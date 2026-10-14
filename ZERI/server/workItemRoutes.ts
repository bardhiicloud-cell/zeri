import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldPath, type Firestore, type Query } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { WORKFLOWS, WORK_KINDS, type WorkKind } from '../src/lib/workflow/definitions';
import { availableActions, workRolesOf } from '../src/lib/workflow/transition';
import { chooseWorker } from '../src/lib/workflow/assignment';
import { measurePerformance } from '../src/lib/workflow/performance';
import { summarizeOrganization, workloadState, type OrgItem, type OrgWorker } from '../src/lib/workflow/workload';
import { DEFAULT_SLA } from '../src/lib/workflow/escalation';
import {
  CONFIG, NOTIFICATIONS, PROFILES, WORK, applyWorkTransition, assignPending, autoAssign, createWorkItem, getSla, mayCreate, runEscalations,
  toAssignable, toWorker, upsertProfile, validateCreate, validateProfilePatch, type Named, type ProfileDoc, type WorkItemDoc,
} from './workItems';

/**
 * The HTTP surface of the work-item system. Thin on purpose: each route decides who is
 * asking, narrows the query to what that role may see, and hands the rest to
 * server/workItems.ts, where the rules live and the transactions run.
 *
 *   GET  /api/v1/work/items?view=mine|unassigned|attention|overdue|open|worker|done[&kind&municipality&uid&limit&cursor]
 *   GET  /api/v1/work/items/:id
 *   POST /api/v1/work/items                              create (and auto-assign unless autoAssign:false)
 *   POST /api/v1/work/items/:id/transition               { action, note, reason, evidence, assigneeUid, expectedVersion }
 *   POST /api/v1/work/items/:id/auto-assign              { dryRun? }  explain or apply the engine's choice
 *   GET  /api/v1/work/overview                           organisation summary (managers, observers)
 *   GET  /api/v1/work/workers?q&municipality&availability&role&state&limit&cursor
 *   GET  /api/v1/work/workers/:uid                       profile, open work, performance
 *   PUT  /api/v1/work/workers/:uid                       manager: skills, capacity, schedule…; self: availability only
 *   POST /api/v1/work/workers/sync                       create profiles for staff accounts that have none
 *   GET|PUT /api/v1/work/config/sla
 *   GET  /api/v1/work/notifications     POST /api/v1/work/notifications/read { ids }
 *   GET  /api/v1/work/health            POST /api/v1/work/run-escalations
 *   GET  /api/v1/work/export/items?view=…&format=csv
 */
export const PAGE_DEFAULT = 50;
export const PAGE_MAX = 100;
export const OVERVIEW_ITEM_CAP = 5000;
export const OVERVIEW_WORKER_CAP = 2000;
/** The organisation summary reads thousands of documents; managers poll it, so it is shared for this long. */
export const OVERVIEW_CACHE_MS = 20_000;

export type ListView = 'mine' | 'unassigned' | 'attention' | 'overdue' | 'open' | 'worker' | 'done';
const VIEWS: readonly ListView[] = ['mine', 'unassigned', 'attention', 'overdue', 'open', 'worker', 'done'];

export type Filter = [field: string, op: '==' | '<=', value: unknown];
export type ListPlan =
  | { outcome: 'ok'; filters: Filter[]; orderField: string; direction: 'asc' | 'desc' }
  | { outcome: 'deny'; status: 403 | 400; error: string };

const denyList = (status: 403 | 400, error: string): ListPlan => ({ outcome: 'deny', status, error });

/**
 * Which records a role may list, and in what order. Pure, so the isolation between roles
 * is tested without a database. The narrowing is part of the query itself, never a filter
 * applied afterwards to rows already read.
 */
export function planList(
  actor: { uid: string; role: string; municipality?: string },
  query: { view?: string; kind?: string; uid?: string },
  nowMs: number
): ListPlan {
  const view = (query.view ?? 'mine') as ListView;
  if (!VIEWS.includes(view)) return denyList(400, 'Pamja nuk njihet.');
  const roles = workRolesOf(actor);
  const oversight = roles.has('manager') || roles.has('observer');
  const kind = WORK_KINDS.includes(query.kind as WorkKind) ? (query.kind as WorkKind) : null;

  if (view === 'mine') {
    if (!roles.size) return denyList(403, 'Kjo llogari nuk punon me detyra.');
    return { outcome: 'ok', filters: [['assigneeUid', '==', actor.uid], ['open', '==', true]], orderField: 'dueAtMs', direction: 'asc' };
  }
  if (view === 'worker') {
    if (!oversight) return denyList(403, 'Vetëm menaxherët shohin punën e një personi tjetër.');
    if (!query.uid) return denyList(400, 'Zgjidhni personin.');
    return { outcome: 'ok', filters: [['assigneeUid', '==', query.uid], ['open', '==', true]], orderField: 'dueAtMs', direction: 'asc' };
  }
  if (view === 'unassigned' || view === 'attention' || view === 'overdue') {
    if (!oversight) return denyList(403, 'Kjo pamje është për menaxherët.');
    if (view === 'unassigned') return { outcome: 'ok', filters: [['assigneeUid', '==', null], ['open', '==', true]], orderField: 'createdAtMs', direction: 'asc' };
    if (view === 'attention') return { outcome: 'ok', filters: [['needsAttention', '==', true], ['open', '==', true]], orderField: 'dueAtMs', direction: 'asc' };
    return { outcome: 'ok', filters: [['open', '==', true], ['dueAtMs', '<=', nowMs]], orderField: 'dueAtMs', direction: 'asc' };
  }

  // open / done: the whole queue for oversight; a municipality's own referrals; the debate cases for moderators.
  const open = view === 'open';
  const order = open ? { orderField: 'dueAtMs', direction: 'asc' as const } : { orderField: 'doneAtMs', direction: 'desc' as const };
  if (oversight) {
    const filters: Filter[] = [['open', '==', open]];
    if (kind) filters.unshift(['kind', '==', kind]);
    return { outcome: 'ok', filters, ...order };
  }
  if (roles.has('municipality')) {
    if (!actor.municipality) return denyList(403, 'Llogaria komunale nuk ka komunë të caktuar.');
    return { outcome: 'ok', filters: [['municipality', '==', actor.municipality], ['kind', '==', 'report_referral'], ['open', '==', open]], ...order };
  }
  if (roles.has('moderator')) {
    return { outcome: 'ok', filters: [['kind', '==', 'moderation_case'], ['open', '==', open]], ...order };
  }
  if (roles.has('agent') && !open) {
    return { outcome: 'ok', filters: [['assigneeUid', '==', actor.uid], ['open', '==', false]], ...order };
  }
  return denyList(403, 'Roli juaj nuk e liston radhën e plotë; përdorni "Detyrat e mia".');
}

/** May this account see this one item? Same boundaries as `planList`, for the single-item routes. */
export function canRead(actor: { uid: string; role: string; municipality?: string }, item: Pick<WorkItemDoc, 'kind' | 'municipality' | 'assigneeUid' | 'subjectUid'>): boolean {
  const roles = workRolesOf(actor);
  if (roles.has('manager') || roles.has('observer')) return true;
  if (item.assigneeUid === actor.uid) return true;
  if (roles.has('municipality')) return item.kind === 'report_referral' && Boolean(actor.municipality) && item.municipality === actor.municipality;
  if (roles.has('moderator')) return item.kind === 'moderation_case';
  if (roles.has('citizen')) return item.kind === 'moderation_case' && item.subjectUid === actor.uid;
  return false;
}

/** What leaves the server for an item: no dedupe key, no internal counters, and the subject only for those who decide. */
export function itemView(id: string, item: WorkItemDoc, actor: { role: string }) {
  const roles = workRolesOf(actor);
  const { dedupeKey: _dedupe, subjectUid, ...rest } = item;
  return { id, ...rest, ...(roles.has('manager') || roles.has('moderator') ? { subjectUid } : {}) };
}

/**
 * What of an item's history a given account may read. Staff who run the work (managers, the
 * monitoring role, the holder, and moderators on a debate case) read everything. Anyone else who
 * may see the item (a municipality on its referral, the person a moderation case is about) sees
 * what happened and when, but not the notes, reasons or evidence staff wrote, and not who the
 * staff member was. Their own entries are shown in full.
 */
export function eventView(
  event: Record<string, unknown> & { id: string },
  actor: { uid: string; role: string },
  item: Pick<WorkItemDoc, 'kind' | 'assigneeUid'>
): Record<string, unknown> {
  const roles = workRolesOf(actor);
  const full = roles.has('manager') || roles.has('observer') || item.assigneeUid === actor.uid
    || (roles.has('moderator') && item.kind === 'moderation_case') || event.actorUid === actor.uid;
  if (full) return event;
  const sees = (event.actorRole === 'municipality' ? 'komuna' : 'platforma');
  return { id: event.id, type: event.type, action: event.action ?? null, from: event.from ?? null, to: event.to ?? null, atMs: event.atMs, by: sees };
}

const encodeCursor = (value: unknown, id: string) => Buffer.from(JSON.stringify([value, id])).toString('base64url');
function decodeCursor(raw: unknown): [unknown, string] | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    return Array.isArray(parsed) && typeof parsed[1] === 'string' ? [parsed[0], parsed[1]] : null;
  } catch { return null; }
}

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
export const ITEM_CSV_HEADERS = ['ID', 'Lloji', 'Titulli', 'Statusi', 'Prioriteti', 'Komuna', 'Departamenti', 'I caktuar', 'Afati', 'Krijuar', 'Mbyllur', 'Vonuar (orë)', 'Kthyer për korrigjim', 'Rihapur'] as const;
export function itemsCsv(rows: ReadonlyArray<{ id: string; item: WorkItemDoc }>, nowMs: number): string {
  const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : '');
  const lines = rows.map(({ id, item }) => [
    id, item.kind, item.title, item.status, item.priority, item.municipality, item.department, item.assigneeName || item.assigneeUid || '',
    iso(item.dueAtMs), iso(item.createdAtMs), iso(item.doneAtMs),
    item.open && item.dueAtMs < nowMs ? Math.round((nowMs - item.dueAtMs) / 3_600_000) : '', item.reworkCount, item.reopenCount,
  ].map(csvCell).join(','));
  return [ITEM_CSV_HEADERS.map(csvCell).join(','), ...lines].join('\n');
}

export interface WorkRouteDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  authAdmin: () => Auth;
  actingUser: (req: Request) => { uid: string; email: string; role: string; municipality: string; permissions: string[] };
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
  now?: () => number;
}

const asLimit = (raw: unknown) => Math.max(1, Math.min(PAGE_MAX, Number.parseInt(String(raw ?? PAGE_DEFAULT), 10) || PAGE_DEFAULT));
const clean = (value: unknown, max = 128) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export function registerWorkItemRoutes(app: Express, deps: WorkRouteDeps): void {
  const now = deps.now ?? Date.now;
  const base = '/api/v1/work';
  let overviewCache: { at: number; body: unknown } | null = null;

  /** The acting account with the display name the history records. */
  const who = async (req: Request): Promise<Named> => {
    const actor = deps.actingUser(req);
    let name = '';
    try { name = String((await deps.db().collection('users').doc(actor.uid).get()).data()?.name ?? ''); } catch { /* display only */ }
    return { uid: actor.uid, role: actor.role, permissions: actor.permissions, municipality: actor.municipality, name: name || actor.email };
  };
  const isOversight = (actor: Named) => { const roles = workRolesOf(actor); return roles.has('manager') || roles.has('observer'); };
  const isManager = (actor: Named) => workRolesOf(actor).has('manager');
  const guard = (res: Response, ok: boolean, message = 'Nuk keni qasje.') => { if (!ok) res.status(403).json({ error: message }); return ok; };
  const serverError = (res: Response, label: string, error: unknown) => {
    console.error(`[WORK] ${label}:`, (error as Error)?.message);
    return res.status(500).json({ error: 'Veprimi nuk u krye. Provoni përsëri.' });
  };

  /* ---------- items ---------- */

  app.get(`${base}/items`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    const plan = planList(actor, { view: clean(req.query.view, 20) || 'mine', kind: clean(req.query.kind, 30), uid: clean(req.query.uid) }, now());
    if (plan.outcome === 'deny') return res.status(plan.status).json({ error: plan.error });
    try {
      let query: Query = deps.db().collection(WORK);
      for (const [field, op, value] of plan.filters) query = query.where(field, op, value);
      query = query.orderBy(plan.orderField, plan.direction).orderBy(FieldPath.documentId(), plan.direction);
      const cursor = decodeCursor(req.query.cursor);
      if (cursor) query = query.startAfter(cursor[0], cursor[1]);
      const limit = asLimit(req.query.limit);
      const snap = await query.limit(limit + 1).get();
      const docs = snap.docs.slice(0, limit);
      const last = docs[docs.length - 1];
      return res.json({
        items: docs.map(doc => itemView(doc.id, doc.data() as WorkItemDoc, actor)),
        nextCursor: snap.docs.length > limit && last ? encodeCursor((last.data() as Record<string, unknown>)[plan.orderField], last.id) : null,
      });
    } catch (error) { return serverError(res, 'list', error); }
  });

  app.get(`${base}/items/:id`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    try {
      const ref = deps.db().collection(WORK).doc(String(req.params.id));
      const snap = await ref.get();
      if (!snap.exists || !canRead(actor, snap.data() as WorkItemDoc)) return res.status(404).json({ error: 'Detyra nuk u gjet.' });
      const item = snap.data() as WorkItemDoc;
      const events = await ref.collection('events').orderBy('atMs').limit(300).get();
      const actions = availableActions(actor, {
        kind: item.kind, status: item.status, assigneeUid: item.assigneeUid, municipality: item.municipality, subjectUid: item.subjectUid ?? undefined,
        decidedBy: item.decidedBy, requiresReview: item.requiresReview, requiresEvidence: item.requiresEvidence,
      }).map(def => ({ action: def.action, label: def.label, requires: def.requires ?? [], to: def.to }));
      return res.json({
        item: itemView(snap.id, item, actor),
        events: events.docs.map(doc => eventView({ id: doc.id, ...doc.data() }, actor, item)),
        actions,
        workflow: { kind: item.kind, states: WORKFLOWS[item.kind].states },
      });
    } catch (error) { return serverError(res, 'read', error); }
  });

  app.post(`${base}/items`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    const checked = validateCreate(req.body);
    if (checked.outcome === 'invalid') return res.status(400).json({ error: checked.error });
    if (!guard(res, mayCreate(actor, checked.value.kind), 'Roli juaj nuk hap këtë lloj pune.')) return;
    try {
      const at = now();
      const created = await createWorkItem(deps.db(), actor, checked.value, at, await getSla(deps.db()));
      deps.audit('work.create', req, { id: created.id, kind: checked.value.kind, created: created.created });
      const assigned = created.created && checked.value.autoAssign ? await autoAssign(deps.db(), created.id, at) : null;
      return res.status(created.created ? 201 : 200).json({ id: created.id, created: created.created, assignment: assigned });
    } catch (error) { return serverError(res, 'create', error); }
  });

  app.post(`${base}/items/:id/transition`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    const itemId = String(req.params.id);
    try {
      // A person who cannot see the item learns nothing about it, not even that a rule refused them.
      const snap = await deps.db().collection(WORK).doc(itemId).get();
      if (!snap.exists || !canRead(actor, snap.data() as WorkItemDoc)) return res.status(404).json({ error: 'Detyra nuk u gjet.' });
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await applyWorkTransition(deps.db(), {
        itemId, actor, nowMs: now(), mode: 'manual',
        request: { action: clean(body.action, 40), note: body.note, reason: body.reason, evidence: body.evidence, assigneeUid: body.assigneeUid },
        expectedVersion: typeof body.expectedVersion === 'number' ? body.expectedVersion : null,
      });
      if (result.outcome === 'fail') {
        deps.audit('work.transition.denied', req, { id: itemId, action: body.action, code: result.code });
        return res.status(result.status).json({ error: result.error, code: result.code });
      }
      deps.audit('work.transition', req, { id: itemId, action: body.action, to: result.status, override: result.override });
      return res.json({ id: result.id, status: result.status, assigneeUid: result.assigneeUid, version: result.version, override: result.override });
    } catch (error) { return serverError(res, 'transition', error); }
  });

  app.post(`${base}/items/:id/auto-assign`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    if (!guard(res, isManager(actor), 'Vetëm menaxherët caktojnë punë.')) return;
    const itemId = String(req.params.id);
    try {
      const snap = await deps.db().collection(WORK).doc(itemId).get();
      if (!snap.exists) return res.status(404).json({ error: 'Detyra nuk u gjet.' });
      const item = snap.data() as WorkItemDoc;
      if (item.assigneeUid || item.status !== WORKFLOWS[item.kind].initial) return res.status(409).json({ error: 'Kjo detyrë tashmë ka një mbajtës ose është përtej fazës së caktimit.' });
      if (req.body?.dryRun === true) {
        const pool = await deps.db().collection(PROFILES).where('role', 'in', [...WORKFLOWS[item.kind].assigneeRoles]).limit(1000).get();
        const choice = chooseWorker(toAssignable(item, itemId), pool.docs.map(doc => toWorker(doc.data() as ProfileDoc)), now());
        return res.json({ dryRun: true, ...choice });
      }
      const result = await autoAssign(deps.db(), itemId, now());
      deps.audit('work.auto-assign', req, { id: itemId, outcome: result.outcome });
      return res.json(result);
    } catch (error) { return serverError(res, 'auto-assign', error); }
  });

  /* ---------- overview, workers ---------- */

  app.get(`${base}/overview`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    if (!guard(res, isOversight(actor), 'Pamja e organizatës është për menaxherët.')) return;
    // The summary is the same for every manager and monitor, so one read serves them all. `fresh=1` skips it.
    if (overviewCache && Date.now() - overviewCache.at < OVERVIEW_CACHE_MS && req.query.fresh !== '1') return res.json(overviewCache.body);
    try {
      const db = deps.db();
      const [items, profiles, sla] = await Promise.all([
        db.collection(WORK).where('open', '==', true).orderBy('createdAtMs').limit(OVERVIEW_ITEM_CAP)
          .select('kind', 'status', 'priority', 'assigneeUid', 'municipality', 'dueAtMs', 'createdAtMs', 'needsAttention').get(),
        db.collection(PROFILES).limit(OVERVIEW_WORKER_CAP).get(),
        getSla(db),
      ]);
      const orgItems: OrgItem[] = items.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<OrgItem, 'id'>) }));
      const orgWorkers: OrgWorker[] = profiles.docs.map(doc => { const p = doc.data() as ProfileDoc; return { uid: p.uid, name: p.name, role: p.role, municipality: p.municipality, department: p.department, capacity: p.capacity, load: p.load, availability: p.availability, disabled: p.disabled }; });
      const body = {
        generatedAtMs: now(),
        summary: summarizeOrganization(orgItems, orgWorkers, now(), sla),
        truncated: { items: items.size >= OVERVIEW_ITEM_CAP, workers: profiles.size >= OVERVIEW_WORKER_CAP },
      };
      overviewCache = { at: Date.now(), body };
      return res.json(body);
    } catch (error) { return serverError(res, 'overview', error); }
  });

  app.get(`${base}/workers`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    if (!guard(res, isOversight(actor), 'Direktoria e punonjësve është për menaxherët.')) return;
    try {
      let query: Query = deps.db().collection(PROFILES);
      const municipality = clean(req.query.municipality, 60);
      const availability = clean(req.query.availability, 20);
      const role = clean(req.query.role, 30);
      const q = clean(req.query.q, 60).toLowerCase();
      if (municipality) query = query.where('municipality', '==', municipality);
      if (availability) query = query.where('availability', '==', availability);
      if (role) query = query.where('role', '==', role);
      if (q) query = query.where('nameLower', '>=', q).where('nameLower', '<=', `${q}`);
      query = query.orderBy('nameLower').orderBy(FieldPath.documentId());
      const cursor = decodeCursor(req.query.cursor);
      if (cursor) query = query.startAfter(cursor[0], cursor[1]);
      const limit = asLimit(req.query.limit);
      const snap = await query.limit(limit + 1).get();
      const docs = snap.docs.slice(0, limit);
      const state = clean(req.query.state, 20);
      const rows = docs.map(doc => {
        const p = doc.data() as ProfileDoc;
        return { ...p, state: workloadState(p), utilization: p.capacity > 0 ? Math.round((p.load / p.capacity) * 100) / 100 : null };
      }).filter(row => !state || row.state === state);
      const last = docs[docs.length - 1];
      return res.json({ workers: rows, nextCursor: snap.docs.length > limit && last ? encodeCursor((last.data() as ProfileDoc).nameLower, last.id) : null });
    } catch (error) { return serverError(res, 'workers', error); }
  });

  app.get(`${base}/workers/:uid`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    const uid = String(req.params.uid);
    if (!guard(res, isOversight(actor) || actor.uid === uid)) return;
    try {
      const db = deps.db();
      const at = now();
      const profileSnap = await db.collection(PROFILES).doc(uid).get();
      if (!profileSnap.exists) return res.status(404).json({ error: 'Personi nuk ka profil pune.' });
      const profile = profileSnap.data() as ProfileDoc;
      const [open, done] = await Promise.all([
        db.collection(WORK).where('assigneeUid', '==', uid).where('open', '==', true).orderBy('dueAtMs').limit(100).get(),
        db.collection(WORK).where('assigneeUid', '==', uid).where('open', '==', false).where('doneAtMs', '>=', at - 30 * 86_400_000).orderBy('doneAtMs', 'desc').limit(200).get(),
      ]);
      const openItems = open.docs.map(doc => ({ id: doc.id, ...(doc.data() as WorkItemDoc) }));
      const finished = done.docs.map(doc => doc.data() as WorkItemDoc);
      const performance = measurePerformance({
        finished: finished.filter(item => item.doneAtMs !== null).map(item => ({ weight: item.weight, createdAtMs: item.createdAtMs, completedAtMs: item.doneAtMs as number, dueAtMs: item.dueAtMs, reworkCount: item.reworkCount, reopenCount: item.reopenCount })),
        open: openItems.map(item => ({ weight: item.weight, dueAtMs: item.dueAtMs })),
        nowMs: at, expectedWeightedOutput: Math.max(1, profile.capacity * 2),
      });
      return res.json({
        profile: { ...profile, state: workloadState(profile) },
        open: openItems.map(item => itemView(item.id, item, actor)),
        recentFinished: finished.length,
        // Measured by the system from the record. A manager's own assessment is a separate thing and is not mixed in here.
        performance: { source: 'system', periodDays: 30, ...performance },
      });
    } catch (error) { return serverError(res, 'worker', error); }
  });

  app.put(`${base}/workers/:uid`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    const uid = String(req.params.uid);
    const self = actor.uid === uid && !isManager(actor);
    if (!guard(res, isManager(actor) || self, 'Mund të ndryshoni vetëm disponueshmërinë tuaj.')) return;
    const checked = validateProfilePatch(req.body, self ? 'self' : 'manager');
    if (checked.outcome === 'invalid') return res.status(400).json({ error: checked.error });
    try {
      const ref = deps.db().collection(PROFILES).doc(uid);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Personi nuk ka profil pune.' });
      await ref.update({ ...checked.patch, updatedAtMs: now() });
      deps.audit('work.profile', req, { uid, fields: Object.keys(checked.patch), self });
      return res.json({ ok: true });
    } catch (error) { return serverError(res, 'profile', error); }
  });

  app.post(`${base}/workers/sync`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    if (!guard(res, isManager(actor), 'Vetëm menaxherët sinkronizojnë profilet.')) return;
    try {
      const roles = [...new Set(Object.values(WORKFLOWS).flatMap(workflow => workflow.assigneeRoles))];
      const uids: string[] = [];
      for (let start = 0; start < roles.length; start += 10) {
        const snap = await deps.db().collection('users').where('role', 'in', roles.slice(start, start + 10)).limit(2000).get();
        uids.push(...snap.docs.map(doc => doc.id));
      }
      let created = 0; let updated = 0;
      for (let start = 0; start < uids.length; start += 100) {
        const found = await deps.authAdmin().getUsers(uids.slice(start, start + 100).map(uid => ({ uid })));
        for (const user of found.users) {
          const claims = (user.customClaims ?? {}) as Record<string, unknown>;
          const role = String(claims.role ?? ''); // authority comes from the verified claim, never from the profile document
          if (!roles.includes(role)) continue;
          const exists = (await deps.db().collection(PROFILES).doc(user.uid).get()).exists;
          await upsertProfile(deps.db(), user.uid, { name: user.displayName || user.email || user.uid, role, municipality: String(claims.municipality ?? ''), disabled: user.disabled === true }, now());
          if (exists) updated += 1; else created += 1;
        }
      }
      deps.audit('work.profiles.sync', req, { created, updated });
      return res.json({ created, updated });
    } catch (error) { return serverError(res, 'sync', error); }
  });

  /* ---------- configuration, health, scheduler ---------- */

  app.get(`${base}/config/sla`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    if (!guard(res, isOversight(actor))) return;
    try { return res.json({ sla: await getSla(deps.db()), defaults: DEFAULT_SLA }); } catch (error) { return serverError(res, 'sla', error); }
  });

  app.put(`${base}/config/sla`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    if (!guard(res, isManager(actor), 'Vetëm menaxherët ndryshojnë afatet.')) return;
    const body = (req.body ?? {}) as Record<string, Record<string, unknown>>;
    const out: Record<string, Record<string, number>> = {};
    for (const key of ['dueHours', 'unassignedAlertMinutes', 'stalledAfterHours']) {
      const values = body[key];
      if (values === undefined) continue;
      out[key] = {};
      for (const priority of ['low', 'normal', 'high', 'urgent']) {
        const n = Number(values?.[priority]);
        if (!Number.isFinite(n) || n <= 0 || n > 100_000) return res.status(400).json({ error: 'Afatet duhet të jenë numra pozitivë.' });
        out[key][priority] = n;
      }
    }
    if (!Object.keys(out).length) return res.status(400).json({ error: 'Asgjë për të ruajtur.' });
    try {
      await deps.db().collection(CONFIG).doc('sla').set({ ...out, updatedAtMs: now(), updatedBy: actor.uid }, { merge: true });
      deps.audit('work.sla', req, { keys: Object.keys(out) });
      return res.json({ sla: await getSla(deps.db()) });
    } catch (error) { return serverError(res, 'sla-save', error); }
  });

  app.get(`${base}/health`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    if (!guard(res, isOversight(actor))) return;
    try {
      const db = deps.db();
      const runtime = (await db.collection(CONFIG).doc('runtime').get()).data() ?? null;
      const count = async (query: Query) => (await query.count().get()).data().count;
      const [open, unassigned, attention] = await Promise.all([
        count(db.collection(WORK).where('open', '==', true)),
        count(db.collection(WORK).where('assigneeUid', '==', null).where('open', '==', true)),
        count(db.collection(WORK).where('needsAttention', '==', true).where('open', '==', true)),
      ]);
      const lastRunAtMs = runtime?.lastRunAtMs ?? null;
      return res.json({
        scheduler: { ...runtime, stale: lastRunAtMs === null || now() - lastRunAtMs > 5 * 60_000 },
        items: { open, unassigned, needsAttention: attention },
      });
    } catch (error) { return serverError(res, 'health', error); }
  });

  app.post(`${base}/run-escalations`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    if (!guard(res, isManager(actor), 'Vetëm menaxherët nisin kontrollin e afateve.')) return;
    try {
      const run = await runEscalations(deps.db(), now());
      deps.audit('work.escalations.run', req, { ...run });
      return res.json(run);
    } catch (error) { return serverError(res, 'escalations', error); }
  });

  /* ---------- notifications ---------- */

  app.get(`${base}/notifications`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    try {
      const db = deps.db();
      const mine = db.collection(NOTIFICATIONS).where('toUid', '==', actor.uid).orderBy('atMs', 'desc').limit(50).get();
      const shared = isManager(actor) ? db.collection(NOTIFICATIONS).where('toRole', '==', 'manager').orderBy('atMs', 'desc').limit(50).get() : Promise.resolve(null);
      const [a, b] = await Promise.all([mine, shared]);
      const rows = [...a.docs, ...(b?.docs ?? [])].map(doc => {
        const data = doc.data();
        return { id: doc.id, itemId: data.itemId, kind: data.kind, action: data.action, title: data.title, atMs: data.atMs, level: data.level ?? null, read: data.readAtMs != null || Boolean(data.readBy?.[actor.uid]) };
      }).sort((x, y) => y.atMs - x.atMs).slice(0, 50);
      return res.json({ notifications: rows, unread: rows.filter(row => !row.read).length });
    } catch (error) { return serverError(res, 'notifications', error); }
  });

  app.post(`${base}/notifications/read`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).map(id => clean(id)).filter(Boolean).slice(0, 100) : [];
    if (!ids.length) return res.status(400).json({ error: 'Zgjidhni njoftimet.' });
    try {
      const db = deps.db();
      const batch = db.batch();
      let marked = 0;
      for (const id of ids) {
        const ref = db.collection(NOTIFICATIONS).doc(id);
        const snap = await ref.get();
        if (!snap.exists) continue;
        const data = snap.data() as { toUid?: string; toRole?: string };
        if (data.toUid === actor.uid) { batch.update(ref, { readAtMs: now() }); marked += 1; }
        else if (data.toRole === 'manager' && isManager(actor)) { batch.update(ref, { [`readBy.${actor.uid}`]: now() }); marked += 1; }
      }
      await batch.commit();
      return res.json({ marked });
    } catch (error) { return serverError(res, 'notifications-read', error); }
  });

  /* ---------- export ---------- */

  app.get(`${base}/export/items`, deps.requireAuth, async (req, res) => {
    const actor = await who(req);
    if (!guard(res, isManager(actor), 'Eksporti është për menaxherët.')) return;
    const plan = planList(actor, { view: clean(req.query.view, 20) || 'open', kind: clean(req.query.kind, 30), uid: clean(req.query.uid) }, now());
    if (plan.outcome === 'deny') return res.status(plan.status).json({ error: plan.error });
    try {
      let query: Query = deps.db().collection(WORK);
      for (const [field, op, value] of plan.filters) query = query.where(field, op, value);
      const snap = await query.orderBy(plan.orderField, plan.direction).limit(OVERVIEW_ITEM_CAP).get();
      deps.audit('work.export', req, { view: req.query.view, rows: snap.size });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="detyra-${new Date(now()).toISOString().slice(0, 10)}.csv"`);
      return res.send(`﻿${itemsCsv(snap.docs.map(doc => ({ id: doc.id, item: doc.data() as WorkItemDoc })), now())}`);
    } catch (error) { return serverError(res, 'export', error); }
  });
}

/** Runs the escalation check on a timer. Safe from any number of servers: see runEscalations. */
export function startWorkScheduler(db: () => Firestore, intervalMs = 60_000): () => void {
  const timer = setInterval(() => {
    void runEscalations(db(), Date.now())
      .then(() => assignPending(db(), Date.now()))
      .catch(error => console.warn('[WORK] scheduled run failed:', (error as Error)?.message));
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}


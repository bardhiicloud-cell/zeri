import { createHash } from 'node:crypto';
import { FieldValue, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { KOSOVO_MUNICIPALITIES } from '../src/lib/constants';
import { PRIORITIES, WORKFLOWS, WORK_KINDS, isTerminalState, type WorkKind, type WorkPriority } from '../src/lib/workflow/definitions';
import { MIN_REASON, decideTransition, workRolesOf, type TransitionRequest, type WorkActor, type WorkItemFacts } from '../src/lib/workflow/transition';
import { chooseWorker, type AssignableItem, type Availability, type RejectReason, type WorkSchedule, type Worker } from '../src/lib/workflow/assignment';
import { DEFAULT_SLA, dueAtFor, evaluateEscalations, raisePriority, type EscalationEvent, type SlaConfig } from '../src/lib/workflow/escalation';
import { loadDeltas } from '../src/lib/workflow/load';

/**
 * Work items: the shared record behind the manager, agent, municipality and debate
 * consoles.
 *
 * Everything that changes a work item goes through `applyWorkTransition`, one Firestore
 * transaction that (1) re-reads the item, (2) asks the engine whether the move is allowed,
 * (3) re-checks the person being given the work, and (4) writes the new state, the person's
 * load, the audit event and the notifications together. If any step fails nothing is
 * written. Clients never write these collections (firestore.rules); they read them.
 *
 *   workItems/{id}                 the item
 *   workItems/{id}/events/{id}     append-only history: who did what, when, why
 *   workerProfiles/{uid}           skills, capacity, availability, schedule, current load
 *   workNotifications/{id}         what each role or person should be told
 *   workflowConfig/{sla|runtime}   deadline rules; the scheduler's last run
 */
export const WORK = 'workItems';
export const PROFILES = 'workerProfiles';
export const NOTIFICATIONS = 'workNotifications';
export const CONFIG = 'workflowConfig';

export const MAX_TITLE = 200;
export const MAX_DESCRIPTION = 2000;
export const SYSTEM_ACTOR: WorkActor & { name: string } = { uid: 'system', role: 'superadmin', permissions: [], name: 'Sistemi' };

export interface WorkItemDoc {
  kind: WorkKind;
  title: string;
  description: string;
  priority: WorkPriority;
  status: string;
  /** False once the item reached a terminal state. Indexed: the scheduler reads only open items. */
  open: boolean;
  assigneeUid: string | null;
  assigneeName: string;
  municipality: string;
  department: string;
  category: string;
  requiredSkills: string[];
  preferredSkills: string[];
  weight: number;
  requiresReview: boolean;
  requiresEvidence: boolean;
  subjectUid: string | null;
  link: { reportId?: string; postId?: string; institution?: string };
  createdBy: string;
  createdByName: string;
  createdAtMs: number;
  updatedAtMs: number;
  assignedAtMs: number | null;
  acceptedAtMs: number | null;
  doneAtMs: number | null;
  dueAtMs: number;
  lastActivityAtMs: number;
  escalationLevel: number;
  unassignedAlerts: number;
  stalledReportedFor: number | null;
  manualEscalations: number;
  needsAttention: boolean;
  reworkCount: number;
  reopenCount: number;
  decidedBy: string | null;
  version: number;
  dedupeKey: string | null;
}

export interface ProfileDoc {
  uid: string;
  name: string;
  /** Lower-cased name: the indexed field a name search runs on. */
  nameLower: string;
  role: string;
  municipality: string;
  department: string;
  skills: string[];
  capacity: number;
  availability: Availability;
  schedule: WorkSchedule | null;
  disabled: boolean;
  /** Weighted work held in active states. Changed only by the item transaction that causes it. */
  load: number;
  activeCount: number;
  lastAssignedAtMs: number | null;
  updatedAtMs: number;
}

/* ------------------------------------------------------------------ */
/* Creating                                                            */
/* ------------------------------------------------------------------ */

export interface CreateValue {
  kind: WorkKind;
  title: string;
  description: string;
  priority: WorkPriority;
  municipality: string;
  department: string;
  category: string;
  requiredSkills: string[];
  preferredSkills: string[];
  weight: number;
  requiresReview: boolean;
  requiresEvidence: boolean;
  subjectUid: string | null;
  link: WorkItemDoc['link'];
  dueAtMs: number | null;
  dedupeKey: string | null;
}

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const strings = (value: unknown, count: number, max: number): string[] =>
  Array.isArray(value) ? [...new Set(value.map(item => str(item, max)).filter(Boolean))].slice(0, count) : [];

export type CreateValidation = { outcome: 'ok'; value: CreateValue } | { outcome: 'invalid'; error: string };

/** Pure: is this a well-formed request to create a work item? */
export function validateCreate(raw: unknown): CreateValidation {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const kind = body.kind as WorkKind;
  if (!WORK_KINDS.includes(kind)) return { outcome: 'invalid', error: 'Lloji i punës nuk njihet.' };
  const title = str(body.title, MAX_TITLE);
  if (title.length < 3) return { outcome: 'invalid', error: 'Titulli duhet të ketë të paktën 3 shkronja.' };
  const priority = (body.priority ?? 'normal') as WorkPriority;
  if (!PRIORITIES.includes(priority)) return { outcome: 'invalid', error: 'Prioriteti nuk njihet.' };
  const municipality = str(body.municipality, 60);
  if (municipality && !KOSOVO_MUNICIPALITIES.includes(municipality)) return { outcome: 'invalid', error: 'Komuna nuk është e njohur.' };
  const weight = body.weight === undefined ? 1 : Number(body.weight);
  if (!Number.isInteger(weight) || weight < 1 || weight > 10) return { outcome: 'invalid', error: 'Pesha duhet të jetë numër nga 1 në 10.' };
  const dueAtMs = body.dueAtMs === undefined || body.dueAtMs === null ? null : Number(body.dueAtMs);
  if (dueAtMs !== null && !Number.isFinite(dueAtMs)) return { outcome: 'invalid', error: 'Afati nuk është i vlefshëm.' };
  const linkRaw = (body.link && typeof body.link === 'object' ? body.link : {}) as Record<string, unknown>;
  const link: WorkItemDoc['link'] = {};
  for (const key of ['reportId', 'postId', 'institution'] as const) { const value = str(linkRaw[key], 128); if (value) link[key] = value; }
  const dedupeKey = str(body.dedupeKey, 200) || null;
  return {
    outcome: 'ok',
    value: {
      kind, title, description: str(body.description, MAX_DESCRIPTION), priority, municipality,
      department: str(body.department, 80), category: str(body.category, 80),
      requiredSkills: strings(body.requiredSkills, 10, 40), preferredSkills: strings(body.preferredSkills, 10, 40),
      weight, requiresReview: body.requiresReview === true, requiresEvidence: body.requiresEvidence === true,
      subjectUid: str(body.subjectUid, 128) || null, link, dueAtMs, dedupeKey,
    },
  };
}

/** Who may open which kind of work. */
export function mayCreate(actor: Pick<WorkActor, 'role'>, kind: WorkKind): boolean {
  const roles = workRolesOf(actor);
  if (roles.has('manager')) return true;
  return kind === 'moderation_case' && roles.has('moderator');
}

export interface Named extends WorkActor { name?: string }

const idFor = (dedupeKey: string) => `dd_${createHash('sha1').update(dedupeKey).digest('hex').slice(0, 32)}`;

export async function getSla(db: Firestore): Promise<SlaConfig> {
  try {
    const data = (await db.collection(CONFIG).doc('sla').get()).data();
    if (!data) return DEFAULT_SLA;
    const merge = (base: Record<WorkPriority, number>, extra: unknown) => {
      const out = { ...base };
      if (extra && typeof extra === 'object') for (const key of PRIORITIES) { const n = Number((extra as Record<string, unknown>)[key]); if (Number.isFinite(n) && n > 0 && n < 100_000) out[key] = n; }
      return out;
    };
    return {
      dueHours: merge(DEFAULT_SLA.dueHours, data.dueHours),
      unassignedAlertMinutes: merge(DEFAULT_SLA.unassignedAlertMinutes, data.unassignedAlertMinutes),
      stalledAfterHours: merge(DEFAULT_SLA.stalledAfterHours, data.stalledAfterHours),
      ladder: DEFAULT_SLA.ladder,
    };
  } catch {
    return DEFAULT_SLA;
  }
}

/**
 * Create an item in its workflow's first state. With a `dedupeKey` the id is derived from
 * the key, so the same event arriving twice (a retry, two servers) creates one item.
 */
export async function createWorkItem(db: Firestore, actor: Named, value: CreateValue, nowMs: number, sla: SlaConfig = DEFAULT_SLA): Promise<{ id: string; created: boolean }> {
  const workflow = WORKFLOWS[value.kind];
  const ref = value.dedupeKey ? db.collection(WORK).doc(idFor(value.dedupeKey)) : db.collection(WORK).doc();
  const doc: WorkItemDoc = {
    kind: value.kind, title: value.title, description: value.description, priority: value.priority,
    status: workflow.initial, open: true, assigneeUid: null, assigneeName: '',
    municipality: value.municipality, department: value.department, category: value.category,
    requiredSkills: value.requiredSkills, preferredSkills: value.preferredSkills, weight: value.weight,
    requiresReview: value.requiresReview, requiresEvidence: value.requiresEvidence,
    subjectUid: value.subjectUid, link: value.link,
    createdBy: actor.uid, createdByName: actor.name ?? '', createdAtMs: nowMs, updatedAtMs: nowMs,
    assignedAtMs: null, acceptedAtMs: null, doneAtMs: null,
    dueAtMs: value.dueAtMs ?? dueAtFor(value.priority, nowMs, sla), lastActivityAtMs: nowMs,
    escalationLevel: 0, unassignedAlerts: 0, stalledReportedFor: null, manualEscalations: 0,
    needsAttention: false, reworkCount: 0, reopenCount: 0, decidedBy: null, version: 1, dedupeKey: value.dedupeKey,
  };
  const batch = db.batch();
  batch.create(ref, doc);
  batch.create(ref.collection('events').doc(), { type: 'created', actorUid: actor.uid, actorRole: actor.role, to: workflow.initial, atMs: nowMs });
  try {
    await batch.commit();
  } catch (error) {
    // ALREADY_EXISTS: the same event was seen before. Not an error; the item is there.
    if ((error as { code?: number }).code === 6) return { id: ref.id, created: false };
    throw error;
  }
  return { id: ref.id, created: true };
}

/* ------------------------------------------------------------------ */
/* Workers                                                             */
/* ------------------------------------------------------------------ */

const AVAILABILITIES: readonly Availability[] = ['available', 'busy', 'away', 'off'];

export function toWorker(profile: ProfileDoc): Worker {
  return {
    uid: profile.uid, name: profile.name, role: profile.role, municipality: profile.municipality || undefined,
    department: profile.department || undefined, skills: profile.skills ?? [], capacity: profile.capacity,
    load: profile.load ?? 0, availability: profile.availability, schedule: profile.schedule ?? undefined,
    disabled: profile.disabled === true, lastAssignedAtMs: profile.lastAssignedAtMs ?? null,
  };
}

export function toAssignable(item: WorkItemDoc, id: string): AssignableItem {
  return {
    id, kind: item.kind, priority: item.priority, municipality: item.municipality || undefined, department: item.department || undefined,
    requiredSkills: item.requiredSkills, preferredSkills: item.preferredSkills, weight: item.weight, dueAtMs: item.dueAtMs,
  };
}

const facts = (item: WorkItemDoc): WorkItemFacts => ({
  kind: item.kind, status: item.status, assigneeUid: item.assigneeUid, municipality: item.municipality || undefined,
  subjectUid: item.subjectUid ?? undefined, decidedBy: item.decidedBy, requiresReview: item.requiresReview, requiresEvidence: item.requiresEvidence,
});

export interface ProfilePatch {
  skills?: unknown; capacity?: unknown; availability?: unknown; schedule?: unknown; department?: unknown;
  disabled?: unknown; name?: unknown; municipality?: unknown;
}

export type ProfileValidation = { outcome: 'ok'; patch: Partial<ProfileDoc> } | { outcome: 'invalid'; error: string };

/** Pure: what may be changed on a profile, and by whom. A person edits only their own availability. */
export function validateProfilePatch(raw: unknown, mode: 'manager' | 'self'): ProfileValidation {
  const body = (raw && typeof raw === 'object' ? raw : {}) as ProfilePatch;
  const patch: Partial<ProfileDoc> = {};
  if (body.availability !== undefined) {
    if (!AVAILABILITIES.includes(body.availability as Availability)) return { outcome: 'invalid', error: 'Disponueshmëria nuk njihet.' };
    patch.availability = body.availability as Availability;
  }
  if (mode === 'self') {
    const extra = Object.keys(body).filter(key => key !== 'availability');
    if (extra.length) return { outcome: 'invalid', error: 'Mund të ndryshoni vetëm disponueshmërinë tuaj.' };
    return Object.keys(patch).length ? { outcome: 'ok', patch } : { outcome: 'invalid', error: 'Asgjë për të ndryshuar.' };
  }
  if (body.capacity !== undefined) {
    const capacity = Number(body.capacity);
    if (!Number.isInteger(capacity) || capacity < 0 || capacity > 100) return { outcome: 'invalid', error: 'Kapaciteti duhet të jetë numër nga 0 në 100.' };
    patch.capacity = capacity;
  }
  if (body.skills !== undefined) patch.skills = strings(body.skills, 30, 40);
  if (body.department !== undefined) patch.department = str(body.department, 80);
  if (body.name !== undefined) { patch.name = str(body.name, 120); patch.nameLower = patch.name.toLowerCase(); }
  if (body.disabled !== undefined) patch.disabled = body.disabled === true;
  if (body.municipality !== undefined) {
    const municipality = str(body.municipality, 60);
    if (municipality && !KOSOVO_MUNICIPALITIES.includes(municipality)) return { outcome: 'invalid', error: 'Komuna nuk është e njohur.' };
    patch.municipality = municipality;
  }
  if (body.schedule !== undefined) {
    if (body.schedule === null) patch.schedule = null;
    else {
      const schedule = body.schedule as Record<string, unknown>;
      const days = Array.isArray(schedule.days) ? [...new Set(schedule.days.map(Number))].filter(day => Number.isInteger(day) && day >= 0 && day <= 6) : [];
      const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (!days.length || !clock.test(String(schedule.start)) || !clock.test(String(schedule.end)) || String(schedule.start) >= String(schedule.end)) {
        return { outcome: 'invalid', error: 'Orari nuk është i vlefshëm (ditë, fillim, fund).' };
      }
      patch.schedule = { days, start: String(schedule.start), end: String(schedule.end) };
    }
  }
  return Object.keys(patch).length ? { outcome: 'ok', patch } : { outcome: 'invalid', error: 'Asgjë për të ndryshuar.' };
}

export async function upsertProfile(db: Firestore, uid: string, base: Pick<ProfileDoc, 'name' | 'role' | 'municipality'> & Partial<ProfileDoc>, nowMs: number): Promise<void> {
  const ref = db.collection(PROFILES).doc(uid);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      // Identity fields follow the account (claims); the manager's settings are left alone.
      tx.update(ref, { name: base.name, nameLower: base.name.toLowerCase(), role: base.role, municipality: base.municipality, disabled: base.disabled === true, updatedAtMs: nowMs });
    } else {
      tx.create(ref, {
        uid, name: base.name, nameLower: base.name.toLowerCase(), role: base.role, municipality: base.municipality, department: base.department ?? '', skills: base.skills ?? [],
        capacity: base.capacity ?? 5, availability: base.availability ?? 'available', schedule: base.schedule ?? null, disabled: base.disabled === true,
        load: 0, activeCount: 0, lastAssignedAtMs: null, updatedAtMs: nowMs,
      } satisfies ProfileDoc);
    }
  });
}

/** Recompute a person's load from the items they actually hold. For repair and for the health check. */
export async function recomputeLoad(db: Firestore, uid: string, nowMs: number): Promise<{ load: number; activeCount: number }> {
  const snap = await db.collection(WORK).where('assigneeUid', '==', uid).where('open', '==', true).get();
  let load = 0;
  let activeCount = 0;
  for (const doc of snap.docs) {
    const item = doc.data() as WorkItemDoc;
    if (WORKFLOWS[item.kind].states[item.status]?.active) { load += item.weight; activeCount += 1; }
  }
  await db.collection(PROFILES).doc(uid).set({ load, activeCount, updatedAtMs: nowMs }, { merge: true });
  return { load, activeCount };
}

/* ------------------------------------------------------------------ */
/* Transitions                                                         */
/* ------------------------------------------------------------------ */

// `outcome` is a string discriminant: the project does not enable strictNullChecks, so a union on `ok: boolean` would not narrow.
export type TxFailure = { ok: false; outcome: 'fail'; status: 400 | 403 | 404 | 409; code: string; error: string };
export type TxResult =
  | { ok: true; outcome: 'ok'; id: string; status: string; assigneeUid: string | null; version: number; override: boolean }
  | TxFailure;

const fail = (status: TxFailure['status'], code: string, error: string): TxFailure => ({ ok: false, outcome: 'fail', status, code, error });

/** Rules a manager may not override: who may hold which work at all. */
const HARD: ReadonlySet<RejectReason> = new Set(['disabled', 'role', 'municipality', 'excluded']);

const SOFT_MESSAGE: Partial<Record<RejectReason, string>> = {
  department: 'departamentin e gabuar',
  skill: 'aftësitë e kërkuara mungojnë',
  unavailable: 'nuk është i disponueshëm',
  off_hours: 'është jashtë orarit të punës',
  capacity: 'ka arritur kapacitetin',
};

export interface ApplyParams {
  itemId: string;
  actor: Named;
  request: TransitionRequest;
  nowMs: number;
  /** `auto`: the assignment engine chose; nothing may be overridden. */
  mode?: 'manual' | 'auto';
  expectedVersion?: number | null;
}

const NOTE_TITLES = (label: string, title: string) => `${label}: ${title}`.slice(0, 200);

export async function applyWorkTransition(db: Firestore, params: ApplyParams): Promise<TxResult> {
  const { itemId, actor, request, nowMs } = params;
  const mode = params.mode ?? 'manual';
  const itemRef = db.collection(WORK).doc(itemId);

  return db.runTransaction<TxResult>(async tx => {
    const snap = await tx.get(itemRef);
    if (!snap.exists) return fail(404, 'NOT_FOUND', 'Detyra nuk u gjet.');
    const item = snap.data() as WorkItemDoc;
    if (params.expectedVersion != null && params.expectedVersion !== item.version) {
      return fail(409, 'STALE', 'Detyra u ndryshua nga dikush tjetër. Rifreskoni dhe provoni përsëri.');
    }

    const decision = decideTransition({ actor, item: facts(item), request });
    if (decision.outcome === 'deny') return fail(decision.status, decision.code, decision.error);

    const newAssignee = decision.assigneeUid === undefined ? item.assigneeUid : decision.assigneeUid;
    const holderChanged = newAssignee !== item.assigneeUid;

    // Everyone whose load changes, read before anything is written.
    const deltas = loadDeltas({ kind: item.kind, fromStatus: item.status, toStatus: decision.to, fromAssignee: item.assigneeUid, toAssignee: newAssignee, weight: item.weight });
    const counts = loadDeltas({ kind: item.kind, fromStatus: item.status, toStatus: decision.to, fromAssignee: item.assigneeUid, toAssignee: newAssignee, weight: 1 });
    const involved = new Set<string>([...deltas.keys(), ...(holderChanged && newAssignee ? [newAssignee] : [])]);
    const profiles = new Map<string, ProfileDoc | null>();
    for (const uid of involved) {
      const profileSnap = await tx.get(db.collection(PROFILES).doc(uid));
      profiles.set(uid, profileSnap.exists ? (profileSnap.data() as ProfileDoc) : null);
    }

    // Giving the work to someone: that person must exist, be allowed to hold it, and have room.
    let softOverride: RejectReason | null = null;
    if (holderChanged && newAssignee) {
      const target = profiles.get(newAssignee);
      if (!target) return fail(409, 'NO_PROFILE', 'Personi nuk ka profil pune (aftësi, kapacitet).');
      const outcome = chooseWorker({ ...toAssignable(item, itemId) }, [toWorker(target)], nowMs);
      if (outcome.outcome === 'unassigned') {
        const rejected = outcome.considered[0].rejected as RejectReason;
        if (mode === 'auto') return fail(409, 'STALE_CHOICE', 'Personi i zgjedhur nuk është më i përshtatshëm.');
        if (HARD.has(rejected)) return fail(409, 'NOT_ELIGIBLE', 'Ky person nuk mund ta mbajë këtë punë (rol, komunë ose llogari e pezulluar).');
        if (decision.reason.length < MIN_REASON) {
          return fail(409, 'OVERRIDE_REASON_REQUIRED', `Ky person ${SOFT_MESSAGE[rejected] ?? 'nuk përshtatet'}. Për ta caktuar gjithsesi shkruani një arsye.`);
        }
        softOverride = rejected;
      }
    }

    // ── writes ──
    const terminalNow = isTerminalState(item.kind, decision.to);
    const update: Record<string, unknown> = {
      status: decision.to, open: !terminalNow, version: item.version + 1, updatedAtMs: nowMs, lastActivityAtMs: nowMs,
    };
    if (holderChanged) {
      update.assigneeUid = newAssignee;
      update.assigneeName = newAssignee ? profiles.get(newAssignee)?.name ?? '' : '';
      update.assignedAtMs = newAssignee ? nowMs : null;
      update.needsAttention = false;
    }
    if (decision.def.action === 'accept' || decision.def.action === 'acknowledge') update.acceptedAtMs = nowMs;
    if (decision.def.rework) update.reworkCount = FieldValue.increment(1);
    if (decision.def.reopen) { update.reopenCount = FieldValue.increment(1); update.doneAtMs = null; update.open = true; }
    if (['confirm_violation', 'dismiss', 'overturn', 'uphold'].includes(decision.def.action)) update.decidedBy = actor.uid;
    if (terminalNow || ['done', 'resolved'].includes(decision.to)) update.doneAtMs = nowMs;
    if (decision.def.action === 'escalate') { update.manualEscalations = FieldValue.increment(1); update.needsAttention = true; }
    tx.update(itemRef, update);

    for (const [uid, delta] of deltas) {
      const profile = profiles.get(uid);
      if (!profile) continue;
      const patch: Record<string, unknown> = { load: FieldValue.increment(delta), activeCount: FieldValue.increment(counts.get(uid) ?? 0), updatedAtMs: nowMs };
      if (delta > 0) patch.lastAssignedAtMs = nowMs;
      tx.update(db.collection(PROFILES).doc(uid), patch);
    }

    tx.create(itemRef.collection('events').doc(), {
      type: 'transition', action: decision.def.action, from: item.status, to: decision.to,
      actorUid: actor.uid, actorRole: actor.role, actorName: actor.name ?? '', auto: mode === 'auto',
      override: decision.override, softOverride,
      reason: decision.reason, note: decision.note, evidence: decision.evidence,
      fromAssignee: item.assigneeUid, toAssignee: newAssignee, atMs: nowMs,
    });

    for (const target of decision.def.notify ?? []) {
      const base = { itemId, kind: item.kind, title: NOTE_TITLES(decision.def.label, item.title), atMs: nowMs, readAtMs: null as number | null, action: decision.def.action };
      if (target === 'assignee' && newAssignee && newAssignee !== actor.uid) tx.create(db.collection(NOTIFICATIONS).doc(), { ...base, toUid: newAssignee });
      else if (target === 'previous_assignee' && item.assigneeUid && item.assigneeUid !== newAssignee) tx.create(db.collection(NOTIFICATIONS).doc(), { ...base, toUid: item.assigneeUid });
      else if (target === 'creator' && item.createdBy && item.createdBy !== actor.uid && item.createdBy !== 'system') tx.create(db.collection(NOTIFICATIONS).doc(), { ...base, toUid: item.createdBy });
      else if (target === 'managers') tx.create(db.collection(NOTIFICATIONS).doc(), { ...base, toRole: 'manager' });
    }

    return { ok: true, outcome: 'ok', id: itemId, status: decision.to, assigneeUid: newAssignee, version: item.version + 1, override: decision.override || softOverride !== null };
  });
}

/* ------------------------------------------------------------------ */
/* Automatic assignment                                                */
/* ------------------------------------------------------------------ */

export type AutoAssignResult =
  | { outcome: 'assigned'; uid: string; score: unknown }
  | { outcome: 'unassigned'; rejectedBy: Partial<Record<RejectReason, number>> }
  | { outcome: 'not_applicable' | 'not_found' | 'contention' };

const MAX_ATTEMPTS = 5;

/**
 * Choose a worker with the engine and give them the item. The choice is made outside the
 * transaction; the transaction re-checks that person (capacity, availability) against the
 * live profile, so two requests racing for the last free place cannot both win: the loser
 * gets `STALE_CHOICE` and chooses again from fresh data.
 */
export async function autoAssign(db: Firestore, itemId: string, nowMs: number): Promise<AutoAssignResult> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const snap = await db.collection(WORK).doc(itemId).get();
    if (!snap.exists) return { outcome: 'not_found' };
    const item = snap.data() as WorkItemDoc;
    if (item.assigneeUid || item.status !== WORKFLOWS[item.kind].initial) return { outcome: 'not_applicable' };

    const roles = [...WORKFLOWS[item.kind].assigneeRoles];
    const pool = await db.collection(PROFILES)
      .where('availability', '==', 'available').where('disabled', '==', false).where('role', 'in', roles).limit(1000).get();
    const workers = pool.docs.map(doc => toWorker(doc.data() as ProfileDoc));
    const choice = chooseWorker(toAssignable(item, itemId), workers, nowMs);

    if (choice.outcome === 'unassigned') {
      // Nobody qualifies: it stays in the unassigned queue and the supervisor is told (once per hour at most).
      const hour = Math.floor(nowMs / 3_600_000);
      try {
        const batch = db.batch();
        batch.create(db.collection(WORK).doc(itemId).collection('events').doc(`noworker_${hour}`), {
          type: 'no_eligible_worker', rejectedBy: choice.rejectedBy, atMs: nowMs, actorUid: 'system', actorRole: 'system',
        });
        batch.update(db.collection(WORK).doc(itemId), { needsAttention: true, updatedAtMs: nowMs });
        batch.create(db.collection(NOTIFICATIONS).doc(`noworker_${itemId}_${hour}`), {
          itemId, kind: item.kind, toRole: 'manager', action: 'no_eligible_worker', title: NOTE_TITLES('Asnjë person i përshtatshëm', item.title), atMs: nowMs, readAtMs: null,
        });
        await batch.commit();
      } catch (error) {
        if ((error as { code?: number }).code !== 6) throw error; // already recorded this hour
      }
      return { outcome: 'unassigned', rejectedBy: choice.rejectedBy };
    }

    let result: TxResult;
    try {
      result = await applyWorkTransition(db, { itemId, actor: SYSTEM_ACTOR, request: { action: 'assign', assigneeUid: choice.uid }, nowMs, mode: 'auto' });
    } catch (error) {
      // The transaction lost to others writing the same documents more times than Firestore retries
      // (ABORTED) or was told to back off: choose again from fresh data.
      const code = (error as { code?: number }).code;
      if (code === 10 || code === 4 || code === 14) continue;
      throw error;
    }
    if (result.outcome === 'ok') return { outcome: 'assigned', uid: choice.uid, score: choice.score };
    if (result.code === 'STALE_CHOICE' || result.code === 'STALE') continue;
    if (result.code === 'WRONG_STATE') return { outcome: 'not_applicable' };
    throw new Error(`autoAssign: ${result.code} ${result.error}`);
  }
  return { outcome: 'contention' };
}

/* ------------------------------------------------------------------ */
/* Escalation                                                          */
/* ------------------------------------------------------------------ */

export interface EscalationRun { scanned: number; applied: number; skipped: number; failed: number; startedAtMs: number }

async function applyEscalation(db: Firestore, itemId: string, key: string, nowMs: number, sla: SlaConfig): Promise<'applied' | 'skipped'> {
  const itemRef = db.collection(WORK).doc(itemId);
  const eventRef = itemRef.collection('events').doc(key);
  return db.runTransaction<'applied' | 'skipped'>(async tx => {
    const [itemSnap, eventSnap] = await Promise.all([tx.get(itemRef), tx.get(eventRef)]);
    if (!itemSnap.exists || eventSnap.exists) return 'skipped'; // gone, or already done: nothing to repeat
    const item = itemSnap.data() as WorkItemDoc;
    const due = evaluateEscalations(escalatable(itemId, item), nowMs, sla).find(event => event.key === key);
    if (!due) return 'skipped'; // no longer applicable (the item moved on since it was scanned)

    const update: Record<string, unknown> = { updatedAtMs: nowMs };
    if (due.type === 'overdue') {
      update.escalationLevel = due.level;
      if (due.action === 'raise_priority') update.priority = raisePriority(item.priority);
      if (due.action === 'needs_manager_attention' || due.action === 'notify_managers') update.needsAttention = true;
    } else if (due.type === 'unassigned') {
      update.unassignedAlerts = due.level;
      update.needsAttention = true;
    } else {
      update.stalledReportedFor = item.lastActivityAtMs;
    }
    tx.update(itemRef, update);
    tx.create(eventRef, { type: 'escalation', escalation: due.type, level: due.level, action: due.action, atMs: nowMs, actorUid: 'system', actorRole: 'system' });
    tx.create(db.collection(NOTIFICATIONS).doc(`esc_${key.replace(/[^A-Za-z0-9_:-]/g, '_')}`), {
      itemId, kind: item.kind, toRole: 'manager', action: `escalation_${due.type}`, level: due.level,
      title: NOTE_TITLES(due.type === 'overdue' ? `Vonesë (niveli ${due.level})` : due.type === 'unassigned' ? 'Pa caktuar' : 'Pa lëvizje', item.title), atMs: nowMs, readAtMs: null,
    });
    return 'applied';
  });
}

export function escalatable(id: string, item: WorkItemDoc) {
  return {
    id, kind: item.kind, status: item.status, priority: item.priority, assigneeUid: item.assigneeUid,
    createdAtMs: item.createdAtMs, dueAtMs: item.dueAtMs, lastActivityAtMs: item.lastActivityAtMs,
    escalationLevel: item.escalationLevel, unassignedAlerts: item.unassignedAlerts, stalledReportedFor: item.stalledReportedFor,
  };
}

/**
 * Walk every open item and apply the escalations that are due. Safe to run as often as
 * wanted, from any number of servers, and after a crash: each escalation is written
 * under its own key, and a key that already exists is skipped (see applyEscalation).
 */
export async function runEscalations(db: Firestore, nowMs: number, options: { pageSize?: number; maxItems?: number } = {}): Promise<EscalationRun> {
  const pageSize = options.pageSize ?? 300;
  const maxItems = options.maxItems ?? 20_000;
  const sla = await getSla(db);
  const run: EscalationRun = { scanned: 0, applied: 0, skipped: 0, failed: 0, startedAtMs: nowMs };
  let cursor: number | null = null;

  while (run.scanned < maxItems) {
    let query = db.collection(WORK).where('open', '==', true).orderBy('createdAtMs').limit(pageSize);
    if (cursor !== null) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (const doc of page.docs) {
      run.scanned += 1;
      const events: EscalationEvent[] = evaluateEscalations(escalatable(doc.id, doc.data() as WorkItemDoc), nowMs, sla);
      for (const event of events) {
        try {
          if ((await applyEscalation(db, doc.id, event.key, nowMs, sla)) === 'applied') run.applied += 1; else run.skipped += 1;
        } catch {
          run.failed += 1;
        }
      }
    }
    cursor = (page.docs[page.docs.length - 1].data() as WorkItemDoc).createdAtMs;
    if (page.size < pageSize) break;
  }

  await db.collection(CONFIG).doc('runtime').set({
    lastRunAtMs: nowMs, lastRunOk: run.failed === 0, scanned: run.scanned, applied: run.applied, failed: run.failed,
    ...(run.failed ? { lastFailureAtMs: nowMs } : {}),
  }, { merge: true });
  return run;
}

export type { DocumentReference };

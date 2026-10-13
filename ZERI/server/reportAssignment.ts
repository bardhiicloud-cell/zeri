import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { pipelineRoleOf } from './approvalPipeline';
import { permissionsFromClaims } from './auth';

/**
 * Who holds a report while it is checked, as a person and not as text.
 *
 * `assignedTo` used to be free text: whatever label the claim wrote. Two agents
 * with the same name were one person, a renamed agent lost their queue, and "my
 * reports" or "how much is each agent carrying" could not be counted. A report
 * now also carries `assignedToUid` (and when and by whom), so:
 *   - "Merr përsipër" (claim) records the person who claimed;
 *   - the owner can hand a report to a specific agent, or take it back;
 *   - an agent can release a report they hold, so it returns to the shared queue.
 *
 * Only reports still at the front of the queue (Draft, Pending Review) are
 * assigned here. Once approved they are the municipality's to answer.
 */

const ASSIGNABLE_STATUSES = ['Draft', 'Pending Review'];

export const MIN_HANDOVER_REASON = 5;
export const MAX_HANDOVER_REASON = 300;

export interface AssignmentInput {
  actor: { uid: string; role: string; permissions: readonly string[] };
  report: { status?: unknown; assignedToUid?: unknown } | null;
  /** The agent to hand the report to, or null to release it. */
  target: { uid: string; role: string; permissions: readonly string[]; disabled: boolean } | null;
  release: boolean;
  /** Why work is being taken from, or moved between, people. Required for those cases. */
  reason?: unknown;
  /**
   * Who the caller saw holding the report ('' = nobody). When given and the stored
   * holder differs, someone else changed it in the meantime and nothing is written.
   */
  expectedHolderUid?: string | null;
}

export type AssignmentDecision =
  | { outcome: 'allow'; kind: 'assign' | 'release'; reason: string }
  | { outcome: 'deny'; status: 400 | 403 | 404 | 409; error: string };

const deny = (status: 400 | 403 | 404 | 409, error: string): AssignmentDecision => ({ outcome: 'deny', status, error });

/** Pure: may this actor give this report to this person, or release it? */
export function decideAssignment(input: AssignmentInput): AssignmentDecision {
  const actorRole = pipelineRoleOf(input.actor.role, input.actor.permissions);
  // The dispatcher's job is to distribute work (owner decision 2026-10-13, docs/DISPATCHER_PERMISSION_MATRIX.md).
  // The role comes from the verified token, never from a `permissions` grant, so an agent with extra sections is not a dispatcher.
  const isOwner = actorRole === 'staff' || input.actor.role === 'dispatcher';
  if (actorRole !== 'staff' && actorRole !== 'agent') return deny(403, 'Kjo llogari nuk cakton punë.');
  if (!input.report) return deny(404, 'Raporti nuk u gjet.');
  if (!ASSIGNABLE_STATUSES.includes(String(input.report.status ?? ''))) {
    return deny(409, 'Ky raportim nuk është më në radhën e shqyrtimit; nuk caktohet.');
  }
  const holder = String(input.report.assignedToUid ?? '');

  // Two people acting on the same screen: the second one must see the first one's change.
  if (typeof input.expectedHolderUid === 'string' && input.expectedHolderUid !== holder) {
    return deny(409, 'Raportimi u ndryshua ndërkohë nga dikush tjetër. Rifreskoni dhe provoni përsëri.');
  }

  const reasonText = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reasonText.length > MAX_HANDOVER_REASON) return deny(400, `Arsyeja nuk mund të kalojë ${MAX_HANDOVER_REASON} shenja.`);
  // Taking work away from a person is accountable: it needs a stated reason.
  const needsReason = (target: string) => holder !== '' && holder !== input.actor.uid && holder !== target;
  const reasonError = () => deny(400, `Shkruani arsyen e kalimit të punës (të paktën ${MIN_HANDOVER_REASON} shenja).`);

  if (input.release) {
    if (!holder) return deny(409, 'Raporti nuk e ka askush përsipër.');
    // An agent may give back what they hold; only the owner takes it from someone else.
    if (!isOwner && holder !== input.actor.uid) return deny(403, 'Vetëm ai që e mban, ose administratori, e lëshon.');
    if (needsReason('') && reasonText.length < MIN_HANDOVER_REASON) return reasonError();
    return { outcome: 'allow', kind: 'release', reason: reasonText };
  }

  if (!isOwner) return deny(403, 'Vetëm administratori ose dispatcher-i ia cakton punën dikujt tjetër. Ju mund ta merrni përsipër vetë.');
  if (!input.target) return deny(404, 'Personi nuk u gjet.');
  if (input.target.disabled) return deny(409, 'Llogaria e këtij personi është e pezulluar.');
  if (pipelineRoleOf(input.target.role, input.target.permissions) !== 'agent') {
    return deny(400, 'Raportimet i caktohen vetëm një agjenti.');
  }
  if (holder === input.target.uid) return deny(409, 'Ky person e ka tashmë përsipër.');
  if (needsReason(input.target.uid) && reasonText.length < MIN_HANDOVER_REASON) return reasonError();
  return { outcome: 'allow', kind: 'assign', reason: reasonText };
}

export interface ReportAssignmentDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  authAdmin: () => Auth;
  actingUser: (req: Request) => { uid: string; role: string; permissions: string[] };
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
}

export function registerReportAssignmentRoutes(app: Express, deps: ReportAssignmentDeps): void {
  /** Body: `{ uid }` to hand the report to that agent, or `{ release: true }`. */
  app.post('/api/v1/reports/:id/assign', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const reportId = String(req.params.id ?? '').trim();
    const release = req.body?.release === true;
    const targetUid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : '';
    const expectedHolderUid = typeof req.body?.expectedHolderUid === 'string' ? req.body.expectedHolderUid.trim() : undefined;
    if (!reportId || (!release && !targetUid)) return res.status(400).json({ error: 'Kërkesa nuk është e plotë.' });

    try {
      let target: AssignmentInput['target'] = null;
      let targetName = '';
      if (!release) {
        try {
          const user = await deps.authAdmin().getUser(targetUid);
          const claims = (user.customClaims ?? {}) as Record<string, unknown>;
          target = { uid: user.uid, role: String(claims.role ?? ''), permissions: permissionsFromClaims(claims), disabled: user.disabled };
          const profile = await deps.db().collection('users').doc(targetUid).get();
          targetName = String(profile.data()?.name ?? user.displayName ?? user.email ?? targetUid);
        } catch (error) {
          if ((error as { code?: string })?.code !== 'auth/user-not-found') throw error;
        }
      }

      // Who did it, by name, so the history reads as people and not ids. Best effort: a missing name is stored as ''.
      let actorName = '';
      try { actorName = String((await deps.db().collection('users').doc(actor.uid).get()).data()?.name ?? '').slice(0, 160); } catch { /* history is still written, without the name */ }
      const ref = deps.db().collection('reports').doc(reportId);
      const now = new Date().toISOString();
      const result = await deps.db().runTransaction(async tx => {
        const snap = await tx.get(ref);
        const decision = decideAssignment({
          actor,
          report: snap.exists ? (snap.data() as Record<string, unknown>) : null,
          target,
          release,
          reason: req.body?.reason,
          expectedHolderUid,
        });
        if (decision.outcome === 'deny') return decision;
        const before = snap.data() as Record<string, unknown>;
        const fromUid = String(before.assignedToUid ?? '');
        const trackId = String(before.trackingId ?? '');
        // The handover is recorded in the same transaction as the change it describes.
        tx.set(ref.collection('assignmentHistory').doc(), {
          kind: decision.kind,
          fromUid, fromName: String(before.assignedTo ?? '').slice(0, 160),
          toUid: decision.kind === 'assign' ? target!.uid : '', toName: decision.kind === 'assign' ? targetName.slice(0, 160) : '',
          byUid: actor.uid, byName: actorName, reason: decision.reason, at: now, createdAt: FieldValue.serverTimestamp(),
        });
        // Whoever is handed the work, or loses it, is told. Never the citizen.
        const notify = (userId: string, title: string, message: string) =>
          tx.set(deps.db().collection('notifications').doc(), {
            title, message, channel: 'report', category: 'report', type: 'info', priority: 'normal', urgent: false,
            audience: 'user', userId, reportId, state: 'published',
            link: `/admin#reports?open=${encodeURIComponent(reportId)}`, sender: 'Zëri i Qytetarëve', createdAt: FieldValue.serverTimestamp(),
          });
        const label = trackId ? ` #${trackId}` : '';
        if (decision.kind === 'assign' && target!.uid !== actor.uid) {
          notify(target!.uid, `Ju u caktua një raportim${label}`, decision.reason || 'Raportimi është tani nën përgjegjësinë tuaj.');
        }
        if (fromUid && fromUid !== actor.uid && fromUid !== (decision.kind === 'assign' ? target!.uid : '')) {
          notify(fromUid, `Raportimi${label} kaloi te dikush tjetër`, decision.reason || 'Nuk është më nën përgjegjësinë tuaj.');
        }
        tx.update(
          ref,
          decision.kind === 'release'
            ? { assignedTo: '', assignedToUid: '', assignedAt: null, assignedBy: actor.uid, updatedAt: now }
            : { assignedTo: targetName.slice(0, 160), assignedToUid: target!.uid, assignedAt: now, assignedBy: actor.uid, updatedAt: now }
        );
        return decision;
      });

      if (result.outcome === 'deny') {
        deps.audit('report.assign.denied', req, { reportId, targetUid: targetUid || null, release, reason: result.error });
        return res.status(result.status).json({ error: result.error });
      }
      deps.audit(result.kind === 'release' ? 'report.release' : 'report.assign', req, { reportId, targetUid: targetUid || null, reason: result.reason || null });
      return res.json({ ok: true, assignedToUid: result.kind === 'release' ? '' : targetUid, assignedTo: result.kind === 'release' ? '' : targetName });
    } catch (error) {
      console.error('[REPORTS] assignment failed:', error instanceof Error ? error.message : error);
      return res.status(500).json({ error: 'Caktimi nuk u ruajt. Provoni përsëri.' });
    }
  });

  /** Who held this report, in what order, and why. Staff, agents and the monitor only. */
  app.get('/api/v1/reports/:id/assignments', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    if (!mayReadHandovers(actor)) return res.status(403).json({ error: 'Historiku i caktimeve është vetëm për stafin.' });
    const reportId = String(req.params.id ?? '').trim();
    if (!reportId) return res.status(400).json({ error: 'Kërkesa nuk është e plotë.' });
    try {
      const page = parseHistoryQuery(req.query as Record<string, unknown>);
      if (page.ok === false) return res.status(400).json({ error: page.error });
      let ordered = deps.db().collection('reports').doc(reportId).collection('assignmentHistory').orderBy('at', 'desc');
      if (page.before) ordered = ordered.startAfter(page.before);
      const snap = await ordered.limit(page.limit).get();
      res.setHeader('Cache-Control', 'private, no-store');
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: undefined }));
      // A full page may have more behind it; a short page is the end. The next page starts after this one's oldest entry.
      const oldest = items.length === page.limit ? String((items[items.length - 1] as { at?: unknown }).at ?? '') : '';
      return res.json({ items, nextBefore: oldest || null });
    } catch (error) {
      console.error('[REPORTS] assignment history failed:', error instanceof Error ? error.message : error);
      return res.status(500).json({ error: 'Historiku nuk u ngarkua. Provoni përsëri.' });
    }
  });
}

/**
 * A person left (or lost access): the reports they held at the front of the queue go back to
 * the shared queue, each with a handover entry saying why. Bounded: at most ROUNDS x PER_ROUND
 * reports per call; `remaining` tells the caller if more are still held. Never throws for an
 * empty result; a Firestore failure propagates so the caller can report it truthfully.
 */
export async function releaseHeldReports(
  db: Firestore,
  uid: string,
  byUid: string,
  reason: string
): Promise<{ released: number; remaining: boolean }> {
  const PER_ROUND = 200; // two writes per report, under the 500-write batch limit
  const ROUNDS = 10;
  let released = 0;
  for (let round = 0; round < ROUNDS; round++) {
    const held = await db.collection('reports').where('assignedToUid', '==', uid).where('status', 'in', ASSIGNABLE_STATUSES).limit(PER_ROUND).get();
    if (held.empty) return { released, remaining: false };
    const now = new Date().toISOString();
    const batch = db.batch();
    for (const doc of held.docs) {
      const before = doc.data();
      batch.update(doc.ref, { assignedTo: '', assignedToUid: '', assignedAt: null, assignedBy: byUid, updatedAt: now });
      batch.set(doc.ref.collection('assignmentHistory').doc(), {
        kind: 'release', fromUid: uid, fromName: String(before.assignedTo ?? '').slice(0, 160), toUid: '', toName: '',
        byUid, reason: reason.slice(0, MAX_HANDOVER_REASON), at: now, createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    released += held.size;
    if (held.size < PER_ROUND) return { released, remaining: false };
  }
  return { released, remaining: true };
}

export const HISTORY_PAGE = 20;
export const HISTORY_MAX_PAGE = 50;

/** `limit` 1..50 (default 20) and `before`, the `at` of the oldest entry already shown. Pure. */
export function parseHistoryQuery(raw: Record<string, unknown>): { ok: true; limit: number; before: string } | { ok: false; error: string } {
  let limit = HISTORY_PAGE;
  if (raw.limit !== undefined && raw.limit !== '') {
    const parsed = Number(raw.limit);
    if (!Number.isInteger(parsed) || parsed < 1) return { ok: false, error: 'Kufiri nuk është i vlefshëm.' };
    limit = Math.min(parsed, HISTORY_MAX_PAGE);
  }
  let before = '';
  if (raw.before !== undefined && raw.before !== '') {
    before = String(raw.before);
    if (Number.isNaN(new Date(before).getTime())) return { ok: false, error: 'Kursori nuk është i vlefshëm.' };
  }
  return { ok: true, limit, before };
}

/** Staff and agents, plus the read-only monitor. Pure. */
export function mayReadHandovers(actor: { role: string; permissions: readonly string[] }): boolean {
  return actor.role === 'monitor' || pipelineRoleOf(actor.role, actor.permissions) !== null && pipelineRoleOf(actor.role, actor.permissions) !== 'municipality';
}

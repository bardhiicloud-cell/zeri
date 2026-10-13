import type { Express, Request, RequestHandler, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
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

export interface AssignmentInput {
  actor: { uid: string; role: string; permissions: readonly string[] };
  report: { status?: unknown; assignedToUid?: unknown } | null;
  /** The agent to hand the report to, or null to release it. */
  target: { uid: string; role: string; permissions: readonly string[]; disabled: boolean } | null;
  release: boolean;
}

export type AssignmentDecision =
  | { outcome: 'allow'; kind: 'assign' | 'release' }
  | { outcome: 'deny'; status: 400 | 403 | 404 | 409; error: string };

const deny = (status: 400 | 403 | 404 | 409, error: string): AssignmentDecision => ({ outcome: 'deny', status, error });

/** Pure: may this actor give this report to this person, or release it? */
export function decideAssignment(input: AssignmentInput): AssignmentDecision {
  const actorRole = pipelineRoleOf(input.actor.role, input.actor.permissions);
  const isOwner = actorRole === 'staff';
  if (actorRole !== 'staff' && actorRole !== 'agent') return deny(403, 'Kjo llogari nuk cakton punë.');
  if (!input.report) return deny(404, 'Raporti nuk u gjet.');
  if (!ASSIGNABLE_STATUSES.includes(String(input.report.status ?? ''))) {
    return deny(409, 'Ky raportim nuk është më në radhën e shqyrtimit; nuk caktohet.');
  }
  const holder = String(input.report.assignedToUid ?? '');

  if (input.release) {
    if (!holder) return deny(409, 'Raporti nuk e ka askush përsipër.');
    // An agent may give back what they hold; only the owner takes it from someone else.
    if (!isOwner && holder !== input.actor.uid) return deny(403, 'Vetëm ai që e mban, ose administratori, e lëshon.');
    return { outcome: 'allow', kind: 'release' };
  }

  if (!isOwner) return deny(403, 'Vetëm administratori ia cakton punën dikujt tjetër. Ju mund ta merrni përsipër vetë.');
  if (!input.target) return deny(404, 'Personi nuk u gjet.');
  if (input.target.disabled) return deny(409, 'Llogaria e këtij personi është e pezulluar.');
  if (pipelineRoleOf(input.target.role, input.target.permissions) !== 'agent') {
    return deny(400, 'Raportimet i caktohen vetëm një agjenti.');
  }
  if (holder === input.target.uid) return deny(409, 'Ky person e ka tashmë përsipër.');
  return { outcome: 'allow', kind: 'assign' };
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
        } catch (error: any) {
          if (error?.code !== 'auth/user-not-found') throw error;
        }
      }

      const ref = deps.db().collection('reports').doc(reportId);
      const now = new Date().toISOString();
      const result = await deps.db().runTransaction(async tx => {
        const snap = await tx.get(ref);
        const decision = decideAssignment({
          actor,
          report: snap.exists ? (snap.data() as Record<string, unknown>) : null,
          target,
          release,
        });
        if (decision.outcome === 'deny') return decision;
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
      deps.audit(result.kind === 'release' ? 'report.release' : 'report.assign', req, { reportId, targetUid: targetUid || null });
      return res.json({ ok: true, assignedToUid: result.kind === 'release' ? '' : targetUid, assignedTo: result.kind === 'release' ? '' : targetName });
    } catch (error: any) {
      console.error('[REPORTS] assignment failed:', error?.message);
      return res.status(500).json({ error: 'Caktimi nuk u ruajt. Provoni përsëri.' });
    }
  });
}

import type { Express, Request, RequestHandler, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { MAX_REASON, MIN_REASON } from './userModeration';

/**
 * Removing a staff or municipal account, done on the server.
 *
 * The screen used to delete only the profile document from the browser. The
 * Firebase identity stayed alive with its role claims, so a "deleted" agent could
 * still sign in and call the API until their token expired, and could come back
 * the moment a profile was recreated. Removing an account now ends the identity
 * and its sessions first, then the profile.
 *
 * What is NOT removed is the person's work. Reports, timeline events and the
 * audit log keep their uid and name, so "who did this" stays answerable after
 * they leave. A snapshot of the profile is written to the audit log.
 */

export interface RemovalInput {
  actor: { uid: string; role: string };
  targetUid: string;
  /** From the target's verified claims ('' = none). */
  targetRole: string;
  targetEmail: string;
  reason: unknown;
  /** The admin retypes the account's email; stops a click on the wrong row. */
  confirmEmail: unknown;
}

export type RemovalDecision =
  | { outcome: 'allow'; reason: string }
  | { outcome: 'deny'; status: 400 | 403; error: string };

const deny = (status: 400 | 403, error: string): RemovalDecision => ({ outcome: 'deny', status, error });

/** Roles that are staff or a municipality, i.e. everything except a citizen. */
const REMOVABLE = new Set(['agent', 'responder', 'dispatcher', 'moderator', 'approver', 'newsadmin', 'adsadmin', 'debatwp', 'monitor', 'municipality', 'admin']);

/** May this actor remove this account? Pure: no I/O. */
export function decideStaffRemoval(input: RemovalInput): RemovalDecision {
  if (input.actor.role !== 'admin' && input.actor.role !== 'superadmin') {
    return deny(403, 'Vetëm administratori heq llogari stafi.');
  }
  if (!input.targetUid) return deny(400, 'Llogaria mungon.');
  if (input.targetUid === input.actor.uid) return deny(400, 'Nuk mund ta hiqni llogarinë tuaj.');
  if (input.targetRole === 'superadmin') return deny(403, 'Llogaria e superadminit nuk hiqet nga paneli.');
  if (input.targetRole === 'admin' && input.actor.role !== 'superadmin') {
    return deny(403, 'Vetëm superadmini heq një administrator.');
  }
  if (!REMOVABLE.has(input.targetRole)) {
    return deny(403, 'Kjo është llogari qytetari; moderohet nga Qytetarët (ndalim), jo këtu.');
  }

  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < MIN_REASON) return deny(400, `Arsyeja është e detyrueshme (të paktën ${MIN_REASON} shenja).`);
  if (reason.length > MAX_REASON) return deny(400, `Arsyeja nuk mund të kalojë ${MAX_REASON} shenja.`);

  const typed = typeof input.confirmEmail === 'string' ? input.confirmEmail.trim().toLowerCase() : '';
  if (!input.targetEmail || typed !== input.targetEmail.trim().toLowerCase()) {
    return deny(400, 'Shkruani emailin e llogarisë për të konfirmuar heqjen.');
  }

  return { outcome: 'allow', reason };
}

export interface StaffRemovalDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  authAdmin: () => Auth;
  actingUser: (req: Request) => { uid: string; email: string };
  resolveActorRole: (user: Request['user']) => Promise<string>;
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
}

export function registerStaffRemovalRoutes(app: Express, deps: StaffRemovalDeps): void {
  app.delete('/api/v1/admin/users/:uid', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const role = await deps.resolveActorRole(req.user);
    const targetUid = String(req.params.uid ?? '').trim();

    try {
      let targetRole = '';
      let targetEmail = '';
      try {
        const target = await deps.authAdmin().getUser(targetUid);
        targetRole = String((target.customClaims as Record<string, unknown> | undefined)?.role ?? '');
        targetEmail = target.email ?? '';
      } catch (error: any) {
        if (error?.code === 'auth/user-not-found') return res.status(404).json({ error: 'Llogaria nuk u gjet.' });
        throw error;
      }

      const decision = decideStaffRemoval({
        actor: { uid: actor.uid, role },
        targetUid,
        targetRole,
        targetEmail,
        reason: req.body?.reason,
        confirmEmail: req.body?.confirmEmail,
      });
      if (decision.outcome === 'deny') {
        deps.audit('admin.staff.remove.denied', req, { targetUid, reason: decision.error });
        return res.status(decision.status).json({ error: decision.error });
      }

      const ref = deps.db().collection('users').doc(targetUid);
      const profile = await ref.get();
      const snapshot = profile.exists ? profile.data() ?? {} : {};

      // Close the door first. If a later step fails the person is already out.
      await deps.authAdmin().revokeRefreshTokens(targetUid);
      await deps.authAdmin().deleteUser(targetUid);
      await ref.delete();

      deps.audit('admin.staff.remove', req, {
        targetUid,
        targetEmail,
        targetRole,
        reason: decision.reason,
        // Enough to answer "who was this?" later, without the contact details.
        profile: { name: snapshot.name ?? null, role: snapshot.role ?? null, municipality: snapshot.municipality ?? null, permissions: snapshot.permissions ?? [] },
      });
      return res.json({ ok: true });
    } catch (error: any) {
      console.error('[ADMIN] staff removal failed:', error?.message);
      return res.status(500).json({ error: 'Llogaria nuk u hoq. Provoni përsëri.' });
    }
  });
}

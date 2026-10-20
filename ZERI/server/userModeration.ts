import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { mayUseSection } from './policy';

/**
 * Moderation of citizen accounts, done on the server.
 *
 * The admin screen used to ban, verify and edit users by writing the user
 * document straight from the browser. That had three defects:
 *   - a "ban" only set a flag; the person's sign-in stayed valid, so they could
 *     keep using the API until their token expired;
 *   - the same write path could set `role`, `points` or `isVerified` on anyone, so
 *     the document was a place to escalate privilege from;
 *   - failures were swallowed, so the screen showed a ban that never happened.
 *
 * Here a ban disables the Firebase identity and revokes its sessions, every action
 * is attributed to a verified actor and written to the audit log, and the target
 * must be an ordinary citizen: staff and municipal accounts are managed by their
 * own routes, where escalation rules apply.
 */

export type ModerationAction = 'ban' | 'unban' | 'verify' | 'unverify';
export const MODERATION_ACTIONS: readonly ModerationAction[] = ['ban', 'unban', 'verify', 'unverify'];

export const MIN_REASON = 5;
export const MAX_REASON = 300;

export interface ModerationInput {
  actor: { uid: string; role: string; permissions: readonly string[] };
  targetUid: string;
  /** The target's role as recorded in its verified claims ('' = no claim = citizen). */
  targetRole: string;
  action: unknown;
  reason: unknown;
}

export type ModerationDecision =
  | { outcome: 'allow'; action: ModerationAction; reason: string }
  | { outcome: 'deny'; status: 400 | 403; error: string };

const deny = (status: 400 | 403, error: string): ModerationDecision => ({ outcome: 'deny', status, error });

/** May this actor apply this action to this target? Pure: no I/O. */
export function decideModeration(input: ModerationInput): ModerationDecision {
  if (!mayUseSection({ role: input.actor.role, permissions: input.actor.permissions }, 'users')) {
    return deny(403, 'Roli juaj nuk ka qasje te regjistri i qytetarëve.');
  }
  if (typeof input.action !== 'string' || !(MODERATION_ACTIONS as readonly string[]).includes(input.action)) {
    return deny(400, 'Veprimi nuk njihet.');
  }
  const action = input.action as ModerationAction;

  if (!input.targetUid) return deny(400, 'Llogaria mungon.');
  if (input.targetUid === input.actor.uid) return deny(400, 'Nuk mund të moderoni llogarinë tuaj.');

  // Only ordinary citizens. Any role claim at all means staff or a municipality.
  if (input.targetRole && input.targetRole !== 'citizen') {
    return deny(403, 'Kjo është llogari stafi ose komune; menaxhohet nga seksioni përkatës.');
  }

  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  // A ban is the one action that takes something from a person: it needs a stated
  // reason, which is kept in the audit log.
  if (action === 'ban') {
    if (reason.length < MIN_REASON) return deny(400, `Arsyeja e ndalimit është e detyrueshme (të paktën ${MIN_REASON} shenja).`);
    if (reason.length > MAX_REASON) return deny(400, `Arsyeja nuk mund të kalojë ${MAX_REASON} shenja.`);
  } else if (reason.length > MAX_REASON) {
    return deny(400, `Arsyeja nuk mund të kalojë ${MAX_REASON} shenja.`);
  }

  return { outcome: 'allow', action, reason };
}

export interface UserModerationDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  authAdmin: () => Auth;
  actingUser: (req: Request) => { uid: string; email: string; role: string; municipality: string; permissions: string[] };
  /** Role from verified claims only (see resolveActorRole). */
  resolveActorRole: (user: Request['user']) => Promise<string>;
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
}

export function registerUserModerationRoutes(app: Express, deps: UserModerationDeps): void {
  app.post('/api/v1/admin/users/:uid/moderate', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const role = await deps.resolveActorRole(req.user);
    const targetUid = String(req.params.uid ?? '').trim();

    try {
      // The target's authority is read from its identity record (claims), never
      // from the profile document the browser can touch.
      let targetRole = '';
      try {
        const target = await deps.authAdmin().getUser(targetUid);
        targetRole = String((target.customClaims as Record<string, unknown> | undefined)?.role ?? '');
      } catch (error) {
        if (error?.code === 'auth/user-not-found') return res.status(404).json({ error: 'Llogaria nuk u gjet.' });
        throw error;
      }

      const decision = decideModeration({
        actor: { uid: actor.uid, role, permissions: actor.permissions },
        targetUid,
        targetRole,
        action: req.body?.action,
        reason: req.body?.reason,
      });
      if (decision.outcome === 'deny') {
        deps.audit('admin.user.moderate.denied', req, { targetUid, action: req.body?.action ?? null, reason: decision.error });
        return res.status(decision.status).json({ error: decision.error });
      }

      const { action, reason } = decision;
      const ref = deps.db().collection('users').doc(targetUid);
      const profile = await ref.get();
      if (!profile.exists) return res.status(404).json({ error: 'Profili i përdoruesit nuk u gjet.' });

      if (action === 'ban' || action === 'unban') {
        const banned = action === 'ban';
        // Order matters: close the door first (identity + sessions), then record why.
        await deps.authAdmin().updateUser(targetUid, { disabled: banned });
        if (banned) await deps.authAdmin().revokeRefreshTokens(targetUid);
        await ref.update(
          banned
            ? { isBanned: true, bannedAt: FieldValue.serverTimestamp(), bannedBy: actor.uid, banReason: reason }
            : { isBanned: false, bannedAt: FieldValue.delete(), bannedBy: FieldValue.delete(), banReason: FieldValue.delete(), suspendedUntil: FieldValue.delete(), restriction: FieldValue.delete() }
        );
      } else {
        await ref.update({ isVerified: action === 'verify' });
      }

      deps.audit(`admin.user.${action}`, req, { targetUid, targetEmail: profile.data()?.email ?? null, reason: reason || null });
      return res.json({ ok: true, action });
    } catch (error) {
      console.error('[ADMIN] user moderation failed:', error?.message);
      return res.status(500).json({ error: 'Veprimi nuk u krye. Provoni përsëri.' });
    }
  });
}

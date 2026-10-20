import { randomBytes } from 'node:crypto';
import type { Express, Request, RequestHandler, Response } from 'express';
import { createIpRateLimiter } from './security';

/**
 * A guest session minted by the server.
 *
 * Guests normally sign in with Firebase "Anonymous" auth. When that provider is switched
 * off in the Firebase project, sign-in fails with auth/operation-not-allowed and the
 * visitor was left with a local-only id: no identity, so nothing they did could be
 * stored (reports, photos, health cases) and Storage/Firestore refused every write.
 *
 * This route hands out a custom token for a fresh `guest_…` uid carrying `guest: true`.
 * The browser signs in with it and is a real, persistent Firebase user, with the same
 * limits as an anonymous guest (firestore.rules `isGuest()` reads the claim, and
 * /api/v1/guest/register numbers it).
 */
export const GUEST_UID_PREFIX = 'guest_';

export interface GuestSessionDeps {
  createCustomToken: (uid: string, claims: Record<string, unknown>) => Promise<string>;
  /** Test seam. */
  limiter?: RequestHandler;
  /** Test seam. */
  newUid?: () => string;
}

export function registerGuestSessionRoutes(app: Express, deps: GuestSessionDeps): void {
  const limiter = deps.limiter ?? createIpRateLimiter({
    windowMs: 10 * 60_000, max: 20, floodFactor: 3, banMs: 15 * 60_000,
    message: 'Shumë kërkesa për sesion mysafiri. Provoni përsëri më vonë.', code: 'GUEST_RATE_LIMIT',
  });

  app.post('/api/v1/guest/session', limiter, async (_req: Request, res: Response) => {
    try {
      const uid = deps.newUid ? deps.newUid() : `${GUEST_UID_PREFIX}${randomBytes(16).toString('hex')}`;
      const token = await deps.createCustomToken(uid, { guest: true });
      return res.status(201).json({ token, uid });
    } catch (error) {
      console.error('[GUEST] session failed:', error instanceof Error ? error.message : error);
      return res.status(503).json({ error: 'Sesioni i mysafirit nuk u krijua. Provoni përsëri.' });
    }
  });
}

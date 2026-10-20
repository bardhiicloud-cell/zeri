import type { Express, Request, RequestHandler, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { createIpRateLimiter, getClientIp } from './security';
import { buildPublicTrackView, normalizeTrackingId } from './trackView';

/**
 * Public Track ID lookup: what a citizen holding a tracking id may see.
 *
 * The /trackid page used to read the `reports` collection straight from the
 * browser, which means the filtering of private fields was whatever the page
 * happened to render. This module is the enforced version: the response is built
 * from an allow-list (nothing is copied unless named here), so a field added to a
 * report later stays private until someone decides it is public.
 *
 * What never leaves this module: the author's id or name, the author's contact
 * details, the staff member's personal name or uid, internal notes, AI analysis
 * of the photos, exact coordinates, and the media of a report no reviewer has
 * accepted yet.
 *
 * Enumeration: the id is a capability. It is validated by shape, answered with one
 * identical message whether it is malformed, unknown or not for the public, rate
 * limited per IP, and an IP that keeps missing is cut off sooner than one that
 * keeps hitting.
 */

export {
  TRACKING_ID_PATTERN, normalizeTrackingId, buildPublicTrackView,
} from './trackView';
export type {
  PublicMedia, PublicTimelineEvent, PublicOfficialResponse, ResolutionState, PublicTrackView,
} from './trackView';
export const NOT_FOUND_MESSAGE = 'Nuk u gjet asnjë raportim me këtë Track ID.';

export interface TrackLookupDeps {
  db: () => Firestore;
  /** Test seam: replaces the lookup limiter. */
  limiter?: RequestHandler;
}

/**
 * Misses are what an enumerating client produces, so they are budgeted
 * separately: a person mistyping an id spends two or three, a script spends
 * hundreds. Past the budget the IP is told to wait, whatever it asks next.
 */
const MISS_WINDOW_MS = 15 * 60_000;
const MISS_BUDGET = 12;

export function registerTrackLookupRoutes(app: Express, deps: TrackLookupDeps): void {
  const limiter = deps.limiter ?? createIpRateLimiter({
    windowMs: 10 * 60_000,
    max: 40,
    floodFactor: 3,
    banMs: 15 * 60_000,
    message: 'Shumë kërkime Track ID. Provoni përsëri pas pak minutash.',
    code: 'TRACK_RATE_LIMIT',
  });

  const misses = new Map<string, { count: number; resetAt: number }>();
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of misses) if (entry.resetAt <= now) misses.delete(ip);
  }, MISS_WINDOW_MS);
  if (typeof sweeper.unref === 'function') sweeper.unref();

  const recordMiss = (ip: string) => {
    const now = Date.now();
    const entry = misses.get(ip);
    if (!entry || entry.resetAt <= now) misses.set(ip, { count: 1, resetAt: now + MISS_WINDOW_MS });
    else entry.count += 1;
  };

  const missesExhausted = (ip: string): number => {
    const entry = misses.get(ip);
    if (!entry || entry.resetAt <= Date.now()) return 0;
    return entry.count > MISS_BUDGET ? Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000)) : 0;
  };

  app.get('/api/v1/public/track/:trackingId', limiter, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    const ip = getClientIp(req);
    const wait = missesExhausted(ip);
    if (wait) {
      res.setHeader('Retry-After', String(wait));
      return res.status(429).json({ error: 'Shumë kërkime pa rezultat. Provoni përsëri më vonë.', code: 'TRACK_MISS_LIMIT', retryAfter: wait });
    }

    const trackingId = normalizeTrackingId(req.params.trackingId);
    if (!trackingId) {
      recordMiss(ip);
      return res.status(404).json({ error: NOT_FOUND_MESSAGE, code: 'NOT_FOUND' });
    }

    try {
      const snap = await deps.db().collection('reports').where('trackingId', '==', trackingId).limit(1).get();
      const view = snap.empty ? null : buildPublicTrackView(snap.docs[0].data());
      if (!view) {
        recordMiss(ip);
        return res.status(404).json({ error: NOT_FOUND_MESSAGE, code: 'NOT_FOUND' });
      }
      return res.json({ report: view, generatedAt: new Date().toISOString() });
    } catch (error) {
      console.error('[TRACK] lookup failed:', error?.message);
      return res.status(500).json({ error: 'Kërkimi nuk u krye. Provoni përsëri.', code: 'LOOKUP_FAILED' });
    }
  });
}

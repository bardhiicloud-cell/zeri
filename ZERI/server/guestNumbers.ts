import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { createIpRateLimiter } from './security';

/**
 * Every guest gets a number of their own: Mysafir-0000001, Mysafir-0000002, …
 *
 * A guest is an anonymous Firebase account, which lives on the person's device, so the
 * number follows that phone or browser. The profile used to be written from the browser,
 * which the database rules refuse for a guest: the guest was left with no profile and no
 * stable name. The server now creates it.
 *
 * Numbers come from one counter (`counters/guestNumbers`). A single document can only take
 * about one write per second, so each server process reserves a block of BLOCK_SIZE numbers
 * in one transaction and hands them out from memory. Consequences, by design:
 *   - no number is ever given twice;
 *   - numbers are in order of reservation, not exactly of arrival across processes;
 *   - a process that restarts leaves the rest of its block unused (gaps are possible).
 * 7 digits cover up to 9,999,999 guests; after that the label simply grows a digit.
 */

export const BLOCK_SIZE = 50;
export const LABEL_DIGITS = 7;

export function formatGuestLabel(n: number): string {
  return `Mysafir-${String(n).padStart(LABEL_DIGITS, '0')}`;
}

/** Hands out numbers from reserved blocks, one at a time, safely under concurrency. Pure apart from `reserve`. */
export function createBlockAllocator(reserve: (size: number) => Promise<number>, size = BLOCK_SIZE) {
  let next = 0;
  let end = -1; // empty
  let queue: Promise<unknown> = Promise.resolve();
  return {
    next(): Promise<number> {
      const turn = queue.then(async () => {
        if (next > end) {
          const start = await reserve(size);
          next = start;
          end = start + size - 1;
        }
        return next++;
      });
      // A failed reservation must not poison every later call.
      queue = turn.catch(() => undefined);
      return turn;
    },
  };
}

/** Reserves `size` numbers on the shared counter and returns the first one. */
export function firestoreReserve(db: () => Firestore) {
  return async (size: number): Promise<number> => {
    const ref = db().collection('counters').doc('guestNumbers');
    return db().runTransaction(async tx => {
      const snap = await tx.get(ref);
      const current = Number(snap.data()?.value ?? 0);
      tx.set(ref, { value: current + size, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return current + 1;
    });
  };
}

export interface GuestNumberDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  /** Test seam. */
  limiter?: RequestHandler;
  /** Test seam: replaces the shared counter. */
  reserve?: (size: number) => Promise<number>;
}

/** An anonymous Firebase account, or a guest the server signed in itself (server/guestSession.ts). */
const isAnonymous = (req: Request): boolean => {
  const claims = (req.user as { claims?: { guest?: boolean; firebase?: { sign_in_provider?: string } } } | undefined)?.claims;
  return claims?.firebase?.sign_in_provider === 'anonymous' || claims?.guest === true;
};

export function registerGuestNumberRoutes(app: Express, deps: GuestNumberDeps): void {
  const allocator = createBlockAllocator(deps.reserve ?? firestoreReserve(deps.db));
  // A script creating anonymous accounts could burn numbers; one device needs one.
  const limiter = deps.limiter ?? createIpRateLimiter({
    windowMs: 10 * 60_000, max: 30, floodFactor: 3, banMs: 15 * 60_000,
    message: 'Shumë kërkesa për llogari mysafiri. Provoni përsëri më vonë.', code: 'GUEST_RATE_LIMIT',
  });

  /** Idempotent: the same guest always gets the same number. */
  app.post('/api/v1/guest/register', limiter, deps.requireAuth, async (req: Request, res: Response) => {
    if (!isAnonymous(req)) return res.status(400).json({ error: 'Kjo është vetëm për llogari mysafiri.' });
    const uid = String((req.user as { uid?: string } | undefined)?.uid ?? '');
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const ref = deps.db().collection('users').doc(uid);
    try {
      const existing = await ref.get();
      const known = existing.data();
      if (known && typeof known.guestNumber === 'number') return res.json({ profile: known });

      const number = await allocator.next();
      const profile = await deps.db().runTransaction(async tx => {
        const snap = await tx.get(ref);
        const data = snap.data();
        // Another request for the same guest got there first: keep theirs (this number is then unused).
        if (data && typeof data.guestNumber === 'number') return data;
        const label = formatGuestLabel(number);
        const created = {
          id: uid, name: label, role: 'guest', guestNumber: number, guestLabel: label,
          email: '', points: 0, badges: [], isVerified: false, createdAt: new Date().toISOString(),
        };
        tx.set(ref, created, { merge: true });
        return created;
      });
      return res.status(201).json({ profile });
    } catch (error) {
      console.error('[GUEST] register failed:', error instanceof Error ? error.message : error);
      return res.status(500).json({ error: 'Llogaria e mysafirit nuk u krijua. Provoni përsëri.' });
    }
  });
}

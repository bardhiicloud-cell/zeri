/**
 * Server side of Reels: deleting your own reel for real, and counting views.
 *
 * Deleting used to be a document delete from the browser, which left the video
 * and cover in Storage, the comments under the reel and the reports about it.
 * Now the server removes all of it. Views are counted once per signed-in account
 * (a marker document is the guarantee, as for post impressions); the browser
 * cannot write the counter — the Firestore rules refuse `viewCount`.
 */
import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { createRateLimiter } from './directMessages';

export class ReelError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 403 | 404 | 429, public readonly code: string) {
    super(message);
    this.name = 'ReelError';
  }
}

const isSafeId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128 && !v.includes('/');

/** Storage paths a reel owns. Only paths inside the author's own reel folder are ever deleted. */
export function reelFilePaths(data: Record<string, unknown>, authorId: string): string[] {
  const prefix = `forum_reels/${authorId}/`;
  return [data.mediaPath, data.coverPath].filter(
    (p): p is string => typeof p === 'string' && p.startsWith(prefix) && !p.includes('..') && p.length > prefix.length,
  );
}

export async function deleteReel(
  fs: Firestore,
  input: { reelId: string; uid: string; staff: boolean },
  removeFiles: (paths: string[]) => Promise<void>,
): Promise<{ filesRemoved: number; reportsRemoved: number }> {
  if (!isSafeId(input.reelId) || !isSafeId(input.uid)) throw new ReelError('Kërkesa nuk është e vlefshme.', 400, 'bad_request');
  const ref = fs.collection('forumReels').doc(input.reelId);
  const snap = await ref.get();
  if (!snap.exists) throw new ReelError('Reel-i nuk u gjet.', 404, 'not_found');
  const data = snap.data() as Record<string, unknown>;
  const authorId = String(data.authorId ?? '');
  if (authorId !== input.uid && !input.staff) throw new ReelError('Nuk keni leje ta fshini këtë Reel.', 403, 'forbidden');

  const paths = reelFilePaths(data, authorId);
  // Reports about the reel are closed with it; the reel's comments go with the document tree.
  const reports = await fs.collection('forumReelReports').where('reelId', '==', input.reelId).get();
  await fs.recursiveDelete(ref);
  for (const r of reports.docs) await r.ref.delete();
  // Files last, best effort: a missing file must not make the delete fail after the document is gone.
  try { await removeFiles(paths); } catch (error) { console.warn('[REELS] file cleanup failed:', (error as Error)?.message); }
  return { filesRemoved: paths.length, reportsRemoved: reports.size };
}

/** One view per account; returns the current count. Hidden and missing reels count nothing. */
export async function recordReelView(fs: Firestore, input: { reelId: string; uid: string }): Promise<{ viewCount: number; counted: boolean }> {
  if (!isSafeId(input.reelId) || !isSafeId(input.uid)) throw new ReelError('Kërkesa nuk është e vlefshme.', 400, 'bad_request');
  const ref = fs.collection('forumReels').doc(input.reelId);
  const markerRef = ref.collection('viewers').doc(input.uid);
  return fs.runTransaction(async (tx) => {
    const [reel, marker] = await Promise.all([tx.get(ref), tx.get(markerRef)]);
    if (!reel.exists || reel.data()?.isHidden === true) throw new ReelError('Reel-i nuk u gjet.', 404, 'not_found');
    const current = Number(reel.data()?.viewCount) || 0;
    if (marker.exists) return { viewCount: current, counted: false };
    tx.create(markerRef, { at: FieldValue.serverTimestamp() });
    tx.update(ref, { viewCount: current + 1 });
    return { viewCount: current + 1, counted: true };
  });
}

const STAFF_CLAIMS = ['admin', 'superadmin', 'agent', 'approver', 'newsadmin', 'adsadmin'];

export interface ForumReelDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  /** Deletes Storage objects by path; injected so tests and the server can differ. */
  removeFiles: (paths: string[]) => Promise<void>;
}

export function registerForumReelRoutes(app: Express, deps: ForumReelDeps): void {
  const allowView = createRateLimiter(120, 60_000);
  const fail = (res: Response, error: unknown, label: string) => {
    if (error instanceof ReelError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
    console.error(`[REELS] ${label} failed:`, (error as Error)?.message);
    return res.status(500).json({ error: 'Veprimi dështoi. Provoni përsëri.' });
  };

  app.delete('/api/v1/forum/reels/:reelId', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const claims = req.user?.claims ?? {};
      const staff = STAFF_CLAIMS.some((c) => claims[c] === true);
      return res.json({ ok: true, ...(await deleteReel(deps.db(), { reelId: req.params.reelId, uid, staff }, deps.removeFiles)) });
    } catch (e) { return fail(res, e, 'delete'); }
  });

  app.post('/api/v1/forum/reels/:reelId/view', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!allowView(uid)) return res.status(429).json({ error: 'Shumë kërkesa.', code: 'rate_limited' });
    try { return res.json(await recordReelView(deps.db(), { reelId: req.params.reelId, uid })); }
    catch (e) { return fail(res, e, 'view'); }
  });
}

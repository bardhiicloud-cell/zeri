/**
 * Followers-only posts, enforced on the server.
 *
 * `visibility: 'followers'` used to be honoured only by the app: the Firestore rules
 * let everyone read every post, so anyone could read a "followers only" post by
 * querying the collection directly. Now the rules refuse those posts to everyone
 * but their author and staff, and the only way for a follower to read them is this
 * endpoint, which checks the follow relationship itself.
 *
 * It returns the followers-only posts of the accounts the caller follows (newest
 * first, paged by time), skipping hidden and deleted posts and anyone who blocked,
 * or was blocked by, the caller.
 */
import type { Express, Request, RequestHandler, Response } from 'express';
import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

export const FOLLOWERS_FEED_PAGE = 30;
/** Firestore allows at most 30 values in an `in` filter. */
const IN_LIMIT = 30;

export interface FeedPost {
  id: string;
  /** Milliseconds, so the browser can rebuild a Firestore Timestamp. */
  createdAtMs: number;
  data: Record<string, unknown>;
}

const toMillis = (v: unknown): number => {
  const t = v as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === 'function' ? t.toMillis() : 0;
};

/** Plain JSON for a post: Firestore timestamps become `{ __ms }` so nothing is lost in transit. */
export function serializePost(doc: QueryDocumentSnapshot): FeedPost {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc.data())) {
    data[k] = v && typeof (v as { toMillis?: unknown }).toMillis === 'function' ? { __ms: toMillis(v) } : v;
  }
  return { id: doc.id, createdAtMs: toMillis(doc.get('createdAt')), data };
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function fetchFollowersFeed(
  fs: Firestore, uid: string, options: { limit?: number; beforeMs?: number } = {},
): Promise<{ posts: FeedPost[]; nextBeforeMs: number | null }> {
  const limit = Math.min(Math.max(options.limit ?? FOLLOWERS_FEED_PAGE, 1), 50);
  const me = await fs.collection('users').doc(uid).get();
  const following: string[] = Array.isArray(me.data()?.followingIds) ? (me.data()!.followingIds as unknown[]).map(String) : [];
  if (me.data()?.role === 'guest' || following.length === 0) return { posts: [], nextBeforeMs: null };

  // People who blocked me, or whom I blocked, are skipped even if I still follow them.
  const blockedChecks = await Promise.all(following.slice(0, 500).flatMap((id) => [
    fs.collection('forum_blocks').doc(`${uid}_${id}`).get(),
    fs.collection('forum_blocks').doc(`${id}_${uid}`).get(),
  ]));
  const blocked = new Set<string>();
  blockedChecks.forEach((snap) => {
    if (!snap.exists) return;
    const d = snap.data() as { blockerId?: string; blockedId?: string };
    blocked.add(d.blockerId === uid ? String(d.blockedId) : String(d.blockerId));
  });
  const authors = following.filter((id) => !blocked.has(id)).slice(0, 300);

  // Hidden and deleted posts are filtered AFTER the query, so a page can come back short:
  // keep reading further back until the page is full or the history is exhausted.
  const collected = new Map<string, FeedPost>();
  let cursor = options.beforeMs;
  for (let round = 0; round < 6 && collected.size < limit; round++) {
    const batches = await Promise.all(chunk(authors, IN_LIMIT).map(async (ids) => {
      let q = fs.collection('forumPosts')
        .where('visibility', '==', 'followers')
        .where('authorId', 'in', ids)
        .orderBy('createdAt', 'desc');
      if (cursor) q = q.startAfter(new Date(cursor));
      return (await q.limit(limit).get()).docs;
    }));
    // A batch that came back full may have more behind it; its oldest post bounds how far back we have seen.
    const fullBatchOldest = batches
      .filter((docs) => docs.length === limit)
      .map((docs) => toMillis(docs[docs.length - 1].get('createdAt')));
    for (const d of batches.flat()) {
      if (d.get('deletedAt') || d.get('isHidden') === true) continue;
      collected.set(d.id, serializePost(d));
    }
    if (fullBatchOldest.length === 0) break; // every author's history is exhausted
    cursor = Math.max(...fullBatchOldest);
  }

  const posts = [...collected.values()].sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, limit);
  return { posts, nextBeforeMs: posts.length === limit ? posts[posts.length - 1].createdAtMs : null };
}

export function registerForumFeedRoutes(app: Express, deps: { requireAuth: RequestHandler; db: () => Firestore }): void {
  app.get('/api/v1/forum/followers-feed', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const limit = Number(req.query.limit);
      const before = Number(req.query.before);
      return res.json(await fetchFollowersFeed(deps.db(), uid, {
        limit: Number.isFinite(limit) ? limit : undefined,
        beforeMs: Number.isFinite(before) && before > 0 ? before : undefined,
      }));
    } catch (error) {
      console.error('[FEED] followers feed failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Postimet nuk u ngarkuan.' });
    }
  });
}

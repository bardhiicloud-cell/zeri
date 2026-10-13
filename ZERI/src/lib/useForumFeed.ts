import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Timestamp, collection, getDocs, limit, onSnapshot, orderBy, query, startAfter, where,
  type DocumentSnapshot, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { authHeaders } from './apiAuth';

/**
 * The public-debate feed from four sources, merged and de-duplicated:
 *
 *   1. public posts, live (newest 50);
 *   2. my own posts, live (this is how my followers-only posts reach me);
 *   3. followers-only posts of people I follow, from the server (it checks the follow);
 *   4. older public posts, loaded a page at a time ("Ngarko më shumë").
 *
 * The Firestore rules serve only `visibility == 'public'` to the public, so the
 * first query must carry that filter.
 */
export const LIVE_PAGE = 50;
export const MORE_PAGE = 30;
const FOLLOWERS_REFRESH_MS = 60_000;

interface FeedDoc { id: string; createdAt?: unknown; deletedAt?: unknown; authorId?: string }

export const millisOf = (value: unknown): number => {
  const t = value as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === 'function' ? t.toMillis() : 0;
};

/** Merges lists by id (later lists win), newest first. */
export function mergePostSources<T extends FeedDoc>(...sources: readonly (readonly T[])[]): T[] {
  const byId = new Map<string, T>();
  for (const list of sources) for (const post of list) byId.set(post.id, post);
  return [...byId.values()].sort((a, b) => millisOf(b.createdAt) - millisOf(a.createdAt));
}

/** Rebuilds a post from the server's JSON, turning `{ __ms }` markers back into Timestamps. */
export function deserializePost<T extends FeedDoc>(raw: { id: string; data: Record<string, unknown> }): T {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw.data ?? {})) {
    data[k] = v && typeof v === 'object' && typeof (v as { __ms?: unknown }).__ms === 'number' ? Timestamp.fromMillis((v as { __ms: number }).__ms) : v;
  }
  return { id: raw.id, ...data } as T;
}

export interface DeletedPostRef { id: string; content: string; deletedAtMs: number | null }

export interface ForumFeed<T> {
  posts: T[];
  setPosts: Dispatch<SetStateAction<T[]>>;
  /** The signed-in author's own soft-deleted posts (restorable for 30 days). */
  trash: DeletedPostRef[];
  isLoading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
}

export function useForumFeed<T extends FeedDoc & { content?: string }>(options: { uid: string | null; isGuest: boolean; followingKey: string }): ForumFeed<T> {
  const { uid, isGuest, followingKey } = options;
  const [posts, setPosts] = useState<T[]>([]);
  const [trash, setTrash] = useState<DeletedPostRef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const live = useRef<T[]>([]);
  const mine = useRef<T[]>([]);
  const followers = useRef<T[]>([]);
  const older = useRef<T[]>([]);
  const cursor = useRef<QueryDocumentSnapshot | DocumentSnapshot | null>(null);
  const exhausted = useRef(false);

  const recompute = useCallback(() => {
    const all = mergePostSources<T>(older.current, followers.current, live.current, mine.current);
    setPosts(all.filter((p) => !p.deletedAt));
    setTrash(
      mine.current
        .filter((p) => p.deletedAt)
        .map((p) => ({ id: p.id, content: String(p.content ?? ''), deletedAtMs: millisOf(p.deletedAt) || null })),
    );
  }, []);

  // 1. Public posts, live.
  useEffect(() => {
    const q = query(collection(db, 'forumPosts'), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'), limit(LIVE_PAGE));
    const unsub = onSnapshot(q, (snap) => {
      live.current = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as T);
      // The first page sets where "load more" continues; later snapshots must not move it back.
      if (!cursor.current && snap.docs.length) cursor.current = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < LIVE_PAGE) { exhausted.current = true; setHasMore(false); } else if (!exhausted.current) setHasMore(true);
      recompute();
      setIsLoading(false);
    }, (error) => {
      console.warn('Postimet publike nuk u ngarkuan:', error);
      setIsLoading(false);
    });
    const safety = window.setTimeout(() => setIsLoading(false), 2000);
    return () => { window.clearTimeout(safety); unsub(); };
  }, [recompute]);

  // 2. My own posts, live (includes followers-only and deleted ones).
  useEffect(() => {
    mine.current = [];
    if (!uid || isGuest) { recompute(); return; }
    const q = query(collection(db, 'forumPosts'), where('authorId', '==', uid), orderBy('createdAt', 'desc'), limit(LIVE_PAGE));
    const unsub = onSnapshot(q, (snap) => {
      mine.current = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as T);
      recompute();
    }, (error) => console.warn('Postimet e mia nuk u ngarkuan:', error));
    return () => unsub();
  }, [uid, isGuest, recompute]);

  // 3. Followers-only posts of the people I follow, from the server; refreshed on focus and on a timer.
  useEffect(() => {
    followers.current = [];
    if (!uid || isGuest) { recompute(); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/v1/forum/followers-feed?limit=50', { headers: await authHeaders({}) });
        if (!response.ok) return;
        const data = await response.json() as { posts: { id: string; data: Record<string, unknown> }[] };
        if (cancelled) return;
        followers.current = (data.posts ?? []).map((p) => deserializePost<T>(p));
        recompute();
      } catch { /* the public feed still works without it */ }
    };
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, FOLLOWERS_REFRESH_MS);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [uid, isGuest, followingKey, recompute]);

  // 4. Older public posts, one page at a time.
  const loadMore = useCallback(async () => {
    if (loadingMore || exhausted.current || !cursor.current) return;
    setLoadingMore(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'forumPosts'), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'), startAfter(cursor.current), limit(MORE_PAGE),
      ));
      if (snap.docs.length) cursor.current = snap.docs[snap.docs.length - 1];
      older.current = mergePostSources<T>(older.current, snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as T));
      if (snap.docs.length < MORE_PAGE) { exhausted.current = true; setHasMore(false); }
      recompute();
    } catch (error) {
      console.warn('Postimet e vjetra nuk u ngarkuan:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, recompute]);

  return { posts, setPosts, trash, isLoading, hasMore, loadingMore, loadMore };
}

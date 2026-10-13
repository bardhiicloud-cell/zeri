/**
 * The public-debate social graph, served by the server.
 *
 * Why this exists: the Firestore rules (rightly) let a citizen read only their own
 * `users` document, so the forum's old approach of downloading up to 500 profiles
 * and counting `followingIds` in the browser returns "permission denied" for every
 * ordinary citizen: follower counts, "who to follow", the People tab and @mentions
 * were all empty for them. This module computes those from the server and returns
 * only what the app needs: name, avatar, a follower COUNT, the person's public
 * forum preferences, and whether they follow ME. Nobody's follow list is exposed.
 *
 * Following is also written here (not by the browser), so the counters and the
 * relationship cannot disagree, blocks are respected, and the notification is created once.
 *
 * Scale note: counts are derived from a bounded in-memory snapshot of `users`
 * (refreshed every minute and after any follow). That is fine into the low
 * thousands of accounts; beyond that, maintain per-user counters instead.
 */
import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { normalizeForumPrefs, type ForumPrefs } from '../src/lib/forumPrefs';
import { notifyFollow } from './forumPosts';
import { createRateLimiter } from './directMessages';

export const SNAPSHOT_TTL_MS = 60_000;
export const SNAPSHOT_MAX_USERS = 2000;
export const MAX_FOLLOWING = 5000;
export const DEFAULT_PEOPLE = 200;

export interface UserLite {
  id: string;
  name: string;
  avatar: string;
  role: string;
  isBanned: boolean;
  followingIds: string[];
  forumPrefs: ForumPrefs;
}

export interface Person {
  id: string;
  name: string;
  avatar: string;
  /** How many accounts follow this person. */
  followers: number;
  /** Only ever `[me]` when this person follows me; never their real list. */
  followingIds: string[];
  forumPrefs: ForumPrefs;
}

export interface PeopleResult {
  people: Person[];
  me: { followers: number; following: number };
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function toUserLite(id: string, data: Record<string, unknown> | undefined): UserLite | null {
  if (!data) return null;
  const following = Array.isArray(data.followingIds) ? (data.followingIds as unknown[]).filter((v): v is string => typeof v === 'string') : [];
  return {
    id,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 120) : 'Qytetar',
    avatar: typeof data.avatar === 'string' && /^https:\/\//.test(data.avatar) ? data.avatar : '',
    role: String(data.role ?? 'citizen'),
    isBanned: data.isBanned === true,
    followingIds: following,
    forumPrefs: normalizeForumPrefs(data.forumPrefs),
  };
}

/** Pure: who the app should know about for `meId`, with counts and the follow-me flag. */
export function buildPeople(
  users: readonly UserLite[], meId: string,
  options: { query?: string; limit?: number; blocked?: ReadonlySet<string> } = {},
): PeopleResult {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_PEOPLE, 1), 500);
  const blocked = options.blocked ?? new Set<string>();
  const visible = users.filter((u) => !u.isBanned && u.role !== 'guest' && !blocked.has(u.id));

  const followers = new Map<string, number>();
  for (const u of users) for (const id of new Set(u.followingIds)) if (id !== u.id) followers.set(id, (followers.get(id) ?? 0) + 1);

  const me = users.find((u) => u.id === meId);
  const iFollow = new Set(me?.followingIds ?? []);
  const followsMe = new Set(users.filter((u) => u.followingIds.includes(meId)).map((u) => u.id));
  const q = norm((options.query ?? '').replace(/^@/, '').trim());

  const chosen = new Map<string, UserLite>();
  const take = (u: UserLite) => { if (!chosen.has(u.id)) chosen.set(u.id, u); };
  for (const u of visible) if (u.id === meId || iFollow.has(u.id) || followsMe.has(u.id)) take(u);
  if (q) for (const u of visible) if (norm(u.name).includes(q)) take(u);
  [...visible].sort((a, b) => (followers.get(b.id) ?? 0) - (followers.get(a.id) ?? 0) || a.name.localeCompare(b.name))
    .slice(0, limit).forEach(take);

  const people: Person[] = [...chosen.values()].map((u) => ({
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    followers: followers.get(u.id) ?? 0,
    followingIds: followsMe.has(u.id) ? [meId] : [],
    forumPrefs: u.forumPrefs,
  }));
  return { people, me: { followers: followers.get(meId) ?? 0, following: iFollow.size } };
}

export class GraphError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 403 | 404 | 409, public readonly code: string) {
    super(message);
    this.name = 'GraphError';
  }
}

const isSafeId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128 && !v.includes('/');

/** Follows or unfollows in one transaction. Idempotent: repeating an action is a no-op that reports the state. */
export async function setFollow(
  fs: Firestore, input: { uid: string; targetId: string; follow: boolean },
): Promise<{ following: boolean; changed: boolean }> {
  const { uid, targetId } = input;
  if (!isSafeId(uid) || !isSafeId(targetId)) throw new GraphError('Përdoruesi nuk është i vlefshëm.', 400, 'bad_user');
  if (uid === targetId) throw new GraphError('Nuk mund ta ndiqni veten.', 400, 'self');
  return fs.runTransaction(async (tx) => {
    const meRef = fs.collection('users').doc(uid);
    const [me, target, b1, b2] = await Promise.all([
      tx.get(meRef),
      tx.get(fs.collection('users').doc(targetId)),
      tx.get(fs.collection('forum_blocks').doc(`${uid}_${targetId}`)),
      tx.get(fs.collection('forum_blocks').doc(`${targetId}_${uid}`)),
    ]);
    if (!me.exists || me.data()?.role === 'guest') throw new GraphError('Kyçuni me llogari për të ndjekur.', 403, 'no_account');
    if (me.data()?.isBanned === true) throw new GraphError('Llogaria juaj është e kufizuar.', 403, 'banned');
    const following: string[] = Array.isArray(me.data()?.followingIds) ? me.data()!.followingIds : [];
    const already = following.includes(targetId);
    if (!input.follow) {
      if (!already) return { following: false, changed: false };
      tx.update(meRef, { followingIds: FieldValue.arrayRemove(targetId) });
      return { following: false, changed: true };
    }
    if (!target.exists || target.data()?.isBanned === true) throw new GraphError('Përdoruesi nuk u gjet.', 404, 'not_found');
    if (b1.exists || b2.exists) throw new GraphError('Nuk mund ta ndiqni këtë përdorues.', 403, 'denied');
    if (already) return { following: true, changed: false };
    if (following.length >= MAX_FOLLOWING) throw new GraphError('Keni arritur kufirin e llogarive që mund të ndiqni.', 409, 'limit');
    tx.update(meRef, { followingIds: FieldValue.arrayUnion(targetId) });
    return { following: true, changed: true };
  });
}

/** Lists for the profile screen, honouring "show follower / following lists". */
export function listAllowed(owner: UserLite | undefined, viewerId: string): boolean {
  if (!owner) return false;
  return owner.id === viewerId || owner.forumPrefs.showFollowLists;
}

export interface ForumPeopleDeps { requireAuth: RequestHandler; db: () => Firestore }

export function registerForumPeopleRoutes(app: Express, deps: ForumPeopleDeps): void {
  let snapshot: { at: number; users: UserLite[] } | null = null;
  const allowFollow = createRateLimiter(60, 60_000);

  const load = async (fs: Firestore, now = Date.now()): Promise<UserLite[]> => {
    if (snapshot && now - snapshot.at < SNAPSHOT_TTL_MS) return snapshot.users;
    const snap = await fs.collection('users').limit(SNAPSHOT_MAX_USERS).get();
    const users = snap.docs.map((d) => toUserLite(d.id, d.data())).filter((u): u is UserLite => u !== null);
    snapshot = { at: now, users };
    return users;
  };

  const blockedFor = async (fs: Firestore, uid: string): Promise<Set<string>> => {
    const [mine, theirs] = await Promise.all([
      fs.collection('forum_blocks').where('blockerId', '==', uid).limit(500).get(),
      fs.collection('forum_blocks').where('blockedId', '==', uid).limit(500).get(),
    ]);
    const out = new Set<string>();
    mine.docs.forEach((d) => out.add(String(d.get('blockedId'))));
    theirs.docs.forEach((d) => out.add(String(d.get('blockerId'))));
    return out;
  };

  const fail = (res: Response, error: unknown, label: string) => {
    if (error instanceof GraphError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
    console.error(`[PEOPLE] ${label} failed:`, (error as Error)?.message);
    return res.status(500).json({ error: 'Veprimi dështoi. Provoni përsëri.' });
  };

  app.get('/api/v1/forum/people', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const fs = deps.db();
      const [users, blocked] = await Promise.all([load(fs), blockedFor(fs, uid)]);
      const limit = Number(req.query.limit);
      return res.json(buildPeople(users, uid, { query: String(req.query.q ?? '').slice(0, 60), limit: Number.isFinite(limit) ? limit : undefined, blocked }));
    } catch (e) { return fail(res, e, 'people'); }
  });

  // Who follows a person / whom they follow, if they allow it.
  app.get('/api/v1/forum/people/:uid/:kind(followers|following)', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const fs = deps.db();
      const [users, blocked] = await Promise.all([load(fs), blockedFor(fs, uid)]);
      const owner = users.find((u) => u.id === req.params.uid);
      if (!listAllowed(owner, uid)) return res.status(403).json({ error: 'Ky përdorues e ka fshehur listën.', code: 'private' });
      const ids = req.params.kind === 'followers'
        ? users.filter((u) => u.followingIds.includes(owner!.id)).map((u) => u.id)
        : owner!.followingIds;
      const byId = new Map(users.map((u) => [u.id, u]));
      const items = ids.filter((id) => !blocked.has(id)).map((id) => byId.get(id)).filter((u): u is UserLite => !!u && !u.isBanned)
        .slice(0, 300).map((u) => ({ id: u.id, name: u.name, avatar: u.avatar }));
      return res.json({ items });
    } catch (e) { return fail(res, e, 'graph list'); }
  });

  const follow = (value: boolean): RequestHandler => async (req, res) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!allowFollow(uid)) return res.status(429).json({ error: 'Shumë veprime. Prisni pak.', code: 'rate_limited' });
    try {
      const fs = deps.db();
      const result = await setFollow(fs, { uid, targetId: req.params.uid, follow: value });
      if (result.changed) {
        snapshot = null; // counts must reflect this immediately
        // The notification is once per pair and honours the recipient's preferences.
        if (value) void notifyFollow(fs, { uid, targetId: req.params.uid }).catch((e) => console.warn('[PEOPLE] notify failed:', e?.message));
      }
      return res.json(result);
    } catch (e) { return fail(res, e, 'follow'); }
  };
  app.put('/api/v1/forum/follow/:uid', deps.requireAuth, follow(true));
  app.delete('/api/v1/forum/follow/:uid', deps.requireAuth, follow(false));
}

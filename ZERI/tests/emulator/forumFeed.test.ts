import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { chunk, fetchFollowersFeed } from '../../server/forumFeed';
import { backfillPostVisibility } from '../../scripts/postMaintenance';

/** Run with: npm run test:rules */
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
let db: Firestore;
const ME = 'me';
const A = 'authorA';
const B = 'authorB';
const STRANGER = 'stranger';
const t = (minutesAgo: number) => Timestamp.fromMillis(Date.now() - minutesAgo * 60_000);

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through `npm run test:rules`.');
  db = getFirestore(getApps().find((a) => a.name === 'feed') ?? initializeApp({ projectId: 'demo-zeri-feed' }, 'feed'));
});
const wipe = async () => { for (const c of await db.listCollections()) for (const r of await c.listDocuments()) await db.recursiveDelete(r); };
beforeEach(async () => {
  await wipe();
  await db.doc(`users/${ME}`).set({ name: 'Me', role: 'citizen', followingIds: [A, B] });
  const post = (id: string, authorId: string, minutes: number, extra: Record<string, unknown> = {}) =>
    db.doc(`forumPosts/${id}`).set({ authorId, content: id, visibility: 'followers', createdAt: t(minutes), ...extra });
  await post('a1', A, 10);
  await post('a2', A, 30);
  await post('b1', B, 20);
  await post('pub', A, 5, { visibility: 'public' });
  await post('stranger1', STRANGER, 1);
  await post('hiddenA', A, 2, { isHidden: true });
  await post('deletedA', A, 3, { deletedAt: t(1) });
});
afterAll(wipe);

describe('chunk', () => {
  it('splits into groups of at most the size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});

describe('fetchFollowersFeed', () => {
  it('returns only followers-only posts of people I follow, newest first, without hidden or deleted ones', async () => {
    const { posts } = await fetchFollowersFeed(db, ME);
    expect(posts.map((p) => p.id)).toEqual(['a1', 'b1', 'a2']);
    expect(posts[0].data.content).toBe('a1');
    expect(posts[0].createdAtMs).toBeGreaterThan(0);
    expect(posts[0].data.createdAt).toEqual({ __ms: posts[0].createdAtMs });
  });

  it('pages by time', async () => {
    const first = await fetchFollowersFeed(db, ME, { limit: 2 });
    expect(first.posts.map((p) => p.id)).toEqual(['a1', 'b1']);
    expect(first.nextBeforeMs).toBe(first.posts[1].createdAtMs);
    const second = await fetchFollowersFeed(db, ME, { limit: 2, beforeMs: first.nextBeforeMs! });
    expect(second.posts.map((p) => p.id)).toEqual(['a2']);
    expect(second.nextBeforeMs).toBeNull();
  });

  it('shows nothing to someone who follows nobody, and nothing from people who blocked or were blocked', async () => {
    expect((await fetchFollowersFeed(db, STRANGER)).posts).toEqual([]);
    await db.doc(`forum_blocks/${A}_${ME}`).set({ blockerId: A, blockedId: ME });
    expect((await fetchFollowersFeed(db, ME)).posts.map((p) => p.id)).toEqual(['b1']);
    await db.doc(`forum_blocks/${ME}_${B}`).set({ blockerId: ME, blockedId: B });
    expect((await fetchFollowersFeed(db, ME)).posts).toEqual([]);
  });

  it('never exposes a post of someone I do not follow, even if I ask for a lot', async () => {
    const { posts } = await fetchFollowersFeed(db, ME, { limit: 500 });
    expect(posts.map((p) => p.id)).not.toContain('stranger1');
  });
});

describe('backfillPostVisibility', () => {
  it('sets public only where the field is missing and keeps followers-only private', async () => {
    await db.doc('forumPosts/old1').set({ authorId: A, content: 'old' });
    await db.doc('forumPosts/old2').set({ authorId: A, content: 'old2', visibility: 'weird' });
    expect(await backfillPostVisibility(db, { apply: false })).toEqual({ scanned: 9, missing: 2 });
    expect((await db.doc('forumPosts/old1').get()).get('visibility')).toBeUndefined();
    expect(await backfillPostVisibility(db, { apply: true, pageSize: 3 })).toEqual({ scanned: 9, missing: 2 });
    expect((await db.doc('forumPosts/old1').get()).get('visibility')).toBe('public');
    expect((await db.doc('forumPosts/old2').get()).get('visibility')).toBe('public');
    expect((await db.doc('forumPosts/a1').get()).get('visibility')).toBe('followers');
    expect(await backfillPostVisibility(db, { apply: true })).toEqual({ scanned: 9, missing: 0 });
  });
});

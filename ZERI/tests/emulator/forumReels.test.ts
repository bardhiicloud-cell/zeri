import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { ReelError, deleteReel, recordReelView, reelFilePaths } from '../../server/forumReels';

/** Run with: npm run test:rules */
vi.setConfig({ testTimeout: 30_000 });
let db: Firestore;
const AUTHOR = 'reelAuthor';
const OTHER = 'viewer1';

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through `npm run test:rules`.');
  db = getFirestore(getApps().find((a) => a.name === 'reels-server') ?? initializeApp({ projectId: 'demo-zeri-reels-server' }, 'reels-server'));
});
const wipe = async () => { for (const c of await db.listCollections()) for (const r of await c.listDocuments()) await db.recursiveDelete(r); };
beforeEach(async () => {
  await wipe();
  await db.doc('forumReels/r1').set({
    authorId: AUTHOR, mediaType: 'video', isHidden: false, likedBy: [],
    mediaPath: `forum_reels/${AUTHOR}/1_a.webm`, coverPath: `forum_reels/${AUTHOR}/1_cover.jpg`,
  });
  await db.doc('forumReels/r1/comments/c1').set({ authorId: OTHER, text: 'hi' });
  await db.doc('forumReelReports/r1_viewer1').set({ reelId: 'r1', reporterId: OTHER, status: 'open' });
  await db.doc('forumReelReports/other_viewer1').set({ reelId: 'other', reporterId: OTHER, status: 'open' });
});
afterAll(wipe);

async function code(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { expect(e).toBeInstanceOf(ReelError); return (e as ReelError).code; }
  throw new Error('expected a ReelError');
}

describe('reelFilePaths', () => {
  it('only returns files inside the author\'s own reel folder', () => {
    expect(reelFilePaths({ mediaPath: 'forum_reels/a/x.webm', coverPath: 'forum_reels/a/c.jpg' }, 'a')).toEqual(['forum_reels/a/x.webm', 'forum_reels/a/c.jpg']);
    expect(reelFilePaths({ mediaPath: 'forum_reels/b/x.webm', coverPath: 'avatars/a/me.png' }, 'a')).toEqual([]);
    expect(reelFilePaths({ mediaPath: 'forum_reels/a/../b/x', coverPath: 42 as any }, 'a')).toEqual([]);
    expect(reelFilePaths({ mediaPath: 'forum_reels/a/' }, 'a')).toEqual([]);
  });
});

describe('deleteReel', () => {
  it('lets the author delete: document, comments, files and the reel\'s reports (not other reels\')', async () => {
    const removed: string[] = [];
    const result = await deleteReel(db, { reelId: 'r1', uid: AUTHOR, staff: false }, async (p) => { removed.push(...p); });
    expect(result).toEqual({ filesRemoved: 2, reportsRemoved: 1 });
    expect(removed).toEqual([`forum_reels/${AUTHOR}/1_a.webm`, `forum_reels/${AUTHOR}/1_cover.jpg`]);
    expect((await db.doc('forumReels/r1').get()).exists).toBe(false);
    expect((await db.doc('forumReels/r1/comments/c1').get()).exists).toBe(false);
    expect((await db.doc('forumReelReports/r1_viewer1').get()).exists).toBe(false);
    expect((await db.doc('forumReelReports/other_viewer1').get()).exists).toBe(true);
  });

  it('refuses a stranger, allows staff, and reports a missing reel', async () => {
    expect(await code(deleteReel(db, { reelId: 'r1', uid: OTHER, staff: false }, async () => undefined))).toBe('forbidden');
    expect((await db.doc('forumReels/r1').get()).exists).toBe(true);
    await deleteReel(db, { reelId: 'r1', uid: OTHER, staff: true }, async () => undefined);
    expect(await code(deleteReel(db, { reelId: 'r1', uid: AUTHOR, staff: false }, async () => undefined))).toBe('not_found');
    expect(await code(deleteReel(db, { reelId: 'a/b', uid: AUTHOR, staff: false }, async () => undefined))).toBe('bad_request');
  });

  it('still deletes the document when file cleanup fails', async () => {
    await deleteReel(db, { reelId: 'r1', uid: AUTHOR, staff: false }, async () => { throw new Error('bucket down'); });
    expect((await db.doc('forumReels/r1').get()).exists).toBe(false);
  });
});

describe('recordReelView', () => {
  it('counts one view per account, never twice, even when requests overlap', async () => {
    await Promise.all([1, 2, 3, 4].map(() => recordReelView(db, { reelId: 'r1', uid: OTHER })));
    await recordReelView(db, { reelId: 'r1', uid: 'viewer2' });
    await recordReelView(db, { reelId: 'r1', uid: OTHER });
    expect((await db.doc('forumReels/r1').get()).get('viewCount')).toBe(2);
  });

  it('counts nothing for a hidden or missing reel', async () => {
    await db.doc('forumReels/r1').update({ isHidden: true });
    expect(await code(recordReelView(db, { reelId: 'r1', uid: OTHER }))).toBe('not_found');
    expect(await code(recordReelView(db, { reelId: 'ghost', uid: OTHER }))).toBe('not_found');
  });
});

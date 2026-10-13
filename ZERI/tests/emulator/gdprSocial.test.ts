import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { DELETED_AUTHOR_ID, eraseUserData } from '../../server/gdpr';

/** Erasure of the social data added with Reels, comments, blocks and DM privacy. Run with: npm run test:rules */
vi.setConfig({ testTimeout: 30_000 });
const ME = 'leaver';
const OTHER = 'stays';
let db: Firestore;
// Storage is covered by gdpr.test.ts; here only the Firestore steps matter.
const noFiles = { deleteFiles: async () => undefined };

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through `npm run test:rules`.');
  db = getFirestore(getApps().find((a) => a.name === 'gdpr-social') ?? initializeApp({ projectId: 'demo-zeri-gdpr-social' }, 'gdpr-social'));
});

const wipe = async () => { for (const c of await db.listCollections()) for (const r of await c.listDocuments()) await db.recursiveDelete(r); };
beforeEach(async () => {
  await wipe();
  await db.doc(`users/${ME}`).set({ name: 'Leaver', role: 'citizen' });
  await db.doc('forumReels/mine').set({ authorId: ME, mediaType: 'video', likedBy: [OTHER], isHidden: false });
  await db.doc('forumReels/mine/comments/c1').set({ authorId: OTHER, text: 'nice' });
  await db.doc('forumReels/theirs').set({ authorId: OTHER, mediaType: 'video', likedBy: [ME, OTHER], isHidden: false });
  await db.doc('forumReels/theirs/comments/c2').set({ authorId: ME, authorName: 'Leaver', text: 'hello' });
  await db.doc('forumReelReports/theirs_leaver').set({ reelId: 'theirs', reporterId: ME, reason: 'spam' });
  await db.doc(`forum_blocks/${ME}_${OTHER}`).set({ blockerId: ME, blockedId: OTHER });
  await db.doc(`forum_blocks/${OTHER}_${ME}`).set({ blockerId: OTHER, blockedId: ME });
  await db.doc(`forum_dm_settings/${ME}`).set({ privacy: 'following' });
  await db.doc('forumPosts/p1').set({ authorId: ME, authorName: 'Leaver', authorEmail: 'leaver@example.org', content: 'x' });
  await db.doc('forumPosts/p2').set({ authorId: OTHER, content: 'y', likes: [ME, OTHER], reposts: [ME] });
});
afterAll(wipe);

const exists = async (path: string) => (await db.doc(path).get()).exists;

describe('erasure of social data', () => {
  it('deletes reels (with their comments), reports filed, both blocks and the DM setting', async () => {
    const report = await eraseUserData(db, noFiles, ME);
    expect(report.steps.filter((s) => s.error)).toEqual([]);
    expect(report.ok).toBe(true);
    expect(await exists('forumReels/mine')).toBe(false);
    expect(await exists('forumReels/mine/comments/c1')).toBe(false);
    expect(await exists('forumReelReports/theirs_leaver')).toBe(false);
    expect(await exists(`forum_blocks/${ME}_${OTHER}`)).toBe(false);
    expect(await exists(`forum_blocks/${OTHER}_${ME}`)).toBe(false);
    expect(await exists(`forum_dm_settings/${ME}`)).toBe(false);
  });

  it('removes their id from other people\'s likes and reposts and keeps the others', async () => {
    await eraseUserData(db, noFiles, ME);
    expect((await db.doc('forumReels/theirs').get()).get('likedBy')).toEqual([OTHER]);
    expect((await db.doc('forumPosts/p2').get()).get('likes')).toEqual([OTHER]);
    expect((await db.doc('forumPosts/p2').get()).get('reposts')).toEqual([]);
  });

  it('anonymises their comment on someone else\'s reel and strips the e-mail from their public posts', async () => {
    await eraseUserData(db, noFiles, ME);
    expect((await db.doc('forumReels/theirs/comments/c2').get()).get('authorId')).toBe(DELETED_AUTHOR_ID);
    const post = await db.doc('forumPosts/p1').get();
    expect(post.get('authorId')).toBe(DELETED_AUTHOR_ID);
    expect(post.get('authorEmail')).toBeUndefined();
  });

  it('is idempotent: a second run succeeds and changes nothing more', async () => {
    await eraseUserData(db, noFiles, ME);
    const again = await eraseUserData(db, noFiles, ME);
    expect(again.ok).toBe(true);
  });
});

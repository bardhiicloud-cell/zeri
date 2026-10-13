import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { DELETED_AUTHOR_ID, DELETED_AUTHOR_NAME, anonymiseComments, eraseUserData } from '../../server/gdpr';

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

describe('comments left on posts by other people', () => {
  const tree = () => [
    { id: 'c1', authorId: ME, authorName: 'Leaver', authorAvatar: 'https://x.test/a.png', content: 'my comment', replies: [
      { id: 'r1', authorId: OTHER, authorName: 'Stays', content: 'reply to me' },
      { id: 'r2', authorId: ME, authorName: 'Leaver', content: 'my own reply' },
    ] },
    { id: 'c2', authorId: OTHER, authorName: 'Stays', content: 'theirs', replies: [{ id: 'r3', authorId: ME, authorName: 'Leaver', content: 'my reply to them' }] },
  ];

  it('anonymiseComments replaces only my identity, at every depth, and keeps the text', () => {
    const { comments, changed } = anonymiseComments(tree(), ME) as { comments: any[]; changed: number };
    expect(changed).toBe(3);
    expect(comments[0]).toMatchObject({ authorId: DELETED_AUTHOR_ID, authorName: DELETED_AUTHOR_NAME, authorAvatar: '', content: 'my comment' });
    expect(comments[0].replies[0]).toMatchObject({ authorId: OTHER, authorName: 'Stays' });
    expect(comments[0].replies[1]).toMatchObject({ authorId: DELETED_AUTHOR_ID, content: 'my own reply' });
    expect(comments[1].replies[0].authorId).toBe(DELETED_AUTHOR_ID);
    expect(comments[1].authorId).toBe(OTHER);
    expect(anonymiseComments(undefined, ME)).toEqual({ comments: [], changed: 0 });
  });

  it('erasing an account anonymises their comments on other posts and drops them from commentAuthorIds', async () => {
    await db.doc('forumPosts/p3').set({ authorId: OTHER, content: 'z', comments: tree(), commentAuthorIds: [ME, OTHER] });
    await db.doc('forumPosts/untouched').set({ authorId: OTHER, content: 'q', comments: [{ id: 'k', authorId: OTHER, authorName: 'Stays', content: 'k' }], commentAuthorIds: [OTHER] });
    const report = await eraseUserData(db, noFiles, ME);
    expect(report.steps.filter((x) => x.error)).toEqual([]);
    const p3 = (await db.doc('forumPosts/p3').get()).data()!;
    expect(JSON.stringify(p3.comments)).not.toContain('Leaver');
    expect(JSON.stringify(p3.comments)).toContain('my comment');
    expect(p3.commentAuthorIds).toEqual([OTHER]);
    expect((await db.doc('forumPosts/untouched').get()).get('comments')[0].authorName).toBe('Stays');
  });

  it('backfillCommentAuthors finds commenters of older posts, adds ids only, and is idempotent', async () => {
    const { backfillCommentAuthors } = await import('../../scripts/postMaintenance');
    await db.doc('forumPosts/old').set({ authorId: OTHER, content: 'o', comments: tree() });
    expect(await backfillCommentAuthors(db, { apply: false })).toMatchObject({ posts: 1 });
    expect((await db.doc('forumPosts/old').get()).get('commentAuthorIds')).toBeUndefined();
    await backfillCommentAuthors(db, { apply: true, pageSize: 1 });
    expect(((await db.doc('forumPosts/old').get()).get('commentAuthorIds') as string[]).sort()).toEqual([ME, OTHER].sort());
    expect(JSON.stringify((await db.doc('forumPosts/old').get()).get('comments'))).toContain('Leaver');
    expect(await backfillCommentAuthors(db, { apply: true })).toMatchObject({ posts: 0 });
  });
});

describe('backfillPostHashtags', () => {
  it('adds hashtags to posts that lack the field, leaves others, and is idempotent', async () => {
    const { backfillPostHashtags } = await import('../../scripts/postMaintenance');
    for (const d of (await db.collection('forumPosts').get()).docs) await d.ref.delete(); // earlier tests leave posts behind
    await db.doc('forumPosts/h1').set({ authorId: OTHER, content: 'Rruga #Prishtina dhe #rruga, link http://x.org/#skip' });
    await db.doc('forumPosts/h2').set({ authorId: OTHER, content: 'tashmë #a1', hashtags: ['kept'] });
    expect(await backfillPostHashtags(db, { apply: false })).toMatchObject({ posts: 1 });
    expect((await db.doc('forumPosts/h1').get()).get('hashtags')).toBeUndefined();
    await backfillPostHashtags(db, { apply: true, pageSize: 1 });
    expect((await db.doc('forumPosts/h1').get()).get('hashtags')).toEqual(['prishtina', 'rruga']);
    expect((await db.doc('forumPosts/h2').get()).get('hashtags')).toEqual(['kept']);
    expect(await backfillPostHashtags(db, { apply: true })).toMatchObject({ posts: 0 });
  });
});

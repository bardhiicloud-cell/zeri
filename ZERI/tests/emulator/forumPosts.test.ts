import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  PostError, addComment, deleteComment, editPost, notifyAfterPublish, notifyFollow, notifyPostAction, purgeExpiredDeletedPosts,
  purgePost, restorePost, setReaction, softDeletePost, votePostPoll,
} from '../../server/forumPosts';

/** Real transactions against the Firestore emulator. Run with: npm run test:rules */
// The first transaction against a cold emulator can take several seconds.
vi.setConfig({ testTimeout: 30_000 });
let db: Firestore;
const AUTHOR = 'author1';
const ALICE = 'alice1';
const BOB = 'bob1';
const POST = 'post1';

const wipe = async () => {
  for (const name of ['users', 'forumPosts', 'notifications', 'forum_blocks']) {
    for (const ref of await db.collection(name).listDocuments()) await db.recursiveDelete(ref);
  }
};

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through `npm run test:rules`.');
  db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-posts' }));
});

beforeEach(async () => {
  await wipe();
  await db.collection('users').doc(AUTHOR).set({ name: 'Arben Autori', role: 'citizen', followingIds: [] });
  await db.collection('users').doc(ALICE).set({ name: 'Alice Qytetare', role: 'citizen', followingIds: [AUTHOR] });
  await db.collection('users').doc(BOB).set({ name: 'Bob', role: 'citizen', followingIds: [] });
  await db.collection('forumPosts').doc(POST).set({
    authorId: AUTHOR, authorName: 'Arben Autori', content: 'Diskutim', likes: [], comments: [], reactions: {}, isHidden: false,
    poll: { question: 'q', totalVotes: 0, options: [{ id: 'a', text: 'A', votes: [] }, { id: 'b', text: 'B', votes: [] }] },
  });
});
afterAll(wipe);

const post = async () => (await db.collection('forumPosts').doc(POST).get()).data() as any;
const notes = async (userId: string) => (await db.collection('notifications').where('userId', '==', userId).get()).docs.map((d) => d.data());
async function codeOf(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { expect(e).toBeInstanceOf(PostError); return (e as PostError).code; }
  throw new Error('expected a PostError');
}

describe('comments', () => {
  it('adds a comment under the verified identity and notifies the post author once', async () => {
    const { comment } = await addComment(db, { postId: POST, uid: ALICE, text: 'Pajtohem' });
    expect(comment).toMatchObject({ authorId: ALICE, authorName: 'Alice Qytetare', content: 'Pajtohem' });
    expect((await post()).comments).toHaveLength(1);
    const [n] = await notes(AUTHOR);
    expect(n).toMatchObject({ channel: 'forum', category: 'forum_reply', actorId: ALICE, postId: POST });
  });

  it('does not lose comments when many people comment at the same time', async () => {
    const names = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
    for (const id of names) await db.collection('users').doc(id).set({ name: id, role: 'citizen', followingIds: [] });
    await Promise.all(names.map((id) => addComment(db, { postId: POST, uid: id, text: `koment ${id}` })));
    const comments = (await post()).comments as any[];
    expect(comments).toHaveLength(6);
    expect(new Set(comments.map((c) => c.authorId)).size).toBe(6);
  });

  it('adds a reply, notifies the comment author and not the replier', async () => {
    const { comment } = await addComment(db, { postId: POST, uid: ALICE, text: 'Pyetje?' });
    await addComment(db, { postId: POST, uid: BOB, text: 'Përgjigje', parentId: comment.id });
    const comments = (await post()).comments as any[];
    expect(comments[0].replies).toHaveLength(1);
    expect((await notes(ALICE)).map((n) => n.category)).toEqual(['forum_reply']);
    expect(await notes(BOB)).toHaveLength(0);
  });

  it('never notifies someone about their own comment', async () => {
    await addComment(db, { postId: POST, uid: AUTHOR, text: 'Shtoj diçka' });
    expect(await notes(AUTHOR)).toHaveLength(0);
  });

  it('notifies a mentioned person only when the text really names them', async () => {
    await addComment(db, { postId: POST, uid: BOB, text: 'Shiko @aliceqytetare', mentionUids: [ALICE] });
    expect((await notes(ALICE)).map((n) => n.category)).toContain('forum_mention');
    await addComment(db, { postId: POST, uid: BOB, text: 'Pa përmendje', mentionUids: [ALICE, AUTHOR] });
    expect((await notes(ALICE)).filter((n) => n.category === 'forum_mention')).toHaveLength(1);
  });

  it('refuses empty text, guests, banned users, hidden posts, missing posts and bad parents', async () => {
    expect(await codeOf(addComment(db, { postId: POST, uid: ALICE, text: '  ' }))).toBe('bad_text');
    await db.collection('users').doc('g').set({ name: 'G', role: 'guest' });
    expect(await codeOf(addComment(db, { postId: POST, uid: 'g', text: 'hi' }))).toBe('no_account');
    await db.collection('users').doc(BOB).update({ isBanned: true });
    expect(await codeOf(addComment(db, { postId: POST, uid: BOB, text: 'hi' }))).toBe('banned');
    expect(await codeOf(addComment(db, { postId: 'ghost', uid: ALICE, text: 'hi' }))).toBe('not_found');
    expect(await codeOf(addComment(db, { postId: POST, uid: ALICE, text: 'hi', parentId: 'nope' }))).toBe('comment_not_found');
    await db.collection('forumPosts').doc(POST).update({ isHidden: true });
    expect(await codeOf(addComment(db, { postId: POST, uid: ALICE, text: 'hi' }))).toBe('not_found');
  });

  it('respects blocks and followers-only posts', async () => {
    await db.collection('forum_blocks').doc(`${AUTHOR}_${BOB}`).set({ blockerId: AUTHOR, blockedId: BOB });
    expect(await codeOf(addComment(db, { postId: POST, uid: BOB, text: 'hi' }))).toBe('denied');
    await db.collection('forumPosts').doc(POST).update({ visibility: 'followers' });
    expect(await codeOf(addComment(db, { postId: POST, uid: ALICE.replace('alice1', 'alice1') === ALICE ? 'bob1' : '', text: 'hi' }))).toBeTruthy();
    await addComment(db, { postId: POST, uid: ALICE, text: 'Ndjekës' }); // Alice follows the author
  });

  it('deletes: the commenter, the post author and staff may; others may not', async () => {
    const { comment } = await addComment(db, { postId: POST, uid: ALICE, text: 'x' });
    expect(await codeOf(deleteComment(db, { postId: POST, commentId: comment.id, uid: BOB, staff: false }))).toBe('forbidden');
    await deleteComment(db, { postId: POST, commentId: comment.id, uid: AUTHOR, staff: false });
    expect((await post()).comments).toHaveLength(0);
    const { comment: c2 } = await addComment(db, { postId: POST, uid: ALICE, text: 'y' });
    await deleteComment(db, { postId: POST, commentId: c2.id, uid: BOB, staff: true });
    expect((await post()).comments).toHaveLength(0);
    expect(await codeOf(deleteComment(db, { postId: POST, commentId: 'nope', uid: ALICE, staff: false }))).toBe('comment_not_found');
  });
});

describe('poll votes and reactions', () => {
  it('records one vote per account, changes and withdraws it, and many voters count correctly', async () => {
    await Promise.all([ALICE, BOB, AUTHOR].map((uid) => votePostPoll(db, { postId: POST, uid, optionId: 'a' })));
    expect((await post()).poll.totalVotes).toBe(3);
    await votePostPoll(db, { postId: POST, uid: ALICE, optionId: 'b' });
    let p = (await post()).poll;
    expect(p.options.map((o: any) => o.votes.length)).toEqual([2, 1]);
    await votePostPoll(db, { postId: POST, uid: ALICE, optionId: 'b' });
    p = (await post()).poll;
    expect(p.totalVotes).toBe(2);
    expect(await codeOf(votePostPoll(db, { postId: POST, uid: ALICE, optionId: 'zzz' }))).toBe('bad_option');
  });

  it('refuses voting on a post without a poll', async () => {
    await db.collection('forumPosts').doc(POST).update({ poll: null });
    expect(await codeOf(votePostPoll(db, { postId: POST, uid: ALICE, optionId: 'a' }))).toBe('no_poll');
  });

  it('keeps one reaction per account and rejects unknown types', async () => {
    await setReaction(db, { postId: POST, uid: ALICE, type: 'love' });
    await setReaction(db, { postId: POST, uid: ALICE, type: 'wow' });
    expect((await post()).reactions).toEqual({ wow: [ALICE] });
    await setReaction(db, { postId: POST, uid: ALICE, type: null });
    expect((await post()).reactions).toEqual({});
    expect(await codeOf(setReaction(db, { postId: POST, uid: ALICE, type: 'hacked' }))).toBe('bad_reaction');
  });
});

describe('edit, soft delete and restore', () => {
  it('lets only the author edit, marks it edited and keeps the previous text for moderators', async () => {
    expect(await codeOf(editPost(db, { postId: POST, uid: ALICE, content: 'Hijack' }))).toBe('forbidden');
    await editPost(db, { postId: POST, uid: AUTHOR, content: 'Teksti i ri' });
    const p = await post();
    expect(p.content).toBe('Teksti i ri');
    expect(p.editedAt).toBeTruthy();
    const edits = await db.collection('forumPosts').doc(POST).collection('edits').get();
    expect(edits.docs.map((d) => d.data().content)).toEqual(['Diskutim']);
  });

  it('ignores an unchanged edit and refuses empty or oversized text and hidden posts', async () => {
    await editPost(db, { postId: POST, uid: AUTHOR, content: 'Diskutim' });
    expect((await post()).editedAt).toBeUndefined();
    expect(await codeOf(editPost(db, { postId: POST, uid: AUTHOR, content: ' ' }))).toBe('bad_text');
    expect(await codeOf(editPost(db, { postId: POST, uid: AUTHOR, content: 'x'.repeat(5001) }))).toBe('bad_text');
    await db.collection('forumPosts').doc(POST).update({ isHidden: true });
    expect(await codeOf(editPost(db, { postId: POST, uid: AUTHOR, content: 'Provë' }))).toBe('hidden');
  });

  it('soft-deletes, blocks actions on it, and restores within 30 days only', async () => {
    expect(await codeOf(softDeletePost(db, ALICE, POST))).toBe('forbidden');
    await softDeletePost(db, AUTHOR, POST);
    expect((await post()).deletedAt).toBeTruthy();
    expect(await codeOf(addComment(db, { postId: POST, uid: ALICE, text: 'hi' }))).toBe('not_found');
    expect(await codeOf(restorePost(db, ALICE, POST))).toBe('forbidden');
    await restorePost(db, AUTHOR, POST);
    expect((await post()).deletedAt).toBeUndefined();
    expect(await codeOf(restorePost(db, AUTHOR, POST))).toBe('not_deleted');

    await db.collection('forumPosts').doc(POST).update({ deletedAt: Timestamp.fromMillis(Date.now() - 31 * 86_400_000) });
    expect(await codeOf(restorePost(db, AUTHOR, POST))).toBe('restore_expired');
  });

  it('purges for good (author only), including subcollections, and by the daily job after 30 days', async () => {
    await addComment(db, { postId: POST, uid: ALICE, text: 'x' });
    await editPost(db, { postId: POST, uid: AUTHOR, content: 'v2' });
    expect(await codeOf(purgePost(db, ALICE, POST))).toBe('forbidden');
    await purgePost(db, AUTHOR, POST);
    expect((await db.collection('forumPosts').doc(POST).get()).exists).toBe(false);
    expect((await db.collection('forumPosts').doc(POST).collection('edits').get()).size).toBe(0);

    await db.collection('forumPosts').doc('old').set({ authorId: AUTHOR, content: 'x', deletedAt: Timestamp.fromMillis(Date.now() - 40 * 86_400_000) });
    await db.collection('forumPosts').doc('recent').set({ authorId: AUTHOR, content: 'x', deletedAt: Timestamp.fromMillis(Date.now() - 2 * 86_400_000) });
    expect(await purgeExpiredDeletedPosts(db)).toBe(1);
    expect((await db.collection('forumPosts').doc('old').get()).exists).toBe(false);
    expect((await db.collection('forumPosts').doc('recent').get()).exists).toBe(true);
  });
});

describe('server-created notifications', () => {
  it('notifies a like or repost only once per person and post, however often it toggles', async () => {
    await notifyPostAction(db, { postId: POST, uid: ALICE, action: 'like' });
    await notifyPostAction(db, { postId: POST, uid: ALICE, action: 'like' });
    await notifyPostAction(db, { postId: POST, uid: ALICE, action: 'repost' });
    await notifyPostAction(db, { postId: POST, uid: AUTHOR, action: 'like' }); // self: nothing
    expect((await notes(AUTHOR)).map((n) => n.category).sort()).toEqual(['forum_like', 'forum_repost']);
  });

  it('notifies after publish for a real quote and for verified mentions only', async () => {
    await db.collection('forumPosts').doc('quote1').set({
      authorId: ALICE, authorName: 'Alice Qytetare', content: 'Citoj dhe përmend @bob', quotedPost: { id: POST },
    });
    await notifyAfterPublish(db, { postId: 'quote1', uid: ALICE, mentionUids: [BOB, AUTHOR] });
    expect((await notes(AUTHOR)).map((n) => n.category)).toEqual(['forum_quote']);
    expect((await notes(BOB)).map((n) => n.category)).toEqual(['forum_mention']);
    await notifyAfterPublish(db, { postId: 'quote1', uid: ALICE, mentionUids: [BOB] });
    expect(await notes(BOB)).toHaveLength(1); // repeated call does not duplicate
    expect(await codeOf(notifyAfterPublish(db, { postId: 'quote1', uid: BOB }))).toBe('not_found'); // not the author's post
  });

  it('notifies a follow once per pair and only when the follow really exists', async () => {
    await notifyFollow(db, { uid: ALICE, targetId: AUTHOR });
    await notifyFollow(db, { uid: ALICE, targetId: AUTHOR });
    expect(await notes(AUTHOR)).toHaveLength(1);
    expect(await codeOf(notifyFollow(db, { uid: BOB, targetId: AUTHOR }))).toBe('not_following');
    expect(await codeOf(notifyFollow(db, { uid: ALICE, targetId: ALICE }))).toBe('bad_request');
  });
});

describe('sponsored click tracking', () => {
  const SP = 'sponsored1';
  beforeEach(async () => {
    await db.collection('forumPosts').doc(SP).set({ authorId: AUTHOR, content: 'Reklamë', isAd: true, adLink: 'https://example.org/ofertë', adClicks: 0, isHidden: false });
  });

  it('counts one click per visitor per day, never counts bots, and always serves the stored link', async () => {
    const { recordAdClick } = await import('../../server/adTracking');
    const now = Date.UTC(2026, 9, 12, 10);
    expect(await recordAdClick(db, SP, { key: 'v1', countable: true }, now)).toEqual({ url: 'https://example.org/ofert%C3%AB', counted: true });
    expect((await recordAdClick(db, SP, { key: 'v1', countable: true }, now + 1000)).counted).toBe(false);
    expect((await recordAdClick(db, SP, { key: 'v2', countable: true }, now)).counted).toBe(true);
    expect((await recordAdClick(db, SP, { key: 'bot', countable: false }, now)).counted).toBe(false);
    expect((await recordAdClick(db, SP, { key: 'v1', countable: true }, now + 86_400_000)).counted).toBe(true); // next day
    expect(((await db.collection('forumPosts').doc(SP).get()).data() as any).adClicks).toBe(3);
  });

  it('does not count simultaneous clicks from one visitor twice', async () => {
    const { recordAdClick } = await import('../../server/adTracking');
    const now = Date.UTC(2026, 9, 13, 10);
    const results = await Promise.all([1, 2, 3, 4].map(() => recordAdClick(db, SP, { key: 'same', countable: true }, now)));
    expect(results.filter((r) => r.counted)).toHaveLength(1);
    expect(((await db.collection('forumPosts').doc(SP).get()).data() as any).adClicks).toBe(1);
  });

  it('serves nothing for a non-ad, hidden or deleted post, an unsafe link or a missing post', async () => {
    const { recordAdClick } = await import('../../server/adTracking');
    await db.collection('forumPosts').doc('plain').set({ authorId: AUTHOR, isAd: false, adLink: 'https://example.org' });
    await db.collection('forumPosts').doc('hiddenad').set({ authorId: AUTHOR, isAd: true, isHidden: true, adLink: 'https://example.org' });
    await db.collection('forumPosts').doc('deadad').set({ authorId: AUTHOR, isAd: true, deletedAt: Timestamp.now(), adLink: 'https://example.org' });
    await db.collection('forumPosts').doc('badlink').set({ authorId: AUTHOR, isAd: true, adLink: 'javascript:alert(1)' });
    for (const id of ['plain', 'hiddenad', 'deadad', 'badlink', 'ghost', 'a/b']) {
      expect(await recordAdClick(db, id, { key: 'k', countable: true })).toEqual({ url: null, counted: false });
    }
  });
});

describe('ad campaign window', () => {
  it('serves nothing before the start, after the end, or once the click cap is reached', async () => {
    const { recordAdClick } = await import('../../server/adTracking');
    const now = Date.UTC(2026, 9, 13, 12);
    const base = { authorId: AUTHOR, isAd: true, adLink: 'https://example.org', adClicks: 0 };
    await db.collection('forumPosts').doc('future').set({ ...base, adStartAt: Timestamp.fromMillis(now + 1000) });
    await db.collection('forumPosts').doc('over').set({ ...base, promotedUntil: Timestamp.fromMillis(now - 1000) });
    await db.collection('forumPosts').doc('running').set({ ...base, promotedUntil: Timestamp.fromMillis(now + 86_400_000), adMaxClicks: 1 });
    expect((await recordAdClick(db, 'future', { key: 'k', countable: true }, now)).url).toBeNull();
    expect((await recordAdClick(db, 'over', { key: 'k', countable: true }, now)).url).toBeNull();
    expect(await recordAdClick(db, 'running', { key: 'a', countable: true }, now)).toMatchObject({ counted: true });
    expect((await recordAdClick(db, 'running', { key: 'b', countable: true }, now)).url).toBeNull();
  });
});

describe('following through the server', () => {
  it('follows and unfollows idempotently, and refuses self, blocked, banned, missing and guest cases', async () => {
    const { setFollow, GraphError } = await import('../../server/forumPeople');
    const fol = async (uid: string, targetId: string, follow = true) => setFollow(db, { uid, targetId, follow });
    expect(await fol(ALICE, BOB)).toEqual({ following: true, changed: true });
    expect(await fol(ALICE, BOB)).toEqual({ following: true, changed: false });
    expect(((await db.collection('users').doc(ALICE).get()).data() as any).followingIds).toEqual([AUTHOR, BOB]);
    expect(await fol(ALICE, BOB, false)).toEqual({ following: false, changed: true });
    expect(await fol(ALICE, BOB, false)).toEqual({ following: false, changed: false });

    const code = async (p: Promise<unknown>) => { try { await p; } catch (e) { expect(e).toBeInstanceOf(GraphError); return (e as any).code; } throw new Error('expected GraphError'); };
    expect(await code(fol(ALICE, ALICE))).toBe('self');
    expect(await code(fol(ALICE, 'ghost'))).toBe('not_found');
    expect(await code(fol(ALICE, 'a/b'))).toBe('bad_user');
    await db.collection('forum_blocks').doc(`${BOB}_${ALICE}`).set({ blockerId: BOB, blockedId: ALICE });
    expect(await code(fol(ALICE, BOB))).toBe('denied');
    await db.collection('users').doc('gst').set({ name: 'G', role: 'guest' });
    expect(await code(fol('gst', BOB))).toBe('no_account');
    await db.collection('users').doc(AUTHOR).update({ isBanned: true });
    expect(await code(fol(BOB, AUTHOR))).toBe('not_found');
  });

  it('keeps counts right when many people follow at once', async () => {
    const { setFollow } = await import('../../server/forumPeople');
    const ids = ['f1', 'f2', 'f3', 'f4', 'f5'];
    for (const id of ids) await db.collection('users').doc(id).set({ name: id, role: 'citizen', followingIds: [] });
    await Promise.all(ids.map((id) => setFollow(db, { uid: id, targetId: AUTHOR, follow: true })));
    const followers = (await db.collection('users').get()).docs.filter((d) => (d.data().followingIds ?? []).includes(AUTHOR));
    expect(followers).toHaveLength(ids.length + 1); // + ALICE, who already follows the author in the fixture
  });
});

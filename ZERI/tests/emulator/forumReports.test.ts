import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { ReportError, findComment, submitReport } from '../../server/forumReports';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';

let db: Firestore;
beforeAll(() => {
  const app = getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-reports' });
  db = getFirestore(app);
});
afterAll(async () => { await db.terminate(); });

beforeEach(async () => {
  for (const col of ['users', 'forumPosts', 'forumReports']) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await db.doc('users/me').set({ name: 'Raportuesi', role: 'citizen' });
  await db.doc('users/guest').set({ name: 'G', role: 'guest' });
  await db.doc('users/bad').set({ name: 'Keqbërësi', role: 'citizen' });
  await db.doc('forumPosts/p1').set({
    authorId: 'author', content: 'post', isAd: false,
    comments: [{ id: 'c1', authorId: 'bad', authorName: 'Keqbërësi', content: 'fyerje', replies: [{ id: 'r1', authorId: 'me', authorName: 'Raportuesi', content: 'përgjigje' }] }],
  });
  await db.doc('forumPosts/ad1').set({ authorId: 'brand', content: 'Blej tani', isAd: true, comments: [] });
});

describe('findComment', () => {
  it('finds top level and nested comments', () => {
    const tree = [{ id: 'a', replies: [{ id: 'b', replies: [{ id: 'c' }] }] }];
    expect(findComment(tree, 'c')).toEqual({ id: 'c' });
    expect(findComment(tree, 'zz')).toBeNull();
    expect(findComment(undefined, 'a')).toBeNull();
  });
});

describe('submitReport', () => {
  it('stores a comment report with a snapshot of what was said, once per reporter', async () => {
    const r = await submitReport(db, { uid: 'me', kind: 'comment', targetId: 'c1', postId: 'p1', reason: 'abuse', details: ' shumë keq ' });
    expect(r.status).toBe('reported');
    const doc = (await db.doc('forumReports/comment_c1_me').get()).data()!;
    expect(doc).toMatchObject({ kind: 'comment', reportedUserId: 'bad', reporterId: 'me', reason: 'abuse', details: 'shumë keq', status: 'open', snapshot: { excerpt: 'fyerje', postId: 'p1' } });
    expect((await submitReport(db, { uid: 'me', kind: 'comment', targetId: 'c1', postId: 'p1', reason: 'spam' })).status).toBe('duplicate');
    expect((await db.collection('forumReports').get()).size).toBe(1);
  });

  it('refuses reporting your own comment, a missing comment, and guests', async () => {
    await expect(submitReport(db, { uid: 'me', kind: 'comment', targetId: 'r1', postId: 'p1', reason: 'abuse' })).rejects.toMatchObject({ code: 'self' });
    await expect(submitReport(db, { uid: 'me', kind: 'comment', targetId: 'nope', postId: 'p1', reason: 'abuse' })).rejects.toMatchObject({ code: 'not_found' });
    await expect(submitReport(db, { uid: 'guest', kind: 'user', targetId: 'bad', reason: 'abuse' })).rejects.toBeInstanceOf(ReportError);
  });

  it('reports accounts but not yourself or unknown ids', async () => {
    expect((await submitReport(db, { uid: 'me', kind: 'user', targetId: 'bad', reason: 'impersonation' })).status).toBe('reported');
    expect((await db.doc('forumReports/user_bad_me').get()).get('snapshot')).toEqual({ name: 'Keqbërësi' });
    await expect(submitReport(db, { uid: 'me', kind: 'user', targetId: 'me', reason: 'abuse' })).rejects.toMatchObject({ code: 'self' });
    await expect(submitReport(db, { uid: 'me', kind: 'user', targetId: 'ghost', reason: 'abuse' })).rejects.toMatchObject({ code: 'not_found' });
  });

  it('reports ads only when the post really is an ad, and normalises unknown reasons', async () => {
    expect((await submitReport(db, { uid: 'me', kind: 'ad', targetId: 'ad1', reason: 'weird' })).status).toBe('reported');
    expect((await db.doc('forumReports/ad_ad1_me').get()).get('reason')).toBe('other');
    await expect(submitReport(db, { uid: 'me', kind: 'ad', targetId: 'p1', reason: 'spam' })).rejects.toMatchObject({ code: 'not_ad' });
  });

  it('rejects malformed input', async () => {
    await expect(submitReport(db, { uid: 'me', kind: 'bogus' as any, targetId: 'x', reason: 'spam' })).rejects.toMatchObject({ code: 'bad_request' });
    await expect(submitReport(db, { uid: 'me', kind: 'user', targetId: 'a/b', reason: 'spam' })).rejects.toMatchObject({ code: 'bad_request' });
  });
});

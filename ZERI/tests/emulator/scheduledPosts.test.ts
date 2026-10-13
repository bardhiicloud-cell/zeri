import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  MAX_PENDING_PER_USER, cancelScheduled, cleanImageUrls, listScheduled, publishDueScheduled, schedulePost,
} from '../../server/scheduledPosts';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';

let db: Firestore;
const NOW = Date.UTC(2026, 9, 13, 12);
const MIN = 60_000;

beforeAll(() => { db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-scheduled' })); });
afterAll(async () => { await db.terminate(); });

beforeEach(async () => {
  for (const col of ['users', 'forumPosts', 'forumScheduled']) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await db.doc('users/me').set({ name: 'Arta', role: 'citizen', points: 5 });
  await db.doc('users/guest').set({ name: 'G', role: 'guest' });
  await db.doc('users/banned').set({ name: 'B', role: 'citizen', isBanned: true });
});

describe('cleanImageUrls', () => {
  it('keeps at most four clean https links', () => {
    const urls = ['https://a.test/1.jpg', 'http://a.test/2.jpg', 'javascript:1', 'https://a.test/ x.jpg', ...Array.from({ length: 6 }, (_, i) => `https://a.test/${i + 3}.jpg`)];
    expect(cleanImageUrls(urls)).toHaveLength(4);
    expect(cleanImageUrls(urls)[0]).toBe('https://a.test/1.jpg');
    expect(cleanImageUrls('x')).toEqual([]);
  });
});

describe('schedulePost', () => {
  it('stores a pending post and lists it', async () => {
    const { id } = await schedulePost(db, { uid: 'me', content: ' Ndeshje #rruga ', publishAtMs: NOW + 10 * MIN, imageUrls: ['https://a.test/1.jpg'] }, NOW);
    const items = await listScheduled(db, 'me');
    expect(items).toMatchObject([{ id, content: 'Ndeshje #rruga', visibility: 'public', publishAtMs: NOW + 10 * MIN, imageUrls: ['https://a.test/1.jpg'] }]);
  });

  it('refuses times that are too soon, too far, empty text, guests, banned and over-limit', async () => {
    await expect(schedulePost(db, { uid: 'me', content: 'x', publishAtMs: NOW + MIN }, NOW)).rejects.toMatchObject({ code: 'too_soon' });
    await expect(schedulePost(db, { uid: 'me', content: 'x', publishAtMs: NOW + 31 * 86_400_000 }, NOW)).rejects.toMatchObject({ code: 'too_far' });
    await expect(schedulePost(db, { uid: 'me', content: '  ', publishAtMs: NOW + 10 * MIN }, NOW)).rejects.toMatchObject({ code: 'bad_text' });
    await expect(schedulePost(db, { uid: 'guest', content: 'x', publishAtMs: NOW + 10 * MIN }, NOW)).rejects.toMatchObject({ code: 'no_account' });
    await expect(schedulePost(db, { uid: 'banned', content: 'x', publishAtMs: NOW + 10 * MIN }, NOW)).rejects.toMatchObject({ code: 'banned' });
    for (let i = 0; i < MAX_PENDING_PER_USER; i++) await schedulePost(db, { uid: 'me', content: `p${i}`, publishAtMs: NOW + 10 * MIN }, NOW);
    await expect(schedulePost(db, { uid: 'me', content: 'one more', publishAtMs: NOW + 10 * MIN }, NOW)).rejects.toMatchObject({ code: 'limit' });
  });

  it('cancels only your own pending post', async () => {
    const { id } = await schedulePost(db, { uid: 'me', content: 'x', publishAtMs: NOW + 10 * MIN }, NOW);
    await expect(cancelScheduled(db, 'other', id)).rejects.toMatchObject({ code: 'not_found' });
    await cancelScheduled(db, 'me', id);
    expect(await listScheduled(db, 'me')).toEqual([]);
  });
});

describe('publishDueScheduled', () => {
  it('publishes due posts once, built from the author profile, and leaves future ones', async () => {
    await schedulePost(db, { uid: 'me', content: 'Tani #tag', publishAtMs: NOW + 10 * MIN, imageUrls: ['https://a.test/1.jpg', 'https://a.test/2.jpg'], followersOnly: true }, NOW);
    await schedulePost(db, { uid: 'me', content: 'Më vonë', publishAtMs: NOW + 3 * 3_600_000 }, NOW);
    await db.doc('users/me').update({ name: 'Arta Re' }); // changed after scheduling

    expect(await publishDueScheduled(db, NOW + 5 * MIN)).toEqual([]);
    const [first, second] = await Promise.all([publishDueScheduled(db, NOW + 11 * MIN), publishDueScheduled(db, NOW + 11 * MIN)]);
    expect(first.length + second.length).toBe(1); // overlapping runs publish it once

    const posts = await db.collection('forumPosts').get();
    expect(posts.size).toBe(1);
    expect(posts.docs[0].data()).toMatchObject({
      authorId: 'me', authorName: 'Arta Re', content: 'Tani #tag', hashtags: ['tag'], visibility: 'followers', isAd: false,
      imageUrl: 'https://a.test/1.jpg', imageUrls: ['https://a.test/1.jpg', 'https://a.test/2.jpg'], likes: [], comments: [], isHidden: false,
    });
    expect(await publishDueScheduled(db, NOW + 11 * MIN)).toEqual([]);
    expect((await listScheduled(db, 'me')).map((x) => x.content)).toEqual(['Më vonë']);
  });

  it('marks a post failed instead of publishing when the author became banned', async () => {
    const { id } = await schedulePost(db, { uid: 'me', content: 'x', publishAtMs: NOW + 10 * MIN }, NOW);
    await db.doc('users/me').update({ isBanned: true });
    expect(await publishDueScheduled(db, NOW + 11 * MIN)).toEqual([]);
    expect((await db.doc(`forumScheduled/${id}`).get()).get('status')).toBe('failed');
    expect((await db.collection('forumPosts').get()).size).toBe(0);
    void Timestamp;
  });
});

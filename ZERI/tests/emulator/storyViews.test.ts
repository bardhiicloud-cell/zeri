import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { listStoryViewers, recordStoryView, replyToStory } from '../../server/storyViews';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';

let db: Firestore;
const NOW = Date.UTC(2026, 9, 13, 12);

beforeAll(() => { db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-story' })); });
afterAll(async () => { await db.terminate(); });

beforeEach(async () => {
  for (const col of ['users', 'forumStories', 'forum_blocks', 'forum_conversations', 'notifications']) {
    for (const ref of await db.collection(col).listDocuments()) await db.recursiveDelete(ref);
  }
  await db.doc('users/author').set({ name: 'Autori', role: 'citizen', followingIds: [] });
  await db.doc('users/v1').set({ name: 'Shikuesi Një', role: 'citizen', avatar: 'https://x.test/a.png' });
  await db.doc('users/v2').set({ name: 'Shikuesi Dy', role: 'citizen' });
  await db.doc('users/guest').set({ name: 'G', role: 'guest' });
  await db.doc('forumStories/live').set({ authorId: 'author', isHidden: false, expiresAt: Timestamp.fromMillis(NOW + 3_600_000) });
  await db.doc('forumStories/old').set({ authorId: 'author', isHidden: false, expiresAt: Timestamp.fromMillis(NOW - 1000) });
  await db.doc('forumStories/hid').set({ authorId: 'author', isHidden: true, expiresAt: Timestamp.fromMillis(NOW + 3_600_000) });
});

describe('story views', () => {
  it('records one view per viewer and ignores the author, guests and blocked pairs', async () => {
    expect(await recordStoryView(db, { storyId: 'live', uid: 'v1' }, NOW)).toEqual({ recorded: true });
    expect(await recordStoryView(db, { storyId: 'live', uid: 'v1' }, NOW)).toEqual({ recorded: false });
    expect(await recordStoryView(db, { storyId: 'live', uid: 'author' }, NOW)).toEqual({ recorded: false });
    expect(await recordStoryView(db, { storyId: 'live', uid: 'guest' }, NOW)).toEqual({ recorded: false });
    await db.doc('forum_blocks/author_v2').set({ blockerId: 'author', blockedId: 'v2' });
    expect(await recordStoryView(db, { storyId: 'live', uid: 'v2' }, NOW)).toEqual({ recorded: false });
    expect((await db.collection('forumStories/live/viewers').get()).size).toBe(1);
  });

  it('refuses expired, hidden and missing stories', async () => {
    await expect(recordStoryView(db, { storyId: 'old', uid: 'v1' }, NOW)).rejects.toMatchObject({ code: 'expired' });
    await expect(recordStoryView(db, { storyId: 'hid', uid: 'v1' }, NOW)).rejects.toMatchObject({ code: 'not_found' });
    await expect(recordStoryView(db, { storyId: 'nope', uid: 'v1' }, NOW)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('lists viewers for the author only, with current names, newest first', async () => {
    await recordStoryView(db, { storyId: 'live', uid: 'v1' }, NOW);
    await new Promise((r) => setTimeout(r, 20));
    await recordStoryView(db, { storyId: 'live', uid: 'v2' }, NOW);
    const { count, viewers } = await listStoryViewers(db, { storyId: 'live', uid: 'author' });
    expect(count).toBe(2);
    expect(viewers.map((v) => v.name)).toEqual(['Shikuesi Dy', 'Shikuesi Një']);
    expect(viewers[1].avatar).toBe('https://x.test/a.png');
    await expect(listStoryViewers(db, { storyId: 'live', uid: 'v1' })).rejects.toMatchObject({ code: 'forbidden' });
    await db.doc('users/v2').delete(); // erased account vanishes from the list
    expect((await listStoryViewers(db, { storyId: 'live', uid: 'author' })).viewers.map((v) => v.id)).toEqual(['v1']);
  });
});

describe('story replies', () => {
  it('arrive as a direct message to the author (a request when they are strangers)', async () => {
    const result = await replyToStory(db, { storyId: 'live', uid: 'v1', text: ' Bravo! ' }, NOW);
    expect(result.status).toBe('request');
    const msgs = await db.collection(`forum_conversations/${result.conversationId}/messages`).get();
    expect(msgs.docs[0].get('text')).toBe('↩ Përgjigje te story juaj: Bravo!');
  });

  it('refuses empty, too long, own-story, expired and blocked replies', async () => {
    await expect(replyToStory(db, { storyId: 'live', uid: 'v1', text: '  ' }, NOW)).rejects.toMatchObject({ code: 'empty' });
    await expect(replyToStory(db, { storyId: 'live', uid: 'v1', text: 'x'.repeat(501) }, NOW)).rejects.toMatchObject({ code: 'too_long' });
    await expect(replyToStory(db, { storyId: 'live', uid: 'author', text: 'hej' }, NOW)).rejects.toMatchObject({ code: 'self' });
    await expect(replyToStory(db, { storyId: 'old', uid: 'v1', text: 'hej' }, NOW)).rejects.toMatchObject({ code: 'expired' });
    await db.doc('forum_blocks/author_v1').set({ blockerId: 'author', blockedId: 'v1' });
    await expect(replyToStory(db, { storyId: 'live', uid: 'v1', text: 'hej' }, NOW)).rejects.toMatchObject({ statusCode: 403 });
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { DELETED_AUTHOR_ID, DELETED_AUTHOR_NAME, eraseUserData, type FileBucket } from '../../server/gdpr';

/**
 * Erasure against the real Firestore and Storage emulators.
 * Run with: npm run test:rules
 */
const ME = 'victim';
const OTHER = 'bystander';
const BUCKET = 'demo-zeri-gdpr.appspot.com';

let db: Firestore;
let bucket: ReturnType<ReturnType<typeof getStorage>['bucket']>;

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST is not set - run these tests through `npm run test:rules`.');
  }
  const app =
    getApps().find((a) => a.name === 'gdpr') ??
    initializeApp({ projectId: 'demo-zeri-gdpr', storageBucket: BUCKET }, 'gdpr');
  db = getFirestore(app);
  bucket = getStorage(app).bucket(BUCKET);
});

async function wipe() {
  for (const collection of await db.listCollections()) {
    for (const ref of await collection.listDocuments()) await db.recursiveDelete(ref);
  }
  await bucket.deleteFiles({ prefix: '', force: true }).catch(() => undefined);
}

const exists = async (path: string) => (await db.doc(path).get()).exists;
const fileExists = async (path: string) => (await bucket.file(path).exists())[0];

async function seed() {
  // Content others rely on -> anonymised
  await db.doc('reports/r1').set({ authorId: ME, authorName: 'Arta K.', title: 'Gropë', isAnonymous: false });
  await db.doc('reports/r2').set({ authorId: OTHER, authorName: 'Besa', title: 'Ndriçim' });
  await db.doc('reports/r1/comments/c1').set({ authorId: ME, authorName: 'Arta K.', content: 'Dakord' });
  await db.doc('reports/r1/comments/c2').set({ authorId: OTHER, authorName: 'Besa', content: 'Edhe unë' });
  await db.doc('forumPosts/p1').set({ authorId: ME, authorName: 'Arta K.', authorAvatar: 'https://a/b.png', content: 'Hej' });
  await db.doc('medicineShortages/m1').set({ authorId: ME, medicineName: 'X' });
  await db.doc('liveMessages/l1').set({ userId: ME, text: 'tung' });
  await db.doc('notifications/sent1').set({ userId: OTHER, actorId: ME, actorName: 'Arta K.', sender: 'Arta K.', title: 'Komentoi' });
  await db.doc('messages/sm1').set({ senderId: ME, senderName: 'Arta', receiverId: OTHER, receiverName: 'Komuna', text: 'Përshëndetje' });
  await db.doc('messages/sm2').set({ senderId: OTHER, senderName: 'Komuna', receiverId: ME, receiverName: 'Arta', text: 'Mirë' });

  // Private data -> deleted (450 notifications crosses the old 400-document cap)
  const batchSize = 100;
  for (let start = 0; start < 450; start += batchSize) {
    const batch = db.batch();
    for (let i = start; i < Math.min(start + batchSize, 450); i += 1) {
      batch.set(db.doc(`notifications/n${i}`), { userId: ME, title: `n${i}` });
    }
    await batch.commit();
  }
  await db.doc('notifications/keep1').set({ userId: OTHER, title: 'not mine' });
  await db.doc('notificationReads/nr1').set({ userId: ME, notificationId: 'a' });
  await db.doc('notificationReads/nr2').set({ userId: OTHER, notificationId: 'a' });
  await db.doc('supportChats/s1').set({ userId: ME, status: 'bot' });
  await db.doc('supportChats/s1/messages/sm').set({ text: 'ndihmë' });
  await db.doc('chats/ch1').set({ userId: ME });
  await db.doc('chats/ch1/messages/cm').set({ text: 'hej' });
  await db.doc('adRequests/a1').set({ userId: ME, phone: '+383' });
  await db.doc('healthRegistry/h1').set({ authorId: ME, fullName: 'Arta K.', diagnosis: 'x' });
  await db.doc('healthRegistry/h2').set({ authorId: OTHER, fullName: 'Besa', diagnosis: 'y' });
  await db.doc('forumStories/st1').set({ authorId: ME, mediaUrl: 'https://s/1.png' });
  await db.doc('polls/poll1/votes/' + ME).set({ optionId: 'a', uid: ME });
  await db.doc('polls/poll1/votes/' + OTHER).set({ optionId: 'b', uid: OTHER });
  await db.doc('reports/r2/upvotes/' + ME).set({ uid: ME });
  await db.doc('reports/r2/upvotes/' + OTHER).set({ uid: OTHER });

  // Direct messages
  await db.doc(`forum_conversations/${ME}_${OTHER}`).set({
    participants: [ME, OTHER],
    participantData: { [ME]: { name: 'Arta K.', avatar: 'a.png' }, [OTHER]: { name: 'Besa', avatar: 'b.png' } },
    lastMessage: 'last words',
  });
  await db.doc(`forum_conversations/${ME}_${OTHER}/messages/dm1`).set({ senderId: ME, text: 'nga unë' });
  await db.doc(`forum_conversations/${ME}_${OTHER}/messages/dm2`).set({ senderId: OTHER, text: 'nga ti' });
  await db.doc(`forum_conversations/${ME}_solo`).set({ participants: [ME], participantData: {} });
  await db.doc(`forum_conversations/${ME}_solo/messages/dm3`).set({ senderId: ME, text: 'vetëm' });

  // The person and a bystander
  await db.doc(`users/${ME}`).set({ id: ME, name: 'Arta K.' });
  await db.doc(`users/${OTHER}`).set({ id: OTHER, name: 'Besa' });

  // Files
  for (const path of [
    `avatars/${ME}/me.png`,
    `forum_dms/${ME}/c1/photo.png`,
    `forumStories/${ME}/s.mp4`,
    `health/${ME}/rec/doc.pdf`,
    `reports/${ME}/r1/evidence.png`,
    `avatars/${OTHER}/them.png`,
    `health/${OTHER}/rec/doc.pdf`,
  ]) {
    await bucket.file(path).save(Buffer.from([1, 2, 3]), { contentType: 'application/octet-stream' });
  }
}

beforeEach(async () => {
  await wipe();
  await seed();
});

afterAll(wipe);

describe('eraseUserData', () => {
  it('completes every step and reports success', { timeout: 60_000 }, async () => {
    const report = await eraseUserData(db, bucket as unknown as FileBucket, ME);
    expect(report.steps.filter((step) => step.error)).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('anonymises content other people rely on instead of deleting it', { timeout: 60_000 }, async () => {
    await eraseUserData(db, bucket as unknown as FileBucket, ME);

    const report = (await db.doc('reports/r1').get()).data()!;
    expect(report).toMatchObject({ authorId: DELETED_AUTHOR_ID, authorName: DELETED_AUTHOR_NAME, isAnonymous: true, title: 'Gropë' });

    expect((await db.doc('reports/r1/comments/c1').get()).data()).toMatchObject({ authorId: DELETED_AUTHOR_ID, content: 'Dakord' });
    expect((await db.doc('forumPosts/p1').get()).data()).toMatchObject({ authorId: DELETED_AUTHOR_ID, authorAvatar: '', content: 'Hej' });
    expect((await db.doc('medicineShortages/m1').get()).data()).toMatchObject({ authorId: DELETED_AUTHOR_ID });
    expect((await db.doc('liveMessages/l1').get()).data()).toMatchObject({ userId: DELETED_AUTHOR_ID });
    expect((await db.doc('notifications/sent1').get()).data()).toMatchObject({ actorId: DELETED_AUTHOR_ID, actorName: DELETED_AUTHOR_NAME, userId: OTHER });
  });

  it('keeps staff <-> municipality messages but removes the identity (both directions)', { timeout: 60_000 }, async () => {
    await eraseUserData(db, bucket as unknown as FileBucket, ME);
    expect((await db.doc('messages/sm1').get()).data()).toMatchObject({ senderId: DELETED_AUTHOR_ID, text: 'Përshëndetje', receiverId: OTHER });
    expect((await db.doc('messages/sm2').get()).data()).toMatchObject({ receiverId: DELETED_AUTHOR_ID, text: 'Mirë', senderId: OTHER });
  });

  it('deletes private data, including more than 400 documents in one collection', { timeout: 60_000 }, async () => {
    await eraseUserData(db, bucket as unknown as FileBucket, ME);

    const remaining = await db.collection('notifications').where('userId', '==', ME).get();
    expect(remaining.size).toBe(0);
    expect(await exists('notifications/n449')).toBe(false);
    expect(await exists('notificationReads/nr1')).toBe(false);
    expect(await exists('supportChats/s1')).toBe(false);
    expect(await exists('supportChats/s1/messages/sm')).toBe(false);
    expect(await exists('chats/ch1')).toBe(false);
    expect(await exists('chats/ch1/messages/cm')).toBe(false);
    expect(await exists('adRequests/a1')).toBe(false);
    expect(await exists('healthRegistry/h1')).toBe(false);
    expect(await exists('forumStories/st1')).toBe(false);
    expect(await exists(`polls/poll1/votes/${ME}`)).toBe(false);
    expect(await exists(`reports/r2/upvotes/${ME}`)).toBe(false);
  });

  it('removes the person from direct messages without destroying the other side', { timeout: 60_000 }, async () => {
    await eraseUserData(db, bucket as unknown as FileBucket, ME);

    expect(await exists(`forum_conversations/${ME}_${OTHER}/messages/dm1`)).toBe(false);
    expect(await exists(`forum_conversations/${ME}_${OTHER}/messages/dm2`)).toBe(true);
    const conversation = (await db.doc(`forum_conversations/${ME}_${OTHER}`).get()).data()!;
    expect(conversation.participantData[ME]).toEqual({ name: DELETED_AUTHOR_NAME, avatar: '' });
    expect(conversation.participantData[OTHER].name).toBe('Besa');
    expect(conversation.lastMessage).toBe('');

    // A conversation with nobody else in it goes away entirely.
    expect(await exists(`forum_conversations/${ME}_solo`)).toBe(false);
    expect(await exists(`forum_conversations/${ME}_solo/messages/dm3`)).toBe(false);
  });

  it('erases private files, keeps report media with the report, and never touches other people', { timeout: 60_000 }, async () => {
    await eraseUserData(db, bucket as unknown as FileBucket, ME);

    expect(await fileExists(`avatars/${ME}/me.png`)).toBe(false);
    expect(await fileExists(`forum_dms/${ME}/c1/photo.png`)).toBe(false);
    expect(await fileExists(`forumStories/${ME}/s.mp4`)).toBe(false);
    expect(await fileExists(`health/${ME}/rec/doc.pdf`)).toBe(false);

    expect(await fileExists(`reports/${ME}/r1/evidence.png`)).toBe(true);
    expect(await fileExists(`avatars/${OTHER}/them.png`)).toBe(true);
    expect(await fileExists(`health/${OTHER}/rec/doc.pdf`)).toBe(true);
  });

  it("leaves everyone else's data untouched", { timeout: 60_000 }, async () => {
    await eraseUserData(db, bucket as unknown as FileBucket, ME);

    expect((await db.doc('reports/r2').get()).data()).toMatchObject({ authorId: OTHER, authorName: 'Besa' });
    expect((await db.doc('reports/r1/comments/c2').get()).data()).toMatchObject({ authorId: OTHER });
    expect(await exists('notifications/keep1')).toBe(true);
    expect(await exists('notificationReads/nr2')).toBe(true);
    expect(await exists('healthRegistry/h2')).toBe(true);
    expect(await exists(`polls/poll1/votes/${OTHER}`)).toBe(true);
    expect(await exists(`reports/r2/upvotes/${OTHER}`)).toBe(true);
    expect(await exists(`users/${OTHER}`)).toBe(true);
  });

  it('does not remove the profile itself - the caller does that once every step succeeded', { timeout: 60_000 }, async () => {
    await eraseUserData(db, bucket as unknown as FileBucket, ME);
    expect(await exists(`users/${ME}`)).toBe(true);
  });

  it('is idempotent: running it again succeeds and changes nothing more', { timeout: 60_000 }, async () => {
    await eraseUserData(db, bucket as unknown as FileBucket, ME);
    const second = await eraseUserData(db, bucket as unknown as FileBucket, ME);
    expect(second.ok).toBe(true);
    expect(second.steps.find((step) => step.name === 'notifications')?.matched).toBe(0);
    expect(second.steps.find((step) => step.name === 'reports')?.matched).toBe(0);
  });

  it('reports a failing step and says the erasure is incomplete', { timeout: 60_000 }, async () => {
    const brokenBucket: FileBucket = {
      deleteFiles: async () => {
        throw new Error('storage unavailable');
      },
    };
    const report = await eraseUserData(db, brokenBucket, ME);
    expect(report.ok).toBe(false);
    expect(report.steps.find((step) => step.name === 'storage')?.error).toMatch(/storage unavailable/);
    // Firestore work still ran, so a retry only has the failed step left to do.
    expect(await exists('notifications/n0')).toBe(false);
  });

  it('treats a missing bucket as incomplete rather than silently skipping the files', { timeout: 60_000 }, async () => {
    const report = await eraseUserData(db, null, ME);
    expect(report.ok).toBe(false);
    expect(report.steps.find((step) => step.name === 'storage')?.error).toMatch(/No Storage bucket/);
  });

  it('refuses an empty uid', async () => {
    await expect(eraseUserData(db, null, '')).rejects.toThrow(/uid is required/);
  });
});

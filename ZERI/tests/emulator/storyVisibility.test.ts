import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { backfillStoryVisibility } from '../../scripts/storyVisibility';

/** Run with: npm run test:rules (emulators:exec provides FIRESTORE_EMULATOR_HOST). */
let db: Firestore;
const wipe = async () => { for (const r of await db.collection('forumStories').listDocuments()) await r.delete(); };

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through `npm run test:rules`.');
  db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-backfill' }));
});
beforeEach(async () => {
  await wipe();
  await db.collection('forumStories').doc('legacy1').set({ authorId: 'a' });
  await db.collection('forumStories').doc('legacy2').set({ authorId: 'b' });
  await db.collection('forumStories').doc('visible').set({ authorId: 'c', isHidden: false });
  await db.collection('forumStories').doc('hidden').set({ authorId: 'd', isHidden: true, hiddenBy: 'mod' });
});
afterAll(wipe);

const flag = async (id: string) => (await db.collection('forumStories').doc(id).get()).get('isHidden');

describe('backfillStoryVisibility', () => {
  it('dry run counts but writes nothing', async () => {
    expect(await backfillStoryVisibility(db, { apply: false })).toEqual({ scanned: 4, alreadyFlagged: 2, missing: 2 });
    expect(await flag('legacy1')).toBeUndefined();
  });

  it('apply flags only documents without the field and never un-hides a moderated story', async () => {
    expect(await backfillStoryVisibility(db, { apply: true })).toEqual({ scanned: 4, alreadyFlagged: 2, missing: 2 });
    expect(await flag('legacy1')).toBe(false);
    expect(await flag('legacy2')).toBe(false);
    expect(await flag('hidden')).toBe(true);
    expect((await db.collection('forumStories').doc('hidden').get()).get('hiddenBy')).toBe('mod');
  });

  it('is idempotent and pages through more documents than one page', async () => {
    await backfillStoryVisibility(db, { apply: true, pageSize: 1 });
    expect(await backfillStoryVisibility(db, { apply: true, pageSize: 1 })).toEqual({ scanned: 4, alreadyFlagged: 4, missing: 0 });
  });
});

describe('scrubPostEmails', () => {
  it('removes authorEmail from posts, changes nothing else and is idempotent', async () => {
    const { scrubPostEmails } = await import('../../scripts/postMaintenance');
    for (const r of await db.collection('forumPosts').listDocuments()) await r.delete();
    await db.collection('forumPosts').doc('a').set({ authorId: 'x', authorEmail: 'x@example.org', content: 'one' });
    await db.collection('forumPosts').doc('b').set({ authorId: 'y', content: 'two' });
    expect(await scrubPostEmails(db, { apply: false })).toEqual({ scanned: 2, withEmail: 1 });
    expect((await db.collection('forumPosts').doc('a').get()).get('authorEmail')).toBe('x@example.org');
    expect(await scrubPostEmails(db, { apply: true, pageSize: 1 })).toEqual({ scanned: 2, withEmail: 1 });
    const a = (await db.collection('forumPosts').doc('a').get()).data()!;
    expect(a).toEqual({ authorId: 'x', content: 'one' });
    expect(await scrubPostEmails(db, { apply: true })).toEqual({ scanned: 2, withEmail: 0 });
    for (const r of await db.collection('forumPosts').listDocuments()) await r.delete();
  });
});

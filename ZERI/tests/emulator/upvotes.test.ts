import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { UpvoteError, castUpvote } from '../../server/upvotes';

/**
 * Run with: npm run test:rules   (emulators:exec provides FIRESTORE_EMULATOR_HOST)
 * Uses its own emulator project id so other suites clearing their data cannot touch it.
 */
let db: Firestore;

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST is not set - run these tests through `npm run test:rules`.');
  }
  const app = getApps().find((a) => a.options.projectId === 'demo-zeri-upvotes') ?? initializeApp({ projectId: 'demo-zeri-upvotes' }, 'upvotes');
  db = getFirestore(app);
});

async function clear() {
  for (const ref of await db.collection('reports').listDocuments()) await db.recursiveDelete(ref);
}

beforeEach(async () => {
  await clear();
  await db.collection('reports').doc('r1').set({ title: 't', upvotes: 2 });
});

afterAll(clear);

async function upvoteErrorOf(promise: Promise<unknown>): Promise<UpvoteError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(UpvoteError);
    return error as UpvoteError;
  }
  throw new Error('expected the upvote to be refused');
}

describe('castUpvote', () => {
  it('increments the counter and records the supporter', async () => {
    const result = await castUpvote(db, 'r1', 'u1');
    expect(result.upvotes).toBe(3);
    expect((await db.collection('reports').doc('r1').get()).data()?.upvotes).toBe(3);
    expect((await db.collection('reports').doc('r1').collection('upvotes').doc('u1').get()).exists).toBe(true);
  });

  it('refuses a second upvote from the same account', async () => {
    await castUpvote(db, 'r1', 'u1');
    expect((await upvoteErrorOf(castUpvote(db, 'r1', 'u1'))).statusCode).toBe(409);
    expect((await db.collection('reports').doc('r1').get()).data()?.upvotes).toBe(3);
  });

  it('counts exactly one upvote when the same account fires many requests at once', { timeout: 30_000 }, async () => {
    const outcomes = await Promise.allSettled(Array.from({ length: 5 }, () => castUpvote(db, 'r1', 'dup')));
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled').length).toBe(1);
    expect((await db.collection('reports').doc('r1').get()).data()?.upvotes).toBe(3);
  });

  it('starts from zero when a report has no usable count (missing, or the legacy array form)', async () => {
    await db.collection('reports').doc('fresh').set({ title: 'x' });
    await db.collection('reports').doc('legacy').set({ title: 'y', upvotes: [] });
    expect((await castUpvote(db, 'fresh', 'u1')).upvotes).toBe(1);
    expect((await castUpvote(db, 'legacy', 'u1')).upvotes).toBe(1);
  });

  it('rejects an unknown report and empty input', async () => {
    expect((await upvoteErrorOf(castUpvote(db, 'missing', 'u1'))).statusCode).toBe(404);
    expect((await upvoteErrorOf(castUpvote(db, '', 'u1'))).statusCode).toBe(400);
    expect((await upvoteErrorOf(castUpvote(db, 'r1', ''))).statusCode).toBe(400);
  });
});

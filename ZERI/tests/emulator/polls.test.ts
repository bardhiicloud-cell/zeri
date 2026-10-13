import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { VoteError, castVote } from '../../server/polls';

/**
 * Exercises the real vote transaction against the Firestore emulator.
 * Run with: npm run test:rules   (emulators:exec provides FIRESTORE_EMULATOR_HOST)
 * Uses its own emulator project id so the rules tests clearing their data cannot touch it.
 */
let db: Firestore;

const options = () => [
  { id: 'a', text: 'A', votes: 0 },
  { id: 'b', text: 'B', votes: 0 },
];
const future = () => new Date(Date.now() + 86_400_000).toISOString();

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST is not set - run these tests through `npm run test:rules`.');
  }
  const app = getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-polls' });
  db = getFirestore(app);
});

beforeEach(async () => {
  const polls = await db.collection('polls').listDocuments();
  for (const ref of polls) await db.recursiveDelete(ref);
  await db.collection('polls').doc('p1').set({ question: 'q', options: options(), totalVotes: 0, expiresAt: future() });
});

afterAll(async () => {
  const polls = await db.collection('polls').listDocuments();
  for (const ref of polls) await db.recursiveDelete(ref);
});

async function voteErrorOf(promise: Promise<unknown>): Promise<VoteError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(VoteError);
    return error as VoteError;
  }
  throw new Error('expected the vote to be refused');
}

describe('castVote', () => {
  it('counts a vote and records the ballot', async () => {
    const result = await castVote(db, 'p1', 'u1', 'a');
    expect(result.totalVotes).toBe(1);
    expect(result.options.find((o) => o.id === 'a')?.votes).toBe(1);
    expect(result.options.find((o) => o.id === 'b')?.votes).toBe(0);

    const poll = (await db.collection('polls').doc('p1').get()).data()!;
    expect(poll.totalVotes).toBe(1);
    const ballot = await db.collection('polls').doc('p1').collection('votes').doc('u1').get();
    expect(ballot.exists).toBe(true);
    expect(ballot.data()?.optionId).toBe('a');
  });

  it('refuses a second vote from the same account, whichever option is chosen', async () => {
    await castVote(db, 'p1', 'u1', 'a');
    const error = await voteErrorOf(castVote(db, 'p1', 'u1', 'b'));
    expect(error.statusCode).toBe(409);
    expect(error.votedOptionId).toBe('a');

    const poll = (await db.collection('polls').doc('p1').get()).data()!;
    expect(poll.totalVotes).toBe(1);
  });

  it('lets different accounts vote and keeps the tallies consistent under concurrency', { timeout: 30_000 }, async () => {
    const voters = Array.from({ length: 6 }, (_, i) => `voter${i}`);
    await Promise.all(voters.map((uid, i) => castVote(db, 'p1', uid, i % 2 === 0 ? 'a' : 'b')));

    const poll = (await db.collection('polls').doc('p1').get()).data()!;
    expect(poll.totalVotes).toBe(6);
    const sum = (poll.options as Array<{ votes: number }>).reduce((total, o) => total + o.votes, 0);
    expect(sum).toBe(6);
  });

  it('counts exactly one vote when the same account fires many requests at once', { timeout: 30_000 }, async () => {
    const outcomes = await Promise.allSettled(Array.from({ length: 5 }, () => castVote(db, 'p1', 'dup', 'a')));
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled').length).toBe(1);

    const poll = (await db.collection('polls').doc('p1').get()).data()!;
    expect(poll.totalVotes).toBe(1);
  });

  it('rejects an unknown option, an unknown poll and a closed poll', async () => {
    expect((await voteErrorOf(castVote(db, 'p1', 'u1', 'zzz'))).statusCode).toBe(400);
    expect((await voteErrorOf(castVote(db, 'missing', 'u1', 'a'))).statusCode).toBe(404);

    await db.collection('polls').doc('old').set({
      question: 'q',
      options: options(),
      totalVotes: 0,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect((await voteErrorOf(castVote(db, 'old', 'u1', 'a'))).statusCode).toBe(410);
    const old = (await db.collection('polls').doc('old').get()).data()!;
    expect(old.totalVotes).toBe(0);
  });

  it('rejects empty input', async () => {
    expect((await voteErrorOf(castVote(db, '', 'u1', 'a'))).statusCode).toBe(400);
    expect((await voteErrorOf(castVote(db, 'p1', '', 'a'))).statusCode).toBe(400);
    expect((await voteErrorOf(castVote(db, 'p1', 'u1', ''))).statusCode).toBe(400);
  });
});

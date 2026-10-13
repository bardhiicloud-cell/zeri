/**
 * Poll voting.
 *
 * Votes used to be written by the browser straight into the poll document, and
 * the Firestore rule allowed any signed-in user - guests included - to replace the
 * whole `options` array, so a single request could set any result. "Already
 * voted" lived only in `localStorage`.
 *
 * Now the counters change only here, inside one transaction that also creates a
 * `polls/{pollId}/votes/{uid}` document. That document is the one-vote-per-account
 * guarantee: the second attempt finds it and is refused, whatever the client says.
 *
 * The Firestore instance is a parameter so the logic can be tested against the
 * emulator without importing the server's global Firebase initialisation.
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export class VoteError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 404 | 409 | 410,
    public readonly votedOptionId?: string
  ) {
    super(message);
    this.name = 'VoteError';
  }
}

export interface VoteResult {
  options: Array<Record<string, unknown>>;
  totalVotes: number;
  votedOptionId: string;
}

export async function castVote(
  firestore: Firestore,
  pollId: string,
  uid: string,
  optionId: string,
  now: number = Date.now()
): Promise<VoteResult> {
  if (!pollId || !uid || !optionId) throw new VoteError('Sondazhi ose opsioni mungon.', 400);

  const pollRef = firestore.collection('polls').doc(pollId);
  const voteRef = pollRef.collection('votes').doc(uid);

  try {
    return await firestore.runTransaction(async (transaction) => {
      const [pollSnapshot, voteSnapshot] = await Promise.all([transaction.get(pollRef), transaction.get(voteRef)]);

      if (!pollSnapshot.exists) throw new VoteError('Sondazhi nuk ekziston.', 404);
      if (voteSnapshot.exists) {
        throw new VoteError(
          'Keni votuar tashmë në këtë sondazh.',
          409,
          String(voteSnapshot.data()?.optionId ?? '')
        );
      }

      const poll = pollSnapshot.data() as Record<string, unknown>;

      const expiresAt = new Date(String(poll.expiresAt ?? '')).getTime();
      if (Number.isFinite(expiresAt) && expiresAt < now) throw new VoteError('Sondazhi ka përfunduar.', 410);

      const options = Array.isArray(poll.options) ? (poll.options as Array<Record<string, unknown>>) : [];
      if (!options.some((option) => option?.id === optionId)) {
        throw new VoteError('Opsioni i zgjedhur nuk ekziston.', 400);
      }

      const updatedOptions = options.map((option) =>
        option.id === optionId ? { ...option, votes: (Number(option.votes) || 0) + 1 } : option
      );
      const totalVotes = (Number(poll.totalVotes) || 0) + 1;

      transaction.update(pollRef, { options: updatedOptions, totalVotes });
      // `uid` is stored (the document id is the uid too) so a collection-group query can
      // find and erase this person's ballots on an erasure request.
      transaction.create(voteRef, { optionId, uid, createdAt: FieldValue.serverTimestamp() });

      return { options: updatedOptions, totalVotes, votedOptionId: optionId };
    });
  } catch (error) {
    // Two simultaneous requests from one account can both pass the existence
    // check above; the ballot is written with create(), so the second commit is
    // refused by Firestore itself (ALREADY_EXISTS). That is the real one-vote
    // guarantee - the read above only produces a friendlier message.
    const code = (error as { code?: unknown }).code;
    if (code === 6 || code === 'already-exists' || /ALREADY_EXISTS/i.test(String((error as Error)?.message))) {
      const ballot = await voteRef.get();
      throw new VoteError('Keni votuar tashmë në këtë sondazh.', 409, String(ballot.data()?.optionId ?? ''));
    }
    throw error;
  }
}

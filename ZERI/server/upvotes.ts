/**
 * "Support this report" upvotes.
 *
 * The browser used to increment `reports/{id}.upvotes` itself. The Firestore rules
 * (correctly) forbid anyone but the author from touching a report, so the write
 * failed every time while the interface showed the optimistic +1 - an upvote that
 * never existed. The counter is now changed here, once per account, using the same
 * pattern as poll votes: a `reports/{id}/upvotes/{uid}` document created in the
 * same transaction is the one-per-account guarantee.
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export class UpvoteError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 404 | 409
  ) {
    super(message);
    this.name = 'UpvoteError';
  }
}

export interface UpvoteResult {
  upvotes: number;
}

export async function castUpvote(firestore: Firestore, reportId: string, uid: string): Promise<UpvoteResult> {
  if (!reportId || !uid) throw new UpvoteError('Raporti mungon.', 400);

  const reportRef = firestore.collection('reports').doc(reportId);
  const upvoteRef = reportRef.collection('upvotes').doc(uid);

  try {
    return await firestore.runTransaction(async (transaction) => {
      const [reportSnapshot, upvoteSnapshot] = await Promise.all([
        transaction.get(reportRef),
        transaction.get(upvoteRef),
      ]);

      if (!reportSnapshot.exists) throw new UpvoteError('Raporti nuk u gjet.', 404);
      if (upvoteSnapshot.exists) throw new UpvoteError('E keni mbështetur tashmë këtë raport.', 409);

      // Older reports stored a number; a few early ones stored an array. Only a
      // finite number is a real count.
      const stored = reportSnapshot.data()?.upvotes;
      const current = typeof stored === 'number' && Number.isFinite(stored) ? stored : 0;

      transaction.update(reportRef, { upvotes: current + 1 });
      // create() fails atomically at commit if the ballot already exists, which is
      // what makes two simultaneous requests from one account count once.
      transaction.create(upvoteRef, { uid, createdAt: FieldValue.serverTimestamp() });

      return { upvotes: current + 1 };
    });
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code === 6 || code === 'already-exists' || /ALREADY_EXISTS/i.test(String((error as Error)?.message))) {
      throw new UpvoteError('E keni mbështetur tashmë këtë raport.', 409);
    }
    throw error;
  }
}

/**
 * Right to erasure (GDPR Art. 17 / Law No. 06/L-082).
 *
 * What the first version got wrong, and what this one does:
 *
 *  - it purged by a field the data does not have (`users` and `messages` were
 *    queried on `userId`; direct messages use `senderId`/`receiverId`, profiles are
 *    keyed by id), so those rows were never found;
 *  - it anonymised by `authorId` only, missing collections keyed by `userId`;
 *  - it handled only the first 400 documents of each collection;
 *  - it never touched Storage, although its comment said uploaded media was erased;
 *  - it swallowed every failure and still deleted the account, leaving orphaned
 *    personal data behind with no way for the person to retry.
 *
 * Here every step reports what it matched, pages through all matches, and the
 * caller deletes the account only when every step succeeded, so a failed erasure
 * can simply be run again (all steps are idempotent).
 *
 * Policy, unchanged from the original intent: content that other people rely on
 * (reports a municipality must act on, public forum posts, comments) is
 * ANONYMISED, not deleted; private data (notifications, support chats, health
 * records, stories, direct-message text, avatars, ballots) is DELETED. A report's
 * attached media stays with the report for the same reason the report does.
 *
 * Known limits (documented, not hidden): comments embedded inside other people's
 * forum posts are stored as array elements and cannot be queried by author;
 * `auditLogs` are retained as security records.
 */
import { FieldPath, FieldValue, type Firestore, type Query, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

export const DELETED_AUTHOR_ID = 'deleted-user';
export const DELETED_AUTHOR_NAME = 'Përdorues i fshirë';

/** The part of a Storage bucket this module needs (satisfied by @google-cloud/storage's Bucket). */
export interface FileBucket {
  deleteFiles(options: { prefix: string; force?: boolean }): Promise<unknown>;
}

export interface ErasureStep {
  name: string;
  /** Documents (or Storage prefixes) examined/changed. */
  matched: number;
  error?: string;
}

export interface ErasureReport {
  /** True only when every step completed; the account may then be removed. */
  ok: boolean;
  steps: ErasureStep[];
}

const PAGE_SIZE = 300;

/** Run `handler` over every page of `query`. Returns how many documents were seen. */
async function eachPage(
  query: Query,
  handler: (docs: QueryDocumentSnapshot[]) => Promise<void>
): Promise<number> {
  let seen = 0;
  let cursor: QueryDocumentSnapshot | undefined;
  for (;;) {
    let page = query.limit(PAGE_SIZE);
    if (cursor) page = page.startAfter(cursor);
    const snapshot = await page.get();
    if (snapshot.empty) break;
    await handler(snapshot.docs);
    seen += snapshot.size;
    cursor = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < PAGE_SIZE) break;
  }
  return seen;
}

async function anonymise(firestore: Firestore, query: Query, patch: Record<string, unknown>): Promise<number> {
  return eachPage(query, async (docs) => {
    const batch = firestore.batch();
    for (const doc of docs) batch.update(doc.ref, patch);
    await batch.commit();
  });
}

async function remove(firestore: Firestore, query: Query, recursive = false): Promise<number> {
  return eachPage(query, async (docs) => {
    if (recursive) {
      // Documents with subcollections (chat messages): delete the whole tree.
      for (const doc of docs) await firestore.recursiveDelete(doc.ref);
      return;
    }
    const batch = firestore.batch();
    for (const doc of docs) batch.delete(doc.ref);
    await batch.commit();
  });
}

/** Storage prefixes that hold only this person's private files. `reports/` is kept with the reports. */
export function privateStoragePrefixes(uid: string): string[] {
  return [
    `avatars/${uid}/`,
    `forum_dms/${uid}/`,
    `forumStories/${uid}/`,
    `forum_reels/${uid}/`,
    `forum/${uid}/`,
    `health/${uid}/`,
  ];
}

export async function eraseUserData(
  firestore: Firestore,
  bucket: FileBucket | null,
  uid: string
): Promise<ErasureReport> {
  if (!uid) throw new Error('A uid is required to erase personal data.');

  const steps: ErasureStep[] = [];
  const run = async (name: string, work: () => Promise<number>) => {
    try {
      steps.push({ name, matched: await work() });
    } catch (error) {
      steps.push({ name, matched: 0, error: (error as Error)?.message || String(error) });
    }
  };

  const col = (name: string) => firestore.collection(name);
  const authorPatch = { authorId: DELETED_AUTHOR_ID, authorName: DELETED_AUTHOR_NAME, authorAvatar: '', isAnonymous: true };

  // ── Content others rely on: anonymise ────────────────────────────────────
  await run('reports', () => anonymise(firestore, col('reports').where('authorId', '==', uid), authorPatch));
  // The author's e-mail used to be copied onto every public post; it goes with the identity.
  await run('forumPosts', () => anonymise(firestore, col('forumPosts').where('authorId', '==', uid), { ...authorPatch, authorEmail: FieldValue.delete() }));
  await run('reportComments', () =>
    anonymise(firestore, firestore.collectionGroup('comments').where('authorId', '==', uid), authorPatch)
  );
  await run('medicineShortages', () =>
    anonymise(firestore, col('medicineShortages').where('authorId', '==', uid), {
      authorId: DELETED_AUTHOR_ID,
      isAnonymous: true,
    })
  );
  await run('liveMessages', () =>
    anonymise(firestore, col('liveMessages').where('userId', '==', uid), { userId: DELETED_AUTHOR_ID })
  );
  await run('notificationsSentByUser', () =>
    anonymise(firestore, col('notifications').where('actorId', '==', uid), {
      actorId: DELETED_AUTHOR_ID,
      actorName: DELETED_AUTHOR_NAME,
      sender: DELETED_AUTHOR_NAME,
    })
  );
  // Staff <-> municipality correspondence is an operational record: keep the text,
  // drop the identity. (Both directions.)
  await run('staffMessagesSent', () =>
    anonymise(firestore, col('messages').where('senderId', '==', uid), {
      senderId: DELETED_AUTHOR_ID,
      senderName: DELETED_AUTHOR_NAME,
    })
  );
  await run('staffMessagesReceived', () =>
    anonymise(firestore, col('messages').where('receiverId', '==', uid), {
      receiverId: DELETED_AUTHOR_ID,
      receiverName: DELETED_AUTHOR_NAME,
    })
  );

  // ── Private data: delete ─────────────────────────────────────────────────
  await run('notifications', () => remove(firestore, col('notifications').where('userId', '==', uid)));
  await run('notificationReads', () => remove(firestore, col('notificationReads').where('userId', '==', uid)));
  await run('supportChats', () => remove(firestore, col('supportChats').where('userId', '==', uid), true));
  await run('chats', () => remove(firestore, col('chats').where('userId', '==', uid), true));
  await run('adRequests', () => remove(firestore, col('adRequests').where('userId', '==', uid)));
  await run('healthRegistry', () => remove(firestore, col('healthRegistry').where('authorId', '==', uid)));
  await run('forumStories', () => remove(firestore, col('forumStories').where('authorId', '==', uid)));
  // Reels are the person's own creative content: deleted with their comments (recursive),
  // the reports they filed, their blocks both ways and their DM privacy setting.
  await run('forumReels', () => remove(firestore, col('forumReels').where('authorId', '==', uid), true));
  await run('forumReelReportsFiled', () => remove(firestore, col('forumReelReports').where('reporterId', '==', uid)));
  await run('blocksMade', () => remove(firestore, col('forum_blocks').where('blockerId', '==', uid)));
  await run('blocksReceived', () => remove(firestore, col('forum_blocks').where('blockedId', '==', uid)));
  await run('dmSettings', async () => {
    const ref = col('forum_dm_settings').doc(uid);
    const snap = await ref.get();
    if (snap.exists) await ref.delete();
    return snap.exists ? 1 : 0;
  });
  // Their likes, reposts and reel likes live in other people's documents as ids: take the id out.
  for (const [name, collection, field] of [
    ['postLikes', 'forumPosts', 'likes'],
    ['postReposts', 'forumPosts', 'reposts'],
    ['reelLikes', 'forumReels', 'likedBy'],
  ] as const) {
    await run(name, () =>
      eachPage(col(collection).where(field, 'array-contains', uid), async (docs) => {
        const batch = firestore.batch();
        for (const doc of docs) batch.update(doc.ref, { [field]: FieldValue.arrayRemove(uid) });
        await batch.commit();
      })
    );
  }
  await run('pollBallots', () => remove(firestore, firestore.collectionGroup('votes').where('uid', '==', uid)));
  await run('reportUpvotes', () => remove(firestore, firestore.collectionGroup('upvotes').where('uid', '==', uid)));

  // Direct messages: remove what this person wrote, redact their profile in the
  // thread, and delete a conversation outright once nobody else is in it.
  await run('directMessages', () =>
    eachPage(col('forum_conversations').where('participants', 'array-contains', uid), async (conversations) => {
      for (const conversation of conversations) {
        await remove(firestore, conversation.ref.collection('messages').where('senderId', '==', uid));

        const participants: unknown[] = Array.isArray(conversation.data().participants)
          ? (conversation.data().participants as unknown[])
          : [];
        if (participants.every((participant) => participant === uid)) {
          await firestore.recursiveDelete(conversation.ref);
          continue;
        }
        await conversation.ref.update(
          new FieldPath('participantData', uid),
          { name: DELETED_AUTHOR_NAME, avatar: '' },
          'lastMessage',
          ''
        );
      }
    })
  );

  // ── Files ────────────────────────────────────────────────────────────────
  if (bucket) {
    await run('storage', async () => {
      const prefixes = privateStoragePrefixes(uid);
      for (const prefix of prefixes) await bucket.deleteFiles({ prefix, force: true });
      return prefixes.length;
    });
  } else {
    steps.push({ name: 'storage', matched: 0, error: 'No Storage bucket is configured, so uploaded files could not be erased.' });
  }

  return { ok: steps.every((step) => !step.error), steps };
}


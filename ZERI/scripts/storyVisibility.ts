import type { Firestore } from 'firebase-admin/firestore';

export interface BackfillResult {
  scanned: number;
  alreadyFlagged: number;
  /** Documents that lacked the flag (updated only when `apply`). */
  missing: number;
}

/**
 * Sets `isHidden: false` on forumStories documents that have no `isHidden`
 * field. Never touches a document that already has the field, so a story a
 * moderator hid stays hidden. Pages through the collection; the Firestore
 * instance is a parameter so this runs against the emulator in tests.
 */
export async function backfillStoryVisibility(
  firestore: Firestore,
  options: { apply: boolean; pageSize?: number },
): Promise<BackfillResult> {
  const pageSize = options.pageSize ?? 300;
  const result: BackfillResult = { scanned: 0, alreadyFlagged: 0, missing: 0 };
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  for (;;) {
    let q = firestore.collection('forumStories').orderBy('__name__').limit(pageSize);
    if (last) q = q.startAfter(last);
    const page = await q.get();
    if (page.empty) break;

    const batch = firestore.batch();
    let writes = 0;
    for (const doc of page.docs) {
      result.scanned += 1;
      if (typeof doc.get('isHidden') === 'boolean') { result.alreadyFlagged += 1; continue; }
      result.missing += 1;
      if (options.apply) { batch.update(doc.ref, { isHidden: false }); writes += 1; }
    }
    if (writes > 0) await batch.commit();
    last = page.docs[page.docs.length - 1];
    if (page.size < pageSize) break;
  }
  return result;
}

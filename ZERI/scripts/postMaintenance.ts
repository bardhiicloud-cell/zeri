import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export interface ScrubResult {
  scanned: number;
  /** Posts that carried an `authorEmail` (removed only when `apply`). */
  withEmail: number;
}

/**
 * Removes `authorEmail` from existing public posts. Older versions of the app copied the
 * author's e-mail onto every post, and posts are readable by everyone. Never touches any
 * other field; idempotent.
 */
export async function scrubPostEmails(firestore: Firestore, options: { apply: boolean; pageSize?: number }): Promise<ScrubResult> {
  const pageSize = options.pageSize ?? 300;
  const result: ScrubResult = { scanned: 0, withEmail: 0 };
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = firestore.collection('forumPosts').orderBy('__name__').limit(pageSize);
    if (last) q = q.startAfter(last);
    const page = await q.get();
    if (page.empty) break;
    const batch = firestore.batch();
    let writes = 0;
    for (const doc of page.docs) {
      result.scanned += 1;
      if (doc.get('authorEmail') === undefined) continue;
      result.withEmail += 1;
      if (options.apply) { batch.update(doc.ref, { authorEmail: FieldValue.delete() }); writes += 1; }
    }
    if (writes > 0) await batch.commit();
    last = page.docs[page.docs.length - 1];
    if (page.size < pageSize) break;
  }
  return result;
}

export interface VisibilityResult {
  scanned: number;
  /** Posts that had no `visibility` (set to 'public' only when `apply`). */
  missing: number;
}

/**
 * Gives every post an explicit `visibility`. The Firestore rules now serve only
 * `visibility == 'public'` to the public, so a post without the field would vanish
 * from the feed. Posts that already have it (including 'followers') are untouched.
 */
export async function backfillPostVisibility(firestore: Firestore, options: { apply: boolean; pageSize?: number }): Promise<VisibilityResult> {
  const pageSize = options.pageSize ?? 300;
  const result: VisibilityResult = { scanned: 0, missing: 0 };
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = firestore.collection('forumPosts').orderBy('__name__').limit(pageSize);
    if (last) q = q.startAfter(last);
    const page = await q.get();
    if (page.empty) break;
    const batch = firestore.batch();
    let writes = 0;
    for (const doc of page.docs) {
      result.scanned += 1;
      const v = doc.get('visibility');
      if (v === 'public' || v === 'followers') continue;
      result.missing += 1;
      if (options.apply) { batch.update(doc.ref, { visibility: 'public' }); writes += 1; }
    }
    if (writes > 0) await batch.commit();
    last = page.docs[page.docs.length - 1];
    if (page.size < pageSize) break;
  }
  return result;
}

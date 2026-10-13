import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { extractHashtags } from '../src/lib/forumTrends';

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

export interface CommentAuthorsResult { scanned: number; posts: number }

/**
 * Builds `commentAuthorIds` for posts written before the server kept it, so that erasing an
 * account can find and anonymise comments left on other people's posts. Adds ids only;
 * never changes a comment. Idempotent.
 */
export async function backfillCommentAuthors(firestore: Firestore, options: { apply: boolean; pageSize?: number }): Promise<CommentAuthorsResult> {
  const pageSize = options.pageSize ?? 300;
  const result: CommentAuthorsResult = { scanned: 0, posts: 0 };
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
      const ids = new Set<string>();
      const comments = doc.get('comments');
      if (Array.isArray(comments)) {
        for (const c of comments) {
          if (typeof c?.authorId === 'string') ids.add(c.authorId);
          if (Array.isArray(c?.replies)) for (const r of c.replies) if (typeof r?.authorId === 'string') ids.add(r.authorId);
        }
      }
      const existing = new Set<string>(Array.isArray(doc.get('commentAuthorIds')) ? doc.get('commentAuthorIds') : []);
      const missing = [...ids].filter((id) => !existing.has(id));
      if (missing.length === 0) continue;
      result.posts += 1;
      if (options.apply) { batch.update(doc.ref, { commentAuthorIds: FieldValue.arrayUnion(...missing) }); writes += 1; }
    }
    if (writes > 0) await batch.commit();
    last = page.docs[page.docs.length - 1];
    if (page.size < pageSize) break;
  }
  return result;
}

export interface HashtagBackfillResult { scanned: number; posts: number }

/** Writes `hashtags` on posts that predate the field, so hashtag pages can find them. */
export async function backfillPostHashtags(firestore: Firestore, options: { apply: boolean; pageSize?: number }): Promise<HashtagBackfillResult> {
  const pageSize = options.pageSize ?? 300;
  const result: HashtagBackfillResult = { scanned: 0, posts: 0 };
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
      if (Array.isArray(doc.get('hashtags'))) continue;
      const tags = extractHashtags(String(doc.get('content') ?? '')).slice(0, 10);
      result.posts += 1;
      if (options.apply) { batch.update(doc.ref, { hashtags: tags }); writes += 1; }
    }
    if (writes > 0) await batch.commit();
    last = page.docs[page.docs.length - 1];
    if (page.size < pageSize) break;
  }
  return result;
}

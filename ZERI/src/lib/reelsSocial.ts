import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { REELS_COLLECTION, isHttpsUrl, toReel, type Reel, type ReelsCursor } from './reels';

/**
 * Everything around a Reel that is not playback or publishing: profile and
 * hashtag queries, comments and the moderator queue. Kept apart from reels.ts
 * so the player does not pull in moderation code.
 */

/* ───────────── Profile and hashtag search ───────────── */

/**
 * Reels of one author, newest first. The owner also sees reels hidden by
 * moderation (rules allow it); everyone else is filtered to visible ones.
 * Indexes: forumReels(authorId, createdAt desc) and (authorId, isHidden, createdAt desc).
 */
export async function fetchReelsByAuthor(authorId: string, includeHidden: boolean, max = 30): Promise<(Reel & { hidden?: boolean })[]> {
  const q = includeHidden
    ? query(collection(db, REELS_COLLECTION), where('authorId', '==', authorId), orderBy('createdAt', 'desc'), limit(max))
    : query(collection(db, REELS_COLLECTION), where('authorId', '==', authorId), where('isHidden', '==', false), orderBy('createdAt', 'desc'), limit(max));
  const snap = await getDocs(q);
  const rows: (Reel & { hidden?: boolean })[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    // The owner keeps seeing a hidden reel (marked), so toReel must not drop it.
    const reel = toReel(d.id, includeHidden ? { ...data, isHidden: false } : data);
    if (reel) rows.push(includeHidden && data.isHidden === true ? { ...reel, hidden: true } : reel);
  }
  return rows;
}

/** Lower-cases and strips a leading `#`; null when it is not a valid tag. */
export function normalizeHashtag(raw: string): string | null {
  const tag = raw.trim().replace(/^#/, '').toLowerCase();
  return /^[\p{L}\p{N}_]{2,40}$/u.test(tag) ? tag : null;
}

/** Reels carrying a hashtag. Index: forumReels(hashtags contains, isHidden, createdAt desc). */
export async function fetchReelsByHashtag(rawTag: string, max = 20): Promise<Reel[]> {
  const tag = normalizeHashtag(rawTag);
  if (!tag) return [];
  const snap = await getDocs(query(
    collection(db, REELS_COLLECTION),
    where('hashtags', 'array-contains', tag),
    where('isHidden', '==', false),
    orderBy('createdAt', 'desc'),
    limit(max),
  ));
  return snap.docs.map((d) => toReel(d.id, d.data())).filter((r): r is Reel => r !== null);
}

/* ───────────── Comments ───────────── */

export const REEL_COMMENT_MAX = 300;
export const REEL_COMMENTS_PAGE = 20;

export interface ReelComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  text: string;
  createdAtMs: number | null;
}

export function validateComment(raw: string): { text: string; error: string | null } {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return { text, error: 'Shkruani një koment.' };
  if (text.length > REEL_COMMENT_MAX) return { text, error: `Komenti ka ${text.length} karaktere; kufiri është ${REEL_COMMENT_MAX}.` };
  return { text, error: null };
}

export function toComment(id: string, data: Record<string, any> | undefined): ReelComment | null {
  if (!data || typeof data.authorId !== 'string' || typeof data.text !== 'string' || !data.text) return null;
  return {
    id,
    authorId: data.authorId,
    authorName: typeof data.authorName === 'string' && data.authorName.trim() ? data.authorName : 'Qytetar',
    authorAvatar: isHttpsUrl(data.authorAvatar) ? data.authorAvatar : null,
    text: data.text,
    createdAtMs: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : null,
  };
}

const commentsOf = (reelId: string) => collection(db, REELS_COLLECTION, reelId, 'comments');

export async function fetchReelComments(
  reelId: string, cursor: ReelsCursor,
): Promise<{ comments: ReelComment[]; cursor: ReelsCursor; done: boolean }> {
  const base = [orderBy('createdAt', 'desc')] as const;
  const q = cursor
    ? query(commentsOf(reelId), ...base, startAfter(cursor), limit(REEL_COMMENTS_PAGE))
    : query(commentsOf(reelId), ...base, limit(REEL_COMMENTS_PAGE));
  const snap = await getDocs(q);
  return {
    comments: snap.docs.map((d) => toComment(d.id, d.data())).filter((c): c is ReelComment => c !== null),
    cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : cursor,
    done: snap.docs.length < REEL_COMMENTS_PAGE,
  };
}

export async function addReelComment(
  reelId: string, rawText: string, author: { id: string; name: string; avatar?: string | null },
): Promise<ReelComment> {
  const uid = auth.currentUser?.uid;
  if (!uid || uid !== author.id || auth.currentUser?.isAnonymous) throw new Error('Kyçuni për të komentuar.');
  const { text, error } = validateComment(rawText);
  if (error) throw new Error(error);
  const avatar = author.avatar && isHttpsUrl(author.avatar) ? author.avatar : null;
  const created = await addDoc(commentsOf(reelId), {
    authorId: uid,
    authorName: author.name.slice(0, 120) || 'Qytetar',
    ...(avatar ? { authorAvatar: avatar } : {}),
    text,
    createdAt: serverTimestamp(),
  });
  return { id: created.id, authorId: uid, authorName: author.name || 'Qytetar', authorAvatar: avatar, text, createdAtMs: Date.now() };
}

export async function deleteReelComment(reelId: string, commentId: string): Promise<void> {
  await deleteDoc(doc(db, REELS_COLLECTION, reelId, 'comments', commentId));
}

/* ───────────── Moderation (staff) ───────────── */

export interface ReelReport {
  id: string;
  reelId: string;
  reporterId: string;
  reason: string;
  details: string;
  status: 'open' | 'resolved';
  createdAtMs: number | null;
}

export function toReport(id: string, data: Record<string, any> | undefined): ReelReport | null {
  if (!data || typeof data.reelId !== 'string' || typeof data.reporterId !== 'string') return null;
  return {
    id,
    reelId: data.reelId,
    reporterId: data.reporterId,
    reason: typeof data.reason === 'string' ? data.reason : 'other',
    details: typeof data.details === 'string' ? data.details : '',
    status: data.status === 'resolved' ? 'resolved' : 'open',
    createdAtMs: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : null,
  };
}

/** Groups reports by reel, most-reported first, so a moderator reviews each reel once. */
export function groupReportsByReel(reports: ReelReport[]): { reelId: string; reports: ReelReport[] }[] {
  const map = new Map<string, ReelReport[]>();
  for (const r of reports) map.set(r.reelId, [...(map.get(r.reelId) ?? []), r]);
  return [...map.entries()]
    .map(([reelId, list]) => ({ reelId, reports: list }))
    .sort((a, b) => b.reports.length - a.reports.length || (b.reports[0].createdAtMs ?? 0) - (a.reports[0].createdAtMs ?? 0));
}

/** Index: forumReelReports(status, createdAt desc). */
export async function fetchOpenReelReports(max = 100): Promise<ReelReport[]> {
  const snap = await getDocs(query(
    collection(db, 'forumReelReports'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(max),
  ));
  return snap.docs.map((d) => toReport(d.id, d.data())).filter((r): r is ReelReport => r !== null);
}

/** Staff must see a reel even when it is already hidden, so isHidden is ignored here. */
export async function fetchReelForReview(reelId: string): Promise<(Reel & { isHidden: boolean }) | null> {
  const snap = await getDoc(doc(db, REELS_COLLECTION, reelId));
  if (!snap.exists()) return null;
  const data = snap.data();
  const reel = toReel(snap.id, { ...data, isHidden: false });
  return reel ? { ...reel, isHidden: data.isHidden === true } : null;
}

export async function setReelHidden(reelId: string, hidden: boolean, staffId: string, reason: string): Promise<void> {
  await updateDoc(doc(db, REELS_COLLECTION, reelId), {
    isHidden: hidden,
    hiddenReason: hidden ? reason.slice(0, 200) : '',
    hiddenBy: staffId,
    hiddenAt: serverTimestamp(),
  });
}

/** Closes every open report on a reel after a decision (hide or keep). */
export async function resolveReelReports(reports: ReelReport[], staffId: string): Promise<void> {
  await Promise.all(reports.map((r) => updateDoc(doc(db, 'forumReelReports', r.id), {
    status: 'resolved', resolvedBy: staffId, resolvedAt: serverTimestamp(),
  })));
}

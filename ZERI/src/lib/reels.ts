import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { UploadTask } from 'firebase/storage';
import { auth, db, loadStorage } from './firebase';

/**
 * Reels: short vertical videos that stay on the profile, unlike 24-hour
 * Stories (`forumStories`).
 *
 * Canonical store: Firestore `forumReels`, media under Storage
 * `forum_reels/{uid}/…`. The limits below mirror storage.rules and the
 * `forumReels` block in firestore.rules; change them together.
 */
export const REELS_COLLECTION = 'forumReels';
export const REEL_ALLOWED_TYPES = ['video/mp4', 'video/webm'] as const;
/** storage.rules: `request.resource.size < 30 * 1024 * 1024` on forum_reels. */
export const REEL_MAX_BYTES = 30 * 1024 * 1024 - 1;
export const REEL_MAX_DURATION_SEC = 90;
export const REEL_MIN_DURATION_SEC = 1;
export const REEL_CAPTION_MAX = 300;
export const REEL_MAX_HASHTAGS = 10;
export const REEL_PAGE_SIZE = 8;

export interface Reel {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  mediaUrl: string;
  /** JPEG frame chosen by the author, shown before the video plays and in grids. */
  coverUrl: string | null;
  /** Credit for music the author added; null when the original sound is used. */
  audioTitle: string | null;
  caption: string;
  hashtags: string[];
  durationSec: number | null;
  likedBy: string[];
  /** Counted by the server, once per signed-in account. */
  viewCount: number;
  createdAtMs: number | null;
}

/** Returns an Albanian error message, or null when the file can be uploaded. */
export function validateReelFile(file: { type: string; size: number } | null | undefined): string | null {
  if (!file) return 'Zgjidhni një video.';
  if (!(REEL_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return `Formati "${file.type || 'i panjohur'}" nuk lejohet. Lejohen vetëm video MP4 ose WebM.`;
  }
  if (file.size <= 0) return 'Fajlli është bosh.';
  if (file.size > REEL_MAX_BYTES) {
    return `Video është ${(file.size / 1024 / 1024).toFixed(1)} MB; kufiri është 30 MB.`;
  }
  return null;
}

export function validateReelDuration(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Kohëzgjatja e videos nuk mund të lexohet. Provoni një fajll tjetër.';
  if (seconds < REEL_MIN_DURATION_SEC) return 'Video është shumë e shkurtër.';
  if (seconds > REEL_MAX_DURATION_SEC + 0.5) {
    return `Video zgjat ${Math.round(seconds)} sekonda; kufiri është ${REEL_MAX_DURATION_SEC} sekonda.`;
  }
  return null;
}

/** Trims, collapses runs of blank lines and enforces the length limit. */
export function normalizeCaption(raw: string): { caption: string; error: string | null } {
  const caption = raw.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (caption.length > REEL_CAPTION_MAX) {
    return { caption, error: `Përshkrimi ka ${caption.length} karaktere; kufiri është ${REEL_CAPTION_MAX}.` };
  }
  return { caption, error: null };
}

/** Lower-cased, de-duplicated hashtags without the `#`, in order of first use. */
export function extractHashtags(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  // A tag starts the text or follows whitespace/opening punctuation, so
  // `email#x` and URL fragments (`…/#x`) are not tags.
  for (const match of text.matchAll(/(^|[\s([{"'«„,;:!?])#([\p{L}\p{N}_]{2,40})/gu)) {
    const tag = match[2].toLowerCase();
    if (!seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
    if (out.length >= REEL_MAX_HASHTAGS) break;
  }
  return out;
}

export const isHttpsUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    // http is allowed only for the local Storage emulator.
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname));
  } catch {
    return false;
  }
};

/**
 * Turns a Firestore document into a Reel, or null when it must not be shown
 * (hidden by moderation, missing/unsafe media). Rules already filter hidden
 * reels; this is the second line so a bad document cannot break the viewer.
 */
export function toReel(id: string, data: Record<string, any> | undefined): Reel | null {
  if (!data || data.isHidden === true) return null;
  if (data.mediaType !== 'video' || !isHttpsUrl(data.mediaUrl)) return null;
  if (typeof data.authorId !== 'string' || !data.authorId) return null;
  const created = data.createdAt;
  return {
    id,
    authorId: data.authorId,
    authorName: typeof data.authorName === 'string' && data.authorName.trim() ? data.authorName : 'Qytetar',
    authorAvatar: isHttpsUrl(data.authorAvatar) ? data.authorAvatar : null,
    mediaUrl: data.mediaUrl,
    coverUrl: isHttpsUrl(data.coverUrl) ? data.coverUrl : null,
    audioTitle: typeof data.audioTitle === 'string' && data.audioTitle.trim() ? data.audioTitle.trim().slice(0, 80) : null,
    caption: typeof data.caption === 'string' ? data.caption : '',
    hashtags: Array.isArray(data.hashtags) ? data.hashtags.filter((t: unknown) => typeof t === 'string') : [],
    durationSec: typeof data.durationSec === 'number' ? data.durationSec : null,
    likedBy: Array.isArray(data.likedBy) ? data.likedBy.filter((u: unknown) => typeof u === 'string') : [],
    viewCount: typeof data.viewCount === 'number' && data.viewCount > 0 ? Math.floor(data.viewCount) : 0,
    createdAtMs: typeof created?.toMillis === 'function' ? created.toMillis() : null,
  };
}

/** Optimistic like state; the server write is reconciled by the caller. */
export function toggleLike(likedBy: string[], uid: string): string[] {
  return likedBy.includes(uid) ? likedBy.filter((id) => id !== uid) : [...likedBy, uid];
}

export type ReelsCursor = QueryDocumentSnapshot | DocumentSnapshot | null;

/**
 * One page of visible reels, newest first. The `isHidden == false` filter is
 * required: the read rule only admits visible reels, and Firestore rejects a
 * list query the rule cannot prove safe. Index: forumReels(isHidden, createdAt desc).
 */
export async function fetchReelsPage(cursor: ReelsCursor): Promise<{ reels: Reel[]; cursor: ReelsCursor; done: boolean }> {
  const base = [where('isHidden', '==', false), orderBy('createdAt', 'desc')] as const;
  const q = cursor
    ? query(collection(db, REELS_COLLECTION), ...base, startAfter(cursor), limit(REEL_PAGE_SIZE))
    : query(collection(db, REELS_COLLECTION), ...base, limit(REEL_PAGE_SIZE));
  const snap = await getDocs(q);
  const reels = snap.docs.map((d) => toReel(d.id, d.data())).filter((r): r is Reel => r !== null);
  return {
    reels,
    cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : cursor,
    done: snap.docs.length < REEL_PAGE_SIZE,
  };
}

export async function setReelLiked(reelId: string, liked: boolean): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Kyçuni për të pëlqyer.');
  await updateDoc(doc(db, REELS_COLLECTION, reelId), { likedBy: liked ? arrayUnion(uid) : arrayRemove(uid) });
}

export const REEL_REPORT_REASONS = [
  { id: 'spam', label: 'Spam ose reklamë e padëshiruar' },
  { id: 'abuse', label: 'Ngacmim ose gjuhë urrejtjeje' },
  { id: 'misinformation', label: 'Dezinformim' },
  { id: 'violence', label: 'Dhunë ose rrezik' },
  { id: 'privacy', label: 'Shkelje e privatësisë' },
  { id: 'other', label: 'Tjetër' },
] as const;
export type ReelReportReason = (typeof REEL_REPORT_REASONS)[number]['id'];

/** One report per reporter per reel; a repeat is reported as already sent. */
export async function reportReel(reelId: string, reason: ReelReportReason, details: string): Promise<'sent' | 'duplicate'> {
  const uid = auth.currentUser?.uid;
  if (!uid || auth.currentUser?.isAnonymous) throw new Error('Kyçuni për të raportuar.');
  const cleaned = details.trim().slice(0, 300);
  try {
    await setDoc(doc(db, 'forumReelReports', `${reelId}_${uid}`), {
      reelId, reporterId: uid, reason, details: cleaned, status: 'open', createdAt: serverTimestamp(),
    });
    return 'sent';
  } catch (error: any) {
    // Overwriting an existing report is an update, which rules refuse for non-staff.
    if (error?.code === 'permission-denied') return 'duplicate';
    throw error;
  }
}

/** Reads duration from the file's metadata without uploading it. */
export function readVideoDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const done = (value: number) => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      resolve(value);
    };
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => done(video.duration);
    video.onerror = () => done(Number.NaN);
    video.src = url;
  });
}

export interface PublishReelInput {
  file: File;
  caption: string;
  durationSec: number;
  /** Optional cover frame (JPEG). Uploaded with the video and removed again if publishing fails. */
  cover?: Blob | null;
  /** Credit text for added music; the author confirmed the right to use it in the editor. */
  audioTitle?: string | null;
  author: { id: string; name: string; avatar?: string | null };
  onProgress?: (fraction: number) => void;
  /** Receives the upload task so the caller can cancel it. */
  onTask?: (task: UploadTask) => void;
}

/**
 * Upload first, then create the document, so a failed upload never leaves a
 * reel pointing at missing media. If the document write fails the uploaded
 * object is deleted (best effort).
 */
export async function publishReel(input: PublishReelInput): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid || uid !== input.author.id) throw new Error('Sesioni ka skaduar. Kyçuni përsëri.');
  if (auth.currentUser?.isAnonymous) throw new Error('Mysafirët nuk mund të publikojnë Reels.');

  const fileError = validateReelFile(input.file);
  if (fileError) throw new Error(fileError);
  const durationError = validateReelDuration(input.durationSec);
  if (durationError) throw new Error(durationError);
  const { caption, error: captionError } = normalizeCaption(input.caption);
  if (captionError) throw new Error(captionError);

  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60) || 'reel';
  const path = `forum_reels/${uid}/${Date.now()}_${safeName}`;
  const { sdk: { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject }, storage } = await loadStorage();
  const objectRef = ref(storage, path);
  const task = uploadBytesResumable(objectRef, input.file, { contentType: input.file.type });
  input.onTask?.(task);

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => input.onProgress?.(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
      reject,
      () => resolve(),
    );
  });
  const mediaUrl = await getDownloadURL(objectRef);

  let coverRef: typeof objectRef | null = null;
  let coverUrl = '';
  let coverPath = '';
  try {
    if (input.cover && input.cover.size > 0) {
      coverPath = `forum_reels/${uid}/${Date.now()}_cover.jpg`;
      coverRef = ref(storage, coverPath);
      await uploadBytes(coverRef, input.cover, { contentType: 'image/jpeg' });
      coverUrl = await getDownloadURL(coverRef);
    }
  } catch (error) {
    // A missing cover is not worth losing the reel; publish without one.
    console.warn('Kopertina nuk u ngarkua:', error);
    coverRef = null;
    coverUrl = '';
    coverPath = '';
  }

  const avatar = input.author.avatar && isHttpsUrl(input.author.avatar) ? input.author.avatar : null;
  const audioTitle = (input.audioTitle ?? '').trim().slice(0, 80);
  try {
    const created = await addDoc(collection(db, REELS_COLLECTION), {
      authorId: uid,
      authorName: input.author.name.slice(0, 120) || 'Qytetar',
      ...(avatar ? { authorAvatar: avatar } : {}),
      mediaUrl,
      mediaPath: path,
      ...(coverUrl ? { coverUrl, coverPath } : {}),
      ...(audioTitle ? { audioTitle } : {}),
      mediaType: 'video',
      caption,
      hashtags: extractHashtags(caption),
      durationSec: Math.round(input.durationSec * 10) / 10,
      isHidden: false,
      likedBy: [],
      createdAt: serverTimestamp(),
    });
    return created.id;
  } catch (error) {
    await deleteObject(objectRef).catch(() => undefined);
    if (coverRef) await deleteObject(coverRef).catch(() => undefined);
    throw error;
  }
}

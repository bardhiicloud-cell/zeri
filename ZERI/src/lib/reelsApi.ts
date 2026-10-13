import { doc, updateDoc } from 'firebase/firestore';
import { authHeaders } from './apiAuth';
import { db } from './firebase';
import { REELS_COLLECTION, extractHashtags, normalizeCaption } from './reels';

/** Client for server/forumReels.ts plus the author's caption edit and link sharing. */

export class ReelApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = 'ReelApiError';
  }
}

async function call<T>(path: string, method: string): Promise<T> {
  const response = await fetch(path, { method, headers: await authHeaders({ 'Content-Type': 'application/json' }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ReelApiError(typeof data?.error === 'string' ? data.error : 'Veprimi dështoi.', response.status, typeof data?.code === 'string' ? data.code : 'error');
  }
  return data as T;
}

/** Deletes the reel, its video and cover in Storage, its comments and its reports. */
export const deleteReelApi = (reelId: string) =>
  call<{ ok: true; filesRemoved: number; reportsRemoved: number }>(`/api/v1/forum/reels/${encodeURIComponent(reelId)}`, 'DELETE');

const counted = new Set<string>();
/** Counts one view per account (the server dedupes); at most one request per reel per page load. */
export async function recordReelViewApi(reelId: string): Promise<number | null> {
  if (counted.has(reelId)) return null;
  counted.add(reelId);
  try {
    const result = await call<{ viewCount: number }>(`/api/v1/forum/reels/${encodeURIComponent(reelId)}/view`, 'POST');
    return result.viewCount;
  } catch {
    return null; // a view that fails to count must never disturb watching
  }
}

/** The author edits the caption (the rules allow only caption and hashtags). */
export async function updateReelCaption(reelId: string, raw: string): Promise<string> {
  const { caption, error } = normalizeCaption(raw);
  if (error) throw new Error(error);
  await updateDoc(doc(db, REELS_COLLECTION, reelId), { caption, hashtags: extractHashtags(caption) });
  return caption;
}

export const reelShareUrl = (reelId: string, origin: string = window.location.origin) =>
  `${origin}/forum?reel=${encodeURIComponent(reelId)}`;

/** Opens the system share sheet where there is one, otherwise copies the link. Returns what happened. */
export async function shareReel(reelId: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = reelShareUrl(reelId);
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title, url });
      return 'shared';
    }
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') return 'failed'; // the person closed the sheet
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** Reads `?reel=<id>` from a query string, or null. */
export function reelIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get('reel');
  return id && id.length <= 128 && !id.includes('/') ? id : null;
}

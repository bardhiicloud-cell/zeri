/**
 * What this person tends to like, kept on this device, used to order the Reels feed.
 *
 * It is deliberately simple and transparent: three kinds of signal (a like, a Reel watched
 * for a moment, "not interested"), weighted by author and hashtag, with older signals fading.
 * Nothing leaves the browser, so there is no tracking profile on a server; the trade-off is
 * that the ordering does not follow the person to another device.
 *
 * Within a freshly loaded page the Reels are ordered by `scoreReel`: newer is better, liked
 * authors and hashtags are better, and anything marked "not interested" (or from an author the
 * person has turned away from) is left out of the main feed.
 */
import type { Reel } from './reels';

const KEY = 'zeri_reel_interest_v1';
const HOUR = 3_600_000;
export const HIDE_AUTHOR_BELOW = -4;
export const MAX_ENTRIES = 200;

export interface InterestProfile {
  authors: Record<string, number>;
  tags: Record<string, number>;
  notInterested: string[];
  updatedAt: number;
}

export type Signal = 'like' | 'watch' | 'not_interested';

export const emptyProfile = (): InterestProfile => ({ authors: {}, tags: {}, notInterested: [], updatedAt: 0 });

const WEIGHTS: Record<Signal, { author: number; tag: number }> = {
  like: { author: 3, tag: 1.5 },
  watch: { author: 0.5, tag: 0.25 },
  not_interested: { author: -3, tag: -1.5 },
};

/** Keeps the strongest entries so the stored profile cannot grow without bound. */
function trim(map: Record<string, number>): Record<string, number> {
  const entries = Object.entries(map).filter(([, v]) => Math.abs(v) >= 0.05);
  if (entries.length <= MAX_ENTRIES) return Object.fromEntries(entries);
  return Object.fromEntries(entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, MAX_ENTRIES));
}

/** Returns a new profile with the signal applied. Pure. */
export function applySignal(profile: InterestProfile, reel: Pick<Reel, 'id' | 'authorId' | 'hashtags'>, signal: Signal, now: number = Date.now()): InterestProfile {
  const w = WEIGHTS[signal];
  const authors = { ...profile.authors, [reel.authorId]: (profile.authors[reel.authorId] ?? 0) + w.author };
  const tags = { ...profile.tags };
  for (const tag of reel.hashtags ?? []) tags[tag] = (tags[tag] ?? 0) + w.tag;
  const notInterested = signal === 'not_interested' && !profile.notInterested.includes(reel.id)
    ? [reel.id, ...profile.notInterested].slice(0, 500)
    : profile.notInterested;
  return { authors: trim(authors), tags: trim(tags), notInterested, updatedAt: now };
}

const toMs = (reel: Pick<Reel, 'createdAtMs'>): number => (typeof reel.createdAtMs === 'number' ? reel.createdAtMs : 0);

export function scoreReel(reel: Pick<Reel, 'authorId' | 'hashtags' | 'likedBy' | 'createdAtMs'>, profile: InterestProfile, now: number = Date.now()): number {
  const ageHours = Math.max(0, (now - toMs(reel)) / HOUR);
  const recency = 4 / (1 + ageHours / 24); // 4 when new, 2 after a day, ~0.5 after a week
  const authorAffinity = Math.max(-6, Math.min(8, profile.authors[reel.authorId] ?? 0));
  const tagAffinity = Math.max(-4, Math.min(6, (reel.hashtags ?? []).reduce((sum, tag) => sum + (profile.tags[tag] ?? 0), 0)));
  const popularity = Math.min(2, Math.log10(1 + (reel.likedBy?.length ?? 0)));
  return recency + authorAffinity + tagAffinity + popularity;
}

/** Orders a page for this person and drops what they turned away from. Ties keep the original (newest first) order. */
export function rankReels<T extends Pick<Reel, 'id' | 'authorId' | 'hashtags' | 'likedBy' | 'createdAtMs'>>(
  reels: readonly T[], profile: InterestProfile, now: number = Date.now(),
): T[] {
  const hidden = new Set(profile.notInterested);
  return reels
    .map((reel, index) => ({ reel, index, score: scoreReel(reel, profile, now) }))
    .filter(({ reel }) => !hidden.has(reel.id) && (profile.authors[reel.authorId] ?? 0) > HIDE_AUTHOR_BELOW)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ reel }) => reel);
}

/* ───────────── storage ───────────── */

function storage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export function loadProfile(uid: string, store: Pick<Storage, 'getItem'> | null = storage()): InterestProfile {
  try {
    const raw = store?.getItem(`${KEY}:${uid}`);
    if (!raw) return emptyProfile();
    const p = JSON.parse(raw) as Partial<InterestProfile>;
    const clean = (m: unknown): Record<string, number> => Object.fromEntries(
      Object.entries(m && typeof m === 'object' ? (m as Record<string, unknown>) : {}).filter(([, v]) => typeof v === 'number' && Number.isFinite(v)),
    ) as Record<string, number>;
    return {
      authors: clean(p.authors), tags: clean(p.tags),
      notInterested: Array.isArray(p.notInterested) ? p.notInterested.filter((x): x is string => typeof x === 'string').slice(0, 500) : [],
      updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : 0,
    };
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(uid: string, profile: InterestProfile, store: Pick<Storage, 'setItem'> | null = storage()): void {
  try { store?.setItem(`${KEY}:${uid}`, JSON.stringify(profile)); } catch { /* full or blocked: ranking just starts fresh next time */ }
}

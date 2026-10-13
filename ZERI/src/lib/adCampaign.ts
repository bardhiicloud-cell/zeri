/**
 * When is a sponsored post actually running? One rule, used by the click redirect on the
 * server and by the feed in the browser, so an ended campaign neither shows nor takes clicks.
 *
 *   live       isAd, started (or no start date), not past `promotedUntil`, under the click cap
 *   scheduled  `adStartAt` is in the future
 *   ended      `promotedUntil` has passed
 *   capped     `adClicks` reached `adMaxClicks`
 *   not_ad     not a sponsored post
 *
 * A campaign without an end date runs until staff remove it (that is how older ads behave).
 */
export type AdStatus = 'not_ad' | 'scheduled' | 'live' | 'ended' | 'capped';

export interface AdCampaignFields {
  isAd?: boolean;
  promotedUntil?: unknown;
  adStartAt?: unknown;
  adMaxClicks?: unknown;
  adClicks?: unknown;
}

/** Firestore Timestamp, Date, ISO string or epoch millis -> millis, else null. */
export function toMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') { const t = Date.parse(value); return Number.isNaN(t) ? null : t; }
  const v = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
  if (typeof v.toMillis === 'function') return v.toMillis();
  const seconds = v.seconds ?? v._seconds;
  return typeof seconds === 'number' ? seconds * 1000 : null;
}

export function adStatus(post: AdCampaignFields, now: number = Date.now()): AdStatus {
  if (post.isAd !== true) return 'not_ad';
  const start = toMillis(post.adStartAt);
  if (start !== null && start > now) return 'scheduled';
  const end = toMillis(post.promotedUntil);
  if (end !== null && end <= now) return 'ended';
  const cap = Number(post.adMaxClicks);
  if (Number.isFinite(cap) && cap > 0 && (Number(post.adClicks) || 0) >= cap) return 'capped';
  return 'live';
}

export const isAdLive = (post: AdCampaignFields, now?: number): boolean => adStatus(post, now) === 'live';

/**
 * Should the post appear in a public feed? Organic posts always; sponsored posts only while the
 * campaign is live. The author and staff still see their own campaign so they can manage it.
 */
export function adVisibleInFeed(post: AdCampaignFields & { authorId?: string }, viewer: { id?: string; isStaff?: boolean }, now?: number): boolean {
  const status = adStatus(post, now);
  if (status === 'not_ad' || status === 'live') return true;
  return viewer.isStaff === true || (!!viewer.id && post.authorId === viewer.id);
}

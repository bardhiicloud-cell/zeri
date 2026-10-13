/**
 * Where a published article lands on the public news page. The page and the admin
 * editor both call this, so the preview an editor sees is the layout readers get,
 * not a second description of it that could drift.
 *
 * Input is the published list, newest first (the order the page loads it in).
 */

export type NewsSlotPosition = 'featured' | 'feed' | 'sidebar';

export interface PlaceableArticle {
  id: string;
  position?: NewsSlotPosition;
}

export const TICKER_SLOTS = 8;
export const LATEST_SLOTS = 3;
export const RAIL_SLOTS = 5;
export const HEADLINE_SLOTS = 9;

export interface NewsLayout<T extends PlaceableArticle> {
  /** The lead story above the fold: the first one marked "featured", else the newest. */
  lead: T | undefined;
  /** Everything except the lead, in order. */
  feed: T[];
  /** The three stacked cards in the left column. */
  latest: T[];
  /** The right-hand "trending" rail: sidebar-marked first, then the rest. */
  rail: T[];
  /** The "Të fundit" strip across the top. */
  ticker: T[];
  /** The numbered "Titujt e ditës" index. */
  headlines: T[];
}

export function layoutNews<T extends PlaceableArticle>(published: readonly T[]): NewsLayout<T> {
  const lead = published.find(item => item.position === 'featured') ?? published[0];
  const feed = lead ? published.filter(item => item.id !== lead.id) : [...published];
  return {
    lead,
    feed,
    latest: feed.slice(0, LATEST_SLOTS),
    rail: feed.filter(item => item.position === 'sidebar').concat(feed.filter(item => item.position !== 'sidebar')).slice(0, RAIL_SLOTS),
    ticker: published.slice(0, TICKER_SLOTS),
    headlines: published.slice(0, HEADLINE_SLOTS),
  };
}

export interface Placement {
  /** True when the article is published and therefore visible at all. */
  visible: boolean;
  lead: boolean;
  /** 1-based positions; null when the article is not in that slot. */
  latest: number | null;
  rail: number | null;
  ticker: number | null;
  headline: number | null;
  /** 1-based page of the archive, whatever else happens. */
  archivePage: number | null;
}

export const ARCHIVE_PAGE_SIZE_DEFAULT = 9;

const nth = <T extends PlaceableArticle>(list: readonly T[], id: string): number | null => {
  const at = list.findIndex(item => item.id === id);
  return at === -1 ? null : at + 1;
};

/**
 * What would happen to `candidate` if it were saved now. An existing article keeps
 * its place in time (`when` is its original creation time); a new one is the newest.
 * `others` is every other published article with its creation time.
 */
export function placeCandidate<T extends PlaceableArticle & { when: number }>(
  others: readonly T[],
  candidate: T,
  published: boolean,
  archivePageSize: number = ARCHIVE_PAGE_SIZE_DEFAULT,
): Placement {
  if (!published) return { visible: false, lead: false, latest: null, rail: null, ticker: null, headline: null, archivePage: null };
  const list = [...others.filter(item => item.id !== candidate.id), candidate].sort((a, b) => b.when - a.when);
  const layout = layoutNews(list);
  const at = list.findIndex(item => item.id === candidate.id);
  return {
    visible: true,
    lead: layout.lead?.id === candidate.id,
    latest: nth(layout.latest, candidate.id),
    rail: nth(layout.rail, candidate.id),
    ticker: nth(layout.ticker, candidate.id),
    headline: nth(layout.headlines, candidate.id),
    archivePage: Math.floor(at / archivePageSize) + 1,
  };
}

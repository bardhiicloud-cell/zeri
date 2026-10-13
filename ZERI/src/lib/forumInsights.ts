/**
 * Account insights: real totals for one author's posts, split into sponsored
 * (`isAd`, set only by ads staff) and organic. Nothing is estimated: views are
 * the server-side impression counter, the rest are counts on the post itself.
 */
export interface InsightPost {
  authorId?: string;
  isAd?: boolean;
  viewCount?: number;
  /** Clicks on a sponsored post's link, counted by the server redirect. */
  adClicks?: number;
  likes?: unknown[];
  comments?: unknown[];
  reposts?: unknown[];
}

export interface InsightBucket {
  posts: number;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  interactions: number;
  /** interactions / views as a percentage, or null when there are no views yet. */
  engagementRate: number | null;
  /** Average interactions per post, or null with no posts. */
  perPost: number | null;
  /** Link clicks (sponsored posts only; always 0 for organic). */
  clicks: number;
  /** clicks / views as a percentage, or null when there are no views yet. */
  ctr: number | null;
}

export interface AccountInsights {
  sponsored: InsightBucket;
  organic: InsightBucket;
  total: InsightBucket;
}

const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

function emptyBucket(): InsightBucket {
  return { posts: 0, views: 0, likes: 0, replies: 0, reposts: 0, interactions: 0, engagementRate: null, perPost: null, clicks: 0, ctr: null };
}

function finish(b: InsightBucket): InsightBucket {
  b.interactions = b.likes + b.replies + b.reposts;
  b.engagementRate = b.views > 0 ? Math.min(100, (b.interactions / b.views) * 100) : null;
  b.perPost = b.posts > 0 ? b.interactions / b.posts : null;
  b.ctr = b.views > 0 ? Math.min(100, (b.clicks / b.views) * 100) : null;
  return b;
}

export function summarizeInsights(posts: readonly InsightPost[], authorId: string): AccountInsights {
  const sponsored = emptyBucket();
  const organic = emptyBucket();
  for (const post of posts) {
    if (post.authorId !== authorId) continue;
    const bucket = post.isAd === true ? sponsored : organic;
    bucket.posts += 1;
    bucket.views += num(post.viewCount);
    bucket.likes += len(post.likes);
    bucket.replies += len(post.comments);
    bucket.reposts += len(post.reposts);
    if (post.isAd === true) bucket.clicks += num(post.adClicks);
  }
  const total: InsightBucket = {
    posts: sponsored.posts + organic.posts,
    views: sponsored.views + organic.views,
    likes: sponsored.likes + organic.likes,
    replies: sponsored.replies + organic.replies,
    reposts: sponsored.reposts + organic.reposts,
    interactions: 0, engagementRate: null, perPost: null, clicks: sponsored.clicks, ctr: null,
  };
  const finished = finish(total);
  // Link clicks exist only on sponsored posts, so a click rate over ALL views would understate them.
  finished.ctr = null;
  return { sponsored: finish(sponsored), organic: finish(organic), total: finished };
}

/**
 * Relative lift of sponsored over organic engagement rate, as a percentage.
 * Null unless both buckets have views — a comparison on no data would mislead.
 */
export function sponsoredLift(insights: AccountInsights): number | null {
  const s = insights.sponsored.engagementRate;
  const o = insights.organic.engagementRate;
  if (s === null || o === null || o === 0) return null;
  return ((s - o) / o) * 100;
}

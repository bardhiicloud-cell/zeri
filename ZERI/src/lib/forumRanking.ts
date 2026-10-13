/**
 * Ranking for the public debate feed.
 *
 * One pure module so the feed, the "trending" sort and the tests all use the
 * same numbers. The model is deliberately explainable:
 *
 *   score = (engagement + FLOOR) × freshness × relationship boosts
 *
 *   • engagement  — likes ×2, comments ×3, reposts ×4, reactions ×1, poll
 *                   votes ×1 (writing a reply or sharing is worth more than a tap);
 *   • FLOOR       — a post nobody has reacted to yet still has a chance to be
 *                   seen, otherwise a new post could never get its first like;
 *   • freshness   — halves every `HALF_LIFE_HOURS`, so yesterday's spike does
 *                   not pin itself to the top;
 *   • boosts      — people I follow, my own municipality, official accounts and
 *                   verified accounts rank a little higher. The verified boost is
 *                   intentionally modest (×1.25) and is applied to the *fresh*
 *                   score, so a verified account is seen slightly more but a weak
 *                   post still loses to a strong one.
 *
 * After scoring, a diversity pass stops one author from filling the first screen:
 * every time an author has already appeared in the last two slots, their next
 * post is damped.
 */

export const HALF_LIFE_HOURS = 18;
export const ENGAGEMENT_FLOOR = 3;

export const BOOSTS = {
  followed: 1.6,
  sameMunicipality: 1.15,
  official: 1.2,
  verified: 1.25,
  /** Very short text without media is rarely a debate. */
  thin: 0.8,
  /** A repeat author within the last two slots. */
  repeatAuthor: 0.6,
} as const;

export interface RankablePost {
  id: string;
  authorId: string;
  authorRole?: string;
  authorBadge?: string;
  content?: string;
  imageUrl?: string;
  neighborhood?: string;
  likes?: string[];
  comments?: unknown[];
  reposts?: string[];
  reactions?: Record<string, string[]>;
  poll?: { options?: Array<{ votes?: number | string[] }> };
  createdAt?: any;
}

export interface RankContext {
  now?: number;
  followedIds?: ReadonlySet<string> | readonly string[];
  verifiedIds?: ReadonlySet<string> | readonly string[];
  municipality?: string | null;
}

const asSet = (value: ReadonlySet<string> | readonly string[] | undefined): ReadonlySet<string> =>
  value instanceof Set ? value : new Set(value ?? []);

export function postTimeMillis(post: Pick<RankablePost, 'createdAt'>): number {
  const value = post.createdAt;
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function postAgeHours(post: Pick<RankablePost, 'createdAt'>, now: number): number {
  const created = postTimeMillis(post);
  return created > 0 ? Math.max(0, (now - created) / 3_600_000) : 0;
}

function pollVotes(post: RankablePost): number {
  const options = post.poll?.options ?? [];
  return options.reduce((sum, option) => {
    const votes = option.votes;
    if (Array.isArray(votes)) return sum + votes.length;
    return sum + (typeof votes === 'number' && Number.isFinite(votes) ? votes : 0);
  }, 0);
}

/** Raw reach points, before age and relationship. */
export function engagementPoints(post: RankablePost): number {
  const reactions = Object.values(post.reactions ?? {}).reduce((sum, ids) => sum + (ids?.length ?? 0), 0);
  return (
    (post.likes?.length ?? 0) * 2 +
    (post.comments?.length ?? 0) * 3 +
    (post.reposts?.length ?? 0) * 4 +
    reactions +
    pollVotes(post)
  );
}

export function isOfficialAuthor(post: RankablePost): boolean {
  return ['admin', 'moderator', 'zyrtar'].includes(String(post.authorRole ?? '')) || post.authorBadge === 'Zyrtar Komunal';
}

/** Score for the personalised "For you" feed. */
export function scorePost(post: RankablePost, ctx: RankContext = {}): number {
  const now = ctx.now ?? Date.now();
  const followed = asSet(ctx.followedIds);
  const verified = asSet(ctx.verifiedIds);

  const freshness = Math.pow(0.5, postAgeHours(post, now) / HALF_LIFE_HOURS);
  let score = (engagementPoints(post) + ENGAGEMENT_FLOOR) * freshness;

  if (followed.has(post.authorId)) score *= BOOSTS.followed;
  if (ctx.municipality && post.neighborhood && post.neighborhood === ctx.municipality) score *= BOOSTS.sameMunicipality;
  if (isOfficialAuthor(post)) score *= BOOSTS.official;
  if (verified.has(post.authorId)) score *= BOOSTS.verified;
  if (!post.imageUrl && !post.poll && (post.content ?? '').trim().length < 8) score *= BOOSTS.thin;

  return score;
}

/** Pure engagement-over-time score used by the "Trending" sort (no relationships). */
export function trendingScore(post: RankablePost, now: number = Date.now()): number {
  return engagementPoints(post) / Math.pow(2, postAgeHours(post, now) / 24);
}

/** Steeper decay for the "Hot" sort: a burst this afternoon beats yesterday's. */
export function hotScore(post: RankablePost, now: number = Date.now()): number {
  return engagementPoints(post) / Math.pow(2, postAgeHours(post, now) / 6);
}

/**
 * Order posts for the "For you" feed: score, then a greedy diversity pass.
 * Stable for equal scores (newer first), so the result is deterministic.
 */
export function rankForYou<T extends RankablePost>(posts: readonly T[], ctx: RankContext = {}): T[] {
  const now = ctx.now ?? Date.now();
  const scored = posts
    .map((post) => ({ post, score: scorePost(post, { ...ctx, now }), time: postTimeMillis(post) }))
    .sort((a, b) => b.score - a.score || b.time - a.time);

  const output: T[] = [];
  const remaining = scored.slice();
  while (remaining.length > 0) {
    const recent = new Set(output.slice(-2).map((p) => p.authorId));
    let bestIndex = 0;
    let bestValue = -Infinity;
    // Only the head of the queue can win: scanning more would be O(n²) for no gain.
    const window = Math.min(remaining.length, 12);
    for (let i = 0; i < window; i++) {
      const candidate = remaining[i];
      const value = candidate.score * (recent.has(candidate.post.authorId) ? BOOSTS.repeatAuthor : 1);
      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    }
    output.push(remaining.splice(bestIndex, 1)[0].post);
  }
  return output;
}

/** Is this account's tick currently valid? (`verifiedUntil` may be an ISO string, Timestamp or absent.) */
export function isTickActive(profile: { isVerified?: boolean; verifiedUntil?: any } | undefined | null, now: number = Date.now()): boolean {
  if (!profile?.isVerified) return false;
  const until = profile.verifiedUntil;
  if (!until) return true;
  const millis = typeof until.toMillis === 'function' ? until.toMillis() : typeof until.seconds === 'number' ? until.seconds * 1000 : Date.parse(until);
  return !Number.isFinite(millis) || millis > now;
}

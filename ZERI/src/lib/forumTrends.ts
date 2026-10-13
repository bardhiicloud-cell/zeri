import { engagementPoints, postAgeHours, type RankablePost } from './forumRanking';

/**
 * Trends computed from real posts only. No placeholder topics and no invented
 * counts: with no posts there are no trends, and the interface says so.
 */
export interface TrendItem {
  /** `#hashtag` or the category name. */
  label: string;
  kind: 'hashtag' | 'category';
  /** Number of posts in the window that carry it. */
  posts: number;
  /** Likes + replies + reposts on those posts. */
  interactions: number;
  score: number;
}

const HASHTAG = /(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{2,40})/gu;
const MENTION = /(^|[^\p{L}\p{N}_])@([\p{L}\p{N}_.]{2,40})/gu;

export function extractHashtags(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(HASHTAG)) out.add(match[2].toLowerCase());
  return [...out];
}

export function extractMentions(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(MENTION)) out.add(match[2].toLowerCase());
  return [...out];
}

/** Lower-case, accent-free handle form used to compare "@bardh" with "Bardh Qytetar". */
export function toHandle(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9_]+/g, '');
}

type TrendPost = RankablePost & { category?: string };

export function computeTrends(posts: readonly TrendPost[], options: { now?: number; windowHours?: number; limit?: number } = {}): TrendItem[] {
  const now = options.now ?? Date.now();
  const windowHours = options.windowHours ?? 24 * 7;
  const limit = options.limit ?? 10;
  const buckets = new Map<string, TrendItem>();

  const add = (label: string, kind: TrendItem['kind'], post: TrendPost) => {
    const age = postAgeHours(post, now);
    if (age > windowHours) return;
    const points = engagementPoints(post);
    const weight = (points + 1) * Math.pow(0.5, age / 24);
    const key = `${kind}:${label}`;
    const current = buckets.get(key) ?? { label, kind, posts: 0, interactions: 0, score: 0 };
    current.posts += 1;
    current.interactions += (post.likes?.length ?? 0) + (post.comments?.length ?? 0) + (post.reposts?.length ?? 0);
    current.score += weight;
    buckets.set(key, current);
  };

  for (const post of posts) {
    for (const tag of extractHashtags(post.content ?? '')) add(`#${tag}`, 'hashtag', post);
    if (post.category && post.category !== 'Tjera' && post.category !== 'Të gjitha') add(post.category, 'category', post);
  }

  return [...buckets.values()].sort((a, b) => b.score - a.score || b.posts - a.posts).slice(0, limit);
}

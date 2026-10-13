import { extractHashtags } from './forumTrends';

export interface TagPost {
  id: string;
  content?: string;
  hashtags?: string[];
  visibility?: string;
  isHidden?: boolean;
  deletedAt?: unknown;
  createdAtMs: number;
}

/** `#Zgjedhjet`, `zgjedhjet` and ` #zgjedhjet ` all name the same page. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').toLowerCase().replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 40);
}

export function postHasTag(post: Pick<TagPost, 'content' | 'hashtags'>, tag: string): boolean {
  if (Array.isArray(post.hashtags) && post.hashtags.includes(tag)) return true;
  // Posts written before the `hashtags` field existed still match through their text.
  return extractHashtags(post.content ?? '').includes(tag);
}

/**
 * Posts for a hashtag page: the server query result plus whatever the feed already
 * holds (older posts without the field). Only public, visible, undeleted posts, no
 * duplicates, newest first.
 */
export function mergeTagPosts<T extends TagPost>(tag: string, queried: readonly T[], local: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const post of [...queried, ...local]) {
    if (post.visibility !== 'public' || post.isHidden === true || post.deletedAt) continue;
    if (!postHasTag(post, tag)) continue;
    if (!byId.has(post.id)) byId.set(post.id, post);
  }
  return [...byId.values()].sort((a, b) => b.createdAtMs - a.createdAtMs);
}

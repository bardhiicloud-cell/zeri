import { authHeaders } from './apiAuth';

/** Client for server/forumPosts.ts. Every change to an existing post goes through here. */

export class PostApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = 'PostApiError';
  }
}

async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new PostApiError(
      typeof data?.error === 'string' ? data.error : 'Veprimi dështoi. Provoni përsëri.',
      response.status,
      typeof data?.code === 'string' ? data.code : 'error',
    );
  }
  return data as T;
}

const post = (id: string) => `/api/v1/forum/posts/${encodeURIComponent(id)}`;

export interface ApiComment {
  id: string; authorId: string; authorName: string; authorAvatar?: string; content: string; createdAt: string;
  replies?: ApiComment[]; likes?: string[];
}

export const addCommentApi = (postId: string, text: string, opts: { parentId?: string; mentionUids?: string[] } = {}) =>
  call<{ comment: ApiComment; parentId: string | null }>(`${post(postId)}/comments`, 'POST', { text, ...opts });

export const deleteCommentApi = (postId: string, commentId: string) =>
  call<{ ok: true }>(`${post(postId)}/comments/${encodeURIComponent(commentId)}`, 'DELETE');

export const votePollApi = (postId: string, optionId: string) =>
  call<{ poll: { question: string; totalVotes: number; options: { id: string; text: string; votes: string[] }[] }; votedOptionId: string | null }>(
    `${post(postId)}/poll-vote`, 'POST', { optionId });

export const setReactionApi = (postId: string, type: string | null) =>
  call<{ reactions: Record<string, string[]> }>(`${post(postId)}/reaction`, 'PUT', { type });

export const editPostApi = (postId: string, content: string) => call<{ content: string }>(post(postId), 'PATCH', { content });

/** Soft delete: restorable for 30 days. */
export const deletePostApi = (postId: string) => call<{ ok: true }>(post(postId), 'DELETE');
/** Erases the post for good. */
export const purgePostApi = (postId: string) => call<{ ok: true }>(`${post(postId)}?permanent=1`, 'DELETE');
export const restorePostApi = (postId: string) => call<{ ok: true }>(`${post(postId)}/restore`, 'POST');

/** After a new post exists: the server notifies quoted authors and verified mentions. Never throws into the caller's flow. */
export const notifyPublishedApi = (postId: string, mentionUids: string[]) =>
  call<{ ok: true }>(`${post(postId)}/published`, 'POST', { mentionUids }).catch(() => undefined);

/** After a follow was saved: the server verifies it and notifies once. */
export const notifyFollowApi = (targetId: string) =>
  call<{ ok: true }>('/api/v1/forum/follow-notify', 'POST', { targetId }).catch(() => undefined);

/** Whether a sponsored post's link may be offered: https only, no credentials, no javascript:. */
export function safeAdUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 2000) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Days left to restore a soft-deleted post (0 when expired). */
export function restoreDaysLeft(deletedAtMs: number | null, now: number = Date.now(), windowDays = 30): number {
  if (!deletedAtMs) return 0;
  return Math.max(0, Math.ceil(windowDays - (now - deletedAtMs) / 86_400_000));
}

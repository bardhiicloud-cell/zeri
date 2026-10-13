import { authHeaders } from './apiAuth';

/** Client for server/storyViews.ts: view marks, the author's viewer list and replies. */

export interface StoryViewer { id: string; name: string; avatar: string; atMs: number }

async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Veprimi dështoi.');
  return data as T;
}

const base = (id: string) => `/api/v1/forum/stories/${encodeURIComponent(id)}`;

export const recordStoryViewApi = (id: string) => call<{ recorded: boolean }>(`${base(id)}/view`, 'POST');
export const fetchStoryViewersApi = (id: string) => call<{ count: number; viewers: StoryViewer[] }>(`${base(id)}/viewers`, 'GET');
export const replyToStoryApi = (id: string, text: string) => call<{ conversationId: string }>(`${base(id)}/reply`, 'POST', { text });

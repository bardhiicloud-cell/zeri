import { authHeaders } from './apiAuth';

/** Client for server/scheduledPosts.ts. */

export interface ScheduledItem {
  id: string;
  content: string;
  imageUrls: string[];
  visibility: 'public' | 'followers';
  publishAtMs: number;
}

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Veprimi dështoi.');
  return data as T;
}

export const schedulePostApi = (input: {
  content: string; category: string; neighborhood: string; imageUrls: string[]; followersOnly: boolean; publishAtMs: number;
}) => call<{ id: string; publishAtMs: number }>('/api/v1/forum/scheduled', 'POST', input);

export const listScheduledApi = () => call<{ items: ScheduledItem[] }>('/api/v1/forum/scheduled');

export const cancelScheduledApi = (id: string) => call<{ ok: true }>(`/api/v1/forum/scheduled/${encodeURIComponent(id)}`, 'DELETE');

/** `datetime-local` value ("2026-10-14T09:30", local time) -> epoch ms, or NaN. */
export const localInputToMs = (value: string): number => (value ? new Date(value).getTime() : NaN);

/** Epoch ms -> `datetime-local` value in local time (for `min`, and for defaults). */
export function msToLocalInput(ms: number): string {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

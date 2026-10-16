import { authHeaders } from './apiAuth';

/** Client for the Debate admin's stories, reels and report analytics (server/debateInsights.ts). */

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Kërkesa dështoi.');
  return data as T;
}

export interface ReportInsights {
  days: number;
  totals: { cases: number; open: number; reports: number; escalated: number; urgentOpen: number };
  byKind: Record<string, number>;
  byReason: Record<string, number>;
  byStatus: Record<string, number>;
  trend: Array<{ day: string; opened: number; decided: number }>;
  openAge: { under24h: number; day1to3: number; day3to7: number; over7d: number };
  medianResolutionHours: number | null;
  repeatSubjects: Array<{ uid: string; name: string; cases: number; reports: number }>;
  moderators: Array<{ uid: string; name: string; open: number }>;
  unassignedOpen: number;
}

export interface StoryRow {
  id: string; authorId: string; authorName: string; mediaUrl: string; mediaType: 'image' | 'video';
  textOverlay: string; createdAtMs: number; expiresAtMs: number; isHidden: boolean; live: boolean; views: number;
}
export interface ReelRow {
  id: string; authorId: string; authorName: string; caption: string; coverUrl: string; mediaUrl: string;
  durationSec: number; views: number; likes: number; reports: number; isHidden: boolean; createdAtMs: number;
}
export interface StoryViewerRow { id: string; name: string; atMs: number }

export const debateInsightsApi = {
  reports: (days: number) => call<ReportInsights>(`/api/v1/debate/insights/reports?days=${days}`),
  stories: () => call<{ stories: StoryRow[]; totals: { live: number; hidden: number; views: number } }>('/api/v1/debate/content/stories'),
  storyViewers: (id: string) => call<{ count: number; viewers: StoryViewerRow[] }>(`/api/v1/debate/content/stories/${encodeURIComponent(id)}/viewers`),
  hideStory: (id: string, hide: boolean, reason?: string) =>
    call<{ ok: true }>(`/api/v1/debate/content/stories/${encodeURIComponent(id)}/hide`, { method: 'POST', body: { hide, reason } }),
  reels: () => call<{ reels: ReelRow[]; totals: { views: number; likes: number; reported: number; hidden: number } }>('/api/v1/debate/content/reels'),
  hideReel: (id: string, hide: boolean, reason?: string) =>
    call<{ ok: true }>(`/api/v1/debate/content/reels/${encodeURIComponent(id)}/hide`, { method: 'POST', body: { hide, reason } }),
};

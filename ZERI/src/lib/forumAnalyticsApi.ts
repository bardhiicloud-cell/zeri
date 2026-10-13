import { authHeaders } from './apiAuth';

/**
 * Client for server/forumAnalytics.ts: reports profile views, contact clicks and
 * Reel views of other people's business accounts, and reads my own series back.
 */

export type ContactKind = 'email' | 'phone' | 'website';

export interface DailyInsights {
  day: string; // YYYYMMDD (UTC)
  profileViews: number;
  profileViewers: number;
  contactClicks: number;
  contactEmail: number;
  contactPhone: number;
  contactWebsite: number;
  reelViews: number;
  reelViewers: number;
  reels: Record<string, number>;
}

export interface InsightsResponse {
  days: number;
  current: DailyInsights[];
  previous: DailyInsights[];
}

const sent = new Set<string>();

/**
 * Fire-and-forget. A profile or a Reel is reported at most once per page load
 * (the server also dedupes "unique" viewers per day), and a failure never
 * reaches the person using the app.
 */
export function trackInsight(event: { authorId: string; type: 'profile_view' | 'reel_view' | 'contact_click'; kind?: ContactKind; reelId?: string }, viewerId?: string): void {
  if (!viewerId || viewerId === event.authorId) return;
  if (event.type !== 'contact_click') {
    const key = `${event.type}:${event.authorId}:${event.reelId ?? ''}`;
    if (sent.has(key)) return;
    sent.add(key);
  }
  void (async () => {
    try {
      await fetch('/api/v1/forum/analytics/event', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(event),
        keepalive: true,
      });
    } catch {
      /* analytics must never get in the way */
    }
  })();
}

export class InsightsError extends Error {
  constructor(message: string, public readonly code: string) { super(message); }
}

export async function fetchMyInsights(days: 7 | 28 | 90): Promise<InsightsResponse> {
  const response = await fetch(`/api/v1/forum/analytics/me?days=${days}`, { headers: await authHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new InsightsError(typeof data?.error === 'string' ? data.error : 'Statistikat nuk u ngarkuan.', typeof data?.code === 'string' ? data.code : 'error');
  return data as InsightsResponse;
}

/* ───────────── Pure helpers for the insights screen ───────────── */

export const sumOf = (rows: readonly DailyInsights[], pick: (d: DailyInsights) => number) => rows.reduce((n, d) => n + pick(d), 0);

/** Change versus the previous period in percent; null when there is nothing to compare with. */
export function changePct(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : null;
  return ((current - previous) / previous) * 100;
}

/** Reel ids ranked by views in the period. */
export function topReels(rows: readonly DailyInsights[], limit = 5): { id: string; views: number }[] {
  const totals = new Map<string, number>();
  for (const d of rows) for (const [id, n] of Object.entries(d.reels)) totals.set(id, (totals.get(id) ?? 0) + n);
  return [...totals.entries()].map(([id, views]) => ({ id, views })).sort((a, b) => b.views - a.views).slice(0, limit);
}

/** "20260312" -> "12/03". */
export function shortDay(day: string): string {
  return `${day.slice(6, 8)}/${day.slice(4, 6)}`;
}

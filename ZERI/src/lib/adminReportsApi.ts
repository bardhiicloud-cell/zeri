import { useCallback, useEffect, useRef, useState } from 'react';
import { authHeaders } from './apiAuth';
import type { Report } from '../types';

/**
 * Client for GET /api/v1/admin/reports: the server-filtered, cursor-paginated
 * reports list that replaces "the newest 100 reports held in the browser".
 *
 * What it guarantees the screens:
 *   - a page is at most 50 reports, however many exist;
 *   - what the caller may see (and which municipality) is decided by the server;
 *   - if the server cannot answer (offline, or a Firestore index not yet
 *     deployed) the hook reports `status: 'error'` and the screen falls back to
 *     the reports already loaded, saying so, instead of showing an empty list.
 */

export interface ReportListParams {
  /** A status tab key or raw status. */
  status?: string;
  /** Exact municipality name (the header scope). */
  municipality?: string;
  urgency?: string;
  /** A tracking code or id: an exact lookup that ignores the other filters. */
  code?: string;
  /** `me`: only what the signed-in person has taken on. */
  assignee?: 'me';
  /** `oldest`: longest-waiting first (status and municipality filters only). */
  order?: 'oldest';
  /** Reports waiting for the citizen's answer, or escalated. Used alone. */
  flag?: 'awaitingInfo' | 'escalated';
}

export interface ReportPage {
  items: Report[];
  nextCursor: string | null;
  /** Exact total, present on the first page only. */
  total: number | null;
}

export class ReportListError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ReportListError';
  }
}

export async function fetchReportPage(
  params: ReportListParams,
  cursor: string | null,
  limit = 50,
  signal?: AbortSignal
): Promise<ReportPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  query.set('limit', String(limit));
  if (cursor) query.set('cursor', cursor);

  let response: Response;
  try {
    response = await fetch(`/api/v1/admin/reports?${query.toString()}`, {
      headers: await authHeaders(),
      signal,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new ReportListError('Lidhja me serverin dështoi.', 0);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ReportListError(body?.error || 'Raportet nuk u ngarkuan.', response.status);
  return { items: body.items ?? [], nextCursor: body.nextCursor ?? null, total: typeof body.total === 'number' ? body.total : null };
}

/** Append `next` to `current`, dropping any report already present (a refresh can overlap). */
export function mergePages(current: readonly Report[], next: readonly Report[]): Report[] {
  const seen = new Set(current.map(report => report.id));
  return [...current, ...next.filter(report => !seen.has(report.id))];
}

/** Does text typed in the search box look like a tracking code rather than words? */
export function looksLikeCode(text: string): boolean {
  const value = text.trim();
  return /^[A-Za-z0-9_-]{3,40}$/.test(value) && /\d/.test(value) && (/[-_]/.test(value) || value.length >= 8);
}

export type ListStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useServerReports(params: ReportListParams, enabled: boolean) {
  const [items, setItems] = useState<Report[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [status, setStatus] = useState<ListStatus>('idle');
  const [error, setError] = useState<ReportListError | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // A response that arrives after the filters changed (or after unmount) is
  // dropped: it describes a list the person is no longer looking at.
  const generation = useRef(0);
  const key = JSON.stringify(params);

  const loadFirst = useCallback(async () => {
    const run = ++generation.current;
    setStatus('loading');
    setError(null);
    try {
      const page = await fetchReportPage(JSON.parse(key), null);
      if (run !== generation.current) return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
      setStatus('ready');
    } catch (caught) {
      if (run !== generation.current || (caught as Error)?.name === 'AbortError') return;
      setError(caught instanceof ReportListError ? caught : new ReportListError('Raportet nuk u ngarkuan.', 0));
      setStatus('error');
    }
  }, [key]);

  useEffect(() => {
    if (!enabled) {
      generation.current += 1;
      setStatus('idle');
      return;
    }
    void loadFirst();
    return () => {
      generation.current += 1;
    };
  }, [enabled, loadFirst]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    const run = generation.current;
    setIsLoadingMore(true);
    try {
      const page = await fetchReportPage(JSON.parse(key), nextCursor);
      if (run !== generation.current) return;
      setItems(current => mergePages(current, page.items));
      setNextCursor(page.nextCursor);
    } catch (caught) {
      if (run !== generation.current) return;
      setError(caught instanceof ReportListError ? caught : new ReportListError('Raportet nuk u ngarkuan.', 0));
    } finally {
      setIsLoadingMore(false);
    }
  }, [key, nextCursor, isLoadingMore]);

  return { items, nextCursor, total, status, error, isLoadingMore, loadMore, refresh: loadFirst };
}

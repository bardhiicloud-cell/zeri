import { useEffect, useState } from 'react';
import type { Report } from '../types';
import { fetchReportPage, mergePages } from './adminReportsApi';

/**
 * The reports that belong in the work inbox, asked of the server.
 *
 * The inbox used to filter the newest hundred reports held in the browser, so with
 * thousands arriving a day the oldest report still waiting for a first look was
 * never in the list. These three questions are answered by the server over the
 * whole collection, each bounded to one page:
 *
 *   - waiting for a first review, the longest-waiting first;
 *   - marked overdue, the longest-overdue first;
 *   - critical and still open, newest first.
 *
 * Refreshed every minute. If the server cannot answer (older deployment, missing
 * index), `status` is 'error' and the inbox falls back to what the browser has.
 */

export type InboxReportsStatus = 'idle' | 'loading' | 'ready' | 'error';

const PAGE = 50;
const REFRESH_MS = 60_000;

export function useInboxReports(enabled: boolean, municipality?: string) {
  const [items, setItems] = useState<Report[]>([]);
  const [status, setStatus] = useState<InboxReportsStatus>('idle');

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setStatus('idle');
      return;
    }
    let cancelled = false;
    const scope = municipality ? { municipality } : {};

    const load = async () => {
      try {
        const [pending, overdue, critical] = await Promise.all([
          fetchReportPage({ status: 'unapproved', order: 'oldest', ...scope }, null, PAGE),
          fetchReportPage({ status: 'overdue', order: 'oldest', ...scope }, null, PAGE),
          fetchReportPage({ status: 'unresolved', urgency: 'Kritike', ...scope }, null, PAGE),
        ]);
        if (cancelled) return;
        setItems(mergePages(mergePages(pending.items, overdue.items), critical.items));
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    setStatus(current => (current === 'ready' ? current : 'loading'));
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, municipality]);

  return { items, status };
}

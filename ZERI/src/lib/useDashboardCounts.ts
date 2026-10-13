import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, getCountFromServer, query, where, type Query } from 'firebase/firestore';
import { db } from './firebase';
import { ACTIVE_STATUSES } from './adminDashboardMetrics';
import { STAFF_ROLES } from './adminPermissions';

/**
 * Exact totals for the admin dashboard.
 *
 * The browser only ever holds the newest page of reports (see CONTENT_LIMITS)
 * and one page of the citizen directory, so a tally of what is in memory stops
 * being true the moment the platform outgrows a page — and it fails silently:
 * the card still shows a confident number. These counters are answered by
 * Firestore's aggregation endpoint instead, which counts index entries without
 * transferring a single document.
 *
 * Cost: an aggregation is billed at one read per 1,000 index entries it scans
 * (minimum one). Ten counters refreshed every five minutes is a rounding error
 * next to a single listener on the collection, and every query below filters on
 * one field only, so none needs a composite index.
 *
 * A counter that cannot be read (a role without access, an offline browser) is
 * simply absent from the result, and the dashboard falls back to the loaded
 * sample for that figure and says so — one failing query never blanks the rest.
 */

export type CountKey =
  | 'reports'
  | 'reportsPending'
  | 'reportsActive'
  | 'reportsOverdue'
  | 'reportsResolved'
  | 'health'
  | 'healthUrgent'
  | 'supportWaiting'
  | 'users'
  | 'staff';

export type DashboardCounts = Partial<Record<CountKey, number>>;

/** Which families of counters the viewer's role may read. */
export interface CountAccess {
  reports: boolean;
  health: boolean;
  support: boolean;
  users: boolean;
}

type CountGroup = keyof CountAccess;

const STAFF_ACCOUNT_ROLES = STAFF_ROLES.filter((role) => role !== 'municipality');

const COUNT_SPECS: ReadonlyArray<{ key: CountKey; group: CountGroup; build: () => Query }> = [
  { key: 'reports', group: 'reports', build: () => query(collection(db, 'reports')) },
  { key: 'reportsPending', group: 'reports', build: () => query(collection(db, 'reports'), where('status', '==', 'Pending Review')) },
  { key: 'reportsActive', group: 'reports', build: () => query(collection(db, 'reports'), where('status', 'in', [...ACTIVE_STATUSES])) },
  { key: 'reportsOverdue', group: 'reports', build: () => query(collection(db, 'reports'), where('status', '==', 'Overdue')) },
  { key: 'reportsResolved', group: 'reports', build: () => query(collection(db, 'reports'), where('status', '==', 'Resolved')) },
  { key: 'health', group: 'health', build: () => query(collection(db, 'healthRegistry')) },
  { key: 'healthUrgent', group: 'health', build: () => query(collection(db, 'healthRegistry'), where('urgency', '==', 'Urgjente')) },
  { key: 'supportWaiting', group: 'support', build: () => query(collection(db, 'supportChats'), where('status', '==', 'waiting_agent')) },
  { key: 'users', group: 'users', build: () => query(collection(db, 'users')) },
  { key: 'staff', group: 'users', build: () => query(collection(db, 'users'), where('role', 'in', [...STAFF_ACCOUNT_ROLES])) },
];

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function useDashboardCounts(access: CountAccess) {
  const [counts, setCounts] = useState<DashboardCounts>({});
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);

  // Bumped by every run and by unmount: a response from a superseded run, or
  // one that lands after the dashboard closed, must not overwrite newer state.
  const generation = useRef(0);
  const lastRun = useRef(0);

  const { reports, health, support, users } = access;

  const refresh = useCallback(async () => {
    const run = ++generation.current;
    lastRun.current = Date.now();
    setIsRefreshing(true);

    const allowed: CountAccess = { reports, health, support, users };
    const jobs = COUNT_SPECS.filter((spec) => allowed[spec.group]);

    const results = await Promise.allSettled(
      jobs.map((spec) => getCountFromServer(spec.build()).then((snapshot) => snapshot.data().count))
    );
    if (run !== generation.current) return;

    const next: DashboardCounts = {};
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        next[jobs[index].key] = result.value;
      } else {
        console.warn(`[Dashboard] counter "${jobs[index].key}" unavailable:`, result.reason?.code ?? result.reason);
      }
    });

    setCounts(next);
    setUpdatedAt(Date.now());
    setIsRefreshing(false);
  }, [reports, health, support, users]);

  useEffect(() => {
    void refresh();

    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, REFRESH_INTERVAL_MS);

    // A tab left in the background is not polled; catch up when it comes back.
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastRun.current > REFRESH_INTERVAL_MS) void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      generation.current += 1;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return { counts, updatedAt, isRefreshing, refresh };
}

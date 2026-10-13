import React, { createContext, useContext, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { canAccessSection } from '../../lib/adminPermissions';
import { useDashboardCounts } from '../../lib/useDashboardCounts';

/**
 * One set of server-side counters for the whole admin panel.
 *
 * The sidebar badges ("12 reports waiting") and the dashboard cards read the
 * same numbers. Fetching them once, here, means the badge and the card can never
 * disagree and the panel does not pay for the same aggregation queries twice.
 * Refreshes every five minutes and on demand (see useDashboardCounts).
 */
type CountsValue = ReturnType<typeof useDashboardCounts>;

/**
 * The context object is kept across hot updates in development.
 *
 * Without this, saving this file made Vite load a second copy of the module: the
 * provider (already mounted) and a lazily loaded section (loaded earlier) then held
 * two different context objects, and the section crashed with "useAdminCounts must
 * be used inside <AdminCountsProvider>" until the page was reloaded. In production
 * there is no hot update and this is simply `createContext`.
 */
const hot = (import.meta as unknown as { hot?: { data: Record<string, unknown> } }).hot;
const AdminCountsContext: React.Context<CountsValue | null> =
  (hot?.data.adminCountsContext as React.Context<CountsValue | null> | undefined) ?? createContext<CountsValue | null>(null);
if (hot) hot.data.adminCountsContext = AdminCountsContext;

export function AdminCountsProvider({ children }: { children: React.ReactNode }) {
  const currentUser = useStore(state => state.currentUser);

  // Which counters this role may read. A role that cannot open a section never
  // issues the query for it.
  const access = useMemo(
    () => ({
      reports: canAccessSection(currentUser, 'reports'),
      health: canAccessSection(currentUser, 'health'),
      support: canAccessSection(currentUser, 'support'),
      users: canAccessSection(currentUser, 'users'),
    }),
    [currentUser]
  );

  const { counts, updatedAt, isRefreshing, refresh } = useDashboardCounts(access);
  const value = useMemo(
    () => ({ counts, updatedAt, isRefreshing, refresh }),
    [counts, updatedAt, isRefreshing, refresh]
  );

  return <AdminCountsContext.Provider value={value}>{children}</AdminCountsContext.Provider>;
}

export function useAdminCounts(): CountsValue {
  const value = useContext(AdminCountsContext);
  if (!value) throw new Error('useAdminCounts must be used inside <AdminCountsProvider>.');
  return value;
}

/**
 * Like {@link useAdminCounts}, but returns null outside the provider instead of
 * throwing. For sections that can also be rendered on their own (a role console
 * embedding the reports queue) and should degrade to loaded-data counts there.
 */
export function useOptionalAdminCounts(): CountsValue | null {
  return useContext(AdminCountsContext);
}

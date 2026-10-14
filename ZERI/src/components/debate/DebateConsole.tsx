import { useState } from 'react';
import { BadgeCheck, Flag, Landmark, LayoutDashboard, Megaphone, MessageSquare, ShieldAlert } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { debateStats, formatEur } from '../../lib/debateApi';
import { DebatePayments } from './DebatePayments';
import { DebatePosts } from './DebatePosts';
import { DebateModeration } from './DebateModeration';
import { DebateAds, DebateTicks } from './DebateAdsAndTicks';
import { ErrorNote, Panel, Stat, btn, useLoad } from './ui';

type Tab = 'overview' | 'moderation' | 'payments' | 'ticks' | 'ads' | 'posts';

const TABS: ReadonlyArray<{ id: Tab; label: string; icon: typeof Landmark }> = [
  { id: 'overview', label: 'Përmbledhje', icon: LayoutDashboard },
  { id: 'moderation', label: 'Moderimi', icon: ShieldAlert },
  { id: 'payments', label: 'Pagesat', icon: Landmark },
  { id: 'ticks', label: 'Verifikimet', icon: BadgeCheck },
  { id: 'ads', label: 'Reklamat', icon: Megaphone },
  { id: 'posts', label: 'Postimet', icon: MessageSquare },
];

/**
 * The Debate admin console. The same component is the `/debatwp` page and the
 * "Admini i Debatit" section inside the owner's admin panel.
 */
export function DebateConsole() {
  const [tab, setTab] = useState<Tab>('overview');
  const [postFilter, setPostFilter] = useState<'all' | 'reported'>('all');
  const stats = useLoad(debateStats, []);
  const refreshStats = () => void stats.reload();

  return (
    <div className="space-y-5">
      <nav aria-label={dt('Seksionet e debatit')} className="sticky top-0 z-30 -mx-4 overflow-x-auto bg-slate-50/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-2xl dark:bg-slate-950/95">
        <div role="tablist" className="flex gap-1.5">
          {TABS.map(({ id, label, icon: Icon }) => {
            const badge = id === 'payments' ? stats.data?.paymentsAwaiting : id === 'posts' ? stats.data?.reported : 0;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold transition',
                  tab === id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/10'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {dt(label)}
                {badge ? <span className="rounded-full bg-rose-600 px-1.5 text-[10px] font-black text-white">{badge}</span> : null}
              </button>
            );
          })}
        </div>
      </nav>

      {tab === 'overview' && (
        <div className="space-y-4">
          <ErrorNote message={stats.error} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Pagesa në pritje" value={stats.data?.paymentsAwaiting ?? '—'} tone="amber" hint={dt('presin konfirmim')} />
            <Stat label="Të paguara (30 ditë)" value={stats.data ? formatEur(stats.data.paidLast30Days.sumEur) : '—'} tone="emerald" hint={stats.data ? `${stats.data.paidLast30Days.count} ${dt('pagesa')}` : undefined} />
            <Stat label="Llogari me tick" value={stats.data?.verifiedAccounts ?? '—'} tone="blue" />
            <Stat label="Postime të raportuara" value={stats.data?.reported ?? '—'} tone="rose" hint={stats.data ? `${stats.data.hidden} ${dt('të fshehura')} · ${stats.data.posts} ${dt('gjithsej')}` : undefined} />
          </div>

          <Panel>
            <h2 className="text-base font-black text-slate-900 dark:text-white">{dt('Çfarë kërkon vëmendje')}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                <span><strong>{stats.data?.paymentsAwaiting ?? 0}</strong> {dt('pagesa presin të konfirmohen me kodin e pagesës')}</span>
                <button type="button" onClick={() => setTab('payments')} className={cn(btn.ghost, 'min-h-9 px-3 text-xs')}><Landmark className="h-3.5 w-3.5" aria-hidden="true" />{dt('Hap pagesat')}</button>
              </li>
              <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                <span><strong>{stats.data?.reported ?? 0}</strong> {dt('postime janë raportuar nga qytetarët')}</span>
                <button type="button" onClick={() => setTab('moderation')} className={cn(btn.ghost, 'min-h-9 px-3 text-xs')}><Flag className="h-3.5 w-3.5" aria-hidden="true" />{dt('Shqyrto')}</button>
              </li>
            </ul>
          </Panel>
        </div>
      )}

      {tab === 'moderation' && <DebateModeration onChanged={refreshStats} />}
      {tab === 'payments' && <DebatePayments onChanged={refreshStats} />}
      {tab === 'ticks' && <DebateTicks />}
      {tab === 'ads' && <DebateAds />}
      {tab === 'posts' && <DebatePosts key={postFilter} initialFilter={postFilter} onChanged={refreshStats} />}
    </div>
  );
}

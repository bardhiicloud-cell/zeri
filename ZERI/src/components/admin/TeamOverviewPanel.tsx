import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { loadTeamOverview, type TeamOverview } from '../../lib/teamOverviewApi';

/**
 * Ekipi: the manager's first screen.
 *
 * Answers four questions without opening a report: how much waits, how much of it
 * nobody has taken on, how the work is spread across agents, and who holds work but
 * has gone quiet. Numbers come from the server (counts, not loaded reports), so
 * they are exact however many reports exist. Read-only; a row opens that person's
 * full audit.
 */
export interface TeamOverviewPanelProps {
  /** Opens one person's activity. Left out where the viewer may see the workload but not individual audit (the dispatcher). */
  onOpenPerson?: (uid: string) => void;
}

const ago = (iso: string | null) => {
  if (!iso) return dt('asnjëherë');
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes} ${dt('min më parë')}`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} ${dt('orë më parë')}`;
  return `${Math.round(minutes / 1440)} ${dt('ditë më parë')}`;
};

function Figure({ label, value, tone = 'slate', hint }: { label: string; value: string | number; tone?: 'slate' | 'rose' | 'amber' | 'emerald'; hint?: string }) {
  const tones = { slate: 'text-slate-900 dark:text-white', rose: 'text-rose-600', amber: 'text-amber-600', emerald: 'text-emerald-600' };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <div className={cn('text-2xl font-black tabular-nums', tones[tone])}>{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{dt(label)}</div>
      {hint && <div className="mt-1 text-[11px] text-slate-400">{dt(hint)}</div>}
    </div>
  );
}

export default function TeamOverviewPanel({ onOpenPerson }: TeamOverviewPanelProps) {
  const [data, setData] = useState<TeamOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    try {
      setData(await loadTeamOverview(fresh));
      setError('');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (error && !data) return <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>;
  if (!data) return <p className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" aria-label={dt('Duke ngarkuar')} /></p>;

  const { queue, team } = data;
  const maxHolding = Math.max(1, ...data.agents.map(agent => agent.holding));

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Presin shqyrtimin" value={queue.pending.toLocaleString('sq')} hint={queue.oldestPendingAt ? `${dt('Më e vjetra:')} ${ago(queue.oldestPendingAt)}` : undefined} />
        <Figure label="Askush s'i ka marrë" value={queue.unassigned.toLocaleString('sq')} tone={queue.unassigned > 0 ? 'amber' : 'emerald'} />
        <Figure label="Të vonuara" value={queue.overdue.toLocaleString('sq')} tone={queue.overdue > 0 ? 'rose' : 'emerald'} />
        <Figure label="Agjentë të heshtur me punë" value={team.dormantHolders} tone={team.dormantHolders > 0 ? 'rose' : 'emerald'} hint="Mbajnë raporte, 3+ ditë pa veprim" />
      </div>

      {team.dormantHolders > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {dt('Disa agjentë mbajnë raportime por nuk kanë vepruar për ditë. Raportet e tyre ndalojnë: kërkoni nga administratori t\'i lëshojë ose t\'i caktojë tjetërkund.')}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{dt('Ngarkesa e ekipit')} <span className="font-normal text-slate-400">· {team.agents} {dt('agjentë')}, {team.totalHeld} {dt('raporte të marra')}</span></h3>
          {team.imbalance >= 2 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{dt('E pabarabartë')}: {team.imbalance}×</span>}
          <button type="button" onClick={() => void load(true)} disabled={loading} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" /> {dt('Rifresko')}
          </button>
        </div>

        {data.agents.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">{dt('Nuk ka agjentë të regjistruar.')}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {data.agents.map(agent => (
              <li key={agent.uid}>
                <button type="button" disabled={!onOpenPerson} onClick={() => onOpenPerson?.(agent.uid)} className="grid w-full grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-slate-900 dark:text-white">{agent.name}</span>
                      {agent.dormant && <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">{dt('I heshtur')}</span>}
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">{dt('Veprimi i fundit')}: {ago(agent.lastActionAt)}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                        <span className={cn('block h-full rounded-full', agent.dormant ? 'bg-rose-500' : 'bg-indigo-600')} style={{ width: `${Math.round((agent.holding / maxHolding) * 100)}%` }} />
                      </span>
                      <span className="w-14 shrink-0 text-right text-xs font-black tabular-nums text-slate-700 dark:text-slate-200">{agent.holding} <span className="font-normal text-slate-400">({agent.sharePercent}%)</span></span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{dt('mban')}</span>
                  </span>
                  <span className="text-right text-[11px] text-slate-500">
                    <span className="block font-bold tabular-nums text-slate-700 dark:text-slate-200">{agent.actions24h}</span>
                    <span>{dt('veprime 24h')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-[11px] text-slate-400">{dt('Përditësuar')} {ago(data.generatedAt)}. {dt('Pamja është vetëm për lexim; ndryshimet i bën administratori.')}</p>
    </section>
  );
}

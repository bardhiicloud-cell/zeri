import { useState } from 'react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { debateInsightsApi } from '../../lib/debateInsightsApi';
import { KIND_LABELS, REASON_LABELS, STATUS_LABELS } from '../../lib/moderationApi';
import { Empty, ErrorNote, Panel, Spinner, Stat, btn, useLoad } from './ui';

const PERIODS = [7, 14, 30, 90] as const;

/** Horizontal bars: one row per entry, widths relative to the largest. */
function Bars({ entries, label }: { entries: Array<[string, number]>; label: (key: string) => string }) {
  const max = Math.max(1, ...entries.map(([, n]) => n));
  if (entries.length === 0) return <Empty>{dt('Pa të dhëna për këtë periudhë.')}</Empty>;
  return (
    <ul className="space-y-2">
      {entries.map(([key, n]) => (
        <li key={key} className="text-sm">
          <div className="flex justify-between gap-2"><span className="font-semibold text-slate-700 dark:text-slate-200">{label(key)}</span><span className="font-black tabular-nums">{n}</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-blue-600" style={{ width: `${(n / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** The reports department: what is reported, why, how fast it is handled, who keeps coming back. */
export function DebateReportInsights() {
  const [days, setDays] = useState<number>(30);
  const data = useLoad(() => debateInsightsApi.reports(days), [days]);
  const d = data.data;
  const sorted = (rec: Record<string, number> | undefined) => Object.entries(rec ?? {}).sort((a, b) => b[1] - a[1]);
  const trendMax = Math.max(1, ...(d?.trend ?? []).map((t) => Math.max(t.opened, t.decided)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button key={p} type="button" aria-pressed={days === p} onClick={() => setDays(p)}
            className={cn('min-h-9 rounded-full px-3 text-sm font-bold', days === p ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300')}>{p} {dt('ditë')}</button>
        ))}
        <button type="button" onClick={() => void data.reload()} className={cn(btn.ghost, 'ml-auto min-h-9 px-3 text-xs')}>{dt('Rifresko')}</button>
      </div>
      <ErrorNote message={data.error} />
      {data.loading && !d && <div className="flex justify-center p-8 text-slate-400"><Spinner className="h-6 w-6" /></div>}

      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Raste" value={d.totals.cases} />
            <Stat label="Raportime" value={d.totals.reports} tone="blue" />
            <Stat label="Të hapura" value={d.totals.open} tone="amber" hint={`${d.unassignedOpen} ${dt('pa moderator')}`} />
            <Stat label="Urgjente të hapura" value={d.totals.urgentOpen} tone="rose" hint={`${d.totals.escalated} ${dt('të eskaluara')}`} />
            <Stat label="Koha mesatare e vendimit" value={d.medianResolutionHours === null ? '—' : `${d.medianResolutionHours} ${dt('orë')}`} tone="emerald" hint={dt('mediana')} />
          </div>

          <Panel>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">{dt('Raste të hapura dhe të vendosura çdo ditë')}</h3>
            <div className="mt-3 flex h-32 items-end gap-0.5" role="img" aria-label={dt('Grafiku ditor')}>
              {d.trend.map((t) => (
                <div key={t.day} className="flex h-full flex-1 items-end gap-px" title={`${t.day}: ${t.opened} ${dt('të hapura')}, ${t.decided} ${dt('të vendosura')}`}>
                  <div className="w-1/2 rounded-t bg-rose-500" style={{ height: `${(t.opened / trendMax) * 100}%` }} />
                  <div className="w-1/2 rounded-t bg-emerald-500" style={{ height: `${(t.decided / trendMax) * 100}%` }} />
                </div>
              ))}
            </div>
            <p className="mt-2 flex gap-4 text-xs text-slate-500"><span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-rose-500" />{dt('Të hapura')}</span><span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-500" />{dt('Të vendosura')}</span></p>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel><h3 className="mb-3 text-sm font-black">{dt('Sipas arsyes')}</h3><Bars entries={sorted(d.byReason)} label={(k) => dt(REASON_LABELS[k] ?? k)} /></Panel>
            <Panel><h3 className="mb-3 text-sm font-black">{dt('Sipas llojit')}</h3><Bars entries={sorted(d.byKind)} label={(k) => dt(KIND_LABELS[k as keyof typeof KIND_LABELS] ?? k)} /></Panel>
            <Panel><h3 className="mb-3 text-sm font-black">{dt('Sipas gjendjes')}</h3><Bars entries={sorted(d.byStatus)} label={(k) => dt(STATUS_LABELS[k as keyof typeof STATUS_LABELS] ?? k)} /></Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel>
              <h3 className="mb-3 text-sm font-black">{dt('Sa kohë presin rastet e hapura')}</h3>
              <Bars entries={[['under24h', d.openAge.under24h], ['day1to3', d.openAge.day1to3], ['day3to7', d.openAge.day3to7], ['over7d', d.openAge.over7d]]}
                label={(k) => dt({ under24h: 'Nën 24 orë', day1to3: '1–3 ditë', day3to7: '3–7 ditë', over7d: 'Mbi 7 ditë' }[k] ?? k)} />
            </Panel>
            <Panel>
              <h3 className="mb-3 text-sm font-black">{dt('Ngarkesa e moderatorëve')}</h3>
              {d.moderators.length === 0 ? <Empty>{dt('Asnjë rast i marrë përsipër.')}</Empty> : (
                <ul className="space-y-1.5 text-sm">{d.moderators.map((m) => <li key={m.uid} className="flex justify-between gap-2"><span className="truncate">{m.name || m.uid}</span><span className="font-black tabular-nums">{m.open}</span></li>)}</ul>
              )}
            </Panel>
            <Panel>
              <h3 className="mb-3 text-sm font-black">{dt('Llogari që raportohen vazhdimisht')}</h3>
              {d.repeatSubjects.length === 0 ? <Empty>{dt('Asnjë llogari me më shumë se një rast.')}</Empty> : (
                <ul className="space-y-1.5 text-sm">{d.repeatSubjects.map((s) => <li key={s.uid} className="flex justify-between gap-2"><span className="truncate">{s.name || s.uid}</span><span className="shrink-0 text-xs text-slate-500">{s.cases} {dt('raste')} · {s.reports} {dt('raportime')}</span></li>)}</ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

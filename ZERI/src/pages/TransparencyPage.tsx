import { useEffect, useMemo, useState } from 'react';
import { Download, Info, Loader2, Printer, RefreshCw, ShieldCheck } from 'lucide-react';
import { AuraOrbit, AuraHero } from '../components/aura/Aura';
import { dt } from '@/src/lib/dt';
import { cn } from '../lib/utils';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import { useStore } from '../lib/store';
import { fetchTransparency, transparencyCsv, type TransparencyData, type TransparencyFilters } from '../lib/transparencyApi';

/**
 * /transparenca - the Transparency Center.
 *
 * Every number is counted by the server over all reports, says what it is divided
 * by, and carries the period and the time it was made. A figure that cannot be
 * computed is "pa të dhëna", never zero. Only aggregates are shown: no reporter,
 * photo, address or internal note is on this page, so anonymous reports stay
 * anonymous. "Shkarko PDF" prints this page (the print layout hides the controls).
 */

const EMPTY: TransparencyFilters = { from: '', to: '', municipality: '', category: '' };

const fmt = (n: number) => n.toLocaleString('sq-AL');
const rate = (value: number | null) => (value === null ? dt('pa të dhëna') : `${value.toLocaleString('sq-AL')}%`);
const hours = (value: number | null) => {
  if (value === null) return dt('pa të dhëna');
  return value >= 48 ? `${(value / 24).toLocaleString('sq-AL', { maximumFractionDigits: 1 })} ${dt('ditë')}` : `${value.toLocaleString('sq-AL')} ${dt('orë')}`;
};

function Figure({ label, value, note, tone = 'slate' }: { label: string; value: string; note?: string; tone?: 'slate' | 'emerald' | 'amber' | 'rose' | 'blue' }) {
  const tones = { slate: 'text-slate-900 dark:text-white', emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600', blue: 'text-blue-700' };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <div className={cn('text-3xl font-black tabular-nums', tones[tone])}>{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">{dt(label)}</div>
      {note && <div className="mt-1 text-xs leading-snug text-slate-600 dark:text-slate-400">{dt(note)}</div>}
    </div>
  );
}

const SEGMENTS: Array<{ key: string; label: string; color: string }> = [
  { key: 'Pending Review', label: 'Presin shqyrtimin', color: 'bg-slate-400' },
  { key: 'Approved', label: 'Aprovuar, presin komunën', color: 'bg-sky-500' },
  { key: 'In Progress', label: 'Në trajtim', color: 'bg-indigo-500' },
  { key: 'Overdue', label: 'Të vonuara', color: 'bg-amber-500' },
  { key: 'Resolved', label: 'Të zgjidhura', color: 'bg-emerald-500' },
  { key: 'Rejected', label: 'Të refuzuara', color: 'bg-rose-500' },
];

export default function TransparencyPage() {
  const categories = useStore(state => state.categories);
  const [filters, setFilters] = useState<TransparencyFilters>(EMPTY);
  const [data, setData] = useState<TransparencyData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // Bumped by "Provo përsëri" to run the request again with the same filters.
  const [attempt, setAttempt] = useState(0);
  const [sort, setSort] = useState<'received' | 'resolutionRate'>('received');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchTransparency(filters, controller.signal)
      .then(result => { setData(result); setError(''); })
      .catch(caught => { if ((caught as Error).name !== 'AbortError') setError((caught as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, attempt]);

  const categoryNames = useMemo(() => Array.from(new Set((categories ?? []).map(category => category.name).filter(Boolean))).sort(), [categories]);
  const maxMonth = Math.max(1, ...(data?.monthly.map(month => month.received) ?? [1]));
  const total = data?.summary.received ?? 0;
  const municipalities = useMemo(
    () => [...(data?.byMunicipality ?? [])].sort((a, b) => sort === 'received' ? b.received - a.received : (b.resolutionRate ?? -1) - (a.resolutionRate ?? -1)),
    [data, sort]
  );

  const download = () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([transparencyCsv(data)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `transparenca-${data.generatedAt.slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const input = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white';
  const filtered = Boolean(filters.from || filters.to || filters.municipality || filters.category);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 print:max-w-none print:px-0" id="transparency">
      <AuraHero visual={<AuraOrbit core={ShieldCheck} />} tone="slate" eyebrow={dt('Transparenca')} icon={ShieldCheck} title={dt('Qendra e Transparencës')}
        subtitle={dt('Çfarë ka bërë platforma me raportimet e qytetarëve, në numra që mund t\'i kontrolloni. Çdo shifër numërohet nga baza e të dhënave për të gjitha raportimet, dhe tregon me çfarë pjesëtohet.')} />

      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 print:hidden dark:border-white/10 dark:bg-slate-900" aria-label={dt('Filtrat')}>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">{dt('Nga')}<input type="date" value={filters.from} max={filters.to || undefined} onChange={event => setFilters({ ...filters, from: event.target.value })} className={cn(input, 'mt-1 block')} /></label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">{dt('Deri')}<input type="date" value={filters.to} min={filters.from || undefined} onChange={event => setFilters({ ...filters, to: event.target.value })} className={cn(input, 'mt-1 block')} /></label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">{dt('Komuna')}
          <select value={filters.municipality} onChange={event => setFilters({ ...filters, municipality: event.target.value })} className={cn(input, 'mt-1 block')}>
            <option value="">{dt('Të gjitha')}</option>
            {KOSOVO_MUNICIPALITIES.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">{dt('Kategoria')}
          <select value={filters.category} onChange={event => setFilters({ ...filters, category: event.target.value })} className={cn(input, 'mt-1 block')}>
            <option value="">{dt('Të gjitha')}</option>
            {categoryNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        {filtered && <button type="button" onClick={() => setFilters(EMPTY)} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-600 underline-offset-2 hover:underline">{dt('Pastro filtrat')}</button>}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={download} disabled={!data} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200"><Download className="h-4 w-4" aria-hidden="true" />{dt('Shkarko CSV')}</button>
          <button type="button" onClick={() => window.print()} disabled={!data} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-900"><Printer className="h-4 w-4" aria-hidden="true" />{dt('Shkarko PDF')}</button>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200">
          <p className="min-w-0 flex-1">{dt(error)}</p>
          <button type="button" onClick={() => setAttempt(count => count + 1)} disabled={loading} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-rose-700 px-4 text-xs font-bold text-white hover:bg-rose-800 disabled:opacity-50">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />{dt('Provo përsëri')}
          </button>
        </div>
      )}
      {loading && !data && <p className="p-12 text-center" role="status"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-600 dark:text-slate-400" aria-label={dt('Duke ngarkuar')} /></p>}

      {data && (
        <div className={cn('space-y-6 transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {dt('Periudha')}: <strong>{data.period.from ?? dt('nga fillimi')}</strong> {dt('deri')} <strong>{data.period.to ?? dt('sot')}</strong>
            {data.filters.municipality && <> · {dt('Komuna')}: <strong>{data.filters.municipality}</strong></>}
            {data.filters.category && <> · {dt('Kategoria')}: <strong>{data.filters.category}</strong></>}
            {' · '}{dt('Përditësuar')}: {new Date(data.generatedAt).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' })} ({dt('rifreskohet çdo')} {Math.round(data.cacheSeconds / 60)} {dt('minuta')})
          </p>

          <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label={dt('Treguesit kryesorë')}>
            <Figure label="Të regjistruara" value={fmt(data.summary.received)} />
            <Figure label="Presin shqyrtimin" value={fmt(data.summary.awaitingReview)} tone="amber" note="Ende pa vendim nga stafi" />
            <Figure label="Të pranuara" value={fmt(data.summary.published)} tone="blue" note={`Pranim: ${rate(data.summary.rates.acceptanceRate)} të atyre që kanë marrë vendim`} />
            <Figure label="Të refuzuara" value={fmt(data.summary.rejected)} tone="rose" note="Gjithmonë me arsye të shkruar" />
            <Figure label="Në trajtim" value={fmt(data.summary.inProgress)} />
            <Figure label="Të zgjidhura" value={fmt(data.summary.resolved)} tone="emerald" note={`Zgjidhje: ${rate(data.summary.rates.resolutionRate)} e të pranuarave`} />
            <Figure label="Të vonuara" value={fmt(data.summary.overdue)} tone="rose" note={`${rate(data.summary.rates.overdueShare)} e të pranuarave të pazgjidhura`} />
            <Figure label="Koha mesatare e zgjidhjes" value={hours(data.resolutionTime.averageHours)} tone="slate" note={data.resolutionTime.sampleSize ? `Mediana ${hours(data.resolutionTime.medianHours)} · matur mbi ${fmt(data.resolutionTime.sampleSize)} raportime të zgjidhura` : 'Ende s\'ka raportime të zgjidhura për ta matur'} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{dt('Ku ndodhen raportimet tani')}</h2>
            {total === 0 ? (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{dt('Asnjë raportim në këtë filtër.')}</p>
            ) : (
              <>
                <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label={dt('Ndarja e raportimeve sipas statusit')}>
                  {SEGMENTS.map(segment => {
                    const value = segment.key === 'Resolved' ? (data.counts.Resolved ?? 0) + (data.counts.Closed ?? 0) : segment.key === 'In Progress' ? (data.counts['In Progress'] ?? 0) + (data.counts.Assigned ?? 0) : data.counts[segment.key] ?? 0;
                    return value > 0 ? <span key={segment.key} className={segment.color} style={{ width: `${(value / total) * 100}%` }} title={`${dt(segment.label)}: ${fmt(value)}`} /> : null;
                  })}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {SEGMENTS.map(segment => {
                    const value = segment.key === 'Resolved' ? (data.counts.Resolved ?? 0) + (data.counts.Closed ?? 0) : segment.key === 'In Progress' ? (data.counts['In Progress'] ?? 0) + (data.counts.Assigned ?? 0) : data.counts[segment.key] ?? 0;
                    return <li key={segment.key} className="flex items-center gap-1.5"><span className={cn('h-2.5 w-2.5 rounded-full', segment.color)} aria-hidden="true" />{dt(segment.label)}: <strong className="tabular-nums">{fmt(value)}</strong> <span className="text-slate-600 dark:text-slate-400">({Math.round((value / total) * 1000) / 10}%)</span></li>;
                  })}
                </ul>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{dt('Raportime të regjistruara sipas muajit')}</h2>
            <div className="mt-4 flex h-40 items-end gap-1.5" role="img" aria-label={dt('Grafiku mujor')}>
              {data.monthly.map(month => (
                <div key={month.month} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-400">{month.received ? fmt(month.received) : ''}</span>
                  <span className="w-full rounded-t bg-blue-600" style={{ height: `${Math.max(month.received ? 3 : 0, (month.received / maxMonth) * 100)}%` }} title={`${month.month}: ${fmt(month.received)}`} />
                  <span className="text-xs text-slate-600 dark:text-slate-400">{month.month.slice(2)}</span>
                </div>
              ))}
            </div>
          </section>

          {data.byMunicipality.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3 dark:border-white/10">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">{dt('Sipas komunës')}</h2>
                <div className="ml-auto flex gap-1.5 print:hidden" role="group" aria-label={dt('Rendit sipas')}>
                  {([['received', 'Më shumë raportime'], ['resolutionRate', 'Përqindja e zgjidhjes']] as const).map(([id, label]) => (
                    <button key={id} type="button" onClick={() => setSort(id)} aria-pressed={sort === id} className={cn('rounded-lg px-2.5 py-1 text-xs font-bold', sort === id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300')}>{dt(label)}</button>
                  ))}
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead><tr className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400"><th className="px-5 py-2">{dt('Komuna')}</th><th className="px-3 py-2 text-right">{dt('Të regjistruara')}</th><th className="px-3 py-2 text-right">{dt('Të zgjidhura')}</th><th className="px-5 py-2 text-right">{dt('Zgjidhje')}</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {municipalities.map(row => (
                    <tr key={row.municipality}>
                      <td className="px-5 py-2 font-semibold text-slate-800 dark:text-slate-100">{row.municipality}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(row.received)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(row.resolved)}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{rate(row.resolutionRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {data.recentOutcomes.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{dt('Rezultatet e fundit të publikuara')}</h2>
              <ul className="mt-3 space-y-3">
                {data.recentOutcomes.map(outcome => (
                  <li key={`${outcome.trackingId}-${outcome.title}`} className="border-b border-slate-100 pb-3 last:border-0 dark:border-white/5">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{outcome.title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{[outcome.municipality, outcome.category, outcome.resolvedAt && `${dt('zgjidhur')} ${outcome.resolvedAt}`].filter(Boolean).join(' · ')}{outcome.trackingId && <> · <a className="font-mono text-blue-700 underline-offset-2 hover:underline print:no-underline" href={`/trackid?id=${encodeURIComponent(outcome.trackingId)}`}>#{outcome.trackingId}</a></>}</p>
                    {outcome.officialResponse && <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300"><strong>{dt('Përgjigja zyrtare')}:</strong> {outcome.officialResponse}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <details className="rounded-2xl border border-slate-200 bg-white p-5 print:open dark:border-white/10 dark:bg-slate-900" open>
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><Info className="h-4 w-4 text-blue-600" aria-hidden="true" />{dt('Si llogariten numrat')}</summary>
            <dl className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {Object.entries(data.definitions).map(([key, text]) => <div key={key}><dd>{dt(text)}</dd></div>)}
            </dl>
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">{dt('Kur një shifër nuk mund të llogaritet (p.sh. pjesëtuesi është zero), shfaqet "pa të dhëna", jo zero.')}</p>
          </details>
        </div>
      )}
    </main>
  );
}

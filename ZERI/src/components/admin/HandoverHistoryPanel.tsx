import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, History, Loader2, RefreshCw, UserMinus, UserPlus } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { fetchHandovers, type HandoverEntry } from '../../lib/reportAssignmentApi';
import { appendHandovers, filterHandovers, formatHandoverTime, HANDOVER_FILTERS, personLabel, type HandoverFilter } from '../../lib/handoverHistory';

/**
 * Who has held this report, in order, and why.
 *
 * Reads GET /api/v1/reports/:id/assignments, which the server limits to staff,
 * agents and the monitor. The list is loaded when the panel is opened, newest
 * first, a page at a time. Only what the server recorded is shown: a missing
 * name reads "nuk është regjistruar", it is never filled in with a guess.
 */
export default function HandoverHistoryPanel({ reportId, refreshKey = '' }: { reportId: string; refreshKey?: string | number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HandoverEntry[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'more' | 'error' | 'ready'>('idle');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<HandoverFilter>('all');
  // A slow answer for a report the reviewer already left must not overwrite the one on screen.
  const generation = useRef(0);

  const load = useCallback(async (before: string | null) => {
    const mine = ++generation.current;
    setState(before ? 'more' : 'loading');
    setError('');
    try {
      const page = await fetchHandovers(reportId, { before });
      if (mine !== generation.current) return;
      setItems(previous => (before ? appendHandovers(previous, page.items) : page.items));
      setNext(page.nextBefore);
      setState('ready');
    } catch (failure) {
      if (mine !== generation.current) return;
      setError(failure instanceof Error ? failure.message : dt('Historiku nuk u ngarkua.'));
      setState('error');
    }
  }, [reportId]);

  // A different report, or a change just made to this one: start over.
  useEffect(() => {
    generation.current += 1;
    setItems([]);
    setNext(null);
    setState('idle');
    setError('');
    setFilter('all');
  }, [reportId]);
  useEffect(() => { if (open) void load(null); }, [open, load, refreshKey]);

  const shown = filterHandovers(items, filter);
  const notRecorded = dt('nuk është regjistruar');
  const busy = state === 'loading' || state === 'more';
  const panelId = `handover-${reportId}`;

  return (
    <section className="mt-5" aria-label={dt('Historiku i caktimeve')}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-400 dark:hover:text-white"
      >
        <History className="h-3.5 w-3.5" aria-hidden="true" />
        {dt('Historiku i caktimeve')}
      </button>

      {open && (
        <div id={panelId} className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`${panelId}-filter`}>{dt('Filtro sipas veprimit')}</label>
            <select
              id={`${panelId}-filter`}
              value={filter}
              onChange={event => setFilter(event.target.value as HandoverFilter)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
            >
              {HANDOVER_FILTERS.map(option => <option key={option.value} value={option.value}>{dt(option.label)}</option>)}
            </select>
            <button
              type="button"
              onClick={() => void load(null)}
              disabled={busy}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-white/10 dark:text-slate-300"
            >
              <RefreshCw className={cn('h-3 w-3', busy && 'animate-spin')} aria-hidden="true" /> {dt('Rifresko')}
            </button>
          </div>

          <div aria-live="polite">
            {state === 'loading' && (
              <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> {dt('Po ngarkohet historiku…')}</p>
            )}
            {state === 'error' && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                <p className="font-semibold">{error}</p>
                <button type="button" onClick={() => void load(null)} className="mt-1.5 font-bold underline">{dt('Provo përsëri')}</button>
              </div>
            )}
            {state === 'ready' && items.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500 dark:border-white/15">{dt('Ky raportim nuk ka ndryshim mbajtësi të regjistruar.')}</p>
            )}
            {state === 'ready' && items.length > 0 && shown.length === 0 && (
              <p className="text-xs text-slate-500">{dt('Asnjë regjistrim për këtë filtër në faqet e ngarkuara.')}</p>
            )}
          </div>

          {shown.length > 0 && (
            <ol className="space-y-2">
              {shown.map(entry => {
                const release = entry.kind === 'release';
                const Icon = release ? UserMinus : UserPlus;
                return (
                  <li key={entry.id} className="rounded-lg border border-slate-200 p-2.5 text-xs dark:border-white/10">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-bold text-slate-800 dark:text-slate-100">
                      <Icon className={cn('h-3.5 w-3.5 shrink-0', release ? 'text-amber-600' : 'text-indigo-600')} aria-hidden="true" />
                      <span>{release ? dt('Lëshim') : dt('Caktim')}</span>
                      <span className="inline-flex flex-wrap items-center gap-1 font-semibold">
                        <span>{personLabel(entry.fromName, entry.fromUid ? notRecorded : dt('askush'))}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" aria-label={dt('te')} />
                        <span>{release ? dt('radha e përbashkët') : personLabel(entry.toName, notRecorded)}</span>
                      </span>
                      <time dateTime={entry.at} className="ml-auto font-normal text-slate-400">{formatHandoverTime(entry.at)}</time>
                    </div>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">{dt('Nga')}: {personLabel(entry.byName, notRecorded)}</p>
                    {entry.reason ? (
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300">{entry.reason}</p>
                    ) : (
                      <p className="mt-1 italic text-slate-400">{dt('Pa arsye të shënuar.')}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {next && state !== 'error' && (
            <button
              type="button"
              onClick={() => void load(next)}
              disabled={busy}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-white/10 dark:text-slate-200"
            >
              {state === 'more' && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />} {dt('Ngarko më të vjetrat')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

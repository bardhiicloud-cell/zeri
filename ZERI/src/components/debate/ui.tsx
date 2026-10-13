import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';

/** Small building blocks shared by the Debate admin console. */

/** Load something once, expose loading/error and a reload. Ignores answers that arrive after unmount. */
export function useLoad<T>(load: () => Promise<T>, deps: readonly unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const value = await loader.current();
      if (alive.current) {
        setData(value);
        setError('');
      }
    } catch (e) {
      if (alive.current) setError((e as Error)?.message || 'Gabim në ngarkim.');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload };
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-hidden="true" />;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-white/10 dark:bg-slate-900', className)}>{children}</section>;
}

export function Stat({ label, value, hint, tone = 'slate' }: { label: string; value: ReactNode; hint?: string; tone?: 'slate' | 'amber' | 'emerald' | 'rose' | 'blue' }) {
  const tones = {
    slate: 'text-slate-900 dark:text-white',
    amber: 'text-amber-600 dark:text-amber-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    rose: 'text-rose-600 dark:text-rose-400',
    blue: 'text-blue-600 dark:text-blue-400',
  } as const;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{dt(label)}</p>
      <p className={cn('mt-1 text-2xl font-black', tones[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'amber' | 'emerald' | 'rose' | 'blue' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
    rose: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  } as const;
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold', tones[tone])}>{children}</span>;
}

export const btn = {
  primary: 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50',
  success: 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50',
  danger: 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50',
  ghost: 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5',
} as const;

export const inputClass =
  'min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-blue-500 dark:border-white/15 dark:bg-slate-950 dark:text-white sm:text-sm';

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{message}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">{children}</p>;
}

/**
 * Selection state for a list: toggle one, select every id on screen, clear.
 * `allSelected` is true only when every visible id is chosen, which is what the
 * header checkbox shows.
 */
export function useSelection(visibleIds: readonly string[]) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  // Ids that disappeared (after an action or a filter change) are dropped.
  useEffect(() => {
    setSelected((current) => {
      const visible = new Set(visibleIds);
      const next = new Set([...current].filter((id) => visible.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visibleIds]);

  const toggle = useCallback((id: string) => setSelected((c) => {
    const next = new Set(c);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }), []);
  const selectAll = useCallback(() => setSelected(new Set(visibleIds)), [visibleIds]);
  const clear = useCallback(() => setSelected(new Set()), []);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggleAll = useCallback(() => (allSelected ? clear() : selectAll()), [allSelected, clear, selectAll]);

  return { selected, toggle, selectAll, clear, toggleAll, allSelected, count: selected.size };
}

export function BulkBar({ count, children, onClear }: { count: number; children: ReactNode; onClear: () => void }) {
  if (count === 0) return null;
  return (
    <div role="region" aria-label={dt('Veprime për të zgjedhurat')} className="sticky bottom-3 z-20 mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 rounded-2xl bg-slate-900 p-2.5 text-sm text-white shadow-xl dark:bg-slate-700">
      <span className="px-2 font-black">{count} {dt('të zgjedhura')}</span>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      <button type="button" onClick={onClear} className="min-h-9 rounded-lg px-3 text-xs font-bold text-slate-300 hover:text-white">{dt('Pastro')}</button>
    </div>
  );
}

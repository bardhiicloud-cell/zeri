import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { dt } from '@/src/lib/dt';

/**
 * End of a paged list: loads the next page when scrolled into view, and keeps a
 * visible button for keyboard users and for browsers without IntersectionObserver.
 */
export function LoadMore({ hasMore, loading, onLoad }: { hasMore: boolean; loading: boolean; onLoad: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onLoad();
    }, { rootMargin: '400px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoad]);

  if (!hasMore) {
    return <p className="py-6 text-center text-xs text-slate-400">{dt('Keni parë të gjitha postimet.')}</p>;
  }
  return (
    <div ref={ref} className="flex justify-center py-6">
      <button type="button" onClick={onLoad} disabled={loading}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 px-5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-700 dark:text-slate-200 dark:hover:bg-zinc-800">
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {loading ? dt('Po ngarkohet…') : dt('Ngarko më shumë')}
      </button>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Clock, Loader2, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { cancelScheduledApi, listScheduledApi, type ScheduledItem } from '../../lib/forumScheduleApi';

/** The author's scheduled posts. Each can be cancelled until it goes live. */
export function ScheduledPostsSheet({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<ScheduledItem[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    listScheduledApi().then((r) => { if (!cancelled) setItems(r.items); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  const cancel = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await cancelScheduledApi(id);
      setItems((prev) => (prev ?? []).filter((i) => i.id !== id));
      toast.success(dt('Postimi i planifikuar u anulua.'));
    } catch (e) {
      toast.error(e?.message || dt('Veprimi dështoi.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="scheduled-title" className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-zinc-900 sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <h2 id="scheduled-title" className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white"><Clock className="h-4 w-4" aria-hidden="true" />{dt('Postimet e planifikuara')}</h2>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto p-4">
          {items === null && !error && <li role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{dt('Po ngarkohet…')}</li>}
          {error && <li role="alert" className="py-8 text-center text-sm text-rose-600">{dt('Nuk u ngarkuan postimet e planifikuara.')}</li>}
          {items?.length === 0 && <li className="py-8 text-center text-sm text-slate-500">{dt('Nuk keni postime të planifikuara.')}</li>}
          {items?.map((p) => (
            <li key={p.id} className="rounded-2xl border border-slate-200 p-3 dark:border-zinc-700">
              <p className="line-clamp-3 whitespace-pre-line text-sm text-slate-800 dark:text-slate-100">{p.content}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {new Date(p.publishAtMs).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' })}
                {p.visibility === 'followers' ? ` · ${dt('Vetëm ndjekësit')}` : ''}
                {p.imageUrls.length ? ` · ${p.imageUrls.length} ${dt('foto')}` : ''}
              </p>
              <button type="button" disabled={busy === p.id} onClick={() => void cancel(p.id)} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-rose-300 px-3 py-1.5 text-xs font-black text-rose-600 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Anulo')}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { RotateCcw, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { PostApiError, purgePostApi, restoreDaysLeft, restorePostApi } from '../../lib/forumPostsApi';
import { askConfirm } from '../../lib/dialogs';

export interface DeletedPost { id: string; content: string; deletedAtMs: number | null }

interface Props {
  posts: DeletedPost[];
  onClose: () => void;
}

/**
 * The author's deleted posts. Each can be restored for 30 days after deletion, or
 * erased permanently right away. After 30 days the daily job removes it.
 */
export function DeletedPostsSheet({ posts, onClose }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (id: string, action: () => Promise<unknown>, ok: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await action();
      setGone((g) => new Set(g).add(id));
      toast.success(ok);
    } catch (error) {
      toast.error(error instanceof PostApiError ? error.message : dt('Veprimi dështoi.'));
    } finally {
      setBusy(null);
    }
  };

  const visible = posts.filter((p) => !gone.has(p.id));

  return (
    <div className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="deleted-posts-title"
        className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-zinc-900 sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <h2 id="deleted-posts-title" className="text-base font-black text-slate-900 dark:text-white">{dt('Postimet e fshira')}</h2>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="px-4 pt-3 text-xs text-slate-500 dark:text-slate-400">{dt('Mund t’i rikthesh brenda 30 ditëve nga fshirja. Pas kësaj fshihen përgjithmonë.')}</p>
        <ul className="flex-1 space-y-2 overflow-y-auto p-4">
          {visible.length === 0 && <li className="py-8 text-center text-sm text-slate-500">{dt('Nuk ka postime të fshira.')}</li>}
          {visible.map((p) => {
            const days = restoreDaysLeft(p.deletedAtMs);
            return (
              <li key={p.id} className="rounded-2xl border border-slate-200 p-3 dark:border-zinc-700">
                <p className="line-clamp-3 whitespace-pre-line text-sm text-slate-800 dark:text-slate-100">{p.content}</p>
                <p className="mt-1 text-[11px] text-slate-500">{days > 0 ? `${days} ${dt('ditë të mbetura për rikthim')}` : dt('Afati i rikthimit ka mbaruar')}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={!!busy || days === 0} onClick={() => void run(p.id, () => restorePostApi(p.id), dt('Postimi u rikthye.'))}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50">
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Rikthe')}
                  </button>
                  <button type="button" disabled={!!busy}
                    onClick={async () => { if (await askConfirm(dt('Ta fshij përgjithmonë? Nuk mund të rikthehet.'))) void run(p.id, () => purgePostApi(p.id), dt('Postimi u fshi përgjithmonë.')); }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 px-3 py-1.5 text-xs font-black text-rose-600 disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Fshi përgjithmonë')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

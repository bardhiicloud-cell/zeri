import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { reportPost } from '../../lib/debateApi';

const REASONS = [
  { id: 'spam', label: 'Spam ose reklamë e padëshiruar' },
  { id: 'abuse', label: 'Gjuhë ofenduese ose ngacmim' },
  { id: 'misinformation', label: 'Dezinformim' },
  { id: 'violence', label: 'Dhunë ose kërcënim' },
  { id: 'illegal', label: 'Përmbajtje e paligjshme' },
  { id: 'other', label: 'Tjetër' },
] as const;

/** A citizen reports a post. The Debate admin reads the reasons and decides; nothing is hidden automatically. */
export function ReportPostSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [reason, setReason] = useState<string>('spam');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    setBusy(true);
    try {
      await reportPost(postId, reason, note.trim());
      toast.success(dt('Faleminderit. Raportimi u dërgua te moderatorët.'));
      onClose();
    } catch (error: any) {
      toast.error(error?.message || dt('Raportimi nuk u dërgua.'));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={dt('Raporto postimin')} className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white"><Flag className="h-5 w-5 text-rose-600" aria-hidden="true" />{dt('Raporto postimin')}</h2>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <fieldset className="mt-3 space-y-1">
          <legend className="sr-only">{dt('Arsyeja')}</legend>
          {REASONS.map((item) => (
            <label key={item.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-zinc-800">
              <input type="radio" name="report-reason" checked={reason === item.id} onChange={() => setReason(item.id)} className="h-4 w-4" />
              {dt(item.label)}
            </label>
          ))}
        </fieldset>
        <label className="mt-3 block text-xs font-bold text-slate-600 dark:text-slate-300">
          {dt('Detaje (opsionale)')}
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={3} className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
        </label>
        <button type="button" onClick={submit} disabled={busy} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rose-600 px-4 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Flag className="h-4 w-4" aria-hidden="true" />}
          {dt('Dërgo raportimin')}
        </button>
      </div>
    </div>,
    document.body
  );
}

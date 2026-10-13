import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { PostApiError, editPostApi } from '../../lib/forumPostsApi';

const POST_MAX = 5000;

interface Props {
  postId: string;
  initialContent: string;
  onClose: () => void;
  /** Called with the saved text so the feed updates without waiting for the listener. */
  onSaved: (content: string) => void;
}

/** Edit the text of your own post. The server keeps the previous version for moderators and marks the post "edited". */
export function PostEditSheet({ postId, initialContent, onClose, onSaved }: Props) {
  const [text, setText] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.setSelectionRange(initialContent.length, initialContent.length);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving, initialContent.length]);

  const trimmed = text.trim();
  const unchanged = trimmed === initialContent.trim();
  const tooLong = trimmed.length > POST_MAX;
  const canSave = !!trimmed && !unchanged && !tooLong && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const result = await editPostApi(postId, trimmed);
      toast.success(dt('Postimi u përditësua.'));
      onSaved(result.content);
      onClose();
    } catch (error) {
      toast.error(error instanceof PostApiError ? error.message : dt('Redaktimi nuk u ruajt.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="post-edit-title"
        className="w-full max-w-lg rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-zinc-900 sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="post-edit-title" className="text-base font-black text-slate-900 dark:text-white">{dt('Redakto postimin')}</h2>
          <button type="button" onClick={onClose} disabled={saving} aria-label={dt('Mbyll')}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <textarea ref={ref} value={text} onChange={(e) => setText(e.target.value)} rows={6} disabled={saving}
          aria-label={dt('Teksti i postimit')}
          className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
        <div className="mt-1 flex justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">{dt('Postimi do të shënohet si “i redaktuar”.')}</span>
          <span className={tooLong ? 'font-bold text-rose-600' : 'text-slate-500'}>{trimmed.length}/{POST_MAX}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="flex-1 rounded-full border border-slate-300 py-2.5 text-sm font-black dark:border-zinc-700">{dt('Anulo')}</button>
          <button type="button" onClick={() => void save()} disabled={!canSave}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-blue-600 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} {dt('Ruaj')}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import type { Reel, ReelsCursor } from '../../lib/reels';
import {
  REEL_COMMENT_MAX, addReelComment, deleteReelComment, fetchReelComments, validateComment, type ReelComment,
} from '../../lib/reelsSocial';

interface Props {
  reel: Reel;
  currentUser: { id: string; name: string; avatar?: string | null } | null;
  canInteract: boolean;
  isStaff: boolean;
  onRequireAuth: () => void;
  onClose: () => void;
}

const timeAgo = (ms: number | null) => {
  if (!ms) return '';
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (minutes < 1) return dt('tani');
  if (minutes < 60) return `${minutes} ${dt('min')}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${dt('orë')}`;
  return `${Math.round(hours / 24)} ${dt('ditë')}`;
};

/** Bottom sheet on phones, side panel on desktop. Paged: 20 comments at a time. */
export function ReelCommentsSheet({ reel, currentUser, canInteract, isStaff, onRequireAuth, onClose }: Props) {
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const cursorRef = useRef<ReelsCursor>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (reset: boolean) => {
    if (reset) { cursorRef.current = null; setStatus('loading'); } else setLoadingMore(true);
    try {
      const page = await fetchReelComments(reel.id, reset ? null : cursorRef.current);
      cursorRef.current = page.cursor;
      setDone(page.done);
      setComments((prev) => {
        if (reset) return page.comments;
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...page.comments.filter((c) => !seen.has(c.id))];
      });
      setStatus('ready');
    } catch (error) {
      console.error('Komentet nuk u ngarkuan:', error);
      if (reset) setStatus('error'); else toast.error(dt('Komente të tjera nuk u ngarkuan.'));
    } finally {
      setLoadingMore(false);
    }
  }, [reel.id]);

  useEffect(() => { void load(true); }, [load]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const { error: draftError } = draft.trim() ? validateComment(draft) : { error: null };

  const send = async () => {
    if (!canInteract || !currentUser) { onRequireAuth(); return; }
    if (sending) return;
    const { error } = validateComment(draft);
    if (error) { toast.error(dt(error)); return; }
    setSending(true);
    try {
      const created = await addReelComment(reel.id, draft, currentUser);
      setComments((prev) => [created, ...prev]);
      setDraft('');
    } catch (error) {
      console.error('Komenti nuk u dërgua:', error);
      toast.error(dt('Komenti nuk u dërgua. Provoni përsëri.'));
    } finally {
      setSending(false);
    }
  };

  const remove = async (comment: ReelComment) => {
    const before = comments;
    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    try {
      await deleteReelComment(reel.id, comment.id);
    } catch (error) {
      console.error('Komenti nuk u fshi:', error);
      setComments(before);
      toast.error(dt('Komenti nuk u fshi.'));
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-stretch sm:justify-end"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="reel-comments-title"
        className="flex max-h-[75dvh] w-full max-w-md flex-col rounded-t-3xl bg-white text-slate-900 dark:bg-zinc-900 dark:text-white sm:max-h-none sm:rounded-none">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <h3 id="reel-comments-title" className="text-base font-black">{dt('Komentet')}</h3>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll komentet')}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-32 flex-1 overflow-y-auto px-4 py-2">
          {status === 'loading' && <div role="status" className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden="true" /></div>}
          {status === 'error' && (
            <div className="py-8 text-center text-sm">
              <p className="mb-3 text-slate-500">{dt('Komentet nuk u ngarkuan.')}</p>
              <button type="button" onClick={() => void load(true)} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white dark:bg-white dark:text-slate-900">{dt('Provo përsëri')}</button>
            </div>
          )}
          {status === 'ready' && comments.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{dt('Ende nuk ka komente. Bëhu i pari.')}</p>
          )}
          <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-3 py-3">
                {c.authorAvatar
                  ? <img src={c.authorAvatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                  : <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-black dark:bg-zinc-700">{c.authorName.charAt(0).toUpperCase()}</span>}
                <div className="min-w-0 flex-1">
                  <p className="text-xs"><span className="font-black">{c.authorName}</span> <span className="text-slate-400">· {timeAgo(c.createdAtMs)}</span></p>
                  {/* Plain text: React escapes it, so user markup can never run. */}
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.text}</p>
                </div>
                {(currentUser?.id === c.authorId || isStaff) && (
                  <button type="button" onClick={() => void remove(c)} aria-label={dt('Fshi komentin')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-zinc-800">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {status === 'ready' && !done && (
            <button type="button" onClick={() => void load(false)} disabled={loadingMore}
              className="my-2 w-full rounded-full border border-slate-200 py-2 text-xs font-black dark:border-zinc-700">
              {loadingMore ? dt('Po ngarkohet…') : dt('Shfaq më shumë')}
            </button>
          )}
        </div>

        <form className="flex items-end gap-2 border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-zinc-800"
          onSubmit={(e) => { e.preventDefault(); void send(); }}>
          {canInteract ? (
            <>
              <label className="flex-1">
                <span className="sr-only">{dt('Shkruaj koment')}</span>
                <textarea ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} rows={1}
                  maxLength={REEL_COMMENT_MAX + 50} placeholder={dt('Shkruaj një koment…')}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                  className="max-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800" />
                {draftError && <span className="mt-1 block text-xs text-rose-600">{dt(draftError)}</span>}
              </label>
              <button type="submit" disabled={sending || !draft.trim() || !!draftError} aria-label={dt('Dërgo komentin')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-50">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              </button>
            </>
          ) : (
            <button type="button" onClick={onRequireAuth} className="w-full rounded-full bg-blue-600 py-2.5 text-sm font-black text-white">{dt('Kyçu për të komentuar')}</button>
          )}
        </form>
      </div>
    </div>
  );
}

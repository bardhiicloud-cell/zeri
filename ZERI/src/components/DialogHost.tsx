import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, MessageSquareText } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { settleDialog, subscribeDialogs, type DialogRequest } from '../lib/dialogs';

/** Renders the confirm / reason dialogs asked for through lib/dialogs. Mounted once, in App. */
export default function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const current = queue[0];
  const currentId = current?.id;
  const currentKind = current?.kind;

  useEffect(() => subscribeDialogs(setQueue), []);
  useEffect(() => {
    setText('');
    if (!currentId) return;
    const timer = window.setTimeout(() => (currentKind === 'reason' ? inputRef.current : confirmRef.current)?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [currentId, currentKind]);

  useEffect(() => {
    if (!current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') settleDialog(current.id, current.kind === 'confirm' ? false : null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current]);

  if (!current) return null;
  const reason = current.kind === 'reason';
  const cancel = () => settleDialog(current.id, reason ? null : false);
  const ready = !reason || text.trim().length >= current.minLength;
  const accept = () => { if (ready) settleDialog(current.id, reason ? text.trim() : true); };
  const Icon = reason ? MessageSquareText : AlertTriangle;

  return (
    <div className="fixed inset-0 z-[100003] flex items-end justify-center bg-slate-950/60 p-3 sm:items-center" role="alertdialog" aria-modal="true" aria-label={dt(current.message)}>
      <button type="button" aria-label={dt('Anulo')} className="absolute inset-0 cursor-default" onClick={cancel} tabIndex={-1} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${current.danger ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="min-w-0 flex-1 pt-1 text-sm font-bold leading-relaxed text-slate-900 dark:text-white">{dt(current.message)}</p>
        </div>
        {reason && (
          <div className="mt-3">
            <textarea
              ref={inputRef}
              value={text}
              onChange={event => setText(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) accept(); }}
              rows={3}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-white/15 dark:bg-slate-800 dark:text-white"
            />
            {current.minLength > 1 && (
              <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-400">{dt('Të paktën')} {current.minLength} {dt('shenja')} ({Math.min(text.trim().length, current.minLength)}/{current.minLength})</p>
            )}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={cancel} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 dark:border-white/15 dark:text-slate-200">{dt('Anulo')}</button>
          <button
            ref={confirmRef}
            type="button"
            onClick={accept}
            disabled={!ready}
            className={`min-h-11 rounded-xl px-4 text-sm font-black text-white disabled:opacity-40 ${current.danger ? 'bg-rose-700 hover:bg-rose-800' : 'bg-blue-700 hover:bg-blue-800'}`}
          >{dt(current.confirmLabel ?? (current.danger ? 'Fshi' : 'Vazhdo'))}</button>
        </div>
      </div>
    </div>
  );
}

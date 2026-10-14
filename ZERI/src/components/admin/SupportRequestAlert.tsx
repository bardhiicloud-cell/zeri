import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { Headphones, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { db } from '../../lib/firebase';
import { normalizeSupportChat, type SupportChatRecord } from '../../lib/supportChat';
import { supportDesk } from '../../lib/supportDeskApi';

/**
 * "A citizen is asking for an agent." Shown on every support agent's screen, wherever they
 * are in the console, until one of them accepts. The first to press "Prano" gets the
 * conversation (the server decides; the others are told who took it) and the card disappears
 * for everyone because the conversation leaves the waiting queue.
 */
export function SupportRequestAlert({ onOpen }: { onOpen: (chatId: string) => void }) {
  const [waiting, setWaiting] = useState<SupportChatRecord[]>([]);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'supportChats'), where('status', '==', 'waiting_agent'), limit(20)),
      snapshot => setWaiting(snapshot.docs.map(doc => normalizeSupportChat(doc.id, doc.data()))),
      () => setWaiting([]),
    );
    return () => unsubscribe();
  }, []);

  const next = useMemo(
    () => waiting
      .filter(chat => !dismissed.has(chat.id))
      .sort((a, b) => String(a.agentRequestedAt ?? '').localeCompare(String(b.agentRequestedAt ?? '')))[0] ?? null,
    [waiting, dismissed],
  );
  if (!next) return null;
  const others = waiting.filter(chat => !dismissed.has(chat.id)).length - 1;

  const accept = async () => {
    setBusy(next.id);
    try {
      await supportDesk.accept(next.id);
      toast.success(dt('E pranuat bisedën.'));
      onOpen(next.id);
    } catch (error) {
      toast.error((error as Error).message);
      setDismissed(previous => new Set([...previous, next.id]));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div role="alertdialog" aria-live="assertive" aria-label={dt('Kërkesë për agjent')}
      className="fixed bottom-4 right-4 z-[90] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl dark:border-emerald-500/30 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <Headphones className="h-5 w-5" aria-hidden="true" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-emerald-500" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900 dark:text-white">{next.userName} {dt('kërkon një agjent')}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{next.messages.filter(m => m.role === 'user').at(-1)?.content || dt('Pa mesazh')}</p>
          {others > 0 && <p className="mt-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">+{others} {dt('të tjerë në pritje')}</p>}
        </div>
        <button type="button" onClick={() => setDismissed(previous => new Set([...previous, next.id]))} aria-label={dt('Mbyll njoftimin')} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => void accept()} disabled={busy !== null} className="min-h-10 flex-1 rounded-xl bg-emerald-600 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? dt('Duke pranuar…') : dt('Prano bisedën')}</button>
        <button type="button" onClick={() => onOpen(next.id)} className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200">{dt('Shiko')}</button>
      </div>
    </div>
  );
}

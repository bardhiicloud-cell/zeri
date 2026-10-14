import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { AlertTriangle, ArrowRight, Megaphone, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { dt } from '@/src/lib/dt';
import { cn } from '../lib/utils';
import { pickFor, type NotificationPlacement } from '../lib/notificationPlacements';

interface Broadcast {
  id: string;
  title: string;
  message: string;
  link?: string;
  urgent?: boolean;
  type?: string;
  state?: string;
  placements?: unknown;
  expiresAt?: unknown;
  createdAt?: unknown;
}

const iso = (value: unknown): string => {
  if (typeof value === 'string') return value;
  const v = value as { toDate?: () => Date } | null;
  return typeof v?.toDate === 'function' ? v.toDate().toISOString() : '';
};

/** Published broadcasts, live. Both constraints are in the query so the rules can prove the read is allowed. */
function useBroadcasts(): Broadcast[] {
  const [items, setItems] = useState<Broadcast[]>([]);
  useEffect(() => {
    const q = query(collection(db, 'notifications'), where('audience', '==', 'all'), where('state', '==', 'published'), limit(25));
    return onSnapshot(q, snap => setItems(snap.docs.map(d => ({ ...(d.data() as Broadcast), id: d.id, createdAt: iso((d.data() as Broadcast).createdAt) }))), () => setItems([]));
  }, []);
  return items;
}

const readSet = (key: string): string[] => {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as string[]; } catch { return []; }
};
const writeSet = (key: string, value: string[]) => {
  try { localStorage.setItem(key, JSON.stringify(value.slice(-50))); } catch { /* storage unavailable: shown again next visit */ }
};

function Link2({ to, children, className, onClick }: { to: string; children: React.ReactNode; className?: string; onClick?: () => void }) {
  return to.startsWith('/') ? <Link to={to} className={className} onClick={onClick}>{children}</Link> : <a href={to} className={className} onClick={onClick} rel="noreferrer">{children}</a>;
}

/** Strip under the header (placement "banner") or at the top of Lajme (placement "news"). */
export function BroadcastStrip({ placement = 'banner' }: { placement?: Extract<NotificationPlacement, 'banner' | 'news'> }) {
  const items = useBroadcasts();
  const key = `zeri_dismissed_${placement}`;
  const [dismissed, setDismissed] = useState<string[]>(() => readSet(key));
  // The news strip is pinned, not dismissible: it is the page's own notice board.
  const current = pickFor(items, placement).find(n => placement === 'news' || !dismissed.includes(n.id));
  if (!current) return null;
  return (
    <div role="status" className={cn('border-b px-4 py-2.5 text-sm', current.urgent || current.type === 'alert' ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-100' : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-100')}>
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        {current.urgent ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Megaphone className="h-4 w-4 shrink-0" aria-hidden="true" />}
        <p className="min-w-0 flex-1"><b>{current.title}</b> <span className="opacity-90">{current.message}</span></p>
        {current.link && <Link2 to={current.link} className="inline-flex shrink-0 items-center gap-1 font-bold underline">{dt('Hap')}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link2>}
        {placement === 'banner' && (
          <button type="button" aria-label={dt('Mbyll njoftimin')} onClick={() => { const next = [...dismissed, current.id]; setDismissed(next); writeSet(key, next); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/10"><X className="h-4 w-4" aria-hidden="true" /></button>
        )}
      </div>
    </div>
  );
}

/** One dialog per visitor per notification (placement "popup"). */
export function BroadcastPopup() {
  const items = useBroadcasts();
  const key = 'zeri_seen_popups';
  const [seen, setSeen] = useState<string[]>(() => readSet(key));
  const current = pickFor(items, 'popup').find(n => !seen.includes(n.id));
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = () => { if (current) { const next = [...seen, current.id]; setSeen(next); writeSet(key, next); } };
  useEffect(() => {
    if (!current) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4" onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="broadcast-title" onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white', current.urgent ? 'bg-rose-600' : 'bg-blue-700')}>{current.urgent ? <AlertTriangle className="h-5 w-5" aria-hidden="true" /> : <Megaphone className="h-5 w-5" aria-hidden="true" />}</span>
          <button ref={closeRef} type="button" aria-label={dt('Mbyll')} onClick={close} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <h2 id="broadcast-title" className="mt-3 text-xl font-black text-slate-900 dark:text-white">{current.title}</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">{current.message}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {current.link && <Link2 to={current.link} onClick={close} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white">{dt('Hap')}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link2>}
          <button type="button" onClick={close} className="min-h-11 rounded-xl px-5 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10">{dt('Mbyll')}</button>
        </div>
      </div>
    </div>
  );
}

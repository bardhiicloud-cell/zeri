import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, X } from 'lucide-react';
import { dt } from '@/src/lib/dt';

/**
 * The review desk's shared parts: the panel shell, the header with previous/next,
 * the keyboard rule, and the ready-made refusal reasons. Used by every panel where
 * one person works through a list of items and decides each one.
 */

/** "para 5 min": how long a report has been waiting, which is what an operator sorts by in their head. */
export function ago(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return '';
  const minutes = Math.max(0, Math.round((now - ms) / 60000));
  if (minutes < 1) return dt('tani');
  if (minutes < 60) return `${dt('para')} ${minutes} ${dt('min')}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${dt('para')} ${hours} ${dt('orë')}`;
  return `${dt('para')} ${Math.round(hours / 24)} ${dt('ditësh')}`;
}


export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const on = () => setMatch(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** Desk keys are for working, not for typing: they stay quiet while a field has focus. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/** Where this report sits in the list being worked through, and how to step. */
export interface DeskNav { index: number; total: number; more: boolean; onPrev?: () => void; onNext?: () => void }

export const REJECT_REASONS = [
  'Dublikat i një raporti ekzistues',
  'Nuk ka prova të mjaftueshme (foto ose përshkrim)',
  'Jashtë kompetencës së platformës',
  'Përmbajtje e papërshtatshme ose fyese',
  'Lokacioni mungon ose nuk gjendet',
];

export function Kbd({ children }: { children: string }) {
  return <kbd className="ml-1.5 hidden rounded border border-current/30 px-1 font-mono text-[10px] font-bold opacity-70 [@media(hover:hover)]:inline">{children}</kbd>;
}

/** The report's window: a side panel on a phone, the right half of the desk on a laptop. */
export function DrawerShell({ inline, onClose, children }: { inline?: boolean; onClose: () => void; children: React.ReactNode }) {
  if (inline) {
    return <section aria-label={dt('Raporti')} className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950">{children}</section>;
  }
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/40 md:backdrop-blur-sm" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={dt('Raporti')} onClick={e => e.stopPropagation()} className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950">{children}</aside>
    </div>
  );
}

export function DeskHeader({ trackingId, title, meta, nav, onClose, inline }: { trackingId: string; title: string; meta?: string; nav?: DeskNav; onClose: () => void; inline?: boolean }) {
  return (
    <header className="flex items-start gap-3 border-b border-slate-200 p-4 dark:border-white/10">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs text-slate-500">{trackingId}</p>
        <h2 className="break-words text-lg font-black leading-snug text-slate-900 dark:text-white">{title}</h2>
        {meta && <p className="mt-0.5 flex items-start gap-1.5 text-xs text-slate-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{meta}</span></p>}
      </div>
      {nav && (
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label={dt('Raporti paraprak dhe i radhës')}>
          <button type="button" onClick={nav.onPrev} disabled={!nav.onPrev} aria-label={dt('Raporti paraprak')} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
          <span className="min-w-[3.5rem] text-center text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300" aria-live="polite">{nav.index + 1} / {nav.total}{nav.more ? '+' : ''}</span>
          <button type="button" onClick={nav.onNext} disabled={!nav.onNext} aria-label={dt('Raporti i radhës')} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
        </div>
      )}
      {!inline && <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>}
    </header>
  );
}


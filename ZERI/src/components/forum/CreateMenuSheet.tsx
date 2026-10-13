import { useEffect, useRef } from 'react';
import { BarChart3, Camera, Film, PenSquare, X } from 'lucide-react';
import { dt } from '@/src/lib/dt';

export type CreateAction = 'post' | 'story' | 'reel' | 'poll';

const OPTIONS: { id: CreateAction; label: string; hint: string; icon: typeof PenSquare; tone: string }[] = [
  { id: 'post', label: 'Postim', hint: 'Tekst, foto ose citim në debat', icon: PenSquare, tone: 'bg-blue-600' },
  { id: 'story', label: 'Story', hint: 'Foto ose video për 24 orë', icon: Camera, tone: 'bg-fuchsia-600' },
  { id: 'reel', label: 'Reel', hint: 'Video vertikale deri në 90 sekonda', icon: Film, tone: 'bg-rose-600' },
  { id: 'poll', label: 'Sondazh', hint: 'Pyetje me opsione për komunitetin', icon: BarChart3, tone: 'bg-emerald-600' },
];

/** Unified "+" menu: one entry point for every kind of content. */
export function CreateMenuSheet({ onSelect, onClose, allowReels = true }: {
  onSelect: (action: CreateAction) => void;
  onClose: () => void;
  /** Admins can switch Reels off in system settings (`showReels`). */
  allowReels?: boolean;
}) {
  const options = allowReels ? OPTIONS : OPTIONS.filter((o) => o.id !== 'reel');
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/50 sm:items-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="create-menu-title"
        className="w-full max-w-md rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-zinc-900 sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="create-menu-title" className="text-base font-black text-slate-900 dark:text-white">{dt('Krijo')}</h2>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <ul className="space-y-1">
          {options.map(({ id, label, hint, icon: Icon, tone }, i) => (
            <li key={id}>
              <button ref={i === 0 ? firstRef : undefined} type="button" onClick={() => onSelect(id)}
                className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${tone}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-slate-900 dark:text-white">{dt(label)}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{dt(hint)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

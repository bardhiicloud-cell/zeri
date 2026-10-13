import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../../lib/utils';

export interface RowMenuItem {
  label: string;
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  onClick: () => void;
  /** Rendered in red and separated from the safe actions. */
  danger?: boolean;
}

/**
 * A small "more actions" menu.
 *
 * Secondary and destructive actions live here so a row shows one obvious
 * primary action instead of four equal-weight buttons. Closes on Esc, on a click
 * outside, and after an item is chosen; returns focus to its trigger.
 */
export function RowMenu({ items, label = dt(`Më shumë veprime`) }: { items: readonly RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  const safe = items.filter(item => !item.danger);
  const danger = items.filter(item => item.danger);

  const renderItem = (item: RowMenuItem) => {
    const Icon = item.icon;
    return (
      <button
        key={item.label}
        type="button"
        role="menuitem"
        onClick={() => {
          setOpen(false);
          item.onClick();
        }}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors',
          item.danger
            ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40'
            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
        )}
      >
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden={true} />}
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-white/10 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-40 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-slate-900"
        >
          {safe.map(renderItem)}
          {safe.length > 0 && danger.length > 0 && <div className="my-1 border-t border-slate-100 dark:border-white/10" />}
          {danger.map(renderItem)}
        </div>
      )}
    </div>
  );
}

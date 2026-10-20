import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../../lib/utils';
import type { AdminSection } from '../../../lib/adminPermissions';
import { moveIndex, searchSections } from '../../../lib/adminNav';
import { NAV_GROUPS, type NavSection } from './navConfig';

/**
 * "Shko te…" — jump to any admin page by typing.
 *
 * Opened with Ctrl/⌘+K (or "/"). Type a word in Albanian or English, with or
 * without accents ("shendetesia", "staff", "ankesa"); arrows move, Enter opens,
 * Esc closes. With an empty box it lists every page the viewer may open, so it
 * doubles as a flat site map.
 */
export function CommandPalette({
  open,
  onClose,
  sections,
  activeId,
  badges,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  /** Only the sections this viewer may open. */
  sections: readonly NavSection[];
  activeId: AdminSection;
  badges: Partial<Record<AdminSection, number>>;
  onSelect: (id: AdminSection) => void;
}) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const results = useMemo(() => searchSections(sections, query), [sections, query]);

  // Fresh state each time it opens; give focus back to where the person was.
  useEffect(() => {
    if (open) {
      returnFocusTo.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setHighlight(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      returnFocusTo.current?.focus?.();
      returnFocusTo.current = null;
    }
  }, [open]);

  // Typing changes the list under the highlight; start from the best match.
  useEffect(() => setHighlight(0), [query]);

  // Keep the highlighted row visible while arrowing through a long list.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlight, results]);

  if (!open) return null;

  const choose = (section: NavSection | undefined) => {
    if (!section) return;
    onSelect(section.id);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight(current => moveIndex(current, 1, results.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight(current => moveIndex(current, -1, results.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[highlight]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  const activeOptionId = results[highlight] ? `palette-option-${results[highlight].id}` : undefined;

  return (
    <div
      className="fixed inset-0 z-[600] flex items-start justify-center bg-slate-950/60 p-4 pt-[12vh] md:backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dt(`Shko te…`)}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-white/10">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={dt(`Shkruaj çfarë kërkon: raporte, staf, spitale, njoftim…`)}
            aria-label={dt(`Kërko faqe`)}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={activeOptionId}
            autoComplete="off"
            className="h-14 w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
          />
          <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] text-slate-400 sm:block dark:border-white/10">Esc</kbd>
        </div>

        <ul id="palette-results" ref={listRef} role="listbox" className="max-h-[min(24rem,55vh)] overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-slate-400">
              {dt(`Asnjë faqe nuk përputhet me`)} “{query}”.
            </li>
          ) : (
            results.map((section, index) => {
              const Icon = section.icon;
              const isHighlighted = index === highlight;
              const badge = badges[section.id] ?? 0;
              return (
                <li key={section.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    id={`palette-option-${section.id}`}
                    data-index={index}
                    aria-selected={isHighlighted}
                    onClick={() => choose(section)}
                    onMouseMove={() => setHighlight(index)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      isHighlighted ? 'bg-rose-50 dark:bg-rose-950/40' : ''
                    )}
                  >
                    <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', isHighlighted ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}>
                      <Icon className="h-4 w-4" aria-hidden={true} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-slate-900 dark:text-white">{section.label}</span>
                        {section.id === activeId && (
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{dt(`Je këtu`)}</span>
                        )}
                        {badge > 0 && (
                          <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold text-white">{badge > 99 ? '99+' : badge}</span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{section.hint}</span>
                    </span>
                    <span className="hidden shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-400 sm:block">{dt(NAV_GROUPS[section.group].label)}</span>
                    {isHighlighted && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-rose-500" aria-hidden="true" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400 dark:border-white/10 dark:bg-slate-950/40">
          <span><kbd className="font-mono">↑↓</kbd> {dt(`lëviz`)}</span>
          <span><kbd className="font-mono">Enter</kbd> {dt(`hap`)}</span>
          <span><kbd className="font-mono">Esc</kbd> {dt(`mbyll`)}</span>
        </div>
      </div>
    </div>
  );
}

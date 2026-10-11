import { dt } from '@/src/lib/dt';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, FileText, X, CornerDownLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ALL_SIDEBAR_LINKS, ALL_MUNICIPALITIES, LEGAL_NAV, TOP_NAV } from '../../lib/navigation';
import { cn } from '../../lib/utils';

const DEBOUNCE_MS = 120;

export type ResultKind = 'faqe' | 'komunë' | 'ligj';

export interface SearchResult {
  label: string;
  hint: string;
  href: string;
  kind: ResultKind;
}

const KIND_ICON: Record<ResultKind, typeof FileText> = {
  faqe: FileText,
  komunë: MapPin,
  ligj: FileText,
};

/**
 * Search state as a hook.
 *
 * This used to export a self-contained `<GlobalSearch />` — button *and* palette
 * — and the sidebar rendered a second copy. Two search fields in one layout read
 * as the same control in two places, and neither looked authoritative. The state
 * now lives here; the top bar mounts the single trigger and the palette, and
 * nothing else does.
 *
 * Cmd/Ctrl+K opens it from anywhere, which is what makes one control enough for
 * the whole platform.
 */
export function useGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Cmd on macOS, Ctrl elsewhere.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen((open) => !open);
        return;
      }
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // The input must exist before it can be focused, so defer past the mount.
      window.setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery('');
      setDebounced('');
      setHighlighted(0);
    }
  }, [isOpen]);

  /**
   * Ranking is deliberately simple and explainable: an exact prefix beats a
   * substring anywhere, and a page outranks a municipality because pages are
   * what people usually mean. A fuzzy scorer would match "prish" to Prishtinë —
   * which is nice — and also to "Print", which is not.
   */
  const results = useMemo<SearchResult[]>(() => {
    const needle = debounced.toLowerCase();
    if (!needle) {
      return ALL_SIDEBAR_LINKS.slice(0, 6).map((link) => ({
        label: link.label,
        hint: link.hint ?? '',
        href: link.href,
        kind: 'faqe' as const,
      }));
    }

    const score = (label: string, hint: string) => {
      const lower = label.toLowerCase();
      if (lower === needle) return 0;
      if (lower.startsWith(needle)) return 1;
      if (lower.includes(needle)) return 2;
      if (hint.toLowerCase().includes(needle)) return 3;
      return -1;
    };

    const pages: SearchResult[] = [...ALL_SIDEBAR_LINKS, ...TOP_NAV, ...LEGAL_NAV]
      .map((link) => ({ link, rank: score(link.label, link.hint ?? '') }))
      .filter((entry) => entry.rank >= 0)
      .sort((a, b) => a.rank - b.rank)
      .map(({ link }) => ({
        label: link.label,
        hint: link.hint ?? '',
        href: link.href,
        kind: (link.href.includes('/privatesia') || link.href.includes('/kushtet')
          ? 'ligj'
          : 'faqe') as ResultKind,
      }));

    const municipalities: SearchResult[] = ALL_MUNICIPALITIES
      .map((name) => ({ name, rank: score(name, 'Komunë') }))
      .filter((entry) => entry.rank >= 0)
      .map(({ name }) => ({
        label: name,
        hint: dt('Komunë'),
        href: `/komunat?komuna=${encodeURIComponent(name)}`,
        kind: 'komunë' as const,
      }));

    return [...pages, ...municipalities].slice(0, 10);
  }, [debounced]);

  useEffect(() => {
    setHighlighted(0);
  }, [debounced]);

  const close = useCallback(() => setIsOpen(false), []);
  const open = useCallback(() => setIsOpen(true), []);

  // Keep the highlighted row visible when arrowing through a long list.
  useEffect(() => {
    const item = listRef.current?.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  return {
    isOpen, open, close,
    query, setQuery,
    highlighted, setHighlighted,
    inputRef, listRef,
    results,
  };
}

/**
 * The palette, as a pure view over the hook's state.
 *
 * It must not call `useGlobalSearch()` itself: the hook holds `isOpen`, and a
 * second instance would never see the top bar's trigger flip it. State in, view
 * out — the top bar owns the single source of truth.
 */
export function SearchPalette({
  isOpen,
  close,
  query,
  setQuery,
  highlighted,
  setHighlighted,
  inputRef,
  listRef,
  results,
}: {
  isOpen: boolean;
  close: () => void;
  query: string;
  setQuery: (value: string) => void;
  highlighted: number;
  setHighlighted: (value: number | ((index: number) => number)) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  listRef: React.RefObject<HTMLUListElement | null>;
  results: SearchResult[];
}) {
  const navigate = useNavigate();

  const go = (result: SearchResult) => {
    close();
    navigate(result.href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((index) => (results.length ? (index + 1) % results.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((index) => (results.length ? (index - 1 + results.length) % results.length : 0));
    } else if (event.key === 'Enter' && results[highlighted]) {
      event.preventDefault();
      go(results[highlighted]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={dt('Kërko në platformë')}
          className="fixed inset-0 z-[100001] flex items-start justify-center px-4 pt-[12vh]"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: 'spring', duration: 0.28, bounce: 0 }}
            className="luxury-card relative w-full max-w-xl overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-white/5">
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={dt('Kërko faqe, komunë ose dokument...')}
                aria-label={dt('Kërko faqe, komunë ose dokument')}
                role="combobox"
                aria-expanded="true"
                aria-controls="global-search-results"
                aria-activedescendant={results[highlighted] ? `search-option-${highlighted}` : undefined}
                className="min-w-0 flex-1 bg-transparent py-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={dt('Pastro')}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {results.length > 0 ? (
              <ul
                ref={listRef}
                id="global-search-results"
                role="listbox"
                aria-label={dt('Rezultatet e kërkimit')}
                className="max-h-[52vh] overflow-y-auto p-2"
              >
                {results.map((result, index) => {
                  const Icon = KIND_ICON[result.kind];
                  return (
                    <li key={`${result.kind}-${result.href}-${result.label}`} role="none">
                      <button
                        id={`search-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={index === highlighted}
                        onClick={() => go(result)}
                        onMouseEnter={() => setHighlighted(index)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                          index === highlighted
                            ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200'
                            : 'text-slate-700 dark:text-slate-300'
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-black">{result.label}</span>
                          {result.hint && (
                            <span className="block truncate text-[10px] opacity-70">{result.hint}</span>
                          )}
                        </span>
                        {index === highlighted && (
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  {dt('Asgjë nuk u gjet.')}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {dt('Provoni me fjalë të tjera ose shfletoni faqet në sidebar.')}
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-[10px] font-bold text-slate-400 dark:border-white/5">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 px-1 py-0.5 font-mono dark:border-white/10">↑↓</kbd>
                {dt('Lëviz')}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 px-1 py-0.5 font-mono dark:border-white/10">↵</kbd>
                {dt('Hap')}
              </span>
              <span className="ml-auto flex items-center gap-1">
                <kbd className="rounded border border-slate-200 px-1 py-0.5 font-mono dark:border-white/10">Esc</kbd>
                {dt('Mbyll')}
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

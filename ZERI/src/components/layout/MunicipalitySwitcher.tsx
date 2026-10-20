import { dt } from '@/src/lib/dt';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Globe, Search, X } from 'lucide-react';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import {
  ALL_MUNICIPALITIES,
  ALL_SCOPE,
  isSpecificScope,
  searchMunicipalities,
} from '../../lib/municipalityScope';

/**
 * The global municipality scope control, pinned to the bottom of the left
 * navigation.
 *
 * Why it lives here and not in the profile menu: the profile menu is only
 * reachable when signed in, on desktop, after two clicks. A citizen who is
 * looking at the wrong municipality is, by definition, not signed in and not on
 * a large screen — and the requirement that the whole platform re-scopes from
 * one place only holds if that one place is always on screen. The footer is
 * outside the sidebar's scroll container, so this control never scrolls out of
 * view, which is also why the 38 municipalities can be offered in full here
 * rather than behind a second click.
 *
 * The list itself scrolls *inside* the popover. The navigation column never
 * grows, so nothing below it moves.
 */
export function MunicipalitySwitcher({ collapsed = false, inline = false }: { collapsed?: boolean; inline?: boolean }) {
  const userMunicipality = useStore((state) => state.userMunicipality);
  const setUserMunicipality = useStore((state) => state.setUserMunicipality);
  const currentUser = useStore((state) => state.currentUser);
  const canAccessAdmin = Boolean(currentUser && ['admin', 'superadmin'].includes(currentUser.role));

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const isScoped = isSpecificScope(userMunicipality);
  const results = useMemo(() => searchMunicipalities(query), [query]);

  // `inline` renders the 38 names directly, with no popover. The mobile sheet
  // uses that mode: a popover positioned relative to a control inside a
  // drag-transformed sheet is clipped by the sheet's own overflow, which is how
  // the list ended up half-visible behind the edge of the panel.
  const listVisible = inline || isOpen;

  // Close on any route change, otherwise the popover survives a navigation and
  // appears to belong to the page that was just left.
  useEffect(() => {
    setIsOpen(false);
  }, [userMunicipality]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !inline) searchRef.current?.focus();
    else setQuery('');
  }, [isOpen, inline]);

  const choose = (value: string) => {
    setUserMunicipality(value);
    if (!inline) setIsOpen(false);
    else setQuery('');
  };

  return (
    <div className={cn(
      'relative shrink-0',
      // The inline variant is a plain block inside the mobile sheet and must not
      // draw the sidebar's separator.
      inline
        ? 'px-0'
        : 'border-t border-slate-100 px-1.5 pb-1.5 pt-1.5 dark:border-white/5'
    )}>
      {isOpen && !inline && (
        <button
          type="button"
          aria-label={dt('Mbyll zgjedhësin e komunës')}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-30 cursor-default"
        />
      )}

      {!inline && (
        <>
          {/*
            In the 56px collapsed column the label cannot fit, so the control
            degrades to its icon. The popover is anchored to the aside and is
            therefore full width in both states, which is why the municipality
            list stays readable after the navigation has been collapsed.
          */}
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            title={isScoped ? userMunicipality : dt('Kosova — të gjitha 38 komunat')}
            aria-label={isScoped ? userMunicipality : dt('Kosova — të gjitha 38 komunat')}
            className={cn(
              'flex w-full items-center rounded-xl px-2 py-1.5 text-left transition-colors',
              collapsed ? 'justify-center' : 'gap-2',
              isScoped
                ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/40'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
          >
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                isScoped
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              )}
            >
              {isScoped ? <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Globe className="h-3.5 w-3.5" aria-hidden="true" />}
            </span>

            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-[8px] font-black uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400">
                    {dt('Komuna aktive')}
                  </span>
                  <span
                    className={cn(
                      'block truncate text-[12px] font-bold leading-tight',
                      isScoped ? 'text-blue-800 dark:text-blue-200' : 'text-slate-700 dark:text-slate-200'
                    )}
                  >
                    {isScoped ? userMunicipality : dt('Të gjitha Komunat')}
                  </span>
                </span>

                <ChevronDown
                  className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')}
                  aria-hidden="true"
                />
              </>
            )}
          </button>
        </>
      )}

      {listVisible && (
        <div
          role="listbox"
          aria-label={dt('38 komunat e Kosovës')}
          className={cn(
            'z-40 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-(--shadow-floating) dark:border-white/10 dark:bg-slate-900',
            // Inline: a normal block in the sheet's own scroll flow.
            inline
              ? 'static w-full'
              : cn(
                  'absolute',
                  // Anchored above the trigger. When collapsed the aside is only
                  // 56px wide, so the panel is pinned to the viewport instead of
                  // the column.
                  collapsed
                    ? 'fixed bottom-4 left-4 w-64'
                    : 'bottom-[calc(100%+6px)] left-1.5 right-1.5'
                )
          )}
        >
          <div className="border-b border-slate-100 p-2 dark:border-white/5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={dt('Kërko në 38 komuna...')}
                aria-label={dt('Kërko komunën')}
                className="min-h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-2 text-[12px] font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={dt('Pastro kërkimin')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/*
            The scroll lives on the list, capped by viewport height. The sidebar
            column itself never grows, which is what keeps the navigation from
            ever needing a second scrollbar.
          */}
          <ul ref={listRef} className="max-h-[min(20rem,45dvh)] overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin]">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!isScoped}
                onClick={() => choose(ALL_SCOPE)}
                className={cn(
                  'flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[12px] font-bold transition-colors',
                  !isScoped
                    ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                )}
              >
                <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">{dt('Kosova (të gjitha 38 komunat)')}</span>
                {!isScoped && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              </button>
            </li>

            {results.map((name) => {
              const active = name === userMunicipality;
              return (
                <li key={name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => choose(name)}
                    className={cn(
                      'flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[12px] font-semibold transition-colors',
                      active
                        ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                    )}
                  >
                    <span className="min-w-[2.25rem] shrink-0 text-[10px] font-black text-slate-400">
                      {ALL_MUNICIPALITIES.indexOf(name) + 1}
                    </span>
                    <span className="flex-1 truncate">{name}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}

            {results.length === 0 && (
              <li className="px-2.5 py-4 text-center text-[11px] font-semibold text-slate-400">
                {dt('Nuk u gjet asnjë komunë.')}
              </li>
            )}
          </ul>

          {canAccessAdmin && (
            <p className="border-t border-slate-100 px-2.5 py-1.5 text-[9px] leading-tight text-slate-400 dark:border-white/5">
              {dt('Si administrator, kjo pamje përshtatet edhe panelit dhe statistikave.')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

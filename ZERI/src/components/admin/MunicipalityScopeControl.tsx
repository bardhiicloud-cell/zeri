import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Globe, Search } from 'lucide-react';
import { useStore } from '../../lib/store';
import { ALL_MUNICIPALITIES, ALL_SCOPE, isSpecificScope, searchMunicipalities } from '../../lib/municipalityScope';
import { cn } from '../../lib/utils';

/**
 * The administrator's municipality scope, pinned to the admin header.
 *
 * The panel is a separate route with its own chrome, so the sidebar's scope
 * switcher is not on screen while an administrator is inside it. Two
 * consequences that this control removes:
 *
 *   • Every section read a different notion of "current municipality", and some
 *     read none at all, so a supervisor could approve a Prizren case believing
 *     they were working through the Prishtinë queue.
 *   • The scope is stored globally, so whatever an administrator last picked
 *     here also silently re-filtered the public site for them.
 *
 * Both are now one state, written in one place, and stated in the header of
 * every section.
 */
export function MunicipalityScopeControl() {
  const userMunicipality = useStore((state) => state.userMunicipality);
  const setUserMunicipality = useStore((state) => state.setUserMunicipality);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const isScoped = isSpecificScope(userMunicipality);
  const results = useMemo(() => searchMunicipalities(query), [query]);

  useEffect(() => {
    if (isOpen) searchRef.current?.focus();
    else setQuery('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const choose = (value: string) => {
    setUserMunicipality(value);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {isOpen && (
        <button
          type="button"
          aria-label="Mbyll"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-30 cursor-default"
        />
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          'flex min-h-10 items-center gap-2 rounded-xl border px-3 text-left transition-colors',
          isScoped
            ? 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-950/30'
            : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800'
        )}
      >
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
            isScoped ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          )}
        >
          {isScoped ? <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Globe className="h-3.5 w-3.5" aria-hidden="true" />}
        </span>
        <span className="hidden min-w-0 flex-col sm:flex">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Kufizimi</span>
          <span
            className={cn(
              'max-w-[10rem] truncate text-xs font-black',
              isScoped ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'
            )}
          >
            {isScoped ? userMunicipality : 'Të 38 komunat'}
          </span>
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Komuna aktive e administrimit"
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
        >
          <div className="border-b border-slate-100 p-2 dark:border-white/5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Kërko në 38 komuna…"
                aria-label="Kërko komunën"
                className="min-h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-2 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <ul className="max-h-[min(20rem,50dvh)] overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin]">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!isScoped}
                onClick={() => choose(ALL_SCOPE)}
                className={cn(
                  'flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-bold transition-colors',
                  !isScoped
                    ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                )}
              >
                <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">Kosova — të gjitha 38 komunat</span>
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
                      'flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-semibold transition-colors',
                      active
                        ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                    )}
                  >
                    <span className="min-w-[2rem] shrink-0 text-[11px] font-black text-slate-400">
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
                Nuk u gjet asnjë komunë.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

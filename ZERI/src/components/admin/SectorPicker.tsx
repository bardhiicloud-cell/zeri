import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { SECTOR_OPTIONS, searchSectors } from '../../lib/sectorSearch';

/**
 * Pick the sector of a report by typing what the problem is about. Each result shows
 * who answers it, so the choice and the responsible body are decided together.
 */
export interface SectorPickerProps {
  value: string;
  onChange: (id: string) => void;
  /** First option, for "leave as is" in a bulk edit. Omit for a plain required choice. */
  emptyLabel?: string;
  className?: string;
}

export default function SectorPicker({ value, onChange, emptyLabel, className }: SectorPickerProps) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const selected = SECTOR_OPTIONS.find(option => option.id === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const results = useMemo(() => searchSectors(query), [query]);
  const text = open ? query : selected ? `${selected.icon} ${selected.label}` : emptyLabel ?? '';

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (id: string) => { onChange(id); setOpen(false); setQuery(''); };

  return (
    <div ref={root} className={cn('relative', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={dt('Sektori / Ministria')}
          value={text}
          placeholder={dt('Kërko problemin ose sektorin…')}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={event => { setOpen(true); setQuery(event.target.value); }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, results.length - 1)); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
            else if (event.key === 'Enter' && open && results[active]) { event.preventDefault(); choose(results[active].id); }
            else if (event.key === 'Escape') { setOpen(false); }
          }}
          className="min-h-10 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-slate-900">
          {emptyLabel && !query && (
            <li role="option" aria-selected={!value} onMouseDown={event => { event.preventDefault(); choose(''); }} className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5">
              {emptyLabel}
            </li>
          )}
          {results.length === 0 && <li className="px-2.5 py-3 text-sm text-slate-500">{dt('Nuk u gjet asnjë sektor.')}</li>}
          {results.map((option, index) => (
            <li
              key={option.id}
              role="option"
              aria-selected={option.id === value}
              onMouseDown={event => { event.preventDefault(); choose(option.id); }}
              onMouseEnter={() => setActive(index)}
              className={cn('cursor-pointer rounded-lg px-2.5 py-2', index === active && 'bg-blue-50 dark:bg-blue-500/15', option.id === value && 'font-bold')}
            >
              <span className="block text-sm text-slate-900 dark:text-white">{option.icon} {option.label}</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">{option.answers}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

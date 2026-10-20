import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ContactRound, Cpu, Download, LayoutGrid, List, SlidersHorizontal, X, Search } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../../lib/utils';
import { STATUS_TABS, activeFilterCount, type QueueFilters, type TimeKey } from '../../../lib/reportQueue';
import type { Figure } from '../dashboard/DashboardParts';

/**
 * The reports queue controls, in the order a person uses them:
 *   1. search            – find a specific report
 *   2. status tabs       – "what state is it in", with live counts
 *   3. Filtra            – the rarer filters (topic, period), behind one button
 *   4. view / export     – how to look at it, and how to take it away
 *
 * This replaces seven large stat tiles, a status dropdown that duplicated them,
 * and five always-open selects, which together pushed the first report below the
 * fold on a laptop screen.
 */

const TIME_LABELS: Record<TimeKey, string> = {
  all: 'Çdo kohë',
  daily: 'Sot',
  weekly: '7 ditët e fundit',
  monthly: 'Muaji i fundit',
};

const FIELD =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 dark:border-white/10 dark:bg-slate-800 dark:text-white';

function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close, ref]);
}

function countText(figure: Figure | undefined): string {
  if (!figure || figure.value === null) return '';
  return `${figure.atLeast && figure.value > 0 ? '≥ ' : ''}${figure.value.toLocaleString('sq')}`;
}

export interface ReportsToolbarProps {
  filters: QueueFilters;
  onChange: (patch: Partial<QueueFilters>) => void;
  onClear: () => void;
  /** Count per status-tab key. Missing means "not available", shown as nothing. */
  tabCounts: Record<string, Figure>;
  topics: ReadonlyArray<{ id: string; label: string }>;
  /** The header's municipality scope, when one is chosen. */
  scopeName: string | null;
  view: 'list' | 'board';
  onView: (view: 'list' | 'board') => void;
  onExport: (format: 'html' | 'csv' | 'pdf') => void;
  onSummary: () => void;
  contactsCount: number;
  contactsOpen: boolean;
  onToggleContacts: () => void;
}

export function ReportsToolbar({
  filters,
  onChange,
  onClear,
  tabCounts,
  topics,
  scopeName,
  view,
  onView,
  onExport,
  onSummary,
  contactsCount,
  contactsOpen,
  onToggleContacts,
}: ReportsToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  useDismiss(filtersOpen, () => setFiltersOpen(false), filtersRef);
  useDismiss(exportOpen, () => setExportOpen(false), exportRef);

  const extra = activeFilterCount(filters);
  const topicLabel = topics.find(topic => topic.id === filters.topic)?.label;
  const hasAnyFilter = Boolean(filters.query || filters.status || extra);

  return (
    <div className="space-y-3 border-b border-slate-100 p-3 sm:p-4 dark:border-white/10">
      {/* Row 1: search + actions */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={filters.query}
            onChange={event => onChange({ query: event.target.value })}
            placeholder={dt(`Kërko sipas titullit, adresës, komunës ose kodit…`)}
            aria-label={dt(`Kërko raporte`)}
            className={cn(FIELD, 'pl-9')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filters */}
          <div ref={filtersRef} className="relative">
            <button
              type="button"
              onClick={() => setFiltersOpen(open => !open)}
              aria-expanded={filtersOpen}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition-colors',
                extra > 0
                  ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-300'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {dt(`Filtra`)}
              {extra > 0 && <span className="rounded-full bg-rose-600 px-1.5 text-[11px] text-white">{extra}</span>}
            </button>
            {filtersOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-72 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-slate-900">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-slate-400">{dt(`Tema`)}</span>
                  <select value={filters.topic} onChange={event => onChange({ topic: event.target.value })} className={FIELD}>
                    <option value="">{dt(`Të gjitha temat`)}</option>
                    {topics.map(topic => (
                      <option key={topic.id} value={topic.id}>{topic.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-slate-400">{dt(`Periudha`)}</span>
                  <select value={filters.time} onChange={event => onChange({ time: event.target.value as TimeKey })} className={FIELD}>
                    {(Object.keys(TIME_LABELS) as TimeKey[]).map(key => (
                      <option key={key} value={key}>{dt(TIME_LABELS[key])}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => onChange({ topic: '', time: 'all' })}
                  disabled={extra === 0}
                  className="w-full rounded-lg border border-slate-200 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {dt(`Pastro filtrat`)}
                </button>
              </div>
            )}
          </div>

          {/* View */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10" role="group" aria-label={dt(`Pamja`)}>
            {([
              ['list', List, dt(`Lista`)],
              ['board', LayoutGrid, dt(`Bordi`)],
            ] as const).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onView(key)}
                aria-pressed={view === key}
                title={label}
                aria-label={label}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-md transition-colors',
                  view === key ? 'bg-slate-900 text-white dark:bg-rose-600' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden={true} />
              </button>
            ))}
          </div>

          {/* Export */}
          <div ref={exportRef} className="relative">
            <button
              type="button"
              onClick={() => setExportOpen(open => !open)}
              aria-expanded={exportOpen}
              aria-haspopup="menu"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {dt(`Eksporto`)}
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            {exportOpen && (
              <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-40 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-slate-900">
                {([
                  ['csv', 'CSV', dt(`Për Excel`)],
                  ['pdf', 'PDF', dt(`Për shtyp`)],
                  ['html', 'HTML', dt(`Faqe e ruajtur`)],
                ] as const).map(([format, label, note]) => (
                  <button
                    key={format}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setExportOpen(false);
                      onExport(format);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span>{label}</span>
                    <span className="text-[11px] font-medium text-slate-400">{note}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onSummary}
            title={dt(`Gjenero përmbledhje ekzekutive me AI`)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Cpu className="h-4 w-4 text-rose-500" aria-hidden="true" />
            <span className="hidden xl:inline">{dt(`Përmbledh me AI`)}</span>
            <span className="xl:hidden">AI</span>
          </button>

          <button
            type="button"
            onClick={onToggleContacts}
            aria-expanded={contactsOpen}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition-colors',
              contactsOpen
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-400/40 dark:bg-indigo-400/10 dark:text-indigo-200'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800'
            )}
          >
            <ContactRound className="h-4 w-4" aria-hidden="true" />
            {dt(`Kontaktet`)} ({contactsCount})
          </button>
        </div>
      </div>

      {/* Row 2: status tabs */}
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label={dt(`Statusi i raporteve`)}>
        {STATUS_TABS.map(tab => {
          const active = filters.status === tab.key;
          const count = countText(tabCounts[tab.key]);
          return (
            <button
              key={tab.key || 'all'}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange({ status: tab.key })}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors',
                active
                  ? 'bg-slate-900 text-white dark:bg-rose-600'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              {dt(tab.label)}
              {count && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active filter chips */}
      {(scopeName || extra > 0 || hasAnyFilter) && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {scopeName && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
              title={dt(`Ndryshohet nga kufizimi lart djathtas`)}
            >
              {dt(`Komuna`)}: {scopeName}
            </span>
          )}
          {topicLabel && (
            <button type="button" onClick={() => onChange({ topic: '' })} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">
              {dt(`Tema`)}: {topicLabel} <X className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">{dt(`Hiq filtrin`)}</span>
            </button>
          )}
          {filters.time !== 'all' && (
            <button type="button" onClick={() => onChange({ time: 'all' })} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">
              {dt(TIME_LABELS[filters.time])} <X className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">{dt(`Hiq filtrin`)}</span>
            </button>
          )}
          {hasAnyFilter && (
            <button type="button" onClick={onClear} className="font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400">
              {dt(`Pastro të gjitha`)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

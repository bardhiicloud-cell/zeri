import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, MapPin, SlidersHorizontal, X } from 'lucide-react';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/LanguageContext';
import { getReportTopicValueLabel, REPORT_TOPICS } from '../../lib/reportTopics';

export type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';
export type RegistryStatus = 'all' | 'open' | 'resolved' | 'critical';
export type RegistrySortKey = 'recent' | 'oldest' | 'voted';

interface AdvancedFilterDrawerProps {
  isOpen: boolean;
  selectedMunicipality: string;
  selectedTopic: string;
  dateFrom: string;
  dateTo: string;
  datePreset: DatePreset;
  status: RegistryStatus;
  sort: RegistrySortKey;
  /** Reports that match the filters right now, shown on the apply button. */
  resultCount: number;
  onMunicipalityChange: (value: string) => void;
  onTopicChange: (value: string) => void;
  onDatePresetChange: (value: DatePreset) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onStatusChange: (value: RegistryStatus) => void;
  onSortChange: (value: RegistrySortKey) => void;
  onReset: () => void;
  onClose: () => void;
}

const datePresets: Array<{ key: DatePreset; label: string }> = [
  { key: 'all', label: 'Gjithë kohën' },
  { key: 'today', label: 'Sot' },
  { key: 'week', label: '7 ditë' },
  { key: 'month', label: '30 ditë' },
];

const statusOptions: Array<{ key: RegistryStatus; label: string }> = [
  { key: 'all', label: 'Të gjitha' },
  { key: 'open', label: 'Në proces' },
  { key: 'resolved', label: 'Të zgjidhura' },
  { key: 'critical', label: 'Kritike' },
];

const sortOptions: Array<{ key: RegistrySortKey; label: string }> = [
  { key: 'recent', label: 'Më të rejat' },
  { key: 'oldest', label: 'Më të vjetrat' },
  { key: 'voted', label: 'Më të mbështetura' },
];

const field = 'min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-b border-slate-100 pb-6 last:border-b-0 last:pb-0 dark:border-white/10">
      <legend className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{title}</legend>
      {children}
    </fieldset>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ key: T; label: string }>; onChange: (value: T) => void; label: string }) {
  const { dt } = useLanguage();
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {options.map(option => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.key)}
            className={cn('min-h-10 rounded-lg px-2 text-xs font-black transition', active ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-950 dark:text-blue-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white')}
          >
            {dt(option.label)}
          </button>
        );
      })}
    </div>
  );
}

/** Slide-over filter panel: the same on every screen, so filtering always feels the same. */
export function AdvancedFilterDrawer({
  isOpen, selectedMunicipality, selectedTopic, dateFrom, dateTo, datePreset, status, sort, resultCount,
  onMunicipalityChange, onTopicChange, onDatePresetChange, onDateFromChange, onDateToChange, onStatusChange, onSortChange, onReset, onClose,
}: AdvancedFilterDrawerProps) {
  const { t, dt } = useLanguage();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label={dt('Mbyll filtrat')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] cursor-default bg-slate-950/40 backdrop-blur-[2px]"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="advanced-filter-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-y-0 right-0 z-[100] flex w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900 sm:rounded-l-3xl"
          >
            <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-white/10">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300"><SlidersHorizontal className="h-5 w-5" aria-hidden="true" /></span>
                <h2 id="advanced-filter-title" className="text-lg font-black tracking-tight text-slate-950 dark:text-white">{dt('Filtra të avancuar')}</h2>
              </div>
              <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" aria-label={dt('Mbyll filtrat')}>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-6">
              <Group title={dt('Statusi')}>
                <Segmented value={status} options={statusOptions} onChange={onStatusChange} label={dt('Statusi')} />
              </Group>

              <Group title={dt('Renditja')}>
                <div role="radiogroup" aria-label={dt('Renditja')} className="space-y-1">
                  {sortOptions.map(option => {
                    const active = sort === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onSortChange(option.key)}
                        className={cn('flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-bold transition', active ? 'bg-blue-50 text-blue-800 dark:bg-blue-400/10 dark:text-blue-200' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800')}
                      >
                        {dt(option.label)}
                        <span className={cn('grid h-5 w-5 place-items-center rounded-full border-2', active ? 'border-blue-700 dark:border-blue-300' : 'border-slate-300 dark:border-slate-600')} aria-hidden="true">
                          {active && <span className="h-2.5 w-2.5 rounded-full bg-blue-700 dark:bg-blue-300" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Group>

              <Group title={dt('Komuna')}>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                  <select value={selectedMunicipality} onChange={event => onMunicipalityChange(event.target.value)} className={cn(field, 'pl-10')} aria-label={dt('Filtro sipas komunës')}>
                    <option value="">{t('dash_all_mun')}</option>
                    {KOSOVO_MUNICIPALITIES.map(municipality => <option key={municipality} value={municipality}>{municipality}</option>)}
                  </select>
                </div>
              </Group>

              <Group title={dt('Tema e raportimit')}>
                <div className="flex flex-wrap gap-2">
                  <button type="button" aria-pressed={selectedTopic === ''} onClick={() => onTopicChange('')}
                    className={cn('min-h-9 rounded-full border px-3.5 text-xs font-black transition', selectedTopic === '' ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300')}>
                    {dt('Të gjitha')}
                  </button>
                  {REPORT_TOPICS.map(topic => {
                    const active = selectedTopic === topic.id;
                    return (
                      <button key={topic.id} type="button" aria-pressed={active} onClick={() => onTopicChange(active ? '' : topic.id)}
                        className={cn('min-h-9 rounded-full border px-3.5 text-xs font-black transition', active ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300')}>
                        {getReportTopicValueLabel(topic.id)}
                      </button>
                    );
                  })}
                </div>
              </Group>

              <Group title={dt('Periudha')}>
                <Segmented value={datePreset === 'custom' ? ('' as DatePreset) : datePreset} options={datePresets} onChange={onDatePresetChange} label={dt('Periudha')} />
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1.5 text-[11px] font-bold text-slate-500">
                    <span>{dt('Nga data')}</span>
                    <span className="relative block">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                      <input type="date" value={dateFrom} onChange={event => onDateFromChange(event.target.value)} className={cn(field, 'pl-9 pr-2 text-xs')} />
                    </span>
                  </label>
                  <label className="space-y-1.5 text-[11px] font-bold text-slate-500">
                    <span>{dt('Deri më datë')}</span>
                    <span className="relative block">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                      <input type="date" value={dateTo} onChange={event => onDateToChange(event.target.value)} className={cn(field, 'pl-9 pr-2 text-xs')} />
                    </span>
                  </label>
                </div>
              </Group>
            </div>

            <footer className="flex gap-3 border-t border-slate-100 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
              <button type="button" onClick={onReset} className="min-h-12 rounded-xl border border-slate-200 px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800">{dt('Pastro')}</button>
              <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-xl bg-blue-700 px-5 text-sm font-black text-white transition hover:bg-blue-800">
                {dt('Shfaq')} {resultCount.toLocaleString('sq-AL')} {dt('raportime')}
              </button>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

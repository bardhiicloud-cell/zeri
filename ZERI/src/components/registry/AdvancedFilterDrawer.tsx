import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, MapPin, SlidersHorizontal, X } from 'lucide-react';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/LanguageContext';
import { getReportTopicValueLabel, REPORT_TOPICS } from '../../lib/reportTopics';

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';
type RegistrySort = 'dash_all' | 'dash_recent' | 'dash_most_voted' | 'dash_critical' | 'dash_resolved';

interface AdvancedFilterDrawerProps {
  isOpen: boolean;
  selectedMunicipality: string;
  selectedTopic: string;
  dateFrom: string;
  dateTo: string;
  datePreset: DatePreset;
  activeTab: RegistrySort;
  onMunicipalityChange: (value: string) => void;
  onTopicChange: (value: string) => void;
  onDatePresetChange: (value: DatePreset) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSortChange: (value: RegistrySort) => void;
  onReset: () => void;
  onClose: () => void;
}

const datePresets: Array<{ key: DatePreset; label: string }> = [
  { key: 'all', label: 'Gjithë kohën' },
  { key: 'today', label: 'Sot' },
  { key: 'week', label: '7 ditë' },
  { key: 'month', label: '30 ditë' },
];

const sortOptions: Array<{ key: RegistrySort; label: string }> = [
  { key: 'dash_all', label: 'Të gjitha' },
  { key: 'dash_recent', label: 'Së fundmi' },
  { key: 'dash_most_voted', label: 'Më të votuarat' },
  { key: 'dash_critical', label: 'Kritike' },
  { key: 'dash_resolved', label: 'Të zgjidhura' },
];

export function AdvancedFilterDrawer({
  isOpen,
  selectedMunicipality,
  selectedTopic,
  dateFrom,
  dateTo,
  datePreset,
  activeTab,
  onMunicipalityChange,
  onTopicChange,
  onDatePresetChange,
  onDateFromChange,
  onDateToChange,
  onSortChange,
  onReset,
  onClose,
}: AdvancedFilterDrawerProps) {
  const { t, dt } = useLanguage();

  const handlePresetChange = (preset: DatePreset) => {
    onDatePresetChange(preset);
  };

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
            className="fixed inset-0 z-[90] cursor-default bg-slate-950/30 md:backdrop-blur-[2px] lg:hidden"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="advanced-filter-title"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-y-0 right-0 z-[100] flex w-full max-w-sm flex-col overflow-y-auto border-l border-(--color-border-soft) bg-(--color-surface) p-5 shadow-(--shadow-floating) dark:border-white/10 dark:bg-slate-900 lg:static lg:mt-4 lg:w-full lg:max-w-none lg:rounded-2xl lg:border lg:p-5 lg:shadow-sm"
          >
            <div className="flex items-start justify-between gap-4 border-b border-(--color-border-soft) pb-4 dark:border-white/10">
              <div>
                <div className="flex items-center gap-2 text-(--color-brand-primary)">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  <p className="text-[10px] font-black uppercase tracking-[0.16em]">{dt('Mjet kërkimi')}</p>
                </div>
                <h2 id="advanced-filter-title" className="mt-1 text-lg font-black tracking-tight text-(--color-text) dark:text-white">{dt('Filtra të avancuar')}</h2>
              </div>
              <button type="button" onClick={onClose} className="grid min-h-10 min-w-10 place-items-center rounded-[10px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" aria-label={dt('Mbyll filtrat')}>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-5 py-5">
              <fieldset className="space-y-2">
                <legend className="text-xs font-black text-(--color-text) dark:text-white">{dt('Komuna')}</legend>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-brand-primary)" aria-hidden="true" />
                  <select
                    value={selectedMunicipality}
                    onChange={(event) => onMunicipalityChange(event.target.value)}
                    className="min-h-11 w-full appearance-none rounded-[10px] border border-(--color-border-soft) bg-(--color-surface-subtle) pl-10 pr-3 text-sm font-bold text-(--color-text) outline-none transition focus:border-(--color-brand-primary) focus:ring-2 focus:ring-(--color-brand-primary)/15 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    aria-label={dt('Filtro sipas komunës')}
                  >
                    <option value="">{t('dash_all_mun')}</option>
                    {KOSOVO_MUNICIPALITIES.map((municipality) => <option key={municipality} value={municipality}>{municipality}</option>)}
                  </select>
                </div>
              </fieldset>

              <fieldset className="space-y-2 border-t border-(--color-border-soft) pt-5 dark:border-white/10">
                <legend className="text-xs font-black text-(--color-text) dark:text-white">{dt('Tema e raportimit')}</legend>
                <select
                  value={selectedTopic}
                  onChange={event => onTopicChange(event.target.value)}
                  className="min-h-11 w-full rounded-[10px] border border-(--color-border-soft) bg-(--color-surface-subtle) px-3 text-sm font-bold text-(--color-text) outline-none transition focus:border-(--color-brand-primary) focus:ring-2 focus:ring-(--color-brand-primary)/15 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                  aria-label={dt('Filtro sipas temës')}
                >
                  <option value="">{dt('Të gjitha temat')}</option>
                  {REPORT_TOPICS.map(topic => <option key={topic.id} value={topic.id}>{getReportTopicValueLabel(topic.id)}</option>)}
                </select>
              </fieldset>

              <fieldset className="space-y-3 border-t border-(--color-border-soft) pt-5 dark:border-white/10">
                <legend className="text-xs font-black text-(--color-text) dark:text-white">{dt('Periudha')}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {datePresets.map((preset) => (
                    <button
                      type="button"
                      key={preset.key}
                      aria-pressed={datePreset === preset.key}
                      onClick={() => handlePresetChange(preset.key)}
                      className={cn(
                        'min-h-9 rounded-lg border px-2.5 text-[11px] font-bold transition-colors',
                        datePreset === preset.key
                          ? 'border-(--color-brand-primary) bg-(--color-surface-subtle) text-(--color-brand-primary)'
                          : 'border-(--color-border-soft) bg-(--color-surface) text-slate-600 hover:bg-(--color-surface-subtle) dark:border-white/10 dark:bg-slate-800 dark:text-slate-300'
                      )}
                    >
                      {dt(preset.label)}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>{dt('Nga data')}</span>
                    <span className="relative block">
                      <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                      <input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} className="min-h-10 w-full rounded-lg border border-(--color-border-soft) bg-(--color-surface-subtle) pl-8 pr-1 text-xs font-semibold text-(--color-text) outline-none focus:border-(--color-brand-primary) dark:border-white/10 dark:bg-slate-800 dark:text-white" />
                    </span>
                  </label>
                  <label className="space-y-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>{dt('Deri më datë')}</span>
                    <span className="relative block">
                      <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                      <input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} className="min-h-10 w-full rounded-lg border border-(--color-border-soft) bg-(--color-surface-subtle) pl-8 pr-1 text-xs font-semibold text-(--color-text) outline-none focus:border-(--color-brand-primary) dark:border-white/10 dark:bg-slate-800 dark:text-white" />
                    </span>
                  </label>
                </div>
              </fieldset>

              <fieldset className="space-y-2 border-t border-(--color-border-soft) pt-5 dark:border-white/10">
                <legend className="text-xs font-black text-(--color-text) dark:text-white">{dt('Renditja dhe statusi')}</legend>
                <div className="space-y-1">
                  {sortOptions.map((option) => (
                    <button
                      type="button"
                      key={option.key}
                      aria-pressed={activeTab === option.key}
                      onClick={() => onSortChange(option.key)}
                      className={cn(
                        'flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm font-bold transition-colors',
                        activeTab === option.key
                          ? 'bg-(--color-surface-subtle) text-(--color-brand-primary)'
                          : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                      )}
                    >
                      <span>{dt(option.label)}</span>
                      {activeTab === option.key && <span className="h-2 w-2 rounded-full bg-(--color-brand-primary)" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="mt-auto flex flex-col gap-2 border-t border-(--color-border-soft) pt-4 dark:border-white/10">
              <button type="button" onClick={onReset} className="min-h-11 rounded-[10px] border border-(--color-border-soft) px-4 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800">{dt('Pastro filtrat')}</button>
              <button type="button" onClick={onClose} className="min-h-11 rounded-[10px] bg-(--color-brand-primary) px-4 text-sm font-black text-white transition-colors hover:bg-(--color-brand-primary-hover) lg:hidden">{dt('Shfaq raportimet')}</button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

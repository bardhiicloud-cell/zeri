import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../lib/store';
import { isSpecificScope, scopeKey } from '../lib/municipalityScope';
import { useLanguage } from '../lib/LanguageContext';
import { format } from 'date-fns';
import { sq } from 'date-fns/locale';
import { Filter, Search, ChevronLeft, ChevronRight, SlidersHorizontal, X, Download, WifiOff, FilePlus2, RefreshCw, ShieldCheck, Clock, CheckSquare } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import { cn } from '../lib/utils';
import ReportDetailModal from '../components/ReportDetailModal.tsx';

import { StatePanel } from '../components/ui/StatePanel.tsx';
import AdBanner from '../components/AdBanner.tsx';
import { AdvancedFilterDrawer } from '../components/registry/AdvancedFilterDrawer.tsx';
import { FilterChip } from '../components/registry/FilterChip';
import { RegistryRow } from '../components/registry/RegistryRow';
import { getReportTopic, getReportTopicLabel, REPORT_TOPICS } from '../lib/reportTopics';

import { dt } from '@/src/lib/dt';
const ITEMS_PER_PAGE = 5;

export default function DetailedRegistryPage() {
  const { dt } = useLanguage();
  const reports = useStore(state => state.reports);
  const reportsStatus = useStore(state => state.reportsStatus);
  const reportsError = useStore(state => state.reportsError);
  const userMunicipality = useStore(state => state.userMunicipality);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedTopic, setSelectedTopic] = useState('');
  /**
   * A deep link that names a municipality wins, and it also *sets* the global
   * scope rather than keeping a private copy. Before, `?municipality=Gjilan`
   * produced a registry filtered to Gjilan while the sidebar, the map and the
   * forum still showed Prishtinë — a link that silently disagreed with the rest
   * of the platform.
   */
  const [selectedMunicipality, setSelectedMunicipality] = useState(() =>
    isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : ''
  );
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [activeTab, setActiveTab] = useState(searchParams.get('status') || 'dash_all');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const setUserMunicipality = useStore((state) => state.setUserMunicipality);

  useEffect(() => {
    const routeMunicipality = searchParams.get('municipality') || '';
    if (routeMunicipality) {
      setUserMunicipality(routeMunicipality);
      setSelectedMunicipality(scopeKey(routeMunicipality));
    } else {
      setSelectedMunicipality(isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : '');
    }
    setCurrentPage(1);
  }, [userMunicipality, searchParams, setUserMunicipality]);

  const handleDownloadCSV = () => {
    const headers = ['ID', 'Tema', 'Sektori / institucioni', 'Komuna', 'Lagjja', 'Adresa', 'Statusi', 'Data e Krijimit', 'Pëlqime'];
    const csvRows = [headers.join(',')];

    filteredReports.forEach(r => {
      const row = [
        r.id,
        getReportTopicLabel(r),
        r.category,
        r.location?.municipality || '',
        '', // Neighborhood placeholder
        `"${(r.location?.address || '').replace(/"/g, '""')}"`,
        r.status,
        format(new Date(r.createdAt), 'dd.MM.yyyy', { locale: sq }),
        r.upvotes
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Regjistri_Raportimeve_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const applyDatePreset = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    if (preset === 'today') {
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setDateFrom(`${yyyy}-${mm}-${dd}`);
      setDateTo(`${yyyy}-${mm}-${dd}`);
    } else if (preset === 'week') {
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 7);
      const yyyyF = lastWeek.getFullYear();
      const mmF = String(lastWeek.getMonth() + 1).padStart(2, '0');
      const ddF = String(lastWeek.getDate()).padStart(2, '0');

      const yyyyT = today.getFullYear();
      const mmT = String(today.getMonth() + 1).padStart(2, '0');
      const ddT = String(today.getDate()).padStart(2, '0');

      setDateFrom(`${yyyyF}-${mmF}-${ddF}`);
      setDateTo(`${yyyyT}-${mmT}-${ddT}`);
    } else if (preset === 'month') {
      const lastMonth = new Date();
      lastMonth.setDate(today.getDate() - 30);
      const yyyyF = lastMonth.getFullYear();
      const mmF = String(lastMonth.getMonth() + 1).padStart(2, '0');
      const ddF = String(lastMonth.getDate()).padStart(2, '0');

      const yyyyT = today.getFullYear();
      const mmT = String(today.getMonth() + 1).padStart(2, '0');
      const ddT = String(today.getDate()).padStart(2, '0');

      setDateFrom(`${yyyyF}-${mmF}-${ddF}`);
      setDateTo(`${yyyyT}-${mmT}-${ddT}`);
    } else {
      setDateFrom('');
      setDateTo('');
    }
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedTopic('');
    setSelectedMunicipality('');
    setDateFrom('');
    setDateTo('');
    setDatePreset('all');
    setActiveTab('dash_all');
    setCurrentPage(1);
    setIsFilterDrawerOpen(false);
  };

  const applyDatePresetAndResetPage = (preset: 'all' | 'today' | 'week' | 'month' | 'custom') => {
    if (preset === 'custom') {
      setDatePreset('custom');
      setCurrentPage(1);
      return;
    }
    applyDatePreset(preset);
  };

  useEffect(() => {
    const rId = searchParams.get('report');
    if (rId) {
      setSelectedReportId(rId);
    }
  }, [searchParams]);

  // Filter for visibility
  const visibleReports = reports.filter(r => {
    if (r.status === 'Pending Review' || r.status === 'Rejected') {
      return false;
    }
    return true;
  });

  const filteredReports = useMemo(() => {
    let result = [...visibleReports];
    if (searchQuery) {
      const q = searchQuery.toLocaleLowerCase('sq-AL');
      result = result.filter(r =>
        r.title?.toLocaleLowerCase('sq-AL').includes(q) ||
        r.description?.toLocaleLowerCase('sq-AL').includes(q) ||
        r.trackingId?.toLocaleLowerCase('sq-AL').includes(q) ||
        r.location?.address?.toLocaleLowerCase('sq-AL').includes(q) ||
        r.category?.toLocaleLowerCase('sq-AL').includes(q) ||
        (() => {
          const topic = getReportTopic(r);
          return Boolean(topic && (topic.label.toLocaleLowerCase('sq-AL').includes(q) || topic.keywords.some(keyword => keyword.includes(q) || q.includes(keyword))));
        })()
      );
    }
    if (selectedTopic) result = result.filter(r => getReportTopic(r)?.id === selectedTopic);
    if (selectedMunicipality) {
      result = result.filter(r =>
        r.location?.municipality &&
        scopeKey(r.location.municipality) === scopeKey(selectedMunicipality)
      );
    }

    if (dateFrom) {
      result = result.filter(r => new Date(r.createdAt) >= new Date(dateFrom));
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(r => new Date(r.createdAt) <= toDate);
    }

    // Sort based on active tab
    if (activeTab === 'dash_recent') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (activeTab === 'dash_resolved') {
      result = result.filter(r => r.status === 'Resolved');
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (activeTab === 'dash_most_voted') {
      result.sort((a, b) => b.upvotes - a.upvotes);
    } else if (activeTab === 'dash_critical') {
      result = result.filter(r => r.urgency === 'E lartë' || r.urgency === 'Kritike');
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      // dash_all defaults to newest
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [visibleReports, searchQuery, selectedTopic, selectedMunicipality, activeTab, dateFrom, dateTo]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (searchQuery.trim()) chips.push({ id: 'search', label: `${dt('Kërko')}: ${searchQuery.trim()}`, onRemove: () => { setSearchQuery(''); setCurrentPage(1); } });
    if (selectedMunicipality) chips.push({ id: 'municipality', label: selectedMunicipality, onRemove: () => { setSelectedMunicipality(''); setCurrentPage(1); } });
    if (selectedTopic) {
      const topic = REPORT_TOPICS.find(item => item.id === selectedTopic);
      if (topic) chips.push({ id: 'topic', label: `${topic.icon} ${topic.label}`, onRemove: () => { setSelectedTopic(''); setCurrentPage(1); } });
    }
    if (datePreset !== 'all' || dateFrom || dateTo) {
      const label = datePreset === 'today' ? 'Sot' : datePreset === 'week' ? '7 ditët e fundit' : datePreset === 'month' ? '30 ditët e fundit' : `${dateFrom || '—'} → ${dateTo || '—'}`;
      chips.push({ id: 'date', label, onRemove: () => { setDateFrom(''); setDateTo(''); setDatePreset('all'); setCurrentPage(1); } });
    }
    if (activeTab !== 'dash_all') {
      const labels: Record<string, string> = {
        dash_recent: 'Së fundmi',
        dash_most_voted: 'Më të votuarat',
        dash_critical: 'Kritike',
        dash_resolved: 'Të zgjidhura',
      };
      chips.push({ id: 'sort', label: labels[activeTab] || activeTab, onRemove: () => { setActiveTab('dash_all'); setCurrentPage(1); } });
    }
    return chips;
  }, [activeTab, dateFrom, datePreset, dateTo, dt, searchQuery, selectedMunicipality, selectedTopic]);

  const totalPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE);

  const currentReports = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredReports.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredReports, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleShare = (e: React.MouseEvent, title: string, id: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/detailed-registry?report=${encodeURIComponent(id)}`;
    if (navigator.share) {
      navigator.share({
        title: `Raportim: ${title}`,
        text: `Shikoni këtë raportim qytetar: "${title}"`,
        url: url
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      alert("Linku është kopjuar!");
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:py-8">

      <header className="relative isolate overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white p-5 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-slate-900 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <button onClick={() => navigate('/')} className="mb-4 inline-flex min-h-9 items-center gap-2 text-xs font-bold text-slate-500 transition-colors hover:text-blue-700 dark:text-slate-400 dark:hover:text-cyan-300">
                <ChevronLeft className="h-4 w-4" />{dt(`Kthehu tek Ballina`)}
              </button>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-900 dark:border-cyan-300/15 dark:bg-cyan-300/10 dark:text-cyan-200">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {dt('Regjistri publik · Të dhëna të moderuara')}
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-4xl">{dt(`Regjistri i Zgjeruar`)}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">{dt(`Eksploro raportimet publike dhe ndiq statusin e çështjeve. Të dhënat personale dhe raportimet në pritje nuk shfaqen në regjistrin publik.`)}</p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
              <div className="relative w-full sm:min-w-72 sm:flex-1 md:w-[22rem]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }}
              placeholder={dt('Kërko raporte, adresa ose ID...')}
              aria-label={dt('Kërko raporte, adresa ose ID...')}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsFilterDrawerOpen((open) => !open)}
            aria-expanded={isFilterDrawerOpen}
            className={cn('inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition-colors', isFilterDrawerOpen || activeFilterChips.length > 0 ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-400/10 dark:text-blue-200' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200')}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {dt('Filtra të avancuar')}
            {activeFilterChips.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-(--color-brand-primary) px-1 text-[10px] text-white">{activeFilterChips.length}</span>}
          </button>
        </div>
      </div>
        </div>

        <div className="relative mt-6 grid grid-cols-1 gap-3 border-t border-slate-200/80 pt-5 dark:border-white/10 sm:grid-cols-3">
          {[
            { label: 'Raportime publike', value: visibleReports.length, icon: FilePlus2, tone: 'text-blue-700 dark:text-blue-300' },
            { label: 'Në proces', value: visibleReports.filter(report => report.status !== 'Resolved').length, icon: Clock, tone: 'text-amber-600 dark:text-amber-300' },
            { label: 'Të zgjidhura', value: visibleReports.filter(report => report.status === 'Resolved').length, icon: CheckSquare, tone: 'text-emerald-600 dark:text-emerald-300' },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/5 dark:bg-white/[0.03]">
              <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-800', tone)}><Icon className="h-4 w-4" aria-hidden="true" /></span>
              <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{dt(label)}</p><p className={cn('text-xl font-black', tone)}>{value.toLocaleString('sq-AL')}</p></div>
            </div>
          ))}
        </div>
        <p className="relative text-[11px] text-slate-500 dark:text-slate-400">{dt('Përmbledhja bazohet në raportimet e ngarkuara aktualisht; përdor filtrat për të kufizuar rezultatet.')}</p>
      </header>

      <div className="relative">
        <AdvancedFilterDrawer
          isOpen={isFilterDrawerOpen}
          selectedMunicipality={selectedMunicipality}
          selectedTopic={selectedTopic}
          dateFrom={dateFrom}
          dateTo={dateTo}
          datePreset={datePreset as 'all' | 'today' | 'week' | 'month' | 'custom'}
          activeTab={activeTab as 'dash_all' | 'dash_recent' | 'dash_most_voted' | 'dash_critical' | 'dash_resolved'}
          onMunicipalityChange={(value) => { setSelectedMunicipality(value); setCurrentPage(1); }}
          onTopicChange={(value) => { setSelectedTopic(value); setCurrentPage(1); }}
          onDatePresetChange={(value) => { if (value === 'custom') applyDatePresetAndResetPage(value); else applyDatePreset(value); }}
          onDateFromChange={(value) => { setDateFrom(value); setDatePreset('custom'); setCurrentPage(1); }}
          onDateToChange={(value) => { setDateTo(value); setDatePreset('custom'); setCurrentPage(1); }}
          onSortChange={(value) => { setActiveTab(value); setCurrentPage(1); }}
          onReset={resetFilters}
          onClose={() => setIsFilterDrawerOpen(false)}
        />
      </div>

      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label={dt('Filtra aktivë')}>
          <span className="mr-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{dt('Filtra aktivë')}</span>
          {activeFilterChips.map((chip) => <FilterChip key={chip.id} label={chip.label} onRemove={chip.onRemove} />)}
          <button type="button" onClick={resetFilters} className="ml-auto inline-flex min-h-8 items-center gap-1 text-xs font-black text-(--color-brand-primary) hover:underline"><X className="h-3.5 w-3.5" aria-hidden="true" />{dt('Pastro filtrat')}</button>
        </div>
      )}

      {/* Results Summary */}
      {!['loading', 'error'].includes(reportsStatus) && filteredReports.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
          <p className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
            <span className="font-bold text-[var(--color-text)] dark:text-white">{filteredReports.length}</span> {dt(`raportime të gjitha`)} ({dt('nga')} {visibleReports.length} {dt('publike')})
          </p>
          {(searchQuery || selectedMunicipality || dateFrom || dateTo || activeTab !== 'dash_all') && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              <X className="w-3 h-3" />{dt(`Pastro filtrat`)}
            </button>
          )}
        </div>
      )}

      {filteredReports.length > 0 && (
        <AdBanner
          position="feed"
          className="max-w-none"
          municipality={selectedMunicipality || undefined}
        />
      )}

      <div className="space-y-6">
        {reportsStatus === 'loading' ? (
          <StatePanel
            icon={<RefreshCw className="h-7 w-7 animate-spin" aria-hidden="true" />}
            title={dt('Po ngarkohen raportimet')}
            description={dt('Po marrim raportimet publike dhe statuset e tyre.')}
            tone="info"
          />
        ) : reportsStatus === 'error' ? (
          <StatePanel
            icon={<WifiOff className="h-7 w-7" aria-hidden="true" />}
            title={dt('Raportimet nuk mund të ngarkohen')}
            description={reportsError || dt('Kontrolloni lidhjen ose lejet e qasjes dhe provoni përsëri.')}
            actionLabel={dt('Provo përsëri')}
            onAction={() => window.location.reload()}
            tone="error"
            secondaryAction={<Link to="/" className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-bold text-(--color-brand-primary) hover:underline">{dt('Kthehu në ballinë')}</Link>}
          />
        ) : reports.length === 0 ? (
          <StatePanel
            icon={<FilePlus2 className="h-7 w-7" aria-hidden="true" />}
            title={dt('Nuk ka ende raportime publike')}
            description={dt('Raportimet e miratuara do të shfaqen këtu sapo të publikohen.')}
            actionLabel={dt('Raporto një problem')}
            onAction={() => navigate('/raporto')}
            tone="info"
          />
        ) : filteredReports.length === 0 ? (
          <StatePanel
            icon={<Filter className="h-7 w-7" aria-hidden="true" />}
            title={dt('Nuk u gjetën raportime për filtrat e zgjedhur')}
            description={dt('Ndryshoni kërkimin ose pastroni komunën, datën dhe statusin për të parë më shumë rezultate.')}
            actionLabel={dt('Pastro të gjithë filtrat')}
            onAction={resetFilters}
          />
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-(--color-border-soft) bg-(--color-surface) dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-(--color-border-soft) bg-(--color-surface-subtle) px-4 py-3 dark:border-white/10 dark:bg-slate-800/60 sm:px-5">
              <div>
                <p className="text-sm font-black text-(--color-text) dark:text-white">{dt('Regjistri i raportimeve')}</p>
                <p className="mt-0.5 text-xs text-(--color-text-muted)">{filteredReports.length} {dt('raportime publike')}</p>
              </div>
              <span className="hidden text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 sm:inline">{dt('ID i raportimit')}</span>
            </div>
            {currentReports.map((report) => (
              <RegistryRow key={report.id} report={report} dt={dt} onOpen={() => setSelectedReportId(report.id)} onShare={handleShare} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="py-8 flex justify-center">
          <nav className="flex items-center gap-2 bg-[var(--color-surface)] dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
               className="p-2 rounded-xl border border-slate-200 dark:border-white/10 text-[var(--color-text-muted)] hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-800 hover:text-[var(--color-text)] dark:text-white dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              aria-label={dt('Faqja e mëparshme')}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar px-2">
              {Array.from({ length: totalPages }).map((_, idx) => {
                const page = idx + 1;
                // Show 5 pages around current page, or first/last
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 2 && page <= currentPage + 2)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={cn(
                        "w-10 h-10 rounded-xl font-bold text-sm transition-all shrink-0",
                        currentPage === page
                          ? "bg-indigo-600 text-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shadow-indigo-200 border-none"
                          : "bg-transparent text-[var(--color-text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800 border border-transparent hover:border-slate-200 dark:border-white/10"
                      )}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  page === currentPage - 3 ||
                  page === currentPage + 3
                ) {
                  return <span key={page} className="px-2 py-2 text-[var(--color-text-muted)] shrink-0">...</span>;
                }
                return null;
              })}
            </div>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
               className="p-2 rounded-xl border border-slate-200 dark:border-white/10 text-[var(--color-text-muted)] hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-800 hover:text-[var(--color-text)] dark:text-white dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              aria-label={dt('Faqja tjetër')}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </nav>
        </div>
      )}

      {/*
        Strategic footer slot. The registry is a long paginated list, so this is
        the one place a banner can sit without interrupting a citizen mid-scan —
        after the last page control, below everything actionable. It renders
        nothing when no campaign targets the `banner` position.
      */}
      <div className="mt-8">
        <AdBanner position="banner" className="mx-auto" />
      </div>

      {selectedReportId && (
        <ReportDetailModal
           report={reports.find(r => r.id === selectedReportId)!}
           onClose={() => setSelectedReportId(null)}
        />
      )}
      
      
    </div>
  );
}

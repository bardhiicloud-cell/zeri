import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BarChart3, ChevronDown, ChevronLeft, ChevronRight, Download, FilePlus2, Filter, LayoutGrid, List, Rows3, Search, ShieldCheck,
  SlidersHorizontal, WifiOff, X, ArrowRight, FileSearch,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { isSpecificScope, scopeKey } from '../lib/municipalityScope';
import { useLanguage } from '../lib/LanguageContext';
import { cn } from '../lib/utils';
import { getReportTopic, getReportTopicLabel, REPORT_TOPICS } from '../lib/reportTopics';
import { statusLabel } from '../lib/reportStatus';
import ReportDetailModal from '../components/ReportDetailModal.tsx';
import { StatePanel } from '../components/ui/StatePanel.tsx';
import AdBanner from '../components/AdBanner.tsx';
import { AdvancedFilterDrawer } from '../components/registry/AdvancedFilterDrawer.tsx';
import { FilterChip } from '../components/registry/FilterChip';
import { RegistryRow } from '../components/registry/RegistryRow';
import { RegistryCard, formatReportDate, trackingIdOf } from '../components/registry/RegistryCard';
import { RegistryTable } from '../components/registry/RegistryTable';
import { RegistryInsights } from '../components/registry/RegistryInsights';
import { PageHero, heroPrimaryClass, heroSecondaryClass } from '../components/layout/PageHero';

type View = 'cards' | 'list' | 'table';
type StatusFilter = 'all' | 'open' | 'resolved' | 'critical';
type SortKey = 'recent' | 'oldest' | 'voted';
type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';

const PAGE_SIZES = [12, 24, 48] as const;
const VIEWS: Array<{ id: View; label: string; icon: typeof LayoutGrid }> = [
  { id: 'cards', label: 'Kartela', icon: LayoutGrid },
  { id: 'list', label: 'Listë', icon: List },
  { id: 'table', label: 'Tabelë', icon: Rows3 },
];
const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Të gjitha' },
  { id: 'open', label: 'Në proces' },
  { id: 'resolved', label: 'Të zgjidhura' },
  { id: 'critical', label: 'Kritike' },
];
const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: 'recent', label: 'Më të rejat' },
  { id: 'oldest', label: 'Më të vjetrat' },
  { id: 'voted', label: 'Më të mbështetura' },
];

/** Old links used one `status=dash_*` value for both filter and sort; keep them working. */
function legacyTab(value: string | null): { status: StatusFilter; sort: SortKey } | null {
  switch (value) {
    case 'dash_resolved': return { status: 'resolved', sort: 'recent' };
    case 'dash_critical': return { status: 'critical', sort: 'recent' };
    case 'dash_most_voted': return { status: 'all', sort: 'voted' };
    case 'dash_recent': case 'dash_all': return { status: 'all', sort: 'recent' };
    default: return null;
  }
}

const oneOf = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(value ?? '') ? (value as T) : fallback;

const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export default function DetailedRegistryPage() {
  const { dt } = useLanguage();
  const reports = useStore(state => state.reports);
  const reportsStatus = useStore(state => state.reportsStatus);
  const reportsError = useStore(state => state.reportsError);
  const userMunicipality = useStore(state => state.userMunicipality);
  const setUserMunicipality = useStore(state => state.setUserMunicipality);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const legacy = legacyTab(searchParams.get('status'));
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedTopic, setSelectedTopic] = useState(searchParams.get('topic') || '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => legacy?.status ?? oneOf(searchParams.get('st'), ['all', 'open', 'resolved', 'critical'] as const, 'all'));
  const [sort, setSort] = useState<SortKey>(() => legacy?.sort ?? oneOf(searchParams.get('sort'), ['recent', 'oldest', 'voted'] as const, 'recent'));
  const [view, setView] = useState<View>(() => oneOf(searchParams.get('view'), ['cards', 'list', 'table'] as const, 'cards'));
  const [perPage, setPerPage] = useState<number>(() => {
    const n = Number(searchParams.get('per'));
    return (PAGE_SIZES as readonly number[]).includes(n) ? n : PAGE_SIZES[0];
  });
  const [currentPage, setCurrentPage] = useState(() => Math.max(1, Number(searchParams.get('page')) || 1));
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('to') || '');
  const [datePreset, setDatePreset] = useState<DatePreset>(() => (searchParams.get('from') || searchParams.get('to') ? 'custom' : 'all'));
  const [selectedReportId, setSelectedReportId] = useState<string | null>(searchParams.get('report'));
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [selectedMunicipality, setSelectedMunicipality] = useState(() => (isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : ''));

  // A link that names a municipality wins, and it sets the platform-wide scope
  // rather than a private copy, so the sidebar and the map agree with it.
  // (Komunat links with `?komuna=`, other pages with `?municipality=`.)
  useEffect(() => {
    const named = searchParams.get('municipality') || searchParams.get('komuna');
    if (named) {
      setUserMunicipality(named);
      setSelectedMunicipality(scopeKey(named));
    }
    // Only the first render consumes the link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchParams.get('municipality') || searchParams.get('komuna')) return;
    setSelectedMunicipality(isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : '');
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userMunicipality]);

  // Keep the address bar in step with the filters, so a filtered view can be
  // bookmarked, shared and survives a reload. `replace` keeps Back usable.
  useEffect(() => {
    const next = new URLSearchParams();
    if (searchQuery.trim()) next.set('q', searchQuery.trim());
    if (selectedTopic) next.set('topic', selectedTopic);
    if (statusFilter !== 'all') next.set('st', statusFilter);
    if (sort !== 'recent') next.set('sort', sort);
    if (view !== 'cards') next.set('view', view);
    if (perPage !== PAGE_SIZES[0]) next.set('per', String(perPage));
    if (currentPage > 1) next.set('page', String(currentPage));
    if (dateFrom) next.set('from', dateFrom);
    if (dateTo) next.set('to', dateTo);
    if (selectedReportId) next.set('report', selectedReportId);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedTopic, statusFilter, sort, view, perPage, currentPage, dateFrom, dateTo, selectedReportId]);

  // Reports in review or rejected are not public record.
  const visibleReports = useMemo(() => reports.filter(report => report.status !== 'Pending Review' && report.status !== 'Rejected' && report.status !== 'Draft'), [reports]);

  /** Everything except the status filter, so the tab counts describe what each tab would show. */
  const baseFiltered = useMemo(() => {
    let result = visibleReports;
    const q = searchQuery.trim().toLocaleLowerCase('sq-AL');
    if (q) {
      result = result.filter(report => {
        const topic = getReportTopic(report);
        return (
          report.title?.toLocaleLowerCase('sq-AL').includes(q) ||
          report.description?.toLocaleLowerCase('sq-AL').includes(q) ||
          report.trackingId?.toLocaleLowerCase('sq-AL').includes(q) ||
          report.location?.address?.toLocaleLowerCase('sq-AL').includes(q) ||
          report.location?.municipality?.toLocaleLowerCase('sq-AL').includes(q) ||
          report.category?.toLocaleLowerCase('sq-AL').includes(q) ||
          Boolean(topic && (topic.label.toLocaleLowerCase('sq-AL').includes(q) || topic.keywords.some(keyword => keyword.includes(q) || q.includes(keyword))))
        );
      });
    }
    if (selectedTopic) result = result.filter(report => getReportTopic(report)?.id === selectedTopic);
    if (selectedMunicipality) result = result.filter(report => report.location?.municipality && scopeKey(report.location.municipality) === scopeKey(selectedMunicipality));
    if (dateFrom) { const from = new Date(dateFrom); result = result.filter(report => new Date(report.createdAt) >= from); }
    if (dateTo) { const to = new Date(dateTo); to.setHours(23, 59, 59, 999); result = result.filter(report => new Date(report.createdAt) <= to); }
    return result;
  }, [visibleReports, searchQuery, selectedTopic, selectedMunicipality, dateFrom, dateTo]);

  const counts = useMemo(() => ({
    all: baseFiltered.length,
    open: baseFiltered.filter(report => report.status !== 'Resolved' && report.status !== 'Closed').length,
    resolved: baseFiltered.filter(report => report.status === 'Resolved' || report.status === 'Closed').length,
    critical: baseFiltered.filter(report => report.urgency === 'Kritike' || report.urgency === 'E lartë').length,
  }), [baseFiltered]);

  const filteredReports = useMemo(() => {
    let result = [...baseFiltered];
    if (statusFilter === 'open') result = result.filter(report => report.status !== 'Resolved' && report.status !== 'Closed');
    if (statusFilter === 'resolved') result = result.filter(report => report.status === 'Resolved' || report.status === 'Closed');
    if (statusFilter === 'critical') result = result.filter(report => report.urgency === 'Kritike' || report.urgency === 'E lartë');
    const time = (report: { createdAt: string }) => new Date(report.createdAt).getTime() || 0;
    if (sort === 'voted') result.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0) || time(b) - time(a));
    else if (sort === 'oldest') result.sort((a, b) => time(a) - time(b));
    else result.sort((a, b) => time(b) - time(a));
    return result;
  }, [baseFiltered, statusFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / perPage));
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);
  const pageReports = useMemo(() => filteredReports.slice((currentPage - 1) * perPage, currentPage * perPage), [filteredReports, currentPage, perPage]);

  const resolvedShare = visibleReports.length
    ? Math.round((visibleReports.filter(report => report.status === 'Resolved' || report.status === 'Closed').length / visibleReports.length) * 100)
    : 0;
  const municipalitiesCovered = useMemo(() => new Set(visibleReports.map(report => report.location?.municipality).filter(Boolean)).size, [visibleReports]);

  const applyDatePreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    const today = new Date();
    if (preset === 'today') { setDateFrom(isoDay(today)); setDateTo(isoDay(today)); }
    else if (preset === 'week' || preset === 'month') {
      const from = new Date(); from.setDate(today.getDate() - (preset === 'week' ? 7 : 30));
      setDateFrom(isoDay(from)); setDateTo(isoDay(today));
    } else if (preset === 'all') { setDateFrom(''); setDateTo(''); }
    setCurrentPage(1);
  }, []);

  const resetFilters = () => {
    setSearchQuery(''); setSelectedTopic(''); setSelectedMunicipality(''); setDateFrom(''); setDateTo('');
    setDatePreset('all'); setStatusFilter('all'); setSort('recent'); setCurrentPage(1);
  };

  const chips = useMemo(() => {
    const list: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (searchQuery.trim()) list.push({ id: 'search', label: `${dt('Kërko')}: ${searchQuery.trim()}`, onRemove: () => { setSearchQuery(''); setCurrentPage(1); } });
    if (selectedMunicipality) list.push({ id: 'municipality', label: selectedMunicipality, onRemove: () => { setSelectedMunicipality(''); setCurrentPage(1); } });
    if (selectedTopic) {
      const topic = REPORT_TOPICS.find(item => item.id === selectedTopic);
      if (topic) list.push({ id: 'topic', label: `${topic.icon} ${topic.label}`, onRemove: () => { setSelectedTopic(''); setCurrentPage(1); } });
    }
    if (datePreset !== 'all' || dateFrom || dateTo) {
      const label = datePreset === 'today' ? dt('Sot') : datePreset === 'week' ? dt('7 ditët e fundit') : datePreset === 'month' ? dt('30 ditët e fundit') : `${dateFrom || '—'} → ${dateTo || '—'}`;
      list.push({ id: 'date', label, onRemove: () => applyDatePreset('all') });
    }
    if (statusFilter !== 'all') list.push({ id: 'status', label: dt(STATUS_FILTERS.find(item => item.id === statusFilter)!.label), onRemove: () => { setStatusFilter('all'); setCurrentPage(1); } });
    return list;
  }, [applyDatePreset, datePreset, dateFrom, dateTo, dt, searchQuery, selectedMunicipality, selectedTopic, statusFilter]);

  const downloadCSV = () => {
    const headers = ['Track ID', 'Titulli', 'Tema', 'Kategoria', 'Komuna', 'Adresa', 'Statusi', 'Urgjenca', 'Institucioni', 'Data', 'Pëlqime', 'Lidhja'];
    const rows = filteredReports.map(report => [
      trackingIdOf(report), report.title, getReportTopicLabel(report), report.category, report.location?.municipality, report.location?.address,
      statusLabel(report.status), report.urgency, report.responsibleInstitution, formatReportDate(report.createdAt), report.upvotes || 0,
      `${window.location.origin}/detailed-registry?report=${encodeURIComponent(report.id)}`,
    ].map(csvCell).join(','));
    // BOM so Excel reads the Albanian letters (ë, ç) correctly.
    const blob = new Blob(['﻿' + [headers.map(csvCell).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Regjistri_Raportimeve_${isoDay(new Date())}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`${filteredReports.length} ${dt('raportime u eksportuan')}`);
  };

  const share = (event: React.MouseEvent, title: string, id: string) => {
    event.stopPropagation();
    const url = `${window.location.origin}/detailed-registry?report=${encodeURIComponent(id)}`;
    if (navigator.share) {
      navigator.share({ title: `Raportim: ${title}`, text: `Shikoni këtë raportim qytetar: "${title}"`, url }).catch(() => undefined);
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success(dt('Linku u kopjua.')), () => toast.error(dt('Linku nuk u kopjua.')));
    }
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    document.getElementById('registry-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectedReport = selectedReportId ? reports.find(report => report.id === selectedReportId) : undefined;
  const loading = reportsStatus === 'loading';
  const first = filteredReports.length ? (currentPage - 1) * perPage + 1 : 0;
  const last = Math.min(currentPage * perPage, filteredReports.length);

  return (
    <div className="page-shell relative mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHero
        eyebrow={dt('Regjistri publik · Të dhëna të moderuara')}
        icon={ShieldCheck}
        title={dt('Regjistri i Zgjeruar')}
        subtitle={dt('Eksploro raportimet publike dhe ndiq statusin e çështjeve. Të dhënat personale dhe raportimet në pritje nuk shfaqen në regjistrin publik.')}
        actions={
          <>
            <Link to="/raporto" className={heroPrimaryClass}>{dt('Raporto një problem')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
            <Link to="/trackid" className={heroSecondaryClass}><FileSearch className="h-4 w-4" aria-hidden="true" /> {dt('Gjej me Track ID')}</Link>
          </>
        }
        stats={visibleReports.length === 0 ? undefined : [
          { value: visibleReports.length.toLocaleString('sq-AL'), label: dt('Raportime publike') },
          { value: `${resolvedShare}%`, label: dt('Të zgjidhura') },
          { value: visibleReports.filter(report => report.status !== 'Resolved' && report.status !== 'Closed').length.toLocaleString('sq-AL'), label: dt('Në proces') },
          { value: String(municipalitiesCovered), label: dt('Komuna me raportime') },
        ]}
      />

      {/* Toolbar */}
      <section aria-label={dt('Kërkimi dhe filtrat')} className="rounded-3xl border border-slate-200/80 bg-white/95 p-3 shadow-lg shadow-slate-900/5 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/95 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={event => { setSearchQuery(event.target.value); setCurrentPage(1); }}
              placeholder={dt('Kërko raporte, adresa, komuna ose ID...')}
              aria-label={dt('Kërko raporte, adresa ose ID...')}
              className="h-12 w-full rounded-2xl border border-transparent bg-slate-100 pl-12 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-950"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(true)}
              aria-haspopup="dialog"
              className={cn('relative inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black transition lg:flex-none', chips.length > 0 ? 'bg-blue-700 text-white hover:bg-blue-800' : 'bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200')}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {dt('Filtra')}
              {chips.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] text-blue-800">{chips.length}</span>}
            </button>
            <button type="button" onClick={downloadCSV} disabled={filteredReports.length === 0} title={dt('Eksporto CSV')} aria-label={dt('Eksporto CSV')} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-slate-200 text-slate-600 transition hover:border-blue-400 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300">
              <Download className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label={dt('Statusi')} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STATUS_FILTERS.map(item => {
              const active = statusFilter === item.id;
              return (
                <button key={item.id} type="button" role="tab" aria-selected={active} onClick={() => { setStatusFilter(item.id); setCurrentPage(1); }}
                  className={cn('inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-black transition', active ? 'border-blue-700 bg-blue-50 text-blue-800 dark:border-blue-300 dark:bg-blue-400/10 dark:text-blue-200' : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white')}>
                  {dt(item.label)}
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] tabular-nums', active ? 'bg-blue-700 text-white dark:bg-blue-300 dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}>{counts[item.id]}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 lg:justify-end">
            <label className="sr-only" htmlFor="registry-sort">{dt('Rendit sipas')}</label>
            <select id="registry-sort" value={sort} onChange={event => { setSort(event.target.value as SortKey); setCurrentPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200">
              {SORTS.map(item => <option key={item.id} value={item.id}>{dt(item.label)}</option>)}
            </select>
            <div role="group" aria-label={dt('Pamja')} className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {VIEWS.map(item => (
                <button key={item.id} type="button" onClick={() => setView(item.id)} aria-pressed={view === item.id} title={dt(item.label)}
                  className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-black transition', item.id === 'table' && 'max-lg:hidden', view === item.id ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-950 dark:text-blue-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400')}>
                  <item.icon className="h-3.5 w-3.5" aria-hidden="true" /> <span className="hidden sm:inline">{dt(item.label)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <AdvancedFilterDrawer
        isOpen={isFilterDrawerOpen}
        selectedMunicipality={selectedMunicipality}
        selectedTopic={selectedTopic}
        dateFrom={dateFrom}
        dateTo={dateTo}
        datePreset={datePreset}
        status={statusFilter}
        sort={sort}
        resultCount={filteredReports.length}
        onMunicipalityChange={value => { setSelectedMunicipality(value); setCurrentPage(1); }}
        onTopicChange={value => { setSelectedTopic(value); setCurrentPage(1); }}
        onDatePresetChange={value => { if (value === 'custom') { setDatePreset('custom'); setCurrentPage(1); } else applyDatePreset(value); }}
        onDateFromChange={value => { setDateFrom(value); setDatePreset('custom'); setCurrentPage(1); }}
        onDateToChange={value => { setDateTo(value); setDatePreset('custom'); setCurrentPage(1); }}
        onStatusChange={value => { setStatusFilter(value); setCurrentPage(1); }}
        onSortChange={value => { setSort(value); setCurrentPage(1); }}
        onReset={resetFilters}
        onClose={() => setIsFilterDrawerOpen(false)}
      />

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label={dt('Filtra aktivë')}>
          <span className="mr-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{dt('Filtra aktivë')}</span>
          {chips.map(chip => <FilterChip key={chip.id} label={chip.label} onRemove={chip.onRemove} />)}
          <button type="button" onClick={resetFilters} className="ml-auto inline-flex min-h-8 items-center gap-1 text-xs font-black text-blue-700 hover:underline dark:text-blue-300"><X className="h-3.5 w-3.5" aria-hidden="true" />{dt('Pastro filtrat')}</button>
        </div>
      )}

      {!loading && reportsStatus !== 'error' && filteredReports.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowInsights(open => !open)} aria-expanded={showInsights} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:border-blue-400 hover:text-blue-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            {showInsights ? dt('Fshih statistikat') : dt('Shfaq statistikat')}
            <ChevronDown className={cn('h-4 w-4 transition-transform', showInsights && 'rotate-180')} aria-hidden="true" />
          </button>
          {showInsights && (
            <div className="mt-4">
              <RegistryInsights
                reports={filteredReports}
                dt={dt}
                activeMunicipality={selectedMunicipality}
                activeTopic={selectedTopic}
                onMunicipality={value => { setSelectedMunicipality(value); if (value) setUserMunicipality(value); setCurrentPage(1); }}
                onTopic={value => { setSelectedTopic(value); setCurrentPage(1); }}
              />
            </div>
          )}
        </div>
      )}

      <section id="registry-results" aria-labelledby="registry-results-title" className="scroll-mt-24 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="registry-results-title" className="font-serif text-2xl font-black text-slate-950 dark:text-white">{dt('Raportimet')}</h2>
            {!loading && filteredReports.length > 0 && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
                <span className="font-black text-slate-900 dark:text-white">{first}–{last}</span> {dt('nga')} <span className="font-black text-slate-900 dark:text-white">{filteredReports.length}</span> {dt('raportime')}
                {filteredReports.length !== visibleReports.length && <> ({visibleReports.length} {dt('publike gjithsej')})</>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <label htmlFor="registry-per">{dt('Për faqe')}</label>
            <select id="registry-per" value={perPage} onChange={event => { setPerPage(Number(event.target.value)); setCurrentPage(1); }} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-black text-slate-700 outline-none dark:border-white/10 dark:bg-slate-950 dark:text-slate-200">
              {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div role="status" aria-label={dt('Po ngarkohen raportimet')} className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
                <div className="aspect-[16/10] bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-3 p-5"><div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-800" /><div className="h-5 w-4/5 rounded bg-slate-200 dark:bg-slate-800" /><div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-800" /><div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-800" /></div>
              </div>
            ))}
          </div>
        ) : reportsStatus === 'error' ? (
          <StatePanel icon={<WifiOff className="h-7 w-7" aria-hidden="true" />} title={dt('Raportimet nuk mund të ngarkohen')} description={reportsError || dt('Kontrolloni lidhjen ose lejet e qasjes dhe provoni përsëri.')} actionLabel={dt('Provo përsëri')} onAction={() => window.location.reload()} tone="error"
            secondaryAction={<Link to="/" className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-bold text-blue-700 hover:underline">{dt('Kthehu në ballinë')}</Link>} />
        ) : reports.length === 0 ? (
          <StatePanel icon={<FilePlus2 className="h-7 w-7" aria-hidden="true" />} title={dt('Nuk ka ende raportime publike')} description={dt('Raportimet e miratuara do të shfaqen këtu sapo të publikohen.')} actionLabel={dt('Raporto një problem')} onAction={() => navigate('/raporto')} tone="info" />
        ) : filteredReports.length === 0 ? (
          <StatePanel icon={<Filter className="h-7 w-7" aria-hidden="true" />} title={dt('Nuk u gjetën raportime për filtrat e zgjedhur')} description={dt('Ndryshoni kërkimin ose pastroni komunën, datën dhe statusin për të parë më shumë rezultate.')} actionLabel={dt('Pastro të gjithë filtrat')} onAction={resetFilters} />
        ) : view === 'list' ? (
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-slate-900">
            {pageReports.map(report => <RegistryRow key={report.id} report={report} dt={dt} onOpen={() => setSelectedReportId(report.id)} onShare={share} />)}
          </div>
        ) : view === 'table' ? (
          <>
            <div className="hidden lg:block"><RegistryTable reports={pageReports} dt={dt} onOpen={setSelectedReportId} onShare={share} /></div>
            {/* Tables do not fit a phone: below lg the same data is shown as cards. */}
            <div className="grid gap-5 sm:grid-cols-2 lg:hidden">{pageReports.map(report => <RegistryCard key={report.id} report={report} dt={dt} onOpen={() => setSelectedReportId(report.id)} onShare={share} />)}</div>
          </>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {pageReports.map(report => <RegistryCard key={report.id} report={report} dt={dt} onOpen={() => setSelectedReportId(report.id)} onShare={share} />)}
          </div>
        )}

        {!loading && filteredReports.length > 0 && <AdBanner position="feed" className="max-w-none" municipality={selectedMunicipality || undefined} />}

        {totalPages > 1 && !loading && (
          <nav aria-label={dt('Faqet e regjistrit')} className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} aria-label={dt('Faqja e mëparshme')} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-400 disabled:opacity-40 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"><ChevronLeft className="h-5 w-5" /></button>
            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
              .map((page, index, pages) => (
                <React.Fragment key={page}>
                  {index > 0 && page - pages[index - 1] > 1 && <span className="px-1 text-slate-400" aria-hidden="true">…</span>}
                  <button type="button" onClick={() => goToPage(page)} aria-current={currentPage === page ? 'page' : undefined} aria-label={`${dt('Faqja')} ${page}`}
                    className={cn('h-11 min-w-11 rounded-xl border px-3 text-sm font-black transition', currentPage === page ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300')}>{page}</button>
                </React.Fragment>
              ))}
            <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label={dt('Faqja tjetër')} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-400 disabled:opacity-40 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"><ChevronRight className="h-5 w-5" /></button>
          </nav>
        )}
      </section>

      <div className="pt-2"><AdBanner position="banner" className="mx-auto" /></div>

      {selectedReportId && selectedReport && <ReportDetailModal report={selectedReport} onClose={() => setSelectedReportId(null)} />}
      {selectedReportId && !selectedReport && !loading && (
        <div role="alert" className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-xl">
          <span>{dt('Ky raportim nuk është publik ose nuk ekziston më.')}</span>
          <button type="button" onClick={() => setSelectedReportId(null)} className="font-black underline">{dt('Mbyll')}</button>
        </div>
      )}
    </div>
  );
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../lib/store';
import { useLanguage } from '../lib/LanguageContext';
import { format } from 'date-fns';
import { sq } from 'date-fns/locale';
import { Filter, Search, ChevronLeft, ChevronRight, SlidersHorizontal, X, WifiOff, FilePlus2, RefreshCw } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import ReportDetailModal from '../components/ReportDetailModal';
import { StatePanel } from '../components/ui/StatePanel';
import { AdvancedFilterDrawer } from '../components/registry/AdvancedFilterDrawer';
import { FilterChip } from '../components/registry/FilterChip';
import { RegistryRow } from '../components/registry/RegistryRow';
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
    const [selectedMunicipality, setSelectedMunicipality] = useState(() => {
        const municipality = userMunicipality && userMunicipality !== 'Të gjitha Komunat' && userMunicipality !== 'Kosova (të gjitha komunat)'
            ? userMunicipality
            : (searchParams.get('municipality') || '');
        return municipality;
    });
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [datePreset, setDatePreset] = useState('all');
    const [activeTab, setActiveTab] = useState(searchParams.get('status') || 'dash_all');
    const [selectedReportId, setSelectedReportId] = useState(null);
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    useEffect(() => {
        const municipality = userMunicipality && userMunicipality !== 'Të gjitha Komunat' && userMunicipality !== 'Kosova (të gjitha komunat)'
            ? userMunicipality
            : '';
        const routeMunicipality = searchParams.get('municipality') || '';
        setSelectedMunicipality(municipality || routeMunicipality);
        setCurrentPage(1);
    }, [userMunicipality, searchParams]);
    const handleDownloadCSV = () => {
        const headers = ['ID', 'Kategoria', 'Komuna', 'Lagjja', 'Adresa', 'Statusi', 'Data e Krijimit', 'Pëlqime'];
        const csvRows = [headers.join(',')];
        filteredReports.forEach(r => {
            const row = [
                r.id,
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
    const applyDatePreset = (preset) => {
        setDatePreset(preset);
        const today = new Date();
        if (preset === 'today') {
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            setDateFrom(`${yyyy}-${mm}-${dd}`);
            setDateTo(`${yyyy}-${mm}-${dd}`);
        }
        else if (preset === 'week') {
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
        }
        else if (preset === 'month') {
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
        }
        else {
            setDateFrom('');
            setDateTo('');
        }
        setCurrentPage(1);
    };
    const resetFilters = () => {
        setSearchQuery('');
        setSelectedMunicipality('');
        setDateFrom('');
        setDateTo('');
        setDatePreset('all');
        setActiveTab('dash_all');
        setCurrentPage(1);
        setIsFilterDrawerOpen(false);
    };
    const applyDatePresetAndResetPage = (preset) => {
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
            const q = searchQuery.toLowerCase();
            result = result.filter(r => r.title?.toLowerCase().includes(q) ||
                r.description?.toLowerCase().includes(q) ||
                r.trackingId?.toLowerCase().includes(q) ||
                r.location?.address?.toLowerCase().includes(q));
        }
        if (selectedMunicipality) {
            result = result.filter(r => r.location?.municipality === selectedMunicipality);
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
        }
        else if (activeTab === 'dash_resolved') {
            result = result.filter(r => r.status === 'Resolved');
            result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        else if (activeTab === 'dash_most_voted') {
            result.sort((a, b) => b.upvotes - a.upvotes);
        }
        else if (activeTab === 'dash_critical') {
            result = result.filter(r => r.urgency === 'E lartë' || r.urgency === 'Kritike');
            result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        else {
            // dash_all defaults to newest
            result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        return result;
    }, [visibleReports, searchQuery, selectedMunicipality, activeTab, dateFrom, dateTo]);
    const activeFilterChips = useMemo(() => {
        const chips = [];
        if (searchQuery.trim())
            chips.push({ id: 'search', label: `${dt('Kërko')}: ${searchQuery.trim()}`, onRemove: () => { setSearchQuery(''); setCurrentPage(1); } });
        if (selectedMunicipality)
            chips.push({ id: 'municipality', label: selectedMunicipality, onRemove: () => { setSelectedMunicipality(''); setCurrentPage(1); } });
        if (datePreset !== 'all' || dateFrom || dateTo) {
            const label = datePreset === 'today' ? 'Sot' : datePreset === 'week' ? '7 ditët e fundit' : datePreset === 'month' ? '30 ditët e fundit' : `${dateFrom || '—'} → ${dateTo || '—'}`;
            chips.push({ id: 'date', label, onRemove: () => { setDateFrom(''); setDateTo(''); setDatePreset('all'); setCurrentPage(1); } });
        }
        if (activeTab !== 'dash_all') {
            const labels = {
                dash_recent: 'Së fundmi',
                dash_most_voted: 'Më të votuarat',
                dash_critical: 'Kritike',
                dash_resolved: 'Të zgjidhura',
            };
            chips.push({ id: 'sort', label: labels[activeTab] || activeTab, onRemove: () => { setActiveTab('dash_all'); setCurrentPage(1); } });
        }
        return chips;
    }, [activeTab, dateFrom, datePreset, dateTo, dt, searchQuery, selectedMunicipality]);
    const totalPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE);
    const currentReports = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredReports.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredReports, currentPage]);
    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    const handleShare = (e, title, id) => {
        e.stopPropagation();
        const url = `${window.location.origin}/detailed-registry?report=${encodeURIComponent(id)}`;
        if (navigator.share) {
            navigator.share({
                title: `Raportim: ${title}`,
                text: `Shikoni këtë raportim qytetar: "${title}"`,
                url: url
            }).catch(console.error);
        }
        else {
            navigator.clipboard.writeText(url);
            alert("Linku është kopjuar!");
        }
    };
    return (_jsxs("div", { className: "relative mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:py-8", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsxs("button", { onClick: () => navigate('/'), className: "inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] hover:text-[var(--color-text)] dark:text-white transition-colors mb-2", children: [_jsx(ChevronLeft, { className: "w-4 h-4" }), dt(`Kthehu tek Ballina`)] }), _jsx("h1", { className: "text-3xl md:text-4xl font-bold text-[var(--color-text)] dark:text-white tracking-tight", children: dt(`Regjistri i Zgjeruar`) }), _jsx("p", { className: "text-[var(--color-text-muted)] mt-2 font-medium", children: dt(`Shfletoni të gjitha raportimet me pamje të detajuar.`) })] }), _jsxs("div", { className: "flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", children: [_jsxs("div", { className: "relative w-full sm:max-w-xl", children: [_jsx(Search, { className: "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400", "aria-hidden": "true" }), _jsx("input", { type: "search", value: searchQuery, onChange: (event) => { setSearchQuery(event.target.value); setCurrentPage(1); }, placeholder: dt('Kërko raporte, adresa ose ID...'), "aria-label": dt('Kërko raporte, adresa ose ID...'), className: "min-h-11 w-full rounded-[10px] border border-(--color-border-soft) bg-(--color-surface) pl-10 pr-4 text-sm font-semibold text-(--color-text) outline-none transition focus:border-(--color-brand-primary) focus:ring-2 focus:ring-(--color-brand-primary)/15 dark:border-white/10 dark:bg-slate-900 dark:text-white" })] }), _jsxs("button", { type: "button", onClick: () => setIsFilterDrawerOpen((open) => !open), "aria-expanded": isFilterDrawerOpen, className: cn('inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border px-4 text-sm font-black transition-colors', isFilterDrawerOpen || activeFilterChips.length > 0 ? 'border-(--color-brand-primary) bg-(--color-surface-subtle) text-(--color-brand-primary)' : 'border-(--color-border-soft) bg-(--color-surface) text-slate-700 hover:border-(--color-brand-primary) hover:text-(--color-brand-primary) dark:border-white/10 dark:bg-slate-900 dark:text-slate-200'), children: [_jsx(SlidersHorizontal, { className: "h-4 w-4", "aria-hidden": "true" }), dt('Filtra të avancuar'), activeFilterChips.length > 0 && _jsx("span", { className: "grid h-5 min-w-5 place-items-center rounded-full bg-(--color-brand-primary) px-1 text-[10px] text-white", children: activeFilterChips.length })] })] })] }), _jsx("div", { className: "relative", children: _jsx(AdvancedFilterDrawer, { isOpen: isFilterDrawerOpen, selectedMunicipality: selectedMunicipality, dateFrom: dateFrom, dateTo: dateTo, datePreset: datePreset, activeTab: activeTab, onMunicipalityChange: (value) => { setSelectedMunicipality(value); setCurrentPage(1); }, onDatePresetChange: (value) => { if (value === 'custom')
                        applyDatePresetAndResetPage(value);
                    else
                        applyDatePreset(value); }, onDateFromChange: (value) => { setDateFrom(value); setDatePreset('custom'); setCurrentPage(1); }, onDateToChange: (value) => { setDateTo(value); setDatePreset('custom'); setCurrentPage(1); }, onSortChange: (value) => { setActiveTab(value); setCurrentPage(1); }, onReset: resetFilters, onClose: () => setIsFilterDrawerOpen(false) }) }), activeFilterChips.length > 0 && (_jsxs("div", { className: "flex flex-wrap items-center gap-2", "aria-label": dt('Filtra aktivë'), children: [_jsx("span", { className: "mr-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400", children: dt('Filtra aktivë') }), activeFilterChips.map((chip) => _jsx(FilterChip, { label: chip.label, onRemove: chip.onRemove }, chip.id)), _jsxs("button", { type: "button", onClick: resetFilters, className: "ml-auto inline-flex min-h-8 items-center gap-1 text-xs font-black text-(--color-brand-primary) hover:underline", children: [_jsx(X, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), dt('Pastro filtrat')] })] })), !['loading', 'error'].includes(reportsStatus) && filteredReports.length > 0 && (_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm", children: [_jsxs("p", { className: "text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]", children: [_jsx("span", { className: "font-bold text-[var(--color-text)] dark:text-white", children: filteredReports.length }), " ", dt(`raportime të gjitha`), " (nga ", visibleReports.length, " publike)"] }), (searchQuery || selectedMunicipality || dateFrom || dateTo || activeTab !== 'dash_all') && (_jsxs("button", { onClick: resetFilters, className: "inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300", children: [_jsx(X, { className: "w-3 h-3" }), dt(`Pastro filtrat`)] }))] })), _jsx("div", { className: "space-y-6", children: reportsStatus === 'loading' ? (_jsx(StatePanel, { icon: _jsx(RefreshCw, { className: "h-7 w-7 animate-spin", "aria-hidden": "true" }), title: "Po ngarkohen raportimet", description: "Po marrim raportimet publike dhe statuset e tyre.", tone: "info" })) : reportsStatus === 'error' ? (_jsx(StatePanel, { icon: _jsx(WifiOff, { className: "h-7 w-7", "aria-hidden": "true" }), title: "Raportimet nuk mund t\u00EB ngarkohen", description: reportsError || 'Kontrolloni lidhjen ose lejet e qasjes dhe provoni përsëri.', actionLabel: "Provo p\u00EBrs\u00EBri", onAction: () => window.location.reload(), tone: "error", secondaryAction: _jsx(Link, { to: "/", className: "inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-bold text-(--color-brand-primary) hover:underline", children: "Kthehu n\u00EB ballin\u00EB" }) })) : reports.length === 0 ? (_jsx(StatePanel, { icon: _jsx(FilePlus2, { className: "h-7 w-7", "aria-hidden": "true" }), title: "Nuk ka ende raportime publike", description: "Raportimet e miratuara do t\u00EB shfaqen k\u00EBtu sapo t\u00EB publikohen.", actionLabel: "Raporto nj\u00EB problem", onAction: () => navigate('/raporto'), tone: "info" })) : filteredReports.length === 0 ? (_jsx(StatePanel, { icon: _jsx(Filter, { className: "h-7 w-7", "aria-hidden": "true" }), title: "Nuk u gjet\u00EBn raportime p\u00EBr filtrat e zgjedhur", description: "Ndryshoni k\u00EBrkimin ose pastroni komun\u00EBn, dat\u00EBn dhe statusin p\u00EBr t\u00EB par\u00EB m\u00EB shum\u00EB rezultate.", actionLabel: "Pastro t\u00EB gjith\u00EB filtrat", onAction: resetFilters })) : (_jsxs("div", { className: "overflow-hidden rounded-[14px] border border-(--color-border-soft) bg-(--color-surface) dark:border-white/10 dark:bg-slate-900", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-(--color-border-soft) bg-(--color-surface-subtle) px-4 py-3 dark:border-white/10 dark:bg-slate-800/60 sm:px-5", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-black text-(--color-text) dark:text-white", children: dt('Regjistri i raportimeve') }), _jsxs("p", { className: "mt-0.5 text-xs text-(--color-text-muted)", children: [filteredReports.length, " ", dt('raportime publike')] })] }), _jsx("span", { className: "hidden text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 sm:inline", children: dt('ID i raportimit') })] }), currentReports.map((report) => (_jsx(RegistryRow, { report: report, dt: dt, onOpen: () => setSelectedReportId(report.id), onShare: handleShare }, report.id)))] })) }), totalPages > 1 && (_jsx("div", { className: "py-8 flex justify-center", children: _jsxs("nav", { className: "flex items-center gap-2 bg-[var(--color-surface)] dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none w-full md:w-auto overflow-x-auto", children: [_jsx("button", { onClick: () => handlePageChange(currentPage - 1), disabled: currentPage === 1, className: "p-2 rounded-xl border border-slate-200 dark:border-white/10 text-[var(--color-text-muted)] hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-800 hover:text-[var(--color-text)] dark:text-white dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0", "aria-label": "Previous page", children: _jsx(ChevronLeft, { className: "w-5 h-5" }) }), _jsx("div", { className: "flex gap-1.5 overflow-x-auto hide-scrollbar px-2", children: Array.from({ length: totalPages }).map((_, idx) => {
                                const page = idx + 1;
                                // Show 5 pages around current page, or first/last
                                if (page === 1 ||
                                    page === totalPages ||
                                    (page >= currentPage - 2 && page <= currentPage + 2)) {
                                    return (_jsx("button", { onClick: () => handlePageChange(page), className: cn("w-10 h-10 rounded-xl font-bold text-sm transition-all shrink-0", currentPage === page
                                            ? "bg-indigo-600 text-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shadow-indigo-200 border-none"
                                            : "bg-transparent text-[var(--color-text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800 border border-transparent hover:border-slate-200 dark:border-white/10"), children: page }, page));
                                }
                                else if (page === currentPage - 3 ||
                                    page === currentPage + 3) {
                                    return _jsx("span", { className: "px-2 py-2 text-[var(--color-text-muted)] shrink-0", children: "..." }, page);
                                }
                                return null;
                            }) }), _jsx("button", { onClick: () => handlePageChange(currentPage + 1), disabled: currentPage === totalPages, className: "p-2 rounded-xl border border-slate-200 dark:border-white/10 text-[var(--color-text-muted)] hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-800 hover:text-[var(--color-text)] dark:text-white dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0", "aria-label": "Next page", children: _jsx(ChevronRight, { className: "w-5 h-5" }) })] }) })), selectedReportId && (_jsx(ReportDetailModal, { report: reports.find(r => r.id === selectedReportId), onClose: () => setSelectedReportId(null) }))] }));
}

import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { Download, Search, Trash2, FileText, Calendar, X, ChevronLeft, ChevronRight, CheckSquare, Square, Edit, MapPin, LayoutGrid, List, Cpu } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import ReportDetailModal from '../ReportDetailModal';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../lib/LanguageContext';
import { getAccountabilityProfile, getAccountabilityDueDate } from '../../lib/accountability';
export default function AdminReports({ department }) {
    const { dt } = useLanguage();
    const reports = useStore(state => state.reports);
    const deleteReport = useStore(state => state.deleteReport);
    const updateReportStatus = useStore(state => state.updateReportStatus);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMunicipality, setSelectedMunicipality] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [timeFilter, setTimeFilter] = useState('all');
    const [selectedReportId, setSelectedReportId] = useState(null);
    // View Toggle
    const [viewMode, setViewMode] = useState('list');
    // Pagination & Multi-select
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const itemsPerPage = 8; // keeping it low for nice list, but board will show more or scroll
    // AI Summary states
    const [aiSummary, setAiSummary] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const handleGetSummary = async () => {
        const reportsToSummarize = selectedIds.size > 0
            ? filteredReports.filter(r => selectedIds.has(r.id))
            : filteredReports;
        if (reportsToSummarize.length === 0) {
            alert("Nuk ka raporte të zgjedhura apo të filtruara për të krijuar përmbledhje.");
            return;
        }
        setLoadingSummary(true);
        setIsSummaryModalOpen(true);
        setAiSummary(null);
        try {
            const res = await fetch('/api/admin/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reports: reportsToSummarize })
            });
            const data = await res.json();
            if (res.ok && data.summary) {
                setAiSummary(data.summary);
            }
            else {
                setAiSummary(`Gabim: ${data.error || "Dështoi gjenerimi i përmbledhjes."}`);
            }
        }
        catch (e) {
            console.error(e);
            setAiSummary("Gabim gjatë kontaktit me serverin për gjenerimin e përmbledhjes me AI.");
        }
        finally {
            setLoadingSummary(false);
        }
    };
    let filteredReports = reports.filter(r => {
        if (!department)
            return true;
        const cat = r.category || '';
        const infra = ['infrastrukturë', 'urbanizëm', 'ambient', 'infrastrukturë rrugore'];
        const isInfra = infra.some(i => cat.toLowerCase().includes(i));
        if (department === 'infrastrukture')
            return isInfra;
        return !isInfra;
    });
    const now = new Date();
    if (timeFilter !== 'all') {
        filteredReports = filteredReports.filter(r => {
            const reportDate = new Date(r.createdAt);
            if (timeFilter === 'daily') {
                return reportDate.toDateString() === now.toDateString();
            }
            else if (timeFilter === 'weekly') {
                const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return reportDate >= oneWeekAgo;
            }
            else if (timeFilter === 'monthly') {
                const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                return reportDate >= oneMonthAgo;
            }
            return true;
        });
    }
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filteredReports = filteredReports.filter(r => r.title?.toLowerCase().includes(q) ||
            r.id?.toLowerCase().includes(q) ||
            r.location?.address?.toLowerCase().includes(q));
    }
    if (selectedMunicipality) {
        filteredReports = filteredReports.filter(r => r.location?.municipality === selectedMunicipality);
    }
    if (selectedStatus) {
        filteredReports = filteredReports.filter(r => r.status === selectedStatus);
    }
    // Calculate statistics
    const stats = useMemo(() => {
        return {
            total: filteredReports.length,
            pending: filteredReports.filter(r => r.status === 'Pending Review').length,
            inProgress: filteredReports.filter(r => r.status === 'In Progress' || r.status === 'Assigned' || r.status === 'Approved').length,
            resolved: filteredReports.filter(r => r.status === 'Resolved').length
        };
    }, [filteredReports]);
    // Pagination Logic
    const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
    const paginatedReports = filteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedReports.length && paginatedReports.length > 0) {
            setSelectedIds(new Set());
        }
        else {
            setSelectedIds(new Set(paginatedReports.map(r => r.id)));
        }
    };
    const toggleSelectBlock = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id))
            newSet.delete(id);
        else
            newSet.add(id);
        setSelectedIds(newSet);
    };
    const handleBulkAction = (action) => {
        if (!window.confirm(`A jeni të sigurt që dëshironi të kryeni këtë veprim për ${selectedIds.size} dosje?`))
            return;
        selectedIds.forEach(id => {
            const report = reports.find(r => r.id === id);
            if (action === 'delete') {
                deleteReport(id);
                console.log(`Raporti ${id} u fshi. Tracking notification sent to approval@ks.com`);
            }
            else if (action === 'approve') {
                updateReportStatus(id, 'Approved', 'Aprovuar masivisht.');
                console.log(`Raporti ${id} u aprovua. Tracking notification sent to approval@ks.com`);
            }
            else if (action === 'resolve') {
                updateReportStatus(id, 'Resolved', 'Zgjidhur masivisht.');
                console.log(`Raporti ${id} u zgjidh. Tracking notification sent to approval@ks.com`);
            }
        });
        setSelectedIds(new Set());
    };
    const handleStatusChange = (id, newStatus) => {
        updateReportStatus(id, newStatus, `Statusi u ndryshua në ${newStatus}`);
        console.log(`Raporti ${id} statusi u ndryshua në ${newStatus}. Tracking notification sent to approval@ks.com`);
    };
    const handleDownload = (format) => {
        if (format === 'csv') {
            const headers = ['ID', 'Titulli', 'Përshkrimi', 'Statusi', 'Kategoria', 'Urgjenca', 'Data e Raportimit', 'Komuna', 'Adresa', 'Lat', 'Lng', 'Raportuesi'];
            const csvRows = [headers.join(',')];
            filteredReports.forEach(r => {
                const row = [
                    r.id,
                    `"${r.title.replace(/"/g, '""')}"`,
                    `"${r.description.replace(/"/g, '""')}"`,
                    r.status,
                    r.category,
                    r.urgency,
                    new Date(r.createdAt).toISOString(),
                    r.location?.municipality || 'N/A',
                    `"${(r.location?.address || '').replace(/"/g, '""')}"`,
                    r.location?.lat || 0,
                    r.location?.lng || 0,
                    `"${r.isAnonymous ? 'Anonim' : (r.authorName || 'N/A')}"`
                ];
                csvRows.push(row.join(','));
            });
            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Raportet_${selectedMunicipality || 'Gjitha'}_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }
        const getCompetentOrgan = (category) => {
            const lowerCat = (category || '').toLowerCase();
            if (lowerCat.includes('komuna') && (lowerCat.includes('infrastrukturës') || lowerCat.includes('rrugë')))
                return 'Komuna - Infrastruktura Lokale';
            if (lowerCat.includes('ministria e infrastrukturës'))
                return 'Ministria e Infrastrukturës';
            if (lowerCat.includes('shëndetësisë') || lowerCat.includes('qkmf'))
                return 'Shëndetësia (QKMF / MSH)';
            if (lowerCat.includes('arsimit') || lowerCat.includes('kopshte') || lowerCat.includes('shkoll'))
                return 'Arsimi';
            if (lowerCat.includes('ujësjellësi') || lowerCat.includes('kru'))
                return 'Ujësjellësi Rajonal (KRU)';
            if (lowerCat.includes('kanalizimi'))
                return 'Komuna - Kanalizimi / Ujërat e zeza';
            if (lowerCat.includes('keds') || lowerCat.includes('kesco') || lowerCat.includes('ndriçimi'))
                return 'Energjia dhe Ndriçimi Publik';
            if (lowerCat.includes('pastrimi') || lowerCat.includes('mbeturin') || lowerCat.includes('deponi') || lowerCat.includes('mjedisi'))
                return 'Menaxhimi i Mbeturinave & Mjedisi';
            if (lowerCat.includes('policia') || lowerCat.includes('siguria') || lowerCat.includes('krim') || lowerCat.includes('aksident'))
                return 'Policia e Kosovës / MPB';
            if (lowerCat.includes('inspekcioni') || lowerCat.includes('ndërtime pa leje'))
                return 'Inspekcioni Komunal';
            if (lowerCat.includes('zjarrfikësit'))
                return 'Zjarrfikësit & Shpëtimi';
            if (lowerCat.includes('qentë') || lowerCat.includes('kafshët'))
                return 'Komuna - Trajtimi i Kafshëve';
            if (lowerCat.includes('transporti'))
                return 'Transporti Publik';
            if (lowerCat.includes('parqet'))
                return 'Komuna - Parqet dhe Gjelbërimi';
            return category || 'Kategori e Papërcaktuar';
        };
        const groupedReports = filteredReports.reduce((acc, report) => {
            const organ = getCompetentOrgan(report.category || '');
            if (!acc[organ])
                acc[organ] = [];
            acc[organ].push(report);
            return acc;
        }, {});
        let htmlContent = `
    <!DOCTYPE html>
    <html lang="sq">
    <head>
      <meta charset="UTF-8">
      <title>Dosja Zyrtare e Raporteve</title>
      <style>
        body { font-family: 'Inter', system-ui, sans-serif; margin: 40px; color: #111; line-height: 1.5; background: #fff; }
        .header { border-bottom: 4px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #0f172a; text-transform: uppercase; margin: 0 0 10px 0; font-size: 28px; font-weight: 900; letter-spacing: 1px; }
        .header p { margin: 0; color: #555; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        h2 { color: #e11d48; margin-top: 50px; border-bottom: 2px solid #eee; padding-bottom: 10px; text-transform: uppercase; font-size: 20px; font-weight: 900; letter-spacing: 1px; }
        .report-card { border: 2px solid #0f172a; padding: 24px; margin-bottom: 24px; page-break-inside: avoid; background: #fdfdfd; box-shadow: 6px 6px 0px #0f172a; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { text-align: left; padding: 8px 4px; border-bottom: 1px solid #e5e5e5; font-size: 13px; }
        th { width: 140px; font-weight: 800; text-transform: uppercase; color: #666; letter-spacing: 0.5px; }
        .status { padding: 4px 10px; font-weight: 900; text-transform: uppercase; font-size: 11px; background: #0f172a; color: white; display: inline-block; letter-spacing: 1px; margin-top: 8px; }
        .images { margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap; }
        .images img { max-width: 300px; max-height: 250px; border: 2px solid #0f172a; object-fit: cover; }
        .desc-title { font-weight: 900; text-transform: uppercase; font-size: 14px; margin-bottom: 5px; color: #0f172a; letter-spacing: 0.5px; margin-top: 20px; }
        .desc-content { font-size: 14px; color: #333; margin: 0; white-space: pre-wrap; }
        @media print {
          body { margin: 0; }
          .report-card { border: 2px solid #000; box-shadow: none; margin-bottom: 30px; }
          .header, h2 { break-before: auto; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Raportet dhe Aprovimet Qytetare</h1>
        <p>Gjeneruar më: ${new Date().toLocaleString('sq-AL')} | Lokalizimi: ${selectedMunicipality || 'E Tërë Kosova'}</p>
        <p>Të filtruara për kohën: ${timeFilter === 'daily' ? 'Ditore' : timeFilter === 'weekly' ? 'Javore' : timeFilter === 'monthly' ? 'Mujore' : 'Të Gjitha'}</p>
      </div>
    `;
        for (const [organ, reportsGroup] of Object.entries(groupedReports)) {
            htmlContent += `<h2>Institucioni Përgjegjës: ${organ.toUpperCase()}</h2>`;
            htmlContent += `<p style="font-weight: bold; font-size: 14px; text-transform: uppercase;">Totali i raporteve: <span style="background: #0f172a; color: white; padding: 2px 8px; border-radius: 12px;">${reportsGroup.length}</span></p>`;
            reportsGroup.forEach(r => {
                htmlContent += `
        <div class="report-card">
          <div class="grid">
            <div>
              <h3 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase;">Referenca: ${r.id}</h3>
              <h4 style="margin: 5px 0 0 0; font-size: 16px; font-weight: 600; color: #e11d48; text-transform: uppercase;">${r.title}</h4>
              <span class="status">${r.status}</span>
              <table>
                <tr><th>Kategoria</th><td><strong>${r.category}</strong></td></tr>
                <tr><th>Urgjenca</th><td>${r.urgency}</td></tr>
                <tr><th>Data e Hapjes</th><td>${new Date(r.createdAt).toLocaleString('sq-AL')}</td></tr>
                <tr><th>Raportuesi</th><td>${r.isAnonymous ? 'Anonim (Mbrojtur)' : r.authorName}</td></tr>
              </table>
            </div>
            <div>
              <div class="desc-title">Të Dhënat Gjeografike</div>
              <table>
                <tr><th>Komuna</th><td>${r.location?.municipality || 'N/A'}</td></tr>
                <tr><th>Adresa</th><td>${r.location?.address || 'N/A'}</td></tr>
              </table>
              <div class="desc-title">Përshkrimi</div>
              <p class="desc-content">${r.description}</p>
            </div>
          </div>
        </div>
        `;
            });
        }
        htmlContent += `
    </body>
    </html>
    `;
        if (format === 'pdf') {
            const printWindow = window.open('', '', 'width=800,height=600');
            if (printWindow) {
                printWindow.document.open();
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 250);
            }
            return;
        }
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Raportet.html`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'Resolved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'Pending Review': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'In Progress':
            case 'Assigned':
            case 'Approved': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Rejected': return 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/10';
            default: return 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/10';
        }
    };
    // Organize by columns for Board view
    const columns = [
        { id: 'Pending Review', title: 'Në Pritje' },
        { id: 'Approved', title: 'Aprovuar / Hapur' },
        { id: 'In Progress', title: 'Në Analizë' },
        { id: 'Resolved', title: 'Të Zgjidhura' }
    ];
    return (_jsxs("div", { className: "flex flex-col gap-6", children: [_jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [
                    { label: 'Totali', value: stats.total, color: 'text-slate-900 dark:text-white', bg: 'bg-white dark:bg-slate-900', border: 'border-slate-200/60 dark:border-white/10' },
                    { label: 'Në Pritje', value: stats.pending, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
                    { label: 'Në Proces', value: stats.inProgress, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
                    { label: 'Të Zgjidhura', value: stats.resolved, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' }
                ].map(stat => (_jsxs("div", { className: cn("p-4 rounded-xl border flex flex-col justify-center shadow-sm dark:shadow-none", stat.bg, stat.border), children: [_jsx("div", { className: "text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-widest", children: stat.label }), _jsx("div", { className: cn("text-3xl font-bold title-serif mt-1", stat.color), children: stat.value })] }, stat.label))) }), _jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl shadow-sm dark:shadow-none hover:shadow transition-all duration-300 flex flex-col max-w-full mx-auto w-full mb-6", children: [_jsxs("div", { className: "p-4 md:p-6 border-b border-slate-100 dark:border-white/5 flex flex-col xl:flex-row items-center justify-between gap-4 md:gap-6 bg-white dark:bg-slate-900 rounded-t-xl", children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-wrap items-center gap-3 md:gap-4 w-full xl:w-auto", children: [_jsxs("div", { className: "relative col-span-1 sm:col-span-2 lg:col-span-1 xl:w-80", children: [_jsx(Search, { className: "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-900 dark:text-white" }), _jsx("input", { type: "text", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), placeholder: dt(`KËRKO DOSJE...`), className: "w-full pl-10 md:pl-12 pr-4 py-2.5 md:py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 focus:bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-bold tracking-wide focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-300 ease-in-out placeholder:text-neutral-500 dark:text-slate-400" })] }), _jsxs("select", { value: selectedMunicipality, onChange: (e) => setSelectedMunicipality(e.target.value), className: "py-2.5 md:py-3 px-3 md:px-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 focus:bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-bold tracking-wide focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-300 ease-in-out", children: [_jsx("option", { value: "", children: dt(`LOKALITETI`) }), KOSOVO_MUNICIPALITIES.map(m => (_jsx("option", { value: m, children: m }, m)))] }), _jsxs("select", { value: selectedStatus, onChange: (e) => setSelectedStatus(e.target.value), className: "col-span-1 py-2.5 md:py-3 px-3 md:px-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 focus:bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-bold tracking-wide focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-300 ease-in-out", children: [_jsx("option", { value: "", children: dt(`TË GJITHA STATUSET`) }), _jsx("option", { value: "Pending Review", children: dt(`NË PRITJE`) }), _jsx("option", { value: "Approved", children: dt(`E HAPUR / APROVUAR`) }), _jsx("option", { value: "Assigned", children: dt(`E CAKTUAAR`) }), _jsx("option", { value: "In Progress", children: dt(`NË ANALIZË`) }), _jsx("option", { value: "Resolved", children: dt(`E PËRFUNDUAR`) }), _jsx("option", { value: "Rejected", children: dt(`E REFUZUAR`) }), _jsx("option", { value: "Overdue", children: dt(`MBI AFAT`) })] }), _jsxs("select", { value: timeFilter, onChange: (e) => setTimeFilter(e.target.value), className: "col-span-1 lg:col-span-1 xl:w-48 py-2.5 md:py-3 px-3 md:px-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 focus:bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-bold tracking-wide focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-300 ease-in-out", children: [_jsx("option", { value: "all", children: dt(`E GJITHË KOHA`) }), _jsx("option", { value: "daily", children: dt(`DITORE`) }), _jsx("option", { value: "weekly", children: dt(`JAVORE`) }), _jsx("option", { value: "monthly", children: dt(`MUJORE`) })] })] }), _jsxs("div", { className: "flex items-center gap-2 w-full xl:w-auto overflow-x-auto pb-1 xl:pb-0", children: [_jsxs("div", { className: "flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl mr-2", children: [_jsx("button", { onClick: () => setViewMode('list'), className: cn("p-2 rounded-2xl flex items-center justify-center transition-colors", viewMode === 'list' ? "bg-white dark:bg-slate-900 shadow-sm dark:shadow-none text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-500 dark:text-slate-400"), title: dt(`Pamja Tabelare`), children: _jsx(List, { className: "w-4 h-4" }) }), _jsx("button", { onClick: () => setViewMode('board'), className: cn("p-2 rounded-2xl flex items-center justify-center transition-colors", viewMode === 'board' ? "bg-white dark:bg-slate-900 shadow-sm dark:shadow-none text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-500 dark:text-slate-400"), title: dt(`Pamja Kanban (Bordi)`), children: _jsx(LayoutGrid, { className: "w-4 h-4" }) })] }), selectedIds.size > 0 ? (_jsxs(motion.div, { initial: { scale: 0.95, opacity: 0 }, animate: { scale: 1, opacity: 1 }, className: "flex items-center gap-2 bg-slate-900 px-2 py-1.5 rounded-xl shadow-sm dark:shadow-none border border-slate-800", children: [_jsxs("span", { className: "text-white text-xs font-bold px-2 whitespace-nowrap", children: [selectedIds.size, dt(`zgjedhur`)] }), _jsx("button", { onClick: () => handleBulkAction('approve'), className: "px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-colors", children: dt(`Aprovo`) }), _jsx("button", { onClick: () => handleBulkAction('resolve'), className: "px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold transition-colors", children: dt(`Zgjidh`) }), _jsxs("button", { onClick: handleGetSummary, className: "px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shadow-indigo-600/25", children: [_jsx(Cpu, { className: "w-3.5 h-3.5" }), dt(`Përmbledh me AI`)] }), _jsx("button", { onClick: () => handleBulkAction('delete'), className: "px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold transition-colors", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] })) : (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: handleGetSummary, className: "flex-1 whitespace-nowrap flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold tracking-wide text-[10px] xl:text-xs transition-all duration-300 rounded-xl border border-slate-950 flex items-center justify-center gap-1.5 shadow-sm dark:shadow-none shadow-slate-900/10", title: dt(`Gjenero Përmbledhje Ekzekutive me AI`), children: [_jsx(Cpu, { className: "w-4 h-4 text-rose-500 animate-pulse" }), dt(`Përmbledh me AI`)] }), _jsxs("button", { onClick: () => handleDownload('html'), className: "flex-1 whitespace-nowrap flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold tracking-wide text-[10px] xl:text-xs transition-colors rounded-xl border border-rose-200", title: dt(`Eksporto HTML`), children: [_jsx(FileText, { className: "w-4 h-4" }), dt(`HTML`)] }), _jsxs("button", { onClick: () => handleDownload('pdf'), className: "flex-1 whitespace-nowrap flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold tracking-wide text-[10px] xl:text-xs transition-colors rounded-xl border border-indigo-200", title: dt(`Eksporto PDF`), children: [_jsx(FileText, { className: "w-4 h-4" }), dt(`PDF`)] }), _jsxs("button", { onClick: () => handleDownload('csv'), className: "flex-1 whitespace-nowrap flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold tracking-wide text-[10px] xl:text-xs transition-colors rounded-xl border border-emerald-200", title: dt(`Eksporto CSV`), children: [_jsx(Download, { className: "w-4 h-4" }), dt(`CSV`)] })] }))] })] }), viewMode === 'list' ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "overflow-x-auto min-h-[400px] bg-white dark:bg-slate-900 relative rounded-b-xl", children: [_jsx("div", { className: "absolute top-0 right-0 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-4 py-2 text-[10px] font-bold tracking-widest uppercase border-b border-l border-slate-100 dark:border-white/5 z-10 rounded-bl-xl hidden sm:block", children: department === 'infrastrukture' ? 'Sektori Qendror: Infrastrukturë & Urbanizëm' : department === 'tjera' ? 'Sektori Sekondar: Tjera' : 'Gjitha Raportimet' }), _jsxs("table", { className: "w-full text-left text-sm whitespace-nowrap min-w-[900px]", children: [_jsx("thead", { className: "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] tracking-widest uppercase font-bold border-b border-slate-100 dark:border-white/5", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-4 w-12 text-center", children: _jsx("button", { onClick: toggleSelectAll, className: "text-slate-400 hover:text-slate-500 dark:text-slate-400", children: paginatedReports.length > 0 && selectedIds.size === paginatedReports.length ? (_jsx(CheckSquare, { className: "w-5 h-5 text-indigo-600" })) : (_jsx(Square, { className: "w-5 h-5" })) }) }), _jsx("th", { className: "px-6 py-4", children: dt(`Statusi & ID`) }), _jsx("th", { className: "px-6 py-4", children: dt(`Objekti Raportimit`) }), _jsx("th", { className: "px-6 py-4", children: dt(`Sektori & Urgjenca`) }), _jsx("th", { className: "px-6 py-4", children: dt(`Koha e Regjistrimit`) }), _jsx("th", { className: "px-6 py-4 text-right", children: dt(`Veprime`) })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: _jsx(AnimatePresence, { mode: "popLayout", children: paginatedReports.map((report) => {
                                                        const isSelected = selectedIds.has(report.id);
                                                        const accountability = getAccountabilityProfile(report.category);
                                                        const responseDueAt = report.responseDueAt || getAccountabilityDueDate(report.createdAt, accountability.responseHours);
                                                        const isOverdue = report.status !== 'Resolved' && new Date(responseDueAt).getTime() < Date.now();
                                                        return (_jsxs(motion.tr, { layout: true, initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, scale: 0.95 }, className: cn("hover:bg-slate-50 dark:bg-slate-800 transition-colors group", isSelected && "bg-indigo-50/50"), children: [_jsx("td", { className: "px-4 py-4 align-top text-center", children: _jsx("button", { onClick: () => toggleSelectBlock(report.id), className: "text-slate-400 hover:text-slate-500 dark:text-slate-400", children: isSelected ? _jsx(CheckSquare, { className: "w-5 h-5 text-indigo-600" }) : _jsx(Square, { className: "w-5 h-5" }) }) }), _jsx("td", { className: "px-6 py-4 align-top", children: _jsxs("div", { className: "flex flex-col gap-1.5 items-start", children: [_jsxs("select", { value: report.status, onChange: (e) => handleStatusChange(report.id, e.target.value), className: cn("px-2 py-1 text-[10px] uppercase font-bold tracking-widest rounded outline-none border focus:ring-2 focus:ring-indigo-500/20 cursor-pointer appearance-none transition-colors", getStatusColor(report.status)), children: [_jsx("option", { value: "Pending Review", children: dt(`Në Pritje`) }), _jsx("option", { value: "Approved", children: dt(`Aprovuar / Hapur`) }), _jsx("option", { value: "Assigned", children: dt(`Caktuar`) }), _jsx("option", { value: "In Progress", children: dt(`Në Analizë`) }), _jsx("option", { value: "Resolved", children: dt(`E Përfunduar`) }), _jsx("option", { value: "Rejected", children: dt(`E Refuzuar`) }), _jsx("option", { value: "Overdue", children: dt(`Mbi Afat`) })] }), _jsx("span", { className: "font-mono text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900", children: report.trackingId || `ZQ-${report.id.substring(0, 8).toUpperCase()}` }), report.assignedTo && _jsxs("span", { className: "text-[10px] font-bold tracking-widest text-indigo-600 truncate max-w-[120px] uppercase mt-1", children: [dt(`Ref:`), " ", report.assignedTo] }), _jsxs("span", { className: cn("text-[9px] font-bold truncate max-w-[180px]", isOverdue ? "text-rose-600" : "text-slate-400"), children: [isOverdue ? 'Përgjegjësi e vonuar' : 'Afati', ": ", new Date(responseDueAt).toLocaleDateString('sq-AL')] })] }) }), _jsxs("td", { className: "px-6 py-4 align-top", children: [_jsxs("div", { className: "flex items-start gap-3", children: [report.images?.[0] && _jsx("img", { src: report.images[0], alt: "", className: "w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-white/10 shrink-0" }), _jsx("p", { className: "font-bold text-slate-900 dark:text-white max-w-[250px] truncate text-sm hover:text-indigo-600 cursor-pointer transition-colors", onClick: () => setSelectedReportId(report.id), title: report.title, children: report.title })] }), _jsxs("div", { className: "flex items-center gap-1.5 mt-1 text-slate-500 dark:text-slate-400", children: [_jsx(MapPin, { className: "w-3.5 h-3.5 flex-shrink-0 text-slate-400" }), _jsx("p", { className: "text-[11px] font-bold tracking-wide truncate max-w-[230px] uppercase", children: report.location?.address || 'Nuk ka adresë' })] })] }), _jsx("td", { className: "px-6 py-4 align-top", children: _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("span", { className: "text-slate-900 dark:text-white font-bold text-xs truncate max-w-[200px]", children: dt(report.category) }), _jsx("span", { className: "text-[10px] font-bold text-blue-600 truncate max-w-[220px]", title: report.responsibleInstitution || accountability.institution, children: report.responsibleInstitution || accountability.institution }), _jsx("span", { className: cn("text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded w-max uppercase", report.urgency === 'Kritike' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                                                                                    report.urgency === 'E lartë' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                                                                        'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-white/5'), children: dt(report.urgency) })] }) }), _jsxs("td", { className: "px-6 py-4 text-slate-500 dark:text-slate-400 font-medium text-xs align-top", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Calendar, { className: "w-3.5 h-3.5 text-slate-400" }), _jsx("span", { className: "font-bold", children: format(new Date(report.createdAt), 'dd MMM yyyy') })] }), _jsx("div", { className: "text-slate-400 mt-0.5 ml-5.5 text-[10px] font-bold tracking-widest", children: format(new Date(report.createdAt), 'HH:mm') })] }), _jsx("td", { className: "px-6 py-4 text-right align-top", children: _jsxs("div", { className: "flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity", children: [_jsxs("button", { onClick: () => setSelectedReportId(report.id), className: "px-4 py-1.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 hover:border-indigo-600 hover:text-indigo-600 text-slate-500 dark:text-slate-400 rounded-2xl text-xs font-bold transition-colors shadow-sm dark:shadow-none flex items-center gap-2", children: [_jsx(Edit, { className: "w-3.5 h-3.5" }), dt(`Shiko`)] }), _jsx("button", { onClick: () => { if (window.confirm('A jeni i sigurt?'))
                                                                                    deleteReport(report.id); }, className: "p-1.5 bg-white dark:bg-slate-900 text-rose-500 hover:text-white border border-slate-200/60 dark:border-white/10 hover:bg-rose-500 hover:border-rose-500 rounded-2xl transition-colors shadow-sm dark:shadow-none", title: dt(`Fshij Dosjen`), children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] }) })] }, report.id));
                                                    }) }) })] }), paginatedReports.length === 0 && (_jsxs("div", { className: "text-center py-24", children: [_jsx("div", { className: "w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-white/5", children: _jsx(Search, { className: "w-8 h-8 text-slate-300" }) }), _jsx("p", { className: "text-slate-500 dark:text-slate-400 font-medium", children: dt(`Asnjë raport nuk u gjet me këto kritere.`) })] }))] }), totalPages > 1 && (_jsxs("div", { className: "px-6 py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800 rounded-b-xl flex items-center justify-between", children: [_jsxs("span", { className: "text-xs font-bold tracking-widest uppercase text-slate-400", children: [dt(`Duke shfaqur`), " ", (currentPage - 1) * itemsPerPage + 1, " - ", Math.min(currentPage * itemsPerPage, filteredReports.length), dt(`nga`), " ", filteredReports.length] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { onClick: () => setCurrentPage(p => Math.max(1, p - 1)), disabled: currentPage === 1, className: "p-1.5 rounded-xl hover:bg-slate-200 disabled:opacity-50 text-slate-500 dark:text-slate-400 transition-colors bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none", children: _jsx(ChevronLeft, { className: "w-5 h-5" }) }), _jsx("span", { className: "text-sm font-bold text-slate-900 dark:text-white min-w-[2.5rem] text-center", children: currentPage }), _jsx("button", { onClick: () => setCurrentPage(p => Math.min(totalPages, p + 1)), disabled: currentPage === totalPages, className: "p-1.5 rounded-xl hover:bg-slate-200 disabled:opacity-50 text-slate-500 dark:text-slate-400 transition-colors bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none", children: _jsx(ChevronRight, { className: "w-5 h-5" }) })] })] }))] })) : (
                    /* KANBAN BOARD VIEW */
                    _jsx("div", { className: "p-4 md:p-6 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl overflow-x-auto min-h-[500px]", children: _jsx("div", { className: "flex gap-4 min-w-max pb-4 h-full items-start", children: columns.map(col => {
                                const colReports = filteredReports.filter(r => r.status === col.id);
                                return (_jsxs("div", { className: "w-80 flex flex-col gap-3 h-full", children: [_jsxs("div", { className: "flex items-center justify-between mb-2 px-1", children: [_jsx("h3", { className: "text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400", children: col.title }), _jsx("span", { className: "bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm dark:shadow-none", children: colReports.length })] }), _jsxs("div", { className: "flex flex-col gap-3 flex-1", children: [colReports.map(report => (_jsxs(motion.div, { layoutId: `board-${report.id}`, className: "bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm dark:shadow-none hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-shadow border border-slate-200/60 dark:border-white/10 cursor-pointer group", onClick: () => setSelectedReportId(report.id), children: [_jsxs("div", { className: "flex justify-between items-start mb-2", children: [_jsxs("span", { className: "font-mono text-[9px] text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-white/5", children: ["#", report.id.substring(0, 6)] }), _jsx("span", { className: cn("text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded uppercase", report.urgency === 'Kritike' ? 'bg-rose-50 text-rose-600' :
                                                                        report.urgency === 'E lartë' ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'), children: dt(report.urgency) })] }), _jsx("h4", { className: "font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors leading-snug", children: report.title }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-2 truncate", children: dt(report.category) }), _jsxs("div", { className: "flex justify-between items-center mt-4 pt-3 border-t border-slate-50", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-slate-400", children: [_jsx(Calendar, { className: "w-3.5 h-3.5" }), _jsx("span", { className: "text-[10px] font-bold tracking-widest uppercase", children: format(new Date(report.createdAt), 'dd MMM') })] }), _jsxs("select", { onClick: (e) => e.stopPropagation(), value: report.status, onChange: (e) => handleStatusChange(report.id, e.target.value), className: "px-2 py-1 text-[9px] uppercase font-bold tracking-widest rounded outline-none border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer text-slate-500 dark:text-slate-400 appearance-none transition-colors", children: [_jsx("option", { value: "Pending Review", children: dt(`Dërgo në Pritje`) }), _jsx("option", { value: "Approved", children: dt(`Aprovo / Hapur`) }), _jsx("option", { value: "Assigned", children: dt(`Cakto`) }), _jsx("option", { value: "In Progress", children: dt(`Analizo`) }), _jsx("option", { value: "Resolved", children: dt(`Përfundo`) }), _jsx("option", { value: "Overdue", children: dt(`Shëno mbi afat`) })] })] })] }, report.id))), colReports.length === 0 && (_jsx("div", { className: "h-24 border-2 border-dashed border-slate-200/60 dark:border-white/10 rounded-xl flex items-center justify-center text-slate-400 text-[10px] font-bold tracking-widest uppercase bg-slate-50 dark:bg-slate-800/50", children: dt(`Boshe`) }))] })] }, col.id));
                            }) }) }))] }), selectedReportId && (_jsx(ReportDetailModal, { report: reports.find(r => r.id === selectedReportId), onClose: () => setSelectedReportId(null) })), _jsx(AnimatePresence, { children: isSummaryModalOpen && (_jsx("div", { className: "fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[500] flex items-center justify-center p-4", children: _jsxs(motion.div, { initial: { opacity: 0, scale: 0.95, y: 20 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.95, y: 20 }, className: "bg-white dark:bg-slate-900 border-2 border-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden", children: [_jsxs("div", { className: "bg-slate-900 text-white p-5 flex justify-between items-center border-b-2 border-slate-900", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-9 h-9 border border-rose-500 bg-rose-500/10 flex items-center justify-center rounded-2xl", children: _jsx(Cpu, { className: "w-5 h-5 text-rose-500 animate-pulse" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-sm tracking-wide uppercase", children: dt(`Përmbledhje Ekzekutive me AI`) }), _jsx("p", { className: "text-[10px] text-slate-400 font-bold tracking-wider mt-0.5", children: dt(`Analizë Inteligjente për Aksion Municipal`) })] })] }), _jsx("button", { onClick: () => setIsSummaryModalOpen(false), className: "p-1.5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-colors", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar", children: loadingSummary ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center gap-4", children: [_jsxs("div", { className: "relative w-16 h-16", children: [_jsx("div", { className: "absolute inset-0 rounded-full border-4 border-slate-100 dark:border-white/5 border-t-indigo-600 animate-spin" }), _jsx(Cpu, { className: "w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-bold text-slate-900 dark:text-white tracking-wide text-sm uppercase", children: dt(`Duke Sintetizuar Raportet me Gemini AI...`) }), _jsx("p", { className: "text-xs font-medium text-slate-500 dark:text-slate-400 mt-2", children: dt(`Kjo mund të marrë disa sekonda. Duke analizuar korrelacionet gjeografike dhe ankesat e komunitetit.`) })] })] })) : aiSummary ? (_jsxs("div", { className: "prose prose-slate max-w-none", children: [_jsxs("div", { className: "bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 p-5 rounded-xl text-xs font-mono text-slate-500 dark:text-slate-400 mb-6 flex justify-between items-center", children: [_jsxs("div", { children: [_jsx("span", { className: "font-bold uppercase tracking-wider text-[10px] text-slate-500 dark:text-slate-400", children: dt(`Masa e Analizuar:`) }), _jsx("p", { className: "font-bold text-slate-800 dark:text-slate-200 dark:text-slate-200 text-sm mt-0.5", children: selectedIds.size > 0
                                                                ? `${selectedIds.size} raste të përzgjedhura manualisht`
                                                                : `${filteredReports.length} raste bazuar në filtrat aktualë` })] }), _jsxs("div", { className: "text-right", children: [_jsx("span", { className: "font-bold uppercase tracking-wider text-[10px] text-slate-500 dark:text-slate-400", children: dt(`Data e Analizës:`) }), _jsx("p", { className: "font-bold text-slate-800 dark:text-slate-200 dark:text-slate-200 mt-0.5", children: format(new Date(), 'dd.MM.yyyy HH:mm') })] })] }), _jsx("div", { className: "space-y-6 text-slate-800 dark:text-slate-200 dark:text-slate-200 leading-relaxed text-sm", children: aiSummary.split('\n').map((line, idx) => {
                                                if (line.startsWith('###')) {
                                                    return (_jsx("h4", { className: "text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2 mt-4 uppercase text-xs tracking-wider", children: line.replace('###', '').trim() }, idx));
                                                }
                                                if (line.startsWith('-') || line.startsWith('*')) {
                                                    return (_jsxs("div", { className: "flex gap-2.5 items-start pl-2", children: [_jsx("span", { className: "text-rose-500 font-bold mt-1 shrink-0", children: "\u2022" }), _jsx("p", { className: "text-slate-700 dark:text-slate-300 font-medium text-xs md:text-sm", children: line.replace(/^[-*]\s*/, '').trim() })] }, idx));
                                                }
                                                if (line.trim() === '')
                                                    return null;
                                                return (_jsx("p", { className: "text-slate-700 dark:text-slate-300 font-medium text-xs md:text-sm pl-1", children: line }, idx));
                                            }) })] })) : (_jsx("div", { className: "text-center py-12 text-slate-400", children: dt(`Nuk ka të dhëna të disponueshme.`) })) }), !loadingSummary && aiSummary && (_jsxs("div", { className: "bg-slate-50 dark:bg-slate-800 border-t border-slate-200/60 dark:border-white/10 p-4 md:px-6 flex flex-col sm:flex-row justify-between items-center gap-3", children: [_jsx("span", { className: "text-[10px] font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase", children: dt(`Gjeneruar me Gemini 3.5 Flash`) }), _jsxs("div", { className: "flex gap-3 w-full sm:w-auto", children: [_jsx("button", { onClick: () => {
                                                    navigator.clipboard.writeText(aiSummary);
                                                    alert("Përmbledhja u kopjua në clipboard!");
                                                }, className: "flex-1 sm:flex-none px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl tracking-wide uppercase transition-colors", children: dt(`Kopjo Raportin`) }), _jsx("button", { onClick: () => {
                                                    const blob = new Blob([aiSummary], { type: 'text/plain;charset=utf-8;' });
                                                    const url = URL.createObjectURL(blob);
                                                    const link = document.createElement("a");
                                                    link.setAttribute("href", url);
                                                    link.setAttribute("download", `AI_Permbledhje_Komunale_${new Date().toISOString().split('T')[0]}.txt`);
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                }, className: "flex-1 sm:flex-none px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800 border border-slate-300 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl tracking-wide uppercase transition-colors", children: dt(`Eksporto si TXT`) })] })] }))] }) })) })] }));
}

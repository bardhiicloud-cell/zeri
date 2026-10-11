import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Clock3, FileText, Image as ImageIcon, MapPin, Search, ShieldCheck, Video } from 'lucide-react';
import { useStore } from '../lib/store';
import { db } from '../lib/firebase';
import { getAccountabilityProfile, getAccountabilityDueDate } from '../lib/accountability';
import { getGuestReportHistory } from '../lib/session';
const statusLabels = {
    Draft: 'Draft',
    'Pending Review': 'Në shqyrtim',
    Approved: 'Aprovuar',
    Assigned: 'Caktuar për trajtim',
    'In Progress': 'Në trajtim',
    Resolved: 'E zgjidhur',
    Rejected: 'E refuzuar',
    Overdue: 'Me afat të kaluar'
};
const statusColors = {
    Draft: 'bg-slate-100 text-slate-700',
    'Pending Review': 'bg-amber-100 text-amber-800',
    Approved: 'bg-blue-100 text-blue-800',
    Assigned: 'bg-indigo-100 text-indigo-800',
    'In Progress': 'bg-sky-100 text-sky-800',
    Resolved: 'bg-emerald-100 text-emerald-800',
    Rejected: 'bg-rose-100 text-rose-800',
    Overdue: 'bg-orange-100 text-orange-800'
};
function normalizeReport(data, id) {
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000).toISOString() : data.createdAt;
    return { ...data, id, createdAt: createdAt || new Date().toISOString(), timeline: Array.isArray(data.timeline) ? data.timeline : [] };
}
export default function TrackIdPage() {
    const reports = useStore(state => state.reports || []);
    const [searchParams, setSearchParams] = useSearchParams();
    const [input, setInput] = useState(searchParams.get('id') || '');
    const [report, setReport] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const guestHistory = getGuestReportHistory();
    const searchReport = async (value) => {
        const trackingId = value.trim().toUpperCase();
        if (!trackingId)
            return;
        setIsSearching(true);
        setNotFound(false);
        setSearchParams({ id: trackingId });
        const localReport = reports.find(item => (item.trackingId || '').toUpperCase() === trackingId || item.id.toUpperCase() === trackingId);
        if (localReport) {
            setReport(localReport);
            setIsSearching(false);
            return;
        }
        const guestLocalReport = guestHistory.find(item => item.trackingId.toUpperCase() === trackingId || item.id.toUpperCase() === trackingId);
        if (guestLocalReport) {
            setReport({
                id: guestLocalReport.id,
                trackingId: guestLocalReport.trackingId,
                title: guestLocalReport.title,
                description: guestLocalReport.description || 'Raportimi u regjistrua në pajisjen tuaj dhe po pret procesimin e mëtejshëm.',
                category: guestLocalReport.category || 'Të tjera',
                status: guestLocalReport.status || 'Pending Review',
                location: { municipality: guestLocalReport.municipality || 'Pa komunë', address: 'Raportim nga pajisja e përdoruesit', lat: 0, lng: 0 },
                images: [],
                createdAt: guestLocalReport.createdAt,
                timeline: [{ id: `guest-${Date.now()}`, status: 'Pending Review', date: guestLocalReport.createdAt, updatedBy: 'Sistemi' }],
                responsibleInstitution: 'Në pritje të caktimit',
                responsibleLevel: 'Lokal',
                responsibleOffice: 'Sistemi i raportimeve',
                accountabilityStatus: 'Në pritje',
                municipality: guestLocalReport.municipality || 'Pa komunë',
                authorName: 'Mysafir',
                isAnonymous: true,
                urgency: 'Mesatare',
                authorId: 'guest',
                upvotes: 0,
                commentsCount: 0,
                media: []
            });
            setIsSearching(false);
            return;
        }
        try {
            const snapshot = await getDocs(query(collection(db, 'reports'), where('trackingId', '==', trackingId), limit(1)));
            if (!snapshot.empty) {
                const item = snapshot.docs[0];
                setReport(normalizeReport(item.data(), item.id));
            }
            else {
                setReport(null);
                setNotFound(true);
            }
        }
        catch (error) {
            console.error('Track ID lookup failed:', error);
            setReport(null);
            setNotFound(true);
        }
        finally {
            setIsSearching(false);
        }
    };
    useEffect(() => {
        const initialId = searchParams.get('id');
        if (initialId)
            searchReport(initialId);
    }, []);
    return (_jsx("div", { className: "min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 sm:px-6 lg:px-8", children: _jsxs("div", { className: "max-w-4xl mx-auto space-y-6", children: [_jsxs("header", { className: "bg-slate-950 text-white rounded-3xl p-6 sm:p-10 relative overflow-hidden", children: [_jsx("div", { className: "absolute -right-20 -top-20 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl" }), _jsxs("div", { className: "relative z-10", children: [_jsxs("div", { className: "flex items-center gap-3 text-blue-300 text-xs font-black uppercase tracking-[0.18em]", children: [_jsx(ShieldCheck, { className: "w-5 h-5" }), " Gjurmimi i raportimit"] }), _jsx("h1", { className: "text-3xl sm:text-5xl font-black mt-4", children: "Gjej raportimin t\u00EBnd" }), _jsx("p", { className: "text-sm sm:text-base text-slate-300 mt-3 max-w-2xl", children: "Vendos Track ID p\u00EBr t\u00EB par\u00EB statusin, historin\u00EB e veprimeve, fotot dhe p\u00EBrgjigjen e institucionit." })] })] }), _jsxs("form", { onSubmit: event => { event.preventDefault(); searchReport(input); }, className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row gap-3", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Search, { className: "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" }), _jsx("input", { value: input, onChange: event => setInput(event.target.value), placeholder: "p.sh. ZQ-ABC12345", className: "w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono font-bold uppercase outline-none focus:border-blue-500" })] }), _jsx("button", { disabled: isSearching || !input.trim(), className: "px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black disabled:opacity-50", children: isSearching ? 'Duke kërkuar...' : 'Kërko Track ID' })] }), guestHistory.length > 0 && (_jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4", children: [_jsx("div", { className: "mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500", children: "Raportimet e tua" }), _jsx("div", { className: "flex flex-wrap gap-2", children: guestHistory.slice(0, 10).map(item => (_jsx("button", { onClick: () => { setInput(item.trackingId); searchReport(item.trackingId); }, className: "rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-black text-blue-700 hover:bg-blue-100", children: item.trackingId }, item.trackingId))) })] })), notFound && _jsx("div", { className: "bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-5 text-sm font-semibold", children: "Nuk u gjet raportimi me k\u00EBt\u00EB Track ID. Kontrollo shkronjat dhe provo p\u00EBrs\u00EBri." }), report && (_jsxs("main", { className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden", children: [_jsxs("div", { className: "p-6 sm:p-8 border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-black uppercase tracking-widest text-blue-600", children: "Track ID" }), _jsx("p", { className: "font-mono text-2xl font-black text-slate-900 dark:text-white mt-1", children: report.trackingId || report.id }), _jsx("h2", { className: "text-xl font-black text-slate-900 dark:text-white mt-4", children: report.title })] }), _jsx("span", { className: `px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap ${statusColors[report.status]}`, children: statusLabels[report.status] })] }), _jsxs("div", { className: "p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8", children: [_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30", children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-widest text-blue-600", children: "P\u00EBrgjegj\u00EBsia institucionale" }), _jsx("p", { className: "mt-1 text-sm font-black text-slate-900 dark:text-white", children: report.responsibleInstitution || getAccountabilityProfile(report.category).institution }), _jsxs("p", { className: "mt-1 text-xs text-slate-500", children: ["Zyra: ", report.responsibleOffice || getAccountabilityProfile(report.category).office, " \u00B7 Afati: ", report.responseDueAt ? new Date(report.responseDueAt).toLocaleString('sq-AL') : new Date(getAccountabilityDueDate(report.createdAt, getAccountabilityProfile(report.category).responseHours)).toLocaleString('sq-AL')] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm", children: [_jsxs("div", { className: "p-4 rounded-xl bg-slate-50 dark:bg-slate-800", children: [_jsx(MapPin, { className: "w-4 h-4 text-blue-600 mb-2" }), _jsx("strong", { children: report.location?.municipality || 'Pa komunë' }), _jsx("p", { className: "text-slate-500 mt-1", children: report.location?.address || 'Pa adresë' })] }), _jsxs("div", { className: "p-4 rounded-xl bg-slate-50 dark:bg-slate-800", children: [_jsx(Calendar, { className: "w-4 h-4 text-blue-600 mb-2" }), _jsx("strong", { children: "D\u00EBrguar" }), _jsx("p", { className: "text-slate-500 mt-1", children: new Date(report.createdAt).toLocaleString('sq-AL') })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "font-black text-slate-900 dark:text-white mb-2", children: "P\u00EBrshkrimi" }), _jsx("p", { className: "text-sm leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap", children: report.description })] }), _jsxs("div", { children: [_jsx("h3", { className: "font-black text-slate-900 dark:text-white mb-3", children: "Historia e trajtimit" }), _jsx("div", { className: "space-y-3", children: (report.timeline || []).length === 0 ? _jsx("p", { className: "text-sm text-slate-500", children: "Raporti \u00EBsht\u00EB pranuar dhe pret shqyrtimin e par\u00EB." }) : report.timeline.map(event => _jsxs("div", { className: "flex gap-3", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-blue-600 mt-2 shrink-0" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-bold text-slate-900 dark:text-white", children: statusLabels[event.status] || event.status }), _jsxs("p", { className: "text-xs text-slate-500", children: [new Date(event.date).toLocaleString('sq-AL'), " \u00B7 ", event.updatedBy] }), event.comment && _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-300 mt-1", children: event.comment })] })] }, event.id)) })] })] }), _jsxs("aside", { children: [_jsx("h3", { className: "font-black text-slate-900 dark:text-white mb-3", children: "D\u00EBshmit\u00EB e raportimit" }), report.images?.length || report.media?.length ? _jsx("div", { className: "grid grid-cols-2 gap-3", children: (report.media || report.images.map(url => ({ url, type: 'image' }))).map((media, index) => media.type === 'video' ? _jsx("video", { src: media.url, controls: true, className: "w-full aspect-square object-cover rounded-xl bg-slate-900" }, `${media.url}-${index}`) : _jsx("img", { src: media.url, alt: `Dëshmi ${index + 1}`, className: "w-full aspect-square object-cover rounded-xl" }, `${media.url}-${index}`)) }) : _jsxs("div", { className: "p-6 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-slate-500 flex items-center gap-2", children: [_jsx(FileText, { className: "w-4 h-4" }), " Pa media t\u00EB bashkangjitura"] }), _jsxs("div", { className: "mt-5 text-xs text-slate-500 space-y-2", children: [_jsxs("p", { className: "flex items-center gap-2", children: [_jsx(Clock3, { className: "w-4 h-4" }), " Statusi p\u00EBrdit\u00EBsohet nga stafi gjat\u00EB trajtimit."] }), _jsxs("p", { className: "flex items-center gap-2", children: [_jsx(ImageIcon, { className: "w-4 h-4" }), " Fotot dhe videot ruhen si d\u00EBshmi e rastit."] }), _jsxs("p", { className: "flex items-center gap-2", children: [_jsx(Video, { className: "w-4 h-4" }), " Track ID p\u00EBrdoret p\u00EBr k\u00EBt\u00EB raportim."] })] })] })] }), report.status === 'Resolved' && report.resolvedImage && _jsxs("div", { className: "p-6 sm:p-8 border-t border-slate-200 dark:border-white/10", children: [_jsx("h3", { className: "font-black text-slate-900 dark:text-white mb-3", children: "D\u00EBshmia pas zgjidhjes" }), _jsx("img", { src: report.resolvedImage, alt: "D\u00EBshmi pas zgjidhjes", className: "max-w-xl w-full rounded-2xl" })] })] }))] }) }));
}

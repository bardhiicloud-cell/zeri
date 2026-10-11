import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useStore } from '../lib/store';
import { formatDistanceToNow } from 'date-fns';
import { sq } from 'date-fns/locale';
import { ThumbsUp, MessageCircle, MapPin, X, Send, User as UserIcon, Edit3, Trash2, Share2, Wand2, ArrowUpRight, ChevronLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { validateComment } from '../lib/moderation';
import { useLanguage } from '../lib/LanguageContext';
const statusConfig = {
    'Pending Review': { label: 'Në Pritje', classes: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
    'Approved': { label: 'Aprovuar', classes: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
    'Assigned': { label: 'Caktuar', classes: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    'In Progress': { label: 'Në Progres', classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    'Resolved': { label: 'E Zgjidhur', classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    'Rejected': { label: 'Refuzuar', classes: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' }
};
export default function ReportDetailModal({ report, onClose }) {
    const { t, dt, language } = useLanguage();
    const currentUser = useStore(state => state.currentUser);
    const upvoteReport = useStore(state => state.upvoteReport);
    const updateReport = useStore(state => state.updateReport);
    const addComment = useStore(state => state.addComment);
    const updateReportStatus = useStore(state => state.updateReportStatus);
    const [commentText, setCommentText] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [resolvingStatus, setResolvingStatus] = useState(false);
    const [resolvedImageUrl, setResolvedImageUrl] = useState('');
    // Calculate Community Impact & Urgency Score
    const getImpactScore = () => {
        let catWeight = 15;
        const cat = report.category || '';
        if (cat.includes('rrug') || cat.includes('Infrastrukturë'))
            catWeight = 30;
        else if (cat.includes('Mbeturina') || cat.includes('Ndotje'))
            catWeight = 25;
        else if (cat.includes('Ndriçim'))
            catWeight = 20;
        else if (cat.includes('Ujë') || cat.includes('Kanalizim'))
            catWeight = 30;
        else if (cat.includes('Siguri'))
            catWeight = 35;
        let urgWeight = 10;
        const urg = report.urgency || '';
        if (urg === 'Kritike')
            urgWeight = 45;
        else if (urg === 'E lartë')
            urgWeight = 35;
        else if (urg === 'Mesatare')
            urgWeight = 20;
        else if (urg === 'E ulët')
            urgWeight = 10;
        const upvotesCount = report.upvotes || 0;
        const commentsCount = (report.comments && report.comments.length) || report.commentsCount || 0;
        const total = Math.min(100, catWeight + urgWeight + (upvotesCount * 5) + (commentsCount * 5));
        return total;
    };
    const impactScore = getImpactScore();
    const getImpactLabel = (score) => {
        if (score >= 80)
            return { label: 'Prioritet i Jashtëzakonshëm', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' };
        if (score >= 50)
            return { label: 'Prioritet i Lartë', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
        return { label: 'Prioritet Normal', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
    };
    const impactInfo = getImpactLabel(impactScore);
    const handleStatusChangeClick = (status) => {
        if (status === 'Resolved') {
            const url = prompt("Ju lutem ngarkoni foton si provë e punës së kryer (Before & After): (Opsionale URL)");
            updateReportStatus(report.id, status, adminResponse || adminReason || "Puna u krye me sukses.", url || undefined);
        }
        else {
            updateReportStatus(report.id, status, adminResponse || adminReason);
        }
    };
    const [editForm, setEditForm] = useState({
        title: report.title,
        description: report.description,
        category: report.category,
        urgency: report.urgency,
        images: [...report.images],
        address: report.location?.address || ''
    });
    const [aiResponseGenerating, setAiResponseGenerating] = useState(false);
    const [adminReason, setAdminReason] = useState('');
    const [adminResponse, setAdminResponse] = useState('');
    const generateAIResponse = async () => {
        if (!adminReason) {
            alert("Ju lutem shënoni një arsye të shkurtër (psh. nuk është pronë komunale).");
            return;
        }
        setAiResponseGenerating(true);
        try {
            const res = await fetch('/api/admin/generate-response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: report.title,
                    description: report.description,
                    reason: adminReason
                })
            });
            const data = await res.json();
            setAdminResponse(data.response);
        }
        catch (e) {
            console.error(e);
        }
        setAiResponseGenerating(false);
    };
    const handleAddImage = () => {
        const url = prompt("Vendos URL-në e fotos së re:");
        if (url) {
            setEditForm(prev => ({ ...prev, images: [...prev.images, url] }));
        }
    };
    const handleShare = async () => {
        const url = `${window.location.origin}/detailed-registry?report=${encodeURIComponent(report.id)}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Raportim: ${report.title}`,
                    text: `Shikoni këtë raportim qytetar: "${report.title}"`,
                    url: url
                });
            }
            catch (err) {
                console.error("Gabim gjatë shpërndarjes:", err);
            }
        }
        else {
            navigator.clipboard.writeText(url);
            alert("Linku është kopjuar!");
        }
    };
    const handleRemoveImage = (index) => {
        setEditForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    };
    const handleAddComment = (e) => {
        e.preventDefault();
        if (!commentText.trim())
            return;
        if (!currentUser) {
            alert("Kërkohet kyçje për të komentuar.");
            return;
        }
        const validation = validateComment(commentText);
        if (!validation.valid) {
            alert(validation.error);
            return;
        }
        addComment(report.id, commentText, currentUser);
        setCommentText('');
    };
    const handleSaveEdit = () => {
        updateReport(report.id, {
            title: editForm.title,
            description: editForm.description,
            category: editForm.category,
            urgency: editForm.urgency,
            images: editForm.images,
            location: {
                lat: report.location?.lat || 0,
                lng: report.location?.lng || 0,
                municipality: report.location?.municipality || 'Prishtinë',
                address: editForm.address
            }
        });
        setIsEditing(false);
    };
    return (_jsxs("div", { className: "fixed inset-0 z-[500] flex items-center justify-center p-0 md:p-6 overflow-y-auto", children: [_jsx("div", { className: "fixed inset-0 bg-slate-900/95 backdrop-blur-md transition-opacity", onClick: onClose }), _jsxs("div", { className: "relative bg-black border-0 md:border md:border-neutral-800 shadow-2xl rounded-none md:rounded-[1.25rem] w-full h-full md:h-[90vh] md:max-w-6xl flex flex-col md:flex-row overflow-hidden", children: [_jsxs("div", { className: "absolute top-4 left-4 right-4 z-[600] flex items-center justify-between", children: [_jsxs("button", { type: "button", "aria-label": "Kthehu", onClick: onClose, className: "flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 py-2 text-xs font-bold text-white backdrop-blur-md transition hover:bg-black/40", children: [_jsx(ChevronLeft, { className: "h-4 w-4" }), _jsx("span", { children: dt('Kthehu') })] }), _jsx("button", { "aria-label": "Mbyll", onClick: onClose, className: "w-12 h-12 flex items-center justify-center bg-white/10 text-white hover:bg-white/20 hover:text-white rounded-full transition-colors shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)] backdrop-blur-md", children: _jsx(X, { className: "w-6 h-6" }) })] }), _jsxs("div", { className: "w-full h-[60vh] md:h-full md:w-[60%] flex flex-col relative bg-neutral-900 overflow-hidden", children: [report.resolvedImage ? (_jsxs("div", { className: "absolute inset-0 w-full h-full flex z-0 overflow-x-auto snap-x snap-mandatory scrollbar-hide", children: [_jsxs("div", { className: "w-full h-full flex-shrink-0 snap-center relative", children: [_jsx("div", { className: "absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900 dark:bg-slate-800 text-white dark:text-white px-3 py-1 text-xs font-bold rounded shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] uppercase tracking-widest border border-slate-700", children: dt(`Para Ndërhyrjes`) }), _jsx("img", { src: report.images[0] || report.media?.[0]?.url, className: "absolute inset-0 w-full h-full object-cover", alt: "Para" })] }), _jsxs("div", { className: "w-full h-full flex-shrink-0 snap-center relative border-l-4 border-emerald-500", children: [_jsx("div", { className: "absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-emerald-600 text-white px-3 py-1 text-xs font-bold rounded shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] uppercase tracking-widest border border-emerald-500", children: dt(`Pas Ndërhyrjes`) }), _jsx("img", { src: report.resolvedImage, className: "absolute inset-0 w-full h-full object-cover", alt: "Pas" })] }), _jsx("div", { className: "absolute top-1/2 -mt-4 right-4 z-20 pointer-events-none", children: _jsx("span", { className: "bg-emerald-600/90 text-white text-[10px] uppercase tracking-widest px-2 py-1 rounded backdrop-blur border border-emerald-500/50 whitespace-nowrap shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)]", children: dt(`Glisni &rarr;`) }) })] })) : report.media && report.media.length > 0 ? (_jsxs("div", { className: "absolute inset-0 w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide z-0", children: [report.media.map((item, idx) => (_jsx("div", { className: "w-full h-full flex-shrink-0 snap-center relative", children: item.type === 'image' ? (_jsx("img", { src: item.url, className: "absolute inset-0 w-full h-full object-cover", alt: `${report.title} - ${idx}` })) : (_jsx("video", { src: item.url, className: "absolute inset-0 w-full h-full object-cover pointer-events-auto", controls: true, playsInline: true })) }, idx))), (report.media.length > 1) && (_jsx("div", { className: "absolute top-1/2 -mt-4 right-4 z-20 pointer-events-none", children: _jsx("span", { className: "bg-black/60 text-white text-[10px] uppercase tracking-widest px-2 py-1 rounded backdrop-blur whitespace-nowrap", children: dt(`Glisni &rarr;`) }) }))] })) : report.images && report.images.length > 0 ? (_jsx("img", { src: report.images[0], className: "absolute inset-0 w-full h-full object-cover z-0", alt: report.title })) : (_jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-slate-800 text-white z-0", children: _jsx("span", { className: "text-xl font-bold title-serif", children: dt(`Nuk ka foto`) }) })), _jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none z-10" }), _jsxs("div", { className: "absolute top-4 left-4 right-4 flex justify-between items-start z-10", children: [_jsx("div", { className: "bg-black/50 backdrop-blur-md text-white px-3 py-1.5 text-xs font-bold tracking-wide rounded-2xl flex flex-col items-center border border-white/10", children: _jsx("span", { children: formatDistanceToNow(new Date(report.createdAt), { locale: sq }) }) }), _jsx("span", { className: cn("px-3 py-1.5 text-xs font-bold tracking-wide rounded-full border shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)] backdrop-blur-md", report.status === 'Resolved' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' :
                                            report.status === 'Rejected' ? 'bg-rose-500/20 text-rose-500 border-rose-500/30' :
                                                'bg-amber-500/20 text-amber-500 border-amber-500/30'), children: dt(report.status) })] }), _jsxs("div", { className: "absolute bottom-0 inset-x-0 p-6 md:p-8 flex flex-col z-10", children: [_jsxs("div", { className: "flex gap-2 flex-wrap mb-3", children: [_jsx("span", { className: "inline-block px-3 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-bold border border-white/20 tracking-wide rounded-xl w-fit", children: dt(report.category) }), report.isAd && (_jsx("span", { className: "inline-block px-3 py-1 bg-slate-900 backdrop-blur-md text-white text-xs font-bold border border-slate-900/50 tracking-wide rounded-xl w-fit", children: dt(`Sponsorizuar`) }))] }), report.isAd && report.adLink && (_jsxs("a", { href: report.adLink, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold rounded-2xl mb-4 w-fit hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800 transition-colors shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)]", children: [dt(`Mëso më shumë`), " ", _jsx(ArrowUpRight, { className: "w-4 h-4" })] })), _jsx("h2", { className: "text-2xl md:text-3xl font-bold text-white mb-3 leading-tight title-serif drop-shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.3)]", children: report.title }), _jsx("p", { className: "text-sm md:text-base text-neutral-200 font-medium line-clamp-4 drop-shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)] max-w-2xl", children: report.description }), _jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center gap-3 text-neutral-300 text-xs md:text-sm font-medium mt-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(MapPin, { className: "w-4 h-4 text-red-400" }), _jsx("span", { children: report.location?.address || 'Nuk ka adresë' })] }), report.location?.lat && report.location?.lng && (_jsx("a", { href: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${report.location.lat},${report.location.lng}`, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded-xl border border-white/20 transition-all text-xs font-bold w-fit cursor-pointer", children: _jsx("span", { children: dt(`Street View 🗺️`) }) }))] })] })] }), _jsxs("div", { className: "w-full md:w-[40%] bg-white dark:bg-slate-900 flex flex-col h-[50vh] md:h-full relative z-20 overflow-y-auto", children: [_jsxs("div", { className: "p-4 md:p-6 border-b border-neutral-100 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 bg-white/95 z-30 backdrop-blur-sm", children: [_jsxs("div", { className: "flex items-center gap-3", children: [report.isAnonymous ? (_jsx("div", { className: "w-10 h-10 bg-neutral-100 text-neutral-500 dark:text-slate-400 flex items-center justify-center text-lg font-bold rounded-full border border-slate-200/60 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)]", children: "A" })) : (_jsx("div", { className: "w-10 h-10 bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg font-bold rounded-full border border-indigo-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)]", children: report.authorName.charAt(0) })), _jsxs("div", { className: "flex flex-col", children: [_jsx("span", { className: "text-sm font-bold text-slate-900 dark:text-white", children: report.authorName }), _jsx("span", { className: "text-xs font-semibold text-neutral-500 dark:text-slate-400", children: dt(`Qytetar Deklarues`) })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: () => upvoteReport(report.id), className: "flex items-center gap-2 px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-slate-200/60 rounded-2xl text-slate-700 dark:text-slate-300 transition-colors shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)] group", children: [_jsx(ThumbsUp, { className: "w-4 h-4 group-hover:scale-110 transition-transform" }), _jsx("span", { className: "text-xs font-bold", children: report.upvotes })] }), _jsx("button", { onClick: handleShare, className: "flex items-center gap-2 px-3 py-1.5 bg-neutral-50 hover:bg-indigo-50 border border-slate-200/60 hover:border-indigo-200 hover:text-indigo-600 rounded-2xl text-slate-700 dark:text-slate-300 transition-colors shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)] group/share", title: dt(`Shpërndaj Raportimin`), children: _jsx(Share2, { className: "w-4 h-4 group-hover/share:scale-110 transition-transform" }) }), (currentUser?.role === 'admin' || currentUser?.role === 'approver' || currentUser?.permissions?.includes('reports')) && !isEditing && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => setIsEditing(true), className: "flex items-center justify-center w-8 h-8 bg-neutral-50 text-slate-700 dark:text-slate-300 border border-slate-200/60 hover:bg-neutral-100 rounded-2xl transition-colors shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)]", title: dt(`Edit`), children: _jsx(Edit3, { className: "w-4 h-4" }) }), _jsx("button", { onClick: () => {
                                                            if (window.confirm('A jeni të sigurt që dëshironi ta fshini?')) {
                                                                useStore.getState().deleteReport(report.id);
                                                                onClose();
                                                            }
                                                        }, className: "flex items-center justify-center w-8 h-8 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-2xl transition-colors shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)]", title: dt(`Delete`), children: _jsx(Trash2, { className: "w-4 h-4" }) })] }))] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4 md:p-6 space-y-6", children: [isEditing && (_jsxs("div", { className: "space-y-4 mb-6 border border-slate-200/60 dark:border-white/10 p-4 bg-neutral-50 dark:bg-slate-800 rounded-2xl shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)]", children: [_jsx("h3", { className: "font-bold text-sm text-slate-800 dark:text-slate-200 dark:text-slate-200 uppercase tracking-wide border-b border-slate-200/60 dark:border-white/10 pb-2", children: dt(`Modifiko Raportin`) }), _jsx("input", { type: "text", value: editForm.title, onChange: e => setEditForm({ ...editForm, title: e.target.value }), className: "w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl text-sm font-medium outline-none focus:border-indigo-600 text-slate-900 dark:text-white", placeholder: dt(`Titulli...`) }), _jsx("textarea", { value: editForm.description, onChange: e => setEditForm({ ...editForm, description: e.target.value }), className: "w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/60 rounded-2xl h-24 text-sm font-medium outline-none focus:border-indigo-600", placeholder: dt(`Përshkrimi...`) }), _jsx("input", { type: "text", value: editForm.address, onChange: e => setEditForm({ ...editForm, address: e.target.value }), className: "w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl text-sm font-medium outline-none focus:border-indigo-600 text-slate-900 dark:text-white", placeholder: dt(`Adresa...`) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: handleSaveEdit, className: "flex-1 py-2 bg-slate-900 dark:bg-slate-800 text-white dark:text-white font-bold text-xs rounded-2xl", children: dt(`RUAJ`) }), _jsx("button", { onClick: () => setIsEditing(false), className: "px-4 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/60 font-bold text-xs rounded-2xl", children: dt(`ANULO`) })] })] })), _jsxs("div", { className: "bg-slate-50 dark:bg-slate-800/50 p-5 rounded-[1.25rem] border border-slate-200/60 dark:border-white/10/60 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)] animate-in fade-in duration-500", children: [_jsxs("div", { className: "flex justify-between items-center mb-2.5", children: [_jsx("span", { className: "text-[11px] font-black uppercase tracking-widest text-slate-400", children: dt(`Indeksi i Ndikimit dhe Urgjencës`) }), _jsx("span", { className: cn("text-[10px] font-bold px-2 py-0.5 rounded border uppercase", impactInfo.color, impactInfo.bg), children: impactInfo.label })] }), _jsxs("div", { className: "flex items-baseline gap-1.5 mb-2", children: [_jsxs("span", { className: "text-3xl font-black tracking-tight text-slate-900 dark:text-white", children: [impactScore, "%"] }), _jsx("span", { className: "text-xs font-semibold text-slate-500 dark:text-slate-400", children: dt(`nga 100 pikë maksimale`) })] }), _jsx("div", { className: "w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-3.5 relative", children: _jsx("div", { className: cn("h-full rounded-full transition-all duration-1000 ease-out", impactScore >= 80 ? "bg-rose-500" :
                                                        impactScore >= 50 ? "bg-amber-500" :
                                                            "bg-emerald-500"), style: { width: `${impactScore}%` } }) }), _jsxs("p", { className: "text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 font-medium", children: [dt(`Kjo vlerë llogaritet automatikisht bazuar në kategorinë`), " ", _jsxs("strong", { className: "text-slate-800 dark:text-slate-200 dark:text-slate-200", children: ["\"", dt(report.category), "\""] }), dt(`, shkallën e urgjencës`), " ", _jsxs("strong", { className: "text-slate-800 dark:text-slate-200 dark:text-slate-200 font-bold", children: ["\"", dt(report.urgency), "\""] }), dt(`dhe mbështetjen e`), " ", _jsxs("strong", { className: "text-slate-800 dark:text-slate-200 dark:text-slate-200 font-bold", children: [report.upvotes, dt(`qytetarëve`)] }), "."] })] }), ((currentUser?.role && ['admin', 'approver'].includes(currentUser.role)) || currentUser?.permissions?.includes('reports')) && (_jsxs("div", { className: "bg-slate-50 dark:bg-slate-800/50 p-4 rounded-[1rem] border border-slate-200/60 dark:border-white/10 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)]", children: [_jsx("h4", { className: "text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3", children: dt(`Përditëso Statusin`) }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [report.status === 'Pending Review' && (_jsx("button", { onClick: () => useStore.getState().updateReportStatus(report.id, 'Approved'), className: "px-3 py-1.5 text-xs font-bold rounded-2xl transition-colors border bg-blue-600 border-blue-600 text-white hover:bg-blue-700 w-full mb-2", children: dt(`APROVO RAPORTIMIN (BËJE PUBLIK)`) })), Object.keys(statusConfig).map(status => {
                                                        const isActive = report.status === status;
                                                        return (_jsx("button", { onClick: () => handleStatusChangeClick(status), disabled: isActive, className: cn("px-2.5 py-1.5 text-xs font-bold rounded-2xl transition-colors border", isActive ? "bg-slate-900 border-slate-900 text-white" : "bg-white dark:bg-slate-900 border-slate-200/60 text-slate-700 dark:text-slate-300 hover:bg-neutral-50"), children: dt(status) }, status));
                                                    })] }), _jsxs("div", { className: "mt-4 pt-4 border-t border-slate-200/60 dark:border-white/10", children: [_jsx("h4", { className: "text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2", children: dt(`Auto-Pilot AI për Përgjigje Zyrtare`) }), _jsx("input", { type: "text", value: adminReason, onChange: (e) => setAdminReason(e.target.value), placeholder: dt(`Arsyeja e shkurtër (p.sh. Rruga jashtë pronësisë komunale)...`), className: "w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 px-3 py-2 rounded-2xl text-sm mb-2 focus:outline-none focus:border-indigo-600" }), _jsxs("button", { onClick: generateAIResponse, disabled: aiResponseGenerating || !adminReason, className: "flex items-center gap-2 justify-center w-full px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-2xl text-xs font-bold uppercase transition hover:bg-indigo-100 disabled:opacity-50", children: [_jsx(Wand2, { className: "w-4 h-4" }), aiResponseGenerating ? 'Duke gjeneruar...' : 'GJENERO PËRGJIGJEN ME AI'] }), adminResponse && (_jsx("textarea", { value: adminResponse, onChange: (e) => setAdminResponse(e.target.value), className: "w-full mt-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 px-3 py-2 rounded-2xl text-sm h-32 focus:outline-none focus:border-indigo-600" }))] })] })), _jsxs("div", { className: "mt-6", children: [_jsxs("h3", { className: "font-bold text-sm text-slate-800 dark:text-slate-200 dark:text-slate-200 uppercase tracking-wide mb-4", children: [dt(`Mendimet e Qytetarëve (`), report.commentsCount, ")"] }), (!report.comments || report.comments.length === 0) ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-8 opacity-60", children: [_jsx(MessageCircle, { className: "w-8 h-8 mb-2 text-neutral-400" }), _jsx("p", { className: "text-xs font-semibold text-neutral-500 dark:text-slate-400", children: dt(`Nuk ka asnjë koment.`) })] })) : (_jsx("div", { className: "space-y-4", children: report.comments.map(comment => (_jsxs("div", { className: "flex gap-3", children: [_jsx("div", { className: "w-8 h-8 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center shrink-0", children: _jsx(UserIcon, { className: "w-4 h-4 text-indigo-500" }) }), _jsxs("div", { children: [_jsxs("div", { className: "bg-neutral-50 border border-neutral-100 px-3 py-2 rounded-[1rem] rounded-tl-none", children: [_jsx("span", { className: "text-xs font-bold text-slate-800 dark:text-slate-200 dark:text-slate-200 mr-2", children: comment.authorName }), _jsx("span", { className: "text-sm font-medium text-slate-700 dark:text-slate-200 dark:text-slate-300", children: comment.content })] }), _jsx("span", { className: "text-[10px] text-neutral-400 font-medium ml-1 mt-1 block", children: formatDistanceToNow(new Date(comment.createdAt), { locale: sq, addSuffix: true }) })] })] }, comment.id))) }))] })] }), _jsx("div", { className: "p-4 border-t border-neutral-100 bg-white dark:bg-slate-900 sticky bottom-0 z-30", children: _jsxs("form", { onSubmit: handleAddComment, className: "flex gap-2 relative", children: [_jsx("input", { type: "text", value: commentText, onChange: (e) => setCommentText(e.target.value), placeholder: currentUser ? "Shto një koment..." : "Identifikohu për të komentuar...", disabled: !currentUser, className: "w-full bg-neutral-100 border-none px-4 py-3 rounded-full text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900/10 placeholder:text-neutral-500 dark:text-slate-400 disabled:opacity-50" }), _jsx("button", { type: "submit", disabled: !commentText.trim() || !currentUser, className: "absolute right-1 top-1 w-8 h-8 flex items-center justify-center bg-slate-900 rounded-full text-white hover:bg-slate-800 disabled:opacity-50", children: _jsx(Send, { className: "w-3.5 h-3.5 -ml-0.5" }) })] }) })] })] })] }));
}

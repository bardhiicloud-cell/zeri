import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { Plus, Trash2, Calendar, MapPin, Edit3, X, Search, Vote, CheckSquare, Square } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
export default function AdminPolls() {
    const polls = useStore(state => state.polls);
    const createPoll = useStore(state => state.createPoll);
    const updatePoll = useStore(state => state.updatePoll);
    const deletePoll = useStore(state => state.deletePoll);
    const [isCreating, setIsCreating] = useState(false);
    const [editingPollId, setEditingPollId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    // Pagination & Multi-select
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const itemsPerPage = 6;
    const initialPollState = {
        question: '',
        description: '',
        image: '',
        category: '',
        municipality: '',
        expiresAt: '',
        options: [{ id: '1', text: '', votes: 0, icon: '👍' }, { id: '2', text: '', votes: 0, icon: '👎' }]
    };
    const [newPoll, setNewPoll] = useState(initialPollState);
    const filteredPolls = useMemo(() => {
        let result = polls;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(poll => poll.question.toLowerCase().includes(q) ||
                poll.description.toLowerCase().includes(q) ||
                poll.category?.toLowerCase().includes(q));
        }
        return result;
    }, [polls, searchQuery]);
    // Pagination Logic
    const totalPages = Math.ceil(filteredPolls.length / itemsPerPage);
    const paginatedPolls = filteredPolls.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const toggleSelectBlock = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id))
            newSet.delete(id);
        else
            newSet.add(id);
        setSelectedIds(newSet);
    };
    const handleBulkAction = (action) => {
        if (!window.confirm(`A jeni të sigurt që dëshironi të fshini ${selectedIds.size} sondazhe?`))
            return;
        selectedIds.forEach(id => {
            deletePoll(id);
        });
        setSelectedIds(new Set());
    };
    const startEditing = (poll) => {
        setEditingPollId(poll.id);
        setIsCreating(true);
        // Format expiration date for datetime-local input
        let formattedDate = '';
        if (poll.expiresAt) {
            const date = new Date(poll.expiresAt);
            formattedDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }
        setNewPoll({
            question: poll.question,
            description: poll.description,
            image: poll.image || '',
            category: poll.category || '',
            municipality: poll.municipality || '',
            expiresAt: formattedDate,
            options: poll.options.map((o) => ({ ...o }))
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleCreateOrUpdate = (e) => {
        e.preventDefault();
        if (!newPoll.question || !newPoll.expiresAt) {
            // Avoid window.alert
            return;
        }
        let expDate = newPoll.expiresAt;
        try {
            expDate = new Date(newPoll.expiresAt).toISOString();
        }
        catch (err) { }
        const submittedData = {
            ...newPoll,
            expiresAt: expDate, createdAt: new Date().toISOString(),
            options: newPoll.options.filter(o => o.text.trim() !== '')
        };
        if (editingPollId) {
            updatePoll(editingPollId, submittedData);
        }
        else {
            createPoll(submittedData);
        }
        setIsCreating(false);
        setEditingPollId(null);
        setNewPoll(initialPollState);
    };
    const cancelEdit = () => {
        setIsCreating(false);
        setEditingPollId(null);
        setNewPoll(initialPollState);
    };
    return (_jsxs("div", { className: "max-w-full mx-auto space-y-6", children: [_jsxs("div", { className: "flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-2", children: [_jsxs("div", { children: [_jsxs("h2", { className: "text-3xl font-bold text-slate-900 dark:text-white tracking-tight title-serif flex items-center gap-3", children: [_jsx(Vote, { className: "w-8 h-8 text-indigo-600" }), dt(`Sistemi Zgjedhor`)] }), _jsx("p", { className: "text-sm font-medium text-slate-500 dark:text-slate-400 mt-2", children: dt(`Menaxhimi i sondazheve dhe opinioneve publike.`) })] }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-4 w-full xl:w-auto items-start xl:items-center", children: [_jsxs("div", { className: "flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl", children: [_jsxs("div", { className: "px-5 py-2 flex flex-col items-center min-w-[6rem]", children: [_jsx("span", { className: "text-lg font-bold title-serif leading-none text-slate-900 dark:text-white", children: polls.length }), _jsx("span", { className: "text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold mt-1", children: dt(`Sondazhe`) })] }), _jsxs("div", { className: "px-5 py-2 border-l border-slate-200/60 dark:border-white/10 flex flex-col items-center min-w-[6rem]", children: [_jsx("span", { className: "text-lg font-bold title-serif leading-none text-indigo-600", children: polls.reduce((acc, p) => acc + Object.values(p.options || {}).reduce((sum, o) => sum + (o.votes || 0), 0), 0) }), _jsx("span", { className: "text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold mt-1", children: dt(`Vota`) })] })] }), _jsxs("button", { onClick: () => {
                                    if (isCreating)
                                        cancelEdit();
                                    else
                                        setIsCreating(true);
                                }, className: cn("flex items-center justify-center gap-2 px-6 py-3.5 font-bold text-sm transition-all rounded-xl shadow-sm dark:shadow-none hover:shadow active:scale-95 w-full sm:w-auto", isCreating
                                    ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
                                    : "bg-slate-900 text-white hover:bg-slate-800 border border-slate-800"), children: [isCreating ? _jsx(X, { className: "w-4 h-4" }) : _jsx(Plus, { className: "w-4 h-4" }), isCreating ? 'Mbyll Procedurën' : 'Shto Sondazh'] })] })] }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm dark:shadow-none border border-slate-100 dark:border-white/5", children: [_jsxs("div", { className: "relative w-full sm:w-96", children: [_jsx(Search, { className: "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" }), _jsx("input", { type: "text", placeholder: dt(`Kërko me emër ose përshkrim...`), value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm font-medium placeholder:text-slate-400 focus:bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" })] }), selectedIds.size > 0 && (_jsxs(motion.div, { initial: { scale: 0.95, opacity: 0 }, animate: { scale: 1, opacity: 1 }, className: "flex items-center gap-2 bg-slate-900 px-2 py-1.5 rounded-xl shadow-sm dark:shadow-none border border-slate-800 w-full sm:w-auto overflow-x-auto whitespace-nowrap scrollbar-hide", children: [_jsxs("span", { className: "text-white text-xs font-bold px-2", children: [selectedIds.size, dt(`zgjedhur`)] }), _jsx("button", { onClick: () => handleBulkAction('delete'), className: "px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold transition-colors", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] }))] }), isCreating && (_jsxs("form", { onSubmit: handleCreateOrUpdate, className: "bg-white dark:bg-slate-900 p-6 md:p-10 border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none rounded-2xl space-y-6 animate-in fade-in slide-in-from-top-4 duration-300", children: [_jsxs("div", { className: "border-b border-slate-100 dark:border-white/5 pb-5 mb-6 flex items-center justify-between", children: [_jsx("h3", { className: "text-2xl font-bold text-slate-900 dark:text-white tracking-tight title-serif", children: editingPollId ? 'Ndrysho Sondazhin' : 'Sondazh i Ri' }), _jsx("span", { className: "bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-[6px] text-[10px] font-bold tracking-widest uppercase", children: dt(`Formulari Zyrtar`) })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2", children: dt(`Çështja (Pyetja kryesore)`) }), _jsx("input", { required: true, type: "text", value: newPoll.question, onChange: e => setNewPoll({ ...newPoll, question: e.target.value }), className: "w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium", placeholder: dt(`psh. Cila është gjendja e rrugëve?`) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2", children: dt(`Përshkrimi (Detajet)`) }), _jsx("textarea", { value: newPoll.description, onChange: e => setNewPoll({ ...newPoll, description: e.target.value }), className: "w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium min-h-[100px]", placeholder: dt(`Detaje shtesë mbi sondazhin...`) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2", children: dt(`Afati i Përfundimit`) }), _jsx("input", { required: true, type: "datetime-local", value: newPoll.expiresAt, onChange: e => setNewPoll({ ...newPoll, expiresAt: e.target.value }), className: "w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2", children: dt(`Kategoria`) }), _jsx("input", { type: "text", value: newPoll.category, onChange: e => setNewPoll({ ...newPoll, category: e.target.value }), className: "w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium", placeholder: dt(`psh. Infrastrukturë`) })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2", children: dt(`Imazhi (URL - Opsionale)`) }), _jsx("input", { type: "url", value: newPoll.image, onChange: e => setNewPoll({ ...newPoll, image: e.target.value }), className: "w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium", placeholder: dt(`https://...`) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2", children: dt(`Targeti Lokal`) }), _jsxs("select", { value: newPoll.municipality, onChange: e => setNewPoll({ ...newPoll, municipality: e.target.value }), className: "w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium appearance-none", children: [_jsx("option", { value: "", children: dt(`Nacionale (E Gjithë Kosova)`) }), KOSOVO_MUNICIPALITIES.map(m => (_jsx("option", { value: m, children: m }, m)))] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4", children: dt(`Opsionet e Zgjedhjes`) }), _jsxs("div", { className: "space-y-3 bg-slate-50 dark:bg-slate-800 p-4 border border-slate-200/60 dark:border-white/10 rounded-xl mb-4", children: [newPoll.options.map((opt, i) => (_jsxs("div", { className: "flex gap-3 relative group", children: [_jsx("input", { type: "text", placeholder: dt(`Ikonë (psh 🚀)`), value: opt.icon || '', onChange: e => {
                                                            const newOptions = [...newPoll.options];
                                                            newOptions[i] = { ...newOptions[i], icon: e.target.value };
                                                            setNewPoll({ ...newPoll, options: newOptions });
                                                        }, className: "w-16 px-2 py-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl text-center focus:outline-none focus:border-indigo-500 text-sm shadow-sm dark:shadow-none" }), _jsx("input", { type: "text", placeholder: `Opsioni ${i + 1}`, value: opt.text, onChange: e => {
                                                            const newOptions = [...newPoll.options];
                                                            newOptions[i] = { ...newOptions[i], text: e.target.value };
                                                            setNewPoll({ ...newPoll, options: newOptions });
                                                        }, className: "flex-1 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white font-medium text-sm shadow-sm dark:shadow-none" }), newPoll.options.length > 2 && (_jsx("button", { type: "button", onClick: () => {
                                                            const newOptions = [...newPoll.options];
                                                            newOptions.splice(i, 1);
                                                            setNewPoll({ ...newPoll, options: newOptions });
                                                        }, className: "absolute -right-2 -top-2 w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity", children: _jsx(X, { className: "w-3.5 h-3.5" }) }))] }, i))), _jsxs("button", { type: "button", onClick: () => setNewPoll({ ...newPoll, options: [...newPoll.options, { id: Math.random().toString(), text: '', votes: 0, icon: '❓' }] }), className: "w-full py-3 border-2 border-dashed border-slate-200/60 dark:border-white/10 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-white dark:bg-slate-900 transition-all flex items-center justify-center gap-2", children: [_jsx(Plus, { className: "w-4 h-4" }), dt(`Shto Opsion Tjetër`)] })] })] })] }), _jsxs("div", { className: "flex justify-end pt-6 border-t border-slate-100 dark:border-white/5 gap-3", children: [_jsx("button", { type: "button", onClick: cancelEdit, className: "px-6 py-3 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold border border-slate-200/60 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 transition-colors", children: dt(`Anulo`) }), _jsx("button", { type: "submit", className: "px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors rounded-xl shadow-sm dark:shadow-none tracking-wide", children: editingPollId ? 'RUAJ NDRYSHIMET' : 'DEKRETO SONDAZHIN' })] })] })), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6", children: _jsx(AnimatePresence, { mode: "popLayout", children: paginatedPolls.map((poll) => {
                        const isSelected = selectedIds.has(poll.id);
                        return (_jsxs(motion.div, { layout: true, initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, scale: 0.95 }, className: cn("bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none hover:shadow transition-all relative flex flex-col overflow-hidden group", isSelected && "ring-2 ring-indigo-500"), children: [_jsx("div", { className: "absolute top-4 left-4 z-20", children: _jsx("button", { onClick: () => toggleSelectBlock(poll.id), className: "w-8 h-8 bg-white/90 backdrop-blur-sm rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-500 dark:text-slate-400 shadow-sm dark:shadow-none border border-slate-200/60 dark:border-white/10 border border-slate-200/60 dark:border-white/10 transition-colors", children: isSelected ? _jsx(CheckSquare, { className: "w-5 h-5 text-indigo-600" }) : _jsx(Square, { className: "w-5 h-5" }) }) }), _jsxs("div", { className: "absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20", children: [_jsx("button", { onClick: () => startEditing(poll), className: "w-8 h-8 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors", title: dt(`Ndrysho`), children: _jsx(Edit3, { className: "w-4 h-4" }) }), _jsx("button", { onClick: () => deletePoll(poll.id), className: "w-8 h-8 bg-white dark:bg-slate-900 text-rose-500 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none flex items-center justify-center hover:bg-rose-50 hover:border-rose-200 transition-colors", title: dt(`Fshij Sondazhin`), children: _jsx(Trash2, { className: "w-4 h-4" }) })] }), poll.image && (_jsxs("div", { className: "h-40 bg-slate-100 dark:bg-slate-800/50 w-full relative shrink-0", children: [_jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent z-10" }), _jsx("img", { src: poll.image, className: "w-full h-full object-cover", alt: "poll header" })] })), _jsxs("div", { className: cn("p-5 flex-1 flex flex-col", !poll.image && "pt-12"), children: [_jsxs("div", { className: "flex flex-wrap gap-2 mb-4", children: [_jsx("span", { className: "px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] uppercase font-bold tracking-widest rounded border border-indigo-100", children: poll.category || 'Të Përgjithshme' }), poll.municipality && (_jsxs("span", { className: "px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-widest rounded flex items-center gap-1", children: [_jsx(MapPin, { className: "w-3 h-3" }), poll.municipality] }))] }), _jsx("h3", { className: "text-lg font-bold text-slate-900 dark:text-white leading-snug mb-2 title-serif tracking-tight truncate-2-lines", children: poll.question }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 md:line-clamp-3 leading-relaxed", children: poll.description }), _jsx("div", { className: "space-y-3 mb-6", children: poll.options.map(opt => {
                                                const percent = poll.totalVotes && poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
                                                return (_jsxs("div", { className: "relative group/opt", children: [_jsxs("div", { className: "flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 z-10 relative px-3 py-2.5 items-center", children: [_jsxs("span", { className: "flex items-center gap-2 truncate pr-2 z-10 mix-blend-difference text-white", children: [opt.icon, " ", _jsx("span", { className: "drop-shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none", children: opt.text })] }), _jsxs("span", { className: "shrink-0 z-10 text-white drop-shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none", children: [percent, "%"] })] }), _jsxs("div", { className: "absolute inset-0 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-full overflow-hidden", children: [_jsx("div", { className: "absolute inset-y-0 left-0 bg-indigo-500 transition-all duration-1000", style: { width: `${percent}%` } }), _jsx("div", { className: "absolute inset-y-0 left-0 w-full bg-slate-800 opacity-0 group-hover/opt:opacity-10 transition-opacity" })] })] }, opt.id));
                                            }) }), _jsxs("div", { className: "flex items-center gap-2 text-[10px] border-t border-slate-100 dark:border-white/5 pt-4 font-bold uppercase text-slate-400 tracking-widest mt-auto", children: [_jsx(Calendar, { className: "w-3.5 h-3.5" }), dt(`SKADON:`), " ", format(new Date(poll.expiresAt), 'dd MMM yyyy')] })] })] }, poll.id));
                    }) }) }), paginatedPolls.length === 0 && (_jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-16 text-center shadow-sm dark:shadow-none", children: [_jsx("div", { className: "w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-5 border border-slate-100 dark:border-white/5", children: _jsx(Vote, { className: "w-10 h-10 text-slate-300" }) }), _jsx("h3", { className: "text-xl font-bold text-slate-900 dark:text-white mb-2 title-serif", children: dt(`S'ka Rezultate`) }), _jsx("p", { className: "text-slate-500 dark:text-slate-400 font-medium", children: dt(`Nuk u gjet asnjë sondazh me këto kritere.`) })] })), totalPages > 1 && (_jsxs("div", { className: "px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none flex flex-col sm:flex-row gap-4 items-center justify-between", children: [_jsxs("span", { className: "text-sm font-medium text-slate-500 dark:text-slate-400", children: [dt(`Shfaqur`), " ", _jsxs("strong", { className: "text-slate-900 dark:text-white", children: [(currentPage - 1) * itemsPerPage + 1, " - ", Math.min(currentPage * itemsPerPage, filteredPolls.length)] }), dt(`nga`), " ", _jsx("strong", { className: "text-slate-900 dark:text-white", children: filteredPolls.length })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { onClick: () => setCurrentPage(p => Math.max(1, p - 1)), disabled: currentPage === 1, className: "px-3 py-2 border border-slate-200/60 dark:border-white/10 rounded-2xl hover:bg-slate-50 dark:bg-slate-800 disabled:opacity-50 text-slate-500 dark:text-slate-400 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20", children: dt(`Kthehu`) }), _jsxs("div", { className: "flex items-center px-4 font-bold title-serif text-slate-900 dark:text-white text-lg", children: [currentPage, " / ", totalPages] }), _jsx("button", { onClick: () => setCurrentPage(p => Math.min(totalPages, p + 1)), disabled: currentPage === totalPages, className: "px-3 py-2 border border-slate-200/60 dark:border-white/10 rounded-2xl hover:bg-slate-50 dark:bg-slate-800 disabled:opacity-50 text-slate-500 dark:text-slate-400 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20", children: dt(`Vazhdo`) })] })] }))] }));
}

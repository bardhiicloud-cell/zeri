import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { Plus, Trash2, Layers, Search, CheckSquare, Square } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
export default function AdminCategories() {
    const categories = useStore(state => state.categories);
    const addCategory = useStore(state => state.addCategory);
    const deleteCategory = useStore(state => state.deleteCategory);
    const [newName, setNewName] = useState('');
    const [newGroup, setNewGroup] = useState('Nivel Lokal');
    const [isCreating, setIsCreating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    // Pagination & Multi-select
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const itemsPerPage = 9;
    const handleAdd = (e) => {
        e.preventDefault();
        if (!newName.trim())
            return;
        addCategory({ name: newName.trim(), group: newGroup });
        setNewName('');
        setNewGroup('Nivel Lokal');
        setIsCreating(false);
    };
    const filteredCategories = useMemo(() => {
        let result = categories;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(cat => cat.name.toLowerCase().includes(q) ||
                cat.group.toLowerCase().includes(q));
        }
        return result;
    }, [categories, searchQuery]);
    // Pagination Logic
    const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);
    const paginatedCategories = filteredCategories.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedCategories.length && paginatedCategories.length > 0) {
            setSelectedIds(new Set());
        }
        else {
            setSelectedIds(new Set(paginatedCategories.map(r => r.id)));
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
    const handleBulkAction = () => {
        if (!window.confirm(`A jeni të sigurt që dëshironi të fshini ${selectedIds.size} kategori?`))
            return;
        selectedIds.forEach(id => {
            deleteCategory(id);
        });
        setSelectedIds(new Set());
    };
    return (_jsxs("div", { className: "space-y-6 max-w-full mx-auto", children: [_jsxs("div", { className: "flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-2", children: [_jsxs("div", { children: [_jsxs("h2", { className: "text-3xl font-bold text-slate-900 dark:text-white tracking-tight title-serif flex items-center gap-3", children: [_jsx(Layers, { className: "w-8 h-8 text-indigo-600" }), dt(`Kategoritë e Raporteve`)] }), _jsx("p", { className: "text-sm font-medium text-slate-500 dark:text-slate-400 mt-2", children: dt(`Menaxhimi i taksonomisë dhe grupimeve tematike.`) })] }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-4 w-full xl:w-auto items-start xl:items-center", children: [_jsx("div", { className: "flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl", children: _jsxs("div", { className: "px-5 py-2 flex flex-col items-center min-w-[6rem]", children: [_jsx("span", { className: "text-lg font-bold title-serif leading-none text-slate-900 dark:text-white", children: categories.length }), _jsx("span", { className: "text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold mt-1", children: dt(`Totali`) })] }) }), _jsxs("button", { onClick: () => setIsCreating(!isCreating), className: cn("flex items-center justify-center gap-2 px-6 py-3.5 font-bold text-sm transition-all rounded-xl shadow-sm dark:shadow-none hover:shadow active:scale-95 w-full sm:w-auto", isCreating
                                    ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
                                    : "bg-slate-900 text-white hover:bg-slate-800 border border-slate-800"), children: [isCreating ? _jsx(Trash2, { className: "w-4 h-4" }) : _jsx(Plus, { className: "w-4 h-4" }), isCreating ? 'Mbyll Formularin' : 'Kategori e Re'] })] })] }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm dark:shadow-none border border-slate-100 dark:border-white/5", children: [_jsxs("div", { className: "relative w-full sm:w-96", children: [_jsx(Search, { className: "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" }), _jsx("input", { type: "text", placeholder: dt(`Kërko kategori ose grup...`), value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm font-medium placeholder:text-slate-400 focus:bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" })] }), selectedIds.size > 0 && (_jsxs(motion.div, { initial: { scale: 0.95, opacity: 0 }, animate: { scale: 1, opacity: 1 }, className: "flex items-center gap-2 bg-slate-900 px-2 py-1.5 rounded-xl shadow-sm dark:shadow-none border border-slate-800 w-full sm:w-auto overflow-x-auto whitespace-nowrap scrollbar-hide", children: [_jsxs("span", { className: "text-white text-xs font-bold px-2", children: [selectedIds.size, dt(`zgjedhur`)] }), _jsx("button", { onClick: handleBulkAction, className: "px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold transition-colors", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] }))] }), isCreating && (_jsxs("form", { onSubmit: handleAdd, className: "bg-white dark:bg-slate-900 p-6 md:p-8 border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300", children: [_jsx("h3", { className: "text-xl font-bold text-slate-900 dark:text-white tracking-tight title-serif mb-6 border-b border-slate-100 dark:border-white/5 pb-4", children: dt(`Shto Kategori të Re`) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6 items-end", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2", children: dt(`Emri i Kategorisë`) }), _jsx("input", { type: "text", value: newName, onChange: e => setNewName(e.target.value), placeholder: dt(`Psh. Shërbime Publike`), className: "w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl font-bold text-sm outline-none focus:bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all uppercase tracking-wider" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2", children: dt(`Grupi / Sektori`) }), _jsxs("select", { value: newGroup, onChange: e => setNewGroup(e.target.value), className: "w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl font-bold text-sm outline-none focus:bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all uppercase tracking-wider appearance-none", children: [_jsx("option", { value: "Nivel Lokal", children: dt(`Nivel Lokal`) }), _jsx("option", { value: "Sipas Ministrive", children: dt(`Sipas Ministrive`) }), _jsx("option", { value: "Nderkomb\u00EBtare", children: dt(`Nderkombëtare`) }), _jsx("option", { value: "T\u00EB tjera", children: dt(`Të tjera`) })] })] }), _jsx("div", { children: _jsx("button", { disabled: !newName.trim(), className: "w-full bg-indigo-600 text-white font-bold py-3 text-sm rounded-xl hover:bg-indigo-500 transition-colors shadow-sm dark:shadow-none disabled:opacity-50", children: dt(`Regjistro Kategorinë`) }) })] })] })), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6", children: _jsx(AnimatePresence, { mode: "popLayout", children: paginatedCategories.length === 0 ? (_jsxs(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, className: "col-span-full py-20 text-center bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none", children: [_jsx("div", { className: "w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-white/5", children: _jsx(Layers, { className: "w-8 h-8 text-slate-300" }) }), _jsx("h3", { className: "text-xl font-bold text-slate-900 dark:text-white mb-2 title-serif", children: dt(`S'ka Kategori`) }), _jsx("p", { className: "text-slate-500 dark:text-slate-400 font-medium", children: dt(`Asnjë kategori nuk u gjet me këto kritere.`) })] })) : (paginatedCategories.map(category => {
                        const isSelected = selectedIds.has(category.id);
                        return (_jsxs(motion.div, { layout: true, initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, className: cn("bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl p-5 shadow-sm dark:shadow-none hover:shadow transition-all flex items-center justify-between group", isSelected && "ring-2 ring-indigo-500"), children: [_jsxs("div", { className: "flex items-center gap-4 min-w-0", children: [_jsx("button", { onClick: () => toggleSelectBlock(category.id), className: "text-slate-400 hover:text-slate-500 dark:text-slate-400 transition-colors shrink-0", children: isSelected ? _jsx(CheckSquare, { className: "w-5 h-5 text-indigo-600" }) : _jsx(Square, { className: "w-5 h-5" }) }), _jsxs("div", { className: "min-w-0 pr-2", children: [_jsx("span", { className: "block text-[10px] font-bold tracking-widest uppercase text-indigo-600 mb-1 truncate bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 w-max", children: category.group }), _jsx("h4", { className: "font-bold text-slate-900 dark:text-white tracking-tight text-sm md:text-base truncate", children: category.name })] })] }), _jsx("button", { onClick: () => { if (confirm('A jeni i sigurt?'))
                                        deleteCategory(category.id); }, className: "w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-colors border border-transparent hover:border-rose-100 shrink-0 opacity-50 group-hover:opacity-100", children: _jsx(Trash2, { className: "w-4 h-4" }) })] }, category.id));
                    })) }) }), totalPages > 1 && (_jsxs("div", { className: "px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none flex flex-col sm:flex-row gap-4 items-center justify-between", children: [_jsxs("span", { className: "text-sm font-medium text-slate-500 dark:text-slate-400", children: [dt(`Shfaqur`), " ", _jsxs("strong", { className: "text-slate-900 dark:text-white", children: [(currentPage - 1) * itemsPerPage + 1, " - ", Math.min(currentPage * itemsPerPage, filteredCategories.length)] }), dt(`nga`), " ", _jsx("strong", { className: "text-slate-900 dark:text-white", children: filteredCategories.length })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { onClick: () => setCurrentPage(p => Math.max(1, p - 1)), disabled: currentPage === 1, className: "px-3 py-2 border border-slate-200/60 dark:border-white/10 rounded-2xl hover:bg-slate-50 dark:bg-slate-800 disabled:opacity-50 text-slate-500 dark:text-slate-400 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20", children: dt(`Kthehu`) }), _jsxs("div", { className: "flex items-center px-4 font-bold title-serif text-slate-900 dark:text-white text-lg", children: [currentPage, " / ", totalPages] }), _jsx("button", { onClick: () => setCurrentPage(p => Math.min(totalPages, p + 1)), disabled: currentPage === totalPages, className: "px-3 py-2 border border-slate-200/60 dark:border-white/10 rounded-2xl hover:bg-slate-50 dark:bg-slate-800 disabled:opacity-50 text-slate-500 dark:text-slate-400 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20", children: dt(`Vazhdo`) })] })] }))] }));
}

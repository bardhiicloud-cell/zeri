import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Trash2, MessageSquare, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
export default function AdminForum() {
    const [posts, setPosts] = useState([]);
    const [search, setSearch] = useState('');
    const currentUser = useStore(state => state.currentUser);
    useEffect(() => {
        const q = query(collection(db, 'forumPosts'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const postsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPosts(postsData);
        });
        return () => unsubscribe();
    }, []);
    const handleDelete = async (id) => {
        if (window.confirm("A jeni të sigurt që dëshironi ta fshini këtë postim?")) {
            try {
                await deleteDoc(doc(db, 'forumPosts', id));
            }
            catch (err) {
                console.error(err);
            }
        }
    };
    const handleToggleVisibility = async (id, isHidden) => {
        try {
            await updateDoc(doc(db, 'forumPosts', id), { isHidden: !isHidden });
        }
        catch (err) {
            console.error(err);
        }
    };
    const handleApprove = async (id, isApproved) => {
        try {
            await updateDoc(doc(db, 'forumPosts', id), { isApproved: !isApproved });
        }
        catch (err) {
            console.error(err);
        }
    };
    const filteredPosts = posts.filter(p => p.content?.toLowerCase().includes(search.toLowerCase()) ||
        p.authorName?.toLowerCase().includes(search.toLowerCase()));
    return (_jsxs("div", { className: "p-8 space-y-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-center gap-4", children: [_jsxs("div", { children: [_jsxs("h2", { className: "text-3xl font-bold text-slate-900 dark:text-white title-serif flex items-center gap-3", children: [_jsx(MessageSquare, { className: "w-8 h-8 text-emerald-600" }), dt(`Menaxhimi i Forumit`)] }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-2", children: dt(`Moderoni postimet, aprovoni përmbajtjen dhe fshini postimet banale.`) })] }), _jsxs("div", { className: "relative w-full md:w-96", children: [_jsx(Search, { className: "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" }), _jsx("input", { type: "text", placeholder: dt(`Kërko postime ose autorë...`), value: search, onChange: (e) => setSearch(e.target.value), className: "w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" })] })] }), _jsx("div", { className: "bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none overflow-hidden", children: _jsxs("table", { className: "w-full text-left border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-slate-50 dark:bg-slate-800 border-b border-slate-200/60 dark:border-white/10", children: [_jsx("th", { className: "px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest", children: dt(`Autori`) }), _jsx("th", { className: "px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest", children: dt(`Përmbajtja`) }), _jsx("th", { className: "px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest", children: dt(`Data`) }), _jsx("th", { className: "px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest", children: dt(`Dukshmëria`) }), _jsx("th", { className: "px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right", children: dt(`Veprimet`) })] }) }), _jsxs("tbody", { className: "divide-y divide-slate-100", children: [filteredPosts.map(post => (_jsxs("tr", { className: "hover:bg-slate-50 dark:bg-slate-800 transition-colors", children: [_jsxs("td", { className: "px-6 py-4", children: [_jsx("div", { className: "font-bold text-slate-900 dark:text-white text-sm", children: post.authorName }), _jsx("div", { className: "text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5", children: post.authorRole })] }), _jsx("td", { className: "px-6 py-4", children: _jsx("div", { className: "text-sm text-slate-700 dark:text-slate-300 max-w-md truncate", children: post.content }) }), _jsx("td", { className: "px-6 py-4 text-xs font-medium text-slate-500 dark:text-slate-400", children: post.createdAt?.toDate ? new Date(post.createdAt.toDate()).toLocaleDateString('sq-AL') : 'Sapo postuar' }), _jsx("td", { className: "px-6 py-4", children: post.isApproved ? (_jsxs("span", { className: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider", children: [_jsx(CheckCircle, { className: "w-3 h-3" }), dt(`Aprovuar`)] })) : (_jsxs("span", { className: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider", children: [_jsx(AlertCircle, { className: "w-3 h-3" }), dt(`Në Pritje`)] })) }), _jsx("td", { className: "px-6 py-4 text-right", children: _jsxs("div", { className: "flex items-center justify-end gap-2", children: [_jsx("button", { onClick: () => handleApprove(post.id, !!post.isApproved), className: cn("p-2 rounded-2xl transition-colors", post.isApproved ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"), title: post.isApproved ? "Hiq Aprovimin" : "Aprovo", children: _jsx(CheckCircle, { className: "w-4 h-4" }) }), _jsx("button", { onClick: () => handleDelete(post.id), className: "p-2 text-rose-500 hover:bg-rose-50 rounded-2xl transition-colors", title: dt(`Fshij Postimin`), children: _jsx(Trash2, { className: "w-4 h-4" }) })] }) })] }, post.id))), filteredPosts.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-6 py-12 text-center text-slate-500 dark:text-slate-400 font-medium", children: dt(`Nuk u gjet asnjë postim.`) }) }))] })] }) })] }));
}

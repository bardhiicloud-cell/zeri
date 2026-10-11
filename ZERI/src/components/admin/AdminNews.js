import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Newspaper, Plus, Trash2, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import toast from 'react-hot-toast';
const emptyForm = {
    title: '', municipality: 'Prishtinë', category: 'Infrastrukturë', summary: '', content: '', imageUrl: '', published: true, position: 'feed'
};
export default function AdminNews() {
    const [items, setItems] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const fieldClass = 'w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500';
    useEffect(() => onSnapshot(collection(db, 'newsArticles'), snapshot => {
        setItems(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    }, () => setItems([])), []);
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!form.title.trim() || !form.summary.trim() || !form.content.trim())
            return;
        const id = `news-${Date.now()}`;
        await setDoc(doc(db, 'newsArticles', id), {
            ...form,
            id,
            author: 'Administrata e Zërit të Qytetarëve',
            readTime: '3 min lexim',
            date: new Date().toLocaleDateString('sq-AL', { day: '2-digit', month: 'long', year: 'numeric' })
        });
        setForm(emptyForm);
        setIsCreating(false);
        toast.success('Lajmi u publikua me sukses.');
    };
    const handleDelete = async (id) => {
        if (!window.confirm('A dëshironi ta hiqni këtë lajm?'))
            return;
        await deleteDoc(doc(db, 'newsArticles', id));
        toast.success('Lajmi u hoq.');
    };
    return (_jsxs("div", { className: "space-y-6 max-w-[1400px] mx-auto", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsxs("h2", { className: "text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3", children: [_jsx(Newspaper, { className: "w-8 h-8 text-blue-600" }), " Menaxhimi i Lajmeve"] }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-2", children: "Krijoni, publikoni dhe hiqni lajmet q\u00EB shfaqen n\u00EB faqen publike." })] }), _jsxs("button", { onClick: () => setIsCreating(value => !value), className: "inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold", children: [isCreating ? _jsx(X, { className: "w-4 h-4" }) : _jsx(Plus, { className: "w-4 h-4" }), isCreating ? 'Mbyll' : 'Krijo lajm'] })] }), isCreating && (_jsxs("form", { onSubmit: handleSubmit, className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-7 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx("input", { required: true, value: form.title, onChange: e => setForm({ ...form, title: e.target.value }), placeholder: "Titulli i lajmit", className: fieldClass }), _jsx("select", { value: form.municipality, onChange: e => setForm({ ...form, municipality: e.target.value }), className: fieldClass, children: KOSOVO_MUNICIPALITIES.map(municipality => _jsx("option", { children: municipality }, municipality)) }), _jsx("input", { required: true, value: form.category, onChange: e => setForm({ ...form, category: e.target.value }), placeholder: "Kategoria", className: fieldClass }), _jsx("input", { value: form.imageUrl, onChange: e => setForm({ ...form, imageUrl: e.target.value }), placeholder: "URL e fotografis\u00EB (opsionale)", className: fieldClass }), _jsxs("select", { value: form.position, onChange: e => setForm({ ...form, position: e.target.value }), className: fieldClass, children: [_jsx("option", { value: "featured", children: "Lajm kryesor" }), _jsx("option", { value: "feed", children: "N\u00EB list\u00EBn e lajmeve" }), _jsx("option", { value: "sidebar", children: "N\u00EB kolon\u00EBn an\u00EBsore" })] })] }), _jsx("textarea", { required: true, value: form.summary, onChange: e => setForm({ ...form, summary: e.target.value }), placeholder: "P\u00EBrmbledhja e shkurt\u00EBr", className: `${fieldClass} min-h-24` }), _jsx("textarea", { required: true, value: form.content, onChange: e => setForm({ ...form, content: e.target.value }), placeholder: "P\u00EBrmbajtja e plot\u00EB e lajmit", className: `${fieldClass} min-h-40` }), _jsx("button", { type: "submit", className: "px-5 py-3 rounded-xl bg-slate-950 text-white font-bold text-sm", children: "Publiko lajmin" })] })), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: [items.map(item => (_jsxs("article", { className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex gap-4", children: [item.imageUrl ? _jsx("img", { src: item.imageUrl, alt: "", className: "w-24 h-24 rounded-xl object-cover shrink-0" }) : _jsx("div", { className: "w-24 h-24 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0", children: _jsx(Newspaper, { className: "w-8 h-8 text-blue-500" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsx("h3", { className: "font-black text-slate-900 dark:text-white line-clamp-2", children: item.title }), _jsx("button", { onClick: () => handleDelete(item.id), className: "text-rose-600 hover:bg-rose-50 p-2 rounded-lg", title: "Fshi lajmin", children: _jsx(Trash2, { className: "w-4 h-4" }) })] }), _jsxs("p", { className: "text-xs text-slate-500 mt-1", children: [item.municipality, " \u00B7 ", item.category, " \u00B7 ", item.date] }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-300 mt-3 line-clamp-2", children: item.summary })] })] }, item.id))), items.length === 0 && _jsx("div", { className: "lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-10 text-center text-sm text-slate-500 border border-dashed border-slate-300 dark:border-white/10", children: "Nuk ka ende lajme t\u00EB krijuara nga administrata." })] })] }));
}

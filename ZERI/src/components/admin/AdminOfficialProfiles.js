import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, deleteDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { Trash2, Users, Search, Plus, BadgeCheck } from 'lucide-react';
export default function AdminOfficialProfiles() {
    const [profiles, setProfiles] = useState([]);
    const [search, setSearch] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newProfile, setNewProfile] = useState({
        name: '',
        handle: '',
        initials: '',
        color: 'bg-blue-600',
        followers: '0',
        verified: true
    });
    useEffect(() => {
        const q = query(collection(db, 'officialProfiles'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProfiles(data);
        });
        return () => unsubscribe();
    }, []);
    const handleDelete = async (id) => {
        if (window.confirm("A jeni të sigurt që dëshironi ta fshini këtë profil?")) {
            try {
                await deleteDoc(doc(db, 'officialProfiles', id));
            }
            catch (err) {
                console.error(err);
            }
        }
    };
    const handleToggleVerify = async (id, verified) => {
        try {
            await updateDoc(doc(db, 'officialProfiles', id), { verified: !verified });
        }
        catch (err) {
            console.error(err);
        }
    };
    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, 'officialProfiles'), {
                ...newProfile,
                createdAt: new Date().toISOString()
            });
            setIsAdding(false);
            setNewProfile({ name: '', handle: '', initials: '', color: 'bg-blue-600', followers: '0', verified: true });
        }
        catch (err) {
            console.error(err);
        }
    };
    const handleSeedDefaults = async () => {
        const defaults = [
            { name: 'Komuna e Prishtinës', handle: '@prishtina_official', verified: true, followers: '45.2K', initials: 'KP', color: 'bg-blue-600' },
            { name: 'Policia e Kosovës', handle: '@policiakosoves', verified: true, followers: '68.9K', initials: 'PK', color: 'bg-indigo-600' },
            { name: 'Ministria e Mjedisit', handle: '@mjedisiks', verified: true, followers: '22.1K', initials: 'MM', color: 'bg-emerald-600' },
            { name: 'Shërbimet Publike', handle: '@sherbimetpublike', verified: true, followers: '19.4K', initials: 'SHP', color: 'bg-amber-600' },
            { name: 'Inspektorati Komunal', handle: '@inspektoratiks', verified: true, followers: '14.8K', initials: 'IK', color: 'bg-rose-600' }
        ];
        try {
            for (const p of defaults) {
                await addDoc(collection(db, 'officialProfiles'), {
                    ...p,
                    createdAt: new Date().toISOString()
                });
            }
        }
        catch (err) {
            console.error('Error seeding defaults:', err);
        }
    };
    const filteredProfiles = profiles.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.handle.toLowerCase().includes(search.toLowerCase()));
    return (_jsxs("div", { className: "p-8 space-y-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-center gap-4", children: [_jsxs("div", { children: [_jsxs("h2", { className: "text-3xl font-bold text-slate-900 dark:text-white title-serif flex items-center gap-3", children: [_jsx(Users, { className: "w-8 h-8 text-blue-600" }), dt(`Profilet Zyrtare`)] }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-2", children: dt(`Menaxhoni profilet zyrtare që shfaqen në Qendër të Vëmendjes.`) })] }), _jsxs("div", { className: "flex flex-wrap gap-3 w-full md:w-auto", children: [_jsxs("div", { className: "relative flex-1 md:w-64", children: [_jsx(Search, { className: "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" }), _jsx("input", { type: "text", placeholder: dt(`Kërko profile...`), value: search, onChange: (e) => setSearch(e.target.value), className: "w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" })] }), profiles.length === 0 && (_jsxs("button", { onClick: handleSeedDefaults, className: "flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors shadow-sm", children: [_jsx(BadgeCheck, { className: "w-4 h-4" }), " ", dt('Shto Profilet Zyrtare')] })), _jsxs("button", { onClick: () => setIsAdding(!isAdding), className: "flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors shadow-sm", children: [_jsx(Plus, { className: "w-4 h-4" }), " ", dt('Shto Profil')] })] })] }), isAdding && (_jsxs("form", { onSubmit: handleAdd, className: "bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-6 shadow-sm", children: [_jsx("h3", { className: "font-bold text-lg mb-4", children: dt('Shto Profil Zyrtar') }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4", children: [_jsx("input", { required: true, placeholder: "Emri (p.sh. Komuna Prishtin\u00EB)", className: "px-4 py-2 border dark:border-slate-700 rounded-xl bg-transparent dark:text-white", value: newProfile.name, onChange: e => setNewProfile({ ...newProfile, name: e.target.value }) }), _jsx("input", { required: true, placeholder: "Handle (p.sh. @komunaprishtine)", className: "px-4 py-2 border dark:border-slate-700 rounded-xl bg-transparent dark:text-white", value: newProfile.handle, onChange: e => setNewProfile({ ...newProfile, handle: e.target.value }) }), _jsx("input", { required: true, placeholder: "Inicialet (p.sh. KP)", maxLength: 3, className: "px-4 py-2 border dark:border-slate-700 rounded-xl bg-transparent dark:text-white", value: newProfile.initials, onChange: e => setNewProfile({ ...newProfile, initials: e.target.value }) }), _jsx("input", { required: true, placeholder: "Ndjek\u00EBsit (p.sh. 45k)", className: "px-4 py-2 border dark:border-slate-700 rounded-xl bg-transparent dark:text-white", value: newProfile.followers, onChange: e => setNewProfile({ ...newProfile, followers: e.target.value }) }), _jsxs("select", { className: "px-4 py-2 border dark:border-slate-700 rounded-xl bg-transparent dark:text-white", value: newProfile.color, onChange: e => setNewProfile({ ...newProfile, color: e.target.value }), children: [_jsx("option", { value: "bg-blue-600", children: "Blu" }), _jsx("option", { value: "bg-emerald-600", children: "Jeshile" }), _jsx("option", { value: "bg-slate-800", children: "E Zez\u00EB / Hiri" }), _jsx("option", { value: "bg-yellow-500", children: "E Verdh\u00EB" }), _jsx("option", { value: "bg-indigo-600", children: "Indigo" }), _jsx("option", { value: "bg-rose-600", children: "E Kuqe" })] }), _jsxs("label", { className: "flex items-center gap-2 text-sm font-bold dark:text-white", children: [_jsx("input", { type: "checkbox", checked: newProfile.verified, onChange: e => setNewProfile({ ...newProfile, verified: e.target.checked }) }), "E Verifikuar"] })] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { type: "button", onClick: () => setIsAdding(false), className: "px-4 py-2 font-bold text-slate-500", children: "Anulo" }), _jsx("button", { type: "submit", className: "px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold", children: "Ruaj" })] })] })), _jsx("div", { className: "bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden", children: _jsxs("table", { className: "w-full text-left border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-slate-50 dark:bg-slate-800 border-b border-slate-200/60 dark:border-white/10", children: [_jsx("th", { className: "px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest", children: dt(`Profili`) }), _jsx("th", { className: "px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest", children: dt(`Ndjekësit`) }), _jsx("th", { className: "px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest", children: dt(`Verifikuar`) }), _jsx("th", { className: "px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right", children: dt(`Veprimet`) })] }) }), _jsxs("tbody", { className: "divide-y divide-slate-100", children: [filteredProfiles.map(profile => (_jsxs("tr", { className: "hover:bg-slate-50 dark:bg-slate-800 transition-colors", children: [_jsx("td", { className: "px-6 py-4", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${profile.color}`, children: profile.initials }), _jsxs("div", { children: [_jsx("div", { className: "font-bold text-slate-900 dark:text-white text-sm", children: profile.name }), _jsx("div", { className: "text-xs text-slate-500 dark:text-slate-400 mt-0.5", children: profile.handle })] })] }) }), _jsx("td", { className: "px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-400", children: profile.followers }), _jsx("td", { className: "px-6 py-4", children: _jsx("button", { onClick: () => handleToggleVerify(profile.id, profile.verified), children: profile.verified ? (_jsxs("span", { className: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider", children: [_jsx(BadgeCheck, { className: "w-3 h-3" }), dt(`PO`)] })) : (_jsx("span", { className: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 text-slate-700 text-[10px] font-bold uppercase tracking-wider", children: dt(`JO`) })) }) }), _jsx("td", { className: "px-6 py-4 text-right", children: _jsx("button", { onClick: () => handleDelete(profile.id), className: "p-2 text-rose-500 hover:bg-rose-50 rounded-2xl transition-colors", title: dt(`Fshij Profilin`), children: _jsx(Trash2, { className: "w-4 h-4" }) }) })] }, profile.id))), filteredProfiles.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 4, className: "px-6 py-12 text-center text-slate-500 dark:text-slate-400 font-medium", children: dt(`Nuk u gjet asnjë profil.`) }) }))] })] }) })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useLanguage } from '../lib/LanguageContext';
import { ShieldAlert, LogIn, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
export function GuestGuard({ children }) {
    const currentUser = useStore(state => state.currentUser);
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [showOverlay, setShowOverlay] = useState(false);
    useEffect(() => {
        let timer;
        if (!currentUser || currentUser.role === 'guest') {
            timer = setTimeout(() => {
                setShowOverlay(true);
            }, 10000); // 10 seconds
        }
        return () => {
            if (timer)
                clearTimeout(timer);
        };
    }, [currentUser]);
    const isRestricted = !currentUser || currentUser.role === 'guest';
    const guestIdentity = currentUser?.id ? `${currentUser.name} • ${currentUser.id}` : 'Mysafir • GUEST-LOCAL';
    return (_jsxs("div", { className: "relative w-full h-full min-h-screen", children: [_jsx("div", { className: showOverlay && isRestricted ? "pointer-events-none blur-sm transition-all duration-1000 select-none opacity-60" : "transition-all duration-1000", children: children }), _jsx(AnimatePresence, { children: isRestricted && showOverlay && (_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, className: "fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-md", children: _jsxs(motion.div, { initial: { opacity: 0, y: 20, scale: 0.95 }, animate: { opacity: 1, y: 0, scale: 1 }, className: "bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden", children: [_jsx("div", { className: "absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" }), _jsx("div", { className: "w-16 h-16 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-colors", children: _jsx(ShieldAlert, { className: "w-8 h-8 text-blue-500 dark:text-blue-400" }) }), _jsxs("div", { className: "mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-center dark:border-sky-500/20 dark:bg-sky-500/10", children: [_jsx("div", { className: "text-[10px] font-black uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300", children: "Identiteti i Mysafirit" }), _jsx("div", { className: "mt-1 text-sm font-bold text-slate-800 dark:text-white", children: guestIdentity })] }), _jsx("h2", { className: "text-2xl font-bold text-center text-slate-900 dark:text-white mb-3 font-sans tracking-tight", children: dt(`Kërkohet Qasje e Plotë`) }), _jsx("p", { className: "text-slate-500 dark:text-slate-400 text-center text-sm mb-8 leading-relaxed", children: dt(`Koha juaj e provës (10s) për këtë modul përfundoi. Për të parë dhe ndërvepruar me këtë përmbajtje, ju lutemi kyçuni ose krijoni një llogari falas.`) }), _jsxs("div", { className: "space-y-3 pointer-events-auto", children: [_jsxs("button", { onClick: () => navigate('/login'), className: "w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] shadow-blue-500/20 dark:shadow-blue-500/25", children: [_jsx(LogIn, { className: "w-5 h-5" }), dt(`Kyçuni`)] }), _jsxs("button", { onClick: () => navigate('/register'), className: "w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-white dark:hover:text-white font-bold py-3.5 px-6 rounded-xl transition-all", children: [_jsx(UserPlus, { className: "w-5 h-5" }), dt(`Regjistrohu`)] }), _jsx("button", { onClick: () => navigate('/'), className: "w-full text-center py-2 text-xs font-bold text-slate-400 hover:text-slate-500 dark:text-slate-400 dark:hover:text-slate-300 transition-colors mt-2", children: dt(`Kthehu në Ballinë`) })] })] }) })) })] }));
}

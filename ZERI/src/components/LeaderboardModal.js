import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState, useEffect } from 'react';
import { Award, Trophy, Medal, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { AnimatePresence, motion } from 'framer-motion';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../lib/LanguageContext';
export function LeaderboardModal({ isOpen, onClose }) {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const currentUser = useStore(state => state.currentUser);
    const { t } = useLanguage();
    useEffect(() => {
        if (isOpen) {
            const fetchLeaders = async () => {
                try {
                    const q = query(collection(db, "users"), orderBy("points", "desc"), limit(10));
                    const snapshot = await getDocs(q);
                    const topUsers = snapshot.docs.map(doc => ({
                        id: doc.id,
                        name: doc.data().name,
                        points: doc.data().points || 0
                    }));
                    setLeaders(topUsers);
                }
                catch (error) {
                    console.error("Gabim me liderët", error);
                }
                finally {
                    setLoading(false);
                }
            };
            fetchLeaders();
        }
    }, [isOpen]);
    if (!isOpen)
        return null;
    return (_jsx(AnimatePresence, { children: _jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, className: "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4", onClick: onClose, children: _jsxs(motion.div, { initial: { scale: 0.95, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.95, opacity: 0 }, className: "bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white text-center relative", children: [_jsx("button", { onClick: onClose, className: "absolute top-4 right-4 bg-white/20 p-1.5 rounded-full hover:bg-white/40 transition-colors", children: _jsx(X, { className: "w-5 h-5" }) }), _jsx(Trophy, { className: "w-12 h-12 mx-auto mb-3 text-amber-100" }), _jsx("h2", { className: "text-2xl font-black title-serif tracking-wide", children: dt(`Tabela e Liderëve`) }), _jsx("p", { className: "text-amber-100 text-sm font-medium mt-1", children: dt(`Qytetarët më aktivë në platformë`) })] }), _jsx("div", { className: "p-4 max-h-[60vh] overflow-y-auto", children: loading ? (_jsx("div", { className: "py-10 text-center text-slate-400 font-medium", children: dt(`Po ngarkohet...`) })) : (_jsx("div", { className: "space-y-2", children: leaders.map((user, index) => (_jsxs("div", { className: `flex items-center p-3 rounded-xl border ${user.id === currentUser?.id ? 'bg-amber-50 border-amber-200 shadow-sm dark:shadow-none' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/60 dark:border-white/10'}`, children: [_jsx("div", { className: "w-8 flex justify-center shrink-0", children: index === 0 ? _jsx(Medal, { className: "w-6 h-6 text-yellow-500" }) :
                                            index === 1 ? _jsx(Medal, { className: "w-6 h-6 text-slate-400" }) :
                                                index === 2 ? _jsx(Medal, { className: "w-6 h-6 text-amber-700" }) :
                                                    _jsxs("span", { className: "font-bold text-slate-400", children: ["#", index + 1] }) }), _jsx("div", { className: "ml-3 flex-1", children: _jsxs("p", { className: "font-bold text-slate-900 dark:text-white text-sm", children: [user.name, " ", user.id === currentUser?.id && _jsx("span", { className: "text-xs text-amber-600 ml-1 font-semibold", children: dt(`(Ti)`) })] }) }), _jsxs("div", { className: "shrink-0 flex items-center gap-1.5 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-2xl font-bold text-xs border border-amber-200", children: [_jsx(Award, { className: "w-3.5 h-3.5" }), user.points, dt(`pts`)] })] }, user.id))) })) })] }) }) }));
}

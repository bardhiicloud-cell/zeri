import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState, useRef, useEffect } from 'react';
import { Bell, Info, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { sq } from 'date-fns/locale';
export default function NotificationsMenu({ isMobile = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedNotif, setSelectedNotif] = useState(null);
    const notifications = useStore(state => state.notifications);
    const markNotificationAsRead = useStore(state => state.markNotificationAsRead);
    const deleteNotification = useStore(state => state.deleteNotification);
    const menuRef = useRef(null);
    const unreadCount = notifications.filter(n => !n.isRead).length;
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
                setSelectedNotif(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    const getIcon = (type) => {
        switch (type) {
            case 'alert': return _jsx(AlertTriangle, { className: "w-5 h-5 text-amber-500" });
            case 'success': return _jsx(CheckCircle2, { className: "w-5 h-5 text-emerald-500" });
            default: return _jsx(Info, { className: "w-5 h-5 text-blue-500" });
        }
    };
    return (_jsxs("div", { className: "relative", ref: menuRef, children: [_jsxs("button", { onClick: () => { setIsOpen(!isOpen); setSelectedNotif(null); }, className: cn("relative flex items-center justify-center p-2 rounded-2xl transition-colors", isMobile ? "text-white" : "text-slate-700 dark:text-slate-200 dark:text-slate-300 hover:bg-neutral-100 hover:text-slate-900 dark:text-white"), children: [_jsx(Bell, { className: "w-5 h-5" }), unreadCount > 0 && (_jsx("span", { className: "absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white" }))] }), isOpen && (_jsx("div", { className: cn("absolute z-50 w-80 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden", isMobile ? "right-0 top-full mt-2" : "bottom-full mb-2 left-0"), children: selectedNotif ? (_jsxs("div", { className: "flex flex-col h-full animate-in slide-in-from-right-4 duration-200", children: [_jsxs("div", { className: "p-4 border-b border-slate-100 dark:border-white/5 flex items-center gap-3 bg-slate-50 dark:bg-slate-800", children: [_jsx("button", { onClick: () => setSelectedNotif(null), className: "p-1 hover:bg-slate-200 rounded-xl transition-colors", children: _jsx(ChevronRight, { className: "w-5 h-5 rotate-180" }) }), _jsx("span", { className: "text-xs uppercase font-bold tracking-widest text-slate-900 dark:text-white", children: dt(`Detajet e Njoftimit`) })] }), _jsxs("div", { className: "p-5 overflow-y-auto max-h-[320px]", children: [_jsxs("div", { className: "flex items-center gap-3 mb-4", children: [getIcon(selectedNotif.type), _jsx("h3", { className: "font-bold text-slate-900 dark:text-white text-lg leading-tight", children: selectedNotif.title })] }), _jsxs("div", { className: "bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-white/5 mb-4", children: [_jsx("p", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1", children: dt(`Dërguesi`) }), _jsx("p", { className: "text-xs font-bold text-slate-700 dark:text-slate-300", children: selectedNotif.sender || 'Sistemi' })] }), _jsx("p", { className: "text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap", children: selectedNotif.message }), _jsx("div", { className: "mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between", children: _jsx("span", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-widest", children: formatDistanceToNow(new Date(selectedNotif.createdAt), { locale: sq, addSuffix: true }) }) })] })] })) : (_jsxs("div", { className: "flex flex-col h-full animate-in fade-in duration-200", children: [_jsxs("div", { className: "p-3 border-b-2 border-slate-900 bg-neutral-50 flex justify-between items-center", children: [_jsx("span", { className: "text-xs uppercase font-bold tracking-widest text-slate-900 dark:text-white", children: dt(`Njoftimet Zytare`) }), unreadCount > 0 && (_jsxs("span", { className: "text-xs font-bold bg-rose-600 text-white px-2 py-0.5 rounded-full", children: [unreadCount, dt(`TË REJA`)] }))] }), _jsx("div", { className: "max-h-[320px] overflow-y-auto w-full", children: notifications.length === 0 ? (_jsxs("div", { className: "p-8 text-center flex flex-col items-center gap-3", children: [_jsx(Bell, { className: "w-8 h-8 text-slate-300" }), _jsx("span", { className: "text-xs text-slate-500 dark:text-slate-400 font-bold tracking-wide uppercase", children: dt(`Nuk ka njoftime`) })] })) : (_jsx("div", { className: "flex flex-col divide-y divide-slate-100", children: notifications.map(notification => (_jsxs("button", { onClick: () => {
                                        if (!notification.isRead)
                                            markNotificationAsRead(notification.id);
                                        setSelectedNotif(notification);
                                    }, className: cn("p-4 text-left flex gap-3 hover:bg-slate-50 dark:bg-slate-800 transition-colors group", !notification.isRead ? "bg-indigo-50/30" : "bg-white dark:bg-slate-900"), children: [_jsx("div", { className: "shrink-0 pt-0.5", children: getIcon(notification.type) }), _jsxs("div", { className: "flex flex-col min-w-0 flex-1", children: [_jsx("span", { className: "text-sm font-bold text-slate-900 dark:text-white truncate pr-2", children: notification.title }), _jsx("span", { className: "text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5", children: notification.message }), _jsx("span", { className: "text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-2", children: formatDistanceToNow(new Date(notification.createdAt), { locale: sq, addSuffix: true }) })] })] }, notification.id))) })) })] })) }))] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
// Global alert override installer
if (typeof window !== 'undefined') {
    window._nativeAlert = window.alert;
    window.alert = (message) => {
        const msgString = String(message);
        const event = new CustomEvent('app-global-alert', { detail: msgString });
        window.dispatchEvent(event);
        console.log('[GlobalAlert Intercepted]:', msgString);
    };
}
export function GlobalAlert() {
    const [toasts, setToasts] = useState([]);
    useEffect(() => {
        const handleAlertEvent = (e) => {
            const message = e.detail;
            if (!message)
                return;
            const id = Math.random().toString(36).substring(2, 9);
            // Determine toast type based on message keywords
            let type = 'info';
            const msgLower = message.toLowerCase();
            if (msgLower.includes('gabim') ||
                msgLower.includes('dështoi') ||
                msgLower.includes('bllokua') ||
                msgLower.includes('kujdes') ||
                msgLower.includes('gabuar') ||
                msgLower.includes('pasaktë') ||
                msgLower.includes('kërkohet')) {
                type = 'warning';
            }
            else if (msgLower.includes('sukses') ||
                msgLower.includes('aprovuar') ||
                msgLower.includes('zgjidhur') ||
                msgLower.includes('dërguar') ||
                msgLower.includes('kopjuar')) {
                type = 'success';
            }
            const newToast = { id, message, type };
            setToasts((prev) => [...prev, newToast]);
            // Auto-remove after 5 seconds
            setTimeout(() => {
                removeToast(id);
            }, 5000);
        };
        window.addEventListener('app-global-alert', handleAlertEvent);
        return () => {
            window.removeEventListener('app-global-alert', handleAlertEvent);
        };
    }, []);
    const removeToast = (id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };
    return (_jsx("div", { className: "fixed top-20 right-4 left-4 sm:left-auto sm:w-96 z-[99999] flex flex-col gap-2 pointer-events-none", children: _jsx(AnimatePresence, { children: toasts.map((toast) => (_jsx(motion.div, { initial: { opacity: 0, y: -20, scale: 0.95 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, scale: 0.9, transition: { duration: 0.15 } }, className: "pointer-events-auto", children: _jsxs("div", { className: `flex items-start gap-3 p-4 rounded-xl border shadow-xl ${toast.type === 'warning'
                        ? 'bg-rose-950/95 border-rose-500/30 text-rose-200'
                        : toast.type === 'success'
                            ? 'bg-emerald-950/95 border-emerald-500/30 text-emerald-200'
                            : 'bg-slate-900/95 border-slate-700 text-slate-100'}`, children: [_jsx("div", { className: "shrink-0 mt-0.5", children: toast.type === 'warning' ? (_jsx(AlertTriangle, { className: "w-5 h-5 text-rose-400" })) : toast.type === 'success' ? (_jsx(CheckCircle2, { className: "w-5 h-5 text-emerald-400" })) : (_jsx(Info, { className: "w-5 h-5 text-blue-400" })) }), _jsx("div", { className: "flex-1 min-w-0", children: _jsx("p", { className: "text-xs font-semibold leading-relaxed font-sans whitespace-pre-line", children: toast.message }) }), _jsx("button", { onClick: () => removeToast(toast.id), className: `shrink-0 p-1 rounded-2xl transition-colors ${toast.type === 'warning'
                                ? 'hover:bg-rose-900/40 text-rose-400'
                                : toast.type === 'success'
                                    ? 'hover:bg-emerald-900/40 text-emerald-400'
                                    : 'hover:bg-slate-800 text-slate-400'}`, children: _jsx(X, { className: "w-4 h-4" }) })] }) }, toast.id))) }) }));
}

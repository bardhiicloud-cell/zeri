import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.handleReload = () => {
            window.location.reload();
        };
        this.handleGoHome = () => {
            window.location.hash = '/';
            window.location.reload();
        };
        this.state = {
            hasError: false,
            error: null
        };
    }
    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an unhandled runtime error:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (_jsx("div", { className: "min-h-screen bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center p-6 text-slate-900 dark:text-white", children: _jsxs("div", { className: "max-w-md w-full bg-white dark:bg-slate-900 border-2 border-slate-200/60 dark:border-white/10 p-8 rounded-2xl shadow-xl space-y-6 text-center", children: [_jsx("div", { className: "w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-sm dark:shadow-none", children: _jsx(AlertTriangle, { className: "w-8 h-8" }) }), _jsxs("div", { className: "space-y-2", children: [_jsxs("h1", { className: "text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white title-serif", children: [dt(`Ndodhi një gabim`), _jsx("span", { className: "text-rose-600", children: "." })] }), _jsx("p", { className: "text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest", children: dt(`Platforma hasi në një vështirësi teknike`) })] }), _jsxs("div", { className: "bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl p-4 text-left", children: [_jsx("p", { className: "text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1", children: dt(`Detajet e Gabimit:`) }), _jsx("p", { className: "font-mono text-[11px] text-slate-700 dark:text-slate-300 font-semibold break-all whitespace-pre-wrap", children: this.state.error?.message || "Gabim i panjohur në renderim" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3 pt-2", children: [_jsxs("button", { onClick: this.handleReload, className: "flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none cursor-pointer", children: [_jsx(RefreshCw, { className: "w-3.5 h-3.5" }), dt(`RI-NGARKON`)] }), _jsxs("button", { onClick: this.handleGoHome, className: "flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-white font-bold text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800 transition-colors shadow-sm dark:shadow-none cursor-pointer", children: [_jsx(Home, { className: "w-3.5 h-3.5" }), dt(`BALLINA`)] })] })] }) }));
        }
        return this.props.children;
    }
}

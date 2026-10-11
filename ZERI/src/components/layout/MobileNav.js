import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, PlusCircle, MessageSquare, Menu, X, ShieldAlert, LogOut, Search, ChevronRight, } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import { useGlobalSearch } from './GlobalSearch';
import { ALL_SIDEBAR_LINKS, LEGAL_NAV } from '../../lib/navigation';
import { canAccessAdmin } from '../../lib/adminPermissions';
/**
 * Mobile navigation: a bottom tab bar plus a slide-in sheet.
 *
 * 95% of the sessions are phones, and the previous arrangement gave them a
 * 56px desktop bar with a half-visible hamburger and a hidden link list. On a
 * 390px screen the useful controls are always within thumb reach, so the
 * primary actions live in a fixed bottom bar and everything else in the sheet.
 *
 * Five tabs, because six starts wrapping on a 360px device. The centre action
 * ("Raporto") is the primary call to action and is raised above the bar, which
 * is the same affordance every civic app uses.
 */
const TABS = [
    { href: '/', label: 'Ballina', icon: Home },
    { href: '/harta', label: 'Harta', icon: Search },
    { href: '/raporto', label: 'Raporto', icon: PlusCircle, primary: true },
    { href: '/forum', label: 'Debati', icon: MessageSquare },
];
export function MobileNav() {
    const location = useLocation();
    const navigate = useNavigate();
    const currentUser = useStore((state) => state.currentUser);
    const logout = useStore((state) => state.logout);
    const { open: openSearch } = useGlobalSearch();
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const isActive = (path) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
    const close = () => setIsSheetOpen(false);
    const goTo = (href) => {
        close();
        navigate(href);
    };
    return (_jsxs(_Fragment, { children: [_jsxs("nav", { "aria-label": dt('Navigimi kryesor'), className: "fixed inset-x-0 bottom-0 z-40 md:hidden", children: [_jsx("div", { "aria-hidden": "true", className: "pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-(--color-page) via-(--color-page)/85 to-transparent dark:from-(--color-brand-dark) dark:via-(--color-brand-dark)/85" }), _jsx("div", { className: "relative border-t border-slate-200/80 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-900/85", children: _jsxs("ul", { className: "grid grid-cols-5 items-end", children: [TABS.slice(0, 2).map((tab) => (_jsx("li", { children: _jsx(TabLink, { tab: tab, active: isActive(tab.href), onClick: () => goTo(tab.href) }) }, tab.href))), _jsx("li", { className: "flex justify-center", children: _jsx(Link, { to: tabHref(TABS[2]), onClick: () => goTo(TABS[2].href), "aria-label": dt('Raporto një problem'), className: cn('relative -mt-6 flex h-14 w-14 items-center justify-center rounded-2xl', 'bg-gradient-to-br from-blue-600 to-blue-900 text-white', 'shadow-[0_10px_24px_-6px_rgba(37,99,235,0.7)]', 'ring-4 ring-(--color-page) transition-transform active:scale-95', 'dark:ring-(--color-brand-dark)'), children: _jsx(PlusCircle, { className: "h-7 w-7", "aria-hidden": "true" }) }) }), TABS.slice(3).map((tab) => (_jsx("li", { children: _jsx(TabLink, { tab: tab, active: isActive(tab.href), onClick: () => goTo(tab.href) }) }, tab.href))), _jsx("li", { children: _jsxs("button", { type: "button", onClick: () => setIsSheetOpen(true), "aria-label": dt('Menuja'), "aria-expanded": isSheetOpen, className: cn('flex w-full flex-col items-center gap-1 py-2 text-[10px] font-bold transition-colors', 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'), children: [_jsx(Menu, { className: "h-[22px] w-[22px]", "aria-hidden": "true" }), _jsx("span", { children: dt('Menu') })] }) })] }) })] }), _jsx(AnimatePresence, { children: isSheetOpen && (_jsxs("div", { role: "dialog", "aria-modal": "true", "aria-label": dt('Menuja'), className: "fixed inset-0 z-50 md:hidden", children: [_jsx(motion.button, { type: "button", initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, onClick: close, "aria-label": dt('Mbyll menunë'), className: "absolute inset-0 bg-slate-950/60 backdrop-blur-sm" }), _jsxs(motion.div, { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: { type: 'spring', duration: 0.32, bounce: 0 }, className: "absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[26px] border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl dark:border-white/10 dark:bg-slate-900", children: [_jsx("div", { className: "flex justify-center pt-2.5", "aria-hidden": "true", children: _jsx("span", { className: "h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" }) }), _jsxs("div", { className: "flex shrink-0 items-center justify-between px-4 py-3", children: [_jsxs("span", { className: "flex items-center gap-2.5", children: [_jsx("span", { className: "flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-brand-primary) text-xs font-black text-white", children: "Z" }), _jsx("span", { className: "text-sm font-black text-slate-900 dark:text-white", children: dt('Menuja') })] }), _jsx("button", { type: "button", onClick: close, "aria-label": dt('Mbyll menunë'), className: "rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800", children: _jsx(X, { className: "h-4 w-4", "aria-hidden": "true" }) })] }), _jsx("div", { className: "shrink-0 px-4 pb-3", children: _jsxs("button", { type: "button", onClick: () => {
                                            close();
                                            // Deferred so the sheet is gone before the palette mounts.
                                            window.setTimeout(openSearch, 120);
                                        }, className: "flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-semibold text-slate-500 transition-colors hover:border-blue-300 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400", children: [_jsx(Search, { className: "h-4 w-4 shrink-0", "aria-hidden": "true" }), dt('Kërko faqe, komunë...')] }) }), _jsxs("nav", { "aria-label": dt('Modulet qytetare'), className: "min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3 [overscroll-behavior:contain]", children: [_jsx("ul", { className: "space-y-0.5", children: ALL_SIDEBAR_LINKS.map((item) => {
                                                const active = isActive(item.href);
                                                return (_jsx("li", { children: _jsxs(Link, { to: item.href, onClick: close, "aria-current": active ? 'page' : undefined, className: cn('flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors', active
                                                            ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                                                            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'), children: [_jsx(item.icon, { className: cn('h-[18px] w-[18px] shrink-0', active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'), "aria-hidden": "true" }), _jsx("span", { className: "flex-1 truncate", children: item.label }), _jsx(ChevronRight, { className: "h-4 w-4 shrink-0 opacity-30", "aria-hidden": "true" })] }) }, item.href));
                                            }) }), canAccessAdmin(currentUser) && (_jsxs(_Fragment, { children: [_jsx("div", { className: "my-3 h-px bg-slate-100 dark:bg-white/5" }), _jsxs(Link, { to: "/admin", onClick: close, className: "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30", children: [_jsx(ShieldAlert, { className: "h-[18px] w-[18px] shrink-0", "aria-hidden": "true" }), dt('Paneli Administrativ')] })] })), _jsx("div", { className: "my-3 h-px bg-slate-100 dark:bg-white/5" }), LEGAL_NAV.map((link) => (_jsx(Link, { to: link.href, onClick: close, className: "flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800", children: link.label }, link.href))), currentUser && (_jsxs("button", { type: "button", onClick: () => {
                                                close();
                                                logout();
                                            }, className: "mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400", children: [_jsx(LogOut, { className: "h-[18px] w-[18px] shrink-0", "aria-hidden": "true" }), dt('Dil nga llogaria')] }))] })] })] })) })] }));
}
function tabHref(tab) {
    return tab.href;
}
function TabLink({ tab, active, onClick, }) {
    return (_jsxs(Link, { to: tab.href, onClick: onClick, "aria-current": active ? 'page' : undefined, "aria-label": tab.label, className: cn('flex w-full flex-col items-center gap-1 py-2 text-[10px] font-bold transition-colors', active
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'), children: [_jsx(tab.icon, { className: "h-[22px] w-[22px]", "aria-hidden": "true" }), _jsx("span", { children: tab.label })] }));
}

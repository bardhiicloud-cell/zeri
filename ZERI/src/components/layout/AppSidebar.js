import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, ShieldAlert, LogOut, FileText, } from 'lucide-react';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import { ALL_SIDEBAR_LINKS, LEGAL_NAV } from '../../lib/navigation';
import { canAccessAdmin } from '../../lib/adminPermissions';
/**
 * Group the flat link list without repeating it.
 *
 * Order comes from navigation.ts; membership is decided here by matching on
 * paths, so a module added to navigation.ts can never end up stranded in an
 * "ungrouped" bucket at the bottom.
 */
const GROUP_SPECS = [
    {
        id: 'primary',
        title: 'Kryesore',
        hrefs: ['/', '/raporto', '/harta', '/detailed-registry', '/trackid'],
    },
    {
        id: 'participate',
        title: 'Pjesëmarrja qytetare',
        // "Buxhetimi me pjesëmarrje" (/buxheti) is intentionally NOT listed here: the
        // page was never routed, so the entry was a dead link in the sidebar. Remove
        // the route and the link together — never re-add one without the other.
        hrefs: ['/idea', '/sondazhet', '/forum'],
    },
    {
        id: 'services',
        title: 'Shërbime & transparencë',
        hrefs: [
            '/sherbimet', '/komunat', '/kontakt-numrat', '/ndihma', '/donacion',
            '/shendetesia', '/statistikat', '/projektet',
            // Anything added to navigation.ts but not claimed above still renders —
            // the "Të tjera" bucket catches it, so no module can go missing again.
        ],
    },
];
export function AppSidebar({ onNavigate }) {
    const location = useLocation();
    const currentUser = useStore((state) => state.currentUser);
    const logout = useStore((state) => state.logout);
    const [collapsed, setCollapsed] = useState(false);
    const isActive = (path) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
    const grouped = GROUP_SPECS.map((spec) => ({
        id: spec.id,
        title: spec.title,
        items: ALL_SIDEBAR_LINKS.filter((link) => spec.hrefs.includes(link.href)),
    }));
    const claimed = new Set(GROUP_SPECS.flatMap((spec) => spec.hrefs));
    const leftovers = ALL_SIDEBAR_LINKS.filter((link) => !claimed.has(link.href));
    if (leftovers.length > 0) {
        grouped.push({ id: 'other', title: 'Të tjera', items: leftovers });
    }
    return (_jsxs("aside", { className: cn('hidden shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900', 'md:col-start-1 md:row-start-2 md:flex md:h-[calc(100dvh-56px)]', 'transition-[width] duration-200 ease-out', collapsed ? 'md:w-14' : 'md:w-[248px]'), children: [_jsxs("nav", { "aria-label": dt('Modulet qytetare'), className: "min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 [overscroll-behavior:contain] [scrollbar-width:thin]", children: [grouped.map((group) => group.items.length === 0 ? null : (_jsxs("div", { className: "mb-3 last:mb-0", children: [!collapsed && (_jsxs(_Fragment, { children: [_jsx("h2", { className: "mb-1 px-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500", children: dt(group.title) }), _jsx("div", { className: "mb-1.5 h-px bg-slate-100 dark:bg-white/5" })] })), _jsx("ul", { className: "space-y-0.5", children: group.items.map((item) => {
                                    const active = isActive(item.href);
                                    return (_jsx("li", { children: _jsxs(Link, { to: item.href, onClick: onNavigate, "aria-current": active ? 'page' : undefined, title: collapsed ? item.label : undefined, className: cn('group relative flex h-8 items-center rounded-lg py-1.5 text-[13px] font-semibold transition-colors', collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5', active
                                                ? 'bg-slate-100 text-slate-900 before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-blue-600 dark:bg-slate-800 dark:text-white'
                                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'), children: [_jsx(item.icon, { className: cn('h-[18px] w-[18px] shrink-0 transition-colors', active
                                                        ? 'text-blue-600 dark:text-blue-400'
                                                        : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'), "aria-hidden": "true" }), !collapsed && _jsx("span", { className: "truncate leading-none", children: item.label })] }) }, item.href));
                                }) })] }, group.id))), canAccessAdmin(currentUser) && (_jsxs(_Fragment, { children: [_jsx("div", { className: "my-2 h-px bg-slate-100 dark:bg-white/5" }), _jsxs(Link, { to: "/admin", onClick: onNavigate, title: collapsed ? dt('Paneli Administrativ') : undefined, className: cn('group relative flex h-8 items-center rounded-lg py-1.5 text-[13px] font-bold text-rose-700 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30', collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'), children: [_jsx(ShieldAlert, { className: "h-[18px] w-[18px] shrink-0", "aria-hidden": "true" }), !collapsed && _jsx("span", { className: "truncate leading-none", children: dt('Paneli Administrativ') })] })] }))] }), _jsxs("div", { className: "mt-auto shrink-0 border-t border-slate-100 p-1.5 dark:border-white/5", children: [LEGAL_NAV.map((link) => (_jsxs(Link, { to: link.href, onClick: onNavigate, title: collapsed ? link.label : undefined, className: cn('flex h-7 items-center rounded-lg py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800', collapsed ? 'justify-center px-0' : 'gap-2 px-2.5'), children: [_jsx(FileText, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }), !collapsed && _jsx("span", { className: "truncate leading-none", children: link.label })] }, link.href))), currentUser && (_jsxs("button", { type: "button", onClick: () => {
                            logout();
                            onNavigate?.();
                        }, title: collapsed ? dt('Dil nga llogaria') : undefined, className: cn('flex h-7 w-full items-center rounded-lg py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:text-slate-500 dark:hover:bg-rose-950/30', collapsed ? 'justify-center px-0' : 'gap-2 px-2.5'), children: [_jsx(LogOut, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }), !collapsed && _jsx("span", { className: "truncate leading-none", children: dt('Dil nga llogaria') })] })), _jsx("button", { type: "button", onClick: () => setCollapsed((value) => !value), "aria-label": collapsed ? dt('Zgjero menunë') : dt('Mblidh menunë'), "aria-expanded": !collapsed, title: collapsed ? dt('Zgjero menunë') : dt('Mblidh menunë'), className: cn('mt-0.5 flex h-7 w-full items-center rounded-lg py-1 text-[11px] font-semibold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200', collapsed ? 'justify-center px-0' : 'gap-2 px-2.5'), children: collapsed ? (_jsx(PanelLeftOpen, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": "true" })) : (_jsxs(_Fragment, { children: [_jsx(PanelLeftClose, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }), _jsx("span", { className: "truncate leading-none", children: dt('Mblidh menunë') })] })) })] })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { Link } from 'react-router-dom';
import { Mail, Phone, Heart } from 'lucide-react';
import { CookiePreferencesButton } from './CookieConsentBanner';
const COLUMNS = [
    {
        title: 'Platforma',
        links: [
            { to: '/', label: 'Ballina' },
            { to: '/harta', label: 'Harta e Raporteve' },
            { to: '/detailed-registry', label: 'Regjistri i Raporteve' },
            { to: '/statistikat', label: 'Statistikat' },
        ],
    },
    {
        title: 'Pjesëmarrja',
        links: [
            { to: '/raporto', label: 'Raporto një Problem' },
            { to: '/forum', label: 'Debati Publik' },
            { to: '/sondazhet', label: 'Sondazhet Publike' },
            { to: '/Idea', label: 'Idetë Qytetare' },
            { to: '/donacion', label: 'Ndihma & Donacione' },
        ],
    },
    {
        title: 'Shërbimet',
        links: [
            { to: '/sherbimet', label: 'Shërbimet' },
            { to: '/kontakt-numrat', label: 'Numrat & Institucionet' },
            { to: '/komunat', label: 'Komunat' },
            { to: '/shendetesia', label: 'Regjistri Shëndetësor' },
            { to: '/ndihma', label: 'Qendra e Ndihmës' },
        ],
    },
    {
        title: 'Ligji & Transparenca',
        links: [
            { to: '/privatesia', label: 'Politika e Privatësisë' },
            { to: '/kushtet-e-perdorimit', label: 'Kushtet e Përdorimit' },
            { to: '/trackid', label: 'Gjej Raportin Tim' },
            { to: '/rreth-projektit', label: 'Rreth Projektit' },
        ],
    },
];
/**
 * Site footer.
 *
 * There was none. The privacy policy, the terms of use and the cookie
 * preferences were reachable only from the sidebar's least-visible group, and a
 * citizen on mobile had no way to change their cookie choice at all after the
 * first decision — which Law 06/L-082 requires to be possible at any time.
 */
export function AppFooter() {
    return (_jsx("footer", { className: "mt-auto border-t border-slate-200 bg-white dark:border-white/5 dark:bg-slate-900", children: _jsxs("div", { className: "mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 sm:py-12 lg:px-8", children: [_jsxs("div", { className: "grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]", children: [_jsxs("div", { children: [_jsxs(Link, { to: "/", className: "inline-flex items-center gap-2.5", children: [_jsx("span", { className: "flex h-9 w-9 items-center justify-center rounded-xl bg-(--color-brand-primary) text-sm font-black text-white", children: "Z" }), _jsxs("span", { className: "flex flex-col", children: [_jsx("span", { className: "text-sm font-black tracking-tight text-slate-900 dark:text-white", children: dt('Zëri Qytetarëve') }), _jsx("span", { className: "text-[9px] font-semibold text-slate-500 dark:text-slate-400", children: dt('Republika e Kosovës') })] })] }), _jsx("p", { className: "mt-4 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400", children: dt('Platforma kombëtare e angazhimit qytetar. Raportoni çështjet, ndiqni zgjidhjet dhe merrni pjesë në vendimmarrjen komunale.') }), _jsxs("div", { className: "mt-4 space-y-1.5 text-xs", children: [_jsxs("a", { href: "mailto:privatisi@zeriqytetare.republiks", className: "flex items-center gap-2 text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400", children: [_jsx(Mail, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }), "privatisi@zeriqytetare.republiks"] }), _jsxs("a", { href: "tel:+38344123456", className: "flex items-center gap-2 text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400", children: [_jsx(Phone, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }), "+383 44 123 456"] })] })] }), COLUMNS.map((column) => (_jsxs("nav", { "aria-label": column.title, children: [_jsx("h2", { className: "text-[10px] font-black uppercase tracking-[0.14em] text-slate-400", children: column.title }), _jsx("ul", { className: "mt-3 space-y-2", children: column.links.map((link) => (_jsx("li", { children: _jsx(Link, { to: link.to, className: "text-xs text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400", children: link.label }) }, link.to))) })] }, column.title)))] }), _jsxs("div", { className: "mt-9 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-white/5", children: [_jsx("p", { className: "text-[11px] leading-relaxed text-slate-400", children: dt('Të dhënat përpunohen sipas Ligjit Nr. 06/L-082 për Mbrojtjen e të Dhënave Personale në Kosovë dhe GDPR-së së Bashkimit Europian.') }), _jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [_jsx(CookiePreferencesButton, {}), _jsxs("span", { className: "flex items-center gap-1.5 text-[11px] text-slate-400", children: [_jsx(Heart, { className: "h-3 w-3 text-rose-500", "aria-hidden": "true" }), dt('Bërë për qytetarët e Kosovës')] })] })] })] }) }));
}

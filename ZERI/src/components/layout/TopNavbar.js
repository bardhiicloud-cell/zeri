import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { ChevronDown, PlusCircle, FileText, LogIn, LogOut, ShieldAlert, Globe, Sun, Moon, Menu, Check, Building2, ChevronRight, Home, } from 'lucide-react';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/LanguageContext';
import { TOP_NAV, FEATURED_MUNICIPALITIES, LEGAL_NAV, } from '../../lib/navigation';
import { canAccessAdmin } from '../../lib/adminPermissions';
const LANGUAGES = [
    { code: 'sq', label: 'AL', fullName: 'Shqip', flag: '🇦🇱' },
    { code: 'en', label: 'EN', fullName: 'English', flag: '🇬🇧' },
    { code: 'bs', label: 'BS', fullName: 'Bosanski', flag: '🇧🇦' },
    { code: 'sr', label: 'SR', fullName: 'Srpski', flag: '🇷🇸' },
    { code: 'tr', label: 'TR', fullName: 'Türkçe', flag: '🇹🇷' },
    { code: 'de', label: 'DE', fullName: 'Deutsch', flag: '🇩🇪' },
];
/**
 * Top navigation bar.
 *
 * Three zones: brand on the left, the primary sections centred, and the action
 * cluster on the right. Everything operational lives in the sidebar, so this row
 * stays short enough to be read at a glance and does not compete with it.
 */
export function TopNavbar({ onOpenMobileMenu }) {
    const location = useLocation();
    const { language, setLanguage } = useLanguage();
    const currentUser = useStore((state) => state.currentUser);
    const userMunicipality = useStore((state) => state.userMunicipality);
    const setUserMunicipality = useStore((state) => state.setUserMunicipality);
    const logout = useStore((state) => state.logout);
    const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
    const [openDropdown, setOpenDropdown] = useState('none');
    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }, [isDark]);
    // Any route change closes whatever was open, otherwise the dropdown survives
    // a navigation and appears to be attached to the wrong page.
    useEffect(() => {
        setOpenDropdown('none');
    }, [location.pathname]);
    useEffect(() => {
        if (openDropdown === 'none')
            return;
        const onKeyDown = (event) => {
            if (event.key === 'Escape')
                setOpenDropdown('none');
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [openDropdown]);
    const toggleDropdown = (name) => setOpenDropdown((current) => (current === name ? 'none' : name));
    const currentLanguage = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];
    const isActive = (path) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
    const handleLogout = async () => {
        try {
            await signOut(auth);
        }
        catch {
            // The local session is cleared regardless, so the citizen is not stuck.
        }
        logout();
    };
    return (_jsxs("header", { className: "sticky top-0 z-30 flex h-14 w-full shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 backdrop-blur-md sm:gap-4 sm:px-4 dark:border-white/10 dark:bg-slate-900", children: [_jsx("button", { type: "button", onClick: onOpenMobileMenu, "aria-label": dt('Menuja'), className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50 md:hidden dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800", children: _jsx(Menu, { className: "h-4 w-4", "aria-hidden": "true" }) }), _jsxs(Link, { to: "/", className: "flex shrink-0 items-center gap-2.5", "aria-label": "Z\u00EBri Qytetar\u00EBve \u2014 Ballina", children: [_jsx("span", { className: "flex h-9 w-9 items-center justify-center rounded-xl bg-(--color-brand-primary) text-sm font-black text-white", children: "Z" }), _jsxs("span", { className: "flex flex-col leading-none", children: [_jsxs("span", { className: "text-sm font-black tracking-tight text-slate-900 dark:text-white", children: [dt('Zëri Qytetarëve'), _jsx("span", { className: "text-blue-600", children: "." })] }), _jsx("span", { className: "text-[8px] font-semibold text-slate-500 dark:text-slate-400", children: dt('Republika e Kosovës') })] })] }), _jsx("nav", { "aria-label": dt('Navigimi kryesor'), className: "hidden min-w-0 flex-1 overflow-x-auto overflow-y-visible scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] md:block [&::-webkit-scrollbar]:hidden", children: _jsxs("ul", { className: "flex w-max min-w-full items-center gap-0.5", children: [_jsx("li", { className: "shrink-0", children: _jsx(NavBarLink, { link: { label: dt('Kryefaqja'), href: '/', icon: Home }, active: isActive('/') }) }), _jsxs("li", { className: "relative shrink-0", children: [_jsxs("button", { type: "button", onClick: () => toggleDropdown('municipalities'), "aria-expanded": openDropdown === 'municipalities', "aria-haspopup": "true", className: cn('flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-bold transition-colors', openDropdown === 'municipalities'
                                        ? 'bg-slate-100 text-(--color-brand-primary) dark:bg-slate-800'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-(--color-brand-primary) dark:text-slate-300 dark:hover:bg-slate-800'), children: [_jsx(Building2, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), dt('Komunat'), _jsx(ChevronDown, { className: cn('h-3 w-3 transition-transform', openDropdown === 'municipalities' && 'rotate-180'), "aria-hidden": "true" })] }), openDropdown === 'municipalities' && (_jsxs("div", { className: "absolute left-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-(--shadow-floating) dark:border-white/10 dark:bg-slate-900", children: [_jsx("p", { className: "px-2.5 pb-1.5 pt-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400", children: dt('Komunat kryesore') }), _jsx("ul", { className: "grid grid-cols-2 gap-0.5", children: FEATURED_MUNICIPALITIES.map((name) => (_jsx("li", { children: _jsxs(Link, { to: `/komunat?komuna=${encodeURIComponent(name)}`, className: "flex min-h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800", children: [name === userMunicipality && (_jsx(Check, { className: "me-1.5 h-3 w-3 shrink-0 text-emerald-600", "aria-hidden": "true" })), _jsx("span", { className: "truncate", children: name })] }) }, name))) }), _jsxs(Link, { to: "/komunat", className: "mt-1 flex min-h-10 items-center justify-between rounded-xl bg-blue-50 px-3 text-xs font-black text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300", children: [dt('Shih të 38 komunat'), _jsx(ChevronRight, { className: "h-3.5 w-3.5", "aria-hidden": "true" })] })] }))] }), TOP_NAV.map((link) => (_jsx("li", { className: "shrink-0", children: _jsx(NavBarLink, { link: link, active: isActive(link.href) }) }, link.href)))] }) }), _jsxs("div", { className: "flex shrink-0 items-center gap-1.5", children: [_jsx("button", { type: "button", onClick: () => setIsDark((value) => !value), "aria-label": isDark ? dt('Ndërro te dita') : dt('Ndërro te natë'), title: isDark ? dt('Ndërro te dita') : dt('Ndërro te natë'), className: "hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 sm:flex dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800", children: isDark ? _jsx(Sun, { className: "h-4 w-4 text-amber-500", "aria-hidden": "true" }) : _jsx(Moon, { className: "h-4 w-4 text-indigo-600", "aria-hidden": "true" }) }), _jsxs("div", { className: "relative hidden sm:block", children: [_jsxs("button", { type: "button", onClick: () => toggleDropdown('language'), "aria-expanded": openDropdown === 'language', "aria-haspopup": "true", "aria-label": dt('Ndrysho gjuhën'), className: "flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800", children: [_jsx(Globe, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), _jsx("span", { className: "font-mono text-[10px] font-black uppercase", children: currentLanguage.label })] }), openDropdown === 'language' && (_jsx("div", { role: "menu", className: "absolute right-0 top-[calc(100%+8px)] z-50 w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-(--shadow-floating) dark:border-white/10 dark:bg-slate-900", children: LANGUAGES.map((lang) => (_jsxs("button", { type: "button", role: "menuitemradio", "aria-checked": language === lang.code, onClick: () => {
                                        setLanguage(lang.code);
                                        setOpenDropdown('none');
                                    }, className: cn('flex min-h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-xs font-bold transition-colors', language === lang.code
                                        ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200'
                                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'), children: [_jsx("span", { "aria-hidden": "true", children: lang.flag }), _jsx("span", { className: "flex-1 truncate", children: lang.fullName }), language === lang.code && _jsx(Check, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": "true" })] }, lang.code))) }))] }), _jsxs(Link, { to: "/trackid", className: "hidden min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 lg:inline-flex dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800", children: [_jsx(FileText, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), dt('Track ID')] }), _jsxs(Link, { to: "/raporto", className: "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-900 px-3 text-xs font-black text-white transition-all hover:brightness-110", children: [_jsx(PlusCircle, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), _jsx("span", { className: "hidden sm:inline", children: dt('Raporto') })] }), currentUser ? (_jsxs("div", { className: "relative hidden sm:block", children: [_jsxs("button", { type: "button", onClick: () => toggleDropdown('profile'), "aria-expanded": openDropdown === 'profile', "aria-haspopup": "true", "aria-label": dt('Menuja e profilit'), className: "flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-2 transition-colors hover:bg-slate-50 dark:border-white/10 dark:hover:bg-slate-800", children: [_jsx("span", { className: "flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-[10px] font-black text-white", children: currentUser.name.charAt(0) }), _jsx("span", { className: "hidden max-w-[7rem] truncate text-xs font-bold text-slate-700 lg:inline dark:text-slate-200", children: currentUser.name })] }), openDropdown === 'profile' && (_jsxs("div", { className: "absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-(--shadow-floating) dark:border-white/10 dark:bg-slate-900", children: [_jsxs("div", { className: "px-2.5 py-2", children: [_jsx("p", { className: "truncate text-xs font-black text-slate-900 dark:text-white", children: currentUser.name }), _jsx("p", { className: "truncate text-[10px] text-slate-500 dark:text-slate-400", children: currentUser.email || dt('Përdorues i regjistruar') })] }), _jsx("div", { className: "my-1 border-t border-slate-100 dark:border-white/5" }), _jsx("label", { className: "block px-2.5 pb-1 pt-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400", children: dt('Zona juaj') }), _jsxs("select", { value: userMunicipality || 'Të gjitha Komunat', onChange: (event) => {
                                            const value = event.target.value;
                                            setUserMunicipality(value);
                                            localStorage.setItem('kosova_user_muni', value);
                                        }, "aria-label": dt('Zgjidh komunën'), className: "mx-1 mb-1 w-[calc(100%-0.5rem)] min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-bold dark:border-white/10 dark:bg-slate-800", children: [_jsx("option", { value: "T\u00EB gjitha Komunat", children: dt('Kosova (të gjitha komunat)') }), FEATURED_MUNICIPALITIES.map((name) => (_jsx("option", { value: name, children: name }, name)))] }), _jsx("div", { className: "my-1 border-t border-slate-100 dark:border-white/5" }), canAccessAdmin(currentUser) && (_jsxs(Link, { to: "/admin", className: "flex min-h-9 items-center gap-2.5 rounded-xl px-2.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30", children: [_jsx(ShieldAlert, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), dt('Paneli Administrativ')] })), LEGAL_NAV.map((link) => (_jsx(Link, { to: link.href, className: "flex min-h-9 items-center rounded-xl px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800", children: link.label }, link.href))), _jsxs("button", { type: "button", onClick: handleLogout, className: "flex min-h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800", children: [_jsx(LogOut, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), dt('Dil')] })] }))] })) : (_jsxs(Link, { to: "/login", className: "hidden h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-black text-white transition-colors hover:bg-slate-800 sm:inline-flex dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white", children: [_jsx(LogIn, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), dt('Hyr')] }))] })] }));
}
function NavBarLink({ link, active }) {
    return (_jsx(NavLink, { to: link.href, end: link.href === '/', "aria-current": active ? 'page' : undefined, className: cn('flex min-h-9 items-center rounded-lg px-3 text-xs font-bold transition-colors', active
            ? 'text-(--color-brand-primary)'
            : 'text-slate-600 hover:bg-slate-50 hover:text-(--color-brand-primary) dark:text-slate-300 dark:hover:bg-slate-800'), children: _jsx("span", { className: cn('relative', active && 'after:absolute after:-bottom-1 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-(--color-brand-primary)'), children: link.label }) }));
}

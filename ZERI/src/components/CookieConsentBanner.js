import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Cookie, ShieldCheck, X, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { dt } from '@/src/lib/dt';
import { announceConsentChange, CATEGORY_LABELS, hasDecided, OPTIONAL_CATEGORIES, readConsent, writeConsent, } from '../lib/consent';
/**
 * Cookie consent banner — Law 06/L-082 compliant.
 *
 * The banner is a hard gate, not a decoration: until the citizen answers, the
 * optional categories are false, so Google Analytics is never initialised and
 * NearbyAlerts never asks for geolocation. Rejecting is exactly as easy as
 * accepting, as Article 9 requires.
 */
export default function CookieConsentBanner() {
    const [isOpen, setIsOpen] = useState(false);
    const [showPreferences, setShowPreferences] = useState(false);
    const [analytics, setAnalytics] = useState(false);
    const [marketing, setMarketing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // Open on mount only when no valid decision is stored. Reading in an effect
    // keeps the first paint free of a banner flash for returning visitors.
    useEffect(() => {
        if (!hasDecided()) {
            setIsOpen(true);
        }
    }, []);
    // Lock body scroll while the banner is up so the page behind it cannot move.
    useEffect(() => {
        if (!isOpen)
            return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [isOpen]);
    // Escape closes the preferences view but never the banner itself: a dismissal
    // without a decision would leave the visitor in the undecided state.
    useEffect(() => {
        if (!isOpen)
            return;
        const onKeyDown = (event) => {
            if (event.key === 'Escape')
                setShowPreferences(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen]);
    const apply = useCallback((next) => {
        setIsSaving(true);
        const saved = writeConsent(next);
        // Announce synchronously so the analytics bootstrap and the geolocation
        // gate react to the new value within the same tick, before any re-render.
        announceConsentChange(saved);
        window.setTimeout(() => {
            setIsSaving(false);
            setIsOpen(false);
        }, 180);
    }, []);
    const acceptAll = useCallback(() => {
        apply({ analytics: true, marketing: true });
    }, [apply]);
    const rejectOptional = useCallback(() => {
        apply({ analytics: false, marketing: false });
    }, [apply]);
    const savePreferences = useCallback(() => {
        apply({ analytics, marketing });
    }, [apply, analytics, marketing]);
    const categoryToggles = [
        { key: 'essential', checked: true, onChange: () => { }, locked: true },
        { key: 'analytics', checked: analytics, onChange: setAnalytics },
        { key: 'marketing', checked: marketing, onChange: setMarketing },
    ];
    return (_jsx(AnimatePresence, { children: isOpen && (_jsxs("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": "cookie-consent-title", className: "fixed inset-0 z-[100000] flex items-end justify-center sm:items-center sm:p-4", children: [_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, className: "absolute inset-0 bg-slate-950/60 backdrop-blur-sm" }), _jsxs(motion.div, { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 24 }, transition: { type: 'spring', duration: 0.4, bounce: 0 }, className: "luxury-card relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900", children: [_jsxs("div", { className: "flex items-start gap-3.5 border-b border-slate-100 p-5 dark:border-white/5 sm:p-6", children: [_jsx("div", { className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", children: _jsx(Cookie, { className: "h-5 w-5", "aria-hidden": "true" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("h2", { id: "cookie-consent-title", className: "title-serif text-lg font-black tracking-tight text-slate-900 dark:text-white", children: dt('Politika e privatësisë dhe Cookies') }), _jsx("p", { className: "mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400", children: dt('Ligji Nr. 06/L-082 për Mbrojtjen e të Dhënave Personale në Kosovë kërkon pëlqimin tuaj të qartë dhe të lirë për çdo Cookies jo-esenciale dhe çdo gjurmim të lokacionit.') })] }), showPreferences && (_jsx("button", { type: "button", onClick: () => setShowPreferences(false), "aria-label": dt('Mbyll menunë'), className: "shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800", children: _jsx(X, { className: "h-4 w-4", "aria-hidden": "true" }) }))] }), _jsx("div", { className: "min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6", children: !showPreferences ? (_jsxs("div", { className: "space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300", children: [_jsxs("p", { children: [dt('Ne përdorim Cookies dhe teknologji të ngjashme për të mbajtur sesionin tuaj, për të matur sa të përdoret platforma dhe për të shfaqur reklama.'), " ", dt('Pa pëlqimin tuaj, asnjë Cookies analitike apo marketingu nuk ngarkohet.')] }), _jsx("ul", { className: "space-y-1.5", children: OPTIONAL_CATEGORIES.map((key) => (_jsxs("li", { className: "flex items-start gap-2", children: [_jsx(ShieldCheck, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400", "aria-hidden": "true" }), _jsxs("span", { children: [_jsx("strong", { className: "font-bold text-slate-800 dark:text-white", children: CATEGORY_LABELS[key].sq }), ' — ', CATEGORY_LABELS[key].descriptionSq] })] }, key))) }), _jsxs("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: [dt('Mund ta ndryshoni vendimin në çdo kohë nga këtu:'), " ", '', _jsx("button", { type: "button", onClick: () => setShowPreferences(true), className: "font-bold text-blue-700 underline underline-offset-2 dark:text-blue-300", children: dt('Menaxho preferencat') })] })] })) : (_jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-xs leading-relaxed text-slate-500 dark:text-slate-400", children: dt('Aktivizoni ose çaktivizoni secilën kategori. Cookies të domosdoshme nuk mund të çaktivizohen sepse pa to platforma nuk funksionon.') }), categoryToggles.map((toggle) => (_jsxs("label", { className: cn('flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors', toggle.locked
                                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 dark:border-white/5 dark:bg-slate-800/40'
                                            : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 dark:border-white/10 dark:hover:border-blue-500/40 dark:hover:bg-slate-800/50'), children: [_jsx("input", { type: "checkbox", checked: toggle.checked, disabled: toggle.locked, onChange: (event) => toggle.onChange(event.target.checked), className: "mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-blue-600 disabled:cursor-not-allowed" }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsx("span", { className: "block text-sm font-black text-slate-900 dark:text-white", children: CATEGORY_LABELS[toggle.key].sq }), _jsx("span", { className: "mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400", children: CATEGORY_LABELS[toggle.key].descriptionSq })] })] }, toggle.key)))] })) }), _jsx("div", { className: "flex flex-col gap-2 border-t border-slate-100 p-4 dark:border-white/5 sm:flex-row sm:justify-end sm:p-5", children: showPreferences ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: rejectOptional, disabled: isSaving, className: "min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800", children: dt('Refuzo jo-esencialet') }), _jsxs("button", { type: "button", onClick: savePreferences, disabled: isSaving, className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-900 px-5 py-2.5 text-xs font-black text-white transition-all hover:brightness-110 disabled:opacity-60", children: [isSaving && _jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin", "aria-hidden": "true" }), dt('Ruaj preferencat')] })] })) : (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: rejectOptional, disabled: isSaving, className: "min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800", children: dt('Refuzo jo-esencialet') }), _jsxs("button", { type: "button", onClick: acceptAll, disabled: isSaving, className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-900 px-5 py-2.5 text-xs font-black text-white transition-all hover:brightness-110 disabled:opacity-60", children: [isSaving && _jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin", "aria-hidden": "true" }), dt('Prano të gjitha')] })] })) }), _jsxs("button", { type: "button", onClick: () => setShowPreferences((open) => !open), className: "flex items-center justify-center gap-1.5 border-t border-slate-100 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 transition-colors hover:bg-slate-50 dark:border-white/5 dark:hover:bg-slate-800/60", children: [showPreferences ? dt('Kthehu te përmbledhja') : dt('Detajet e cookies'), _jsx(ChevronDown, { className: cn('h-3 w-3 transition-transform', showPreferences && 'rotate-180'), "aria-hidden": "true" })] })] })] })) }));
}
/**
 * Small re-openable entry point for the footer and the settings screen.
 *
 * A visitor must be able to change their mind at any time — that is a
 * substantive right under Article 9, not a nicety — so this reads the stored
 * state on mount and pre-fills the toggles.
 */
export function CookiePreferencesButton({ className }) {
    const [isOpen, setIsOpen] = useState(false);
    const [analytics, setAnalytics] = useState(false);
    const [marketing, setMarketing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    useEffect(() => {
        const stored = readConsent();
        setAnalytics(stored?.analytics ?? false);
        setMarketing(stored?.marketing ?? false);
    }, []);
    const save = useCallback((next) => {
        setIsSaving(true);
        const state = writeConsent(next);
        announceConsentChange(state);
        window.setTimeout(() => {
            setIsSaving(false);
            setIsOpen(false);
        }, 180);
    }, []);
    return (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", onClick: () => setIsOpen(true), className: cn('inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400', className), children: [_jsx(Cookie, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), dt('Menaxho Cookies')] }), _jsx(AnimatePresence, { children: isOpen && (_jsxs("div", { className: "fixed inset-0 z-[100000] flex items-end justify-center sm:items-center sm:p-4", children: [_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, onClick: () => setIsOpen(false), className: "absolute inset-0 bg-slate-950/60 backdrop-blur-sm" }), _jsxs(motion.div, { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 24 }, role: "dialog", "aria-modal": "true", "aria-labelledby": "cookie-preferences-title", className: "luxury-card relative w-full max-w-lg overflow-hidden rounded-[26px] border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:p-6", children: [_jsxs("div", { className: "mb-4 flex items-start gap-3", children: [_jsx("div", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", children: _jsx(Cookie, { className: "h-5 w-5", "aria-hidden": "true" }) }), _jsx("h3", { id: "cookie-preferences-title", className: "title-serif flex-1 text-lg font-black tracking-tight text-slate-900 dark:text-white", children: dt('Preferencat tuaja të privatësisë') }), _jsx("button", { type: "button", onClick: () => setIsOpen(false), "aria-label": dt('Mbyll'), className: "shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800", children: _jsx(X, { className: "h-4 w-4", "aria-hidden": "true" }) })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "flex cursor-not-allowed items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/5 dark:bg-slate-800/40", children: [_jsx("input", { type: "checkbox", checked: true, disabled: true, className: "mt-0.5 h-5 w-5 shrink-0 accent-blue-600" }), _jsxs("span", { children: [_jsx("span", { className: "block text-sm font-black text-slate-900 dark:text-white", children: CATEGORY_LABELS.essential.sq }), _jsx("span", { className: "mt-0.5 block text-xs text-slate-500 dark:text-slate-400", children: CATEGORY_LABELS.essential.descriptionSq })] })] }), _jsxs("label", { className: "flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3.5 transition-colors hover:border-blue-300 dark:border-white/10 dark:hover:border-blue-500/40", children: [_jsx("input", { type: "checkbox", checked: analytics, onChange: (event) => setAnalytics(event.target.checked), className: "mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-blue-600" }), _jsxs("span", { children: [_jsx("span", { className: "block text-sm font-black text-slate-900 dark:text-white", children: CATEGORY_LABELS.analytics.sq }), _jsx("span", { className: "mt-0.5 block text-xs text-slate-500 dark:text-slate-400", children: CATEGORY_LABELS.analytics.descriptionSq })] })] }), _jsxs("label", { className: "flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3.5 transition-colors hover:border-blue-300 dark:border-white/10 dark:hover:border-blue-500/40", children: [_jsx("input", { type: "checkbox", checked: marketing, onChange: (event) => setMarketing(event.target.checked), className: "mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-blue-600" }), _jsxs("span", { children: [_jsx("span", { className: "block text-sm font-black text-slate-900 dark:text-white", children: CATEGORY_LABELS.marketing.sq }), _jsx("span", { className: "mt-0.5 block text-xs text-slate-500 dark:text-slate-400", children: CATEGORY_LABELS.marketing.descriptionSq })] })] })] }), _jsxs("div", { className: "mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end", children: [_jsx("button", { type: "button", onClick: () => save({ analytics: false, marketing: false }), disabled: isSaving, className: "min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800", children: dt('Refuzo të gjitha') }), _jsxs("button", { type: "button", onClick: () => save({ analytics, marketing }), disabled: isSaving, className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-900 px-5 py-2.5 text-xs font-black text-white transition-all hover:brightness-110 disabled:opacity-60", children: [isSaving && _jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin", "aria-hidden": "true" }), dt('Ruaj preferencat')] })] })] })] })) })] }));
}

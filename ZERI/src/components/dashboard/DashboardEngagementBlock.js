import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Phone, MessageCircle, FileText, ArrowRight, Lightbulb, Star, MapPin, TrendingUp, } from 'lucide-react';
import { useStore } from '../../lib/store';
const SPONSOR_PHONE = '+383 44 123 456';
/** wa.me needs the number in international form with no separators. */
const SPONSOR_WHATSAPP = '38344123456';
const SAMPLE_TRACK_IDS = ['ZQ-4587', 'ZQ-4586', 'ZQ-4584'];
/**
 * Two-level engagement block: the sponsorship strip, then the two working
 * widgets.
 *
 * Placed directly under the map and the reports table because that is where a
 * citizen's attention lands after scanning what is happening locally — the two
 * actions available to them from there are "track what I filed" and "propose
 * something new". Both feed the platform's core loop, so they are worth the
 * space rather than being pushed below the fold.
 */
export function DashboardEngagementBlock() {
    const navigate = useNavigate();
    const donationCauses = useStore((state) => state.donationCauses ?? []);
    const [trackId, setTrackId] = useState('');
    /**
     * Normalised to upper case and stripped of the leading '#', because a citizen
     * copying the number off a paper receipt will type any of "ZQ-4587",
     * "#ZQ-4587" or "zq 4587". Sending all three to the registry as-is means the
     * search silently returns nothing on two out of three attempts.
     */
    const submitTrackId = (value) => {
        const cleaned = value.trim().replace(/^#/, '').replace(/\s+/g, '-').toUpperCase();
        if (!cleaned)
            return;
        navigate(`/trackid?id=${encodeURIComponent(cleaned)}`);
    };
    /**
     * The store has no dedicated ideas collection, so the most recent donation
     * causes stand in as the featured civic proposals. This keeps the card
     * populated from data the app already holds instead of opening another
     * Firestore listener for a card most visitors scroll past.
     */
    const featuredIdeas = donationCauses.length >= 2
        ? donationCauses.slice(0, 2).map((cause, index) => ({
            id: cause.id ?? `idea-${index}`,
            title: cause.title ?? cause.name ?? 'Projekt qytetar',
            municipality: cause.municipality ?? 'Kosovë',
            votes: Number(cause.backers ?? cause.votes ?? 0),
        }))
        : [
            { id: 'idea-sample-1', title: 'Korsi e dedikuar biçikletash në Rrugën B', municipality: 'Prishtinë', votes: 184 },
            { id: 'idea-sample-2', title: 'Ndriçim inteligjent dhe Wi-Fi publik në Shadërvan', municipality: 'Prizren', votes: 142 },
        ];
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("section", { "aria-label": "Hap\u00EBsira e sponsorizimit", className: "w-full", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-widest text-slate-400", children: dt('Hapësira e Sponsorizimit & Partneriteti') }), _jsx("p", { className: "text-[10px] text-slate-400", children: dt('Civic-Tech & Zhvillim Komunal') })] }), _jsxs("div", { className: "flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center dark:border-white/10 dark:bg-slate-900", children: [_jsxs("div", { className: "flex min-w-0 flex-1 items-start gap-3.5", children: [_jsx("div", { className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400", children: _jsx(Sparkles, { className: "h-5 w-5", "aria-hidden": "true" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("span", { className: "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400", children: dt('Hapësira Reklamimi e Lirë') }), _jsx("h3", { className: "mt-1.5 text-sm font-black leading-snug text-slate-900 dark:text-white sm:text-base", children: dt('Promovoni Biznesin Tuaj Këtu – Bëhuni Pjesë e Komunës') }), _jsx("p", { className: "mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400", children: dt('Arrijni mbi 800 mijë qytetarë aktivë çdo muaj me një banner të dedikuar. Pa pagesa të fshehura, pa të dhëna personale.') })] })] }), _jsxs("div", { className: "flex shrink-0 flex-col gap-2 sm:flex-row", children: [_jsxs("a", { href: `tel:${SPONSOR_PHONE.replace(/\s/g, '')}`, className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800", children: [_jsx(Phone, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), SPONSOR_PHONE] }), _jsxs("a", { href: `https://wa.me/${SPONSOR_WHATSAPP}`, target: "_blank", rel: "noopener noreferrer", className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white transition-colors hover:bg-emerald-700", children: [_jsx(MessageCircle, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), "WhatsApp"] })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-2", children: [_jsxs("section", { "aria-label": "Gjurmimi i raportimit", className: "relative overflow-hidden rounded-3xl border border-blue-900/40 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 p-6", children: [_jsx("div", { "aria-hidden": "true", className: "pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-600/20 blur-3xl" }), _jsxs("div", { className: "relative", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-blue-200 backdrop-blur-sm", children: [_jsx(FileText, { className: "h-3 w-3", "aria-hidden": "true" }), dt('Gjurmimi i Raportimit (Track ID)')] }), _jsx("h3", { className: "title-serif mt-3 text-2xl font-black leading-tight text-white", children: dt('A keni raportuar një problem?') }), _jsx("p", { className: "mt-2 text-xs leading-relaxed text-slate-300", children: dt('Futni numrin unik të referencës (p.sh. ZQ-4587) për të kontrolluar statusin në kohë reale, zyrtarin përgjegjës dhe hapat e ndërmarrë.') }), _jsxs("form", { onSubmit: (event) => {
                                            event.preventDefault();
                                            submitTrackId(trackId);
                                        }, className: "mt-4 space-y-2.5", children: [_jsxs("div", { className: "relative", children: [_jsx(FileText, { className: "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500", "aria-hidden": "true" }), _jsx("input", { type: "text", value: trackId, onChange: (event) => setTrackId(event.target.value), placeholder: dt('SHËNO NUMRIN E TRACK ID (P.SH. ZQ-4587)...'), "aria-label": dt('Numri i Track ID'), className: "w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-3 font-mono text-sm uppercase tracking-wider text-white outline-none transition-colors placeholder:font-sans placeholder:text-[11px] placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500 focus:border-blue-500/60 focus:bg-white/10" })] }), _jsxs("button", { type: "submit", disabled: !trackId.trim(), className: "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-black text-slate-900 transition-all hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40", children: [dt('Verifiko Statusin'), _jsx(ArrowRight, { className: "h-3.5 w-3.5", "aria-hidden": "true" })] })] }), _jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-white/10 pt-3", children: [_jsx("span", { className: "text-[10px] font-bold uppercase tracking-wider text-slate-400", children: dt('Shembuj të shpejtë:') }), SAMPLE_TRACK_IDS.map((id) => (_jsxs("button", { type: "button", onClick: () => {
                                                    setTrackId(id);
                                                    submitTrackId(id);
                                                }, className: "rounded-lg bg-white/5 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-300 transition-colors hover:bg-white/10 hover:text-blue-200", children: ["#", id] }, id)))] })] })] }), _jsxs("section", { "aria-label": "Banka e ideve qytetare", className: "flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400", children: [_jsx(Lightbulb, { className: "h-3 w-3", "aria-hidden": "true" }), dt('Iniciativa Qytetare')] }), _jsxs(Link, { to: "/Idea", className: "inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400", children: [dt('Shiko të gjitha idetë'), _jsx(ArrowRight, { className: "h-3 w-3", "aria-hidden": "true" })] })] }), _jsx("h3", { className: "title-serif mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white", children: dt('Banka e Ideve Qytetare') }), _jsx("p", { className: "mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400", children: dt('Keni një ide për parqe të reja, transport publik apo digjitalizim? Propozoni projektin tuaj dhe mblidhni mbështetjen e komunitetit.') }), _jsx("ul", { className: "mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2", children: featuredIdeas.map((idea) => (_jsx("li", { children: _jsxs(Link, { to: "/Idea", className: "group flex h-full flex-col rounded-2xl border border-slate-200 p-3.5 transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50/40 dark:border-white/10 dark:hover:border-amber-500/40 dark:hover:bg-amber-950/20", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("span", { className: "flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400", children: [_jsx(MapPin, { className: "h-3 w-3 shrink-0", "aria-hidden": "true" }), _jsx("span", { className: "truncate", children: idea.municipality ?? 'Kosovë' })] }), _jsxs("span", { className: "flex shrink-0 items-center gap-1 text-[10px] font-black text-amber-600 dark:text-amber-400", children: [_jsx(Star, { className: "h-3 w-3 fill-current", "aria-hidden": "true" }), idea.votes ?? 0] })] }), _jsx("p", { className: "mt-1.5 line-clamp-3 text-[11px] font-bold leading-snug text-slate-800 dark:text-slate-200", children: idea.title })] }) }, idea.id))) }), _jsxs("div", { className: "mt-auto flex flex-wrap items-center justify-between gap-3 pt-4", children: [_jsxs("span", { className: "flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400", children: [_jsx(TrendingUp, { className: "h-3.5 w-3.5 shrink-0 text-emerald-500", "aria-hidden": "true" }), dt('Mbi 24 ide të pranuara këtë muaj')] }), _jsxs(Link, { to: "/Idea", className: "inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-black text-white transition-all hover:brightness-110", children: [_jsx(Lightbulb, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), dt('Propozo një Ide')] })] })] })] })] }));
}

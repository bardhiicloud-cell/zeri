import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Bot, LogIn, Send, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
const KNOWLEDGE = [
    { words: ['si raportoj', 'raportoj një problem', 'grop', 'ankes'], answer: 'Për raportim, hap “Raporto”, përshkruaj problemin, vendos lokacionin në hartë, shto dëshmi dhe dërgoje. Pas ruajtjes merr një Track ID për ndjekje.' },
    { words: ['track id', 'ndjek raport', 'statusi i raportit'], answer: 'Te “Track ID” shkruaj kodin e raportit. Shfaqen statusi, institucioni përgjegjës, përgjigjet zyrtare, afati dhe historia e trajtimit.' },
    { words: ['harta', 'lokacion', 'kosova'], answer: 'Harta Leaflet paraqet raportimet në gjithë Kosovën. Filtrat e kategorisë, statusit, komunës dhe urgjencës ndryshojnë pikat e shfaqura.' },
    { words: ['anonim', 'emri im', 'privatësi'], answer: 'Mund të raportosh pa publikuar emrin. Të dhënat e kontaktit nuk duhet të shfaqen publikisht; ato përdoren vetëm për komunikim administrativ kur është e nevojshme.' },
    { words: ['shëndet', 'regjistri shëndetësor', 'mjek'], answer: 'Për raste shëndetësore përdor opsionin anonim kur nuk dëshiron publikimin e identitetit. Emri dhe telefoni duhet të jenë të kufizuar vetëm për stafin e autorizuar.' },
    { words: ['sondazh', 'vot'], answer: 'Te Sondazhet mund të shohësh pyetjet aktive dhe të votosh një herë nga llogaria jote. Rezultatet paraqiten në mënyrë të përmbledhur.' },
    { words: ['debat', 'forum', 'koment'], answer: 'Debati Publik është hapësira për biseda qytetare sipas komunës dhe temës. Respekto rregullat e komunitetit dhe raporto përmbajtjen e dëmshme.' },
    { words: ['institucion', 'ministri', 'drejtori'], answer: 'Kategoria dhe vendndodhja ndihmojnë sistemin të caktojë institucionin përgjegjës. Nëse nuk je i sigurt, përshkruaje problemin sa më qartë.' },
    { words: ['numra', 'emergjenc', 'polici'], answer: 'Për emergjencë të menjëhershme përdor 112; për Policinë 192. Për çështje jo emergjente përdor “Numrat & Institucionet” ose krijo raportim.' },
    { words: ['donacion', 'ndihmë'], answer: 'Te Ndihma & Donacione shfaqen rastet e verifikuara dhe kategoritë e mbështetjes. Jep përparësi rasteve urgjente dhe verifiko informacionin para çdo kontributi.' },
    { words: ['lajme', 'njoftime'], answer: 'Lajmet komunale paraqesin njoftime të publikuara me burimin, datën dhe komunën përkatëse.' },
    { words: ['llogari', 'regjistro', 'kyç'], answer: 'Me llogari mund të ruash raportimet, të ndjekësh njoftimet dhe të kërkosh ndihmë nga stafi. Mysafirët mund të përdorin informacionin publik dhe asistentin.' },
];
const SUGGESTIONS = ['Si raportoj një problem?', 'Si funksionon Track ID?', 'A mund të raportoj në mënyrë anonime?', 'Cilat janë numrat emergjentë?', 'Si përdoret harta?'];
function reply(text, canRequestAgent) {
    const value = text.toLocaleLowerCase('sq');
    if (value.includes('/agent') || value.includes('agjent') || value.includes('njeri real'))
        return canRequestAgent
            ? 'Kërkesa për mbështetje njerëzore mund të krijohet nga profili yt i regjistruar. Hap Qendrën e Ndihmës dhe dërgo kërkesën me detajet e çështjes.'
            : 'Mbështetja me agjent është e disponueshme vetëm për përdoruesit e regjistruar. Mund të vazhdosh këtu me pyetje rreth platformës ose të krijosh një llogari.';
    return KNOWLEDGE.find(item => item.words.some(word => value.includes(word)))?.answer ?? 'Mund të të ndihmoj për raportime, Track ID, hartën, privatësinë, sondazhet, debatet, lajmet, donacionet dhe përdorimin e faqes.';
}
export function AIAssistantWidget() {
    const currentUser = useStore(state => state.currentUser);
    const registered = Boolean(currentUser && currentUser.role !== 'guest');
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([{ role: 'bot', content: 'Përshëndetje! Jam asistenti i Zërit të Qytetarëve. Kam përgjigje të gatshme për raportimet, Track ID, hartën dhe shërbimet publike.' }]);
    const end = useRef(null);
    useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [messages, open]);
    const send = (value) => { if (!value.trim())
        return; const clean = value.trim(); setMessages(old => [...old, { role: 'user', content: clean }, { role: 'bot', content: reply(clean, registered) }]); setInput(''); };
    return _jsxs(_Fragment, { children: [!open && _jsx(motion.button, { initial: { scale: 0 }, animate: { scale: 1 }, whileTap: { scale: .95 }, onClick: () => setOpen(true), "aria-label": "Hap Asistentin AI", className: "mobile-assistant-safe fixed right-4 z-[60] grid h-14 w-14 place-items-center rounded-full bg-(--color-brand-navy) text-white shadow-(--shadow-floating) ring-4 ring-(--color-surface) hover:bg-(--color-brand-primary) md:bottom-6 md:right-6", children: _jsx(Sparkles, { className: "w-6 h-6" }) }), _jsx(AnimatePresence, { children: open && _jsxs(motion.section, { initial: { opacity: 0, y: 18, scale: .96 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 18, scale: .96 }, className: "fixed inset-0 z-[9999] flex h-[100dvh] w-full flex-col overflow-hidden bg-(--color-page) md:inset-auto md:bottom-6 md:right-6 md:z-[60] md:h-[620px] md:w-[420px] md:rounded-2xl md:border md:border-(--color-border-soft) md:shadow-2xl", children: [_jsxs("header", { className: "flex items-center justify-between bg-(--color-brand-navy) p-4 text-white", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "grid h-10 w-10 place-items-center rounded-xl bg-white/10", children: _jsx(Bot, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-sm font-black", children: "Asistenti i Z\u00EBrit Qytetar" }), _jsx("p", { className: "text-[11px] text-blue-100", children: "Informacion p\u00EBr platform\u00EBn dhe sh\u00EBrbimet" })] })] }), _jsx("button", { onClick: () => setOpen(false), className: "rounded-lg p-2 hover:bg-white/10", "aria-label": "Mbyll", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsx("div", { className: "border-b border-blue-100 bg-blue-50 px-4 py-2 text-[11px] text-blue-900", children: registered ? 'Llogari e regjistruar: mund të kërkosh mbështetje njerëzore.' : 'Mysafir: pyetjet informative janë të hapura; mbështetja me agjent kërkon llogari.' }), _jsxs("main", { className: "flex-1 space-y-3 overflow-y-auto p-4", children: [messages.map((m, i) => _jsx("div", { className: cn('max-w-[90%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed', m.role === 'user' ? 'ml-auto bg-(--color-brand-primary) text-white' : 'border border-slate-200 bg-white text-slate-700 shadow-sm'), children: m.content }, i)), _jsx("div", { ref: end })] }), messages.length < 4 && _jsx("div", { className: "flex flex-wrap gap-2 px-4 pb-3", children: SUGGESTIONS.map(q => _jsx("button", { onClick: () => send(q), className: "rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-50", children: q }, q)) }), !registered && _jsxs("div", { className: "mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl bg-slate-100 p-3 text-xs", children: [_jsx("span", { children: "Regjistrohu p\u00EBr mb\u00EBshtetje nga agjenti." }), _jsxs(Link, { to: "/register", onClick: () => setOpen(false), className: "inline-flex items-center gap-1 font-black text-(--color-brand-primary)", children: [_jsx(LogIn, { className: "w-3.5 h-3.5" }), " Regjistrohu"] })] }), _jsxs("form", { onSubmit: e => { e.preventDefault(); send(input); }, className: "flex gap-2 border-t border-slate-200 bg-white p-3", children: [_jsx("input", { value: input, onChange: e => setInput(e.target.value), placeholder: "Shkruaj pyetjen t\u00EBnde...", className: "min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" }), _jsx("button", { className: "grid h-10 w-10 place-items-center rounded-xl bg-(--color-brand-primary) text-white", "aria-label": "D\u00EBrgo", children: _jsx(Send, { className: "w-4 h-4" }) })] })] }) })] });
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, RefreshCw, FileText, Landmark, FileCheck, HelpCircle } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useStore } from '../lib/store';
import { motion, AnimatePresence } from 'framer-motion';
const PRESETS = [
    {
        id: 'birth_cert',
        label: 'Certifikatë Lindjeje',
        icon: FileText,
        query: 'Cilat dokumente më duhen për të marrë një certifikatë lindjeje në komunë dhe sa kushton tarifat administrative?',
    },
    {
        id: 'building_permit',
        label: 'Leje Ndërtimi',
        icon: Landmark,
        query: 'Çfarë procedure dhe cilat dokumente kryesore nevojiten për të aplikuar për leje ndërtimi për një shtëpi banimi?',
    },
    {
        id: 'business_reg',
        label: 'Regjistrim Biznesi',
        icon: FileCheck,
        query: 'Si mund ta regjistroj një biznes të ri lokal (Sh.p.k.) dhe cilat janë kërkesat e komunës për leje pune?',
    },
    {
        id: 'subsidies',
        label: 'Subvencione Bujqësore',
        icon: HelpCircle,
        query: 'Si bëhet aplikimi për subvencione bujqësore apo grante të tjera të ofruara nga drejtoria përkatëse komunale këtë vit?',
    },
];
export function AIAssistantPage() {
    const { language, t } = useLanguage();
    const currentUser = useStore(state => state.currentUser);
    const [messages, setMessages] = useState([
        {
            id: 'welcome',
            role: 'assistant',
            content: `Përshëndetje ${currentUser ? currentUser.name : 'i/e nderuar qytetar/e'}! 

Unë jam **Ndihmësi Inteligjent AI i Procedurave Zyrtare**. Detyra ime është t'ju tregoj me saktësi procedurat administrative për të gjitha komunat e Kosovës.

Mund të më pyesni për:
- **Dokumentet e nevojshme** për certifikata, leje ndërtimi apo licenca.
- **Afatet e përfundimit** dhe **tarifat** zyrtare.
- **Hapat konkrete** për aplikim online apo fizik.

Zgjidhni një nga pyetjet e shpeshta më poshtë, ose shkruani pyetjen tuaj të personalizuar!`,
            timestamp: new Date(),
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef(null);
    useEffect(() => {
        // Only scroll smoothly if we are not at the very bottom already
        // but a better approach is to rely on flex-col-reverse or similar. 
        // We will just do a small timeout scroll.
        const t = setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        return () => clearTimeout(t);
    }, [messages]);
    const handleSendMessage = async (text) => {
        if (!text.trim() || isLoading)
            return;
        const userMsg = {
            id: Math.random().toString(),
            role: 'user',
            content: text,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);
        try {
            // Build conversation history for the endpoint
            const formattedHistory = [...messages, userMsg].map(m => ({
                role: m.role,
                content: m.content
            }));
            const res = await fetch('/api/ai-assistant/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: formattedHistory,
                    language: language,
                }),
            });
            const data = await res.json();
            if (res.ok && data.text) {
                setMessages(prev => [...prev, {
                        id: Math.random().toString(),
                        role: 'assistant',
                        content: data.text,
                        timestamp: new Date(),
                    }]);
            }
            else {
                throw new Error(data.error || 'Gabim i panjohur nga serveri AI.');
            }
        }
        catch (err) {
            console.error(err);
            setMessages(prev => [...prev, {
                    id: Math.random().toString(),
                    role: 'assistant',
                    content: `Më vjen keq, ndodhi një gabim gjatë lidhjes me serverin AI: **${err.message || 'Lidhja dështoi'}**. Ju lutem provoni përsëri pas pak.`,
                    timestamp: new Date(),
                }]);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handlePresetClick = (query) => {
        handleSendMessage(query);
    };
    const clearChat = () => {
        setMessages([
            {
                id: 'welcome',
                role: 'assistant',
                content: `Biseda u rinis. Pyetni Ndihmësin Inteligjent për çfarëdo procedure zyrtare në komunën tuaj!`,
                timestamp: new Date(),
            }
        ]);
    };
    return (_jsxs(motion.div, { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }, className: "max-w-5xl mx-auto flex flex-col h-[calc(100dvh-72px)] relative bg-slate-50 dark:bg-slate-800", id: "ai-assistant-page", children: [_jsxs("div", { className: "bg-slate-900 text-white border-b-4 border-rose-600 px-6 py-4 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shrink-0", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "w-12 h-12 bg-rose-600 flex items-center justify-center border-2 border-white rounded-2xl animate-pulse", children: _jsx(Bot, { className: "w-6 h-6 text-white" }) }), _jsxs("div", { children: [_jsxs("h1", { className: "text-xl sm:text-2xl font-bold tracking-tight uppercase title-serif flex items-center gap-2", children: [dt(`Ndihmësi AI`), " ", _jsx("span", { className: "text-xs bg-rose-700 text-white px-2 py-0.5 rounded-full font-black animate-bounce tracking-widest", children: dt(`AKTIV`) })] }), _jsx("p", { className: "text-xs text-neutral-400 font-mono", children: dt(`ASISTENTI INTELIGJENT PËR PROCEDURA ZYRTARE`) })] })] }), _jsxs("button", { onClick: clearChat, className: "bg-slate-800 hover:bg-slate-700 text-neutral-300 hover:text-white px-3 py-1.5 border border-slate-700 text-xs font-bold tracking-wider uppercase transition-colors flex items-center gap-1 cursor-pointer", children: [_jsx(RefreshCw, { className: "w-3.5 h-3.5" }), dt(`Rinis`)] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto bg-white dark:bg-slate-900 p-6 space-y-6 custom-scrollbar scroll-smooth", children: [_jsx(AnimatePresence, { initial: false, children: messages.map((msg) => {
                            const isBot = msg.role === 'assistant';
                            return (_jsxs(motion.div, { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, className: `flex gap-4 max-w-[85%] ${isBot ? 'self-start' : 'ml-auto flex-row-reverse'}`, children: [isBot ? (_jsx("div", { className: "w-10 h-10 shrink-0 bg-slate-900 border-2 border-rose-600 text-white flex items-center justify-center font-bold text-sm", children: _jsx(Bot, { className: "w-5 h-5 text-rose-600" }) })) : (_jsx("div", { className: "w-10 h-10 shrink-0 bg-rose-600 border-2 border-slate-900 text-white flex items-center justify-center font-bold text-sm uppercase title-serif", children: currentUser ? currentUser.name.charAt(0) : 'Q' })), _jsxs("div", { className: `p-4 border-2 shadow-sm dark:shadow-none ${isBot
                                            ? 'bg-neutral-50 border-slate-200/60 text-slate-800 dark:text-slate-200 dark:text-slate-200 rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'
                                            : 'bg-slate-900 border-slate-900 text-white rounded-tl-2xl rounded-br-2xl rounded-bl-2xl'}`, children: [_jsx("div", { className: "prose prose-sm max-w-none font-sans leading-relaxed whitespace-pre-line text-sm md:text-base", children: msg.content }), _jsx("span", { className: `block text-[10px] font-mono mt-2 ${isBot ? 'text-neutral-400' : 'text-neutral-500 dark:text-slate-400 text-right'}`, children: msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })] })] }, msg.id));
                        }) }), isLoading && (_jsxs("div", { className: "flex gap-4 max-w-[85%] self-start", children: [_jsx("div", { className: "w-10 h-10 bg-slate-900 border-2 border-rose-600 text-white flex items-center justify-center font-bold animate-spin", children: _jsx(Sparkles, { className: "w-5 h-5 text-rose-600" }) }), _jsx("div", { className: "p-4 bg-neutral-50 border-2 border-slate-200/60 text-slate-800 dark:text-slate-200 dark:text-slate-200 rounded-tr-2xl rounded-br-2xl rounded-bl-2xl flex items-center gap-3", children: _jsx("span", { className: "text-sm font-bold tracking-wider font-mono animate-pulse", children: dt(`ASISTENTI DUKE PROCESUAR RREGULLAT ADMINISTRATIVE...`) }) })] })), _jsx("div", { ref: chatEndRef })] }), _jsxs("div", { className: "bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-white/10 p-4 space-y-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] shrink-0 z-10", children: [messages.length === 1 && !isLoading && (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-[10px] font-black tracking-widest text-neutral-400 uppercase", children: dt(`Sugjerime të Shpeshta:`) }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-2", children: PRESETS.map((preset) => {
                                    const Icon = preset.icon;
                                    return (_jsxs("button", { onClick: () => handlePresetClick(preset.query), className: "flex items-center gap-3 bg-white dark:bg-slate-900 hover:bg-slate-900 hover:text-white border-2 border-slate-200/60 dark:border-white/10 hover:border-slate-900 p-3 text-left transition-all duration-200 shadow-sm dark:shadow-none cursor-pointer", children: [_jsx("div", { className: "p-1.5 bg-neutral-100 group-hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl shrink-0", children: _jsx(Icon, { className: "w-4 h-4 text-rose-600" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-bold leading-tight uppercase", children: preset.label }), _jsx("p", { className: "text-[10px] text-neutral-500 dark:text-slate-400 font-serif italic truncate mt-0.5", children: dt(`Kliko për udhëzime...`) })] })] }, preset.id));
                                }) })] })), _jsxs("form", { onSubmit: (e) => {
                            e.preventDefault();
                            handleSendMessage(inputValue);
                        }, className: "flex gap-2", children: [_jsx("input", { type: "text", value: inputValue, onChange: (e) => setInputValue(e.target.value), disabled: isLoading, placeholder: dt(`Shkruani pyetjen tuaj për procedurat zyrtare administrative...`), className: "flex-1 bg-white dark:bg-slate-900 border-2 border-slate-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-600 text-slate-900 dark:text-white" }), _jsxs("button", { type: "submit", disabled: !inputValue.trim() || isLoading, className: "bg-slate-900 hover:bg-rose-600 text-white font-bold px-6 py-3 transition-colors flex items-center justify-center gap-2 border-l-4 border-rose-600 disabled:opacity-50 disabled:bg-slate-400 disabled:border-slate-400 shrink-0 cursor-pointer", children: [_jsx(Send, { className: "w-4 h-4" }), " ", _jsx("span", { className: "hidden sm:inline text-sm uppercase tracking-wider", children: dt(`Dërgo`) })] })] })] })] }));
}

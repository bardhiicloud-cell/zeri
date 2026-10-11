import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { ArrowLeft, Bot, CheckCircle2, Clipboard, Headphones, Info, MessageSquare, Search, Send, UserRound, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import { getSupportSortTime, groupSupportMessages, normalizeSupportChat, SUPPORT_DEPARTMENTS, SUPPORT_STATUS_LABELS, SUPPORT_STATUS_ORDER, } from '../../lib/supportChat';
const statusTone = {
    waiting_agent: 'bg-(--color-brand-accent)',
    active_agent: 'bg-emerald-500',
    bot: 'bg-blue-500',
    resolved: 'bg-slate-400',
};
function formatChatTime(value) {
    if (!value)
        return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return '—';
    return date.toLocaleString('sq-AL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function createAgentMessage(content) {
    return {
        id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'agent',
        content,
        createdAt: new Date().toISOString(),
    };
}
export default function AdminSupportChats() {
    const currentUser = useStore((state) => state.currentUser);
    const [chats, setChats] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [queue, setQueue] = useState('all');
    const [search, setSearch] = useState('');
    const [input, setInput] = useState('');
    const [department, setDepartment] = useState('help');
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const messagesEndRef = useRef(null);
    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = onSnapshot(collection(db, 'supportChats'), (snapshot) => {
            const nextChats = snapshot.docs
                .map((snapshotDoc) => normalizeSupportChat(snapshotDoc.id, snapshotDoc.data()))
                .sort((a, b) => getSupportSortTime(b) - getSupportSortTime(a));
            setChats(nextChats);
            setIsLoading(false);
            setError(null);
        }, (reason) => {
            console.error('Support chat queue failed', reason);
            setIsLoading(false);
            setError('Bisedat nuk mund të ngarkohen. Kontrolloni lejet ose lidhjen dhe provoni përsëri.');
        });
        return () => unsubscribe();
    }, []);
    const queueCounts = useMemo(() => ({
        all: chats.length,
        waiting_agent: chats.filter((chat) => chat.status === 'waiting_agent').length,
        active_agent: chats.filter((chat) => chat.status === 'active_agent').length,
        bot: chats.filter((chat) => chat.status === 'bot').length,
        resolved: chats.filter((chat) => chat.status === 'resolved').length,
    }), [chats]);
    const visibleChats = useMemo(() => {
        const query = search.trim().toLocaleLowerCase('sq');
        return chats
            .filter((chat) => queue === 'all' || chat.status === queue)
            .filter((chat) => {
            if (!query)
                return true;
            return [chat.userName, chat.userEmail, chat.id, chat.agentTrackId, chat.department]
                .filter(Boolean)
                .some((value) => String(value).toLocaleLowerCase('sq').includes(query));
        })
            .sort((a, b) => {
            const statusPriority = SUPPORT_STATUS_ORDER.indexOf(a.status) - SUPPORT_STATUS_ORDER.indexOf(b.status);
            return statusPriority || getSupportSortTime(b) - getSupportSortTime(a);
        });
    }, [chats, queue, search]);
    useEffect(() => {
        if (activeChatId && !visibleChats.some((chat) => chat.id === activeChatId))
            setActiveChatId(null);
    }, [activeChatId, visibleChats]);
    const activeChat = chats.find((chat) => chat.id === activeChatId) || null;
    useEffect(() => {
        setDepartment(activeChat?.department || 'help');
        setInput('');
        setIsDetailsOpen(false);
        setError(null);
    }, [activeChatId, activeChat?.department]);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeChat?.messages]);
    const copyIdentifier = async (value, type) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedId(type);
            window.setTimeout(() => setCopiedId(null), 1400);
        }
        catch (reason) {
            console.error('Copy chat identifier failed', reason);
        }
    };
    const handleSend = async (event) => {
        event.preventDefault();
        if (!activeChat || !input.trim() || activeChat.status === 'resolved' || isSending)
            return;
        if (!navigator.onLine) {
            setError('Jeni jashtë linje. Përgjigjja nuk u dërgua.');
            return;
        }
        const message = createAgentMessage(input.trim());
        setIsSending(true);
        setError(null);
        try {
            await updateDoc(doc(db, 'supportChats', activeChat.id), {
                messages: arrayUnion(message),
                status: 'active_agent',
                department,
                assignedTo: currentUser?.id || null,
                assignedAgentName: currentUser?.name || 'Agjenti i mbështetjes',
                updatedAt: serverTimestamp(),
            });
            setInput('');
        }
        catch (reason) {
            console.error('Agent reply failed', reason);
            setError('Përgjigjja nuk u dërgua. Teksti juaj u ruajt në fushë; provoni përsëri.');
        }
        finally {
            setIsSending(false);
        }
    };
    const handleResolve = async () => {
        if (!activeChat || activeChat.status === 'resolved')
            return;
        if (!window.confirm('A dëshironi ta shënoni këtë bisedë si të zgjidhur?'))
            return;
        try {
            await updateDoc(doc(db, 'supportChats', activeChat.id), {
                status: 'resolved',
                resolvedAt: new Date().toISOString(),
                resolvedBy: currentUser?.id || null,
                updatedAt: serverTimestamp(),
            });
        }
        catch (reason) {
            console.error('Resolve support chat failed', reason);
            setError('Biseda nuk u shënua si e zgjidhur. Provoni përsëri.');
        }
    };
    const handleDepartmentChange = async (value) => {
        if (!activeChat || activeChat.status === 'resolved')
            return;
        setDepartment(value);
        try {
            await updateDoc(doc(db, 'supportChats', activeChat.id), { department: value, updatedAt: serverTimestamp() });
        }
        catch (reason) {
            console.error('Department update failed', reason);
            setError('Departamenti nuk u përditësua.');
        }
    };
    const statusButtons = [
        { id: 'all', label: 'Të gjitha' },
        ...SUPPORT_STATUS_ORDER.map((status) => ({ id: status, label: SUPPORT_STATUS_LABELS[status] })),
    ];
    return (_jsxs("div", { className: "mx-auto flex h-[min(calc(100vh-10rem),820px)] min-h-[620px] max-w-[1600px] overflow-hidden rounded-[14px] border border-(--color-border-soft) bg-(--color-surface) shadow-(--shadow-control) dark:border-white/10 dark:bg-slate-900", children: [_jsxs("aside", { className: cn('w-full shrink-0 flex-col border-r border-(--color-border-soft) bg-(--color-surface) md:w-[280px] dark:border-white/10 dark:bg-slate-900 lg:w-[300px]', activeChatId ? 'hidden md:flex' : 'flex'), children: [_jsxs("div", { className: "border-b border-(--color-border-soft) p-4 dark:border-white/10", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-[0.16em] text-(--color-brand-primary)", children: dt('Bisedat e klientëve') }), _jsx("h2", { className: "mt-1 text-lg font-black tracking-tight text-(--color-text) dark:text-white", children: "Qendra e mb\u00EBshtetjes" })] }), _jsx(Headphones, { className: "mt-1 h-5 w-5 text-(--color-brand-primary)", "aria-hidden": "true" })] }), _jsxs("div", { className: "relative mt-4", children: [_jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400", "aria-hidden": "true" }), _jsx("input", { type: "search", value: search, onChange: (event) => setSearch(event.target.value), placeholder: dt('Kërko bisedë...'), "aria-label": dt('Kërko bisedë...'), className: "min-h-10 w-full rounded-[10px] border border-(--color-border-soft) bg-(--color-surface-subtle) pl-9 pr-3 text-sm text-(--color-text) outline-none focus:border-(--color-brand-primary) dark:border-white/10 dark:bg-slate-800 dark:text-white" })] })] }), _jsx("div", { className: "flex gap-1 overflow-x-auto border-b border-(--color-border-soft) p-2 dark:border-white/10", children: statusButtons.map((item) => (_jsxs("button", { type: "button", onClick: () => setQueue(item.id), "aria-pressed": queue === item.id, className: cn('flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-black transition-colors', queue === item.id ? 'bg-(--color-surface-subtle) text-(--color-brand-primary)' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'), children: [item.id !== 'all' && _jsx("span", { className: cn('h-1.5 w-1.5 rounded-full', statusTone[item.id]), "aria-hidden": "true" }), _jsx("span", { children: item.label }), _jsx("span", { className: "font-mono text-[9px] text-slate-400", children: queueCounts[item.id] })] }, item.id))) }), _jsx("div", { className: "min-h-0 flex-1 overflow-y-auto p-2", children: isLoading ? (_jsxs("div", { className: "space-y-2 p-2", children: [_jsx("div", { className: "h-16 animate-pulse rounded-[10px] bg-slate-100 dark:bg-slate-800" }), _jsx("div", { className: "h-16 animate-pulse rounded-[10px] bg-slate-100 dark:bg-slate-800" }), _jsx("div", { className: "h-16 animate-pulse rounded-[10px] bg-slate-100 dark:bg-slate-800" })] })) : visibleChats.length === 0 ? (_jsx("div", { className: "p-6 text-center text-xs font-semibold text-slate-500 dark:text-slate-400", children: search ? 'Nuk u gjet asnjë bisedë për këtë kërkim.' : 'Nuk ka biseda në këtë radhë.' })) : visibleChats.map((chat) => (_jsxs("button", { type: "button", onClick: () => { setActiveChatId(chat.id); setIsDetailsOpen(false); }, className: cn('relative mb-1.5 w-full rounded-[10px] border-l-[3px] p-3 text-left transition-colors', activeChatId === chat.id ? 'border-(--color-brand-primary) bg-(--color-surface-subtle)' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'), children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsx("span", { className: "truncate text-sm font-black text-(--color-text) dark:text-white", children: chat.userName }), _jsx("span", { className: "shrink-0 text-[10px] font-semibold text-slate-400", children: formatChatTime(chat.updatedAt) })] }), _jsxs("div", { className: "mt-1 flex items-center gap-1.5", children: [_jsx("span", { className: cn('h-1.5 w-1.5 shrink-0 rounded-full', statusTone[chat.status]), "aria-hidden": "true" }), _jsx("span", { className: "truncate text-[10px] font-bold text-slate-500 dark:text-slate-400", children: SUPPORT_STATUS_LABELS[chat.status] })] }), _jsx("p", { className: "mt-1 truncate text-xs text-slate-500 dark:text-slate-400", children: chat.messages.at(-1)?.content || 'Pa mesazhe' }), _jsx("p", { className: "mt-1 truncate font-mono text-[9px] text-(--color-brand-primary)", children: chat.agentTrackId || chat.id })] }, chat.id))) })] }), _jsx("section", { className: cn('relative min-w-0 flex-1 flex-col bg-(--color-surface-subtle)', activeChatId ? 'flex' : 'hidden', 'md:flex'), children: activeChat ? (_jsxs(_Fragment, { children: [_jsxs("header", { className: "flex shrink-0 items-center justify-between gap-3 border-b border-(--color-border-soft) bg-(--color-surface) px-4 py-4 dark:border-white/10 dark:bg-slate-900 sm:px-5", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-2 sm:gap-3", children: [_jsx("button", { type: "button", onClick: () => setActiveChatId(null), className: "grid min-h-10 min-w-10 place-items-center rounded-[10px] text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800", "aria-label": "Kthehu te bisedat", children: _jsx(ArrowLeft, { className: "h-4 w-4", "aria-hidden": "true" }) }), _jsx("div", { className: "grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-(--color-surface-subtle) text-(--color-brand-primary)", children: _jsx(UserRound, { className: "h-5 w-5", "aria-hidden": "true" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("h2", { className: "truncate text-base font-black text-(--color-text) dark:text-white", children: activeChat.userName }), _jsxs("p", { className: "truncate text-xs text-slate-500 dark:text-slate-400", children: [activeChat.userEmail || 'Nuk ka email', " \u00B7 ", _jsx("span", { className: "font-mono", children: activeChat.id })] }), _jsxs("p", { className: "mt-1 flex items-center gap-1.5 text-[10px] font-bold text-(--color-brand-primary)", children: [_jsx("span", { className: cn('h-1.5 w-1.5 rounded-full', statusTone[activeChat.status]) }), SUPPORT_STATUS_LABELS[activeChat.status], " \u00B7 ", activeChat.agentTrackId || 'Pa ID ndjekjeje'] })] })] }), _jsxs("div", { className: "flex shrink-0 items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => setIsDetailsOpen((open) => !open), className: "grid min-h-10 min-w-10 place-items-center rounded-[10px] border border-(--color-border-soft) text-slate-500 hover:text-(--color-brand-primary) lg:hidden", "aria-label": "Hap detajet", children: _jsx(Info, { className: "h-4 w-4", "aria-hidden": "true" }) }), activeChat.status !== 'resolved' && _jsxs("button", { type: "button", onClick: handleResolve, className: "hidden min-h-10 items-center gap-1.5 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition-colors hover:bg-emerald-100 sm:inline-flex", children: [_jsx(CheckCircle2, { className: "h-4 w-4", "aria-hidden": "true" }), "Sh\u00EBno t\u00EB zgjidhur"] })] })] }), _jsx("div", { className: "min-h-0 flex-1 overflow-y-auto p-5 lg:p-8", children: _jsxs("div", { className: "mx-auto max-w-3xl space-y-5", children: [groupSupportMessages(activeChat.messages).map((group, index) => (_jsx("div", { className: cn('flex', group.role === 'agent' ? 'justify-end' : 'justify-start'), children: _jsxs("div", { className: cn('max-w-[86%] space-y-1.5', group.role === 'agent' ? 'items-end' : 'items-start'), children: [_jsxs("div", { className: cn('flex items-center gap-1.5 px-1 text-[10px] font-black uppercase tracking-wider', group.role === 'agent' ? 'justify-end text-(--color-brand-primary)' : 'text-slate-500'), children: [group.role === 'agent' ? _jsx(Headphones, { className: "h-3 w-3", "aria-hidden": "true" }) : group.role === 'bot' ? _jsx(Bot, { className: "h-3 w-3", "aria-hidden": "true" }) : _jsx(UserRound, { className: "h-3 w-3", "aria-hidden": "true" }), group.role === 'agent' ? (activeChat.assignedAgentName || 'Agjent') : group.role === 'bot' ? 'AI Bot' : activeChat.userName] }), group.messages.map((message) => _jsx("div", { className: cn('rounded-[10px] px-4 py-3 text-sm leading-relaxed', group.role === 'agent' ? 'bg-(--color-brand-primary) text-white' : group.role === 'bot' ? 'border border-(--color-border-soft) bg-(--color-surface) text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200' : 'bg-white text-slate-800 shadow-(--shadow-control) dark:bg-slate-800 dark:text-slate-100'), children: message.content }, message.id)), _jsx("div", { className: cn('px-1 text-[10px] text-slate-400', group.role === 'agent' ? 'text-right' : 'text-left'), children: formatChatTime(group.messages.at(-1)?.createdAt) })] }) }, `${group.role}-${index}`))), _jsx("div", { ref: messagesEndRef })] }) }), activeChat.status === 'resolved' ? _jsx("div", { className: "shrink-0 border-t border-(--color-border-soft) bg-(--color-surface) p-4 text-center text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400", children: "Kjo bised\u00EB \u00EBsht\u00EB sh\u00EBnuar e zgjidhur. Nuk mund t\u00EB d\u00EBrgoni m\u00EB mesazhe." }) : _jsxs("form", { onSubmit: handleSend, className: "shrink-0 border-t border-(--color-border-soft) bg-(--color-surface) p-4 dark:border-white/10 dark:bg-slate-900", children: [_jsx("label", { htmlFor: "support-agent-reply", className: "mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400", children: "P\u00EBrgjigjja juaj" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { id: "support-agent-reply", value: input, onChange: (event) => setInput(event.target.value), placeholder: "Shkruaj p\u00EBrgjigjen si agjent...", disabled: isSending, className: "min-h-11 min-w-0 flex-1 rounded-[10px] border border-(--color-border-soft) bg-(--color-surface-subtle) px-3.5 text-sm text-(--color-text) outline-none focus:border-(--color-brand-primary) dark:border-white/10 dark:bg-slate-800 dark:text-white" }), _jsxs("button", { type: "submit", disabled: !input.trim() || isSending, className: "inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-(--color-brand-primary) px-4 text-xs font-black text-white transition-colors hover:bg-(--color-brand-primary-hover) disabled:cursor-not-allowed disabled:opacity-50", children: [isSending ? 'Duke dërguar...' : 'Dërgo përgjigjen', _jsx(Send, { className: "h-4 w-4", "aria-hidden": "true" })] })] }), error && _jsx("p", { role: "alert", className: "mt-2 text-xs font-semibold text-rose-600", children: error })] })] })) : _jsxs("div", { className: "flex flex-1 items-center justify-center p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400", children: [_jsx(MessageSquare, { className: "mb-3 h-8 w-8 text-slate-300", "aria-hidden": "true" }), _jsx("p", { children: "Zgjidhni nj\u00EB bised\u00EB nga lista." })] }) }), activeChat && _jsxs("aside", { className: cn('w-[240px] shrink-0 border-l border-(--color-border-soft) bg-(--color-surface) p-4 dark:border-white/10 dark:bg-slate-900', isDetailsOpen ? 'fixed inset-y-0 right-0 z-[120] block shadow-(--shadow-floating) lg:static lg:shadow-none' : 'hidden lg:block'), children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-[0.16em] text-slate-400", children: "Detajet" }), _jsx("button", { type: "button", onClick: () => setIsDetailsOpen(false), className: "grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800", "aria-label": "Mbyll detajet", children: _jsx(X, { className: "h-4 w-4", "aria-hidden": "true" }) })] }), _jsxs("div", { className: "mt-5 space-y-5 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-wider text-slate-400", children: "Statusi" }), _jsxs("p", { className: "mt-1 flex items-center gap-2 font-bold text-(--color-text) dark:text-white", children: [_jsx("span", { className: cn('h-2 w-2 rounded-full', statusTone[activeChat.status]) }), SUPPORT_STATUS_LABELS[activeChat.status]] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-wider text-slate-400", children: "Departamenti" }), _jsx("select", { value: department, onChange: (event) => void handleDepartmentChange(event.target.value), disabled: activeChat.status === 'resolved', className: "mt-1 min-h-10 w-full rounded-lg border border-(--color-border-soft) bg-(--color-surface-subtle) px-2 text-xs font-bold text-(--color-text) outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white", children: SUPPORT_DEPARTMENTS.map((item) => _jsx("option", { value: item.id, children: item.label }, item.id)) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-wider text-slate-400", children: "ID i bised\u00EBs" }), _jsxs("button", { type: "button", onClick: () => void copyIdentifier(activeChat.id, 'conversation'), className: "mt-1 flex w-full items-center gap-2 break-all text-left font-mono text-xs font-bold text-(--color-brand-primary)", children: [_jsx(Clipboard, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }), copiedId === 'conversation' ? 'U kopjua' : activeChat.id] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-wider text-slate-400", children: "ID i ndjekjes" }), _jsxs("button", { type: "button", disabled: !activeChat.agentTrackId, onClick: () => activeChat.agentTrackId && void copyIdentifier(activeChat.agentTrackId, 'tracking'), className: "mt-1 flex w-full items-center gap-2 break-all text-left font-mono text-xs font-bold text-(--color-brand-primary) disabled:text-slate-400", children: [_jsx(Clipboard, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }), copiedId === 'tracking' ? 'U kopjua' : activeChat.agentTrackId || 'Pa kërkesë aktive'] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-wider text-slate-400", children: "P\u00EBrdoruesi" }), _jsx("p", { className: "mt-1 font-bold text-(--color-text) dark:text-white", children: activeChat.userName }), _jsx("p", { className: "break-all text-xs text-slate-500", children: activeChat.userEmail || 'Nuk ka email' })] }), _jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-wider text-slate-400", children: "P\u00EBrdit\u00EBsuar" }), _jsx("p", { className: "mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300", children: formatChatTime(activeChat.updatedAt) })] }), activeChat.status !== 'resolved' && _jsxs("button", { type: "button", onClick: handleResolve, className: "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 sm:hidden", children: [_jsx(CheckCircle2, { className: "h-4 w-4", "aria-hidden": "true" }), "Sh\u00EBno t\u00EB zgjidhur"] })] })] })] }));
}

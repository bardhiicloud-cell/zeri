import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Vote, CheckCircle2, Clock, ShieldCheck, TrendingUp, Users, Share2 } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import AdBanner from '../components/AdBanner';
export default function PollsPage() {
    const polls = useStore(state => state.polls);
    const votePoll = useStore(state => state.votePoll);
    const currentUser = useStore(state => state.currentUser);
    const [filter, setFilter] = useState('active');
    const [votedPolls, setVotedPolls] = useState([]);
    useEffect(() => {
        const saved = localStorage.getItem('voted_polls');
        if (saved)
            setVotedPolls(JSON.parse(saved));
    }, []);
    const handleVote = (pollId, optionId) => {
        if (!currentUser) {
            toast.error(dt('Identifikohu për të votuar'));
            return;
        }
        if (votedPolls.includes(pollId)) {
            toast.error(dt('Keni votuar tashmë'));
            return;
        }
        votePoll(pollId, optionId);
        toast.success(dt('Vota juaj u regjistrua. Faleminderit për kontributin!'));
        const newVoted = [...votedPolls, pollId];
        setVotedPolls(newVoted);
        localStorage.setItem('voted_polls', JSON.stringify(newVoted));
    };
    const filteredPolls = polls.filter(p => {
        const isExpired = new Date(p.expiresAt) < new Date();
        if (filter === 'active')
            return !isExpired;
        if (filter === 'ended')
            return isExpired;
        return true;
    });
    const accentMap = {
        Investime: 'from-violet-500 via-indigo-500 to-blue-500',
        Mjedis: 'from-emerald-500 via-teal-500 to-cyan-500',
        Pjesëmarrje: 'from-rose-500 via-pink-500 to-orange-400',
        Shërbime: 'from-sky-500 via-cyan-500 to-teal-500',
        Transparencë: 'from-amber-500 via-orange-500 to-rose-500',
        'Dizajn i platformës': 'from-fuchsia-500 via-violet-500 to-indigo-500'
    };
    const highlightedTopics = [
        { label: 'Rrugët', value: '42%' },
        { label: 'Shëndeti', value: '31%' },
        { label: 'Transporti', value: '27%' },
    ];
    return (_jsxs("div", { className: "page-shell min-h-screen bg-(--color-page) dark:bg-(--color-brand-dark) transition-colors pb-24 font-sans text-[var(--color-text)] dark:text-white dark:text-slate-100 selection:bg-rose-500/30", children: [_jsxs("div", { className: "bg-slate-900 relative overflow-hidden py-14 md:py-18 px-6 sm:px-10 lg:px-20 mb-8 md:mb-10", children: [_jsxs("div", { className: "absolute inset-0 z-0", children: [_jsx("div", { className: "absolute -top-[40%] -right-[10%] w-[720px] h-[720px] bg-rose-500/20 blur-[120px] rounded-full pointer-events-none" }), _jsx("div", { className: "absolute -bottom-[35%] -left-[8%] w-[620px] h-[620px] bg-cyan-500/20 blur-[120px] rounded-full pointer-events-none" })] }), _jsxs("div", { className: "relative z-10 max-w-7xl mx-auto flex flex-col md:flex-row md:items-end md:justify-between gap-6", children: [_jsxs("div", { className: "max-w-3xl", children: [_jsxs("div", { className: "inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-4", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" }), _jsx("span", { className: "text-[10px] font-bold text-white uppercase tracking-widest", children: dt(`Platforma Zyrtare e Votimit Publik`) })] }), _jsxs("h1", { className: "text-4xl md:text-6xl font-black text-white tracking-[-0.05em] leading-[0.96] title-serif", children: [dt(`Sondazhet &`), " ", _jsx("span", { className: "text-rose-500", children: dt(`Pjesëmarrja Qytetare`) })] }), _jsx("p", { className: "text-slate-300 font-medium max-w-2xl text-sm leading-relaxed mt-3", children: dt(`Vota juaj është thelbësore për vendimet tona. Merrni pjesë në sondazhet aktive, ndani mendimin tuaj mbi politikat e ardhshme dhe ndihmoni në përmirësimin e qytetit tonë me anë të demokracisë së drejtpërdrejtë. Të gjitha votimet janë plotësisht anonime dhe të sigurta.`) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3 min-w-[260px] md:max-w-[320px] w-full md:w-auto", children: [_jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md", children: [_jsx("div", { className: "text-[10px] uppercase tracking-[0.18em] text-slate-300", children: "Qytetar\u00EB" }), _jsx("div", { className: "mt-1 text-2xl font-black text-white", children: polls.reduce((acc, p) => acc + (p.totalVotes || 0), 0).toLocaleString() })] }), _jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md", children: [_jsx("div", { className: "text-[10px] uppercase tracking-[0.18em] text-slate-300", children: "Aktive" }), _jsx("div", { className: "mt-1 text-2xl font-black text-white", children: polls.filter(p => new Date(p.expiresAt) >= new Date()).length })] })] })] })] }), _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsx("div", { className: "mb-6", children: _jsx(AdBanner, { position: "inline" }) }), _jsx("div", { className: "mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3", children: [
                            {
                                icon: Users,
                                tone: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400',
                                label: dt('Qytetarë Angazhuar'),
                                value: polls.reduce((acc, p) => acc + (p.totalVotes || 0), 0).toLocaleString('de-DE'),
                            },
                            {
                                icon: TrendingUp,
                                tone: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
                                label: dt('Sondazhe Aktive'),
                                value: polls.filter((p) => new Date(p.expiresAt) >= new Date()).length.toLocaleString('de-DE'),
                            },
                            {
                                icon: ShieldCheck,
                                tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
                                label: dt('Siguria & Anonimiteti'),
                                value: dt('100% E Garantuar'),
                                // The privacy claim is a sentence, not a count, so it renders at
                                // the same optical size as the numbers above it.
                                isText: true,
                            },
                        ].map((stat) => (_jsxs("div", { className: "luxury-card flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-200 ease-out hover:scale-[1.02] sm:gap-4 sm:px-5", children: [_jsx("div", { className: cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', stat.tone), children: _jsx(stat.icon, { className: "h-5 w-5", "aria-hidden": "true" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400", children: stat.label }), _jsx("p", { className: cn('mt-0.5 truncate font-black tracking-tight text-slate-900 dark:text-white', stat.isText ? 'text-sm' : 'text-2xl'), children: stat.value })] })] }, stat.label))) }), _jsx("div", { className: "mb-8 rounded-[28px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_15px_50px_-18px_rgba(15,23,42,0.18)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/80 md:p-5", children: _jsxs("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-black uppercase tracking-[0.22em] text-rose-500", children: "Prioritetet e qytetit" }), _jsx("h2", { className: "mt-2 text-xl font-black text-slate-900 dark:text-white md:text-2xl", children: "Debate t\u00EB hapura dhe vendimmarrje me ndikim t\u00EB drejtp\u00EBrdrejt\u00EB" })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: highlightedTopics.map((item) => (_jsxs("div", { className: "rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200", children: [item.label, ": ", _jsx("span", { className: "text-rose-500", children: item.value })] }, item.label))) })] }) }), _jsx("div", { className: "flex flex-col sm:flex-row items-center justify-between gap-4 mb-8", children: _jsx("div", { className: "flex bg-slate-200/50 dark:bg-slate-700/50 dark:bg-slate-800/50 p-1.5 rounded-[var(--radius-card)] w-full sm:w-auto overflow-x-auto custom-scrollbar", children: ['active', 'all', 'ended'].map((f) => (_jsx("button", { onClick: () => setFilter(f), className: cn("flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-[11px] transition-all uppercase tracking-widest whitespace-nowrap", filter === f
                                    ? f === 'active' ? 'bg-rose-500 text-white shadow-sm dark:shadow-none' : 'bg-slate-900 dark:bg-slate-800 text-white dark:text-white shadow-sm dark:shadow-none'
                                    : 'text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] hover:text-[var(--color-text)] dark:text-white dark:text-slate-100 hover:bg-slate-200/50 dark:bg-slate-700/50 dark:hover:bg-slate-800 dark:bg-slate-800/50'), children: f === 'active' ? 'Aktive' : f === 'all' ? 'Të Gjitha' : 'Të Mbyllura' }, f))) }) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8", children: [_jsx(AnimatePresence, { mode: "popLayout", children: filteredPolls.map(poll => {
                                    const hasVoted = votedPolls.includes(poll.id);
                                    const isExpired = new Date(poll.expiresAt) < new Date();
                                    const isClosed = isExpired;
                                    const totalVotes = poll.totalVotes || 0;
                                    return (_jsxs(motion.div, { layout: true, initial: { opacity: 0, scale: 0.95, y: 20 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.95 }, className: "bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-slate-200 dark:border-white/10 rounded-[26px] overflow-hidden flex flex-col hover:shadow-[0_24px_52px_-28px_rgba(15,23,42,0.28)] dark:hover:shadow-none hover:border-slate-300 dark:hover:border-white/20 transition-all duration-500 group", children: [_jsx("div", { className: cn("h-1.5 w-full transition-colors", isClosed ? "bg-slate-300 dark:bg-slate-700" : "bg-gradient-to-r from-rose-500 via-orange-400 to-cyan-500") }), _jsxs("div", { className: "p-5 md:p-6 flex-1 flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("span", { className: "text-[10px] font-black text-rose-600 uppercase tracking-widest bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-100 dark:border-rose-500/20", children: poll.category || 'Opinion Publik' }), _jsx("div", { className: "flex items-center gap-2", children: isClosed ? (_jsxs("span", { className: "flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 text-[var(--color-text-muted)] dark:text-slate-300 text-[10px] font-bold uppercase rounded-full border border-slate-200 dark:border-white/10", children: [_jsx(CheckCircle2, { className: "w-3.5 h-3.5" }), dt(`Përfunduar`)] })) : (_jsxs("span", { className: "flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase rounded-full border border-emerald-200 dark:border-emerald-500/20", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" }), dt(`Aktiv`)] })) })] }), _jsx("h3", { className: "text-xl font-black text-[var(--color-text)] dark:text-white tracking-tight leading-[1.2] title-serif group-hover:text-rose-600 transition-colors", children: poll.question }), _jsx("p", { className: "text-sm text-[var(--color-text-muted)] dark:text-slate-300 mt-2 leading-relaxed", children: poll.description }), _jsx("div", { className: "space-y-3 mt-6 flex-1", children: poll.options.map((option, idx) => {
                                                            const votes = option.votes || 0;
                                                            const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                                                            return (_jsx("div", { className: "relative", children: hasVoted || isClosed ? (_jsxs("div", { className: "w-full bg-slate-50 dark:bg-slate-800/80 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-[var(--radius-card)] overflow-hidden p-4 flex items-center justify-between relative group/res", children: [_jsx(motion.div, { initial: { width: 0 }, animate: { width: `${percent}%` }, transition: { duration: 1, ease: [0.16, 1, 0.3, 1], delay: idx * 0.1 }, className: cn("absolute top-0 bottom-0 left-0 rounded-r-xl", percent === Math.max(...poll.options.map(o => totalVotes > 0 ? Math.round(((o.votes || 0) / totalVotes) * 100) : 0))
                                                                                ? "bg-rose-100 dark:bg-rose-500/20 border-r-2 border-rose-500"
                                                                                : "bg-slate-200/50 dark:bg-slate-700/50 dark:bg-slate-800/50") }), _jsx("div", { className: "relative z-10 flex items-center gap-3", children: _jsx("span", { className: "text-[13px] font-bold text-[var(--color-text)] dark:text-white dark:text-slate-100", children: option.text }) }), _jsxs("div", { className: "relative z-10 flex items-center gap-4", children: [_jsxs("span", { className: "text-[10px] font-bold text-[var(--color-text-muted)] tracking-widest uppercase", children: [votes, dt(`Vota`)] }), _jsxs("span", { className: "text-sm font-black text-[var(--color-text)] dark:text-white dark:text-slate-100 w-10 text-right", children: [percent, "%"] })] })] })) : (_jsxs("button", { onClick: () => handleVote(poll.id, option.id), className: "w-full p-4 border-2 border-slate-200 dark:border-white/10 dark:border-white/10 hover:border-rose-300 dark:hover:border-rose-500 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:hover:shadow-none text-left bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] rounded-[var(--radius-card)] transition-all cursor-pointer flex items-center justify-between group/opt", children: [_jsx("span", { className: "text-[13px] font-bold text-slate-700 dark:text-slate-300 group-hover/opt:text-[var(--color-text)] dark:text-white dark:group-hover/opt:text-white transition-colors", children: option.text }), _jsx("div", { className: "w-5 h-5 rounded-full border-2 border-slate-300 dark:border-white/20 group-hover/opt:border-rose-500 transition-all flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm dark:shadow-none", children: _jsx("div", { className: "w-2 h-2 rounded-full bg-rose-500 scale-0 group-hover/opt:scale-100 transition-all" }) })] })) }, option.id));
                                                        }) })] }), _jsxs("div", { className: "px-6 md:px-8 py-5 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-white/10 dark:border-white/10 flex items-center justify-between mt-auto", children: [_jsxs("div", { className: "flex items-center gap-6", children: [_jsxs("span", { className: "flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] uppercase tracking-widest", children: [_jsx(Users, { className: "w-3.5 h-3.5 text-[var(--color-text-muted)]" }), totalVotes, dt(`Pjesëmarrës`)] }), _jsxs("span", { className: "flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] uppercase tracking-widest", children: [_jsx(Clock, { className: "w-3.5 h-3.5 text-[var(--color-text-muted)]" }), dt(`Deri:`), " ", new Date(poll.expiresAt).toLocaleDateString('sq-AL', { day: 'numeric', month: 'short' })] })] }), _jsx("button", { "aria-label": "Shp\u00EBrndaj sondazhin", onClick: () => {
                                                            const shareUrl = window.location.href;
                                                            if (navigator.share) {
                                                                navigator.share({
                                                                    title: poll.question,
                                                                    text: poll.description,
                                                                    url: shareUrl
                                                                }).catch(() => { });
                                                            }
                                                            else {
                                                                navigator.clipboard.writeText(`${poll.question}\n${shareUrl}`);
                                                                toast.success(dt('Linku i sondazhit u kopjua me sukses!'));
                                                            }
                                                        }, className: "text-[var(--color-text-muted)] hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 transition-colors p-2 bg-white dark:bg-slate-700 rounded-full border border-slate-200 dark:border-white/10 shadow-sm active:scale-95", children: _jsx(Share2, { className: "w-3.5 h-3.5" }) })] })] }, poll.id));
                                }) }), filteredPolls.length === 0 && (_jsxs("div", { className: "col-span-full bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-slate-200 dark:border-white/10 rounded-[var(--radius-card)] p-16 text-center flex flex-col items-center justify-center", children: [_jsx("div", { className: "w-20 h-20 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 dark:border-white/10 rounded-full flex items-center justify-center mb-6", children: _jsx(Vote, { className: "w-10 h-10 text-slate-300" }) }), _jsx("h3", { className: "text-xl font-bold text-[var(--color-text)] dark:text-white dark:text-slate-100 title-serif mb-2", children: dt(`Nuk u gjet asnjë sondazh`) }), _jsx("p", { className: "text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] text-sm max-w-sm", children: dt(`Provoni të ndryshoni filtrin ose kthehuni më vonë për të votuar në vendimet e reja.`) })] }))] })] })] }));
}

import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { dt } from '@/src/lib/dt';
import { AuraOrbit, AuraHero, AuraStats } from '../components/aura/Aura';
import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Vote, CheckCircle2, AlertCircle, BarChart3, Clock, Lock, ShieldCheck, Calendar, TrendingUp, Users, Info, ChevronRight, Share2, ChevronDown, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import AdBanner from '../components/AdBanner.tsx';
import { shareNatively } from '../lib/share';
import { filterByScope, isSpecificScope } from '../lib/municipalityScope';

export default function PollsPage() {
  const polls = useStore(state => state.polls);
  const votePoll = useStore(state => state.votePoll);
  const currentUser = useStore(state => state.currentUser);
  const userMunicipality = useStore(state => state.userMunicipality);
  const [filter, setFilter] = useState<'all' | 'active' | 'ended'>('active');
  const [votedPolls, setVotedPolls] = useState<string[]>([]);
  /**
   * pollId -> optionId. The record of *which* option was chosen, not just that
   * a vote happened.
   *
   * Without this the page could only say "you have voted", so once the results
   * bars appeared there was no way to tell which one was yours — the bar for
   * the option you picked looked exactly like the bar for the option that won.
   * It also let a second tap silently move the vote, because `votedPolls`
   * blocked the write but not the intent.
   */
  const [votedOptions, setVotedOptions] = useState<Record<string, string>>({});
  /**
   * Polls whose full result breakdown is open. Results stay hidden until the
   * citizen has voted (or the poll has closed), which is the only way a survey
   * measures opinion rather than bandwagon.
   */
  const [expandedResults, setExpandedResults] = useState<string[]>([]);

  useEffect(() => {
    try {
      const savedPolls = localStorage.getItem('voted_polls');
      const savedOptions = localStorage.getItem('voted_poll_options');
      if (savedPolls) setVotedPolls(JSON.parse(savedPolls));
      if (savedOptions) setVotedOptions(JSON.parse(savedOptions));
    } catch {
      setVotedPolls([]);
      setVotedOptions({});
    }
  }, []);

  const persistVote = (pollId: string, optionId: string) => {
    const newVoted = [...votedPolls, pollId];
    const newOptions = { ...votedOptions, [pollId]: optionId };
    setVotedPolls(newVoted);
    setVotedOptions(newOptions);
    try {
      localStorage.setItem('voted_polls', JSON.stringify(newVoted));
      localStorage.setItem('voted_poll_options', JSON.stringify(newOptions));
    } catch {
      toast.error('Vota u regjistrua, por pajisja nuk ruajti zgjedhjen lokalisht.');
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    if (!currentUser) {
      toast.error(dt('Identifikohu për të votuar'));
      return;
    }
    if (votedPolls.includes(pollId)) {
      toast.error(dt('Keni votuar tashmë'));
      return;
    }
    // The server decides: it holds the one-vote-per-account record. Only a
    // confirmed vote is celebrated or remembered locally.
    const result = await votePoll(pollId, optionId);
    if (result.status !== 'voted') {
      if (result.status === 'already_voted') {
        toast.error(dt('Keni votuar tashmë'));
        persistVote(pollId, result.votedOptionId || optionId);
      } else if (result.status === 'expired') {
        toast.error(dt('Ky sondazh ka përfunduar.'));
      } else if (result.status === 'unauthorized') {
        toast.error(dt('Identifikohu për të votuar'));
      } else {
        toast.error(dt('Vota nuk u regjistrua. Provoni përsëri.'));
      }
      return;
    }
    toast.success(dt('Vota juaj u regjistrua. Faleminderit për kontributin!'));
    persistVote(pollId, optionId);
    // Reveal the breakdown immediately: the citizen just committed, and the
    // next thing they want is the comparison. This is also the moment the
    // "Vota juaj" marker is most useful.
    setExpandedResults((current) => current.includes(pollId) ? current : [...current, pollId]);
  };

  const toggleResults = (pollId: string) => {
    setExpandedResults((current) =>
      current.includes(pollId) ? current.filter((id) => id !== pollId) : [...current, pollId]
    );
  };

  const filteredPolls = useMemo(() => {
    // Municipality-scoped polls follow the global scope, so a citizen who has
    // chosen Pejë is not shown nationwide questions next to their local ones.
    const scoped = isSpecificScope(userMunicipality)
      ? filterByScope(polls, userMunicipality)
      : polls;
    return scoped.filter(p => {
      const isExpired = new Date(p.expiresAt) < new Date();
      if (filter === 'active') return !isExpired;
      if (filter === 'ended') return isExpired;
      return true;
    });
  }, [polls, filter, userMunicipality]);

  /**
   * The "city priorities" strip used to be three hard-coded percentages
   * ("Rrugët: 42%", "Shëndeti: 31%", "Transporti: 27%") that no vote ever
   * moved — a citizen voted, and the numbers stayed exactly where they were.
   * They are now the three leading options across every poll that carries a
   * category, derived from the same totals the cards display.
   */
  const leadingPriorities = useMemo(() => {
    const totals = new Map<string, { label: string; votes: number }>();
    polls.forEach((poll) => {
      const label = poll.category?.trim();
      if (!label) return;
      const current = totals.get(label) ?? { label, votes: 0 };
      current.votes += poll.totalVotes || 0;
      totals.set(label, current);
    });

    const ranked = [...totals.values()].sort((a, b) => b.votes - a.votes).slice(0, 3);
    const grandTotal = ranked.reduce((sum, item) => sum + item.votes, 0);
    if (grandTotal === 0) return [];

    return ranked.map((item) => ({
      label: item.label,
      value: `${Math.round((item.votes / grandTotal) * 100)}%`,
    }));
  }, [polls]);

  const handleSharePoll = async (question: string, description?: string, pollId?: string) => {
    const result = await shareNatively({
      // Deep link to this specific poll. `window.location.href` was the router
      // root, so a shared poll arrived at the dashboard with no poll attached.
      url: pollId
        ? `${window.location.origin}${window.location.pathname}#/sondazhet?poll=${encodeURIComponent(pollId)}`
        : window.location.href,
      title: question,
      text: description || dt('Merr pjesë në sondazhin publik në platformë.'),
    });
    if (result === 'copied') toast.success(dt('Linku i sondazhit u kopjua me sukses!'));
  };

  return (
    <div className="page-shell min-h-screen bg-(--color-page) dark:bg-(--color-brand-dark) transition-colors pb-24 font-sans text-[var(--color-text)] dark:text-white dark:text-slate-100 selection:bg-rose-500/30">
      <div className="mx-auto mb-6 max-w-6xl px-3 pt-3 sm:px-6 lg:px-8">
        <AuraHero visual={<AuraOrbit core={Vote} />} tone="violet" live eyebrow={dt(`Votim publik`)} icon={Vote}
          title={dt(`Sondazhet & Pjesëmarrja Qytetare`)}
          subtitle={dt(`Votoni në sondazhet aktive. Çdo llogari voton një herë për sondazh. Rezultatet shfaqen si totale; zgjedhja juaj individuale nuk shfaqet publikisht, por sistemi ruan që keni votuar për të parandaluar votat e dyfishta.`)}
          aside={<AuraStats items={[
            { value: polls.reduce((acc, p) => acc + (p.totalVotes || 0), 0).toLocaleString(), label: dt('Vota gjithsej') },
            { value: polls.filter(p => new Date(p.expiresAt) >= new Date()).length, label: dt('Aktive') },
          ]} />} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Inline Ad Banner */}
        <div className="mb-6">
          <AdBanner position="inline" />
        </div>
        {/*
          Statistics.

          These sat on `transform -translate-y-14` to overlap the hero, but their
          parent reserved no space for the shift, so the row was pulled up over
          the sponsor banner and the hero's own text. The overlap was decorative
          and cost legibility.

          Now it is a plain grid with a small negative offset of its own that is
          accounted for by the wrapper's padding, so nothing can collide at any
          breakpoint and the row reflows to two columns on a phone instead of
          wrapping mid-icon.
        */}
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[
            {
              icon: Users,
              tone: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400',
              label: dt('Vota gjithsej'),
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
              label: dt('Rregulli i votimit'),
              value: dt('Një votë për llogari'),
              // The voting rule is a sentence, not a count, so it renders at
              // the same optical size as the numbers above it.
              isText: true,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="luxury-card flex items-center gap-3 rounded-2xl px-4 py-3.5 transition duration-200 ease-out hover:scale-[1.02] sm:gap-4 sm:px-5"
            >
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', stat.tone)}>
                <stat.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
                <p
                  className={cn(
                    'mt-0.5 truncate font-black tracking-tight text-slate-900 dark:text-white',
                    stat.isText ? 'text-sm' : 'text-2xl'
                  )}
                >
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-8 rounded-[28px] border border-slate-200/80 bg-white/80 p-4 shadow-[0_15px_50px_-18px_rgba(15,23,42,0.18)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/80 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-500">{dt('Prioritetet e qytetit')}</p>
              <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white md:text-2xl">{dt('Debate të hapura dhe vendimmarrje me ndikim të drejtpërdrejtë')}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {leadingPriorities.length > 0 ? leadingPriorities.map((item) => (
                <div key={item.label} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200">
                  {item.label}: <span className="text-rose-500">{item.value}</span>
                </div>
              )) : (
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400">
                  {dt('Rezultatet shfaqen sapo të regjistrohet vota e parë.')}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div className="flex bg-slate-200/50 dark:bg-slate-700/50 dark:bg-slate-800/50 p-1.5 rounded-[var(--radius-card)] w-full sm:w-auto overflow-x-auto custom-scrollbar">
            {['active', 'all', 'ended'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={cn(
                  "flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-[11px] transition uppercase tracking-widest whitespace-nowrap",
                  filter === f
                    ? f === 'active' ? 'bg-rose-500 text-white shadow-sm dark:shadow-none' : 'bg-slate-900 dark:bg-slate-800 text-white dark:text-white shadow-sm dark:shadow-none'
                    : 'text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] hover:text-[var(--color-text)] dark:text-white dark:text-slate-100 hover:bg-slate-200/50 dark:bg-slate-700/50 dark:hover:bg-slate-800 dark:bg-slate-800/50'
                )}
              >
                {dt(f === 'active' ? 'Aktive' : f === 'all' ? 'Të Gjitha' : 'Të Mbyllura')}
              </button>
            ))}
          </div>
        </div>

        {/* Polls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <AnimatePresence mode="popLayout">
            {filteredPolls.map(poll => {
              const hasVoted = votedPolls.includes(poll.id);
              const chosenOptionId = votedOptions[poll.id];
              const isExpired = new Date(poll.expiresAt) < new Date();
              const isClosed = isExpired;
                            const isRevealed = hasVoted || isClosed || expandedResults.includes(poll.id);
              const canReveal = isClosed || poll.totalVotes > 0;

              const totalVotes = poll.totalVotes || 0;
              /**
               * The winning option, computed once. It used to be recomputed
               * inside every option's `className` with a `Math.max` over the
               * whole array, and the "is this the winner" test compared two
               * *rounded* percentages — so two options at 33.4% and 33.6% both
               * rendered as the winner and both got a red border. Halved here,
               * on the raw totals.
               */
              const winningVotes = poll.options.reduce((max, o) => Math.max(max, o.votes || 0), 0);

              return (
                <motion.div
                  key={poll.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-slate-200 dark:border-white/10 rounded-[26px] overflow-hidden flex flex-col hover:shadow-[0_24px_52px_-28px_rgba(15,23,42,0.28)] dark:hover:shadow-none hover:border-slate-300 dark:hover:border-white/20 transition-all duration-500 group"
                >
                  <div className={cn("h-1.5 w-full transition-colors", isClosed ? "bg-slate-300 dark:bg-slate-700" : "bg-gradient-to-r from-rose-500 via-orange-400 to-cyan-500")} />

                  <div className="p-5 md:p-6 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-100 dark:border-rose-500/20">
                        {poll.category || 'Opinion Publik'}
                      </span>
                      <div className="flex items-center gap-2">
                        {isClosed ? (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 text-[var(--color-text-muted)] dark:text-slate-300 text-[10px] font-bold uppercase rounded-full border border-slate-200 dark:border-white/10">
                            <CheckCircle2 className="w-3.5 h-3.5" />{dt(`Përfunduar`)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase rounded-full border border-emerald-200 dark:border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{dt(`Aktiv`)}
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="text-xl font-black text-[var(--color-text)] dark:text-white tracking-tight leading-[1.2] title-serif group-hover:text-rose-600 transition-colors">
                      {poll.question}
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)] dark:text-slate-300 mt-2 leading-relaxed">
                      {poll.description}
                    </p>

                    <div className="space-y-3 mt-6 flex-1">
                      {poll.options.map((option, idx) => {
                        const votes = option.votes || 0;
                        const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                        const isMyChoice = chosenOptionId === option.id;
                        const isWinner = votes > 0 && votes === winningVotes;

                        return (
                          <div key={option.id} className="relative">
                            {isRevealed ? (
                              <div
                                aria-label={`${option.text}: ${percent}%${isMyChoice ? ' — vota juaj' : ''}`}
                                className={cn(
                                  'relative flex w-full items-center justify-between overflow-hidden rounded-[var(--radius-card)] border p-4',
                                  // The option the citizen actually chose is the
                                  // only one drawn in blue. Everything else is
                                  // neutral, so "which did I pick" is answered by
                                  // colour, not by reading a small badge.
                                  isMyChoice
                                    ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20 dark:bg-blue-950/30'
                                    : 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-800/80'
                                )}
                              >
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percent}%` }}
                                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: idx * 0.1 }}
                                  className={cn(
                                    'absolute inset-y-0 left-0 rounded-r-xl',
                                    isMyChoice
                                      ? 'bg-blue-100 dark:bg-blue-500/25'
                                      : isWinner
                                        ? 'bg-rose-100/70 dark:bg-rose-500/15'
                                        : 'bg-slate-200/50 dark:bg-slate-700/40'
                                  )}
                                />
                                <div className="relative z-10 flex min-w-0 items-center gap-2">
                                  <span className={cn(
                                    'truncate text-[13px]',
                                    isMyChoice
                                      ? 'font-black text-blue-900 dark:text-blue-100'
                                      : 'font-bold text-slate-800 dark:text-slate-100'
                                  )}>
                                    {option.text}
                                  </span>
                                  {isMyChoice && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                                      <CheckCircle2 className="h-3 w-3" /> {dt('Vota juaj')}
                                    </span>
                                  )}
                                  {!isMyChoice && isWinner && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                                      <Trophy className="h-3 w-3" /> {dt('Kryesues')}
                                    </span>
                                  )}
                                </div>
                                <div className="relative z-10 flex shrink-0 items-center gap-3">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                    {votes} {dt('vota')}
                                  </span>
                                  <span className={cn(
                                    'w-10 text-right text-sm font-black',
                                    isMyChoice ? 'text-blue-700 dark:text-blue-200' : 'text-slate-900 dark:text-white'
                                  )}>
                                    {percent}%
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleVote(poll.id, option.id)}
                                className="flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-card)] border-2 border-slate-200 bg-[var(--color-surface)] p-4 text-left transition hover:border-rose-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-white/10 dark:bg-[var(--color-surface-dark)] dark:hover:border-rose-500 dark:hover:shadow-none group/opt"
                              >
                                <span className="text-[13px] font-bold text-slate-700 transition-colors group-hover/opt:text-slate-900 dark:text-slate-300 dark:group-hover/opt:text-white">
                                  {option.text}
                                </span>
                                <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-300 bg-white shadow-sm transition group-hover/opt:border-rose-500 dark:border-white/20 dark:bg-slate-800 dark:shadow-none">
                                  <div className="h-2 w-2 scale-0 rounded-full bg-rose-500 transition group-hover/opt:scale-100" />
                                </div>
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/**
                       * Results toggle. It only offers to reveal once there is
                       * something to reveal: showing "shiko rezultatet" on a
                       * poll with zero votes led to an empty 0% breakdown.
                       */}
                      {!isRevealed && canReveal && (
                        <button
                          type="button"
                          onClick={() => toggleResults(poll.id)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        >
                          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                          {dt('Shiko rezultatet pa votuar')}
                        </button>
                      )}

                      {isRevealed && !hasVoted && !isClosed && (
                        <button
                          type="button"
                          onClick={() => toggleResults(poll.id)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        >
                          <ChevronDown className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
                          {dt('Kthehu te votimi')}
                        </button>
                      )}

                      {!isClosed && !hasVoted && (
                        <p className="flex items-center justify-center gap-1.5 pt-1 text-[10px] font-semibold text-slate-400">
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          {dt('Rezultatet hapen pasi të votoni.')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-6 md:px-8 py-5 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 mt-auto">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1.5">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        <Users className="w-3.5 h-3.5" />
                        {totalVotes} {dt('pjesëmarrës')}
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        <Clock className="w-3.5 h-3.5" />{dt('Deri:')} {new Date(poll.expiresAt).toLocaleDateString('sq-AL', { day: 'numeric', month: 'short' })}
                      </span>
                      {/*
                        A permanent, plain-language restatement of the
                        citizen's own choice. The option row carries the colour
                        cue, but the footer is where the eye lands after voting,
                        and reading "Votuat: Rrugë dhe trotuare" is unambiguous
                        in a way a highlighted bar is not.
                      */}
                      {chosenOptionId && (
                        <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {dt('Votuat:')} {poll.options.find((o) => o.id === chosenOptionId)?.text ?? ''}
                          </span>
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={dt('Shpërndaj sondazhin në të gjitha platformat')}
                      onClick={() => handleSharePoll(poll.question, poll.description, poll.id)}
                      className="shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition-colors hover:text-rose-600 active:scale-95 dark:border-white/10 dark:bg-slate-700 dark:text-slate-300 dark:hover:text-rose-400 dark:shadow-none"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {filteredPolls.length === 0 && (
            <div className="col-span-full bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-slate-200 dark:border-white/10 rounded-[var(--radius-card)] p-16 text-center flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 dark:border-white/10 rounded-full flex items-center justify-center mb-6">
                <Vote className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-[var(--color-text)] dark:text-white dark:text-slate-100 title-serif mb-2">{dt(`Nuk u gjet asnjë sondazh`)}</h3>
              <p className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] text-sm max-w-sm">{dt(`Provoni të ndryshoni filtrin ose kthehuni më vonë për të votuar në vendimet e reja.`)}
              </p>
            </div>
          )}
        </div>

        {/*
          Strategic footer slot. Renders nothing unless a campaign targets the
          `banner` position, so an unsold page simply ends rather than showing a
          placeholder.
        */}
        <div className="mt-10">
          <AdBanner position="banner" className="mx-auto" />
        </div>
      </div>
    </div>
  );
}

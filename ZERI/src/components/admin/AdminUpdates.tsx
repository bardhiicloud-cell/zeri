import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock3,
  FileText,
  HeartPulse,
  Megaphone,
  Sparkles,
  Vote,
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useStore } from '../../lib/store';
import { db } from '../../lib/firebase';
import { STAFF_LIMITS } from '../../lib/loadLimits';
import { cn } from '../../lib/utils';

interface ActionItem {
  title: string;
  description: string;
  value: number;
  status: 'live' | 'priority' | 'review';
  icon: React.ComponentType<{ className?: string }>;
  tab: 'reports' | 'health' | 'polls' | 'notifications';
}

export default function AdminUpdates({ onTabChange }: { onTabChange: (tab: string) => void }) {
  const reports = useStore(state => state.reports || []);
  const polls = useStore(state => state.polls || []);
  const notifications = useStore(state => state.notifications || []);
  const [healthCases, setHealthCases] = useState<any[]>([]);

  useEffect(() => {
    // Bounded and ordered: the KPI below only counts urgent cases, so reading the
    // entire registry for it was pure cost.
    const q = query(
      collection(db, 'healthRegistry'),
      orderBy('createdAt', 'desc'),
      limit(STAFF_LIMITS.healthCases)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextHealthCases = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setHealthCases(nextHealthCases);
      },
      () => setHealthCases([])
    );

    return () => unsubscribe();
  }, []);

  const pendingReports = useMemo(() => reports.filter(r => r.status === 'Pending Review'), [reports]);
  const urgentHealthCases = useMemo(() => healthCases.filter((c: any) => c.urgency === 'Urgjente'), [healthCases]);
  const activePolls = useMemo(() => polls.filter(p => new Date(p.expiresAt).getTime() > Date.now()), [polls]);

  const actionItems: ActionItem[] = [
    {
      title: 'Raportet e reja',
      description: 'Pritet aprovimi dhe koordinimi i raporteve qytetare.',
      value: pendingReports.length,
      status: pendingReports.length > 0 ? 'priority' : 'live',
      icon: FileText,
      tab: 'reports',
    },
    {
      title: 'Raste shëndetësore',
      description: 'Kërkojnë njoftim dhe ndihmë me prioritet.',
      value: urgentHealthCases.length,
      status: urgentHealthCases.length > 0 ? 'priority' : 'live',
      icon: HeartPulse,
      tab: 'health',
    },
    {
      title: 'Sondazhe publike',
      description: 'Qytetarët po marrin pjesë në konsultime të hapura.',
      value: activePolls.length,
      status: activePolls.length > 0 ? 'live' : 'review',
      icon: Vote,
      tab: 'polls',
    },
    {
      title: 'Njoftime / komunikim',
      description: 'Përditësime publike dhe alarme të planifikuara.',
      value: notifications.filter((n: any) => !n.isRead).length,
      status: notifications.filter((n: any) => !n.isRead).length > 0 ? 'review' : 'live',
      icon: Bell,
      tab: 'notifications',
    },
  ];

  const priorityList = [
    'Verifiko raportet e reja dhe cakto prioritete sipas zonës dhe urgjencës.',
    'Monitoro raste të shëndetit me urgjencë të lartë dhe lia njoftimet e spitalit.',
    'Përditëso komunikimin publik në kohë reale për nxjerrje të besimit qytetar.',
    'Ruaj një ekuilibër të qartë mes lajmeve, sondazheve dhe përgjigjeve administrative.',
  ];

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto">
      <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-2xl shadow-slate-300/10">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.25em] text-rose-300">
              <Sparkles className="w-3.5 h-3.5" />
              Admin Update Center
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white">Përditësimet administrative në kohë reale</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Qendra e operimit për raportet, shëndetin, komunikimet dhe sondazhet publike me fokus të qartë në besim, shpejtësi dhe transparencë.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-right">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">Status</div>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                LIVE
              </div>
            </div>
            <div className="flex gap-2 rounded-full border border-white/10 bg-white/5 p-1">
              {['Raporte', 'Shëndeti', 'Sondazhe'].map((label) => (
                <span key={label} className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-200">{label}</span>
              ))}
            </div>
            <button
              onClick={() => onTabChange('dashboard')}
              className="inline-flex items-center gap-2 rounded-xl bg-white text-slate-900 px-4 py-2.5 text-sm font-black shadow-lg shadow-white/10 transition-transform hover:-translate-y-0.5"
            >
              Kthehu te paneli
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {actionItems.map((item) => {
          const Icon = item.icon;
          const isPriority = item.status === 'priority';
          const isReview = item.status === 'review';

          return (
            <button
              key={item.title}
              onClick={() => onTabChange(item.tab)}
              className={cn(
                'group rounded-2xl border p-4 text-left transition-all hover:-translate-y-1 hover:shadow-lg',
                isPriority
                  ? 'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-950/30'
                  : isReview
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-950/30'
                    : 'border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={cn(
                  'rounded-xl p-2',
                  isPriority ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' :
                  isReview ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' :
                  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                )}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className={cn(
                  'rounded-full px-2 py-1 text-[11px] font-black uppercase tracking-[0.18em]',
                  isPriority ? 'bg-rose-600 text-white' : isReview ? 'bg-amber-600 text-white' : 'bg-slate-800 text-white'
                )}>
                  {isPriority ? 'PRIORITET' : isReview ? 'SHQYRIM' : 'LIVE'}
                </span>
              </div>

              <div className="mt-4 flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{item.description}</p>
                </div>
                <span className="text-2xl font-black text-slate-900 dark:text-white">{item.value}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-6">
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Rrjedha e punës</p>
              <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Prioritetet e javës</h3>
            </div>
            <div className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
              Operational
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {priorityList.map((item, index) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 dark:border-white/10 dark:bg-slate-800/60 p-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[11px] font-black text-white dark:bg-slate-700">
                  {index + 1}
                </div>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-950 p-5 text-white shadow-xl">
          <div className="flex items-center gap-2 text-rose-400">
            <Activity className="h-4 w-4" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em]">Pulse</span>
          </div>
          <h3 className="mt-3 text-xl font-black">Kohëzgjatja operacionale</h3>

          <div className="mt-6 space-y-4 text-sm">
            <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
              <span className="text-slate-300">Raportet në pritje</span>
              <strong className="text-rose-300">{pendingReports.length}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
              <span className="text-slate-300">Raste urgjente</span>
              <strong className="text-amber-300">{urgentHealthCases.length}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
              <span className="text-slate-300">Sondazhe aktive</span>
              <strong className="text-sky-300">{activePolls.length}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
              <span className="text-slate-300">Njoftime pa lexuar</span>
              <strong className="text-emerald-300">{notifications.filter((n: any) => !n.isRead).length}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[
          { label: 'Koha mesatare e trajtimit', value: '2.4h', icon: Clock3, tone: 'rose' },
          { label: 'Vlerësim i besimit publik', value: '94%', icon: CheckCircle2, tone: 'emerald' },
          { label: 'Raportet e zgjidhura', value: `${reports.filter(r => r.status === 'Resolved').length}`, icon: FileText, tone: 'sky' },
          { label: 'Komunikime aktive', value: `${notifications.length}`, icon: Megaphone, tone: 'amber' },
        ].map((metric) => {
          const Icon = metric.icon as React.ComponentType<{ className?: string }>;
          return (
            <div key={metric.label} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4">
              <div className={cn(
                'inline-flex rounded-xl p-2',
                metric.tone === 'rose' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' :
                metric.tone === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' :
                metric.tone === 'sky' ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' :
                'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-4 text-2xl font-black text-slate-900 dark:text-white">{metric.value}</div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{metric.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

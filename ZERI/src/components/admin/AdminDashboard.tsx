import { dt } from '@/src/lib/dt';
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlarmClock, BellRing, Clock, Flame, Heart, HeartPulse, FileText, Headphones, MapPin,
  Megaphone, Newspaper, ShieldAlert, ShieldCheck, Users, Activity, ArrowRight, CheckCircle2,
  Search, X, Zap,
} from 'lucide-react';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import type { HealthCase } from '../../types';
import { STAFF_LIMITS, PUBLIC_LIMITS } from '../../lib/loadLimits';
import { canAccessSection, type AdminSection } from '../../lib/adminPermissions';
import { ALL_SCOPE, filterByScope, isSpecificScope, normalizeScope } from '../../lib/municipalityScope';
import { statusMeta, TONE_CLASSES } from '../../lib/reportStatus';
import {
  breakdownByMunicipality,
  humanizeHours,
  summarizeReports,
  topCategories,
  unnotifiedUrgentCases,
} from '../../lib/adminDashboardMetrics';
import type { CountKey } from '../../lib/useDashboardCounts';
import { useAdminCounts } from './AdminCountsContext';
import { useServiceHealth } from '../../lib/useServiceHealth';
import {
  AgeText,
  AttentionTile,
  FOCUS_RING,
  FigureText,
  LOADING,
  Panel,
  PipelineBar,
  RefreshButton,
  ServiceStatusPanel,
  StatCard,
  UNAVAILABLE,
  type Figure,
  type PipelineSegment,
  type Tone,
} from './dashboard/DashboardParts';

type MunicipalityFilter = 'all' | 'active' | 'pending' | 'health';

/**
 * Stable fallback for a store slice that has not been hydrated. A selector that
 * returns a fresh `[]` on every call makes React see a new value each render.
 */
const NONE: never[] = [];

/** Rows shown before "show all"; the table is a leaderboard, not a registry. */
const COLLAPSED_ROWS = 10;

const KPI_GRID: Record<number, string> = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
};

export default function AdminDashboard({ onTabChange }: { onTabChange: (tab: AdminSection) => void }) {
  const currentUser = useStore((state) => state.currentUser);
  const reports = useStore((state) => state.reports ?? NONE);
  const reportsStatus = useStore((state) => state.reportsStatus);
  const reportsError = useStore((state) => state.reportsError);
  const hasMoreReports = useStore((state) => state.hasMoreReports);
  const donationCauses = useStore((state) => state.donationCauses ?? NONE);
  const ads = useStore((state) => state.ads ?? NONE);
  const auditLogs = useStore((state) => state.auditLogs ?? NONE);
  const scope = useStore((state) => state.userMunicipality);
  const setScope = useStore((state) => state.setUserMunicipality);

  /**
   * What this viewer may open. Every widget below is gated on it, so a role is
   * never shown a number it cannot act on, a card that links to a section the
   * panel will bounce it out of, or a listener on data it has no reason to read.
   */
  const access = useMemo(
    () => ({
      reports: canAccessSection(currentUser, 'reports'),
      health: canAccessSection(currentUser, 'health'),
      users: canAccessSection(currentUser, 'users'),
      support: canAccessSection(currentUser, 'support'),
      donations: canAccessSection(currentUser, 'donations'),
      ads: canAccessSection(currentUser, 'ads'),
      notifications: canAccessSection(currentUser, 'notifications'),
      news: canAccessSection(currentUser, 'news'),
      moderim: canAccessSection(currentUser, 'moderim'),
      security: canAccessSection(currentUser, 'security'),
      updates: canAccessSection(currentUser, 'updates'),
    }),
    [currentUser]
  );

  // ── Time ───────────────────────────────────────────────────────────────────
  // Ages ("pending for 3 days") move without any data changing, so the clock is
  // state: a dashboard left open overnight must not keep yesterday's numbers.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // ── Data ───────────────────────────────────────────────────────────────────
  // One set of server counters for the whole panel (the sidebar badges read the
  // same numbers), fetched by the shell rather than by each section.
  const { counts, updatedAt, isRefreshing, refresh } = useAdminCounts();
  const serviceHealth = useServiceHealth();

  // Bounded: this was an unordered listener on the whole collection, so a staff
  // session held an open connection that re-read every health record in the
  // country on every write — and the figures it feeds only look at urgency and
  // municipality. The limit is what a supervisor reviews in one sitting; the
  // full registry is searched in its own tab, which paginates. It is also
  // skipped entirely for roles that cannot open the registry.
  const [healthCases, setHealthCases] = useState<HealthCase[]>([]);
  const [healthLoaded, setHealthLoaded] = useState(false);
  useEffect(() => {
    if (!access.health) {
      setHealthCases([]);
      return;
    }
    setHealthLoaded(false);
    const healthQuery = query(
      collection(db, 'healthRegistry'),
      orderBy('createdAt', 'desc'),
      limit(STAFF_LIMITS.healthCases)
    );
    return onSnapshot(
      healthQuery,
      (snapshot) => {
        setHealthCases(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as HealthCase));
        setHealthLoaded(true);
      },
      (error) => {
        console.warn('[Dashboard] health registry unavailable:', error.code ?? error.message);
        setHealthLoaded(true);
      }
    );
  }, [access.health]);

  // ── Scope ──────────────────────────────────────────────────────────────────
  // The header's municipality control promises that its choice applies to every
  // section. The previous dashboard ignored it and always showed the country.
  const isScoped = isSpecificScope(scope);
  const scopeName = normalizeScope(scope);
  const scopedReports = useMemo(() => filterByScope(reports, scope), [reports, scope]);
  const scopedHealth = useMemo(() => filterByScope(healthCases, scope), [healthCases, scope]);
  const scopedAudit = useMemo(() => filterByScope(auditLogs, scope), [auditLogs, scope]);

  // ── Figures ────────────────────────────────────────────────────────────────
  const reportsLoading = reportsStatus === 'loading';
  const countsLoading = updatedAt === null;
  // The store holds only the newest page of reports. While more exist, anything
  // computed from it is a lower bound, and must not be presented as a total.
  const reportsPartial = hasMoreReports;
  const healthPartial = healthCases.length >= STAFF_LIMITS.healthCases;
  const donationsPartial = donationCauses.length >= PUBLIC_LIMITS.donationCauses;

  const summary = useMemo(() => summarizeReports(scopedReports, now), [scopedReports, now]);

  /**
   * One figure, from the best source available: the server's exact count for the
   * national view, otherwise the loaded sample (a lower bound if the sample is
   * incomplete). Server counters cannot be narrowed to a municipality without a
   * composite index, so a scoped view always reads the sample.
   */
  const reportFigure = (key: CountKey, sample: number): Figure => {
    const server = counts[key];
    if (!isScoped && server !== undefined) return { value: server };
    if (!isScoped && countsLoading) return LOADING;
    if (reportsLoading) return LOADING;
    return { value: sample, atLeast: reportsPartial };
  };

  /** Age- and urgency-based figures exist only in the sample; the server cannot count them. */
  const sampleReportFigure = (sample: number): Figure =>
    reportsLoading ? LOADING : { value: sample, atLeast: reportsPartial };

  const serverOnlyFigure = (key: CountKey): Figure => {
    const server = counts[key];
    if (server !== undefined) return { value: server };
    return countsLoading ? LOADING : UNAVAILABLE;
  };

  const totalReports = reportFigure('reports', summary.total);
  const pendingReports = reportFigure('reportsPending', summary.pending);
  const activeReports = reportFigure('reportsActive', summary.active);
  const overdueReports = reportFigure('reportsOverdue', summary.overdue);
  const resolvedReports = reportFigure('reportsResolved', summary.resolved);

  const healthSampleFigure = (sample: number): Figure =>
    healthLoaded ? { value: sample, atLeast: healthPartial } : LOADING;
  const totalHealth: Figure =
    !isScoped && counts.health !== undefined
      ? { value: counts.health }
      : healthSampleFigure(scopedHealth.length);
  const urgentHealth: Figure =
    !isScoped && counts.healthUrgent !== undefined
      ? { value: counts.healthUrgent }
      : healthSampleFigure(scopedHealth.filter((c) => c.urgency === 'Urgjente').length);
  const unnotifiedHealth = healthSampleFigure(unnotifiedUrgentCases(scopedHealth));
  const notifiedHospitals = scopedHealth.filter((c) => c.hospitalNotified).length;

  const pendingDonations = donationCauses.filter((cause) => cause.status === 'pending').length;
  const activeAds = ads.filter((ad) => ad.status === 'active').length;

  // ── Attention ──────────────────────────────────────────────────────────────
  const attention: Array<{
    id: string;
    section: AdminSection;
    label: string;
    hint: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: Tone;
    figure: Figure;
  }> = [];

  if (access.reports) {
    attention.push(
      {
        id: 'critical',
        section: 'reports',
        label: dt(`Raporte kritike në pritje`),
        hint: dt(`Raporte me urgjencë "Kritike" që ende nuk janë shqyrtuar`),
        icon: Flame,
        tone: 'red',
        figure: sampleReportFigure(summary.criticalPending),
      },
      {
        id: 'sla',
        section: 'reports',
        label: dt(`Afati i përgjigjes i kaluar`),
        hint: dt(`Raporte të hapura që kanë kaluar afatin e përgjigjes`),
        icon: AlarmClock,
        tone: 'rose',
        figure: sampleReportFigure(summary.slaBreached),
      },
      {
        id: 'stale',
        section: 'reports',
        label: dt(`Në pritje mbi 72 orë`),
        hint: dt(`Raporte që presin shqyrtimin e parë për më shumë se 3 ditë`),
        icon: Clock,
        tone: 'amber',
        figure: sampleReportFigure(summary.stalePending),
      }
    );
  }
  if (access.health) {
    attention.push({
      id: 'health',
      section: 'health',
      label: dt(`Raste urgjente pa spital të njoftuar`),
      hint: dt(`Raste shëndetësore urgjente ku spitali ende nuk është njoftuar`),
      icon: HeartPulse,
      tone: 'red',
      figure: unnotifiedHealth,
    });
  }
  if (access.support) {
    attention.push({
      id: 'support',
      section: 'support',
      label: dt(`Biseda që presin agjent`),
      hint: dt(`Qytetarë që kanë kërkuar të flasin me një agjent`),
      icon: Headphones,
      tone: 'sky',
      figure: serverOnlyFigure('supportWaiting'),
    });
  }
  if (access.donations) {
    attention.push({
      id: 'donations',
      section: 'donations',
      label: dt(`Donacione për aprovim`),
      hint: dt(`Kërkesa për fonde që presin vendim`),
      icon: Heart,
      tone: 'emerald',
      figure: { value: pendingDonations, atLeast: donationsPartial },
    });
  }

  const attentionSettled = attention.every((item) => item.figure.value !== null || item.figure.unavailable);
  const attentionClear =
    attention.length > 0 &&
    attentionSettled &&
    attention.every((item) => (item.figure.value ?? 0) === 0) &&
    // With an incomplete sample "nothing found" does not mean "nothing there".
    !(access.reports && reportsPartial);

  // ── Pipeline ───────────────────────────────────────────────────────────────
  const pipeline = useMemo<PipelineSegment[]>(() => {
    const value = (figure: Figure) => figure.value ?? 0;
    const known =
      value(pendingReports) + value(activeReports) + value(overdueReports) + value(resolvedReports);
    const closed = Math.max(0, value(totalReports) - known);
    return [
      { key: 'pending', label: dt(`Në pritje`), value: value(pendingReports), bar: 'sky' },
      { key: 'active', label: dt(`Në trajtim`), value: value(activeReports), bar: 'amber' },
      { key: 'overdue', label: dt(`Të vonuara`), value: value(overdueReports), bar: 'red' },
      { key: 'resolved', label: dt(`Të zgjidhura`), value: value(resolvedReports), bar: 'emerald' },
      { key: 'closed', label: dt(`Të mbyllura`), value: closed, bar: 'slate' },
    ];
  }, [pendingReports, activeReports, overdueReports, resolvedReports, totalReports]);

  const categories = useMemo(() => topCategories(scopedReports, 5), [scopedReports]);
  const breakdown = useMemo(() => breakdownByMunicipality(reports, healthCases), [reports, healthCases]);

  // ── Municipality table ─────────────────────────────────────────────────────
  const [muniSearch, setMuniSearch] = useState('');
  const [muniFilter, setMuniFilter] = useState<MunicipalityFilter>('all');
  const [showAllMunis, setShowAllMunis] = useState(false);

  const visibleRows = useMemo(() => {
    const needle = muniSearch.trim().toLowerCase();
    let rows = breakdown.rows;
    if (needle) rows = rows.filter((row) => row.name.toLowerCase().includes(needle));
    if (muniFilter === 'active') rows = rows.filter((row) => row.total > 0 || row.health > 0);
    if (muniFilter === 'pending') rows = rows.filter((row) => row.pending > 0);
    if (muniFilter === 'health') rows = rows.filter((row) => row.health > 0);
    const isUnfiltered = !needle && muniFilter === 'all';
    return isUnfiltered && !showAllMunis ? rows.slice(0, COLLAPSED_ROWS) : rows;
  }, [breakdown, muniSearch, muniFilter, showAllMunis]);

  const recentReports = useMemo(
    () =>
      [...scopedReports]
        .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
        .slice(0, 8),
    [scopedReports]
  );

  const recentActivity = useMemo(() => scopedAudit.slice(0, 6), [scopedAudit]);

  // ── Presentation helpers ───────────────────────────────────────────────────
  const kpiCount = [access.reports, access.health, access.users, access.donations || access.ads].filter(Boolean).length;
  const resolution = summary.avgResolutionHours === null ? null : humanizeHours(summary.avgResolutionHours);
  const resolutionText = resolution
    ? `${resolution.value} ${resolution.unit === 'hours' ? dt(`orë`) : dt(`ditë`)}`
    : null;

  const pendingChip = (figure: Figure, text: string, tone: Tone) =>
    figure.value === null || figure.value === 0 ? null : { text: `${figure.value.toLocaleString('sq')} ${text}`, tone };

  const filterChips: Array<{ id: MunicipalityFilter; label: string }> = [
    { id: 'all', label: `${dt(`Të gjitha`)} (${breakdown.rows.length})` },
    { id: 'active', label: dt(`Me të dhëna`) },
    { id: 'pending', label: dt(`Në pritje`) },
    ...(access.health ? [{ id: 'health' as const, label: dt(`Raste shëndetësore`) }] : []),
  ];

  const serviceTone: Tone =
    serviceHealth.state === 'ok' ? 'emerald' : serviceHealth.state === 'down' ? 'red' : serviceHealth.state === 'degraded' ? 'amber' : 'slate';

  return (
    <div className="mx-auto min-h-full max-w-[1600px] space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-rose-600/10 blur-3xl" aria-hidden="true" />
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-rose-300">
              <span className={cn('h-2 w-2 rounded-full', serviceTone === 'emerald' ? 'bg-emerald-400 motion-safe:animate-pulse' : serviceTone === 'red' ? 'bg-red-500' : serviceTone === 'amber' ? 'bg-amber-400' : 'bg-slate-400')} aria-hidden="true" />
              <span>{isScoped ? `${dt(`Kufizuar te komuna`)}: ${scopeName}` : dt(`Qendra Operative Mbarëkombëtare`)}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{dt(`Paneli Qendror i Administrimit`)}</h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-400 sm:text-sm">
              {isScoped
                ? dt(`Pasqyra e kufizuar në një komunë. Ndryshoni kufizimin lart djathtas për të parë të gjithë vendin.`)
                : dt(`Pasqyra e raporteve qytetare, rasteve shëndetësore dhe aktivitetit të 38 komunave të Kosovës.`)}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <div className="text-right text-[11px] text-slate-400" aria-live="polite">
              {updatedAt ? (
                <>
                  <span className="block font-bold uppercase tracking-wider">{dt(`Numrat u përditësuan`)}</span>
                  <span className="font-mono text-slate-300">
                    {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              ) : (
                <span>{dt(`Duke ngarkuar numrat…`)}</span>
              )}
            </div>
            <RefreshButton
              isRefreshing={isRefreshing}
              onClick={() => {
                void refresh();
                serviceHealth.recheck();
              }}
            />
            {access.reports && (
              <button
                type="button"
                onClick={() => onTabChange('reports')}
                className={cn('flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-rose-700', FOCUS_RING)}
              >
                <span>{dt(`Veprimet në pritje`)}</span>
                {pendingReports.value !== null && (
                  <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[11px]">
                    <FigureText figure={pendingReports} />
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {reportsStatus === 'error' && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{reportsError || dt(`Raportet nuk u ngarkuan. Numrat e mëposhtëm mund të jenë të paplotë.`)}</span>
        </div>
      )}

      {/* ── Needs attention ────────────────────────────────────────────────── */}
      {attention.length > 0 && (
        <Panel
          title={dt(`Kërkon vëmendje tani`)}
          icon={Zap}
          iconClassName="text-amber-500"
          action={
            access.reports && reportsPartial && !reportsLoading ? (
              <span className="text-[11px] text-slate-400">
                {dt(`Bazuar në raportet më të fundit të ngarkuara`)} ({reports.length})
              </span>
            ) : undefined
          }
        >
          {attentionClear && (
            <p className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              {dt(`Asgjë nuk kërkon vëmendje të menjëhershme.`)}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
            {attention.map((item) => (
              <AttentionTile
                key={item.id}
                label={item.label}
                hint={item.hint}
                icon={item.icon}
                tone={item.tone}
                figure={item.figure}
                onClick={() => onTabChange(item.section)}
              />
            ))}
          </div>
        </Panel>
      )}

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      {kpiCount > 0 && (
        <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5', KPI_GRID[Math.min(4, kpiCount)])}>
          {access.reports && (
            <StatCard
              label={dt(`Raportimet Qytetare`)}
              figure={totalReports}
              icon={FileText}
              tone="blue"
              chip={pendingChip(pendingReports, dt(`në pritje`), 'amber')}
              footer={
                <>
                  {dt(`Zgjidhur`)}: <strong className="text-emerald-600">{resolvedReports.value === null ? '…' : resolvedReports.value.toLocaleString('sq')}</strong>
                  {resolutionText && <> · {dt(`mesatarisht`)} {resolutionText}</>}
                </>
              }
              cta={dt(`Inspekto`)}
              onClick={() => onTabChange('reports')}
            />
          )}
          {access.health && (
            <StatCard
              label={dt(`Regjistri Shëndetësor`)}
              figure={totalHealth}
              icon={HeartPulse}
              tone="rose"
              chip={pendingChip(urgentHealth, dt(`urgjente`), 'red')}
              footer={<>{dt(`Spitale të njoftuara`)}: <strong className="text-slate-800 dark:text-slate-200">{notifiedHospitals}</strong></>}
              cta={dt(`Menaxho`)}
              onClick={() => onTabChange('health')}
            />
          )}
          {access.users && (
            <StatCard
              label={dt(`Llogari të regjistruara`)}
              figure={serverOnlyFigure('users')}
              icon={Users}
              tone="purple"
              chip={pendingChip(serverOnlyFigure('staff'), dt(`staf & agjentë`), 'purple')}
              footer={dt(`Qytetarë, staf dhe agjentë`)}
              cta={dt(`Detajet`)}
              onClick={() => onTabChange('users')}
            />
          )}
          {(access.donations || access.ads) && (
            <StatCard
              label={access.donations ? dt(`Donacione & Solidaritet`) : dt(`Reklamat`)}
              figure={access.donations ? { value: donationCauses.length, atLeast: donationsPartial } : { value: ads.length }}
              icon={access.donations ? Heart : Megaphone}
              tone="emerald"
              chip={
                access.donations && pendingDonations > 0
                  ? { text: `${pendingDonations} ${dt(`për aprovim`)}`, tone: 'amber' }
                  : access.ads && activeAds > 0
                    ? { text: `${activeAds} ${dt(`aktive`)}`, tone: 'blue' }
                    : null
              }
              footer={
                access.donations
                  ? <>{dt(`Aprovuar`)}: <strong className="text-emerald-600">{donationCauses.filter((cause) => cause.status === 'approved').length}</strong></>
                  : <>{dt(`Fushata në qarkullim`)}</>
              }
              cta={access.donations ? dt(`Aprovo`) : dt(`Menaxho`)}
              onClick={() => onTabChange(access.donations ? 'donations' : 'ads')}
            />
          )}
        </div>
      )}

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {access.reports && (
            <Panel
              title={dt(`Ecuria e raporteve`)}
              icon={Activity}
              iconClassName="text-blue-500"
              action={
                resolutionText ? (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {dt(`Koha mesatare e zgjidhjes`)}: <strong className="text-slate-900 dark:text-white">{resolutionText}</strong>
                  </span>
                ) : undefined
              }
            >
              {totalReports.value === null ? (
                <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" aria-label={dt(`Duke ngarkuar`)} />
              ) : totalReports.value === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">{dt(`Nuk ka ende raporte për t'u shfaqur.`)}</p>
              ) : (
                <PipelineBar segments={pipeline} />
              )}

              {categories.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/5">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {dt(`Kategoritë më të shpeshta`)}
                  </p>
                  <ul className="space-y-1.5">
                    {categories.map((entry) => (
                      <li key={entry.category} className="flex items-center gap-3 text-xs">
                        <span className="w-40 shrink-0 truncate text-slate-700 dark:text-slate-300">{entry.category}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                          <span className="block h-full rounded-full bg-blue-500" style={{ width: `${(entry.count / categories[0].count) * 100}%` }} />
                        </span>
                        <span className="w-8 shrink-0 text-right font-bold tabular-nums text-slate-900 dark:text-white">{entry.count}</span>
                      </li>
                    ))}
                  </ul>
                  {reportsPartial && (
                    <p className="mt-2 text-[11px] text-slate-400">
                      {dt(`Bazuar në raportet më të fundit të ngarkuara`)} ({scopedReports.length})
                    </p>
                  )}
                </div>
              )}
            </Panel>
          )}

          {access.reports && isScoped && (
            <Panel
              title={`${dt(`Raportet e fundit`)} — ${scopeName}`}
              icon={FileText}
              iconClassName="text-blue-500"
              action={
                <button
                  type="button"
                  onClick={() => setScope(ALL_SCOPE)}
                  className={cn('flex items-center gap-1 rounded-md text-xs font-bold text-rose-600 hover:text-rose-700', FOCUS_RING)}
                >
                  {dt(`Shiko të 38 komunat`)} <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              }
            >
              {recentReports.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">{dt(`Asnjë raport i ngarkuar për këtë komunë.`)}</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-white/5">
                  {recentReports.map((report) => {
                    const meta = statusMeta(report.status);
                    return (
                      <li key={report.id}>
                        <button
                          type="button"
                          onClick={() => onTabChange('reports')}
                          className={cn('flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50', FOCUS_RING)}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold text-slate-900 dark:text-white">{report.title}</span>
                            <span className="block truncate text-[11px] text-slate-400">
                              {report.category} · <AgeText iso={report.createdAt} now={now} />
                            </span>
                          </span>
                          {report.urgency === 'Kritike' && (
                            <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                              {dt(`Kritike`)}
                            </span>
                          )}
                          <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold', TONE_CLASSES[meta.tone].badge)}>
                            {meta.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          )}

          {access.reports && !isScoped && (
            <Panel
              title={dt(`Aktiviteti i 38 Komunave të Kosovës`)}
              icon={MapPin}
              action={
                <button
                  type="button"
                  onClick={() => onTabChange('reports')}
                  className={cn('flex items-center gap-1 rounded-md text-xs font-bold text-rose-600 hover:text-rose-700', FOCUS_RING)}
                >
                  {dt(`Të gjitha raportet`)} <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              }
            >
              <div className="mb-3 flex flex-col items-stretch justify-between gap-2.5 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    type="search"
                    value={muniSearch}
                    onChange={(event) => setMuniSearch(event.target.value)}
                    placeholder={dt(`Kërko komunën (psh. Prishtinë, Prizren)…`)}
                    aria-label={dt(`Kërko komunën`)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-8 text-xs text-slate-900 outline-none focus:border-rose-500 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                  />
                  {muniSearch && (
                    <button
                      type="button"
                      onClick={() => setMuniSearch('')}
                      aria-label={dt(`Pastro kërkimin`)}
                      className={cn('absolute right-2 top-1/2 -translate-y-1/2 rounded text-slate-400 hover:text-slate-600', FOCUS_RING)}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0" role="group" aria-label={dt(`Filtro komunat`)}>
                  {filterChips.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setMuniFilter(chip.id)}
                      aria-pressed={muniFilter === chip.id}
                      className={cn(
                        'whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors',
                        muniFilter === chip.id
                          ? 'bg-slate-900 text-white dark:bg-rose-600'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                        FOCUS_RING
                      )}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[460px] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-100 font-bold uppercase tracking-wider text-slate-400 dark:border-white/5">
                      <th scope="col" className="px-2 py-2.5">{dt(`Komuna`)}</th>
                      <th scope="col" className="px-2 py-2 text-center">{dt(`Raporte`)}</th>
                      <th scope="col" className="px-2 py-2 text-center">{dt(`Në pritje`)}</th>
                      <th scope="col" className="px-2 py-2 text-center">{dt(`Zgjidhur`)}</th>
                      {access.health && <th scope="col" className="px-2 py-2 text-center">{dt(`Shëndetësi`)}</th>}
                      <th scope="col" className="px-2 py-2 text-right">{dt(`Ecuria`)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {reportsLoading ? (
                      <tr>
                        <td colSpan={access.health ? 6 : 5} className="py-6 text-center text-slate-400">{dt(`Duke ngarkuar`)}…</td>
                      </tr>
                    ) : visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={access.health ? 6 : 5} className="py-6 text-center text-slate-400">
                          {dt(`Nuk u gjet asnjë komunë me këtë filtër.`)}
                        </td>
                      </tr>
                    ) : (
                      visibleRows.map((row) => (
                        <tr key={row.name} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => setScope(row.name)}
                              title={dt(`Kufizo panelin te kjo komunë`)}
                              className={cn('flex items-center gap-1.5 rounded text-left font-bold text-slate-900 hover:text-rose-600 dark:text-white', FOCUS_RING)}
                            >
                              <span className={cn('h-2 w-2 shrink-0 rounded-full', row.total > 0 ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600')} aria-hidden="true" />
                              <span className="whitespace-nowrap">{row.name}</span>
                            </button>
                          </td>
                          <td className="px-2 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">{row.total}</td>
                          <td className="px-2 py-2 text-center">
                            {row.pending > 0 ? (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">{row.pending}</span>
                            ) : (
                              <span className="text-slate-400">–</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center font-bold text-emerald-600">{row.resolved}</td>
                          {access.health && (
                            <td className="px-2 py-2 text-center font-bold text-purple-600">{row.health > 0 ? row.health : '–'}</td>
                          )}
                          <td className="px-2 py-2 text-right">
                            {row.resolutionRate === null ? (
                              <span className="text-slate-400" title={dt(`Asnjë raport për t'u matur`)}>–</span>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-[11px] font-bold tabular-nums text-slate-600 dark:text-slate-300">{row.resolutionRate}%</span>
                                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label={`${row.resolutionRate}%`}>
                                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.resolutionRate}%` }} />
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-white/5 dark:text-slate-400">
                <span>
                  {reportsPartial
                    ? `${dt(`Bazuar në raportet më të fundit të ngarkuara`)} (${reports.length})`
                    : dt(`Bazuar në të gjitha raportet`)}
                  {breakdown.unassignedReports > 0 && (
                    <> · {breakdown.unassignedReports} {dt(`pa komunë të njohur`)}</>
                  )}
                </span>
                {!muniSearch.trim() && muniFilter === 'all' && (
                  <button
                    type="button"
                    onClick={() => setShowAllMunis((value) => !value)}
                    className={cn('rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700', FOCUS_RING)}
                  >
                    {showAllMunis ? dt(`Shfaq më pak`) : `${dt(`Shfaq të gjitha`)} ${breakdown.rows.length}`}
                  </button>
                )}
              </div>
            </Panel>
          )}
        </div>

        {/* ── Side column ─────────────────────────────────────────────────── */}
        <div className="space-y-6">
          <ServiceStatusPanel health={serviceHealth} />

          {(access.updates || access.security) && (
            <Panel
              title={dt(`Aktiviteti i fundit`)}
              icon={Activity}
              iconClassName="text-purple-500"
              action={
                <button
                  type="button"
                  onClick={() => onTabChange(access.updates ? 'updates' : 'security')}
                  className={cn('flex items-center gap-1 rounded-md text-xs font-bold text-rose-600 hover:text-rose-700', FOCUS_RING)}
                >
                  {dt(`Të gjitha`)} <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              }
            >
              {recentActivity.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">{dt(`Nuk ka aktivitet të fundit.`)}</p>
              ) : (
                <ul className="space-y-3">
                  {recentActivity.map((log) => (
                    <li key={log.id} className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          log.status === 'danger' ? 'bg-red-500' : log.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-slate-900 dark:text-white">{log.action}</span>
                        <span className="block truncate text-[11px] text-slate-400">
                          {log.userName || log.userEmail || dt(`Sistemi`)} · <AgeText iso={log.createdAt} now={now} />
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {(access.notifications || access.news || access.moderim || access.security) && (
            <Panel title={dt(`Veprime të shpejta`)} icon={Zap} iconClassName="text-amber-500">
              <div className="space-y-2">
                {[
                  { show: access.notifications, section: 'notifications' as const, icon: BellRing, title: dt(`Dërgo njoftim / thirrje emergjente`), text: dt(`Transmetim tek qytetarët e komunës`) },
                  { show: access.news, section: 'news' as const, icon: Newspaper, title: dt(`Publiko një lajm`), text: dt(`Botim dhe redaktim i lajmeve`) },
                  { show: access.moderim, section: 'moderim' as const, icon: ShieldAlert, title: dt(`Qendra e moderimit`), text: dt(`Anomalitë, auditimi dhe moderimi`) },
                  { show: access.security, section: 'security' as const, icon: ShieldCheck, title: dt(`Regjistri i auditimit`), text: dt(`Kush ka bërë çfarë dhe kur`) },
                ]
                  .filter((action) => action.show)
                  .map((action) => (
                    <button
                      key={action.section}
                      type="button"
                      onClick={() => onTabChange(action.section)}
                      className={cn('group flex w-full items-center gap-3 rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-left transition-colors hover:bg-rose-50 dark:border-white/5 dark:bg-slate-800 dark:hover:bg-rose-950/30', FOCUS_RING)}
                    >
                      <action.icon className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-rose-600" aria-hidden={true} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-slate-900 group-hover:text-rose-600 dark:text-white">{action.title}</span>
                        <span className="block truncate text-[11px] text-slate-400">{action.text}</span>
                      </span>
                    </button>
                  ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

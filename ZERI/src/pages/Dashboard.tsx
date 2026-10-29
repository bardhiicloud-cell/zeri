import { dt } from '@/src/lib/dt';
import { BrandMark } from '@/src/components/BrandLogo';
import { NationalHero } from '@/src/components/NationalHero';
const HeritageHomeBand = React.lazy(() => import('@/src/components/heritage/HomeBand').then((m) => ({ default: m.HeritageHomeBand })));
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../lib/store';
import { statusLabel, statusMeta, TONE_CLASSES } from '../lib/reportStatus';
import { 
  Search, MapPin, Clock, ArrowRight, CheckCircle2, AlertTriangle, 
  Layers, Heart, Share2, Sparkles, Filter, SlidersHorizontal,
  ThumbsUp, MessageCircle, Phone, ArrowUpRight, Check, Eye,
  Building2, Users, FileText, Vote, Shield, ShieldCheck,
  ChevronRight, Calendar, ArrowUp, ExternalLink, X, Activity,
  Zap, Droplets, Leaf, PenSquare, Newspaper, Info, HeartPulse, Handshake, UserPlus
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import ReportDetailModal from '../components/ReportDetailModal.tsx';
import { Report } from '../types';
const KosovoDashboardMap = React.lazy(() => import('../components/KosovoDashboardMap').then((m) => ({ default: m.KosovoDashboardMap })));
const DashboardFeed = React.lazy(() => import('./DashboardFeed'));
import { useLanguage } from '../lib/LanguageContext';
import toast from 'react-hot-toast';
import { MunicipalityShield } from '../components/MunicipalityShield';
import { getMunicipalityHeroImage } from '../lib/municipalityHeroImages';
import { getMunicipalityPhoto } from '../lib/municipalityPhotos';
import { ALL_SCOPE, isSpecificScope, recordMatchesScope, scopeKey } from '../lib/municipalityScope';
import AdBanner from '../components/AdBanner.tsx';
import { QuickAccessGrid } from '../components/dashboard/QuickAccessGrid';
import { DashboardEngagementBlock } from '../components/dashboard/DashboardEngagementBlock.tsx';
import { SocialFollowBlock } from '../components/SocialFollowBlock';
import { getReportTopicLabel } from '../lib/reportTopics';

/**
 * Do not download below-the-fold modules until the visitor approaches them.
 * A fixed minimum height reserves layout space, avoiding a blank-to-content CLS jump.
 */
function DeferredSection({
  children,
  className = '',
  rootMargin = '250px 0px',
}: {
  children: React.ReactNode;
  className?: string;
  rootMargin?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} className={className}>
      {visible ? children : <div aria-hidden="true" />}
    </div>
  );
}

export default function Dashboard() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const reports = useStore((state) => state.reports || []);
  const polls = useStore((state) => state.polls || []);
  const reportsStatus = useStore((state) => state.reportsStatus);
  const userMunicipality = useStore((state) => state.userMunicipality);

  const hasMoreReports = useStore((state) => state.hasMoreReports);
  const currentUser = useStore((state) => state.currentUser);
  const isGuest = !currentUser || currentUser.role === 'guest';

  // View Mode: default is 'screenshot'
  const [viewMode, setViewMode] = useState<'screenshot' | 'backup'>(() => {
    return (localStorage.getItem('dashboard_view_mode') as 'screenshot' | 'backup') || 'screenshot';
  });

  const [topSearchQuery, setTopSearchQuery] = useState('');
  const [selectedMunicipality, setSelectedMunicipality] = useState(
    isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : ''
  );
  const [muniSearchQuery, setMuniSearchQuery] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  useEffect(() => {
    // The page mirrors the global scope; the state below is no longer a second
    // copy that the hero and the cards could disagree about.
    setSelectedMunicipality(isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : '');
  }, [userMunicipality]);

  // If user requested backup view, render the preserved original dashboard
  if (viewMode === 'backup') {
    return (
      <div className="relative">
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-2 rounded-full shadow-2xl border border-white/20 flex items-center gap-3 text-xs">
          <span className="font-bold text-amber-400">Pamja: Backup</span>
          <button
            onClick={() => {
              setViewMode('screenshot');
              localStorage.setItem('dashboard_view_mode', 'screenshot');
              toast.success("U kthye në pamjen 100% identike!");
            }}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-full font-bold text-white transition text-xs"
          >
            Kthe te Pamja Kryesore ↗
          </button>
        </div>
        <React.Suspense fallback={<div className="min-h-[60vh]" aria-label={dt('Duke ngarkuar pamjen rezervë...')} />}>
          <DashboardFeed />
        </React.Suspense>
      </div>
    );
  }

  // Real-time live counts + baseline
  const publicReports = reports.filter(r => !['Pending Review', 'Rejected', 'Draft'].includes(r.status));
  // Only real, public reports. Demo/sample rows used to fill this page when none had loaded.
  const dashboardReports = publicReports;
  /**
   * The page-level scope is the global one. It used to fall back to a private
   * `selectedMunicipality` state, which meant the hero and the cards could
   * disagree: clicking a municipality chip changed only the cards, while the
   * sidebar and every other page still pointed somewhere else. There is now no
   * second copy to fall out of step.
   */
  const setUserMunicipality = useStore((state) => state.setUserMunicipality);
  const activeMunicipality = isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : '';
  const heroMunicipality = activeMunicipality || 'Prishtinë';
  const fallbackHero = getMunicipalityHeroImage(heroMunicipality);
  // "Gjithë Kosova" (no municipality selected) gets the dedicated national hero.
  const isNationalScope = !activeMunicipality;
  const heroImageDay = getMunicipalityPhoto(heroMunicipality, 'day') ?? fallbackHero;
  const heroImageNight = getMunicipalityPhoto(heroMunicipality, 'night') ?? fallbackHero;
  const handleMunicipalityChange = (municipality: string) => {
    // The store setter persists; the page no longer writes localStorage itself.
    setUserMunicipality(municipality || ALL_SCOPE);
  };
  const scopedReports = activeMunicipality
    ? dashboardReports.filter((report) => recordMatchesScope(report, activeMunicipality))
    : dashboardReports;
  const activeReports = scopedReports.filter(r => r.status !== 'Resolved');
  const resolvedReports = scopedReports.filter(r => r.status === 'Resolved');

  const totalReportsCount = scopedReports.length;
  const inTreatmentCount = activeReports.length;
  const resolvedCount = resolvedReports.length;
  /** True until real reports are on screen: numbers are then shown as "—", never as invented figures. */
  const countsUnavailable = reportsStatus !== 'ready' && publicReports.length === 0;

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const reportsCreatedInRange = (start: number, end: number) => scopedReports.filter((report) => {
    const createdAt = new Date(report.createdAt || 0).getTime();
    return createdAt >= start && createdAt < end;
  });
  const currentMonthReports = reportsCreatedInRange(currentMonthStart, now.getTime());
  const previousMonthReports = reportsCreatedInRange(previousMonthStart, currentMonthStart);
  const currentMonthInTreatment = currentMonthReports.filter(r => r.status !== 'Resolved').length;
  const previousMonthInTreatment = previousMonthReports.filter(r => r.status !== 'Resolved').length;
  const currentMonthResolved = currentMonthReports.filter(r => r.status === 'Resolved').length;
  const previousMonthResolved = previousMonthReports.filter(r => r.status === 'Resolved').length;
  const getPercentageChange = (current: number, previous: number) => {
    if (previous === 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  };
  const totalChange = getPercentageChange(currentMonthReports.length, previousMonthReports.length);
  const inTreatmentChange = getPercentageChange(currentMonthInTreatment, previousMonthInTreatment);
  const resolvedChange = getPercentageChange(currentMonthResolved, previousMonthResolved);
  const activeMunicipalitiesCount = new Set(
    dashboardReports.map(report => report.location?.municipality).filter(Boolean)
  ).size;
  const activePollsCount = polls.filter((poll) => new Date(poll.expiresAt).getTime() > Date.now()).length;
  const urgentReportsCount = scopedReports.filter(report => report.urgency === 'Kritike' || report.urgency === 'E lartë').length;
  const renderChange = (change: number | null) => (
    <div className={cn(
      "flex items-start gap-1 text-xs leading-tight font-bold mt-2",
      change === null ? "text-slate-600 dark:text-slate-400" : change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
    )}>
      {change === null ? <Activity className="w-3 h-3 shrink-0" /> : <ArrowUp className={cn("w-3 h-3 shrink-0", change < 0 && "rotate-180")} />}
      <span>{change === null ? 'Pa bazë krahasimi' : `${change > 0 ? '+' : ''}${change}% krahasuar me muajin e kaluar`}</span>
    </div>
  );

  // Dynamic reports from store formatted to table rows
  const storeTableRows = scopedReports.map((r) => {
    return {
      id: r.id,
      code: r.trackingId || r.id,
      category: getReportTopicLabel(r),
      municipality: r.location?.municipality || 'Prishtinë',
      date: new Date(r.createdAt || Date.now()).toLocaleDateString('de-DE'),
      status: statusLabel(r.status),
      tone: statusMeta(r.status).tone,
      rawReport: r
    };
  });

  // Combined reports (store first so latest reports update live)
  const combinedRecentReports = storeTableRows.slice(0, 6);

  // Filter municipalities for the quick badge grid
  const keyMunicipalities = [
    { name: 'Prishtinë', code: 'PR' },
    { name: 'Pejë', code: 'PE' },
    { name: 'Prizren', code: 'PZ' },
    { name: 'Gjilan', code: 'GJ' },
    { name: 'Ferizaj', code: 'FE' },
    { name: 'Mitrovicë', code: 'MI' },
    { name: 'Gjakovë', code: 'GJA' },
    { name: 'Vushtrri', code: 'VU' }
  ].filter(m => !muniSearchQuery || m.name.toLowerCase().includes(muniSearchQuery.toLowerCase()));

  // One lookup through dt() for every supported language, instead of a table
  // that only knew six of them and showed Albanian to the other fourteen.
  const headerLabels = {
    report: dt('Raporto', language),
    track: dt('Gjej raportimin tim', language),
    search: dt('Kërko ndihmë, komunë ose raportim...', language),
    action: dt('Kërko', language),
  };

  return (
    <div className="w-full min-h-screen bg-(--color-page) dark:bg-[#111B24] text-slate-900 dark:text-white flex flex-col font-sans transition-colors duration-200">


      {/* MAIN CONTENT WRAPPER */}
      {/*
        `py-3` on mobile, `py-4` from sm. The previous `py-4 sm:py-6` stacked
        under the layout's own top padding, so the hero started ~40px below the
        bar and the top of the fold was empty on a 900px-tall screen. The search
        form, hero and metrics now start immediately below the navigation.
      */}
      <div className="max-w-[1600px] mx-auto w-full px-3 sm:px-5 lg:px-8 2xl:px-10 py-3 sm:py-4 space-y-4 sm:space-y-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (topSearchQuery.trim()) navigate(`/detailed-registry?q=${encodeURIComponent(topSearchQuery.trim())}`);
          }}
          className="luxury-search mx-auto flex w-full max-w-3xl items-center gap-2 rounded-[24px] p-1.5 dark:border-white/10"
        >
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
            <input
              type="search"
              placeholder={headerLabels.search}
              value={topSearchQuery}
              onChange={(event) => setTopSearchQuery(event.target.value)}
              className="w-full pl-10 pr-3 py-2.5 bg-transparent text-base text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
              aria-label={headerLabels.search}
            />
          </div>
          <button type="submit" disabled={!topSearchQuery.trim()} aria-label={headerLabels.action} className="luxury-cta inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-900 px-4 py-2.5 text-xs font-black text-white transition duration-200 hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100">
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{headerLabels.action}</span>
          </button>
        </form>

        {isNationalScope ? (
          <NationalHero
            onReport={() => navigate('/raporto')}
            onViewReports={() => document.getElementById('recent-reports-table')?.scrollIntoView({ behavior: 'smooth' })}
          />
        ) : (
        <div className="luxury-hero relative w-full min-h-[210px] sm:min-h-[230px] lg:min-h-[250px] rounded-[28px] overflow-hidden text-white flex flex-col justify-start p-4 sm:p-5 lg:p-6">

          {/* Municipality panorama with a deep navy overlay for readable content. */}
          <div
            className="dark:hidden absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
            style={{ backgroundImage: `url(${heroImageDay})` }}
          />
          <div
            className="hidden dark:block absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
            style={{ backgroundImage: `url(${heroImageNight})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#071328]/80 via-[#0b1d3a]/55 to-[#071328]/30 dark:from-[#071328]/75 dark:via-[#0b1d3a]/40 dark:to-[#071328]/10" />

          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Badge inside Hero */}
          <div className="relative z-10 mb-1">
            <div className="luxury-pill inline-flex items-center gap-1.5 px-3 py-1 text-blue-200 text-xs sm:text-xs font-black rounded-full uppercase tracking-[0.16em]">
              <span>{dt('Shërbime për qytetarët')}</span>
            </div>
          </div>

          {/* Hero Middle Content: Left Text & Right 3 Badges */}
          <div className="relative z-10 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 sm:gap-8">

            {/* Left Content */}
            <div className="max-w-2xl">
              <h1 className="luxury-hero-title text-3xl sm:text-4xl lg:text-[3.35rem] font-black text-white tracking-[-0.06em] leading-[0.92] mb-2 title-serif">
                Zëri Qytetarëve {heroMunicipality}
              </h1>

              <p className="text-xs sm:text-sm text-slate-200/90 leading-snug mb-3 max-w-xl font-normal">
                {dt('Raportoni probleme, merrni pjesë në vendimmarrje dhe ndihmoni në përmirësimin e shërbimeve në komunën tuaj.')}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/raporto')}
                  className="luxury-cta inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 px-3.5 py-2 text-xs font-extrabold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98]"
                >
                  <PenSquare className="w-3.5 h-3.5" />
                  <span>{dt('Raporto një problem')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    document.getElementById('recent-reports-table')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="luxury-pill inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/20 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-white/10 active:scale-[0.98]"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{dt('Shiko raportimet')}</span>
                </button>
              </div>
            </div>

            {/* Right Side: 3 Stacked Horizontal Items (Exact from Screenshot) */}
            <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0 xl:absolute xl:right-4 xl:top-4 rtl:xl:left-4 rtl:xl:right-auto">

              <div className="luxury-stat-card hover:bg-slate-900/80 backdrop-blur-md rounded-xl px-2 py-1 flex items-center gap-1.5 text-white shadow-xs transition min-w-[170px]">
                <div className="w-5 h-5 rounded-md bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0">
                  <Users className="w-3 h-3" />
                </div>
                <span className="text-xs font-bold">{dt('Qytetarët raportojnë')}</span>
              </div>

              <div className="luxury-stat-card hover:bg-slate-900/80 backdrop-blur-md rounded-xl px-2 py-1 flex items-center gap-1.5 text-white shadow-xs transition min-w-[170px]">
                <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                  <Building2 className="w-3 h-3" />
                </div>
                <span className="text-xs font-bold">{dt('Institucionet veprojnë')}</span>
              </div>

              <div className="luxury-stat-card hover:bg-slate-900/80 backdrop-blur-md rounded-xl px-2 py-1 flex items-center gap-1.5 text-white shadow-xs transition min-w-[170px]">
                <div className="w-5 h-5 rounded-md bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0">
                  <Heart className="w-3 h-3" />
                </div>
                <span className="text-xs font-bold">{dt('Komuniteti përmirësohet')}</span>
              </div>

            </div>

          </div>

        </div>
        )}

        {/* Below-the-fold archive cards are loaded only as the visitor approaches them. */}
        <DeferredSection className="min-h-[220px]" rootMargin="250px 0px">
          <React.Suspense fallback={<div className="grid min-h-[220px] grid-cols-1 gap-3 md:grid-cols-3 md:gap-4" aria-hidden="true"><div className="min-h-[210px] rounded-2xl bg-slate-100 dark:bg-slate-900" /><div className="min-h-[210px] rounded-2xl bg-slate-100 dark:bg-slate-900" /><div className="min-h-[210px] rounded-2xl bg-slate-100 dark:bg-slate-900" /></div>}>
            <HeritageHomeBand />
          </React.Suspense>
        </DeferredSection>

        {/* Primary actions replaced the four KPI counters: those numbers now live on /statistikat. */}
        <QuickAccessGrid />

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
          {[
            { label: 'Raporte publike', value: countsUnavailable ? '—' : `${totalReportsCount.toLocaleString('de-DE')}${hasMoreReports ? '+' : ''}`, tone: 'blue', icon: FileText },
            { label: 'Jo ende të zgjidhura', value: countsUnavailable ? '—' : inTreatmentCount.toLocaleString('de-DE'), tone: 'amber', icon: Activity },
            { label: 'Urgjente', value: countsUnavailable ? '—' : urgentReportsCount.toLocaleString('de-DE'), tone: 'rose', icon: AlertTriangle },
            { label: 'Sondazhe aktive', value: activePollsCount.toLocaleString('de-DE'), tone: 'emerald', icon: Vote },
          ].map((metric) => {
            const Icon = metric.icon as React.ComponentType<{ className?: string }>;
            return (
              <div key={metric.label} className="rounded-2xl sm:rounded-[24px] border border-slate-200/80 bg-white dark:border-white/10 dark:bg-slate-900 p-2.5 sm:p-4 shadow-sm">
                <div className={cn(
                  'inline-flex rounded-lg sm:rounded-xl p-1.5 sm:p-2',
                  metric.tone === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
                  metric.tone === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
                  metric.tone === 'rose' && 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
                  metric.tone === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="mt-2 sm:mt-4 text-lg sm:text-2xl font-black leading-none text-slate-900 dark:text-white">{metric.value}</div>
                <div className="mt-1 text-xs sm:text-xs font-bold uppercase leading-tight tracking-[0.1em] sm:tracking-[0.15em] text-slate-600 dark:text-slate-400">{dt(metric.label)}</div>
              </div>
            );
          })}
        </div>

        <div className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold",
          countsUnavailable
            ? "border-amber-100 bg-amber-50/80 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300"
            : "border-emerald-100 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
        )}>
          <span className={cn("h-2 w-2 shrink-0 rounded-full", countsUnavailable ? "bg-amber-500" : "bg-emerald-500")} />
          <span role="status">
            {reportsStatus === 'error'
              ? dt("Raportet nuk u ngarkuan. Rifreskoni faqen për të provuar përsëri.")
              : countsUnavailable
                ? dt("Raportet po ngarkohen.")
                : dt("Numrat tregojnë raportet publike të ngarkuara. Detajet e plota janë te Statistikat dhe Regjistri.")}
          </span>
        </div>

        {/*
          Partnership band. Sits right after the live numbers, so the offer to
          institutions and businesses is made at the moment the page has shown
          what the platform reaches. Guests also get a sign-up action here; for
          signed-in citizens it would be noise.
        */}
        <section
          aria-labelledby="partner-band-heading"
          className="relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 dark:border-white/10 dark:bg-slate-900"
        >
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3 sm:gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-sm">
                <Handshake className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
                  {dt('Për institucione, biznese dhe OJQ')}
                </p>
                <h2 id="partner-band-heading" className="mt-1 text-lg font-black leading-tight text-slate-900 sm:text-xl dark:text-white">
                  {dt('Bashkëpunoni me Zërin e Qytetarëve')}
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-slate-400">
                  {dt('Arrini qytetarët e 38 komunave me njoftime, fushata dhe projekte të përbashkëta.')}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
              <Link
                to="/partneret"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-black text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                <Handshake className="h-4 w-4" aria-hidden="true" />
                {dt('Bëhu partner')}
              </Link>
              {isGuest && (
                <Link
                  to="/register"
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-800 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  {dt('Krijo llogari falas')}
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* 4. SPLIT SECTION: RAPORTIMET NË HARTË (LEFT) & RAPORTIMET MË TË FUNDIT (RIGHT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

          {/* Left Column (7 cols): Raportimet në hartë (Accurate Kosovo Map) */}
          <div className="lg:col-span-7 flex flex-col">
            <DeferredSection className="min-h-[520px]" rootMargin="250px 0px">
              <React.Suspense fallback={<div className="min-h-[520px] rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-900" aria-hidden="true" />}>
                <KosovoDashboardMap
                  reports={scopedReports}
                  selectedMunicipality={activeMunicipality}
                  onMunicipalityChange={handleMunicipalityChange}
                  /**
                   * The link carries the *active* scope, never the hero fallback.
                   * `heroMunicipality` defaults to Prishtinë when nothing is chosen,
                   * so a citizen who had never picked a municipality used to be
                   * handed `/harta?municipality=Prishtinë` — a map filtered to a
                   * city they had not chosen. When the scope is the whole country,
                   * the query string is omitted entirely so the map opens on all 38.
                   */
                  onNavigateToMap={() => navigate(
                    activeMunicipality
                      ? `/harta?municipality=${encodeURIComponent(activeMunicipality)}`
                      : '/harta'
                  )}
                />
              </React.Suspense>
            </DeferredSection>
          </div>

          {/* Right Column (5 cols): Raportimet më të fundit Table */}
          <div id="recent-reports-table" className="luxury-card lg:col-span-5 rounded-[28px] border border-slate-200/80 p-5 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1 dark:border-white/10">

            <div>

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-900 dark:text-white title-serif tracking-tight">
                  {dt('Raportimet më të fundit')}
                </h3>

                <Link
                  to="/detailed-registry"
                  className="min-h-10 md:min-h-0 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 group transition-colors"
                >
                  <span>{dt('Shiko të gjitha')}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              {/* Table */}
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={dt('Tabela e raportimeve')}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-white/5 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 pr-2">#</th>
                      <th className="py-2.5 px-2">{dt('Kategoria')}</th>
                      <th className="py-2.5 px-2">{dt('Komuna')}</th>
                      <th className="py-2.5 px-2">{dt('Data')}</th>
                      <th className="py-2.5 pl-2 text-right">{dt('Statusi')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs font-medium">
                    {combinedRecentReports.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {countsUnavailable ? dt('Raportet po ngarkohen.') : dt('Nuk ka ende raporte publike për këtë zonë.')}
                        </td>
                      </tr>
                    )}
                    {combinedRecentReports.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => {
                          if ((row as any).rawReport) {
                            setSelectedReportId((row as any).rawReport.id);
                          } else {
                            navigate('/detailed-registry');
                          }
                        }}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                      >
                        {/* Code */}
                        <td className="py-3 pr-2 font-mono font-bold text-slate-500 group-hover:text-blue-600">
                          {row.code}
                        </td>

                        {/* Category */}
                        <td className="py-3 px-2 font-bold text-slate-900 dark:text-white truncate max-w-[120px]">
                          {row.category}
                        </td>

                        {/* Municipality */}
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {row.municipality}
                        </td>

                        {/* Date */}
                        <td className="py-3 px-2 text-slate-400 whitespace-nowrap text-xs">
                          {row.date}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 pl-2 text-right whitespace-nowrap">
                          <span className={cn("inline-block px-2.5 py-0.5 rounded-full border text-xs font-bold", TONE_CLASSES[row.tone].badge)}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

         </div>

         {/* Two-level engagement block: sponsorship strip plus the Track ID and
             Ideas Bank widgets, directly under the map and reports table. */}
         <DashboardEngagementBlock municipality={activeMunicipality || undefined} />

         {/*
           Social follow block.

           Placed here, after the citizen has read the map and the reports table
           but before the closing banner: this is the point where they have just
           seen that the platform produces real updates, which is the only moment
           a follow request has an argument behind it. It is not in the footer,
           because on a dashboard this long the footer is several screens away and
           is read by people who were already leaving.
         */}
         <SocialFollowBlock />

         {/*
           Strategic banner slot: the last thing on the page, after the citizen
           has read, tracked and proposed. It is deliberately below everything
           useful — a banner is never the reason someone came — and it renders
           nothing at all when no campaign targets this position, so an unfilled
           slot cannot leave the "space for sale" placeholder at the foot of the
           home page.
         */}
         <AdBanner
           position="banner"
           municipality={activeMunicipality || undefined}
           className="mt-1"
         />

        {/* 6. SECTION: PJESËMARRJA QYTETARE, KOMUNAT & SHËRBIMET (3 CARDS MATCHING SCREENSHOT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* Card 1: Pjesëmarrja qytetare (lg:col-span-5) */}
          <div className="luxury-card lg:col-span-5 flex flex-col justify-between rounded-[26px] border border-slate-200/80 p-5 transition-transform duration-300 hover:-translate-y-1 dark:border-white/10">
            <div>
              <h3 className="title-serif text-lg font-black tracking-tight text-slate-900 dark:text-white">
                {dt('Pjesëmarrja qytetare')}
              </h3>
              <p className="mt-1 mb-4 text-xs text-slate-600 dark:text-slate-400">
                {dt('Merr pjesë, jep mendimin dhe kontribuo në vendimmarrje.')}
              </p>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                
                {/* 1. Sondazhe publike */}
                <Link 
                  to="/sondazhet"
                  className="group flex min-h-[130px] flex-col justify-between rounded-[18px] border border-slate-100 bg-slate-50/80 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 dark:border-white/5 dark:bg-slate-800/60 dark:hover:border-blue-500/40 dark:hover:bg-slate-800"
                >
                  <div>
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300">
                      <Vote className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-black leading-tight text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white">
                      Sondazhe publike
                    </h4>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                      {dt('Shpreh mendimin tënd për çështje të rëndësishme.')}
                    </p>
                  </div>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600 transition group-hover:gap-1.5">
                    <span>{dt('Shiko')}</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>

                {/* 2. Konsultime publike */}
                <Link 
                  to="/sondazhet"
                  className="group flex min-h-[130px] flex-col justify-between rounded-[18px] border border-slate-100 bg-slate-50/80 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 dark:border-white/5 dark:bg-slate-800/60 dark:hover:border-emerald-500/40 dark:hover:bg-slate-800"
                >
                  <div>
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300">
                      <Users className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-black leading-tight text-slate-900 transition-colors group-hover:text-emerald-600 dark:text-white">
                      {dt('Sondazhe publike')}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                      {dt('Votoni në sondazhet e hapura.')}
                    </p>
                  </div>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-600 transition group-hover:gap-1.5">
                    <span>{dt('Shiko')}</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>

                {/* 3. Debate publike */}
                <Link 
                  to="/trackid"
                  className="group flex min-h-[130px] flex-col justify-between rounded-[18px] border border-slate-100 bg-slate-50/80 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 dark:border-white/5 dark:bg-slate-800/60 dark:hover:border-indigo-500/40 dark:hover:bg-slate-800"
                >
                  <div>
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-300">
                      <Search className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-black leading-tight text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white">
                      {dt('Gjej raportin tim')}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                      {dt('Ndiq statusin e rastit me Track ID.')}
                    </p>
                  </div>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 transition group-hover:gap-1.5">
                    <span>{dt('Shiko')}</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>

                {/* 4. Raste sociale & ndihmë */}
                <Link 
                  to="/donacion"
                  className="group flex min-h-[130px] flex-col justify-between rounded-[18px] border border-slate-100 bg-slate-50/80 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 dark:border-white/5 dark:bg-slate-800/60 dark:hover:border-rose-500/40 dark:hover:bg-slate-800"
                >
                  <div>
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300">
                      <Heart className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-black leading-tight text-slate-900 transition-colors group-hover:text-rose-600 dark:text-white">
                      {dt('Raste sociale & ndihmë')}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                      {dt('Ndihmo në rastet ku nevojitet mbështetje.')}
                    </p>
                  </div>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-rose-600 transition group-hover:gap-1.5">
                    <span>{dt('Shiko')}</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>

              </div>
            </div>
          </div>

          {/* Card 2: Komunat e Kosovës (lg:col-span-3) */}
          <div id="komunat-section" className="luxury-card lg:col-span-3 flex flex-col justify-between rounded-[26px] border border-slate-200/80 p-5 transition-transform duration-300 hover:-translate-y-1 dark:border-white/10">
            <div>
              <h3 className="title-serif text-lg font-black tracking-tight text-slate-900 dark:text-white">
                {dt('Komunat e Kosovës')}
              </h3>
              <p className="mt-1 mb-3 text-xs text-slate-600 dark:text-slate-400">
                {dt('Gjej komunën tënde dhe informohu për shërbimet lokale.')}
              </p>

              {/* Search Municipalities */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder={dt('Kërko komunën...')}
                  value={muniSearchQuery}
                  onChange={(e) => setMuniSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* 8 Municipalities Grid (4x2) with Authentic Shields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {keyMunicipalities.map((muni) => (
                  <button
                    key={muni.name}
                    type="button"
                    onClick={() => {
                      handleMunicipalityChange(muni.name);
                      document.getElementById('recent-reports-table')?.scrollIntoView({ behavior: 'smooth' });
                      toast.success(`U zgjodh Komuna e ${muni.name}`);
                    }}
                    className="p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-slate-700/80 rounded-xl border border-slate-100 dark:border-white/5 transition text-center flex flex-col items-center gap-1 cursor-pointer group"
                  >
                    <div className="w-7 h-7 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MunicipalityShield name={muni.name} code={muni.code} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 truncate w-full">
                      {muni.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/5 mt-3">
              <Link to="/komunat" className="min-h-10 md:min-h-0 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                <span>{dt('Të gjitha 38 komunat')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 3: Shërbimet dhe kontaktet e institucioneve (lg:col-span-4) */}
          <div id="sherbimet-section" className="luxury-card lg:col-span-4 flex flex-col justify-between rounded-[26px] border border-slate-200/80 p-5 transition-transform duration-300 hover:-translate-y-1 dark:border-white/10">
            <div>
              <h3 className="title-serif text-lg font-black tracking-tight text-slate-900 dark:text-white">
                {dt('Shërbimet dhe kontaktet e institucioneve')}
              </h3>
              <p className="mt-1 mb-3 text-xs text-slate-600 dark:text-slate-400">
                {dt('Numra, email dhe kontakte të rëndësishme për qytetarët.')}
              </p>

              {/* 8 Contact Buttons Grid (4x2: 4 columns x 2 rows) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                
                {/* 1. Policia */}
                <a href="tel:192" className="p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-slate-700/80 rounded-xl border border-slate-100 dark:border-white/5 flex flex-col items-start gap-1 transition-colors group">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                    <Shield className="w-3 h-3" />
                  </div>
                  <div className="w-full min-w-0">
                    <div className="font-bold truncate text-xs text-slate-800 dark:text-slate-200">Policia</div>
                    <div className="font-mono font-black text-blue-600 dark:text-blue-400 text-xs">192</div>
                  </div>
                </a>

                {/* 2. Emergjenca */}
                <a href="tel:112" className="p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-slate-700/80 rounded-xl border border-slate-100 dark:border-white/5 flex flex-col items-start gap-1 transition-colors group">
                  <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-3 h-3" />
                  </div>
                  <div className="w-full min-w-0">
                    <div className="font-bold truncate text-xs text-slate-800 dark:text-slate-200">Emergjenca</div>
                    <div className="font-mono font-black text-rose-600 dark:text-rose-400 text-xs">112</div>
                  </div>
                </a>

                {/* 3. KEDS */}
                <a href="tel:080079100" className="p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-amber-50 dark:hover:bg-slate-700/80 rounded-xl border border-slate-100 dark:border-white/5 flex flex-col items-start gap-1 transition-colors group">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                    <Zap className="w-3 h-3" />
                  </div>
                  <div className="w-full min-w-0">
                    <div className="font-bold truncate text-xs text-slate-800 dark:text-slate-200">KEDS</div>
                    <div className="font-mono font-black text-amber-600 dark:text-amber-400 text-xs truncate">0800 791 00</div>
                  </div>
                </a>

                {/* 4. KRU */}
                <a href="tel:080050020" className="p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-slate-700/80 rounded-xl border border-slate-100 dark:border-white/5 flex flex-col items-start gap-1 transition-colors group">
                  <div className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center shrink-0">
                    <Droplets className="w-3 h-3" />
                  </div>
                  <div className="w-full min-w-0">
                    <div className="font-bold truncate text-xs text-slate-800 dark:text-slate-200">KRU</div>
                    <div className="font-mono font-black text-sky-600 dark:text-sky-400 text-xs truncate">0800 500 20</div>
                  </div>
                </a>

                {/* 5. Inspektorati */}
                <a href="tel:038200650" className="p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 rounded-xl border border-slate-100 dark:border-white/5 flex flex-col items-start gap-1 transition-colors group">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-3 h-3" />
                  </div>
                  <div className="w-full min-w-0">
                    <div className="font-bold truncate text-xs text-slate-800 dark:text-slate-200">Inspektorati</div>
                    <div className="font-mono font-black text-slate-700 dark:text-slate-300 text-xs truncate">038 200 650</div>
                  </div>
                </a>

                {/* 6. Shërb. Publike */}
                <a href="tel:038200640" className="p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 rounded-xl border border-slate-100 dark:border-white/5 flex flex-col items-start gap-1 transition-colors group">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center shrink-0">
                    <Building2 className="w-3 h-3" />
                  </div>
                  <div className="w-full min-w-0">
                    <div className="font-bold truncate text-xs text-slate-800 dark:text-slate-200">{dt('Shërb. Publ.')}</div>
                    <div className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs truncate">038 200 640</div>
                  </div>
                </a>

                {/* 7. Mjedisi */}
                <a href="tel:080020089" className="p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-slate-700/80 rounded-xl border border-slate-100 dark:border-white/5 flex flex-col items-start gap-1 transition-colors group">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                    <Leaf className="w-3 h-3" />
                  </div>
                  <div className="w-full min-w-0">
                    <div className="font-bold truncate text-xs text-slate-800 dark:text-slate-200">Mjedisi</div>
                    <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs truncate">0800 200 89</div>
                  </div>
                </a>

                {/* 8. Ndihma Sociale */}
                <a href="tel:038234567" className="p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-purple-50 dark:hover:bg-slate-700/80 rounded-xl border border-slate-100 dark:border-white/5 flex flex-col items-start gap-1 transition-colors group">
                  <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                    <Heart className="w-3 h-3" />
                  </div>
                  <div className="w-full min-w-0">
                    <div className="font-bold truncate text-xs text-slate-800 dark:text-slate-200">{dt('Ndihma Soc.')}</div>
                    <div className="font-mono font-black text-rose-600 dark:text-rose-400 text-xs truncate">038 234 567</div>
                  </div>
                </a>

              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/5 mt-3 flex items-center justify-between">
              <Link to="/sherbimet" className="min-h-10 md:min-h-0 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                <span>{dt('Shërbimet komunale')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
              <Link to="/kontakt" className="min-h-10 md:min-h-0 text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1">
                <span>{dt('Të gjitha kontaktet')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

        </div>

        {/* 8. TRANSPARENCY & OPEN DATA BANNER (DARK NAVY) */}
        <div className="w-full bg-[#0b1a30] text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
              <Activity className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-black text-white title-serif tracking-tight">
                {dt('Transparencë, më shumë të dhëna, vendimmarrje më e mirë.')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl font-normal leading-relaxed">
                {dt('Raportet e aprovuara janë publike dhe shfaqen në regjistër, hartë dhe statistika.')}
              </p>
            </div>
          </div>

          <Link 
            to="/statistikat"
            className="px-6 py-3 bg-[#1e3a8a] hover:bg-blue-800 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition hover:scale-105 active:scale-95 shrink-0"
          >
            <span>{dt('Të dhënat e hapura')}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>

      {/* 9. OFFICIAL FOOTER (DARK NAVY #071322) */}
      <footer className="w-full bg-[#071322] border-t border-slate-800 text-white mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-[1.15fr_1.5fr_1fr] items-center gap-6 md:gap-10">
          
          <div className="flex items-center gap-3 justify-center md:justify-start">
            <BrandMark className="h-10 w-10" />
            <div className="flex flex-col">
              <span className="text-sm font-black text-white leading-tight">{dt('Zëri i Qytetarëve')}</span>
              <span className="text-xs text-slate-400">{dt('Platforma Qytetare & Komunale')}</span>
            </div>
          </div>

          {/* Center Links */}
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-slate-400" aria-label="Lidhjet e footer-it">
            <Link to="/rreth-projektit" className="hover:text-white transition-colors">
              {dt('Rreth Projektit')}
            </Link>
            <Link to="/komunat" className="hover:text-white transition-colors">
              {dt('38 Komunat')}
            </Link>
            <Link to="/sherbimet" className="hover:text-white transition-colors">
              {dt('Shërbimet')}
            </Link>
            <Link to="/projektet" className="hover:text-white transition-colors">
              {dt('Projektet')}
            </Link>
            <Link to="/kushtet-e-perdorimit" className="hover:text-white transition-colors">
              {dt('Kushtet e përdorimit')}
            </Link>
          </nav>

          {/* Right: Copyright */}
          <div className="text-xs text-slate-400 font-medium text-center md:text-right leading-relaxed">
            {dt('© 2026 Zëri i Qytetarëve. Të gjitha të drejtat janë të rezervuara.')}
          </div>

        </div>
      </footer>

      {/* REPORT DETAIL MODAL (WHEN CLICKING A REPORT ROW) */}
      {selectedReportId && (reports.find(r => r.id === selectedReportId) || reports[0]) && (
        <ReportDetailModal
          report={reports.find(r => r.id === selectedReportId) || reports[0]}
          onClose={() => setSelectedReportId(null)}
        />
      )}

    </div>
  );
}

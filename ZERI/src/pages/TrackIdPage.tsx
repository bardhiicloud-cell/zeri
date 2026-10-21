import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWithTimeout, isJsonResponse } from '../lib/timeouts';
import { apiReady } from '../lib/apiAvailability';
import { lookupDonationDirect } from '../lib/directSubmissions';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle, ArrowRight, BadgeCheck, Building2, Calendar, CheckCircle2, ChevronDown, ChevronUp, Clock3,
  Copy, FileSearch, Hourglass, Link2, Loader2, Lock, MapPin, MessageSquareText, Search, ShieldCheck, ShieldOff,
  Tag, WifiOff, XCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { statusLabel, statusMeta, TONE_CLASSES } from '../lib/reportStatus';
import { getGuestReportHistory } from '../lib/session';
import {
  buildJourney, lookupTrackingId, normalizeTrackingId, TrackLookupError, TRACKING_ID_PATTERN,
  type JourneyStep, type PublicTrackView,
} from '../lib/trackApi';
import { ReportAttachments } from '../components/reports/ReportAttachments';
import { PageHero } from '../components/layout/PageHero';
import CitizenCaseCard from '../components/reports/CitizenCaseCard';

import { dt } from '@/src/lib/dt';

const SQ_MONTHS = ['Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor', 'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'];

/** Deterministic Albanian date: browsers without the `sq` locale fall back to English months. */
function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = `${d.getDate()} ${SQ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return withTime ? `${day} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : day;
}

const DESCRIPTION_PREVIEW = 520;

/** Donations (DN-), health cases (HC-) and news tips (LJ-) share the Track-ID: the public sees the stage only. */
interface SectorStatus { kind: 'news' | 'donation' | 'health'; reference: string; stage: string; rejected: boolean; updatedAt: string | null; createdAt: string | null }
// Health cases carry two parts (HC-<time>-<random>); the old one-part pattern sent them to the report lookup.
const SECTOR_PREFIX = /^(LJ|DN|HC)-[A-Z0-9]{4,12}(-[A-Z0-9]{2,8})?$/;
const SECTOR_LABEL: Record<SectorStatus['kind'], string> = { news: 'Lajmi i dërguar', donation: 'Kërkesa për donacion', health: 'Rasti në regjistrin shëndetësor' };

function SectorCard({ status }: { status: SectorStatus }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900" aria-live="polite">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-600 dark:text-slate-400">{dt(SECTOR_LABEL[status.kind])}</p>
      <p className="mt-1 font-mono text-lg font-black text-slate-900 dark:text-white">{status.reference}</p>
      <p className={cn('mt-4 inline-block rounded-full px-4 py-1.5 text-sm font-black', status.rejected ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800')}>{dt(status.stage)}</p>
      <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
        {status.createdAt ? `${dt('Dërguar')}: ${formatDate(status.createdAt, true)}` : ''}{status.updatedAt ? ` · ${dt('Përditësuar')}: ${formatDate(status.updatedAt, true)}` : ''}
      </p>
      <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">{dt('Për siguri shfaqet vetëm faza; teksti dhe të dhënat e dërguesit nuk shfaqen publikisht.')}</p>
    </section>
  );
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; error: TrackLookupError }
  | { kind: 'found'; report: PublicTrackView }
  | { kind: 'sector'; status: SectorStatus };

export default function TrackIdPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState(searchParams.get('id') || '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const myReports = React.useMemo(() => getGuestReportHistory().slice(0, 8), []);

  const search = useCallback(async (value: string) => {
    const trackingId = normalizeTrackingId(value);
    if (!trackingId) {
      setFieldError(dt('Shkruani Track ID-në e raportimit.'));
      return;
    }
    if (SECTOR_PREFIX.test(trackingId)) {
      setFieldError(null);
      setInput(trackingId);
      setSearchParams({ id: trackingId }, { replace: true });
      abortRef.current?.abort();
      setPhase({ kind: 'loading' });
      try {
        // News, donations and health cases are read only by the server; say so at once when it is not there.
        if (!(await apiReady())) {
          // Donation records are public by rule, so their stage can be read directly.
          if (trackingId.startsWith('DN-')) {
            const found = await lookupDonationDirect(trackingId).catch(() => { throw new TrackLookupError('network', 'Kërkimi nuk u krye. Kontrolloni lidhjen dhe provoni përsëri.'); });
            if (!found) throw new TrackLookupError('not_found', 'Nuk u gjet asnjë dërgesë me këtë kod.');
            setPhase({ kind: 'sector', status: found });
            return;
          }
          // News tips and health cases are private: only the server may read them.
          throw new TrackLookupError('network', 'Kodi juaj është i ruajtur. Ndjekja e fazës së lajmeve dhe rasteve shëndetësore hapet kur serveri i platformës të jetë aktiv; provoni përsëri më vonë.');
        }
        const response = await fetchWithTimeout(`/api/v1/public/submission-status?ref=${encodeURIComponent(trackingId)}`, { cache: 'no-store' }, 20000);
        if (!isJsonResponse(response)) throw new TrackLookupError('network', 'Shërbimi i ndjekjes nuk është i arritshëm tani. Provoni përsëri pas pak.');
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new TrackLookupError(response.status === 404 ? 'not_found' : 'server', String((body as { error?: string }).error ?? 'Kërkimi nuk u krye.'));
        setPhase({ kind: 'sector', status: body as SectorStatus });
      } catch (error) {
        setPhase({ kind: 'error', error: error instanceof TrackLookupError ? error : new TrackLookupError('server', 'Kërkimi nuk u krye. Provoni përsëri.') });
      }
      return;
    }
    if (!TRACKING_ID_PATTERN.test(trackingId)) {
      setFieldError(dt('Track ID duhet të ketë 8 deri 40 shenja: shkronja, shifra ose viza (p.sh. ZQ-20260101-ABC123).'));
      return;
    }
    setFieldError(null);
    setInput(trackingId);
    setSearchParams({ id: trackingId }, { replace: true });
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: 'loading' });
    try {
      const report = await lookupTrackingId(trackingId, controller.signal);
      setPhase({ kind: 'found', report });
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return;
      setPhase({
        kind: 'error',
        error: error instanceof TrackLookupError ? error : new TrackLookupError('server', 'Kërkimi nuk u krye. Provoni përsëri.'),
      });
    }
  }, [setSearchParams]);

  useEffect(() => {
    const initialId = searchParams.get('id');
    if (initialId) void search(initialId);
    return () => abortRef.current?.abort();
    // Only the first render consumes the link; later searches come from the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = phase.kind === 'loading';

  return (
    <div className="page-shell min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHero
          eyebrow={dt('Gjurmimi i raportimit')}
          icon={FileSearch}
          title={dt('Ndiq raportimin tënd, hap pas hapi')}
          subtitle={dt('Shkruaj Track ID-në që more kur dërgove raportimin. Do të shohësh statusin aktual, përgjigjet zyrtare të institucionit dhe historinë e plotë të veprimeve.')}
        />

        <form
          onSubmit={event => { event.preventDefault(); void search(input); }}
          noValidate
          className="-mt-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-slate-900 sm:p-6"
        >
          <label htmlFor="track-id-input" className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-600 dark:text-slate-400">
            {dt('Track ID i raportimit')}
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-600 dark:text-slate-400" aria-hidden="true" />
              <input
                id="track-id-input"
                value={input}
                onChange={event => { setInput(event.target.value.toUpperCase()); if (fieldError) setFieldError(null); }}
                placeholder="ZQ-20260101-ABC123"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={48}
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? 'track-id-error' : 'track-id-help'}
                className={cn(
                  'h-14 w-full rounded-2xl border-2 bg-slate-50 pl-12 pr-4 font-mono text-base font-bold tracking-wide text-slate-900 outline-none transition focus:ring-4 dark:bg-slate-800 dark:text-white',
                  fieldError
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/15 dark:border-white/10',
                )}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-blue-700 px-8 text-sm font-black text-white shadow-lg shadow-blue-700/25 transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
              {loading ? dt('Duke kërkuar…') : dt('Kërko raportimin')}
            </button>
          </div>
          {fieldError ? (
            <p id="track-id-error" role="alert" className="mt-2.5 flex items-start gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {fieldError}
            </p>
          ) : (
            <p id="track-id-help" className="mt-2.5 text-xs text-slate-600 dark:text-slate-400">
              {dt('Track ID shfaqet në konfirmimin pas dërgimit të raportit dhe, nëse jeni kyçur, në njoftimet e llogarisë. Platforma nuk dërgon email konfirmimi.')}
            </p>
          )}

          {myReports.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/10">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">{dt('Raportimet e dërguara nga kjo pajisje')}</p>
              <div className="flex flex-wrap gap-2">
                {myReports.map(item => (
                  <button
                    key={item.trackingId}
                    type="button"
                    onClick={() => { setInput(item.trackingId); void search(item.trackingId); }}
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 font-mono text-xs font-bold text-blue-800 transition hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
                  >
                    {item.trackingId}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        <div ref={resultRef} className="scroll-mt-24" aria-live="polite">
          {phase.kind === 'idle' && <IdleState />}
          {phase.kind === 'loading' && <LoadingState />}
          {phase.kind === 'error' && <ErrorState error={phase.error} onRetry={() => void search(input)} />}
          {phase.kind === 'found' && <ReportView report={phase.report} />}
          {phase.kind === 'sector' && <SectorCard status={phase.status} />}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── states ───────────────────────── */

function IdleState() {
  const steps = [
    { icon: Copy, title: 'Kopjo Track ID', text: 'E gjen në konfirmimin e raportimit dhe në njoftimet e tua.' },
    { icon: Search, title: 'Kërko këtu', text: 'Shkruaje në fushën e kërkimit dhe shtyp “Kërko raportimin”.' },
    { icon: BadgeCheck, title: 'Ndiq rastin', text: 'Statusi, përgjigjet zyrtare dhe historia e plotë, të gjitha në një vend.' },
  ];
  return (
    <ol className="grid gap-4 md:grid-cols-3">
      {steps.map((step, index) => (
        <li key={step.title} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            <step.icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">{dt('Hapi')} {index + 1}</p>
          <h2 className="mt-1 text-base font-black text-slate-900 dark:text-white">{dt(step.title)}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{dt(step.text)}</p>
        </li>
      ))}
    </ol>
  );
}

function LoadingState() {
  return (
    <div role="status" aria-label={dt('Duke ngarkuar raportimin')} className="animate-pulse space-y-4">
      <div className="h-40 rounded-3xl bg-slate-200 dark:bg-slate-800" />
      <div className="h-24 rounded-3xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="h-72 rounded-3xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-72 rounded-3xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: TrackLookupError; onRetry: () => void }) {
  const config = {
    invalid: { icon: AlertTriangle, title: 'Track ID i pavlefshëm', tone: 'amber' },
    not_found: { icon: FileSearch, title: 'Nuk u gjet asnjë raportim', tone: 'rose' },
    rate_limited: { icon: Hourglass, title: 'Shumë kërkime', tone: 'amber' },
    network: { icon: WifiOff, title: 'Pa lidhje me serverin', tone: 'slate' },
    server: { icon: AlertTriangle, title: 'Kërkimi nuk u krye', tone: 'rose' },
  }[error.kind];
  const Icon = config.icon;
  const tones: Record<string, string> = {
    rose: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100',
    amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100',
    slate: 'border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white',
  };
  return (
    <div role="alert" className={cn('rounded-3xl border p-6 sm:p-8', tones[config.tone])}>
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/70 dark:bg-white/10"><Icon className="h-6 w-6" aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 className="text-lg font-black">{dt(config.title)}</h2>
          <p className="mt-1 text-sm leading-relaxed opacity-90">{error.message}</p>
          {error.kind === 'not_found' && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm opacity-90">
              <li>{dt('Kontrolloni nëse keni shkruar saktë shkronjat dhe vizat.')}</li>
              <li>{dt('Kopjojeni Track ID-në direkt nga konfirmimi për të shmangur gabimet.')}</li>
            </ul>
          )}
          {error.kind === 'rate_limited' && error.retryAfter ? (
            <p className="mt-2 text-sm font-bold">{dt('Provoni përsëri pas')} {Math.ceil(error.retryAfter / 60)} {dt('minutash.')}</p>
          ) : null}
          {(error.kind === 'network' || error.kind === 'server') && (
            <button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900">
              {dt('Provo përsëri')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── result ───────────────────────── */

function copy(text: string, success: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(success),
    () => toast.error(dt('Nuk u kopjua. Provoni përsëri.')),
  );
}

function ReportView({ report }: { report: PublicTrackView }) {
  const meta = statusMeta(report.status);
  const tone = TONE_CLASSES[meta.tone];
  const journey = buildJourney(report);
  const current = journey.find(step => step.state === 'current' || step.state === 'rejected') ?? journey[journey.length - 1];
  const link = `${window.location.origin}/trackid?id=${encodeURIComponent(report.trackingId)}`;

  return (
    <div className="space-y-6">
      {/* Identity + status */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">{dt('Track ID')}</span>
              <button
                type="button"
                onClick={() => copy(report.trackingId, dt('Track ID u kopjua.'))}
                className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-sm font-black text-slate-900 transition hover:border-blue-300 hover:text-blue-700 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                aria-label={dt('Kopjo Track ID')}
              >
                {report.trackingId} <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => copy(link, dt('Lidhja u kopjua.'))}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-slate-500 transition hover:text-blue-700 dark:text-slate-400"
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Kopjo lidhjen')}
              </button>
            </div>
            <h2 className="mt-3 font-serif text-2xl font-black leading-tight tracking-tight text-slate-950 dark:text-white sm:text-3xl">{report.title}</h2>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              {report.category && <Chip icon={Tag}>{report.category}</Chip>}
              {report.municipality && <Chip icon={MapPin}>{dt('Komuna e')} {report.municipality}</Chip>}
              {report.urgency && <Chip icon={AlertTriangle}>{dt('Urgjenca')}: {report.urgency}</Chip>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
            <span className={cn('inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black', tone.badge)}>
              <span className={cn('h-2 w-2 rounded-full', tone.dot)} aria-hidden="true" /> {statusLabel(report.status)}
            </span>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs lg:text-right">
              <dt className="font-bold text-slate-600 dark:text-slate-400">{dt('Dërguar')}</dt>
              <dd className="font-black text-slate-800 dark:text-slate-100">{formatDate(report.createdAt)}</dd>
              <dt className="font-bold text-slate-600 dark:text-slate-400">{dt('Përditësuar')}</dt>
              <dd className="font-black text-slate-800 dark:text-slate-100">{formatDate(report.lastUpdate, true)}</dd>
            </dl>
          </div>
        </div>

        <Journey steps={journey} current={current} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <CitizenCaseCard
            trackingId={report.trackingId}
            status={report.status}
            municipality={report.municipality}
            late={Boolean(report.institution.responseDueAt) && Date.parse(report.institution.responseDueAt as string) < Date.now() && !['Resolved', 'Closed', 'Rejected'].includes(report.status)}
          />
          <DescriptionCard report={report} />
          <ResolutionCard report={report} />
          <OfficialResponses report={report} />
          <History report={report} />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <InstitutionCard report={report} />
          <EvidenceCard report={report} />
          <PrivacyCard report={report} />
          <p className="px-1 text-center text-xs text-slate-600 dark:text-slate-400">
            {dt('Keni një problem tjetër?')}{' '}
            <Link to="/raporto" className="font-bold text-blue-700 hover:underline dark:text-blue-300">{dt('Raporto një problem')}</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}

function Chip({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
      <Icon className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" /> {children}
    </span>
  );
}

function Card({ title, icon: Icon, children, tone }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; tone?: string }) {
  return (
    <section className={cn('rounded-3xl border bg-white p-5 shadow-xs dark:bg-slate-900 sm:p-7', tone ?? 'border-slate-200 dark:border-white/10')}>
      <h3 className="mb-4 flex items-center gap-2.5 text-base font-black text-slate-950 dark:text-white">
        <Icon className="h-4.5 w-4.5 text-blue-700 dark:text-blue-300" /> {title}
      </h3>
      {children}
    </section>
  );
}

/* ───────────────────────── progress ───────────────────────── */

function Journey({ steps, current }: { steps: JourneyStep[]; current: JourneyStep }) {
  return (
    <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-5 dark:border-white/10 dark:bg-slate-800/30 sm:px-7">
      <p className="mb-4 text-xs font-bold text-slate-600 dark:text-slate-400">
        {dt('Faza aktuale')}: <span className="font-black text-slate-900 dark:text-white">{dt(current.label)}</span>
        {current.date ? <span> · {formatDate(current.date)}</span> : null}
      </p>
      <ol className="flex snap-x gap-3 overflow-x-auto pb-2 md:grid md:overflow-visible" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => {
          const done = step.state === 'done';
          const isCurrent = step.state === 'current';
          const rejected = step.state === 'rejected';
          return (
            <li key={step.id} className="min-w-[116px] flex-1 snap-start md:min-w-0" aria-current={isCurrent || rejected ? 'step' : undefined}>
              <div className="flex items-center">
                <span
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-xs font-black transition',
                    done && 'border-emerald-500 bg-emerald-500 text-white',
                    isCurrent && 'border-blue-600 bg-blue-600 text-white ring-4 ring-blue-600/20',
                    rejected && 'border-rose-600 bg-rose-600 text-white ring-4 ring-rose-600/20',
                    step.state === 'upcoming' && 'border-slate-300 bg-white text-slate-400 dark:border-white/20 dark:bg-slate-900',
                  )}
                >
                  {done ? <CheckCircle2 className="h-4.5 w-4.5" aria-hidden="true" /> : rejected ? <XCircle className="h-4.5 w-4.5" aria-hidden="true" /> : index + 1}
                </span>
                {index < steps.length - 1 && (
                  <span aria-hidden="true" className={cn('ml-2 h-0.5 flex-1 rounded-full', done ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-white/15')} />
                )}
              </div>
              <p className={cn('mt-2.5 pr-2 text-xs font-black leading-tight', step.state === 'upcoming' ? 'text-slate-400' : 'text-slate-900 dark:text-white')}>{dt(step.label)}</p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{step.date && step.state !== 'upcoming' ? formatDate(step.date) : step.state === 'upcoming' ? dt('Në pritje') : ''}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ───────────────────────── details ───────────────────────── */

function DescriptionCard({ report }: { report: PublicTrackView }) {
  const [expanded, setExpanded] = useState(false);
  const long = report.description.length > DESCRIPTION_PREVIEW;
  return (
    <Card title={dt('Përshkrimi i raportimit')} icon={MessageSquareText}>
      <div className="relative">
        <p className={cn(
          'whitespace-pre-wrap break-words text-[15px] leading-8 text-slate-700 dark:text-slate-300',
          long && !expanded && 'max-h-52 overflow-hidden',
        )}>
          {report.description}
        </p>
        {long && !expanded && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent dark:from-slate-900" />
        )}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          aria-expanded={expanded}
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-xs font-black text-blue-700 hover:text-blue-900 dark:text-blue-300"
        >
          {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
          {expanded ? dt('Shfaq më pak') : dt('Lexo përshkrimin e plotë')}
        </button>
      )}
      <dl className="mt-6 grid gap-3 border-t border-slate-100 pt-5 text-sm dark:border-white/10 sm:grid-cols-2">
        <Detail icon={MapPin} label={dt('Vendndodhja')} value={[report.address, report.municipality].filter(Boolean).join(', ') || dt('Nuk është dhënë')} />
        <Detail icon={Calendar} label={dt('Data e dërgimit')} value={formatDate(report.createdAt, true)} />
        <Detail icon={Tag} label={dt('Kategoria')} value={[report.category, report.topic].filter(Boolean).join(' · ') || '—'} />
        <Detail icon={Clock3} label={dt('Përditësimi i fundit')} value={formatDate(report.lastUpdate, true)} />
      </dl>
    </Card>
  );
}

function Detail({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
      <div className="min-w-0">
        <dt className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">{label}</dt>
        <dd className="mt-0.5 break-words font-bold text-slate-800 dark:text-slate-100">{value}</dd>
      </div>
    </div>
  );
}

function InstitutionCard({ report }: { report: PublicTrackView }) {
  const due = report.institution.responseDueAt ? new Date(report.institution.responseDueAt) : null;
  const finished = ['Resolved', 'Closed', 'Rejected'].includes(report.status);
  const late = due && !finished && due.getTime() < Date.now();
  return (
    <Card title={dt('Institucioni përgjegjës')} icon={Building2}>
      <p className="text-sm font-black text-slate-900 dark:text-white">{report.institution.name || dt('Në pritje të caktimit')}</p>
      {report.institution.office && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{dt('Zyra')}: {report.institution.office}</p>}
      {report.institution.level && <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{dt('Niveli')}: {report.institution.level}</p>}
      {due && (
        <div className={cn('mt-4 rounded-2xl border p-3.5 text-xs', late ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100' : 'border-blue-100 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100')}>
          <p className="font-black">{finished ? dt('Afati i përgjigjes') : late ? dt('Afati i përgjigjes ka kaluar') : dt('Afati i përgjigjes')}</p>
          <p className="mt-0.5">{formatDate(report.institution.responseDueAt, true)}</p>
        </div>
      )}
    </Card>
  );
}

function EvidenceCard({ report }: { report: PublicTrackView }) {
  const { evidence } = report;
  return (
    <Card title={dt('Dëshmitë e raportimit')} icon={ShieldCheck}>
      {evidence.published && evidence.items.length > 0 ? (
        <ReportAttachments media={evidence.items} title="" emptyText={dt('Pa dëshmi të bashkangjitura')} />
      ) : evidence.totalCount > 0 ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <Lock className="mb-1 h-4 w-4" aria-hidden="true" />
          {evidence.totalCount} {dt('dëshmi janë ngarkuar, por publikohen vetëm pasi raportimi të shqyrtohet nga një recensues.')}
        </p>
      ) : (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">{dt('Ky raportim nuk ka foto ose dokumente të bashkangjitura.')}</p>
      )}
    </Card>
  );
}

function PrivacyCard({ report }: { report: PublicTrackView }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      {report.isAnonymous ? <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-600 dark:text-slate-400" aria-hidden="true" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />}
      <div className="text-xs leading-relaxed">
        <p className="font-black text-slate-900 dark:text-white">{report.isAnonymous ? dt('Raportim anonim') : dt('Të dhënat e raportuesit janë private')}</p>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          {dt('Kjo faqe nuk shfaq emrin, kontaktin ose të dhëna të tjera personale të raportuesit, as shënimet e brendshme të stafit.')}
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────── resolution + responses + history ───────────────────────── */

function ResolutionCard({ report }: { report: PublicTrackView }) {
  const { resolution, rejection } = report;

  if (rejection) {
    return (
      <Card title={dt('Raportimi u refuzua')} icon={XCircle} tone="border-rose-200 dark:border-rose-900/60">
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {rejection.reason || dt('Nuk është publikuar arsye e detajuar për këtë vendim.')}
        </p>
        <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
          {rejection.institution ? `${rejection.institution} · ` : ''}{formatDate(rejection.date, true)}
        </p>
      </Card>
    );
  }
  if (resolution.state === 'none') return null;

  const verified = resolution.state === 'verified';
  const awaiting = resolution.state === 'awaiting_verification';
  const heading = verified ? dt('E zgjidhur dhe e verifikuar') : awaiting ? dt('E raportuar si e zgjidhur, në pritje të verifikimit') : dt('Raportimi u mbyll');

  return (
    <Card
      title={heading}
      icon={verified ? BadgeCheck : awaiting ? Hourglass : Lock}
      tone={verified ? 'border-emerald-200 dark:border-emerald-900/60' : awaiting ? 'border-amber-200 dark:border-amber-900/60' : undefined}
    >
      {awaiting && (
        <p className="mb-4 rounded-2xl bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          {dt('Zgjidhja është deklaruar nga institucioni dhe ende nuk është verifikuar në mënyrë të pavarur nga stafi i platformës.')}
        </p>
      )}
      {verified && (
        <p className="mb-4 rounded-2xl bg-emerald-50 p-3.5 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          {dt('Zgjidhja u verifikua nga stafi i platformës përpara mbylljes së rastit.')}
        </p>
      )}

      <div className="space-y-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
            {dt('Zgjidhja e deklaruar nga institucioni')}{resolution.resolvedBy ? ` · ${resolution.resolvedBy}` : ''}
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">
            {resolution.explanation || dt('Institucioni nuk ka publikuar shpjegim të detajuar për zgjidhjen.')}
          </p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{dt('Data e përfundimit')}: {formatDate(resolution.resolvedAt, true)}</p>
        </div>

        {resolution.evidenceUrl && (
          <figure>
            <a href={resolution.evidenceUrl} target="_blank" rel="noreferrer noopener">
              <img src={resolution.evidenceUrl} alt={dt('Dëshmia pas zgjidhjes')} loading="lazy" className="max-h-80 w-full rounded-2xl object-cover" />
            </a>
            <figcaption className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{dt('Foto e dorëzuar si dëshmi e zgjidhjes')}</figcaption>
          </figure>
        )}

        {resolution.verifiedAt && (
          <div className="border-t border-slate-100 pt-4 dark:border-white/10">
            <p className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">{dt('Verifikimi')}</p>
            {resolution.verificationNote && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">{resolution.verificationNote}</p>}
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{formatDate(resolution.verifiedAt, true)}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

function OfficialResponses({ report }: { report: PublicTrackView }) {
  const responses = [...report.officialResponses].reverse();
  return (
    <Card title={dt('Përgjigjet zyrtare')} icon={Building2}>
      {responses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center dark:border-white/15">
          <Hourglass className="mx-auto h-6 w-6 text-slate-300" aria-hidden="true" />
          <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">{dt('Ende nuk është publikuar asnjë përgjigje zyrtare.')}</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {dt('Kur institucioni përgjegjës të publikojë një përgjigje për këtë raportim, ajo do të shfaqet këtu me datën dhe përmbajtjen e plotë.')}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {responses.map(response => (
            <li key={response.id} className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                  <Building2 className="h-4 w-4 text-blue-700 dark:text-blue-300" aria-hidden="true" /> {response.institution}
                </span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{formatDate(response.date, true)}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 dark:text-slate-300">{response.text}</p>
              {response.attachments.length > 0 && (
                <div className="mt-3"><ReportAttachments media={response.attachments} title="" layout="row" /></div>
              )}
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">{dt('Statusi në atë moment')}: {statusLabel(response.status)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function History({ report }: { report: PublicTrackView }) {
  const events = report.timeline;
  const [showAll, setShowAll] = useState(false);
  const ordered = [...events].reverse();
  const visible = showAll ? ordered : ordered.slice(0, 6);
  return (
    <Card title={`${dt('Historiku i përditësimeve')} (${events.length})`} icon={Clock3}>
      <ol className="relative space-y-4 pl-8 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-0.5 before:rounded-full before:bg-slate-200 dark:before:bg-white/10">
        {visible.map((event, index) => {
          const meta = statusMeta(event.status);
          const tone = TONE_CLASSES[meta.tone];
          const latest = index === 0;
          const changed = event.previousStatus && event.previousStatus !== event.status;
          return (
            <li key={event.id} className="relative">
              <span aria-hidden="true" className={cn('absolute -left-8 top-1.5 h-6 w-6 rounded-full border-4 border-white dark:border-slate-900', tone.dot)} />
              <div className={cn('rounded-2xl border p-4', latest ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-white/10')}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-black', tone.badge)}>{statusLabel(event.status)}</span>
                    {latest && <span className="rounded-full bg-blue-700 px-2 py-0.5 text-xs font-black uppercase tracking-wide text-white">{dt('Më e fundit')}</span>}
                  </span>
                  <time dateTime={event.date} className="text-xs font-semibold text-slate-600 dark:text-slate-400">{formatDate(event.date, true)}</time>
                </div>
                {changed ? (
                  <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-400">{statusLabel(event.previousStatus)} <span aria-hidden="true">→</span> {statusLabel(event.status)}</p>
                ) : event.previousStatus ? (
                  <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-400">{dt('Përditësim brenda statusit')} “{statusLabel(event.status)}”</p>
                ) : null}
                <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-200">{event.institution}</p>
                {event.comment ? (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600 dark:text-slate-300">{event.comment}</p>
                ) : null}
                {event.attachments.length > 0 && (
                  <div className="mt-3"><ReportAttachments media={event.attachments} title="" layout="row" /></div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {ordered.length > 6 && (
        <button type="button" onClick={() => setShowAll(value => !value)} className="mt-4 inline-flex min-h-9 items-center gap-1.5 text-xs font-black text-blue-700 hover:text-blue-900 dark:text-blue-300">
          {showAll ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
          {showAll ? dt('Shfaq më pak') : `${dt('Shfaq të gjitha')} (${ordered.length})`}
        </button>
      )}
    </Card>
  );
}

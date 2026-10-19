import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
  AlertTriangle, Building2, CalendarDays, Check, CheckCircle2, ChevronRight, Copy, FileText, FolderOpen, HeartPulse,
  Loader2, MapPin, Megaphone, MessageSquareText, PlusCircle, Search, Tag, Wallet, X, XCircle,
} from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { auth, db } from '../lib/firebase';
import { cn } from '../lib/utils';
import { statusLabel } from '../lib/reportStatus';
import { getGuestReportHistory } from '../lib/session';
import { lookupTrackingId, normalizeTrackingId, TRACKING_ID_PATTERN, TrackLookupError, type PublicTrackView } from '../lib/trackApi';
import { lookupDonationDirect } from '../lib/directSubmissions';
import { apiReady } from '../lib/apiAvailability';
import { fetchWithTimeout, isJsonResponse } from '../lib/timeouts';

/**
 * "Raportet e mia" and "Gjej raportin me Track ID", one page.
 *
 * Citizens found two pages for one need and the tracking view was too detailed to read
 * on a phone. Here: a search box on top, the person's own list below, and one plain
 * status card that says in a sentence where the case is. The full history is one tap
 * away (/trackid/detaje) for whoever wants it.
 */

type Kind = 'report' | 'news' | 'donation' | 'health';

interface Row { trackingId: string; title: string; kind: Kind; status: string | null; municipality: string; createdAt: string | null }

const KIND: Record<Kind, { label: string; icon: typeof FileText; tone: string }> = {
  report: { label: 'Raportim', icon: FileText, tone: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  news: { label: 'Lajm', icon: Megaphone, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  donation: { label: 'Donacion', icon: Wallet, tone: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
  health: { label: 'Rast shëndetësor', icon: HeartPulse, tone: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
};

export function kindOf(trackingId: string): Kind {
  if (trackingId.startsWith('LJ-')) return 'news';
  if (trackingId.startsWith('DN-')) return 'donation';
  if (trackingId.startsWith('HC-')) return 'health';
  return 'report';
}

const SECTOR_PREFIX = /^(LJ|DN|HC)-[A-Z0-9]{4,12}(-[A-Z0-9]{2,8})?$/;

const SECTOR_STAGE: Record<string, string> = {
  submitted: 'Në pritje', pending: 'Në pritje', accepted: 'U pranua', in_editing: 'Në përpunim', published: 'U publikua',
  approved: 'U aprovua', verified: 'U verifikua', resolved: 'U zgjidh', rejected: 'U refuzua',
};

const SQ_MONTHS = ['Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor', 'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'];
function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = `${d.getDate()} ${SQ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return withTime ? `${day}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : day;
}

const toIso = (value: unknown): string | null => {
  if (!value) return null;
  const v = value as { toDate?: () => Date };
  const date = typeof v.toDate === 'function' ? v.toDate() : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/* ── The plain-language status ─────────────────────────────────────────────── */

type Step = 0 | 1 | 2 | 3;
interface Plain { step: Step; headline: string; detail: string; tone: 'wait' | 'go' | 'done' | 'no' }

export function plainStatus(status: string): Plain {
  switch (status) {
    case 'Approved': return { step: 1, headline: 'U pranua', detail: 'Raporti juaj u verifikua dhe po i dërgohet institucionit përgjegjës.', tone: 'go' };
    case 'Assigned': return { step: 2, headline: 'Te institucioni', detail: 'Institucioni përgjegjës e ka marrë rastin përsipër.', tone: 'go' };
    case 'In Progress': return { step: 2, headline: 'Po punohet', detail: 'Institucioni po punon për zgjidhjen e problemit.', tone: 'go' };
    case 'Overdue': return { step: 2, headline: 'Me vonesë', detail: 'Afati i përgjigjes ka kaluar. Platforma e ka shënuar dhe po e ndjek.', tone: 'wait' };
    case 'Resolved': return { step: 3, headline: 'U zgjidh', detail: 'Institucioni raportoi se problemi u zgjidh.', tone: 'done' };
    case 'Closed': return { step: 3, headline: 'U mbyll', detail: 'Rasti u verifikua dhe u mbyll.', tone: 'done' };
    case 'Rejected': return { step: 1, headline: 'Nuk u pranua', detail: 'Raporti nuk u pranua për publikim.', tone: 'no' };
    default: return { step: 0, headline: 'Në pritje', detail: 'Raporti u ruajt dhe po pret shqyrtimin nga stafi i platformës. Nuk është publik ende.', tone: 'wait' };
  }
}

const STEPS = ['Dërguar', 'Shqyrtuar', 'Në proces', 'Zgjidhur'];

const TONE = {
  wait: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30',
  go: 'bg-blue-50 text-blue-900 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-500/30',
  done: 'bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30',
  no: 'bg-rose-50 text-rose-900 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30',
} as const;

function CopyId({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { try { await navigator.clipboard.writeText(id); setDone(true); window.setTimeout(() => setDone(false), 1500); } catch { /* no clipboard */ } }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200"
      aria-label={dt('Kopjo Track ID')}
    >
      {id}{done ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
    </button>
  );
}

function StatusCard({ report, onClose }: { report: PublicTrackView; onClose: () => void }) {
  const plain = plainStatus(report.status);
  const response = report.officialResponses[0];
  const photos = report.evidence.published ? report.evidence.items.filter(m => m.type === 'image').slice(0, 4) : [];
  const rejected = report.status === 'Rejected';
  return (
    <section aria-live="polite" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="min-w-0">
          <CopyId id={report.trackingId} />
          <h2 className="mt-2 text-lg font-black leading-snug text-slate-900 dark:text-white">{report.title || dt('Raportim')}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="-mr-1 rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>
      </div>

      <div className={cn('mx-5 rounded-2xl p-4 ring-1', TONE[plain.tone])}>
        <p className="flex items-center gap-2 text-base font-black">
          {plain.tone === 'done' ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : plain.tone === 'no' ? <XCircle className="h-5 w-5" aria-hidden="true" /> : <span className="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />}
          {dt(plain.headline)}
        </p>
        <p className="mt-1 text-sm leading-relaxed opacity-90">{dt(plain.detail)}</p>
        {rejected && report.rejection?.reason && <p className="mt-2 text-sm"><b>{dt('Arsyeja')}:</b> {report.rejection.reason}</p>}
      </div>

      {!rejected && (
        <ol className="mx-5 mt-4 grid grid-cols-4 gap-1" aria-label={dt('Ecuria')}>
          {STEPS.map((label, i) => (
            <li key={label} className="text-center">
              <span className={cn('block h-1.5 rounded-full', i <= plain.step ? (plain.tone === 'done' ? 'bg-emerald-500' : 'bg-blue-600') : 'bg-slate-200 dark:bg-white/10')} />
              <span className={cn('mt-1.5 block text-[11px] font-bold', i <= plain.step ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400')}>{dt(label)}</span>
            </li>
          ))}
        </ol>
      )}

      <dl className="mx-5 mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 text-sm dark:border-white/10">
        <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /><div><dt className="text-[11px] text-slate-500">{dt('Komuna')}</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{report.municipality || '—'}</dd></div></div>
        <div className="flex items-start gap-2"><Tag className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /><div><dt className="text-[11px] text-slate-500">{dt('Kategoria')}</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{report.category || '—'}</dd></div></div>
        <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /><div><dt className="text-[11px] text-slate-500">{dt('Dërguar')}</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{formatDate(report.createdAt)}</dd></div></div>
        <div className="flex items-start gap-2"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /><div><dt className="text-[11px] text-slate-500">{dt('Institucioni')}</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{report.institution.name || '—'}</dd></div></div>
      </dl>

      {response && (
        <div className="mx-5 mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
          <p className="flex items-center gap-2 text-xs font-black text-slate-500"><MessageSquareText className="h-4 w-4" aria-hidden="true" />{dt('Përgjigjja e institucionit')} · {formatDate(response.date)}</p>
          <p className="mt-1.5 whitespace-pre-line text-sm text-slate-800 dark:text-slate-100">{response.text}</p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="mx-5 mt-4 grid grid-cols-4 gap-2">
          {photos.map(p => <a key={p.url} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="" loading="lazy" className="aspect-square w-full rounded-xl object-cover" /></a>)}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs dark:border-white/10">
        <span className="text-slate-500">{dt('Përditësuar')}: {formatDate(report.lastUpdate ?? report.createdAt, true)}</span>
        <Link to={`/trackid/detaje?id=${encodeURIComponent(report.trackingId)}`} className="inline-flex items-center gap-1 font-bold text-blue-700 dark:text-blue-300">
          {dt('Historia e plotë')}<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

interface SectorStatus { kind: 'news' | 'donation' | 'health'; reference: string; stage: string; rejected: boolean; updatedAt: string | null; createdAt: string | null }

function SectorCard({ status, onClose }: { status: SectorStatus; onClose: () => void }) {
  const kind = KIND[status.kind];
  return (
    <section aria-live="polite" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-500">{dt(kind.label)}</p>
          <div className="mt-1"><CopyId id={status.reference} /></div>
        </div>
        <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>
      </div>
      <p className={cn('mt-4 inline-block rounded-full px-4 py-1.5 text-sm font-black', status.rejected ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800')}>{dt(status.stage)}</p>
      <p className="mt-3 text-xs text-slate-500">{dt('Dërguar')}: {formatDate(status.createdAt, true)}{status.updatedAt ? ` · ${dt('Përditësuar')}: ${formatDate(status.updatedAt, true)}` : ''}</p>
    </section>
  );
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading'; id: string }
  | { kind: 'error'; message: string }
  | { kind: 'found'; report: PublicTrackView }
  | { kind: 'sector'; status: SectorStatus };

async function lookupSector(trackingId: string): Promise<SectorStatus> {
  if (!(await apiReady())) {
    if (trackingId.startsWith('DN-')) {
      const found = await lookupDonationDirect(trackingId).catch(() => { throw new TrackLookupError('network', 'Kërkimi nuk u krye. Kontrolloni lidhjen dhe provoni përsëri.'); });
      if (!found) throw new TrackLookupError('not_found', 'Nuk u gjet asnjë dërgesë me këtë kod.');
      return found;
    }
    throw new TrackLookupError('network', 'Kodi juaj është i ruajtur dhe redaksia e ka marrë. Faza e lajmeve dhe rasteve shëndetësore shfaqet këtu kur serveri i platformës të jetë aktiv.');
  }
  const response = await fetchWithTimeout(`/api/v1/public/submission-status?ref=${encodeURIComponent(trackingId)}`, { cache: 'no-store' }, 20000);
  if (!isJsonResponse(response)) throw new TrackLookupError('network', 'Shërbimi i ndjekjes nuk është i arritshëm tani. Provoni përsëri pas pak.');
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new TrackLookupError(response.status === 404 ? 'not_found' : 'server', String((body as { error?: string }).error ?? 'Kërkimi nuk u krye.'));
  return body as SectorStatus;
}

export default function ReportsHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState(searchParams.get('id') || '');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const resultRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [deviceRows] = useState<Row[]>(() => getGuestReportHistory().map(item => ({
    trackingId: item.trackingId,
    title: item.title || dt('Pa titull'),
    kind: kindOf(item.trackingId),
    status: item.status ?? null,
    municipality: item.municipality ?? '',
    createdAt: item.createdAt ?? null,
  })));
  const [accountRows, setAccountRows] = useState<Row[]>([]);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  useEffect(() => onAuthStateChanged(auth, user => setUid(user?.uid ?? null)), []);
  useEffect(() => {
    if (!uid) { setAccountRows([]); return; }
    const q = query(collection(db, 'reports'), where('authorId', '==', uid), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(
      q,
      snap => setAccountRows(snap.docs.flatMap(d => {
        const data = d.data() as Record<string, any>;
        const trackingId = typeof data.trackingId === 'string' ? data.trackingId : '';
        if (!trackingId) return [];
        return [{ trackingId, title: String(data.title ?? dt('Pa titull')), kind: 'report' as const, status: typeof data.status === 'string' ? data.status : null, municipality: String(data.location?.municipality ?? data.municipality ?? ''), createdAt: toIso(data.createdAt) }];
      })),
      () => setAccountRows([]),
    );
  }, [uid]);

  const rows = useMemo(() => {
    const byId = new Map<string, Row>();
    for (const row of [...deviceRows, ...accountRows]) byId.set(row.trackingId, { ...byId.get(row.trackingId), ...row });
    return [...byId.values()].sort((a, b) => (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0));
  }, [deviceRows, accountRows]);

  const search = useCallback(async (value: string) => {
    const trackingId = normalizeTrackingId(value);
    if (!trackingId) { setPhase({ kind: 'error', message: dt('Shkruani ose ngjitni Track ID-në.') }); return; }
    if (!SECTOR_PREFIX.test(trackingId) && !TRACKING_ID_PATTERN.test(trackingId)) {
      setPhase({ kind: 'error', message: dt('Kjo nuk duket si Track ID. Shembull: ZQ-20261016-AB12CD34.') });
      return;
    }
    setInput(trackingId);
    setSearchParams({ id: trackingId }, { replace: true });
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: 'loading', id: trackingId });
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
    try {
      if (SECTOR_PREFIX.test(trackingId)) setPhase({ kind: 'sector', status: await lookupSector(trackingId) });
      else setPhase({ kind: 'found', report: await lookupTrackingId(trackingId, controller.signal) });
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return;
      setPhase({ kind: 'error', message: error instanceof Error ? error.message : dt('Kërkimi nuk u krye. Provoni përsëri.') });
    }
  }, [setSearchParams]);

  useEffect(() => {
    const initial = searchParams.get('id');
    if (initial) void search(initial);
    return () => abortRef.current?.abort();
    // Only the link that opened the page is consumed here; later searches come from the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => { setPhase({ kind: 'idle' }); setSearchParams({}, { replace: true }); };
  const openId = phase.kind === 'found' ? phase.report.trackingId : phase.kind === 'sector' ? phase.status.reference : phase.kind === 'loading' ? phase.id : null;

  return (
    <div className="page-shell min-h-screen bg-slate-50 px-4 pb-32 pt-6 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-3xl bg-gradient-to-br from-[#0b1b3f] via-[#13306b] to-[#1d4ed8] p-5 text-white shadow-lg">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-blue-200"><FolderOpen className="h-4 w-4" aria-hidden="true" />{dt('Llogaria ime')}</p>
          <h1 className="mt-1.5 text-2xl font-black">{dt('Raportet e mia')}</h1>
          <p className="mt-1 text-sm text-blue-100">{dt('Ndiqni çdo raport me Track ID. Prekni një raport për të parë ku ndodhet.')}</p>
          <form onSubmit={e => { e.preventDefault(); void search(input); }} className="mt-4 flex gap-2" role="search">
            <label htmlFor="hub-track" className="sr-only">{dt('Track ID')}</label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="hub-track"
                value={input}
                onChange={e => setInput(e.target.value.toUpperCase())}
                placeholder="ZQ-20261016-..."
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={48}
                className="h-12 w-full rounded-2xl bg-white pl-10 pr-3 font-mono text-sm font-bold text-slate-900 outline-none ring-2 ring-transparent focus:ring-blue-300"
              />
            </div>
            <button type="submit" disabled={phase.kind === 'loading'} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white/15 px-4 text-sm font-black text-white ring-1 ring-white/30 hover:bg-white/25 disabled:opacity-60">
              {phase.kind === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
              <span className="hidden sm:inline">{dt('Kërko')}</span>
            </button>
          </form>
        </header>

        <div ref={resultRef} className="scroll-mt-24">
          {phase.kind === 'loading' && (
            <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white p-8 text-sm font-bold text-slate-500 dark:border-white/10 dark:bg-slate-900"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />{dt('Duke kërkuar…')}</div>
          )}
          {phase.kind === 'error' && (
            <p role="alert" className="flex items-start gap-2 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-800 dark:bg-rose-500/10 dark:text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{phase.message}</p>
          )}
          {phase.kind === 'found' && <StatusCard report={phase.report} onClose={close} />}
          {phase.kind === 'sector' && <SectorCard status={phase.status} onClose={close} />}
        </div>

        {rows.length === 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm dark:border-white/10 dark:bg-slate-900">
            <FolderOpen className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
            <h2 className="mt-3 text-base font-black text-slate-900 dark:text-white">{dt('Ende asnjë dërgesë nga kjo pajisje')}</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{dt('Kur dërgoni një raport, ai shfaqet këtu. Nga një pajisje tjetër, ngjitni Track ID-në më lart.')}</p>
            <Link to="/raporto" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white"><PlusCircle className="h-4 w-4" aria-hidden="true" />{dt('Raporto një problem')}</Link>
          </section>
        ) : (
          <section aria-label={dt('Dërgesat e mia')} className="space-y-2.5">
            <h2 className="px-1 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{dt('Dërgesat e mia')} · {rows.length}</h2>
            {rows.map(row => {
              const kind = KIND[row.kind];
              const label = row.status ? (row.kind === 'report' ? statusLabel(row.status) : SECTOR_STAGE[row.status] ?? row.status) : null;
              const plain = row.kind === 'report' && row.status ? plainStatus(row.status) : null;
              const active = openId === row.trackingId;
              return (
                <button
                  key={row.trackingId}
                  type="button"
                  onClick={() => void search(row.trackingId)}
                  aria-pressed={active}
                  className={cn('flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors dark:bg-slate-900', active ? 'border-blue-400 ring-2 ring-blue-100 dark:ring-blue-500/20' : 'border-slate-200 hover:border-blue-300 dark:border-white/10')}
                >
                  <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', kind.tone)}><kind.icon className="h-5 w-5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-900 dark:text-white">{row.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      <span className="font-mono font-bold">{row.trackingId}</span>{row.municipality ? ` · ${row.municipality}` : ''}{row.createdAt ? ` · ${formatDate(row.createdAt)}` : ''}
                    </span>
                  </span>
                  {label && (
                    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ring-1', plain ? TONE[plain.tone] : 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-white/10')}>
                      {dt(plain ? plain.headline : label)}
                    </span>
                  )}
                </button>
              );
            })}
            <p className="px-1 pt-1 text-xs text-slate-500">{dt('Lista ruhet në këtë pajisje dhe në llogarinë tuaj. Raportet "Në pritje" nuk janë publike derisa t’i aprovojë stafi.')}</p>
          </section>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle, ArrowRight, Ban, CheckCircle2, ChevronLeft, ChevronRight, Clock, Crop, Eye, History, ImagePlus, Inbox, Loader2, MapPin, Phone, RefreshCw, Search, SkipForward, Sparkles, Trash2, UserCheck, Users, X,
} from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../../lib/utils';
import {
  PRIORITY_LABEL, QUEUE_TEXT, REPORT_QUEUES, REPORT_STAGES, TASK_TEXT, stageIndex, queueOfStatus as queueOfStatusLocal,
  type PriorityLevel, type ReportQueue,
} from '../../../lib/reportWorkflow';
import {
  autoAssign, fetchCandidates, fetchQueue, fetchQueueCounts, fetchReportWorkflow, newRequestId, runReportAction, syncTasks,
  type ActionOption, type CandidateRow, type QueueRow, type ReportWorkflowDetail,
} from '../../../lib/workflowApi';
import { cropReportPhoto, removeReportPhoto } from '../../../lib/reportMediaApi';
import PhotoCropper from '../PhotoCropper';
import type { ReportAction } from '../../../lib/reportWorkflow';
import { directAdvance, directCounts, directQueue, directReject, directReopen, directReport, isApiUnavailableError } from '../../../lib/workflowDirect';
import { contactLine, useReportContact } from '../../../lib/useReportContact';
import { askConfirm, askReason } from '../../../lib/dialogs';
import { DeskHeader, DrawerShell, Kbd, REJECT_REASONS, ago, isTyping, useMediaQuery, type DeskNav } from './deskKit';

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

export function formatWhen(ms: number | null | undefined): string {
  if (!ms) return '—';
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('sq-AL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const PRIORITY_TONE: Record<PriorityLevel, string> = {
  urgent: 'bg-rose-600 text-white',
  high: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  normal: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  low: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
};

export function PriorityBadge({ level, score }: { level?: PriorityLevel | ''; score?: number }) {
  if (!level) return <span className="text-[11px] text-slate-400">—</span>;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', PRIORITY_TONE[level])} title={score !== undefined ? `${dt('Pikët e prioritetit')}: ${score}` : undefined}>
      {dt(PRIORITY_LABEL[level])}{score !== undefined ? <span className="opacity-70">· {score}</span> : null}
    </span>
  );
}

const QUEUE_TONE: Record<ReportQueue, string> = {
  pending: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  approved: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300',
  assigned: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  in_process: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  closed: 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200',
  rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
};

export function QueueBadge({ queue, overdue }: { queue: ReportQueue; overdue?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', QUEUE_TONE[queue])}>{dt(QUEUE_TEXT[queue].label)}</span>
      {overdue && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">{dt('Me vonesë')}</span>}
    </span>
  );
}

/** The six stages as a track, with where this report is. */
function StageTrack({ queue }: { queue: ReportQueue }) {
  const at = stageIndex(queue);
  if (queue === 'rejected') {
    return <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><Ban className="h-4 w-4" aria-hidden="true" />{dt('Refuzuar — jashtë gjashtë fazave të rrjedhës.')}</p>;
  }
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label={dt('Fazat e raportit')}>
      {REPORT_STAGES.map((stage, i) => (
        <li key={stage} className="flex items-center gap-1">
          <span
            aria-current={i === at ? 'step' : undefined}
            className={cn('rounded-lg px-2 py-1 text-[11px] font-bold',
              i < at ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                : i === at ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400')}
          >
            {i + 1}. {dt(QUEUE_TEXT[stage].label)}
          </span>
          {i < REPORT_STAGES.length - 1 && <ChevronRight className="h-3 w-3 text-slate-400" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* The panel                                                           */
/* ------------------------------------------------------------------ */

export interface ReportQueuesPanelProps {
  /** Heading shown above the queues; omit for an embedded panel. */
  title?: string;
  subtitle?: string;
  initialQueue?: ReportQueue;
  /** Report to open on mount (deep link). */
  openReportId?: string;
}

/**
 * The reports panel's seven queues, each loaded from the database with an exact
 * server count: Në pritje, U aprovua, I caktuar, Në proces, U zgjidh, U mbyll and,
 * apart from them, Të refuzuara. Opening a report shows its history, assignments,
 * tasks and only the actions this account may take.
 */
export default function ReportQueuesPanel({ title, subtitle, initialQueue = 'pending', openReportId }: ReportQueuesPanelProps) {
  const [queue, setQueue] = useState<ReportQueue>(initialQueue);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [overdue, setOverdue] = useState(0);
  const [role, setRole] = useState<string>('');
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(openReportId ?? null);
  const [syncing, setSyncing] = useState(false);
  const generation = useRef(0);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  const [startAction, setStartAction] = useState<ReportAction | undefined>(undefined);
  /**
   * Without the API server the panel reads and moves reports in the database itself
   * (lib/workflowDirect.ts), so an administrator is never left with an error and a
   * queue nobody can act on.
   */
  const [direct, setDirect] = useState(false);
  const directRef = useRef(false);
  const goDirect = useCallback(() => { directRef.current = true; setDirect(true); setRole((r: string) => r || 'superadmin'); }, []);

  const loadCounts = useCallback(async () => {
    try {
      if (directRef.current) { setCounts(await directCounts()); return; }
      const result = await fetchQueueCounts();
      setCounts(result.counts);
      setOverdue(result.overdue);
      setRole(result.role);
    } catch (e) {
      if (!directRef.current && isApiUnavailableError(e)) {
        goDirect();
        try { setCounts(await directCounts()); } catch { setCounts(null); }
        return;
      }
      setCounts(null);
      setError((e as Error).message);
    }
  }, [goDirect]);

  const loadQueue = useCallback(async (which: ReportQueue, quiet = false) => {
    const mine = ++generation.current;
    if (!quiet) setLoading(true);
    setError('');
    try {
      if (directRef.current) {
        const items = await directQueue(which);
        if (mine !== generation.current) return;
        setRows(items);
        setCursor(null);
        return;
      }
      const result = await fetchQueue(which);
      if (mine !== generation.current) return;
      setRows(Array.isArray(result?.items) ? result.items : []);
      setCursor(result?.nextCursor ?? null);
    } catch (e) {
      if (mine !== generation.current) return;
      if (!directRef.current && isApiUnavailableError(e)) {
        goDirect();
        try {
          const items = await directQueue(which);
          if (mine !== generation.current) return;
          setRows(items);
          setCursor(null);
          return;
        } catch (inner) {
          e = inner;
        }
      }
      setRows([]);
      setCursor(null);
      setError((e as Error).message);
    } finally {
      if (mine === generation.current) setLoading(false);
    }
  }, [goDirect]);

  const refresh = useCallback(() => { void loadCounts(); void loadQueue(queue, true); }, [loadCounts, loadQueue, queue]);

  useEffect(() => { void loadCounts(); }, [loadCounts]);
  useEffect(() => { void loadQueue(queue); }, [loadQueue, queue]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    const from = queue;
    setLoadingMore(true);
    try {
      const result = await fetchQueue(from, cursor);
      if (from !== queueRef.current) return;
      setRows(prev => [...prev, ...result.items.filter(item => !prev.some(p => p.id === item.id))]);
      setCursor(result.nextCursor);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, queue]);

  /* ---- The desk: filter what is loaded, step through it, move on after each decision ---- */
  const desk = useMediaQuery('(min-width: 1024px)');
  const [filters, setFilters] = useState({ q: '', sector: '', municipality: '', sort: 'priority' });
  const filtersActive = Boolean(filters.q || filters.sector || filters.municipality);
  const sectors = useMemo(() => [...new Set(rows.map(r => r.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [rows]);
  const municipalities = useMemo(() => [...new Set(rows.map(r => r.municipality).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [rows]);
  const shown = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const list = rows.filter(r =>
      (!filters.sector || r.sector === filters.sector)
      && (!filters.municipality || r.municipality === filters.municipality)
      && (!q || [r.title, r.trackingId, r.municipality, r.category, r.sector].some(v => String(v ?? '').toLowerCase().includes(q))));
    if (filters.sort === 'oldest') return [...list].sort((a, b) => a.createdAtMs - b.createdAtMs);
    if (filters.sort === 'newest') return [...list].sort((a, b) => b.createdAtMs - a.createdAtMs);
    return list;
  }, [rows, filters]);
  const index = openId ? shown.findIndex(r => r.id === openId) : -1;

  const go = useCallback((delta: number) => {
    const next = shown[index + delta];
    if (next) setOpenId(next.id);
    else if (delta > 0 && cursor) void loadMore();
  }, [shown, index, cursor, loadMore]);

  const nav: DeskNav | undefined = index >= 0
    ? { index, total: shown.length, more: Boolean(cursor), onPrev: index > 0 ? () => go(-1) : undefined, onNext: index < shown.length - 1 ? () => go(1) : undefined }
    : undefined;

  /** A decision took the report out of this queue: show the next one at once, so the work never stops. */
  const handleMoved = useCallback((id: string) => {
    const i = shown.findIndex(r => r.id === id);
    const next = shown[i + 1] ?? shown[i - 1] ?? null;
    setRows(prev => prev.filter(r => r.id !== id));
    setOpenId(next ? next.id : null);
    setStartAction(undefined);
    void loadCounts();
    if (cursor && shown.length - 1 <= 8) void loadMore();
  }, [shown, cursor, loadCounts, loadMore]);

  // On a laptop there is always a report open; the first one is chosen for you.
  useEffect(() => {
    if (desk && !openId && !loading && shown.length > 0) setOpenId(shown[0].id);
  }, [desk, openId, loading, shown]);
  // Close to the end of what is loaded: fetch the next page before the operator gets there.
  useEffect(() => {
    if (cursor && !loadingMore && index >= 0 && shown.length - index <= 5) void loadMore();
  }, [cursor, loadingMore, index, shown.length, loadMore]);
  // Keep the selected row in view while stepping with the keyboard.
  useEffect(() => {
    if (openId) document.getElementById(`desk-row-${openId}`)?.scrollIntoView({ block: 'nearest' });
  }, [openId]);

  const runSync = async () => {
    setSyncing(true);
    try {
      const result = await syncTasks();
      toast.success(`${dt('Detyrat u sinkronizuan')}: ${result.synced} ${dt('raporte')} (${result.scanned} ${dt('të kontrolluara')})`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  /** The row's own button: runs one-click steps at once, opens the drawer for the ones that need text or people. */
  const runQuick = async (row: QueueRow) => {
    if (!row.quick) return;
    if (direct) {
      setQuickBusy(row.id);
      try {
        const to = await directAdvance(row.id, row.status);
        toast.success(`${dt('Raporti kaloi në')} "${dt(QUEUE_TEXT[to].label)}".`);
        refresh();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setQuickBusy(null);
      }
      return;
    }
    if (!row.quick.oneClick) { setStartAction(row.quick.action); setOpenId(row.id); return; }
    setQuickBusy(row.id);
    try {
      const result = await runReportAction(row.id, { action: row.quick.action, expectedStatus: row.status, requestId: newRequestId() });
      toast.success(result.from !== result.to ? `${dt('Raporti kaloi në')} "${dt(result.label)}".` : dt('U ruajt.'));
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setQuickBusy(null);
    }
  };

  const visible = role === 'municipality' ? REPORT_QUEUES.filter(q => q !== 'pending' && q !== 'rejected') : REPORT_QUEUES;
  const isManager = !direct && (role === 'superadmin' || role === 'manager');

  const rejectDirect = async (row: QueueRow) => {
    const reason = await askReason(dt('Arsyeja e refuzimit (e sheh qytetari në Track ID):')) ?? '';
    if (!reason.trim()) return;
    setQuickBusy(row.id);
    try { await directReject(row.id, row.status, reason); toast.success(dt('Raporti u refuzua.')); refresh(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setQuickBusy(null); }
  };

  const reopenDirect = async (row: QueueRow) => {
    setQuickBusy(row.id);
    try { await directReopen(row.id, row.status); toast.success(dt('Raporti u rikthye në pritje.')); refresh(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setQuickBusy(null); }
  };

  return (
    <section className="space-y-4">
      {(title || subtitle) && (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h1 className="text-xl font-black text-slate-900 dark:text-white">{dt(title)}</h1>}
            {subtitle && <p className="text-sm text-slate-600 dark:text-slate-300 lg:hidden">{dt(subtitle)}</p>}
          </div>
          <div className="flex gap-2">
            {isManager && (
              <button type="button" onClick={() => void runSync()} disabled={syncing} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5" title={dt('Krijon detyrat që mungojnë për raportet ekzistuese')}>
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}{dt('Sinkronizo detyrat')}
              </button>
            )}
            <button type="button" onClick={refresh} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />{dt('Rifresko')}
            </button>
          </div>
        </header>
      )}

      {/* The six stages in order, then the rejected section apart from them. */}
      <div role="tablist" aria-label={dt('Radhët e raporteve')} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {visible.map(q => {
          const n = counts?.[q];
          const i = stageIndex(q);
          return (
            <button
              key={q}
              type="button"
              role="tab"
              aria-selected={queue === q}
              onClick={() => { setQueue(q); setOpenId(null); }}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-bold transition',
                q === 'rejected' && 'sm:ml-3',
                queue === q
                  ? q === 'rejected' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-white/5'
              )}
            >
              {i >= 0 && <span className="text-[11px] opacity-60">{i + 1}</span>}
              {dt(QUEUE_TEXT[q].label)}
              <span className={cn('rounded-full px-1.5 text-[11px]', queue === q ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/10')}>{n === undefined ? '…' : n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
        <p><span className="font-bold text-slate-800 dark:text-slate-100">{dt(QUEUE_TEXT[queue].label)}:</span> {dt(QUEUE_TEXT[queue].hint)} <span className="text-slate-500">({dt('Kush vepron')}: {dt(QUEUE_TEXT[queue].owner)})</span></p>
        {queue === 'in_process' && overdue > 0 && <span className="rounded-full bg-rose-600 px-2 py-0.5 font-bold text-white">{overdue} {dt('me afat të kaluar')}</span>}
      </div>

      {direct && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {dt('Serveri i platformës nuk po përgjigjet, prandaj paneli punon drejtpërdrejt me bazën e të dhënave: mund të aprovoni, kaloni fazën ose refuzoni. Caktimi i agjentëve dhe detyrat kthehen kur serveri lidhet.')}
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}
        </p>
      )}

      <div className={cn(desk && 'grid grid-cols-[minmax(300px,380px)_minmax(0,1fr)] items-start gap-4')}>
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2" role="search" aria-label={dt('Filtro raportet e ngarkuara')}>
            <label className="relative min-w-[10rem] flex-1">
              <span className="sr-only">{dt('Kërko në raportet e ngarkuara')}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input type="search" value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} placeholder={dt('Kërko titull, kod, komunë…')} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-white/10 dark:bg-slate-900" />
            </label>
            <select aria-label={dt('Sektori')} value={filters.sector} onChange={e => setFilters(f => ({ ...f, sector: e.target.value }))} className="min-h-10 max-w-[12rem] rounded-xl border border-slate-200 bg-white px-2 text-sm dark:border-white/10 dark:bg-slate-900">
              <option value="">{dt('Të gjithë sektorët')}</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label={dt('Komuna')} value={filters.municipality} onChange={e => setFilters(f => ({ ...f, municipality: e.target.value }))} className="min-h-10 max-w-[10rem] rounded-xl border border-slate-200 bg-white px-2 text-sm dark:border-white/10 dark:bg-slate-900">
              <option value="">{dt('Të gjitha komunat')}</option>
              {municipalities.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select aria-label={dt('Renditja')} value={filters.sort} onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))} className="min-h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm dark:border-white/10 dark:bg-slate-900">
              <option value="priority">{dt('Sipas prioritetit')}</option>
              <option value="oldest">{dt('Më të vjetrat')}</option>
              <option value="newest">{dt('Më të rejat')}</option>
            </select>
            {filtersActive && <button type="button" onClick={() => setFilters(f => ({ ...f, q: '', sector: '', municipality: '' }))} className="min-h-10 rounded-xl px-3 text-xs font-bold text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-white/5">{dt('Pastro filtrat')}</button>}
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" aria-label={dt('Duke ngarkuar')} /></div>
          ) : rows.length === 0 && !error ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 p-10 text-center dark:border-white/10">
              <Inbox className="h-8 w-8 text-slate-300" aria-hidden="true" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{dt('Radha është e pastër.')}</p>
              <p className="text-xs text-slate-500">{dt('Asnjë raport në këtë radhë.')}</p>
            </div>
          ) : shown.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-white/10">{dt('Asnjë raport i ngarkuar nuk përputhet me filtrat.')}</p>
          ) : (
            <>
              <ul className={cn('overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900', desk && 'max-h-[calc(100vh-17rem)] min-h-[20rem] overflow-y-auto')} aria-label={dt('Raportet')}>
                {shown.map(row => desk ? (
                  <li key={row.id} id={`desk-row-${row.id}`}>
                    <button
                      type="button"
                      onClick={() => setOpenId(row.id)}
                      aria-current={row.id === openId ? 'true' : undefined}
                      className={cn('flex w-full items-center gap-3 border-b border-l-4 border-slate-100 px-3 py-2.5 text-left transition dark:border-white/5',
                        row.id === openId ? 'border-l-sky-600 bg-sky-50 dark:bg-sky-500/10' : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-white/5')}
                    >
                      {row.thumb
                        ? <img src={row.thumb} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                        : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-white/5"><MapPin className="h-4 w-4" aria-hidden="true" /></span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{row.title || dt('Pa titull')}</span>
                        <span className="block truncate text-xs text-slate-500"><span className="font-mono">{row.trackingId || row.id.slice(0, 8)}</span> · {[row.municipality, row.sector].filter(Boolean).join(' · ')}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <PriorityBadge level={row.priorityLevel} />
                          {row.overdue && <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{dt('Me vonesë')}</span>}
                          <span className="text-[11px] text-slate-500">{ago(row.createdAtMs)}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                ) : (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3 last:border-0 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5 sm:flex-nowrap">
                    <button type="button" onClick={() => setOpenId(row.id)} className="flex min-w-0 basis-full items-center gap-3 text-left sm:flex-1 sm:basis-0">
                      {row.thumb
                        ? <img src={row.thumb} alt="" loading="lazy" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
                        : <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-white/5"><MapPin className="h-5 w-5" aria-hidden="true" /></span>}
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="break-words font-semibold text-slate-900 dark:text-white sm:truncate">{row.title || dt('Pa titull')}</span>
                          <PriorityBadge level={row.priorityLevel} />
                        </span>
                        <span className="block break-words text-xs text-slate-500 sm:truncate">
                          <span className="font-mono text-sky-700 dark:text-sky-300">{row.trackingId || row.id.slice(0, 8)}</span> · {[row.municipality, row.category, row.sector].filter(Boolean).join(' · ')}
                        </span>
                        <span className="block break-words text-xs text-slate-500 sm:truncate">
                          {row.assignedTo ? `${dt('Përgjegjës')}: ${row.assignedTo}` : dt('Pa përgjegjës')}
                          {row.approvedByName ? ` · ${dt('Aprovoi')}: ${row.approvedByName}` : ''}
                          {row.assigneeCount > 0 && row.queue === 'in_process' ? ` · ${row.submittedCount}/${row.assigneeCount} ${dt('dërguan zgjidhjen')}` : ''}
                        </span>
                        {row.rejectionReason && <span className="block break-words text-xs text-rose-600 sm:truncate">{row.rejectionReason}</span>}
                      </span>
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                      <QueueBadge queue={row.queue} overdue={row.overdue} />
                      <span className="text-[11px] text-slate-500">{dt('përditësuar')} {formatWhen(row.updatedAtMs || row.createdAtMs)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {row.quick && (
                        <button type="button" disabled={quickBusy === row.id} onClick={() => void runQuick(row)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                          {quickBusy === row.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                          {dt(row.quick.label)}
                        </button>
                      )}
                      {direct && row.queue !== 'rejected' && row.queue !== 'closed' && (
                        <button type="button" disabled={quickBusy === row.id} onClick={() => void rejectDirect(row)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-rose-200 px-3 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300">
                          <Ban className="h-4 w-4" aria-hidden="true" />{dt('Refuzo')}
                        </button>
                      )}
                      {direct && row.queue === 'rejected' && (
                        <button type="button" disabled={quickBusy === row.id} onClick={() => void reopenDirect(row)} className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200">{dt('Rikthe')}</button>
                      )}
                      <button type="button" onClick={() => setOpenId(row.id)} className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">{dt('Hap')}</button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{shown.length}{shown.length !== rows.length ? ` / ${rows.length}` : ''} {dt('të ngarkuara')}{counts?.[queue] !== undefined ? ` · ${counts[queue]} ${dt('gjithsej në radhë')}` : ''}</span>
                {cursor && (
                  <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-white/10 dark:text-slate-200">
                    {loadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{dt('Ngarko më shumë')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {desk && (
          <div className="sticky top-2 h-[calc(100vh-9rem)] min-h-[34rem]">
            {openId
              ? (direct
                ? <DirectReportDrawer key={openId} inline reportId={openId} nav={nav} onMoved={handleMoved} onClose={() => setOpenId(null)} onChanged={refresh} />
                : <ReportWorkflowDrawer key={openId} inline reportId={openId} nav={nav} onMoved={handleMoved} startAction={startAction} onClose={() => setOpenId(null)} onChanged={refresh} />)
              : (
                <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 dark:border-white/10">
                  <Inbox className="h-10 w-10" aria-hidden="true" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{loading ? dt('Duke ngarkuar') : rows.length === 0 ? dt('Nuk ka asgjë për shqyrtim këtu.') : dt('Zgjidhni një raport nga lista')}</p>
                </div>
              )}
          </div>
        )}
      </div>

      {!desk && openId && direct && <DirectReportDrawer reportId={openId} nav={nav} onMoved={handleMoved} onClose={() => setOpenId(null)} onChanged={refresh} />}
      {!desk && openId && !direct && <ReportWorkflowDrawer reportId={openId} nav={nav} onMoved={handleMoved} startAction={startAction} onClose={() => { setOpenId(null); setStartAction(undefined); }} onChanged={refresh} />}
    </section>
  );
}


/* ------------------------------------------------------------------ */
/* The report, read straight from the database (no API server)        */
/* ------------------------------------------------------------------ */

function DirectReportDrawer({ reportId, onClose, onChanged, inline, nav, onMoved }: {
  reportId: string; onClose: () => void; onChanged: () => void; inline?: boolean; nav?: DeskNav; onMoved?: (id: string) => void;
}) {
  const [report, setReport] = useState<Record<string, any> | null>(null);
  const contact = useReportContact(reportId);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await directReport(reportId);
      if (!r) setError(dt('Raporti nuk u gjet.'));
      setReport(r);
    } catch (e) { setError((e as Error).message); }
  }, [reportId]);
  useEffect(() => { void load(); }, [load]);

  const act = async (kind: 'advance' | 'reject') => {
    if (!report || busy) return;
    setBusy(true);
    try {
      if (kind === 'advance') {
        const to = await directAdvance(report.id, String(report.status));
        toast.success(`${dt('Raporti kaloi në')} "${dt(QUEUE_TEXT[to].label)}".`);
      } else {
        const reason = await askReason(dt('Arsyeja e refuzimit (e sheh qytetari në Track ID):')) ?? '';
        if (!reason.trim()) { setBusy(false); return; }
        await directReject(report.id, String(report.status), reason);
        toast.success(dt('Raporti u refuzua.'));
      }
      if (onMoved) { onMoved(report.id); return; }
      onChanged();
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const queue = report ? queueOfStatusLocal(String(report.status)) : 'pending';
  const actionable = Boolean(report) && queue !== 'closed' && queue !== 'rejected';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (!inline) onClose(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'j' || e.key === 'ArrowDown' || e.key === 'ArrowRight') { if (nav?.onNext) { e.preventDefault(); nav.onNext(); } }
      else if (k === 'k' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') { if (nav?.onPrev) { e.preventDefault(); nav.onPrev(); } }
      else if (k === 'a' && actionable) { e.preventDefault(); void act('advance'); }
      else if (k === 'r' && actionable) { e.preventDefault(); void act('reject'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const images: string[] = Array.isArray(report?.images) ? report!.images : [];
  const media: Array<{ url: string; type: string; name?: string }> = Array.isArray(report?.media) ? report!.media : [];

  return (
    <DrawerShell inline={inline} onClose={onClose}>
      <DeskHeader trackingId={report?.trackingId || reportId} title={report?.title || dt('Raporti')} nav={nav} onClose={onClose} inline={inline} />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
        {!report && !error && <div className="flex h-40 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" aria-label={dt('Duke ngarkuar')} /></div>}
        {report && (
          <>
            <StageTrack queue={queue} />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-slate-500">{dt('Komuna')}</dt><dd className="font-semibold">{report.location?.municipality || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">{dt('Kategoria')}</dt><dd className="font-semibold">{report.category || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">{dt('Urgjenca')}</dt><dd className="font-semibold">{report.urgency || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">{dt('Raportuesi')}</dt><dd className="font-semibold">{report.isAnonymous ? dt('Anonim') : contactLine(contact, report.authorName)}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-slate-500">{dt('Adresa')}</dt><dd className="font-semibold">{report.location?.address || '—'}</dd></div>
            </dl>
            <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-800 dark:bg-white/5 dark:text-slate-100">{report.description}</p>
            {(media.length > 0 || images.length > 0) && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(media.length ? media : images.map((url): { url: string; type: string; name?: string } => ({ url, type: 'image' }))).map(m => m.type === 'video'
                  ? <video key={m.url} src={m.url} controls className="aspect-video w-full rounded-lg bg-black" />
                  : m.type === 'image'
                    ? <a key={m.url} href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" className="aspect-square w-full rounded-lg object-cover" /></a>
                    : <a key={m.url} href={m.url} target="_blank" rel="noreferrer" className="rounded-lg border p-2 text-xs underline">{m.name || dt('Dokument')}</a>)}
              </div>
            )}
            {report.rejectionReason && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{dt('Arsyeja e refuzimit')}: {report.rejectionReason}</p>}
          </>
        )}
      </div>
      {report && actionable && (
        <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950">
          <button type="button" disabled={busy} onClick={() => void act('advance')} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            {queue === 'pending' ? dt('Aprovo raportin') : dt('Kalo në fazën tjetër')}<Kbd>A</Kbd>
          </button>
          <button type="button" disabled={busy} onClick={() => void act('reject')} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300">
            <Ban className="h-4 w-4" aria-hidden="true" />{dt('Refuzo')}<Kbd>R</Kbd>
          </button>
          {nav?.onNext && (
            <button type="button" onClick={nav.onNext} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
              <SkipForward className="h-4 w-4" aria-hidden="true" />{dt('Kalo')}<Kbd>→</Kbd>
            </button>
          )}
        </footer>
      )}
    </DrawerShell>
  );
}

/* ------------------------------------------------------------------ */
/* The report drawer                                                   */
/* ------------------------------------------------------------------ */

const ROLE_LABEL: Record<string, string> = { superadmin: 'Superadmin', manager: 'Menaxher', agent: 'Agjent', municipality: 'Komunë', monitor: 'Monitorim' };

export function ReportWorkflowDrawer({ reportId, onClose, onChanged, startAction, inline, nav, onMoved }: {
  reportId: string; onClose: () => void; onChanged?: () => void; startAction?: ReportAction;
  /** Rendered as a panel in the page (the laptop desk) instead of a window over it. */
  inline?: boolean;
  /** Present when the report is one of a list being worked through. */
  nav?: DeskNav;
  /** A decision moved the report out of the list: the list shows the next one and does not reload this one. */
  onMoved?: (id: string) => void;
}) {
  const [detail, setDetail] = useState<ReportWorkflowDetail | null>(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState<ActionOption | null>(null);
  const [cropping, setCropping] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const contact = useReportContact(reportId);

  const load = useCallback(async () => {
    setError('');
    try {
      setDetail(await fetchReportWorkflow(reportId));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [reportId]);

  useEffect(() => { setDetail(null); setActive(null); setPhotoIdx(0); void load(); }, [load]);
  // Opened from a row's own button: preselect that action once the detail is in.
  useEffect(() => {
    if (!detail || !startAction) return;
    const wanted = detail.actions.find(a => a.action === startAction);
    if (wanted) setActive(wanted);
  }, [detail, startAction]);

  const done = async (message: string, moved: boolean) => {
    toast.success(message);
    setActive(null);
    if (moved && onMoved) { onMoved(reportId); return; }
    await load();
    onChanged?.();
  };

  const r = detail?.report;
  const primary = detail?.actions.find(a => a.tone === 'primary');
  const danger = detail?.actions.find(a => a.tone === 'danger');
  const others = (detail?.actions ?? []).filter(a => a !== primary && a !== danger);
  const picks = (a: ActionOption) => a.action === 'assign' || a.action === 'update_assignees';

  /** One click for a step that needs no text and no people (approving); a form for the rest. */
  const choose = async (a: ActionOption) => {
    if (!r || busy) return;
    if (a.requires || picks(a) || a.tone === 'danger') { setActive(a); return; }
    setBusy(true);
    try {
      const result = await runReportAction(reportId, { action: a.action, expectedStatus: r.status, requestId: newRequestId() });
      const moved = result.from !== result.to;
      await done(moved ? `${dt('Raporti kaloi në')} "${dt(result.label)}".` : `${dt(a.label)}: ${dt('u ruajt')}.`, moved);
    } catch (e) {
      // Nothing changed on the server: the previous status stands.
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (lightbox) setLightbox(null); else if (active) setActive(null); else if (!inline && !cropping) onClose(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || lightbox || cropping || active) return;
      const k = e.key.toLowerCase();
      if (k === 'j' || e.key === 'ArrowDown' || e.key === 'ArrowRight') { if (nav?.onNext) { e.preventDefault(); nav.onNext(); } }
      else if (k === 'k' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') { if (nav?.onPrev) { e.preventDefault(); nav.onPrev(); } }
      else if (k === 'a' && primary) { e.preventDefault(); void choose(primary); }
      else if (k === 'r' && danger) { e.preventDefault(); void choose(danger); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const imageList = detail ? (detail.report.media.filter(m => m.type === 'image').length ? detail.report.media.filter(m => m.type === 'image') : detail.report.images.map(url => ({ url, type: 'image', name: '', edited: false }))) : [];
  const videoList = detail ? detail.report.media.filter(m => m.type === 'video') : [];
  const photo = imageList[Math.min(photoIdx, Math.max(0, imageList.length - 1))];

  const removePhoto = async (url: string) => {
    const reason = await askReason(dt('Pse hiqet kjo foto? (e lexon vetëm stafi, së paku 5 shenja)'), { minLength: 5 }) ?? '';
    if (reason.trim().length < 5) return;
    setPhotoBusy(true);
    try { await removeReportPhoto(reportId, url, reason.trim()); toast.success(dt('Fotoja u hoq (ruhet privatisht dhe zhbëhet).')); setPhotoIdx(0); await load(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setPhotoBusy(false); }
  };

  /** "Ndrysho foto": a replacement from this device; the original is kept privately by the server, like a crop. */
  const changePhoto = (url: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 6 * 1024 * 1024) { toast.error(dt('Fotoja është mbi 6 MB.')); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        setPhotoBusy(true);
        try { await cropReportPhoto(reportId, url, String(reader.result)); toast.success(dt('Fotoja u ndryshua.')); await load(); }
        catch (e) { toast.error((e as Error).message); }
        finally { setPhotoBusy(false); }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const photoTool = 'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold disabled:opacity-50';

  return (
    <>
      <DrawerShell inline={inline} onClose={onClose}>
        <DeskHeader
          trackingId={r?.trackingId || reportId}
          title={r?.title || dt('Raporti')}
          meta={r ? [r.municipality, r.address, r.category].filter(Boolean).join(' · ') : undefined}
          nav={nav}
          onClose={onClose}
          inline={inline}
        />

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          {error && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              <span>{error}</span>
              <button type="button" onClick={() => void load()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-rose-700 ring-1 ring-rose-200 dark:bg-transparent"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />{dt('Provo përsëri')}</button>
            </div>
          )}
          {!detail && !error && <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label={dt('Duke ngarkuar')} /></div>}

          {detail && r && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <QueueBadge queue={r.queue} overdue={r.overdue} />
                <PriorityBadge level={r.priorityLevel} score={r.priorityScore} />
                {r.sector && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">{r.sector}</span>}
                <span className="ml-auto text-[11px] text-slate-500">{ago(r.createdAtMs)} · {dt('Roli juaj')}: {dt(ROLE_LABEL[detail.role] ?? detail.role)}</span>
              </div>
              <StageTrack queue={r.queue} />
              {r.priorityReasons.length > 0 && <p className="text-[11px] text-slate-500">{dt('Pse ky prioritet')}: {r.priorityReasons.join(' · ')}</p>}

              {r.workflow && (r.workflow as { approvedByName?: string }).approvedByName && (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {dt('Aprovuar nga')} {(r.workflow as { approvedByName?: string }).approvedByName} · {formatWhen(Number((r.workflow as { approvedAtMs?: number }).approvedAtMs))}
                </p>
              )}

              {photo && (
                <section aria-label={dt('Fotot')} className="space-y-2">
                  <div className="relative overflow-hidden rounded-2xl bg-slate-950">
                    <button type="button" onClick={() => setLightbox(photo.url)} className="block w-full" aria-label={dt('Hape foton në ekran të plotë')}>
                      <img src={photo.url} alt={dt('Fotoja e raportit')} className="mx-auto max-h-[44vh] w-full object-contain" />
                    </button>
                    {photo.edited && <span className="absolute left-2 top-2 rounded bg-slate-900/80 px-1.5 py-0.5 text-[11px] font-bold text-white">{dt('E ndryshuar')}</span>}
                    {imageList.length > 1 && <span className="absolute right-2 top-2 rounded bg-slate-900/80 px-1.5 py-0.5 text-[11px] font-bold text-white">{Math.min(photoIdx, imageList.length - 1) + 1} / {imageList.length}</span>}
                  </div>
                  {imageList.length > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={dt('Zgjidh foton')}>
                      {imageList.map((p, i) => (
                        <button key={p.url} type="button" role="tab" aria-selected={i === photoIdx} onClick={() => setPhotoIdx(i)} className={cn('h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2', i === photoIdx ? 'ring-sky-600' : 'ring-transparent opacity-70 hover:opacity-100')}>
                          <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setLightbox(photo.url)} className={cn(photoTool, 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-100')}><Eye className="h-3.5 w-3.5" aria-hidden="true" />{dt('Shiko')}</button>
                    {r.canEditPhotos && (
                      <>
                        <button type="button" disabled={photoBusy} onClick={() => changePhoto(photo.url)} className={cn(photoTool, 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-100')}><ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />{dt('Ndrysho foto')}</button>
                        <button type="button" disabled={photoBusy} onClick={() => setCropping(photo.url)} className={cn(photoTool, 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-100')}><Crop className="h-3.5 w-3.5" aria-hidden="true" />{dt('Prit')}</button>
                        <button type="button" disabled={photoBusy} onClick={() => void removePhoto(photo.url)} className={cn(photoTool, 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300')}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{dt('Hiq')}</button>
                      </>
                    )}
                  </div>
                </section>
              )}
              {videoList.length > 0 && (
                <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
                  {videoList.map(v => <video key={v.url} src={v.url} controls preload="metadata" className="aspect-video w-full rounded-xl bg-black" />)}
                </div>
              )}

              {r.description && (
                <section aria-label={dt('Përshkrimi')} className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                  <h3 className="mb-1 text-[11px] font-black uppercase tracking-wider text-slate-400">{dt('Përshkrimi')}</h3>
                  <p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-slate-800 dark:text-slate-100">{r.description}</p>
                </section>
              )}

              <section aria-label={dt('Raportuesi')} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-slate-200 p-3 text-sm dark:border-white/10">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{dt('Raportuesi')}</p>
                  <p className="break-words font-semibold text-slate-900 dark:text-white">{r.authorName ? (contact?.name || r.authorName) : dt('Anonim')}</p>
                </div>
                {contact?.phone && r.authorName && (
                  <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white dark:bg-white dark:text-slate-900"><Phone className="h-3.5 w-3.5" aria-hidden="true" />{contact.phone}</a>
                )}
              </section>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-slate-200 p-3 text-sm dark:border-white/10">
                {([
                  ['Kategoria', [r.category, r.topicCategory].filter(Boolean).join(' · ')],
                  ['Urgjenca', r.urgency],
                  ['Terreni', r.terrain || r.zone],
                  ['Komuna', r.municipality],
                  ['Lagjja', r.neighborhood],
                  ['Adresa / lokacioni', r.address || (r.lat != null && r.lng != null ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}` : '')],
                  ['Ministria / institucioni', [r.responsibleInstitution, r.responsibleOffice].filter(Boolean).join(' · ')],
                  ['Niveli', r.responsibleLevel],
                  ['Dërguar', formatWhen(r.createdAtMs)],
                ] as const).map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{dt(label)}</dt>
                    <dd className="mt-0.5 break-words font-medium text-slate-800 dark:text-slate-100">{value || '—'}</dd>
                  </div>
                ))}
              </dl>
              {r.lat != null && r.lng != null && (
                <a href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=17/${r.lat}/${r.lng}`} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 text-xs font-bold text-sky-700 underline dark:text-sky-300"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{dt('Hape në hartë')}</a>
              )}
              {r.rejectionReason && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><b>{dt('Arsyeja e refuzimit')}:</b> {r.rejectionReason}</p>}
              {r.resolutionSummary && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"><b>{dt('Zgjidhja e verifikuar')}:</b> {r.resolutionSummary}</p>}
              {r.finalOutcome && <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-800 dark:bg-white/10 dark:text-slate-100"><b>{dt('Rezultati përfundimtar')}:</b> {r.finalOutcome}</p>}

              <details className="group rounded-2xl border border-slate-200 dark:border-white/10" open={detail.assignments.length > 0 && r.queue !== 'pending'}>
                <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-xs font-black uppercase tracking-wide text-slate-500"><Users className="h-4 w-4" aria-hidden="true" />{dt('Caktimet')} ({detail.assignments.length})</summary>
                <div className="px-3 pb-3">
                  {detail.assignments.length === 0 ? <p className="text-sm text-slate-500">{dt('Ende pa përgjegjës.')}</p> : (
                    <ul className="space-y-2">
                      {detail.assignments.map(a => (
                        <li key={a.key} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">{a.name || a.municipality || a.uid}</span>
                            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold',
                              a.status === 'active' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                                : a.status === 'submitted' ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300'
                                  : a.status === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-500 dark:bg-white/10')}>
                              {dt({ active: 'Në punë', submitted: 'Zgjidhja e dërguar', completed: 'E përfunduar', cancelled: 'E hequr' }[a.status])}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{a.type === 'municipality' ? dt('Komunë') : dt('Agjent')} · {dt('caktuar nga')} {a.assignedByName || '—'} · {formatWhen(a.assignedAtMs)}</p>
                          {a.note && <p className="mt-1 text-xs text-slate-700 dark:text-slate-300"><b>{dt('Zgjidhja')}:</b> {a.note}</p>}
                          {a.evidence && a.evidence.length > 0 && <p className="mt-1 flex flex-wrap gap-2 text-xs">{a.evidence.map(u => <a key={u} href={u} target="_blank" rel="noreferrer" className="text-sky-700 underline dark:text-sky-300">{dt('Dëshmi')}</a>)}</p>}
                          {a.returnReason && a.status === 'active' && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300"><b>{dt('U kthye')}:</b> {a.returnReason}</p>}
                          {a.cancelReason && a.status === 'cancelled' && <p className="mt-1 text-xs text-slate-500">{a.cancelReason}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>

              <details className="rounded-2xl border border-slate-200 dark:border-white/10">
                <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-xs font-black uppercase tracking-wide text-slate-500"><UserCheck className="h-4 w-4" aria-hidden="true" />{dt('Detyrat e lidhura')} ({detail.tasks.length})</summary>
                <div className="px-3 pb-3">
                  {detail.tasks.length === 0 ? <p className="text-sm text-slate-500">{dt('Asnjë detyrë.')}</p> : (
                    <ul className="space-y-1.5">
                      {detail.tasks.map(t => (
                        <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-white/5">
                          <span><b>{dt(TASK_TEXT[t.kind]?.label ?? t.kind)}</b> · {t.assigneeName || (t.needsAssignment ? dt('Kërkon caktim') : dt('Radha'))}</span>
                          <span className={cn('font-bold', t.status === 'open' ? 'text-amber-700 dark:text-amber-300' : t.status === 'done' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400')}>
                            {dt(t.status === 'open' ? 'E hapur' : t.status === 'done' ? 'E kryer' : 'E anuluar')}{t.status === 'open' && t.dueAtMs ? ` · ${dt('afati')} ${formatWhen(t.dueAtMs)}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>

              <details className="rounded-2xl border border-slate-200 dark:border-white/10">
                <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-xs font-black uppercase tracking-wide text-slate-500"><History className="h-4 w-4" aria-hidden="true" />{dt('Historiku i vendimeve')} ({detail.history.length || detail.timeline.length})</summary>
                <div className="px-3 pb-3">
                  {detail.history.length === 0 && detail.timeline.length === 0 ? <p className="text-sm text-slate-500">{dt('Pa histori ende.')}</p> : (
                    <ol className="space-y-2 border-l-2 border-slate-200 pl-4 dark:border-white/10">
                      {detail.history.map(h => (
                        <li key={h.id} className="text-sm">
                          <p className="font-semibold text-slate-900 dark:text-white">{dt(h.label)}{h.from !== h.to && <span className="font-normal text-slate-500"> · {dt(QUEUE_TEXT[h.from]?.label ?? h.fromStatus)} → {dt(QUEUE_TEXT[h.to]?.label ?? h.toStatus)}</span>}</p>
                          <p className="text-xs text-slate-500">{h.actorName || '—'}{h.workflowRole ? ` (${dt(ROLE_LABEL[h.workflowRole] ?? h.workflowRole)})` : ''}{h.onBehalf ? ` · ${dt('në emër të përgjegjësit')}` : ''} · {formatWhen(h.atMs)}</p>
                          {h.text && <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">{h.text}</p>}
                        </li>
                      ))}
                      {detail.history.length === 0 && detail.timeline.slice().reverse().map((t, i) => (
                        <li key={i} className="text-sm">
                          <p className="font-semibold text-slate-900 dark:text-white">{t.status}</p>
                          <p className="text-xs text-slate-500">{t.updatedBy} · {t.date ? new Date(t.date).toLocaleString('sq-AL') : ''}</p>
                          {t.comment && <p className="text-xs text-slate-700 dark:text-slate-300">{t.comment}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </details>
            </>
          )}
        </div>

        {/* The decision lives at the bottom, always in reach: approve and move on, refuse with a reason, or skip. */}
        {detail && r && (
          <footer aria-label={dt('Veprimet')} className="max-h-[65%] overflow-y-auto border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950">
            {active ? (
              <ActionForm
                key={active.action}
                reportId={reportId}
                option={active}
                status={r.status}
                currentAssignees={detail.assignments.filter(a => a.status === 'active' || a.status === 'submitted')}
                onCancel={() => setActive(null)}
                onDone={done}
              />
            ) : detail.actions.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-500">{detail.role === 'monitor' ? dt('Monitorimi sheh progresin dhe historikun; nuk ndryshon asgjë.') : dt('Në këtë fazë nuk keni veprim për të bërë. Kush vepron')}{detail.role !== 'monitor' && `: ${dt(QUEUE_TEXT[r.queue].owner)}.`}</p>
                {nav?.onNext && <button type="button" onClick={nav.onNext} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"><SkipForward className="h-4 w-4" aria-hidden="true" />{dt('Kalo')}<Kbd>→</Kbd></button>}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {primary && (
                  <button type="button" disabled={busy} onClick={() => void choose(primary)} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{dt(primary.label)}<Kbd>A</Kbd>
                  </button>
                )}
                {danger && (
                  <button type="button" disabled={busy} onClick={() => void choose(danger)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300">
                    <Ban className="h-4 w-4" aria-hidden="true" />{dt('Refuzo')}<Kbd>R</Kbd>
                  </button>
                )}
                {others.map(a => (
                  <button key={a.action} type="button" disabled={busy} onClick={() => void choose(a)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-800 hover:bg-slate-200 disabled:opacity-50 dark:bg-white/10 dark:text-slate-100">
                    {a.to && a.to !== r.queue ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{dt(a.label)}
                  </button>
                ))}
                {nav?.onNext && (
                  <button type="button" onClick={nav.onNext} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
                    <SkipForward className="h-4 w-4" aria-hidden="true" />{dt('Kalo')}<Kbd>→</Kbd>
                  </button>
                )}
              </div>
            )}
          </footer>
        )}
      </DrawerShell>
      {lightbox && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/85 p-4" role="dialog" aria-modal="true" aria-label={dt('Fotoja')} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          <button type="button" onClick={() => setLightbox(null)} aria-label={dt('Mbyll')} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
      )}
      {cropping && (
        <PhotoCropper reportId={reportId} url={cropping} onClose={() => setCropping(null)} onCropped={() => { setCropping(null); void load(); }} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* One action: its text, its people, and the request                   */
/* ------------------------------------------------------------------ */

function ActionForm({ reportId, option, status, currentAssignees, onCancel, onDone }: {
  reportId: string;
  option: ActionOption;
  status: string;
  currentAssignees: ReportWorkflowDetail['assignments'];
  onCancel: () => void;
  onDone: (message: string, moved: boolean) => Promise<void>;
}) {
  // One id per opened form: a double click or a retry is applied by the server once.
  const requestId = useMemo(() => newRequestId(), []);
  const [text, setText] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const picking = option.action === 'assign' || option.action === 'update_assignees';
  const [people, setPeople] = useState<CandidateRow[] | null>(null);
  const [municipality, setMunicipality] = useState<{ name: string; hasAccount: boolean } | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(currentAssignees.map(a => a.type === 'agent' ? `u:${a.uid}` : `m:${a.municipality}`)));

  useEffect(() => {
    if (!picking) return;
    fetchCandidates(reportId).then(result => { setPeople(result.people); setMunicipality(result.municipality); }).catch(e => setError((e as Error).message));
  }, [picking, reportId]);

  const toggle = (key: string) => setChosen(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const assignees = picking
        ? [...chosen].map(key => key.startsWith('u:') ? { type: 'agent' as const, uid: key.slice(2) } : { type: 'municipality' as const, municipality: key.slice(2) })
        : undefined;
      const field = option.requires?.field;
      const result = await runReportAction(reportId, {
        action: option.action,
        reason: field === 'reason' ? text.trim() : undefined,
        note: field === 'note' || !field ? text.trim() || undefined : undefined,
        assignees,
        evidence: option.action === 'submit_resolution' ? evidence.split(/\s+/).map(s => s.trim()).filter(Boolean) : undefined,
        expectedStatus: status,
        requestId,
      });
      await onDone(result.from !== result.to ? `${dt('Raporti kaloi në')} "${dt(result.label)}".` : `${dt(option.label)}: ${dt('u ruajt')}.`, result.from !== result.to);
    } catch (e) {
      // Nothing changed on the server: the previous status stands.
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runAuto = async () => {
    setBusy(true);
    setError('');
    try {
      await autoAssign(reportId, requestId);
      await onDone(dt('Sistemi caktoi përgjegjësin më të përshtatshëm.'), true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const needsText = Boolean(option.requires);
  const enough = !needsText || text.trim().length >= (option.requires?.min ?? 0);
  const valid = enough && (!picking || chosen.size > 0);

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
      <p className="text-sm font-bold text-slate-900 dark:text-white">{dt(option.label)}</p>

      {picking && (
        <div className="space-y-2">
          {option.action === 'assign' && (
            <button type="button" onClick={() => void runAuto()} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-600 px-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
              <Sparkles className="h-4 w-4" aria-hidden="true" />{dt('Cakto automatikisht (sistemi zgjedh)')}
            </button>
          )}
          <p className="text-xs text-slate-500">{dt('Ose zgjidhni një a më shumë përgjegjës. Secili merr caktimin e vet; raporti mbetet një.')}</p>
          {!people && !error && <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label={dt('Duke ngarkuar')} />}
          {municipality && (
            <label className={cn('flex items-center gap-2 rounded-lg border p-2 text-sm', municipality.hasAccount ? 'border-slate-200 dark:border-white/10' : 'border-dashed border-slate-200 opacity-60 dark:border-white/10')}>
              <input type="checkbox" disabled={!municipality.hasAccount} checked={chosen.has(`m:${municipality.name}`)} onChange={() => toggle(`m:${municipality.name}`)} />
              <span className="font-semibold">{dt('Komuna')} {municipality.name}</span>
              <span className="text-xs text-slate-500">{municipality.hasAccount ? dt('përgjegjësi institucional') : dt('pa llogari aktive — nuk mund të caktohet')}</span>
            </label>
          )}
          {people && (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {people.map(p => (
                <li key={p.uid}>
                  <label className={cn('flex items-start gap-2 rounded-lg border p-2 text-sm', p.eligible ? 'border-slate-200 dark:border-white/10' : 'border-dashed border-slate-200 opacity-60 dark:border-white/10')}>
                    <input type="checkbox" className="mt-1" disabled={!p.eligible && !chosen.has(`u:${p.uid}`)} checked={chosen.has(`u:${p.uid}`)} onChange={() => toggle(`u:${p.uid}`)} />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{p.name}</span> <span className="text-xs text-slate-500">({p.role}{p.department ? ` · ${p.department}` : ''}{p.municipality ? ` · ${p.municipality}` : ''})</span>
                      <span className="block text-xs text-slate-500">{p.eligible ? `${dt('Pikë')} ${p.score} · ${p.why.join(' · ')}` : `${dt('Jo i përshtatshëm')}: ${p.excluded}`}</span>
                    </span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{p.load}/{p.capacity}</span>
                  </label>
                </li>
              ))}
              {people.length === 0 && <li className="text-sm text-slate-500">{dt('Nuk ka staf me leje pune.')}</li>}
            </ul>
          )}
        </div>
      )}

      {needsText || !picking ? (
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">{dt(option.requires?.prompt ?? 'Shënim (opsional)')}{option.requires ? ` *` : ''}</span>
          {option.tone === 'danger' && option.requires?.field === 'reason' && (
            <span className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label={dt('Arsye të gatshme')}>
              {REJECT_REASONS.map(reason => (
                <button key={reason} type="button" onClick={() => setText(reason)} className={cn('min-h-9 rounded-lg px-2.5 text-xs font-bold ring-1', text === reason ? 'bg-rose-600 text-white ring-rose-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-white/10')}>{dt(reason)}</button>
              ))}
            </span>
          )}
          <textarea autoFocus={Boolean(option.requires)} value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={1200} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm dark:border-white/10 dark:bg-slate-900" />
          {option.requires && <span className="text-[11px] text-slate-500">{text.trim().length}/{option.requires.min}+ {dt('shenja')}</span>}
        </label>
      ) : null}

      {option.action === 'submit_resolution' && (
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">{dt('Dëshmi (lidhje foto ose dokumenti, një për rresht, opsionale)')}</span>
          <textarea value={evidence} onChange={e => setEvidence(e.target.value)} rows={2} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs dark:border-white/10 dark:bg-slate-900" placeholder="https://…" />
        </label>
      )}

      {error && <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 p-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void submit()} disabled={busy || !valid} className={cn('inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-40', option.tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900')}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{dt('Konfirmo')}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-bold text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-white/10">{dt('Anulo')}</button>
        <span className="flex items-center gap-1 text-[11px] text-slate-500"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{dt('Serveri e kontrollon dhe e regjistron në histori.')}</span>
      </div>
    </div>
  );
}

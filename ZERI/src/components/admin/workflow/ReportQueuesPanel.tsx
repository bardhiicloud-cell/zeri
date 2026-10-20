import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle, ArrowRight, Ban, CheckCircle2, ChevronRight, Clock, Crop, Eye, History, ImagePlus, Loader2, MapPin, RefreshCw, Sparkles, Trash2, UserCheck, Users, X,
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
import { askConfirm, askReason } from '../../../lib/dialogs';

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

  const loadQueue = useCallback(async (which: ReportQueue) => {
    const mine = ++generation.current;
    setLoading(true);
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

  const refresh = useCallback(() => { void loadCounts(); void loadQueue(queue); }, [loadCounts, loadQueue, queue]);

  useEffect(() => { void loadCounts(); }, [loadCounts]);
  useEffect(() => { void loadQueue(queue); }, [loadQueue, queue]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const result = await fetchQueue(queue, cursor);
      setRows(prev => [...prev, ...result.items.filter(item => !prev.some(p => p.id === item.id))]);
      setCursor(result.nextCursor);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

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
            {subtitle && <p className="text-sm text-slate-600 dark:text-slate-300">{dt(subtitle)}</p>}
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
              onClick={() => setQueue(q)}
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

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
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

      {loading ? (
        <div className="flex h-40 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" aria-label={dt('Duke ngarkuar')} /></div>
      ) : rows.length === 0 && !error ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">{dt('Asnjë raport në këtë radhë.')}</p>
      ) : (
        <>
          <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900" aria-label={dt('Raportet')}>
            {rows.map(row => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3 last:border-0 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5 sm:flex-nowrap">
                <button type="button" onClick={() => setOpenId(row.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  {row.thumb
                    ? <img src={row.thumb} alt="" loading="lazy" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
                    : <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-white/5"><MapPin className="h-5 w-5" aria-hidden="true" /></span>}
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-slate-900 dark:text-white">{row.title || dt('Pa titull')}</span>
                      <PriorityBadge level={row.priorityLevel} />
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      <span className="font-mono text-sky-700 dark:text-sky-300">{row.trackingId || row.id.slice(0, 8)}</span> · {[row.municipality, row.category, row.sector].filter(Boolean).join(' · ')}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {row.assignedTo ? `${dt('Përgjegjës')}: ${row.assignedTo}` : dt('Pa përgjegjës')}
                      {row.approvedByName ? ` · ${dt('Aprovoi')}: ${row.approvedByName}` : ''}
                      {row.assigneeCount > 0 && row.queue === 'in_process' ? ` · ${row.submittedCount}/${row.assigneeCount} ${dt('dërguan zgjidhjen')}` : ''}
                    </span>
                    {row.rejectionReason && <span className="block truncate text-xs text-rose-600">{row.rejectionReason}</span>}
                  </span>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <QueueBadge queue={row.queue} overdue={row.overdue} />
                  <span className="text-[11px] text-slate-500">{dt('përditësuar')} {formatWhen(row.updatedAtMs || row.createdAtMs)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {row.quick && (
                    <button
                      type="button"
                      disabled={quickBusy === row.id}
                      onClick={() => void runQuick(row)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
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

          {cursor && (
            <div className="flex justify-center">
              <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-white/10 dark:text-slate-200">
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{dt('Ngarko më shumë')}
              </button>
            </div>
          )}
        </>
      )}

      {openId && direct && <DirectReportDrawer reportId={openId} onClose={() => setOpenId(null)} onChanged={refresh} />}
      {openId && !direct && <ReportWorkflowDrawer reportId={openId} startAction={startAction} onClose={() => { setOpenId(null); setStartAction(undefined); }} onChanged={refresh} />}
    </section>
  );
}


/* ------------------------------------------------------------------ */
/* The report, read straight from the database (no API server)        */
/* ------------------------------------------------------------------ */

function DirectReportDrawer({ reportId, onClose, onChanged }: { reportId: string; onClose: () => void; onChanged: () => void }) {
  const [report, setReport] = useState<Record<string, any> | null>(null);
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const act = async (kind: 'advance' | 'reject') => {
    if (!report) return;
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
      onChanged();
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const queue = report ? queueOfStatusLocal(String(report.status)) : 'pending';
  const images: string[] = Array.isArray(report?.images) ? report!.images : [];
  const media: Array<{ url: string; type: string; name?: string }> = Array.isArray(report?.media) ? report!.media : [];

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/40 md:backdrop-blur-sm" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={dt('Raporti')} onClick={e => e.stopPropagation()} className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-white/10">
          <div className="min-w-0">
            <p className="font-mono text-xs text-sky-700 dark:text-sky-300">{report?.trackingId || reportId}</p>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{report?.title || dt('Raporti')}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
          {!report && !error && <div className="flex h-40 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" aria-label={dt('Duke ngarkuar')} /></div>}
          {report && (
            <>
              <StageTrack queue={queue} />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-slate-500">{dt('Komuna')}</dt><dd className="font-semibold">{report.location?.municipality || '—'}</dd></div>
                <div><dt className="text-xs text-slate-500">{dt('Kategoria')}</dt><dd className="font-semibold">{report.category || '—'}</dd></div>
                <div><dt className="text-xs text-slate-500">{dt('Urgjenca')}</dt><dd className="font-semibold">{report.urgency || '—'}</dd></div>
                <div><dt className="text-xs text-slate-500">{dt('Raportuesi')}</dt><dd className="font-semibold">{report.isAnonymous ? dt('Anonim') : (report.authorName || '—')}</dd></div>
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
        {report && queue !== 'closed' && queue !== 'rejected' && (
          <footer className="flex gap-2 border-t border-slate-200 p-4 dark:border-white/10">
            <button type="button" disabled={busy} onClick={() => void act('advance')} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              {queue === 'pending' ? dt('Aprovo raportin') : dt('Kalo në fazën tjetër')}
            </button>
            <button type="button" disabled={busy} onClick={() => void act('reject')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300">
              <Ban className="h-4 w-4" aria-hidden="true" />{dt('Refuzo')}
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The report drawer                                                   */
/* ------------------------------------------------------------------ */

const ROLE_LABEL: Record<string, string> = { superadmin: 'Superadmin', manager: 'Menaxher', agent: 'Agjent', municipality: 'Komunë', monitor: 'Monitorim' };

export function ReportWorkflowDrawer({ reportId, onClose, onChanged, startAction }: { reportId: string; onClose: () => void; onChanged?: () => void; startAction?: ReportAction }) {
  const [detail, setDetail] = useState<ReportWorkflowDetail | null>(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState<ActionOption | null>(null);
  const [cropping, setCropping] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setDetail(await fetchReportWorkflow(reportId));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [reportId]);

  useEffect(() => { setDetail(null); setActive(null); void load(); }, [load]);
  // Opened from a row's own button: preselect that action once the detail is in.
  useEffect(() => {
    if (!detail || !startAction) return;
    const wanted = detail.actions.find(a => a.action === startAction);
    if (wanted) setActive(wanted);
  }, [detail, startAction]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const done = async (message: string) => {
    toast.success(message);
    setActive(null);
    await load();
    onChanged?.();
  };

  const photoList = detail ? (detail.report.media.filter(m => m.type === 'image').length ? detail.report.media.filter(m => m.type === 'image') : detail.report.images.map(url => ({ url, type: 'image', name: '', edited: false }))) : [];

  const removePhoto = async (url: string) => {
    const reason = await askReason(dt('Pse hiqet kjo foto? (e lexon vetëm stafi, së paku 5 shenja)'), { minLength: 5 }) ?? '';
    if (reason.trim().length < 5) return;
    setPhotoBusy(true);
    try { await removeReportPhoto(reportId, url, reason.trim()); toast.success(dt('Fotoja u hoq (ruhet privatisht dhe zhbëhet).')); await load(); }
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

  const r = detail?.report;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/40 md:backdrop-blur-sm" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={dt('Raporti')}
        onClick={e => e.stopPropagation()}
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-white/10">
          <div className="min-w-0">
            <p className="font-mono text-xs text-slate-500">{r?.trackingId || reportId}</p>
            <h2 className="truncate text-lg font-black text-slate-900 dark:text-white">{r?.title || dt('Raporti')}</h2>
            {r && <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{[r.municipality, r.address, r.category].filter(Boolean).join(' · ')}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
          {!detail && !error && <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label={dt('Duke ngarkuar')} /></div>}

          {detail && r && (
            <>
              <StageTrack queue={r.queue} />

              <div className="flex flex-wrap items-center gap-2">
                <QueueBadge queue={r.queue} overdue={r.overdue} />
                <PriorityBadge level={r.priorityLevel} score={r.priorityScore} />
                {r.sector && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">{r.sector}</span>}
                <span className="text-[11px] text-slate-500">{dt('Roli juaj')}: {dt(ROLE_LABEL[detail.role] ?? detail.role)}</span>
              </div>

              {r.priorityReasons.length > 0 && (
                <p className="text-[11px] text-slate-500">{dt('Pse ky prioritet')}: {r.priorityReasons.join(' · ')}</p>
              )}

              {/* The next step lives in one place, at the top: approve and move on, or refuse with a reason. */}
              {detail.actions.length > 0 && !active && (
                <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
                  <span className="mr-auto text-xs font-bold text-slate-500">{dt('Hapi i radhës')}</span>
                  {detail.actions.filter(a => a.tone !== 'neutral').map(a => (
                    <button key={a.action} type="button" onClick={() => setActive(a)}
                      className={cn('inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-bold',
                        a.tone === 'danger' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-emerald-600 text-white hover:bg-emerald-700')}>
                      {a.tone === 'danger' ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                      {dt(a.tone === 'danger' ? 'Refuzo / fshij nga rrjedha' : a.label)}
                    </button>
                  ))}
                </div>
              )}

              {r.workflow && (r.workflow as { approvedByName?: string }).approvedByName && (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {dt('Aprovuar nga')} {(r.workflow as { approvedByName?: string }).approvedByName} · {formatWhen(Number((r.workflow as { approvedAtMs?: number }).approvedAtMs))}
                </p>
              )}

              {photoList.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={dt('Fotot')}>
                  {photoList.map(photo => (
                    <div key={photo.url} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5">
                      <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      {photo.edited && <span className="absolute left-1.5 top-1.5 rounded bg-slate-900/80 px-1.5 py-0.5 text-[11px] font-bold text-white">{dt('E ndryshuar')}</span>}
                      {/* Hover (or focus / tap) menu: View · Ndrysho foto · Prit · Hiq */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-950/55 p-2 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:bg-slate-950/35">
                        <button type="button" onClick={() => setLightbox(photo.url)} className="inline-flex w-28 items-center justify-center gap-1.5 rounded-md bg-slate-700/90 px-2 py-1 text-[11px] font-bold text-white hover:bg-slate-600"><Eye className="h-3.5 w-3.5" aria-hidden="true" />{dt('Shiko')}</button>
                        {detail.report.canEditPhotos && (
                          <>
                            <button type="button" disabled={photoBusy} onClick={() => changePhoto(photo.url)} className="inline-flex w-28 items-center justify-center gap-1.5 rounded-md bg-slate-700/90 px-2 py-1 text-[11px] font-bold text-white hover:bg-slate-600 disabled:opacity-50"><ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />{dt('Ndrysho foto')}</button>
                            <button type="button" disabled={photoBusy} onClick={() => setCropping(photo.url)} className="inline-flex w-28 items-center justify-center gap-1.5 rounded-md bg-slate-700/90 px-2 py-1 text-[11px] font-bold text-white hover:bg-slate-600 disabled:opacity-50"><Crop className="h-3.5 w-3.5" aria-hidden="true" />{dt('Prit')}</button>
                            <button type="button" disabled={photoBusy} onClick={() => void removePhoto(photo.url)} className="inline-flex w-28 items-center justify-center gap-1.5 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-rose-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{dt('Hiq')}</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
                {([
                  ['Kategoria', [r.category, r.topicCategory].filter(Boolean).join(' · ')],
                  ['Urgjenca', r.urgency],
                  ['Terreni', r.terrain || r.zone],
                  ['Komuna', r.municipality],
                  ['Lagjja', r.neighborhood],
                  ['Adresa / lokacioni', r.address || (r.lat != null && r.lng != null ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}` : '')],
                  ['Ministria / institucioni', [r.responsibleInstitution, r.responsibleOffice].filter(Boolean).join(' · ')],
                  ['Niveli', r.responsibleLevel],
                  ['Raportuesi', r.authorName || dt('Anonim')],
                  ['Dërguar', formatWhen(r.createdAtMs)],
                ] as const).map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{dt(label)}</dt>
                    <dd className="mt-0.5 break-words font-medium text-slate-800 dark:text-slate-100">{value || '—'}</dd>
                  </div>
                ))}
              </dl>
              {r.lat != null && r.lng != null && (
                <a href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=17/${r.lat}/${r.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 underline dark:text-sky-300"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{dt('Hape në hartë')}</a>
              )}
              {r.description && <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-200"><b className="block text-[11px] uppercase tracking-wider text-slate-400">{dt('Përshkrimi')}</b>{r.description}</p>}
              {r.rejectionReason && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><b>{dt('Arsyeja e refuzimit')}:</b> {r.rejectionReason}</p>}
              {r.resolutionSummary && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"><b>{dt('Zgjidhja e verifikuar')}:</b> {r.resolutionSummary}</p>}
              {r.finalOutcome && <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-800 dark:bg-white/10 dark:text-slate-100"><b>{dt('Rezultati përfundimtar')}:</b> {r.finalOutcome}</p>}

              {/* Actions this account may take, decided by the same rules the server enforces. */}
              <section aria-label={dt('Veprimet')} className="rounded-2xl border border-slate-200 p-3 dark:border-white/10">
                <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{dt('Veprimet tuaja')}</h3>
                {detail.actions.length === 0 ? (
                  <p className="text-sm text-slate-500">{detail.role === 'monitor' ? dt('Monitorimi sheh progresin dhe historikun; nuk ndryshon asgjë.') : dt('Në këtë fazë nuk keni veprim për të bërë. Kush vepron')}{detail.role !== 'monitor' && `: ${dt(QUEUE_TEXT[r.queue].owner)}.`}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {detail.actions.map(a => (
                      <button
                        key={a.action}
                        type="button"
                        onClick={() => setActive(a)}
                        className={cn('inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-bold',
                          a.tone === 'danger' ? 'bg-rose-600 text-white hover:bg-rose-700'
                            : a.tone === 'primary' ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900'
                              : 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-100')}
                      >
                        {a.tone === 'danger' ? <Ban className="h-4 w-4" aria-hidden="true" /> : a.to && a.to !== r.queue ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                        {dt(a.label)}
                      </button>
                    ))}
                  </div>
                )}
                {active && (
                  <ActionForm
                    key={active.action}
                    reportId={reportId}
                    option={active}
                    status={r.status}
                    currentAssignees={detail.assignments.filter(a => a.status === 'active' || a.status === 'submitted')}
                    onCancel={() => setActive(null)}
                    onDone={done}
                  />
                )}
              </section>

              <section aria-label={dt('Caktimet')}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500"><Users className="h-4 w-4" aria-hidden="true" />{dt('Caktimet')} ({detail.assignments.length})</h3>
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
              </section>

              <section aria-label={dt('Detyrat')}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500"><UserCheck className="h-4 w-4" aria-hidden="true" />{dt('Detyrat e lidhura')}</h3>
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
              </section>

              <section aria-label={dt('Historiku')}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500"><History className="h-4 w-4" aria-hidden="true" />{dt('Historiku i vendimeve')}</h3>
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
              </section>
            </>
          )}
        </div>
      </aside>
      {lightbox && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/85 p-4" onClick={e => { e.stopPropagation(); setLightbox(null); }}>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          <button type="button" onClick={() => setLightbox(null)} aria-label={dt('Mbyll')} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
      )}
      {cropping && (
        <PhotoCropper reportId={reportId} url={cropping} onClose={() => setCropping(null)} onCropped={() => { setCropping(null); void load(); }} />
      )}
    </div>
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
  onDone: (message: string) => Promise<void>;
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
      await onDone(result.from !== result.to ? `${dt('Raporti kaloi në')} "${dt(result.label)}".` : `${dt(option.label)}: ${dt('u ruajt')}.`);
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
      await onDone(dt('Sistemi caktoi përgjegjësin më të përshtatshëm.'));
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
          <textarea value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={1200} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm dark:border-white/10 dark:bg-slate-900" />
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

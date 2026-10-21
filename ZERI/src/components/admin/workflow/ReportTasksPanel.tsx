import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CalendarClock, ClipboardCheck, Inbox, Loader2, RefreshCw, UserPlus } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../../lib/utils';
import { useStore } from '../../../lib/store';
import { QUEUE_TEXT, TASK_TEXT, queueOfStatus, workflowRoleOf } from '../../../lib/reportWorkflow';
import { assignTask, fetchCandidates, fetchTasks, type CandidateRow, type TaskRow } from '../../../lib/workflowApi';
import { PriorityBadge, ReportWorkflowDrawer, formatWhen } from './ReportQueuesPanel';
import type { DeskNav } from './deskKit';

type View = 'mine' | 'queue' | 'all';

/**
 * "Detyrat": the work this person is expected to do, generated from real reports.
 * Nobody claims anything here. The system gives each task to an eligible person
 * (or to a queue a manager watches); opening a task opens its report, where the
 * report's own actions complete it.
 */
export default function ReportTasksPanel({ embedded = false }: { embedded?: boolean }) {
  const currentUser = useStore(s => s.currentUser);
  const role = workflowRoleOf(currentUser?.role ?? '', (currentUser?.permissions ?? []) as string[]);
  const isManager = role === 'superadmin' || role === 'manager';
  const views: Array<{ id: View; label: string }> = [
    { id: 'mine', label: role === 'municipality' ? 'Detyrat e komunës' : 'Detyrat e mia' },
    ...(isManager ? [{ id: 'queue' as View, label: 'Kërkojnë caktim' }] : []),
    ...(isManager || role === 'monitor' ? [{ id: 'all' as View, label: 'Të gjitha detyrat' }] : []),
  ];
  const [view, setView] = useState<View>(role === 'monitor' ? 'all' : 'mine');
  const [closed, setClosed] = useState(false);
  const [items, setItems] = useState<TaskRow[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openReport, setOpenReport] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<TaskRow | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const result = await fetchTasks(view, closed ? 'closed' : 'open');
      setItems(result.items);
      setNow(result.now);
    } catch (e) {
      setItems([]);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [view, closed]);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => {
    if (closed) return [{ id: 'closed', label: 'Të mbyllura', rows: items }];
    const late = items.filter(t => t.dueAtMs && t.dueAtMs < now);
    const soon = items.filter(t => t.dueAtMs && t.dueAtMs >= now && t.dueAtMs - now < 24 * 3_600_000);
    const rest = items.filter(t => !late.includes(t) && !soon.includes(t));
    return [
      { id: 'late', label: 'Me afat të kaluar', rows: late },
      { id: 'soon', label: 'Afati brenda 24 orëve', rows: soon },
      { id: 'rest', label: 'Të tjerat, sipas prioritetit', rows: rest },
    ].filter(g => g.rows.length > 0);
  }, [items, now, closed]);

  /** The order the operator sees, top to bottom: the next report is the next task down. */
  const flat = useMemo(() => groups.flatMap(g => g.rows).filter((t, i, all) => all.findIndex(o => o.reportId === t.reportId) === i), [groups]);
  const at = openReport ? flat.findIndex(t => t.reportId === openReport) : -1;
  const nav: DeskNav | undefined = at >= 0
    ? { index: at, total: flat.length, more: false, onPrev: at > 0 ? () => setOpenReport(flat[at - 1].reportId) : undefined, onNext: at < flat.length - 1 ? () => setOpenReport(flat[at + 1].reportId) : undefined }
    : undefined;
  const handleMoved = (reportId: string) => {
    const next = flat[at + 1] ?? flat[at - 1];
    setItems(prev => prev.filter(t => t.reportId !== reportId));
    setOpenReport(next && next.reportId !== reportId ? next.reportId : null);
    void load(true);
  };

  if (!role) return <p className="rounded-2xl bg-slate-100 p-4 text-sm dark:bg-white/5">{dt('Kjo llogari nuk ka detyra.')}</p>;

  return (
    <section className="space-y-4">
      {!embedded && (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900"><ClipboardCheck className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">{dt('Detyrat')}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">{dt('Çdo detyrë lidhet me një raport të vërtetë dhe me një hap të rrjedhës. Sistemi i cakton sipas lejeve, sektorit, komunës dhe ngarkesës — nuk merren përsipër.')}</p>
            </div>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200"><RefreshCw className="h-4 w-4" aria-hidden="true" />{dt('Rifresko')}</button>
        </header>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label={dt('Pamja e detyrave')} className="flex flex-wrap gap-1.5">
          {views.map(v => (
            <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}
              className={cn('min-h-10 rounded-xl px-3.5 text-sm font-bold', view === v.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-white/10')}>
              {dt(v.label)}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={closed} onChange={e => setClosed(e.target.checked)} />{dt('Shfaq të mbyllurat')}
        </label>
      </div>

      {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</p>}

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label={dt('Duke ngarkuar')} /></div>
      ) : items.length === 0 && !error ? (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 p-8 text-sm text-slate-500 dark:border-white/10"><Inbox className="h-5 w-5" aria-hidden="true" />{view === 'mine' ? dt('Nuk keni detyra të hapura.') : dt('Asnjë detyrë këtu.')}</p>
      ) : (
        groups.map(group => (
          <div key={group.id} className="space-y-2">
            <h2 className={cn('text-xs font-black uppercase tracking-wide', group.id === 'late' ? 'text-rose-600' : 'text-slate-500')}>{dt(group.label)} ({group.rows.length})</h2>
            <ul className="space-y-2">
              {group.rows.map(task => (
                <li key={task.id} className={cn('rounded-2xl border bg-white p-3 dark:bg-slate-900', group.id === 'late' ? 'border-rose-300 dark:border-rose-500/40' : 'border-slate-200 dark:border-white/10')}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <button type="button" onClick={() => setOpenReport(task.reportId)} className="min-w-0 flex-1 text-left">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-bold text-white dark:bg-white dark:text-slate-900">{dt(TASK_TEXT[task.kind]?.label ?? task.kind)}</span>
                        <PriorityBadge level={task.priorityLevel} score={task.priorityScore} />
                        <span className="text-[11px] text-slate-500">{dt(QUEUE_TEXT[queueOfStatus(task.reportStatus)].label)}</span>
                      </span>
                      <span className="mt-1 block break-words font-semibold text-slate-900 hover:underline dark:text-white">{task.title || dt('Pa titull')}</span>
                      <span className="block text-xs text-slate-500">{[task.trackingId, task.category, task.municipality, task.sector].filter(Boolean).join(' · ')}</span>
                      <span className="mt-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">{dt(task.doThis || TASK_TEXT[task.kind]?.doThis)}</span>
                    </button>
                    <div className="text-right text-xs text-slate-500">
                      <p className="flex items-center justify-end gap-1"><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />{task.status === 'open' ? formatWhen(task.dueAtMs) : formatWhen(task.closedAtMs)}</p>
                      <p>{task.assigneeName || (task.needsAssignment ? <span className="font-bold text-rose-600">{dt('Kërkon caktim')}</span> : dt('Radha'))}</p>
                      {isManager && task.status === 'open' && task.kind === 'review' && (
                        <button type="button" onClick={() => setAssigning(task)} className="mt-1 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200">
                          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />{task.assigneeUid ? dt('Ricakto') : dt('Cakto')}
                        </button>
                      )}
                      {isManager && task.status === 'open' && task.kind === 'assign' && (
                        <button type="button" onClick={() => setOpenReport(task.reportId)} className="mt-1 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2 py-1 font-bold text-white dark:bg-white dark:text-slate-900">
                          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />{dt('Cakto përgjegjësin')}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {assigning && <ReviewerPicker task={assigning} onClose={() => setAssigning(null)} onDone={() => { setAssigning(null); void load(); }} />}
      {openReport && <ReportWorkflowDrawer reportId={openReport} nav={nav} onMoved={handleMoved} onClose={() => setOpenReport(null)} onChanged={() => void load(true)} />}
    </section>
  );
}

function ReviewerPicker({ task, onClose, onDone }: { task: TaskRow; onClose: () => void; onDone: () => void }) {
  const [people, setPeople] = useState<CandidateRow[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchCandidates(task.reportId, 'review').then(r => setPeople(r.people)).catch(e => setError((e as Error).message));
  }, [task.reportId]);

  const pick = async (uid: string) => {
    setBusy(true);
    setError('');
    try {
      await assignTask(task.id, uid);
      toast.success(dt('Shqyrtuesi u caktua.'));
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={dt('Cakto shqyrtuesin')} onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-950">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">{dt('Cakto shqyrtuesin')}</h2>
        <p className="mb-3 text-xs text-slate-500">{task.title}</p>
        {error && <p role="alert" className="mb-2 rounded-lg bg-rose-50 p-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
        {!people ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label={dt('Duke ngarkuar')} /> : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {people.map(p => (
              <li key={p.uid}>
                <button type="button" disabled={busy || !p.eligible} onClick={() => void pick(p.uid)} className="flex w-full items-start justify-between gap-2 rounded-lg border border-slate-200 p-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5">
                  <span><b>{p.name}</b> <span className="text-xs text-slate-500">({p.role})</span><span className="block text-xs text-slate-500">{p.eligible ? p.why.join(' · ') : p.excluded}</span></span>
                  <span className="text-xs font-bold">{p.load}/{p.capacity}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={onClose} className="mt-3 min-h-10 rounded-xl px-4 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10">{dt('Mbyll')}</button>
      </div>
    </div>
  );
}

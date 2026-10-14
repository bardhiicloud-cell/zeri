import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../../lib/utils';
import { WORKFLOWS } from '../../../lib/workflow/definitions';
import {
  KIND_LABELS, PRIORITY_LABELS, describeDue, workApi,
  type AvailableAction, type WorkDetail, type WorkerProfile,
} from '../../../lib/workApi';

/**
 * One work item: what it is, who holds it, everything that happened to it, and the moves
 * this person may make. The list of moves comes from the server (`actions`), which has
 * already applied the role, the state and the ownership rules; the form only collects what
 * a chosen move says it needs (a note, a reason, evidence, a person) and the server checks
 * it again before anything is written.
 */
export interface ItemDrawerProps {
  itemId: string;
  canManage: boolean;
  onClose: () => void;
  /** Called after any change so the list behind the drawer can refresh. */
  onChanged: () => void;
}

const EVENT_LABELS: Record<string, string> = {
  created: 'Krijuar', transition: 'Ndryshim', auto_assign: 'Caktim automatik', escalation: 'Eskalim', exception: 'Pa person të përshtatshëm',
};

const ACTION_FALLBACKS: Record<string, string> = {
  no_eligible_worker: 'Asnjë person i përshtatshëm: detyra mbeti në radhë për menaxherët',
  notify_supervisor: 'Njoftim për mbikëqyrësin', raise_priority: 'Prioriteti u rrit', notify_managers: 'Njoftim për menaxherët',
  needs_manager_attention: 'Kërkon vëmendjen e menaxherit', alert_supervisor: 'Alarm: pa caktuar shumë gjatë',
};

/** The label a person knows an action by, even after the item moved on and the server no longer offers it. */
function actionLabel(kind: keyof typeof WORKFLOWS, action: string): string {
  return WORKFLOWS[kind]?.transitions.find(t => t.action === action)?.label ?? ACTION_FALLBACKS[action] ?? action;
}

const STAGE_TONE = (waiting?: boolean, terminal?: boolean) =>
  terminal ? 'bg-slate-200 text-slate-700' : waiting ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';

export default function WorkItemDrawer({ itemId, canManage, onClose, onChanged }: ItemDrawerProps) {
  const [detail, setDetail] = useState<WorkDetail | null>(null);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState<AvailableAction | null>(null);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setError('');
    try { setDetail(await workApi.detail(itemId)); } catch (e) { setError((e as Error).message); }
  }, [itemId]);

  useEffect(() => { setDetail(null); setChosen(null); void load(); }, [load]);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const autoAssign = async () => {
    setBusy(true);
    try {
      const result = await workApi.autoAssign(itemId);
      if (result.outcome === 'assigned') toast.success('U caktua automatikisht.');
      else toast('Asnjë person nuk i plotëson kushtet; detyra mbetet në radhë dhe iu shfaq menaxherëve.', { icon: '⚠️' });
      await load(); onChanged();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const item = detail?.item;
  const stateInfo = item && detail ? detail.workflow.states[item.status] : undefined;
  const due = item ? describeDue(item.open ? item.dueAtMs : null, Date.now()) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside
        role="dialog" aria-modal="true" aria-label="Detajet e detyrës"
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item ? KIND_LABELS[item.kind] : 'Detyra'}</p>
            <h2 className="truncate text-lg font-black text-slate-900">{item?.title ?? 'Duke ngarkuar…'}</h2>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Mbyll" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </header>

        {error && <p role="alert" className="m-5 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{error} <button className="underline" onClick={() => void load()}>Provo përsëri</button></p>}
        {!detail && !error && <div className="flex flex-1 items-center justify-center p-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>}

        {detail && item && (
          <div className="space-y-5 p-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="Statusi"><span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', STAGE_TONE(stateInfo?.waiting, stateInfo?.terminal))}>{stateInfo?.label ?? item.status}</span></Field>
              <Field label="Prioriteti">{PRIORITY_LABELS[item.priority]}{item.escalationLevel > 0 && <span className="ml-2 rounded bg-rose-100 px-1.5 text-xs font-bold text-rose-700">Eskaluar · niveli {item.escalationLevel}</span>}</Field>
              <Field label="I caktuar te">{item.assigneeName || item.assigneeUid || <span className="text-amber-700">Askush (në radhë)</span>}</Field>
              <Field label="Afati"><span className={due?.overdue ? 'font-bold text-rose-700' : ''}>{due?.text}</span></Field>
              <Field label="Komuna">{item.municipality || '—'}</Field>
              <Field label="Departamenti">{item.department || '—'}</Field>
              <Field label="Pesha">{item.weight}</Field>
              <Field label="Krijuar nga">{item.createdByName || '—'}</Field>
              {(item.reworkCount > 0 || item.reopenCount > 0) && <Field label="Kthyer / rihapur">{item.reworkCount} / {item.reopenCount}</Field>}
              {(item.requiresReview || item.requiresEvidence) && <Field label="Kërkesa">{[item.requiresReview && 'shqyrtim', item.requiresEvidence && 'dëshmi'].filter(Boolean).join(', ')}</Field>}
            </dl>
            {item.description && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{item.description}</p>}
            {item.requiredSkills.length > 0 && <p className="text-xs text-slate-500">Aftësi të kërkuara: {item.requiredSkills.join(', ')}</p>}

            <section aria-label="Veprimet">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Veprimet e disponueshme</h3>
              {chosen ? (
                <ActionForm
                  action={chosen} version={item.version} itemId={itemId} canManage={canManage}
                  onCancel={() => setChosen(null)}
                  onDone={async () => { setChosen(null); await load(); onChanged(); }}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {detail.actions.map(action => (
                    <button key={action.action} onClick={() => setChosen(action)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                      {action.label}
                    </button>
                  ))}
                  {canManage && !item.assigneeUid && item.open && (
                    <button disabled={busy} onClick={() => void autoAssign()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                      {busy ? 'Duke caktuar…' : 'Cakto automatikisht'}
                    </button>
                  )}
                  {detail.actions.length === 0 && !(canManage && !item.assigneeUid && item.open) && <p className="text-sm text-slate-500">Nuk keni veprime në këtë gjendje.</p>}
                </div>
              )}
            </section>

            <section aria-label="Historiku">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Historiku ({detail.events.length})</h3>
              <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
                {[...detail.events].reverse().map(event => (
                  <li key={event.id} className="text-sm">
                    <p className="font-semibold text-slate-800">
                      {event.action ? actionLabel(item.kind, event.action) : EVENT_LABELS[event.type] ?? event.type}
                      {event.from && event.to && event.from !== event.to && (
                        <span className="ml-2 font-normal text-slate-500">{detail.workflow.states[event.from]?.label ?? event.from} → {detail.workflow.states[event.to]?.label ?? event.to}</span>
                      )}
                      {event.override && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs font-bold text-amber-800">ndërhyrje e menaxherit</span>}
                    </p>
                    <p className="text-xs text-slate-500">{event.actorName || event.actorUid || (event.by ? String(event.by) : 'Sistemi')} · {new Date(event.atMs).toLocaleString('sq-AL')}</p>
                    {event.reason && <p className="mt-1 text-slate-700"><span className="font-semibold">Arsyeja:</span> {event.reason}</p>}
                    {event.note && <p className="mt-1 text-slate-700"><span className="font-semibold">Shënim:</span> {event.note}</p>}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-0.5 text-slate-900">{children}</dd></div>;
}

function ActionForm({ action, version, itemId, canManage, onCancel, onDone }: {
  action: AvailableAction; version: number; itemId: string; canManage: boolean; onCancel: () => void; onDone: () => Promise<void>;
}) {
  const needs = (key: string) => action.requires.includes(key);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [assigneeUid, setAssigneeUid] = useState('');
  const [people, setPeople] = useState<WorkerProfile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!needs('assignee') || !canManage) return;
    workApi.workers({ availability: 'available', limit: 100 }).then(r => setPeople(r.workers)).catch(e => setError((e as Error).message));
  }, [action.action]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await workApi.transition(itemId, {
        action: action.action, expectedVersion: version,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(assigneeUid ? { assigneeUid } : {}),
        ...(evidence.trim() ? { evidence: evidence.split(/\s+/).filter(Boolean) } : {}),
      });
      toast.success(`${action.label}: u ruajt.`);
      await onDone();
    } catch (e) {
      // The server's sentence says what to fix (missing reason, someone else changed it, no capacity).
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500';
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-bold text-slate-900">{action.label}</p>
      {needs('assignee') && (
        <label className="block text-sm font-semibold text-slate-700">Personi
          <select required value={assigneeUid} onChange={e => setAssigneeUid(e.target.value)} className={cn(input, 'mt-1 font-normal')}>
            <option value="">{people ? 'Zgjidhni…' : 'Duke ngarkuar…'}</option>
            {people?.map(p => <option key={p.uid} value={p.uid}>{p.name} · {p.load}/{p.capacity}{p.municipality ? ` · ${p.municipality}` : ''}</option>)}
          </select>
        </label>
      )}
      {needs('reason') && (
        <label className="block text-sm font-semibold text-slate-700">Arsyeja (5–300 shenja)
          <textarea required minLength={5} maxLength={300} rows={2} value={reason} onChange={e => setReason(e.target.value)} className={cn(input, 'mt-1 font-normal')} />
        </label>
      )}
      {needs('note') && (
        <label className="block text-sm font-semibold text-slate-700">Shënim (3–1000 shenja)
          <textarea required minLength={3} maxLength={1000} rows={3} value={note} onChange={e => setNote(e.target.value)} className={cn(input, 'mt-1 font-normal')} />
        </label>
      )}
      {(needs('evidence') || ['submit', 'complete', 'take_action', 'resolve'].includes(action.action)) && (
        <label className="block text-sm font-semibold text-slate-700">Dëshmi (lidhje foto ose dokumenti, një për rresht)
          <textarea rows={2} value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="https://…" className={cn(input, 'mt-1 font-normal')} />
        </label>
      )}
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm font-medium text-rose-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50">{busy ? 'Duke ruajtur…' : 'Konfirmo'}</button>
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">Anulo</button>
      </div>
    </form>
  );
}

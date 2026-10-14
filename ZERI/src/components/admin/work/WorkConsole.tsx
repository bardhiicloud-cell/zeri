import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, Download, Loader2, Plus, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../../../lib/store';
import { cn } from '../../../lib/utils';
import { WORKFLOWS, WORK_KINDS, PRIORITIES, type WorkKind, type WorkPriority } from '../../../lib/workflow/definitions';
import type { OrgSummary } from '../../../lib/workflow/workload';
import {
  KIND_LABELS, PRIORITY_LABELS, STATE_LABELS, describeDue, workApi,
  type ListView, type WorkItem, type WorkerPerformance, type WorkerProfile,
} from '../../../lib/workApi';
import { KOSOVO_MUNICIPALITIES } from '../../../lib/constants';
import WorkItemDrawer from './WorkItemDrawer';

/**
 * The work console: one place for tasks, report referrals and debate-moderation cases.
 *
 * What a person sees is decided by the server for their role. This file only chooses which
 * tabs to draw: everyone gets "Puna ime"; supervisors (admin, superadmin, dispatcher, and the
 * read-only monitor) also get the organisation overview, the open queue and the team. The
 * monitor can read all of it and is shown no buttons that change anything.
 */
type Tab = 'mine' | 'queue' | 'overview' | 'team';

const SUPERVISOR_ROLES = ['superadmin', 'admin', 'dispatcher', 'monitor'];
const MANAGER_ROLES = ['superadmin', 'admin', 'dispatcher'];

export default function WorkConsole() {
  const role = useStore(state => state.currentUser?.role) ?? '';
  const oversight = SUPERVISOR_ROLES.includes(role);
  const canManage = MANAGER_ROLES.includes(role);
  // Only these roles may list a shared queue (their own municipality's referrals, or the debate cases); a field agent sees assigned and closed work.
  const sharedQueue = ['municipality', 'moderator', 'debatwp'].includes(role);
  const [tab, setTab] = useState<Tab>(oversight ? 'overview' : 'mine');
  const [openId, setOpenId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [unread, setUnread] = useState(0);
  const [creating, setCreating] = useState(false);

  const bump = useCallback(() => setRefresh(n => n + 1), []);
  useEffect(() => { workApi.notifications().then(r => setUnread(r.unread)).catch(() => undefined); }, [refresh]);

  const tabs: Array<{ id: Tab; label: string }> = [
    ...(oversight ? [{ id: 'overview' as const, label: 'Përmbledhje' }] : []),
    { id: 'mine', label: 'Puna ime' },
    ...(oversight ? [{ id: 'queue' as const, label: 'Radha' }, { id: 'team' as const, label: 'Ekipi' }] : []),
  ];

  return (
    <div className="space-y-4 p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Detyrat dhe ngarkesa</h1>
          <p className="text-xs text-slate-500">Çdo numër vjen nga të dhënat e regjistruara; asgjë nuk është e simuluar.</p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700"><Bell className="h-3.5 w-3.5" aria-hidden />{unread} të reja</span>}
          <button onClick={bump} aria-label="Rifresko" className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /></button>
          {canManage && <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white hover:bg-rose-700"><Plus className="h-4 w-4" aria-hidden />Detyrë e re</button>}
        </div>
      </div>

      <div role="tablist" aria-label="Pamjet" className="flex gap-1 border-b border-slate-200">
        {tabs.map(entry => (
          <button
            key={entry.id} role="tab" aria-selected={tab === entry.id} onClick={() => setTab(entry.id)}
            className={cn('-mb-px border-b-2 px-4 py-2 text-sm font-semibold', tab === entry.id ? 'border-rose-600 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-800')}
          >{entry.label}</button>
        ))}
      </div>

      {tab === 'overview' && oversight && <Overview refresh={refresh} canManage={canManage} onOpenItem={setOpenId} onSwitch={setTab} />}
      {tab === 'mine' && <Queue key="mine" views={oversight ? [['mine', 'Në punë', true]] : sharedQueue ? [['mine', 'Në punë', true], ['open', 'Radha e lejuar', false], ['done', 'Të mbyllura', false]] : [['mine', 'Në punë', true], ['done', 'Të mbyllura', false]]} refresh={refresh} canManage={canManage} onOpen={setOpenId} />}
      {tab === 'queue' && oversight && (
        <Queue
          key="queue" refresh={refresh} canManage={canManage} onOpen={setOpenId} exportable={canManage}
          views={[['unassigned', 'Pa caktuar', true], ['attention', 'Kërkon vëmendje', true], ['overdue', 'Me vonesë', true], ['open', 'Të gjitha të hapura', true], ['done', 'Të mbyllura', true]]}
        />
      )}
      {tab === 'team' && oversight && <Team refresh={refresh} canManage={canManage} onOpenItem={setOpenId} />}

      {openId && <WorkItemDrawer itemId={openId} canManage={canManage} onClose={() => setOpenId(null)} onChanged={bump} />}
      {creating && <CreateDialog onClose={() => setCreating(false)} onCreated={id => { setCreating(false); bump(); setOpenId(id); }} />}
    </div>
  );
}

/* ------------------------------------------------------------------ queue */

function Queue({ views, refresh, canManage, onOpen, exportable }: {
  views: Array<[ListView, string, boolean]>; refresh: number; canManage: boolean; onOpen: (id: string) => void; exportable?: boolean;
}) {
  const [view, setView] = useState<ListView>(views[0][0]);
  const [kind, setKind] = useState<WorkKind | ''>('');
  const [rows, setRows] = useState<WorkItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const supportsKind = ['open', 'done'].includes(view) && views.some(v => v[2]);

  const load = useCallback(async (after: string | null) => {
    setLoading(true); setError('');
    try {
      const page = await workApi.list({ view, kind: supportsKind ? kind : '', cursor: after, limit: 50 });
      setRows(previous => (after ? [...previous, ...page.items] : page.items));
      setCursor(page.nextCursor);
    } catch (e) { setError((e as Error).message); if (!after) setRows([]); } finally { setLoading(false); }
  }, [view, kind, supportsKind]);

  useEffect(() => { void load(null); }, [load, refresh]);

  const now = Date.now();
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {views.length > 1 && views.map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} aria-pressed={view === id}
            className={cn('rounded-full px-3 py-1 text-sm font-semibold', view === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{label}</button>
        ))}
        {supportsKind && (
          <select aria-label="Lloji" value={kind} onChange={e => setKind(e.target.value as WorkKind | '')} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
            <option value="">Të gjitha llojet</option>
            {WORK_KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
        )}
        {exportable && (
          <button onClick={() => workApi.exportCsv(view, supportsKind ? kind : '').catch(e => toast.error((e as Error).message))} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Download className="h-4 w-4" aria-hidden />Eksporto CSV
          </button>
        )}
      </div>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{error} <button className="underline" onClick={() => void load(null)}>Provo përsëri</button></p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr><th className="px-3 py-2">Detyra</th><th className="px-3 py-2">Lloji</th><th className="px-3 py-2">Prioriteti</th><th className="px-3 py-2">Statusi</th><th className="px-3 py-2">I caktuar</th><th className="px-3 py-2">Afati</th></tr>
          </thead>
          <tbody>
            {rows.map(item => {
              const due = describeDue(item.open ? item.dueAtMs : null, now);
              return (
                <tr key={item.id} tabIndex={0} onClick={() => onOpen(item.id)} onKeyDown={e => { if (e.key === 'Enter') onOpen(item.id); }}
                  className="cursor-pointer border-t border-slate-100 hover:bg-rose-50/40 focus:bg-rose-50/60 focus:outline-none">
                  <td className="max-w-xs truncate px-3 py-2 font-semibold text-slate-900">
                    {item.needsAttention && <AlertTriangle className="mr-1 inline h-4 w-4 text-rose-600" aria-label="Kërkon vëmendje" />}{item.title}
                    {item.municipality && <span className="ml-2 text-xs font-normal text-slate-500">{item.municipality}</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{KIND_LABELS[item.kind]}</td>
                  <td className="px-3 py-2"><PriorityBadge priority={item.priority} /></td>
                  <td className="px-3 py-2 text-slate-700">{WORKFLOWS[item.kind]?.states[item.status]?.label ?? item.status}</td>
                  <td className="px-3 py-2 text-slate-700">{item.assigneeName || (item.assigneeUid ? '…' : <span className="text-amber-700">Pa caktuar</span>)}</td>
                  <td className={cn('px-3 py-2', due.overdue ? 'font-bold text-rose-700' : 'text-slate-600')}>{item.open ? due.text : item.doneAtMs ? new Date(item.doneAtMs).toLocaleDateString('sq-AL') : '—'}</td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && !error && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-500">Nuk ka detyra në këtë pamje.</td></tr>
            )}
          </tbody>
        </table>
        {loading && <div className="flex justify-center p-4 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      </div>
      {cursor && !loading && <button onClick={() => void load(cursor)} className="mx-auto block rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Ngarko më shumë</button>}
      {!canManage && views.length > 0 && <p className="text-xs text-slate-400">Pamje vetëm leximi për llogaritë e monitorimit.</p>}
    </section>
  );
}

const PRIORITY_TONE: Record<WorkPriority, string> = { low: 'bg-slate-100 text-slate-600', normal: 'bg-sky-100 text-sky-800', high: 'bg-amber-100 text-amber-800', urgent: 'bg-rose-100 text-rose-800' };
function PriorityBadge({ priority }: { priority: WorkPriority }) {
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', PRIORITY_TONE[priority])}>{PRIORITY_LABELS[priority]}</span>;
}

/* --------------------------------------------------------------- overview */

function Tile({ label, value, tone, onClick }: { label: string; value: string | number; tone?: 'bad' | 'warn'; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cn('rounded-xl border bg-white p-4 text-left', onClick && 'hover:border-rose-300', tone === 'bad' ? 'border-rose-200' : tone === 'warn' ? 'border-amber-200' : 'border-slate-200')}>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-black', tone === 'bad' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900')}>{value}</p>
    </Tag>
  );
}

function Overview({ refresh, canManage, onOpenItem: _onOpenItem, onSwitch }: { refresh: number; canManage: boolean; onOpenItem: (id: string) => void; onSwitch: (tab: Tab) => void }) {
  const [data, setData] = useState<{ summary: OrgSummary; generatedAtMs: number; truncated: { items: boolean; workers: boolean } } | null>(null);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof workApi.health>> | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setError('');
    workApi.overview().then(setData).catch(e => setError((e as Error).message));
    workApi.health().then(setHealth).catch(() => setHealth(null));
  }, [refresh]);

  if (error) return <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p>;
  if (!data) return <div className="flex justify-center p-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  const { summary } = data;

  const runEscalations = async () => {
    setRunning(true);
    try { const r = await workApi.runEscalations(); toast.success(`Kontrolli përfundoi: ${r.applied ?? 0} eskalime të reja.`); } catch (e) { toast.error((e as Error).message); } finally { setRunning(false); }
  };
  const syncProfiles = async () => {
    try { const r = await workApi.syncWorkers(); toast.success(`Profile të reja: ${r.created}, të përditësuara: ${r.updated}.`); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-5">
      {health?.scheduler?.stale && (
        <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-800">Kontrolli automatik i afateve nuk ka punuar së fundmi: eskalimet nuk po ndodhin vetvetiu. {canManage && <button className="font-bold underline" onClick={() => void runEscalations()}>Ekzekuto tani</button>}</p>
      )}
      {data.truncated.items && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Përmbledhja llogaritet nga 5000 detyrat më të vjetra të hapura; numrat janë të pjesshëm.</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Të hapura" value={summary.items.open} onClick={() => onSwitch('queue')} />
        <Tile label="Pa caktuar" value={summary.items.unassigned} tone={summary.items.unassigned > 0 ? 'warn' : undefined} onClick={() => onSwitch('queue')} />
        <Tile label="Me vonesë" value={summary.items.overdue} tone={summary.items.overdue > 0 ? 'bad' : undefined} onClick={() => onSwitch('queue')} />
        <Tile label="Kërkon vëmendje" value={summary.items.needsAttention} tone={summary.items.needsAttention > 0 ? 'bad' : undefined} onClick={() => onSwitch('queue')} />
        <Tile label="Staf i disponueshëm" value={`${summary.workforce.available}/${summary.workforce.total}`} />
        <Tile label="Shfrytëzimi i kapacitetit" value={`${Math.round(summary.workforce.utilization * 100)}%`} tone={summary.workforce.utilization >= 1 ? 'bad' : summary.workforce.utilization >= 0.8 ? 'warn' : undefined} />
        <Tile label="Mbingarkuar" value={summary.workforce.overloaded} tone={summary.workforce.overloaded > 0 ? 'bad' : undefined} />
        <Tile label="Nën-përdorur" value={summary.workforce.under} />
      </div>

      <section aria-label="Pengesat">
        <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">Pengesat e zbuluara</h2>
        {summary.bottlenecks.length === 0 ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Asnjë pengesë nuk kalon pragjet.</p> : (
          <ul className="space-y-2">{summary.bottlenecks.map(b => (
            <li key={`${b.type}:${b.key}`} className={cn('rounded-lg border p-3 text-sm', b.severity === 'critical' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-amber-200 bg-amber-50 text-amber-900')}>{b.detail}</li>
          ))}</ul>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Sipas llojit">
          <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">Sipas llojit dhe prioritetit</h2>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            {WORK_KINDS.map(k => <p key={k} className="flex justify-between py-1"><span>{KIND_LABELS[k]}</span><b>{summary.items.byKind[k]}</b></p>)}
            <hr className="my-2" />
            {PRIORITIES.map(p => <p key={p} className="flex justify-between py-1"><span>{PRIORITY_LABELS[p]}</span><b>{summary.items.byPriority[p]}</b></p>)}
          </div>
        </section>
        <section aria-label="Ngarkesa">
          <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">Më të ngarkuarit / më të lirët</h2>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            {summary.overloadedWorkers.length === 0 && summary.underusedWorkers.length === 0 && <p className="text-slate-500">Nuk ka të dhëna ngarkese.</p>}
            {summary.overloadedWorkers.map(w => <p key={w.uid} className="flex justify-between py-1 text-rose-700"><span>{w.name}</span><b>{w.load}/{w.capacity}</b></p>)}
            {summary.underusedWorkers.length > 0 && summary.overloadedWorkers.length > 0 && <hr className="my-2" />}
            {summary.underusedWorkers.map(w => <p key={w.uid} className="flex justify-between py-1 text-slate-600"><span>{w.name}</span><b>{w.load}/{w.capacity}</b></p>)}
          </div>
        </section>
      </div>

      <section aria-label="Sipas komunës">
        <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">Sipas komunës</h2>
        <div className="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs font-bold uppercase text-slate-500"><tr><th className="px-3 py-2">Komuna</th><th className="px-3 py-2">Të hapura</th><th className="px-3 py-2">Me vonesë</th><th className="px-3 py-2">Pa caktuar</th><th className="px-3 py-2">Staf</th></tr></thead>
            <tbody>{summary.byMunicipality.map(row => (
              <tr key={row.municipality} className="border-t border-slate-100"><td className="px-3 py-1.5 font-semibold">{row.municipality}</td><td className="px-3 py-1.5">{row.open}</td><td className={cn('px-3 py-1.5', row.overdue > 0 && 'font-bold text-rose-700')}>{row.overdue}</td><td className="px-3 py-1.5">{row.unassigned}</td><td className="px-3 py-1.5">{row.workers}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void runEscalations()} disabled={running} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{running ? 'Duke kontrolluar…' : 'Kontrollo afatet tani'}</button>
          <button onClick={() => void syncProfiles()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sinkronizo profilet e stafit</button>
        </div>
      )}
      <p className="text-xs text-slate-400">Përditësuar {new Date(data.generatedAtMs).toLocaleTimeString('sq-AL')}.</p>
    </div>
  );
}

/* ------------------------------------------------------------------- team */

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const id = setTimeout(() => setDebounced(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return debounced;
}

function Team({ refresh, canManage, onOpenItem }: { refresh: number; canManage: boolean; onOpenItem: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim().toLowerCase(), 300);
  const [state, setState] = useState('');
  const [rows, setRows] = useState<WorkerProfile[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async (after: string | null) => {
    setLoading(true); setError('');
    try {
      const page = await workApi.workers({ q, state, cursor: after, limit: 50 });
      setRows(previous => (after ? [...previous, ...page.workers] : page.workers));
      setCursor(page.nextCursor);
    } catch (e) { setError((e as Error).message); if (!after) setRows([]); } finally { setLoading(false); }
  }, [q, state]);
  useEffect(() => { void load(null); }, [load, refresh]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kërko sipas emrit" aria-label="Kërko punonjës" className="rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm" />
        </label>
        <select aria-label="Gjendja" value={state} onChange={e => setState(e.target.value)} className="rounded-lg border border-slate-300 px-2 text-sm">
          <option value="">Të gjitha gjendjet</option>
          {Object.entries(STATE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Emri</th><th className="px-3 py-2">Roli</th><th className="px-3 py-2">Komuna</th><th className="px-3 py-2">Ngarkesa</th><th className="px-3 py-2">Gjendja</th></tr></thead>
          <tbody>
            {rows.map(w => (
              <tr key={w.uid} tabIndex={0} onClick={() => setSelected(w.uid)} onKeyDown={e => { if (e.key === 'Enter') setSelected(w.uid); }} className="cursor-pointer border-t border-slate-100 hover:bg-rose-50/40 focus:bg-rose-50/60 focus:outline-none">
                <td className="px-3 py-2 font-semibold text-slate-900">{w.name}</td>
                <td className="px-3 py-2 text-slate-600">{w.role}</td>
                <td className="px-3 py-2 text-slate-600">{w.municipality || '—'}</td>
                <td className="px-3 py-2"><LoadBar load={w.load} capacity={w.capacity} /></td>
                <td className="px-3 py-2"><span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', w.state === 'overloaded' ? 'bg-rose-100 text-rose-800' : w.state === 'high' ? 'bg-amber-100 text-amber-800' : w.state === 'unavailable' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800')}>{STATE_LABELS[w.state]}</span></td>
              </tr>
            ))}
            {!loading && rows.length === 0 && !error && <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-500">Asnjë profil pune. Në "Përmbledhje" përdorni "Sinkronizo profilet e stafit".</td></tr>}
          </tbody>
        </table>
        {loading && <div className="flex justify-center p-4 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      </div>
      {cursor && !loading && <button onClick={() => void load(cursor)} className="mx-auto block rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Ngarko më shumë</button>}
      {selected && <WorkerPanel uid={selected} canManage={canManage} onClose={() => setSelected(null)} onOpenItem={onOpenItem} onChanged={() => void load(null)} />}
    </section>
  );
}

function LoadBar({ load, capacity }: { load: number; capacity: number }) {
  const ratio = capacity > 0 ? Math.min(1.2, load / capacity) : 0;
  return (
    <div className="flex items-center gap-2" title={`${load} nga ${capacity}`}>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`${load} nga ${capacity}`}>
        <div className={cn('h-full', ratio >= 1 ? 'bg-rose-500' : ratio >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <span className="text-xs text-slate-600">{load}/{capacity}</span>
    </div>
  );
}

function WorkerPanel({ uid, canManage, onClose, onOpenItem, onChanged }: { uid: string; canManage: boolean; onClose: () => void; onOpenItem: (id: string) => void; onChanged: () => void }) {
  const [data, setData] = useState<{ profile: WorkerProfile; open: WorkItem[]; recentFinished: number; performance: WorkerPerformance } | null>(null);
  const [error, setError] = useState('');
  const [capacity, setCapacity] = useState('');
  const [availability, setAvailability] = useState('');
  const [skills, setSkills] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await workApi.worker(uid);
      setData(result); setCapacity(String(result.profile.capacity)); setAvailability(result.profile.availability); setSkills(result.profile.skills.join(', '));
    } catch (e) { setError((e as Error).message); }
  }, [uid]);
  useEffect(() => { setData(null); void load(); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await workApi.updateWorker(uid, { capacity: Number(capacity), availability, skills: skills.split(',').map(s => s.trim()).filter(Boolean) });
      toast.success('Profili u ruajt.'); await load(); onChanged();
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };

  const perf = data?.performance;
  const pct = (value: number | null | undefined) => (value === null || value === undefined ? 'n/a' : `${Math.round(value * 100)}%`);
  const now = Date.now();
  const input = 'rounded-lg border border-slate-300 px-3 py-2 text-sm';
  const summary = useMemo(() => data?.profile, [data]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label="Profili i punonjësit" className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between"><h2 className="text-lg font-black text-slate-900">{summary?.name ?? 'Duke ngarkuar…'}</h2><button onClick={onClose} aria-label="Mbyll" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button></div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {!data && !error && <div className="flex justify-center p-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>}
        {data && perf && summary && (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">{summary.role}{summary.municipality && ` · ${summary.municipality}`}{summary.department && ` · ${summary.department}`}</p>
            <LoadBar load={summary.load} capacity={summary.capacity} />

            <section aria-label="Performanca">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Matje e sistemit · {perf.periodDays} ditët e fundit</h3>
              {perf.confidence === 'low' && <p className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-800">Mostër e vogël ({perf.finishedCount} të mbyllura): shifrat tregohen, por nuk duhen përdorur për krahasim.</p>}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="Të mbyllura (pesha)" value={`${perf.finishedCount} (${perf.weightedOutput})`} />
                <Stat label="Në kohë" value={pct(perf.onTimeRate)} />
                <Stat label="Kthyer për korrigjim" value={pct(perf.reworkRate)} />
                <Stat label="Rihapur" value={pct(perf.reopenRate)} />
                <Stat label="Me vonesë tani" value={perf.overdueOpen} />
                <Stat label="Koha mesatare" value={perf.avgCycleHours === null ? 'n/a' : `${perf.avgCycleHours} orë`} />
              </div>
              <p className="mt-2 text-xs text-slate-500">Sasia dhe cilësia ndahen: treguesi nuk shpërblen mbylljen e shpejtë pa kontroll. Vlerësimi i menaxherit është veçmas dhe nuk përzihet këtu.</p>
            </section>

            {canManage && (
              <form onSubmit={save} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Kapaciteti">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Kapaciteti dhe disponueshmëria</h3>
                <div className="flex flex-wrap gap-3">
                  <label className="text-sm font-semibold text-slate-700">Kapaciteti<input type="number" min={0} max={200} value={capacity} onChange={e => setCapacity(e.target.value)} className={cn(input, 'ml-2 w-24 font-normal')} /></label>
                  <label className="text-sm font-semibold text-slate-700">Disponueshmëria
                    <select value={availability} onChange={e => setAvailability(e.target.value)} className={cn(input, 'ml-2 font-normal')}>
                      <option value="available">I disponueshëm</option><option value="busy">I zënë</option><option value="away">Larg</option><option value="off">Jashtë shërbimit</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-semibold text-slate-700">Aftësi (të ndara me presje)<input value={skills} onChange={e => setSkills(e.target.value)} className={cn(input, 'mt-1 w-full font-normal')} /></label>
                <button disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50">{saving ? 'Duke ruajtur…' : 'Ruaj'}</button>
              </form>
            )}

            <section aria-label="Detyrat e hapura">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Detyrat e hapura ({data.open.length})</h3>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {data.open.map(item => {
                  const due = describeDue(item.dueAtMs, now);
                  return (
                    <li key={item.id}><button onClick={() => onOpenItem(item.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-rose-50/40">
                      <span className="min-w-0 truncate text-sm font-semibold text-slate-900">{item.title}</span>
                      <span className={cn('shrink-0 text-xs', due.overdue ? 'font-bold text-rose-700' : 'text-slate-500')}>{due.text}</span>
                    </button></li>
                  );
                })}
                {data.open.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-500">Nuk ka detyra të hapura.</li>}
              </ul>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-base font-bold text-slate-900">{value}</p></div>;
}

/* ----------------------------------------------------------------- create */

function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [kind, setKind] = useState<WorkKind>('internal_task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<WorkPriority>('normal');
  const [municipality, setMunicipality] = useState('');
  const [weight, setWeight] = useState('1');
  const [requiresReview, setRequiresReview] = useState(false);
  const [requiresEvidence, setRequiresEvidence] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const result = await workApi.create({ kind, title, description, priority, municipality, weight: Number(weight), requiresReview, requiresEvidence });
      toast.success(result.assignment?.outcome === 'assigned' ? 'Detyra u krijua dhe u caktua.' : 'Detyra u krijua; pret caktim.');
      onCreated(result.id);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label="Detyrë e re" onClick={e => e.stopPropagation()} className="max-h-full w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-black text-slate-900">Detyrë e re</h2>
        <label className="block text-sm font-semibold text-slate-700">Lloji
          <select value={kind} onChange={e => setKind(e.target.value as WorkKind)} className={input}>{WORK_KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">Titulli<input required minLength={3} maxLength={200} value={title} onChange={e => setTitle(e.target.value)} className={input} /></label>
        <label className="block text-sm font-semibold text-slate-700">Përshkrimi<textarea rows={3} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} className={input} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold text-slate-700">Prioriteti<select value={priority} onChange={e => setPriority(e.target.value as WorkPriority)} className={input}>{PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700">Pesha (1–10)<input type="number" min={1} max={10} value={weight} onChange={e => setWeight(e.target.value)} className={input} /></label>
        </div>
        <label className="block text-sm font-semibold text-slate-700">Komuna (opsionale)
          <select value={municipality} onChange={e => setMunicipality(e.target.value)} className={input}><option value="">—</option>{KOSOVO_MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}</select>
        </label>
        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2"><input type="checkbox" checked={requiresReview} onChange={e => setRequiresReview(e.target.checked)} />Kërkon shqyrtim para mbylljes</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={requiresEvidence} onChange={e => setRequiresEvidence(e.target.checked)} />Kërkon dëshmi</label>
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm font-medium text-rose-700">{error}</p>}
        <div className="flex gap-2">
          <button disabled={busy} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50">{busy ? 'Duke krijuar…' : 'Krijo dhe cakto'}</button>
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Anulo</button>
        </div>
      </form>
    </div>
  );
}

/**
 * Paneli i Komunës — /komuna
 *
 * Ku një komunë punon me raportimet e qytetit të vet. Gjithçka këtu lexohet nga
 * serveri dhe gjithçka që bën komuna ruhet te serveri: asgjë nuk mbetet vetëm në
 * kujtesën e shfletuesit.
 *
 *   Radha          raportimet e aprovuara të komunës, më urgjentet dhe më të vonuarat në krye
 *   Kërkesat       çka ka dërguar komuna te redaksia dhe çfarë i është përgjigjur
 *   Punimet        faktet e punimeve që komuna ka regjistruar, dhe verifikimi i tyre
 *   Performanca    afatet, numrat e saktë, koha mesatare
 *   Politika       çka lejohet dhe çka jo
 *
 * Kufijtë i vendos serveri (editorialFirewall dhe rrjedha e aprovimit): komuna
 * shton kontekst dhe nuk heq asgjë, sheh vetëm raportet e veta të aprovuara dhe
 * nuk sheh kush i ka raportuar.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { dt } from '../lib/dt';
import { useStore } from '../lib/store';
import { MUNICIPALITY_MAY, MUNICIPALITY_MAY_NOT } from '../lib/editorialFirewall';
import { isSpecificScope, scopeKey } from '../lib/municipalityScope';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import { MUNICIPALITY_PLANS } from '../lib/municipalityProvisioning';
import { statusMeta, TONE_CLASSES } from '../lib/reportStatus';
import { applyTransition } from '../lib/adminApi';
import { fetchReportPage, useServerReports } from '../lib/adminReportsApi';
import {
  FEATURE_FROM_PLAN, REQUEST_LABELS, addWorkFact, fileRequest, loadDesk, loadHealthCases,
  type Desk, type MunicipalHealthCase, type RequestKind,
} from '../lib/municipalityDeskApi';
import type { Report } from '../types';
import {
  AlertTriangle, Building2, CheckCircle2, ClipboardList, Clock, FileCheck2, Flame, Gavel,
  HeartPulse, Loader2, LogOut, MapPin, Scale, Search, Send, ShieldCheck,
} from 'lucide-react';
import DecisionBar from '../components/admin/DecisionBar';
import ReportTasksPanel from '../components/admin/workflow/ReportTasksPanel';
import ReportQueuesPanel, { ReportWorkflowDrawer } from '../components/admin/workflow/ReportQueuesPanel';

type Tab = 'tasks' | 'stages' | 'queue' | 'health' | 'requests' | 'works' | 'performance' | 'policy';
type Stage = 'all' | 'Approved' | 'working' | 'Resolved' | 'Overdue';

const TABS: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
  { id: 'tasks', label: 'Detyrat e komunës', icon: ClipboardList },
  { id: 'stages', label: 'Raportet sipas fazës', icon: FileCheck2 },
  { id: 'queue', label: 'Radha e punëve', icon: ClipboardList },
  { id: 'health', label: 'Shëndetësia', icon: HeartPulse },
  { id: 'requests', label: 'Kërkesat e mia', icon: Send },
  { id: 'works', label: 'Punimet', icon: FileCheck2 },
  { id: 'performance', label: 'Performanca', icon: Clock },
  { id: 'policy', label: 'Politika', icon: Scale },
];

const STAGES: { id: Stage; label: string }[] = [
  { id: 'all', label: 'Të gjitha' },
  { id: 'Approved', label: 'Të reja' },
  { id: 'working', label: 'Në punim' },
  { id: 'Overdue', label: 'Të vonuara' },
  { id: 'Resolved', label: 'Të zgjidhura' },
];

const URGENCY_WEIGHT: Record<string, number> = { Kritike: 4, 'E lartë': 3, Mesatare: 2, 'E ulët': 1 };

const REQUEST_STATUS: Record<string, { label: string; tone: string }> = {
  published: { label: 'Publikuar', tone: 'bg-emerald-100 text-emerald-800' },
  pending: { label: 'Në shqyrtim nga redaksia', tone: 'bg-amber-100 text-amber-800' },
  accepted: { label: 'Pranuar', tone: 'bg-emerald-100 text-emerald-800' },
  declined: { label: 'Refuzuar', tone: 'bg-rose-100 text-rose-800' },
};

const fmt = (iso: string | null | undefined) =>
  iso && Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleString('sq-AL', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const hoursSince = (iso?: string) => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 36e5)) : 0;
};

const isLate = (report: Report) =>
  report.status === 'Overdue' || (!!report.responseDueAt && report.status !== 'Resolved' && Date.parse(report.responseDueAt) < Date.now());

function Stat({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'text-slate-900 dark:text-white', amber: 'text-amber-600', emerald: 'text-emerald-600',
    rose: 'text-rose-600', indigo: 'text-indigo-600', blue: 'text-blue-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <div className={`text-2xl font-black tabular-nums ${tones[tone] ?? tones.slate}`}>{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{dt(label)}</div>
    </div>
  );
}

export default function MunicipalityPanelPage() {
  const currentUser = useStore(s => s.currentUser);
  const logout = useStore(s => s.logout);
  const navigate = useNavigate();
  const handleLogout = async () => {
    await signOut(auth).catch(() => undefined);
    logout();
    navigate('/login');
  };

  const [tab, setTab] = useState<Tab>('tasks');
  const [stage, setStage] = useState<Stage>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The profile loads a moment after the page; until then the viewer is a guest and
  // must not be told "access denied" for a second on every sign-in.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  /** Komuna e kësaj llogarie. Bosh = llogari e pacaktuar. */
  const ownMunicipality = useMemo(() => {
    const explicit = (currentUser?.municipality ?? '').trim();
    if (explicit) return explicit;
    const scope = useStore.getState().userMunicipality;
    return isSpecificScope(scope) ? scopeKey(scope) : '';
  }, [currentUser?.municipality]);

  const isMunicipal = currentUser?.role === 'municipality';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const hasGrant = (currentUser?.permissions ?? []).includes('municipalities' as never);
  const allowed = (isMunicipal && !!ownMunicipality) || isAdmin || hasGrant;

  // An administrator looks at one municipality at a time, read-only; the server
  // refuses their writes here because they are not that municipality.
  const [inspect, setInspect] = useState('');
  const effective = isMunicipal ? ownMunicipality : inspect;
  const canWork = isMunicipal && !!ownMunicipality;
  const enabled = allowed && !!effective;

  const serverParams = useMemo(
    () => ({
      status: stage === 'all' ? undefined : stage,
      ...(isMunicipal ? {} : { municipality: inspect || undefined }),
    }),
    [stage, isMunicipal, inspect]
  );
  const list = useServerReports(serverParams, enabled);

  // Exact totals per stage (the first page of each carries the count).
  const [totals, setTotals] = useState<Record<string, number | null>>({});
  const refreshTotals = useCallback(async () => {
    if (!enabled) return;
    const municipality = isMunicipal ? undefined : inspect || undefined;
    const keys = ['Approved', 'working', 'Overdue', 'Resolved'];
    const results = await Promise.all(
      keys.map(status => fetchReportPage({ status, municipality }, null, 1).then(page => page.total).catch(() => null))
    );
    setTotals(Object.fromEntries(keys.map((key, i) => [key, results[i]])));
  }, [enabled, isMunicipal, inspect]);
  useEffect(() => { void refreshTotals(); }, [refreshTotals]);

  const [desk, setDesk] = useState<Desk | null>(null);
  const [deskError, setDeskError] = useState('');
  const refreshDesk = useCallback(async () => {
    if (!canWork) return;
    try {
      setDesk(await loadDesk());
      setDeskError('');
    } catch (error) {
      setDeskError((error as Error).message);
    }
  }, [canWork]);
  useEffect(() => { void refreshDesk(); }, [refreshDesk]);

  const [healthCases, setHealthCases] = useState<MunicipalHealthCase[] | null>(null);
  const [healthError, setHealthError] = useState('');
  const refreshHealth = useCallback(async () => {
    if (!canWork) return;
    try {
      setHealthCases(await loadHealthCases());
      setHealthError('');
    } catch (error) {
      setHealthError((error as Error).message);
    }
  }, [canWork]);
  useEffect(() => { if (tab === 'health' && (!desk || desk.features.includes('health'))) void refreshHealth(); }, [tab, refreshHealth, desk]);

  const queue = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...list.items]
      .filter(r => !needle || r.title?.toLowerCase().includes(needle) || (r.trackingId ?? '').toLowerCase().includes(needle) || (r.category ?? '').toLowerCase().includes(needle))
      .sort((a, b) => {
        const late = Number(isLate(b)) - Number(isLate(a));
        if (late) return late;
        const urgency = (URGENCY_WEIGHT[b.urgency] ?? 1) - (URGENCY_WEIGHT[a.urgency] ?? 1);
        return urgency || hoursSince(b.createdAt) - hoursSince(a.createdAt);
      });
  }, [list.items, query]);

  const selected = queue.find(r => r.id === selectedId) ?? null;
  const pendingRequests = desk?.requests.filter(r => r.status === 'pending').length ?? 0;
  // Until the desk answers, nothing is locked: the server is what actually refuses.
  const has = (feature: string) => !desk || desk.features.includes(feature);
  const planName = MUNICIPALITY_PLANS.find(plan => plan.id === desk?.plan)?.name ?? '';

  const afterChange = () => { void list.refresh(); void refreshTotals(); void refreshDesk(); };

  if (!allowed && !settled && (!currentUser || currentUser.role === 'guest')) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label={dt('Duke ngarkuar')} />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-xl font-black text-slate-900 dark:text-white">{dt('Akses i kufizuar')}</h1>
        <p className="mt-2 text-sm text-slate-500">{dt('Ky panel është i dedikuar llogarive komunale.')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-700 text-white"><Building2 className="h-5 w-5" /></span>
          <div>
            <h1 className="font-serif text-2xl font-black text-slate-950 dark:text-white">{effective || dt('Zgjidhni një komunë')}</h1>
            <p className="text-xs text-slate-500">{currentUser?.name} · {dt('paneli i komunës')}</p>
          </div>
        </div>

        {!isMunicipal && (
          <select
            value={inspect}
            onChange={e => { setInspect(e.target.value); setSelectedId(null); }}
            aria-label={dt('Komuna për inspektim')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
          >
            <option value="">{dt('Zgjidhni një komunë për të inspektuar…')}</option>
            {KOSOVO_MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{(totals.Approved ?? 0) + (totals.working ?? 0)} {dt('të hapura')}</span>
          {(totals.Overdue ?? 0) > 0 && <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">{totals.Overdue} {dt('të vonuara')}</span>}
          {pendingRequests > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">{pendingRequests} {dt('kërkesa në pritje')}</span>}
          {planName && <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300" title={dt('Plani i abonimit')}>{dt('Plani')}: {planName}</span>}
          <button type="button" onClick={() => navigate('/')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800">{dt('Faqja publike')}</button>
          <button type="button" onClick={() => void handleLogout()} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-rose-600 hover:bg-rose-600 hover:text-white dark:bg-rose-500/10">
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Mbyll sesionin')}
          </button>
        </div>
      </header>

      {!canWork && (
        <p className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-200">
          {dt('Po e shihni si inspektues: vetëm lexim. Veprimet i bën llogaria e komunës.')}
        </p>
      )}

      <nav className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-white/10 dark:bg-slate-900">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${tab === id ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
          >
            <Icon className="h-4 w-4" /> {dt(label)}
            {id === 'requests' && pendingRequests > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[11px] text-white">{pendingRequests}</span>}
          </button>
        ))}
      </nav>

      {!effective && <p className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500 dark:border-white/10">{dt('Zgjidhni një komunë për të parë punën e saj.')}</p>}

      {effective && tab === 'tasks' && (isMunicipal ? <ReportTasksPanel embedded /> : <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-white/10">{dt('Detyrat e komunës i sheh llogaria e komunës. Si inspektues, përdorni "Raportet sipas fazës".')}</p>)}
      {effective && tab === 'stages' && <ReportQueuesPanel initialQueue="assigned" />}

      {effective && tab === 'queue' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {STAGES.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setStage(s.id); setSelectedId(null); }}
                aria-pressed={stage === s.id}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${stage === s.id ? 'bg-slate-900 text-white dark:bg-emerald-600' : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300'}`}
              >
                {dt(s.label)} {s.id !== 'all' && totals[s.id] != null && <span className="ml-1 tabular-nums opacity-70">{totals[s.id]}</span>}
              </button>
            ))}
            <div className="relative ml-auto min-w-[14rem] flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={dt('Kërko sipas titullit, kodit…')}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
            <div className="space-y-2">
              {list.status === 'loading' && queue.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></p>
              ) : list.status === 'error' ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">{list.error?.message ?? dt('Raportet nuk u ngarkuan.')}</p>
              ) : queue.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">{dt('Nuk ka punë këtu.')}</p>
              ) : (
                queue.map(r => {
                  const meta = statusMeta(r.status);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      aria-pressed={selectedId === r.id}
                      className={`block w-full rounded-xl border p-4 text-left transition-colors ${selectedId === r.id ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/10' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900'}`}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE_CLASSES[meta.tone]}`}>{dt(meta.label)}</span>
                        {isLate(r) && <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700"><Flame className="h-3 w-3" /> {dt('Afati i kaluar')}</span>}
                        {r.urgency === 'Kritike' && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">{dt('Kritike')}</span>}
                        {r.trackingId && <span className="font-mono text-[11px] text-slate-400">#{r.trackingId}</span>}
                      </span>
                      <span className="mt-1 block truncate text-sm font-semibold text-slate-900 dark:text-white">{r.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{r.category} · {fmt(r.createdAt)} · {hoursSince(r.createdAt)} {dt('orë')}</span>
                    </button>
                  );
                })
              )}
              {list.nextCursor && (
                <button type="button" onClick={() => void list.loadMore()} disabled={list.isLoadingMore} className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300">
                  {list.isLoadingMore ? dt('Duke ngarkuar…') : dt('Ngarko më shumë')}
                </button>
              )}
            </div>

            <aside className="space-y-3">
              {selected ? (
                <Dossier report={selected} canWork={canWork} canRegisterWorks={has('workFacts')} onChanged={afterChange} />
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-white/10">{dt('Zgjidhni një punë për të vepruar.')}</p>
              )}
            </aside>
          </div>
        </section>
      )}

      {effective && tab === 'health' && (
        <section className="space-y-3">
          <p className="text-xs text-slate-500">{dt('Rastet shëndetësore të komunës suaj. Emri dhe kontaktet e pacientit mbeten te stafi shëndetësor dhe nuk shfaqen këtu. Mund të verifikoni që rasti është i vërtetë dhe ta mbyllni kur trajtohet.')}</p>
          {healthError && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{healthError}</p>}
          {canWork && !has('health') ? (
            <PlanLock feature="health" what="Rastet shëndetësore" />
          ) : !canWork ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">{dt('Rastet shihen nga llogaria e komunës.')}</p>
          ) : healthCases === null ? (
            <p className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></p>
          ) : healthCases.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">{dt('Asnjë rast shëndetësor për komunën tuaj.')}</p>
          ) : (
            <ul className="space-y-2">
              {healthCases.map(c => (
                <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    {c.urgency && <span className={`rounded-full px-2 py-0.5 ${c.urgency === 'Urgjente' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{c.urgency}</span>}
                    <span className={`rounded-full px-2 py-0.5 ${c.status === 'verified' ? 'bg-emerald-100 text-emerald-800' : c.status === 'resolved' ? 'bg-blue-100 text-blue-800' : c.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                      {c.status === 'verified' ? dt('Verifikuar') : c.status === 'resolved' ? dt('Trajtuar') : c.status === 'rejected' ? dt('Refuzuar') : dt('Në shqyrtim')}
                    </span>
                    {c.trackingId && <span className="font-mono text-slate-400">#{c.trackingId}</span>}
                    {c.hospitalNotified && <span className="text-slate-400">{dt('Spitali u njoftua')}{c.hospitalTarget ? `: ${c.hospitalTarget}` : ''}</span>}
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">{c.category}{c.diagnosis ? ` · ${c.diagnosis}` : ''}</p>
                  <p className="text-xs text-slate-500">{[c.age != null ? `${c.age} ${dt('vjeç')}` : '', c.gender, c.neighborhood].filter(Boolean).join(' · ')}</p>
                  {c.description && <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{c.description}</p>}
                  {c.needs.length > 0 && <p className="mt-1 text-[11px] text-slate-500">{dt('Nevojat:')} {c.needs.join(', ')}</p>}
                  <DecisionBar kind="health" id={c.id} doc={c as unknown as Record<string, unknown>} className="mt-3" onDecided={() => void refreshHealth()} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {effective && tab === 'requests' && (
        <section className="space-y-3">
          <p className="text-xs text-slate-500">{dt('Çdo kërkesë ruhet. Ato që kërkojnë shqyrtim presin vendimin e redaksisë, dhe arsyen e shihni këtu.')}</p>
          {deskError && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{deskError}</p>}
          {!canWork ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">{dt('Kërkesat shihen nga llogaria e komunës.')}</p>
          ) : !desk || desk.requests.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">{dt('Asnjë kërkesë ende.')}</p>
          ) : (
            <ul className="space-y-2">
              {desk.requests.map(item => {
                const state = REQUEST_STATUS[item.status] ?? REQUEST_STATUS.pending;
                return (
                  <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                      <span className="text-slate-700 dark:text-slate-200">{dt(REQUEST_LABELS[item.kind] ?? item.kind)}</span>
                      <span className={`rounded-full px-2 py-0.5 ${state.tone}`}>{dt(state.label)}</span>
                      <span className="ml-auto text-slate-400">{fmt(item.at)}</span>
                    </div>
                    {item.reportTitle && <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{item.reportTitle}{item.trackingId && <span className="ml-2 font-mono text-slate-400">#{item.trackingId}</span>}</p>}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{item.note}</p>
                    {item.decisionReason && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"><strong>{dt('Përgjigja e redaksisë:')}</strong> {item.decisionReason}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {effective && tab === 'works' && (
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Fakte të regjistruara" value={desk?.workFacts.length ?? 0} tone="emerald" />
            <Stat label="Në verifikim" value={desk?.workFacts.filter(f => f.review === 'pending').length ?? 0} tone="amber" />
            <Stat label="Të verifikuara" value={desk?.workFacts.filter(f => f.review === 'confirmed').length ?? 0} tone="emerald" />
            <Stat label="Të refuzuara" value={desk?.workFacts.filter(f => f.review === 'rejected').length ?? 0} tone="rose" />
          </div>
          {!canWork || !desk || desk.workFacts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">{dt('Asnjë fakt pune i regjistruar. Regjistrojini te dosja e një raportimi në punim.')}</p>
          ) : (
            <ul className="space-y-2">
              {desk.workFacts.map(f => (
                <li key={f.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                  <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{f.description}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span>{fmt(f.at)}</span>
                    <span className={`rounded-full px-1.5 py-0.5 font-bold ${f.review === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : f.review === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                      {f.review === 'confirmed' ? dt('Verifikuar') : f.review === 'rejected' ? dt('Refuzuar') : dt('Në verifikim')}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {effective && tab === 'performance' && (
        <section className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Të reja" value={totals.Approved ?? '—'} tone="blue" />
            <Stat label="Në punim" value={totals.working ?? '—'} tone="indigo" />
            <Stat label="Të vonuara" value={totals.Overdue ?? '—'} tone="rose" />
            <Stat label="Të zgjidhura" value={totals.Resolved ?? '—'} tone="emerald" />
          </div>
          <p className="text-[11px] text-slate-500">{dt('Numrat janë të saktë për gjithë komunën, jo vetëm për rreshtat e ngarkuar.')}</p>
        </section>
      )}

      {tab === 'policy' && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]">
            <h2 className="flex items-center gap-2 text-sm font-black text-emerald-900 dark:text-emerald-200"><CheckCircle2 className="h-4 w-4" /> {dt('Komuna mund të')}</h2>
            <ul className="mt-3 space-y-1.5 text-xs text-emerald-900/90 dark:text-emerald-100/80">{MUNICIPALITY_MAY.map(x => <li key={x}>✓ {dt(x)}</li>)}</ul>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-500/20 dark:bg-rose-500/[0.06]">
            <h2 className="flex items-center gap-2 text-sm font-black text-rose-900 dark:text-rose-200"><Gavel className="h-4 w-4" /> {dt('Komuna nuk mund të')}</h2>
            <ul className="mt-3 space-y-1.5 text-xs text-rose-900/90 dark:text-rose-100/80">{MUNICIPALITY_MAY_NOT.map(x => <li key={x}>✕ {dt(x)}</li>)}</ul>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500 md:col-span-2">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
            {dt('Këto kufizime zbatohen nga serveri, jo vetëm në kontratë. Pagesa e abonimit nuk jep kontroll mbi përmbajtjen.')}
          </p>
        </section>
      )}
    </div>
  );
}

/** One report, with everything the municipality may do about it. */
function Dossier({ report, canWork, canRegisterWorks, onChanged }: { report: Report; canWork: boolean; canRegisterWorks: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [fact, setFact] = useState({ description: '', completedAt: '', performedBy: '', cost: '' });
  const [kind, setKind] = useState<RequestKind>('respond');
  const [note, setNote] = useState('');
  const [flowOpen, setFlowOpen] = useState(false);

  // A new report starts with empty forms.
  useEffect(() => { setNote(''); setFact({ description: '', completedAt: '', performedBy: '', cost: '' }); }, [report.id]);

  const run = async (work: () => Promise<unknown>, done: string, after?: () => void) => {
    setBusy(true);
    try {
      await work();
      toast.success(done);
      after?.();
      onChanged();
    } catch (error) {
      toast.error((error as Error)?.message || dt('Veprimi nuk u krye.'));
    } finally {
      setBusy(false);
    }
  };

  const meta = statusMeta(report.status);
  const photos = report.images ?? [];
  const input = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-white';
  const primary = 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-40';

  return (
    <>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE_CLASSES[meta.tone]}`}>{dt(meta.label)}</span>
          {report.trackingId && <span className="font-mono text-[11px] text-slate-400">#{report.trackingId}</span>}
        </div>
        <h2 className="text-sm font-black text-slate-900 dark:text-white">{report.title}</h2>
        <p className="text-[11px] text-slate-500"><MapPin className="mr-1 inline h-3 w-3" />{report.location?.address || report.location?.municipality} · {report.category}</p>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">{report.description}</p>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {photos.slice(0, 6).map(url => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        )}
        {(report.timeline ?? []).length > 0 && (
          <ol className="max-h-40 space-y-1.5 overflow-y-auto border-t border-slate-100 pt-3 text-[11px] dark:border-white/10">
            {[...report.timeline].reverse().slice(0, 8).map(event => (
              <li key={event.id} className="text-slate-600 dark:text-slate-300">
                <span className="font-bold">{event.updatedBy}</span> · <span className="text-slate-400">{fmt(event.date)}</span>
                {event.comment && <span className="block">{event.comment}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]">
        <h3 className="text-xs font-black text-slate-900 dark:text-white">{dt('Rrjedha e raportit')}</h3>
        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
          {report.status === 'Approved'
            ? dt('U aprovua dhe pret caktimin nga menaxheri. Kur komuna caktohet, raporti shfaqet te "Detyrat e komunës".')
            : report.status === 'Assigned'
              ? dt('I caktuar. Kur puna fillon realisht, përgjegjësi i caktuar shtyp "Aprovo fillimin e procesit".')
              : dt('Fazat, caktimet, historiku dhe veprimet që ju lejohen.')}
        </p>
        <button type="button" onClick={() => setFlowOpen(true)} className={primary}>{dt('Hap rrjedhën dhe veprimet')}</button>
      </div>
      {flowOpen && <ReportWorkflowDrawer reportId={report.id} onClose={() => setFlowOpen(false)} onChanged={onChanged} />}

      {['In Progress', 'Assigned', 'Overdue'].includes(report.status) && (report as { resolutionClaimed?: boolean }).resolutionClaimed === true && (
        <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
          {dt('Keni raportuar punimet të kryera. Platforma po e verifikon; raportimi mbyllet vetëm pas konfirmimit. Nëse kthehet, arsyeja shfaqet te historiku.')}
        </p>
      )}

      {canWork && ['In Progress', 'Assigned', 'Overdue'].includes(report.status) && (report as { resolutionClaimed?: boolean }).resolutionClaimed !== true && !canRegisterWorks && (
        <>
          <PlanLock feature="workFacts" what="Regjistrimi i fakteve të punimeve" />
          <button type="button" disabled={busy} onClick={() => setFlowOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-40 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> {dt('Dërgo zgjidhjen për verifikim')}
          </button>
        </>
      )}

      {canWork && canRegisterWorks && ['In Progress', 'Assigned', 'Overdue'].includes(report.status) && (report as { resolutionClaimed?: boolean }).resolutionClaimed !== true && (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]">
          <h3 className="text-xs font-black text-slate-900 dark:text-white">{dt('Fakte për punimet e kryera')}</h3>
          <p className="text-[11px] leading-relaxed text-slate-500">{dt('Përshkruani çka u rregullua. Redaksia e verifikon para se të shfaqet si fakt i konfirmuar.')}</p>
          <textarea value={fact.description} onChange={e => setFact({ ...fact, description: e.target.value })} rows={3} maxLength={2000} placeholder={dt('Çka u rregullua, ku, me çfarë…')} className={input} />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={fact.completedAt} onChange={e => setFact({ ...fact, completedAt: e.target.value })} aria-label={dt('Data e përfundimit')} className={input} />
            <input value={fact.performedBy} onChange={e => setFact({ ...fact, performedBy: e.target.value })} placeholder={dt('Kush e kreu')} className={input} />
          </div>
          <input value={fact.cost} onChange={e => setFact({ ...fact, cost: e.target.value })} placeholder={dt('Kostoja (opsionale)')} className={input} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || fact.description.trim().length < 10} onClick={() => void run(() => addWorkFact({ reportId: report.id, ...fact }), dt('Faktet u regjistruan dhe presin verifikimin.'), () => setFact({ description: '', completedAt: '', performedBy: '', cost: '' }))} className={primary}>
              {dt('Regjistro faktet')}
            </button>
            <button type="button" disabled={busy} onClick={() => setFlowOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-40 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> {dt('Dërgo zgjidhjen për verifikim')}
            </button>
          </div>
        </div>
      )}

      {canWork && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
          <h3 className="text-xs font-black text-slate-900 dark:text-white">{dt('Shkruaj te redaksia ose publiku')}</h3>
          <select value={kind} onChange={e => setKind(e.target.value as RequestKind)} aria-label={dt('Lloji')} className={input}>
            {(Object.keys(REQUEST_LABELS) as RequestKind[]).map(k => <option key={k} value={k}>{dt(REQUEST_LABELS[k])}</option>)}
          </select>
          <p className="text-[11px] text-slate-400">
            {kind === 'respond' ? dt('Shfaqet menjëherë te historiku publik i raportimit.') : dt('Ruhet dhe e shqyrton redaksia; përgjigjen e shihni te "Kërkesat e mia".')}
          </p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={4} maxLength={1200} placeholder={dt('Teksti…')} className={input} />
          <button type="button" disabled={busy || note.trim().length < 10} onClick={() => void run(() => fileRequest(report.id, kind, note.trim()), kind === 'respond' ? dt('Përgjigjja u publikua.') : dt('Kërkesa u dërgua te redaksia.'), () => setNote(''))} className={primary}>
            <Send className="h-3.5 w-3.5" /> {kind === 'respond' ? dt('Publiko përgjigjen') : dt('Dërgo kërkesën')}
          </button>
          <p className="border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-400 dark:border-white/10">{dt('Komuna nuk mund të fshijë, fshehë ose ndryshojë raportime qytetarësh.')}</p>
        </div>
      )}
    </>
  );
}

/** A part of the console the current plan does not include, with what to do about it. */
function PlanLock({ feature, what }: { feature: string; what: string }) {
  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
      <p className="text-sm font-bold text-amber-900 dark:text-amber-200">{dt(what)} {dt('përfshihen nga plani')} {FEATURE_FROM_PLAN[feature] ?? 'më i lartë'}</p>
      <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{dt('Kontaktoni administratorin e platformës për ta ndryshuar planin e komunës suaj. Çdo gjë tjetër vazhdon të punojë.')}</p>
    </div>
  );
}

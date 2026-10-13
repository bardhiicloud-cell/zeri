/**
 * Monitorimi — /monitorim
 *
 * Vëzhgimi i detajuar i çdo veprimi të stafit, i ndarë nga moderimi.
 *
 * Moderimi merr vendime (aprovo, refuzo, pezullo). Monitorimi nuk vendos asgjë —
 * ai lexon, krahason dhe tregon. Ndarja është e qëllimshme: njeriu që po vëzhgon
 * stafin nuk duhet të jetë i njëjti që e ndëshkon atë në të njëjtin ekran, sepse
 * një buton "pezullo" pranë çdo rreshti e kthen vëzhgimin në një gjueti.
 *
 * Seksionet:
 *   1. Pulsi        — gjendja e sistemit tani, pa filtra
 *   2. Agjentët     — kush punon, sa, ku, dhe çka ka bërë së fundmi
 *   3. Komunat      — ngarkesa dhe sjellja e llogarive komunale
 *   4. Anomalitë    — veprimet që ndryshojnë nga norma dhe kërkojnë sy
 *   5. Rrjedha live — çdo veprim i regjistruar, më i reja në krye
 *
 * Të gjitha shifrat vijnë nga `agentActivity.ts` dhe `actorAudit.ts`. Asnjë
 * numër nuk shpiket, dhe një agjent pa histori tregon 0, jo një shifër të
 * fabrikuar.
 */
import { useMemo, useState } from 'react';
import { dt } from '../lib/dt';
import { useStore } from '../lib/store';
import type { AuditLog } from '../types';
import { useAgentActivity, useMunicipalityLoad } from '../lib/agentActivity';
import type { User } from '../types';
import { useStaffDirectory } from '../lib/useCitizenDirectory';
import {
  collectActorAudit,
  touchedSubjects,
  classifyActionKind,
  AUDIT_WINDOWS,
  WINDOW_LABELS,
  ACTION_KIND_LABELS,
  ACTION_KIND_TONES,
  type AuditWindow,
} from '../lib/actorAudit';
import { collectAgents, collectMunicipalities, isModerationCenterUser } from '../lib/moderationCenter';
import ActorAccessControl from '../components/admin/ActorAccessControl';
import TeamOverviewPanel from '../components/admin/TeamOverviewPanel';
import {
  buildDepartmentBoard,
  summariseBoard,
  HEALTH_LABELS,
  HEALTH_TONES,
  type DepartmentInput,
} from '../lib/departmentVision';
import { ALL_SCOPE, isSpecificScope, scopeKey } from '../lib/municipalityScope';
import {
  Activity, Users, Building2, AlertTriangle, Radio, Search, ShieldCheck,
  Clock, Eye, ChevronRight, MapPin, TrendingUp, UserSearch, LayoutGrid,
} from 'lucide-react';
type Tab = 'team' | 'actor' | 'pulse' | 'departments' | 'agents' | 'municipalities' | 'anomalies' | 'stream';

const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  // Actor first: the operator's usual task is "audit this one person", and the
  // previous layout made that the last thing they could reach.
  { id: 'team', label: 'Ekipi', icon: Users },
  { id: 'actor', label: 'Zgjidh personin', icon: UserSearch },
  { id: 'pulse', label: 'Pulsi', icon: Activity },
  { id: 'departments', label: 'Repartet', icon: LayoutGrid },
  { id: 'agents', label: 'Agjentët', icon: Users },
  { id: 'municipalities', label: 'Komunat', icon: Building2 },
  { id: 'anomalies', label: 'Anomalitë', icon: AlertTriangle },
  { id: 'stream', label: 'Rrjedha live', icon: Radio },
];

const STATUS_DOT: Record<AuditLog['status'], string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
};

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('sq-AL', { dateStyle: 'short', timeStyle: 'short' }) : '—';

function Stat({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'text-slate-900 dark:text-white',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    indigo: 'text-indigo-600',
    blue: 'text-blue-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <div className={`text-2xl font-black tabular-nums ${tones[tone] ?? tones.slate}`}>{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{dt(label)}</div>
    </div>
  );
}

/**
 * Një agjent është "i heshtur" nëse nuk ka vepruar fare sot por ka histori —
 * kjo është sinjali i parë që diçka nuk shkon (llogari e kompromentuar, punonjës
 * i larguar pa u çaktivizuar, ose një rol që nuk arrin t'i japë punë).
 */
function isDormant(lastActionAt: string | undefined): boolean {
  if (!lastActionAt) return false;
  return Date.now() - Date.parse(lastActionAt) > 3 * 24 * 36e5;
}

export default function MonitoringPage() {
  const currentUser = useStore((s) => s.currentUser);
  /**
   * The staff directory, paged and staff-only.
   *
   * This page used to read `state.users`, which the app-level listener filled by
   * subscribing *every* visitor to the whole users collection. That listener was
   * removed — it downloaded the country on first paint and leaked emails and
   * phone numbers to the browser — so `state.users` is now only ever populated by
   * local edits and is empty on a fresh staff session. The consequence was that
   * the monitoring console showed no actors at all. Sourcing it from the same
   * paginated directory the rest of the admin panel uses fixes that and keeps the
   * read cost flat as the platform grows.
   */
  const { staff } = useStaffDirectory();
  const users = staff;
  const auditLogs = useStore((s) => s.auditLogs ?? []);
  const reports = useStore((s) => s.reports ?? []);
  const scope = useStore((s) => s.userMunicipality);
  const setUserMunicipality = useStore((s) => s.setUserMunicipality);

  const [tab, setTab] = useState<Tab>('team');
  const [query, setQuery] = useState('');
  /** Search over the actor list, separate from the log-stream search. */
  const [actorQuery, setActorQuery] = useState('');
  /** Bumped after an access change so the drawer re-reads the account. */
  const [accessRefresh, setAccessRefresh] = useState(0);
  /** The actor whose detail drawer is open. */
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [inspectWindow, setInspectWindow] = useState<AuditWindow>('7d');

  /*
   * Guard.
   *
   * An administrator always passes. `isModerationCenterUser` already grants
   * admin and superadmin, but the permissions arm below is what lets a field
   * agent be given monitoring without being promoted to a staff role — and the
   * explicit admin check keeps the owner's access from depending on a helper
   * whose definition could change.
   */
  const isOwner = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const allowed =
    isOwner ||
    isModerationCenterUser(currentUser) ||
    (currentUser?.permissions ?? []).some((p) => p === 'monitorim' || p === 'monitoring');

  /* --- Të dhënat --- */
  const agents = useMemo(() => collectAgents(users), [users]);
  const municipalities = useMemo(() => collectMunicipalities(users), [users]);
  const agentActivity = useAgentActivity(
    useMemo(
      () => agents.map((a) => ({ id: a.id, name: a.name, email: a.email ?? '', role: a.role })),
      [agents]
    )
  );
  const municipalityLoad = useMunicipalityLoad();

  const scoped = isSpecificScope(scope);
  const wanted = scopeKey(scope);

  /* --- Filtrat --- */
  const matches = (log: AuditLog) => {
    const needle = query.trim().toLowerCase();
    if (scoped && (log.municipality ?? '') !== wanted) return false;
    if (!needle) return true;
    return (
      (log.action ?? '').toLowerCase().includes(needle) ||
      (log.userName ?? '').toLowerCase().includes(needle) ||
      (log.userEmail ?? '').toLowerCase().includes(needle) ||
      String(log.details ?? '').toLowerCase().includes(needle)
    );
  };

  const filteredStream = useMemo(
    () => auditLogs.filter(matches).slice(0, 300),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auditLogs, query, scope]
  );

  /* --- Pulsi --- */
  const pulse = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 36e5;
    const inDay = (l: AuditLog) => {
      const t = Date.parse(l.createdAt);
      return Number.isFinite(t) && t >= dayAgo;
    };
    return {
      actions24h: auditLogs.filter(inDay).length,
      flagged24h: auditLogs.filter((l) => inDay(l) && l.status !== 'success').length,
      activeAgents: agentActivity.filter((a) => a.last24h > 0).length,
      dormantAgents: agentActivity.filter((a) => a.total > 0 && a.last24h === 0 && isDormant(a.lastAction?.at)).length,
      openReports: reports.filter((r) => ['Pending Review', 'Approved', 'Assigned', 'In Progress', 'Overdue'].includes(r.status)).length,
      overdueReports: reports.filter((r) => r.status === 'Overdue').length,
    };
  }, [auditLogs, agentActivity, reports]);

  /* --- Anomalitë --- */
  /**
   * Veprimet që meritojnë sy, të llogaritura nga regjistri — jo të përcaktuara
   * me dorë. Kategoritë janë ato që në praktikë kapin gabimin e parë: fshirje,
   * refuzime, dhe përdorues të panjohur që veprojnë.
   */
  const anomalies = useMemo(() => {
    const out: Array<{ log: AuditLog; reason: string; severity: 'high' | 'medium' }> = [];
    const scopedLogs = auditLogs.filter((l) => matches(l));

    for (const log of scopedLogs) {
      const kind = classifyActionKind(log);
      const action = `${log.action} ${log.details ?? ''}`.toLowerCase();

      if (log.status === 'danger' && kind === 'destructive') {
        out.push({ log, reason: 'Fshirje ose veprim shkatërrues me status alarmi', severity: 'high' });
        continue;
      }
      if (log.status === 'danger') {
        out.push({ log, reason: 'Veprim i dështuar ose i refuzuar', severity: 'high' });
        continue;
      }
      // Një rol tradicionalisht i kufizuar që prek fusha të stafit.
      if (/(role|permission|claim|ban|fjalëkalim|password)/i.test(action) && log.status !== 'success') {
        out.push({ log, reason: 'Ndryshim i refuzuar i qasjes ose kredencialeve', severity: 'medium' });
        continue;
      }
      if (!log.userId || log.userId === 'system') {
        out.push({ log, reason: 'Veprim pa identitet përdoruesi', severity: 'medium' });
      }
    }

    // Grupim sipas veprimit për ta bërë të lexueshëm: një listë me 200 rreshta
    // identike nuk tregon asgjë, ndërsa "12× i njëjti refuzim" tregon një model.
    const grouped = new Map<string, { log: AuditLog; reason: string; severity: 'high' | 'medium'; count: number }>();
    for (const item of out) {
      const key = `${item.log.action}|${item.log.userName ?? item.log.userId}|${item.reason}`;
      const existing = grouped.get(key);
      if (existing) existing.count += 1;
      else grouped.set(key, { ...item, count: 1 });
    }

    return [...grouped.values()].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
      return b.count - a.count;
    });
  }, [auditLogs, query, scope]);

  /* --- Repartet: një vështrim mbi çdo fushë pune --- */
  /** Fakte punimesh që presin verifikim — burimi i vetëm është radha e sesionit. */
  /**
   * The department board.
   *
   * Every figure is counted from collections already in the store, in a single
   * pass each — the board must never walk a collection per department, or it
   * becomes the slowest page in the panel at exactly the traffic where it is
   * needed most.
   */
  const departments = useMemo(() => {
    const now = Date.now();
    const periodStart = now - 7 * 24 * 36e5;
    const inPeriod = (iso?: string) => {
      const t = Date.parse(iso ?? '');
      return Number.isFinite(t) && t >= periodStart;
    };
    const inScopeReport = (m?: string) => !scoped || (m ?? '') === wanted;

    // Reports: backlog, flow, breach — one pass, three counters.
    let reportBacklog = 0;
    let reportFlow = 0;
    let reportBreach = 0;
    for (const r of reports) {
      if (!inScopeReport(r.location?.municipality)) continue;
      if (['Pending Review', 'Approved', 'Assigned', 'In Progress', 'Overdue'].includes(r.status)) reportBacklog += 1;
      if (r.status === 'Resolved' && inPeriod(r.resolvedAt ?? r.updatedAt)) reportFlow += 1;
      if (r.status === 'Overdue') reportBreach += 1;
    }

    // Agents who acted inside the window, from the indexed activity rows.
    const active = agentActivity.filter((a) => a.last7d > 0).length;

    const inputs: DepartmentInput[] = [
      {
        id: 'reports',
        label: 'Raportimet qytetare',
        backlog: reportBacklog,
        flow: reportFlow,
        breach: reportBreach,
        staff: agents.length,
        activeStaff: active,
        note: `${reports.length} të ngarkuara`,
      },
      {
        id: 'moderation',
        label: 'Moderimi i përmbajtjes',
        backlog: anomalies.filter((a) => a.severity === 'high').length,
        flow: auditLogs.filter((l) => inPeriod(l.createdAt) && l.status === 'success').length,
        breach: auditLogs.filter((l) => inPeriod(l.createdAt) && l.status === 'danger').length,
        staff: agents.length,
        activeStaff: active,
        note: `${auditLogs.length} veprime të regjistruara`,
      },
      {
        id: 'reports-overdue',
        label: 'Afatet e vonuara',
        backlog: pulse.overdueReports,
        flow: 0,
        breach: pulse.overdueReports,
        staff: agents.length,
        activeStaff: active,
        note: 'SLA 48 orë',
      },
    ];

    return { rows: buildDepartmentBoard(inputs), summary: summariseBoard(buildDepartmentBoard(inputs)) };
  }, [reports, agents, agentActivity, municipalityLoad, municipalities, auditLogs, anomalies, pulse.overdueReports, scoped, wanted]);

  /**
   * The actor list, active first.
   *
   * Ordered by recent activity rather than alphabetically: an administrator
   * opening this screen is usually looking for whoever is working now, and a
   * name they have to scroll to is a name they will not check. Counts come from
   * the already-indexed activity rows, so this adds no extra pass.
   */
  const actorList = useMemo(() => {
    const needle = actorQuery.trim().toLowerCase();
    const activityById = new Map(agentActivity.map((a) => [a.agent.id, a]));

    const rows = [
      ...agents.map((a) => {
        const act = activityById.get(a.id);
        return {
          id: a.id,
          name: a.name,
          email: a.email ?? '',
          role: a.role,
          permissions: a.permissions,
          isBanned: a.isBanned,
          kind: 'agent' as const,
          total: act?.total ?? 0,
          last7d: act?.last7d ?? 0,
          flagged: act?.flagged ?? 0,
        };
      }),
      ...municipalities.map((m) => {
        const load = municipalityLoad.find((l) => l.municipality === m.municipality);
        return {
          id: m.id,
          name: m.name,
          email: m.email ?? '',
          role: m.role,
          permissions: m.permissions,
          isBanned: m.isBanned,
          kind: 'municipality' as const,
          total: load?.actions ?? 0,
          last7d: load?.actions ?? 0,
          flagged: load?.flagged ?? 0,
        };
      }),
    ];

    return rows
      .filter((r) => {
        if (!needle) return true;
        return r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.last7d - a.last7d || b.total - a.total || a.name.localeCompare(b.name));
  }, [agents, municipalities, agentActivity, municipalityLoad, actorQuery]);

  /* --- Inspektimi i një aktori --- */
  const inspectActor = actorList.find((a) => a.id === inspectId) ?? null;
  const inspection = useMemo(
    () => (inspectActor ? collectActorAudit(auditLogs, inspectActor, inspectWindow) : null),
    // accessRefresh is not read inside: it is the dependency that forces a
    // recompute after a grant or a suspension, so the drawer never shows a
    // permission the account no longer holds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auditLogs, inspectActor, inspectWindow, accessRefresh]
  );
  const subjects = useMemo(() => (inspection ? touchedSubjects(inspection) : []), [inspection]);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-xl font-black text-slate-900 dark:text-white">{dt('Akses i kufizuar')}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {dt('Monitorimi është vetëm për stafin e autorizuar.')}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-900 text-white dark:bg-slate-700">
            <Eye className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-black text-slate-950 dark:text-white">
              {dt('Monitorimi i Stafit')}
            </h1>
            <p className="text-xs text-slate-500">
              {dt('Vëzhgim i plotë i veprimeve — pa vendime, vetëm fakte')}
              {isOwner && <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white dark:bg-slate-700">{dt('Akses i plotë')}</span>}
            </p>
          </div>
        </div>

        {/* Scope switcher: the owner can narrow to one municipality. */}
        <select
          value={scoped ? scope : ALL_SCOPE}
          onChange={(e) => setUserMunicipality(e.target.value === ALL_SCOPE ? null : e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white"
        >
          <option value={ALL_SCOPE}>{dt('Të gjitha komunat')}</option>
          {municipalityLoad
            .filter((m) => m.municipality !== ALL_SCOPE)
            .map((m) => <option key={m.municipality} value={m.municipality}>{m.municipality}</option>)}
        </select>
      </header>

      {/* Tabs */}
      <nav className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-white/10 dark:bg-slate-900">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
              tab === id ? 'bg-slate-900 text-white dark:bg-slate-700' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <Icon className="h-4 w-4" />
            {dt(label)}
          </button>
        ))}
      </nav>

      {/* ============ ACTOR — pick a person, then audit and control them ============ */}
      {tab === 'team' && (
        <TeamOverviewPanel onOpenPerson={uid => { setInspectId(uid); setTab('actor'); }} />
      )}

      {tab === 'actor' && (
        <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
          {/* Left: who. Searchable, active actors first. */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={actorQuery}
                onChange={(e) => setActorQuery(e.target.value)}
                placeholder={dt('Kërko email-in ose emrin që do monitorosh…')}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              {actorList.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-white/10">
                  {dt('Nuk ka agjentë ose komuna që përputhen.')}
                </p>
              ) : (
                actorList.map((a) => {
                  const active = a.last7d > 0;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => { setInspectId(a.id); setTab('actor'); }}
                      aria-pressed={inspectId === a.id}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${
                        inspectId === a.id
                          ? 'border-slate-400 bg-slate-100/70 dark:border-slate-500 dark:bg-slate-800'
                          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900 dark:hover:border-white/20'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-800 text-xs font-black text-white dark:bg-slate-700"
                          aria-hidden="true"
                        >
                          {a.name.charAt(0).toUpperCase()}
                          {/* A live dot for anyone who acted this week. */}
                          {active && (
                            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-slate-900 dark:text-white">{a.name}</span>
                          <span className="block truncate text-[11px] text-slate-500">{a.email}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={`block rounded-full px-2 py-0.5 text-[10px] font-black ${
                          a.kind === 'municipality'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                        }`}>
                          {a.kind === 'municipality' ? dt('Komunë') : dt('Agjent')}
                        </span>
                        <span className="mt-0.5 block text-[10px] font-bold text-slate-400">
                          {a.total} {dt('veprime')}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: what they did, and what they may do. */}
          <div className="space-y-4">
            {!inspectActor ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center dark:border-white/10">
                <UserSearch className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">
                  {dt('Zgjidhni një agjent ose komunë për të parë çdo veprim dhe për të kontrolluar qasjen.')}
                </p>
              </div>
            ) : (
              <>
                {/* Window + kind summary */}
                <div className="flex flex-wrap items-center gap-2">
                  {AUDIT_WINDOWS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setInspectWindow(w)}
                      aria-pressed={inspectWindow === w}
                      className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                        inspectWindow === w
                          ? 'bg-slate-900 text-white dark:bg-slate-700'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {dt(WINDOW_LABELS[w])}
                    </button>
                  ))}
                </div>

                {inspection && (
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(ACTION_KIND_LABELS) as Array<keyof typeof ACTION_KIND_LABELS>).map((k) => (
                      <span key={k} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${ACTION_KIND_TONES[k]}`}>
                        {dt(ACTION_KIND_LABELS[k])}: {inspection.byKind[k]}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Access control — grant, revoke, suspend, password. */}
                  <ActorAccessControl
                    account={{
                      id: inspectActor.id,
                      name: inspectActor.name,
                      email: inspectActor.email,
                      // Stored role is an open string: a record can predate the
                      // current role union. `ActorAccessControl` narrows it
                      // against STAFF_ROLES before rendering, so the cast here
                      // records that the value is untrusted, not that it is valid.
                      role: inspectActor.role as User['role'],
                      permissions: inspectActor.permissions,
                      isBanned: inspectActor.isBanned,
                      municipalityPlan: (inspectActor as { municipalityPlan?: string }).municipalityPlan,
                    }}
                    onChanged={() => setAccessRefresh((v) => v + 1)}
                  />

                  {/* What they touched */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                    <h4 className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
                      {dt('Raportimet e prekura')}
                    </h4>
                    {subjects.length === 0 ? (
                      <p className="text-[11px] text-slate-400">{dt('Asnjë raportim i identifikuar.')}</p>
                    ) : (
                      <ul className="max-h-[320px] space-y-1.5 overflow-y-auto">
                        {subjects.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 dark:border-white/5 dark:bg-slate-800/60">
                            <span className="min-w-0">
                              <span className="block truncate font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200">{s.id}</span>
                              <span className="block text-[10px] text-slate-400">{fmtDate(s.lastAt)}</span>
                            </span>
                            <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                              {s.hits}×
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Full timeline */}
                {inspection && (
                  <div className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
                    <h4 className="border-b border-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-white/5">
                      {dt('Çdo veprim')} ({inspection.total})
                    </h4>
                    {inspection.rows.length === 0 ? (
                      <p className="p-6 text-center text-xs text-slate-400">{dt('Nuk ka veprime në këtë periudhë.')}</p>
                    ) : (
                      <ul className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
                        {inspection.rows.slice(0, 200).map(({ log, kind }) => (
                          <li key={log.id} className="flex items-start gap-3 px-4 py-3">
                            <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${ACTION_KIND_TONES[kind]}`}>
                              {dt(ACTION_KIND_LABELS[kind])}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">{log.action}</span>
                              {log.details && (
                                <span className="mt-0.5 block break-words text-[11px] text-slate-500 dark:text-slate-400">
                                  {String(log.details)}
                                </span>
                              )}
                              <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400">
                                <span>{fmtDate(log.createdAt)}</span>
                                {log.municipality && <span>· {log.municipality}</span>}
                                <span className={`rounded-full px-1.5 py-0.5 font-bold ${
                                  log.status === 'danger' ? 'bg-rose-100 text-rose-700'
                                    : log.status === 'warning' ? 'bg-amber-100 text-amber-700'
                                      : 'bg-emerald-100 text-emerald-700'
                                }`}>{log.status}</span>
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* ============ PULSE ============ */}
      {tab === 'pulse' && (
        <section className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Veprime 24h" value={pulse.actions24h} tone="blue" />
            <Stat label="Flamurime 24h" value={pulse.flagged24h} tone="rose" />
            <Stat label="Agjentë aktivë" value={pulse.activeAgents} tone="emerald" />
            <Stat label="Agjentë të heshtur" value={pulse.dormantAgents} tone="amber" />
            <Stat label="Punë të hapura" value={pulse.openReports} tone="indigo" />
            <Stat label="Të vonuara" value={pulse.overdueReports} tone="rose" />
          </div>

          {/* Ngarkesa sipas komunave — ku po shkon puna vërtet. */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <TrendingUp className="h-4 w-4 text-blue-600" /> {dt('Ngarkesa sipas komunave')}
            </h3>
            {municipalityLoad.filter((m) => m.municipality !== ALL_SCOPE).length === 0 ? (
              <p className="text-xs text-slate-500">{dt('Nuk ka veprime të regjistruara akoma.')}</p>
            ) : (
              <ul className="space-y-2">
                {municipalityLoad
                  .filter((m) => m.municipality !== ALL_SCOPE)
                  .slice(0, 12)
                  .map((m) => {
                    const max = Math.max(1, municipalityLoad[0]?.actions ?? 1);
                    return (
                      <li key={m.municipality} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                          {m.municipality}
                        </span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <span
                            className={`block h-full rounded-full ${m.flagged > 0 ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-blue-600'}`}
                            style={{ width: `${Math.round((m.actions / max) * 100)}%` }}
                          />
                        </span>
                        <span className="w-10 shrink-0 text-right text-xs font-black text-slate-700 dark:text-slate-200">
                          {m.actions}
                        </span>
                        {m.flagged > 0 && (
                          <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                            {m.flagged}
                          </span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* ============ DEPARTMENTS ============ */}
      {tab === 'departments' && (
        <section className="space-y-5">
          {/*
            The one-line verdict.

            It is derived from the rows below rather than written by hand, so
            the headline cannot claim everything is fine while a card on the same
            screen shows a breach.
          */}
          <div className={`rounded-xl border p-4 ${
            departments.summary.atRisk > 0
              ? 'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/[0.06]'
              : departments.summary.headline.includes('rregull')
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]'
                : 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/[0.06]'
          }`}>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {dt(departments.summary.headline)}
            </h3>
            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
              {departments.summary.total} {dt('reparte')} · {dt('renditur sipas urgjencës, më problematiku i pari')}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {departments.rows.map((d) => (
              <article
                key={d.id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"
              >
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-black text-slate-900 dark:text-white">{dt(d.label)}</h4>
                    {d.note && <p className="mt-0.5 text-[10px] text-slate-400">{d.note}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${HEALTH_TONES[d.health]}`}>
                    {dt(HEALTH_LABELS[d.health])}
                  </span>
                </header>

                {/* The verdict, in words — a badge alone is not an explanation. */}
                <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{dt(d.verdict)}</p>

                <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {([
                    ['Në pritje', d.backlog, 'text-slate-900 dark:text-white'],
                    ['Qarkullim', d.flow, 'text-emerald-600'],
                    ['Jashtë afatit', d.breach, d.breach > 0 ? 'text-rose-600' : 'text-slate-400'],
                    ['Në punë', `${d.activeStaff}/${d.staff}`, 'text-blue-600'],
                  ] as const).map(([label, value, tone]) => (
                    <div key={label} className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/60">
                      <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{dt(label)}</dt>
                      <dd className={`mt-0.5 text-sm font-black tabular-nums ${tone}`}>{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold dark:bg-slate-800 dark:text-slate-300">
                    {d.loadPerWorker} {dt('punë / punëtor')}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold dark:bg-slate-800 dark:text-slate-300">
                    {d.breachRate}% {dt('jashtë afatit')}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold dark:bg-slate-800 dark:text-slate-300">
                    {d.coverageRate}% {dt('mbulim stafi')}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ============ AGENTS ============ */}
      {tab === 'agents' && (
        <section className="space-y-3">
          {agentActivity.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">
              {dt('Nuk ka agjentë të regjistruar.')}
            </p>
          ) : (
            agentActivity.map((row) => {
              const dormant = row.total > 0 && row.last24h === 0 && isDormant(row.lastAction?.at);
              return (
                <button
                  key={row.agent.id}
                  type="button"
                  onClick={() => { setInspectId(row.agent.id); setTab('pulse'); }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300 dark:border-white/10 dark:bg-slate-900 dark:hover:border-white/20"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-800 text-xs font-black text-white dark:bg-slate-700">
                      {row.agent.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{row.agent.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {row.agent.email || dt('Pa email')} · {row.agent.role}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs">
                    {dormant && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-700">
                        <Clock className="h-3 w-3" /> {dt('I heshtur')}
                      </span>
                    )}
                    {row.last24h > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">{row.last24h} · 24h</span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {row.total} {dt('veprime')}
                    </span>
                    {row.flagged > 0 && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 font-bold text-rose-700">{row.flagged} ⚑</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </span>
                </button>
              );
            })
          )}
        </section>
      )}

      {/* ============ MUNICIPALITIES ============ */}
      {tab === 'municipalities' && (
        <section className="space-y-3">
          {municipalities.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">
              {dt('Nuk ka llogari komunale.')}
            </p>
          ) : (
            municipalities.map((m) => {
              const load = municipalityLoad.find((l) => l.municipality === m.municipality);
              const muniReports = reports.filter((r) => (r.location?.municipality ?? '') === m.municipality);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setInspectId(m.id); setTab('pulse'); }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300 dark:border-white/10 dark:bg-slate-900 dark:hover:border-white/20"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-700 text-white">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                        {m.municipality || m.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">{m.email}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-bold text-blue-700">
                      <MapPin className="h-3 w-3" /> {muniReports.length} {dt('punë')}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {load?.actions ?? 0} {dt('veprime')}
                    </span>
                    {(load?.flagged ?? 0) > 0 && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 font-bold text-rose-700">{load?.flagged} ⚑</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </span>
                </button>
              );
            })
          )}
        </section>
      )}

      {/* ============ ANOMALIES ============ */}
      {tab === 'anomalies' && (
        <section className="space-y-3">
          <p className="text-xs text-slate-500">
            {dt('Rreshtat grupohen sipas veprimit: përsëritja e të njëjtit refuzim është sinjal, një gabim i vetëm nuk është.')}
          </p>
          {anomalies.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-slate-900">
              <ShieldCheck className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm text-slate-500">{dt('Nuk u gjet asnjë anomali.')}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {anomalies.slice(0, 60).map((a, i) => (
                <li
                  key={`${a.log.id}_${i}`}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${
                    a.severity === 'high'
                      ? 'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/[0.06]'
                      : 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/[0.06]'
                  }`}
                >
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${a.severity === 'high' ? 'text-rose-600' : 'text-amber-600'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {a.log.action}
                      {a.count > 1 && (
                        <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-black text-white dark:bg-slate-700">
                          {a.count}×
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">{a.reason}</p>
                    {a.log.details && (
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{String(a.log.details)}</p>
                    )}
                    <p className="mt-1 text-[10px] text-slate-400">
                      {a.log.userName ?? a.log.userEmail} · {fmtDate(a.log.createdAt)} · {a.log.municipality ?? '—'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ============ STREAM ============ */}
      {tab === 'stream' && (
        <section className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dt('Kërko sipas veprimit, personit, detajeve…')}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            />
          </div>

          {filteredStream.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">
              {dt('Nuk ka veprime që përputhen me filtrin.')}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-2 font-semibold">{dt('Kush')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Veprimi')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Detaje')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Komuna')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Kur')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredStream.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[log.status]}`} />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {log.userName ?? log.userEmail}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200">{log.action}</td>
                      <td className="max-w-xs truncate px-4 py-2 text-slate-600 dark:text-slate-300">{log.details ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{log.municipality ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-500">{fmtDate(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/*
        The detail drawer that used to live here has been removed.

        Everything it showed — the window switcher, the kind counts, the touched
        subjects and the full timeline — now lives in the "Zgjidh personin" tab,
        beside the access controls for the same account. Keeping both would mean
        two places to fix whenever the audit shape changes, and two answers to
        the same question.
      */}
    </div>
  );
}

/**
 * Qendra e Moderimit — /moderim
 *
 * Super e detajuar, vetëm për stafin me akses admin. Tre fokus kryesor:
 *   1. Përmbledhje      — numrat e radhës, rreziku, aktive në 24h
 *   2. Debat publik     — postimet me flamurim automatik (AI Guard)
 *   3. Raportimet       — filtri i plotë sipas statusit dhe komunës
 *   4. Agjentët         — aktiviteti, statistika dhe lejet e secilit
 *   5. Komunat          — akses i kufizuar, firewall, log i veprimeve
 *   6. Matrica lejesh   — kush sheh çfarë, një tabelë e vetme
 *   7. Audit log        — çdo veprim i regjistruar
 *
 * E ndërtuar mbi `moderationCenter.ts` — pa rikalkulim në JSX, pa efekte
 * anësore, e sigurt për mijëra rreshta pa u ndërprerë.
 */
import { useMemo, useState } from 'react';
import { dt } from '../lib/dt';
import { useStore } from '../lib/store';
import {
  isModerationCenterUser,
  collectAgents,
  collectMunicipalities,
  computeQueueStats,
  filterReports,
  computeAgentActivity,
  computeMunicipalityActivity,
  classifyRisk,
  ROLE_MATRIX,
  MATRIX_SECTIONS,
  ROLE_MATRIX_LABELS,
  type ReportFilter,
} from '../lib/moderationCenter';
import {
  collectActorAudit,
  touchedSubjects,
  classifyActionKind,
  AUDIT_WINDOWS,
  WINDOW_LABELS,
  ACTION_KIND_LABELS,
  ACTION_KIND_TONES,
  type AuditWindow,
  type ActionKind,
} from '../lib/actorAudit';
import { BAD_WORDS } from '../lib/moderation';
import { roleLabel } from '../lib/adminPermissions';
import { useCitizenDirectory } from '../lib/useCitizenDirectory';
import {
  ShieldAlert, Building2, Users, Activity, Table2, ScrollText, Search,
  AlertTriangle, CheckCircle2, Ban, MessageSquare, FileText, ChevronDown,
  ChevronRight, LayoutDashboard, ArrowUpRight, UserSearch,
} from 'lucide-react';
// (importet e panvendosura janë hequr për të mbajtur module të pastër)

type Tab =
  | 'overview' | 'forum' | 'reports' | 'agents'
  | 'municipalities' | 'inspect' | 'matrix' | 'audit';

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Përmbledhje', icon: LayoutDashboard },
  { id: 'forum', label: 'Debat publik', icon: MessageSquare },
  { id: 'reports', label: 'Raportimet', icon: FileText },
  { id: 'agents', label: 'Agjentët', icon: ShieldAlert },
  { id: 'municipalities', label: 'Komunat', icon: Building2 },
  { id: 'inspect', label: 'Inspekto një person', icon: UserSearch },
  { id: 'matrix', label: 'Matrica e lejeve', icon: Table2 },
  { id: 'audit', label: 'Audit log', icon: ScrollText },
];

const REPORT_STATUSES: ReportFilter[] = [
  'all', 'Draft', 'Pending Review', 'Approved', 'Assigned',
  'In Progress', 'Resolved', 'Rejected', 'Overdue',
];

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600',
  'Pending Review': 'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Assigned: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-indigo-100 text-indigo-700',
  Resolved: 'bg-green-100 text-green-700',
  Rejected: 'bg-rose-100 text-rose-700',
  Overdue: 'bg-red-100 text-red-700',
};

function Stat({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'text-slate-900 dark:text-white',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    indigo: 'text-indigo-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <div className={`text-2xl font-black tabular-nums ${tones[tone] ?? tones.slate}`}>{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{dt(label)}</div>
    </div>
  );
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('sq-AL', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export default function ModerationCenter() {
  const currentUser = useStore((s) => s.currentUser);
  /**
   * Staff and citizens come from the paginated, staff-only directory.
   *
   * `state.users` is empty on a fresh staff session because the collection-wide
   * listener that used to fill it was removed — it downloaded every profile in
   * the country for every visitor and exposed contact details to the browser.
   * The centre therefore rendered no actors at all. The paged hook restores the
   * data at a cost that does not grow with the size of the user base.
   */
  const { citizens } = useCitizenDirectory();
  /**
   * The staff/citizen directory, paged and staff-only. Typed as the directory
   * row so `role`, `permissions`, `municipality` and `notes` are all present
   * without a cast.
   */
  const users = citizens;
  const reports = useStore((s) => s.reports ?? []);
  const auditLogs = useStore((s) => s.auditLogs ?? []);

  const [tab, setTab] = useState<Tab>('overview');
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all');
  const [query, setQuery] = useState('');
  const [muniFilter, setMuniFilter] = useState<string>('all');
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [expandedMuni, setExpandedMuni] = useState<string | null>(null);

  /* --- Per-actor inspection: who to audit, over what window, and by what kind --- */
  const [inspectActorId, setInspectActorId] = useState<string>('');
  const [inspectWindow, setInspectWindow] = useState<AuditWindow>('7d');
  const [inspectKind, setInspectKind] = useState<ActionKind | 'all'>('all');

  /* --- Guard: vetëm stafi i panelit admin --- */
  /**
   * Guard.
   *
   * The centre is for authorised staff, and a field agent may be given it
   * explicitly with the `moderim` grant — the same shape the other two consoles
   * use, so "I granted it and the page refused me" cannot happen here either.
   */
  const allowed =
    isModerationCenterUser(currentUser) ||
    (currentUser?.permissions ?? []).some((p) => p === 'moderim' || p === 'monitoring');

  /* --- Llogaritjet — të gjitha memoized, të pastra --- */
  const agents = useMemo(() => collectAgents(users), [users]);
  const municipalities = useMemo(() => collectMunicipalities(users), [users]);
  const stats = useMemo(() => computeQueueStats(reports), [reports]);
  const agentActivity = useMemo(
    () => computeAgentActivity(agents, auditLogs),
    [agents, auditLogs]
  );
  const muniActivity = useMemo(
    () => computeMunicipalityActivity(municipalities, auditLogs),
    [municipalities, auditLogs]
  );
  const muniNames = useMemo(
    () => [...new Set(reports.map((r) => r.location?.municipality ?? '').filter(Boolean))],
    [reports]
  );
  const filtered = useMemo(
    () => filterReports(reports, reportFilter, query, muniFilter === 'all' ? undefined : muniFilter),
    [reports, reportFilter, query, muniFilter]
  );

  /**
   * The actors a supervisor may pick from: every agent and every municipal
   * account, in one list, because "who did this" does not respect the role a
   * person happens to hold.
   */
  const inspectableActors = useMemo(
    () => [
      ...agents.map((a) => ({ id: a.id, name: a.name, email: a.email ?? '', label: `${a.name} — ${a.role}` })),
      ...municipalities.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email ?? '',
        label: `${m.name} — ${m.municipality ?? dt('komunë')}`,
      })),
    ],
    [agents, municipalities]
  );

  /** Everything the chosen actor did inside the chosen window. */
  const inspectActor = inspectableActors.find((a) => a.id === inspectActorId) ?? null;
  const inspection = useMemo(
    () =>
      inspectActor
        ? collectActorAudit(auditLogs, inspectActor, inspectWindow)
        : null,
    [auditLogs, inspectActor, inspectWindow]
  );

  /** The timeline after the kind filter, plus the subjects they touched. */
  const inspectRows = useMemo(() => {
    if (!inspection) return [];
    return inspectKind === 'all'
      ? inspection.rows
      : inspection.rows.filter((r) => r.kind === inspectKind);
  }, [inspection, inspectKind]);

  const inspectSubjects = useMemo(
    () => (inspection ? touchedSubjects(inspection) : []),
    [inspection]
  );

  /* --- Flamurimi i përmbajtjes --- */
  const flagged = useMemo(() => {
    type Flagged = { id: string; source: 'report' | 'comment'; text: string; author: string; risk: string; at: string; link: string };
    const out: Flagged[] = [];
    for (const r of reports) {
      const risk = classifyRisk(`${r.title ?? ''} ${r.description ?? ''}`, BAD_WORDS);
      if (risk !== 'clean') {
        out.push({
          id: `r_${r.id}`, source: 'report', text: r.title ?? '',
          author: r.authorName ?? '—', risk,
          at: r.createdAt, link: `/raporto?focus=${r.id}`,
        });
      }
      for (const c of r.comments ?? []) {
        const cr = classifyRisk(c.content ?? '', BAD_WORDS);
        if (cr !== 'clean') {
          out.push({
            id: `c_${r.id}_${c.id}`, source: 'comment', text: (c.content ?? '').slice(0, 140),
            author: c.authorName ?? '—', risk: cr,
            at: c.createdAt ?? r.createdAt, link: `/raporto?focus=${r.id}`,
          });
        }
      }
    }
    return out.sort((a, b) => (a.risk === 'violation' ? -1 : 1) - (b.risk === 'violation' ? -1 : 1));
  }, [reports]);

  const violations = flagged.filter((f) => f.risk === 'violation').length;
  const suspects = flagged.filter((f) => f.risk === 'suspect').length;
  const activeAgents24h = agentActivity.filter((a) => a.last24h > 0).length;
  const deniedTotal = muniActivity.reduce((s, m) => s + m.deniedAttempts, 0);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-xl font-black text-slate-900 dark:text-white">{dt('Akses i kufizuar')}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {dt('Kjo faqe është vetëm për Super Adminin dhe stafin e autorizuar.')}
        </p>
      </div>
    );
  }

  /** Super Admin AND administrator see everything — the deep detail is not
   * reserved for one role, or the other admin could not run the platform. */
  const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-rose-600 text-white">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-black text-slate-950 dark:text-white">
              {dt('Qendra e Moderimit')}
            </h1>
            <p className="text-xs text-slate-500">
              {dt('Vetëm staf i autorizuar')} · {roleLabel(currentUser, 'sq')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">{violations} {dt('shkelje')}</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">{suspects} {dt('të dyshimtë')}</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{activeAgents24h} {dt('agjentë aktivë 24h')}</span>
        </div>
      </header>

      {/* Tabs */}
      <nav className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-white/10 dark:bg-slate-900">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${tab === id ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
          >
            <Icon className="h-4 w-4" />
            {dt(label)}
          </button>
        ))}
      </nav>

      {/* ============ OVERVIEW ============ */}
      {tab === 'overview' && (
        <section className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total raportime" value={stats.total} />
            <Stat label="Në pritje" value={stats.pendingReview} tone="amber" />
            <Stat label="Zgjidhur" value={stats.resolved} tone="emerald" />
            <Stat label="Retarduar" value={stats.overdue} tone="rose" />
            <Stat label="Aprovuar" value={stats.approved} tone="indigo" />
            <Stat label="Refuzuar" value={stats.rejected} tone="rose" />
            <Stat label="Shkelje gjuhe" value={violations} tone="rose" />
            <Stat label="Ora mes. zgjidhje" value={stats.avgResolutionHours} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Users className="h-4 w-4 text-blue-600" /> {dt('Agjentët')}
              </h3>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{agents.length}</p>
              <p className="text-xs text-slate-500">{activeAgents24h} {dt('aktivë në 24h')}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Building2 className="h-4 w-4 text-indigo-600" /> {dt('Komunat')}
              </h3>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{municipalities.length}</p>
              <p className="text-xs text-slate-500">{deniedTotal} {dt('refuzime të regjistruara')}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Activity className="h-4 w-4 text-rose-600" /> {dt('Flamurime')}
              </h3>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{flagged.length}</p>
              <p className="text-xs text-slate-500">{dt('postime dhe komente me rrezik')}</p>
            </div>
          </div>

          {/* Top violators */}
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-rose-800 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" /> {dt('Përmbajtja me prioritet — shkelje')}
            </h3>
            {violations === 0 ? (
              <p className="text-xs text-rose-700 dark:text-rose-300">{dt('Asnjë shkelje aktive.')}</p>
            ) : (
              <ul className="space-y-2">
                {flagged.filter((f) => f.risk === 'violation').slice(0, 10).map((f) => (
                  <li key={f.id} className="flex items-start gap-2 text-xs text-rose-900 dark:text-rose-200">
                    <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div>
                      <span className="font-bold">[{f.source === 'report' ? dt('Raportim') : dt('Koment')}]</span> {f.text}
                      <span className="ml-2 text-rose-600 dark:text-rose-400">— {f.author}, {fmtDate(f.at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* ============ FORUM ============ */}
      {tab === 'forum' && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={dt('Kërko në postime…')}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-rose-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>
          {flagged.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-slate-900">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm text-slate-500">{dt('Asnjë përmbajtje e flamuruar.')}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-2 font-semibold">{dt('Burimi')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Përmbajtja')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Autori')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Rreziku')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Data')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {flagged.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300">
                        {f.source === 'report' ? dt('Raportim') : dt('Koment')}
                      </td>
                      <td className="max-w-xs truncate px-4 py-2 text-slate-700 dark:text-slate-200">{f.text}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{f.author}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 font-bold ${f.risk === 'violation' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                          {f.risk === 'violation' ? dt('Shkelje') : dt('E dyshimtë')}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{fmtDate(f.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ============ REPORTS ============ */}
      {tab === 'reports' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={dt('Kërko titull, përshkrim, komunë…')}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-rose-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <select
              value={muniFilter}
              onChange={(e) => setMuniFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white"
            >
              <option value="all">{dt('Të gjitha komunat')}</option>
              {muniNames.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {REPORT_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setReportFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${reportFilter === s ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
              >
                {s === 'all' ? dt('Të gjitha') : s}
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-500">{filtered.length} {dt('raportime')}</p>

          <div className="space-y-2">
            {filtered.slice(0, 100).map((r) => {
              const risk = classifyRisk(`${r.title ?? ''} ${r.description ?? ''}`, BAD_WORDS);
              return (
                <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[r.status] ?? ''}`}>
                        {r.status}
                      </span>
                      {risk !== 'clean' && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${risk === 'violation' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                          {risk === 'violation' ? dt('Gjuhë e përshtatshme jo') : dt('E dyshimtë')}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{r.title}</p>
                    <p className="text-xs text-slate-500">
                      {r.location?.municipality ?? '—'} · {fmtDate(r.createdAt)} · {r.authorName ?? '—'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-500">
                    <p>{r.upvotes ?? 0} 👍</p>
                    <p>{(r.comments ?? []).length} 💬</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ============ AGENTS ============ */}
      {tab === 'agents' && (
        <section className="space-y-3">
          {agentActivity.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-slate-900">
              <p className="text-sm text-slate-500">{dt('Nuk ka agjentë të regjistruar.')}</p>
            </div>
          ) : (
            agentActivity.map((row) => {
              const isExpanded = expandedAgent === row.agent.id;
              const agentUser = agents.find((a) => a.id === row.agent.id);
              return (
                <div key={row.agent.id} className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setExpandedAgent(isExpanded ? null : row.agent.id)}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{row.agent.name}</p>
                        <p className="text-xs text-slate-500">{row.agent.email} · {row.agent.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {row.last24h > 0 && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">{row.last24h} {dt('24h')}</span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {row.totalActions} {dt('veprime')}
                      </span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 font-bold text-blue-700">{row.approvalRate}%</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4 dark:border-white/5">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Stat label="Vetëm 24h" value={row.last24h} />
                        <Stat label="Vetëm 7 ditë" value={row.last7d} />
                        <Stat label="Aprovime" value={row.approvals} tone="emerald" />
                        <Stat label="Refuzime" value={row.rejections} tone="rose" />
                      </div>
                      <div className="mt-3">
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{dt('Vetëm veprime të moderimit')}:</p>
                        <p className="text-sm text-slate-900 dark:text-white">{row.moderationActions}</p>
                      </div>
                      <div className="mt-3">
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{dt('Vetëm veprimi i fundit')}:</p>
                        <p className="text-sm text-slate-900 dark:text-white">{fmtDate(row.lastActionAt)}</p>
                      </div>
                      {agentUser && (
                        <div className="mt-3">
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{dt('Seksionet e lejuara')}:</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(agentUser.permissions ?? []).map((p) => (
                              <span key={p} className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{p}</span>
                            ))}
                            {(!agentUser.permissions || agentUser.permissions.length === 0) && (
                              <span className="text-xs text-slate-500">{dt('Vetëm rolet e parazgjedhura')}</span>
                            )}
                          </div>
                        </div>
                      )}
                      {agentUser?.notes && (
                        <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                          {agentUser.notes}
                        </p>
                      )}

                      {/* Deep view: the agent's own professional console. */}
                      <a
                        href="/agent"
                        className="mt-3 inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-1.5 text-[11px] font-black text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10"
                      >
                        {dt('Hap panelin e agjentit')} <ArrowUpRight className="h-3 w-3" />
                      </a>

                      {/* ============ DETALE E PLOTË: çka kanë bërë / hequr ============ */}
                      {isSuperAdmin && (
                        <div className="mt-4">
                          <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                            {dt('Kronologjia e plotë e veprimeve (vetëm Super Admin)')}
                          </p>
                          <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950">
                            {auditLogs
                              .filter((l) => l.userId === row.agent.id || l.userName === row.agent.name)
                              .slice(0, 50)
                              .map((log) => (
                                <div key={log.id} className="flex items-start gap-2 text-xs">
                                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                    log.status === 'danger' ? 'bg-rose-500'
                                    : log.status === 'warning' ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                  }`} />
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 dark:text-white">{log.action}</p>
                                    {log.details && <p className="truncate text-slate-600 dark:text-slate-300">{log.details}</p>}
                                    <p className="text-[10px] text-slate-400">{fmtDate(log.createdAt)} · {log.municipality ?? '—'}</p>
                                  </div>
                                </div>
                              ))}
                            {auditLogs.filter((l) => l.userId === row.agent.id || l.userName === row.agent.name).length === 0 && (
                              <p className="text-xs text-slate-500">{dt('Nuk ka veprime të regjistruara.')}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      )}

      {/* ============ MUNICIPALITIES ============ */}
      {tab === 'municipalities' && (
        <section className="space-y-3">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-200">
            <strong>{dt('Aksesi i kufizuar')}:</strong>{' '}
            {dt('Komuna sheh vetëm raportimet e aprovuara për komunën e vet, mund të shtojë fakte dhe përgjigje — nuk mund të fshijë, fshehë ose të ndryshojë asgjë.')}
          </div>

          {muniActivity.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-slate-900">
              <p className="text-sm text-slate-500">{dt('Nuk ka llogari komunale aktive.')}</p>
            </div>
          ) : (
            muniActivity.map((row) => {
              const isExpanded = expandedMuni === row.account.id;
              const muniUser = municipalities.find((m) => m.id === row.account.id);
              const muniReports = reports.filter(
                (r) => (r.location?.municipality ?? '') === row.municipality
              );
              return (
                <div key={row.account.id} className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setExpandedMuni(isExpanded ? null : row.account.id)}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{row.municipality || row.account.name}</p>
                        <p className="text-xs text-slate-500">{row.account.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {muniReports.length} {dt('raportime')}
                      </span>
                      {row.deniedAttempts > 0 && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 font-bold text-rose-700">
                          {row.deniedAttempts} {dt('refuzime')}
                        </span>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4 dark:border-white/5">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Stat label="Raportime" value={muniReports.length} />
                        <Stat label="Zgjidhur" value={muniReports.filter((r) => r.status === 'Resolved').length} tone="emerald" />
                        <Stat label="Veprime" value={row.totalActions} />
                        <Stat label="Refuzime" value={row.deniedAttempts} tone="rose" />
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-bold text-emerald-700">{dt('Mund')}:</p>
                          <ul className="mt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                            <li>· {dt('Shohë raportimet e aprovuara')}</li>
                            <li>· {dt('Përgjigjet zyrtare')}</li>
                            <li>· {dt('Shtoj fakte punimesh')}</li>
                            <li>· {dt('Ngarkoj dokumente')}</li>
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-rose-700">{dt('Nuk mund')}:</p>
                          <ul className="mt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                            <li>· {dt('Fshijë raportime')}</li>
                            <li>· {dt('Fshihë komente')}</li>
                            <li>· {dt('Ndryshojë tekst original')}</li>
                            <li>· {dt('Shohë raportime të paprovuara')}</li>
                          </ul>
                        </div>
                      </div>
                      {muniUser && (
                          <div className="mt-3">
                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{dt('Plani')}:</p>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {muniUser.municipalityPlan ?? 'basic'}
                              {muniUser.notes && <span className="ml-2 text-xs text-slate-500">({muniUser.notes})</span>}
                            </p>
                          </div>
                        )}

                        {/* Deep view: the municipality's own work console. */}
                        <a
                          href="/komuna"
                          className="mt-3 inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-3 py-1.5 text-[11px] font-black text-indigo-700 transition-colors hover:bg-indigo-50 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                        >
                          {dt('Hap panelin e komunës')} <ArrowUpRight className="h-3 w-3" />
                        </a>

                      {/* ============ ZGJERIMI I PUNËVE PËR QYTETIN ============ */}
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                          {dt('Punët e komunës — statusi i zgjerimit')}
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <Stat label="Në pritje" value={muniReports.filter((r) => r.status === 'Pending Review').length} tone="amber" />
                          <Stat label="Në punim" value={muniReports.filter((r) => r.status === 'In Progress').length} tone="indigo" />
                          <Stat label="Të caktuara" value={muniReports.filter((r) => r.status === 'Assigned').length} />
                          <Stat label="Të përfunduara" value={muniReports.filter((r) => r.status === 'Resolved').length} tone="emerald" />
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="mb-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">{dt('Radha e punëve — e parë në mënyrë profesionale')}:</p>
                        <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950">
                          {muniReports.slice(0, 30).map((r) => (
                            <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                              <div className="min-w-0">
                                <p className="truncate font-bold text-slate-900 dark:text-white">{r.title}</p>
                                <p className="text-[10px] text-slate-400">{fmtDate(r.createdAt)}</p>
                              </div>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[r.status] ?? ''}`}>
                                {r.status}
                              </span>
                            </div>
                          ))}
                          {muniReports.length === 0 && (
                            <p className="text-xs text-slate-500">{dt('Nuk ka punë aktive për këtë komunë.')}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      )}

      {/* ============ INSPECT ONE PERSON ============ */}
      {tab === 'inspect' && (
        <section className="space-y-4">
          {/*
            The supervisor's question, stated plainly: pick a person, pick a
            window, see everything they did — including what they removed.
          */}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {dt('Zgjidh agjentin ose komunën')}
              </span>
              <select
                value={inspectActorId}
                onChange={(e) => setInspectActorId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              >
                <option value="">{dt('Zgjidhni një person…')}</option>
                {inspectableActors.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {dt('Periudha')}
              </span>
              <select
                value={inspectWindow}
                onChange={(e) => setInspectWindow(e.target.value as AuditWindow)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white"
              >
                {AUDIT_WINDOWS.map((w) => (
                  <option key={w} value={w}>{dt(WINDOW_LABELS[w])}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {dt('Lloji i veprimit')}
              </span>
              <select
                value={inspectKind}
                onChange={(e) => setInspectKind(e.target.value as ActionKind | 'all')}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white"
              >
                <option value="all">{dt('Të gjitha')}</option>
                {(Object.keys(ACTION_KIND_LABELS) as ActionKind[]).map((k) => (
                  <option key={k} value={k}>{dt(ACTION_KIND_LABELS[k])}</option>
                ))}
              </select>
            </label>
          </div>

          {!inspectActor || !inspection ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center dark:border-white/10">
              <UserSearch className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">
                {dt('Zgjidhni një person për të parë çdo veprim, ndryshim dhe fshirje.')}
              </p>
            </div>
          ) : (
            <>
              {/* Header: who, how much, and what kind of work it was. */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">{inspectActor.name}</h3>
                    <p className="text-xs text-slate-500">{inspectActor.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">{inspection.total}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {dt('veprime në periudhën')} · {dt(WINDOW_LABELS[inspectWindow])}
                    </p>
                  </div>
                </div>

                {inspection.firstAt && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    {dt('Nga')} {fmtDate(inspection.firstAt)} {dt('deri')} {fmtDate(inspection.lastAt)}
                  </p>
                )}

                {/* Counts by kind — a deletion is not the same as an approval. */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(Object.keys(ACTION_KIND_LABELS) as ActionKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setInspectKind(inspectKind === k ? 'all' : k)}
                      aria-pressed={inspectKind === k}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-opacity ${ACTION_KIND_TONES[k]} ${
                        inspectKind === 'all' || inspectKind === k ? 'opacity-100' : 'opacity-45'
                      }`}
                    >
                      {dt(ACTION_KIND_LABELS[k])}: {inspection.byKind[k]}
                    </button>
                  ))}
                </div>

                {inspection.municipalities.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{dt('Ka vepruar në')}:</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {inspection.municipalities.map((m) => (
                        <span key={m} className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                {/* The timeline itself */}
                <div className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
                  <h4 className="border-b border-slate-100 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 dark:border-white/5">
                    {dt('Çdo veprim, me radhë')}
                  </h4>
                  {inspectRows.length === 0 ? (
                    <p className="p-8 text-center text-xs text-slate-500">
                      {dt('Nuk ka veprime të këtij lloji në këtë periudhë.')}
                    </p>
                  ) : (
                    <ul className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
                      {inspectRows.map(({ log, kind }) => (
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

                {/* What specifically was touched — the "which profiles" answer. */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                  <h4 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                    {dt('Raportimet e prekura')}
                  </h4>
                  {inspectSubjects.length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                      {dt('Asnjë raportim i identifikuar nga regjistri i veprimeve.')}
                    </p>
                  ) : (
                    <ul className="max-h-[500px] space-y-1.5 overflow-y-auto">
                      {inspectSubjects.map((s) => (
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
            </>
          )}
        </section>
      )}

      {/* ============ MATRIX ============ */}
      {tab === 'matrix' && (
        <section>
          <p className="mb-3 text-xs text-slate-500">
            {dt('Çdo rresht = një rol. Çdo kolonë = një seksion paneli admin. vetëm ✕ = pa akses.')}
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 font-semibold">{dt('Roli')}</th>
                  {MATRIX_SECTIONS.map((s) => (
                    <th key={s} className="px-2 py-2 text-center font-semibold">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {Object.entries(ROLE_MATRIX).map(([role, sections]) => (
                  <tr key={role} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">
                      {ROLE_MATRIX_LABELS[role] ?? role}
                    </td>
                    {MATRIX_SECTIONS.map((s) => (
                      <td key={s} className="px-2 py-2 text-center">
                        {sections.includes('*') || sections.includes(s) ? (
                          <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                        ) : (
                          <Ban className="mx-auto h-4 w-4 text-slate-300 dark:text-slate-600" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ============ AUDIT ============ */}
      {tab === 'audit' && (
        <section>
          {auditLogs.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-slate-900">
              <p className="text-sm text-slate-500">{dt('Nuk ka regjistrime akoma.')}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-2 font-semibold">{dt('Veprimi')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Përdoruesi')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Komuna')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Statusi')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Data')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {auditLogs.slice(0, 200).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200">{log.action}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{log.userName ?? log.userEmail}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{log.municipality ?? '—'}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 font-bold ${log.status === 'danger' ? 'bg-rose-100 text-rose-700'
                            : log.status === 'warning' ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{fmtDate(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

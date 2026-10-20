import { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, Clock, Eye, FileText, Filter, MapPin, RefreshCw, Search, ShieldAlert, UserCheck, Users, X
} from 'lucide-react';
import { useStore } from '../../lib/store';
import { useCitizenDirectory } from '../../lib/useCitizenDirectory';
import { useAgentActivity, useMunicipalityLoad, type AgentIdentity } from '../../lib/agentActivity';
import { ALL_SCOPE, isSpecificScope, scopeKey } from '../../lib/municipalityScope';
import { STAFF_ROLES } from '../../lib/adminPermissions';
import { cn } from '../../lib/utils';
import { getReportTopicLabel } from '../../lib/reportTopics';

/**
 * Deep, scope-aware monitoring of every staff member.
 *
 * Three questions this answers, none of which the previous console could:
 *
 *   1. Who is active, right now, and where?        (per-agent rows)
 *   2. Which municipality is absorbing the work?    (the 38-bucket table)
 *   3. Which actions were flagged and by whom?      (the review queue)
 *
 * Every figure is read from the audit log. Where the old console substituted a
 * fabricated number for a staffer with no history, this shows 0 and says so.
 */
export default function AdminAgentMonitoring() {
  const { citizens, isLoading, error } = useCitizenDirectory();
  const scope = useStore((state) => state.userMunicipality);
  const scoped = isSpecificScope(scope);
  const wanted = scopeKey(scope);

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date().toISOString());
  /** The agent whose detail drawer is open, if any. */
  const [selectedAgent, setSelectedAgent] = useState<AgentIdentity | null>(null);

  /**
   * The directory is paginated and returns one page. Filtering a single page
   * by role is honest about what it shows, so the header states the row count
   * rather than implying it is the whole staff of 38 municipalities.
   */
  const identities = useMemo<AgentIdentity[]>(
    () =>
      citizens
        .filter((c) => (STAFF_ROLES as readonly string[]).includes(c.role) || (c.permissions?.length ?? 0) > 0)
        .map((c) => ({ id: c.id, name: c.name, email: c.email, role: c.role })),
    [citizens]
  );

  const activity = useAgentActivity(identities);
  const municipalityLoad = useMunicipalityLoad();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return activity.filter((row) => {
      if (roleFilter !== 'all' && row.agent.role !== roleFilter) return false;
      if (onlyFlagged && row.flagged === 0) return false;
      if (!needle) return true;
      return row.agent.name.toLowerCase().includes(needle) || row.agent.email.toLowerCase().includes(needle);
    });
  }, [activity, query, roleFilter, onlyFlagged]);

  const totals = useMemo(
    () => ({
      staff: activity.length,
      active24h: activity.filter((r) => r.last24h > 0).length,
      flagged: activity.reduce((sum, r) => sum + r.flagged, 0),
      municipalities: municipalityLoad.filter((m) => m.municipality !== ALL_SCOPE).length,
    }),
    [activity, municipalityLoad]
  );

  const topMunicipalities = useMemo(
    () => municipalityLoad.filter((m) => m.municipality !== ALL_SCOPE).slice(0, 12),
    [municipalityLoad]
  );

  const maxLoad = Math.max(1, ...topMunicipalities.map((m) => m.actions));

  /** All audit logs for the selected agent, newest first — the drawer's timeline. */
  const auditLogs = useStore((state) => state.auditLogs || []);
  const reports = useStore((state) => state.reports || []);
  const selectedLogs = useMemo(() => {
    if (!selectedAgent) return [];
    return auditLogs
      .filter((log) =>
        (log.userId && log.userId === selectedAgent.id) ||
        (log.userEmail && selectedAgent.email && log.userEmail.toLowerCase() === selectedAgent.email.toLowerCase())
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [auditLogs, selectedAgent]);

  /** Reports the selected agent has touched (timeline mentions or audit refs). */
  const selectedReports = useMemo(() => {
    if (!selectedAgent) return [];
    const byId = new Map(reports.map((r) => [r.id, r]));
    const seen = new Set<string>();
    const out: typeof reports = [];
    for (const log of selectedLogs) {
      const match = String(log.details || '').match(/\b((?:RPT|ZQ)-[A-Za-z0-9-]{6,})\b/);
      if (match && byId.has(match[1]) && !seen.has(match[1])) {
        seen.add(match[1]);
        out.push(byId.get(match[1])!);
      }
    }
    // Also pick up reports whose timeline explicitly credits the agent.
    for (const report of reports) {
      if (seen.has(report.id)) continue;
      const touched = (report.timeline || []).some((event: any) =>
        event.updatedBy && (
          event.updatedBy === selectedAgent.name ||
          (selectedAgent.email && event.updatedBy.toLowerCase() === selectedAgent.email.toLowerCase())
        )
      );
      if (touched) {
        seen.add(report.id);
        out.push(report);
      }
    }
    return out;
  }, [selectedAgent, selectedLogs, reports]);

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
        <RefreshCw className="h-6 w-6 animate-spin text-rose-500" />
        <span className="text-xs font-semibold">Duke ngarkuar regjistrin e stafit…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-950/30 dark:text-rose-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2.5 text-xl font-black tracking-tight text-slate-900 dark:text-white">
              <Activity className="h-5 w-5 text-rose-500" />
              Monitorimi i Agjentëve në Detaje
            </h2>
            <p className="mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {scoped
                ? `Të gjitha shifrat janë të kufizuara në ${wanted}.`
                : 'Të gjitha shifrat janë për të 38 komunat e Kosovës.'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Përditësuar</p>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {new Date(lastRefreshed).toLocaleString('sq-AL')}
            </p>
            <button
              type="button"
              onClick={() => setLastRefreshed(new Date().toISOString())}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-500"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Rifresko
            </button>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile icon={Users} label="Stafi në regjistër" value={totals.staff} tone="slate" />
          <Tile icon={UserCheck} label="Aktivë sot" value={totals.active24h} tone="emerald" />
          <Tile icon={AlertTriangle} label="Veprime të flaguara" value={totals.flagged} tone="rose" />
          <Tile icon={MapPin} label="Komuna të mbuluara" value={totals.municipalities} tone="blue" />
        </div>
      </div>

      {/* Per-agent table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 dark:border-white/5 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <ShieldAlert className="h-4 w-4 text-rose-500" />
            Agjentët ({rows.length})
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Kërko agjentin…"
                aria-label="Kërko agjentin"
                className="min-h-9 w-52 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-semibold outline-none focus:border-rose-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filtro rolin"
              className="min-h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold outline-none focus:border-rose-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">Të gjitha rolet</option>
              {STAFF_ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setOnlyFlagged((value) => !value)}
              aria-pressed={onlyFlagged}
              className={cn(
                'inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors',
                onlyFlagged
                  ? 'bg-rose-600 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300'
              )}
            >
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              Vetëm të flaguara
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[54rem] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3">Agjenti</th>
                <th className="px-5 py-3">Roli</th>
                <th className="px-5 py-3 text-right">24 orë</th>
                <th className="px-5 py-3 text-right">7 ditë</th>
                <th className="px-5 py-3 text-right">Në këtë komunë</th>
                <th className="px-5 py-3 text-right">Aprovime</th>
                <th className="px-5 py-3">Komunat</th>
                <th className="px-5 py-3">Veprimi i fundit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                    <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    <p className="font-bold">Nuk u gjet asnjë agent për këtë filtr.</p>
                  </td>
                </tr>
              )}

              {rows.map((row) => (
                <tr
                  key={row.agent.id}
                  onClick={() => setSelectedAgent(row.agent)}
                  className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  title="Kliko për detajet e plota të agjentit"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[11px] font-black text-white dark:bg-slate-700">
                        {row.agent.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900 dark:text-white">{row.agent.name}</p>
                        <p className="truncate text-[10px] text-slate-400">{row.agent.email || 'Pa email'}</p>
                      </div>
                      {row.flagged > 0 && (
                        <span
                          className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                          title={`${row.flagged} veprime të flaguara`}
                        >
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          {row.flagged}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <RolePill role={row.agent.role} />
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-700 dark:text-slate-200">{row.last24h}</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-700 dark:text-slate-200">{row.last7d}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={cn('font-black', row.inScope > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-300 dark:text-slate-600')}>
                      {row.inScope}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <span className="w-8 text-right font-bold text-slate-700 dark:text-slate-200">{row.approvalRate}%</span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <span
                          className="block h-full rounded-full bg-emerald-500"
                          style={{ width: `${row.approvalRate}%` }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex max-w-[9rem] flex-wrap gap-1">
                      {row.municipalities.length === 0 ? (
                        <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                      ) : (
                        row.municipalities.slice(0, 3).map((m) => (
                          <span
                            key={m}
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[9px] font-bold',
                              m === wanted && scoped
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                            )}
                          >
                            {m}
                          </span>
                        ))
                      )}
                      {row.municipalities.length > 3 && (
                        <span className="text-[9px] font-bold text-slate-400">+{row.municipalities.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {row.lastAction ? (
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-700 dark:text-slate-200">{row.lastAction.action}</p>
                        <p className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                          {new Date(row.lastAction.at).toLocaleString('sq-AL')}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-300 dark:text-slate-600">Pa veprime</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 transition-colors hover:border-rose-300 hover:text-rose-600 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300">
                      <Eye className="h-3 w-3" aria-hidden="true" />
                      Detaje
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent detail drawer */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Mbyll detajet"
            onClick={() => setSelectedAgent(null)}
            className="absolute inset-0 bg-slate-900/60 md:backdrop-blur-sm"
          />
          <aside className="relative z-10 flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl dark:bg-slate-900">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 p-5 backdrop-blur dark:border-white/5 dark:bg-slate-900/95">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-base font-black text-white dark:bg-slate-700">
                  {selectedAgent.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">{selectedAgent.name}</h3>
                  <p className="text-[11px] text-slate-400">{selectedAgent.email || 'Pa email'} · {selectedAgent.role}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAgent(null)}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 p-5">
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <Activity className="h-3.5 w-3.5 text-rose-500" />
                  Veprimet ({selectedLogs.length})
                </h4>
                {selectedLogs.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-white/10">
                    Ky agjent nuk ka veprime të regjistruara akoma.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {selectedLogs.slice(0, 40).map((log) => (
                      <li key={log.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs dark:border-white/5 dark:bg-slate-800/60">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-100">{log.action}</span>
                          <span className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Clock className="h-2.5 w-2.5" /> {new Date(log.createdAt).toLocaleString('sq-AL')}
                          </span>
                        </div>
                        {log.details && <p className="mt-1 leading-relaxed text-slate-500 dark:text-slate-400">{String(log.details)}</p>}
                        {log.municipality && (
                          <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                            <MapPin className="h-2.5 w-2.5" /> {log.municipality}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div>
                <h4 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <FileText className="h-3.5 w-3.5 text-indigo-500" />
                  Raportet e prekura ({selectedReports.length})
                </h4>
                {selectedReports.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-white/10">
                    Asnjë raport i lidhur direkt me këtë agjent.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {selectedReports.map((report) => (
                      <li key={report.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-white/5 dark:bg-slate-800/60">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{report.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold dark:bg-slate-700">{report.trackingId || report.id}</span>
                          <span>{report.status}</span>
                          <span>{getReportTopicLabel(report)}</span>
                          {report.location?.municipality && <span className="font-bold">{report.location.municipality}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Municipality workload */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-100 p-5 dark:border-white/5">
          <BarChart3 className="h-4 w-4 text-blue-600" />
          <h3 className="font-bold text-slate-900 dark:text-white">Ngarkesa sipas komunave</h3>
          <span className="ml-auto text-[10px] font-bold text-slate-400">12 më e larta</span>
        </div>

        {topMunicipalities.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-400">
            Nuk ka akoma veprime të regjistruara për të shpërndarë sipas komunave.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {topMunicipalities.map((m) => (
              <li key={m.municipality} className="flex items-center gap-4 px-5 py-3">
                <span className="w-28 shrink-0 truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                  {m.municipality}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      m.flagged > 0 ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-blue-600'
                    )}
                    style={{ width: `${Math.round((m.actions / maxLoad) * 100)}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right text-xs font-black text-slate-700 dark:text-slate-200">
                  {m.actions}
                </span>
                {m.flagged > 0 && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                    <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                    {m.flagged}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone: 'slate' | 'emerald' | 'rose' | 'blue';
}) {
  const tones = {
    slate: 'bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  } as const;

  return (
    <div className={cn('rounded-xl p-4', tones[tone])}>
      <Icon className="h-4 w-4 opacity-70" aria-hidden="true" />
      <p className="mt-2 text-2xl font-black leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
    </div>
  );
}

function RolePill({ role }: { role: string }) {
  const tone =
    role === 'admin' || role === 'superadmin'
      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
      : role === 'approver'
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';

  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider', tone)}>
      {role}
    </span>
  );
}

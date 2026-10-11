/**
 * Qendra e Moderimit — logjika e perbashket per faqen `/moderim`.
 *
 * Kjo eshte nje shtrese e vetme llogaritjeje mbi tre burimet e te dhenave:
 *   - `users`   (agjentet, komunat, stafi)
 *   - `reports` (radha e raportimeve)
 *   - `auditLogs` (regjistri i pandryshueshem i veprimeve)
 *
 * Qellimi: faqja e moderimit te marre te gjitha numrat dhe filtrat nga ketu,
 * nuk i rikalkulon ne JSX. Nje rregulle = nje vend, e lehte per t'u testuar,
 * e lehte per t'u lexuar, e sigurt per miliona perdorues (te gjitha funksionet
 * jane te pastra, pa efekte anesore).
 */

import type { Report, User, AuditLog, IssueStatus } from '../types';
import { canAccessAdmin } from './adminPermissions';

/**
 * KYC: kjo logjikë i përket VETËM panelit admin.
 * Çdo funksion këtu thirret nga seksionet e `/admin` — asnjë faqe publike,
 * asnjë panel komunal dhe asnjë agjent nuk e përdor. Kufizohet me një guard
 * të vetëm që ridërgon te `adminPermissions`, pra një burim i vetëm i së vërtetës.
 */
export function isModerationCenterUser(
  user: Parameters<typeof canAccessAdmin>[0]
): boolean {
  return canAccessAdmin(user);
}

/* ------------------------------------------------------------------ */
/* Filtrimi i stafit                                                   */
/* ------------------------------------------------------------------ */

/** Rolet e terrenit qe i perkasen panelit te agjenteve. */
export const AGENT_ROLES = ['agent', 'responder', 'dispatcher'] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export const isAgentRole = (role: string | undefined): role is AgentRole =>
  !!role && (AGENT_ROLES as readonly string[]).includes(role);

/**
 * The minimum a row must carry to be classified.
 *
 * Deliberately narrow: these two helpers only ever read `role`, and the rows
 * that reach them now come from the paginated staff directory, whose summary
 * shape is a strict subset of `User`. Requiring the full profile here forced the
 * caller to cast, which is exactly the kind of lie that hides a real mismatch.
 */
export interface RoleBearing {
  role: string;
}

/** Te gjithe agjentet e stafit te terrenit. */
export function collectAgents<T extends RoleBearing>(users: readonly T[]): T[] {
  return users.filter((u) => isAgentRole(u.role));
}

/** Te gjitha llogarite komunale aktive. */
export function collectMunicipalities<T extends RoleBearing>(users: readonly T[]): T[] {
  return users.filter((u) => u.role === 'municipality');
}

/* ------------------------------------------------------------------ */
/* Statistika e radhes                                                 */
/* ------------------------------------------------------------------ */

export interface QueueStats {
  total: number;
  pendingReview: number;
  approved: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  overdue: number;
  /** Koha mesatare e zgjidhjes ne ore, per raportimet e zgjidhura. */
  avgResolutionHours: number;
}

export function computeQueueStats(reports: readonly Report[]): QueueStats {
  const by: Record<IssueStatus, number> = {
    Draft: 0, 'Pending Review': 0, Approved: 0, Assigned: 0,
    'In Progress': 0, Resolved: 0, Rejected: 0, Closed: 0, Overdue: 0,
  };
  let resolutionMsSum = 0;
  let resolvedCount = 0;

  for (const r of reports) {
    if (by[r.status] !== undefined) by[r.status] += 1;
    if (r.status === 'Resolved' && r.updatedAt) {
      const start = Date.parse(r.createdAt);
      const end = Date.parse(r.updatedAt);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        resolutionMsSum += end - start;
        resolvedCount += 1;
      }
    }
  }

  return {
    total: reports.length,
    pendingReview: by['Pending Review'],
    approved: by.Approved + by.Assigned + by['In Progress'],
    inProgress: by['In Progress'],
    resolved: by.Resolved,
    rejected: by.Rejected,
    overdue: by.Overdue,
    avgResolutionHours: resolvedCount > 0
      ? Math.round((resolutionMsSum / resolvedCount) / 36e5)
      : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Filtrimi i raportimeve                                              */
/* ------------------------------------------------------------------ */

export type ReportFilter = 'all' | IssueStatus;

export function filterReports(
  reports: readonly Report[],
  filter: ReportFilter,
  query: string,
  municipality?: string
): Report[] {
  const q = query.trim().toLowerCase();
  return reports.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (municipality && (r.location?.municipality ?? '') !== municipality) return false;
    if (!q) return true;
    return (
      r.title?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.location?.municipality?.toLowerCase().includes(q)
    );
  });
}

/* ------------------------------------------------------------------ */
/* Aktiviteti per agjent                                               */
/* ------------------------------------------------------------------ */

export interface AgentActivityRow {
  agent: { id: string; name: string; email?: string; role: string };
  totalActions: number;
  last24h: number;
  last7d: number;
  approvals: number;
  rejections: number;
  moderationActions: number;
  lastActionAt: string | null;
  approvalRate: number;
}

const MOD_ACTIONS = ['moderat', 'delete', 'hide', 'approve', 'reject', 'ban'];

export function computeAgentActivity(
  agents: readonly (RoleBearing & Pick<User, 'id' | 'name' | 'email'>)[],
  logs: readonly AuditLog[]
): AgentActivityRow[] {
  const now = Date.now();
  const dayAgo = now - 24 * 36e5;
  const weekAgo = now - 7 * 24 * 36e5;

  /**
   * Bucket the log by actor once, then read each bucket.
   *
   * The previous shape ran four `.filter()` passes over every log for every
   * agent — O(agents × logs). With the 500-row staff feed that was survivable;
   * with a per-actor detail view reading thousands of rows it is not, and the
   * panel freezes on open. One pass builds the index, and every per-agent figure
   * below is a walk over only that agent's own entries.
   *
   * Two keys are indexed because records written before `userId` existed carry
   * only the name. Both maps point at the same rows rather than duplicating them.
   */
  const byId = new Map<string, AuditLog[]>();
  const byName = new Map<string, AuditLog[]>();
  for (const log of logs) {
    if (log.userId) {
      const bucket = byId.get(log.userId);
      if (bucket) bucket.push(log);
      else byId.set(log.userId, [log]);
    }
    if (log.userName) {
      const bucket = byName.get(log.userName);
      if (bucket) bucket.push(log);
      else byName.set(log.userName, [log]);
    }
  }

  return agents.map((agent) => {
    // Prefer the id bucket (authoritative); fall back to the name only when the
    // id yields nothing, so legacy records still count without double-counting.
    const byIdRows = byId.get(agent.id) ?? [];
    const mine = byIdRows.length > 0 ? byIdRows : (byName.get(agent.name) ?? []);

    let approvals = 0;
    let rejections = 0;
    let moderationActions = 0;
    let last24h = 0;
    let last7d = 0;
    let lastActionMs = Number.NEGATIVE_INFINITY;
    let lastActionAt: string | null = null;

    // One walk, no intermediate arrays: this is the whole per-agent cost.
    for (const l of mine) {
      const action = l.action ?? '';
      const lower = action.toLowerCase();
      if (/approve/i.test(action)) approvals += 1;
      if (/reject/i.test(action)) rejections += 1;
      if (MOD_ACTIONS.some((m) => lower.includes(m))) moderationActions += 1;

      const t = Date.parse(l.createdAt);
      if (Number.isFinite(t)) {
        if (t >= dayAgo) last24h += 1;
        if (t >= weekAgo) last7d += 1;
        if (t > lastActionMs) {
          lastActionMs = t;
          lastActionAt = l.createdAt;
        }
      }
    }

    const decided = approvals + rejections;
    return {
      agent: { id: agent.id, name: agent.name, email: agent.email, role: String(agent.role) },
      totalActions: mine.length,
      last24h,
      last7d,
      approvals,
      rejections,
      moderationActions,
      lastActionAt,
      approvalRate: decided > 0 ? Math.round((approvals / decided) * 100) : 0,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Aktiviteti per komunë                                               */
/* ------------------------------------------------------------------ */

export interface MunicipalityActivityRow {
  account: Pick<User, 'id' | 'name' | 'email' | 'municipality'>;
  municipality: string;
  totalActions: number;
  deniedAttempts: number;
  lastActionAt: string | null;
}

export function computeMunicipalityActivity(
  accounts: readonly (RoleBearing & Pick<User, 'id' | 'name' | 'email' | 'municipality'>)[],
  logs: readonly AuditLog[]
): MunicipalityActivityRow[] {
  return accounts.map((acc) => {
    const muni = acc.municipality ?? '';
    const mine = logs.filter(
      (l) => l.userId === acc.id || (l.municipality && l.municipality === muni)
    );
    // E njëjta rregull si te agjentët: asnjë spread mbi array të madh.
    let lastActionAt: string | null = null;
    let lastActionMs = Number.NEGATIVE_INFINITY;
    for (const l of mine) {
      const t = Date.parse(l.createdAt);
      if (Number.isFinite(t) && t > lastActionMs) {
        lastActionMs = t;
        lastActionAt = l.createdAt;
      }
    }
    return {
      account: { id: acc.id, name: acc.name, email: acc.email, municipality: muni },
      municipality: muni,
      totalActions: mine.length,
      deniedAttempts: mine.filter((l) => l.status === 'danger').length,
      lastActionAt,
    };
  });
}

/** Numër i veprimeve pas një kohe, pa krijim arrays të ndërmjetëm. */
function countSince(logs: readonly AuditLog[], sinceMs: number): number {
  let n = 0;
  for (const l of logs) {
    const t = Date.parse(l.createdAt);
    if (Number.isFinite(t) && t >= sinceMs) n += 1;
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* Aktiviteti i Dyshimit (flag) per permbajtje                         */
/* ------------------------------------------------------------------ */

/** Numuron fjalet e ndaluara ne nje tekst — per badge te moderimit. */
export function countFlaggedWords(text: string, badWords: readonly string[]): number {
  const lower = text.toLowerCase();
  return badWords.filter((w) => lower.includes(w)).length;
}

/** Shtresa e rrezikut per nje postim/raportim: pastrim, dyshim, shkelje. */
export type RiskTier = 'clean' | 'suspect' | 'violation';

export function classifyRisk(
  text: string,
  badWords: readonly string[],
  profanityThreshold = 2
): RiskTier {
  const hits = countFlaggedWords(text, badWords);
  if (hits >= profanityThreshold) return 'violation';
  if (hits > 0) return 'suspect';
  return 'clean';
}

/* ------------------------------------------------------------------ */
/* Matrica e lejeve                                                    */
/* ------------------------------------------------------------------ */

/**
 * Cilat seksione paneli sheh cdo role — per matricen vizuale.
 * Baza e vertete mbetet `adminPermissions.BY_ROLE`; kjo eshte pasqyra per
 * lexim te lehte dhe duhet sinkronizuar me te.
 */
export const ROLE_MATRIX: Record<string, readonly string[]> = {
  admin: ['*'],
  superadmin: ['*'],
  approver: ['dashboard', 'reports', 'workfacts', 'health', 'donations', 'notifications', 'forum', 'polls', 'categories', 'support'],
  adsadmin: ['dashboard', 'ads', 'notifications'],
  newsadmin: ['dashboard', 'notifications', 'news', 'forum', 'polls'],
  /**
   * Field roles. The three panel grants are per-account, not per-role: an agent
   * only gets them when an administrator ticks the box on their staff form, so
   * they are absent from every role's defaults here.
   */
  agent: ['dashboard', 'reports', 'support', 'forum', 'news', 'notifications'],
  responder: ['dashboard', 'reports', 'support', 'forum'],
  dispatcher: ['dashboard', 'reports', 'support', 'forum', 'notifications'],
  municipality: ['dashboard', 'reports', 'health', 'donations'],
};

export const MATRIX_SECTIONS = [
  'dashboard', 'reports', 'workfacts', 'health', 'donations', 'users',
  'agents', 'municipalities', 'monitoring', 'monitorim', 'agentpanel', 'komunapanel',
  'forum', 'support', 'polls', 'news',
  'notifications', 'ads', 'security', 'settings',
] as const;

export const ROLE_MATRIX_LABELS: Record<string, string> = {
  admin: 'Administrator',
  superadmin: 'Super Admin',
  approver: 'Zyrtar Aprovimi',
  adsadmin: 'Menaxher Reklamash',
  newsadmin: 'Redaktor Lajmesh',
  agent: 'Agjent Terreni',
  responder: 'Përgjegjës',
  dispatcher: 'Dispatcher',
  municipality: 'Komuna',
};

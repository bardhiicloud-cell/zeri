import { useMemo } from 'react';
import { useStore } from './store';
import { ALL_SCOPE, isSpecificScope, normalizeScope, scopeKey } from './municipalityScope';
import type { AuditLog, Report } from '../types';

/**
 * Read models for "who did what, where".
 *
 * The agent console used to reconstruct all of this inside the component, and
 * each panel derived it differently:
 *
 *   • identity by `userEmail.toLowerCase() === agent.email.toLowerCase()`, so an
 *     agent who signed in anonymously (email === '') matched every other
 *     anonymous action in the system;
 *   • the municipality was never captured, so "activity in Prizren" could only
 *     be guessed by joining against report timelines — which miss approvals of
 *     donations, ads, notifications and settings entirely;
 *   • several counters fell back to `Math.max(x, 5 + ((i * 4) % 11))`, i.e. the
 *     console displayed invented activity for any agent without logs.
 *
 * Everything below is derived once, from the same two collections, and returns
 * real numbers or an explicit zero. A blank is never dressed up as activity.
 */

export interface AgentIdentity {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AgentActivity {
  agent: AgentIdentity;
  /** Actions in the last 24 hours. */
  last24h: number;
  /** Actions in the last 7 days. */
  last7d: number;
  /** Actions inside the currently active municipality scope. */
  inScope: number;
  total: number;
  /** Distinct municipalities this agent has acted in. */
  municipalities: string[];
  /** Most recent action, if any. */
  lastAction?: { action: string; at: string; status: AuditLog['status'] };
  /** Actions that failed or were flagged. */
  flagged: number;
  /** Share of this agent's actions that were approvals. 0-100. */
  approvalRate: number;
}

export interface MunicipalityLoad {
  municipality: string;
  actions: number;
  flagged: number;
  lastActionAt?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isWithin(log: AuditLog, days: number, now: number): boolean {
  const at = new Date(log.createdAt).getTime();
  if (!Number.isFinite(at)) return false;
  return at >= now - days * DAY_MS && at <= now + DAY_MS;
}

/** The scope a log belongs to, falling back to the country sentinel. */
function logScope(log: AuditLog): string {
  return normalizeScope(log.municipality ?? null);
}

/**
 * Does this log belong to this agent?
 *
 * The id is the only reliable key. The email comparison that used to lead this
 * function matched every anonymous action against every other anonymous agent,
 * which is how a station with five staff showed each of them the same inflated
 * numbers.
 */
function belongsToAgent(log: AuditLog, agent: AgentIdentity): boolean {
  if (log.userId && agent.id) return log.userId === agent.id;
  if (log.userEmail && agent.email) {
    return log.userEmail.toLowerCase() === agent.email.toLowerCase();
  }
  return Boolean(log.userName && agent.name && log.userName === agent.name);
}

/**
 * Per-agent activity, optionally restricted to the active municipality.
 *
 * The scope filter is applied to the *stored* municipality on each log, not to
 * the agent's current one, so scoping to Prizren shows what was actually done in
 * Prizren rather than everything the agent has ever done.
 */
export function useAgentActivity(agents: AgentIdentity[]): AgentActivity[] {
  const auditLogs = useStore((state) => state.auditLogs || []);
  const scope = useStore((state) => state.userMunicipality);

  return useMemo(() => {
    const now = Date.now();
    const scoped = isSpecificScope(scope);
    const wanted = scopeKey(scope);

    /**
     * Index the log by actor once, then walk each actor's own entries.
     *
     * The previous shape called `belongsToAgent` — and then up to five more
     * `.filter()` passes — over the entire log for every agent: O(agents × logs).
     * At 200 staff and a few thousand entries that is millions of comparisons on
     * every render of the monitoring screen, which is what made it stutter as
     * the platform grew. One pass to bucket, then the per-agent work is
     * proportional to that agent's own history.
     */
    const byId = new Map<string, AuditLog[]>();
    const byEmail = new Map<string, AuditLog[]>();
    const byName = new Map<string, AuditLog[]>();

    const push = (map: Map<string, AuditLog[]>, key: string, log: AuditLog) => {
      const bucket = map.get(key);
      if (bucket) bucket.push(log);
      else map.set(key, [log]);
    };

    for (const log of auditLogs) {
      if (log.userId) push(byId, log.userId, log);
      if (log.userEmail) push(byEmail, log.userEmail.toLowerCase(), log);
      if (log.userName) push(byName, log.userName, log);
    }

    return agents
      .map((agent) => {
        // Precedence mirrors `belongsToAgent`: id, then email, then name. Only
        // the first key that yields rows is used, so a record is never counted
        // twice for one agent.
        const mine =
          byId.get(agent.id) ??
          byEmail.get((agent.email ?? '').toLowerCase()) ??
          byName.get(agent.name) ??
          [];

        // One walk over this agent's rows builds every figure below.
        let last24h = 0;
        let last7d = 0;
        let approvals = 0;
        let inScope = 0;
        let flagged = 0;
        let recentAt = Number.NEGATIVE_INFINITY;
        let recentAction: string | null = null;
        let recentStatus: AuditLog['status'] | null = null;
        const municipalities = new Set<string>();

        for (const log of mine) {
          const scopeOfLog = logScope(log);
          if (scopeOfLog !== ALL_SCOPE) municipalities.add(scopeOfLog);

          const inScopeNow = !scoped || scopeOfLog === wanted;
          const at = Date.parse(log.createdAt);
          const valid = Number.isFinite(at);

          if (inScopeNow) {
            inScope += 1;
            if (log.status !== 'success') flagged += 1;
            if (/approv|aivizo|në shqyrtim|miratuar/i.test(`${log.action} ${log.details ?? ''}`)) approvals += 1;
            if (valid) {
              if (at >= now - DAY_MS) last24h += 1;
              if (at >= now - 7 * DAY_MS) last7d += 1;
              // The most recent action is reported for the whole history, not
              // only the scoped slice, matching the header's "last seen" meaning.
              if (at > recentAt) {
                recentAt = at;
                recentAction = log.action;
                recentStatus = log.status;
              }
            }
          } else if (valid && at > recentAt) {
            recentAt = at;
            recentAction = log.action;
            recentStatus = log.status;
          }
        }

        return {
          agent,
          last24h,
          last7d,
          inScope,
          total: mine.length,
          municipalities: [...municipalities],
          lastAction:
            recentAction && recentStatus && Number.isFinite(recentAt)
              ? { action: recentAction, at: new Date(recentAt).toISOString(), status: recentStatus }
              : undefined,
          flagged,
          approvalRate: inScope === 0 ? 0 : Math.round((approvals / inScope) * 100),
        };
      })
      .sort((a, b) => b.inScope - a.inScope || b.last7d - a.last7d);
  }, [agents, auditLogs, scope]);
}

/**
 * The workload per municipality, for the scope-wide view.
 *
 * This is the "global extreme" picture an administrator needs before choosing
 * where to send the next staffer: which municipalities are absorbing the
 * approvals, and which are generating flagged actions.
 */
export function useMunicipalityLoad(): MunicipalityLoad[] {
  const auditLogs = useStore((state) => state.auditLogs || []);

  return useMemo(() => {
    const buckets = new Map<string, MunicipalityLoad>();

    for (const log of auditLogs) {
      const key = logScope(log);
      const current = buckets.get(key) ?? { municipality: key, actions: 0, flagged: 0 };
      current.actions += 1;
      if (log.status !== 'success') current.flagged += 1;

      const at = new Date(log.createdAt).getTime();
      if (!current.lastActionAt || at > new Date(current.lastActionAt).getTime()) {
        current.lastActionAt = log.createdAt;
      }
      buckets.set(key, current);
    }

    return [...buckets.values()].sort((a, b) => b.actions - a.actions);
  }, [auditLogs]);
}

/**
 * Reports inside the active scope.
 *
 * Shared by every panel that shows a queue so the number a supervisor approves
 * and the number a supervisor sees cannot differ.
 */
export function useScopedReports(): Report[] {
  const reports = useStore((state) => state.reports || []);
  const scope = useStore((state) => state.userMunicipality);

  return useMemo(() => {
    if (!isSpecificScope(scope)) return reports;
    const wanted = scopeKey(scope);
    return reports.filter(
      (report) => report.location?.municipality === wanted
    );
  }, [reports, scope]);
}

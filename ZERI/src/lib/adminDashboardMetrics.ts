import type { HealthCase, IssueStatus, Report } from '../types';
import { KOSOVO_MUNICIPALITIES } from './constants';
import { normalizeMunicipalityKey, normalizeMunicipalityName } from './municipalityNormalizer';

/**
 * Pure arithmetic behind the admin dashboard.
 *
 * Kept out of the component for two reasons. The numbers on this screen decide
 * what a supervisor does next, so they have to be testable without rendering
 * anything; and the previous in-component version quietly disagreed with the
 * rest of the product (it compared municipality names with a lower-cased
 * `===`, reported a 100% resolution rate for a municipality with no reports,
 * and never looked at the SLA the store already enforces).
 *
 * Every function takes `now` explicitly so age-based figures are deterministic.
 */

/** The SLA `store.checkSLAs` enforces for critical reports, in hours. */
export const CRITICAL_SLA_HOURS = 48;

/** A pending report older than this is flagged even when it is not critical. */
export const STALE_PENDING_HOURS = 72;

const HOUR_MS = 60 * 60 * 1000;

/** Where a status sits in the report lifecycle, for aggregation. */
export type ReportBucket = 'pending' | 'active' | 'overdue' | 'resolved' | 'closed' | 'draft';

const BUCKET_BY_STATUS: Record<IssueStatus, ReportBucket> = {
  'Pending Review': 'pending',
  'Approved': 'active',
  'Assigned': 'active',
  'In Progress': 'active',
  'Overdue': 'overdue',
  'Resolved': 'resolved',
  'Rejected': 'closed',
  'Closed': 'closed',
  'Draft': 'draft',
};

/** Statuses the server-side counters query for the "active" bucket. */
export const ACTIVE_STATUSES: readonly IssueStatus[] = ['Approved', 'Assigned', 'In Progress'];

/** Unknown or legacy status strings count as `draft`, never as work to do. */
export function bucketOf(status: string | null | undefined): ReportBucket {
  return BUCKET_BY_STATUS[status as IssueStatus] ?? 'draft';
}

/** A report that still needs someone to act on it. */
export function isOpen(status: string | null | undefined): boolean {
  const bucket = bucketOf(status);
  return bucket === 'pending' || bucket === 'active' || bucket === 'overdue';
}

/** Parses the ISO strings the store holds. Returns NaN for anything unusable. */
function toMillis(value: unknown): number {
  if (typeof value !== 'string' || !value) return Number.NaN;
  return Date.parse(value);
}

export interface ReportSummary {
  total: number;
  pending: number;
  active: number;
  overdue: number;
  resolved: number;
  closed: number;
  draft: number;
  /** Critical reports still waiting for a first review. */
  criticalPending: number;
  /** Open reports whose response deadline has passed, or that are flagged Overdue. */
  slaBreached: number;
  /** Pending reports waiting longer than {@link STALE_PENDING_HOURS}. */
  stalePending: number;
  /** Mean hours from creation to resolution, or null when nothing was resolved. */
  avgResolutionHours: number | null;
}

export function summarizeReports(reports: readonly Report[], now: number): ReportSummary {
  const summary: ReportSummary = {
    total: reports.length,
    pending: 0,
    active: 0,
    overdue: 0,
    resolved: 0,
    closed: 0,
    draft: 0,
    criticalPending: 0,
    slaBreached: 0,
    stalePending: 0,
    avgResolutionHours: null,
  };

  let resolutionHoursTotal = 0;
  let resolutionSamples = 0;

  for (const report of reports) {
    const bucket = bucketOf(report.status);
    summary[bucket] += 1;

    const createdAt = toMillis(report.createdAt);

    if (bucket === 'pending' || bucket === 'overdue') {
      if (report.urgency === 'Kritike') summary.criticalPending += 1;
    }

    if (bucket === 'pending' && Number.isFinite(createdAt) && now - createdAt > STALE_PENDING_HOURS * HOUR_MS) {
      summary.stalePending += 1;
    }

    if (isOpen(report.status)) {
      const dueAt = toMillis(report.responseDueAt);
      if (bucket === 'overdue' || (Number.isFinite(dueAt) && dueAt < now)) {
        summary.slaBreached += 1;
      }
    }

    if (bucket === 'resolved') {
      const resolvedAt = toMillis(report.resolvedAt);
      // A resolution timestamp before the creation time is corrupt data; leaving
      // it out beats letting one bad row drag the average negative.
      if (Number.isFinite(createdAt) && Number.isFinite(resolvedAt) && resolvedAt >= createdAt) {
        resolutionHoursTotal += (resolvedAt - createdAt) / HOUR_MS;
        resolutionSamples += 1;
      }
    }
  }

  if (resolutionSamples > 0) {
    summary.avgResolutionHours = resolutionHoursTotal / resolutionSamples;
  }
  return summary;
}

export interface MunicipalityRow {
  name: string;
  total: number;
  pending: number;
  resolved: number;
  health: number;
  /** Share of reports resolved, 0–100, or null when there is nothing to measure. */
  resolutionRate: number | null;
}

export interface MunicipalityBreakdown {
  rows: MunicipalityRow[];
  /** Reports whose municipality is missing or not one of the registry's names. */
  unassignedReports: number;
}

const REGISTRY_BY_KEY: ReadonlyMap<string, string> = new Map(
  KOSOVO_MUNICIPALITIES.map((name) => [normalizeMunicipalityKey(name), name] as const)
);

/**
 * Resolve a stored municipality string to a name in the 38-municipality
 * registry, or null. Exact spelling is tried first so a stored value is never
 * rewritten to a similar-looking neighbour; the alias table is the fallback, and
 * its answer is accepted only if the registry actually contains it.
 */
export function registryMunicipality(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const direct = REGISTRY_BY_KEY.get(normalizeMunicipalityKey(raw));
  if (direct) return direct;
  const aliased = normalizeMunicipalityName(raw);
  return aliased ? REGISTRY_BY_KEY.get(normalizeMunicipalityKey(aliased)) ?? null : null;
}

/** Reports carry the municipality either nested under `location` or flat. */
function reportMunicipality(report: Report): string | null {
  const flat = (report as unknown as { municipality?: unknown }).municipality;
  return registryMunicipality(report.location?.municipality) ?? registryMunicipality(flat);
}

export function breakdownByMunicipality(
  reports: readonly Report[],
  healthCases: readonly HealthCase[]
): MunicipalityBreakdown {
  const rows = new Map<string, MunicipalityRow>(
    KOSOVO_MUNICIPALITIES.map((name) => [
      name,
      { name, total: 0, pending: 0, resolved: 0, health: 0, resolutionRate: null },
    ])
  );
  let unassignedReports = 0;

  for (const report of reports) {
    const row = rows.get(reportMunicipality(report) ?? '');
    if (!row) {
      unassignedReports += 1;
      continue;
    }
    row.total += 1;
    const bucket = bucketOf(report.status);
    if (bucket === 'pending') row.pending += 1;
    if (bucket === 'resolved') row.resolved += 1;
  }

  for (const healthCase of healthCases) {
    const row = rows.get(registryMunicipality(healthCase.municipality) ?? '');
    if (row) row.health += 1;
  }

  for (const row of rows.values()) {
    row.resolutionRate = row.total > 0 ? Math.round((row.resolved / row.total) * 100) : null;
  }

  const sorted = [...rows.values()].sort(
    (a, b) => b.total + b.health - (a.total + a.health) || a.name.localeCompare(b.name, 'sq')
  );
  return { rows: sorted, unassignedReports };
}

export interface CategoryCount {
  category: string;
  count: number;
}

/** The most frequent report categories, most common first. */
export function topCategories(reports: readonly Report[], limit = 5): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const report of reports) {
    const category = (report.category || '').trim() || 'Të tjera';
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, 'sq'))
    .slice(0, limit);
}

/** Urgent health cases whose hospital has not been notified yet. */
export function unnotifiedUrgentCases(healthCases: readonly HealthCase[]): number {
  return healthCases.filter((c) => c.urgency === 'Urgjente' && !c.hospitalNotified).length;
}

export type AgeUnit = 'now' | 'minutes' | 'hours' | 'days';

/** How long ago an ISO timestamp was, in the largest unit that reads naturally. */
export function ageOf(iso: string | undefined, now: number): { value: number; unit: AgeUnit } | null {
  const at = toMillis(iso);
  if (!Number.isFinite(at)) return null;
  // A clock a few seconds ahead of the server must read "now", not "-3 min".
  const minutes = Math.floor(Math.max(0, now - at) / 60_000);
  if (minutes < 1) return { value: 0, unit: 'now' };
  if (minutes < 60) return { value: minutes, unit: 'minutes' };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { value: hours, unit: 'hours' };
  return { value: Math.floor(hours / 24), unit: 'days' };
}

/**
 * "2 orë", "3 ditë" — the resolution time as a person would say it.
 * Returns the number and unit separately so the caller can translate the unit.
 */
export function humanizeHours(hours: number): { value: number; unit: 'hours' | 'days' } {
  if (hours < 48) return { value: Math.max(1, Math.round(hours)), unit: 'hours' };
  return { value: Math.round(hours / 24), unit: 'days' };
}

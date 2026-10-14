import { PRIORITIES, WORK_KINDS, type WorkKind, type WorkPriority } from './definitions';
import { DEFAULT_SLA, type SlaConfig } from './escalation';

/**
 * What a manager sees across the whole organisation, computed from plain records so it
 * can be tested with hundreds of people and checked by hand.
 *
 * Every flag here is an explainable rule with a threshold written below, not a score
 * nobody can argue with:
 *   overloaded   holds at least its full capacity (or more)
 *   high         holds 80% or more of its capacity
 *   under        available, holds under 30% of its capacity
 *   unavailable  away, off, busy, disabled, or has no capacity at all
 */
export type WorkloadState = 'overloaded' | 'high' | 'normal' | 'under' | 'unavailable';

export const HIGH_AT = 0.8;
export const UNDER_BELOW = 0.3;

export interface OrgWorker {
  uid: string;
  name: string;
  role: string;
  municipality: string;
  department: string;
  capacity: number;
  load: number;
  availability: 'available' | 'busy' | 'away' | 'off';
  disabled: boolean;
}

export interface OrgItem {
  id: string;
  kind: WorkKind;
  status: string;
  priority: WorkPriority;
  assigneeUid: string | null;
  municipality: string;
  dueAtMs: number | null;
  createdAtMs: number;
  needsAttention: boolean;
}

export function workloadState(worker: Pick<OrgWorker, 'load' | 'capacity' | 'availability' | 'disabled'>): WorkloadState {
  if (worker.disabled || worker.availability !== 'available' || worker.capacity <= 0) return 'unavailable';
  const ratio = worker.load / worker.capacity;
  if (ratio >= 1) return 'overloaded';
  if (ratio >= HIGH_AT) return 'high';
  if (ratio < UNDER_BELOW) return 'under';
  return 'normal';
}

export type BottleneckType = 'unassigned_waiting' | 'review_backlog' | 'municipality_overdue' | 'team_overloaded' | 'no_capacity';

export interface Bottleneck {
  type: BottleneckType;
  /** What it is about: a municipality, a department, a queue. */
  key: string;
  count: number;
  /** One sentence, in plain words, saying what the rule saw. */
  detail: string;
  severity: 'warning' | 'critical';
}

export interface OrgSummary {
  items: {
    open: number;
    unassigned: number;
    overdue: number;
    needsAttention: number;
    byKind: Record<WorkKind, number>;
    byPriority: Record<WorkPriority, number>;
    byStatus: Record<string, number>;
  };
  workforce: {
    total: number;
    available: number;
    unavailable: number;
    overloaded: number;
    high: number;
    normal: number;
    under: number;
    totalCapacity: number;
    totalLoad: number;
    /** Weighted work held divided by capacity of those who can take work, 0–1+. */
    utilization: number;
  };
  byMunicipality: Array<{ municipality: string; open: number; overdue: number; unassigned: number; workers: number; load: number; capacity: number }>;
  overloadedWorkers: Array<{ uid: string; name: string; load: number; capacity: number }>;
  underusedWorkers: Array<{ uid: string; name: string; load: number; capacity: number }>;
  bottlenecks: Bottleneck[];
}

const REVIEW_BACKLOG_AT = 5;
const MUNICIPALITY_OVERDUE_AT = 3;
const TEAM_OVERLOADED_RATIO = 0.9;
const TEAM_MIN_SIZE = 3;

export function summarizeOrganization(items: readonly OrgItem[], workers: readonly OrgWorker[], nowMs: number, sla: SlaConfig = DEFAULT_SLA): OrgSummary {
  const byKind = Object.fromEntries(WORK_KINDS.map(kind => [kind, 0])) as Record<WorkKind, number>;
  const byPriority = Object.fromEntries(PRIORITIES.map(priority => [priority, 0])) as Record<WorkPriority, number>;
  const byStatus: Record<string, number> = {};
  const muni = new Map<string, { open: number; overdue: number; unassigned: number; workers: number; load: number; capacity: number }>();
  const muniRow = (name: string) => {
    const key = name || '—';
    if (!muni.has(key)) muni.set(key, { open: 0, overdue: 0, unassigned: 0, workers: 0, load: 0, capacity: 0 });
    return muni.get(key)!;
  };

  let unassigned = 0;
  let overdue = 0;
  let attention = 0;
  let waitingTooLong = 0;
  let inReview = 0;
  for (const item of items) {
    byKind[item.kind] += 1;
    byPriority[item.priority] += 1;
    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
    const row = muniRow(item.municipality);
    row.open += 1;
    if (!item.assigneeUid) {
      unassigned += 1; row.unassigned += 1;
      if (nowMs - item.createdAtMs > sla.unassignedAlertMinutes[item.priority] * 60_000) waitingTooLong += 1;
    }
    if (item.dueAtMs !== null && item.dueAtMs < nowMs) { overdue += 1; row.overdue += 1; }
    if (item.needsAttention) attention += 1;
    if (item.status === 'in_review') inReview += 1;
  }

  const workforce = { total: workers.length, available: 0, unavailable: 0, overloaded: 0, high: 0, normal: 0, under: 0, totalCapacity: 0, totalLoad: 0, utilization: 0 };
  const overloadedWorkers: OrgSummary['overloadedWorkers'] = [];
  const underusedWorkers: OrgSummary['underusedWorkers'] = [];
  const teams = new Map<string, { load: number; capacity: number; size: number }>();
  let usableCapacity = 0;
  let usableLoad = 0;
  for (const worker of workers) {
    const state = workloadState(worker);
    workforce[state === 'unavailable' ? 'unavailable' : state] += 1;
    if (state !== 'unavailable') {
      workforce.available += 1;
      usableCapacity += worker.capacity;
      usableLoad += worker.load;
      const team = teams.get(worker.department || worker.municipality || '—') ?? { load: 0, capacity: 0, size: 0 };
      team.load += worker.load; team.capacity += worker.capacity; team.size += 1;
      teams.set(worker.department || worker.municipality || '—', team);
    }
    workforce.totalCapacity += worker.capacity;
    workforce.totalLoad += worker.load;
    if (worker.municipality) { const row = muniRow(worker.municipality); row.workers += 1; row.load += worker.load; row.capacity += worker.capacity; }
    if (state === 'overloaded') overloadedWorkers.push({ uid: worker.uid, name: worker.name, load: worker.load, capacity: worker.capacity });
    if (state === 'under') underusedWorkers.push({ uid: worker.uid, name: worker.name, load: worker.load, capacity: worker.capacity });
  }
  workforce.utilization = usableCapacity > 0 ? Math.round((usableLoad / usableCapacity) * 100) / 100 : 0;

  const rank = (a: { load: number; capacity: number; uid: string }, b: { load: number; capacity: number; uid: string }) =>
    b.load / (b.capacity || 1) - a.load / (a.capacity || 1) || b.load - a.load || a.uid.localeCompare(b.uid);
  overloadedWorkers.sort(rank);
  underusedWorkers.sort((a, b) => -rank(a, b));

  const bottlenecks: Bottleneck[] = [];
  if (waitingTooLong > 0) {
    bottlenecks.push({ type: 'unassigned_waiting', key: 'unassigned', count: waitingTooLong, severity: waitingTooLong >= 10 ? 'critical' : 'warning',
      detail: `${waitingTooLong} detyra pa caktuar kanë pritur më shumë se afati i njoftimit për prioritetin e tyre.` });
  }
  if (inReview >= REVIEW_BACKLOG_AT) {
    bottlenecks.push({ type: 'review_backlog', key: 'in_review', count: inReview, severity: inReview >= 20 ? 'critical' : 'warning',
      detail: `${inReview} detyra presin shqyrtimin (pragu: ${REVIEW_BACKLOG_AT}).` });
  }
  for (const [name, row] of muni) {
    if (row.overdue >= MUNICIPALITY_OVERDUE_AT) {
      bottlenecks.push({ type: 'municipality_overdue', key: name, count: row.overdue, severity: row.overdue >= 10 ? 'critical' : 'warning',
        detail: `${name}: ${row.overdue} detyra me afat të kaluar (pragu: ${MUNICIPALITY_OVERDUE_AT}).` });
    }
  }
  for (const [name, team] of teams) {
    if (team.size >= TEAM_MIN_SIZE && team.capacity > 0 && team.load / team.capacity >= TEAM_OVERLOADED_RATIO) {
      bottlenecks.push({ type: 'team_overloaded', key: name, count: team.size, severity: team.load / team.capacity >= 1 ? 'critical' : 'warning',
        detail: `Ekipi "${name}" mban ${team.load} nga ${team.capacity} vende (${Math.round((team.load / team.capacity) * 100)}%).` });
    }
  }
  if (unassigned > 0 && workforce.available > 0 && usableCapacity - usableLoad <= 0) {
    bottlenecks.push({ type: 'no_capacity', key: 'organisation', count: unassigned, severity: 'critical',
      detail: `Nuk ka asnjë vend të lirë te stafi i disponueshëm dhe ${unassigned} detyra presin.` });
  }
  const severityRank = { critical: 0, warning: 1 };
  bottlenecks.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.count - a.count || a.key.localeCompare(b.key));

  return {
    items: { open: items.length, unassigned, overdue, needsAttention: attention, byKind, byPriority, byStatus },
    workforce,
    byMunicipality: [...muni].map(([municipality, row]) => ({ municipality, ...row })).sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.municipality.localeCompare(b.municipality)),
    overloadedWorkers: overloadedWorkers.slice(0, 10),
    underusedWorkers: underusedWorkers.slice(0, 10),
    bottlenecks,
  };
}

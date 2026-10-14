import { PRIORITIES, WORKFLOWS, type WorkKind, type WorkPriority } from './definitions';

/**
 * Who should do this work: eligibility first, then an explained score, then a fixed
 * tie-break, so the same inputs always give the same answer and anyone can be shown why.
 *
 * Two promises:
 *   - nobody unauthorised, unavailable or full is ever chosen. If no one qualifies the
 *     item is reported as unassigned, with the count of people each rule ruled out, so a
 *     supervisor can act. It is never handed to "the least bad" candidate;
 *   - the function only recommends. The server applies the recommendation inside a
 *     transaction that re-checks capacity, so two simultaneous requests cannot both
 *     take the last free place.
 */
export type Availability = 'available' | 'busy' | 'away' | 'off';

export interface WorkSchedule {
  /** 0 = Sunday … 6 = Saturday, in the schedule's time zone. */
  days: readonly number[];
  /** "08:00" */
  start: string;
  /** "16:00" */
  end: string;
  timeZone?: string;
}

export interface Worker {
  uid: string;
  name?: string;
  /** Account role: agent, responder, municipality, moderator, debatwp … */
  role: string;
  municipality?: string;
  department?: string;
  skills: readonly string[];
  /** The most weighted work this person should hold at once. */
  capacity: number;
  /** Weighted work held now (kept by the server as items are assigned and finished). */
  load: number;
  availability: Availability;
  schedule?: WorkSchedule;
  disabled?: boolean;
  lastAssignedAtMs?: number | null;
}

export interface AssignableItem {
  id: string;
  kind: WorkKind;
  priority: WorkPriority;
  municipality?: string;
  department?: string;
  requiredSkills?: readonly string[];
  /** Skills that help but are not required (the category's usual skills). */
  preferredSkills?: readonly string[];
  /** How much of a person's capacity this takes. A routine task is 1; a complex case more. */
  weight?: number;
  dueAtMs?: number | null;
  /** The person who held related work before; continuity of responsibility. */
  continuityUid?: string | null;
  /** People who must not receive it (a conflict, a restricted case, a prior reviewer). */
  excludeUids?: readonly string[];
}

export type RejectReason =
  | 'disabled' | 'role' | 'municipality' | 'department' | 'skill' | 'unavailable' | 'off_hours' | 'capacity' | 'excluded';

export interface ScoreBreakdown {
  headroom: number;
  skills: number;
  continuity: number;
  fairness: number;
  urgency: number;
  total: number;
}

export interface Candidate {
  uid: string;
  eligible: boolean;
  rejected?: RejectReason;
  score?: ScoreBreakdown;
}

export type AssignmentOutcome =
  | { outcome: 'assigned'; uid: string; score: ScoreBreakdown; considered: Candidate[] }
  | { outcome: 'unassigned'; reason: 'no_eligible_worker'; rejectedBy: Partial<Record<RejectReason, number>>; considered: Candidate[] };

export const WEIGHTS = { headroom: 40, skills: 20, continuity: 15, fairness: 15, urgency: 10 } as const;
export const DEFAULT_TIME_ZONE = 'Europe/Belgrade';

/** Whether `nowMs` falls inside the schedule. No schedule means always on. */
export function isWithinSchedule(schedule: WorkSchedule | undefined, nowMs: number): boolean {
  if (!schedule) return true;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: schedule.timeZone ?? DEFAULT_TIME_ZONE, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(nowMs));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  const toMinutes = (clock: string) => { const [h, m] = clock.split(':').map(Number); return h * 60 + (m || 0); };
  return schedule.days.includes(day) && minutes >= toMinutes(schedule.start) && minutes < toMinutes(schedule.end);
}

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();

function rejection(worker: Worker, item: AssignableItem, nowMs: number): RejectReason | null {
  const weight = item.weight ?? 1;
  if (worker.disabled) return 'disabled';
  if (item.excludeUids?.includes(worker.uid)) return 'excluded';
  if (!WORKFLOWS[item.kind].assigneeRoles.includes(worker.role)) return 'role';
  // A municipality's worker only ever works that municipality's items.
  if (worker.role === 'municipality') {
    if (!worker.municipality || norm(worker.municipality) !== norm(item.municipality)) return 'municipality';
  } else if (item.municipality && worker.municipality && norm(worker.municipality) !== norm(item.municipality)) {
    return 'municipality';
  }
  if (item.department && worker.department && norm(worker.department) !== norm(item.department)) return 'department';
  if (item.requiredSkills?.some(skill => !worker.skills.map(norm).includes(norm(skill)))) return 'skill';
  if (worker.availability !== 'available') return 'unavailable';
  if (!isWithinSchedule(worker.schedule, nowMs)) return 'off_hours';
  if (worker.load + weight > worker.capacity) return 'capacity';
  return null;
}

/** Compare two optional times without NaN: a missing time is the oldest there is. */
const when = (value: number | null | undefined) => value ?? -Infinity;
const compareTimes = (a: number | null | undefined, b: number | null | undefined) => (when(a) === when(b) ? 0 : when(a) < when(b) ? -1 : 1);

function score(worker: Worker, item: AssignableItem, fairnessRank: number, pool: number): ScoreBreakdown {
  const weight = item.weight ?? 1;
  const free = Math.max(0, worker.capacity - worker.load - weight);
  const headroom = worker.capacity > 0 ? (free / worker.capacity) * WEIGHTS.headroom : 0;

  const wanted = (item.preferredSkills ?? []).map(norm);
  const have = new Set(worker.skills.map(norm));
  const skills = wanted.length ? (wanted.filter(skill => have.has(skill)).length / wanted.length) * WEIGHTS.skills : WEIGHTS.skills / 2;

  const continuity = item.continuityUid && item.continuityUid === worker.uid ? WEIGHTS.continuity : 0;

  // The longer since someone was last given work, the better; never-assigned is best.
  const fairness = pool > 1 ? (fairnessRank / (pool - 1)) * WEIGHTS.fairness : WEIGHTS.fairness;

  // Urgent and high-priority work leans toward the person with the most room.
  const urgent = item.priority === 'urgent' || item.priority === 'high';
  const urgency = urgent && worker.capacity > 0 ? (1 - worker.load / worker.capacity) * WEIGHTS.urgency : 0;

  const round = (n: number) => Math.round(n * 100) / 100;
  const parts = { headroom: round(headroom), skills: round(skills), continuity: round(continuity), fairness: round(fairness), urgency: round(urgency) };
  return { ...parts, total: round(parts.headroom + parts.skills + parts.continuity + parts.fairness + parts.urgency) };
}

/** Recommend a worker for one item. Pure and deterministic. */
export function chooseWorker(item: AssignableItem, workers: readonly Worker[], nowMs: number): AssignmentOutcome {
  const considered: Candidate[] = [];
  const eligible: Worker[] = [];
  const rejectedBy: Partial<Record<RejectReason, number>> = {};

  for (const worker of workers) {
    const reason = rejection(worker, item, nowMs);
    if (reason) {
      considered.push({ uid: worker.uid, eligible: false, rejected: reason });
      rejectedBy[reason] = (rejectedBy[reason] ?? 0) + 1;
    } else {
      eligible.push(worker);
    }
  }

  if (eligible.length === 0) return { outcome: 'unassigned', reason: 'no_eligible_worker', rejectedBy, considered };

  // Fairness rank over the distinct moments people were last given work: 0 = most recent,
  // the highest rank = longest ago or never. People with the same moment (every newcomer has
  // none) share a rank, so their user ids play no part in how fair they look.
  const distinct = [...new Set(eligible.map(worker => when(worker.lastAssignedAtMs)))].sort((a, b) => (a === b ? 0 : a < b ? 1 : -1));
  const rankOf = (worker: Worker) => distinct.indexOf(when(worker.lastAssignedAtMs));

  const scored = eligible.map(worker => ({ worker, score: score(worker, item, rankOf(worker), distinct.length) }));
  scored.sort((a, b) =>
    b.score.total - a.score.total ||
    a.worker.load - b.worker.load ||
    compareTimes(a.worker.lastAssignedAtMs, b.worker.lastAssignedAtMs) ||
    a.worker.uid.localeCompare(b.worker.uid));

  for (const entry of scored) considered.push({ uid: entry.worker.uid, eligible: true, score: entry.score });
  const best = scored[0];
  return { outcome: 'assigned', uid: best.worker.uid, score: best.score, considered };
}

export interface DistributionResult {
  assigned: Array<{ itemId: string; uid: string; score: ScoreBreakdown }>;
  unassigned: Array<{ itemId: string; rejectedBy: Partial<Record<RejectReason, number>> }>;
  /** The workers after the distribution, with the load the new work added. */
  workers: Worker[];
}

const PRIORITY_RANK: Record<WorkPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/**
 * Hand out a batch in a fixed order (urgency, then deadline, then id) updating each
 * worker's load as it goes, so a batch cannot overfill one person.
 */
export function distribute(items: readonly AssignableItem[], workers: readonly Worker[], nowMs: number): DistributionResult {
  const pool = workers.map(worker => ({ ...worker }));
  const ordered = [...items].sort((a, b) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (a.dueAtMs ?? Infinity) - (b.dueAtMs ?? Infinity) ||
    a.id.localeCompare(b.id));

  const assigned: DistributionResult['assigned'] = [];
  const unassigned: DistributionResult['unassigned'] = [];
  let tick = 0;
  for (const item of ordered) {
    const result = chooseWorker(item, pool, nowMs);
    if (result.outcome === 'unassigned') { unassigned.push({ itemId: item.id, rejectedBy: result.rejectedBy }); continue; }
    const winner = pool.find(worker => worker.uid === result.uid)!;
    winner.load += item.weight ?? 1;
    winner.lastAssignedAtMs = nowMs + (tick += 1);
    assigned.push({ itemId: item.id, uid: result.uid, score: result.score });
  }
  return { assigned, unassigned, workers: pool };
}

/**
 * Should active work be moved off its holder? Almost never: moving work destroys
 * accountability. It is only recalculated while nobody has accepted it, or when the
 * holder can no longer do it.
 */
export function mayRecalculate(item: { kind: WorkKind; status: string }, holder: Pick<Worker, 'disabled' | 'availability'> | null): boolean {
  if (!holder) return true;
  if (holder.disabled) return true;
  return item.status === 'assigned' && holder.availability === 'off';
}

export { PRIORITIES };

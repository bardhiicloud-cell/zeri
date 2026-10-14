/**
 * How a worker is doing, without turning it into a count of tasks closed.
 *
 * Counting closed tasks rewards the person who takes the easy ones and punishes the one
 * who takes the hard ones; it also rewards closing badly. So every figure here accounts for
 * how heavy the work was, whether it came back for rework, whether it was reopened,
 * whether it was on time, and what is overdue right now. A small sample is flagged as
 * such instead of being ranked as if it meant something.
 *
 * These are system-computed measures from the record. A manager's own assessment of a
 * person is a different thing and is stored separately (see server/workItems.ts); nothing
 * here is written by a human and nothing here reads one.
 */
export interface FinishedWork {
  weight: number;
  createdAtMs: number;
  completedAtMs: number;
  dueAtMs: number | null;
  /** Times a reviewer sent it back. */
  reworkCount: number;
  /** Times it was reopened after being finished. */
  reopenCount: number;
}

export interface OpenWork {
  weight: number;
  dueAtMs: number | null;
}

export interface PerformanceInput {
  finished: readonly FinishedWork[];
  open: readonly OpenWork[];
  nowMs: number;
  /** The weighted amount a person at full capacity finishes in the period; the throughput yardstick. */
  expectedWeightedOutput?: number;
}

export interface Performance {
  finishedCount: number;
  weightedOutput: number;
  /** Share of deadline-bearing finished work that was on time, 0–1; null with no deadlines. */
  onTimeRate: number | null;
  /** Share of finished work that came back at least once, 0–1. */
  reworkRate: number;
  reopenRate: number;
  overdueOpen: number;
  avgCycleHours: number | null;
  /** 0–100, from the four measures below; null when there is nothing finished to judge. */
  index: number | null;
  /** `low` below five finished items: shown, but not to be ranked on. */
  confidence: 'low' | 'ok';
  basis: { timeliness: number; quality: number; overdue: number; throughput: number };
}

export const MIN_SAMPLE = 5;
const WEIGHTS = { timeliness: 0.4, quality: 0.35, overdue: 0.1, throughput: 0.15 } as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

export function measurePerformance(input: PerformanceInput): Performance {
  const { finished, open, nowMs } = input;
  const expected = input.expectedWeightedOutput && input.expectedWeightedOutput > 0 ? input.expectedWeightedOutput : 10;

  const weightedOutput = finished.reduce((sum, work) => sum + work.weight, 0);
  const withDue = finished.filter(work => work.dueAtMs !== null);
  const onTime = withDue.filter(work => work.completedAtMs <= (work.dueAtMs as number)).length;
  const onTimeRate = withDue.length ? onTime / withDue.length : null;
  const reworkRate = finished.length ? finished.filter(work => work.reworkCount > 0).length / finished.length : 0;
  const reopenRate = finished.length ? finished.filter(work => work.reopenCount > 0).length / finished.length : 0;
  const overdueOpen = open.filter(work => work.dueAtMs !== null && work.dueAtMs < nowMs).length;
  const avgCycleHours = finished.length
    ? finished.reduce((sum, work) => sum + (work.completedAtMs - work.createdAtMs), 0) / finished.length / 3_600_000
    : null;

  const basis = {
    timeliness: onTimeRate ?? 1,
    quality: clamp01(1 - reworkRate * 0.7 - reopenRate * 0.3),
    // Three overdue items open at once is as bad as it gets for this term.
    overdue: clamp01(1 - overdueOpen / 3),
    throughput: clamp01(weightedOutput / expected),
  };
  const index = finished.length
    ? round(100 * (WEIGHTS.timeliness * basis.timeliness + WEIGHTS.quality * basis.quality + WEIGHTS.overdue * basis.overdue + WEIGHTS.throughput * basis.throughput), 1)
    : null;

  return {
    finishedCount: finished.length,
    weightedOutput: round(weightedOutput),
    onTimeRate: onTimeRate === null ? null : round(onTimeRate),
    reworkRate: round(reworkRate),
    reopenRate: round(reopenRate),
    overdueOpen,
    avgCycleHours: avgCycleHours === null ? null : round(avgCycleHours, 1),
    index,
    confidence: finished.length >= MIN_SAMPLE ? 'ok' : 'low',
    basis: { timeliness: round(basis.timeliness), quality: round(basis.quality), overdue: round(basis.overdue), throughput: round(basis.throughput) },
  };
}

/**
 * Order people for a manager's attention, best measured first. Those with too little to
 * judge come last whatever their figure, so a lucky first task never tops the list.
 */
export function orderByPerformance<T extends { uid: string; performance: Performance }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) =>
    Number(b.performance.confidence === 'ok') - Number(a.performance.confidence === 'ok') ||
    (b.performance.index ?? -1) - (a.performance.index ?? -1) ||
    a.uid.localeCompare(b.uid));
}

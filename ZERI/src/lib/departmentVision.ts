/**
 * Vizioni i Reparteve — the one board that answers "how is every department doing".
 *
 * ─── The question this exists to answer ─────────────────────────────────────
 *
 * An administrator of a platform this size does not want a list of features.
 * They want, in one screen: which department is behind, which is overloaded,
 * which is quiet, and what needs a decision today. That is a different shape
 * from every other admin page, which each show one collection in depth.
 *
 * So each department here reports the same five things:
 *
 *   • backlog    — work waiting on someone
 *   • flow        — work moving this period
 *   • breach      — work that missed its deadline
 *   • coverage    — is anyone actually working it
 *   • health      — a single verdict, derived, never asserted
 *
 * The verdict is computed from the numbers above rather than stored, so the
 * board cannot claim "healthy" beside a breach count. If a department has no
 * data at all it says so, rather than showing a green tick it has not earned.
 *
 * ─── Why this is pure ───────────────────────────────────────────────────────
 *
 * It takes counts, not collections. At the volumes this platform targets, a
 * function that walks every report to build a summary is a function that stalls
 * the admin's browser — so the caller passes already-computed figures, and this
 * module only classifies and ranks them. It is trivially testable as a result.
 */

/** A department's numbers for one reporting period. */
export interface DepartmentInput {
  id: string;
  label: string;
  /** Work waiting for action. */
  backlog: number;
  /** Work completed inside the period. */
  flow: number;
  /** Work past its deadline. */
  breach: number;
  /** People who could work this queue. */
  staff: number;
  /** People who actually did, in the period. */
  activeStaff: number;
  /** Extra context shown on the card, e.g. "12 të reja". */
  note?: string;
}

export type DepartmentHealth = 'healthy' | 'watch' | 'at-risk' | 'idle' | 'empty';

export interface DepartmentRow extends DepartmentInput {
  health: DepartmentHealth;
  /** Health expressed as a phrase, so the badge is readable without a legend. */
  verdict: string;
  /** Backlog per active worker — the load that actually predicts failure. */
  loadPerWorker: number;
  /** Share of the queue that is in breach, 0-100. */
  breachRate: number;
  /** Share of available staff who worked, 0-100. */
  coverageRate: number;
}

export const HEALTH_LABELS: Record<DepartmentHealth, string> = {
  healthy: 'Në rregull',
  watch: 'Për vëmendje',
  'at-risk': 'Në rrezik',
  idle: 'Pa aktivitet',
  empty: 'Pa punë',
};

export const HEALTH_TONES: Record<DepartmentHealth, string> = {
  healthy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  watch: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'at-risk': 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  idle: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  empty: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

/** Ranking order: the departments that need attention sort first. */
const HEALTH_RANK: Record<DepartmentHealth, number> = {
  'at-risk': 0,
  watch: 1,
  idle: 2,
  healthy: 3,
  empty: 4,
};

/**
 * Thresholds, in one place and named.
 *
 * These are policy, not physics: they encode what this platform considers a
 * healthy queue. Keeping them here means a change of policy is one edit and a
 * reviewable diff, rather than a magic number inside a comparison.
 */
export const DEPARTMENT_THRESHOLDS = {
  /** Backlog per active worker above this is an overload signal. */
  loadWarn: 15,
  loadRisk: 30,
  /** Share of the queue in breach. */
  breachWarnPct: 10,
  breachRiskPct: 25,
  /** Share of staff who must be working for the queue to be "covered". */
  coverageWarnPct: 50,
} as const;

/**
 * Classify one department.
 *
 * Order is deliberate and goes from worst to best:
 *
 *   1. `empty`   — nothing to do and nothing done. Not a problem, not a win.
 *   2. `idle`    — there is a queue and staff, but nobody worked it. This is the
 *                  most easily missed failure and the most damaging, because it
 *                  looks calm on a dashboard that only counts backlog.
 *   3. `at-risk` — a hard breach or overload condition.
 *   4. `watch`   — a soft threshold crossed.
 *   5. `healthy` — none of the above.
 */
export function classifyDepartment(input: DepartmentInput): DepartmentRow {
  const loadPerWorker =
    input.activeStaff > 0 ? Math.round((input.backlog / input.activeStaff) * 10) / 10 : input.backlog;

  const totalConsidered = input.backlog + input.flow;
  const breachRate =
    totalConsidered > 0 ? Math.round((input.breach / totalConsidered) * 100) : 0;
  const coverageRate =
    input.staff > 0 ? Math.round((input.activeStaff / input.staff) * 100) : 0;

  const t = DEPARTMENT_THRESHOLDS;

  let health: DepartmentHealth;
  let verdict: string;

  if (input.backlog === 0 && input.flow === 0 && input.breach === 0) {
    health = 'empty';
    verdict = 'Pa punë në këtë periudhë.';
  } else if (input.backlog > 0 && input.activeStaff === 0 && input.staff > 0) {
    health = 'idle';
    verdict = `Radha ka ${input.backlog} punë dhe askush nuk ka vepruar.`;
  } else if (breachRate >= t.breachRiskPct) {
    health = 'at-risk';
    verdict = `${breachRate}% e punëve jashtë afatit.`;
  } else if (loadPerWorker >= t.loadRisk) {
    health = 'at-risk';
    verdict = `${loadPerWorker} punë për punëtor aktiv — mbingarkesë.`;
  } else if (breachRate >= t.breachWarnPct) {
    health = 'watch';
    verdict = `${breachRate}% e punëve jashtë afatit.`;
  } else if (loadPerWorker >= t.loadWarn) {
    health = 'watch';
    verdict = `${loadPerWorker} punë për punëtor aktiv.`;
  } else if (input.staff > 0 && coverageRate < t.coverageWarnPct && input.backlog > 0) {
    health = 'watch';
    verdict = `Vetëm ${coverageRate}% e stafit ka vepruar.`;
  } else {
    health = 'healthy';
    verdict = 'Qarkullimi mbulon radhën.';
  }

  return {
    ...input,
    health,
    verdict,
    loadPerWorker,
    breachRate,
    coverageRate,
  };
}

/** Classify a whole board and sort it so attention-needing rows come first. */
export function buildDepartmentBoard(inputs: readonly DepartmentInput[]): DepartmentRow[] {
  return inputs
    .map(classifyDepartment)
    .sort((a, b) => {
      const rank = HEALTH_RANK[a.health] - HEALTH_RANK[b.health];
      if (rank !== 0) return rank;
      // Within a tier, the bigger backlog is the more urgent conversation.
      return b.backlog - a.backlog;
    });
}

/** One line for the top of the board. */
export function summariseBoard(rows: readonly DepartmentRow[]): {
  total: number;
  atRisk: number;
  idle: number;
  watch: number;
  headline: string;
} {
  const atRisk = rows.filter((r) => r.health === 'at-risk').length;
  const idle = rows.filter((r) => r.health === 'idle').length;
  const watch = rows.filter((r) => r.health === 'watch').length;

  const parts: string[] = [];
  if (atRisk > 0) parts.push(`${atRisk} reparte në rrezik`);
  if (idle > 0) parts.push(`${idle} pa aktivitet`);
  if (watch > 0) parts.push(`${watch} për vëmendje`);

  return {
    total: rows.length,
    atRisk,
    idle,
    watch,
    headline: parts.length === 0 ? 'Të gjitha repartet në rregull.' : parts.join(' · '),
  };
}

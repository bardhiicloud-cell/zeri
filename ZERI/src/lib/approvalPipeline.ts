/**
 * Rrjedha e Aprovimit — the review pipeline a report travels through.
 *
 * ─── The pipeline this encodes ──────────────────────────────────────────────
 *
 * The platform was described as three roles in sequence, each adding something
 * the previous one could not:
 *
 *   1. AGJENTI  inspects. Reads the description, the location, the photos the
 *               citizen attached. Confirms the report is real and complete.
 *               Cannot approve — only pass it on.
 *
 *   2. KOMUNA   responds. Sees only what the agent passed, adds the facts of the
 *               work it carried out, and marks it done.
 *
 *   3. STAFF    verifies. Confirms the municipality's claims before they are
 *               published as record.
 *
 * The important property is that each stage is a *gate*, not a notification:
 * a report that has not been inspected by an agent cannot reach a municipality,
 * and a municipality's claim cannot become public record until verified. That is
 * what makes the audit trail mean anything.
 *
 * ─── Why this is a separate module ──────────────────────────────────────────
 *
 * The rules below are the platform's editorial policy expressed as transitions.
 * Keeping them out of the components means the same transition function can be
 * used by the UI to decide which buttons to draw, by a test to assert the
 * policy, and by the server to enforce it — one definition, three consumers.
 */
import type { IssueStatus, Report } from '../types';

/* ------------------------------------------------------------------ */
/* Stages                                                              */
/* ------------------------------------------------------------------ */

/** Who acts at each point in the pipeline. */
export type PipelineStage =
  | 'submitted'    // citizen filed it; nobody has looked
  | 'inspecting'   // an agent has it open
  | 'inspected'    // an agent confirmed it; waiting for a municipality
  | 'responding'   // the municipality is working it
  | 'responded'    // the municipality says the work is done
  | 'verifying'    // staff is checking the municipality's claim
  | 'published'    // verified and public record
  | 'rejected';    // dismissed at some stage

export const STAGE_LABELS: Record<PipelineStage, string> = {
  submitted: 'E paraqitur',
  inspecting: 'Në inspektim',
  inspected: 'E inspektuar',
  responding: 'Komuna po përgjigjet',
  responded: 'Komuna u përgjigj',
  verifying: 'Në verifikim',
  published: 'E publikuar',
  rejected: 'E refuzuar',
};

export const STAGE_TONES: Record<PipelineStage, string> = {
  submitted: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  inspecting: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  inspected: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  responding: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  responded: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  verifying: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};

/** The role that owns each stage — who is waiting on whom. */
export const STAGE_OWNER: Record<PipelineStage, 'agent' | 'municipality' | 'staff' | 'nobody'> = {
  submitted: 'agent',
  inspecting: 'agent',
  inspected: 'municipality',
  responding: 'municipality',
  responded: 'staff',
  verifying: 'staff',
  published: 'nobody',
  rejected: 'nobody',
};

/**
 * Map the stored status onto a pipeline stage.
 *
 * `IssueStatus` is the field that exists on every report, including ones written
 * before this pipeline was defined, so the stage is derived rather than stored.
 * That keeps every existing record readable instead of needing a migration.
 */
export function stageOf(report: Pick<Report, 'status' | 'assignedTo'>): PipelineStage {
  switch (report.status) {
    case 'Draft':
    case 'Pending Review':
      return report.assignedTo ? 'inspecting' : 'submitted';
    case 'Approved':
      return 'inspected';
    case 'Assigned':
    case 'In Progress':
      return 'responding';
    case 'Resolved':
      return 'published';
    case 'Rejected':
      return 'rejected';
    case 'Overdue':
      return 'responding';
    default:
      return 'submitted';
  }
}

/* ------------------------------------------------------------------ */
/* Completeness — what an agent checks before passing it on            */
/* ------------------------------------------------------------------ */

export interface CompletenessCheck {
  key: string;
  label: string;
  ok: boolean;
  /** What is missing, phrased as the fix rather than the fault. */
  hint: string;
}

/**
 * The checklist an agent works through.
 *
 * These are the things that make a report actionable. A complaint with no
 * location cannot be routed; one with no description cannot be assessed; a
 * photo is what lets a municipality recognise the site without a visit. Each
 * failed check says what to do, because "mungon" is not guidance.
 */
export function completenessChecks(report: Report): CompletenessCheck[] {
  const hasLocation = Boolean(report.location?.municipality);
  const hasAddress = Boolean(report.location?.address);
  const hasDescription = (report.description ?? '').trim().length >= 20;
  const hasPhotos = (report.images?.length ?? 0) > 0 || (report.media?.length ?? 0) > 0;
  const hasCategory = Boolean(report.category);

  return [
    {
      key: 'location',
      label: 'Komuna është e identifikuar',
      ok: hasLocation,
      hint: 'Pa komunë raportimi nuk mund të drejtohet te askush.',
    },
    {
      key: 'address',
      label: 'Adresa ose pika e saktë',
      ok: hasAddress,
      hint: 'Shtoni adresën ose pikën e referimit para se ta dërgoni.',
    },
    {
      key: 'description',
      label: 'Përshkrim i mjaftueshëm (20+ shenja)',
      ok: hasDescription,
      hint: 'Zgjerojeni përshkrimin — një fjali e shkurtër nuk mjafton për verifikim.',
    },
    {
      key: 'photos',
      label: 'Së paku një fotografi',
      ok: hasPhotos,
      hint: 'Kërkojini qytetarit ose shtojeni një foto; pa të komuna nuk e njeh vendin.',
    },
    {
      key: 'category',
      label: 'Kategoria e caktuar',
      ok: hasCategory,
      hint: 'Caktoni kategorinë që raportimi të shkojë te drejtoria e duhur.',
    },
  ];
}

/** True when every check passes — the gate for passing to a municipality. */
export function isReadyForMunicipality(report: Report): boolean {
  return completenessChecks(report).every((c) => c.ok);
}

/* ------------------------------------------------------------------ */
/* Transitions                                                         */
/* ------------------------------------------------------------------ */

export type Transition =
  | 'claim'        // agent takes it
  | 'pass_to_municipality'  // agent confirms and forwards
  | 'municipality_accept'   // municipality picks it up
  | 'municipality_done'     // municipality reports the work complete
  | 'staff_verify'          // staff confirms and publishes
  | 'reject';

export interface TransitionRule {
  transition: Transition;
  label: string;
  /** Who may perform it. */
  by: 'agent' | 'municipality' | 'staff';
  /** The stage the report must be in for this to be legal. */
  from: PipelineStage[];
  /** The stored status the transition writes. */
  toStatus: IssueStatus;
  /** Why it might be refused, evaluated per report. */
  guard?: (report: Report) => { ok: true } | { ok: false; reason: string };
}

/**
 * The rules, in one table.
 *
 * Each `from` list is deliberately exhaustive rather than "anything except" — a
 * transition that is not listed cannot happen, so a new status added later does
 * not silently become a valid source for every action.
 */
export const TRANSITIONS: readonly TransitionRule[] = [
  {
    transition: 'claim',
    label: 'Merr për inspektim',
    by: 'agent',
    from: ['submitted', 'inspecting'],
    toStatus: 'Pending Review',
  },
  {
    transition: 'pass_to_municipality',
    label: 'Paso te komuna',
    by: 'agent',
    from: ['inspecting', 'submitted'],
    toStatus: 'Approved',
    guard: (report) => {
      const failed = completenessChecks(report).filter((c) => !c.ok);
      if (failed.length > 0) {
        return {
          ok: false,
          reason: `Nuk mund të pasohet: ${failed.map((f) => f.hint).join(' ')}`,
        };
      }
      return { ok: true };
    },
  },
  {
    transition: 'municipality_accept',
    label: 'Marr përsipër punën',
    by: 'municipality',
    from: ['inspected'],
    toStatus: 'In Progress',
  },
  {
    transition: 'municipality_done',
    label: 'Punimet u kryen',
    by: 'municipality',
    from: ['responding', 'inspected'],
    toStatus: 'Resolved',
    guard: (report) => {
      // The municipality must have described the work; a bare status change is
      // not evidence, and the newsroom has nothing to verify.
      const facts = report.timeline?.filter((t) => t.status === 'In Progress' && t.comment) ?? [];
      if (facts.length === 0) {
        return {
          ok: false,
          reason: 'Shtoni faktet e punimeve (çka u rregullua, kur, kush) para se ta shënoni të kryer.',
        };
      }
      return { ok: true };
    },
  },
  {
    transition: 'staff_verify',
    label: 'Verifiko dhe publiko',
    by: 'staff',
    from: ['published', 'responded'],
    toStatus: 'Resolved',
  },
  {
    transition: 'reject',
    label: 'Refuzo',
    by: 'staff',
    from: ['submitted', 'inspecting', 'inspected', 'responding', 'responded', 'verifying'],
    toStatus: 'Rejected',
  },
];

/** The transitions available to a role for a specific report. */
export function availableTransitions(
  report: Report,
  role: 'agent' | 'municipality' | 'staff'
): Array<{ rule: TransitionRule; allowed: boolean; reason?: string }> {
  const stage = stageOf(report);
  return TRANSITIONS
    .filter((rule) => rule.by === role)
    .map((rule) => {
      if (!rule.from.includes(stage)) {
        return {
          rule,
          allowed: false,
          reason: `Veprimi nuk lejohet nga faza "${STAGE_LABELS[stage]}".`,
        };
      }
      const guard = rule.guard?.(report);
      // `guard.ok` narrows the union, so the reason is only read on the branch
      // where it exists — the explicit check is what makes that safe.
      if (guard && guard.ok === false) return { rule, allowed: false, reason: guard.reason };
      return { rule, allowed: true };
    });
}

/* ------------------------------------------------------------------ */
/* Queue shaping                                                       */
/* ------------------------------------------------------------------ */

/**
 * What a role should see, and in what order.
 *
 * Each role sees only the stage it owns: an agent does not need the municipality
 * queue, and a municipality must not see reports an agent has not yet confirmed.
 * That last restriction is the editorial firewall applied to the pipeline rather
 * than to a single action.
 */
export function queueFor(
  reports: readonly Report[],
  role: 'agent' | 'municipality' | 'staff'
): Report[] {
  const owned: Record<typeof role, PipelineStage[]> = {
    agent: ['submitted', 'inspecting'],
    municipality: ['inspected', 'responding'],
    staff: ['responded', 'verifying', 'published'],
  };

  const wanted = owned[role];
  return reports
    .filter((r) => wanted.includes(stageOf(r)))
    .sort((a, b) => {
      // Oldest first: a queue is worked front-to-back, and the report that has
      // waited longest is the one that has been failed longest.
      return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    });
}
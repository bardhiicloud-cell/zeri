/**
 * Rrjedha e Aprovimit — the same policy the UI draws, enforced where it counts.
 *
 * ─── Why this file exists, given src/lib/approvalPipeline.ts ────────────────
 *
 * The client module decides which buttons to draw. A button is a usability
 * affordance, never an authorisation decision: a modified client can call
 * Firestore directly and write any status it likes. This module is the server's
 * copy of the *same* policy, so a transition that the UI would grey out is also
 * refused when it arrives over the wire.
 *
 * It is deliberately a self-contained port rather than an import of the client
 * file, because the two have different jobs and different inputs:
 *
 *   - the client works with a hydrated `Report` (arrays for images, nested
 *     location, an ISO `createdAt`);
 *   - the server works with a raw Firestore document (`createdAt` is a
 *     Timestamp, `location` may be absent, `images` may be undefined).
 *
 * Sharing one function would force one of them to lie about its input type.
 * What must not drift is the *rule table*, so the transitions, the stages and
 * the completeness floor are transcribed here verbatim and a comment points back
 * to the client file. When the policy changes, both move together.
 *
 * ─── What "enforcement" means here ──────────────────────────
 *
 * Given (actor role, actor municipality, current report document, requested
 * transition) this answers one question: may this account move this report along
 * this edge of the graph, right now? Everything else — writing the status,
 * stamping the timeline, auditing — belongs to the endpoint.
 */

/* ------------------------------------------------------------------ */
/* Stages                                                              */
/* ------------------------------------------------------------------ */

export type PipelineStage =
  | 'submitted'
  | 'inspecting'
  | 'inspected'
  | 'responding'
  | 'responded'
  | 'verifying'
  | 'published'
  | 'rejected';

export type PipelineRole = 'agent' | 'municipality' | 'staff';

export type IssueStatus =
  | 'Draft' | 'Pending Review' | 'Approved' | 'Assigned'
  | 'In Progress' | 'Resolved' | 'Rejected' | 'Overdue';

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

/**
 * Map the stored status onto a pipeline stage.
 *
 * Mirrors `stageOf` in the client module. `assignedTo` matters for the two
 * pre-approval statuses: a report that has an inspector attached is being
 * worked, not merely sitting in the queue.
 */
export function stageOf(report: { status?: unknown; assignedTo?: unknown }): PipelineStage {
  const status = String(report?.status ?? '');
  const assigned = Boolean(String(report?.assignedTo ?? '').trim());

  switch (status) {
    case 'Draft':
    case 'Pending Review':
      return assigned ? 'inspecting' : 'submitted';
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

/**
 * The role a stored account plays in the pipeline.
 *
 * `admin` and `superadmin` act as `staff`: they own verification. The editorial
 * roles (`approver`, `responder`, `dispatcher`, `moderator`) act as `agent`:
 * they work the front of the queue. A municipality account is `municipality`.
 *
 * Returning `null` means the account has no standing in the pipeline at all,
 * which is the correct answer for a citizen or a guest — neither may move a
 * report's status.
 */
export function pipelineRoleOf(role: string, permissions?: readonly string[]): PipelineRole | null {
  const r = String(role || '').toLowerCase();

  if (r === 'municipality') return 'municipality';
  if (r === 'admin' || r === 'superadmin') return 'staff';
  if (r === 'agent' || r === 'responder' || r === 'dispatcher' || r === 'moderator' || r === 'approver') {
    return 'agent';
  }

  // A per-section grant can promote a differently-named account into the agent
  // role for the pipeline, mirroring how `/agent` opens on `permissions:['agents']`.
  // SECURITY: `permissions` must come from verified token claims
  // (`permissionsFromClaims` in server/auth.ts), never from the client-writable
  // profile document, or any citizen could grant themselves this role.
  if (Array.isArray(permissions) && permissions.includes('agents')) return 'agent';

  return null;
}

/* ------------------------------------------------------------------ */
/* Completeness — the gate an agent cannot pass without                */
/* ------------------------------------------------------------------ */

export interface CompletenessCheck {
  key: string;
  label: string;
  ok: boolean;
  hint: string;
}

/**
 * The checklist an agent works through, re-evaluated on the server from the
 * stored document. A client that shows every box ticked still cannot pass a
 * report the server finds incomplete.
 */
export function completenessChecks(report: any): CompletenessCheck[] {
  const location = report?.location ?? {};
  const images = Array.isArray(report?.images) ? report.images : [];
  const media = Array.isArray(report?.media) ? report.media : [];

  const hasLocation = Boolean(String(location?.municipality ?? '').trim());
  const hasAddress = Boolean(String(location?.address ?? '').trim());
  const hasDescription = String(report?.description ?? '').trim().length >= 20;
  const hasPhotos = images.length > 0 || media.length > 0;
  const hasCategory = Boolean(String(report?.category ?? '').trim());

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

export function isReadyForMunicipality(report: any): boolean {
  return completenessChecks(report).every((c) => c.ok);
}

/* ------------------------------------------------------------------ */
/* Transitions                                                         */
/* ------------------------------------------------------------------ */

export type Transition =
  | 'claim'
  | 'pass_to_municipality'
  | 'municipality_accept'
  | 'municipality_done'
  | 'staff_verify'
  | 'reject';

export const ALL_TRANSITIONS: readonly Transition[] = [
  'claim',
  'pass_to_municipality',
  'municipality_accept',
  'municipality_done',
  'staff_verify',
  'reject',
];

export interface TransitionRule {
  transition: Transition;
  label: string;
  by: PipelineRole;
  from: PipelineStage[];
  toStatus: IssueStatus;
  /** A note is mandatory: a status the citizen is shown must carry a reason. */
  requiresNote?: boolean;
  guard?: (report: any) => { ok: true } | { ok: false; reason: string };
}

/**
 * The rule table. Transcribed from src/lib/approvalPipeline.ts::TRANSITIONS.
 *
 * Each `from` list is exhaustive rather than "anything except", so a status
 * added later does not silently become a valid source for every action.
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
      // A report whose reviewer asked the citizen for more cannot be passed on until the
      // citizen has answered (it can still be rejected, with a reason).
      if (report?.awaitingInfo === true) {
        return { ok: false, reason: 'Raporti pret përgjigjen e qytetarit për informacionin e kërkuar. Prisni përgjigjen ose refuzojeni me arsye.' };
      }
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
      // The municipality must have described the work somewhere in the
      // timeline; a bare status change is not evidence the newsroom can verify.
      const timeline = Array.isArray(report?.timeline) ? report.timeline : [];
      const facts = timeline.filter(
        (t: any) => t?.status === 'In Progress' && String(t?.comment ?? '').trim().length > 0
      );
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
    // Dismissing a citizen's report without a stated reason is the single most
    // common complaint about a platform of this kind, and the reason is what the
    // citizen is shown.
    requiresNote: true,
  },
];

export function ruleFor(transition: Transition): TransitionRule | undefined {
  return TRANSITIONS.find((r) => r.transition === transition);
}

/* ------------------------------------------------------------------ */
/* The decision                                                        */
/* ------------------------------------------------------------------ */

export interface TransitionDecision {
  allowed: boolean;
  /** Stable code for logging and tests. */
  code: string;
  /** Human explanation, safe to show the operator. */
  reason: string;
  /** The status to write when allowed. */
  toStatus?: IssueStatus;
  /** The stage the report was in when the decision was made. */
  fromStage?: PipelineStage;
  /**
   * Set when an owner (admin, superadmin) performed a step that belongs to another
   * role. The step is allowed, but it is recorded as done on that role's behalf.
   */
  onBehalfOf?: PipelineRole;
}

const deny = (code: string, reason: string, fromStage?: PipelineStage): TransitionDecision => ({
  allowed: false,
  code,
  reason,
  fromStage,
});

/**
 * Decide whether `actor` may apply `transition` to `report`.
 *
 * The checks run cheapest-and-most-fundamental first, so the refusal a client
 * receives names the real obstacle rather than a downstream symptom:
 *
 *   1. the transition is one we know;
 *   2. the account has standing in the pipeline at all;
 *   3. the account's role owns this transition;
 *   4. the report is in a stage the transition accepts;
 *   5. any per-report guard passes (completeness, evidence of work);
 *   6. a jurisdiction check, for a municipality.
 */
export function decideTransition(
  actor: { uid: string; role: string; municipality?: string; permissions?: readonly string[] },
  report: any,
  transition: Transition
): TransitionDecision {
  const rule = ruleFor(transition);
  if (!rule) return deny('UNKNOWN_TRANSITION', 'Veprim i panjohur — refuzohet si parazgjedhje.');

  const actorRole = pipelineRoleOf(actor.role, actor.permissions);
  if (!actorRole) {
    return deny('NO_STANDING', 'Kjo llogari nuk ka rol në rrjedhën e aprovimit.');
  }

  const stage = stageOf(report);

  // The owner may do the agents' work: the superadmin has every access an agent
  // has. Only the agents' steps - the owner does not attest to a municipality's
  // physical work, and the municipality's own steps stay with the municipality.
  const onBehalfOf: PipelineRole | undefined = actorRole === 'staff' && rule.by === 'agent' ? 'agent' : undefined;

  if (rule.by !== actorRole && !onBehalfOf) {
    return deny(
      'WRONG_ROLE',
      `Veprimi "${rule.label}" kryhet nga ${rule.by}, jo nga ${actorRole}.`,
      stage
    );
  }

  if (!rule.from.includes(stage)) {
    return deny(
      'WRONG_STAGE',
      `Veprimi nuk lejohet nga faza "${STAGE_LABELS[stage]}".`,
      stage
    );
  }

  const guard = rule.guard?.(report);
  if (guard && guard.ok === false) return deny('GUARD_FAILED', guard.reason, stage);

  // A municipality may only act inside its own jurisdiction. Without this, a
  // paid account for one municipality could mark a neighbouring authority's
  // report as done.
  if (actorRole === 'municipality') {
    const own = String(actor.municipality ?? '').trim().toLowerCase();
    const target = String(report?.location?.municipality ?? '').trim().toLowerCase();
    if (!own) return deny('NO_JURISDICTION', 'Llogaria nuk ka komunë të caktuar.', stage);
    if (own !== target) {
      return deny('OUT_OF_JURISDICTION', `Kjo llogari mbulon vetëm ${actor.municipality}.`, stage);
    }
  }

  return { allowed: true, code: 'ALLOW', reason: '', toStatus: rule.toStatus, fromStage: stage, ...(onBehalfOf ? { onBehalfOf } : {}) };
}

/**
 * Whether a status value may be written to a report at all.
 *
 * The transition endpoint derives its status from the rule table, so this exists
 * for the *creation* path and for the rules file's own review: it is the single
 * list of legal `status` values, and a value outside it is a typo or an attack.
 */
export const LEGAL_STATUSES: readonly IssueStatus[] = [
  'Draft', 'Pending Review', 'Approved', 'Assigned',
  'In Progress', 'Resolved', 'Rejected', 'Overdue',
];

export function isLegalStatus(status: unknown): status is IssueStatus {
  return typeof status === 'string' && (LEGAL_STATUSES as readonly string[]).includes(status);
}

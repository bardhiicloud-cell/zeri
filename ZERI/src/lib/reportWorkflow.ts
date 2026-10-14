/**
 * The report lifecycle: six stages, one rejected side-track, one rule table.
 *
 * Shared by the browser and the server, so the queue a screen shows, the buttons it
 * draws and the transition the server accepts are the same answer.
 *
 *   1 Në pritje   (Pending Review)  ── Aprovo raportimin ──────────▶ 2
 *   2 U aprovua   (Approved)        ── Cakto përgjegjësin ─────────▶ 3
 *   3 I caktuar   (Assigned)        ── Aprovo fillimin e procesit ─▶ 4
 *   4 Në proces   (In Progress)     ── Aprovo zgjidhjen ───────────▶ 5
 *   5 U zgjidh    (Resolved)        ── Aprovo mbylljen ────────────▶ 6
 *   6 U mbyll     (Closed)
 *     Të refuzuara (Rejected) — a separate section, never one of the six.
 *
 * The stage IS the stored `status` field (the same English codes the public Track-ID,
 * the rules file and every existing reader use), so no record needs migrating: `Draft`
 * reads as Në pritje and `Overdue` reads as Në proces with its deadline passed.
 *
 * Besides the five stage moves there are a few recorded actions that never change the
 * stage (an assignee submitting a resolution, a reviewer returning it, a manager
 * correcting who is assigned). They are part of the history, not extra statuses.
 *
 * Pure: no Firebase, no React. The server runs `decideReportAction` inside the
 * transaction that writes the change; the screens run it to decide what to draw.
 */

/* ------------------------------------------------------------------ */
/* Stages                                                              */
/* ------------------------------------------------------------------ */

export type ReportStage = 'pending' | 'approved' | 'assigned' | 'in_process' | 'resolved' | 'closed';
export type ReportQueue = ReportStage | 'rejected';

/** The six stages, in flow order. */
export const REPORT_STAGES: readonly ReportStage[] = ['pending', 'approved', 'assigned', 'in_process', 'resolved', 'closed'];
/** The seven queues of the reports panel: the six stages plus the rejected section. */
export const REPORT_QUEUES: readonly ReportQueue[] = [...REPORT_STAGES, 'rejected'];

export const STAGE_STATUS: Record<ReportQueue, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  assigned: 'Assigned',
  in_process: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  rejected: 'Rejected',
};

/** Every stored status a queue holds (legacy values included, so nothing is orphaned). */
export const QUEUE_STATUSES: Record<ReportQueue, readonly string[]> = {
  pending: ['Pending Review', 'Draft'],
  approved: ['Approved'],
  assigned: ['Assigned'],
  in_process: ['In Progress', 'Overdue'],
  resolved: ['Resolved'],
  closed: ['Closed'],
  rejected: ['Rejected'],
};

export interface StageText { label: string; hint: string; owner: string }

export const QUEUE_TEXT: Record<ReportQueue, StageText> = {
  pending: { label: 'Në pritje', hint: 'Raportime të reja që presin shqyrtimin: aprovohen ose refuzohen me arsye.', owner: 'Shqyrtuesi i autorizuar' },
  approved: { label: 'U aprovua', hint: 'Kaluan shqyrtimin; presin caktimin e përgjegjësit.', owner: 'Menaxheri' },
  assigned: { label: 'I caktuar', hint: 'Kanë përgjegjës; puna fillon vetëm me "Aprovo fillimin e procesit".', owner: 'Përgjegjësi i caktuar' },
  in_process: { label: 'Në proces', hint: 'Puna po kryhet; zgjidhja verifikohet para se të shënohet e zgjidhur.', owner: 'Përgjegjësi / Verifikuesi' },
  resolved: { label: 'U zgjidh', hint: 'Zgjidhja u verifikua; pret aprovimin e mbylljes.', owner: 'Superadmini' },
  closed: { label: 'U mbyll', hint: 'Raste të mbyllura zyrtarisht; historiku ruhet i plotë.', owner: '—' },
  rejected: { label: 'Të refuzuara', hint: 'Raportime të refuzuara me arsye të shkruar. Nuk janë pjesë e gjashtë fazave.', owner: '—' },
};

/** Which queue a stored status belongs to. Unknown values read as Në pritje, so a record never vanishes. */
export function queueOfStatus(status: unknown): ReportQueue {
  const value = String(status ?? '');
  for (const queue of REPORT_QUEUES) {
    if (QUEUE_STATUSES[queue].includes(value)) return queue;
  }
  return 'pending';
}

export function stageIndex(queue: ReportQueue): number {
  return queue === 'rejected' ? -1 : REPORT_STAGES.indexOf(queue);
}

/* ------------------------------------------------------------------ */
/* Who acts                                                            */
/* ------------------------------------------------------------------ */

/**
 * The five platform roles, derived from the stored account roles (verified token claims):
 *
 *   superadmin    superadmin, admin
 *   manager       dispatcher (owner decision 2026-10-13: assigns work, sees team load)
 *   agent         agent, responder, approver, moderator, or any account granted `agents`
 *   municipality  municipality
 *   monitor       monitor (reads, changes nothing)
 */
export type WorkflowRole = 'superadmin' | 'manager' | 'agent' | 'municipality' | 'monitor';

export function workflowRoleOf(role: string, permissions: readonly string[] = []): WorkflowRole | null {
  const r = String(role || '').toLowerCase();
  if (r === 'superadmin' || r === 'admin') return 'superadmin';
  if (r === 'dispatcher') return 'manager';
  if (r === 'municipality') return 'municipality';
  if (r === 'monitor') return 'monitor';
  if (r === 'agent' || r === 'responder' || r === 'approver' || r === 'moderator') return 'agent';
  if (permissions.includes('agents')) return 'agent';
  return null;
}

/** Roles whose accounts can hold an agent assignment (eligible assignees). */
export const AGENT_ACCOUNT_ROLES: readonly string[] = ['agent', 'responder', 'approver', 'moderator', 'dispatcher'];

export const WORKFLOW_ROLE_LABEL: Record<WorkflowRole, string> = {
  superadmin: 'Superadmin',
  manager: 'Menaxher',
  agent: 'Agjent',
  municipality: 'Komunë',
  monitor: 'Monitorim',
};

export interface ReportActor {
  uid: string;
  role: string;
  permissions?: readonly string[];
  municipality?: string;
}

/* ------------------------------------------------------------------ */
/* Assignments                                                         */
/* ------------------------------------------------------------------ */

export type AssignmentStatus = 'active' | 'submitted' | 'completed' | 'cancelled';

/**
 * One person's (or one municipality's) share of one report. A report worked by two
 * agents has two assignments and is still one report.
 */
export interface AssignmentFacts {
  /** Document id: `u_<uid>` or `m_<municipality slug>`. */
  key: string;
  type: 'agent' | 'municipality';
  uid?: string | null;
  municipality?: string | null;
  name?: string;
  status: AssignmentStatus;
}

export function assignmentKey(target: { type: 'agent'; uid: string } | { type: 'municipality'; municipality: string }): string {
  return target.type === 'agent' ? `u_${target.uid}` : `m_${slug(target.municipality)}`;
}

export function slug(value: string): string {
  return String(value ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'x';
}

const sameText = (a?: string | null, b?: string | null) =>
  Boolean(a) && Boolean(b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** Is this actor the holder of this assignment? */
export function holdsAssignment(actor: ReportActor, assignment: AssignmentFacts): boolean {
  if (assignment.type === 'agent') return Boolean(assignment.uid) && assignment.uid === actor.uid;
  return workflowRoleOf(actor.role, actor.permissions) === 'municipality' && sameText(actor.municipality, assignment.municipality);
}

const LIVE: readonly AssignmentStatus[] = ['active', 'submitted'];
export const liveAssignments = (list: readonly AssignmentFacts[]) => list.filter(a => LIVE.includes(a.status));

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export type ReportAction =
  | 'approve_report'
  | 'reject_report'
  | 'assign'
  | 'update_assignees'
  | 'start_process'
  | 'submit_resolution'
  | 'return_to_work'
  | 'approve_resolution'
  | 'approve_closure';

export interface ActionDef {
  action: ReportAction;
  label: string;
  /** Stages the action is legal from. */
  from: readonly ReportQueue[];
  /** The stage it ends in; null keeps the current one (a recorded action, not a move). */
  to: ReportQueue | null;
  /** Mandatory free text and its minimum length. */
  requires?: { field: 'reason' | 'note'; min: number; prompt: string };
  /** Who owns it, in words, for the screens. */
  owner: string;
  tone: 'primary' | 'danger' | 'neutral';
}

export const MIN_REASON = 5;
export const MAX_TEXT = 1200;
export const MAX_ASSIGNEES = 6;

export const ACTIONS: Record<ReportAction, ActionDef> = {
  approve_report: { action: 'approve_report', label: 'Aprovo raportimin', from: ['pending'], to: 'approved', owner: 'Shqyrtuesi (agjent, menaxher, superadmin)', tone: 'primary' },
  reject_report: {
    action: 'reject_report', label: 'Refuzo raportimin', from: ['pending', 'approved', 'assigned', 'in_process'], to: 'rejected',
    requires: { field: 'reason', min: MIN_REASON, prompt: 'Arsyeja e refuzimit (e lexon qytetari)' }, owner: 'Zyrtari i aprovimit / superadmin', tone: 'danger',
  },
  assign: { action: 'assign', label: 'Cakto përgjegjësin', from: ['approved'], to: 'assigned', owner: 'Menaxheri / superadmin', tone: 'primary' },
  update_assignees: {
    action: 'update_assignees', label: 'Korrigjo caktimin', from: ['assigned', 'in_process'], to: null,
    requires: { field: 'reason', min: MIN_REASON, prompt: 'Pse ndryshon caktimi' }, owner: 'Menaxheri / superadmin', tone: 'neutral',
  },
  start_process: { action: 'start_process', label: 'Aprovo fillimin e procesit', from: ['assigned'], to: 'in_process', owner: 'Përgjegjësi i caktuar / menaxheri', tone: 'primary' },
  submit_resolution: {
    action: 'submit_resolution', label: 'Dërgo zgjidhjen për verifikim', from: ['in_process'], to: null,
    requires: { field: 'note', min: 10, prompt: 'Çka u bë, kur dhe nga kush' }, owner: 'Përgjegjësi i caktuar', tone: 'primary',
  },
  return_to_work: {
    action: 'return_to_work', label: 'Kthe për punë', from: ['in_process'], to: null,
    requires: { field: 'reason', min: MIN_REASON, prompt: 'Çka mungon ose nuk u konfirmua' }, owner: 'Superadmini', tone: 'neutral',
  },
  approve_resolution: {
    action: 'approve_resolution', label: 'Aprovo zgjidhjen', from: ['in_process'], to: 'resolved',
    requires: { field: 'note', min: MIN_REASON, prompt: 'Përmbledhja e zgjidhjes së verifikuar' }, owner: 'Superadmini (jo ai që e dërgoi)', tone: 'primary',
  },
  approve_closure: {
    action: 'approve_closure', label: 'Aprovo mbylljen', from: ['resolved'], to: 'closed',
    requires: { field: 'note', min: MIN_REASON, prompt: 'Rezultati përfundimtar' }, owner: 'Superadmini', tone: 'primary',
  },
};

export const ALL_ACTIONS = Object.keys(ACTIONS) as ReportAction[];

export function isReportAction(value: unknown): value is ReportAction {
  return typeof value === 'string' && (ALL_ACTIONS as string[]).includes(value);
}

/**
 * The roles that own each action. `assignee` means "holds a live assignment on this
 * report" and is checked against the assignment list, not the role name.
 *
 * Derived from the existing pipeline (server/approvalPipeline.ts before this file):
 * agents pass reports on (`pass_to_municipality` → approve), staff reject and verify,
 * the municipality starts and claims the work, the dispatcher distributes it. The one
 * derived grant: the `approver` role (Zyrtar Aprovimi) may also reject at Në pritje,
 * because an approval officer who cannot refuse is not reviewing.
 */
const OWNERS: Record<ReportAction, ReadonlyArray<WorkflowRole | 'assignee' | 'approver'>> = {
  approve_report: ['superadmin', 'manager', 'agent'],
  reject_report: ['superadmin', 'approver'],
  assign: ['superadmin', 'manager'],
  update_assignees: ['superadmin', 'manager'],
  start_process: ['superadmin', 'manager', 'assignee'],
  submit_resolution: ['assignee'],
  return_to_work: ['superadmin'],
  approve_resolution: ['superadmin'],
  approve_closure: ['superadmin'],
};

/* ------------------------------------------------------------------ */
/* Completeness (unchanged policy from the old pipeline)               */
/* ------------------------------------------------------------------ */

export interface CompletenessCheck { key: string; label: string; ok: boolean; hint: string }

export function completenessChecks(report: Record<string, any>): CompletenessCheck[] {
  const location = report?.location ?? {};
  const images = Array.isArray(report?.images) ? report.images : [];
  const media = Array.isArray(report?.media) ? report.media : [];
  return [
    { key: 'location', label: 'Komuna është e identifikuar', ok: Boolean(String(location?.municipality ?? '').trim()), hint: 'Pa komunë raportimi nuk mund të drejtohet te askush.' },
    { key: 'address', label: 'Adresa ose pika e saktë', ok: Boolean(String(location?.address ?? '').trim()), hint: 'Shtoni adresën ose pikën e referimit.' },
    { key: 'description', label: 'Përshkrim i mjaftueshëm (20+ shenja)', ok: String(report?.description ?? '').trim().length >= 20, hint: 'Përshkrimi është shumë i shkurtër për verifikim.' },
    { key: 'photos', label: 'Së paku një fotografi', ok: images.length > 0 || media.length > 0, hint: 'Pa foto komuna nuk e njeh vendin.' },
    { key: 'category', label: 'Kategoria e caktuar', ok: Boolean(String(report?.category ?? '').trim()), hint: 'Caktoni kategorinë.' },
  ];
}

/* ------------------------------------------------------------------ */
/* The decision                                                        */
/* ------------------------------------------------------------------ */

export interface ReportFacts {
  status: string;
  municipality?: string;
  awaitingInfo?: boolean;
  /** The full stored document, for the completeness guard. */
  doc?: Record<string, any>;
  assignments: readonly AssignmentFacts[];
}

export interface AssigneeInput { type: 'agent' | 'municipality'; uid?: string; municipality?: string }

export interface ActionRequest {
  action: string;
  reason?: unknown;
  note?: unknown;
  assignees?: unknown;
  /** The status the caller saw. A mismatch means someone else moved the report first. */
  expectedStatus?: unknown;
}

export type DenyCode =
  | 'UNKNOWN_ACTION' | 'NO_STANDING' | 'READ_ONLY' | 'WRONG_ROLE' | 'WRONG_STAGE' | 'STALE'
  | 'TEXT_REQUIRED' | 'TEXT_TOO_LONG' | 'ASSIGNEES_REQUIRED' | 'ASSIGNEE_INVALID' | 'NOT_ASSIGNEE'
  | 'OUT_OF_JURISDICTION' | 'INCOMPLETE' | 'AWAITING_INFO' | 'WORK_OUTSTANDING' | 'NOTHING_SUBMITTED'
  | 'SAME_PERSON' | 'ALREADY_SUBMITTED';

export type ActionDecision =
  | {
      outcome: 'allow';
      def: ActionDef;
      from: ReportQueue;
      to: ReportQueue;
      text: string;
      /** For assign / update_assignees: the validated target list. */
      assignees: AssigneeInput[];
      /** The assignment(s) this actor acts through (assignee actions). */
      via: AssignmentFacts[];
      /** A manager or superadmin did a step that belongs to the assignee. */
      onBehalf: boolean;
    }
  | { outcome: 'deny'; status: 400 | 403 | 404 | 409; code: DenyCode; error: string };

const deny = (status: 400 | 403 | 404 | 409, code: DenyCode, error: string): ActionDecision => ({ outcome: 'deny', status, code, error });
const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function parseAssignees(value: unknown): AssigneeInput[] | null {
  if (!Array.isArray(value)) return null;
  const out: AssigneeInput[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const type = (raw as any).type;
    if (type === 'agent') {
      const uid = clean((raw as any).uid);
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return null;
      const key = assignmentKey({ type, uid });
      if (!seen.has(key)) { seen.add(key); out.push({ type, uid }); }
    } else if (type === 'municipality') {
      const municipality = clean((raw as any).municipality);
      if (!municipality || municipality.length > 80) return null;
      const key = assignmentKey({ type, municipality });
      if (!seen.has(key)) { seen.add(key); out.push({ type, municipality }); }
    } else {
      return null;
    }
  }
  return out;
}

/**
 * May this actor do this action on this report, right now? Checks run from the most
 * fundamental to the most specific, so a refusal names the real obstacle.
 */
export function decideReportAction(input: { actor: ReportActor; report: ReportFacts; request: ActionRequest }): ActionDecision {
  const { actor, report, request } = input;
  if (!isReportAction(request.action)) return deny(400, 'UNKNOWN_ACTION', 'Ky veprim nuk ekziston në rrjedhën e raportit.');
  const def = ACTIONS[request.action];

  const role = workflowRoleOf(actor.role, actor.permissions ?? []);
  if (!role) return deny(403, 'NO_STANDING', 'Kjo llogari nuk ka rol në rrjedhën e raporteve.');
  if (role === 'monitor') return deny(403, 'READ_ONLY', 'Roli i monitorimit sheh progresin dhe historikun; nuk ndryshon asgjë.');

  // A municipality only ever sees its own reports; another's is "not found".
  if (role === 'municipality' && !sameText(actor.municipality, report.municipality)) {
    return deny(404, 'OUT_OF_JURISDICTION', 'Raporti nuk u gjet.');
  }

  const from = queueOfStatus(report.status);
  if (typeof request.expectedStatus === 'string' && request.expectedStatus && queueOfStatus(request.expectedStatus) !== from) {
    return deny(409, 'STALE', `Raporti u ndryshua ndërkohë dhe tani është "${QUEUE_TEXT[from].label}". Rifreskoni.`);
  }

  // Who may do it. `assignee` is satisfied by holding a live assignment.
  const owners = OWNERS[def.action];
  const mine = liveAssignments(report.assignments).filter(a => holdsAssignment(actor, a));
  const byRole = owners.includes(role) || (owners.includes('approver') && String(actor.role).toLowerCase() === 'approver');
  const byAssignment = owners.includes('assignee') && mine.length > 0;
  if (!byRole && !byAssignment) {
    if (owners.includes('assignee') && (role === 'agent' || role === 'municipality')) {
      return deny(403, 'NOT_ASSIGNEE', 'Ky hap kryhet nga përgjegjësi i caktuar për këtë raport.');
    }
    return deny(403, 'WRONG_ROLE', `"${def.label}" kryhet nga: ${def.owner}.`);
  }

  if (!def.from.includes(from)) {
    if (def.to === from) return deny(409, 'WRONG_STAGE', `Raporti është tashmë "${QUEUE_TEXT[from].label}".`);
    return deny(409, 'WRONG_STAGE', `"${def.label}" nuk lejohet kur raporti është "${QUEUE_TEXT[from].label}".`);
  }

  // Rejecting work already under way stays with the superadmin.
  if (def.action === 'reject_report' && from !== 'pending' && role !== 'superadmin') {
    return deny(403, 'WRONG_ROLE', 'Pas aprovimit, refuzimin e bën vetëm superadmini.');
  }

  const text = clean(def.requires?.field === 'reason' ? request.reason : request.note) || clean(request.reason) || clean(request.note);
  if (text.length > MAX_TEXT) return deny(400, 'TEXT_TOO_LONG', `Teksti nuk mund të kalojë ${MAX_TEXT} shenja.`);
  if (def.requires && text.length < def.requires.min) {
    return deny(400, 'TEXT_REQUIRED', `${def.requires.prompt}: shkruani të paktën ${def.requires.min} shenja.`);
  }

  let assignees: AssigneeInput[] = [];
  let via: AssignmentFacts[] = [];
  let onBehalf = false;

  switch (def.action) {
    case 'approve_report': {
      if (report.awaitingInfo === true) {
        return deny(409, 'AWAITING_INFO', 'Raporti pret informacionin e kërkuar nga qytetari. Prisni përgjigjen ose refuzojeni me arsye.');
      }
      const failed = completenessChecks(report.doc ?? {}).filter(check => !check.ok);
      if (failed.length > 0) return deny(409, 'INCOMPLETE', `Nuk mund të aprovohet: ${failed.map(f => f.hint).join(' ')}`);
      break;
    }
    case 'assign':
    case 'update_assignees': {
      const parsed = parseAssignees(request.assignees);
      if (!parsed) return deny(400, 'ASSIGNEE_INVALID', 'Lista e përgjegjësve nuk është e vlefshme.');
      if (parsed.length === 0) return deny(400, 'ASSIGNEES_REQUIRED', 'Zgjidhni të paktën një përgjegjës.');
      if (parsed.length > MAX_ASSIGNEES) return deny(400, 'ASSIGNEE_INVALID', `Jo më shumë se ${MAX_ASSIGNEES} përgjegjës për një raport.`);
      const foreign = parsed.find(a => a.type === 'municipality' && !sameText(a.municipality, report.municipality));
      if (foreign) return deny(400, 'ASSIGNEE_INVALID', `Raporti është në ${report.municipality || '—'}; nuk i caktohet komunës ${foreign.municipality}.`);
      assignees = parsed;
      break;
    }
    case 'start_process': {
      via = mine;
      onBehalf = mine.length === 0;
      if (liveAssignments(report.assignments).length === 0) {
        return deny(409, 'ASSIGNEES_REQUIRED', 'Raporti nuk ka përgjegjës të caktuar.');
      }
      break;
    }
    case 'submit_resolution': {
      via = mine.filter(a => a.status === 'active');
      if (via.length === 0) return deny(409, 'ALREADY_SUBMITTED', 'Zgjidhja juaj është dërguar tashmë dhe pret verifikimin.');
      break;
    }
    case 'return_to_work': {
      if (!report.assignments.some(a => a.status === 'submitted')) {
        return deny(409, 'NOTHING_SUBMITTED', 'Asnjë përgjegjës nuk ka dërguar zgjidhje për t\'u kthyer.');
      }
      break;
    }
    case 'approve_resolution': {
      const live = liveAssignments(report.assignments);
      const outstanding = live.filter(a => a.status === 'active');
      if (live.length === 0 || !live.some(a => a.status === 'submitted')) {
        return deny(409, 'NOTHING_SUBMITTED', 'Asnjë përgjegjës nuk ka dërguar zgjidhjen ende.');
      }
      if (outstanding.length > 0) {
        return deny(409, 'WORK_OUTSTANDING', `Ende pa dërguar zgjidhjen: ${outstanding.map(a => a.name || a.municipality || a.uid).join(', ')}. Prisni ata ose korrigjoni caktimin.`);
      }
      // Independent verification: whoever submitted cannot verify their own work.
      if (mine.length > 0) return deny(403, 'SAME_PERSON', 'Zgjidhjen e verifikon dikush tjetër nga ai që e dërgoi.');
      break;
    }
    default:
      break;
  }

  return { outcome: 'allow', def, from, to: def.to ?? from, text, assignees, via, onBehalf };
}

/** The actions this actor could take from this report's current state (for drawing buttons). */
export function availableReportActions(actor: ReportActor, report: ReportFacts): ActionDef[] {
  const role = workflowRoleOf(actor.role, actor.permissions ?? []);
  if (!role || role === 'monitor') return [];
  const from = queueOfStatus(report.status);
  const mine = liveAssignments(report.assignments).filter(a => holdsAssignment(actor, a));
  return ALL_ACTIONS.map(action => ACTIONS[action]).filter(def => {
    if (!def.from.includes(from)) return false;
    const owners = OWNERS[def.action];
    const byRole = owners.includes(role) || (owners.includes('approver') && String(actor.role).toLowerCase() === 'approver');
    if (!byRole && !(owners.includes('assignee') && mine.length > 0)) return false;
    if (def.action === 'reject_report' && from !== 'pending' && role !== 'superadmin') return false;
    if (def.action === 'submit_resolution' && !mine.some(a => a.status === 'active')) return false;
    if (role === 'municipality' && !sameText(actor.municipality, report.municipality)) return false;
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Tasks: the work a stage generates                                   */
/* ------------------------------------------------------------------ */

/**
 * The task kinds. Every task names one report and one action somebody must take; the
 * stage decides which exist. Tasks never change a report by themselves — completing
 * one is a side effect of the stage action, inside the same transaction.
 *
 *   review   Në pritje    → reviewer approves or rejects        (one, given to an agent)
 *   assign   U aprovua    → manager assigns responsibility      (manager queue)
 *   work     I caktuar /  → each assignee starts and resolves   (one per assignee)
 *            Në proces
 *   verify   Në proces    → superadmin verifies the resolution  (once all assignees submitted)
 *   close    U zgjidh     → superadmin approves the closure     (superadmin queue)
 */
export type TaskKind = 'review' | 'assign' | 'work' | 'verify' | 'close';

export const TASK_TEXT: Record<TaskKind, { label: string; doThis: string }> = {
  review: { label: 'Shqyrtim', doThis: 'Shqyrto: aprovo ose refuzo me arsye' },
  assign: { label: 'Caktim', doThis: 'Cakto përgjegjësin' },
  work: { label: 'Punë', doThis: 'Fillo procesin dhe dërgo zgjidhjen' },
  verify: { label: 'Verifikim', doThis: 'Verifiko dhe aprovo zgjidhjen' },
  close: { label: 'Mbyllje', doThis: 'Aprovo mbylljen' },
};

/** Which roles a queued (person-less) task is visible to. */
export const TASK_QUEUE_ROLES: Record<TaskKind, readonly WorkflowRole[]> = {
  review: ['superadmin', 'manager', 'agent'],
  assign: ['superadmin', 'manager'],
  work: ['superadmin', 'manager'],
  verify: ['superadmin'],
  close: ['superadmin'],
};

export function taskId(reportId: string, kind: TaskKind, key = ''): string {
  return `${reportId}__${kind}${key ? `__${key}` : ''}`;
}

export interface TaskPlan {
  id: string;
  kind: TaskKind;
  /** For `work`: the assignment it belongs to. */
  assignmentKey?: string;
}

/** The tasks that must be open for a report in this state. Everything else is closed. */
export function plannedTasks(reportId: string, queue: ReportQueue, assignments: readonly AssignmentFacts[]): TaskPlan[] {
  switch (queue) {
    case 'pending': return [{ id: taskId(reportId, 'review'), kind: 'review' }];
    case 'approved': return [{ id: taskId(reportId, 'assign'), kind: 'assign' }];
    case 'assigned':
    case 'in_process': {
      const active = assignments.filter(a => a.status === 'active');
      const plans: TaskPlan[] = active.map(a => ({ id: taskId(reportId, 'work', a.key), kind: 'work', assignmentKey: a.key }));
      const live = liveAssignments(assignments);
      if (queue === 'in_process' && live.length > 0 && active.length === 0) plans.push({ id: taskId(reportId, 'verify'), kind: 'verify' });
      // Everyone removed: the report needs assigning again, a manager is asked.
      if (live.length === 0) plans.push({ id: taskId(reportId, 'assign'), kind: 'assign' });
      return plans;
    }
    case 'resolved': return [{ id: taskId(reportId, 'close'), kind: 'close' }];
    default: return [];
  }
}

/* ------------------------------------------------------------------ */
/* Priority                                                            */
/* ------------------------------------------------------------------ */

export type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent';

export const PRIORITY_LABEL: Record<PriorityLevel, string> = { low: 'E ulët', normal: 'Normale', high: 'E lartë', urgent: 'Urgjente' };

/** Configurable on the server (`workflowConfig/reportPriority`); these are the defaults. */
export interface PriorityRules {
  urgency: Record<string, number>;
  aiSeverity: Record<string, number>;
  /** Extra weight per category name (lower-case match on the category). */
  category: Record<string, number>;
  /** Public impact: points per upvote, capped. */
  perUpvote: number;
  upvoteCap: number;
  /** Waiting time: points per day open, capped. */
  perDay: number;
  ageCap: number;
  /** Words in the title/description that signal risk to people. */
  riskWords: string[];
  riskBonus: number;
  overdueBonus: number;
  /** Score thresholds for the levels. */
  levels: { urgent: number; high: number; normal: number };
  /** Hours each level has before a task is due. */
  slaHours: Record<PriorityLevel, number>;
}

export const DEFAULT_PRIORITY_RULES: PriorityRules = {
  urgency: { 'Kritike': 45, 'E lartë': 30, 'Mesatare': 15, 'E ulët': 0 },
  aiSeverity: { CRITICAL: 25, HIGH: 15, MEDIUM: 5, LOW: 0 },
  category: { 'siguri': 15, 'shëndet': 15, 'ujë': 10, 'rrym': 10, 'infrastruktur': 5 },
  perUpvote: 1,
  upvoteCap: 20,
  perDay: 2,
  ageCap: 20,
  riskWords: ['rrezik', 'aksident', 'zjarr', 'fëmij', 'shkollë', 'vërshim', 'kabllo', 'gyp', 'shemb', 'helm'],
  riskBonus: 15,
  overdueBonus: 15,
  levels: { urgent: 60, high: 40, normal: 20 },
  slaHours: { urgent: 24, high: 72, normal: 168, low: 336 },
};

export interface PriorityResult { score: number; level: PriorityLevel; reasons: string[] }

const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

/** Merge a stored (partial, untrusted) rules document over the defaults. */
export function normalizePriorityRules(raw: unknown): PriorityRules {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<PriorityRules>;
  const map = (value: unknown, fallback: Record<string, number>) => {
    if (!value || typeof value !== 'object') return fallback;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.length <= 60 && typeof v === 'number' && Number.isFinite(v) && v >= -100 && v <= 100) out[k] = v;
    }
    return Object.keys(out).length ? out : fallback;
  };
  const d = DEFAULT_PRIORITY_RULES;
  const levels = r.levels && typeof r.levels === 'object' ? r.levels : d.levels;
  const sla = r.slaHours && typeof r.slaHours === 'object' ? r.slaHours : d.slaHours;
  const bounded = (v: unknown, fb: number, max: number) => Math.min(max, Math.max(0, num(v, fb)));
  return {
    urgency: map(r.urgency, d.urgency),
    aiSeverity: map(r.aiSeverity, d.aiSeverity),
    category: map(r.category, d.category),
    perUpvote: bounded(r.perUpvote, d.perUpvote, 20),
    upvoteCap: bounded(r.upvoteCap, d.upvoteCap, 100),
    perDay: bounded(r.perDay, d.perDay, 20),
    ageCap: bounded(r.ageCap, d.ageCap, 100),
    riskWords: Array.isArray(r.riskWords) ? r.riskWords.map(String).map(w => w.trim().toLowerCase()).filter(w => w && w.length <= 30).slice(0, 50) : d.riskWords,
    riskBonus: bounded(r.riskBonus, d.riskBonus, 100),
    overdueBonus: bounded(r.overdueBonus, d.overdueBonus, 100),
    levels: {
      urgent: bounded((levels as any).urgent, d.levels.urgent, 500),
      high: bounded((levels as any).high, d.levels.high, 500),
      normal: bounded((levels as any).normal, d.levels.normal, 500),
    },
    slaHours: {
      urgent: Math.max(1, bounded((sla as any).urgent, d.slaHours.urgent, 2000)),
      high: Math.max(1, bounded((sla as any).high, d.slaHours.high, 2000)),
      normal: Math.max(1, bounded((sla as any).normal, d.slaHours.normal, 4000)),
      low: Math.max(1, bounded((sla as any).low, d.slaHours.low, 8000)),
    },
  };
}

export function toMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const t = Date.parse(value); return Number.isFinite(t) ? t : 0; }
  if (value && typeof value === 'object') {
    const v = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    if (typeof v._seconds === 'number') return v._seconds * 1000;
  }
  return 0;
}

/** Urgency, risk, public impact, category and time waited → one score and a level. */
export function priorityOf(report: Record<string, any>, rules: PriorityRules = DEFAULT_PRIORITY_RULES, nowMs = Date.now()): PriorityResult {
  const reasons: string[] = [];
  let score = 0;
  const add = (points: number, why: string) => { if (points > 0) { score += points; reasons.push(`${why} +${Math.round(points)}`); } };

  add(rules.urgency[String(report?.urgency ?? '')] ?? 0, `Urgjenca ${report?.urgency}`);
  add(rules.aiSeverity[String(report?.aiSeverity ?? '')] ?? 0, `Rreziku i vlerësuar ${report?.aiSeverity}`);
  const category = String(report?.category ?? '').toLowerCase();
  let categoryPoints = 0;
  for (const [key, points] of Object.entries(rules.category)) {
    if (key && category.includes(key.toLowerCase())) categoryPoints = Math.max(categoryPoints, points);
  }
  add(categoryPoints, `Kategoria ${report?.category}`);
  add(Math.min(rules.upvoteCap, num(report?.upvotes) * rules.perUpvote), 'Ndikimi publik (mbështetje)');
  const created = toMillis(report?.createdAt);
  if (created > 0) add(Math.min(rules.ageCap, Math.floor((nowMs - created) / 86_400_000) * rules.perDay), 'Koha e pritjes');
  const body = `${report?.title ?? ''} ${report?.description ?? ''}`.toLowerCase();
  if (rules.riskWords.some(word => body.includes(word))) add(rules.riskBonus, 'Rrezik për njerëz');
  if (String(report?.status ?? '') === 'Overdue') add(rules.overdueBonus, 'Afati i kaluar');

  const level: PriorityLevel = score >= rules.levels.urgent ? 'urgent' : score >= rules.levels.high ? 'high' : score >= rules.levels.normal ? 'normal' : 'low';
  return { score: Math.round(score), level, reasons };
}

export function dueAtFor(level: PriorityLevel, fromMs: number, rules: PriorityRules = DEFAULT_PRIORITY_RULES): number {
  return fromMs + rules.slaHours[level] * 3_600_000;
}

/* ------------------------------------------------------------------ */
/* Choosing who does the work                                          */
/* ------------------------------------------------------------------ */

export interface Candidate {
  uid: string;
  name: string;
  role: string;
  /** From the verified claims, not the profile document. */
  permissions: readonly string[];
  disabled: boolean;
  /** Scope: an agent tied to one municipality only gets that municipality's work. */
  municipality?: string;
  /** Sector/department the person works in, and skills (category names). */
  department?: string;
  skills?: readonly string[];
  capacity: number;
  /** Open tasks the person holds now. */
  load: number;
  /** Was this person on the report before (continuity). */
  previouslyOnReport?: boolean;
}

export interface RankedCandidate extends Candidate {
  eligible: boolean;
  score: number;
  why: string[];
  /** Set when not eligible: the rule that excluded the person. */
  excluded?: string;
}

export interface WorkContext {
  municipality?: string;
  category?: string;
  sector?: string;
  /** Which kind of task the person would receive. */
  kind: TaskKind;
}

/**
 * Rank people for a piece of work. Eligibility is a hard filter (permissions, scope,
 * suspension, capacity); the score orders the eligible by sector fit, municipality,
 * free capacity and continuity. Nobody lacking the permission is ever returned as
 * eligible, so "assign automatically" cannot give work to the wrong account.
 */
export function rankCandidates(candidates: readonly Candidate[], context: WorkContext): RankedCandidate[] {
  const category = String(context.category ?? '').toLowerCase();
  const sector = String(context.sector ?? '').toLowerCase();
  const ranked = candidates.map((person): RankedCandidate => {
    const role = workflowRoleOf(person.role, person.permissions);
    const why: string[] = [];
    const out = (excluded: string): RankedCandidate => ({ ...person, eligible: false, score: 0, why, excluded });
    if (person.disabled) return out('Llogaria është e pezulluar');
    const mayHold = context.kind === 'review' || context.kind === 'work'
      ? role === 'agent' || role === 'manager'
      : context.kind === 'assign' ? role === 'manager' || role === 'superadmin' : role === 'superadmin';
    if (!mayHold) return out('Roli nuk e lejon këtë punë');
    if (person.municipality && context.municipality && !sameText(person.municipality, context.municipality)) {
      return out(`Punon vetëm për ${person.municipality}`);
    }
    if (person.load >= person.capacity) return out(`Kapaciteti i plotë (${person.load}/${person.capacity})`);

    let score = 0;
    const skills = (person.skills ?? []).map(s => s.toLowerCase());
    const department = String(person.department ?? '').toLowerCase();
    const fitsSector = Boolean(
      (category && (skills.some(s => s && category.includes(s)) || (department && category.includes(department)))) ||
      (sector && (skills.some(s => s && sector.includes(s)) || (department && sector.includes(department))))
    );
    if (fitsSector) { score += 40; why.push('Sektori përputhet'); }
    if (person.municipality && sameText(person.municipality, context.municipality)) { score += 20; why.push('Komuna e njëjtë'); }
    const free = Math.max(0, person.capacity - person.load);
    score += Math.min(30, Math.round((free / Math.max(1, person.capacity)) * 30));
    why.push(`Ngarkesa ${person.load}/${person.capacity}`);
    if (person.previouslyOnReport) { score += 10; why.push('E njeh rastin'); }
    return { ...person, eligible: true, score, why };
  });
  return ranked.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.load - b.load || a.uid.localeCompare(b.uid));
}

/** The single best eligible person, or null (the task then waits for a manager). */
export function pickAssignee(candidates: readonly Candidate[], context: WorkContext): RankedCandidate | null {
  const best = rankCandidates(candidates, context)[0];
  return best && best.eligible ? best : null;
}

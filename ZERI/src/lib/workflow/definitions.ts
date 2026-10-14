/**
 * The shared workflow engine's vocabulary: what kinds of work exist, which states each
 * one passes through, and which moves between states are allowed, by whom, and with
 * what in hand.
 *
 * Three kinds of work share one engine and do NOT share one lifecycle:
 *
 *   internal_task    work the organisation gives itself (verify a site, call a ministry)
 *   report_referral  one institution's share of a citizen report. A report that needs two
 *                    institutions has two referrals, each with its own state, so one
 *                    institution's progress or private notes are never another's
 *   moderation_case  a flagged piece of public debate, from automated flag to a human decision
 *
 * Everything here is data plus a validator (transition.ts). Nothing here touches a
 * database: the server applies a transition only after this says it is allowed.
 */
export type WorkKind = 'internal_task' | 'report_referral' | 'moderation_case';
export const WORK_KINDS: readonly WorkKind[] = ['internal_task', 'report_referral', 'moderation_case'];

export type WorkPriority = 'low' | 'normal' | 'high' | 'urgent';
export const PRIORITIES: readonly WorkPriority[] = ['low', 'normal', 'high', 'urgent'];

/**
 * What an account is *for* in this engine. An account can play several (an admin is a
 * manager and also a moderator); the engine asks "does the actor hold a role this
 * transition names", never "what is the account called".
 *
 *   manager       assigns, reassigns, overrides, cancels, approves work
 *   observer      reads everything in scope, changes nothing (the `monitor` role)
 *   agent         does assigned work
 *   municipality  does work for its own municipality only
 *   moderator     handles debate moderation cases
 *   citizen       the person a moderation decision is about (may appeal)
 */
export type WorkRole = 'manager' | 'observer' | 'agent' | 'municipality' | 'moderator' | 'citizen';

/** What a transition needs in hand besides the right to make it. */
export type Requirement = 'note' | 'reason' | 'evidence' | 'assignee';

export interface StateDef {
  label: string;
  /** No further moves (except an explicit reopen). */
  terminal?: boolean;
  /** Counts toward a worker's workload while the item is in this state. */
  active?: boolean;
  /** Waiting on somebody other than the assignee: the clock for the assignee pauses. */
  waiting?: boolean;
}

export interface TransitionDef {
  action: string;
  label: string;
  from: readonly string[];
  /** The state it ends in; `=` keeps the current one (an escalation, a comment). */
  to: string;
  roles: readonly WorkRole[];
  /** Only the person the item is assigned to may do it (managers may still, with a reason). */
  assigneeOnly?: boolean;
  requires?: readonly Requirement[];
  /** The actor must not be the person who made the decision being reviewed. */
  independentReview?: boolean;
  /** This move is the rework of rejected work: counts toward the rework tally. */
  rework?: boolean;
  /** This move reopens finished work: counts toward the reopen tally. */
  reopen?: boolean;
  /** Who is told. Resolved by the server into notification records. */
  notify?: ReadonlyArray<'assignee' | 'managers' | 'creator' | 'previous_assignee'>;
}

export interface WorkflowDef {
  kind: WorkKind;
  title: string;
  initial: string;
  states: Record<string, StateDef>;
  transitions: readonly TransitionDef[];
  /** Roles that may hold the item as its assignee, and so be given it by the assignment engine. */
  assigneeRoles: readonly string[];
}

const OPEN = ['assigned', 'accepted', 'in_progress', 'blocked', 'in_review'] as const;

export const INTERNAL_TASK: WorkflowDef = {
  kind: 'internal_task',
  title: 'Detyrë e brendshme',
  initial: 'unassigned',
  assigneeRoles: ['agent', 'responder', 'approver', 'dispatcher'],
  states: {
    unassigned: { label: 'Pa caktuar' },
    assigned: { label: 'Caktuar', active: true },
    accepted: { label: 'Pranuar', active: true },
    in_progress: { label: 'Në punë', active: true },
    blocked: { label: 'E bllokuar', active: true, waiting: true },
    in_review: { label: 'Në shqyrtim', active: true, waiting: true },
    done: { label: 'E kryer', terminal: true },
    cancelled: { label: 'E anuluar', terminal: true },
  },
  transitions: [
    { action: 'assign', label: 'Cakto', from: ['unassigned'], to: 'assigned', roles: ['manager'], requires: ['assignee'], notify: ['assignee'] },
    { action: 'reassign', label: 'Ricakto', from: ['assigned', 'accepted', 'in_progress', 'blocked'], to: 'assigned', roles: ['manager'], requires: ['assignee', 'reason'], notify: ['assignee', 'previous_assignee'] },
    { action: 'accept', label: 'Prano', from: ['assigned'], to: 'accepted', roles: ['agent'], assigneeOnly: true, notify: ['managers'] },
    { action: 'decline', label: 'Kërko ricaktim', from: ['assigned', 'accepted'], to: 'unassigned', roles: ['agent'], assigneeOnly: true, requires: ['reason'], notify: ['managers'] },
    { action: 'start', label: 'Fillo punën', from: ['accepted'], to: 'in_progress', roles: ['agent'], assigneeOnly: true },
    { action: 'block', label: 'Raporto bllokim', from: ['in_progress'], to: 'blocked', roles: ['agent'], assigneeOnly: true, requires: ['reason'], notify: ['managers'] },
    { action: 'unblock', label: 'Hiq bllokimin', from: ['blocked'], to: 'in_progress', roles: ['agent', 'manager'], assigneeOnly: true, requires: ['note'] },
    { action: 'submit', label: 'Dërgo për shqyrtim', from: ['in_progress'], to: 'in_review', roles: ['agent'], assigneeOnly: true, requires: ['note'], notify: ['managers'] },
    { action: 'complete', label: 'Mbyll', from: ['in_progress'], to: 'done', roles: ['agent'], assigneeOnly: true, requires: ['note'] },
    { action: 'approve', label: 'Aprovo punën', from: ['in_review'], to: 'done', roles: ['manager'], requires: ['note'], notify: ['assignee'] },
    { action: 'reject_work', label: 'Kthe për korrigjim', from: ['in_review'], to: 'in_progress', roles: ['manager'], requires: ['reason'], rework: true, notify: ['assignee'] },
    { action: 'reopen', label: 'Rihap', from: ['done'], to: 'in_progress', roles: ['manager'], requires: ['reason'], reopen: true, notify: ['assignee'] },
    { action: 'cancel', label: 'Anulo', from: ['unassigned', ...OPEN], to: 'cancelled', roles: ['manager'], requires: ['reason'], notify: ['assignee'] },
    { action: 'escalate', label: 'Eskalo', from: [...OPEN, 'unassigned'], to: '=', roles: ['agent', 'manager', 'municipality'], assigneeOnly: false, requires: ['reason'], notify: ['managers'] },
  ],
};

export const REPORT_REFERRAL: WorkflowDef = {
  kind: 'report_referral',
  title: 'Referim i raportit te një institucion',
  initial: 'pending_acceptance',
  assigneeRoles: ['agent', 'responder', 'approver', 'dispatcher', 'municipality'],
  states: {
    pending_acceptance: { label: 'Pret pranimin' },
    acknowledged: { label: 'Pranuar', active: true },
    investigating: { label: 'Në hetim', active: true },
    returned: { label: 'Kërkon sqarim', active: true, waiting: true },
    action_taken: { label: 'Veprim i ndërmarrë', active: true },
    resolved: { label: 'Zgjidhur' },
    transferred: { label: 'Transferuar', terminal: true },
    closed: { label: 'Mbyllur', terminal: true },
  },
  transitions: [
    { action: 'acknowledge', label: 'Pranoj referimin', from: ['pending_acceptance'], to: 'acknowledged', roles: ['municipality', 'agent', 'manager'], notify: ['managers'] },
    { action: 'investigate', label: 'Filloj hetimin', from: ['acknowledged'], to: 'investigating', roles: ['municipality', 'agent', 'manager'], assigneeOnly: true },
    { action: 'request_clarification', label: 'Kërko sqarim', from: ['acknowledged', 'investigating'], to: 'returned', roles: ['municipality', 'agent'], requires: ['note'], notify: ['managers', 'creator'] },
    { action: 'clarify', label: 'Jep sqarimin', from: ['returned'], to: 'acknowledged', roles: ['agent', 'manager'], requires: ['note'], notify: ['assignee'] },
    { action: 'take_action', label: 'Raporto veprimin', from: ['investigating'], to: 'action_taken', roles: ['municipality', 'agent', 'manager'], assigneeOnly: true, requires: ['note'], notify: ['managers'] },
    { action: 'resolve', label: 'Zgjidh', from: ['action_taken'], to: 'resolved', roles: ['municipality', 'agent', 'manager'], assigneeOnly: true, requires: ['note'], notify: ['managers', 'creator'] },
    { action: 'transfer', label: 'Transfero te departamenti tjetër', from: ['acknowledged', 'investigating'], to: 'transferred', roles: ['municipality', 'manager'], requires: ['reason'], notify: ['managers'] },
    { action: 'close', label: 'Mbyll', from: ['resolved', 'returned'], to: 'closed', roles: ['manager'], requires: ['note'] },
    { action: 'reopen', label: 'Rihap', from: ['resolved', 'closed'], to: 'investigating', roles: ['manager'], requires: ['reason'], reopen: true, notify: ['assignee'] },
    { action: 'escalate', label: 'Eskalo', from: ['acknowledged', 'investigating', 'returned', 'action_taken'], to: '=', roles: ['agent', 'manager', 'municipality'], requires: ['reason'], notify: ['managers'] },
  ],
};

export const MODERATION_CASE: WorkflowDef = {
  kind: 'moderation_case',
  title: 'Rast moderimi i debatit',
  initial: 'flagged',
  assigneeRoles: ['debatwp', 'moderator'],
  states: {
    flagged: { label: 'I shënuar (automatik, i pakonfirmuar)' },
    under_review: { label: 'Në shqyrtim', active: true },
    violation_confirmed: { label: 'Shkelje e konfirmuar', active: true },
    no_violation: { label: 'Pa shkelje', active: true },
    restricted: { label: 'Kufizuar', active: true },
    appealed: { label: 'Me apelim', active: true },
    resolved: { label: 'Zgjidhur', terminal: true },
  },
  transitions: [
    { action: 'open_review', label: 'Hap shqyrtimin', from: ['flagged'], to: 'under_review', roles: ['moderator', 'manager'], requires: ['assignee'] },
    // The only roads to "violation_confirmed" and "restricted" are human decisions with a reason.
    { action: 'confirm_violation', label: 'Konfirmo shkeljen', from: ['under_review'], to: 'violation_confirmed', roles: ['moderator'], assigneeOnly: true, requires: ['reason'], notify: ['managers'] },
    { action: 'dismiss', label: 'Nuk ka shkelje', from: ['under_review'], to: 'no_violation', roles: ['moderator'], assigneeOnly: true, requires: ['reason'] },
    { action: 'restrict', label: 'Apliko kufizimin', from: ['violation_confirmed'], to: 'restricted', roles: ['moderator'], assigneeOnly: true, requires: ['reason'], notify: ['managers'] },
    { action: 'resolve', label: 'Mbyll rastin', from: ['no_violation', 'violation_confirmed', 'restricted'], to: 'resolved', roles: ['moderator'], assigneeOnly: true, requires: ['note'] },
    { action: 'appeal', label: 'Apelo', from: ['violation_confirmed', 'restricted'], to: 'appealed', roles: ['citizen'], requires: ['reason'], notify: ['managers'] },
    // A different moderator reviews an appeal than the one who decided.
    { action: 'overturn', label: 'Rrëzo vendimin', from: ['appealed'], to: 'no_violation', roles: ['moderator', 'manager'], requires: ['reason'], independentReview: true },
    { action: 'uphold', label: 'Mbaj vendimin', from: ['appealed'], to: 'restricted', roles: ['moderator', 'manager'], requires: ['reason'], independentReview: true },
    { action: 'reopen', label: 'Rihap', from: ['resolved'], to: 'under_review', roles: ['manager'], requires: ['reason'], reopen: true },
    { action: 'escalate', label: 'Eskalo', from: ['flagged', 'under_review', 'violation_confirmed', 'appealed'], to: '=', roles: ['moderator', 'manager'], requires: ['reason'], notify: ['managers'] },
  ],
};

export const WORKFLOWS: Record<WorkKind, WorkflowDef> = {
  internal_task: INTERNAL_TASK,
  report_referral: REPORT_REFERRAL,
  moderation_case: MODERATION_CASE,
};

/** States that count toward a worker's workload. */
export function isActiveState(kind: WorkKind, state: string): boolean {
  return Boolean(WORKFLOWS[kind]?.states[state]?.active);
}

export function isTerminalState(kind: WorkKind, state: string): boolean {
  return Boolean(WORKFLOWS[kind]?.states[state]?.terminal);
}

/** The moves available from a state, whoever is asking (the UI then filters by actor). */
export function transitionsFrom(kind: WorkKind, state: string): readonly TransitionDef[] {
  return WORKFLOWS[kind].transitions.filter(transition => transition.from.includes(state));
}

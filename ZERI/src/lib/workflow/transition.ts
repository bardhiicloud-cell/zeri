import { WORKFLOWS, type Requirement, type TransitionDef, type WorkKind, type WorkRole } from './definitions';

/**
 * May this person make this move on this item, right now?
 *
 * One pure function answers it for every kind of work, so the rules cannot differ
 * between the four consoles. The server runs it inside the transaction that writes the
 * change; the screens run it to decide which buttons to draw. A refusal carries a code
 * and a sentence a person can act on.
 */
export interface WorkActor {
  uid: string;
  role: string;
  /** Verified token claims only; never the profile document. */
  permissions?: readonly string[];
  municipality?: string;
}

/** The fields of a work item the decision needs. */
export interface WorkItemFacts {
  kind: WorkKind;
  status: string;
  assigneeUid: string | null;
  municipality?: string;
  /** The person a moderation case is about (may appeal it). */
  subjectUid?: string;
  /** Who made the decision an appeal is about. */
  decidedBy?: string | null;
  /** The work goes to a reviewer before it counts as done. */
  requiresReview?: boolean;
  /** The work must be closed with evidence. */
  requiresEvidence?: boolean;
}

export interface TransitionRequest {
  action: string;
  note?: unknown;
  reason?: unknown;
  evidence?: unknown;
  assigneeUid?: unknown;
}

export const MIN_NOTE = 3;
export const MAX_NOTE = 1000;
export const MIN_REASON = 5;
export const MAX_REASON = 300;
export const MAX_EVIDENCE = 10;

export type DenyCode =
  | 'UNKNOWN_ACTION' | 'READ_ONLY' | 'WRONG_ROLE' | 'NOT_FOUND' | 'WRONG_STATE' | 'NOT_ASSIGNEE'
  | 'NOTE_REQUIRED' | 'REASON_REQUIRED' | 'EVIDENCE_REQUIRED' | 'ASSIGNEE_REQUIRED'
  | 'REVIEW_REQUIRED' | 'SAME_REVIEWER' | 'OVERRIDE_REASON_REQUIRED';

export type TransitionDecision =
  | {
      outcome: 'allow';
      def: TransitionDef;
      to: string;
      /** A manager acting on work that is not theirs; always recorded with the reason. */
      override: boolean;
      /** The assignee after the move: `undefined` keeps it, `null` clears it. */
      assigneeUid: string | null | undefined;
      note: string;
      reason: string;
      evidence: string[];
    }
  | { outcome: 'deny'; status: 400 | 403 | 404 | 409; code: DenyCode; error: string };

const deny = (status: 400 | 403 | 404 | 409, code: DenyCode, error: string): TransitionDecision => ({ outcome: 'deny', status, code, error });

/** The workflow roles an account holds. See definitions.ts for what each is for. */
export function workRolesOf(actor: Pick<WorkActor, 'role'>): ReadonlySet<WorkRole> {
  const roles = new Set<WorkRole>();
  switch (String(actor.role ?? '')) {
    case 'superadmin':
    case 'admin':
      roles.add('manager'); roles.add('moderator'); break;
    case 'dispatcher':
      roles.add('manager'); roles.add('agent'); break;
    case 'monitor':
      roles.add('observer'); break;
    case 'agent':
    case 'responder':
    case 'approver':
      roles.add('agent'); break;
    case 'moderator':
      roles.add('agent'); roles.add('moderator'); break;
    case 'debatwp':
      roles.add('moderator'); break;
    case 'municipality':
      roles.add('municipality'); break;
    case 'citizen':
    case 'user':
      roles.add('citizen'); break;
    default: break;
  }
  return roles;
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

function evidenceOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => text(item)).filter(url => /^https?:\/\//i.test(url)).slice(0, MAX_EVIDENCE);
}

export function decideTransition(input: { actor: WorkActor; item: WorkItemFacts; request: TransitionRequest }): TransitionDecision {
  const { actor, item, request } = input;
  const workflow = WORKFLOWS[item.kind];
  if (!workflow) return deny(400, 'UNKNOWN_ACTION', 'Lloji i punës nuk njihet.');

  const def = workflow.transitions.find(transition => transition.action === request.action);
  if (!def) return deny(400, 'UNKNOWN_ACTION', 'Ky veprim nuk ekziston për këtë lloj pune.');

  const held = workRolesOf(actor);
  if (held.size === 0) return deny(403, 'WRONG_ROLE', 'Kjo llogari nuk punon me detyra.');
  if (held.size === 1 && held.has('observer')) return deny(403, 'READ_ONLY', 'Roli i monitorimit lexon, nuk ndryshon punë.');
  const usable = def.roles.filter(role => held.has(role));
  if (usable.length === 0) return deny(403, 'WRONG_ROLE', 'Roli juaj nuk e lejon këtë veprim.');

  // A municipality only ever sees its own work; another's is "not found", not "forbidden".
  if (held.has('municipality') && usable.every(role => role === 'municipality')) {
    if (!actor.municipality || actor.municipality !== item.municipality) return deny(404, 'NOT_FOUND', 'Detyra nuk u gjet.');
  }
  // A citizen may only act on a case about their own content.
  if (usable.every(role => role === 'citizen') && (!item.subjectUid || item.subjectUid !== actor.uid)) {
    return deny(404, 'NOT_FOUND', 'Detyra nuk u gjet.');
  }

  if (!def.from.includes(item.status)) {
    return deny(409, 'WRONG_STATE', `Nga gjendja "${workflow.states[item.status]?.label ?? item.status}" nuk lejohet "${def.label}".`);
  }

  if (item.kind === 'internal_task' && def.action === 'complete' && item.requiresReview) {
    return deny(409, 'REVIEW_REQUIRED', 'Kjo detyrë kërkon shqyrtim: dërgojeni për shqyrtim në vend që ta mbyllni.');
  }

  const reason = text(request.reason);
  const note = text(request.note);

  // Someone other than the assignee acts on assigned work: only a manager, only where the
  // transition names managers, and only with a reason on the record.
  let override = false;
  if (def.assigneeOnly && item.assigneeUid && actor.uid !== item.assigneeUid) {
    if (!(usable.includes('manager') && held.has('manager'))) return deny(403, 'NOT_ASSIGNEE', 'Vetëm personi te i cili është caktuar mund ta bëjë këtë.');
    if (reason.length < MIN_REASON) return deny(400, 'OVERRIDE_REASON_REQUIRED', 'Ndërhyrja në punën e dikujt tjetër kërkon një arsye.');
    override = true;
  }
  if (def.assigneeOnly && !item.assigneeUid && !usable.includes('manager')) {
    return deny(409, 'NOT_ASSIGNEE', 'Kjo detyrë nuk i është caktuar askujt.');
  }

  if (def.independentReview && item.decidedBy && actor.uid === item.decidedBy) {
    return deny(403, 'SAME_REVIEWER', 'Apelimin e shqyrton një moderator tjetër nga ai që mori vendimin.');
  }

  const needs = (requirement: Requirement) => def.requires?.includes(requirement) ?? false;
  if (needs('reason') && (reason.length < MIN_REASON || reason.length > MAX_REASON)) {
    return deny(400, 'REASON_REQUIRED', `Shkruani një arsye (${MIN_REASON}–${MAX_REASON} shenja).`);
  }
  if (needs('note') && (note.length < MIN_NOTE || note.length > MAX_NOTE)) {
    return deny(400, 'NOTE_REQUIRED', `Shkruani një shënim (${MIN_NOTE}–${MAX_NOTE} shenja).`);
  }

  const evidence = evidenceOf(request.evidence);
  const closing = ['submit', 'complete', 'take_action', 'resolve'].includes(def.action);
  if (closing && item.requiresEvidence && evidence.length === 0) {
    return deny(400, 'EVIDENCE_REQUIRED', 'Kjo detyrë kërkon dëshmi (një lidhje foto ose dokumenti).');
  }

  let assigneeUid: string | null | undefined;
  if (needs('assignee')) {
    const target = text(request.assigneeUid);
    if (!target) return deny(400, 'ASSIGNEE_REQUIRED', 'Zgjidhni personin të cilit i caktohet.');
    assigneeUid = target;
  } else if (def.action === 'decline') {
    assigneeUid = null;
  }

  return {
    outcome: 'allow',
    def,
    to: def.to === '=' ? item.status : def.to,
    override,
    assigneeUid,
    note,
    reason,
    evidence,
  };
}

/** The moves this actor may attempt from the item's current state (for drawing buttons). */
export function availableActions(actor: WorkActor, item: WorkItemFacts): TransitionDef[] {
  const workflow = WORKFLOWS[item.kind];
  return workflow.transitions.filter(def => {
    if (!def.from.includes(item.status)) return false;
    const held = workRolesOf(actor);
    if (!def.roles.some(role => held.has(role))) return false;
    if (def.assigneeOnly && item.assigneeUid && actor.uid !== item.assigneeUid) return held.has('manager') && def.roles.includes('manager');
    return true;
  });
}

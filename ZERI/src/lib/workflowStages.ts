import type { Report } from '../types';
import { DECISION_KINDS, decide, patchFor } from './decisionRules';
import { TRANSITIONS, availableTransitions, type Transition } from './approvalPipeline';

/**
 * The staged board: one set of stages for everything staff approve.
 *
 *   Raportuar -> Aprovuar -> Në pritje -> Përgjigje -> Përfunduar      (and Refuzuar)
 *
 * Reports, donation appeals, health cases and news all read the same way, so one screen
 * can move any of them. What changes is the rule behind each move:
 *
 *   - reports follow the approval pipeline (server/approvalPipeline.ts): who may do a
 *     step is fixed by role, and a move is one transition;
 *   - donations, health cases and news follow the decision tables
 *     (src/lib/decisionRules.ts): a move is a short chain of decision actions, found
 *     here, and each one is still checked by the server when it runs.
 *
 * Nothing in this file writes anything. It answers "which stage is this in?" and "what
 * would it take to move it there, for this person?" - the screen asks the server to do
 * the moves one by one, so a refusal on one record never blocks the rest.
 */

export type StageKey = 'reported' | 'approved' | 'waiting' | 'responded' | 'completed' | 'rejected';

/** The columns in flow order. Refused records sit beside them, not in the flow. */
export const FLOW_STAGES: readonly StageKey[] = ['reported', 'approved', 'waiting', 'responded', 'completed'];
export const ALL_STAGES: readonly StageKey[] = [...FLOW_STAGES, 'rejected'];

export type BoardKind = 'report' | 'donation' | 'health' | 'news';
export type DocBoardKind = Exclude<BoardKind, 'report'>;

export interface StageText {
  label: string;
  hint: string;
}

const BASE_TEXT: Record<StageKey, StageText> = {
  reported: { label: 'Raportuar', hint: 'Të reja, ende pa shqyrtuar.' },
  approved: { label: 'Aprovuar', hint: 'Të shqyrtuara dhe të pranuara.' },
  waiting: { label: 'Në pritje', hint: 'Presin veprimin e tjetrit.' },
  responded: { label: 'Përgjigje', hint: 'Është dhënë përgjigje.' },
  completed: { label: 'Përfunduar', hint: 'Puna ka mbaruar.' },
  rejected: { label: 'Refuzuar', hint: 'Nuk pranohen.' },
};

const KIND_TEXT: Record<BoardKind, Partial<Record<StageKey, Partial<StageText>>>> = {
  report: {
    approved: { hint: 'Agjenti i aprovoi dhe i kaloi te komuna.' },
    waiting: { hint: 'Komuna i mori përsipër; pret punën.' },
    responded: { hint: 'Komuna dha përgjigje me shënim.' },
    completed: { hint: 'Punimet u kryen; raporti është i zgjidhur.' },
  },
  donation: {
    reported: { hint: 'Kërkesa të reja për fonde.' },
    approved: { hint: 'Aprovuar dhe publike në faqen e donacioneve.' },
    waiting: { hint: 'Pret dokumente, verifikim ose fonde.' },
    responded: { hint: 'Organizatori ka dhënë përgjigje.' },
    completed: { hint: 'Fushata ka përfunduar.' },
  },
  health: {
    reported: { hint: 'Raste të reja në regjistër.' },
    approved: { label: 'Verifikuar', hint: 'Rasti u verifikua.' },
    waiting: { hint: 'Pret spitalin ose komunën.' },
    responded: { hint: 'Spitali ose komuna ka përgjigjur.' },
    completed: { label: 'Zgjidhur', hint: 'Rasti u zgjidh.' },
  },
  news: {
    reported: { label: 'Drafte', hint: 'Tekste të dorëzuara, ende pa aprovuar.' },
    approved: { hint: 'Aprovuar nga redaktori, ende pa u publikuar.' },
    waiting: { label: 'Në pritje të publikimit', hint: 'Gati; presin kohën e duhur.' },
    responded: { label: 'Për rishikim', hint: 'Kthyer te autori për korrigjim.' },
    completed: { label: 'Publikuar', hint: 'Janë publike në faqe.' },
  },
};

export function stageText(kind: BoardKind, stage: StageKey): StageText {
  return { ...BASE_TEXT[stage], ...KIND_TEXT[kind][stage] };
}

/* ------------------------------------------------------------------ */
/* Donations, health cases, news                                       */
/* ------------------------------------------------------------------ */

type Doc = Record<string, any>;

/**
 * The stage of a record. The public status decides the ends (new, refused, done); the
 * stages in between are the optional `workflowStage` the decision steps write.
 */
export function docStage(kind: DocBoardKind, doc: Doc): StageKey {
  const state = DECISION_KINDS[kind].stateOf(doc);
  const sub = String(doc?.workflowStage ?? '');

  switch (kind) {
    case 'donation':
      if (state === 'rejected') return 'rejected';
      if (state === 'approved') return sub === 'waiting' || sub === 'responded' || sub === 'completed' ? sub : 'approved';
      return 'reported';
    case 'health':
      if (state === 'rejected') return 'rejected';
      if (state === 'resolved') return 'completed';
      if (state === 'verified') return sub === 'waiting' || sub === 'responded' ? sub : 'approved';
      return 'reported';
    case 'news':
      if (state === 'published') return 'completed';
      if (state === 'rejected') return 'rejected';
      return sub === 'approved' || sub === 'waiting' || sub === 'responded' ? sub : 'reported';
  }
}

interface Edge {
  /** The decision action in DECISION_KINDS[kind].actions. */
  action: string;
  from: readonly StageKey[];
  to: StageKey;
}

/** `stage_<target>` for every pair of stages inside `stages`. */
const restage = (stages: readonly StageKey[]): Edge[] =>
  stages.map(to => ({ action: `stage_${to}`, from: stages.filter(s => s !== to), to }));

/**
 * What each decision action does to the stage. A test applies every edge to a sample
 * record and checks the record really lands where the edge says, so this table and
 * decisionRules.ts cannot drift apart unnoticed.
 */
export const EDGES: Record<DocBoardKind, readonly Edge[]> = {
  donation: [
    { action: 'approve', from: ['reported', 'rejected'], to: 'approved' },
    { action: 'reject', from: ['reported', 'approved', 'waiting', 'responded', 'completed'], to: 'rejected' },
    { action: 'reopen', from: ['approved', 'waiting', 'responded', 'completed', 'rejected'], to: 'reported' },
    ...restage(['approved', 'waiting', 'responded', 'completed']),
  ],
  health: [
    { action: 'approve', from: ['reported', 'rejected'], to: 'approved' },
    { action: 'reject', from: ['reported', 'approved', 'waiting', 'responded'], to: 'rejected' },
    { action: 'resolve', from: ['approved', 'waiting', 'responded'], to: 'completed' },
    { action: 'reopen', from: ['approved', 'waiting', 'responded', 'rejected', 'completed'], to: 'reported' },
    ...restage(['approved', 'waiting', 'responded']),
  ],
  news: [
    { action: 'publish', from: ['reported', 'approved', 'waiting', 'responded', 'rejected'], to: 'completed' },
    { action: 'unpublish', from: ['completed'], to: 'reported' },
    { action: 'reject', from: ['reported', 'approved', 'waiting', 'responded'], to: 'rejected' },
    { action: 'reopen', from: ['rejected'], to: 'reported' },
    ...restage(['reported', 'approved', 'waiting', 'responded']),
  ],
};

/**
 * The shortest chain of actions from one stage to another, or null when none exists.
 * Refusal is a destination only: a path never passes through "Refuzuar", which would
 * ask for a reason the person did not mean to give.
 */
export function planPath(kind: DocBoardKind, from: StageKey, to: StageKey): string[] | null {
  if (from === to) return [];
  const edges = EDGES[kind];
  const seen = new Map<StageKey, string[]>([[from, []]]);
  const queue: StageKey[] = [from];

  while (queue.length > 0) {
    const current = queue.shift() as StageKey;
    const path = seen.get(current) as string[];
    for (const edge of edges) {
      if (!edge.from.includes(current) || seen.has(edge.to)) continue;
      if (edge.to === 'rejected' && to !== 'rejected') continue;
      seen.set(edge.to, [...path, edge.action]);
      if (edge.to === to) return seen.get(edge.to) as string[];
      queue.push(edge.to);
    }
  }
  return null;
}

export interface Actor {
  uid: string;
  role: string;
  municipality: string;
  permissions: readonly string[];
}

export type DocMovePlan =
  | { ok: true; actions: string[]; needsReason: boolean }
  | { ok: false; reason: string };

/** A stand-in reason that satisfies the length check while a plan is only being tested. */
const PROBE_REASON = 'x'.repeat(5);

/**
 * May this person move this record to that stage, and by which actions? The chain is
 * run against a copy of the record, step by step, with the same `decide()` the server
 * uses - so a move the plan accepts is a move the server will not refuse for role,
 * section or state (it can still refuse if someone else changed the record meanwhile).
 */
export function planDocMove(kind: DocBoardKind, doc: Doc, to: StageKey, actor: Actor): DocMovePlan {
  const from = docStage(kind, doc);
  if (from === to) return { ok: false, reason: `Tashmë në “${stageText(kind, to).label}”.` };

  const path = planPath(kind, from, to);
  if (!path) {
    return { ok: false, reason: `Nuk ka hap nga “${stageText(kind, from).label}” te “${stageText(kind, to).label}”.` };
  }

  const rule = DECISION_KINDS[kind];
  let current: Doc = { ...doc };
  let needsReason = false;
  for (const action of path) {
    const step = rule.actions[action];
    if (!step) return { ok: false, reason: `Veprimi “${action}” nuk ekziston për këtë lloj.` };
    const verdict = decide({ actor, kind, action, reason: step.needsReason ? PROBE_REASON : '', doc: current });
    if (verdict.outcome === 'deny') return { ok: false, reason: verdict.error };
    if (step.needsReason) needsReason = true;
    current = { ...current, ...patchFor(kind, action, new Date().toISOString(), { reason: '', campaignId: '' }) };
  }
  return { ok: true, actions: path, needsReason };
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

type ReportShape = Pick<Report, 'status' | 'timeline'>;

/** A municipality has written something on the report while working it. */
export function hasMunicipalResponse(report: Pick<Report, 'timeline'>): boolean {
  return (report.timeline ?? []).some(t => t.status === 'In Progress' && String(t.comment ?? '').trim().length > 0);
}

/**
 * Reports sit where the pipeline puts them. "Në pritje" and "Përgjigje" are both the
 * municipality working the report; what tells them apart is whether it has written a
 * response yet - the same fact `municipality_done` insists on before it closes one.
 */
export function reportStage(report: ReportShape): StageKey {
  switch (report.status) {
    case 'Rejected':
      return 'rejected';
    case 'Resolved':
      return 'completed';
    case 'Approved':
      return 'approved';
    case 'Assigned':
    case 'In Progress':
    case 'Overdue':
      return hasMunicipalResponse(report) ? 'responded' : 'waiting';
    default:
      return 'reported';
  }
}

export type PipelineRole = 'agent' | 'municipality' | 'staff';

/** The role an account plays in the report pipeline, or null for none. Same as the server's. */
export function pipelineRoleFor(role: string, permissions: readonly string[] = []): PipelineRole | null {
  const r = String(role || '').toLowerCase();
  if (r === 'municipality') return 'municipality';
  if (r === 'admin' || r === 'superadmin') return 'staff';
  if (r === 'agent' || r === 'responder' || r === 'dispatcher' || r === 'moderator' || r === 'approver') return 'agent';
  if (permissions.includes('agents')) return 'agent';
  return null;
}

export type NoteMode = 'none' | 'optional' | 'required';

export type ReportMovePlan =
  | { ok: true; transition: Transition; label: string; note: NoteMode }
  | { ok: false; reason: string };

const WHO: Record<PipelineRole, string> = { agent: 'agjenti', municipality: 'komuna', staff: 'stafi' };

/**
 * May this person move this report to that stage? One transition, because each stage of
 * the pipeline has exactly one owner and a report is not handed over twice in one go.
 *
 * The owner can do the agent's steps (approve, refuse) but not the municipality's: the
 * rule that the owner does not attest to a municipality's physical work is the
 * pipeline's, and the board shows it as "this step is the municipality's".
 */
export function planReportMove(report: Report, to: StageKey, role: PipelineRole | null): ReportMovePlan {
  const from = reportStage(report);
  if (from === to) return { ok: false, reason: `Tashmë në “${stageText('report', to).label}”.` };
  if (!role) return { ok: false, reason: 'Kjo llogari nuk ka rol në rrjedhën e aprovimit.' };

  let transition: Transition;
  let note: NoteMode = 'none';
  switch (to) {
    case 'approved':
      transition = 'pass_to_municipality';
      break;
    case 'waiting':
      transition = 'municipality_accept';
      break;
    case 'responded':
      // Accepting with a written note is how a municipality answers; there is no
      // separate "respond" step once the report is already being worked.
      if (from !== 'approved') {
        return { ok: false, reason: 'Përgjigjen e shkruan komuna kur e merr përsipër punën; një raporti që po punohet nuk i shtohet përgjigje këtu.' };
      }
      transition = 'municipality_accept';
      note = 'required';
      break;
    case 'completed':
      transition = 'municipality_done';
      note = 'optional';
      break;
    case 'rejected':
      transition = 'reject';
      note = 'required';
      break;
    case 'reported':
    default:
      return { ok: false, reason: 'Një raport nuk kthehet te “Raportuar”.' };
  }

  const rule = TRANSITIONS.find(t => t.transition === transition);
  if (!rule) return { ok: false, reason: 'Veprimi nuk njihet.' };

  const asRole: PipelineRole = role === 'staff' && rule.by === 'agent' ? 'agent' : role;
  if (rule.by !== asRole) {
    return { ok: false, reason: `Ky hap kryhet nga ${WHO[rule.by]}, jo nga ${WHO[role]}.` };
  }

  const verdict = availableTransitions(report, asRole).find(a => a.rule.transition === transition);
  if (!verdict || !verdict.allowed) {
    return { ok: false, reason: verdict?.reason ?? 'Hapi nuk lejohet nga faza e tanishme.' };
  }
  return { ok: true, transition, label: rule.label, note };
}

/* ------------------------------------------------------------------ */
/* Who moves the work on, and what comes next                          */
/* ------------------------------------------------------------------ */

export interface StageActor {
  /** Who has to act for a record in this stage to move on. */
  who: string;
  /** What they do, in one line. */
  does: string;
}

/**
 * The person or office that holds the work in each stage. Taken from the stage
 * descriptions above and the pipeline rules (agent → municipality → staff for reports;
 * the decision tables for the others). Display only: it grants nothing.
 */
const ACTORS: Record<BoardKind, Partial<Record<StageKey, StageActor>>> = {
  report: {
    reported: { who: 'Agjenti', does: 'Shqyrton raportin, kërkon informacion nëse mungon dhe e aprovon ose e refuzon.' },
    approved: { who: 'Komuna', does: 'Merr përsipër raportin e kaluar nga agjenti.' },
    waiting: { who: 'Komuna', does: 'Kryen punën në terren dhe jep përgjigje zyrtare.' },
    responded: { who: 'Administrata', does: 'Verifikon përgjigjen e komunës dhe e mbyll rastin.' },
  },
  donation: {
    reported: { who: 'Stafi i donacioneve', does: 'Kontrollon kërkesën dhe dokumentet, pastaj e aprovon ose e refuzon.' },
    approved: { who: 'Stafi i donacioneve', does: 'Fushata është publike; ndjek mbledhjen e fondeve.' },
    waiting: { who: 'Organizatori', does: 'Dërgon dokumentet, verifikimin ose fondet që mungojnë.' },
    responded: { who: 'Stafi i donacioneve', does: 'Vlerëson përgjigjen e organizatorit dhe e mbyll fushatën.' },
  },
  health: {
    reported: { who: 'Stafi shëndetësor', does: 'Verifikon rastin e ri.' },
    approved: { who: 'Spitali / Komuna', does: 'Merr rastin e verifikuar.' },
    waiting: { who: 'Spitali / Komuna', does: 'Trajton rastin dhe jep përgjigje.' },
    responded: { who: 'Stafi shëndetësor', does: 'Kontrollon përgjigjen dhe e shënon të zgjidhur.' },
  },
  news: {
    reported: { who: 'Redaktori', does: 'Lexon draftin dhe e aprovon, ose e kthen te autori.' },
    approved: { who: 'Redaktori', does: 'Cakton kohën e publikimit.' },
    waiting: { who: 'Redaktori', does: 'E publikon në kohën e caktuar.' },
    responded: { who: 'Autori', does: 'Korrigjon tekstin dhe e dorëzon përsëri.' },
  },
};

/** Who acts in this stage; null for the ends of the flow (finished, refused). */
export function stageActor(kind: BoardKind, stage: StageKey): StageActor | null {
  return ACTORS[kind][stage] ?? null;
}

/** The next stage in the flow, if any. */
export function nextFlowStage(stage: StageKey): StageKey | null {
  const index = FLOW_STAGES.indexOf(stage);
  return index >= 0 && index < FLOW_STAGES.length - 1 ? FLOW_STAGES[index + 1] : null;
}

/** Whole days between a date (ISO, Firestore timestamp, {seconds}) and now; null when unknown. */
export function daysSince(value: unknown, nowMs: number = Date.now()): number | null {
  let ms = Number.NaN;
  if (typeof value === 'string') ms = Date.parse(value);
  else if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') ms = (value as { toDate: () => Date }).toDate().getTime();
  else if (value && typeof (value as { seconds?: number }).seconds === 'number') ms = (value as { seconds: number }).seconds * 1000;
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((nowMs - ms) / 86_400_000));
}

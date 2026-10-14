import type { Express, Request, RequestHandler, Response } from 'express';
import {
  FieldPath, FieldValue, Timestamp,
  type DocumentSnapshot, type Firestore, type Query, type Transaction,
} from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { mayUseSection } from './policy';
import { findComment, removeComment, type Comment } from './forumPosts';
import { describeRestriction, liftExpiredSuspensions, untilMs } from './accountRestrictions';

/**
 * Moderation of the public debate (WP Debate) as cases, not as loose reports.
 *
 * Every report of a post, a comment, an account or an ad lands on ONE case per target
 * (`moderationCases/{kind}_{targetId}`), however many people report it: the case counts
 * the reports and their reasons, keeps a snapshot of what was reported, and is worked by
 * one moderator at a time.
 *
 * A decision is applied to the real thing in the same transaction that records it:
 *
 *   hide          the post stops being shown (reversible)
 *   remove        the post is soft-deleted, or the comment is taken out of its thread;
 *                 a full copy is kept in `moderationEvidence` first (server-only)
 *   unpromote     an ad stops being promoted
 *   warn          a warning is added to the account
 *   suspend       the account cannot post, comment or message until a date (1-90 days)
 *   ban           the account is restricted with no end and its sign-in is disabled
 *                 (administrators only)
 *   dismiss       no violation: the reports are closed, nothing is changed
 *   restore       a moderator undoes the last effect
 *
 * The person a decision is about may appeal once; the appeal is decided by a different
 * moderator than the one who decided (uphold, or overturn, which undoes the effect).
 * Nothing is removed or restricted because of reports alone.
 *
 * State names follow the `moderation_case` workflow in src/lib/workflow/definitions.ts,
 * so these cases can later be counted with the rest of the work.
 */
export const CASES = 'moderationCases';
export const EVIDENCE = 'moderationEvidence';

export type CaseKind = 'post' | 'comment' | 'user' | 'ad';
export const CASE_KINDS: readonly CaseKind[] = ['post', 'comment', 'user', 'ad'];
export type CaseStatus = 'flagged' | 'under_review' | 'violation_confirmed' | 'restricted' | 'no_violation' | 'appealed' | 'resolved';
export const CASE_STATUSES: readonly CaseStatus[] = ['flagged', 'under_review', 'violation_confirmed', 'restricted', 'no_violation', 'appealed', 'resolved'];
const OPEN_STATUSES: readonly CaseStatus[] = ['flagged', 'under_review', 'appealed'];

export type ModerationAction =
  | 'claim' | 'release' | 'escalate' | 'dismiss' | 'hide' | 'remove' | 'unpromote' | 'warn' | 'suspend' | 'ban'
  | 'restore' | 'uphold' | 'overturn';
export const MODERATION_ACTIONS: readonly ModerationAction[] = ['claim', 'release', 'escalate', 'dismiss', 'hide', 'remove', 'unpromote', 'warn', 'suspend', 'ban', 'restore', 'uphold', 'overturn'];

export type EffectType = 'hide' | 'remove_post' | 'remove_comment' | 'unpromote' | 'warn' | 'suspend' | 'ban';

export const MIN_REASON = 5;
export const MAX_REASON = 300;
export const MIN_APPEAL = 10;
export const MAX_APPEAL = 1000;
export const MAX_SUSPENSION_DAYS = 90;
export const APPEAL_WINDOW_DAYS = 30;
export const PAGE_DEFAULT = 25;
export const PAGE_MAX = 100;

export type Priority = 'low' | 'normal' | 'high' | 'urgent';
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/** Pure: how urgent a case is, from what people reported. Harm first, then volume. */
export function priorityFor(reasons: Record<string, number>, reportCount: number): Priority {
  const harm = (reasons.violence ?? 0) + (reasons.illegal ?? 0);
  if (harm >= 3 || (harm >= 1 && reportCount >= 5)) return 'urgent';
  if (harm >= 1 || (reasons.abuse ?? 0) >= 2 || reportCount >= 5) return 'high';
  const spamOnly = reportCount > 0 && (reasons.spam ?? 0) === reportCount;
  return spamOnly && reportCount < 3 ? 'low' : 'normal';
}

export const caseIdFor = (kind: CaseKind, targetId: string) => `${kind}_${targetId}`;
const isSafeId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 160 && !value.includes('/');
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/* ------------------------------------------------------------------ */
/* Reports arriving                                                    */
/* ------------------------------------------------------------------ */

export interface IncomingReport {
  kind: CaseKind;
  targetId: string;
  postId: string;
  subjectUid: string;
  reason: string;
  snapshot: Record<string, unknown>;
}

/** Read the case a report belongs to. Call in the reads phase of the report's transaction. */
export function readCaseFor(tx: Transaction, db: Firestore, kind: CaseKind, targetId: string): Promise<DocumentSnapshot> {
  return tx.get(db.collection(CASES).doc(caseIdFor(kind, targetId)));
}

/**
 * Count a report on its case (creating the case on the first one). Writes only; the case
 * snapshot must have been read in the same transaction. A case closed as "no violation"
 * that keeps being reported is reopened, because the new reports are new information.
 */
export function applyReportToCase(tx: Transaction, db: Firestore, current: DocumentSnapshot, input: IncomingReport, nowMs: number): void {
  const ref = db.collection(CASES).doc(caseIdFor(input.kind, input.targetId));
  if (!current.exists) {
    const reasons = { [input.reason]: 1 };
    const priority = priorityFor(reasons, 1);
    tx.create(ref, {
      kind: input.kind, targetId: input.targetId, postId: input.postId, subjectUid: input.subjectUid,
      status: 'flagged', open: true, reportCount: 1, reasons, snapshot: input.snapshot,
      priority, priorityRank: PRIORITY_RANK[priority], escalated: false,
      assigneeUid: null, assigneeName: '', decidedBy: null, decision: null, lastEffect: null, appeal: null,
      firstReportedAtMs: nowMs, lastReportedAtMs: nowMs, updatedAtMs: nowMs, version: 1,
    });
    tx.create(ref.collection('history').doc(), { type: 'opened', action: 'report', reason: input.reason, actorUid: 'system', atMs: nowMs });
    return;
  }
  const data = current.data() as CaseDoc;
  const reasons = { ...(data.reasons ?? {}), [input.reason]: (data.reasons?.[input.reason] ?? 0) + 1 };
  const reportCount = (data.reportCount ?? 0) + 1;
  const priority = priorityFor(reasons, reportCount);
  const patch: Record<string, unknown> = {
    reportCount, reasons, priority, priorityRank: PRIORITY_RANK[priority], lastReportedAtMs: nowMs, updatedAtMs: nowMs, snapshot: input.snapshot,
  };
  if (data.status === 'no_violation' || (data.status === 'resolved' && !data.lastEffect)) {
    patch.status = 'flagged'; patch.open = true; patch.assigneeUid = null; patch.assigneeName = '';
    tx.create(ref.collection('history').doc(), { type: 'reopened', action: 'report', reason: input.reason, actorUid: 'system', from: data.status, to: 'flagged', atMs: nowMs });
  }
  tx.update(ref, patch);
}

/* ------------------------------------------------------------------ */
/* Deciding                                                            */
/* ------------------------------------------------------------------ */

export interface CaseDoc {
  kind: CaseKind;
  targetId: string;
  postId: string;
  subjectUid: string;
  status: CaseStatus;
  open: boolean;
  reportCount: number;
  reasons: Record<string, number>;
  snapshot: Record<string, unknown>;
  priority: Priority;
  escalated: boolean;
  assigneeUid: string | null;
  assigneeName: string;
  decidedBy: string | null;
  decision: { action: string; reason: string; byUid: string; atMs: number } | null;
  lastEffect: { type: EffectType; previous?: Record<string, unknown> } | null;
  appeal: { text: string; atMs: number; outcome?: 'upheld' | 'overturned' | null } | null;
  firstReportedAtMs: number;
  lastReportedAtMs: number;
  updatedAtMs: number;
  version: number;
}

export interface Moderator { uid: string; role: string; permissions: readonly string[] }

export const canModerate = (actor: Moderator) => mayUseSection(actor, 'debate') || mayUseSection(actor, 'forum');
export const canBan = (actor: Moderator) => actor.role === 'admin' || actor.role === 'superadmin';
const isAdminRole = (role: string) => role === 'admin' || role === 'superadmin';

export type Decision =
  | { outcome: 'allow'; to: CaseStatus; effect: EffectType | 'undo' | null; reason: string; days: number; assign: boolean }
  | { outcome: 'deny'; status: 400 | 403 | 404 | 409; code: string; error: string };

const deny = (status: 400 | 403 | 404 | 409, code: string, error: string): Decision => ({ outcome: 'deny', status, code, error });

const CONTENT_KINDS: readonly CaseKind[] = ['post', 'comment', 'ad'];

/** Pure: may this moderator take this action on this case, and what follows from it? */
export function decideCase(input: { actor: Moderator; item: Pick<CaseDoc, 'kind' | 'status' | 'assigneeUid' | 'decidedBy' | 'lastEffect' | 'subjectUid'>; action: unknown; reason?: unknown; days?: unknown }): Decision {
  const { actor, item } = input;
  if (!canModerate(actor)) return deny(403, 'WRONG_ROLE', 'Roli juaj nuk modereron debatin.');
  if (!(MODERATION_ACTIONS as readonly string[]).includes(String(input.action))) return deny(400, 'UNKNOWN_ACTION', 'Veprimi nuk njihet.');
  const action = input.action as ModerationAction;
  const reason = text(input.reason, MAX_REASON + 1);
  const needReason = () => (reason.length < MIN_REASON || reason.length > MAX_REASON ? deny(400, 'REASON_REQUIRED', `Shkruani arsyen (${MIN_REASON}-${MAX_REASON} shenja). Ajo i tregohet personit dhe mbetet në historik.`) : null);
  const open = item.status === 'flagged' || item.status === 'under_review';
  const holder = item.assigneeUid;
  // Somebody else is on it: only an administrator steps in, and the reason records why.
  const takenByOther = Boolean(holder) && holder !== actor.uid && !isAdminRole(actor.role);

  switch (action) {
    case 'claim':
      if (item.status === 'appealed') {
        if (item.decidedBy === actor.uid) return deny(403, 'SAME_REVIEWER', 'Apelimin e shqyrton një moderator tjetër nga ai që vendosi.');
        if (holder && holder !== actor.uid) return deny(409, 'ALREADY_CLAIMED', 'Dikush tjetër po e shqyrton këtë apelim.');
        return { outcome: 'allow', to: 'appealed', effect: null, reason: '', days: 0, assign: true };
      }
      if (item.status !== 'flagged') return deny(409, 'WRONG_STATE', 'Rasti nuk pret shqyrtim.');
      if (holder && holder !== actor.uid) return deny(409, 'ALREADY_CLAIMED', 'Dikush tjetër po e shqyrton këtë rast.');
      return { outcome: 'allow', to: 'under_review', effect: null, reason: '', days: 0, assign: true };
    case 'release':
      if (item.status !== 'under_review' && item.status !== 'appealed') return deny(409, 'WRONG_STATE', 'Rasti nuk është në shqyrtim.');
      if (!holder) return deny(409, 'NOT_CLAIMED', 'Askush nuk e ka marrë këtë rast.');
      if (holder !== actor.uid) {
        if (!isAdminRole(actor.role)) return deny(403, 'NOT_ASSIGNEE', 'Vetëm moderatori që e mban ose administratori e lëshon.');
        const missing = needReason(); if (missing) return missing;
      }
      return { outcome: 'allow', to: item.status === 'appealed' ? 'appealed' : 'flagged', effect: null, reason, days: 0, assign: false };
    case 'escalate': {
      if (!open && item.status !== 'appealed') return deny(409, 'WRONG_STATE', 'Vetëm një rast i hapur eskalohet.');
      const missing = needReason(); if (missing) return missing;
      return { outcome: 'allow', to: item.status, effect: null, reason, days: 0, assign: false };
    }
    case 'dismiss': case 'hide': case 'remove': case 'unpromote': case 'warn': case 'suspend': case 'ban': {
      if (!open) return deny(409, 'WRONG_STATE', 'Ky rast është vendosur tashmë; përdorni "Rikthe" ose apelimin.');
      if (takenByOther) return deny(409, 'ALREADY_CLAIMED', 'Rasti po shqyrtohet nga dikush tjetër.');
      const missing = needReason(); if (missing) return missing;
      if (action === 'dismiss') return { outcome: 'allow', to: 'no_violation', effect: null, reason, days: 0, assign: true };
      if (action === 'hide') {
        if (item.kind !== 'post' && item.kind !== 'ad') return deny(400, 'WRONG_KIND', 'Fshehja vlen vetëm për postime.');
        return { outcome: 'allow', to: 'violation_confirmed', effect: 'hide', reason, days: 0, assign: true };
      }
      if (action === 'remove') {
        if (!CONTENT_KINDS.includes(item.kind)) return deny(400, 'WRONG_KIND', 'Për një llogari përdorni paralajmërim, pezullim ose ndalim.');
        return { outcome: 'allow', to: 'violation_confirmed', effect: item.kind === 'comment' ? 'remove_comment' : 'remove_post', reason, days: 0, assign: true };
      }
      if (action === 'unpromote') {
        if (item.kind !== 'ad') return deny(400, 'WRONG_KIND', 'Vetëm një reklamë ndalet së promovuari.');
        return { outcome: 'allow', to: 'violation_confirmed', effect: 'unpromote', reason, days: 0, assign: true };
      }
      if (!item.subjectUid) return deny(409, 'NO_SUBJECT', 'Rasti nuk ka një llogari të lidhur.');
      if (action === 'warn') return { outcome: 'allow', to: 'violation_confirmed', effect: 'warn', reason, days: 0, assign: true };
      if (action === 'suspend') {
        const days = Number(input.days);
        if (!Number.isInteger(days) || days < 1 || days > MAX_SUSPENSION_DAYS) return deny(400, 'BAD_DAYS', `Pezullimi zgjat 1-${MAX_SUSPENSION_DAYS} ditë.`);
        return { outcome: 'allow', to: 'restricted', effect: 'suspend', reason, days, assign: true };
      }
      if (!canBan(actor)) return deny(403, 'BAN_NOT_ALLOWED', 'Ndalimin e përhershëm e vendos vetëm administratori. Përdorni pezullimin ose eskalojeni.');
      return { outcome: 'allow', to: 'restricted', effect: 'ban', reason, days: 0, assign: true };
    }
    case 'restore': {
      if (item.status !== 'violation_confirmed' && item.status !== 'restricted') return deny(409, 'WRONG_STATE', 'Nuk ka asnjë vendim për t’u rikthyer.');
      if (!item.lastEffect) return deny(409, 'NOTHING_TO_UNDO', 'Vendimi nuk ndryshoi asgjë që të rikthehet.');
      if (item.lastEffect.type === 'ban' && !canBan(actor)) return deny(403, 'BAN_NOT_ALLOWED', 'Ndalimin e heq vetëm administratori.');
      const missing = needReason(); if (missing) return missing;
      return { outcome: 'allow', to: 'resolved', effect: 'undo', reason, days: 0, assign: false };
    }
    case 'uphold': case 'overturn': {
      if (item.status !== 'appealed') return deny(409, 'WRONG_STATE', 'Nuk ka apelim për të vendosur.');
      if (item.decidedBy === actor.uid) return deny(403, 'SAME_REVIEWER', 'Apelimin e vendos një moderator tjetër nga ai që mori vendimin.');
      if (takenByOther) return deny(409, 'ALREADY_CLAIMED', 'Apelimi po shqyrtohet nga dikush tjetër.');
      if (action === 'overturn' && item.lastEffect?.type === 'ban' && !canBan(actor)) return deny(403, 'BAN_NOT_ALLOWED', 'Ndalimin e heq vetëm administratori.');
      const missing = needReason(); if (missing) return missing;
      return { outcome: 'allow', to: 'resolved', effect: action === 'overturn' && item.lastEffect ? 'undo' : null, reason, days: 0, assign: true };
    }
    default:
      return deny(400, 'UNKNOWN_ACTION', 'Veprimi nuk njihet.');
  }
}

/** Pure: may the person a decision is about appeal it now? */
export function decideAppeal(item: Pick<CaseDoc, 'status' | 'subjectUid' | 'appeal' | 'decision'>, uid: string, appealText: unknown, nowMs: number):
  { outcome: 'allow'; text: string } | { outcome: 'deny'; status: 400 | 403 | 404 | 409; error: string } {
  if (!uid || item.subjectUid !== uid) return { outcome: 'deny', status: 404, error: 'Rasti nuk u gjet.' };
  if (item.status !== 'violation_confirmed' && item.status !== 'restricted') return { outcome: 'deny', status: 409, error: 'Ky vendim nuk apelohet.' };
  if (item.appeal) return { outcome: 'deny', status: 409, error: 'Keni apeluar tashmë këtë vendim.' };
  if (item.decision && nowMs - item.decision.atMs > APPEAL_WINDOW_DAYS * 86_400_000) return { outcome: 'deny', status: 409, error: `Afati i apelimit (${APPEAL_WINDOW_DAYS} ditë) ka kaluar.` };
  const value = text(appealText, MAX_APPEAL + 1);
  if (value.length < MIN_APPEAL || value.length > MAX_APPEAL) return { outcome: 'deny', status: 400, error: `Shpjegoni apelimin (${MIN_APPEAL}-${MAX_APPEAL} shenja).` };
  return { outcome: 'allow', text: value };
}

/** Pure: put a removed comment back where it was (a reply under its parent, or at the top level). */
export function reinsertComment(comments: Comment[], comment: Comment, parentId: string | null): Comment[] {
  if (comments.some(c => c.id === comment.id || c.replies?.some(r => r.id === comment.id))) return comments;
  if (parentId) {
    const parent = comments.find(c => c.id === parentId);
    if (parent) return comments.map(c => (c.id === parentId ? { ...c, replies: [...(c.replies ?? []), comment] } : c));
  }
  return [...comments, comment];
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

export interface ModerationDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  authAdmin: () => Auth;
  actingUser: (req: Request) => { uid: string; role: string; permissions: string[] };
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
  now?: () => number;
}

const encodeCursor = (values: unknown[]) => Buffer.from(JSON.stringify(values)).toString('base64url');
function decodeCursor(raw: unknown): unknown[] | null {
  if (typeof raw !== 'string' || !raw) return null;
  try { const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')); return Array.isArray(parsed) ? parsed : null; } catch { return null; }
}

/** What a moderator sees of a case. The reporters are never named. */
function caseView(id: string, data: CaseDoc) {
  return {
    id, kind: data.kind, targetId: data.targetId, postId: data.postId, subjectUid: data.subjectUid, status: data.status, open: data.open,
    reportCount: data.reportCount, reasons: data.reasons ?? {}, snapshot: data.snapshot ?? {}, priority: data.priority, escalated: data.escalated === true,
    assigneeUid: data.assigneeUid ?? null, assigneeName: data.assigneeName ?? '', decidedBy: data.decidedBy ?? null, decision: data.decision ?? null,
    lastEffect: data.lastEffect ? { type: data.lastEffect.type } : null, appeal: data.appeal ?? null,
    firstReportedAtMs: data.firstReportedAtMs, lastReportedAtMs: data.lastReportedAtMs, updatedAtMs: data.updatedAtMs, version: data.version,
  };
}

const EFFECT_NOTICE: Record<EffectType, string> = {
  hide: 'Një postim juaj u fsheh nga moderimi',
  remove_post: 'Një postim juaj u hoq nga moderimi',
  remove_comment: 'Një koment juaji u hoq nga moderimi',
  unpromote: 'Promovimi i reklamës suaj u ndal',
  warn: 'Morët një paralajmërim nga moderimi',
  suspend: 'Llogaria juaj u pezullua përkohësisht',
  ban: 'Llogaria juaj u kufizua',
};

export function registerModerationRoutes(app: Express, deps: ModerationDeps): void {
  const now = deps.now ?? Date.now;
  const db = () => deps.db();
  const cases = () => db().collection(CASES);

  const notify = (tx: Transaction, userId: string, title: string, message: string, caseId: string) =>
    tx.set(db().collection('notifications').doc(), {
      title, message, channel: 'moderation', category: 'moderation', type: 'info', priority: 'normal', urgent: false,
      audience: 'user', userId, moderationCaseId: caseId, state: 'published', link: '/moderimi-im',
      sender: 'Zëri i Qytetarëve', createdAt: FieldValue.serverTimestamp(),
    });

  /** Staff and municipal accounts are not moderated here; their own routes apply. */
  async function subjectRole(uid: string): Promise<string> {
    try { return String(((await deps.authAdmin().getUser(uid)).customClaims ?? {}).role ?? ''); } catch (error) {
      if ((error as { code?: string })?.code === 'auth/user-not-found') return 'missing';
      throw error;
    }
  }

  async function actorName(uid: string): Promise<string> {
    try { return String((await db().collection('users').doc(uid).get()).data()?.name ?? '').slice(0, 160); } catch { return ''; }
  }

  /* ---------- queue ---------- */

  app.get('/api/v1/moderation/cases', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    if (!canModerate(actor)) return res.status(403).json({ error: 'Roli juaj nuk modereron debatin.' });
    const view = text(req.query.view, 20) || 'queue';
    const kind = text(req.query.kind, 20);
    const limit = Math.max(1, Math.min(PAGE_MAX, Number.parseInt(String(req.query.limit ?? PAGE_DEFAULT), 10) || PAGE_DEFAULT));
    if (kind && !(CASE_KINDS as readonly string[]).includes(kind)) return res.status(400).json({ error: 'Lloji nuk njihet.' });
    let query: Query = cases();
    let order: string[];
    if (view === 'queue') {
      query = query.where('open', '==', true);
      if (kind) query = query.where('kind', '==', kind);
      query = query.orderBy('priorityRank').orderBy('lastReportedAtMs', 'desc').orderBy(FieldPath.documentId(), 'desc');
      order = ['priorityRank', 'lastReportedAtMs'];
    } else if (view === 'mine') {
      query = query.where('assigneeUid', '==', actor.uid).where('open', '==', true).orderBy('lastReportedAtMs', 'desc').orderBy(FieldPath.documentId(), 'desc');
      order = ['lastReportedAtMs'];
    } else if (view === 'escalated') {
      query = query.where('open', '==', true).where('escalated', '==', true).orderBy('lastReportedAtMs', 'desc').orderBy(FieldPath.documentId(), 'desc');
      order = ['lastReportedAtMs'];
    } else if ((CASE_STATUSES as readonly string[]).includes(view)) {
      query = query.where('status', '==', view).orderBy('updatedAtMs', 'desc').orderBy(FieldPath.documentId(), 'desc');
      order = ['updatedAtMs'];
    } else if (view === 'subject') {
      const uid = text(req.query.uid, 128);
      if (!isSafeId(uid)) return res.status(400).json({ error: 'Zgjidhni llogarinë.' });
      query = query.where('subjectUid', '==', uid).orderBy('updatedAtMs', 'desc').orderBy(FieldPath.documentId(), 'desc');
      order = ['updatedAtMs'];
    } else return res.status(400).json({ error: 'Pamja nuk njihet.' });

    try {
      const cursor = decodeCursor(req.query.cursor);
      if (cursor) query = query.startAfter(...cursor);
      const snap = await query.limit(limit + 1).get();
      const docs = snap.docs.slice(0, limit);
      const last = docs[docs.length - 1];
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({
        cases: docs.map(doc => caseView(doc.id, doc.data() as CaseDoc)),
        nextCursor: snap.docs.length > limit && last ? encodeCursor([...order.map(field => (last.data() as Record<string, unknown>)[field]), last.id]) : null,
      });
    } catch (error) {
      console.error('[MODERATION] list failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Radha nuk u ngarkua.' });
    }
  });

  app.get('/api/v1/moderation/summary', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    if (!canModerate(actor)) return res.status(403).json({ error: 'Roli juaj nuk modereron debatin.' });
    try {
      const count = async (query: Query) => (await query.count().get()).data().count;
      const [flagged, underReview, appealed, escalated, urgent, mine, oldest] = await Promise.all([
        count(cases().where('status', '==', 'flagged')),
        count(cases().where('status', '==', 'under_review')),
        count(cases().where('status', '==', 'appealed')),
        count(cases().where('open', '==', true).where('escalated', '==', true)),
        count(cases().where('open', '==', true).where('priority', '==', 'urgent')),
        count(cases().where('assigneeUid', '==', actor.uid).where('open', '==', true)),
        cases().where('status', '==', 'flagged').orderBy('firstReportedAtMs').limit(1).get(),
      ]);
      const oldestMs = oldest.docs[0] ? (oldest.docs[0].data() as CaseDoc).firstReportedAtMs : null;
      return res.json({ flagged, underReview, appealed, escalated, urgent, mine, oldestFlaggedAgeHours: oldestMs ? Math.round((now() - oldestMs) / 360_000) / 10 : null });
    } catch (error) {
      console.error('[MODERATION] summary failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Përmbledhja nuk u ngarkua.' });
    }
  });

  app.get('/api/v1/moderation/cases/:id', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    if (!canModerate(actor)) return res.status(403).json({ error: 'Roli juaj nuk modereron debatin.' });
    const id = String(req.params.id ?? '');
    if (!isSafeId(id)) return res.status(400).json({ error: 'Rasti nuk është i vlefshëm.' });
    try {
      const ref = cases().doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Rasti nuk u gjet.' });
      const data = snap.data() as CaseDoc;
      const [history, subject, priorCases] = await Promise.all([
        ref.collection('history').orderBy('atMs', 'desc').limit(100).get(),
        data.subjectUid ? db().collection('users').doc(data.subjectUid).get() : Promise.resolve(null),
        data.subjectUid ? cases().where('subjectUid', '==', data.subjectUid).orderBy('updatedAtMs', 'desc').limit(11).get() : Promise.resolve(null),
      ]);
      const user = subject?.data();
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({
        case: caseView(snap.id, data),
        history: history.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        // What the moderator needs to be proportionate, and nothing more: no email, no phone.
        subject: user ? {
          uid: data.subjectUid, name: String(user.name ?? ''), warningCount: Number(user.warningCount ?? 0),
          restriction: describeRestriction(user as never, now()),
          priorCases: (priorCases?.docs ?? []).filter(doc => doc.id !== snap.id).slice(0, 10).map(doc => {
            const prior = doc.data() as CaseDoc;
            return { id: doc.id, kind: prior.kind, status: prior.status, effect: prior.lastEffect?.type ?? null, atMs: prior.updatedAtMs };
          }),
        } : null,
      });
    } catch (error) {
      console.error('[MODERATION] read failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Rasti nuk u ngarkua.' });
    }
  });

  /* ---------- deciding ---------- */

  app.post('/api/v1/moderation/cases/:id/decide', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const id = String(req.params.id ?? '');
    if (!isSafeId(id)) return res.status(400).json({ error: 'Rasti nuk është i vlefshëm.' });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const expectedVersion = typeof body.expectedVersion === 'number' ? body.expectedVersion : null;
    try {
      // Account actions never touch staff or municipal accounts.
      const pre = await cases().doc(id).get();
      if (!pre.exists) return res.status(404).json({ error: 'Rasti nuk u gjet.' });
      const preData = pre.data() as CaseDoc;
      if (['warn', 'suspend', 'ban'].includes(String(body.action)) && preData.subjectUid) {
        const role = await subjectRole(preData.subjectUid);
        if (role === 'missing') return res.status(409).json({ error: 'Llogaria nuk ekziston më.', code: 'NO_SUBJECT' });
        if (role && role !== 'citizen') return res.status(403).json({ error: 'Kjo është llogari stafi ose komune; menaxhohet nga seksioni përkatës.', code: 'STAFF_SUBJECT' });
      }
      const name = await actorName(actor.uid);

      const result = await db().runTransaction(async tx => {
        const ref = cases().doc(id);
        const snap = await tx.get(ref);
        if (!snap.exists) return { status: 404, error: 'Rasti nuk u gjet.', code: 'NOT_FOUND' } as const;
        const item = snap.data() as CaseDoc;
        if (expectedVersion !== null && expectedVersion !== item.version) return { status: 409, error: 'Rasti u ndryshua ndërkohë. Rifreskoni dhe provoni përsëri.', code: 'STALE' } as const;
        const decision = decideCase({ actor, item, action: body.action, reason: body.reason, days: body.days });
        if (decision.outcome === 'deny') return { status: decision.status, error: decision.error, code: decision.code } as const;
        const action = String(body.action) as ModerationAction;
        const t = now();

        // ---- reads: everything the effect needs, before any write ----
        const postRef = item.postId ? db().collection('forumPosts').doc(item.postId) : null;
        const userRef = item.subjectUid ? db().collection('users').doc(item.subjectUid) : null;
        const evidenceRef = db().collection(EVIDENCE).doc(id);
        const effect = decision.effect === 'undo' ? item.lastEffect?.type ?? null : decision.effect;
        const needsPost = effect === 'hide' || effect === 'remove_post' || effect === 'remove_comment' || effect === 'unpromote' || action === 'dismiss';
        const needsUser = effect === 'warn' || effect === 'suspend' || effect === 'ban';
        const [post, user, evidence, openReports] = await Promise.all([
          needsPost && postRef ? tx.get(postRef) : Promise.resolve(null),
          needsUser && userRef ? tx.get(userRef) : Promise.resolve(null),
          decision.effect === 'undo' && (effect === 'remove_post' || effect === 'remove_comment') ? tx.get(evidenceRef) : Promise.resolve(null),
          ['dismiss', 'hide', 'remove', 'unpromote', 'warn', 'suspend', 'ban'].includes(action) && item.kind !== 'post'
            ? tx.get(db().collection('forumReports').where('kind', '==', item.kind).where('targetId', '==', item.targetId).where('status', '==', 'open').limit(200))
            : Promise.resolve(null),
        ]);

        // ---- the effect itself ----
        let lastEffect: CaseDoc['lastEffect'] = item.lastEffect;
        if (decision.effect && decision.effect !== 'undo') {
          if ((effect === 'hide' || effect === 'remove_post' || effect === 'unpromote') && !post?.exists) return { status: 409, error: 'Postimi nuk ekziston më.', code: 'TARGET_GONE' } as const;
          if (effect === 'hide') {
            tx.update(postRef!, { isHidden: true, hiddenBy: actor.uid, hiddenAt: FieldValue.serverTimestamp(), moderationCaseId: id });
            lastEffect = { type: 'hide' };
          } else if (effect === 'remove_post') {
            tx.set(evidenceRef, { caseId: id, kind: item.kind, postId: item.postId, post: post!.data(), removedBy: actor.uid, reason: decision.reason, removedAtMs: t });
            tx.update(postRef!, { deletedAt: FieldValue.serverTimestamp(), deletedBy: actor.uid, moderationRemoved: true, moderationCaseId: id });
            lastEffect = { type: 'remove_post' };
          } else if (effect === 'remove_comment') {
            if (!post?.exists) return { status: 409, error: 'Postimi i komentit nuk ekziston më.', code: 'TARGET_GONE' } as const;
            const comments = (Array.isArray(post.data()?.comments) ? post.data()!.comments : []) as Comment[];
            const found = findComment(comments, item.targetId);
            if (!found) return { status: 409, error: 'Komenti nuk ekziston më (mund ta ketë fshirë autori).', code: 'TARGET_GONE' } as const;
            tx.set(evidenceRef, { caseId: id, kind: 'comment', postId: item.postId, comment: found.item, parentId: found.parentId, removedBy: actor.uid, reason: decision.reason, removedAtMs: t });
            tx.update(postRef!, { comments: removeComment(comments, item.targetId) });
            lastEffect = { type: 'remove_comment' };
          } else if (effect === 'unpromote') {
            const previous = post!.data() ?? {};
            tx.update(postRef!, { isAd: false, promotedUntil: FieldValue.delete(), adPausedByModeration: true });
            lastEffect = { type: 'unpromote', previous: { isAd: previous.isAd === true, promotedUntilMs: untilMs(previous.promotedUntil) } };
          } else if (effect === 'warn') {
            tx.set(userRef!, { warningCount: FieldValue.increment(1), lastWarningAt: FieldValue.serverTimestamp(), lastWarningReason: decision.reason }, { merge: true });
            lastEffect = { type: 'warn' };
          } else if (effect === 'suspend') {
            const previous = user?.data() ?? {};
            tx.set(userRef!, {
              isBanned: true, restriction: 'suspension', suspendedUntil: Timestamp.fromMillis(t + decision.days * 86_400_000),
              bannedAt: FieldValue.serverTimestamp(), bannedBy: actor.uid, banReason: decision.reason,
            }, { merge: true });
            lastEffect = { type: 'suspend', previous: { isBanned: previous.isBanned === true, suspendedUntilMs: untilMs(previous.suspendedUntil) } };
          } else if (effect === 'ban') {
            const previous = user?.data() ?? {};
            tx.set(userRef!, {
              isBanned: true, restriction: 'ban', suspendedUntil: FieldValue.delete(),
              bannedAt: FieldValue.serverTimestamp(), bannedBy: actor.uid, banReason: decision.reason,
            }, { merge: true });
            lastEffect = { type: 'ban', previous: { isBanned: previous.isBanned === true, suspendedUntilMs: untilMs(previous.suspendedUntil) } };
          }
          if (item.subjectUid && effect) notify(tx, item.subjectUid, EFFECT_NOTICE[effect], `Arsyeja: ${decision.reason}. Mund ta apeloni brenda ${APPEAL_WINDOW_DAYS} ditëve.`, id);
        }

        if (decision.effect === 'undo' && item.lastEffect) {
          const undo = item.lastEffect;
          if (undo.type === 'hide' && postRef && post?.exists) tx.update(postRef, { isHidden: false, hiddenBy: FieldValue.delete(), hiddenAt: FieldValue.delete() });
          if (undo.type === 'remove_post' && postRef) {
            const kept = evidence?.data()?.post as Record<string, unknown> | undefined;
            if (post?.exists) tx.update(postRef, { deletedAt: FieldValue.delete(), deletedBy: FieldValue.delete(), moderationRemoved: FieldValue.delete() });
            else if (kept) tx.set(postRef, { ...kept, deletedAt: FieldValue.delete(), deletedBy: FieldValue.delete(), moderationRemoved: FieldValue.delete() }, { merge: true });
            else return { status: 409, error: 'Postimi është fshirë përgjithmonë dhe nuk ka kopje për rikthim.', code: 'NOTHING_TO_RESTORE' } as const;
          }
          if (undo.type === 'remove_comment' && postRef) {
            const kept = evidence?.data();
            if (!kept?.comment || !post?.exists) return { status: 409, error: 'Komenti nuk mund të rikthehet: postimi ose kopja nuk ekziston.', code: 'NOTHING_TO_RESTORE' } as const;
            const comments = (Array.isArray(post.data()?.comments) ? post.data()!.comments : []) as Comment[];
            tx.update(postRef, { comments: reinsertComment(comments, kept.comment as Comment, (kept.parentId as string | null) ?? null) });
          }
          if (undo.type === 'unpromote' && postRef && post?.exists) {
            const previous = undo.previous ?? {};
            const until = typeof previous.promotedUntilMs === 'number' && previous.promotedUntilMs > t ? Timestamp.fromMillis(previous.promotedUntilMs) : FieldValue.delete();
            tx.set(postRef, { isAd: previous.isAd === true, promotedUntil: until, adPausedByModeration: FieldValue.delete() }, { merge: true });
          }
          if (undo.type === 'warn' && userRef) tx.set(userRef, { warningCount: FieldValue.increment(-1) }, { merge: true });
          if ((undo.type === 'suspend' || undo.type === 'ban') && userRef) {
            const previous = undo.previous ?? {};
            const until = typeof previous.suspendedUntilMs === 'number' && previous.suspendedUntilMs > t ? Timestamp.fromMillis(previous.suspendedUntilMs) : null;
            tx.set(userRef, previous.isBanned === true && (until || previous.suspendedUntilMs === null)
              ? { isBanned: true, suspendedUntil: until ?? FieldValue.delete() }
              : { isBanned: false, restriction: FieldValue.delete(), suspendedUntil: FieldValue.delete(), bannedAt: FieldValue.delete(), bannedBy: FieldValue.delete(), banReason: FieldValue.delete() }, { merge: true });
          }
          if (item.subjectUid) notify(tx, item.subjectUid, 'Vendimi i moderimit u rikthye', `Arsyeja: ${decision.reason}`, id);
          lastEffect = null;
        }

        // ---- reports behind the case are closed by any decision ----
        if (action === 'dismiss' && (item.kind === 'post' || item.kind === 'ad') && post?.exists) tx.update(postRef!, { reportCount: 0, needsReview: false });
        // A decided post leaves the "needs review" list; its report count stays as a record.
        if (['hide', 'remove', 'unpromote'].includes(action) && (item.kind === 'post' || item.kind === 'ad') && post?.exists) tx.update(postRef!, { needsReview: false });
        for (const report of openReports?.docs ?? []) tx.update(report.ref, { status: 'closed', resolution: action, resolvedBy: actor.uid, resolvedAt: FieldValue.serverTimestamp() });

        // ---- the case and its history ----
        const patch: Record<string, unknown> = { status: decision.to, open: (OPEN_STATUSES as readonly string[]).includes(decision.to), updatedAtMs: t, version: item.version + 1 };
        if (action === 'claim') { patch.assigneeUid = actor.uid; patch.assigneeName = name; }
        else if (action === 'release') { patch.assigneeUid = null; patch.assigneeName = ''; }
        else if (decision.assign && !item.assigneeUid) { patch.assigneeUid = actor.uid; patch.assigneeName = name; }
        if (action === 'escalate') patch.escalated = true;
        if (['dismiss', 'hide', 'remove', 'unpromote', 'warn', 'suspend', 'ban'].includes(action)) {
          patch.decidedBy = actor.uid;
          patch.decision = { action, reason: decision.reason, byUid: actor.uid, atMs: t, ...(action === 'suspend' ? { days: decision.days } : {}) };
          patch.lastEffect = lastEffect;
          patch.escalated = false;
        }
        if (action === 'restore') patch.lastEffect = lastEffect;
        if (action === 'uphold' || action === 'overturn') {
          patch.appeal = { ...(item.appeal ?? { text: '', atMs: t }), outcome: action === 'uphold' ? 'upheld' : 'overturned', decidedBy: actor.uid, decidedAtMs: t };
          if (action === 'overturn') patch.lastEffect = lastEffect;
          if (item.subjectUid) notify(tx, item.subjectUid, action === 'uphold' ? 'Apelimi juaj u shqyrtua: vendimi mbetet' : 'Apelimi juaj u pranua', `Arsyeja: ${decision.reason}`, id);
        }
        tx.update(ref, patch);
        tx.create(ref.collection('history').doc(), {
          type: 'decision', action, from: item.status, to: decision.to, actorUid: actor.uid, actorName: name, actorRole: actor.role,
          reason: decision.reason, ...(action === 'suspend' ? { days: decision.days } : {}), ...(effect ? { effect } : {}), atMs: t,
        });
        return { status: 200, case: caseView(id, { ...item, ...patch } as CaseDoc), effect, undo: decision.effect === 'undo' } as const;
      });

      if ('error' in result) {
        deps.audit('moderation.denied', req, { id, action: body.action, code: result.code });
        return res.status(result.status).json({ error: result.error, code: result.code });
      }

      // Sign-in follows the account flag, outside the transaction (Auth is not Firestore).
      let warning: string | undefined;
      if (result.effect === 'ban' && preData.subjectUid) {
        try {
          if (result.undo) await deps.authAdmin().updateUser(preData.subjectUid, { disabled: false });
          else { await deps.authAdmin().updateUser(preData.subjectUid, { disabled: true }); await deps.authAdmin().revokeRefreshTokens(preData.subjectUid); }
        } catch (error) {
          console.error('[MODERATION] sign-in change failed:', (error as Error)?.message);
          warning = 'Llogaria u shënua, por hyrja nuk u ndryshua. Provoni përsëri nga Llogaritë e qytetarëve.';
        }
      }
      deps.audit(`moderation.${String(body.action)}`, req, { id, effect: result.effect ?? null, undo: result.undo, reason: text(body.reason, MAX_REASON) || null });
      return res.json({ ok: true, case: result.case, ...(warning ? { warning } : {}) });
    } catch (error) {
      console.error('[MODERATION] decide failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Vendimi nuk u ruajt. Asgjë nuk ndryshoi.' });
    }
  });

  /* ---------- the person a decision is about ---------- */

  app.get('/api/v1/moderation/my-cases', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = deps.actingUser(req).uid;
    try {
      const [snap, user] = await Promise.all([
        cases().where('subjectUid', '==', uid).orderBy('updatedAtMs', 'desc').limit(20).get(),
        db().collection('users').doc(uid).get(),
      ]);
      const t = now();
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({
        restriction: describeRestriction(user.data() as never, t),
        warningCount: Number(user.data()?.warningCount ?? 0),
        // Only decided cases: an open report about someone is not shown to them.
        cases: snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as CaseDoc) }))
          .filter(item => item.decision && item.status !== 'no_violation')
          .map(item => ({
            id: item.id, kind: item.kind, status: item.status, effect: item.lastEffect?.type ?? item.decision?.action ?? null,
            reason: item.decision?.reason ?? '', decidedAtMs: item.decision?.atMs ?? null, excerpt: String(item.snapshot?.excerpt ?? ''),
            appeal: item.appeal ? { atMs: item.appeal.atMs, outcome: item.appeal.outcome ?? null } : null,
            canAppeal: decideAppeal(item, uid, 'x'.repeat(MIN_APPEAL), t).outcome === 'allow',
          })),
      });
    } catch (error) {
      console.error('[MODERATION] my cases failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Nuk u ngarkua.' });
    }
  });

  app.post('/api/v1/moderation/cases/:id/appeal', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = deps.actingUser(req).uid;
    const id = String(req.params.id ?? '');
    if (!isSafeId(id)) return res.status(400).json({ error: 'Rasti nuk është i vlefshëm.' });
    try {
      const result = await db().runTransaction(async tx => {
        const ref = cases().doc(id);
        const snap = await tx.get(ref);
        if (!snap.exists) return { status: 404 as const, error: 'Rasti nuk u gjet.' };
        const item = snap.data() as CaseDoc;
        const verdict = decideAppeal(item, uid, req.body?.text, now());
        if (verdict.outcome === 'deny') return { status: verdict.status, error: verdict.error };
        const t = now();
        tx.update(ref, { status: 'appealed', open: true, appeal: { text: verdict.text, atMs: t, outcome: null }, assigneeUid: null, assigneeName: '', updatedAtMs: t, version: item.version + 1 });
        tx.create(ref.collection('history').doc(), { type: 'appeal', action: 'appeal', from: item.status, to: 'appealed', actorUid: uid, actorRole: 'citizen', reason: verdict.text, atMs: t });
        return { status: 200 as const };
      });
      if ('error' in result) return res.status(result.status).json({ error: result.error });
      deps.audit('moderation.appeal', req, { id });
      return res.json({ ok: true });
    } catch (error) {
      console.error('[MODERATION] appeal failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Apelimi nuk u dërgua. Provoni përsëri.' });
    }
  });

  /* ---------- bringing in reports made before cases existed ---------- */

  app.post('/api/v1/moderation/backfill', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    if (!canModerate(actor)) return res.status(403).json({ error: 'Roli juaj nuk modereron debatin.' });
    try {
      const t = now();
      const groups = new Map<string, { kind: CaseKind; targetId: string; postId: string; subjectUid: string; reasons: Record<string, number>; count: number; snapshot: Record<string, unknown>; firstMs: number }>();
      const reports = await db().collection('forumReports').where('status', '==', 'open').limit(500).get();
      for (const doc of reports.docs) {
        const r = doc.data();
        if (!(CASE_KINDS as readonly string[]).includes(r.kind)) continue;
        const key = caseIdFor(r.kind, r.targetId);
        const group = groups.get(key) ?? { kind: r.kind, targetId: r.targetId, postId: r.postId ?? '', subjectUid: r.reportedUserId ?? '', reasons: {}, count: 0, snapshot: r.snapshot ?? {}, firstMs: untilMs(r.createdAt) ?? t };
        group.reasons[r.reason] = (group.reasons[r.reason] ?? 0) + 1;
        group.count += 1;
        groups.set(key, group);
      }
      const posts = await db().collection('forumPosts').where('reportCount', '>', 0).orderBy('reportCount', 'desc').limit(300).get();
      for (const doc of posts.docs) {
        const p = doc.data();
        if (p.deletedAt) continue;
        const sub = await doc.ref.collection('reports').limit(100).get();
        const reasons: Record<string, number> = {};
        for (const r of sub.docs) reasons[String(r.data().reason ?? 'other')] = (reasons[String(r.data().reason ?? 'other')] ?? 0) + 1;
        groups.set(caseIdFor('post', doc.id), {
          kind: 'post', targetId: doc.id, postId: doc.id, subjectUid: String(p.authorId ?? ''), reasons, count: Number(p.reportCount) || sub.size,
          snapshot: { excerpt: String(p.content ?? '').slice(0, 300), authorName: String(p.authorName ?? '').slice(0, 120), imageUrl: p.imageUrl ?? null }, firstMs: untilMs(p.createdAt) ?? t,
        });
      }
      let created = 0;
      const entries = [...groups.entries()];
      for (let start = 0; start < entries.length; start += 100) {
        const slice = entries.slice(start, start + 100);
        const existing = await db().getAll(...slice.map(([id]) => cases().doc(id)));
        const batch = db().batch();
        slice.forEach(([id, group], index) => {
          if (existing[index].exists) return;
          const priority = priorityFor(group.reasons, group.count);
          batch.create(cases().doc(id), {
            kind: group.kind, targetId: group.targetId, postId: group.postId, subjectUid: group.subjectUid, status: 'flagged', open: true,
            reportCount: group.count, reasons: group.reasons, snapshot: group.snapshot, priority, priorityRank: PRIORITY_RANK[priority], escalated: false,
            assigneeUid: null, assigneeName: '', decidedBy: null, decision: null, lastEffect: null, appeal: null,
            firstReportedAtMs: group.firstMs, lastReportedAtMs: group.firstMs, updatedAtMs: t, version: 1,
          });
          batch.create(cases().doc(id).collection('history').doc(), { type: 'opened', action: 'backfill', actorUid: actor.uid, atMs: t });
          created += 1;
        });
        await batch.commit();
      }
      deps.audit('moderation.backfill', req, { created, scanned: groups.size });
      return res.json({ created, scanned: groups.size, more: reports.size === 500 || posts.size === 300 });
    } catch (error) {
      console.error('[MODERATION] backfill failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Importimi nuk përfundoi.' });
    }
  });
}

/** Lift lapsed suspensions on a timer. Idempotent and safe from several servers. */
export function startSuspensionSweep(db: () => Firestore, intervalMs = 5 * 60_000): () => void {
  const timer = setInterval(() => {
    void liftExpiredSuspensions(db()).catch(error => console.warn('[MODERATION] suspension sweep failed:', (error as Error)?.message));
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}


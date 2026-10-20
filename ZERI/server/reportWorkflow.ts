/**
 * The report workflow on the server: the six-stage state machine of
 * src/lib/reportWorkflow.ts applied to Firestore, with the task system generated
 * from it.
 *
 *   POST /api/v1/workflow/reports/:id/action        one action, one transaction
 *   GET  /api/v1/workflow/counts                    exact count per queue
 *   GET  /api/v1/workflow/reports?queue=…           one page of a queue
 *   GET  /api/v1/workflow/reports/:id               detail: history, assignments, tasks, my actions
 *   GET  /api/v1/workflow/reports/:id/candidates    eligible assignees, ranked
 *   POST /api/v1/workflow/reports/:id/auto-assign   the system picks and assigns
 *   GET  /api/v1/workflow/tasks?view=mine|queue|all the tasks a person is expected to do
 *   POST /api/v1/workflow/tasks/:id/assign          a manager gives a review task to someone
 *   POST /api/v1/workflow/sync                      (re)generate tasks from existing reports
 *   GET|PUT /api/v1/workflow/priority-rules         the configurable priority rules
 *
 * Data (all linked to the one original report; nothing is copied):
 *   reports/{id}                       status = the stage; `workflow.*` stamps; assignee lists
 *   reports/{id}/assignments/{key}     one per person or municipality
 *   reports/{id}/workflowEvents/{id}   every action: from, to, actor, time, text
 *   reportTasks/{reportId__kind[__key]} deterministic ids → a retried or concurrent
 *                                       request cannot create a second task for one action
 *
 * Guarantees: the decision runs inside the transaction on the stored document, so a
 * second click or a concurrent update sees the new state and is refused (or, with the
 * same `requestId`, answered with the first result); a failure writes nothing, so the
 * previous status stands.
 */
import type { Express, Request, RequestHandler, Response } from 'express';
import { createHash } from 'node:crypto';
import { FieldPath, FieldValue, type Firestore, type Transaction, type DocumentReference } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import {
  AGENT_ACCOUNT_ROLES, QUEUE_STATUSES, QUEUE_TEXT, REPORT_QUEUES, STAGE_STATUS, TASK_QUEUE_ROLES, TASK_TEXT,
  assignmentKey, availableReportActions, decideReportAction, dueAtFor, liveAssignments, normalizePriorityRules,
  pickAssignee, plannedTasks, priorityOf, queueOfStatus, rankCandidates, taskId, toMillis, workflowRoleOf,
  type ActionRequest, type AssignmentFacts, type Candidate, type PriorityRules, type ReportAction, type ReportActor,
  type ReportQueue, type TaskKind, type TaskPlan, type WorkflowRole
} from '../src/lib/reportWorkflow';

export const TASKS = 'reportTasks';
const CONFIG_DOC = ['workflowConfig', 'reportPriority'] as const;

export interface ReportWorkflowDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  authAdmin: () => Auth;
  actingUser: (req: Request) => { uid: string; email: string; role: string; municipality: string; permissions: string[] };
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
  /** Append-only editorial log for municipality actions (optional in tests). */
  logEditorialEvent?: (entry: Record<string, unknown>) => Promise<void>;
}

type Actor = ReturnType<ReportWorkflowDeps['actingUser']>;
type Doc = Record<string, any>;

const PUBLIC_LABEL: Record<string, string> = {
  'Pending Review': 'Në pritje', Approved: 'U aprovua', Assigned: 'I caktuar', 'In Progress': 'Në proces',
  Overdue: 'Në proces', Resolved: 'U zgjidh', Closed: 'U mbyll', Rejected: 'U refuzua', Draft: 'Në pritje',
};

const municipalityOf = (report: Doc) => String(report?.location?.municipality ?? '').trim();
const sameText = (a: unknown, b: unknown) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase() && String(a ?? '').trim() !== '';

/* ------------------------------------------------------------------ */
/* Priority rules (cached, configurable)                               */
/* ------------------------------------------------------------------ */

let rulesCache: { at: number; rules: PriorityRules } | null = null;

export async function loadPriorityRules(db: Firestore): Promise<PriorityRules> {
  if (rulesCache && Date.now() - rulesCache.at < 30_000) return rulesCache.rules;
  let rules = normalizePriorityRules(null);
  try {
    const snap = await db.collection(CONFIG_DOC[0]).doc(CONFIG_DOC[1]).get();
    if (snap.exists) rules = normalizePriorityRules(snap.data());
  } catch (error) {
    console.error('[workflow] priority rules load failed:', (error as Error)?.message);
  }
  rulesCache = { at: Date.now(), rules };
  return rules;
}

/* ------------------------------------------------------------------ */
/* People: who can hold work                                           */
/* ------------------------------------------------------------------ */

export interface Pool {
  candidates: Candidate[];
  /** Who is told when work has nobody: managers, else superadmins. */
  managerUids: string[];
  /** Municipality name (lower-case) → whether it has at least one active account. */
  municipalities: Set<string>;
}

let poolCache: { at: number; pool: Pool } | null = null;
export function invalidatePool(): void { poolCache = null; }

/**
 * Everyone who could be given work, with authority read from the verified custom
 * claims (never the profile document) and load counted from the open tasks.
 */
export async function loadPool(db: Firestore, auth: Auth): Promise<Pool> {
  if (poolCache && Date.now() - poolCache.at < 20_000) return poolCache.pool;
  const roles = [...AGENT_ACCOUNT_ROLES, 'admin', 'superadmin', 'municipality'];
  const [usersSnap, profilesSnap, openSnap] = await Promise.all([
    db.collection('users').where('role', 'in', roles).limit(500).get(),
    db.collection('workerProfiles').limit(1000).get(),
    db.collection(TASKS).where('status', '==', 'open').select('assigneeUid').limit(5000).get(),
  ]);
  const profiles = new Map(profilesSnap.docs.map(d => [d.id, d.data() as Doc]));
  const load = new Map<string, number>();
  for (const doc of openSnap.docs) {
    const uid = String(doc.get('assigneeUid') ?? '');
    if (uid) load.set(uid, (load.get(uid) ?? 0) + 1);
  }

  const uids = usersSnap.docs.map(d => d.id);
  const claimsOf = new Map<string, { role: string; permissions: string[]; disabled: boolean; municipality: string }>();
  for (let i = 0; i < uids.length; i += 100) {
    const result = await auth.getUsers(uids.slice(i, i + 100).map(uid => ({ uid })));
    for (const user of result.users) {
      const claims = (user.customClaims ?? {}) as Doc;
      claimsOf.set(user.uid, {
        role: String(claims.role ?? ''),
        permissions: Object.keys(claims).filter(k => k.startsWith('perm_') && claims[k] === true).map(k => k.slice(5)),
        disabled: user.disabled,
        municipality: String(claims.municipality ?? ''),
      });
    }
  }

  const candidates: Candidate[] = [];
  const managerUids: string[] = [];
  const superUids: string[] = [];
  const municipalities = new Set<string>();
  for (const doc of usersSnap.docs) {
    const data = doc.data() as Doc;
    const claim = claimsOf.get(doc.id);
    // No claims: the account has no authority, whatever its profile says.
    if (!claim || !claim.role) continue;
    const banned = claim.disabled || data.isBanned === true;
    const role = workflowRoleOf(claim.role, claim.permissions);
    if (claim.role === 'municipality') {
      if (!banned && claim.municipality) municipalities.add(claim.municipality.trim().toLowerCase());
      continue;
    }
    if (role === 'manager' && !banned) managerUids.push(doc.id);
    if (role === 'superadmin' && !banned) superUids.push(doc.id);
    const profile = profiles.get(doc.id) ?? {};
    const capacity = Number(profile.capacity);
    candidates.push({
      uid: doc.id,
      name: String(data.name ?? profile.name ?? data.email ?? doc.id).slice(0, 120),
      role: claim.role,
      permissions: claim.permissions,
      disabled: banned || profile.availability === 'away' || profile.disabled === true,
      municipality: String(profile.municipality ?? data.municipality ?? '').trim() || undefined,
      department: String(profile.department ?? data.department ?? '').trim() || undefined,
      skills: Array.isArray(profile.skills) ? profile.skills.map(String) : [],
      capacity: Number.isFinite(capacity) && capacity >= 1 ? Math.min(50, capacity) : 8,
      load: load.get(doc.id) ?? 0,
    });
  }
  const pool = { candidates, managerUids: managerUids.length ? managerUids : superUids, municipalities };
  poolCache = { at: Date.now(), pool };
  return pool;
}

/* ------------------------------------------------------------------ */
/* Reading a report's workflow state inside a transaction              */
/* ------------------------------------------------------------------ */

function assignmentFacts(id: string, data: Doc): AssignmentFacts {
  return {
    key: id,
    type: data.type === 'municipality' ? 'municipality' : 'agent',
    uid: data.uid ?? null,
    municipality: data.municipality ?? null,
    name: String(data.name ?? ''),
    status: (['active', 'submitted', 'completed', 'cancelled'].includes(data.status) ? data.status : 'active') as AssignmentFacts['status'],
  };
}

interface Snapshot {
  report: Doc;
  assignments: Map<string, { facts: AssignmentFacts; data: Doc }>;
  openTasks: Map<string, Doc>;
}

async function readState(tx: Transaction, db: Firestore, ref: DocumentReference): Promise<Snapshot | null> {
  const snap = await tx.get(ref);
  if (!snap.exists) return null;
  const [assignSnap, taskSnap] = await Promise.all([
    tx.get(ref.collection('assignments')),
    tx.get(db.collection(TASKS).where('reportId', '==', ref.id).where('status', '==', 'open')),
  ]);
  return {
    report: snap.data() as Doc,
    assignments: new Map(assignSnap.docs.map(d => [d.id, { facts: assignmentFacts(d.id, d.data()), data: d.data() as Doc }])),
    openTasks: new Map(taskSnap.docs.map(d => [d.id, d.data() as Doc])),
  };
}

/* ------------------------------------------------------------------ */
/* Tasks: reconcile the open tasks with what the stage needs            */
/* ------------------------------------------------------------------ */

interface TaskContext {
  nowMs: number;
  rules: PriorityRules;
  pool: Pool | null;
  actorUid: string;
  /** Tasks the current action completed (closed as done rather than cancelled). */
  completedKinds: ReadonlySet<TaskKind>;
  completedAssignmentKeys?: ReadonlySet<string>;
  /** A manager's explicit pick for the review task. */
  reviewerUid?: string | null;
}

/**
 * Bring a report's tasks in line with its (new) state. Called inside a transaction
 * after every read is done: `existing` are the planned task docs read beforehand.
 * Returns the notifications to send (also written in the transaction).
 */
function reconcileTasks(
  tx: Transaction,
  db: Firestore,
  reportId: string,
  report: Doc,
  queue: ReportQueue,
  assignments: AssignmentFacts[],
  assignmentData: Map<string, Doc>,
  openTasks: Map<string, Doc>,
  existing: Map<string, Doc | null>,
  plans: TaskPlan[],
  ctx: TaskContext,
): { created: string[]; closed: string[] } {
  const created: string[] = [];
  const closed: string[] = [];
  const planned = new Set(plans.map(p => p.id));

  for (const [id, task] of openTasks) {
    if (planned.has(id)) continue;
    const done = ctx.completedKinds.has(task.kind) && (task.kind !== 'work' || !ctx.completedAssignmentKeys || ctx.completedAssignmentKeys.has(task.assignmentKey));
    tx.update(db.collection(TASKS).doc(id), {
      status: done ? 'done' : 'cancelled', closedAtMs: ctx.nowMs, closedBy: ctx.actorUid, updatedAtMs: ctx.nowMs,
      reportStatus: STAGE_STATUS[queue],
    });
    closed.push(id);
  }

  const priority = priorityOf(report, ctx.rules, ctx.nowMs);
  const base = {
    reportId,
    trackingId: String(report.trackingId ?? ''),
    title: String(report.title ?? '').slice(0, 160),
    category: String(report.category ?? ''),
    municipality: municipalityOf(report),
    sector: String(report.responsibleOffice ?? report.responsibleInstitution ?? '').slice(0, 120),
    reportStatus: STAGE_STATUS[queue],
    priorityScore: priority.score,
    priorityLevel: priority.level,
    priorityReasons: priority.reasons.slice(0, 8),
  };

  const notify = (userId: string, title: string, message: string) =>
    tx.set(db.collection('notifications').doc(), {
      title, message, channel: 'report', category: 'report', type: 'info', priority: priority.level === 'urgent' ? 'high' : 'normal',
      urgent: priority.level === 'urgent', audience: 'user', userId, reportId, state: 'published',
      link: `/agent#detyrat?raport=${encodeURIComponent(reportId)}`, sender: 'Zëri i Qytetarëve', createdAt: FieldValue.serverTimestamp(),
    });
  const label = base.trackingId ? ` #${base.trackingId}` : '';

  for (const plan of plans) {
    const already = openTasks.get(plan.id);
    if (already) {
      // Keep priority fresh on the open task; do not touch its holder.
      tx.update(db.collection(TASKS).doc(plan.id), { priorityScore: base.priorityScore, priorityLevel: base.priorityLevel, reportStatus: base.reportStatus, updatedAtMs: ctx.nowMs });
      continue;
    }
    const before = existing.get(plan.id) ?? null;
    let assigneeUid: string | null = null;
    let assigneeName = '';
    let assigneeMunicipality: string | null = null;
    let assigneeType: 'user' | 'municipality' | 'queue' = 'queue';

    if (plan.kind === 'work' && plan.assignmentKey) {
      const a = assignmentData.get(plan.assignmentKey) ?? {};
      if (a.type === 'municipality') {
        assigneeType = 'municipality';
        assigneeMunicipality = String(a.municipality ?? '');
        assigneeName = `Komuna ${assigneeMunicipality}`;
      } else {
        assigneeType = 'user';
        assigneeUid = String(a.uid ?? '') || null;
        assigneeName = String(a.name ?? '');
      }
    } else if (plan.kind === 'review') {
      // The reviewer: an explicit pick, else whoever already holds the report, else the system's choice.
      const held = String(report.assignedToUid ?? '');
      const pickUid = ctx.reviewerUid ?? (held || null);
      const pick = pickUid
        ? ctx.pool?.candidates.find(c => c.uid === pickUid) ?? null
        : ctx.pool ? pickAssignee(ctx.pool.candidates, { kind: 'review', municipality: base.municipality, category: base.category, sector: base.sector }) : null;
      if (pick) {
        assigneeType = 'user';
        assigneeUid = pick.uid;
        assigneeName = pick.name;
        pick.load += 1; // the next report in this batch sees the new load
      } else if (pickUid) {
        assigneeType = 'user';
        assigneeUid = pickUid;
        assigneeName = String(report.assignedTo ?? '');
      }
    }

    const needsAssignment = assigneeType === 'queue' && (plan.kind === 'review' || plan.kind === 'assign');
    const doc = {
      ...base,
      kind: plan.kind,
      label: TASK_TEXT[plan.kind].label,
      doThis: TASK_TEXT[plan.kind].doThis,
      assignmentKey: plan.assignmentKey ?? null,
      status: 'open',
      assigneeType,
      assigneeUid,
      assigneeName: assigneeName.slice(0, 120),
      assigneeMunicipality,
      queueRoles: [...TASK_QUEUE_ROLES[plan.kind]],
      needsAssignment,
      createdAtMs: before ? toMillis(before.createdAtMs) || ctx.nowMs : ctx.nowMs,
      reopenedAtMs: before ? ctx.nowMs : null,
      updatedAtMs: ctx.nowMs,
      dueAtMs: dueAtFor(priority.level, ctx.nowMs, ctx.rules),
      closedAtMs: null,
      closedBy: null,
      createdBy: ctx.actorUid,
    };
    tx.set(db.collection(TASKS).doc(plan.id), doc);
    created.push(plan.id);

    if (assigneeUid && assigneeUid !== ctx.actorUid) {
      notify(assigneeUid, `Detyrë e re: ${TASK_TEXT[plan.kind].label}${label}`, `${TASK_TEXT[plan.kind].doThis}. ${base.title}`.slice(0, 300));
    }
    if (needsAssignment && ctx.pool) {
      const what = plan.kind === 'assign' ? 'pret caktimin e përgjegjësit' : 'nuk ka shqyrtues të lirë me leje';
      for (const uid of ctx.pool.managerUids.slice(0, 20)) {
        if (uid !== ctx.actorUid) notify(uid, `Kërkohet caktim${label}`, `Raporti ${what}. ${base.title}`.slice(0, 300));
      }
    }
  }
  return { created, closed };
}

/* ------------------------------------------------------------------ */
/* The action executor                                                 */
/* ------------------------------------------------------------------ */

export interface ActionInput extends ActionRequest {
  requestId?: unknown;
  evidence?: unknown;
}

export type ActionResult =
  | { ok: true; reportId: string; action: ReportAction; from: ReportQueue; to: ReportQueue; status: string; replay?: boolean; eventId: string; tasks: { created: string[]; closed: string[] } }
  | { ok: false; status: number; error: string; code: string };

const evidenceOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(v => String(v ?? '').trim()).filter(u => /^https?:\/\//i.test(u) && u.length <= 2048).slice(0, 10) : [];

async function displayName(db: Firestore, uid: string): Promise<string> {
  try { return String((await db.collection('users').doc(uid).get()).data()?.name ?? '').slice(0, 120); } catch { return ''; }
}

/**
 * Validate and apply one action. Never throws for a refusal: it returns the refusal.
 * Throws only when Firestore itself fails (the caller answers 500; nothing was written).
 */
export async function executeReportAction(deps: Pick<ReportWorkflowDeps, 'db' | 'authAdmin'>, actor: Actor, reportId: string, input: ActionInput): Promise<ActionResult> {
  const db = deps.db();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(reportId)) return { ok: false, status: 400, error: 'ID e raportit nuk është e vlefshme.', code: 'BAD_ID' };
  const ref = db.collection('reports').doc(reportId);
  const action = String(input.action ?? '');
  const requestId = typeof input.requestId === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(input.requestId) ? input.requestId : '';
  const eventRef = requestId
    ? ref.collection('workflowEvents').doc(`r_${createHash('sha1').update(`${actor.uid}:${requestId}`).digest('hex').slice(0, 30)}`)
    : ref.collection('workflowEvents').doc();

  const [rules, actorName] = await Promise.all([loadPriorityRules(db), displayName(db, actor.uid)]);
  // People are needed to validate assignees and to tell the managers about work nobody holds.
  const needsPool = ['assign', 'update_assignees', 'approve_report'].includes(action);
  const pool = needsPool ? await loadPool(db, deps.authAdmin()).catch(error => { console.error('[workflow] pool load failed:', error?.message); return null; }) : null;

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const role = workflowRoleOf(actor.role, actor.permissions);
  const actorInstitution = role === 'municipality' ? `Komuna e ${actor.municipality || '—'}` : role === 'agent' ? 'Agjenti i platformës' : role === 'manager' ? 'Menaxheri' : 'Administrata';

  return db.runTransaction(async tx => {
    // Same requestId again (double click, network retry): answer with the first result.
    if (requestId) {
      const seen = await tx.get(eventRef);
      if (seen.exists) {
        const e = seen.data() as Doc;
        return { ok: true as const, reportId, action: e.action, from: e.from, to: e.to, status: e.toStatus, replay: true, eventId: eventRef.id, tasks: { created: [], closed: [] } };
      }
    }
    const state = await readState(tx, db, ref);
    if (!state) return { ok: false as const, status: 404, error: 'Raporti nuk u gjet.', code: 'NOT_FOUND' };
    const { report } = state;
    const facts = [...state.assignments.values()].map(a => a.facts);
    const reportActor: ReportActor = { uid: actor.uid, role: actor.role, permissions: actor.permissions, municipality: actor.municipality };

    const decision = decideReportAction({
      actor: reportActor,
      report: { status: String(report.status ?? ''), municipality: municipalityOf(report), awaitingInfo: report.awaitingInfo === true, doc: report, assignments: facts },
      request: input,
    });
    if (decision.outcome === 'deny') return { ok: false as const, status: decision.status, error: decision.error, code: decision.code };

    // Assignee identities are checked against verified claims (the pool), never the request.
    const newAssignments = new Map<string, Doc>();
    if (decision.assignees.length > 0) {
      for (const target of decision.assignees) {
        if (target.type === 'agent') {
          const person = pool?.candidates.find(c => c.uid === target.uid);
          if (!person) return { ok: false as const, status: 400, error: 'Personi i zgjedhur nuk është staf aktiv me leje pune.', code: 'ASSIGNEE_INVALID' };
          const [ranked] = rankCandidates([{ ...person, load: 0 }], { kind: 'work', municipality: municipalityOf(report), category: report.category });
          if (!ranked.eligible) return { ok: false as const, status: 400, error: `${person.name}: ${ranked.excluded}.`, code: 'ASSIGNEE_INVALID' };
          newAssignments.set(assignmentKey({ type: 'agent', uid: person.uid }), { type: 'agent', uid: person.uid, name: person.name, role: person.role, municipality: null, department: person.department ?? '' });
        } else {
          const name = String(target.municipality);
          if (pool && !pool.municipalities.has(name.toLowerCase())) {
            return { ok: false as const, status: 400, error: `Komuna ${name} nuk ka llogari aktive në platformë; nuk mund ta marrë punën.`, code: 'ASSIGNEE_INVALID' };
          }
          newAssignments.set(assignmentKey({ type: 'municipality', municipality: name }), { type: 'municipality', uid: null, name: `Komuna ${name}`, municipality: name, role: 'municipality' });
        }
      }
    }

    /* -- compute the assignments after the action -- */
    const after = new Map(state.assignments);
    const assignmentWrites: Array<{ key: string; data: Doc; merge: boolean }> = [];
    const setAssignment = (key: string, data: Doc, merge = true) => {
      assignmentWrites.push({ key, data, merge });
      const prev = after.get(key);
      const merged = { ...(merge ? prev?.data ?? {} : {}), ...data };
      after.set(key, { facts: assignmentFacts(key, merged), data: merged });
    };
    const completedKeys = new Set<string>();
    const completedKinds = new Set<TaskKind>();

    switch (decision.def.action) {
      case 'approve_report': completedKinds.add('review'); break;
      case 'reject_report': completedKinds.add('review'); break;
      case 'assign':
      case 'update_assignees': {
        completedKinds.add('assign');
        for (const [key, data] of newAssignments) {
          const prev = state.assignments.get(key);
          if (prev && (prev.facts.status === 'active' || prev.facts.status === 'submitted')) continue;
          setAssignment(key, { ...data, status: 'active', assignedBy: actor.uid, assignedByName: actorName, assignedAtMs: nowMs, submittedAtMs: null, note: '', evidence: [] }, false);
        }
        if (decision.def.action === 'update_assignees') {
          for (const [key, a] of state.assignments) {
            if (!newAssignments.has(key) && (a.facts.status === 'active' || a.facts.status === 'submitted')) {
              setAssignment(key, { status: 'cancelled', cancelledBy: actor.uid, cancelledAtMs: nowMs, cancelReason: decision.text });
            }
          }
        }
        break;
      }
      case 'submit_resolution': {
        const evidence = evidenceOf(input.evidence);
        for (const a of decision.via) {
          setAssignment(a.key, { status: 'submitted', submittedAtMs: nowMs, submittedBy: actor.uid, submittedByName: actorName, note: decision.text, evidence });
          completedKeys.add(a.key);
        }
        completedKinds.add('work');
        break;
      }
      case 'return_to_work': {
        for (const [key, a] of state.assignments) {
          if (a.facts.status === 'submitted') setAssignment(key, { status: 'active', returnedAtMs: nowMs, returnedBy: actor.uid, returnReason: decision.text });
        }
        completedKinds.add('verify');
        break;
      }
      case 'approve_resolution': {
        for (const [key, a] of state.assignments) {
          if (a.facts.status === 'submitted') setAssignment(key, { status: 'completed', completedAtMs: nowMs });
        }
        completedKinds.add('verify');
        break;
      }
      case 'approve_closure': completedKinds.add('close'); break;
      case 'start_process': break;
      default: break;
    }
    if (decision.to === 'rejected' || decision.to === 'closed') {
      for (const [key, a] of after) {
        if (a.facts.status === 'active' || a.facts.status === 'submitted') setAssignment(key, { status: 'cancelled', cancelledBy: actor.uid, cancelledAtMs: nowMs, cancelReason: decision.to });
      }
    }
    const afterFacts = [...after.values()].map(a => a.facts);
    const live = liveAssignments(afterFacts);
    if ((decision.def.action === 'update_assignees') && live.length === 0) {
      return { ok: false as const, status: 400, error: 'Raporti duhet të mbetet me të paktën një përgjegjës.', code: 'ASSIGNEES_REQUIRED' };
    }

    /* -- remaining reads: the planned task docs (a closed one may be reopened) -- */
    const plans = plannedTasks(reportId, decision.to, afterFacts);
    const plannedRefs = plans.filter(p => !state.openTasks.has(p.id)).map(p => db.collection(TASKS).doc(p.id));
    const plannedSnaps = plannedRefs.length ? await tx.getAll(...plannedRefs) : [];
    const existing = new Map(plannedSnaps.map(s => [s.id, s.exists ? (s.data() as Doc) : null]));

    /* -- writes -- */
    const toStatus = decision.to === decision.from ? String(report.status ?? STAGE_STATUS[decision.from]) : STAGE_STATUS[decision.to];
    const previousStatus = String(report.status ?? '');
    const moved = decision.to !== decision.from;
    const updatedByLabel = actorName || actorInstitution;

    for (const w of assignmentWrites) {
      tx.set(ref.collection('assignments').doc(w.key), { ...w.data, updatedAtMs: nowMs }, { merge: w.merge });
    }

    const agentLive = live.filter(a => a.type === 'agent');
    const municipalityLive = live.filter(a => a.type === 'municipality');
    const priority = priorityOf({ ...report, status: toStatus }, rules, nowMs);
    const patch: Doc = {
      updatedAt: nowIso,
      'workflow.stage': decision.to,
      'workflow.lastAction': decision.def.action,
      'workflow.lastActionBy': actor.uid,
      'workflow.lastActionAtMs': nowMs,
      'workflow.tasksFor': toStatus,
      'workflow.assigneeCount': live.length,
      'workflow.submittedCount': live.filter(a => a.status === 'submitted').length,
      priorityScore: priority.score,
      priorityLevel: priority.level,
    };
    if (moved) patch.status = toStatus;

    const publicEvent = (status: string, comment: string) => ({
      id: `${nowMs.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      status, date: nowIso, updatedBy: updatedByLabel, actorRole: role ?? 'staff', actorInstitution, previousStatus,
      source: role === 'municipality' ? 'municipality' : role === 'agent' ? 'agent' : 'admin', comment: comment.slice(0, MAX_PUBLIC),
    });

    switch (decision.def.action) {
      case 'approve_report':
        Object.assign(patch, { 'workflow.approvedBy': actor.uid, 'workflow.approvedByName': actorName, 'workflow.approvedAtMs': nowMs, awaitingInfo: false });
        break;
      case 'reject_report':
        Object.assign(patch, { 'workflow.rejectedBy': actor.uid, 'workflow.rejectedAtMs': nowMs, rejectedAt: nowIso, rejectionReason: decision.text, assigneeUids: [], assignedMunicipalities: [] });
        break;
      case 'assign':
      case 'update_assignees':
        Object.assign(patch, {
          'workflow.assignedBy': actor.uid, 'workflow.assignedByName': actorName, 'workflow.assignedAtMs': nowMs,
          assigneeUids: agentLive.map(a => a.uid),
          assignedMunicipalities: municipalityLive.map(a => a.municipality),
          assignedTo: live.map(a => a.name).join(', ').slice(0, 160),
          assignedToUid: agentLive[0]?.uid ?? '',
          assignedAt: nowIso,
          assignedBy: actor.uid,
        });
        break;
      case 'start_process':
        Object.assign(patch, { 'workflow.startedBy': actor.uid, 'workflow.startedByName': actorName, 'workflow.startedAtMs': nowMs, 'workflow.startedOnBehalf': decision.onBehalf });
        break;
      case 'submit_resolution':
        Object.assign(patch, {
          resolutionClaimed: true,
          resolutionClaim: { byUid: actor.uid, by: actorInstitution, at: nowIso, note: decision.text, evidence: evidenceOf(input.evidence) },
        });
        break;
      case 'return_to_work':
        Object.assign(patch, { resolutionClaimed: false, resolutionReturned: { byUid: actor.uid, at: nowIso, note: decision.text } });
        break;
      case 'approve_resolution':
        Object.assign(patch, {
          resolvedAt: nowIso, resolutionClaimed: false, resolutionSummary: decision.text,
          resolutionVerified: { byUid: actor.uid, at: nowIso },
          'workflow.resolvedBy': actor.uid, 'workflow.resolvedByName': actorName, 'workflow.resolvedAtMs': nowMs,
        });
        break;
      case 'approve_closure':
        Object.assign(patch, {
          closedAt: nowIso, closedBy: actor.uid, finalOutcome: decision.text,
          'workflow.closedBy': actor.uid, 'workflow.closedByName': actorName, 'workflow.closedAtMs': nowMs, 'workflow.outcome': decision.text,
        });
        break;
      default: break;
    }

    // The public Track-ID timeline: stage moves, the submitted work and a return. Internal
    // reassignments stay in the internal history only.
    const publicComment = decision.def.action === 'update_assignees' ? null
      : decision.def.action === 'assign' ? `Caktuar: ${live.map(a => a.type === 'municipality' ? a.name : 'staf i platformës').filter((v, i, all) => all.indexOf(v) === i).join(', ')}`
      : decision.text;
    if (publicComment !== null) patch.timeline = FieldValue.arrayUnion(publicEvent(toStatus, publicComment));

    tx.update(ref, patch);

    tx.set(eventRef, {
      action: decision.def.action,
      label: decision.def.label,
      from: decision.from,
      to: decision.to,
      fromStatus: previousStatus,
      toStatus,
      actorUid: actor.uid,
      actorName,
      actorRole: actor.role,
      workflowRole: role,
      onBehalf: decision.onBehalf,
      text: decision.text,
      assignees: decision.assignees,
      evidence: decision.def.action === 'submit_resolution' ? evidenceOf(input.evidence) : [],
      requestId: requestId || null,
      atMs: nowMs,
      createdAt: FieldValue.serverTimestamp(),
    });

    const assignmentData = new Map([...after].map(([k, v]) => [k, v.data]));
    const tasks = reconcileTasks(tx, db, reportId, { ...report, ...('status' in patch ? { status: toStatus } : {}) }, decision.to, afterFacts, assignmentData, state.openTasks, existing, plans, {
      nowMs, rules, pool, actorUid: actor.uid, completedKinds, completedAssignmentKeys: completedKeys,
    });

    return { ok: true as const, reportId, action: decision.def.action, from: decision.from, to: decision.to, status: toStatus, eventId: eventRef.id, tasks };
  });
}

const MAX_PUBLIC = 1000;

/**
 * Generate (or repair) the tasks of one report from its stored state. Idempotent: the
 * same state always yields the same task ids, so running it twice changes nothing.
 */
export async function syncReportTasks(db: Firestore, reportId: string, ctx: { rules: PriorityRules; pool: Pool | null; actorUid: string }): Promise<{ created: number; closed: number }> {
  const ref = db.collection('reports').doc(reportId);
  const nowMs = Date.now();
  return db.runTransaction(async tx => {
    const state = await readState(tx, db, ref);
    if (!state) return { created: 0, closed: 0 };
    const queue = queueOfStatus(state.report.status);
    const facts = [...state.assignments.values()].map(a => a.facts);
    const plans = plannedTasks(reportId, queue, facts);
    const refs = plans.filter(p => !state.openTasks.has(p.id)).map(p => db.collection(TASKS).doc(p.id));
    const snaps = refs.length ? await tx.getAll(...refs) : [];
    const existing = new Map(snaps.map(s => [s.id, s.exists ? (s.data() as Doc) : null]));
    const result = reconcileTasks(tx, db, reportId, state.report, queue, facts, new Map([...state.assignments].map(([k, v]) => [k, v.data])), state.openTasks, existing, plans, {
      nowMs, rules: ctx.rules, pool: ctx.pool, actorUid: ctx.actorUid, completedKinds: new Set(),
    });
    const status = String(state.report.status ?? '');
    if (state.report?.workflow?.tasksFor !== status || result.created.length || result.closed.length) {
      const priority = priorityOf(state.report, ctx.rules, nowMs);
      tx.update(ref, { 'workflow.tasksFor': status, 'workflow.stage': queue, priorityScore: priority.score, priorityLevel: priority.level });
    }
    return { created: result.created.length, closed: result.closed.length };
  });
}

/**
 * Sweep: reports whose tasks were never generated for their current status (created
 * by an older client, imported, or changed before this module existed). Bounded.
 */
export async function sweepUnsyncedReports(db: Firestore, auth: Auth, limit = 150): Promise<{ scanned: number; synced: number }> {
  const [rules, pool] = await Promise.all([loadPriorityRules(db), loadPool(db, auth).catch(() => null)]);
  let scanned = 0;
  let synced = 0;
  const open = ['Pending Review', 'Approved', 'Assigned', 'In Progress', 'Overdue', 'Resolved'];
  for (const status of open) {
    const snap = await db.collection('reports').where('status', '==', status).orderBy('createdAt', 'desc').limit(limit).get();
    for (const doc of snap.docs) {
      scanned += 1;
      if (doc.get('workflow.tasksFor') === status) continue;
      try {
        const result = await syncReportTasks(db, doc.id, { rules, pool, actorUid: 'system' });
        if (result.created || result.closed) synced += 1;
      } catch (error) {
        console.error('[workflow] sync failed for', doc.id, (error as Error)?.message);
      }
    }
  }
  return { scanned, synced };
}

/* ------------------------------------------------------------------ */
/* Side effects after a committed action                               */
/* ------------------------------------------------------------------ */

async function afterCommit(deps: ReportWorkflowDeps, actor: Actor, result: Extract<ActionResult, { ok: true }>, text: string): Promise<void> {
  if (result.replay) return;
  const db = deps.db();
  let report: Doc = {};
  try { report = (await db.collection('reports').doc(result.reportId).get()).data() ?? {}; } catch { /* best effort */ }
  const role = workflowRoleOf(actor.role, actor.permissions);
  const institution = role === 'municipality' ? `Komuna e ${actor.municipality || '—'}` : role === 'agent' ? 'Agjenti i platformës' : 'Administrata';
  const trackId = String(report.trackingId ?? '');
  const moved = result.from !== result.to;
  const publicStatuses = ['Approved', 'Assigned', 'In Progress', 'Resolved', 'Rejected', 'Overdue', 'Closed'];

  if (moved || result.action === 'submit_resolution' || result.action === 'return_to_work') {
    try {
      await db.collection('report_events').add({
        reportId: result.reportId, trackingId: trackId || null, trackId: trackId || null, status: result.status,
        previousStatus: moved ? STAGE_STATUS[result.from] : result.status, municipality: municipalityOf(report) || null,
        category: String(report.category ?? '') || null, reportTitle: String(report.title ?? '').slice(0, 140),
        comment: text || null, actorId: actor.uid, actorName: institution, actorRole: role, actorInstitution: institution,
        source: role === 'municipality' ? 'municipality' : 'admin', action: result.action,
        isPublic: report.isAnonymous !== true && publicStatuses.includes(result.status), notifyReporter: moved,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (error) { console.error('[workflow] report_event failed:', (error as Error)?.message); }
  }

  const authorId = String(report.authorId ?? '');
  if (authorId && moved) {
    const label = PUBLIC_LABEL[result.status] ?? result.status;
    try {
      await db.collection('notifications').add({
        title: `Përditësim i raportimit ${trackId ? `#${trackId}` : ''}`.trim(),
        message: `Raportimi juaj ${trackId ? `#${trackId}` : ''} kaloi në statusin "${label}".${result.to === 'rejected' && text ? ` Arsyeja: ${text.slice(0, 200)}` : ''}`.trim(),
        channel: 'report', category: 'report',
        type: result.to === 'rejected' ? 'alert' : result.to === 'resolved' || result.to === 'closed' ? 'success' : 'info',
        priority: result.to === 'rejected' ? 'high' : 'normal', urgent: false, audience: 'user', userId: authorId,
        reportId: result.reportId, trackId: trackId || null, municipality: municipalityOf(report) || null, state: 'published',
        link: `/trackid${trackId ? `?id=${encodeURIComponent(trackId)}` : ''}`, sender: institution, createdAt: FieldValue.serverTimestamp(),
      });
    } catch (error) { console.error('[workflow] reporter notification failed:', (error as Error)?.message); }
  }

  if (role === 'municipality' && deps.logEditorialEvent) {
    await deps.logEditorialEvent({
      kind: result.action === 'submit_resolution' ? 'work_facts_added' : 'response_published',
      subjectId: result.reportId, subjectType: 'report', actorMunicipality: actor.municipality, actorUserId: actor.uid,
      actorEmail: actor.email, attemptedAction: result.action, denied: false, note: text || undefined,
    }).catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ */
/* Presenting                                                          */
/* ------------------------------------------------------------------ */

/** What a role may see in a list row. A municipality never sees the reporter's identity. */
function presentRow(id: string, data: Doc, viewer: WorkflowRole) {
  const queue = queueOfStatus(data.status);
  return {
    id,
    trackingId: String(data.trackingId ?? ''),
    title: String(data.title ?? '').slice(0, 200),
    category: String(data.category ?? ''),
    urgency: String(data.urgency ?? ''),
    municipality: municipalityOf(data),
    sector: String(data.responsibleOffice ?? data.responsibleInstitution ?? ''),
    status: String(data.status ?? ''),
    queue,
    overdue: String(data.status ?? '') === 'Overdue',
    priorityScore: Number(data.priorityScore ?? 0),
    priorityLevel: String(data.priorityLevel ?? ''),
    assignedTo: String(data.assignedTo ?? ''),
    assigneeUids: Array.isArray(data.assigneeUids) ? data.assigneeUids : [],
    assignedMunicipalities: Array.isArray(data.assignedMunicipalities) ? data.assignedMunicipalities : [],
    submittedCount: Number(data?.workflow?.submittedCount ?? 0),
    assigneeCount: Number(data?.workflow?.assigneeCount ?? 0),
    rejectionReason: queue === 'rejected' ? String(data.rejectionReason ?? '') : undefined,
    createdAtMs: toMillis(data.createdAt),
    updatedAtMs: Math.max(toMillis(data.updatedAt), Number(data?.workflow?.lastActionAtMs ?? 0)),
    authorName: viewer === 'municipality' || data.isAnonymous === true ? undefined : String(data.authorName ?? ''),
    approvedByName: String(data?.workflow?.approvedByName ?? ''),
    thumb: Array.isArray(data.images) && typeof data.images[0] === 'string' ? data.images[0] : '',
  };
}

/**
 * The one step this viewer would most likely take from the list ("Aprovo", "Cakto", "Fillo"),
 * decided by the same rules as the server. Assignments are rebuilt from the report's own
 * lists, which is enough for the buttons; the action itself is validated again on the server.
 */
function quickActionFor(actor: Actor, data: Doc) {
  const assignments: AssignmentFacts[] = [
    ...(Array.isArray(data.assigneeUids) ? data.assigneeUids : []).map((uid: string) => ({ key: `u_${uid}`, type: 'agent' as const, uid, status: 'active' as const })),
    ...(Array.isArray(data.assignedMunicipalities) ? data.assignedMunicipalities : []).map((m: string) => ({ key: `m_${m}`, type: 'municipality' as const, municipality: m, status: 'active' as const })),
  ];
  const options = availableReportActions({ uid: actor.uid, role: actor.role, permissions: actor.permissions, municipality: actor.municipality }, {
    status: String(data.status ?? ''), municipality: municipalityOf(data), awaitingInfo: data.awaitingInfo === true, doc: data, assignments,
  });
  const pick = options.find(o => o.tone === 'primary');
  return pick ? { action: pick.action, label: pick.label, oneClick: !pick.requires && pick.action !== 'assign' && pick.action !== 'update_assignees' } : null;
}

/** The statuses a role may read in each queue. A municipality sees its routed reports only, from approval on. */
function visibleQueues(role: WorkflowRole): readonly ReportQueue[] {
  return role === 'municipality' ? ['approved', 'assigned', 'in_process', 'resolved', 'closed'] : REPORT_QUEUES;
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

const LEGACY_TO_ACTION: Record<string, ReportAction> = {
  pass_to_municipality: 'approve_report',
  reject: 'reject_report',
  municipality_accept: 'start_process',
  municipality_done: 'submit_resolution',
  staff_verify: 'approve_resolution',
  staff_return: 'return_to_work',
};

/**
 * The acting account. `actingUser` reads the `role` claim only; an account whose token carries
 * just a flag (`admin`, `agent`, …) would otherwise read as a citizen and be told it has no access.
 */
function effectiveActor(deps: ReportWorkflowDeps, req: Request): Actor {
  const actor = deps.actingUser(req);
  if (actor.role && actor.role !== 'citizen') return actor;
  const claims = ((req as unknown as { user?: { claims?: Record<string, unknown> } }).user?.claims ?? {});
  const role = claims.superadmin === true ? 'superadmin'
    : claims.admin === true ? 'admin'
      : claims.municipality_account === true ? 'municipality'
        : claims.monitor === true ? 'monitor'
          : claims.approver === true ? 'approver'
            : claims.agent === true ? 'agent' : actor.role;
  return { ...actor, role };
}

const noAccess = (actor: Actor) =>
  `Kjo llogari nuk ka qasje në raporte (roli i saj: ${actor.role || 'asnjë'}). Qasja jepet për rolet superadmin, menaxher, agjent, komunë dhe monitorim; një administrator mund ta ndryshojë rolin te Agjentët.`;

export function registerReportWorkflowRoutes(app: Express, deps: ReportWorkflowDeps): void {
  const base = '/api/v1/workflow';

  const roleOf = (req: Request) => {
    const actor = effectiveActor(deps, req);
    return { actor, role: workflowRoleOf(actor.role, actor.permissions) };
  };

  const runAction = async (req: Request, res: Response, reportId: string, input: ActionInput) => {
    const actor = effectiveActor(deps, req);
    try {
      const result = await executeReportAction(deps, actor, reportId, input);
      if (result.ok === false) {
        deps.audit('report.workflow.denied', req, { reportId, action: input.action, code: result.code, reason: result.error });
        return res.status(result.status).json({ error: result.error, code: result.code });
      }
      if (!result.replay) {
        invalidatePool();
        deps.audit(`report.workflow.${result.action}`, req, { reportId, from: result.from, to: result.to, tasksCreated: result.tasks.created.length, tasksClosed: result.tasks.closed.length });
        const text = String(input.reason ?? '').trim() || String(input.note ?? '').trim();
        void afterCommit(deps, actor, result, text.slice(0, 1200));
      }
      return res.json({ ...result, id: reportId, stage: result.to, label: QUEUE_TEXT[result.to].label });
    } catch (error) {
      console.error('[workflow] action failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Veprimi nuk u ruajt; statusi i mëparshëm mbetet. Provoni përsëri.', code: 'WRITE_FAILED' });
    }
  };

  app.post(`${base}/reports/:id/action`, deps.requireAuth, (req, res) =>
    runAction(req, res, String(req.params.id ?? ''), {
      action: req.body?.action, reason: req.body?.reason, note: req.body?.note, assignees: req.body?.assignees,
      expectedStatus: req.body?.expectedStatus, requestId: req.body?.requestId, evidence: req.body?.evidence,
    }));

  /**
   * The old transition endpoint, kept for every screen that still calls it, now a thin
   * alias onto the same state machine. The old free "claim" is gone: work is assigned.
   */
  app.post('/api/v1/reports/:id/transition', deps.requireAuth, (req, res) => {
    const legacy = String(req.body?.transition ?? '');
    if (legacy === 'claim') {
      return res.status(410).json({ error: '"Merr përsipër" u hoq. Punën e cakton sistemi ose menaxheri; detyrat tuaja janë te "Detyrat e mia".', code: 'CLAIM_REMOVED' });
    }
    const action = LEGACY_TO_ACTION[legacy];
    if (!action) return res.status(400).json({ error: 'Veprim i panjohur i rrjedhës.', code: 'UNKNOWN_ACTION' });
    const text = String(req.body?.note ?? '').trim();
    const resolvedImage = String(req.body?.resolvedImage ?? '').trim();
    return runAction(req, res, String(req.params.id ?? ''), {
      action,
      reason: text,
      note: text || (action === 'approve_resolution' ? 'Zgjidhja u verifikua nga platforma.' : ''),
      evidence: resolvedImage ? [resolvedImage] : [],
      requestId: req.body?.requestId,
    });
  });

  app.get(`${base}/counts`, deps.requireAuth, async (req, res) => {
    const { actor, role } = roleOf(req);
    if (!role) return res.status(403).json({ error: noAccess(actor) });
    try {
      const counts: Record<string, number> = {};
      await Promise.all(REPORT_QUEUES.map(async queue => {
        if (!visibleQueues(role).includes(queue)) { counts[queue] = 0; return; }
        let q: FirebaseFirestore.Query = deps.db().collection('reports').where('status', 'in', [...QUEUE_STATUSES[queue]]);
        if (role === 'municipality') q = q.where('location.municipality', '==', actor.municipality);
        counts[queue] = (await q.count().get()).data().count;
      }));
      let overdue = 0;
      try {
        let q: FirebaseFirestore.Query = deps.db().collection('reports').where('status', '==', 'Overdue');
        if (role === 'municipality') q = q.where('location.municipality', '==', actor.municipality);
        overdue = (await q.count().get()).data().count;
      } catch { /* optional */ }
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({ counts, overdue, role });
    } catch (error) {
      console.error('[workflow] counts failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Numërimi i radhëve dështoi.' });
    }
  });

  app.get(`${base}/reports`, deps.requireAuth, async (req, res) => {
    const { actor, role } = roleOf(req);
    if (!role) return res.status(403).json({ error: noAccess(actor) });
    const queue = String(req.query.queue ?? 'pending') as ReportQueue;
    if (!REPORT_QUEUES.includes(queue)) return res.status(400).json({ error: 'Radha nuk njihet.' });
    if (!visibleQueues(role).includes(queue)) return res.json({ items: [], nextCursor: null });
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 25) || 25));
    const cursor = String(req.query.cursor ?? '');
    try {
      let q: FirebaseFirestore.Query = deps.db().collection('reports').where('status', 'in', [...QUEUE_STATUSES[queue]]);
      if (role === 'municipality') q = q.where('location.municipality', '==', actor.municipality);
      else if (typeof req.query.municipality === 'string' && req.query.municipality.trim()) q = q.where('location.municipality', '==', req.query.municipality.trim());
      q = q.orderBy('createdAt', queue === 'pending' || queue === 'approved' ? 'asc' : 'desc').orderBy(FieldPath.documentId(), queue === 'pending' || queue === 'approved' ? 'asc' : 'desc');
      if (cursor) {
        const after = await deps.db().collection('reports').doc(cursor).get();
        if (after.exists) q = q.startAfter(after);
      }
      const snap = await q.limit(limit + 1).get();
      const docs = snap.docs.slice(0, limit);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({
        items: docs.map(d => ({ ...presentRow(d.id, d.data() as Doc, role), quick: quickActionFor(actor, d.data() as Doc) })),
        nextCursor: snap.docs.length > limit ? docs[docs.length - 1].id : null,
      });
    } catch (error) {
      console.error('[workflow] list failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Radha nuk u ngarkua. Provoni përsëri.' });
    }
  });

  app.get(`${base}/reports/:id`, deps.requireAuth, async (req, res) => {
    const { actor, role } = roleOf(req);
    if (!role) return res.status(403).json({ error: noAccess(actor) });
    const ref = deps.db().collection('reports').doc(String(req.params.id ?? ''));
    try {
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Raporti nuk u gjet.' });
      const data = snap.data() as Doc;
      const queue = queueOfStatus(data.status);
      if (role === 'municipality' && (!sameText(actor.municipality, municipalityOf(data)) || !visibleQueues(role).includes(queue))) {
        return res.status(404).json({ error: 'Raporti nuk u gjet.' });
      }
      const [assignSnap, eventSnap, taskSnap] = await Promise.all([
        ref.collection('assignments').get(),
        ref.collection('workflowEvents').orderBy('atMs', 'desc').limit(100).get(),
        deps.db().collection(TASKS).where('reportId', '==', snap.id).get(),
      ]);
      const assignments = assignSnap.docs.map(d => ({ key: d.id, ...(d.data() as Doc) }));
      const facts = assignSnap.docs.map(d => assignmentFacts(d.id, d.data()));
      const actions = availableReportActions({ uid: actor.uid, role: actor.role, permissions: actor.permissions, municipality: actor.municipality }, {
        status: String(data.status ?? ''), municipality: municipalityOf(data), awaitingInfo: data.awaitingInfo === true, doc: data, assignments: facts,
      }).map(def => ({ action: def.action, label: def.label, tone: def.tone, requires: def.requires ?? null, to: def.to }));
      // Staff notes (the internal history text) are not for a municipality beyond its own actions.
      const history = eventSnap.docs.map(d => {
        const e = d.data() as Doc;
        const own = e.actorUid === actor.uid || e.workflowRole === 'municipality';
        return { id: d.id, action: e.action, label: e.label, from: e.from, to: e.to, fromStatus: e.fromStatus, toStatus: e.toStatus, actorName: e.actorName || e.workflowRole, workflowRole: e.workflowRole, onBehalf: e.onBehalf === true, text: role === 'municipality' && !own && e.action === 'update_assignees' ? '' : e.text, evidence: e.evidence ?? [], atMs: e.atMs };
      });
      const timeline = Array.isArray(data.timeline) ? data.timeline.slice(-50) : [];
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({
        report: {
          ...presentRow(snap.id, data, role),
          description: String(data.description ?? ''),
          address: String(data?.location?.address ?? ''),
          images: Array.isArray(data.images) ? data.images.slice(0, 12) : [],
          media: (Array.isArray(data.media) ? data.media : []).slice(0, 20).map((m: Doc) => ({ url: String(m?.url ?? ''), type: String(m?.type ?? 'image'), name: String(m?.name ?? ''), edited: Boolean(m?.editedAt) })),
          zone: String(data.zone ?? ''),
          terrain: String(data.zone === 'urban' ? 'Urban' : data.zone === 'rural' ? 'Rural' : ''),
          neighborhood: String(data?.location?.neighborhood ?? ''),
          lat: typeof data?.location?.lat === 'number' ? data.location.lat : null,
          lng: typeof data?.location?.lng === 'number' ? data.location.lng : null,
          responsibleInstitution: String(data.responsibleInstitution ?? ''),
          responsibleOffice: String(data.responsibleOffice ?? ''),
          responsibleLevel: String(data.responsibleLevel ?? ''),
          topicCategory: String(data.topicCategory ?? ''),
          canEditPhotos: role === 'superadmin' || role === 'manager' || role === 'agent',
          resolutionClaim: data.resolutionClaim ?? null,
          resolutionSummary: data.resolutionSummary ?? null,
          finalOutcome: data.finalOutcome ?? null,
          awaitingInfo: data.awaitingInfo === true,
          workflow: data.workflow ?? {},
          priorityReasons: priorityOf(data, await loadPriorityRules(deps.db())).reasons,
        },
        assignments,
        tasks: taskSnap.docs.map(d => ({ id: d.id, ...(d.data() as Doc) })).sort((a: Doc, b: Doc) => Number(b.createdAtMs ?? 0) - Number(a.createdAtMs ?? 0)),
        history,
        timeline,
        actions,
        role,
      });
    } catch (error) {
      console.error('[workflow] detail failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Raporti nuk u ngarkua.' });
    }
  });

  app.get(`${base}/reports/:id/candidates`, deps.requireAuth, async (req, res) => {
    const { role } = roleOf(req);
    if (role !== 'superadmin' && role !== 'manager') return res.status(403).json({ error: 'Vetëm menaxheri dhe superadmini caktojnë përgjegjës.' });
    try {
      const snap = await deps.db().collection('reports').doc(String(req.params.id ?? '')).get();
      if (!snap.exists) return res.status(404).json({ error: 'Raporti nuk u gjet.' });
      const data = snap.data() as Doc;
      const pool = await loadPool(deps.db(), deps.authAdmin());
      const assignSnap = await snap.ref.collection('assignments').get();
      const before = new Set(assignSnap.docs.map(d => String(d.get('uid') ?? '')).filter(Boolean));
      const kind = String(req.query.kind ?? 'work') === 'review' ? 'review' : 'work';
      const ranked = rankCandidates(pool.candidates.map(c => ({ ...c, previouslyOnReport: before.has(c.uid) })), {
        kind, municipality: municipalityOf(data), category: String(data.category ?? ''), sector: String(data.responsibleOffice ?? ''),
      });
      const municipality = municipalityOf(data);
      return res.json({
        people: ranked.map(c => ({ uid: c.uid, name: c.name, role: c.role, eligible: c.eligible, score: c.score, why: c.why, excluded: c.excluded ?? null, load: c.load, capacity: c.capacity, department: c.department ?? '', municipality: c.municipality ?? '' })),
        municipality: municipality ? { name: municipality, hasAccount: pool.municipalities.has(municipality.toLowerCase()) } : null,
      });
    } catch (error) {
      console.error('[workflow] candidates failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Lista e përgjegjësve nuk u ngarkua.' });
    }
  });

  app.post(`${base}/reports/:id/auto-assign`, deps.requireAuth, async (req, res) => {
    const { role } = roleOf(req);
    if (role !== 'superadmin' && role !== 'manager') return res.status(403).json({ error: 'Vetëm menaxheri dhe superadmini caktojnë përgjegjës.' });
    const reportId = String(req.params.id ?? '');
    try {
      const snap = await deps.db().collection('reports').doc(reportId).get();
      if (!snap.exists) return res.status(404).json({ error: 'Raporti nuk u gjet.' });
      const data = snap.data() as Doc;
      const pool = await loadPool(deps.db(), deps.authAdmin());
      const best = pickAssignee(pool.candidates, { kind: 'work', municipality: municipalityOf(data), category: String(data.category ?? ''), sector: String(data.responsibleOffice ?? '') });
      const municipality = municipalityOf(data);
      const assignees = best ? [{ type: 'agent', uid: best.uid }] : [];
      // Municipal responsibility: the municipality is assigned as well when it has an account.
      if (String(data.responsibleLevel ?? '') === 'Komunale' && municipality && pool.municipalities.has(municipality.toLowerCase())) {
        assignees.push({ type: 'municipality', municipality } as never);
      }
      if (assignees.length === 0) {
        return res.status(409).json({ error: 'Nuk ka asnjë person të lirë me leje për këtë raport. Detyra mbetet "Kërkon caktim" dhe menaxherët u njoftuan.', code: 'NO_ELIGIBLE' });
      }
      return runAction(req, res, reportId, { action: 'assign', assignees, expectedStatus: 'Approved', requestId: req.body?.requestId });
    } catch (error) {
      console.error('[workflow] auto-assign failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Caktimi automatik dështoi; asgjë nuk u ndryshua.' });
    }
  });

  app.get(`${base}/tasks`, deps.requireAuth, async (req, res) => {
    const { actor, role } = roleOf(req);
    if (!role) return res.status(403).json({ error: 'Kjo llogari nuk ka detyra.' });
    const view = String(req.query.view ?? 'mine');
    const status = String(req.query.status ?? 'open') === 'closed' ? ['done', 'cancelled'] : ['open'];
    try {
      const col = deps.db().collection(TASKS);
      const queries: FirebaseFirestore.Query[] = [];
      if (view === 'mine') {
        if (role === 'municipality') queries.push(col.where('assigneeMunicipality', '==', actor.municipality).where('status', 'in', status));
        else queries.push(col.where('assigneeUid', '==', actor.uid).where('status', 'in', status));
      } else if (view === 'queue') {
        // Work nobody holds yet that this role may pick up or assign.
        if (role === 'municipality' || role === 'monitor' || role === 'agent') return res.json({ items: [] });
        queries.push(col.where('queueRoles', 'array-contains', role).where('status', 'in', status).where('assigneeType', '==', 'queue'));
      } else if (view === 'all') {
        if (role !== 'superadmin' && role !== 'manager' && role !== 'monitor') return res.status(403).json({ error: 'Pamja e të gjitha detyrave është për menaxherët dhe monitorimin.' });
        queries.push(col.where('status', 'in', status));
      } else {
        return res.status(400).json({ error: 'Pamja nuk njihet.' });
      }
      const snaps = await Promise.all(queries.map(q => q.limit(300).get()));
      const items = snaps.flatMap(s => s.docs.map(d => ({ id: d.id, ...(d.data() as Doc) })))
        .sort((a: Doc, b: Doc) => Number(b.priorityScore ?? 0) - Number(a.priorityScore ?? 0) || Number(a.dueAtMs ?? 0) - Number(b.dueAtMs ?? 0));
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({ items, now: Date.now() });
    } catch (error) {
      console.error('[workflow] tasks failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Detyrat nuk u ngarkuan.' });
    }
  });

  /** A manager hands a review task to a specific eligible person (or back to the system). */
  app.post(`${base}/tasks/:id/assign`, deps.requireAuth, async (req, res) => {
    const { actor, role } = roleOf(req);
    if (role !== 'superadmin' && role !== 'manager') return res.status(403).json({ error: 'Vetëm menaxheri dhe superadmini caktojnë detyra.' });
    const id = String(req.params.id ?? '');
    const uid = String(req.body?.uid ?? '').trim();
    try {
      const [pool, actorName] = await Promise.all([loadPool(deps.db(), deps.authAdmin()), displayName(deps.db(), actor.uid)]);
      const person = pool.candidates.find(c => c.uid === uid);
      const ref = deps.db().collection(TASKS).doc(id);
      const outcome = await deps.db().runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) return { status: 404, error: 'Detyra nuk u gjet.' };
        const task = snap.data() as Doc;
        if (task.status !== 'open') return { status: 409, error: 'Detyra është mbyllur.' };
        if (task.kind !== 'review') return { status: 409, error: 'Kjo detyrë ndryshohet përmes "Korrigjo caktimin" të raportit.' };
        if (!person) return { status: 400, error: 'Personi nuk është staf aktiv me leje.' };
        const [ranked] = rankCandidates([{ ...person, load: person.uid === task.assigneeUid ? person.load - 1 : person.load }], { kind: 'review', municipality: task.municipality, category: task.category });
        if (!ranked.eligible) return { status: 400, error: `${person.name}: ${ranked.excluded}.` };
        const reportRef = deps.db().collection('reports').doc(String(task.reportId));
        const report = await tx.get(reportRef);
        if (!report.exists || queueOfStatus(report.get('status')) !== 'pending') return { status: 409, error: 'Raporti nuk është më në pritje.' };
        const nowMs = Date.now();
        tx.update(ref, { assigneeType: 'user', assigneeUid: person.uid, assigneeName: person.name, needsAssignment: false, updatedAtMs: nowMs, reassignedBy: actor.uid });
        tx.update(reportRef, { assignedTo: person.name, assignedToUid: person.uid, assignedAt: new Date(nowMs).toISOString(), assignedBy: actor.uid });
        tx.set(reportRef.collection('workflowEvents').doc(), {
          action: 'assign_reviewer', label: 'Caktim shqyrtuesi', from: 'pending', to: 'pending', fromStatus: report.get('status'), toStatus: report.get('status'),
          actorUid: actor.uid, actorName, actorRole: actor.role, workflowRole: role, text: String(req.body?.reason ?? '').slice(0, 300),
          assignees: [{ type: 'agent', uid: person.uid }], atMs: nowMs, createdAt: FieldValue.serverTimestamp(),
        });
        if (person.uid !== actor.uid) {
          tx.set(deps.db().collection('notifications').doc(), {
            title: 'Detyrë e re: Shqyrtim', message: `Shqyrto raportin ${task.trackingId ? `#${task.trackingId}` : ''}: ${task.title}`.slice(0, 300),
            channel: 'report', category: 'report', type: 'info', priority: 'normal', urgent: false, audience: 'user', userId: person.uid,
            reportId: task.reportId, state: 'published', link: '/agent#detyrat', sender: 'Zëri i Qytetarëve', createdAt: FieldValue.serverTimestamp(),
          });
        }
        return { status: 200, error: '' };
      });
      if (outcome.status !== 200) return res.status(outcome.status).json({ error: outcome.error });
      invalidatePool();
      deps.audit('report.workflow.assign_reviewer', req, { taskId: id, uid });
      return res.json({ ok: true });
    } catch (error) {
      console.error('[workflow] task assign failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Caktimi nuk u ruajt.' });
    }
  });

  app.post(`${base}/sync`, deps.requireAuth, async (req, res) => {
    const { role } = roleOf(req);
    if (role !== 'superadmin' && role !== 'manager') return res.status(403).json({ error: 'Vetëm menaxheri dhe superadmini.' });
    try {
      const result = await sweepUnsyncedReports(deps.db(), deps.authAdmin(), Math.min(500, Number(req.body?.limit ?? 200) || 200));
      deps.audit('report.workflow.sync', req, result);
      return res.json(result);
    } catch (error) {
      console.error('[workflow] sync failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Sinkronizimi i detyrave dështoi.' });
    }
  });

  app.get(`${base}/priority-rules`, deps.requireAuth, async (req, res) => {
    const { role } = roleOf(req);
    if (!role || role === 'municipality') return res.status(403).json({ error: 'Pa qasje.' });
    return res.json({ rules: await loadPriorityRules(deps.db()) });
  });

  app.put(`${base}/priority-rules`, deps.requireAuth, async (req, res) => {
    const { actor, role } = roleOf(req);
    if (role !== 'superadmin') return res.status(403).json({ error: 'Rregullat e prioritetit i ndryshon vetëm superadmini.' });
    const rules = normalizePriorityRules(req.body?.rules);
    try {
      await deps.db().collection(CONFIG_DOC[0]).doc(CONFIG_DOC[1]).set({ ...rules, updatedBy: actor.uid, updatedAtMs: Date.now() });
      rulesCache = null;
      deps.audit('report.workflow.priority_rules', req, {});
      return res.json({ rules });
    } catch (error) {
      console.error('[workflow] rules save failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Rregullat nuk u ruajtën.' });
    }
  });
}

/** Run the sweep every few minutes so reports created by any path get their tasks. */
export function startWorkflowSweeper(db: () => Firestore, auth: () => Auth, everyMs = 3 * 60_000): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await sweepUnsyncedReports(db(), auth(), 100); } catch (error) { console.error('[workflow] sweep failed:', (error as Error)?.message); } finally { running = false; }
  };
  const timer = setInterval(() => void tick(), everyMs);
  timer.unref?.();
  setTimeout(() => void tick(), 15_000).unref?.();
  return () => clearInterval(timer);
}

/** People the system can no longer give work to: their open tasks go back to the queue. */
export async function releaseTasksOf(db: Firestore, uid: string): Promise<number> {
  const snap = await db.collection(TASKS).where('assigneeUid', '==', uid).where('status', '==', 'open').limit(400).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  const nowMs = Date.now();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { assigneeType: 'queue', assigneeUid: null, assigneeName: '', needsAssignment: true, updatedAtMs: nowMs, releasedFrom: uid });
  }
  await batch.commit();
  invalidatePool();
  return snap.size;
}

export { taskId };
export type { WorkflowRole };

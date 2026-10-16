import { describe, expect, it } from 'vitest';
import {
  ACTIONS, DEFAULT_PRIORITY_RULES, QUEUE_TEXT, REPORT_QUEUES, REPORT_STAGES, availableReportActions, decideReportAction,
  normalizePriorityRules, pickAssignee, plannedTasks, priorityOf, queueOfStatus, rankCandidates, workflowRoleOf,
  type AssignmentFacts, type Candidate, type ReportActor, type ReportFacts,
} from '../../src/lib/reportWorkflow';

const COMPLETE = {
  location: { municipality: 'Prishtinë', address: 'Rr. Agim Ramadani' },
  description: 'Një gropë e madhe në rrugë që rrezikon kalimtarët çdo ditë.',
  images: ['https://x/1.jpg'],
  category: 'Infrastrukturë',
};

const report = (status: string, assignments: AssignmentFacts[] = [], extra: Partial<ReportFacts> = {}): ReportFacts => ({
  status, municipality: 'Prishtinë', doc: COMPLETE, assignments, ...extra,
});

const SUPER: ReportActor = { uid: 'boss', role: 'superadmin' };
const MANAGER: ReportActor = { uid: 'disp', role: 'dispatcher' };
const AGENT: ReportActor = { uid: 'ana', role: 'agent' };
const AGENT2: ReportActor = { uid: 'blerim', role: 'agent' };
const APPROVER: ReportActor = { uid: 'appr', role: 'approver' };
const MUNI: ReportActor = { uid: 'pr', role: 'municipality', municipality: 'Prishtinë' };
const OTHER_MUNI: ReportActor = { uid: 'pz', role: 'municipality', municipality: 'Prizren' };
const MONITOR: ReportActor = { uid: 'mon', role: 'monitor' };
const CITIZEN: ReportActor = { uid: 'cit', role: 'citizen' };

const agentA = (status: AssignmentFacts['status'] = 'active'): AssignmentFacts => ({ key: 'u_ana', type: 'agent', uid: 'ana', name: 'Ana', status });
const agentB = (status: AssignmentFacts['status'] = 'active'): AssignmentFacts => ({ key: 'u_blerim', type: 'agent', uid: 'blerim', name: 'Blerim', status });
const muni = (status: AssignmentFacts['status'] = 'active'): AssignmentFacts => ({ key: 'm_prishtine', type: 'municipality', municipality: 'Prishtinë', name: 'Komuna Prishtinë', status });

const decide = (actor: ReportActor, r: ReportFacts, action: string, extra: Record<string, unknown> = {}) =>
  decideReportAction({ actor, report: r, request: { action, ...extra } });

describe('reopening', () => {
  it('lets only the superadmin send a resolved or refused report back to review, with a reason', () => {
    expect(decide(SUPER, report('Resolved'), 'reopen_report', { reason: '' })).toMatchObject({ outcome: 'deny', code: 'TEXT_REQUIRED' });
    expect(decide(SUPER, report('Resolved'), 'reopen_report', { reason: 'Qytetari dërgoi prova të reja.' })).toMatchObject({ outcome: 'allow', to: 'pending' });
    expect(decide(SUPER, report('Rejected'), 'reopen_report', { reason: 'Refuzimi ishte i gabuar.' })).toMatchObject({ outcome: 'allow', to: 'pending' });
    expect(decide(MANAGER, report('Resolved'), 'reopen_report', { reason: 'Qytetari dërgoi prova të reja.' })).toMatchObject({ outcome: 'deny', code: 'WRONG_ROLE' });
    expect(decide(AGENT, report('Rejected'), 'reopen_report', { reason: 'Refuzimi ishte i gabuar.' })).toMatchObject({ outcome: 'deny' });
  });
  it('does not apply to reports that are open or closed', () => {
    for (const status of ['Pending Review', 'Approved', 'Assigned', 'In Progress', 'Closed']) {
      expect(decide(SUPER, report(status), 'reopen_report', { reason: 'arsye e mjaftueshme' }).outcome).toBe('deny');
    }
  });
});

describe('the six stages', () => {
  it('are exactly the six statuses, in order, with rejected apart', () => {
    expect(REPORT_STAGES.map(s => QUEUE_TEXT[s].label)).toEqual(['Në pritje', 'U aprovua', 'I caktuar', 'Në proces', 'U zgjidh', 'U mbyll']);
    expect(REPORT_QUEUES).toContain('rejected');
    expect(REPORT_STAGES).not.toContain('rejected');
  });

  it('maps every stored status onto a queue and never loses a record', () => {
    expect(queueOfStatus('Pending Review')).toBe('pending');
    expect(queueOfStatus('Draft')).toBe('pending');
    expect(queueOfStatus('Approved')).toBe('approved');
    expect(queueOfStatus('Assigned')).toBe('assigned');
    expect(queueOfStatus('In Progress')).toBe('in_process');
    expect(queueOfStatus('Overdue')).toBe('in_process');
    expect(queueOfStatus('Resolved')).toBe('resolved');
    expect(queueOfStatus('Closed')).toBe('closed');
    expect(queueOfStatus('Rejected')).toBe('rejected');
    expect(queueOfStatus('something-new')).toBe('pending');
  });

  it('derives the five roles from the existing account roles', () => {
    expect(workflowRoleOf('superadmin')).toBe('superadmin');
    expect(workflowRoleOf('admin')).toBe('superadmin');
    expect(workflowRoleOf('dispatcher')).toBe('manager');
    expect(workflowRoleOf('agent')).toBe('agent');
    expect(workflowRoleOf('approver')).toBe('agent');
    expect(workflowRoleOf('municipality')).toBe('municipality');
    expect(workflowRoleOf('monitor')).toBe('monitor');
    expect(workflowRoleOf('citizen')).toBeNull();
    expect(workflowRoleOf('newsadmin')).toBeNull();
    expect(workflowRoleOf('custom', ['agents'])).toBe('agent');
  });
});

describe('the full lifecycle, one owner per step', () => {
  it('Në pritje → U aprovua: a reviewer approves', () => {
    for (const actor of [AGENT, MANAGER, SUPER, APPROVER]) {
      const d = decide(actor, report('Pending Review'), 'approve_report');
      expect(d.outcome).toBe('allow');
      if (d.outcome === 'allow') expect(d.to).toBe('approved');
    }
    expect(decide(MUNI, report('Pending Review'), 'approve_report')).toMatchObject({ outcome: 'deny', status: 403 });
  });

  it('U aprovua → I caktuar: only a manager or superadmin assigns, with people', () => {
    expect(decide(MANAGER, report('Approved'), 'assign', { assignees: [{ type: 'agent', uid: 'ana1' }] })).toMatchObject({ outcome: 'allow', to: 'assigned' });
    expect(decide(SUPER, report('Approved'), 'assign', { assignees: [{ type: 'municipality', municipality: 'Prishtinë' }] })).toMatchObject({ outcome: 'allow' });
    expect(decide(AGENT, report('Approved'), 'assign', { assignees: [{ type: 'agent', uid: 'ana1' }] })).toMatchObject({ outcome: 'deny', code: 'WRONG_ROLE' });
    expect(decide(MANAGER, report('Approved'), 'assign', { assignees: [] })).toMatchObject({ outcome: 'deny', code: 'ASSIGNEES_REQUIRED' });
    expect(decide(MANAGER, report('Approved'), 'assign', { assignees: [{ type: 'municipality', municipality: 'Prizren' }] })).toMatchObject({ outcome: 'deny', code: 'ASSIGNEE_INVALID' });
  });

  it('I caktuar → Në proces: only an explicit start by the assignee or a manager', () => {
    const r = report('Assigned', [agentA()]);
    expect(decide(AGENT, r, 'start_process')).toMatchObject({ outcome: 'allow', to: 'in_process', onBehalf: false });
    expect(decide(MANAGER, r, 'start_process')).toMatchObject({ outcome: 'allow', onBehalf: true });
    expect(decide(AGENT2, r, 'start_process')).toMatchObject({ outcome: 'deny', code: 'NOT_ASSIGNEE' });
    // A municipality assigned to the report may start it; one that is not assigned may not.
    expect(decide(MUNI, report('Assigned', [muni()]), 'start_process')).toMatchObject({ outcome: 'allow' });
    expect(decide(MUNI, r, 'start_process')).toMatchObject({ outcome: 'deny', code: 'NOT_ASSIGNEE' });
  });

  it('Në proces: each assignee submits their own resolution with a description', () => {
    const r = report('In Progress', [agentA(), agentB()]);
    expect(decide(AGENT, r, 'submit_resolution', { note: 'short' })).toMatchObject({ outcome: 'deny', code: 'TEXT_REQUIRED' });
    const d = decide(AGENT, r, 'submit_resolution', { note: 'Gropa u mbush me asfalt më 12 tetor.' });
    expect(d).toMatchObject({ outcome: 'allow', to: 'in_process' });
    if (d.outcome === 'allow') expect(d.via.map(a => a.key)).toEqual(['u_ana']);
    expect(decide(AGENT, report('In Progress', [agentA('submitted'), agentB()]), 'submit_resolution', { note: 'Gropa u mbush me asfalt.' })).toMatchObject({ outcome: 'deny', code: 'ALREADY_SUBMITTED' });
  });

  it('Në proces → U zgjidh: completing one assignment does not resolve the report', () => {
    const half = report('In Progress', [agentA('submitted'), agentB('active')]);
    expect(decide(SUPER, half, 'approve_resolution', { note: 'Verifikuar në terren.' })).toMatchObject({ outcome: 'deny', code: 'WORK_OUTSTANDING' });
    const none = report('In Progress', [agentA('active')]);
    expect(decide(SUPER, none, 'approve_resolution', { note: 'Verifikuar në terren.' })).toMatchObject({ outcome: 'deny', code: 'NOTHING_SUBMITTED' });
    const all = report('In Progress', [agentA('submitted'), agentB('submitted')]);
    expect(decide(SUPER, all, 'approve_resolution', { note: 'Verifikuar në terren.' })).toMatchObject({ outcome: 'allow', to: 'resolved' });
    expect(decide(MANAGER, all, 'approve_resolution', { note: 'Verifikuar në terren.' })).toMatchObject({ outcome: 'deny', code: 'WRONG_ROLE' });
    expect(decide(AGENT, all, 'approve_resolution', { note: 'Verifikuar në terren.' })).toMatchObject({ outcome: 'deny' });
  });

  it('the person who submitted cannot verify their own work', () => {
    const selfAssigned = report('In Progress', [{ key: 'u_boss', type: 'agent', uid: 'boss', status: 'submitted' }]);
    expect(decide(SUPER, selfAssigned, 'approve_resolution', { note: 'Verifikuar.' })).toMatchObject({ outcome: 'deny', code: 'SAME_PERSON' });
  });

  it('U zgjidh → U mbyll: an explicit closure with the final outcome', () => {
    expect(decide(SUPER, report('Resolved'), 'approve_closure', { note: '' })).toMatchObject({ outcome: 'deny', code: 'TEXT_REQUIRED' });
    expect(decide(SUPER, report('Resolved'), 'approve_closure', { note: 'Rasti u mbyll, qytetari u njoftua.' })).toMatchObject({ outcome: 'allow', to: 'closed' });
    expect(decide(MANAGER, report('Resolved'), 'approve_closure', { note: 'Rasti u mbyll.' })).toMatchObject({ outcome: 'deny' });
  });

  it('no stage is skipped and nothing leaves U mbyll', () => {
    expect(decide(SUPER, report('Pending Review'), 'assign', { assignees: [{ type: 'agent', uid: 'ana1' }] })).toMatchObject({ outcome: 'deny', code: 'WRONG_STAGE' });
    expect(decide(SUPER, report('Approved'), 'start_process')).toMatchObject({ outcome: 'deny', code: 'WRONG_STAGE' });
    expect(decide(SUPER, report('Assigned', [agentA('submitted')]), 'approve_resolution', { note: 'x verified' })).toMatchObject({ outcome: 'deny', code: 'WRONG_STAGE' });
    expect(decide(SUPER, report('In Progress'), 'approve_closure', { note: 'mbyllur' })).toMatchObject({ outcome: 'deny', code: 'WRONG_STAGE' });
    for (const action of Object.keys(ACTIONS)) {
      expect(decide(SUPER, report('Closed'), action, { note: 'diçka e gjatë', reason: 'diçka e gjatë', assignees: [{ type: 'agent', uid: 'ana1' }] }).outcome).toBe('deny');
    }
  });

  it('a repeated click is refused with the stage it is already in', () => {
    expect(decide(AGENT, report('Approved'), 'approve_report')).toMatchObject({ outcome: 'deny', status: 409, error: expect.stringContaining('U aprovua') });
  });

  it('a stale screen is refused: someone else moved the report first', () => {
    expect(decide(AGENT, report('Approved'), 'approve_report', { expectedStatus: 'Pending Review' })).toMatchObject({ outcome: 'deny', code: 'STALE' });
  });
});

describe('rejection', () => {
  it('needs a written reason and goes to the rejected section', () => {
    expect(decide(SUPER, report('Pending Review'), 'reject_report', { reason: '' })).toMatchObject({ outcome: 'deny', code: 'TEXT_REQUIRED' });
    expect(decide(SUPER, report('Pending Review'), 'reject_report', { reason: 'Dublikatë e raportit #A12.' })).toMatchObject({ outcome: 'allow', to: 'rejected' });
  });

  it('the approval officer may reject at Në pritje, an agent may not; after approval only the superadmin', () => {
    expect(decide(APPROVER, report('Pending Review'), 'reject_report', { reason: 'Nuk është problem publik.' })).toMatchObject({ outcome: 'allow' });
    expect(decide(AGENT, report('Pending Review'), 'reject_report', { reason: 'Nuk është problem publik.' })).toMatchObject({ outcome: 'deny', code: 'WRONG_ROLE' });
    expect(decide(APPROVER, report('Approved'), 'reject_report', { reason: 'Nuk është problem publik.' })).toMatchObject({ outcome: 'deny', code: 'WRONG_ROLE' });
    expect(decide(SUPER, report('In Progress', [agentA()]), 'reject_report', { reason: 'U zbulua se është i rremë.' })).toMatchObject({ outcome: 'allow' });
  });
});

describe('role restrictions', () => {
  it('monitoring changes nothing', () => {
    for (const action of Object.keys(ACTIONS)) {
      expect(decide(MONITOR, report('Pending Review'), action)).toMatchObject({ outcome: 'deny', code: 'READ_ONLY' });
    }
    expect(availableReportActions(MONITOR, report('Pending Review'))).toEqual([]);
  });

  it('a citizen has no standing', () => {
    expect(decide(CITIZEN, report('Pending Review'), 'approve_report')).toMatchObject({ outcome: 'deny', code: 'NO_STANDING' });
  });

  it('a municipality never touches another municipality\'s report', () => {
    expect(decide(OTHER_MUNI, report('Assigned', [muni()]), 'start_process')).toMatchObject({ outcome: 'deny', status: 404 });
  });

  it('the incomplete report cannot be approved (existing completeness policy)', () => {
    expect(decide(AGENT, report('Pending Review', [], { doc: { ...COMPLETE, images: [] } }), 'approve_report')).toMatchObject({ outcome: 'deny', code: 'INCOMPLETE' });
    expect(decide(AGENT, report('Pending Review', [], { awaitingInfo: true }), 'approve_report')).toMatchObject({ outcome: 'deny', code: 'AWAITING_INFO' });
  });

  it('buttons match the decision', () => {
    expect(availableReportActions(AGENT, report('Pending Review')).map(a => a.action)).toEqual(['approve_report']);
    expect(availableReportActions(SUPER, report('Pending Review')).map(a => a.action)).toEqual(['approve_report', 'reject_report']);
    expect(availableReportActions(MANAGER, report('Approved')).map(a => a.action)).toEqual(['assign']);
    expect(availableReportActions(AGENT, report('Assigned', [agentA()])).map(a => a.action)).toEqual(['start_process']);
    expect(availableReportActions(AGENT2, report('Assigned', [agentA()])).map(a => a.action)).toEqual([]);
    expect(availableReportActions(AGENT, report('In Progress', [agentA()])).map(a => a.action)).toEqual(['submit_resolution']);
  });
});

describe('tasks generated from the stage', () => {
  it('one review, one assign, one work task per assignee, then verify and close', () => {
    expect(plannedTasks('r1', 'pending', []).map(t => t.id)).toEqual(['r1__review']);
    expect(plannedTasks('r1', 'approved', []).map(t => t.id)).toEqual(['r1__assign']);
    expect(plannedTasks('r1', 'assigned', [agentA(), agentB()]).map(t => t.id)).toEqual(['r1__work__u_ana', 'r1__work__u_blerim']);
    expect(plannedTasks('r1', 'in_process', [agentA('submitted'), agentB()]).map(t => t.id)).toEqual(['r1__work__u_blerim']);
    expect(plannedTasks('r1', 'in_process', [agentA('submitted'), agentB('submitted')]).map(t => t.id)).toEqual(['r1__verify']);
    expect(plannedTasks('r1', 'resolved', []).map(t => t.id)).toEqual(['r1__close']);
    expect(plannedTasks('r1', 'closed', [])).toEqual([]);
    expect(plannedTasks('r1', 'rejected', [])).toEqual([]);
  });

  it('task ids are deterministic, so a retry cannot create a duplicate', () => {
    expect(plannedTasks('r1', 'pending', [])).toEqual(plannedTasks('r1', 'pending', []));
  });

  it('a report left without anyone asks a manager to assign again', () => {
    expect(plannedTasks('r1', 'assigned', [agentA('cancelled')]).map(t => t.kind)).toEqual(['assign']);
  });
});

describe('priority', () => {
  it('urgency, risk, impact, category and waiting time add up', () => {
    const now = Date.parse('2026-10-14T12:00:00Z');
    const low = priorityOf({ urgency: 'E ulët', category: 'Tjetër', createdAt: '2026-10-14T11:00:00Z', title: 'x', description: 'y' }, DEFAULT_PRIORITY_RULES, now);
    const high = priorityOf({ urgency: 'Kritike', aiSeverity: 'HIGH', category: 'Siguri publike', upvotes: 40, createdAt: '2026-10-04T12:00:00Z', title: 'Kabllo elektrike e zhveshur pranë shkollës', description: '' }, DEFAULT_PRIORITY_RULES, now);
    expect(low.level).toBe('low');
    expect(high.level).toBe('urgent');
    expect(high.score).toBeGreaterThan(low.score);
    expect(high.reasons.length).toBeGreaterThan(3);
  });

  it('stored rules are clamped, and missing ones fall back to the defaults', () => {
    const rules = normalizePriorityRules({ perUpvote: 999, levels: { urgent: -5 }, urgency: { 'Kritike': 'x' } });
    expect(rules.perUpvote).toBe(20);
    expect(rules.levels.urgent).toBe(0);
    expect(rules.urgency).toEqual(DEFAULT_PRIORITY_RULES.urgency);
  });
});

describe('choosing who does the work', () => {
  const person = (over: Partial<Candidate>): Candidate => ({ uid: 'x', name: 'X', role: 'agent', permissions: [], disabled: false, capacity: 5, load: 0, ...over });

  it('never offers someone without the permission, suspended, out of scope or full', () => {
    const ranked = rankCandidates([
      person({ uid: 'news', role: 'newsadmin' }),
      person({ uid: 'mon', role: 'monitor' }),
      person({ uid: 'off', disabled: true }),
      person({ uid: 'pz', municipality: 'Prizren' }),
      person({ uid: 'full', load: 5 }),
      person({ uid: 'ok' }),
    ], { kind: 'work', municipality: 'Prishtinë', category: 'Infrastrukturë' });
    expect(ranked.filter(r => r.eligible).map(r => r.uid)).toEqual(['ok']);
    expect(ranked.find(r => r.uid === 'full')?.excluded).toMatch(/Kapaciteti/);
  });

  it('prefers sector fit, then free capacity', () => {
    const best = pickAssignee([
      person({ uid: 'busy', load: 4, skills: ['infrastruktur'] }),
      person({ uid: 'free', load: 0 }),
      person({ uid: 'fit', load: 1, skills: ['infrastruktur'] }),
    ], { kind: 'work', municipality: 'Prishtinë', category: 'Infrastrukturë' });
    expect(best?.uid).toBe('fit');
  });

  it('returns nobody when nobody is eligible (the task then waits for a manager)', () => {
    expect(pickAssignee([person({ disabled: true })], { kind: 'review' })).toBeNull();
  });
});

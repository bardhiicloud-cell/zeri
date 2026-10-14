import { describe, expect, it } from 'vitest';
import { canRead, itemView, itemsCsv, planList, ITEM_CSV_HEADERS } from '../../server/workItemRoutes';
import type { WorkItemDoc } from '../../server/workItems';

const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);

const people = {
  owner: { uid: 'owner', role: 'superadmin' },
  disp: { uid: 'disp', role: 'dispatcher' },
  monitor: { uid: 'mon', role: 'monitor' },
  agent: { uid: 'ana', role: 'agent' },
  peja: { uid: 'peja1', role: 'municipality', municipality: 'Pejë' },
  noMuni: { uid: 'm0', role: 'municipality' },
  mod: { uid: 'm1', role: 'debatwp' },
  citizen: { uid: 'cit1', role: 'citizen' },
  stranger: { uid: 's', role: 'guest' },
};

const item = (over: Partial<WorkItemDoc> = {}): WorkItemDoc => ({
  kind: 'internal_task', title: 'T', description: '', priority: 'normal', status: 'assigned', open: true, assigneeUid: 'ana', assigneeName: 'Ana',
  municipality: 'Pejë', department: '', category: '', requiredSkills: [], preferredSkills: [], weight: 1, requiresReview: false, requiresEvidence: false,
  subjectUid: 'cit1', link: {}, createdBy: 'owner', createdByName: '', createdAtMs: NOW - 1000, updatedAtMs: NOW, assignedAtMs: NOW, acceptedAtMs: null, doneAtMs: null,
  dueAtMs: NOW + 1000, lastActivityAtMs: NOW, escalationLevel: 0, unassignedAlerts: 0, stalledReportedFor: null, manualEscalations: 0, needsAttention: false,
  reworkCount: 0, reopenCount: 0, decidedBy: null, version: 1, dedupeKey: 'secret-key', ...over,
});

describe('planList: what each role may list', () => {
  const plan = (actor: { uid: string; role: string; municipality?: string }, query: { view?: string; kind?: string; uid?: string } = {}) => planList(actor, query, NOW);

  it('every role may list its own open work', () => {
    for (const actor of [people.owner, people.agent, people.peja, people.mod, people.monitor]) {
      expect(plan(actor, { view: 'mine' })).toMatchObject({ outcome: 'ok', filters: [['assigneeUid', '==', actor.uid], ['open', '==', true]] });
    }
    expect(plan(people.stranger, { view: 'mine' })).toMatchObject({ outcome: 'deny', status: 403 });
  });

  it('only managers and the monitoring role see queues across the organisation', () => {
    for (const view of ['unassigned', 'attention', 'overdue', 'worker']) {
      for (const actor of [people.owner, people.disp, people.monitor]) expect(plan(actor, { view, uid: 'x' }).outcome, `${actor.role} ${view}`).toBe('ok');
      for (const actor of [people.agent, people.peja, people.mod, people.citizen]) expect(plan(actor, { view, uid: 'x' }).outcome, `${actor.role} ${view}`).toBe('deny');
    }
  });

  it('a municipality is narrowed in the query to its own referrals, whatever it asks for', () => {
    const result = plan(people.peja, { view: 'open', kind: 'internal_task' });
    expect(result).toMatchObject({ outcome: 'ok' });
    expect(result.outcome === 'ok' && result.filters).toEqual([['municipality', '==', 'Pejë'], ['kind', '==', 'report_referral'], ['open', '==', true]]);
    expect(plan(people.noMuni, { view: 'open' })).toMatchObject({ outcome: 'deny' });
  });

  it('a debate moderator sees only moderation cases, whatever it asks for', () => {
    const result = plan(people.mod, { view: 'open', kind: 'report_referral' });
    expect(result.outcome === 'ok' && result.filters).toEqual([['kind', '==', 'moderation_case'], ['open', '==', true]]);
  });

  it('a field agent cannot list the whole queue, only its own finished work', () => {
    expect(plan(people.agent, { view: 'open' })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(plan(people.agent, { view: 'done' })).toMatchObject({ outcome: 'ok', filters: [['assigneeUid', '==', 'ana'], ['open', '==', false]] });
  });

  it('managers may narrow by kind; an unknown kind is ignored, an unknown view is refused', () => {
    expect(plan(people.owner, { view: 'open', kind: 'moderation_case' }).outcome === 'ok').toBe(true);
    const unknownKind = plan(people.owner, { view: 'open', kind: 'nonsense' });
    expect(unknownKind.outcome === 'ok' && unknownKind.filters).toEqual([['open', '==', true]]);
    expect(plan(people.owner, { view: 'everything' })).toMatchObject({ outcome: 'deny', status: 400 });
  });

  it('the overdue view is a deadline range read in deadline order; finished work is newest first', () => {
    expect(plan(people.owner, { view: 'overdue' })).toMatchObject({ filters: [['open', '==', true], ['dueAtMs', '<=', NOW]], orderField: 'dueAtMs', direction: 'asc' });
    expect(plan(people.owner, { view: 'done' })).toMatchObject({ orderField: 'doneAtMs', direction: 'desc' });
  });
});

describe('canRead', () => {
  it('lets oversight read everything and the holder read their own', () => {
    expect(canRead(people.owner, item())).toBe(true);
    expect(canRead(people.monitor, item())).toBe(true);
    expect(canRead(people.agent, item())).toBe(true);
    expect(canRead({ uid: 'blerim', role: 'agent' }, item())).toBe(false);
  });
  it('limits a municipality to its own referrals', () => {
    expect(canRead(people.peja, item({ kind: 'report_referral' }))).toBe(true);
    expect(canRead(people.peja, item({ kind: 'report_referral', municipality: 'Gjilan' }))).toBe(false);
    expect(canRead(people.peja, item({ kind: 'internal_task' }))).toBe(false);
    expect(canRead(people.noMuni, item({ kind: 'report_referral' }))).toBe(false);
  });
  it('limits a moderator to moderation cases, and a citizen to a case about them', () => {
    expect(canRead(people.mod, item({ kind: 'moderation_case', assigneeUid: null }))).toBe(true);
    expect(canRead(people.mod, item({ kind: 'report_referral', assigneeUid: null }))).toBe(false);
    expect(canRead(people.citizen, item({ kind: 'moderation_case', assigneeUid: null }))).toBe(true);
    expect(canRead({ uid: 'other', role: 'citizen' }, item({ kind: 'moderation_case', assigneeUid: null }))).toBe(false);
    expect(canRead(people.citizen, item({ kind: 'internal_task' }))).toBe(false);
  });
  it('refuses an account with no role in the system', () => {
    expect(canRead(people.stranger, item({ assigneeUid: null }))).toBe(false);
  });
});

describe('itemView', () => {
  it('never exposes the dedupe key, and shows who a case is about only to those who decide', () => {
    const asManager = itemView('i1', item(), people.owner) as Record<string, unknown>;
    const asAgent = itemView('i1', item(), people.agent) as Record<string, unknown>;
    const asMunicipality = itemView('i1', item({ kind: 'report_referral' }), people.peja) as Record<string, unknown>;
    for (const view of [asManager, asAgent, asMunicipality]) expect(view).not.toHaveProperty('dedupeKey');
    expect(asManager.subjectUid).toBe('cit1');
    expect(asAgent).not.toHaveProperty('subjectUid');
    expect(asMunicipality).not.toHaveProperty('subjectUid');
    expect(asManager.id).toBe('i1');
  });
});

describe('itemsCsv', () => {
  it('writes a header, one row per item, and escapes quotes and commas', () => {
    const csv = itemsCsv([{ id: 'a', item: item({ title: 'Gropë, "e madhe"', open: true, dueAtMs: NOW - 5 * 3_600_000 }) }], NOW);
    const [header, row] = csv.split('\n');
    expect(header.split('","')).toHaveLength(ITEM_CSV_HEADERS.length);
    expect(row).toContain('"Gropë, ""e madhe"""');
    expect(row).toContain('"5"'); // five hours overdue
  });
  it('leaves the overdue column empty for finished work', () => {
    const csv = itemsCsv([{ id: 'a', item: item({ open: false, status: 'done', dueAtMs: NOW - 99 * 3_600_000, doneAtMs: NOW }) }], NOW);
    expect(csv.split('\n')[1]).toContain('"","0","0"');
  });
});

import { describe, expect, it } from 'vitest';
import { DECISION_KINDS, availableActions, decide, type DecisionInput } from '../../src/lib/decisionRules';

const owner = { uid: 'o', role: 'superadmin', municipality: '', permissions: [] as string[] };
const run = (patch: Partial<DecisionInput>) =>
  decide({ actor: owner, kind: 'donation', action: 'approve', reason: '', doc: { status: 'pending' }, ...patch });

describe('decide - who may decide', () => {
  it('lets the owner decide every kind', () => {
    expect(run({}).outcome).toBe('allow');
    expect(run({ kind: 'health', doc: { status: 'pending' } }).outcome).toBe('allow');
    expect(run({ kind: 'news', action: 'publish', doc: { published: false, status: 'Draft' } }).outcome).toBe('allow');
    expect(run({ kind: 'adRequest', doc: { status: 'pending' } }).outcome).toBe('allow');
    expect(run({ kind: 'forum', doc: {} }).outcome).toBe('allow');
  });

  it('lets an agent decide only in the fields they were given', () => {
    const agent = { uid: 'a', role: 'agent', municipality: '', permissions: ['donations'] };
    expect(run({ actor: agent }).outcome).toBe('allow');
    expect(run({ actor: agent, kind: 'adRequest', doc: { status: 'pending' } })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(run({ actor: { ...agent, permissions: [] } })).toMatchObject({ outcome: 'deny', status: 403 });
  });

  it('never lets the manager of the agents decide', () => {
    expect(run({ actor: { uid: 'm', role: 'monitor', municipality: '', permissions: ['donations'] } })).toMatchObject({ outcome: 'deny', status: 403 });
  });

  it('lets a municipality confirm and close its own health cases, and nothing else', () => {
    const muni = { uid: 'k', role: 'municipality', municipality: 'Prishtinë', permissions: [] as string[] };
    const own = { status: 'pending', municipality: 'Prishtinë' };
    expect(run({ actor: muni, kind: 'health', doc: own }).outcome).toBe('allow');
    expect(run({ actor: muni, kind: 'health', action: 'resolve', doc: { ...own, status: 'verified' } }).outcome).toBe('allow');
    expect(run({ actor: muni, kind: 'health', action: 'reject', reason: 'nuk është e vërtetë', doc: own })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(run({ actor: muni, kind: 'health', doc: { status: 'pending', municipality: 'Gjilan' } })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(run({ actor: muni })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(run({ actor: { ...muni, municipality: '' }, kind: 'health', doc: own })).toMatchObject({ outcome: 'deny', status: 403 });
  });

  it('refuses a citizen', () => {
    expect(run({ actor: { uid: 'c', role: 'citizen', municipality: '', permissions: [] } })).toMatchObject({ outcome: 'deny', status: 403 });
  });
});

describe('decide - the action tables', () => {
  it('needs a reason to reject, hide or withdraw', () => {
    expect(run({ action: 'reject' })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ action: 'reject', reason: 'Lidhja e donacionit është e rreme' }).outcome).toBe('allow');
    expect(run({ kind: 'forum', action: 'hide', doc: {} })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ kind: 'news', action: 'unpublish', doc: { published: true } })).toMatchObject({ outcome: 'deny', status: 400 });
  });

  it('refuses a move from the wrong state with 409, so a stale screen learns it is stale', () => {
    expect(run({ doc: { status: 'approved' } })).toMatchObject({ outcome: 'deny', status: 409 });
    expect(run({ kind: 'health', action: 'resolve', doc: { status: 'rejected' } })).toMatchObject({ outcome: 'deny', status: 409 });
    expect(run({ kind: 'news', action: 'publish', doc: { published: true } })).toMatchObject({ outcome: 'deny', status: 409 });
  });

  it('reads the state of each kind the way its documents store it', () => {
    expect(DECISION_KINDS.news.stateOf({ published: true, status: 'Draft' })).toBe('published');
    expect(DECISION_KINDS.news.stateOf({ published: false, status: 'Rejected' })).toBe('rejected');
    expect(DECISION_KINDS.forum.stateOf({ isApproved: true, isHidden: true })).toBe('hidden');
    expect(DECISION_KINDS.donation.stateOf({})).toBe('pending');
  });

  it('rejects unknown kinds, actions, a missing record, and an over-long reason', () => {
    expect(run({ kind: 'poll' })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ action: 'delete' })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ doc: null })).toMatchObject({ outcome: 'deny', status: 404 });
    expect(run({ action: 'reject', reason: 'x'.repeat(301) })).toMatchObject({ outcome: 'deny', status: 400 });
  });

  it('writes what each kind expects', () => {
    const now = '2026-10-12T00:00:00.000Z';
    expect(DECISION_KINDS.news.actions.publish.patch(now, { reason: '', campaignId: '' })).toEqual({ published: true, publishedAt: now, status: 'Published' });
    expect(DECISION_KINDS.health.actions.reject.patch(now, { reason: 'r', campaignId: '' })).toMatchObject({ status: 'rejected', statusNote: 'r' });
    expect(DECISION_KINDS.adRequest.actions.approve.patch(now, { reason: '', campaignId: 'c1' })).toMatchObject({ status: 'approved', campaignId: 'c1' });
  });
});

describe('availableActions', () => {
  it('offers only the buttons the server will accept', () => {
    expect(availableActions('donation', { status: 'pending' }, owner).map(a => a.action)).toEqual(['approve', 'reject']);
    expect(availableActions('donation', { status: 'approved' }, owner).map(a => a.action)).toEqual(['reject', 'reopen']);
    const muni = { uid: 'k', role: 'municipality', municipality: 'Pejë', permissions: [] as string[] };
    expect(availableActions('health', { status: 'pending', municipality: 'Pejë' }, muni).map(a => a.action)).toEqual(['approve']);
    expect(availableActions('donation', { status: 'pending' }, { uid: 'm', role: 'monitor', municipality: '', permissions: [] })).toEqual([]);
  });
});

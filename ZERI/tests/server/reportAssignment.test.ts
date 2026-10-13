import { describe, expect, it } from 'vitest';
import { decideAssignment, type AssignmentInput } from '../../server/reportAssignment';
import { parseReportListQuery, planReportQuery, REQUIRED_REPORT_INDEXES } from '../../server/reportQuery';

const owner = { uid: 'owner', role: 'superadmin', permissions: [] as string[] };
const agentA = { uid: 'a', role: 'agent', permissions: [] as string[] };
const target = { uid: 'b', role: 'agent', permissions: [] as string[], disabled: false };
const run = (patch: Partial<AssignmentInput>) =>
  decideAssignment({ actor: owner, report: { status: 'Pending Review' }, target, release: false, ...patch });

describe('decideAssignment', () => {
  it('lets the owner hand a report in the queue to an agent', () => {
    expect(run({})).toEqual({ outcome: 'allow', kind: 'assign' });
  });

  it('does not let an agent hand work to someone else', () => {
    expect(run({ actor: agentA })).toMatchObject({ outcome: 'deny', status: 403 });
  });

  it('refuses monitors, municipalities and citizens', () => {
    for (const role of ['monitor', 'municipality', 'citizen']) {
      expect(run({ actor: { uid: 'x', role, permissions: [] } }), role).toMatchObject({ outcome: 'deny', status: 403 });
    }
  });

  it('assigns only to an active agent', () => {
    expect(run({ target: { ...target, role: 'municipality' } })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ target: { ...target, role: 'citizen' } })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ target: { ...target, disabled: true } })).toMatchObject({ outcome: 'deny', status: 409 });
    expect(run({ target: null })).toMatchObject({ outcome: 'deny', status: 404 });
  });

  it('only assigns reports still at the front of the queue', () => {
    expect(run({ report: { status: 'Approved' } })).toMatchObject({ outcome: 'deny', status: 409 });
    expect(run({ report: { status: 'Resolved' } })).toMatchObject({ outcome: 'deny', status: 409 });
    expect(run({ report: null })).toMatchObject({ outcome: 'deny', status: 404 });
  });

  it('refuses a no-op reassignment', () => {
    expect(run({ report: { status: 'Pending Review', assignedToUid: 'b' } })).toMatchObject({ outcome: 'deny', status: 409 });
  });

  it('lets the holder release, and the owner release anyone; nobody else', () => {
    const held = { status: 'Pending Review', assignedToUid: 'a' };
    expect(run({ actor: agentA, report: held, release: true, target: null })).toEqual({ outcome: 'allow', kind: 'release' });
    expect(run({ report: held, release: true, target: null })).toEqual({ outcome: 'allow', kind: 'release' });
    expect(run({ actor: { ...agentA, uid: 'c' }, report: held, release: true, target: null })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(run({ report: { status: 'Pending Review' }, release: true, target: null })).toMatchObject({ outcome: 'deny', status: 409 });
  });
});

describe('"Të miat" in the report list', () => {
  const principal = { uid: 'a', role: 'agent', municipality: '', permissions: [] as string[] };
  const plan = (raw: Record<string, unknown>, who = principal) => {
    const parsed = parseReportListQuery(raw);
    if (parsed.ok === false) return parsed;
    return planReportQuery(parsed.query, who);
  };

  it('filters on the caller, never on a uid the client sends', () => {
    const result = plan({ assignee: 'me' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.where).toEqual([{ field: 'assignedToUid', op: '==', value: 'a' }]);
    expect(plan({ assignee: 'someone-else' })).toMatchObject({ ok: false, status: 400 });
  });

  it('combines with status, and has an index for it', () => {
    const result = plan({ assignee: 'me', status: 'unapproved' });
    expect(result.ok && result.plan.indexKey).toBe('assignedToUid+status');
    expect(REQUIRED_REPORT_INDEXES.some(f => [...f].sort().join('+') === 'assignedToUid+status')).toBe(true);
  });

  it('refuses combinations without an index, and municipalities', () => {
    expect(plan({ assignee: 'me', urgency: 'Kritike' })).toMatchObject({ ok: false, status: 400 });
    expect(plan({ assignee: 'me' }, { uid: 'k', role: 'municipality', municipality: 'Pejë', permissions: [] })).toMatchObject({ ok: false, status: 400 });
    expect(plan({ assignee: 'me' }, { ...principal, uid: undefined as unknown as string })).toMatchObject({ ok: false, status: 400 });
  });
});

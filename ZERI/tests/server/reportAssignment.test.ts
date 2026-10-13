import { describe, expect, it } from 'vitest';
import { decideAssignment, mayReadHandovers, parseHistoryQuery, type AssignmentInput } from '../../server/reportAssignment';
import { parseReportListQuery, planReportQuery, REQUIRED_REPORT_INDEXES } from '../../server/reportQuery';

const owner = { uid: 'owner', role: 'superadmin', permissions: [] as string[] };
const agentA = { uid: 'a', role: 'agent', permissions: [] as string[] };
const target = { uid: 'b', role: 'agent', permissions: [] as string[], disabled: false };
const run = (patch: Partial<AssignmentInput>) =>
  decideAssignment({ actor: owner, report: { status: 'Pending Review' }, target, release: false, ...patch });

describe('decideAssignment', () => {
  it('lets the owner hand a report in the queue to an agent', () => {
    expect(run({})).toEqual({ outcome: 'allow', kind: 'assign', reason: '' });
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
    expect(run({ actor: agentA, report: held, release: true, target: null })).toEqual({ outcome: 'allow', kind: 'release', reason: '' });
    expect(run({ report: held, release: true, target: null, reason: 'Agjenti është me pushim' })).toEqual({ outcome: 'allow', kind: 'release', reason: 'Agjenti është me pushim' });
    expect(run({ actor: { ...agentA, uid: 'c' }, report: held, release: true, target: null })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(run({ report: { status: 'Pending Review' }, release: true, target: null })).toMatchObject({ outcome: 'deny', status: 409 });
  });

  describe('handover accountability', () => {
    const held = { status: 'Pending Review', assignedToUid: 'a' };

    it('requires a reason to take work from another person, on reassign and on release', () => {
      expect(run({ report: held })).toMatchObject({ outcome: 'deny', status: 400 });
      expect(run({ report: held, reason: '   ' })).toMatchObject({ outcome: 'deny', status: 400 });
      expect(run({ report: held, reason: 'abc' })).toMatchObject({ outcome: 'deny', status: 400 });
      expect(run({ report: held, release: true, target: null })).toMatchObject({ outcome: 'deny', status: 400 });
      expect(run({ report: held, reason: ' Ngarkesa e agjentit A është e plotë ' })).toEqual({
        outcome: 'allow', kind: 'assign', reason: 'Ngarkesa e agjentit A është e plotë',
      });
    });

    it('does not ask for a reason when nobody loses the work', () => {
      expect(run({ report: { status: 'Pending Review' } })).toMatchObject({ outcome: 'allow' });
      expect(run({ actor: agentA, report: held, release: true, target: null })).toMatchObject({ outcome: 'allow' });
    });

    it('bounds the reason', () => {
      expect(run({ reason: 'x'.repeat(301) })).toMatchObject({ outcome: 'deny', status: 400 });
    });

    it('refuses when the holder changed since the caller looked (simultaneous assignment)', () => {
      expect(run({ report: { status: 'Pending Review', assignedToUid: 'z' }, expectedHolderUid: '', reason: 'Rast urgjent' }))
        .toMatchObject({ outcome: 'deny', status: 409 });
      expect(run({ report: { status: 'Pending Review' }, expectedHolderUid: 'a' })).toMatchObject({ outcome: 'deny', status: 409 });
      expect(run({ report: { status: 'Pending Review' }, expectedHolderUid: '' })).toMatchObject({ outcome: 'allow' });
      expect(run({ report: held, expectedHolderUid: 'a', reason: 'Rast urgjent' })).toMatchObject({ outcome: 'allow' });
    });
  });
});

describe('the dispatcher distributes work', () => {
  const dispatcher = { uid: 'd', role: 'dispatcher', permissions: [] as string[] };

  it('hands a front-of-queue report to an active agent, and moves it between people with a reason', () => {
    expect(run({ actor: dispatcher })).toEqual({ outcome: 'allow', kind: 'assign', reason: '' });
    const held = { status: 'Pending Review', assignedToUid: 'a' };
    expect(run({ actor: dispatcher, report: held })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ actor: dispatcher, report: held, reason: 'Ana është me leje' })).toMatchObject({ outcome: 'allow', kind: 'assign' });
    expect(run({ actor: dispatcher, report: held, release: true, target: null, reason: 'Rishpërndarje' })).toMatchObject({ outcome: 'allow', kind: 'release' });
  });

  it('keeps every other guard: eligible target, queue stage, stale changes', () => {
    expect(run({ actor: dispatcher, target: { ...target, disabled: true } })).toMatchObject({ outcome: 'deny', status: 409 });
    expect(run({ actor: dispatcher, target: { ...target, role: 'municipality' } })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ actor: dispatcher, target: { ...target, role: 'citizen' } })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ actor: dispatcher, report: { status: 'Approved' } })).toMatchObject({ outcome: 'deny', status: 409 });
    expect(run({ actor: dispatcher, report: { status: 'In Progress' } })).toMatchObject({ outcome: 'deny', status: 409 });
    expect(run({ actor: dispatcher, report: { status: 'Pending Review', assignedToUid: 'z' }, expectedHolderUid: '', reason: 'Rast urgjent' })).toMatchObject({ outcome: 'deny', status: 409 });
  });

  it('is the role, not a section grant: an agent with the agents permission still cannot assign others', () => {
    expect(run({ actor: { uid: 'x', role: 'agent', permissions: ['agents', 'monitorim', 'reports'] } })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(run({ actor: { uid: 'x', role: 'responder', permissions: [] } })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(run({ actor: { uid: 'x', role: 'moderator', permissions: [] } })).toMatchObject({ outcome: 'deny', status: 403 });
  });
});

describe('parseHistoryQuery', () => {
  it('defaults to 20, clamps to 50, and rejects nonsense', () => {
    expect(parseHistoryQuery({})).toEqual({ ok: true, limit: 20, before: '' });
    expect(parseHistoryQuery({ limit: '500' })).toMatchObject({ ok: true, limit: 50 });
    for (const bad of ['0', '-3', '2.5', 'x']) expect(parseHistoryQuery({ limit: bad }), bad).toMatchObject({ ok: false });
    expect(parseHistoryQuery({ before: 'yesterday' })).toMatchObject({ ok: false });
    expect(parseHistoryQuery({ before: '2026-01-01T00:00:00.000Z' })).toMatchObject({ ok: true, before: '2026-01-01T00:00:00.000Z' });
  });
});

describe('mayReadHandovers', () => {
  it('opens to staff, agents and the monitor only', () => {
    for (const role of ['superadmin', 'admin', 'agent', 'dispatcher', 'monitor']) {
      expect(mayReadHandovers({ role, permissions: [] }), role).toBe(true);
    }
    for (const role of ['municipality', 'citizen', 'newsadmin', '']) {
      expect(mayReadHandovers({ role, permissions: [] }), role).toBe(false);
    }
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

import { describe, expect, it } from 'vitest';
import { DEFAULT_SLA, dueAtFor, evaluateEscalations, raisePriority, type EscalatableItem } from '../../src/lib/workflow/escalation';
import { MIN_SAMPLE, measurePerformance, orderByPerformance, type FinishedWork } from '../../src/lib/workflow/performance';

const H = 3_600_000;
const T0 = Date.UTC(2026, 9, 14, 8, 0, 0);

const item = (over: Partial<EscalatableItem> = {}): EscalatableItem => ({
  id: 'w1', kind: 'internal_task', status: 'in_progress', priority: 'normal', assigneeUid: 'a',
  createdAtMs: T0, dueAtMs: T0 + 72 * H, lastActivityAtMs: T0, escalationLevel: 0, unassignedAlerts: 0, ...over,
});

describe('deadlines', () => {
  it('sets the due time from the priority', () => {
    expect(dueAtFor('urgent', T0)).toBe(T0 + 4 * H);
    expect(dueAtFor('low', T0)).toBe(T0 + 168 * H);
  });
  it('raises priority one step and stops at urgent', () => {
    expect(raisePriority('low')).toBe('normal');
    expect(raisePriority('high')).toBe('urgent');
    expect(raisePriority('urgent')).toBe('urgent');
  });
});

describe('overdue escalation', () => {
  it('does nothing before the deadline', () => {
    expect(evaluateEscalations(item({ lastActivityAtMs: T0 + 70 * H }), T0 + 71 * H)).toEqual([]);
  });

  it('fires the first rung as soon as the deadline passes, then the later ones as time goes on', () => {
    const due = T0 + 72 * H;
    const at = (hours: number) => evaluateEscalations(item({ lastActivityAtMs: due + hours * H - 1 }), due + hours * H + 1).filter(event => event.type === 'overdue').map(event => event.level);
    expect(at(0)).toEqual([1]);
    expect(at(25)).toEqual([1, 2]);
    expect(at(49)).toEqual([1, 2, 3]);
    expect(at(100)).toEqual([1, 2, 3, 4]);
  });

  it('is idempotent: the same moment gives the same keys, and a rung already applied is not repeated', () => {
    const now = T0 + 72 * H + 100 * H;
    const fresh = evaluateEscalations(item(), now).filter(event => event.type === 'overdue');
    const again = evaluateEscalations(item(), now).filter(event => event.type === 'overdue');
    expect(again.map(event => event.key)).toEqual(fresh.map(event => event.key));
    expect(fresh.map(event => event.key)).toEqual(['w1:overdue:1', 'w1:overdue:2', 'w1:overdue:3', 'w1:overdue:4']);
    const applied = evaluateEscalations(item({ escalationLevel: 2 }), now).filter(event => event.type === 'overdue');
    expect(applied.map(event => event.level)).toEqual([3, 4]);
  });

  it('does not escalate finished work', () => {
    expect(evaluateEscalations(item({ status: 'done' }), T0 + 500 * H)).toEqual([]);
    expect(evaluateEscalations(item({ status: 'cancelled' }), T0 + 500 * H)).toEqual([]);
  });

  it('pauses the assignee\'s clock while the work waits on someone else', () => {
    expect(evaluateEscalations(item({ status: 'blocked' }), T0 + 500 * H)).toEqual([]);
    expect(evaluateEscalations(item({ status: 'in_review' }), T0 + 500 * H)).toEqual([]);
  });

  it('maps rungs to the configured actions', () => {
    const actions = evaluateEscalations(item(), T0 + 72 * H + 100 * H).filter(event => event.type === 'overdue').map(event => event.action);
    expect(actions).toEqual(['notify_supervisor', 'raise_priority', 'notify_managers', 'needs_manager_attention']);
  });
});

describe('unassigned work', () => {
  const orphan = (over: Partial<EscalatableItem> = {}) => item({ status: 'unassigned', assigneeUid: null, priority: 'urgent', dueAtMs: null, ...over });

  it('alerts the supervisor once an urgent item has waited 15 minutes, and again each interval', () => {
    expect(evaluateEscalations(orphan(), T0 + 14 * 60_000)).toEqual([]);
    expect(evaluateEscalations(orphan(), T0 + 16 * 60_000).map(event => event.key)).toEqual(['w1:unassigned:1']);
    expect(evaluateEscalations(orphan({ unassignedAlerts: 1 }), T0 + 31 * 60_000).map(event => event.key)).toEqual(['w1:unassigned:2']);
  });

  it('stops after five alerts so a forgotten item does not flood anyone', () => {
    expect(evaluateEscalations(orphan(), T0 + 100 * H).filter(event => event.type === 'unassigned')).toHaveLength(5);
    expect(evaluateEscalations(orphan({ unassignedAlerts: 5 }), T0 + 100 * H)).toEqual([]);
  });

  it('uses the priority\'s own wait', () => {
    expect(evaluateEscalations(orphan({ priority: 'low' }), T0 + 23 * H)).toEqual([]);
    expect(evaluateEscalations(orphan({ priority: 'low' }), T0 + 25 * H)).toHaveLength(1);
  });

  it('applies to moderation cases and referrals in their own first state', () => {
    expect(evaluateEscalations(orphan({ kind: 'moderation_case', status: 'flagged' }), T0 + H).map(event => event.type)).toEqual(['unassigned', 'unassigned', 'unassigned', 'unassigned']);
    expect(evaluateEscalations(orphan({ kind: 'report_referral', status: 'pending_acceptance' }), T0 + 20 * 60_000)).toHaveLength(1);
  });
});

describe('stalled work', () => {
  it('flags held work with no activity, once per quiet period', () => {
    const quiet = item({ priority: 'high', dueAtMs: null, lastActivityAtMs: T0 });
    const events = evaluateEscalations(quiet, T0 + 25 * H);
    expect(events).toEqual([{ key: `w1:stalled:${T0}`, type: 'stalled', level: 1, action: 'notify_supervisor', itemId: 'w1' }]);
    expect(evaluateEscalations({ ...quiet, stalledReportedFor: T0 }, T0 + 40 * H)).toEqual([]);
    expect(evaluateEscalations({ ...quiet, lastActivityAtMs: T0 + 30 * H, stalledReportedFor: T0 }, T0 + 50 * H)).toEqual([]);
    expect(evaluateEscalations({ ...quiet, lastActivityAtMs: T0 + 30 * H, stalledReportedFor: T0 }, T0 + 80 * H)).toHaveLength(1);
  });
});

describe('the ladder is configurable', () => {
  it('uses the configuration it is given', () => {
    const strict = { ...DEFAULT_SLA, ladder: [{ level: 1, afterOverdueHours: 0, action: 'notify_managers' as const }] };
    expect(evaluateEscalations(item(), T0 + 100 * H, strict).filter(event => event.type === 'overdue')).toHaveLength(1);
  });
});

describe('performance is not a count of closed tasks', () => {
  const done = (over: Partial<FinishedWork> = {}): FinishedWork => ({ weight: 1, createdAtMs: T0, completedAtMs: T0 + 10 * H, dueAtMs: T0 + 24 * H, reworkCount: 0, reopenCount: 0, ...over });
  const many = (count: number, over: Partial<FinishedWork> = {}) => Array.from({ length: count }, () => done(over));

  it('rates a person who finishes fewer but heavier, clean, on-time tasks above one who closes many sloppy late ones', () => {
    const careful = measurePerformance({ finished: many(6, { weight: 3 }), open: [], nowMs: T0 + 100 * H });
    const sloppy = measurePerformance({
      finished: many(20, { completedAtMs: T0 + 48 * H, reworkCount: 2, reopenCount: 1 }),
      open: [{ weight: 1, dueAtMs: T0 }, { weight: 1, dueAtMs: T0 }],
      nowMs: T0 + 100 * H,
    });
    expect(sloppy.finishedCount).toBeGreaterThan(careful.finishedCount);
    expect(careful.index as number).toBeGreaterThan(sloppy.index as number);
  });

  it('counts weight, not items', () => {
    const light = measurePerformance({ finished: many(5), open: [], nowMs: T0 });
    const heavy = measurePerformance({ finished: many(5, { weight: 4 }), open: [], nowMs: T0 });
    expect(heavy.weightedOutput).toBe(20);
    expect(heavy.basis.throughput).toBeGreaterThan(light.basis.throughput);
  });

  it('reports each measure from the record', () => {
    const result = measurePerformance({
      finished: [done(), done({ completedAtMs: T0 + 30 * H }), done({ reworkCount: 1 }), done({ dueAtMs: null })],
      open: [{ weight: 1, dueAtMs: T0 + 1 }, { weight: 1, dueAtMs: T0 + 1000 * H }],
      nowMs: T0 + 5 * H,
    });
    expect(result.onTimeRate).toBeCloseTo(2 / 3, 2);
    expect(result.reworkRate).toBe(0.25);
    expect(result.overdueOpen).toBe(1);
    expect(result.avgCycleHours).toBeCloseTo(15, 0);
  });

  it('says so when there is too little to judge, and never ranks that above a solid record', () => {
    const lucky = { uid: 'lucky', performance: measurePerformance({ finished: many(1, { weight: 5 }), open: [], nowMs: T0 }) };
    const solid = { uid: 'solid', performance: measurePerformance({ finished: many(MIN_SAMPLE, { reworkCount: 1 }), open: [], nowMs: T0 }) };
    expect(lucky.performance.confidence).toBe('low');
    expect(solid.performance.confidence).toBe('ok');
    expect(orderByPerformance([lucky, solid]).map(row => row.uid)).toEqual(['solid', 'lucky']);
  });

  it('gives no score to someone who has finished nothing', () => {
    expect(measurePerformance({ finished: [], open: [], nowMs: T0 }).index).toBeNull();
  });
});

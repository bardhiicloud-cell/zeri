import { describe, expect, it } from 'vitest';
import { loadDeltas } from '../../src/lib/workflow/load';
import { summarizeOrganization, workloadState, type OrgItem, type OrgWorker } from '../../src/lib/workflow/workload';

const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);
const H = 3_600_000;

const worker = (uid: string, over: Partial<OrgWorker> = {}): OrgWorker => ({
  uid, name: uid, role: 'agent', municipality: 'Prishtinë', department: 'Infrastruktura', capacity: 10, load: 0, availability: 'available', disabled: false, ...over,
});
const item = (id: string, over: Partial<OrgItem> = {}): OrgItem => ({
  id, kind: 'internal_task', status: 'in_progress', priority: 'normal', assigneeUid: 'a', municipality: 'Prishtinë', dueAtMs: NOW + 24 * H, createdAtMs: NOW - H, needsAttention: false, ...over,
});

describe('workloadState', () => {
  it('uses the stated thresholds', () => {
    expect(workloadState(worker('a', { load: 10 }))).toBe('overloaded');
    expect(workloadState(worker('a', { load: 14 }))).toBe('overloaded');
    expect(workloadState(worker('a', { load: 8 }))).toBe('high');
    expect(workloadState(worker('a', { load: 5 }))).toBe('normal');
    expect(workloadState(worker('a', { load: 2 }))).toBe('under');
    expect(workloadState(worker('a', { load: 3 }))).toBe('normal');
  });
  it('treats absent, disabled and zero-capacity people as unavailable, not as idle', () => {
    expect(workloadState(worker('a', { availability: 'away' }))).toBe('unavailable');
    expect(workloadState(worker('a', { availability: 'off' }))).toBe('unavailable');
    expect(workloadState(worker('a', { disabled: true }))).toBe('unavailable');
    expect(workloadState(worker('a', { capacity: 0 }))).toBe('unavailable');
  });
});

describe('summarizeOrganization with hundreds of workers', () => {
  const workers: OrgWorker[] = Array.from({ length: 500 }, (_, index) => worker(`w${String(index).padStart(3, '0')}`, {
    municipality: ['Prishtinë', 'Prizren', 'Pejë', 'Gjilan', 'Ferizaj'][index % 5],
    department: ['Infrastruktura', 'Mjedisi', 'Shërbimet'][index % 3],
    capacity: 10,
    load: index % 20 === 0 ? 10 : index % 7 === 0 ? 1 : 5,
    availability: index % 50 === 0 ? 'off' : 'available',
  }));

  it('counts every person exactly once and the states add up', () => {
    const summary = summarizeOrganization([], workers, NOW);
    const w = summary.workforce;
    expect(w.total).toBe(500);
    expect(w.overloaded + w.high + w.normal + w.under + w.unavailable).toBe(500);
    expect(w.available + w.unavailable).toBe(500);
    expect(w.totalCapacity).toBe(5000);
  });

  it('names who is overloaded and who has room, worst and emptiest first, with a stable order', () => {
    const summary = summarizeOrganization([], workers, NOW);
    expect(summary.overloadedWorkers.length).toBeLessThanOrEqual(10);
    expect(summary.overloadedWorkers.every(entry => entry.load >= entry.capacity)).toBe(true);
    expect(summary.underusedWorkers.every(entry => entry.load / entry.capacity < 0.3)).toBe(true);
    expect(summarizeOrganization([], [...workers].reverse(), NOW).overloadedWorkers).toEqual(summary.overloadedWorkers);
  });

  it('reports queues, overdue work and what needs attention', () => {
    const items: OrgItem[] = [
      ...Array.from({ length: 40 }, (_, i) => item(`ok${i}`)),
      ...Array.from({ length: 6 }, (_, i) => item(`late${i}`, { dueAtMs: NOW - H, municipality: 'Pejë' })),
      ...Array.from({ length: 12 }, (_, i) => item(`free${i}`, { status: 'unassigned', assigneeUid: null, priority: 'urgent', createdAtMs: NOW - 2 * H })),
      item('att', { needsAttention: true }),
    ];
    const summary = summarizeOrganization(items, workers, NOW);
    expect(summary.items).toMatchObject({ open: 59, unassigned: 12, overdue: 6, needsAttention: 1 });
    expect(summary.items.byPriority.urgent).toBe(12);
    expect(summary.items.byStatus.unassigned).toBe(12);
    expect(summary.byMunicipality.find(row => row.municipality === 'Pejë')).toMatchObject({ overdue: 6 });
    expect(summary.byMunicipality[0].municipality).toBe('Pejë'); // most overdue first
  });

  it('finds bottlenecks by explicit rules, critical ones first, each with a sentence', () => {
    const items: OrgItem[] = [
      ...Array.from({ length: 12 }, (_, i) => item(`free${i}`, { status: 'unassigned', assigneeUid: null, priority: 'urgent', createdAtMs: NOW - 2 * H })),
      ...Array.from({ length: 11 }, (_, i) => item(`late${i}`, { dueAtMs: NOW - H, municipality: 'Prizren' })),
      ...Array.from({ length: 5 }, (_, i) => item(`rev${i}`, { status: 'in_review' })),
    ];
    const { bottlenecks } = summarizeOrganization(items, workers, NOW);
    const types = bottlenecks.map(entry => entry.type);
    expect(types).toContain('unassigned_waiting');
    expect(types).toContain('municipality_overdue');
    expect(types).toContain('review_backlog');
    expect(bottlenecks[0].severity).toBe('critical');
    expect(bottlenecks.every(entry => entry.detail.length > 10)).toBe(true);
    expect(bottlenecks.find(entry => entry.type === 'municipality_overdue')).toMatchObject({ key: 'Prizren', count: 11, severity: 'critical' });
  });

  it('says when nobody has a free place and work is waiting', () => {
    const full = Array.from({ length: 5 }, (_, i) => worker(`f${i}`, { load: 10 }));
    const waiting = [item('x', { status: 'unassigned', assigneeUid: null })];
    expect(summarizeOrganization(waiting, full, NOW).bottlenecks.map(entry => entry.type)).toContain('no_capacity');
    expect(summarizeOrganization(waiting, [worker('free')], NOW).bottlenecks.map(entry => entry.type)).not.toContain('no_capacity');
  });

  it('flags a team that is nearly full, but not a tiny one', () => {
    const team = Array.from({ length: 4 }, (_, i) => worker(`t${i}`, { department: 'Mjedisi', municipality: '', load: 9 }));
    expect(summarizeOrganization([], team, NOW).bottlenecks).toEqual([expect.objectContaining({ type: 'team_overloaded', key: 'Mjedisi' })]);
    expect(summarizeOrganization([], team.slice(0, 2), NOW).bottlenecks).toEqual([]);
  });

  it('is fast enough to compute on every request', () => {
    const items = Array.from({ length: 5000 }, (_, i) => item(`i${i}`, { assigneeUid: i % 9 === 0 ? null : 'a', dueAtMs: NOW + (i % 5 - 2) * H }));
    const started = Date.now();
    summarizeOrganization(items, workers, NOW);
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe('loadDeltas', () => {
  const base = { kind: 'internal_task' as const, weight: 3 };
  it('adds to the new holder when work becomes active', () => {
    expect([...loadDeltas({ ...base, fromStatus: 'unassigned', toStatus: 'assigned', fromAssignee: null, toAssignee: 'a' })]).toEqual([['a', 3]]);
  });
  it('is zero for the same person staying in active states', () => {
    expect(loadDeltas({ ...base, fromStatus: 'accepted', toStatus: 'in_progress', fromAssignee: 'a', toAssignee: 'a' }).size).toBe(0);
  });
  it('moves load from the old holder to the new one', () => {
    const deltas = loadDeltas({ ...base, fromStatus: 'in_progress', toStatus: 'assigned', fromAssignee: 'a', toAssignee: 'b' });
    expect(Object.fromEntries(deltas)).toEqual({ a: -3, b: 3 });
  });
  it('frees the place when work finishes, is cancelled or is declined', () => {
    expect(Object.fromEntries(loadDeltas({ ...base, fromStatus: 'in_review', toStatus: 'done', fromAssignee: 'a', toAssignee: 'a' }))).toEqual({ a: -3 });
    expect(Object.fromEntries(loadDeltas({ ...base, fromStatus: 'assigned', toStatus: 'unassigned', fromAssignee: 'a', toAssignee: null }))).toEqual({ a: -3 });
  });
  it('restores the place when finished work is reopened', () => {
    expect(Object.fromEntries(loadDeltas({ ...base, fromStatus: 'done', toStatus: 'in_progress', fromAssignee: 'a', toAssignee: 'a' }))).toEqual({ a: 3 });
  });
});

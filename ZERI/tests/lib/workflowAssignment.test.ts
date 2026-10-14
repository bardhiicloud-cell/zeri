import { describe, expect, it } from 'vitest';
import { chooseWorker, distribute, isWithinSchedule, mayRecalculate, type AssignableItem, type Worker } from '../../src/lib/workflow/assignment';

// Wednesday 14 Oct 2026, 11:00 in Pristina (CEST, UTC+2).
const NOW = Date.UTC(2026, 9, 14, 9, 0, 0);

const worker = (uid: string, over: Partial<Worker> = {}): Worker => ({
  uid, role: 'agent', skills: [], capacity: 5, load: 0, availability: 'available', ...over,
});
const task = (id: string, over: Partial<AssignableItem> = {}): AssignableItem => ({ id, kind: 'internal_task', priority: 'normal', ...over });

describe('chooseWorker: who is never chosen', () => {
  const cases: Array<[string, Worker, AssignableItem]> = [
    ['disabled', worker('w', { disabled: true }), task('t')],
    ['role', worker('w', { role: 'citizen' }), task('t')],
    ['municipality', worker('w', { role: 'municipality', municipality: 'Pejë' }), task('t', { municipality: 'Gjilan', kind: 'report_referral' })],
    ['department', worker('w', { department: 'Infrastruktura' }), task('t', { department: 'Arsimi' })],
    ['skill', worker('w', { skills: ['gis'] }), task('t', { requiredSkills: ['gis', 'inspektim'] })],
    ['unavailable', worker('w', { availability: 'away' }), task('t')],
    ['off_hours', worker('w', { schedule: { days: [0], start: '08:00', end: '16:00' } }), task('t')],
    ['capacity', worker('w', { capacity: 3, load: 3 }), task('t')],
    ['excluded', worker('w'), task('t', { excludeUids: ['w'] })],
  ];
  for (const [reason, candidate, item] of cases) {
    it(`rules out a worker for: ${reason}`, () => {
      const result = chooseWorker(item, [candidate], NOW);
      expect(result.outcome).toBe('unassigned');
      expect(result.outcome === 'unassigned' && result.rejectedBy[reason as keyof typeof result.rejectedBy]).toBe(1);
    });
  }

  it('does not fit a heavy item into the last free place', () => {
    expect(chooseWorker(task('t', { weight: 3 }), [worker('w', { capacity: 5, load: 3 })], NOW).outcome).toBe('unassigned');
    expect(chooseWorker(task('t', { weight: 2 }), [worker('w', { capacity: 5, load: 3 })], NOW).outcome).toBe('assigned');
  });

  it('never gives a municipality worker work from another municipality', () => {
    const pej = worker('peja', { role: 'municipality', municipality: 'Pejë' });
    const gji = worker('gjilan', { role: 'municipality', municipality: 'Gjilan' });
    const result = chooseWorker(task('t', { kind: 'report_referral', municipality: 'Pejë' }), [gji, pej], NOW);
    expect(result).toMatchObject({ outcome: 'assigned', uid: 'peja' });
  });

  it('keeps moderation cases with moderators', () => {
    const result = chooseWorker(task('c', { kind: 'moderation_case' }), [worker('a'), worker('m', { role: 'debatwp' })], NOW);
    expect(result).toMatchObject({ outcome: 'assigned', uid: 'm' });
  });
});

describe('chooseWorker: who is chosen, and why', () => {
  it('reports unassigned, with the reasons counted, rather than picking an unsuitable person', () => {
    const result = chooseWorker(task('t', { requiredSkills: ['gis'] }), [worker('a'), worker('b', { skills: ['gis'], availability: 'off' }), worker('c', { skills: ['gis'], load: 5 })], NOW);
    expect(result).toMatchObject({ outcome: 'unassigned', reason: 'no_eligible_worker', rejectedBy: { skill: 1, unavailable: 1, capacity: 1 } });
  });

  it('prefers the person with the most room', () => {
    const result = chooseWorker(task('t'), [worker('busy', { load: 4 }), worker('free', { load: 0 }), worker('some', { load: 2 })], NOW);
    expect(result).toMatchObject({ outcome: 'assigned', uid: 'free' });
  });

  it('prefers matching skills when room is equal', () => {
    const result = chooseWorker(task('t', { preferredSkills: ['rrugë', 'gis'] }), [worker('plain'), worker('skilled', { skills: ['Rrugë', 'GIS'] })], NOW);
    expect(result).toMatchObject({ outcome: 'assigned', uid: 'skilled' });
  });

  it('keeps related work with the same person', () => {
    const result = chooseWorker(task('t', { continuityUid: 'old-hand' }), [worker('a'), worker('old-hand', { load: 1 }), worker('b')], NOW);
    expect(result).toMatchObject({ outcome: 'assigned', uid: 'old-hand' });
  });

  it('spreads work: the person given work longest ago goes first among equals', () => {
    const result = chooseWorker(task('t'), [
      worker('recent', { lastAssignedAtMs: NOW - 1_000 }),
      worker('longago', { lastAssignedAtMs: NOW - 9_000_000 }),
      worker('never', { lastAssignedAtMs: null }),
    ], NOW);
    expect(result).toMatchObject({ outcome: 'assigned', uid: 'never' });
  });

  it('is deterministic: the order the workers arrive in changes nothing', () => {
    const pool = Array.from({ length: 30 }, (_, index) => worker(`w${String(index).padStart(2, '0')}`, { load: index % 3 }));
    const first = chooseWorker(task('t'), pool, NOW);
    const second = chooseWorker(task('t'), [...pool].reverse(), NOW);
    const third = chooseWorker(task('t'), [...pool.slice(10), ...pool.slice(0, 10)], NOW);
    expect(second).toMatchObject({ outcome: 'assigned', uid: (first as { uid: string }).uid });
    expect(third).toMatchObject({ outcome: 'assigned', uid: (first as { uid: string }).uid });
  });

  it('breaks an exact tie by user id so the answer can be reproduced', () => {
    const result = chooseWorker(task('t'), [worker('b'), worker('a'), worker('c')], NOW);
    expect(result).toMatchObject({ outcome: 'assigned', uid: 'a' });
  });

  it('explains the score and lists everyone it considered', () => {
    const result = chooseWorker(task('t', { priority: 'urgent' }), [worker('a'), worker('b', { disabled: true })], NOW);
    expect(result.outcome).toBe('assigned');
    if (result.outcome === 'assigned') {
      expect(result.score.total).toBeCloseTo(result.score.headroom + result.score.skills + result.score.continuity + result.score.fairness + result.score.urgency, 1);
      expect(result.considered).toEqual(expect.arrayContaining([
        expect.objectContaining({ uid: 'b', eligible: false, rejected: 'disabled' }),
        expect.objectContaining({ uid: 'a', eligible: true }),
      ]));
    }
  });
});

describe('working hours', () => {
  const office = { days: [1, 2, 3, 4, 5], start: '08:00', end: '16:00' };
  it('is on during office hours in Pristina time and off outside them', () => {
    expect(isWithinSchedule(office, NOW)).toBe(true);                              // Wed 11:00
    expect(isWithinSchedule(office, Date.UTC(2026, 9, 14, 14, 30))).toBe(false);   // Wed 16:30
    expect(isWithinSchedule(office, Date.UTC(2026, 9, 14, 5, 59))).toBe(false);    // Wed 07:59
    expect(isWithinSchedule(office, Date.UTC(2026, 9, 18, 9, 0))).toBe(false);     // Sunday
    expect(isWithinSchedule(undefined, Date.UTC(2026, 9, 18, 2, 0))).toBe(true);   // no schedule: always
  });
});

describe('distribute: hundreds of workers, a thousand items', () => {
  const workers = Array.from({ length: 300 }, (_, index) => worker(`w${String(index).padStart(3, '0')}`, {
    capacity: 5,
    skills: index % 10 === 0 ? ['gis'] : [],
    municipality: ['Pejë', 'Gjilan', 'Prizren'][index % 3],
    availability: index % 25 === 0 ? 'off' : 'available',
  }));
  const items = Array.from({ length: 900 }, (_, index) => task(`t${String(index).padStart(4, '0')}`, {
    priority: (['low', 'normal', 'high', 'urgent'] as const)[index % 4],
    requiredSkills: index % 30 === 0 ? ['gis'] : [],
  }));

  it('never exceeds anyone\'s capacity and never gives work to an unavailable person', () => {
    const result = distribute(items, workers, NOW);
    for (const w of result.workers) expect(w.load, w.uid).toBeLessThanOrEqual(w.capacity);
    const off = new Set(workers.filter(w => w.availability === 'off').map(w => w.uid));
    expect(result.assigned.every(entry => !off.has(entry.uid))).toBe(true);
    expect(result.assigned.length + result.unassigned.length).toBe(items.length);
  });

  it('gives work only to people with the required skill, and assigns each item once', () => {
    const result = distribute(items, workers, NOW);
    const skilled = new Set(workers.filter(w => w.skills.includes('gis')).map(w => w.uid));
    const needsGis = new Set(items.filter(item => item.requiredSkills?.length).map(item => item.id));
    for (const entry of result.assigned) if (needsGis.has(entry.itemId)) expect(skilled.has(entry.uid)).toBe(true);
    expect(new Set(result.assigned.map(entry => entry.itemId)).size).toBe(result.assigned.length);
  });

  it('spreads the load instead of piling it on a few', () => {
    const result = distribute(items.filter(item => !item.requiredSkills?.length), workers, NOW);
    const loads = result.workers.filter(w => w.availability === 'available').map(w => w.load);
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(2);
  });

  it('leaves the rest unassigned, with reasons, when capacity runs out', () => {
    const tooMany = Array.from({ length: 2000 }, (_, index) => task(`x${String(index).padStart(4, '0')}`));
    const result = distribute(tooMany, workers, NOW);
    const room = workers.filter(w => w.availability === 'available').length * 5;
    expect(result.assigned.length).toBe(room);
    expect(result.unassigned.length).toBe(2000 - room);
    expect(result.unassigned[0].rejectedBy).toMatchObject({ capacity: expect.any(Number) });
  });

  it('is reproducible: the same batch gives the same assignments', () => {
    const first = distribute(items, workers, NOW);
    const second = distribute([...items].reverse(), [...workers].reverse(), NOW);
    expect(second.assigned.map(entry => `${entry.itemId}:${entry.uid}`).sort()).toEqual(first.assigned.map(entry => `${entry.itemId}:${entry.uid}`).sort());
  });

  it('serves urgent work first when capacity is short', () => {
    const few = [worker('only', { capacity: 2 })];
    const result = distribute([task('low1', { priority: 'low' }), task('urgent1', { priority: 'urgent' }), task('normal1'), task('urgent2', { priority: 'urgent' })], few, NOW);
    expect(result.assigned.map(entry => entry.itemId)).toEqual(['urgent1', 'urgent2']);
  });
});

describe('when work may move', () => {
  it('does not move work that someone has accepted or is doing', () => {
    expect(mayRecalculate({ kind: 'internal_task', status: 'accepted' }, { disabled: false, availability: 'available' })).toBe(false);
    expect(mayRecalculate({ kind: 'internal_task', status: 'in_progress' }, { disabled: false, availability: 'off' })).toBe(false);
  });
  it('may move work nobody holds, or whose holder is gone', () => {
    expect(mayRecalculate({ kind: 'internal_task', status: 'unassigned' }, null)).toBe(true);
    expect(mayRecalculate({ kind: 'internal_task', status: 'in_progress' }, { disabled: true, availability: 'available' })).toBe(true);
    expect(mayRecalculate({ kind: 'internal_task', status: 'assigned' }, { disabled: false, availability: 'off' })).toBe(true);
  });
});

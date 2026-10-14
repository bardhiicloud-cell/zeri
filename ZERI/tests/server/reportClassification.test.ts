import { describe, expect, it } from 'vitest';
import { MAX_BATCH, decideClassification } from '../../server/reportClassification';

const staff = { uid: 'u1', role: 'admin', municipality: '', permissions: [] as string[] };
const agent = { uid: 'u2', role: 'agent', municipality: '', permissions: [] as string[] };
const prishtina = { uid: 'u3', role: 'municipality', municipality: 'Prishtinë', permissions: [] as string[] };
const citizen = { uid: 'u4', role: 'citizen', municipality: '', permissions: [] as string[] };

const found = [
  { id: 'a', municipality: 'Prishtinë' },
  { id: 'b', municipality: 'Prishtinë' },
  { id: 'c', municipality: 'Pejë' },
];

describe('decideClassification', () => {
  it('lets staff set category, municipality and zone together', () => {
    const decision = decideClassification({ actor: staff, ids: ['a', 'c'], change: { topicCategory: 'infrastrukture', municipality: 'Gjilan', zone: 'urban' }, found });
    expect(decision).toEqual({ outcome: 'allow', ids: ['a', 'c'], patch: { topicCategory: 'infrastrukture', municipality: 'Gjilan', zone: 'urban' } });
  });

  it('lets an agent classify too', () => {
    expect(decideClassification({ actor: agent, ids: ['a'], change: { zone: 'rural' }, found }).outcome).toBe('allow');
  });

  it('refuses a citizen', () => {
    const decision = decideClassification({ actor: citizen, ids: ['a'], change: { zone: 'urban' }, found });
    expect(decision).toMatchObject({ outcome: 'deny', status: 403 });
  });

  it('lets a municipality set category and zone on its own reports', () => {
    expect(decideClassification({ actor: prishtina, ids: ['a', 'b'], change: { topicCategory: 'rruge', zone: 'urban' }, found }).outcome).toBe('allow');
  });

  it('refuses a municipality moving a report to another municipality', () => {
    expect(decideClassification({ actor: prishtina, ids: ['a'], change: { municipality: 'Pejë' }, found })).toMatchObject({ outcome: 'deny', status: 403 });
  });

  it("answers 'not found' when a municipality selects another municipality's report", () => {
    expect(decideClassification({ actor: prishtina, ids: ['a', 'c'], change: { zone: 'urban' }, found })).toMatchObject({ outcome: 'deny', status: 404 });
  });

  it('rejects an unknown category, municipality or zone', () => {
    expect(decideClassification({ actor: staff, ids: ['a'], change: { topicCategory: 'nuk-ekziston' }, found })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(decideClassification({ actor: staff, ids: ['a'], change: { municipality: 'Atlantida' }, found })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(decideClassification({ actor: staff, ids: ['a'], change: { zone: 'suburban' }, found })).toMatchObject({ outcome: 'deny', status: 400 });
  });

  it('needs at least one thing to change and at least one report', () => {
    expect(decideClassification({ actor: staff, ids: ['a'], change: {}, found })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(decideClassification({ actor: staff, ids: [], change: { zone: 'urban' }, found })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(decideClassification({ actor: staff, ids: 'a', change: { zone: 'urban' }, found })).toMatchObject({ outcome: 'deny', status: 400 });
  });

  it('refuses when a selected report does not exist', () => {
    expect(decideClassification({ actor: staff, ids: ['a', 'zzz'], change: { zone: 'urban' }, found })).toMatchObject({ outcome: 'deny', status: 404 });
  });

  it('caps the batch and ignores duplicate ids', () => {
    const many = Array.from({ length: MAX_BATCH + 1 }, (_, index) => `r${index}`);
    expect(decideClassification({ actor: staff, ids: many, change: { zone: 'urban' }, found })).toMatchObject({ outcome: 'deny', status: 400 });
    const decision = decideClassification({ actor: staff, ids: ['a', 'a', ' a '], change: { zone: 'urban' }, found });
    expect(decision).toMatchObject({ outcome: 'allow', ids: ['a'] });
  });
});

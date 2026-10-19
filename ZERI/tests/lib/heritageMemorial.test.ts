import { describe, expect, it } from 'vitest';
import { LEGENDARY_FAMILIES, LIBERATION_POINTS, MARTYRS, PLACES, ageAtDeath, formatMemorialDate } from '../../src/lib/heritage/memorial';

const DATE = /^\d{4}(-\d{2}-\d{2})?$/;

describe('the martyrs register', () => {
  it('has unique ids, valid dates in order, and a source for every name', () => {
    const ids = new Set<string>();
    for (const m of MARTYRS) {
      expect(ids.has(m.id), m.id).toBe(false);
      ids.add(m.id);
      expect(m.died, m.id).toMatch(DATE);
      if (m.born) {
        expect(m.born, m.id).toMatch(DATE);
        expect(m.born < m.died, m.id).toBe(true);
      }
      expect(m.source, m.id).toMatch(/^https:\/\//);
      expect(m.role.sq.length, m.id).toBeGreaterThan(10);
      expect(m.role.en.length, m.id).toBeGreaterThan(10);
    }
  });

  it('every family member is in the register', () => {
    const ids = new Set(MARTYRS.map(m => m.id));
    for (const f of LEGENDARY_FAMILIES) for (const id of f.members) expect(ids.has(id), `${f.id}:${id}`).toBe(true);
  });

  it('every liberation point and place is complete in both languages', () => {
    for (const p of LIBERATION_POINTS) { expect(p.source).toMatch(/^https:\/\//); expect(p.body.sq && p.body.en).toBeTruthy(); }
    expect(new Set(PLACES.map(p => p.id)).size).toBe(PLACES.length);
    for (const p of PLACES) expect(p.body.sq && p.body.en).toBeTruthy();
  });

  it('formats dates and ages', () => {
    expect(formatMemorialDate('1955-11-28')).toBe('28.11.1955');
    expect(formatMemorialDate('1971')).toBe('1971');
    expect(formatMemorialDate()).toBe('—');
    expect(ageAtDeath('1955-11-28', '1998-03-07')).toBe(42);
    expect(ageAtDeath('1971', '1998-05-07')).toBeNull();
  });
});

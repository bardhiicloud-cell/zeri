import { describe, expect, it } from 'vitest';
import { postDateLabel, postMillis } from '../../src/lib/postDate';

describe('post date', () => {
  it('reads a Firestore Timestamp, a Date, a number and an ISO string', () => {
    expect(postMillis({ toMillis: () => 5 })).toBe(5);
    expect(postMillis(new Date(7))).toBe(7);
    expect(postMillis(9)).toBe(9);
    expect(postMillis('2026-10-15T12:00:00Z')).toBe(Date.parse('2026-10-15T12:00:00Z'));
  });

  it('has no time for a post still waiting for the server clock', () => {
    expect(postMillis(null)).toBeNull();
    expect(postMillis(undefined)).toBeNull();
    expect(postMillis('not a date')).toBeNull();
    expect(postDateLabel(null)).toBe('Tani');
  });

  it('never prints Invalid Date', () => {
    for (const v of [{ toMillis: () => Date.parse('2026-10-15T12:00:00Z') }, '2026-10-15T12:00:00Z', null, 'x', {}]) {
      expect(postDateLabel(v)).not.toMatch(/invalid/i);
    }
  });
});

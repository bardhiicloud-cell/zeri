import { describe, expect, it } from 'vitest';
import { formatTrackingId, reserveTrackingId } from '../../server/trackingIds';

function fakeDb(taken: Set<string>) {
  return {
    collection: () => ({
      doc: (id: string) => ({
        create: async () => {
          if (taken.has(id)) throw Object.assign(new Error('exists'), { code: 6 });
          taken.add(id);
        },
      }),
    }),
  } as any;
}

describe('reserveTrackingId', () => {
  const now = Date.UTC(2026, 9, 16);
  it('formats ZQ-YYYYMMDD-...', () => {
    expect(formatTrackingId('ZQ', now, 'abcd1234')).toMatch(/^ZQ-20261016-[A-Z0-9]+ABCD1234$/);
  });
  it('retries on a collision and never returns an id twice', async () => {
    const taken = new Set<string>([formatTrackingId('ZQ', now, 'aaaaaaaa')]);
    const seq = ['aaaaaaaa', 'bbbbbbbb'];
    const id = await reserveTrackingId(fakeDb(taken), { prefix: 'ZQ', kind: 'report', ownerUid: 'u', nowMs: now, randomHex: () => seq.shift()! });
    expect(id.endsWith('BBBBBBBB')).toBe(true);
    expect(taken.size).toBe(2);
  });
});

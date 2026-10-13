import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/firebase', () => ({ db: {} }));
vi.mock('../../src/lib/apiAuth', () => ({ authHeaders: async (h: Record<string, string>) => h }));

const { deserializePost, mergePostSources, millisOf } = await import('../../src/lib/useForumFeed');
const { Timestamp } = await import('firebase/firestore');

const ts = (ms: number) => Timestamp.fromMillis(ms);
const post = (id: string, ms: number, extra: Record<string, unknown> = {}) => ({ id, createdAt: ts(ms), ...extra });

describe('mergePostSources', () => {
  it('de-duplicates by id (later sources win) and orders newest first', () => {
    const merged = mergePostSources(
      [post('a', 100, { content: 'old copy' }), post('b', 300)],
      [post('a', 100, { content: 'fresh copy' }), post('c', 200)],
    );
    expect(merged.map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect((merged.find((p) => p.id === 'a') as any).content).toBe('fresh copy');
  });

  it('handles empty sources and posts without a timestamp', () => {
    expect(mergePostSources([], [])).toEqual([]);
    expect(mergePostSources([{ id: 'x' }, post('y', 5)]).map((p) => p.id)).toEqual(['y', 'x']);
  });

  it('keeps my private post even when the public feed does not contain it', () => {
    const merged = mergePostSources([post('pub', 100)], [post('mine-private', 200)]);
    expect(merged.map((p) => p.id)).toEqual(['mine-private', 'pub']);
  });
});

describe('deserializePost', () => {
  it('rebuilds timestamps from the server markers and leaves everything else alone', () => {
    const p = deserializePost<any>({ id: 'p1', data: { content: 'hi', likes: ['a'], createdAt: { __ms: 5000 }, editedAt: { __ms: 6000 }, nested: { x: 1 } } });
    expect(p.id).toBe('p1');
    expect(millisOf(p.createdAt)).toBe(5000);
    expect(millisOf(p.editedAt)).toBe(6000);
    expect(p.likes).toEqual(['a']);
    expect(p.nested).toEqual({ x: 1 });
  });

  it('tolerates missing data and null values', () => {
    expect(deserializePost<any>({ id: 'p2', data: undefined as any })).toEqual({ id: 'p2' });
    expect(deserializePost<any>({ id: 'p3', data: { a: null } }).a).toBeNull();
  });
});

describe('millisOf', () => {
  it('is 0 for anything that is not a timestamp', () => {
    expect(millisOf(undefined)).toBe(0);
    expect(millisOf('x')).toBe(0);
    expect(millisOf(ts(7))).toBe(7);
  });
});

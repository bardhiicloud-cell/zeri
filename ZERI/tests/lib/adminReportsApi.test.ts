import { describe, expect, it } from 'vitest';
import { looksLikeCode, mergePages } from '../../src/lib/adminReportsApi';
import type { Report } from '../../src/types';

const r = (id: string) => ({ id, title: id }) as unknown as Report;

describe('mergePages', () => {
  it('appends a new page in order', () => {
    expect(mergePages([r('a'), r('b')], [r('c')]).map(x => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('drops reports already present, which happens when a refresh overlaps a page', () => {
    expect(mergePages([r('a'), r('b')], [r('b'), r('c')]).map(x => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate its inputs', () => {
    const current = [r('a')];
    mergePages(current, [r('b')]);
    expect(current).toHaveLength(1);
  });
});

describe('looksLikeCode', () => {
  it('recognises tracking codes and ids', () => {
    for (const text of ['ZQ-1042', 'zq-abc12', 'ZQ_7788', 'a1B2c3D4e5F6', ' ZQ-1042 ']) {
      expect(looksLikeCode(text), text).toBe(true);
    }
  });

  it('treats ordinary words and sentences as text', () => {
    for (const text of ['gropa', 'gropa në rrugë', 'prishtine', 'Prishtinë', 'ndriçim', '12', '', 'ab']) {
      expect(looksLikeCode(text), text).toBe(false);
    }
  });
});

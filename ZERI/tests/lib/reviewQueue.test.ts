import { describe, expect, it } from 'vitest';
import { advanceAfterAction, clampPhotoIndex, reviewProgress, stepIndex } from '../../src/lib/reviewQueue';

const ids = ['a', 'b', 'c', 'd'];

describe('stepIndex', () => {
  it('moves forward and back through the list', () => {
    expect(stepIndex(ids, new Set(), 0, 1)).toBe(1);
    expect(stepIndex(ids, new Set(), 2, -1)).toBe(1);
  });

  it('stops at the ends instead of wrapping', () => {
    expect(stepIndex(ids, new Set(), 3, 1)).toBeNull();
    expect(stepIndex(ids, new Set(), 0, -1)).toBeNull();
  });

  it('skips handled records going forward, but not going back when asked', () => {
    expect(stepIndex(ids, new Set(['b']), 0, 1)).toBe(2);
    expect(stepIndex(ids, new Set(['b']), 2, -1, false)).toBe(1);
  });

  it('handles an empty list', () => {
    expect(stepIndex([], new Set(), 0, 1)).toBeNull();
  });
});

describe('advanceAfterAction', () => {
  it('goes to the next unhandled record', () => {
    expect(advanceAfterAction(ids, new Set(['a']), 0)).toBe(1);
  });

  it('wraps once to pick up records that were skipped earlier', () => {
    expect(advanceAfterAction(ids, new Set(['c', 'd']), 3)).toBe(0);
    expect(advanceAfterAction(ids, new Set(['a', 'c', 'd']), 3)).toBe(1);
  });

  it('returns null when everything is handled', () => {
    expect(advanceAfterAction(ids, new Set(ids), 3)).toBeNull();
  });

  it('does not send the reviewer back to the record they are on', () => {
    expect(advanceAfterAction(['a'], new Set(), 0)).toBeNull();
  });
});

describe('reviewProgress', () => {
  it('counts only ids that are in the queue', () => {
    expect(reviewProgress(ids, new Set(['a', 'zzz']))).toEqual({ total: 4, handled: 1, remaining: 3, percent: 25 });
  });

  it('reads 100 for an empty queue', () => {
    expect(reviewProgress([], new Set()).percent).toBe(100);
  });
});

describe('clampPhotoIndex', () => {
  it('stays inside the photos', () => {
    expect(clampPhotoIndex(5, 3)).toBe(2);
    expect(clampPhotoIndex(-1, 3)).toBe(0);
    expect(clampPhotoIndex(1, 0)).toBe(0);
  });
});

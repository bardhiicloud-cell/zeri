import { describe, expect, it } from 'vitest';
import { HIDE_AUTHOR_BELOW, applySignal, emptyProfile, loadProfile, rankReels, saveProfile, scoreReel } from '../../src/lib/reelInterest';

const NOW = Date.UTC(2026, 9, 13, 12);
const H = 3_600_000;
const reel = (id: string, authorId: string, hashtags: string[] = [], ageHours = 1, likes = 0) => ({
  id, authorId, hashtags, likedBy: Array.from({ length: likes }, (_, i) => `u${i}`), createdAtMs: NOW - ageHours * H,
});

describe('applySignal', () => {
  it('raises author and hashtag affinity on a like, without changing the old profile', () => {
    const base = emptyProfile();
    const next = applySignal(base, reel('r', 'a', ['rruga', 'kosova']), 'like', NOW);
    expect(next.authors.a).toBe(3);
    expect(next.tags).toMatchObject({ rruga: 1.5, kosova: 1.5 });
    expect(base.authors).toEqual({});
  });

  it('remembers "not interested" once and lowers the author and tags', () => {
    let p = applySignal(emptyProfile(), reel('r', 'a', ['x']), 'not_interested', NOW);
    p = applySignal(p, reel('r', 'a', ['x']), 'not_interested', NOW);
    expect(p.notInterested).toEqual(['r']);
    expect(p.authors.a).toBe(-6);
    expect(p.tags.x).toBe(-3);
  });
});

describe('rankReels', () => {
  it('puts liked authors and tags ahead of slightly newer neutral Reels', () => {
    let p = applySignal(emptyProfile(), reel('seed', 'fav', ['sport']), 'like', NOW);
    p = applySignal(p, reel('seed2', 'fav', ['sport']), 'like', NOW);
    const ranked = rankReels([reel('new', 'x', [], 1), reel('fav1', 'fav', ['sport'], 20), reel('tag', 'y', ['sport'], 3)], p, NOW);
    expect(ranked.map((r) => r.id)).toEqual(['fav1', 'tag', 'new']);
  });

  it('keeps the original newest-first order when nothing is known', () => {
    const list = [reel('a', '1', [], 1), reel('b', '2', [], 1), reel('c', '3', [], 1)];
    expect(rankReels(list, emptyProfile(), NOW).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('drops reels marked not interested and authors the person turned away from', () => {
    let p = emptyProfile();
    p = applySignal(p, reel('gone', 'bad', []), 'not_interested', NOW); // -3
    expect(rankReels([reel('gone', 'bad'), reel('other', 'bad'), reel('ok', 'fine')], p, NOW).map((r) => r.id)).toEqual(['ok', 'other']); // the author is down-ranked but not yet hidden
    p = applySignal(p, reel('gone2', 'bad', []), 'not_interested', NOW); // -6 <= threshold
    expect(p.authors.bad).toBeLessThanOrEqual(HIDE_AUTHOR_BELOW);
    expect(rankReels([reel('other', 'bad'), reel('ok', 'fine')], p, NOW).map((r) => r.id)).toEqual(['ok']);
  });

  it('lets a very old Reel from a liked author still lose to a fresh one when affinity is small', () => {
    const p = applySignal(emptyProfile(), reel('s', 'a', []), 'watch', NOW); // +0.5
    expect(scoreReel(reel('fresh', 'b', [], 1), p, NOW)).toBeGreaterThan(scoreReel(reel('old', 'a', [], 24 * 30), p, NOW));
  });
});

describe('profile storage', () => {
  const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

  it('round-trips per account and shrugs off corrupt data', () => {
    const store = memory();
    const p = applySignal(emptyProfile(), reel('r', 'a', ['t']), 'like', NOW);
    saveProfile('me', p, store);
    expect(loadProfile('me', store).authors.a).toBe(3);
    expect(loadProfile('you', store)).toEqual(emptyProfile());
    store.setItem('zeri_reel_interest_v1:me', '{oops');
    expect(loadProfile('me', store)).toEqual(emptyProfile());
    store.setItem('zeri_reel_interest_v1:me', JSON.stringify({ authors: { a: 'x', b: 2 }, tags: null, notInterested: [1, 'z'] }));
    expect(loadProfile('me', store)).toMatchObject({ authors: { b: 2 }, tags: {}, notInterested: ['z'] });
  });
});

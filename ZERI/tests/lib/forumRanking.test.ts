import { describe, expect, it } from 'vitest';
import {
  BOOSTS,
  engagementPoints,
  isTickActive,
  rankForYou,
  scorePost,
  type RankablePost,
} from '../../src/lib/forumRanking';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const post = (over: Partial<RankablePost> = {}): RankablePost => ({
  id: 'p',
  authorId: 'a',
  content: 'Një debat i gjatë mjaftueshëm për komunën',
  likes: [],
  comments: [],
  reposts: [],
  createdAt: hoursAgo(1),
  ...over,
});

describe('engagement points', () => {
  it('weights replies and reposts above likes', () => {
    expect(engagementPoints(post({ likes: ['x'] }))).toBe(2);
    expect(engagementPoints(post({ comments: [{}] }))).toBe(3);
    expect(engagementPoints(post({ reposts: ['x'] }))).toBe(4);
  });

  it('counts reactions and poll votes', () => {
    const p = post({ reactions: { '🔥': ['a', 'b'] }, poll: { options: [{ votes: 3 }, { votes: ['x', 'y'] }] } });
    expect(engagementPoints(p)).toBe(2 + 3 + 2);
  });
});

describe('scoring', () => {
  it('decays with age', () => {
    const fresh = scorePost(post({ likes: ['x'], createdAt: hoursAgo(1) }), { now: NOW });
    const old = scorePost(post({ likes: ['x'], createdAt: hoursAgo(48) }), { now: NOW });
    expect(fresh).toBeGreaterThan(old * 4);
  });

  it('gives an unreacted new post a chance (non-zero floor)', () => {
    expect(scorePost(post(), { now: NOW })).toBeGreaterThan(0);
  });

  it('boosts followed authors, same municipality and verified accounts', () => {
    const base = scorePost(post(), { now: NOW });
    expect(scorePost(post(), { now: NOW, followedIds: ['a'] })).toBeCloseTo(base * BOOSTS.followed);
    expect(scorePost(post({ neighborhood: 'Prizren' }), { now: NOW, municipality: 'Prizren' })).toBeCloseTo(base * BOOSTS.sameMunicipality);
    expect(scorePost(post(), { now: NOW, verifiedIds: ['a'] })).toBeCloseTo(base * BOOSTS.verified);
  });

  it('keeps the verified boost modest: a strong post from an unverified author still wins', () => {
    const strong = post({ id: 'strong', authorId: 'u', likes: Array(30).fill('x') });
    const weakVerified = post({ id: 'weak', authorId: 'v' });
    const ranked = rankForYou([weakVerified, strong], { now: NOW, verifiedIds: ['v'] });
    expect(ranked[0].id).toBe('strong');
  });

  it('puts a verified author ahead of an otherwise identical unverified one', () => {
    const a = post({ id: 'plain', authorId: 'u' });
    const b = post({ id: 'tick', authorId: 'v' });
    expect(rankForYou([a, b], { now: NOW, verifiedIds: ['v'] })[0].id).toBe('tick');
  });

  it('damps very thin posts', () => {
    expect(scorePost(post({ content: 'ok' }), { now: NOW })).toBeLessThan(scorePost(post(), { now: NOW }));
  });
});

describe('diversity', () => {
  it('stops one author from taking the first slots', () => {
    const spam = Array.from({ length: 5 }, (_, i) =>
      post({ id: `s${i}`, authorId: 'spammer', likes: Array(10).fill('x'), createdAt: hoursAgo(1 + i * 0.1) })
    );
    const other = post({ id: 'o', authorId: 'other', likes: Array(8).fill('x'), createdAt: hoursAgo(1.2) });
    const ids = rankForYou([...spam, other], { now: NOW }).map((p) => p.id);
    expect(ids.slice(0, 3)).toContain('o');
  });

  it('is deterministic and keeps every post', () => {
    const posts = Array.from({ length: 20 }, (_, i) => post({ id: `p${i}`, authorId: `a${i % 4}`, likes: Array(i).fill('x') }));
    const one = rankForYou(posts, { now: NOW }).map((p) => p.id);
    const two = rankForYou(posts, { now: NOW }).map((p) => p.id);
    expect(one).toEqual(two);
    expect(new Set(one).size).toBe(20);
  });
});

describe('tick validity', () => {
  it('requires isVerified', () => {
    expect(isTickActive({ isVerified: false }, NOW)).toBe(false);
    expect(isTickActive(undefined, NOW)).toBe(false);
  });
  it('is open-ended without verifiedUntil', () => {
    expect(isTickActive({ isVerified: true }, NOW)).toBe(true);
  });
  it('expires after verifiedUntil', () => {
    expect(isTickActive({ isVerified: true, verifiedUntil: hoursAgo(1) }, NOW)).toBe(false);
    expect(isTickActive({ isVerified: true, verifiedUntil: new Date(NOW + 3_600_000).toISOString() }, NOW)).toBe(true);
    expect(isTickActive({ isVerified: true, verifiedUntil: { seconds: (NOW - 1000) / 1000 } }, NOW)).toBe(false);
  });
});

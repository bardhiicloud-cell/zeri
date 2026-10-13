import { describe, expect, it } from 'vitest';
import { MAX_BULK, filterPosts, isHttpsUrl, isPromotionActive, parseBulk, toPostRow, type PostRow } from '../../server/debateAdmin';

const NOW = Date.parse('2026-10-12T12:00:00Z');

const row = (over: Partial<PostRow> = {}): PostRow => ({
  id: 'p1', authorId: 'u1', authorName: 'Arben Krasniqi', content: 'Rruga në lagje', category: null, imageUrl: null,
  likes: 0, comments: 0, reposts: 0, viewCount: 0, reportCount: 0, isHidden: false, isAd: false, promotedUntilMs: null, createdAtMs: NOW,
  ...over,
});

describe('post rows', () => {
  it('summarises a Firestore document without leaking arrays', () => {
    const r = toPostRow('abc', {
      authorId: 'u', authorName: 'A', content: 'x'.repeat(900), likes: ['a', 'b'], comments: [{}], reposts: undefined,
      viewCount: 12, reportCount: 3, isHidden: true, createdAt: { toMillis: () => 5 }, promotedUntil: { toMillis: () => 99 }, isAd: true,
    });
    expect(r).toMatchObject({ id: 'abc', likes: 2, comments: 1, reposts: 0, viewCount: 12, reportCount: 3, isHidden: true, createdAtMs: 5, promotedUntilMs: 99, isAd: true });
    expect(r.content).toHaveLength(500);
  });
});

describe('filters', () => {
  const rows = [
    row({ id: 'a', content: 'Uji në Prizren', reportCount: 2 }),
    row({ id: 'zz9', content: 'Ndriçimi', isHidden: true }),
    row({ id: 'c', content: 'Promovim', isAd: true, promotedUntilMs: NOW + 1000 }),
    row({ id: 'd', content: 'Promovim i skaduar', isAd: true, promotedUntilMs: NOW - 1000 }),
  ];
  const ids = (filter: any, q = '') => filterPosts(rows, filter, q, NOW).map((r) => r.id);

  it('filters by state', () => {
    expect(ids('reported')).toEqual(['a']);
    expect(ids('hidden')).toEqual(['zz9']);
    expect(ids('visible')).toEqual(['a', 'c', 'd']);
    expect(ids('promoted')).toEqual(['c']);
    expect(ids('all')).toHaveLength(4);
  });

  it('searches content, author and id', () => {
    expect(ids('all', 'prizren')).toEqual(['a']);
    expect(ids('all', 'KRASNIQI')).toHaveLength(4);
    expect(ids('all', 'ZZ9')).toEqual(['zz9']); // exact id match, case-insensitive
  });

  it('treats a promotion without an end date as running, and an ended one as over', () => {
    expect(isPromotionActive({ isAd: true, promotedUntilMs: null }, NOW)).toBe(true);
    expect(isPromotionActive({ isAd: true, promotedUntilMs: NOW - 1 }, NOW)).toBe(false);
    expect(isPromotionActive({ isAd: false, promotedUntilMs: NOW + 1 }, NOW)).toBe(false);
  });
});

describe('bulk requests', () => {
  it('accepts a valid request and de-duplicates ids', () => {
    expect(parseBulk({ action: 'hide', ids: ['a', 'a', 'b'] })).toEqual({ outcome: 'ok', action: 'hide', ids: ['a', 'b'] });
  });

  it('rejects unknown actions, empty and oversized selections, bad ids', () => {
    expect(parseBulk({ action: 'ban', ids: ['a'] }).outcome).toBe('invalid');
    expect(parseBulk({ action: 'hide', ids: [] }).outcome).toBe('invalid');
    expect(parseBulk({ action: 'hide', ids: Array.from({ length: MAX_BULK + 1 }, (_, i) => `p${i}`) }).outcome).toBe('invalid');
    expect(parseBulk({ action: 'hide', ids: ['a/b'] }).outcome).toBe('invalid');
    expect(parseBulk(undefined).outcome).toBe('invalid');
  });

  it('refuses to delete without explicit confirmation', () => {
    expect(parseBulk({ action: 'delete', ids: ['a'] }).outcome).toBe('invalid');
    expect(parseBulk({ action: 'delete', ids: ['a'], confirm: 'yes' }).outcome).toBe('invalid');
    expect(parseBulk({ action: 'delete', ids: ['a'], confirm: true }).outcome).toBe('ok');
  });
});

describe('links', () => {
  it('only accepts https URLs', () => {
    expect(isHttpsUrl('https://biznesi.com/oferta')).toBe(true);
    expect(isHttpsUrl('http://biznesi.com')).toBe(false);
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpsUrl('')).toBe(false);
    expect(isHttpsUrl(undefined)).toBe(false);
  });
});

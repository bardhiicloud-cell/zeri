import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/firebase', () => ({ auth: {}, db: {}, storage: {} }));

const { groupReportsByReel, normalizeHashtag, toComment, toReport, validateComment, REEL_COMMENT_MAX } =
  await import('../../src/lib/reelsSocial');

describe('normalizeHashtag', () => {
  it('lower-cases and strips the #', () => {
    expect(normalizeHashtag('#Prishtina')).toBe('prishtina');
    expect(normalizeHashtag('  Ndriçimi ')).toBe('ndriçimi');
  });

  it('rejects multi-word, too short, too long and symbol input', () => {
    expect(normalizeHashtag('dy fjalë')).toBeNull();
    expect(normalizeHashtag('a')).toBeNull();
    expect(normalizeHashtag('x'.repeat(41))).toBeNull();
    expect(normalizeHashtag('rruga!')).toBeNull();
    expect(normalizeHashtag('')).toBeNull();
    expect(normalizeHashtag('#')).toBeNull();
  });
});

describe('validateComment', () => {
  it('collapses whitespace and accepts normal text', () => {
    expect(validateComment('  Mirë   shumë \n punë ')).toEqual({ text: 'Mirë shumë punë', error: null });
  });

  it('rejects empty and over-long comments', () => {
    expect(validateComment('   ').error).toMatch(/koment/);
    expect(validateComment('x'.repeat(REEL_COMMENT_MAX)).error).toBeNull();
    expect(validateComment('x'.repeat(REEL_COMMENT_MAX + 1)).error).toMatch(/kufiri/);
  });
});

describe('toComment', () => {
  it('maps a valid document and keeps text as plain data', () => {
    const c = toComment('c1', { authorId: 'u', authorName: 'Arta', text: '<img src=x onerror=alert(1)>', createdAt: { toMillis: () => 5 } });
    expect(c).toMatchObject({ id: 'c1', text: '<img src=x onerror=alert(1)>', createdAtMs: 5 });
  });

  it('drops malformed documents and unsafe avatars', () => {
    expect(toComment('c', undefined)).toBeNull();
    expect(toComment('c', { authorId: 'u', text: '' })).toBeNull();
    expect(toComment('c', { text: 'hi' })).toBeNull();
    expect(toComment('c', { authorId: 'u', text: 'hi', authorAvatar: 'javascript:1' })?.authorAvatar).toBeNull();
  });
});

describe('toReport and groupReportsByReel', () => {
  const r = (id: string, reelId: string, at: number) => toReport(id, { reelId, reporterId: id, reason: 'spam', details: '', status: 'open', createdAt: { toMillis: () => at } })!;

  it('rejects documents missing ids and defaults unknown values', () => {
    expect(toReport('x', { reelId: 'a' })).toBeNull();
    expect(toReport('x', { reelId: 'a', reporterId: 'b', status: 'weird', reason: 3 })).toMatchObject({ status: 'open', reason: 'other' });
  });

  it('groups by reel, most-reported first, then most recent', () => {
    const groups = groupReportsByReel([r('1', 'a', 10), r('2', 'b', 30), r('3', 'a', 20), r('4', 'c', 40)]);
    expect(groups.map((g) => g.reelId)).toEqual(['a', 'c', 'b']);
    expect(groups[0].reports).toHaveLength(2);
  });

  it('handles no reports', () => {
    expect(groupReportsByReel([])).toEqual([]);
  });
});

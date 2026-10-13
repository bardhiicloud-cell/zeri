import { describe, expect, it } from 'vitest';
import {
  moveIndex,
  normalizeSearch,
  resolveOpenGroups,
  searchSections,
  toggleGroup,
} from '../../src/lib/adminNav';

const sections = [
  { id: 'dashboard', nav: 'Paneli', label: 'Paneli i Përgjithshëm', hint: 'Numrat e ditës', keywords: ['kreu', 'home'] },
  { id: 'reports', nav: 'Raportet', label: 'Inspektimi i Raporteve', hint: 'Radha e raporteve qytetare', keywords: ['dosje', 'ankesa', 'complaints'] },
  { id: 'health', nav: 'Shëndetësia', label: 'Regjistri Shëndetësor & Spitalet', hint: 'Rastet shëndetësore', keywords: ['spital', 'health'] },
  { id: 'users', nav: 'Qytetarët', label: 'Regjistri i Qytetarëve', hint: 'Llogaritë dhe statusi', keywords: ['përdorues', 'users'] },
  { id: 'agents', nav: 'Stafi & Agjentët', label: 'Menaxhimi i Stafit & Agjentëve', hint: 'Rolet dhe lejet e stafit', keywords: ['staf', 'staff', 'punonjës'] },
  { id: 'support', nav: 'Mbështetja', label: 'Kërkesat për Agjent', hint: 'Bisedat me qytetarë', keywords: ['chat', 'biseda'] },
] as const;

const ids = (list: ReadonlyArray<{ id: string }>) => list.map((s) => s.id);

describe('normalizeSearch', () => {
  it('drops accents, case and punctuation', () => {
    expect(normalizeSearch('Shëndetësia')).toBe('shendetesia');
    expect(normalizeSearch('  Stafi & Agjentët! ')).toBe('stafi agjentet');
    expect(normalizeSearch('Çmimi')).toBe('cmimi');
  });

  it('tolerates empty and missing input', () => {
    expect(normalizeSearch('')).toBe('');
    expect(normalizeSearch(undefined as unknown as string)).toBe('');
  });
});

describe('searchSections', () => {
  it('returns every section, in order, for an empty query', () => {
    expect(ids(searchSections(sections, ''))).toEqual(ids(sections));
    expect(ids(searchSections(sections, '   '))).toEqual(ids(sections));
  });

  it('finds Albanian words typed without accents', () => {
    expect(ids(searchSections(sections, 'shendetesia'))[0]).toBe('health');
    expect(ids(searchSections(sections, 'qytetaret'))[0]).toBe('users');
  });

  it('matches the start of a word inside a longer title', () => {
    expect(ids(searchSections(sections, 'stafit'))).toContain('agents');
  });

  it('matches synonyms and English names from keywords', () => {
    expect(ids(searchSections(sections, 'complaints'))).toEqual(['reports']);
    expect(ids(searchSections(sections, 'staff'))).toEqual(['agents']);
    expect(ids(searchSections(sections, 'spital'))[0]).toBe('health');
  });

  it('ranks a short-label prefix above a looser match', () => {
    // "rap" starts "Raportet" (nav label) and appears in "raporteve" in a hint.
    const result = ids(searchSections(sections, 'rap'));
    expect(result[0]).toBe('reports');
  });

  it('requires every word to match, so extra words narrow the results', () => {
    expect(ids(searchSections(sections, 'raporte qytetare'))).toEqual(['reports']);
    expect(searchSections(sections, 'raporte inexistent')).toEqual([]);
  });

  it('returns nothing when no section matches', () => {
    expect(searchSections(sections, 'zzz')).toEqual([]);
  });

  it('keeps the original order for equal scores, so results do not jump while typing', () => {
    const tied = [
      { id: 'a', nav: 'Alfa', label: 'Alfa', hint: '', keywords: [] },
      { id: 'b', nav: 'Alfa', label: 'Alfa', hint: '', keywords: [] },
    ] as const;
    expect(ids(searchSections(tied, 'alf'))).toEqual(['a', 'b']);
  });

  it('does not mutate its input', () => {
    const copy = [...sections];
    searchSections(sections, 'rap');
    expect([...sections]).toEqual(copy);
  });
});

describe('moveIndex', () => {
  it('wraps in both directions', () => {
    expect(moveIndex(0, -1, 4)).toBe(3);
    expect(moveIndex(3, 1, 4)).toBe(0);
    expect(moveIndex(1, 1, 4)).toBe(2);
  });

  it('is safe for an empty list', () => {
    expect(moveIndex(0, 1, 0)).toBe(0);
  });
});

describe('open groups', () => {
  it('always opens the group of the active section', () => {
    expect(resolveOpenGroups(['system'], 'team').sort()).toEqual(['system', 'team']);
    expect(resolveOpenGroups([], 'daily')).toEqual(['daily']);
  });

  it('keeps remembered groups open and tolerates no active group', () => {
    expect(resolveOpenGroups(['team', 'system'], null)).toEqual(['team', 'system']);
  });

  it('does not duplicate a group that is both remembered and active', () => {
    expect(resolveOpenGroups(['team'], 'team')).toEqual(['team']);
  });

  it('toggles a group on and off without touching the others', () => {
    expect(toggleGroup(['team'], 'system')).toEqual(['team', 'system']);
    expect(toggleGroup(['team', 'system'], 'team')).toEqual(['system']);
  });
});

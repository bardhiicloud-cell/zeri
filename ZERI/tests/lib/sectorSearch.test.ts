import { describe, expect, it } from 'vitest';
import { SECTOR_OPTIONS, searchSectors } from '../../src/lib/sectorSearch';
import { REPORT_TOPICS } from '../../src/lib/reportTopics';

describe('searchSectors', () => {
  it('offers every topic when nothing is typed', () => {
    expect(searchSectors('')).toHaveLength(REPORT_TOPICS.length);
  });

  it('finds a sector from a word a citizen would use, with or without diacritics', () => {
    expect(searchSectors('gropë').map(option => option.id)).toContain('rruge');
    expect(searchSectors('grope').map(option => option.id)).toContain('rruge');
    expect(searchSectors('rrymë').map(option => option.id)).toContain('energji');
  });

  it('finds a sector from the name of the ministry that answers it', () => {
    expect(searchSectors('ministria e shëndetësisë').map(option => option.id)).toContain('shendetesi');
  });

  it('requires every word typed to match', () => {
    expect(searchSectors('rruge arsim')).toHaveLength(0);
  });

  it('puts a label that starts with the query first', () => {
    expect(searchSectors('ur')[0].label.toLowerCase().startsWith('ur')).toBe(true);
  });

  it('says who answers each sector', () => {
    const roads = SECTOR_OPTIONS.find(option => option.id === 'rruge');
    expect(roads?.answers).toMatch(/^Komuna \(urbane\) · .*Infrastrukturës.* \(rurale\)$/);
    expect(SECTOR_OPTIONS.find(option => option.id === 'arsim')?.answers).toBe('Komuna · Drejtoria e Arsimit');
    expect(SECTOR_OPTIONS.find(option => option.id === 'drejtesi')?.answers).toBe('Ministria e Drejtësisë');
  });
});

import { describe, expect, it } from 'vitest';
import { layoutNews, placeCandidate, type NewsSlotPosition } from '../../src/lib/newsPlacement';

const make = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `a${i}`, when: 1000 - i, position: 'feed' as NewsSlotPosition }));

describe('news placement', () => {
  it('the newest article leads, the rest feed the columns in order', () => {
    const layout = layoutNews(make(12));
    expect(layout.lead?.id).toBe('a0');
    expect(layout.latest.map(i => i.id)).toEqual(['a1', 'a2', 'a3']);
    expect(layout.rail).toHaveLength(5);
    expect(layout.ticker).toHaveLength(8);
    expect(layout.headlines).toHaveLength(9);
  });

  it('a featured article leads even when older; sidebar ones come first in the rail', () => {
    const list = make(8);
    list[5] = { ...list[5], position: 'featured' as never };
    list[7] = { ...list[7], position: 'sidebar' as never };
    const layout = layoutNews(list);
    expect(layout.lead?.id).toBe('a5');
    expect(layout.rail[0].id).toBe('a7');
  });

  it('a new featured article takes the lead and lands as #1 everywhere recent', () => {
    const others = make(10);
    const p = placeCandidate(others, { id: 'new', when: 5000, position: 'featured' }, true);
    expect(p).toMatchObject({ visible: true, lead: true, ticker: 1, headline: 1, archivePage: 1 });
  });

  it('a new plain article leads when nothing is featured, else tops the left column', () => {
    const p = placeCandidate(make(10), { id: 'new', when: 5000, position: 'feed' }, true);
    expect(p).toMatchObject({ lead: true });
    const withFeatured = make(10).map((a, i) => (i === 0 ? { ...a, position: 'featured' as never } : a));
    expect(placeCandidate(withFeatured, { id: 'new', when: 5000, position: 'feed' }, true)).toMatchObject({ lead: false, latest: 1 });
  });

  it('a draft is not placed anywhere', () => {
    expect(placeCandidate(make(3), { id: 'new', when: 1, position: 'feed' }, false)).toMatchObject({ visible: false, lead: false, ticker: null });
  });

  it('an old article editing itself keeps its place in time', () => {
    const others = make(20);
    const p = placeCandidate(others, { id: 'old', when: 1, position: 'feed' }, true);
    expect(p.headline).toBeNull();
    expect(p.archivePage).toBe(3);
  });
});

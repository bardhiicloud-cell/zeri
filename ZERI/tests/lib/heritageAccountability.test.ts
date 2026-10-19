import { describe, expect, it } from 'vitest';
import { CHARGES, SEXUAL_VIOLENCE_COUNTS } from '../../src/lib/heritage/accountability';
import { PREKAZ_BEATS } from '../../src/lib/heritage/jashari';
import { CITIES, WHY_VISIT } from '../../src/lib/heritage/welcome';
import { PLAYLIST, hasEmbed, searchUrl } from '../../src/lib/heritage/playlist';

describe('accountability data', () => {
  it('every figure and charge has a https source and both languages', () => {
    for (const c of [...SEXUAL_VIOLENCE_COUNTS, ...CHARGES]) {
      expect(c.source).toMatch(/^https:\/\//);
      expect(c.sourceLabel.length).toBeGreaterThan(2);
    }
    for (const c of CHARGES) { expect(c.title.sq && c.title.en && c.body.sq && c.body.en).toBeTruthy(); }
    expect(new Set(CHARGES.map((c) => c.id)).size).toBe(CHARGES.length);
    expect(CHARGES.some((c) => c.side === 'intl') && CHARGES.some((c) => c.side === 'kosova')).toBe(true);
  });
  it('estimates are labelled as estimates, never as findings', () => {
    for (const c of SEXUAL_VIOLENCE_COUNTS.filter((x) => /–/.test(x.value))) expect(c.strength).toBe('estimate');
  });
  it('Prekaz, welcome and playlist data are complete', () => {
    for (const b of PREKAZ_BEATS) expect(b.body.sq && b.body.en).toBeTruthy();
    expect(CITIES.length).toBe(7);
    for (const w of WHY_VISIT) expect(w.body.sq && w.body.en).toBeTruthy();
    expect(new Set(PLAYLIST.map((t) => t.id)).size).toBe(PLAYLIST.length);
    for (const t of PLAYLIST) if (t.videoId) expect(t.videoId).toMatch(/^[\w-]{11}$/);
    expect(searchUrl(PLAYLIST[0])).toContain('youtube.com/results');
    expect(typeof hasEmbed()).toBe('boolean');
  });
});

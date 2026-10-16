import { describe, expect, it } from 'vitest';
import { SEED_ENTRIES, SEED_SOURCES } from '../../src/lib/heritage/seed';
import { ALL_SECTIONS, KOSOVA_SECTIONS, UCK_SECTIONS, dateKey, findSection } from '../../src/lib/heritage/types';
import { parseEntryInput, parseSource } from '../../src/lib/heritage/workflow';
import { mergeContent, entriesOf, timelineOf, searchEntries, contentStats } from '../../src/lib/heritage/content';

/**
 * The shipped content is data, so it gets the same scrutiny as code: a dangling source id or a
 * victim figure with no date is a defect, not an editorial nuance.
 */
describe('seed content integrity', () => {
  const ids = SEED_ENTRIES.map((e) => e.id);
  const sourceIds = new Set(SEED_SOURCES.map((s) => s.id));

  it('has unique entry and source ids', () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(sourceIds.size).toBe(SEED_SOURCES.length);
  });

  it('every entry and every source passes the same validation the CMS applies', () => {
    for (const e of SEED_ENTRIES) {
      const r = parseEntryInput(e);
      expect(r.ok, `${e.id}: ${r.ok === false ? JSON.stringify(r.errors) : ''}`).toBe(true);
    }
    for (const s of SEED_SOURCES) {
      const r = parseSource(s);
      expect(r.ok, `${s.id}: ${r.ok === false ? JSON.stringify(r.errors) : ''}`).toBe(true);
    }
  });

  it('every referenced source exists', () => {
    for (const e of SEED_ENTRIES) {
      for (const id of [...e.sourceIds, ...e.claims.flatMap((c) => c.sourceIds)]) expect(sourceIds.has(id), `${e.id} → ${id}`).toBe(true);
    }
  });

  it('is bilingual: Albanian and English title, summary and body on every entry', () => {
    for (const e of SEED_ENTRIES) {
      for (const k of ['title', 'summary', 'body'] as const) {
        expect(e[k].sq.trim().length, `${e.id}.${k}.sq`).toBeGreaterThan(0);
        expect(e[k].en.trim().length, `${e.id}.${k}.en`).toBeGreaterThan(0);
      }
    }
  });

  it('every claim is dated and sourced; an entry without sources is only an editorial-policy or call-to-action page', () => {
    for (const e of SEED_ENTRIES) {
      for (const c of e.claims) {
        expect(c.sourceIds.length, `${e.id}/${c.id}`).toBeGreaterThan(0);
        expect(c.asOf, `${e.id}/${c.id}`).toMatch(/^\d{4}(-\d{2}(-\d{2})?)?$/);
      }
    }
    const sourceless = SEED_ENTRIES.filter((e) => e.sourceIds.length === 0);
    expect(sourceless.length).toBeGreaterThan(0);
    for (const e of sourceless) {
      expect(e.evidence, e.id).toBe('official-position');
      expect(e.claims, e.id).toEqual([]);
    }
  });

  it('claims nothing it has not had verified: no seed entry is marked verified', () => {
    for (const e of SEED_ENTRIES) expect(e.verification.state, e.id).toBe('unverified');
  });

  it('no source claims a checked link: nothing could be opened when this was written', () => {
    for (const s of SEED_SOURCES) expect(s.linkChecked, s.id).toBe(false);
  });

  it('every section of both areas has at least one entry, and entries sit in a section of their own area', () => {
    for (const s of ALL_SECTIONS) expect(SEED_ENTRIES.some((e) => e.area === s.area && e.section === s.id), `${s.area}/${s.id}`).toBe(true);
    for (const e of SEED_ENTRIES) expect(findSection(e.area, e.section), e.id).toBeDefined();
    expect(KOSOVA_SECTIONS).toHaveLength(10);
    expect(UCK_SECTIONS).toHaveLength(10);
  });

  it('allegations and contested items say so in their text', () => {
    for (const e of SEED_ENTRIES.filter((x) => x.evidence === 'allegation')) {
      expect(`${e.summary.sq} ${e.body.sq}`, e.id).toMatch(/pretend|prezumimi|akuz|pavërtetu|nuk është vërtetuar/i);
    }
  });

  it('the sexual-violence chapter carries no media, no figures in prose and flags its content', () => {
    const sv = SEED_ENTRIES.filter((e) => e.section === 'sexual-violence');
    expect(sv.length).toBeGreaterThan(2);
    for (const e of sv) { expect(e.media).toEqual([]); expect(e.claims).toEqual([]); }
    expect(sv.some((e) => e.sensitive === 'sexual-violence')).toBe(true);
    for (const e of sv) expect(`${e.body.sq} ${e.body.en}`).not.toMatch(/\d{2,}\s*(gra|persona|women|persons|cases|raste)/i);
  });

  it('contains no testimony and no invented human stories: story entries are only calls for contributions', () => {
    expect(SEED_ENTRIES.filter((e) => e.evidence === 'testimony')).toEqual([]);
    for (const e of SEED_ENTRIES.filter((x) => x.kind === 'story')) expect(e.sourceIds, e.id).toEqual([]);
  });

  it('every dated entry has a parseable date and the war timeline is in 1998–1999', () => {
    for (const e of SEED_ENTRIES.filter((x) => x.date)) expect(Number.isFinite(dateKey(e.date!.from)), e.id).toBe(true);
    const tl = timelineOf(mergeContent(null), 'uck', 'timeline');
    expect(tl.length).toBeGreaterThanOrEqual(20);
    for (const e of tl) { const y = Math.floor(dateKey(e.date!.from)); expect([1998, 1999], e.id).toContain(y); }
  });

  it('the Declaration entry does not invent a signatory list', () => {
    const e = SEED_ENTRIES.find((x) => x.id === 'nenshkruesit')!;
    expect(e.body.sq).toMatch(/nuk është shkruar këtu nga kujtesa/);
    expect(e.claims).toEqual([]);
  });
});

describe('content merge', () => {
  it('serves the seed alone when the API has nothing', () => {
    const c = mergeContent(null);
    expect(c.seedOnly).toBe(true);
    expect(c.entries.length).toBe(SEED_ENTRIES.length);
  });

  it('a CMS record replaces the seed entry of the same id; hiddenIds withdraws one', () => {
    const base = SEED_ENTRIES.find((e) => e.id === 'mikpritja')!;
    const edited = { ...base, origin: 'cms' as const, version: 3, verification: { state: 'verified' as const, at: '2026-02-02' } };
    const merged = mergeContent({ entries: [edited], hiddenIds: ['ulpiana'], sources: [] });
    expect(merged.entries.find((e) => e.id === 'mikpritja')!.version).toBe(3);
    expect(merged.entries.some((e) => e.id === 'ulpiana')).toBe(false);
    expect(merged.seedOnly).toBe(false);
    expect(contentStats(merged).verified).toBe(1);
  });

  it('adds CMS-only entries and orders by the editor-set order', () => {
    const extra = { ...SEED_ENTRIES[0], id: 'new-one', section: 'bashkon' as const, order: -5, area: 'kosova' as const };
    const merged = mergeContent({ entries: [extra], sources: [] });
    expect(entriesOf(merged, 'kosova', 'bashkon')[0].id).toBe('new-one');
  });

  it('searches accent-insensitively in both languages', () => {
    const c = mergeContent(null);
    expect(searchEntries(c, 'Rambuje', 'sq').some((e) => /Rambou/i.test(e.title.sq + e.title.en))).toBe(true);
    expect(searchEntries(c, 'constitution', 'en').length).toBeGreaterThan(0);
    expect(searchEntries(c, '   ', 'sq')).toEqual([]);
  });
});

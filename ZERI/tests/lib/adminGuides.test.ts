import { describe, expect, it } from 'vitest';
import { SECTION_GUIDES, GLOBAL_TIPS, roleNote } from '../../src/lib/adminGuides';
import { NAV_SECTIONS } from '../../src/components/admin/nav/navConfig';

describe('section guides', () => {
  it('has a guide for every section in the menu, so none ships unexplained', () => {
    const missing = NAV_SECTIONS.map(section => section.id).filter(id => !SECTION_GUIDES[id]);
    expect(missing).toEqual([]);
  });

  it('has no guide for a section that does not exist', () => {
    const ids = new Set<string>(NAV_SECTIONS.map(section => section.id));
    expect(Object.keys(SECTION_GUIDES).filter(id => !ids.has(id))).toEqual([]);
  });

  it('gives every guide a purpose, real steps and at least one rule', () => {
    for (const [id, guide] of Object.entries(SECTION_GUIDES)) {
      expect(guide.purpose.length, id).toBeGreaterThan(20);
      expect(guide.steps.length, id).toBeGreaterThan(0);
      expect(guide.rules.length, id).toBeGreaterThan(0);
      for (const step of guide.steps) expect(step.length, `${id}: ${step}`).toBeGreaterThan(8);
    }
  });

  it('only links to sections that exist', () => {
    const ids = new Set<string>(NAV_SECTIONS.map(section => section.id));
    for (const [id, guide] of Object.entries(SECTION_GUIDES)) {
      for (const link of guide.next ?? []) expect(ids.has(link.id), `${id} -> ${link.id}`).toBe(true);
    }
  });

  it('never repeats a step or a rule inside one guide', () => {
    for (const [id, guide] of Object.entries(SECTION_GUIDES)) {
      expect(new Set(guide.steps).size, `${id} steps`).toBe(guide.steps.length);
      expect(new Set(guide.rules).size, `${id} rules`).toBe(guide.rules.length);
    }
  });

  it('describes the role in plain words and has global tips', () => {
    expect(roleNote('reports', 'monitor')).toMatch(/vëzhgon/);
    expect(roleNote('reports', 'municipality')).toMatch(/komun/i);
    expect(roleNote('reports', 'citizen')).toBeNull();
    expect(GLOBAL_TIPS.length).toBeGreaterThan(2);
  });
});

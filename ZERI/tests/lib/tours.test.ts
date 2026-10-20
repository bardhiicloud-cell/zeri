import { describe, expect, it } from 'vitest';
import { TOURS, stripLanguage, toursForRoute } from '../../src/lib/tours';
import { readFileSync } from 'node:fs';

describe('tours', () => {
  it('matches a route with or without a language prefix', () => {
    expect(stripLanguage('/sq/raporto')).toBe('/raporto');
    expect(stripLanguage('/raporto/')).toBe('/raporto');
    expect(stripLanguage('/en')).toBe('/');
    expect(toursForRoute('/en/raporto').map(t => t.id)).toEqual(['report-1', 'report-2']);
    expect(toursForRoute('/lajmero').map(t => t.id)).toEqual(['news']);
  });

  it('has unique ids and non-empty steps', () => {
    expect(new Set(TOURS.map(t => t.id)).size).toBe(TOURS.length);
    for (const tour of TOURS) {
      expect(tour.steps.length).toBeGreaterThan(0);
      for (const step of tour.steps) expect(step.selectors.length).toBeGreaterThan(0);
    }
  });

  it('only points at data-tour anchors that exist in the pages', () => {
    const sources = ['ReportIssue', 'LajmeroPage', 'DonationsPage', 'HealthRegistryPage']
      .map(name => readFileSync(`src/pages/${name}.tsx`, 'utf8')).join('\n');
    for (const tour of TOURS) {
      for (const step of tour.steps) {
        for (const selector of step.selectors) {
          const anchor = /data-tour="([^"]+)"/.exec(selector)?.[1];
          if (anchor) expect(sources, anchor).toContain(`data-tour="${anchor}"`);
        }
      }
    }
  });
});

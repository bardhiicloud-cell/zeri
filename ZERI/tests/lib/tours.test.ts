import { describe, expect, it } from 'vitest';
import { PLATFORM_TOUR_ID, TOURS, genericTourFor, stepsForDevice, stripLanguage, tourById, toursForRoute } from '../../src/lib/tours';
import { ALL_SIDEBAR_LINKS } from '../../src/lib/navigation';
import { readFileSync } from 'node:fs';

describe('tours', () => {
  it('matches a route with or without a language prefix', () => {
    expect(stripLanguage('/sq/raporto')).toBe('/raporto');
    expect(stripLanguage('/raporto/')).toBe('/raporto');
    expect(stripLanguage('/en')).toBe('/');
    expect(toursForRoute('/en/raporto').map(t => t.id)).toEqual(['report-1', 'report-2']);
    expect(toursForRoute('/lajmero').map(t => t.id)).toEqual(['news']);
  });

  it('matches route aliases', () => {
    expect(toursForRoute('/kontakte').map(t => t.id)).toEqual(['contact']);
    expect(toursForRoute('/sq/raportet-e-mia').map(t => t.id)).toEqual(['track']);
    expect(toursForRoute('/regjistri').map(t => t.id)).toEqual(['registry']);
  });

  it('has unique ids and non-empty steps', () => {
    expect(new Set(TOURS.map(t => t.id)).size).toBe(TOURS.length);
    for (const tour of TOURS) expect(tour.steps.length).toBeGreaterThan(0);
  });

  it('only the platform tour opens with a centred welcome; every other step points at something', () => {
    for (const tour of TOURS) {
      tour.steps.forEach((step, i) => {
        if (step.selectors.length === 0) expect(tour.id === PLATFORM_TOUR_ID, `${tour.id}#${i}`).toBe(true);
      });
    }
  });

  it('only points at data-tour anchors that exist in the pages and the shell', () => {
    const sources = [
      'pages/ReportIssue', 'pages/LajmeroPage', 'pages/DonationsPage', 'pages/HealthRegistryPage', 'pages/MapPage',
      'components/layout/MobileNav', 'components/layout/TopNavbar', 'components/layout/AppSidebar', 'components/GuidedTour',
    ].map(name => readFileSync(`src/${name}.tsx`, 'utf8')).join('\n');
    for (const tour of TOURS) {
      for (const step of tour.steps) {
        for (const selector of step.selectors) {
          const anchor = /data-tour="([^"]+)"/.exec(selector)?.[1];
          if (anchor) expect(sources, anchor).toMatch(new RegExp(`data-tour=("${anchor}"|\\{\`dock-)`));
          if (/data-tour-launcher/.test(selector)) expect(sources).toContain('data-tour-launcher');
        }
      }
    }
  });

  it('the platform tour explains every menu entry, on a phone and on a laptop', () => {
    const tour = tourById(PLATFORM_TOUR_ID)!;
    const mentioned = (device: 'mobile' | 'desktop') => new Set(
      stepsForDevice(tour, device).flatMap(step => step.selectors.map(s => /data-tour-menu="([^"]+)"/.exec(s)?.[1]).filter(Boolean)),
    );
    const phone = mentioned('mobile');
    const laptop = mentioned('desktop');
    // On a laptop "Raporto" is the button in the top bar rather than a menu row.
    if (stepsForDevice(tour, 'desktop').some(step => step.selectors.includes('[data-tour="top-report"]'))) laptop.add('/raporto');
    for (const link of ALL_SIDEBAR_LINKS) {
      expect(phone.has(link.href), `phone: ${link.href}`).toBe(true);
      expect(laptop.has(link.href), `laptop: ${link.href}`).toBe(true);
    }
  });

  it('the phone tour walks map, "+", then opens the menu before any menu entry', () => {
    const steps = stepsForDevice(tourById(PLATFORM_TOUR_ID)!, 'mobile');
    const firstMenuEntry = steps.findIndex(s => s.panel === 'menu');
    const at = (anchor: string) => steps.findIndex(s => s.selectors.includes(`[data-tour="${anchor}"]`));
    expect(at('dock-map')).toBeGreaterThan(-1);
    expect(at('dock-map')).toBeLessThan(at('dock-create'));
    expect(at('dock-create')).toBeLessThan(at('dock-menu'));
    expect(at('dock-menu')).toBeLessThan(firstMenuEntry);
    // The panel stays open from the first menu step to the last menu entry.
    const lastMenuEntry = steps.map(s => s.panel).lastIndexOf('menu');
    expect(steps.slice(firstMenuEntry, lastMenuEntry + 1).every(s => s.panel === 'menu')).toBe(true);
  });

  it('every page gets a tour, even one that has none of its own', () => {
    const generic = genericTourFor('/sq/diçka-e-panjohur');
    expect(generic.generic).toBe(true);
    expect(generic.steps.length).toBeGreaterThan(1);
  });
});

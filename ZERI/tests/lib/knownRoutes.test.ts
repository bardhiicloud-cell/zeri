import { describe, expect, it } from 'vitest';
import { isKnownPagePath, isLocalePrefix } from '../../src/lib/knownRoutes';

describe('knownRoutes', () => {
  it('treats real pages as known, with or without a language prefix', () => {
    for (const p of ['/', '/raporto', '/en/raporto', '/en', '/Idea', '/kosova/historia/x', '/ar/historia-e-uck', '/trackid/detaje']) {
      expect(isKnownPagePath(p), p).toBe(true);
    }
  });

  it('treats unknown URLs as 404, including under a language prefix', () => {
    for (const p of ['/nuk-ekziston', '/en/nuk-ekziston', '/xx/raporto', '/raporto-gabim', '/forum', '/en/buxheti']) {
      expect(isKnownPagePath(p), p).toBe(false);
    }
  });

  it('recognises only prefixed languages as locale segments', () => {
    expect(isLocalePrefix('en')).toBe(true);
    expect(isLocalePrefix('sq')).toBe(false);
    expect(isLocalePrefix('nuk-ekziston')).toBe(false);
    expect(isLocalePrefix(undefined)).toBe(false);
  });
});

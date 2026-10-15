// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AGE_VERIFICATION_KEY,
  announceAgeVerified,
  legalGatesCleared,
  onLegalGatesChange,
  writeConsent,
  announceConsentChange,
} from '../../src/lib/consent';
import { isTaskPath } from '../../src/lib/promptRoutes';

beforeEach(() => window.localStorage.clear());

describe('first-visit prompts (PUB-UI-002)', () => {
  it('does not clear the legal gates until the age question AND the cookie choice are answered', () => {
    expect(legalGatesCleared()).toBe(false);
    window.localStorage.setItem(AGE_VERIFICATION_KEY, 'passed');
    expect(legalGatesCleared()).toBe(false);
    writeConsent({ analytics: false, marketing: false });
    expect(legalGatesCleared()).toBe(true);
  });

  it('tells subscribers when either gate is answered', () => {
    const listener = vi.fn();
    const off = onLegalGatesChange(listener);
    announceAgeVerified();
    announceConsentChange(writeConsent({ analytics: false, marketing: false }));
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    announceAgeVerified();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps the optional municipality prompt off task and legal pages, with or without a locale prefix', () => {
    for (const path of ['/raporto', '/en/raporto', '/trackid', '/de/trackid/', '/privatesia', '/login']) {
      expect(isTaskPath(path), path).toBe(true);
    }
    for (const path of ['/', '/harta', '/statistikat', '/en/harta', '/komunat']) {
      expect(isTaskPath(path), path).toBe(false);
    }
  });
});

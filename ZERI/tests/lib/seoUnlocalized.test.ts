import { describe, expect, it } from 'vitest';
import { buildLocalizedPath, isUnlocalizedPath, parseLocalePath } from '../../src/lib/seo';

describe('pages without a language prefix', () => {
  it('flags sign-in and every staff console', () => {
    for (const path of ['/login', '/register', '/admin', '/approvals', '/agent', '/menagjer', '/monitorim', '/moderim', '/komuna', '/komuna-panel', '/debatwp', '/debatiwp']) {
      expect(isUnlocalizedPath(path), path).toBe(true);
    }
  });

  it('also matches their sub-paths', () => {
    expect(isUnlocalizedPath('/admin/anything')).toBe(true);
  });

  it('leaves public pages localized', () => {
    for (const path of ['/', '/lajme', '/partneret', '/sherbimet', '/komunat']) {
      expect(isUnlocalizedPath(path), path).toBe(false);
    }
  });

  it('would otherwise have produced the 404 address', () => {
    // Documents the failure this guards against: the generic builder prefixes
    // everything, so callers must check isUnlocalizedPath first.
    expect(buildLocalizedPath('/admin', 'en')).toBe('/en/admin');
    expect(parseLocalePath('/en/admin').pagePath).toBe('/admin');
  });
});

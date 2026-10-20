import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Googlebot renders the pages and needs the public feed they load from the API host. A blanket
 * `Disallow: /api/` blocked it ("Googlebot blocked by robots.txt" in Search Console), so the
 * render saw empty pages. The public feed must stay allowed, with the more specific rule first.
 */
const robots = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe.each([
  ['public/robots.txt', '../../public/robots.txt'],
  ['server.ts (the API host)', '../../server.ts'],
])('robots rules in %s', (_name, path) => {
  const text = robots(path);

  it('allows the public feed and still keeps the rest of the API out', () => {
    const allow = text.indexOf('Allow: /api/v1/public/');
    const disallow = text.indexOf('Disallow: /api/');
    expect(allow).toBeGreaterThan(-1);
    expect(disallow).toBeGreaterThan(allow);
  });

  it('keeps the admin area out', () => {
    expect(text).toContain('Disallow: /admin');
  });
});

import { describe, expect, it } from 'vitest';
import { dayStamp, isLikelyBot, safeHttpsUrl, visitorKey } from '../../server/adTracking';

describe('safeHttpsUrl', () => {
  it('accepts plain https and normalises it', () => {
    expect(safeHttpsUrl('https://example.org/a?b=1')).toBe('https://example.org/a?b=1');
    expect(safeHttpsUrl('  https://example.org  ')).toBe('https://example.org/');
  });

  it('refuses http, javascript:, data:, credentials, junk and oversize', () => {
    for (const bad of ['http://example.org', 'javascript:alert(1)', 'data:text/html,hi', 'https://user:pw@example.org', 'ftp://x.test', 'not a url', '', null, undefined, 42, `https://e.org/${'a'.repeat(2100)}`]) {
      expect(safeHttpsUrl(bad)).toBeNull();
    }
  });
});

describe('bot detection and visitor key', () => {
  it('does not count crawlers, previews or missing user agents', () => {
    expect(isLikelyBot(undefined)).toBe(true);
    expect(isLikelyBot('Googlebot/2.1')).toBe(true);
    expect(isLikelyBot('WhatsApp/2.23')).toBe(true);
    expect(isLikelyBot('curl/8.0')).toBe(true);
    expect(isLikelyBot('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36')).toBe(false);
  });

  it('is stable within a day, differs by visitor and by day, and is not reversible to the inputs', () => {
    const t = Date.UTC(2026, 9, 12, 10);
    const a = visitorKey('1.2.3.4', 'UA', t);
    expect(a).toBe(visitorKey('1.2.3.4', 'UA', t + 3_600_000));
    expect(a).not.toBe(visitorKey('1.2.3.5', 'UA', t));
    expect(a).not.toBe(visitorKey('1.2.3.4', 'UA', t + 86_400_000));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain('1.2.3.4');
    expect(dayStamp(t)).toBe('2026-10-12');
  });
});

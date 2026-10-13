import { describe, expect, it } from 'vitest';
import { realContactOrEmpty } from '../../src/lib/placeholderContacts';

describe('realContactOrEmpty', () => {
  it('drops the sample contacts the admin form used to seed', () => {
    for (const v of ['+383 44 123 456', '+38344123456', '+383 (44) 123-456', 'reklama@qytetari.ks', 'Reklama@Qytetari.KS']) {
      expect(realContactOrEmpty(v)).toBe('');
    }
  });
  it('keeps real values, trimmed, and tolerates non-strings', () => {
    expect(realContactOrEmpty(' +383 49 555 111 ')).toBe('+383 49 555 111');
    expect(realContactOrEmpty('info@example.org')).toBe('info@example.org');
    expect(realContactOrEmpty(undefined)).toBe('');
    expect(realContactOrEmpty(null)).toBe('');
    expect(realContactOrEmpty(42)).toBe('');
  });
});

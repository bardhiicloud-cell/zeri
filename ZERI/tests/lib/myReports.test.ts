import { describe, expect, it } from 'vitest';
import { kindOf } from '../../src/pages/MyReportsPage';

describe('Raportet e mia', () => {
  it('tells each sector apart by its Track ID prefix', () => {
    expect(kindOf('ZQ-20261017-ABCDEF123456')).toBe('report');
    expect(kindOf('LJ-ABCDEFGH')).toBe('news');
    expect(kindOf('DN-ABCDEFGH')).toBe('donation');
    expect(kindOf('HC-MGT3XYZ1-AB12')).toBe('health');
  });
});

import { describe, expect, it } from 'vitest';
import { mayOffer } from '../../src/lib/useInstallApp';

describe('install offer', () => {
  it('is made to a new visitor', () => {
    expect(mayOffer({ installed: false, offered: false, dismissals: 0 })).toBe(true);
  });
  it('is never repeated once shown, installed or refused before', () => {
    expect(mayOffer({ installed: false, offered: true, dismissals: 0 })).toBe(false);
    expect(mayOffer({ installed: true, offered: false, dismissals: 0 })).toBe(false);
    expect(mayOffer({ installed: false, offered: false, dismissals: 1 })).toBe(false);
  });
});

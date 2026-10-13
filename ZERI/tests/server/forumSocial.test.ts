import { describe, expect, it } from 'vitest';
import {
  VERIFICATION_DAYS,
  VERIFICATION_PRICE_EUR,
  activeVerifiedIds,
  decideVerificationRequest,
  isSafeDocId,
  verifiedUntil,
} from '../../server/forumSocial';

describe('verification requests', () => {
  const base = { hasEmail: true, alreadyVerified: false, existingStatus: null, note: 'Jam gazetar' };

  it('accepts a signed-in, unverified account and trims the note', () => {
    const decision = decideVerificationRequest({ ...base, note: `  ${'x'.repeat(400)}  ` });
    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.note.length).toBe(300);
  });

  it('refuses guests (no e-mail)', () => {
    const decision = decideVerificationRequest({ ...base, hasEmail: false });
    expect(decision).toMatchObject({ ok: false, status: 403 });
  });

  it('refuses accounts that are already verified or already pending', () => {
    expect(decideVerificationRequest({ ...base, alreadyVerified: true })).toMatchObject({ ok: false, status: 409 });
    expect(decideVerificationRequest({ ...base, existingStatus: 'pending' })).toMatchObject({ ok: false, status: 409 });
  });

  it('lets a rejected account apply again', () => {
    expect(decideVerificationRequest({ ...base, existingStatus: 'rejected' }).ok).toBe(true);
  });

  it('uses the agreed price and a 30 day term', () => {
    expect(VERIFICATION_PRICE_EUR).toBe(15.99);
    const from = new Date('2026-10-12T00:00:00Z');
    expect(verifiedUntil(from).getTime() - from.getTime()).toBe(VERIFICATION_DAYS * 86_400_000);
  });
});

describe('active ticks', () => {
  const now = Date.parse('2026-10-12T00:00:00Z');
  const until = (ms: number) => ({ toMillis: () => ms });

  it('keeps open-ended and unexpired ticks, drops lapsed ones', () => {
    const ids = activeVerifiedIds(
      [
        { id: 'open' },
        { id: 'valid', verifiedUntil: until(now + 1000) },
        { id: 'lapsed', verifiedUntil: until(now - 1000) },
      ],
      now
    );
    expect(ids).toEqual(['open', 'valid']);
  });
});

describe('document ids', () => {
  it('rejects empty, oversized and path-like ids', () => {
    expect(isSafeDocId('abc123')).toBe(true);
    expect(isSafeDocId('')).toBe(false);
    expect(isSafeDocId('a/b')).toBe(false);
    expect(isSafeDocId('x'.repeat(129))).toBe(false);
    expect(isSafeDocId(undefined)).toBe(false);
  });
});

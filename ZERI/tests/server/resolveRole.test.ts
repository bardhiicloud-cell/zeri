import { describe, expect, it } from 'vitest';
import { PROFILE_ROLE_FALLBACK, resolveActorRole, type AuthedUser } from '../../server/auth';

/**
 * Authority comes from the verified ID token alone. The profile document's `role`
 * field is attacker-influenceable (an admin could write it onto another user), so
 * by default it must never turn an account into staff.
 */
const user = (claims: Record<string, unknown>): AuthedUser => ({
  uid: 'u1',
  email: 'u1@example.test',
  role: String(claims.role ?? 'citizen'),
  claims,
});

describe('resolveActorRole', () => {
  it('reads the role claim', async () => {
    expect(await resolveActorRole(user({ role: 'agent' }))).toBe('agent');
    expect(await resolveActorRole(user({ role: 'municipality', municipality: 'Prizren' }))).toBe('municipality');
  });

  it('treats the legacy admin flag as admin', async () => {
    expect(await resolveActorRole(user({ admin: true }))).toBe('admin');
  });

  it('prefers the role claim over the legacy flag', async () => {
    expect(await resolveActorRole(user({ role: 'superadmin', admin: true }))).toBe('superadmin');
  });

  it('returns no role for a token without one - the profile document is not consulted', async () => {
    expect(PROFILE_ROLE_FALLBACK).toBe(false);
    expect(await resolveActorRole(user({}))).toBe('');
    expect(await resolveActorRole(user({ admin: false }))).toBe('');
  });

  it('returns no role when there is no user', async () => {
    expect(await resolveActorRole(undefined)).toBe('');
  });
});

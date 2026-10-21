import { describe, expect, it } from 'vitest';
import { PLATFORM_OWNER_EMAIL, isPlatformOwnerAccount, isProtectedOwner } from '../../server/owner';
import { buildOwnerClaims, buildRoleClaims, isManagedClaimKey } from '../../server/roleClaims';
import { checkRoleChange } from '../../server/policy';
import { decideStaffRemoval, type RemovalInput } from '../../server/staffRemoval';

/**
 * The platform owner sits above every superadmin: only the owner creates, demotes, bans or removes a
 * superadmin, and nobody changes or removes the owner. Authority is the verified `owner` claim plus the
 * owner's email, never a profile field.
 */
const ownerClaims = buildOwnerClaims();

describe('who is the owner', () => {
  it('is bardhiicloud@gmail.com unless the environment says otherwise', () => {
    expect(PLATFORM_OWNER_EMAIL).toBe('bardhiicloud@gmail.com');
  });

  it('needs the owner claim, the superadmin claim and the owner email, all three', () => {
    expect(isPlatformOwnerAccount({ email: 'bardhiicloud@gmail.com', claims: ownerClaims })).toBe(true);
    expect(isPlatformOwnerAccount({ email: ' BardhiiCloud@Gmail.com ', claims: ownerClaims })).toBe(true);
    // A claim copied onto another account gives nothing.
    expect(isPlatformOwnerAccount({ email: 'someone@else.test', claims: ownerClaims })).toBe(false);
    // The owner's email without the claim gives nothing.
    expect(isPlatformOwnerAccount({ email: 'bardhiicloud@gmail.com', claims: buildRoleClaims('superadmin', []) })).toBe(false);
    expect(isPlatformOwnerAccount({ email: 'bardhiicloud@gmail.com', claims: { owner: true } })).toBe(false);
    expect(isPlatformOwnerAccount({ email: 'bardhiicloud@gmail.com' })).toBe(false);
  });

  it('protects the owner by claim OR email, so it fails safe', () => {
    expect(isProtectedOwner({ email: 'bardhiicloud@gmail.com', claims: {} })).toBe(true);
    expect(isProtectedOwner({ email: 'x@y.test', claims: { owner: true } })).toBe(true);
    expect(isProtectedOwner({ email: 'x@y.test', claims: buildRoleClaims('superadmin', []) })).toBe(false);
  });

  it('carries everything a superadmin has, plus the flag; the role routes never manage the flag', () => {
    expect(ownerClaims).toMatchObject({ role: 'superadmin', admin: true, superadmin: true, owner: true });
    expect(isManagedClaimKey('owner')).toBe(false);
    expect(buildRoleClaims('superadmin', [])).not.toHaveProperty('owner');
  });
});

describe('changing a role', () => {
  const change = (patch: Record<string, unknown>) => checkRoleChange({
    actorUid: 'actor', actorRole: 'superadmin', targetUid: 'target', currentTargetRole: 'agent', nextRole: 'moderator', ...patch,
  } as never);

  it('lets a superadmin manage staff and admins as before', () => {
    expect(change({}).outcome).toBe('allow');
    expect(change({ currentTargetRole: 'admin', nextRole: 'agent' }).outcome).toBe('allow');
    expect(change({ nextRole: 'admin' }).outcome).toBe('allow');
  });

  it('keeps superadmins to the owner: no creating, demoting or banning one otherwise', () => {
    expect(change({ nextRole: 'superadmin' })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(change({ currentTargetRole: 'superadmin', nextRole: 'agent' })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(change({ currentTargetRole: 'superadmin', nextRole: 'superadmin' })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(change({ nextRole: 'superadmin', actorIsOwner: true }).outcome).toBe('allow');
    expect(change({ currentTargetRole: 'superadmin', nextRole: 'agent', actorIsOwner: true }).outcome).toBe('allow');
  });

  it('lets nobody change the owner, not even the owner through another door', () => {
    for (const actorIsOwner of [false, true]) {
      expect(change({ targetIsOwner: true, actorIsOwner, currentTargetRole: 'superadmin', nextRole: 'agent' }), String(actorIsOwner)).toMatchObject({ outcome: 'deny', status: 403 });
    }
  });

  it('an admin still cannot touch admins or superadmins at all', () => {
    expect(change({ actorRole: 'admin', currentTargetRole: 'admin', nextRole: 'agent' })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(change({ actorRole: 'admin', currentTargetRole: 'superadmin', nextRole: 'agent', actorIsOwner: false })).toMatchObject({ outcome: 'deny', status: 403 });
  });
});

describe('removing an account', () => {
  const base: RemovalInput = {
    actor: { uid: 'actor', role: 'superadmin' }, targetUid: 'target', targetRole: 'agent',
    targetEmail: 'agent@zeri.test', reason: 'Ka lënë punën', confirmEmail: 'agent@zeri.test',
  };
  const run = (patch: Partial<RemovalInput>) => decideStaffRemoval({ ...base, ...patch });
  const superadminTarget = { targetRole: 'superadmin', targetEmail: 'sa@zeri.test', confirmEmail: 'sa@zeri.test' };

  it('lets only the owner remove a superadmin, with a reason and the typed email', () => {
    expect(run({ ...superadminTarget })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(run({ ...superadminTarget, actorIsOwner: true }).outcome).toBe('allow');
    expect(run({ ...superadminTarget, actorIsOwner: true, confirmEmail: 'wrong@zeri.test' })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ ...superadminTarget, actorIsOwner: true, reason: '' })).toMatchObject({ outcome: 'deny', status: 400 });
  });

  it('removes nobody who is the owner, whoever asks', () => {
    for (const actorIsOwner of [false, true]) {
      expect(run({ targetIsOwner: true, actorIsOwner, targetRole: 'superadmin' }), String(actorIsOwner)).toMatchObject({ outcome: 'deny', status: 403 });
    }
  });

  it('the owner cannot remove their own account either', () => {
    expect(run({ actor: { uid: 'target', role: 'superadmin' }, actorIsOwner: true, targetIsOwner: true, targetRole: 'superadmin' })).toMatchObject({ outcome: 'deny' });
  });

  it('is unchanged for everyone else', () => {
    expect(run({}).outcome).toBe('allow');
    expect(run({ actor: { uid: 'a', role: 'agent' } })).toMatchObject({ outcome: 'deny', status: 403 });
  });
});

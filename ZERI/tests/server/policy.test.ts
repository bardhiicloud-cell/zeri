import { describe, expect, it } from 'vitest';
import { checkMessageParties, checkRoleChange, mayUseSection } from '../../server/policy';

const base = {
  actorUid: 'actor',
  actorRole: 'admin',
  targetUid: 'target',
  currentTargetRole: 'agent',
  nextRole: 'approver',
};

describe('checkRoleChange', () => {
  it('lets an admin reassign frontline staff', () => {
    expect(checkRoleChange(base)).toEqual({ outcome: 'allow' });
  });

  it('rejects unknown roles with 400', () => {
    expect(checkRoleChange({ ...base, nextRole: 'owner' })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(checkRoleChange({ ...base, nextRole: 'municipality' })).toMatchObject({ outcome: 'deny', status: 400 });
  });

  it('accepts moderator, which the create route already allows', () => {
    expect(checkRoleChange({ ...base, nextRole: 'moderator' })).toEqual({ outcome: 'allow' });
  });

  it('requires the caller to be an admin or superadmin', () => {
    for (const actorRole of ['agent', 'approver', 'adsadmin', 'newsadmin', 'citizen', '']) {
      expect(checkRoleChange({ ...base, actorRole }), actorRole).toMatchObject({ outcome: 'deny', status: 403 });
    }
  });

  it('stops anyone changing their own role or access, even a superadmin', () => {
    const own = { ...base, actorUid: 'same', targetUid: 'same' };
    expect(checkRoleChange({ ...own, actorRole: 'superadmin', currentTargetRole: 'superadmin', nextRole: 'agent' }))
      .toMatchObject({ outcome: 'deny', status: 400 });
    expect(checkRoleChange({ ...own, actorRole: 'admin', currentTargetRole: 'admin', nextRole: 'agent' }))
      .toMatchObject({ outcome: 'deny', status: 400 });
  });

  it('reserves granting admin or superadmin to a superadmin', () => {
    expect(checkRoleChange({ ...base, nextRole: 'admin' })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(checkRoleChange({ ...base, nextRole: 'superadmin' })).toMatchObject({ outcome: 'deny', status: 403 });
    expect(checkRoleChange({ ...base, actorRole: 'superadmin', nextRole: 'admin' })).toEqual({ outcome: 'allow' });
  });

  it('stops a plain admin demoting or banning another admin (new)', () => {
    expect(checkRoleChange({ ...base, currentTargetRole: 'admin', nextRole: 'agent' }))
      .toMatchObject({ outcome: 'deny', status: 403 });
    expect(checkRoleChange({ ...base, currentTargetRole: 'superadmin', nextRole: 'agent' }))
      .toMatchObject({ outcome: 'deny', status: 403 });
    expect(checkRoleChange({ ...base, actorRole: 'superadmin', currentTargetRole: 'admin', nextRole: 'agent' }))
      .toEqual({ outcome: 'allow' });
  });
});

describe('checkMessageParties', () => {
  it('allows staff <-> municipality in either direction', () => {
    expect(checkMessageParties('admin', 'municipality')).toEqual({ outcome: 'allow' });
    expect(checkMessageParties('superadmin', 'municipality')).toEqual({ outcome: 'allow' });
    expect(checkMessageParties('approver', 'municipality')).toEqual({ outcome: 'allow' });
    expect(checkMessageParties('municipality', 'admin')).toEqual({ outcome: 'allow' });
  });

  it('refuses citizens, guests and municipality-to-municipality', () => {
    expect(checkMessageParties('citizen', 'admin')).toMatchObject({ outcome: 'deny', status: 403 });
    expect(checkMessageParties('guest', 'municipality')).toMatchObject({ outcome: 'deny', status: 403 });
    expect(checkMessageParties('admin', 'citizen')).toMatchObject({ outcome: 'deny', status: 403 });
    expect(checkMessageParties('municipality', 'municipality')).toMatchObject({ outcome: 'deny', status: 403 });
    expect(checkMessageParties('admin', 'admin')).toMatchObject({ outcome: 'deny', status: 403 });
    expect(checkMessageParties('', '')).toMatchObject({ outcome: 'deny', status: 403 });
  });
});

describe('mayUseSection — the UI policy, enforced from token data', () => {
  it('gives admins and superadmins every section', () => {
    expect(mayUseSection({ role: 'admin', permissions: [] }, 'users')).toBe(true);
    expect(mayUseSection({ role: 'superadmin', permissions: [] }, 'security')).toBe(true);
  });

  it('keeps ads and news editors out of the user directory and work-fact review', () => {
    for (const role of ['adsadmin', 'newsadmin']) {
      expect(mayUseSection({ role, permissions: [] }, 'users'), role).toBe(false);
      expect(mayUseSection({ role, permissions: [] }, 'workfacts'), role).toBe(false);
      expect(mayUseSection({ role, permissions: [] }, 'security'), role).toBe(false);
    }
  });

  it('follows the role table for approvers and agents', () => {
    expect(mayUseSection({ role: 'approver', permissions: [] }, 'workfacts')).toBe(true);
    expect(mayUseSection({ role: 'approver', permissions: [] }, 'users')).toBe(false);
    expect(mayUseSection({ role: 'agent', permissions: [] }, 'workfacts')).toBe(false);
    expect(mayUseSection({ role: 'agent', permissions: [] }, 'reports')).toBe(true);
  });

  it('honours an explicit per-section grant from the token', () => {
    expect(mayUseSection({ role: 'agent', permissions: ['users'] }, 'users')).toBe(true);
    expect(mayUseSection({ role: 'moderator', permissions: ['reports'] }, 'reports')).toBe(true);
    expect(mayUseSection({ role: 'moderator', permissions: [] }, 'reports')).toBe(false);
  });

  it('gives a citizen nothing', () => {
    expect(mayUseSection({ role: 'citizen', permissions: [] }, 'dashboard')).toBe(false);
  });
});

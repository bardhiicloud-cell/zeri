import { describe, expect, it } from 'vitest';
import {
  CLAIM_ROLES,
  MAX_CLAIMS_BYTES,
  STAFF_ROLES,
  buildRoleClaims,
  claimsByteLength,
  reconcileClaims,
  sanitizePermissions,
} from '../../server/roleClaims';

/**
 * The Firestore rules test boolean flags; the server and UI test `role`.
 * These tests pin the mapping between the two so it cannot drift.
 */
describe('buildRoleClaims — flags the Firestore rules depend on', () => {
  it.each([
    ['admin', { admin: true }],
    ['superadmin', { admin: true, superadmin: true }],
    ['approver', { approver: true }],
    ['adsadmin', { adsadmin: true }],
    ['newsadmin', { newsadmin: true }],
    ['agent', { agent: true }],
    ['responder', { agent: true }],
    ['dispatcher', { agent: true }],
    ['moderator', { agent: true }],
    ['monitor', { monitor: true }],
  ])('%s carries its rules flag(s)', (role, flags) => {
    expect(buildRoleClaims(role, [])).toMatchObject({ role, ...flags });
  });

  it('gives every staff role at least one rules flag', () => {
    for (const role of STAFF_ROLES) {
      const claims = buildRoleClaims(role, []);
      const flags = Object.keys(claims).filter((key) => !['role', 'permissions'].includes(key));
      expect(flags.length, role).toBeGreaterThan(0);
    }
  });

  it('writes municipality_account and the municipality name for a municipality', () => {
    expect(buildRoleClaims('municipality', ['reports'], 'Prizren')).toMatchObject({
      role: 'municipality',
      municipality_account: true,
      municipality: 'Prizren',
      perm_reports: true,
    });
  });

  it('omits the municipality claim when no name is supplied', () => {
    expect(buildRoleClaims('municipality', [])).not.toHaveProperty('municipality');
  });

  it('flattens section permissions to perm_* and ignores non-identifiers', () => {
    const claims = buildRoleClaims('agent', ['reports', '*', 'bad name']);
    expect(claims).toMatchObject({ perm_reports: true });
    expect(claims).not.toHaveProperty('perm_*');
    expect(Object.keys(claims).some((key) => key.includes(' '))).toBe(false);
  });

  it('stays under the Firebase claims limit with every section granted', () => {
    const sections = [
      'dashboard', 'updates', 'reports', 'workfacts', 'health', 'donations', 'users', 'forum', 'polls',
      'agents', 'municipalities', 'monitoring', 'monitorim', 'agentpanel', 'komunapanel', 'moderim',
      'support', 'chat', 'ads', 'notifications', 'news', 'categories', 'security', 'settings',
    ];
    expect(claimsByteLength(buildRoleClaims('agent', sections))).toBeLessThan(MAX_CLAIMS_BYTES);
  });
});

describe('sanitizePermissions', () => {
  it('keeps identifiers, drops everything else, removes duplicates', () => {
    expect(sanitizePermissions(['reports', 'reports', '*', '', 7, 'a-b'])).toEqual(['reports']);
    expect(sanitizePermissions('reports')).toEqual([]);
  });
});

describe('reconcileClaims', () => {
  it('adds the superadmin flag the owner bootstrap script used to forget', () => {
    const legacyOwner = { role: 'superadmin', admin: true };
    const result = reconcileClaims(legacyOwner, { role: 'superadmin', permissions: ['*'] });
    expect(result.conflicts).toEqual([]);
    expect(result.changes).toContain('+superadmin');
    expect(result.next).toMatchObject({ role: 'superadmin', admin: true, superadmin: true });
  });

  it('is idempotent: reconciling its own output changes nothing', () => {
    const first = reconcileClaims({ role: 'agent' }, { role: 'agent' });
    const second = reconcileClaims(first.next, { role: 'agent' });
    expect(first.changes.length).toBeGreaterThan(0);
    expect(second.changes).toEqual([]);
    expect(second.conflicts).toEqual([]);
  });

  it('never changes an existing role claim; a disagreement is a conflict', () => {
    const existing = { role: 'admin', admin: true };
    const result = reconcileClaims(existing, { role: 'agent' });
    expect(result.conflicts[0]).toMatch(/differs from profile role/);
    expect(result.changes).toEqual([]);
    expect(result.next).toBe(existing);
  });

  it('treats a citizen profile as out of scope', () => {
    expect(reconcileClaims({}, { role: 'citizen' }).conflicts.length).toBe(1);
    expect(reconcileClaims({}, { role: 'user' }).conflicts.length).toBe(1);
    expect(CLAIM_ROLES.has('citizen')).toBe(false);
  });

  it('preserves claims it does not own', () => {
    const result = reconcileClaims({ role: 'agent', beta_tester: true }, { role: 'agent' });
    expect(result.next).toMatchObject({ beta_tester: true, agent: true });
  });

  it('removes stale managed flags that no longer match the role', () => {
    const result = reconcileClaims({ role: 'agent', agent: true, admin: true, perm_users: true, permissions: [] }, { role: 'agent' });
    expect(result.changes).toEqual(expect.arrayContaining(['-admin', '-perm_users']));
    expect(result.next).not.toHaveProperty('admin');
  });

  describe('profile-derived data is not trusted by default', () => {
    it('holds profile permissions back until accepted', () => {
      const profile = { role: 'approver', permissions: ['agents', 'users'] };
      const held = reconcileClaims({ role: 'approver' }, profile);
      expect(held.pending[0]).toMatch(/permissions from profile: agents, users/);
      expect(held.next).not.toHaveProperty('perm_agents');

      const accepted = reconcileClaims({ role: 'approver' }, profile, { acceptProfileData: true });
      expect(accepted.pending).toEqual([]);
      expect(accepted.next).toMatchObject({ perm_agents: true, perm_users: true });
    });

    it('prefers permissions already in the token over the profile', () => {
      const result = reconcileClaims(
        { role: 'approver', permissions: ['reports'] },
        { role: 'approver', permissions: ['agents'] },
        { acceptProfileData: true }
      );
      expect(result.next).toMatchObject({ permissions: ['reports'], perm_reports: true });
      expect(result.next).not.toHaveProperty('perm_agents');
    });

    it('lets a reviewed second pass import permissions after a role-only first pass', () => {
      const profile = { role: 'agent', permissions: ['reports', 'agents'] };
      const firstPass = reconcileClaims({}, profile); // safe mode: writes permissions: []
      expect(firstPass.next).toMatchObject({ role: 'agent', agent: true, permissions: [] });
      expect(firstPass.pending.length).toBe(1);

      const secondPass = reconcileClaims(firstPass.next, profile, { acceptProfileData: true });
      expect(secondPass.pending).toEqual([]);
      expect(secondPass.next).toMatchObject({ permissions: ['reports', 'agents'], perm_reports: true, perm_agents: true });
    });

    it('holds a municipality name from the profile until accepted', () => {
      const profile = { role: 'municipality', municipality: 'Gjilan' };
      const held = reconcileClaims({ role: 'municipality' }, profile);
      expect(held.pending[0]).toMatch(/municipality from profile: Gjilan/);
      expect(held.next).not.toHaveProperty('municipality');

      const accepted = reconcileClaims({ role: 'municipality' }, profile, { acceptProfileData: true });
      expect(accepted.next).toMatchObject({ municipality: 'Gjilan', municipality_account: true });
    });

    it('keeps the token municipality even if the profile was edited to another one', () => {
      const result = reconcileClaims(
        { role: 'municipality', municipality: 'Prizren' },
        { role: 'municipality', municipality: 'Prishtinë' },
        { acceptProfileData: true }
      );
      expect(result.next).toMatchObject({ municipality: 'Prizren' });
    });

    it('flags a municipality account that has no municipality anywhere', () => {
      const result = reconcileClaims({ role: 'municipality' }, { role: 'municipality' });
      expect(result.conflicts[0]).toMatch(/no municipality/);
    });

    it('gives admins no section list from the profile', () => {
      const result = reconcileClaims({}, { role: 'admin', permissions: ['reports'] }, { acceptProfileData: true });
      expect(result.pending).toEqual([]);
      expect(result.next).not.toHaveProperty('perm_reports');
    });
  });

  it('refuses a result that would exceed the Firebase claims limit', () => {
    const result = reconcileClaims(
      { role: 'municipality', municipality: 'M'.repeat(1100) },
      { role: 'municipality' }
    );
    expect(result.conflicts[0]).toMatch(/bytes/);
    expect(result.changes).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  ALL_ADMIN_ROLES,
  CLEARANCE_LABELS,
  CLEARANCE_ORDER,
  ROLE_CATALOG,
  SECTION_LABELS,
  SECTION_ORDER,
  isFullAccess,
  roleProfile,
  sectionsForRole,
} from '../../src/lib/roleCatalog';

describe('role catalog', () => {
  it('looks roles up and ignores citizens, unknown and empty values', () => {
    expect(roleProfile('admin')?.role).toBe('admin');
    expect(roleProfile('citizen')).toBeUndefined();
    expect(roleProfile('nonsense')).toBeUndefined();
    expect(roleProfile(null)).toBeUndefined();
    expect(roleProfile('')).toBeUndefined();
  });

  it('lists each role once', () => {
    const roles = ROLE_CATALOG.map((entry) => entry.role);
    expect(new Set(roles).size).toBe(roles.length);
  });

  it('describes every role with a known clearance and only known sections', () => {
    for (const entry of ROLE_CATALOG) {
      expect(CLEARANCE_ORDER, entry.role).toContain(entry.clearance);
      for (const section of entry.sections) expect(SECTION_ORDER, `${entry.role}: ${section}`).toContain(section);
    }
  });

  it('has a label for every section and clearance', () => {
    for (const section of SECTION_ORDER) expect(SECTION_LABELS[section], section).toBeTruthy();
    for (const level of CLEARANCE_ORDER) expect(CLEARANCE_LABELS[level], level).toBeTruthy();
  });

  it('returns a role’s sections in reading order, and none for an unknown role', () => {
    const sections = sectionsForRole('admin');
    const positions = sections.map((section) => SECTION_ORDER.indexOf(section));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(sectionsForRole('citizen')).toEqual([]);
  });

  it('knows full access: the administrators have it, field staff do not', () => {
    expect(isFullAccess(sectionsForRole('superadmin'))).toBe(true);
    expect(isFullAccess(sectionsForRole('agent'))).toBe(false);
    expect(isFullAccess([])).toBe(false);
  });

  it('covers the roles the permission code knows about', () => {
    const catalogued = new Set(ROLE_CATALOG.map((entry) => entry.role as string));
    for (const role of ALL_ADMIN_ROLES) expect(catalogued.has(role) || role === 'monitor', role).toBe(true);
  });
});

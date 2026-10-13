import { describe, expect, it } from 'vitest';
import { hashForSection, paramsFromHash, sectionFromHash } from '../../src/lib/adminDeepLink';
import { FULL_ACCESS } from '../../src/lib/adminPermissions';

describe('sectionFromHash', () => {
  it('reads the plain, slashed and nested forms of a section', () => {
    expect(sectionFromHash('#reports', FULL_ACCESS)).toBe('reports');
    expect(sectionFromHash('#/reports', FULL_ACCESS)).toBe('reports');
    expect(sectionFromHash('#/admin/reports', FULL_ACCESS)).toBe('reports');
    expect(sectionFromHash('#/ADMIN/Reports', FULL_ACCESS)).toBe('reports');
  });

  it('keeps the legacy /approvals link working', () => {
    expect(sectionFromHash('#/approvals', FULL_ACCESS)).toBe('reports');
    expect(sectionFromHash('#approvals', FULL_ACCESS)).toBe('reports');
  });

  it('matches whole segments only, never a fragment of a longer word', () => {
    expect(sectionFromHash('#/adsense', FULL_ACCESS)).toBeNull();
    expect(sectionFromHash('#/agentpanel', FULL_ACCESS)).toBe('agentpanel');
    expect(sectionFromHash('#/agent', FULL_ACCESS)).toBeNull();
  });

  it('ignores a query string after the section', () => {
    expect(sectionFromHash('#/reports?id=abc', FULL_ACCESS)).toBe('reports');
  });

  it('returns null for an empty or unknown hash', () => {
    expect(sectionFromHash('', FULL_ACCESS)).toBeNull();
    expect(sectionFromHash('#', FULL_ACCESS)).toBeNull();
    expect(sectionFromHash('#/nonsense', FULL_ACCESS)).toBeNull();
  });

  it('only resolves sections the caller says exist', () => {
    expect(sectionFromHash('#reports', ['dashboard', 'ads'])).toBeNull();
  });
});

describe('hashForSection', () => {
  it('leaves the dashboard as the bare URL and names every other section', () => {
    expect(hashForSection('dashboard')).toBe('');
    expect(hashForSection('reports')).toBe('#reports');
  });

  it('round-trips through sectionFromHash for every section', () => {
    for (const section of FULL_ACCESS) {
      const hash = hashForSection(section);
      expect(sectionFromHash(hash, FULL_ACCESS)).toBe(hash === '' ? null : section);
    }
  });
});

describe('link parameters', () => {
  it('writes and reads a parameter after the section', () => {
    const hash = hashForSection('reports', { open: 'abc123' });
    expect(hash).toBe('#reports?open=abc123');
    expect(paramsFromHash(hash)).toEqual({ open: 'abc123' });
    expect(sectionFromHash(hash, FULL_ACCESS)).toBe('reports');
  });

  it('encodes awkward ids so they cannot be mistaken for another section or segment', () => {
    const hash = hashForSection('reports', { open: 'a/b?c&d=e' });
    expect(paramsFromHash(hash)).toEqual({ open: 'a/b?c&d=e' });
    expect(sectionFromHash(hash, FULL_ACCESS)).toBe('reports');
  });

  it('omits empty parameters and has none when there is no query', () => {
    expect(hashForSection('reports', { open: '' })).toBe('#reports');
    expect(paramsFromHash('#reports')).toEqual({});
    expect(paramsFromHash('')).toEqual({});
  });

  it('ignores a malformed escape instead of failing', () => {
    expect(paramsFromHash('#reports?open=%E0%A4%A&ok=1')).toEqual({ ok: '1' });
  });
});

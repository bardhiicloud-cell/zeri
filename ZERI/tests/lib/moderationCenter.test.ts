import { describe, expect, it } from 'vitest';
import {
  classifyRisk,
  collectAgents,
  collectMunicipalities,
  computeQueueStats,
  countFlaggedWords,
  filterReports,
  isAgentRole,
  MATRIX_SECTIONS,
  ROLE_MATRIX,
  ROLE_MATRIX_LABELS,
} from '../../src/lib/moderationCenter';
import type { Report } from '../../src/types';

const report = (over: Partial<Report>): Report =>
  ({
    id: 'r1',
    title: 'Gropë në rrugë',
    description: 'Një gropë e madhe',
    status: 'Pending Review',
    createdAt: '2026-01-01T00:00:00.000Z',
    location: { municipality: 'Prishtinë' },
    ...over,
  }) as Report;

describe('staff classification', () => {
  it('recognises the field roles only', () => {
    expect(['agent', 'responder', 'dispatcher'].every(isAgentRole)).toBe(true);
    expect(isAgentRole('admin')).toBe(false);
    expect(isAgentRole(undefined)).toBe(false);
  });

  it('splits agents from municipality accounts', () => {
    const users = [{ role: 'agent' }, { role: 'municipality' }, { role: 'admin' }, { role: 'dispatcher' }];
    expect(collectAgents(users)).toHaveLength(2);
    expect(collectMunicipalities(users)).toEqual([{ role: 'municipality' }]);
  });
});

describe('computeQueueStats', () => {
  it('counts each status and folds assigned work into "approved"', () => {
    const stats = computeQueueStats([
      report({ status: 'Pending Review' }),
      report({ status: 'Approved' }),
      report({ status: 'Assigned' }),
      report({ status: 'In Progress' }),
      report({ status: 'Rejected' }),
      report({ status: 'Overdue' }),
    ]);
    expect(stats).toMatchObject({ total: 6, pendingReview: 1, approved: 3, inProgress: 1, rejected: 1, overdue: 1, resolved: 0 });
  });

  it('averages resolution time in hours over resolved reports with valid dates', () => {
    const stats = computeQueueStats([
      report({ status: 'Resolved', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T10:00:00Z' }),
      report({ status: 'Resolved', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T20:00:00Z' }),
      report({ status: 'Resolved', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }), // ends before it starts: ignored
      report({ status: 'Resolved', createdAt: 'not a date', updatedAt: '2026-01-01T00:00:00Z' }), // unparsable: ignored
    ]);
    expect(stats.resolved).toBe(4);
    expect(stats.avgResolutionHours).toBe(15);
  });

  it('reports 0 hours rather than NaN when nothing is resolved', () => {
    expect(computeQueueStats([]).avgResolutionHours).toBe(0);
    expect(computeQueueStats([report({ status: 'Approved' })]).avgResolutionHours).toBe(0);
  });
});

describe('filterReports', () => {
  const reports = [
    report({ id: 'a', title: 'Gropë', status: 'Approved', location: { municipality: 'Prishtinë' } as Report['location'] }),
    report({ id: 'b', title: 'Mbeturina', description: 'Pranë shkollës', status: 'Resolved', location: { municipality: 'Prizren' } as Report['location'] }),
  ];

  it('filters by status, municipality and a case-insensitive query over title, description and municipality', () => {
    expect(filterReports(reports, 'all', '')).toHaveLength(2);
    expect(filterReports(reports, 'Resolved', '').map((r) => r.id)).toEqual(['b']);
    expect(filterReports(reports, 'all', '', 'Prishtinë').map((r) => r.id)).toEqual(['a']);
    expect(filterReports(reports, 'all', '  SHKOLL ').map((r) => r.id)).toEqual(['b']);
    expect(filterReports(reports, 'all', 'prizren').map((r) => r.id)).toEqual(['b']);
    expect(filterReports(reports, 'Approved', 'mbeturina')).toEqual([]);
  });
});

describe('risk classification', () => {
  const bad = ['idiot', 'budall'];

  it('counts distinct flagged words case-insensitively', () => {
    expect(countFlaggedWords('Ti IDIOT!', bad)).toBe(1);
    expect(countFlaggedWords('idiot dhe budall', bad)).toBe(2);
    expect(countFlaggedWords('tekst i pastër', bad)).toBe(0);
  });

  it('is clean, suspect or a violation by the number of hits', () => {
    expect(classifyRisk('tekst i pastër', bad)).toBe('clean');
    expect(classifyRisk('ti idiot', bad)).toBe('suspect');
    expect(classifyRisk('idiot budall', bad)).toBe('violation');
    expect(classifyRisk('ti idiot', bad, 1)).toBe('violation');
  });
});

describe('role matrix', () => {
  it('has a label for every role in the matrix', () => {
    for (const role of Object.keys(ROLE_MATRIX)) expect(ROLE_MATRIX_LABELS[role], role).toBeTruthy();
  });

  it('only grants sections the matrix knows about (or everything)', () => {
    const known = new Set<string>([...MATRIX_SECTIONS, 'debate', 'categories']);
    for (const [role, sections] of Object.entries(ROLE_MATRIX)) {
      for (const section of sections) expect(section === '*' || known.has(section), `${role}: ${section}`).toBe(true);
    }
  });
});

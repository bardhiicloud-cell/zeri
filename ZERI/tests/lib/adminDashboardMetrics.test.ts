import { describe, expect, it } from 'vitest';
import type { HealthCase, Report } from '../../src/types';
import { classifyService, SLOW_RESPONSE_MS } from '../../src/lib/useServiceHealth';
import {
  ageOf,
  bucketOf,
  breakdownByMunicipality,
  humanizeHours,
  registryMunicipality,
  summarizeReports,
  topCategories,
  unnotifiedUrgentCases,
} from '../../src/lib/adminDashboardMetrics';

const NOW = Date.parse('2026-10-11T12:00:00.000Z');
const hoursAgo = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

function report(overrides: Partial<Report> & { municipality?: string } = {}): Report {
  const { municipality, ...rest } = overrides;
  return {
    id: Math.random().toString(36).slice(2),
    title: 't',
    description: 'd',
    category: 'Infrastrukturë',
    urgency: 'Mesatare',
    location: { lat: 0, lng: 0, municipality: municipality ?? 'Prishtinë' },
    images: [],
    status: 'Pending Review',
    createdAt: hoursAgo(1),
    upvotes: 0,
    commentsCount: 0,
    authorId: 'a',
    authorName: 'n',
    isAnonymous: false,
    timeline: [],
    ...rest,
  } as Report;
}

function healthCase(overrides: Partial<HealthCase> = {}): HealthCase {
  return {
    id: Math.random().toString(36).slice(2),
    urgency: 'Mesatare',
    municipality: 'Prishtinë',
    ...overrides,
  } as HealthCase;
}

describe('bucketOf', () => {
  it('groups the lifecycle into the buckets the dashboard shows', () => {
    expect(bucketOf('Pending Review')).toBe('pending');
    expect(bucketOf('Approved')).toBe('active');
    expect(bucketOf('Assigned')).toBe('active');
    expect(bucketOf('In Progress')).toBe('active');
    expect(bucketOf('Overdue')).toBe('overdue');
    expect(bucketOf('Resolved')).toBe('resolved');
    expect(bucketOf('Rejected')).toBe('closed');
    expect(bucketOf('Closed')).toBe('closed');
  });

  it('treats an unknown or missing status as draft, never as work to do', () => {
    expect(bucketOf('Archived')).toBe('draft');
    expect(bucketOf(undefined)).toBe('draft');
    expect(bucketOf(null)).toBe('draft');
  });
});

describe('summarizeReports', () => {
  it('counts every bucket and the total', () => {
    const summary = summarizeReports(
      [
        report({ status: 'Pending Review' }),
        report({ status: 'Pending Review' }),
        report({ status: 'In Progress' }),
        report({ status: 'Resolved' }),
        report({ status: 'Rejected' }),
        report({ status: 'Overdue' }),
      ],
      NOW
    );
    expect(summary).toMatchObject({ total: 6, pending: 2, active: 1, resolved: 1, closed: 1, overdue: 1 });
  });

  it('flags only critical reports that are still waiting', () => {
    const summary = summarizeReports(
      [
        report({ urgency: 'Kritike', status: 'Pending Review' }),
        report({ urgency: 'Kritike', status: 'Overdue' }),
        report({ urgency: 'Kritike', status: 'Resolved' }),
        report({ urgency: 'E ulët', status: 'Pending Review' }),
      ],
      NOW
    );
    expect(summary.criticalPending).toBe(2);
  });

  it('counts an SLA breach from the Overdue status or from a passed deadline', () => {
    const summary = summarizeReports(
      [
        report({ status: 'Overdue' }),
        report({ status: 'In Progress', responseDueAt: hoursAgo(5) }),
        report({ status: 'In Progress', responseDueAt: new Date(NOW + 3_600_000).toISOString() }),
        // A resolved report past its old deadline is not a breach any more.
        report({ status: 'Resolved', responseDueAt: hoursAgo(50) }),
      ],
      NOW
    );
    expect(summary.slaBreached).toBe(2);
  });

  it('flags a pending report only after the stale threshold', () => {
    const summary = summarizeReports(
      [
        report({ createdAt: hoursAgo(71) }),
        report({ createdAt: hoursAgo(73) }),
        report({ createdAt: hoursAgo(200), status: 'Approved' }),
      ],
      NOW
    );
    expect(summary.stalePending).toBe(1);
  });

  it('averages resolution time and ignores rows with corrupt timestamps', () => {
    const summary = summarizeReports(
      [
        report({ status: 'Resolved', createdAt: hoursAgo(30), resolvedAt: hoursAgo(20) }), // 10h
        report({ status: 'Resolved', createdAt: hoursAgo(50), resolvedAt: hoursAgo(20) }), // 30h
        report({ status: 'Resolved', createdAt: hoursAgo(10), resolvedAt: hoursAgo(40) }), // resolved before created
        report({ status: 'Resolved', createdAt: hoursAgo(10) }), // no resolvedAt
        report({ status: 'Resolved', createdAt: 'not a date', resolvedAt: hoursAgo(1) }),
      ],
      NOW
    );
    expect(summary.avgResolutionHours).toBeCloseTo(20, 5);
  });

  it('reports no average, not zero, when nothing was resolved', () => {
    expect(summarizeReports([report()], NOW).avgResolutionHours).toBeNull();
    expect(summarizeReports([], NOW)).toMatchObject({ total: 0, avgResolutionHours: null });
  });
});

describe('registryMunicipality', () => {
  it('accepts exact names, other casings and diacritic-free spellings', () => {
    expect(registryMunicipality('Prishtinë')).toBe('Prishtinë');
    expect(registryMunicipality('PRISHTINË')).toBe('Prishtinë');
    expect(registryMunicipality('prishtine')).toBe('Prishtinë');
  });

  it('resolves common alternative spellings through the alias table', () => {
    expect(registryMunicipality('Pristina')).toBe('Prishtinë');
    expect(registryMunicipality('Peja')).toBe('Pejë');
  });

  it('returns null for blanks and for names outside Kosovo', () => {
    expect(registryMunicipality('')).toBeNull();
    expect(registryMunicipality('   ')).toBeNull();
    expect(registryMunicipality(undefined)).toBeNull();
    expect(registryMunicipality('Tiranë')).toBeNull();
  });
});

describe('breakdownByMunicipality', () => {
  it('always returns all 38 municipalities, including those with no data', () => {
    const { rows } = breakdownByMunicipality([], []);
    expect(rows).toHaveLength(38);
    expect(rows.every((row) => row.total === 0 && row.resolutionRate === null)).toBe(true);
  });

  it('groups different spellings of one municipality together', () => {
    const { rows } = breakdownByMunicipality(
      [
        report({ municipality: 'Prishtinë' }),
        report({ municipality: 'PRISHTINE' }),
        report({ municipality: 'Pristina', status: 'Resolved' }),
      ],
      []
    );
    const prishtine = rows.find((row) => row.name === 'Prishtinë')!;
    expect(prishtine).toMatchObject({ total: 3, pending: 2, resolved: 1, resolutionRate: 33 });
  });

  it('counts reports it cannot place instead of dropping them silently', () => {
    const result = breakdownByMunicipality(
      [report({ municipality: 'Tiranë' }), report({ municipality: '' }), report({ municipality: 'Prizren' })],
      []
    );
    expect(result.unassignedReports).toBe(2);
    expect(result.rows.find((row) => row.name === 'Prizren')!.total).toBe(1);
  });

  it('adds health cases to the same rows and sorts the busiest first', () => {
    const { rows } = breakdownByMunicipality(
      [report({ municipality: 'Prizren' })],
      [healthCase({ municipality: 'Gjakovë' }), healthCase({ municipality: 'Gjakova' })]
    );
    expect(rows[0]).toMatchObject({ name: 'Gjakovë', health: 2, total: 0 });
    expect(rows[1]).toMatchObject({ name: 'Prizren', total: 1 });
  });

  it('reports a 0% rate, not null, when reports exist but none are resolved', () => {
    const { rows } = breakdownByMunicipality([report({ municipality: 'Ferizaj' })], []);
    expect(rows.find((row) => row.name === 'Ferizaj')!.resolutionRate).toBe(0);
  });
});

describe('topCategories', () => {
  it('ranks by count, breaks ties alphabetically and respects the limit', () => {
    const result = topCategories(
      [
        report({ category: 'Rrugë' }),
        report({ category: 'Rrugë' }),
        report({ category: 'Ujë' }),
        report({ category: 'Drita' }),
        report({ category: '' }),
      ],
      3
    );
    expect(result).toEqual([
      { category: 'Rrugë', count: 2 },
      { category: 'Drita', count: 1 },
      { category: 'Të tjera', count: 1 },
    ]);
  });
});

describe('unnotifiedUrgentCases', () => {
  it('counts urgent cases whose hospital has not been told', () => {
    expect(
      unnotifiedUrgentCases([
        healthCase({ urgency: 'Urgjente', hospitalNotified: false }),
        healthCase({ urgency: 'Urgjente' }),
        healthCase({ urgency: 'Urgjente', hospitalNotified: true }),
        healthCase({ urgency: 'Mesatare' }),
      ])
    ).toBe(2);
  });
});

describe('humanizeHours', () => {
  it('switches to days after two days and never rounds down to zero hours', () => {
    expect(humanizeHours(0.2)).toEqual({ value: 1, unit: 'hours' });
    expect(humanizeHours(5.4)).toEqual({ value: 5, unit: 'hours' });
    expect(humanizeHours(47)).toEqual({ value: 47, unit: 'hours' });
    expect(humanizeHours(72)).toEqual({ value: 3, unit: 'days' });
  });
});

describe('ageOf', () => {
  it('picks the largest unit that reads naturally', () => {
    expect(ageOf(hoursAgo(0), NOW)).toEqual({ value: 0, unit: 'now' });
    expect(ageOf(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toEqual({ value: 5, unit: 'minutes' });
    expect(ageOf(hoursAgo(3), NOW)).toEqual({ value: 3, unit: 'hours' });
    expect(ageOf(hoursAgo(24), NOW)).toEqual({ value: 1, unit: 'days' });
    expect(ageOf(hoursAgo(24 * 9 + 5), NOW)).toEqual({ value: 9, unit: 'days' });
  });

  it('never goes negative when the viewer clock is behind the timestamp', () => {
    expect(ageOf(new Date(NOW + 90_000).toISOString(), NOW)).toEqual({ value: 0, unit: 'now' });
  });

  it('returns null for a missing or unparseable date', () => {
    expect(ageOf(undefined, NOW)).toBeNull();
    expect(ageOf('yesterday-ish', NOW)).toBeNull();
  });
});

describe('classifyService', () => {
  const healthy = { reachable: true, latencyMs: 40, dataSource: 'firestore' };

  it('is ok only when reachable, backed by Firestore and not slow', () => {
    expect(classifyService(healthy, true)).toBe('ok');
  });

  it('is down when the API does not answer or the browser is offline', () => {
    expect(classifyService({ reachable: false, latencyMs: null, dataSource: null }, true)).toBe('down');
    expect(classifyService(healthy, false)).toBe('down');
  });

  it('is degraded when the server has no data source or answers slowly', () => {
    expect(classifyService({ ...healthy, dataSource: 'unavailable' }, true)).toBe('degraded');
    expect(classifyService({ ...healthy, dataSource: null }, true)).toBe('degraded');
    expect(classifyService({ ...healthy, latencyMs: SLOW_RESPONSE_MS + 1 }, true)).toBe('degraded');
    expect(classifyService({ ...healthy, latencyMs: SLOW_RESPONSE_MS }, true)).toBe('ok');
  });
});

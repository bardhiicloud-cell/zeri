import { describe, expect, it } from 'vitest';
import { durations, monthsBetween, parseQuery, summarize, STATUSES, type StatusCounts } from '../../server/transparency';

const counts = (patch: Partial<StatusCounts>): StatusCounts => ({
  'Pending Review': 0, Approved: 0, Assigned: 0, 'In Progress': 0, Overdue: 0, Resolved: 0, Closed: 0, Rejected: 0, ...patch,
});

describe('summarize', () => {
  it('derives every figure from the per-status counts', () => {
    const s = summarize(counts({ 'Pending Review': 10, Approved: 20, 'In Progress': 15, Assigned: 5, Overdue: 5, Resolved: 40, Closed: 10, Rejected: 20 }));
    expect(s).toMatchObject({ received: 125, awaitingReview: 10, published: 95, inProgress: 20, resolved: 50, rejected: 20, overdue: 5 });
  });

  it('says what each rate is divided by', () => {
    const s = summarize(counts({ Approved: 20, 'In Progress': 15, Overdue: 5, Resolved: 40, Closed: 10, Rejected: 20, 'Pending Review': 99 }));
    // published = 20+15+5+40+10 = 90; decided = 90 + 20; open = 90 - 50 = 40
    expect(s.rates.acceptanceRate).toBe(81.8);
    expect(s.rates.resolutionRate).toBe(55.6);
    expect(s.rates.overdueShare).toBe(12.5);
  });

  it('does not count what is still waiting as accepted or rejected', () => {
    const s = summarize(counts({ 'Pending Review': 1000, Resolved: 1 }));
    expect(s.rates.acceptanceRate).toBe(100);
    expect(s.published).toBe(1);
  });

  it('returns null, never 0 and never invented, when there is nothing to divide by', () => {
    expect(summarize(counts({})).rates).toEqual({ acceptanceRate: null, resolutionRate: null, overdueShare: null });
    expect(summarize(counts({ 'Pending Review': 5 })).rates.resolutionRate).toBeNull();
    expect(summarize(counts({ Resolved: 3 })).rates.overdueShare).toBeNull();
  });

  it('counts exactly the statuses it was given', () => {
    const everyOne = Object.fromEntries(STATUSES.map(status => [status, 1])) as StatusCounts;
    expect(summarize(everyOne).received).toBe(STATUSES.length);
  });
});

describe('durations', () => {
  const H = 3_600_000;
  it('averages and takes the median over reports that have both dates', () => {
    const d = durations([
      { createdMs: 0, resolvedMs: 10 * H }, { createdMs: 0, resolvedMs: 20 * H }, { createdMs: 0, resolvedMs: 90 * H },
      { createdMs: 0, resolvedMs: null }, { createdMs: null, resolvedMs: 5 * H },
    ]);
    expect(d).toEqual({ sampleSize: 3, averageHours: 40, medianHours: 20 });
  });

  it('leaves out a resolution before the filing (bad data) and reports an empty sample honestly', () => {
    expect(durations([{ createdMs: 10 * H, resolvedMs: 5 * H }])).toEqual({ sampleSize: 0, averageHours: null, medianHours: null });
    expect(durations([])).toEqual({ sampleSize: 0, averageHours: null, medianHours: null });
  });

  it('takes the middle of an even sample', () => {
    expect(durations([{ createdMs: 0, resolvedMs: 10 * H }, { createdMs: 0, resolvedMs: 30 * H }]).medianHours).toBe(20);
  });
});

describe('parseQuery', () => {
  const now = new Date('2026-10-12T12:00:00.000Z');
  it('accepts a period, a municipality and a category, with the end date inclusive', () => {
    const parsed = parseQuery({ from: '2026-01-01', to: '2026-03-31', municipality: 'Pejë', category: 'Rrugë' }, now);
    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    expect(parsed.query.from?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(parsed.query.to?.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(parsed.query).toMatchObject({ municipality: 'Pejë', category: 'Rrugë' });
  });

  it('allows no filters at all', () => {
    expect(parseQuery({}, now)).toMatchObject({ ok: true, query: { from: null, to: null, municipality: '', category: '' } });
  });

  it('refuses malformed, impossible, reversed and future dates, and non-string values', () => {
    for (const raw of [{ from: '01/02/2026' }, { to: '2026-13-40' }, { from: '2026-05-01', to: '2026-04-01' }, { to: '2030-01-01' }, { from: ['2026-01-01'] }, { municipality: { a: 1 } }, { category: 'x'.repeat(81) }]) {
      expect(parseQuery(raw as never, now), JSON.stringify(raw)).toMatchObject({ ok: false });
    }
  });
});

describe('monthsBetween', () => {
  const now = new Date('2026-10-12T12:00:00.000Z');
  it('defaults to the last twelve months, oldest first, ending with the current month', () => {
    const months = monthsBetween(null, null, now);
    expect(months).toHaveLength(12);
    expect(months[0].key).toBe('2025-11');
    expect(months[11].key).toBe('2026-10');
  });

  it('covers a chosen period month by month', () => {
    const months = monthsBetween(new Date('2026-01-15T00:00:00Z'), new Date('2026-04-01T00:00:00Z'), now);
    expect(months.map(m => m.key)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(months[0].start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(months[2].end.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('never returns more than two years', () => {
    expect(monthsBetween(new Date('2020-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'), now).length).toBeLessThanOrEqual(24);
  });
});

import { describe, expect, it } from 'vitest';
import { isReportOverdue, reportDueAt } from '../../src/lib/reportDue';

const NOW = Date.parse('2026-10-11T12:00:00.000Z');
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const ahead = (h: number) => new Date(NOW + h * 3_600_000).toISOString();
const base = { createdAt: ago(24 * 60), category: 'Infrastrukturë rrugore', status: 'Pending Review' };

describe('reportDueAt', () => {
  it('prefers the stored deadline - the one the citizen was promised', () => {
    expect(reportDueAt({ ...base, responseDueAt: ahead(10) })).toBe(ahead(10));
  });

  it('falls back to the category standard when none is stored', () => {
    const due = Date.parse(reportDueAt(base));
    expect(Number.isFinite(due)).toBe(true);
    expect(due).toBeGreaterThan(Date.parse(base.createdAt));
  });
});

describe('isReportOverdue', () => {
  it('is overdue when open and past the stored deadline', () => {
    expect(isReportOverdue({ ...base, responseDueAt: ago(1) }, NOW)).toBe(true);
  });

  it('is NOT overdue when the stored deadline is still ahead, however old the report is', () => {
    // The tab used to recompute from the category and call this overdue.
    expect(isReportOverdue({ ...base, responseDueAt: ahead(48) }, NOW)).toBe(false);
  });

  it('is never overdue once closed', () => {
    for (const status of ['Resolved', 'Rejected', 'Closed', 'Draft']) {
      expect(isReportOverdue({ ...base, status, responseDueAt: ago(500) }, NOW)).toBe(false);
    }
  });

  it('treats a stored Overdue status as late even when the deadline looks ahead', () => {
    expect(isReportOverdue({ ...base, status: 'Overdue', responseDueAt: ahead(48) }, NOW)).toBe(true);
  });

  it('covers every open stage', () => {
    for (const status of ['Pending Review', 'Approved', 'Assigned', 'In Progress', 'Overdue']) {
      expect(isReportOverdue({ ...base, status, responseDueAt: ago(1) }, NOW)).toBe(true);
    }
  });
});

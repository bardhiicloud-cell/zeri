import { getAccountabilityDueDate, getAccountabilityProfile } from './accountability';

/**
 * The response deadline of a report - the ONE place it is computed.
 *
 * The reports screen used to work it out three different ways: the row used the
 * stored `responseDueAt`, the "overdue" tab ignored it and recomputed from the
 * category, and the work inbox did the first again. The same report could be
 * "overdue" on one screen and on time on the next, and the counts disagreed
 * (12 on the tab, 2 in the inbox for the same data).
 *
 * The stored value wins when present - it is what the citizen was promised - and
 * the category's standard response time is the fallback.
 */
export function reportDueAt(report: { createdAt: string; category: string; responseDueAt?: string }): string {
  return (
    report.responseDueAt ||
    getAccountabilityDueDate(report.createdAt, getAccountabilityProfile(report.category).responseHours)
  );
}

const OPEN = ['Pending Review', 'Approved', 'Assigned', 'In Progress', 'Overdue'];

/** Open (still to be handled) and past its deadline. Closed reports are never late. */
export function isReportOverdue(
  report: { createdAt: string; category: string; status: string; responseDueAt?: string },
  now: number = Date.now()
): boolean {
  if (!OPEN.includes(report.status)) return false;
  // A report already marked Overdue (by the SLA job or a person) is late whatever
  // its recomputed deadline says; otherwise the tab and the inbox disagree.
  if (report.status === 'Overdue') return true;
  const due = Date.parse(reportDueAt(report));
  return Number.isFinite(due) && due < now;
}

import { normalizeSearch } from './adminNav';

/**
 * Filtering and due-date logic for the admin reports queue, as pure functions.
 *
 * The queue used to inline all of this in the component, which meant the filter
 * semantics (what "in progress" or "overdue" includes) could only be checked by
 * clicking through the screen, and the text search was accent-sensitive: typing
 * "prishtine" found nothing for a report in "Prishtinë".
 */

export type TimeKey = 'all' | 'daily' | 'weekly' | 'monthly';

export interface QueueFilters {
  query: string;
  /** A status tab key or a raw status such as "Assigned". Empty means all. */
  status: string;
  /** A report-topic id. Empty means all. */
  topic: string;
  time: TimeKey;
}

export const EMPTY_FILTERS: QueueFilters = { query: '', status: '', topic: '', time: 'all' };

const CLOSED_STATUSES = ['Resolved', 'Rejected', 'Closed'];
const ACTIVE_STATUSES = ['Approved', 'Assigned', 'In Progress'];

/** The tabs shown above the list, in order. `key` is what `matchesStatus` reads. */
export const STATUS_TABS: ReadonlyArray<{ key: string; label: string }> = [
  { key: '', label: 'Të gjitha' },
  { key: 'unapproved', label: 'Në pritje' },
  { key: 'in-progress', label: 'Në trajtim' },
  { key: 'overdue', label: 'Të vonuara' },
  { key: 'resolved', label: 'Të zgjidhura' },
  { key: 'rejected', label: 'Të refuzuara' },
];

/**
 * Does a report with `status` belong under the tab `key`?
 *
 * `overdue` is decided by the caller (it depends on the category's response
 * deadline, not only on the stored status), so it arrives as a flag.
 */
export function matchesStatus(status: string, key: string, isOverdue: boolean): boolean {
  switch (key) {
    case '':
      return true;
    case 'unapproved':
      return status === 'Pending Review';
    case 'in-progress':
      return ACTIVE_STATUSES.includes(status);
    case 'unresolved':
      return !CLOSED_STATUSES.includes(status);
    case 'resolved':
      return status === 'Resolved';
    case 'rejected':
      return status === 'Rejected';
    case 'overdue':
      return isOverdue;
    default:
      // A raw status ("Assigned") used by older links and saved filters.
      return status === key;
  }
}

/** Is `createdAt` inside the chosen window? An unparseable date never matches a window. */
export function matchesTime(createdAt: string, key: TimeKey, now: number): boolean {
  if (key === 'all') return true;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const today = new Date(now);
  if (key === 'daily') return created.toDateString() === today.toDateString();
  if (key === 'weekly') return created.getTime() >= now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
  return created.getTime() >= monthAgo.getTime();
}

export interface QueueContext<T> {
  now: number;
  isOverdue: (report: T) => boolean;
  /** Everything a person might search for on this report, as plain text. */
  searchText: (report: T) => string;
  /** The topic id this report belongs to, if any. */
  topicId: (report: T) => string | undefined;
}

export function filterQueue<T extends { status: string; createdAt: string }>(
  reports: readonly T[],
  filters: QueueFilters,
  context: QueueContext<T>
): T[] {
  const tokens = normalizeSearch(filters.query).split(' ').filter(Boolean);

  return reports.filter(report => {
    if (!matchesStatus(report.status, filters.status, context.isOverdue(report))) return false;
    if (!matchesTime(report.createdAt, filters.time, context.now)) return false;
    if (filters.topic && context.topicId(report) !== filters.topic) return false;
    if (tokens.length > 0) {
      const haystack = normalizeSearch(context.searchText(report));
      if (!tokens.every(token => haystack.includes(token))) return false;
    }
    return true;
  });
}

/** How many of the secondary filters (behind the "Filtra" button) are active. */
export function activeFilterCount(filters: QueueFilters): number {
  return (filters.topic ? 1 : 0) + (filters.time !== 'all' ? 1 : 0);
}

export interface DueInfo {
  state: 'overdue' | 'soon' | 'ok' | 'none';
  /** Whole days from now to the deadline (absolute), at least 1 unless `none`. */
  days: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where a report stands against its response deadline.
 * A closed report has no live deadline, so it reports `none` however old it is.
 */
export function dueInfo(dueAt: string | undefined, status: string, now: number): DueInfo {
  if (CLOSED_STATUSES.includes(status) || !dueAt) return { state: 'none', days: 0 };
  const due = Date.parse(dueAt);
  if (!Number.isFinite(due)) return { state: 'none', days: 0 };
  const diff = due - now;
  const days = Math.max(1, Math.ceil(Math.abs(diff) / DAY_MS));
  if (diff < 0) return { state: 'overdue', days };
  return { state: diff <= DAY_MS ? 'soon' : 'ok', days };
}

/** Page `page` (1-based) of `items`, plus the totals the footer needs. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return {
    page: current,
    totalPages,
    items: items.slice(start, start + pageSize),
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, items.length),
    total: items.length,
  };
}

/**
 * One value, safe to place in a CSV file that will be opened in a spreadsheet.
 *
 * Report titles and descriptions are typed by anyone. A cell that starts with
 * `=`, `+`, `-` or `@` is run as a formula by Excel and Sheets — a report titled
 * `=HYPERLINK("https://evil", "click")` would then execute on whoever exports the
 * queue. A leading apostrophe makes the spreadsheet treat it as plain text. Every
 * value is also quoted, with inner quotes doubled, so commas and line breaks stay
 * inside their cell.
 */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

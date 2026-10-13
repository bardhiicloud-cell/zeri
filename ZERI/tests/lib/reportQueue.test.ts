import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  csvCell,
  dueInfo,
  filterQueue,
  matchesStatus,
  matchesTime,
  paginate,
  type QueueContext,
} from '../../src/lib/reportQueue';

const NOW = Date.parse('2026-10-11T12:00:00.000Z');
const hoursFromNow = (h: number) => new Date(NOW + h * 3_600_000).toISOString();

interface R {
  id: string;
  status: string;
  createdAt: string;
  title: string;
  municipality: string;
  topic?: string;
  overdue?: boolean;
}

const ctx: QueueContext<R> = {
  now: NOW,
  isOverdue: r => Boolean(r.overdue),
  searchText: r => `${r.title} ${r.municipality}`,
  topicId: r => r.topic,
};

const reports: R[] = [
  { id: 'a', status: 'Pending Review', createdAt: hoursFromNow(-2), title: 'Gropa në rrugë', municipality: 'Prishtinë', topic: 'roads' },
  { id: 'b', status: 'In Progress', createdAt: hoursFromNow(-30), title: 'Ndriçim publik', municipality: 'Gjilan', topic: 'lighting', overdue: true },
  { id: 'c', status: 'Resolved', createdAt: hoursFromNow(-24 * 10), title: 'Mbeturina', municipality: 'Pejë', topic: 'waste' },
  { id: 'd', status: 'Rejected', createdAt: hoursFromNow(-24 * 40), title: 'Zhurmë', municipality: 'Prizren' },
  { id: 'e', status: 'Assigned', createdAt: hoursFromNow(-5), title: 'Kanalizim', municipality: 'Ferizaj', topic: 'water' },
];

const ids = (list: R[]) => list.map(r => r.id);

describe('matchesStatus', () => {
  it('maps each tab to the statuses it should contain', () => {
    expect(matchesStatus('Pending Review', 'unapproved', false)).toBe(true);
    expect(matchesStatus('Approved', 'unapproved', false)).toBe(false);
    for (const status of ['Approved', 'Assigned', 'In Progress']) {
      expect(matchesStatus(status, 'in-progress', false)).toBe(true);
    }
    expect(matchesStatus('Pending Review', 'in-progress', false)).toBe(false);
    expect(matchesStatus('Resolved', 'resolved', false)).toBe(true);
    expect(matchesStatus('Rejected', 'rejected', false)).toBe(true);
  });

  it('treats overdue as the caller\'s flag, not a status', () => {
    expect(matchesStatus('In Progress', 'overdue', true)).toBe(true);
    expect(matchesStatus('In Progress', 'overdue', false)).toBe(false);
  });

  it('keeps "unresolved" as everything not closed, and accepts a raw status', () => {
    expect(matchesStatus('Overdue', 'unresolved', false)).toBe(true);
    expect(matchesStatus('Closed', 'unresolved', false)).toBe(false);
    expect(matchesStatus('Assigned', 'Assigned', false)).toBe(true);
    expect(matchesStatus('Approved', 'Assigned', false)).toBe(false);
  });

  it('shows everything for the empty key', () => {
    expect(matchesStatus('Rejected', '', false)).toBe(true);
  });
});

describe('matchesTime', () => {
  it('applies day, week and month windows', () => {
    expect(matchesTime(hoursFromNow(-1), 'daily', NOW)).toBe(true);
    expect(matchesTime(hoursFromNow(-48), 'daily', NOW)).toBe(false);
    expect(matchesTime(hoursFromNow(-24 * 6), 'weekly', NOW)).toBe(true);
    expect(matchesTime(hoursFromNow(-24 * 8), 'weekly', NOW)).toBe(false);
    expect(matchesTime(hoursFromNow(-24 * 20), 'monthly', NOW)).toBe(true);
    expect(matchesTime(hoursFromNow(-24 * 60), 'monthly', NOW)).toBe(false);
  });

  it('never matches a window for an unparseable date, but matches "all"', () => {
    expect(matchesTime('not a date', 'weekly', NOW)).toBe(false);
    expect(matchesTime('not a date', 'all', NOW)).toBe(true);
  });
});

describe('filterQueue', () => {
  it('returns everything for empty filters', () => {
    expect(ids(filterQueue(reports, EMPTY_FILTERS, ctx))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('finds Albanian text typed without accents', () => {
    expect(ids(filterQueue(reports, { ...EMPTY_FILTERS, query: 'prishtine' }, ctx))).toEqual(['a']);
    expect(ids(filterQueue(reports, { ...EMPTY_FILTERS, query: 'ndricim' }, ctx))).toEqual(['b']);
  });

  it('requires every word of the query to match', () => {
    expect(ids(filterQueue(reports, { ...EMPTY_FILTERS, query: 'gropa prishtine' }, ctx))).toEqual(['a']);
    expect(filterQueue(reports, { ...EMPTY_FILTERS, query: 'gropa gjilan' }, ctx)).toEqual([]);
  });

  it('combines status, topic and time', () => {
    expect(ids(filterQueue(reports, { ...EMPTY_FILTERS, status: 'in-progress' }, ctx))).toEqual(['b', 'e']);
    expect(ids(filterQueue(reports, { ...EMPTY_FILTERS, status: 'in-progress', topic: 'water' }, ctx))).toEqual(['e']);
    expect(ids(filterQueue(reports, { ...EMPTY_FILTERS, time: 'daily' }, ctx))).toEqual(['a', 'e']);
    expect(ids(filterQueue(reports, { ...EMPTY_FILTERS, status: 'overdue' }, ctx))).toEqual(['b']);
  });

  it('does not mutate its input', () => {
    const copy = [...reports];
    filterQueue(reports, { ...EMPTY_FILTERS, query: 'x' }, ctx);
    expect(reports).toEqual(copy);
  });
});

describe('activeFilterCount', () => {
  it('counts only the secondary filters', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, query: 'x', status: 'resolved' })).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, topic: 'roads', time: 'weekly' })).toBe(2);
  });
});

describe('dueInfo', () => {
  it('flags a passed deadline as overdue with the days late', () => {
    expect(dueInfo(hoursFromNow(-60), 'In Progress', NOW)).toEqual({ state: 'overdue', days: 3 });
  });

  it('flags a deadline inside 24h as soon, and further out as ok', () => {
    expect(dueInfo(hoursFromNow(5), 'Pending Review', NOW).state).toBe('soon');
    expect(dueInfo(hoursFromNow(80), 'Pending Review', NOW)).toEqual({ state: 'ok', days: 4 });
  });

  it('has no live deadline once a report is closed, or when the date is missing or bad', () => {
    expect(dueInfo(hoursFromNow(-500), 'Resolved', NOW).state).toBe('none');
    expect(dueInfo(hoursFromNow(-500), 'Rejected', NOW).state).toBe('none');
    expect(dueInfo(undefined, 'Pending Review', NOW).state).toBe('none');
    expect(dueInfo('garbage', 'Pending Review', NOW).state).toBe('none');
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 45 }, (_, i) => i + 1);

  it('slices a page and reports the range', () => {
    expect(paginate(items, 2, 20)).toMatchObject({ page: 2, totalPages: 3, from: 21, to: 40, total: 45 });
    expect(paginate(items, 3, 20).items).toEqual([41, 42, 43, 44, 45]);
  });

  it('clamps an out-of-range page, which happens when a filter shrinks the list', () => {
    expect(paginate(items, 99, 20).page).toBe(3);
    expect(paginate(items, 0, 20).page).toBe(1);
  });

  it('handles an empty list', () => {
    expect(paginate([], 1, 20)).toMatchObject({ page: 1, totalPages: 1, from: 0, to: 0, total: 0, items: [] });
  });
});

describe('csvCell', () => {
  it('quotes every value and doubles inner quotes', () => {
    expect(csvCell('plain')).toBe('"plain"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('a,b\nc')).toBe('"a,b\nc"');
  });

  it('defuses spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("https://evil","x")')).toBe('"\'=HYPERLINK(""https://evil"",""x"")"');
    expect(csvCell('+1+1')).toBe('"\'+1+1"');
    expect(csvCell('-2')).toBe('"\'-2"');
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
  });

  it('leaves ordinary text, numbers and empties alone', () => {
    expect(csvCell('Gropa në rrugë')).toBe('"Gropa në rrugë"');
    expect(csvCell(42)).toBe('"42"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });
});

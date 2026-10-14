import { describe, expect, it } from 'vitest';
import type { Report } from '../../src/types';
import { CSV_HEADERS, csvText, routeReports, routingCsvRows, routingHtml } from '../../src/lib/routingExport';

const base = {
  description: 'Gropë e madhe në rrugë.',
  urgency: 'E lartë',
  status: 'Approved',
  createdAt: '2026-10-01T10:00:00.000Z',
  images: [],
  upvotes: 0,
  commentsCount: 0,
  authorId: 'secret-uid',
  authorName: 'Emri Sekret',
  isAnonymous: false,
} as const;

const report = (over: Partial<Report>): Report => ({
  ...base,
  id: 'r1',
  trackingId: 'ZQ-001',
  title: 'Gropë',
  category: 'Rrugë',
  topicCategory: 'rruge',
  location: { municipality: 'Prishtinë', address: 'Rr. Nëna Terezë' },
  ...over,
} as Report);

describe('routeReports', () => {
  it('groups by recipient and sends urban and rural road reports to different bodies', () => {
    const groups = routeReports([
      report({ id: 'a', zone: 'urban' }),
      report({ id: 'b', zone: 'urban' }),
      report({ id: 'c', zone: 'rural' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].recipient.level).toBe('municipal');
    expect(groups[1].recipient.level).toBe('central');
  });

  it('flags the reports whose zone is still unset', () => {
    const [group] = routeReports([report({ id: 'a' })]);
    expect(group.needsZone).toBe(1);
  });

  it('classifies a legacy report from its text when it has no topic field', () => {
    const [group] = routeReports([report({ topicCategory: undefined, category: 'Rrugë', title: 'Gropë në asfalt', zone: 'urban' })]);
    expect(group.items[0].topicId).toBe('rruge');
  });
});

describe('documents', () => {
  const groups = routeReports([report({ zone: 'urban', title: '<script>alert(1)</script> Gropë' })]);

  it('never contains who reported', () => {
    const html = routingHtml(groups, 'Test');
    const csv = csvText(CSV_HEADERS, routingCsvRows(groups));
    for (const text of [html, csv]) {
      expect(text).not.toContain('Emri Sekret');
      expect(text).not.toContain('secret-uid');
    }
  });

  it('escapes citizen-written text in the HTML', () => {
    const html = routingHtml(groups, 'Test');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('writes one CSV row per report with a header of the same width', () => {
    const rows = routingCsvRows(groups);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(CSV_HEADERS.length);
    expect(rows[0][3]).toBe('komunaprishtine@rks-gov.net');
    expect(rows[0][4]).toBe('Gati për dërgim');
  });

  it('quotes commas, quotes and new lines in a CSV cell', () => {
    expect(csvText(['a'], [['x, "y"\nz']])).toBe('"a"\n"x, ""y""\nz"');
  });
});

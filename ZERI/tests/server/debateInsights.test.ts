import { describe, expect, it } from 'vitest';
import { summariseCases, tallyReelReports, toCaseLite, toReelRow, toStoryRow, type CaseLite } from '../../server/debateInsights';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const H = 3_600_000;

const lite = (over: Partial<CaseLite> = {}): CaseLite => ({
  kind: 'post', status: 'flagged', open: true, reasons: { spam: 1 }, reportCount: 1, priority: 'normal', escalated: false,
  subjectUid: 'u1', subjectName: 'Arben', assigneeUid: null, assigneeName: '', firstReportedAtMs: NOW - H, decidedAtMs: null, ...over,
});

describe('summariseCases', () => {
  it('counts totals, kinds, reasons and open work', () => {
    const out = summariseCases([
      lite({ reasons: { spam: 2, abuse: 1 }, reportCount: 3, priority: 'urgent', escalated: true }),
      lite({ kind: 'comment', open: false, status: 'no_violation', reasons: { spam: 1 }, decidedAtMs: NOW - H / 2 }),
    ], 7, NOW);
    expect(out.totals).toEqual({ cases: 2, open: 1, reports: 4, escalated: 1, urgentOpen: 1 });
    expect(out.byKind).toEqual({ post: 1, comment: 1 });
    expect(out.byReason).toEqual({ spam: 3, abuse: 1 });
    expect(out.unassignedOpen).toBe(1);
  });

  it('buckets how long open cases have waited', () => {
    const out = summariseCases([
      lite({ firstReportedAtMs: NOW - H }),
      lite({ firstReportedAtMs: NOW - 30 * H }),
      lite({ firstReportedAtMs: NOW - 5 * 24 * H }),
      lite({ firstReportedAtMs: NOW - 9 * 24 * H }),
    ], 30, NOW);
    expect(out.openAge).toEqual({ under24h: 1, day1to3: 1, day3to7: 1, over7d: 1 });
  });

  it('gives the median resolution time and a trend with a slot per day', () => {
    const out = summariseCases([
      lite({ open: false, firstReportedAtMs: NOW - 10 * H, decidedAtMs: NOW - 8 * H }),
      lite({ open: false, firstReportedAtMs: NOW - 10 * H, decidedAtMs: NOW - 4 * H }),
      lite({ open: false, firstReportedAtMs: NOW - 10 * H, decidedAtMs: NOW - 2 * H }),
    ], 7, NOW);
    expect(out.medianResolutionHours).toBe(6);
    expect(out.trend).toHaveLength(7);
    expect(out.trend.at(-1)).toMatchObject({ day: '2026-10-15', opened: 3, decided: 3 });
  });

  it('has no median without decisions', () => {
    expect(summariseCases([lite()], 7, NOW).medianResolutionHours).toBeNull();
  });

  it('lists repeat subjects and moderator load', () => {
    const out = summariseCases([
      lite({ subjectUid: 'a', subjectName: 'A', reportCount: 4, assigneeUid: 'm1', assigneeName: 'Moderatori 1' }),
      lite({ subjectUid: 'a', reportCount: 2, assigneeUid: 'm1', assigneeName: 'Moderatori 1' }),
      lite({ subjectUid: 'b', subjectName: 'B' }),
    ], 30, NOW);
    expect(out.repeatSubjects).toEqual([{ uid: 'a', name: 'A', cases: 2, reports: 6 }]);
    expect(out.moderators).toEqual([{ uid: 'm1', name: 'Moderatori 1', open: 2 }]);
    expect(out.unassignedOpen).toBe(1);
  });
});

describe('row mappers', () => {
  it('reads a case document defensively', () => {
    const c = toCaseLite({ kind: 'ad', reasons: { spam: 2, bad: 0, x: 'nope' }, reportCount: 2, snapshot: { authorName: 'Biznesi' }, decision: { atMs: 50 }, open: true });
    expect(c).toMatchObject({ kind: 'ad', reasons: { spam: 2 }, subjectName: 'Biznesi', decidedAtMs: 50, assigneeUid: null });
  });

  it('marks a story live only while unhidden and unexpired', () => {
    const base = { authorId: 'u', authorName: 'A', mediaUrl: 'https://x/y.jpg', createdAt: { toMillis: () => 1 } };
    expect(toStoryRow('s', { ...base, expiresAt: { toMillis: () => NOW + 1 } }, 4, NOW)).toMatchObject({ live: true, views: 4, mediaType: 'image' });
    expect(toStoryRow('s', { ...base, expiresAt: { toMillis: () => NOW - 1 } }, 0, NOW).live).toBe(false);
    expect(toStoryRow('s', { ...base, isHidden: true, expiresAt: { toMillis: () => NOW + 1 } }, 0, NOW).live).toBe(false);
  });

  it('summarises a reel and tallies its reports', () => {
    expect(toReelRow('r', { authorId: 'u', viewCount: 9, likedBy: ['a', 'b'], caption: 'x'.repeat(400) }, 2)).toMatchObject({ views: 9, likes: 2, reports: 2 });
    expect(tallyReelReports([{ reelId: 'r1' }, { reelId: 'r1' }, { reelId: 'r2' }, {}])).toEqual({ r1: 2, r2: 1 });
  });
});

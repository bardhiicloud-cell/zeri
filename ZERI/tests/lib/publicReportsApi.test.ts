import { afterEach, describe, expect, it, vi } from 'vitest';
import { canReadAllReports, claimsGrantFullReportRead, fetchPublicReports, mergeOwnReports, normalizeStoredReport } from '../../src/lib/publicReportsApi';
import type { Report } from '../../src/types';

const report = (id: string, createdAt: string, extra: Partial<Report> = {}) => ({ id, createdAt, title: id, ...extra }) as Report;

describe('who gets the full collection', () => {
  it('only the flags the database rules accept', () => {
    for (const flag of ['admin', 'superadmin', 'approver', 'adsadmin', 'newsadmin', 'agent', 'monitor']) {
      expect(claimsGrantFullReportRead({ [flag]: true }), flag).toBe(true);
    }
    for (const claims of [null, undefined, {}, { role: 'agent' }, { municipality_account: true }, { debatwp: true }, { admin: 'true' }, { admin: false }]) {
      expect(claimsGrantFullReportRead(claims as never), JSON.stringify(claims)).toBe(false);
    }
  });

  it('fails closed: no user, or a token that cannot be read, means the public feed', async () => {
    expect(await canReadAllReports(null)).toBe(false);
    expect(await canReadAllReports({ getIdTokenResult: async () => { throw new Error('offline'); } })).toBe(false);
    expect(await canReadAllReports({ getIdTokenResult: async () => ({ claims: { agent: true } }) as never })).toBe(true);
  });
});

describe('mergeOwnReports', () => {
  it('puts the viewer\'s own reports among the feed, newest first, own copy winning', () => {
    const merged = mergeOwnReports(
      [report('a', '2026-01-03T00:00:00Z', { authorId: '' }), report('b', '2026-01-01T00:00:00Z')],
      [report('a', '2026-01-03T00:00:00Z', { authorId: 'me' }), report('mine', '2026-01-02T00:00:00Z', { status: 'Pending Review' })],
    );
    expect(merged.map(r => r.id)).toEqual(['a', 'mine', 'b']);
    expect(merged[0].authorId).toBe('me');
  });
});

describe('normalizeStoredReport', () => {
  it('turns timestamps into ISO strings and never throws on missing parts', () => {
    const out = normalizeStoredReport('x', { createdAt: { toDate: () => new Date('2026-01-01T00:00:00Z') }, timeline: [{ date: { seconds: 1767225600 } }] });
    expect(out.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(out.timeline[0].date).toBe('2026-01-01T00:00:00.000Z');
    expect(normalizeStoredReport('y', {}).timeline).toEqual([]);
  });
});

describe('fetchPublicReports', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks the public endpoint with the paging it was given and returns the cursor', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [{ id: 'a' }], nextCursor: '2026-01-01T00:00:00.000Z' })));
    vi.stubGlobal('fetch', fetchMock);
    const page = await fetchPublicReports({ cursor: '2026-02-01T00:00:00.000Z', limit: 50 });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/public/reports?limit=50&cursor=2026-02-01T00%3A00%3A00.000Z', { signal: undefined });
    expect(page).toEqual({ items: [{ id: 'a' }], nextCursor: '2026-01-01T00:00:00.000Z' });
  });

  it('turns a failed response into an error instead of an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    await expect(fetchPublicReports()).rejects.toThrow(/500/);
  });
});

import http from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { buildFeedReport, parseFeedQuery, registerPublicReportRoutes, FEED_STATUSES, MAX_FEED_PAGE } from '../../server/publicReports';

const ID = 'ZQ-20260101-ABCD1234';
const at = (iso: string) => ({ toDate: () => new Date(iso) });

/** A stored report carrying every private field a real one has, to prove none leaks. */
const stored = (patch: Record<string, unknown> = {}) => ({
  trackingId: ID,
  title: 'Gropë në rrugë',
  description: 'Përshkrim i plotë',
  category: 'Rrugë & Infrastrukturë',
  urgency: 'E lartë',
  status: 'In Progress',
  createdAt: at('2026-01-01T10:00:00Z'),
  location: { address: 'Rr. Nënë Tereza 5', municipality: 'Pejë', lat: 42.660149, lng: 20.280193 },
  responsibleInstitution: 'Drejtoria e Infrastrukturës',
  authorId: 'uid-secret-123',
  authorName: 'Filan Fisteku',
  isAnonymous: false,
  internalNote: 'KUJDES-E-BRENDSHME',
  aiSummary: 'ANALIZË-E-BRENDSHME',
  aiTags: ['TAG-I-BRENDSHËM'],
  aiSeverity: 'HIGH',
  awaitingInfo: true,
  escalated: true,
  assignedToUid: 'staff-uid-777',
  assignedTo: 'Agron Berisha',
  assignedBy: 'owner-uid-1',
  email: 'filan@example.com',
  phone: '+38344111222',
  upvotes: 7,
  commentsCount: 2,
  media: [{ type: 'image', url: 'https://cdn.example/a.jpg' }, { type: 'image', url: 'http://insecure.example/b.jpg' }],
  images: ['https://cdn.example/a.jpg'],
  timeline: [
    { id: 'e1', status: 'Pending Review', date: '2026-01-01T10:00:00.000Z', updatedBy: 'Sistemi', source: 'system' },
    { id: 'e2', status: 'Approved', date: '2026-01-02T10:00:00.000Z', updatedBy: 'Agron Berisha', actorId: 'staff-uid-777', actorRole: 'agent', source: 'agent', comment: 'Verifikuar.' },
  ],
  ...patch,
});

describe('buildFeedReport', () => {
  it('never exposes the author uid, staff identity, internal fields, AI analysis, contact details or exact coordinates', () => {
    const feed = buildFeedReport('doc1', stored())!;
    const json = JSON.stringify(feed);
    for (const secret of ['uid-secret-123', 'staff-uid-777', 'Agron Berisha', 'owner-uid-1', 'KUJDES', 'ANALIZË', 'TAG-I-BRENDSHËM', 'filan@example.com', '+38344111222', '42.660149', '20.280193', 'Nënë Tereza', 'awaitingInfo', 'escalated', 'internalNote', 'assignedToUid', 'aiSeverity', 'insecure.example']) {
      expect(json, secret).not.toContain(secret);
    }
    expect(feed.authorId).toBe('');
    expect(feed.location.lat).toBe(42.66);
    expect(feed.location.lng).toBe(20.28);
    expect(feed.location.address).toBe('');
    expect(feed.location.municipality).toBe('Pejë');
  });

  it('uses an institution, not a person, as the holder', () => {
    expect(buildFeedReport('d', stored())!.assignedTo).toBe('Drejtoria e Infrastrukturës');
    expect(buildFeedReport('d', stored({ assignedTo: '', responsibleInstitution: undefined }))!.assignedTo).toBe('');
    expect(buildFeedReport('d', stored({ responsibleInstitution: undefined }))!.assignedTo).toBe('Caktuar');
  });

  it('keeps a name only for a citizen who did not ask for anonymity', () => {
    expect(buildFeedReport('d', stored())!.authorName).toBe('Filan Fisteku');
    const anonymous = buildFeedReport('d', stored({ isAnonymous: true }))!;
    expect(anonymous.authorName).toBe('Anonim');
    expect(JSON.stringify(anonymous)).not.toContain('Filan');
  });

  it('keeps the counters and the public timeline the pages need', () => {
    const feed = buildFeedReport('doc1', stored())!;
    expect(feed).toMatchObject({ id: 'doc1', upvotes: 7, commentsCount: 2, status: 'In Progress', createdAt: '2026-01-01T10:00:00.000Z' });
    expect(feed.timeline.map(event => event.id)).toEqual(['e1', 'e2']);
    expect(feed.timeline[1].updatedBy).toBe('Agjenti i platformës');
  });

  it('leaves out reports no reviewer accepted, drafts and rejected ones', () => {
    for (const status of ['Draft', 'Pending Review', 'Rejected', 'Whatever', '']) {
      expect(buildFeedReport('d', stored({ status }))).toBeNull();
    }
    for (const status of FEED_STATUSES) expect(buildFeedReport('d', stored({ status }))).not.toBeNull();
  });

  it('skips a document with no tracking id or no creation time instead of throwing', () => {
    expect(buildFeedReport('d', stored({ trackingId: '' }))).toBeNull();
    expect(buildFeedReport('d', stored({ createdAt: undefined, timeline: [] }))).toBeNull();
  });
});

describe('parseFeedQuery', () => {
  it('defaults, clamps and rejects', () => {
    expect(parseFeedQuery({})).toMatchObject({ ok: true, limit: 100, cursor: null, municipality: '' });
    expect(parseFeedQuery({ limit: '5000' })).toMatchObject({ ok: true, limit: MAX_FEED_PAGE });
    for (const bad of ['0', '-1', '1.5', 'abc']) expect(parseFeedQuery({ limit: bad }), bad).toMatchObject({ ok: false });
    expect(parseFeedQuery({ cursor: 'not a date' })).toMatchObject({ ok: false });
    expect(parseFeedQuery({ cursor: '2026-01-01T00:00:00Z' })).toMatchObject({ ok: true });
  });

  it('accepts only a real municipality, so a made-up value cannot sidestep the cache', () => {
    expect(parseFeedQuery({ municipality: 'Pejë' })).toMatchObject({ ok: true, municipality: 'Pejë' });
    expect(parseFeedQuery({ municipality: 'peje' })).toMatchObject({ ok: true, municipality: 'Pejë' });
    for (const bad of ['M1', 'zzzzzz', '<script>', 'x'.repeat(500)]) expect(parseFeedQuery({ municipality: bad }), bad).toMatchObject({ ok: false });
  });
});

/** Just enough of the Firestore query builder for the route. Records what was asked. */
function fakeDb(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const calls: Array<{ op: string; args: unknown[] }> = [];
  let reads = 0;
  const chain: Record<string, unknown> = {};
  for (const op of ['where', 'orderBy', 'startAfter', 'limit']) {
    chain[op] = (...args: unknown[]) => { calls.push({ op, args }); return chain; };
  }
  chain.get = async () => {
    reads += 1;
    const limit = (calls.find(c => c.op === 'limit')?.args[0] as number) ?? docs.length;
    return { docs: docs.slice(0, limit).map(d => ({ id: d.id, data: () => d.data })) };
  };
  return { db: { collection: () => chain } as unknown as Firestore, calls, reads: () => reads };
}

describe('GET /api/v1/public/reports', () => {
  let server: http.Server;
  let base = '';
  let clock = 1_000_000;
  const fake = fakeDb([
    { id: 'a', data: stored() },
    { id: 'b', data: stored({ trackingId: 'ZQ-20260102-BBBB2222', createdAt: at('2026-01-02T10:00:00Z') }) },
    { id: 'hidden', data: stored({ status: 'Pending Review' }) },
  ]);

  beforeAll(async () => {
    const app = express();
    registerPublicReportRoutes(app, { db: () => fake.db, limiter: (_req, _res, next) => next(), now: () => clock });
    server = http.createServer(app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

  const get = async (path: string) => {
    const res = await fetch(`${base}${path}`);
    return { status: res.status, headers: res.headers, body: await res.json() as { items?: Array<Record<string, unknown>>; nextCursor?: string | null; error?: string } };
  };

  it('needs no sign-in, returns only allow-listed reports and no private data', async () => {
    const res = await get('/api/v1/public/reports?limit=3');
    expect(res.status).toBe(200);
    expect(res.body.items!.map(item => item.id)).toEqual(['a', 'b']); // the pending one is filtered out
    const json = JSON.stringify(res.body);
    for (const secret of ['uid-secret-123', 'staff-uid-777', 'KUJDES', 'filan@example.com', 'Agron Berisha']) expect(json, secret).not.toContain(secret);
    expect(res.headers.get('cache-control')).toContain('public');
  });

  it('only asks the database for reviewed statuses, newest first, bounded', async () => {
    const ops = fake.calls.map(c => c.op);
    expect(ops).toContain('where');
    const statusFilter = fake.calls.find(c => c.op === 'where' && c.args[0] === 'status')!;
    expect(statusFilter.args[1]).toBe('in');
    expect(statusFilter.args[2]).toEqual([...FEED_STATUSES]);
    expect(fake.calls.find(c => c.op === 'orderBy')!.args).toEqual(['createdAt', 'desc']);
    expect(fake.calls.filter(c => c.op === 'limit').every(c => (c.args[0] as number) <= MAX_FEED_PAGE)).toBe(true);
  });

  it('answers repeat requests from a short cache, then reads again once it expires', async () => {
    await get('/api/v1/public/reports?limit=2');
    const after = fake.reads();
    await get('/api/v1/public/reports?limit=2');
    expect(fake.reads()).toBe(after);
    clock += 31_000;
    await get('/api/v1/public/reports?limit=2');
    expect(fake.reads()).toBe(after + 1);
  });

  it('rejects malformed paging and never reaches the database for it', async () => {
    const before = fake.reads();
    expect((await get('/api/v1/public/reports?limit=abc')).status).toBe(400);
    expect((await get('/api/v1/public/reports?cursor=zzz')).status).toBe(400);
    expect(fake.reads()).toBe(before);
  });
});

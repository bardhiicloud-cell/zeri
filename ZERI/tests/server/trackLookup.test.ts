import http from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildPublicTrackView, normalizeTrackingId, registerTrackLookupRoutes, NOT_FOUND_MESSAGE,
} from '../../server/trackLookup';

const ID = 'ZQ-20260101-ABCD1234';

/** A stored report with every private field a real one carries, to prove none leaks. */
const stored = (patch: Record<string, unknown> = {}) => ({
  trackingId: ID,
  title: 'Gropë në rrugë',
  description: 'Përshkrim i plotë\nme dy rreshta.',
  category: 'Rrugë & Infrastrukturë',
  topicCategory: 'rruge',
  urgency: 'E lartë',
  status: 'In Progress',
  createdAt: { toDate: () => new Date('2026-01-01T10:00:00Z') },
  updatedAt: '2026-01-05T09:00:00.000Z',
  location: { address: 'Rr. Nënë Tereza 5', municipality: 'Pejë', lat: 42.66, lng: 20.28 },
  responsibleInstitution: 'Drejtoria e Infrastrukturës',
  responsibleOffice: 'Zyra e rrugëve',
  responsibleLevel: 'Komunale',
  responseDueAt: '2026-01-04T10:00:00.000Z',
  authorId: 'uid-secret-123',
  authorName: 'Filan Fisteku',
  isAnonymous: false,
  internalNote: 'KUJDES: i njohur i kryetarit',
  aiSummary: 'ANALIZË-E-BRENDSHME',
  aiForensicsReport: 'FORENSIKE-E-BRENDSHME',
  assignedToUid: 'staff-uid-777',
  assignedTo: 'Agron Berisha',
  media: [
    { type: 'image', url: 'https://cdn.example/a.jpg' },
    { type: 'image', url: 'http://insecure.example/b.jpg' },
  ],
  images: ['https://cdn.example/a.jpg'],
  timeline: [
    { id: 'e3', status: 'In Progress', date: '2026-01-03T10:00:00.000Z', updatedBy: 'agron@komuna.rks-gov.net', actorRole: 'municipality', actorInstitution: 'Komuna e Pejës', source: 'municipality', comment: 'Ekipi do të dalë nesër.' },
    { id: 'e1', status: 'Pending Review', date: '2026-01-01T10:00:00.000Z', updatedBy: 'Sistemi', source: 'system' },
    { id: 'e2', status: 'Approved', date: '2026-01-02T10:00:00.000Z', updatedBy: 'Agron Berisha', actorId: 'staff-uid-777', actorRole: 'agent', actorInstitution: 'Agjenti i platformës', source: 'agent', comment: 'Verifikuar nga foto.' },
  ],
  ...patch,
});

describe('normalizeTrackingId', () => {
  it('accepts the report writer alphabet and rejects everything else', () => {
    expect(normalizeTrackingId(` ${ID.toLowerCase()} `)).toBe(ID);
    for (const bad of ['', 'abc', 'ZQ 20260101', 'ZQ-1;DROP', '../etc/passwd', 'Z'.repeat(41), '-ZQ-20260101-AB', undefined, null, 12]) {
      expect(normalizeTrackingId(bad as unknown), String(bad)).toBeNull();
    }
  });
});

describe('buildPublicTrackView: what is public', () => {
  it('never exposes the author, staff identity, internal notes, AI analysis or coordinates', () => {
    const json = JSON.stringify(buildPublicTrackView(stored()));
    for (const secret of ['uid-secret-123', 'Filan Fisteku', 'KUJDES', 'ANALIZË-E-BRENDSHME', 'FORENSIKE', 'staff-uid-777', 'Agron Berisha', 'agron@komuna', '42.66', '20.28', 'authorId', 'internalNote']) {
      expect(json, secret).not.toContain(secret);
    }
  });

  it('keeps the full description and the real details', () => {
    const view = buildPublicTrackView(stored())!;
    expect(view.description).toBe('Përshkrim i plotë\nme dy rreshta.');
    expect(view).toMatchObject({ trackingId: ID, municipality: 'Pejë', address: '', category: 'Rrugë & Infrastrukturë', status: 'In Progress' });
    expect(view.institution).toMatchObject({ name: 'Drejtoria e Infrastrukturës', office: 'Zyra e rrugëve' });
  });

  it('does not reveal the street address, only the neighbourhood when there is one', () => {
    const withNeighbourhood = buildPublicTrackView(stored({ location: { address: 'Rr. Nënë Tereza 5', municipality: 'Pejë', neighborhood: 'Qendra', lat: 42.66, lng: 20.28 } }))!;
    expect(withNeighbourhood.address).toBe('Qendra');
    const json = JSON.stringify([buildPublicTrackView(stored()), withNeighbourhood]);
    expect(json).not.toContain('Nënë Tereza');
    expect(json).not.toContain('42.66');
  });

  it('has no page for a draft or a report without a tracking id', () => {
    expect(buildPublicTrackView(stored({ status: 'Draft' }))).toBeNull();
    expect(buildPublicTrackView(stored({ trackingId: '' }))).toBeNull();
  });

  it('names the institution that acted, never a person, and orders the history by time', () => {
    const view = buildPublicTrackView(stored())!;
    expect(view.timeline.map(event => event.id)).toEqual(['e1', 'e2', 'e3']);
    expect(view.timeline.map(event => event.institution)).toEqual(['Sistemi', 'Agjenti i platformës', 'Komuna e Pejës']);
    expect(view.lastUpdate).toBe('2026-01-05T09:00:00.000Z');
  });

  it('shows submission as the one true event when a report has no stored history', () => {
    const view = buildPublicTrackView(stored({ timeline: [], status: 'Pending Review' }))!;
    expect(view.timeline).toHaveLength(1);
    expect(view.timeline[0]).toMatchObject({ status: 'Pending Review', date: '2026-01-01T10:00:00.000Z' });
  });
});

describe('buildPublicTrackView: evidence', () => {
  it('holds back the files until a reviewer has accepted the report, but still says they exist', () => {
    const view = buildPublicTrackView(stored({ status: 'Pending Review' }))!;
    expect(view.evidence).toMatchObject({ published: false, totalCount: 2, items: [] });
    expect(JSON.stringify(view)).not.toContain('cdn.example');
  });

  it('publishes only https files after review', () => {
    const view = buildPublicTrackView(stored())!;
    expect(view.evidence.published).toBe(true);
    expect(view.evidence.items.map(item => item.url)).toEqual(['https://cdn.example/a.jpg']);
  });

  it('does not show files of a rejected report', () => {
    expect(buildPublicTrackView(stored({ status: 'Rejected' }))!.evidence.items).toEqual([]);
  });

  it('shows the author their own files whatever the review state, and the public never', () => {
    const own = buildPublicTrackView(stored({ status: 'Pending Review' }), { viewerIsAuthor: true })!;
    expect(own.evidence).toMatchObject({ ownerView: true, published: false });
    expect(own.evidence.items.map(item => item.url)).toEqual(['https://cdn.example/a.jpg']);
    expect(buildPublicTrackView(stored({ status: 'Pending Review' }))!.evidence.ownerView).toBe(false);
    expect(buildPublicTrackView(stored({ status: 'Rejected' }), { viewerIsAuthor: true })!.evidence.items).toHaveLength(1);
  });

  it('tells a rejected report when it will be erased: 24 hours after the rejection', () => {
    const view = buildPublicTrackView(stored({
      status: 'Rejected',
      timeline: [{ id: 'r', status: 'Rejected', date: '2026-01-06T08:00:00.000Z', source: 'admin', comment: 'Jo komunale.' }],
    }))!;
    expect(view.rejection?.deleteAt).toBe('2026-01-07T08:00:00.000Z');
  });
});

describe('buildPublicTrackView: official responses', () => {
  it('lists only what the municipality published under its own name', () => {
    const view = buildPublicTrackView(stored())!;
    expect(view.officialResponses).toHaveLength(1);
    expect(view.officialResponses[0]).toMatchObject({ institution: 'Komuna e Pejës', text: 'Ekipi do të dalë nesër.' });
  });

  it('is empty, not invented, when no municipality has answered', () => {
    const view = buildPublicTrackView(stored({ timeline: [{ id: 'e1', status: 'Pending Review', date: '2026-01-01T10:00:00.000Z', source: 'system' }] }))!;
    expect(view.officialResponses).toEqual([]);
  });
});

describe('buildPublicTrackView: resolution', () => {
  const resolvedEvent = { id: 'r1', status: 'Resolved', date: '2026-02-01T10:00:00.000Z', source: 'municipality', actorInstitution: 'Komuna e Pejës', comment: 'Gropa u mbush.' };
  const closedEvent = { id: 'c1', status: 'Closed', date: '2026-02-03T10:00:00.000Z', source: 'admin', actorInstitution: 'Administrata', comment: 'Verifikuar në terren.' };
  // What `staff_verify` writes: Resolved again, status unchanged, by the platform's staff.
  const verifyEvent = { id: 'v1', status: 'Resolved', previousStatus: 'Resolved', date: '2026-02-03T10:00:00.000Z', source: 'admin', actorInstitution: 'Administrata', comment: 'Verifikuar në terren.' };

  it('says the institution declared it done and nobody has verified it yet', () => {
    const view = buildPublicTrackView(stored({ status: 'Resolved', resolvedAt: '2026-02-01T10:00:00.000Z', timeline: [{ ...resolvedEvent, previousStatus: 'In Progress' }] }))!;
    expect(view.resolution).toMatchObject({ state: 'awaiting_verification', explanation: 'Gropa u mbush.', resolvedBy: 'Komuna e Pejës', verifiedAt: null });
  });

  it('marks it verified once platform staff wrote their own verification after the institution', () => {
    const view = buildPublicTrackView(stored({ status: 'Resolved', resolvedAt: '2026-02-01T10:00:00.000Z', timeline: [{ ...resolvedEvent, previousStatus: 'In Progress' }, verifyEvent] }))!;
    expect(view.resolution).toMatchObject({ state: 'verified', explanation: 'Gropa u mbush.', resolvedBy: 'Komuna e Pejës', verificationNote: 'Verifikuar në terren.' });
  });

  it('does not take the municipality adding a note to a resolved case for verification', () => {
    const followUp = { id: 'f1', status: 'Resolved', previousStatus: 'Resolved', date: '2026-02-02T10:00:00.000Z', source: 'municipality', actorInstitution: 'Komuna e Pejës', comment: 'Shënim shtesë.' };
    const view = buildPublicTrackView(stored({ status: 'Resolved', timeline: [{ ...resolvedEvent, previousStatus: 'In Progress' }, followUp] }))!;
    expect(view.resolution.state).toBe('awaiting_verification');
    expect(view.officialResponses.map(response => response.text)).toContain('Shënim shtesë.');
  });

  it('still honours a Closed status', () => {
    const view = buildPublicTrackView(stored({ status: 'Closed', resolvedAt: '2026-02-01T10:00:00.000Z', timeline: [{ ...resolvedEvent, previousStatus: 'In Progress' }, closedEvent] }))!;
    expect(view.resolution).toMatchObject({ state: 'verified', verificationNote: 'Verifikuar në terren.' });
  });

  it('does not call a report resolved while it is still in progress', () => {
    const view = buildPublicTrackView(stored())!;
    expect(view.resolution).toMatchObject({ state: 'none', explanation: null, evidenceUrl: null });
  });

  it('carries the public reason of a rejection', () => {
    const view = buildPublicTrackView(stored({ status: 'Rejected', timeline: [{ id: 'x1', status: 'Rejected', date: '2026-01-02T10:00:00.000Z', source: 'agent', actorInstitution: 'Agjenti i platformës', comment: 'Nuk është çështje komunale.' }] }))!;
    expect(view.rejection).toMatchObject({ reason: 'Nuk është çështje komunale.' });
  });

  it('only links an https completion photo', () => {
    const ok = buildPublicTrackView(stored({ status: 'Resolved', timeline: [resolvedEvent], resolvedImage: 'https://cdn.example/done.jpg' }))!;
    const bad = buildPublicTrackView(stored({ status: 'Resolved', timeline: [resolvedEvent], resolvedImage: 'javascript:alert(1)' }))!;
    expect(ok.resolution.evidenceUrl).toBe('https://cdn.example/done.jpg');
    expect(bad.resolution.evidenceUrl).toBeNull();
  });
});

/* ───── the route ───── */

let server: http.Server;
let port: number;
let reads = 0;

const docs: Record<string, Record<string, unknown>> = {
  [ID]: stored(),
  'ZQ-DRAFT-0000001': stored({ trackingId: 'ZQ-DRAFT-0000001', status: 'Draft' }),
};
const fakeDb = () => ({
  collection: () => ({
    where: (_field: string, _op: string, value: string) => ({
      limit: () => ({
        get: async () => {
          reads += 1;
          const hit = docs[value];
          return hit ? { empty: false, docs: [{ data: () => hit }] } : { empty: true, docs: [] };
        },
      }),
    }),
  }),
});

beforeAll(async () => {
  const app = express();
  registerTrackLookupRoutes(app, { db: fakeDb as never, limiter: (_req, _res, next) => next() });
  server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;
});
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

function call(path: string): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    http.get({ port, host: '127.0.0.1', path }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : null, headers: res.headers }));
    }).on('error', reject);
  });
}

describe('GET /api/v1/public/track/:trackingId', () => {
  it('returns the public view, uncached and not indexable', async () => {
    const res = await call(`/api/v1/public/track/${ID.toLowerCase()}`);
    expect(res.status).toBe(200);
    expect(res.body.report.trackingId).toBe(ID);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-robots-tag']).toContain('noindex');
    expect(JSON.stringify(res.body)).not.toContain('uid-secret-123');
  });

  it('answers malformed, unknown and draft ids identically, so a probe learns nothing', async () => {
    const answers = await Promise.all([
      call('/api/v1/public/track/short'),
      call('/api/v1/public/track/ZQ-20269999-NOSUCHID1'),
      call('/api/v1/public/track/ZQ-DRAFT-0000001'),
    ]);
    for (const answer of answers) {
      expect(answer.status).toBe(404);
      expect(answer.body).toEqual({ error: NOT_FOUND_MESSAGE, code: 'NOT_FOUND' });
    }
  });

  it('cuts off a client that keeps missing, but not before a person mistyping gets a few tries', async () => {
    const before = reads;
    const statuses: number[] = [];
    for (let i = 0; i < 16; i += 1) statuses.push((await call(`/api/v1/public/track/ZQ-20269999-MISS${String(i).padStart(4, '0')}`)).status);
    expect(statuses.slice(0, 5).every(status => status === 404)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    // Once cut off it no longer touches the database, and a good id is refused too.
    const after = reads;
    expect((await call(`/api/v1/public/track/${ID}`)).status).toBe(429);
    expect(reads).toBe(after);
    expect(after).toBeGreaterThan(before);
  });
});

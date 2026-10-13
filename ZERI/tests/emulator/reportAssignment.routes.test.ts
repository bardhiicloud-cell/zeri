import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { registerReportAssignmentRoutes, releaseHeldReports } from '../../server/reportAssignment';

/**
 * The real assignment handlers against the Firestore emulator: the report change, its
 * handover history and the notifications must land together, or not at all.
 * Authentication and the identity provider are replaced by a header and a fixed table.
 * Run with: npm run test:rules
 */
let db: Firestore;
let server: Server;
let base = '';
const auditLog: Array<{ action: string; detail?: Record<string, unknown> }> = [];

const PEOPLE: Record<string, { role: string; name: string; disabled?: boolean }> = {
  owner: { role: 'superadmin', name: 'Pronari' },
  disp: { role: 'dispatcher', name: 'Dispatcheri' },
  ana: { role: 'agent', name: 'Ana' },
  blerim: { role: 'agent', name: 'Blerim' },
  gone: { role: 'agent', name: 'Larguar', disabled: true },
  mayor: { role: 'municipality', name: 'Komuna' },
};

const wipe = async () => {
  for (const name of ['reports', 'users', 'notifications']) {
    for (const ref of await db.collection(name).listDocuments()) await db.recursiveDelete(ref);
  }
};

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through `npm run test:rules`.');
  db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-assign-routes' }));
  const app = express();
  app.use(express.json());
  const requireAuth: express.RequestHandler = (req, res, next) => {
    const uid = req.header('x-test-uid');
    if (!uid || !PEOPLE[uid]) return res.status(401).json({ error: 'Unauthorized' });
    (req as unknown as { user: { uid: string } }).user = { uid };
    next();
  };
  const authAdmin = () => ({
    getUser: async (uid: string) => {
      const person = PEOPLE[uid];
      if (!person) throw Object.assign(new Error('not found'), { code: 'auth/user-not-found' });
      return { uid, customClaims: { role: person.role }, disabled: person.disabled === true, displayName: person.name, email: `${uid}@test` };
    },
  }) as unknown as Auth;
  registerReportAssignmentRoutes(app, {
    requireAuth,
    db: () => db,
    authAdmin,
    actingUser: req => {
      const uid = (req as unknown as { user: { uid: string } }).user.uid;
      return { uid, role: PEOPLE[uid].role, permissions: [] };
    },
    audit: (action, _req, detail) => { auditLog.push({ action, detail }); },
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(async () => {
  auditLog.length = 0;
  await wipe();
  for (const [uid, person] of Object.entries(PEOPLE)) await db.collection('users').doc(uid).set({ name: person.name });
  await db.collection('reports').doc('r1').set({ status: 'Pending Review', trackingId: 'ZQ-TEST-0001', assignedToUid: '', assignedTo: '' });
});
afterAll(async () => { await wipe(); await new Promise(resolve => server.close(resolve)); });

const call = async (as: string | null, method: string, path: string, body?: unknown) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(as ? { 'x-test-uid': as } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> & { items?: Array<Record<string, unknown>> } };
};
const assign = (as: string, body: Record<string, unknown>) => call(as, 'POST', '/api/v1/reports/r1/assign', body);
const history = async () => (await db.collection('reports').doc('r1').collection('assignmentHistory').get()).docs.map(d => d.data());
const inbox = async (uid: string) => (await db.collection('notifications').where('userId', '==', uid).get()).docs.map(d => d.data());

describe('releaseHeldReports (an account was removed)', () => {
  it('returns only front-of-queue reports to the shared queue, with a history entry each', async () => {
    await db.collection('reports').doc('held1').set({ status: 'Pending Review', assignedToUid: 'ana', assignedTo: 'Ana' });
    await db.collection('reports').doc('held2').set({ status: 'Draft', assignedToUid: 'ana', assignedTo: 'Ana' });
    await db.collection('reports').doc('approved').set({ status: 'Approved', assignedToUid: 'ana', assignedTo: 'Ana' });
    await db.collection('reports').doc('other').set({ status: 'Pending Review', assignedToUid: 'blerim', assignedTo: 'Blerim' });

    const result = await releaseHeldReports(db, 'ana', 'owner', 'Llogaria u hoq');
    expect(result).toEqual({ released: 2, remaining: false });
    for (const id of ['held1', 'held2']) {
      const doc = (await db.collection('reports').doc(id).get()).data()!;
      expect(doc.assignedToUid).toBe('');
      const entries = (await db.collection('reports').doc(id).collection('assignmentHistory').get()).docs.map(d => d.data());
      expect(entries).toMatchObject([{ kind: 'release', fromUid: 'ana', byUid: 'owner', reason: 'Llogaria u hoq' }]);
    }
    expect((await db.collection('reports').doc('approved').get()).data()!.assignedToUid).toBe('ana');
    expect((await db.collection('reports').doc('other').get()).data()!.assignedToUid).toBe('blerim');
  });

  it('does nothing when the person held nothing', async () => {
    expect(await releaseHeldReports(db, 'ana', 'owner', 'x')).toEqual({ released: 0, remaining: false });
  });
});

describe('assignment routes', () => {
  it('requires authentication', async () => {
    expect((await call(null, 'POST', '/api/v1/reports/r1/assign', { uid: 'ana' })).status).toBe(401);
    expect((await call(null, 'GET', '/api/v1/reports/r1/assignments')).status).toBe(401);
  });

  it('records the handover and tells the new assignee, in one step', async () => {
    const res = await assign('owner', { uid: 'ana', reason: 'Zona e Anës' });
    expect(res.status).toBe(200);
    const report = (await db.collection('reports').doc('r1').get()).data()!;
    expect(report.assignedToUid).toBe('ana');
    expect(await history()).toMatchObject([{ kind: 'assign', fromUid: '', toUid: 'ana', toName: 'Ana', byUid: 'owner', reason: 'Zona e Anës' }]);
    const told = await inbox('ana');
    expect(told).toHaveLength(1);
    expect(told[0].link).toContain('r1');
    // Internal handover text must never go to the citizen's feed.
    expect(await inbox('citizen')).toHaveLength(0);
  });

  it('needs a reason to take work from someone, and writes nothing without it', async () => {
    await assign('owner', { uid: 'ana' });
    const refused = await assign('owner', { uid: 'blerim' });
    expect(refused.status).toBe(400);
    expect((await db.collection('reports').doc('r1').get()).data()!.assignedToUid).toBe('ana');
    expect(await history()).toHaveLength(1);

    const moved = await assign('owner', { uid: 'blerim', reason: 'Ana është me leje' });
    expect(moved.status).toBe(200);
    expect(await history()).toHaveLength(2);
    expect(await inbox('blerim')).toHaveLength(1);
    expect(await inbox('ana')).toHaveLength(2); // assigned, then moved away
  });

  it('refuses a stale change and leaves the report and history untouched', async () => {
    await assign('owner', { uid: 'ana' });
    const stale = await assign('owner', { uid: 'blerim', reason: 'Rast urgjent', expectedHolderUid: '' });
    expect(stale.status).toBe(409);
    expect((await db.collection('reports').doc('r1').get()).data()!.assignedToUid).toBe('ana');
    expect(await history()).toHaveLength(1);
  });

  it('lets exactly one of two simultaneous assignments win', async () => {
    const results = await Promise.all([
      assign('owner', { uid: 'ana', expectedHolderUid: '' }),
      assign('owner', { uid: 'blerim', expectedHolderUid: '' }),
    ]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await history()).toHaveLength(1);
  });

  it('lets a dispatcher distribute work, with history, notification and an audit entry', async () => {
    const first = await assign('disp', { uid: 'ana' });
    expect(first.status).toBe(200);
    expect((await assign('disp', { uid: 'blerim' })).status).toBe(400); // taking it from Ana needs a reason
    expect((await assign('disp', { uid: 'blerim', reason: 'Ana është me leje' })).status).toBe(200);
    expect(await history()).toMatchObject([
      { toUid: 'ana', byUid: 'disp', byName: 'Dispatcheri' },
      { toUid: 'blerim', byUid: 'disp', fromUid: 'ana', reason: 'Ana është me leje' },
    ].map(x => expect.objectContaining(x)));
    expect(await inbox('blerim')).toHaveLength(1);
    const audited = auditLog.filter(entry => entry.action === 'report.assign');
    expect(audited).toHaveLength(2);
    expect(audited[1].detail).toMatchObject({ reportId: 'r1', targetUid: 'blerim', reason: 'Ana është me leje' });
    expect(auditLog.some(entry => entry.action === 'report.assign.denied')).toBe(true);
  });

  it('keeps the dispatcher inside the same limits: no suspended or non-agent targets, no municipality-stage reports', async () => {
    expect((await assign('disp', { uid: 'gone' })).status).toBe(409);
    expect((await assign('disp', { uid: 'mayor' })).status).toBe(400);
    await db.collection('reports').doc('r1').update({ status: 'In Progress' });
    expect((await assign('disp', { uid: 'ana' })).status).toBe(409);
    expect(await history()).toHaveLength(0);
  });

  it('refuses ineligible targets and non-owners', async () => {
    expect((await assign('owner', { uid: 'gone' })).status).toBe(409);
    expect((await assign('owner', { uid: 'mayor' })).status).toBe(400);
    expect((await assign('owner', { uid: 'nobody' })).status).toBe(404);
    expect((await assign('ana', { uid: 'blerim' })).status).toBe(403);
    expect((await assign('mayor', { uid: 'ana' })).status).toBe(403);
    expect(await history()).toHaveLength(0);
  });

  it('lets the holder release without a reason; history shows it', async () => {
    await assign('owner', { uid: 'ana' });
    const released = await assign('ana', { release: true });
    expect(released.status).toBe(200);
    expect((await db.collection('reports').doc('r1').get()).data()!.assignedToUid).toBe('');
    expect((await history()).map(h => h.kind).sort()).toEqual(['assign', 'release']);
  });

  it('records who acted by name, and pages the history newest first with a cursor', async () => {
    await assign('owner', { uid: 'ana' });
    await assign('owner', { uid: 'blerim', reason: 'Ana është me leje' });
    await assign('owner', { uid: 'ana', reason: 'Blerimi mungon sot' });
    const first = await call('owner', 'GET', '/api/v1/reports/r1/assignments?limit=2');
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.items![0]).toMatchObject({ toUid: 'ana', byName: 'Pronari', reason: 'Blerimi mungon sot' });
    expect(typeof first.body.nextBefore).toBe('string');
    const second = await call('owner', 'GET', `/api/v1/reports/r1/assignments?limit=2&before=${encodeURIComponent(String(first.body.nextBefore))}`);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.nextBefore).toBeNull();
    expect((await call('owner', 'GET', '/api/v1/reports/r1/assignments?limit=abc')).status).toBe(400);
  });

  it('serves the history to staff and the monitor, never to a municipality', async () => {
    await assign('owner', { uid: 'ana' });
    const staff = await call('owner', 'GET', '/api/v1/reports/r1/assignments');
    expect(staff.status).toBe(200);
    expect(staff.body.items).toHaveLength(1);
    expect(staff.body.items[0].createdAt).toBeUndefined();
    expect((await call('mayor', 'GET', '/api/v1/reports/r1/assignments')).status).toBe(403);
  });
});

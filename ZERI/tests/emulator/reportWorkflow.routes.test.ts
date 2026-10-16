import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { invalidatePool, registerReportWorkflowRoutes, syncReportTasks, loadPool, loadPriorityRules, TASKS } from '../../server/reportWorkflow';

/**
 * The report workflow against the Firestore emulator: the six-stage lifecycle, the
 * tasks it generates, rejection, two agents on one report, role limits, repeated
 * clicks and concurrent updates. Authentication is a header and a fixed table of
 * people whose "claims" are what the server trusts.
 * Run with: npm run test:workflow
 */
let db: Firestore;
let server: Server;
let base = '';

const PEOPLE: Record<string, { role: string; name: string; municipality?: string; disabled?: boolean; skills?: string[] }> = {
  boss: { role: 'superadmin', name: 'Pronari' },
  disp: { role: 'dispatcher', name: 'Menaxheri' },
  ana: { role: 'agent', name: 'Ana', skills: ['infrastruktur'] },
  blerim: { role: 'agent', name: 'Blerim' },
  appr: { role: 'approver', name: 'Zyrtarja' },
  mon: { role: 'monitor', name: 'Monitoruesi' },
  gone: { role: 'agent', name: 'Larguar', disabled: true },
  pr: { role: 'municipality', name: 'Komuna Prishtinë', municipality: 'Prishtinë' },
  pz: { role: 'municipality', name: 'Komuna Prizren', municipality: 'Prizren' },
};

const COMPLETE = {
  title: 'Gropë e rrezikshme',
  description: 'Një gropë e madhe në rrugë që rrezikon kalimtarët çdo ditë.',
  category: 'Infrastrukturë',
  urgency: 'E lartë',
  images: ['https://example.test/1.jpg'],
  authorId: 'citizen-1',
  authorName: 'Qytetari',
  isAnonymous: false,
  upvotes: 3,
  timeline: [],
  createdAt: '2026-10-14T08:00:00.000Z',
};

const wipe = async () => {
  for (const name of ['reports', 'users', 'workerProfiles', TASKS, 'notifications', 'report_events', 'workflowConfig']) {
    for (const ref of await db.collection(name).listDocuments()) await db.recursiveDelete(ref);
  }
};

const seedReport = (id: string, municipality = 'Prishtinë', status = 'Pending Review', extra: Record<string, unknown> = {}) =>
  db.collection('reports').doc(id).set({ ...COMPLETE, location: { municipality, address: 'Rr. Agim Ramadani' }, status, ...extra });

const post = async (uid: string, path: string, body: unknown) => {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() as any };
};
const get = async (uid: string, path: string) => {
  const response = await fetch(`${base}${path}`, { headers: { 'x-test-uid': uid } });
  return { status: response.status, body: await response.json() as any };
};
const act = (uid: string, id: string, body: Record<string, unknown>) => post(uid, `/api/v1/workflow/reports/${id}/action`, body);
const statusOf = async (id: string) => (await db.collection('reports').doc(id).get()).get('status');
const tasksOf = async (id: string) => (await db.collection(TASKS).where('reportId', '==', id).get()).docs.map(d => ({ id: d.id, ...(d.data() as any) }));
const openTasks = async (id: string) => (await tasksOf(id)).filter(t => t.status === 'open');
const events = async (id: string) => (await db.collection('reports').doc(id).collection('workflowEvents').get()).docs.map(d => d.data());
const sync = async (id: string) => {
  invalidatePool();
  const [rules, pool] = await Promise.all([loadPriorityRules(db), loadPool(db, fakeAuth)]);
  return syncReportTasks(db, id, { rules, pool, actorUid: 'system' });
};

const fakeAuth = {
  getUsers: async (ids: Array<{ uid: string }>) => ({
    users: ids.filter(i => PEOPLE[i.uid]).map(({ uid }) => ({
      uid,
      disabled: PEOPLE[uid].disabled === true,
      customClaims: { role: PEOPLE[uid].role, ...(PEOPLE[uid].municipality ? { municipality: PEOPLE[uid].municipality } : {}) },
    })),
    notFound: [],
  }),
} as unknown as Auth;

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through `npm run test:workflow`.');
  db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-workflow' }));
  const app = express();
  app.use(express.json());
  const requireAuth: express.RequestHandler = (req, res, next) => {
    const uid = req.header('x-test-uid');
    if (!uid || !PEOPLE[uid]) return res.status(401).json({ error: 'Unauthorized' });
    (req as unknown as { user: { uid: string } }).user = { uid };
    next();
  };
  registerReportWorkflowRoutes(app, {
    requireAuth,
    db: () => db,
    authAdmin: () => fakeAuth,
    actingUser: req => {
      const uid = (req as unknown as { user: { uid: string } }).user.uid;
      return { uid, email: `${uid}@test`, role: PEOPLE[uid].role, municipality: PEOPLE[uid].municipality ?? '', permissions: [] };
    },
    audit: () => undefined,
  });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => { server?.close(); });

beforeEach(async () => {
  await wipe();
  invalidatePool();
  for (const [uid, p] of Object.entries(PEOPLE)) {
    await db.collection('users').doc(uid).set({ name: p.name, role: p.role, email: `${uid}@test`, municipality: p.municipality ?? '' });
    if (['agent', 'dispatcher', 'approver'].includes(p.role)) {
      await db.collection('workerProfiles').doc(uid).set({ uid, role: p.role, skills: p.skills ?? [], capacity: 5, availability: 'available' });
    }
  }
});

describe('the full lifecycle on the database', () => {
  it('Në pritje → U aprovua → I caktuar → Në proces → U zgjidh → U mbyll, with two agents on one report', async () => {
    await seedReport('r1');

    // A new report gets one review task, given to an eligible person.
    await sync('r1');
    let open = await openTasks('r1');
    expect(open.map(t => t.kind)).toEqual(['review']);
    expect(['ana', 'blerim', 'disp', 'appr']).toContain(open[0].assigneeUid);
    // Syncing again changes nothing (no duplicate task).
    await sync('r1');
    expect((await tasksOf('r1')).length).toBe(1);

    // 1 → 2: Aprovo raportimin.
    let res = await act('ana', 'r1', { action: 'approve_report', requestId: 'req-approve-1' });
    expect(res.status).toBe(200);
    expect(await statusOf('r1')).toBe('Approved');
    open = await openTasks('r1');
    expect(open.map(t => t.kind)).toEqual(['assign']);
    expect(open[0].needsAssignment).toBe(true);
    expect((await tasksOf('r1')).find(t => t.kind === 'review')?.status).toBe('done');

    // An agent cannot assign; the report stays in the approved queue.
    res = await act('ana', 'r1', { action: 'assign', assignees: [{ type: 'agent', uid: 'blerim' }] });
    expect(res.status).toBe(403);
    expect(await statusOf('r1')).toBe('Approved');

    // A suspended person is never given work; nothing changes.
    res = await act('disp', 'r1', { action: 'assign', assignees: [{ type: 'agent', uid: 'gone' }] });
    expect(res.status).toBe(400);
    expect(await statusOf('r1')).toBe('Approved');
    expect((await openTasks('r1')).map(t => t.kind)).toEqual(['assign']);

    // 2 → 3: Cakto përgjegjësin — two agents, two assignments, one report.
    res = await act('disp', 'r1', { action: 'assign', assignees: [{ type: 'agent', uid: 'ana' }, { type: 'agent', uid: 'blerim' }], requestId: 'req-assign-1' });
    expect(res.status).toBe(200);
    expect(await statusOf('r1')).toBe('Assigned');
    expect((await db.collection('reports').get()).size).toBe(1);
    const assignments = (await db.collection('reports').doc('r1').collection('assignments').get()).docs.map(d => d.id).sort();
    expect(assignments).toEqual(['u_ana', 'u_blerim']);
    open = await openTasks('r1');
    expect(open.map(t => t.id).sort()).toEqual(['r1__work__u_ana', 'r1__work__u_blerim']);

    // Each agent sees their own task without claiming it.
    const mine = await get('ana', '/api/v1/workflow/tasks?view=mine');
    expect(mine.body.items.map((t: any) => t.id)).toEqual(['r1__work__u_ana']);

    // Opening the report does not start the work.
    const detail = await get('ana', '/api/v1/workflow/reports/r1');
    expect(detail.status).toBe(200);
    expect(detail.body.actions.map((a: any) => a.action)).toEqual(['start_process']);
    expect(await statusOf('r1')).toBe('Assigned');

    // 3 → 4: Aprovo fillimin e procesit.
    res = await act('ana', 'r1', { action: 'start_process' });
    expect(res.status).toBe(200);
    expect(await statusOf('r1')).toBe('In Progress');

    // Ana submits her part: the report stays in process, Blerim's task stays open.
    res = await act('ana', 'r1', { action: 'submit_resolution', note: 'Mbusha gropën me asfalt më 14 tetor.', evidence: ['https://example.test/after.jpg'] });
    expect(res.status).toBe(200);
    expect(await statusOf('r1')).toBe('In Progress');
    expect((await openTasks('r1')).map(t => t.id)).toEqual(['r1__work__u_blerim']);

    // Verifying now would close work that is not done.
    res = await act('boss', 'r1', { action: 'approve_resolution', note: 'Verifikuar në terren.' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('WORK_OUTSTANDING');
    expect(await statusOf('r1')).toBe('In Progress');

    res = await act('blerim', 'r1', { action: 'submit_resolution', note: 'Vendosa shenjat e trafikut rreth zonës.' });
    expect(res.status).toBe(200);
    expect((await openTasks('r1')).map(t => t.kind)).toEqual(['verify']);

    // 4 → 5: Aprovo zgjidhjen — the manager may not, the superadmin may.
    res = await act('disp', 'r1', { action: 'approve_resolution', note: 'Verifikuar.' });
    expect(res.status).toBe(403);
    res = await act('boss', 'r1', { action: 'approve_resolution', note: 'Verifikuar në terren me foto.', requestId: 'req-resolve-1' });
    expect(res.status).toBe(200);
    expect(await statusOf('r1')).toBe('Resolved');
    expect((await openTasks('r1')).map(t => t.kind)).toEqual(['close']);

    // The same click again: answered once, nothing written twice.
    const before = (await events('r1')).length;
    res = await act('boss', 'r1', { action: 'approve_resolution', note: 'Verifikuar në terren me foto.', requestId: 'req-resolve-1' });
    expect(res.status).toBe(200);
    expect(res.body.replay).toBe(true);
    expect((await events('r1')).length).toBe(before);

    // Resolution does not close by itself; 5 → 6 needs Aprovo mbylljen.
    expect(await statusOf('r1')).toBe('Resolved');
    res = await act('boss', 'r1', { action: 'approve_closure', note: 'Rasti u mbyll; qytetari u njoftua.' });
    expect(res.status).toBe(200);
    const closed = (await db.collection('reports').doc('r1').get()).data() as any;
    expect(closed.status).toBe('Closed');
    expect(closed.closedBy).toBe('boss');
    expect(closed.finalOutcome).toContain('mbyll');
    expect(closed.description).toBe(COMPLETE.description);
    expect(await openTasks('r1')).toEqual([]);

    // U mbyll is final: a closed report cannot be reopened.
    res = await act('boss', 'r1', { action: 'reopen_report', reason: 'Qytetari kundërshton rezultatin.' });
    expect(res.status).toBe(409);

    // Every transition is on the record: previous, new, who, when, text.
    const history = (await events('r1')).sort((a, b) => a.atMs - b.atMs);
    const moves = history.filter(e => e.from !== e.to).map(e => `${e.fromStatus}>${e.toStatus}:${e.actorUid}`);
    expect(moves).toEqual([
      'Pending Review>Approved:ana',
      'Approved>Assigned:disp',
      'Assigned>In Progress:ana',
      'In Progress>Resolved:boss',
      'Resolved>Closed:boss',
    ]);
    for (const e of history) expect(typeof e.atMs).toBe('number');

    // The closed report stays readable in its queue.
    const counts = await get('mon', '/api/v1/workflow/counts');
    expect(counts.body.counts.closed).toBe(1);
    const closedQueue = await get('mon', '/api/v1/workflow/reports?queue=closed');
    expect(closedQueue.body.items.map((r: any) => r.id)).toEqual(['r1']);
  });
});

describe('rejection and queues', () => {
  it('rejection needs a reason and lands in the rejected section, with correct counters', async () => {
    await seedReport('a');
    await seedReport('b');
    await seedReport('c', 'Prishtinë', 'Approved');
    await sync('a');

    let res = await act('boss', 'a', { action: 'reject_report', reason: '' });
    expect(res.status).toBe(400);
    expect(await statusOf('a')).toBe('Pending Review');

    res = await act('ana', 'a', { action: 'reject_report', reason: 'Dublikatë e raportit tjetër.' });
    expect(res.status).toBe(403);

    res = await act('appr', 'a', { action: 'reject_report', reason: 'Dublikatë e raportit tjetër.' });
    expect(res.status).toBe(200);
    const rejected = (await db.collection('reports').doc('a').get()).data() as any;
    expect(rejected.status).toBe('Rejected');
    expect(rejected.rejectionReason).toBe('Dublikatë e raportit tjetër.');
    expect(await openTasks('a')).toEqual([]);

    const counts = await get('boss', '/api/v1/workflow/counts');
    expect(counts.body.counts).toMatchObject({ pending: 1, approved: 1, assigned: 0, in_process: 0, resolved: 0, closed: 0, rejected: 1 });
    const pending = await get('boss', '/api/v1/workflow/reports?queue=pending');
    expect(pending.body.items.map((r: any) => r.id)).toEqual(['b']);
    const rejectedQueue = await get('boss', '/api/v1/workflow/reports?queue=rejected');
    expect(rejectedQueue.body.items[0].rejectionReason).toBe('Dublikatë e raportit tjetër.');
  });

  it('a wrongly refused report can be reopened by the superadmin only, with a reason, and returns to review', async () => {
    await seedReport('a');
    await sync('a');
    expect((await act('appr', 'a', { action: 'reject_report', reason: 'Dublikatë e raportit tjetër.' })).status).toBe(200);

    expect((await act('appr', 'a', { action: 'reopen_report', reason: 'Refuzimi ishte i gabuar.' })).status).toBe(403);
    expect((await act('boss', 'a', { action: 'reopen_report', reason: '' })).status).toBe(400);
    expect(await statusOf('a')).toBe('Rejected');

    const res = await act('boss', 'a', { action: 'reopen_report', reason: 'Refuzimi ishte i gabuar.' });
    expect(res.status).toBe(200);
    const reopened = (await db.collection('reports').doc('a').get()).data() as any;
    expect(reopened.status).toBe('Pending Review');
    expect(reopened.rejectionReason).toBeUndefined();
    expect(reopened.workflow.reopenReason).toBe('Refuzimi ishte i gabuar.');
    expect((await openTasks('a')).map(t => t.kind)).toEqual(['review']);
    const pending = await get('boss', '/api/v1/workflow/reports?queue=pending');
    expect(pending.body.items.map((r: any) => r.id)).toEqual(['a']);
  });
});

describe('concurrency and failures', () => {
  it('two people approving at once: exactly one wins, one event is written', async () => {
    await seedReport('r');
    const results = await Promise.all([
      act('ana', 'r', { action: 'approve_report', requestId: 'race-ana-0001' }),
      act('blerim', 'r', { action: 'approve_report', requestId: 'race-blerim-01' }),
    ]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await statusOf('r')).toBe('Approved');
    expect((await events('r')).length).toBe(1);
    expect((await openTasks('r')).filter(t => t.kind === 'assign').length).toBe(1);
  });

  it('a stale screen is refused and the status stands', async () => {
    await seedReport('r', 'Prishtinë', 'Approved');
    const res = await act('ana', 'r', { action: 'approve_report', expectedStatus: 'Pending Review' });
    expect(res.status).toBe(409);
    expect(await statusOf('r')).toBe('Approved');
  });

  it('an unknown report or action writes nothing', async () => {
    expect((await act('boss', 'missing', { action: 'approve_report' })).status).toBe(404);
    await seedReport('r');
    expect((await act('boss', 'r', { action: 'make_it_resolved' })).status).toBe(400);
    expect(await statusOf('r')).toBe('Pending Review');
  });
});

describe('role restrictions', () => {
  it('monitoring reads but cannot act', async () => {
    await seedReport('r');
    const res = await act('mon', 'r', { action: 'approve_report' });
    expect(res.status).toBe(403);
    expect((await get('mon', '/api/v1/workflow/reports/r')).body.actions).toEqual([]);
  });

  it('a municipality acts only on reports routed and assigned to it', async () => {
    await seedReport('r', 'Prishtinë', 'Approved');
    // Prizren cannot see a Prishtinë report at all.
    expect((await get('pz', '/api/v1/workflow/reports/r')).status).toBe(404);
    // Pending reports are not visible to a municipality.
    await seedReport('p', 'Prishtinë', 'Pending Review');
    expect((await get('pr', '/api/v1/workflow/reports/p')).status).toBe(404);

    let res = await act('disp', 'r', { action: 'assign', assignees: [{ type: 'municipality', municipality: 'Prishtinë' }] });
    expect(res.status).toBe(200);
    // A municipality without an account cannot be given the work.
    await seedReport('q', 'Prishtinë', 'Approved');
    res = await act('disp', 'q', { action: 'assign', assignees: [{ type: 'municipality', municipality: 'Gjilan' }] });
    expect(res.status).toBe(400);

    const tasks = await get('pr', '/api/v1/workflow/tasks?view=mine');
    expect(tasks.body.items.map((t: any) => t.id)).toEqual(['r__work__m_prishtine']);
    expect((await act('pz', 'r', { action: 'start_process' })).status).toBe(404);
    expect((await act('pr', 'r', { action: 'start_process' })).status).toBe(200);
    expect(await statusOf('r')).toBe('In Progress');
  });

  it('the legacy endpoint is the same state machine, and the free claim is gone', async () => {
    await seedReport('r');
    expect((await post('ana', '/api/v1/reports/r/transition', { transition: 'claim' })).status).toBe(410);
    const res = await post('ana', '/api/v1/reports/r/transition', { transition: 'pass_to_municipality' });
    expect(res.status).toBe(200);
    expect(await statusOf('r')).toBe('Approved');
    // "municipality_accept" from Approved would skip I caktuar: refused.
    expect((await post('boss', '/api/v1/reports/r/transition', { transition: 'municipality_accept' })).status).toBe(409);
  });
});

describe('automatic assignment', () => {
  it('auto-assign gives the work to the best eligible person; managers can reassign a review task', async () => {
    await seedReport('r', 'Prishtinë', 'Approved');
    const res = await post('disp', '/api/v1/workflow/reports/r/auto-assign', { requestId: 'auto-r-000001' });
    expect(res.status).toBe(200);
    expect(await statusOf('r')).toBe('Assigned');
    const assigned = (await db.collection('reports').doc('r').get()).get('assigneeUids');
    // Ana fits the infrastructure sector.
    expect(assigned).toEqual(['ana']);

    await seedReport('p');
    await sync('p');
    const review = (await openTasks('p'))[0];
    expect((await post('ana', `/api/v1/workflow/tasks/${review.id}/assign`, { uid: 'blerim' })).status).toBe(403);
    expect((await post('disp', `/api/v1/workflow/tasks/${review.id}/assign`, { uid: 'mon' })).status).toBe(400);
    expect((await post('disp', `/api/v1/workflow/tasks/${review.id}/assign`, { uid: 'blerim' })).status).toBe(200);
    expect((await openTasks('p'))[0].assigneeUid).toBe('blerim');
  });

  it('with nobody eligible the work waits for a manager, who is notified', async () => {
    for (const uid of ['ana', 'blerim', 'disp', 'appr']) PEOPLE[uid].disabled = true;
    try {
      await seedReport('r');
      await sync('r');
      const [task] = await openTasks('r');
      expect(task.assigneeUid).toBeNull();
      expect(task.needsAssignment).toBe(true);
      const auto = await post('boss', '/api/v1/workflow/reports/r/auto-assign', {});
      expect(auto.status).toBe(409);
    } finally {
      for (const uid of ['ana', 'blerim', 'disp', 'appr']) PEOPLE[uid].disabled = false;
    }
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { registerWorkItemRoutes } from '../../server/workItemRoutes';
import { CONFIG, NOTIFICATIONS, PROFILES, WORK, createWorkItem, validateCreate, type ProfileDoc, type WorkItemDoc } from '../../server/workItems';

/**
 * The work-item HTTP routes against the Firestore emulator, as each kind of account sees them.
 * Authentication is a header and a fixed table; everything else is the real handlers.
 * Run with the emulator (see docs/WORKFLOW_SYSTEM.md).
 */
let db: Firestore;
let server: Server;
let base = '';
const auditLog: Array<{ action: string; detail?: Record<string, unknown> }> = [];
let clock = Date.UTC(2026, 9, 14, 9, 0, 0);

const PEOPLE: Record<string, { role: string; name: string; municipality?: string; disabled?: boolean }> = {
  owner: { role: 'superadmin', name: 'Pronari' },
  disp: { role: 'dispatcher', name: 'Dispatcheri' },
  monitor: { role: 'monitor', name: 'Monitori' },
  ana: { role: 'agent', name: 'Ana' },
  blerim: { role: 'agent', name: 'Blerim' },
  peja1: { role: 'municipality', name: 'Komuna Pejë', municipality: 'Pejë' },
  gji1: { role: 'municipality', name: 'Komuna Gjilan', municipality: 'Gjilan' },
  mod1: { role: 'debatwp', name: 'Moderatori' },
  mod2: { role: 'debatwp', name: 'Moderatori 2' },
  cit1: { role: 'citizen', name: 'Qytetari' },
  guest: { role: 'guest', name: 'Mysafir' },
};

const call = async (uid: string | null, method: string, path: string, body?: unknown) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(uid ? { 'x-test-uid': uid } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const type = response.headers.get('content-type') ?? '';
  return { status: response.status, body: type.includes('json') ? await response.json() : await response.text() } as { status: number; body: any };
};

const wipe = async () => {
  for (const name of [WORK, PROFILES, NOTIFICATIONS, CONFIG, 'users']) for (const ref of await db.collection(name).listDocuments()) await db.recursiveDelete(ref);
};

async function seedProfiles(count: number, over: (index: number) => Partial<ProfileDoc> = () => ({})) {
  for (let start = 0; start < count; start += 400) {
    const batch = db.batch();
    for (let index = start; index < Math.min(count, start + 400); index += 1) {
      const uid = `w${String(index).padStart(3, '0')}`;
      const doc: ProfileDoc = {
        uid, name: `Punonjës ${String(index).padStart(3, '0')}`, nameLower: `punonjës ${String(index).padStart(3, '0')}`, role: 'agent',
        municipality: ['Prishtinë', 'Prizren', 'Pejë', 'Gjilan', 'Ferizaj'][index % 5], department: ['Infrastruktura', 'Mjedisi', 'Shërbimet'][index % 3], skills: [],
        capacity: 10, availability: 'available', schedule: null, disabled: false, load: index % 20 === 0 ? 10 : index % 7 === 0 ? 1 : 5, activeCount: 0, lastAssignedAtMs: null, updatedAtMs: clock,
        ...over(index),
      };
      batch.set(db.collection(PROFILES).doc(uid), doc);
    }
    await batch.commit();
  }
}

const profileFor = (uid: string, role = 'agent', over: Partial<ProfileDoc> = {}) => db.collection(PROFILES).doc(uid).set({
  uid, name: uid, nameLower: uid, role, municipality: PEOPLE[uid]?.municipality ?? '', department: '', skills: [], capacity: 5, availability: 'available', schedule: null,
  disabled: false, load: 0, activeCount: 0, lastAssignedAtMs: null, updatedAtMs: clock, ...over,
} satisfies ProfileDoc);

const makeItem = async (over: Record<string, unknown> = {}) => {
  const checked = validateCreate({ kind: 'internal_task', title: 'Detyrë test', priority: 'normal', ...over });
  if (checked.outcome === 'invalid') throw new Error(checked.error);
  return (await createWorkItem(db, { uid: 'owner', role: 'superadmin', name: 'Pronari' }, checked.value, clock)).id;
};

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through the emulator.');
  db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-workroutes' }));
  const app = express();
  app.use(express.json());
  const requireAuth: express.RequestHandler = (req, res, next) => {
    const uid = req.header('x-test-uid');
    if (!uid || !PEOPLE[uid]) return res.status(401).json({ error: 'Unauthorized' });
    (req as unknown as { user: { uid: string } }).user = { uid };
    next();
  };
  const authAdmin = () => ({
    getUsers: async (identifiers: Array<{ uid: string }>) => ({
      users: identifiers.filter(({ uid }) => PEOPLE[uid]).map(({ uid }) => ({
        uid, email: `${uid}@test`, displayName: PEOPLE[uid].name, disabled: PEOPLE[uid].disabled === true,
        customClaims: { role: PEOPLE[uid].role, ...(PEOPLE[uid].municipality ? { municipality: PEOPLE[uid].municipality } : {}) },
      })),
    }),
  }) as unknown as Auth;
  registerWorkItemRoutes(app, {
    requireAuth, db: () => db, authAdmin,
    actingUser: req => {
      const uid = (req as unknown as { user: { uid: string } }).user.uid;
      return { uid, email: `${uid}@test`, role: PEOPLE[uid].role, municipality: PEOPLE[uid].municipality ?? '', permissions: [] };
    },
    audit: (action, _req, detail) => { auditLog.push({ action, detail }); },
    now: () => clock,
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await wipe(); await new Promise(resolve => server.close(resolve)); });
beforeEach(async () => { auditLog.length = 0; clock = Date.UTC(2026, 9, 14, 9, 0, 0); await wipe(); });

describe('authentication and creation', () => {
  it('refuses everything without a signed-in account', async () => {
    for (const [method, path] of [['GET', '/items'], ['GET', '/overview'], ['GET', '/workers'], ['POST', '/items'], ['GET', '/notifications']] as const) {
      expect((await call(null, method, `/api/v1/work${path}`, method === 'POST' ? {} : undefined)).status, path).toBe(401);
    }
  });

  it('a manager creates work and the engine assigns it; the response says who got it', async () => {
    await profileFor('ana');
    const created = await call('owner', 'POST', '/api/v1/work/items', { kind: 'internal_task', title: 'Verifiko urën në Pejë', priority: 'high', municipality: 'Pejë' });
    expect(created.status).toBe(201);
    expect(created.body.assignment).toMatchObject({ outcome: 'assigned', uid: 'ana' });
    expect(auditLog.map(entry => entry.action)).toContain('work.create');
  });

  it('refuses invalid input and refuses accounts that may not open that kind of work', async () => {
    expect((await call('owner', 'POST', '/api/v1/work/items', { kind: 'internal_task', title: 'ab' })).status).toBe(400);
    expect((await call('ana', 'POST', '/api/v1/work/items', { kind: 'internal_task', title: 'Detyrë e re' })).status).toBe(403);
    expect((await call('peja1', 'POST', '/api/v1/work/items', { kind: 'report_referral', title: 'Referim' })).status).toBe(403);
    expect((await call('mod1', 'POST', '/api/v1/work/items', { kind: 'internal_task', title: 'Detyrë e re' })).status).toBe(403);
    expect((await call('mod1', 'POST', '/api/v1/work/items', { kind: 'moderation_case', title: 'Postim i raportuar', autoAssign: false })).status).toBe(201);
  });

  it('the same event sent twice makes one item', async () => {
    const body = { kind: 'report_referral', title: 'Referim te Komuna Pejë', municipality: 'Pejë', dedupeKey: 'report:r1:peja', autoAssign: false };
    const first = await call('owner', 'POST', '/api/v1/work/items', body);
    const second = await call('owner', 'POST', '/api/v1/work/items', body);
    expect([first.status, second.status]).toEqual([201, 200]);
    expect(second.body.id).toBe(first.body.id);
    expect((await db.collection(WORK).get()).size).toBe(1);
  });
});

describe('what each role sees', () => {
  it('everyone sees only their own in "mine"; field agents cannot list the queue', async () => {
    const mine = await makeItem({ title: 'Detyra e Anës' });
    await db.collection(WORK).doc(mine).update({ assigneeUid: 'ana', status: 'assigned' });
    await makeItem({ title: 'Detyra e askujt' });
    const ana = await call('ana', 'GET', '/api/v1/work/items?view=mine');
    expect(ana.body.items.map((item: any) => item.title)).toEqual(['Detyra e Anës']);
    expect((await call('blerim', 'GET', '/api/v1/work/items?view=mine')).body.items).toEqual([]);
    expect((await call('ana', 'GET', '/api/v1/work/items?view=open')).status).toBe(403);
    expect((await call('ana', 'GET', '/api/v1/work/items?view=unassigned')).status).toBe(403);
  });

  it('a municipality sees only its own referrals, and never internal tasks or another municipality\'s', async () => {
    await makeItem({ kind: 'report_referral', municipality: 'Pejë', title: 'Referim Pejë' });
    await makeItem({ kind: 'report_referral', municipality: 'Gjilan', title: 'Referim Gjilan' });
    await makeItem({ kind: 'internal_task', municipality: 'Pejë', title: 'Detyrë e brendshme Pejë' });
    const peja = await call('peja1', 'GET', '/api/v1/work/items?view=open&kind=internal_task');
    expect(peja.body.items.map((item: any) => item.title)).toEqual(['Referim Pejë']);
    const gjilan = await call('gji1', 'GET', '/api/v1/work/items?view=open');
    expect(gjilan.body.items.map((item: any) => item.title)).toEqual(['Referim Gjilan']);
  });

  it('a municipality gets "not found" for another municipality\'s referral, for a task and for a case', async () => {
    const other = await makeItem({ kind: 'report_referral', municipality: 'Gjilan' });
    const task = await makeItem({ kind: 'internal_task', municipality: 'Pejë' });
    const debate = await makeItem({ kind: 'moderation_case', title: 'Rast debati' });
    for (const id of [other, task, debate]) {
      expect((await call('peja1', 'GET', `/api/v1/work/items/${id}`)).status).toBe(404);
      expect((await call('peja1', 'POST', `/api/v1/work/items/${id}/transition`, { action: 'escalate', reason: 'Provë e paautorizuar.' })).status).toBe(404);
    }
  });

  it('the debate moderator sees cases only: no reports, tasks, or referrals', async () => {
    await makeItem({ kind: 'moderation_case', title: 'Rast debati' });
    await makeItem({ kind: 'report_referral', municipality: 'Pejë', title: 'Referim' });
    await makeItem({ kind: 'internal_task', title: 'Detyrë' });
    const list = await call('mod1', 'GET', '/api/v1/work/items?view=open&kind=internal_task');
    expect(list.body.items.map((item: any) => item.title)).toEqual(['Rast debati']);
    expect((await call('mod1', 'GET', '/api/v1/work/overview')).status).toBe(403);
    expect((await call('mod1', 'GET', '/api/v1/work/workers')).status).toBe(403);
  });

  it('the monitoring role reads everything and changes nothing', async () => {
    await profileFor('ana');
    const id = await makeItem();
    expect((await call('monitor', 'GET', '/api/v1/work/items?view=unassigned')).body.items).toHaveLength(1);
    expect((await call('monitor', 'GET', '/api/v1/work/overview?fresh=1')).status).toBe(200);
    const attempt = await call('monitor', 'POST', `/api/v1/work/items/${id}/transition`, { action: 'assign', assigneeUid: 'ana' });
    expect(attempt).toMatchObject({ status: 403, body: { code: 'READ_ONLY' } });
    expect((await call('monitor', 'POST', '/api/v1/work/items', { kind: 'internal_task', title: 'Detyrë e re' })).status).toBe(403);
    expect((await call('monitor', 'PUT', '/api/v1/work/config/sla', { dueHours: { low: 1, normal: 1, high: 1, urgent: 1 } })).status).toBe(403);
  });

  it('a citizen sees only a moderation case about their own content, and may appeal it', async () => {
    const mine = await makeItem({ kind: 'moderation_case', title: 'Rast për mua', subjectUid: 'cit1' });
    const other = await makeItem({ kind: 'moderation_case', title: 'Rast për tjetër', subjectUid: 'someone' });
    expect((await call('cit1', 'GET', `/api/v1/work/items/${other}`)).status).toBe(404);
    const detail = await call('cit1', 'GET', `/api/v1/work/items/${mine}`);
    expect(detail.status).toBe(200);
    expect(detail.body.item).not.toHaveProperty('subjectUid');
    expect((await call('cit1', 'GET', '/api/v1/work/items?view=open')).status).toBe(403);
  });
});

describe('listing is paged and ordered', () => {
  it('walks 25 items 10 at a time in deadline order without repeating or skipping any', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 25; i += 1) {
      const id = await makeItem({ title: `Detyra ${String(i).padStart(2, '0')}` });
      await db.collection(WORK).doc(id).update({ assigneeUid: 'ana', status: 'assigned', dueAtMs: clock + (25 - i) * 60_000 });
      ids.push(id);
    }
    const seen: string[] = [];
    let cursor = '';
    for (let page = 0; page < 5; page += 1) {
      const response = await call('ana', 'GET', `/api/v1/work/items?view=mine&limit=10${cursor ? `&cursor=${cursor}` : ''}`);
      seen.push(...response.body.items.map((item: any) => item.id));
      if (!response.body.nextCursor) break;
      cursor = response.body.nextCursor;
    }
    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25);
    expect(seen).toEqual([...ids].reverse()); // nearest deadline first
  });

  it('the overdue view lists only open work past its deadline, oldest deadline first', async () => {
    const late = await makeItem({ title: 'Vonuar' });
    await db.collection(WORK).doc(late).update({ dueAtMs: clock - 3_600_000 });
    await makeItem({ title: 'Në kohë' });
    const finished = await makeItem({ title: 'E mbyllur' });
    await db.collection(WORK).doc(finished).update({ dueAtMs: clock - 3_600_000, open: false, status: 'done', doneAtMs: clock });
    const list = await call('owner', 'GET', '/api/v1/work/items?view=overdue');
    expect(list.body.items.map((item: any) => item.title)).toEqual(['Vonuar']);
  });
});

describe('one item', () => {
  it('shows the holder the item, its history and exactly the moves they may make', async () => {
    await profileFor('ana');
    const id = await makeItem({ title: 'Detyra e Anës' });
    await call('owner', 'POST', `/api/v1/work/items/${id}/transition`, { action: 'assign', assigneeUid: 'ana' });
    const detail = await call('ana', 'GET', `/api/v1/work/items/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.item).toMatchObject({ status: 'assigned', assigneeUid: 'ana' });
    expect(detail.body.item).not.toHaveProperty('dedupeKey');
    expect(detail.body.events.map((event: any) => event.action ?? event.type).sort()).toEqual(['assign', 'created']);
    expect(detail.body.actions.map((action: any) => action.action).sort()).toEqual(['accept', 'decline', 'escalate']);
    expect((await call('blerim', 'GET', `/api/v1/work/items/${id}`)).status).toBe(404);
  });

  it('runs a transition over HTTP, denies the wrong one with a code, and records the audit trail', async () => {
    await profileFor('ana'); await profileFor('blerim');
    const id = await makeItem();
    await call('owner', 'POST', `/api/v1/work/items/${id}/transition`, { action: 'assign', assigneeUid: 'ana' });
    const accepted = await call('ana', 'POST', `/api/v1/work/items/${id}/transition`, { action: 'accept' });
    expect(accepted).toMatchObject({ status: 200, body: { status: 'accepted', version: 3 } });
    expect((await call('blerim', 'POST', `/api/v1/work/items/${id}/transition`, { action: 'start' })).status).toBe(404); // cannot even see it
    expect(await call('ana', 'POST', `/api/v1/work/items/${id}/transition`, { action: 'complete' })).toMatchObject({ status: 409, body: { code: 'WRONG_STATE' } });
    expect(await call('ana', 'POST', `/api/v1/work/items/${id}/transition`, { action: 'start' })).toMatchObject({ status: 200 });
    expect(await call('ana', 'POST', `/api/v1/work/items/${id}/transition`, { action: 'block' })).toMatchObject({ status: 400, body: { code: 'REASON_REQUIRED' } });
    expect(await call('ana', 'POST', `/api/v1/work/items/${id}/transition`, { action: 'start', expectedVersion: 1 })).toMatchObject({ status: 409 });
    const actions = auditLog.map(entry => entry.action);
    expect(actions).toEqual(expect.arrayContaining(['work.transition', 'work.transition.denied']));
  });

  it('lets a manager intervene in someone\'s blocked work, with a reason, and marks it as an override', async () => {
    await profileFor('ana');
    const id = await makeItem();
    for (const [uid, request] of [['owner', { action: 'assign', assigneeUid: 'ana' }], ['ana', { action: 'accept' }], ['ana', { action: 'start' }], ['ana', { action: 'block', reason: 'Pret informacion.' }]] as const) {
      expect((await call(uid, 'POST', `/api/v1/work/items/${id}/transition`, request)).status).toBe(200);
    }
    expect((await call('owner', 'POST', `/api/v1/work/items/${id}/transition`, { action: 'unblock', note: 'U sqarua.' })).body.code).toBe('OVERRIDE_REASON_REQUIRED');
    const done = await call('owner', 'POST', `/api/v1/work/items/${id}/transition`, { action: 'unblock', note: 'U sqarua.', reason: 'Informacioni erdhi nga komuna.' });
    expect(done).toMatchObject({ status: 200, body: { override: true, status: 'in_progress' } });
  });

  it('explains the assignment engine\'s choice without applying it (dry run)', async () => {
    await profileFor('ana', 'agent', { load: 2 }); await profileFor('blerim', 'agent', { load: 0 });
    const id = await makeItem();
    const dry = await call('owner', 'POST', `/api/v1/work/items/${id}/auto-assign`, { dryRun: true });
    expect(dry.body).toMatchObject({ dryRun: true, outcome: 'assigned', uid: 'blerim' });
    expect(dry.body.considered).toHaveLength(2);
    expect((await db.collection(WORK).doc(id).get()).data()?.assigneeUid).toBeNull();
    expect((await call('ana', 'POST', `/api/v1/work/items/${id}/auto-assign`, { dryRun: true })).status).toBe(403);
    expect((await call('owner', 'POST', `/api/v1/work/items/${id}/auto-assign`, {})).body).toMatchObject({ outcome: 'assigned', uid: 'blerim' });
    expect((await call('owner', 'POST', `/api/v1/work/items/${id}/auto-assign`, {})).status).toBe(409);
  });
});

describe('the manager\'s command center, with hundreds of seeded workers', () => {
  it('summarises 300 workers and 120 items, and names who is overloaded', async () => {
    await seedProfiles(300, index => ({ availability: index % 50 === 0 ? 'off' : 'available' }));
    for (let i = 0; i < 120; i += 1) {
      const id = await makeItem({ title: `Detyra ${i}`, municipality: ['Prishtinë', 'Pejë'][i % 2] });
      if (i % 3 === 0) await db.collection(WORK).doc(id).update({ dueAtMs: clock - 3_600_000 });
    }
    const overview = await call('owner', 'GET', '/api/v1/work/overview?fresh=1');
    expect(overview.status).toBe(200);
    const { summary, truncated } = overview.body;
    expect(truncated).toEqual({ items: false, workers: false });
    expect(summary.workforce.total).toBe(300);
    expect(summary.workforce.overloaded + summary.workforce.high + summary.workforce.normal + summary.workforce.under + summary.workforce.unavailable).toBe(300);
    expect(summary.items).toMatchObject({ open: 120, unassigned: 120, overdue: 40 });
    expect(summary.overloadedWorkers.length).toBeGreaterThan(0);
    expect(summary.bottlenecks.length).toBeGreaterThan(0);
    expect((await call('monitor', 'GET', '/api/v1/work/overview?fresh=1')).status).toBe(200);
    expect((await call('ana', 'GET', '/api/v1/work/overview')).status).toBe(403);
  });

  it('serves the organisation summary from a short shared cache, and recomputes on request', async () => {
    await makeItem({ title: 'E para' });
    const first = await call('owner', 'GET', '/api/v1/work/overview?fresh=1');
    await makeItem({ title: 'E dyta' });
    const cached = await call('monitor', 'GET', '/api/v1/work/overview');
    expect(cached.body.summary.items.open).toBe(first.body.summary.items.open); // same answer, no new read
    const fresh = await call('owner', 'GET', '/api/v1/work/overview?fresh=1');
    expect(fresh.body.summary.items.open).toBe(first.body.summary.items.open + 1);
    expect((await call('ana', 'GET', '/api/v1/work/overview')).status).toBe(403); // the cache never bypasses the role check
  });

  it('pages the worker directory, searches by name and filters by workload state', async () => {
    await seedProfiles(300);
    const seen = new Set<string>();
    let cursor = '';
    for (let page = 0; page < 10; page += 1) {
      const response = await call('owner', 'GET', `/api/v1/work/workers?limit=50${cursor ? `&cursor=${cursor}` : ''}`);
      for (const worker of response.body.workers) seen.add(worker.uid);
      if (!response.body.nextCursor) break;
      cursor = response.body.nextCursor;
    }
    expect(seen.size).toBe(300);

    const search = await call('owner', 'GET', '/api/v1/work/workers?q=punonjës 02');
    expect(search.body.workers).toHaveLength(10);
    expect(search.body.workers.every((worker: any) => worker.name.startsWith('Punonjës 02'))).toBe(true);

    const overloaded = await call('owner', 'GET', '/api/v1/work/workers?limit=100&state=overloaded');
    expect(overloaded.body.workers.every((worker: any) => worker.state === 'overloaded' && worker.utilization >= 1)).toBe(true);
    expect((await call('owner', 'GET', '/api/v1/work/workers?municipality=Pejë&limit=100')).body.workers.every((worker: any) => worker.municipality === 'Pejë')).toBe(true);
    expect((await call('ana', 'GET', '/api/v1/work/workers')).status).toBe(403);
  });

  it('drills down to one person: their open work, and performance measured by the system', async () => {
    await profileFor('ana', 'agent', { capacity: 5 });
    const open = await makeItem({ title: 'Ende e hapur' });
    await db.collection(WORK).doc(open).update({ assigneeUid: 'ana', status: 'in_progress', dueAtMs: clock - 1000 });
    for (let i = 0; i < 6; i += 1) {
      const id = await makeItem({ title: `E mbyllur ${i}`, weight: 2 });
      await db.collection(WORK).doc(id).update({ assigneeUid: 'ana', open: false, status: 'done', createdAtMs: clock - 10 * 3_600_000, dueAtMs: clock + 3_600_000, doneAtMs: clock - 3_600_000, reworkCount: i === 0 ? 1 : 0 });
    }
    const detail = await call('owner', 'GET', '/api/v1/work/workers/ana');
    expect(detail.status).toBe(200);
    expect(detail.body.open).toHaveLength(1);
    expect(detail.body.performance).toMatchObject({ source: 'system', periodDays: 30, finishedCount: 6, weightedOutput: 12, overdueOpen: 1, confidence: 'ok', onTimeRate: 1 });
    expect(detail.body.performance.reworkRate).toBeCloseTo(1 / 6, 1);
    expect((await call('ana', 'GET', '/api/v1/work/workers/ana')).status).toBe(200);
    expect((await call('blerim', 'GET', '/api/v1/work/workers/ana')).status).toBe(403);
  });

  it('keeps the profile rules: a person sets their own availability only; a manager sets the rest', async () => {
    await profileFor('ana');
    expect((await call('ana', 'PUT', '/api/v1/work/workers/ana', { availability: 'away' })).status).toBe(200);
    expect((await db.collection(PROFILES).doc('ana').get()).data()?.availability).toBe('away');
    expect((await call('ana', 'PUT', '/api/v1/work/workers/ana', { capacity: 99 })).status).toBe(400);
    expect((await call('ana', 'PUT', '/api/v1/work/workers/ana', { availability: 'available', capacity: 99 })).status).toBe(400);
    expect((await call('blerim', 'PUT', '/api/v1/work/workers/ana', { availability: 'off' })).status).toBe(403);
    expect((await call('owner', 'PUT', '/api/v1/work/workers/ana', { capacity: 8, skills: ['GIS', 'gis', 'Rrugë'], schedule: { days: [1, 2, 3, 4, 5], start: '08:00', end: '16:00' } })).status).toBe(200);
    expect((await db.collection(PROFILES).doc('ana').get()).data()).toMatchObject({ capacity: 8, skills: ['GIS', 'gis', 'Rrugë'], schedule: { start: '08:00', end: '16:00' } });
    expect((await call('owner', 'PUT', '/api/v1/work/workers/ana', { capacity: -1 })).status).toBe(400);
    expect((await call('owner', 'PUT', '/api/v1/work/workers/ana', { schedule: { days: [1], start: '16:00', end: '08:00' } })).status).toBe(400);
    expect(auditLog.map(entry => entry.action)).toContain('work.profile');
  });

  it('creates profiles for staff accounts from their verified claims, once', async () => {
    for (const uid of ['ana', 'peja1', 'mod1', 'owner', 'cit1']) await db.collection('users').doc(uid).set({ role: PEOPLE[uid].role, name: PEOPLE[uid].name });
    const first = await call('owner', 'POST', '/api/v1/work/workers/sync');
    expect(first.body).toEqual({ created: 3, updated: 0 }); // agent, municipality, debate moderator; not the owner or a citizen
    expect(await db.collection(PROFILES).doc('peja1').get().then(doc => doc.data())).toMatchObject({ role: 'municipality', municipality: 'Pejë', capacity: 5 });
    expect((await call('owner', 'POST', '/api/v1/work/workers/sync')).body).toEqual({ created: 0, updated: 3 });
    expect((await call('ana', 'POST', '/api/v1/work/workers/sync')).status).toBe(403);
  });
});

describe('deadlines, notifications, health, export', () => {
  it('reads and writes the deadline rules, managers only, with sane values', async () => {
    const read = await call('monitor', 'GET', '/api/v1/work/config/sla');
    expect(read.body.sla.dueHours.urgent).toBe(4);
    expect((await call('owner', 'PUT', '/api/v1/work/config/sla', { dueHours: { low: 200, normal: 50, high: 12, urgent: 2 } })).body.sla.dueHours).toMatchObject({ urgent: 2, high: 12 });
    expect((await call('owner', 'PUT', '/api/v1/work/config/sla', { dueHours: { low: 200, normal: 50, high: -1, urgent: 2 } })).status).toBe(400);
    expect((await call('ana', 'PUT', '/api/v1/work/config/sla', { dueHours: { low: 1, normal: 1, high: 1, urgent: 1 } })).status).toBe(403);
    const created = await call('owner', 'POST', '/api/v1/work/items', { kind: 'internal_task', title: 'Detyrë urgjente', priority: 'urgent', autoAssign: false });
    expect((await db.collection(WORK).doc(created.body.id).get()).data()?.dueAtMs).toBe(clock + 2 * 3_600_000);
  });

  it('runs the deadline check on request, reports health, and sends each notification to the right people', async () => {
    await profileFor('ana');
    const id = await makeItem({ priority: 'urgent' });
    clock += 20 * 60_000;
    const run = await call('owner', 'POST', '/api/v1/work/run-escalations');
    expect(run.body).toMatchObject({ applied: 1, failed: 0 });
    const health = await call('monitor', 'GET', '/api/v1/work/health');
    expect(health.body).toMatchObject({ scheduler: { lastRunOk: true, stale: false }, items: { open: 1, unassigned: 1, needsAttention: 1 } });
    expect((await call('ana', 'POST', '/api/v1/work/run-escalations')).status).toBe(403);

    const manager = await call('owner', 'GET', '/api/v1/work/notifications');
    expect(manager.body.unread).toBeGreaterThan(0);
    expect((await call('ana', 'GET', '/api/v1/work/notifications')).body.notifications).toEqual([]); // manager alerts are not for agents
    await call('owner', 'POST', `/api/v1/work/items/${id}/transition`, { action: 'assign', assigneeUid: 'ana' });
    const agentNotes = await call('ana', 'GET', '/api/v1/work/notifications');
    expect(agentNotes.body.notifications).toHaveLength(1);
    expect(agentNotes.body.notifications[0]).toMatchObject({ itemId: id, action: 'assign', read: false });

    expect((await call('ana', 'POST', '/api/v1/work/notifications/read', { ids: [agentNotes.body.notifications[0].id] })).body.marked).toBe(1);
    expect((await call('ana', 'GET', '/api/v1/work/notifications')).body.unread).toBe(0);
    const managerId = manager.body.notifications[0].id;
    expect((await call('ana', 'POST', '/api/v1/work/notifications/read', { ids: [managerId] })).body.marked).toBe(0); // not hers
    expect((await call('owner', 'POST', '/api/v1/work/notifications/read', { ids: [managerId] })).body.marked).toBe(1);
  });

  it('exports a CSV for managers only, and records the export', async () => {
    await makeItem({ title: 'Gropë, "e madhe"' });
    const csv = await call('owner', 'GET', '/api/v1/work/export/items?view=open');
    expect(csv.status).toBe(200);
    expect(csv.body.split('\n')).toHaveLength(2);
    expect(csv.body).toContain('"Gropë, ""e madhe"""');
    expect((await call('monitor', 'GET', '/api/v1/work/export/items?view=open')).status).toBe(403);
    expect((await call('ana', 'GET', '/api/v1/work/export/items?view=open')).status).toBe(403);
    expect(auditLog.map(entry => entry.action)).toContain('work.export');
  });
});

describe('what a work item never exposes', () => {
  it('has no field that identifies a reporter, in any view or role', async () => {
    const id = await makeItem({ kind: 'report_referral', municipality: 'Pejë', title: 'Referim', link: { reportId: 'r1', institution: 'Komuna Pejë' } });
    for (const uid of ['owner', 'monitor', 'peja1']) {
      const detail = await call(uid, 'GET', `/api/v1/work/items/${id}`);
      const text = JSON.stringify(detail.body);
      expect(text, uid).not.toMatch(/authorId|authorName|reporter|email|phone/i);
    }
  });
});

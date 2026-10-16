import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { decideDesk, notifyWaitingChats, registerSupportDeskRoutes, MAX_ACTIVE_CHATS } from '../../server/supportDesk';

/**
 * The support desk against the Firestore emulator: one agent wins a conversation, keeps it
 * alone, and every change of hands is recorded. Run with: npm run test:rules
 */
let db: Firestore;
let server: Server;
let base = '';

const PEOPLE: Record<string, { role: string; name: string }> = {
  ana: { role: 'agent', name: 'Ana' }, blerim: { role: 'agent', name: 'Blerim' }, cena: { role: 'agent', name: 'Cena' },
  boss: { role: 'admin', name: 'Pronari' }, news: { role: 'newsadmin', name: 'Redaktori' },
};

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through the emulator.');
  db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-support' }));
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
      if (!PEOPLE[uid]) throw Object.assign(new Error('nf'), { code: 'auth/user-not-found' });
      return { uid, customClaims: { role: PEOPLE[uid].role }, disabled: false, displayName: PEOPLE[uid].name };
    },
    getUsers: async (ids: Array<{ uid: string }>) => ({
      users: ids.filter(i => PEOPLE[i.uid]).map(({ uid }) => ({ uid, customClaims: { role: PEOPLE[uid].role }, disabled: false })),
      notFound: [],
    }),
  }) as unknown as Auth;
  registerSupportDeskRoutes(app, {
    requireAuth, db: () => db, authAdmin, audit: () => undefined,
    actingUser: req => { const uid = (req as unknown as { user: { uid: string } }).user.uid; return { uid, role: PEOPLE[uid].role, permissions: [] }; },
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server?.close(); });

beforeEach(async () => {
  for (const name of ['supportChats', 'users', 'notifications']) for (const ref of await db.collection(name).listDocuments()) await db.recursiveDelete(ref);
  for (const [uid, person] of Object.entries(PEOPLE)) await db.collection('users').doc(uid).set({ name: person.name, role: person.role });
  await db.collection('supportChats').doc('c1').set({ userId: 'cit', userName: 'Qytetari', status: 'waiting_agent', assignedTo: null, messages: [] });
});

const post = async (uid: string, path: string, body: unknown = {}) => {
  const response = await fetch(`${base}/api/v1/support/chats/${path}`, { method: 'POST', headers: { 'x-test-uid': uid, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, json: await response.json() as any };
};
const chat = async () => (await db.collection('supportChats').doc('c1').get()).data() as any;
const events = async () => (await db.collection('supportChats').doc('c1').collection('events').get()).docs.map(d => d.data().action).sort();

describe('accepting', () => {
  it('three agents press "Prano" at once: exactly one gets the conversation', async () => {
    const results = await Promise.all(['ana', 'blerim', 'cena'].map(uid => post(uid, 'c1/accept')));
    expect(results.filter(r => r.status === 200)).toHaveLength(1);
    expect(results.filter(r => r.status === 409)).toHaveLength(2);
    const after = await chat();
    expect(after.status).toBe('active_agent');
    expect(['ana', 'blerim', 'cena']).toContain(after.assignedTo);
    expect(after.messages.at(-1).content).toContain('e pranoi bisedën');
    expect(await events()).toEqual(['accept']);
    // Three contending transactions retry with backoff; on a shared CI runner that outlasts the 5 s default.
  }, 30_000);

  it('after accepting, only that agent may write; the others are told it does not exist', async () => {
    await post('ana', 'c1/accept');
    expect((await post('ana', 'c1/reply', { text: 'Përshëndetje, si mund t\'ju ndihmoj?' })).status).toBe(200);
    expect((await post('blerim', 'c1/reply', { text: 'Tentativë' })).status).toBe(404);
    expect((await post('blerim', 'c1/resolve')).status).toBe(404);
    const after = await chat();
    expect(after.messages.filter((m: any) => m.role === 'agent').map((m: any) => m.content)).toEqual(['Përshëndetje, si mund t\'ju ndihmoj?']);
    expect(after.firstResponseAt).toBeTruthy();
  });

  it('a conversation not yet accepted cannot be answered', async () => {
    expect((await post('ana', 'c1/reply', { text: 'hej' })).json.code).toBe('NOT_ACCEPTED');
  });

  it('staff outside support cannot accept', async () => {
    expect((await post('news', 'c1/accept')).status).toBe(403);
  });
});

describe('a request reaches every agent, and only a free one takes it', () => {
  it('announces a waiting conversation to every support agent exactly once', async () => {
    expect((await notifyWaitingChats(db, authAdmin2())).announced).toBe(1);
    const notes = (await db.collection('notifications').get()).docs.map(d => d.get('userId')).sort();
    expect(notes).toEqual(['ana', 'blerim', 'boss', 'cena']);
    expect((await notifyWaitingChats(db, authAdmin2())).announced).toBe(0);
    expect((await db.collection('notifications').get()).size).toBe(4);
  });

  it('an agent already holding the maximum cannot accept another; a free colleague can', async () => {
    for (let i = 0; i < MAX_ACTIVE_CHATS; i += 1) {
      await db.collection('supportChats').doc(`busy${i}`).set({ status: 'active_agent', assignedTo: 'ana', messages: [] });
    }
    const busy = await post('ana', 'c1/accept');
    expect(busy.status).toBe(409);
    expect(busy.json.code).toBe('BUSY');
    expect((await chat()).status).toBe('waiting_agent');
    expect((await post('blerim', 'c1/accept')).status).toBe(200);
    expect((await chat()).assignedTo).toBe('blerim');
  });
});

describe('the desk overview and clearing finished conversations', () => {
  const get = async (uid: string, path: string) => {
    const response = await fetch(`${base}/api/v1/support/${path}`, { headers: { 'x-test-uid': uid } });
    return { status: response.status, json: await response.json() as any };
  };

  it('shows who is waiting, who has access and who is free', async () => {
    for (let i = 0; i < MAX_ACTIVE_CHATS; i += 1) await db.collection('supportChats').doc(`busy${i}`).set({ status: 'active_agent', assignedTo: 'ana', messages: [] });
    const res = await get('blerim', 'overview');
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ waiting: 1, active: MAX_ACTIVE_CHATS, maxActivePerAgent: MAX_ACTIVE_CHATS });
    const byName = Object.fromEntries(res.json.agents.map((a: any) => [a.name, a]));
    expect(byName.Ana).toMatchObject({ load: MAX_ACTIVE_CHATS, free: false });
    expect(byName.Blerim).toMatchObject({ load: 0, free: true });
    expect(byName.Redaktori).toBeUndefined();
    expect((await get('news', 'overview')).status).toBe(403);
  });

  it('only the superadmin clears finished conversations, and open ones stay', async () => {
    await db.collection('supportChats').doc('done1').set({ status: 'resolved', resolvedAt: new Date().toISOString(), messages: [] });
    await db.collection('supportChats').doc('done1').collection('events').doc('e').set({ action: 'resolve' });
    await db.collection('supportChats').doc('done2').set({ status: 'resolved', resolvedAt: new Date().toISOString(), messages: [] });
    const noOwner = await fetch(`${base}/api/v1/support/clear-resolved`, { method: 'POST', headers: { 'x-test-uid': 'ana', 'Content-Type': 'application/json' }, body: '{}' });
    expect(noOwner.status).toBe(403);
    const ok = await fetch(`${base}/api/v1/support/clear-resolved`, { method: 'POST', headers: { 'x-test-uid': 'boss', 'Content-Type': 'application/json' }, body: '{}' });
    expect(ok.status).toBe(200);
    expect((await ok.json() as any).removed).toBe(2);
    expect((await db.collection('supportChats').doc('done1').get()).exists).toBe(false);
    expect((await db.collection('supportChats').doc('done1').collection('events').get()).size).toBe(0);
    expect((await chat()).status).toBe('waiting_agent');
  });
});

describe('handing over', () => {
  it('an agent can return a conversation to the queue or transfer it to a colleague, who is notified', async () => {
    await post('ana', 'c1/accept');
    expect((await post('ana', 'c1/transfer', { uid: 'blerim' })).status).toBe(200);
    expect((await chat()).assignedTo).toBe('blerim');
    expect((await db.collection('notifications').where('userId', '==', 'blerim').get()).size).toBe(1);
    expect((await post('ana', 'c1/reply', { text: 'x' })).status).toBe(404);
    expect((await post('blerim', 'c1/release')).status).toBe(200);
    expect(await chat()).toMatchObject({ status: 'waiting_agent', assignedTo: null });
  });

  it('an administrator may take over someone else\'s conversation, but only with a reason', async () => {
    await post('ana', 'c1/accept');
    expect((await post('boss', 'c1/transfer', { uid: 'boss' })).json.code).toBe('REASON_REQUIRED');
    expect((await post('boss', 'c1/transfer', { uid: 'boss', reason: 'Qytetari kërkoi menaxherin' })).status).toBe(200);
    expect((await chat()).assignedTo).toBe('boss');
    expect(await events()).toEqual(['accept', 'transfer']);
  });

  it('closing is the holder\'s (or an administrator\'s) and is recorded', async () => {
    await post('ana', 'c1/accept');
    expect((await post('ana', 'c1/resolve')).status).toBe(200);
    expect(await chat()).toMatchObject({ status: 'resolved', resolvedBy: 'ana' });
  });
});

describe('the pure rule', () => {
  it('matches the routes', () => {
    const ana = { uid: 'ana', role: 'agent', permissions: [] };
    expect(decideDesk(ana, { status: 'waiting_agent', assignedTo: null }, 'accept')).toMatchObject({ outcome: 'allow' });
    expect(decideDesk(ana, { status: 'active_agent', assignedTo: 'blerim' }, 'accept')).toMatchObject({ outcome: 'deny', code: 'ALREADY_TAKEN' });
    expect(decideDesk(ana, { status: 'bot', assignedTo: null }, 'accept')).toMatchObject({ outcome: 'deny', code: 'WRONG_STATE' });
    expect(decideDesk(ana, null, 'reply')).toMatchObject({ outcome: 'deny', code: 'NOT_FOUND' });
  });
});

function authAdmin2() {
  return {
    getUsers: async (ids: Array<{ uid: string }>) => ({
      users: ids.filter(i => PEOPLE[i.uid]).map(({ uid }) => ({ uid, customClaims: { role: PEOPLE[uid].role }, disabled: false })),
      notFound: [],
    }),
  } as unknown as Auth;
}

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { registerDirectMessageRoutes } from '../../server/directMessages';

/**
 * The real Express handlers against the Firestore emulator. Authentication is
 * replaced by a header so the tests can act as different accounts; everything
 * after authentication is the production code.
 * Run with: npm run test:rules
 */
let db: Firestore;
let server: Server;
let base = '';
const A = 'routeA';
const B = 'routeB';

const wipe = async () => {
  for (const name of ['users', 'forum_conversations', 'forum_blocks', 'forum_dm_settings', 'notifications']) {
    for (const ref of await db.collection(name).listDocuments()) await db.recursiveDelete(ref);
  }
};

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through `npm run test:rules`.');
  db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-dm-routes' }));
  const app = express();
  app.use(express.json());
  const requireAuth: express.RequestHandler = (req, res, next) => {
    const uid = req.header('x-test-uid');
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    (req as any).user = { uid };
    next();
  };
  registerDirectMessageRoutes(app, { requireAuth, db: () => db });
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(async () => {
  await wipe();
  await db.collection('users').doc(A).set({ name: 'Arta', role: 'citizen', followingIds: [] });
  await db.collection('users').doc(B).set({ name: 'Besa', role: 'citizen', followingIds: [] });
});
afterAll(async () => { await wipe(); await new Promise((r) => server.close(r)); });

const call = async (as: string | null, method: string, path: string, body?: unknown) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(as ? { 'x-test-uid': as } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
};

describe('DM routes', () => {
  it('requires authentication on every route', async () => {
    for (const [m, p] of [['POST', '/api/v1/forum/dm/send'], ['POST', '/api/v1/forum/dm/x/respond'], ['POST', '/api/v1/forum/dm/x/read'],
      ['PUT', '/api/v1/forum/dm/privacy'], ['PUT', '/api/v1/forum/blocks/x'], ['DELETE', '/api/v1/forum/blocks/x']] as const) {
      expect((await call(null, m, p, {})).status).toBe(401);
    }
  });

  it('sends a request, then the receiver accepts it and replies', async () => {
    const sent = await call(A, 'POST', '/api/v1/forum/dm/send', { receiverId: B, text: 'Përshëndetje' });
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({ conversationId: `${A}_${B}`, status: 'request' });

    expect((await call(A, 'POST', `/api/v1/forum/dm/${A}_${B}/respond`, { action: 'accept' })).status).toBe(403); // requester cannot accept
    expect((await call(B, 'POST', `/api/v1/forum/dm/${A}_${B}/respond`, { action: 'accept' })).body).toEqual({ status: 'active' });
    expect((await call(B, 'POST', '/api/v1/forum/dm/send', { receiverId: A, text: 'Mirë se erdhe' })).body.status).toBe('active');
    expect((await call(B, 'POST', `/api/v1/forum/dm/${A}_${B}/read`)).status).toBe(200);
  });

  it('maps policy refusals to HTTP codes with the Albanian message and a code', async () => {
    await call(A, 'POST', '/api/v1/forum/dm/send', { receiverId: B, text: 'Një' });
    const second = await call(A, 'POST', '/api/v1/forum/dm/send', { receiverId: B, text: 'Dy' });
    expect(second).toMatchObject({ status: 409, body: { code: 'request_pending' } });
    expect((await call(A, 'POST', '/api/v1/forum/dm/send', { receiverId: B, text: '' })).status).toBe(400);
    expect((await call(A, 'POST', '/api/v1/forum/dm/send', { receiverId: 'ghost', text: 'hi' })).status).toBe(404);
    expect((await call(A, 'POST', '/api/v1/forum/dm/send', { text: 'no receiver' })).status).toBe(400);
  });

  it('blocks and unblocks over HTTP, and blocking is private to the blocker', async () => {
    expect((await call(B, 'PUT', `/api/v1/forum/blocks/${A}`)).status).toBe(200);
    const denied = await call(A, 'POST', '/api/v1/forum/dm/send', { receiverId: B, text: 'hi' });
    expect(denied).toMatchObject({ status: 403, body: { code: 'denied' } });
    expect((await call(B, 'POST', '/api/v1/forum/dm/send', { receiverId: A, text: 'hi' })).body.code).toBe('you_blocked');
    expect((await call(B, 'DELETE', `/api/v1/forum/blocks/${A}`)).status).toBe(200);
    expect((await call(A, 'POST', '/api/v1/forum/dm/send', { receiverId: B, text: 'hi' })).status).toBe(201);
    expect((await call(A, 'PUT', `/api/v1/forum/blocks/${A}`)).status).toBe(400); // cannot block yourself
  });

  it('stores a valid privacy choice and rejects others', async () => {
    expect((await call(B, 'PUT', '/api/v1/forum/dm/privacy', { privacy: 'following' })).body).toEqual({ privacy: 'following' });
    expect((await call(A, 'POST', '/api/v1/forum/dm/send', { receiverId: B, text: 'hi' })).body.code).toBe('privacy');
    expect((await call(B, 'PUT', '/api/v1/forum/dm/privacy', { privacy: 'public' })).status).toBe(400);
  });

  it('rate-limits a flood from one account', async () => {
    await db.collection('users').doc(B).update({ followingIds: [A] });
    let last = 0;
    for (let i = 0; i < 32; i++) last = (await call(A, 'POST', '/api/v1/forum/dm/send', { receiverId: B, text: `m${i}` })).status;
    expect(last).toBe(429);
  });
});

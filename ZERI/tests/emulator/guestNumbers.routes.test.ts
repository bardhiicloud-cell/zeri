import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { registerGuestNumberRoutes } from '../../server/guestNumbers';

/**
 * The real guest-number route against the Firestore emulator. Authentication is a header:
 * `x-test-uid` plus `x-test-provider` (anonymous or password).
 * Run with: npm run test:rules
 */
let db: Firestore;
let server: Server;
let base = '';

const wipe = async () => {
  for (const name of ['users', 'counters']) for (const ref of await db.collection(name).listDocuments()) await db.recursiveDelete(ref);
};

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through `npm run test:rules`.');
  db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-guests' }));
  const app = express();
  const requireAuth: express.RequestHandler = (req, res, next) => {
    const uid = req.header('x-test-uid');
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    (req as unknown as { user: unknown }).user = { uid, claims: { firebase: { sign_in_provider: req.header('x-test-provider') ?? 'anonymous' } } };
    next();
  };
  registerGuestNumberRoutes(app, { requireAuth, db: () => db, limiter: (_q, _s, next) => next() });
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(wipe);
afterAll(async () => { await wipe(); await new Promise(resolve => server.close(resolve)); });

const register = async (uid: string, provider = 'anonymous') => {
  const res = await fetch(`${base}/api/v1/guest/register`, { method: 'POST', headers: { 'x-test-uid': uid, 'x-test-provider': provider } });
  return { status: res.status, body: (await res.json()) as { profile?: Record<string, unknown>; error?: string } };
};

describe('guest numbers', () => {
  it('gives a guest a numbered profile, created by the server', async () => {
    const first = await register('g1');
    expect(first.status).toBe(201);
    expect(first.body.profile).toMatchObject({ id: 'g1', role: 'guest', guestNumber: 1, name: 'Mysafir-0000001' });
    expect((await db.collection('users').doc('g1').get()).data()).toMatchObject({ guestLabel: 'Mysafir-0000001' });
  });

  it('is idempotent: the same device keeps its number', async () => {
    const first = await register('g1');
    const again = await register('g1');
    expect(again.status).toBe(200);
    expect(again.body.profile?.guestNumber).toBe(first.body.profile?.guestNumber);
    expect(again.body.profile?.name).toBe(first.body.profile?.name);
  });

  it('never gives two guests the same number, even all at once', async () => {
    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => register(`g${i}`)));
    const numbers = results.map(r => r.body.profile?.guestNumber as number);
    expect(results.every(r => r.status === 201)).toBe(true);
    expect(new Set(numbers).size).toBe(25);
  });

  it('refuses a non-guest account and an unauthenticated call', async () => {
    expect((await register('citizen', 'password')).status).toBe(400);
    expect((await fetch(`${base}/api/v1/guest/register`, { method: 'POST' })).status).toBe(401);
    expect((await db.collection('users').doc('citizen').get()).exists).toBe(false);
  });
});

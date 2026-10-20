import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { registerGuestSessionRoutes } from '../../server/guestSession';

let server: Server | undefined;
afterEach(() => new Promise<void>(done => (server ? server.close(() => done()) : done())));

async function post(deps: Parameters<typeof registerGuestSessionRoutes>[1]) {
  const app = express();
  registerGuestSessionRoutes(app, { limiter: (_q, _s, n) => n(), ...deps });
  server = createServer(app);
  await new Promise<void>(r => server!.listen(0, r));
  const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/guest/session`, { method: 'POST' });
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

describe('POST /api/v1/guest/session', () => {
  it('mints a custom token for a fresh guest_ uid carrying the guest claim', async () => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const { status, body } = await post({ createCustomToken: async (uid, claims) => { calls.push([uid, claims]); return 'tok'; } });
    expect(status).toBe(201);
    expect(body.token).toBe('tok');
    expect(String(body.uid)).toMatch(/^guest_[0-9a-f]{32}$/);
    expect(calls[0][1]).toEqual({ guest: true });
  });

  it('answers 503 when the token cannot be signed', async () => {
    const { status } = await post({ createCustomToken: async () => { throw new Error('no credentials'); } });
    expect(status).toBe(503);
  });
});

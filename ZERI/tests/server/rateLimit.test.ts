import http from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createIpRateLimiter } from '../../server/security';

/**
 * The limiter must key on the address the trusted proxy recorded, not on a
 * header the caller controls.
 */
let server: http.Server;
let port: number;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', 1); // exactly one hop, as in server.ts
  app.use(
    createIpRateLimiter({ windowMs: 60_000, max: 3, floodFactor: 100, message: 'limited', code: 'TEST' })
  );
  app.get('/', (_req, res) => res.json({ ok: true }));
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function get(xForwardedFor: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { port, host: '127.0.0.1', path: '/', headers: { 'x-forwarded-for': xForwardedFor } },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode ?? 0));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('createIpRateLimiter behind one trusted proxy', () => {
  it('cannot be bypassed by rotating a forged leading X-Forwarded-For entry', async () => {
    // The proxy appends the real client address ("203.0.113.9") after whatever
    // the client sent. The forged first entry changes on every request.
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push(await get(`10.0.0.${i}, 203.0.113.9`));
    }
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses.slice(3).every((status) => status === 429)).toBe(true);
  });

  it('still keeps different real clients apart', async () => {
    expect(await get('198.51.100.1')).toBe(200);
    expect(await get('198.51.100.2')).toBe(200);
  });
});

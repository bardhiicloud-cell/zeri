import express from 'express';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { MAX_PHOTO_BYTES, registerReportPhotoRoutes, sniffImageMime } from '../../server/reportPhotos';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);

function fakeDb() {
  const docs = new Map<string, Record<string, unknown>>();
  return {
    docs,
    db: (() => ({
      collection: () => ({
        doc: (id: string) => ({
          create: async (data: Record<string, unknown>) => { docs.set(id, data); },
          get: async () => ({ exists: docs.has(id), data: () => docs.get(id) }),
        }),
      }),
    })) as never,
  };
}

async function serve() {
  const { db, docs } = fakeDb();
  const app = express();
  app.use(express.json({ limit: '12mb' }));
  registerReportPhotoRoutes(app, {
    db,
    limiter: (_req, _res, next) => next(),
    requireAuth: (req, _res, next) => { (req as never as { user: unknown }).user = { uid: 'u1' }; next(); },
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, docs, close: () => server.close() };
}

describe('sniffImageMime', () => {
  it('reads the type from the bytes', () => {
    expect(sniffImageMime(JPEG)).toBe('image/jpeg');
    expect(sniffImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImageMime(Buffer.from('GIF89a......'))).toBeNull();
  });
});

describe('report photo routes', () => {
  it('stores a photo and serves it back with a cross-origin header', async () => {
    const { base, close } = await serve();
    try {
      const created = await fetch(`${base}/api/v1/report-photos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: `data:image/jpeg;base64,${JPEG.toString('base64')}`, reportId: 'r1' }),
      });
      expect(created.status).toBe(201);
      const { id } = await created.json() as { id: string };
      const got = await fetch(`${base}/api/v1/report-photos/${id}`);
      expect(got.status).toBe(200);
      expect(got.headers.get('content-type')).toBe('image/jpeg');
      expect(got.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
      expect(Buffer.from(await got.arrayBuffer()).equals(JPEG)).toBe(true);
    } finally { close(); }
  });

  it('refuses non-images, oversize files and malformed ids', async () => {
    const { base, close } = await serve();
    try {
      const post = (data: string) => fetch(`${base}/api/v1/report-photos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }),
      });
      expect((await post(Buffer.from('<svg/>').toString('base64'))).status).toBe(400);
      expect((await post(Buffer.alloc(MAX_PHOTO_BYTES + 1, 0xff).toString('base64'))).status).toBe(413);
      expect((await fetch(`${base}/api/v1/report-photos/../x`)).status).toBe(404);
      expect((await fetch(`${base}/api/v1/report-photos/${'a'.repeat(24)}`)).status).toBe(404);
    } finally { close(); }
  });
});

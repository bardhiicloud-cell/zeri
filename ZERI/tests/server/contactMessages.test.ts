import http from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerContactRoutes, validateContact } from '../../server/contactMessages';

const good = { name: 'Agron Berisha', subject: 'Pyetje', message: 'Si ndiqet një raport?' };

describe('validateContact', () => {
  it('accepts the minimum and strips control characters', () => {
    const r = validateContact({ ...good, name: 'Agron\u0000 Berisha' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name).toBe('Agron Berisha');
  });
  it('reports each bad field', () => {
    const r = validateContact({ name: '', subject: '', message: 'shkurt', email: 'x', phone: 'abc' });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(Object.keys(r.errors).sort()).toEqual(['email', 'message', 'name', 'phone', 'subject']);
  });
  it('rejects non-object bodies', () => {
    expect(validateContact(null).ok).toBe(false);
    expect(validateContact('x').ok).toBe(false);
  });
});

describe('POST /api/v1/public/contact', () => {
  const written: any[] = [];
  let failWrite = false;
  let server: http.Server;
  let base = '';
  const db: any = () => ({
    collection: () => ({
      doc: () => ({
        id: 'abcdef123456',
        set: async (d: any) => { if (failWrite) throw new Error('down'); written.push(d); },
      }),
    }),
  });
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerContactRoutes(app, { db, limiter: (_q, _s, n) => n() });
    server = http.createServer(app);
    await new Promise<void>(r => server.listen(0, r));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(() => server.close());
  const post = (body: unknown) => fetch(`${base}/api/v1/public/contact`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  it('stores the message and returns the stored reference', async () => {
    const res = await post(good);
    expect(res.status).toBe(201);
    const j = await res.json();
    expect(j).toEqual({ ok: true, reference: 'KT-ABCDEF12', delivery: 'stored' });
    expect(written[0]).toMatchObject({ name: 'Agron Berisha', reference: 'KT-ABCDEF12', status: 'new' });
  });
  it('returns field errors and stores nothing for invalid input', async () => {
    const before = written.length;
    const res = await post({ name: 'A' });
    expect(res.status).toBe(400);
    expect((await res.json()).fields.message).toBeTruthy();
    expect(written.length).toBe(before);
  });
  it('never returns a reference when the write fails', async () => {
    failWrite = true;
    const res = await post(good);
    failWrite = false;
    expect(res.status).toBe(500);
    expect((await res.json()).reference).toBeUndefined();
  });
  it('swallows honeypot submissions without storing', async () => {
    const before = written.length;
    const res = await post({ ...good, website: 'http://spam' });
    expect(res.status).toBe(202);
    expect(written.length).toBe(before);
  });
});

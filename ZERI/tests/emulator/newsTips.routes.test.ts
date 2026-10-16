import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { registerNewsTipRoutes } from '../../server/newsTips';

/**
 * News tips and the cross-sector Track-ID against the Firestore emulator: submit, follow with the
 * code, staff accept → draft → publish (only once the article is live), rejection with a reason,
 * and what the public can and cannot see. Run with: npm run test:rules
 */
let db: Firestore;
let server: Server;
let base = '';

const PEOPLE: Record<string, string> = { boss: 'superadmin', editor: 'newsadmin', muni: 'municipality', mon: 'monitor' };
const GOOD = { title: 'Tender i dyshimtë në komunë', body: 'Tenderi për rrugën u dha pa konkurrim; dokumentet janë publike dhe e dëshmojnë këtë qartë.', category: 'korrupsion', anonymous: false, contactEmail: 'burimi@example.test', contactName: 'Burimi' };
const IMG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through the emulator.');
  db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-newstips' }));
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const requireAuth: express.RequestHandler = (req, res, next) => {
    const uid = req.header('x-test-uid');
    if (!uid || !PEOPLE[uid]) return res.status(401).json({ error: 'Unauthorized' });
    (req as unknown as { user: { uid: string } }).user = { uid };
    next();
  };
  registerNewsTipRoutes(app, {
    requireAuth, db: () => db, audit: () => undefined,
    limiter: (_req, _res, next) => next(),
    actingUser: req => { const uid = (req as unknown as { user: { uid: string } }).user.uid; return { uid, email: `${uid}@t`, role: PEOPLE[uid], municipality: '', permissions: [] }; },
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server?.close(); });
beforeEach(async () => {
  for (const name of ['newsTips', 'newsArticles', 'donationCauses', 'healthRegistry', 'users']) for (const ref of await db.collection(name).listDocuments()) await db.recursiveDelete(ref);
});

const call = async (method: string, path: string, uid?: string, body?: unknown) => {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(uid ? { 'x-test-uid': uid } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, json: await response.json() as any };
};
const submit = async () => (await call('POST', '/api/v1/public/news-tips', undefined, { ...GOOD, media: [IMG] })).json.reference as string;
const tipId = async (reference: string) => (await db.collection('newsTips').where('reference', '==', reference).get()).docs[0].id;

describe('submitting and following', () => {
  it('gives a Track-ID, and the public sees only the stage', async () => {
    const res = await call('POST', '/api/v1/public/news-tips', undefined, { ...GOOD, media: [IMG] });
    expect(res.status).toBe(201);
    expect(res.json.reference).toMatch(/^LJ-[A-Z0-9]{8}$/);

    const status = await call('GET', `/api/v1/public/submission-status?ref=${res.json.reference}`);
    expect(status.status).toBe(200);
    expect(status.json).toMatchObject({ kind: 'news', stage: 'Në pritje', rejected: false });
    const leaked = JSON.stringify(status.json);
    for (const secret of ['burimi@example.test', 'Burimi', GOOD.body, IMG]) expect(leaked).not.toContain(secret);
    expect((await call('GET', '/api/v1/public/submission-status?ref=LJ-ZZZZZZZZ')).status).toBe(404);
    expect((await call('GET', '/api/v1/public/submission-status?ref=not-a-code')).status).toBe(404);
  });

  it('refuses an invalid tip and stores nothing', async () => {
    const res = await call('POST', '/api/v1/public/news-tips', undefined, { ...GOOD, body: 'shkurt' });
    expect(res.status).toBe(400);
    expect((await db.collection('newsTips').get()).size).toBe(0);
  });

  it('donations and health cases answer to their Track-IDs too', async () => {
    await db.collection('donationCauses').doc('d1').set({ reference: 'DN-ABCD1234', status: 'pending', createdAt: '2026-10-01T10:00:00Z', title: 'Sekret' });
    await db.collection('healthRegistry').doc('h1').set({ trackingId: 'HC-ABCD1234', status: 'verified', createdAt: '2026-10-01T10:00:00Z', fullName: 'Sekret' });
    const donation = await call('GET', '/api/v1/public/submission-status?ref=dn-abcd1234');
    expect(donation.json).toMatchObject({ kind: 'donation', stage: 'Në pritje' });
    expect(JSON.stringify(donation.json)).not.toContain('Sekret');
    expect((await call('GET', '/api/v1/public/submission-status?ref=HC-ABCD1234')).json).toMatchObject({ kind: 'health', stage: 'U verifikua' });
  });

  it('finds a health case by the two-part code the registry form issues', async () => {
    await db.collection('healthRegistry').doc('h2').set({ trackingId: 'HC-MGT3XYZ1-AB12', status: 'pending', createdAt: '2026-10-01T10:00:00Z', fullName: 'Sekret' });
    const found = await call('GET', '/api/v1/public/submission-status?ref=hc-mgt3xyz1-ab12');
    expect(found.json).toMatchObject({ kind: 'health', reference: 'HC-MGT3XYZ1-AB12' });
    expect(JSON.stringify(found.json)).not.toContain('Sekret');
  });
});

describe('the newsroom', () => {
  it('accepts, creates a draft article, and marks published only when the article is live', async () => {
    const reference = await submit();
    const id = await tipId(reference);

    expect((await call('GET', '/api/v1/admin/news-tips?stage=submitted', 'editor')).json.items.map((i: any) => i.reference)).toEqual([reference]);
    const detail = await call('GET', `/api/v1/admin/news-tips/${id}`, 'editor');
    expect(detail.json.media).toHaveLength(1);
    expect(detail.json.contactEmail).toBe('burimi@example.test');

    // Nothing is skipped.
    expect((await call('POST', `/api/v1/admin/news-tips/${id}/action`, 'editor', { action: 'create_draft' })).status).toBe(409);
    expect((await call('POST', `/api/v1/admin/news-tips/${id}/action`, 'editor', { action: 'accept' })).status).toBe(200);
    const draft = await call('POST', `/api/v1/admin/news-tips/${id}/action`, 'editor', { action: 'create_draft' });
    expect(draft.status).toBe(200);
    const article = (await db.collection('newsArticles').doc(draft.json.articleId).get()).data()!;
    expect(article).toMatchObject({ published: false, status: 'Draft', sourceTipReference: reference });
    expect(article.content).toBe('');
    expect(JSON.stringify(article)).not.toContain('burimi@example.test');
    expect((await call('GET', `/api/v1/public/submission-status?ref=${reference}`)).json.stage).toBe('Në përpunim');

    // Marking published before the article is live is refused.
    const early = await call('POST', `/api/v1/admin/news-tips/${id}/action`, 'editor', { action: 'mark_published' });
    expect(early.status).toBe(409);
    expect(early.json.code).toBe('ARTICLE_NOT_PUBLISHED');
    await db.collection('newsArticles').doc(draft.json.articleId).update({ published: true });
    expect((await call('POST', `/api/v1/admin/news-tips/${id}/action`, 'editor', { action: 'mark_published' })).status).toBe(200);
    expect((await call('GET', `/api/v1/public/submission-status?ref=${reference}`)).json.stage).toBe('U publikua');

    const history = (await db.collection('newsTips').doc(id).collection('events').get()).docs.map(d => d.data().action).sort();
    expect(history).toEqual(['accept', 'create_draft', 'mark_published']);
    expect((await call('GET', '/api/v1/admin/news-tips?stage=published', 'boss')).json.counts).toMatchObject({ published: 1, submitted: 0 });
  });

  it('rejection needs a reason and shows as refused to the sender', async () => {
    const reference = await submit();
    const id = await tipId(reference);
    expect((await call('POST', `/api/v1/admin/news-tips/${id}/action`, 'editor', { action: 'reject', reason: '' })).status).toBe(400);
    expect((await call('POST', `/api/v1/admin/news-tips/${id}/action`, 'editor', { action: 'reject', reason: 'Nuk verifikohet nga burime të pavarura.' })).status).toBe(200);
    expect((await call('GET', `/api/v1/public/submission-status?ref=${reference}`)).json).toMatchObject({ stage: 'U refuzua', rejected: true });
    expect((await call('POST', `/api/v1/admin/news-tips/${id}/action`, 'editor', { action: 'accept' })).status).toBe(409);
  });

  it('only the newsroom reaches the queue', async () => {
    const reference = await submit();
    const id = await tipId(reference);
    for (const uid of ['muni', 'mon']) {
      expect((await call('GET', '/api/v1/admin/news-tips', uid)).status).toBe(403);
      expect((await call('GET', `/api/v1/admin/news-tips/${id}`, uid)).status).toBe(403);
      expect((await call('POST', `/api/v1/admin/news-tips/${id}/action`, uid, { action: 'accept' })).status).toBe(403);
    }
    expect((await call('GET', '/api/v1/admin/news-tips')).status).toBe(401);
    expect(await db.collection('newsTips').doc(id).get().then(s => s.get('status'))).toBe('submitted');
  });
});

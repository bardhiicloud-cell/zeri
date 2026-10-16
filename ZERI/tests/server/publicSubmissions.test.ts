import http from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerPublicSubmissionRoutes, validateDonationApplication, validateFeedback, validateIdea } from '../../server/publicSubmissions';

describe('ideas and feedback', () => {
  const rows: Record<string, any[]> = { platformIdeas: [], platformFeedback: [], donationCauses: [] };
  let server: http.Server;
  let base = '';
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerPublicSubmissionRoutes(app, {
      db: (() => ({ collection: (c: string) => ({ doc: () => ({ id: 'zz11yy22xx', set: async (d: any) => { rows[c].push(d); }, create: async () => {} }) }) })) as any,
      limiter: (_q, _s, n) => n(),
      optionalUid: async req => (req.headers.authorization === 'Bearer good' ? 'uid-1' : null),
    });
    server = http.createServer(app);
    await new Promise<void>(r => server.listen(0, r));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(() => server.close());
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

  const idea = { title: 'Autobus i natës', category: 'Tjetër', problem: 'Nuk ka transport pas orës 22:00.', solution: 'Një linjë nate çdo orë.', impact: '', audience: 'Të gjithë', scope: 'Prishtinë' };

  it('validates ideas and feedback', () => {
    expect(validateIdea({}).ok).toBe(false);
    expect(validateFeedback({ rating: 9, feedback: 'mjaft gjatë tekst' }).ok).toBe(false);
    expect(validateFeedback({ rating: 4, feedback: 'mjaft gjatë tekst' }).ok).toBe(true);
  });
  it('stores an idea and takes the author from the verified token only', async () => {
    const res = await post('/api/v1/public/ideas', { ...idea, authorId: 'spoofed' }, { authorization: 'Bearer good' });
    expect(res.status).toBe(201);
    expect((await res.json()).reference).toMatch(/^ID-[A-Z0-9]{8}$/);
    expect(rows.platformIdeas[0].authorId).toBe('uid-1');
    const anon = await post('/api/v1/public/ideas', idea);
    expect(anon.status).toBe(201);
    expect(rows.platformIdeas[1].authorId).toBeNull();
  });
  it('stores feedback and rejects invalid input', async () => {
    expect((await post('/api/v1/public/feedback', { rating: 5, feedback: 'Shumë e dobishme faqja.', source: 'SherbimetPage' })).status).toBe(201);
    expect(rows.platformFeedback.length).toBe(1);
    expect((await post('/api/v1/public/feedback', { rating: 0, feedback: 'x' })).status).toBe(400);
    expect(rows.platformFeedback.length).toBe(1);
  });

  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const app = { title: 'Ndihmë për familjen', description: 'Familja ka nevojë për ngrohje këtë dimër.', category: 'shtepi', mediaUrl: png, donationUrl: 'https://gofund.me/abc' };

  it('validates donation applications', () => {
    expect(validateDonationApplication(app).ok).toBe(true);
    const bad = validateDonationApplication({ ...app, category: 'x', donationUrl: 'javascript:alert(1)', mediaUrl: 'http://evil/x.png' });
    expect(bad.ok).toBe(false);
    if (bad.ok === false) expect(Object.keys(bad.errors).sort()).toEqual(['category', 'donationUrl', 'mediaUrl']);
  });
  it('stores a donation application as pending, never approved, whatever the body says', async () => {
    const res = await post('/api/v1/public/donation-applications', { ...app, status: 'approved' });
    expect(res.status).toBe(201);
    expect(rows.donationCauses[0].status).toBe('pending');
    expect(rows.donationCauses[0].mediaType).toBe('image');
    expect((await post('/api/v1/public/donation-applications', { ...app, title: 'x' })).status).toBe(400);
    expect(rows.donationCauses.length).toBe(1);
  });
});

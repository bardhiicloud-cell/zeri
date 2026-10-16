import http from 'node:http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { invalidateHeritageCache, registerHeritageRoutes } from '../../server/heritage';
import { requireSection } from '../../server/auth';

/** A just-enough in-memory Firestore: collections, docs, sub-collections, queries by orderBy/limit, transactions. */
function fakeFirestore() {
  const store = new Map<string, Record<string, any>>();
  let auto = 0;
  const childrenOf = (path: string) =>
    [...store.keys()].filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes('/'));
  const snapOf = (path: string) => {
    const id = path.split('/').pop()!;
    const data = store.get(path);
    return { id, exists: data !== undefined, data: () => (data === undefined ? undefined : structuredClone(data)) };
  };
  const query = (path: string, order?: { f: string; dir: string }, max = Infinity) => ({
    limit: (n: number) => query(path, order, n),
    orderBy: (f: string, dir = 'asc') => query(path, { f, dir }, max),
    get: async () => {
      let docs = childrenOf(path).map(snapOf);
      if (order) docs = docs.sort((a, b) => (order.dir === 'desc' ? -1 : 1) * (a.data()![order.f] > b.data()![order.f] ? 1 : -1));
      docs = docs.slice(0, max);
      return { docs, forEach: (cb: (d: any) => void) => docs.forEach(cb) };
    },
  });
  const docRef = (path: string): any => ({
    id: path.split('/').pop(), path,
    get: async () => snapOf(path),
    set: async (data: any) => { store.set(path, structuredClone(data)); },
    delete: async () => { store.delete(path); },
    collection: (name: string) => colRef(`${path}/${name}`),
  });
  const colRef = (path: string): any => ({ doc: (id?: string) => docRef(`${path}/${id ?? `auto${++auto}`}`), ...query(path) });
  const db = {
    collection: colRef,
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      const writes: Array<() => void> = [];
      const tx = {
        get: async (ref: any) => ref.get(),
        set: (ref: any, data: any) => { writes.push(() => store.set(ref.path, structuredClone(data))); },
        delete: (ref: any) => { writes.push(() => store.delete(ref.path)); },
      };
      const out = await fn(tx);
      writes.forEach((w) => w());
      return out;
    },
  };
  return { db, store, childrenOf };
}

const USERS: Record<string, { uid: string; role: string }> = {
  editor: { uid: 'u-editor', role: 'newsadmin' },
  editor2: { uid: 'u-editor2', role: 'newsadmin' },
  admin: { uid: 'u-admin', role: 'admin' },
  super: { uid: 'u-super', role: 'superadmin' },
  agent: { uid: 'u-agent', role: 'agent' },
  citizen: { uid: 'u-cit', role: 'citizen' },
};

describe('heritage CMS routes', () => {
  let server: http.Server;
  let base = '';
  let fx = fakeFirestore();
  const audits: string[] = [];

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerHeritageRoutes(app, {
      db: () => fx.db as any,
      requireAuth: (req, res, next) => {
        const who = USERS[String(req.headers['x-user'] ?? '')];
        if (!who) return res.status(401).json({ error: 'Unauthorized' });
        req.user = { uid: who.uid, email: `${who.uid}@test.org`, role: who.role, claims: { role: who.role } };
        next();
      },
      requireHeritage: requireSection('heritage'),
      audit: (action) => { audits.push(action); },
      resolveRole: async (req) => String(req.user?.claims.role ?? ''),
      permissions: () => [],
    });
    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(() => server.close());
  beforeEach(() => { fx = fakeFirestore(); audits.length = 0; invalidateHeritageCache(); });

  const call = async (who: string | null, method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method, headers: { 'content-type': 'application/json', ...(who ? { 'x-user': who } : {}) }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) as any };
  };

  const entry = (over: Record<string, unknown> = {}) => ({
    id: 'test-entry', area: 'kosova', section: 'historia', kind: 'article', evidence: 'established',
    title: { sq: 'Titull', en: 'Title' }, summary: { sq: 'Përmbledhje', en: 'Summary' }, body: { sq: 'Tekst i plotë.', en: 'Full text.' },
    sourceIds: ['constitution'], ...over,
  });
  const E = '/api/v1/admin/heritage/entries';

  /** Walk an entry through the whole pipeline with the right people. */
  async function publish(id = 'test-entry', over: Record<string, unknown> = {}) {
    expect((await call('editor', 'POST', E, entry({ id, ...over }))).status).toBe(200);
    expect((await call('editor', 'POST', `${E}/${id}/transition`, { to: 'review' })).status).toBe(200);
    expect((await call('admin', 'POST', `${E}/${id}/verify`, { state: 'verified', note: 'burimet u hapën dhe u krahasuan' })).status).toBe(200);
    expect((await call('admin', 'POST', `${E}/${id}/transition`, { to: 'approved' })).status).toBe(200);
    return call('admin', 'POST', `${E}/${id}/transition`, { to: 'published' });
  }

  it('closes the staff API to anyone outside the heritage section', async () => {
    expect((await call(null, 'GET', '/api/v1/admin/heritage')).status).toBe(401);
    expect((await call('citizen', 'GET', '/api/v1/admin/heritage')).status).toBe(403);
    expect((await call('agent', 'GET', '/api/v1/admin/heritage')).status).toBe(403);
    expect((await call('agent', 'POST', E, entry())).status).toBe(403);
    expect((await call('editor', 'GET', '/api/v1/admin/heritage')).status).toBe(200);
  });

  it('creates drafts only, with a version, an owner and an audit line', async () => {
    const r = await call('editor', 'POST', E, entry({ status: 'published', verification: { state: 'verified' } }));
    expect(r.status).toBe(200);
    expect(r.body.entry).toMatchObject({ status: 'draft', version: 1, origin: 'cms', verification: { state: 'unverified' }, createdBy: 'u-editor', editedBy: 'u-editor' });
    expect(audits).toContain('heritage.create');
    expect(fx.childrenOf('heritageLog').length).toBe(1);
    expect((await call('editor', 'POST', E, entry())).status).toBe(409);
  });

  it('rejects invalid input with field errors', async () => {
    const r = await call('editor', 'POST', E, entry({ id: 'Bad Id', section: 'nope', evidence: 'rumour' }));
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.errors).sort()).toEqual(['evidence', 'id', 'section']);
  });

  it('refuses a stale edit (version conflict) and resets verification when content changes', async () => {
    await call('editor', 'POST', E, entry());
    await call('editor', 'POST', `${E}/test-entry/transition`, { to: 'review' });
    await call('admin', 'POST', `${E}/test-entry/verify`, { state: 'verified', note: 'kontrolluar me burimet' });
    // A second author edits; the first still holds version 1+.
    const edit = await call('editor2', 'PUT', `${E}/test-entry`, { ...entry({ title: { sq: 'Titull i ri', en: 'New title' } }), expectedVersion: 3 });
    expect(edit.status).toBe(200);
    expect(edit.body.entry.verification.state).toBe('unverified');
    const stale = await call('editor', 'PUT', `${E}/test-entry`, { ...entry(), expectedVersion: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toMatch(/tjetër/);
  });

  it('enforces four-eyes on verification and approval', async () => {
    await call('editor', 'POST', E, entry());
    await call('editor', 'POST', `${E}/test-entry/transition`, { to: 'review' });
    const selfVerify = await call('editor', 'POST', `${E}/test-entry/verify`, { state: 'verified', note: 'e kontrollova vetë' });
    expect(selfVerify.status).toBe(403);
    const selfApprove = await call('editor', 'POST', `${E}/test-entry/transition`, { to: 'approved' });
    expect(selfApprove.status).toBe(403);
    const noNote = await call('admin', 'POST', `${E}/test-entry/verify`, { state: 'verified', note: '' });
    expect(noNote.status).toBe(400);
  });

  it('publishes only a verified, sourced, complete entry — and only by an admin', async () => {
    await call('editor', 'POST', E, entry({ title: { sq: 'Titull', en: '' } }));
    await call('editor', 'POST', `${E}/test-entry/transition`, { to: 'review' });
    await call('admin', 'POST', `${E}/test-entry/transition`, { to: 'approved' });
    const blocked = await call('admin', 'POST', `${E}/test-entry/transition`, { to: 'published' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatch(/anglisht/);
    expect(blocked.body.error).toMatch(/Verifikimi/);

    fx = fakeFirestore();
    const ok = await publish();
    expect(ok.status).toBe(200);
    expect(ok.body.entry).toMatchObject({ status: 'published' });
    const asEditor = await call('editor', 'POST', E, entry({ id: 'second' }));
    await call('editor', 'POST', `${E}/second/transition`, { to: 'review' });
    await call('admin', 'POST', `${E}/second/verify`, { state: 'verified', note: 'kontrolluar me burimet' });
    await call('admin', 'POST', `${E}/second/transition`, { to: 'approved' });
    expect(asEditor.status).toBe(200);
    expect((await call('editor', 'POST', `${E}/second/transition`, { to: 'published' })).status).toBe(403);
  });

  it('refuses to publish an entry whose source is not in the register', async () => {
    const r = await publish('ghostly', { sourceIds: ['no-such-source'] });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/no-such-source/);
  });

  it('the public API shows only published entries and no staff identities', async () => {
    await call('editor', 'POST', E, entry({ id: 'still-draft' }));
    await publish('is-public');
    const pub = await call(null, 'GET', '/api/public/heritage');
    expect(pub.status).toBe(200);
    expect(pub.body.entries.map((e: any) => e.id)).toEqual(['is-public']);
    const shown = JSON.stringify(pub.body);
    expect(shown).not.toMatch(/u-editor|u-admin|@test\.org|createdBy|updatedBy|editedBy|withdrawn/);
    expect(pub.body.entries[0].verification).toMatchObject({ state: 'verified' });
    expect(pub.body.entries[0].verification.by).toBeUndefined();
  });

  it('withdrawing a published entry hides the bundled seed text of the same id', async () => {
    await publish('mikpritja');
    expect((await call(null, 'GET', '/api/public/heritage')).body.hiddenIds).toEqual([]);
    const down = await call('admin', 'POST', `${E}/mikpritja/transition`, { to: 'draft', reason: 'gabim faktik në paragrafin e dytë' });
    expect(down.status).toBe(200);
    invalidateHeritageCache();
    const pub = await call(null, 'GET', '/api/public/heritage');
    expect(pub.body.entries).toEqual([]);
    expect(pub.body.hiddenIds).toEqual(['mikpritja']);
  });

  it('importing the bundled content creates drafts that do NOT hide the public seed text', async () => {
    expect((await call('editor', 'POST', '/api/v1/admin/heritage/import-seed', {})).status).toBe(403);
    const r = await call('admin', 'POST', '/api/v1/admin/heritage/import-seed', { ids: ['mikpritja', 'ulpiana'] });
    expect(r.body).toMatchObject({ ok: true, created: 2, skipped: 0 });
    expect((await call('admin', 'POST', '/api/v1/admin/heritage/import-seed', { ids: ['mikpritja'] })).body).toMatchObject({ created: 0, skipped: 1 });
    const pub = await call(null, 'GET', '/api/public/heritage');
    expect(pub.body.entries).toEqual([]);
    expect(pub.body.hiddenIds).toEqual([]);
  });

  it('a visible correction on a published entry is dated, attributed internally, and bumps the version', async () => {
    await publish();
    const r = await call('admin', 'POST', `${E}/test-entry/correct`, { text: { sq: 'U korrigjua data e ngjarjes.', en: 'The date was corrected.' }, patch: { summary: { sq: 'Përmbledhje e korrigjuar' } } });
    expect(r.status).toBe(200);
    expect(r.body.entry.corrections).toHaveLength(1);
    expect(r.body.entry.summary.sq).toBe('Përmbledhje e korrigjuar');
    expect(r.body.entry.summary.en).toBe('Summary');
    invalidateHeritageCache();
    const pub = (await call(null, 'GET', '/api/public/heritage')).body.entries[0];
    expect(pub.corrections[0]).toMatchObject({ text: { sq: 'U korrigjua data e ngjarjes.' }, by: '' });
    expect((await call('editor', 'POST', `${E}/test-entry/correct`, { text: { sq: 'Një korrigjim pa leje.' } })).status).toBe(403);
  });

  it('published entries are not edited in place', async () => {
    await publish();
    const r = await call('admin', 'PUT', `${E}/test-entry`, { ...entry(), expectedVersion: 5 });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/Korrigjim|draft/);
  });

  it('keeps one revision per change and an append-only log with the actor and reason', async () => {
    await publish();
    await call('admin', 'POST', `${E}/test-entry/transition`, { to: 'archived', reason: 'zëvendësohet nga një shënim më i plotë' });
    const revs = await call('editor', 'GET', `${E}/test-entry/revisions`);
    expect(revs.body.revisions.length).toBe(6);
    expect(revs.body.revisions[0]).toMatchObject({ status: 'archived', actorRole: 'admin' });
    expect(revs.body.revisions[0].reason).toMatch(/zëvendësohet/);
    const list = await call('editor', 'GET', '/api/v1/admin/heritage');
    expect(list.body.log.length).toBe(6);
    expect(list.body.log.every((l: any) => l.actorUid && l.at && l.entryId === 'test-entry')).toBe(true);
    expect(list.body.me).toMatchObject({ canEdit: true, canApprove: true, canPublish: false });
  });

  it('only a super-admin deletes, and only drafts or archived entries', async () => {
    await call('editor', 'POST', E, entry({ id: 'to-delete' }));
    expect((await call('admin', 'DELETE', `${E}/to-delete`, { reason: 'x' })).status).toBe(403);
    expect((await call('super', 'DELETE', `${E}/to-delete`, { reason: 'dublikatë' })).status).toBe(200);
    await publish('live-one');
    expect((await call('super', 'DELETE', `${E}/live-one`, { reason: 'x' })).status).toBe(409);
  });

  it('manages the citation register: https only, the check date is stamped by the server, in-use sources cannot be deleted', async () => {
    const S = '/api/v1/admin/heritage/sources';
    expect((await call('editor', 'PUT', `${S}/new-src`, { title: 'T', publisher: 'P', type: 'court', url: 'http://insecure.org' })).status).toBe(400);
    const ok = await call('editor', 'PUT', `${S}/new-src`, { title: 'Vendim', publisher: 'Gjykata', type: 'court', url: 'https://court.example/d', linkChecked: true, linkCheckedAt: '1999-01-01' });
    expect(ok.status).toBe(200);
    expect(ok.body.source.linkChecked).toBe(true);
    expect(ok.body.source.linkCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ok.body.source.linkCheckedAt).not.toBe('1999-01-01');
    await call('editor', 'POST', E, entry({ id: 'uses-src', sourceIds: ['new-src'] }));
    expect((await call('admin', 'DELETE', `${S}/new-src`)).status).toBe(409);
    expect((await call('editor', 'DELETE', `${S}/new-src`)).status).toBe(403);
  });

  it('settings: hero photo needs credit and a known right; only admins change them', async () => {
    const P = '/api/v1/admin/heritage/settings';
    expect((await call('editor', 'PUT', P, { heroImageUrl: 'https://x/y.jpg', heroCredit: 'A', heroRights: 'licensed' })).status).toBe(403);
    expect((await call('admin', 'PUT', P, { heroImageUrl: 'https://x/y.jpg', heroCredit: '', heroRights: 'licensed' })).status).toBe(400);
    expect((await call('admin', 'PUT', P, { heroImageUrl: 'https://x/y.jpg', heroCredit: 'Foto: A', heroRights: 'unknown' })).status).toBe(400);
    expect((await call('admin', 'PUT', P, { heroImageUrl: 'javascript:alert(1)', heroCredit: 'A', heroRights: 'licensed' })).status).toBe(400);
    expect((await call('admin', 'PUT', P, { heroImageUrl: 'https://x/y.jpg', heroCredit: 'Foto: A', heroRights: 'licensed' })).status).toBe(200);
    invalidateHeritageCache();
    expect((await call(null, 'GET', '/api/public/heritage')).body.settings).toMatchObject({ heroImageUrl: 'https://x/y.jpg', heroCredit: 'Foto: A' });
  });
});

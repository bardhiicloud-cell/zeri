import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { PURGE_AFTER_MS, TOMBSTONES, isPurgeDue, purgeRejectedReports, rejectedAtMs, storagePathsOf } from '../../server/rejectedPurge';
import { registerTrackLookupRoutes } from '../../server/trackLookup';

/**
 * A refused report is deleted from the whole system 24 hours after the refusal and its Track ID keeps
 * answering "refused". Run with: npm run test:rules
 */
let db: Firestore;
let server: Server;
let base = '';

const NOW = Date.UTC(2026, 9, 21, 12, 0, 0);
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const files: string[] = [];
const prefixes: string[] = [];
const bucket = () => ({
  deleteFiles: async (o: { prefix: string }) => { prefixes.push(o.prefix); },
  file: (path: string) => ({ delete: async () => { files.push(path); } }),
});

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through the emulator.');
  db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-purge' }));
  const app = express();
  registerTrackLookupRoutes(app, { db: () => db, limiter: (_req, _res, next) => next() });
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server?.close(); });
beforeEach(async () => {
  files.length = 0; prefixes.length = 0;
  for (const name of ['reports', 'reportPrivate', 'workItems', 'reportTasks', 'notifications', TOMBSTONES]) for (const ref of await db.collection(name).listDocuments()) await db.recursiveDelete(ref);
});

const report = (extra: Record<string, unknown>) => ({
  title: 'Gropë në rrugë', description: 'Përshkrim i gjatë i problemit.', category: 'Rrugë', authorId: 'author12', status: 'Rejected',
  location: { municipality: 'Prishtinë' }, images: [], media: [], timeline: [], ...extra,
});

describe('when a refused report is due', () => {
  it('counts from the latest refusal, and never for a report that was not refused', () => {
    expect(isPurgeDue(report({ rejectedAt: hoursAgo(25) }), NOW)).toBe(true);
    expect(isPurgeDue(report({ rejectedAt: hoursAgo(23) }), NOW)).toBe(false);
    expect(isPurgeDue(report({ status: 'Approved', rejectedAt: hoursAgo(99) }), NOW)).toBe(false);
    // No date at all: it cannot be aged, so it is left alone.
    expect(isPurgeDue(report({}), NOW)).toBe(false);
    // Refused, re-opened, refused again an hour ago: the old date must not decide.
    const again = report({ rejectedAt: hoursAgo(80), timeline: [{ status: 'Rejected', date: hoursAgo(80) }, { status: 'Pending Review', date: hoursAgo(60) }, { status: 'Rejected', date: hoursAgo(1) }] });
    expect(rejectedAtMs(again)).toBe(NOW - 3_600_000);
    expect(isPurgeDue(again, NOW)).toBe(false);
    expect(PURGE_AFTER_MS).toBe(24 * 3_600_000);
  });

  it('finds our own files by their download URLs and ignores everything else', () => {
    const paths = storagePathsOf({
      images: ['https://firebasestorage.googleapis.com/v0/b/x/o/reports%2Fauthor12%2Frep1%2Fa.jpg?alt=media&token=t', 'https://evil.example/o/secrets%2Fa.jpg'],
      media: [{ url: 'http://127.0.0.1:9199/v0/b/x/o/reports%2Fedited%2Frep1%2Fb.png?alt=media' }, { url: 'https://x/o/reports%2F..%2Fup.png' }],
    });
    expect(paths.sort()).toEqual(['reports/author12/rep1/a.jpg', 'reports/edited/rep1/b.png']);
  });
});

describe('the sweep', () => {
  it('deletes a report 24 hours after the refusal, with everything that belongs to it, and leaves the code', async () => {
    await db.collection('reports').doc('rep1').set(report({ trackingId: 'ZQ-20261020-AAAA1111', rejectedAt: hoursAgo(25), images: ['https://x/o/reports%2Fauthor12%2Frep1%2Fa.jpg?alt=media'] }));
    await db.collection('reports').doc('rep1').collection('internalNotes').add({ text: 'shënim' });
    await db.collection('reports').doc('rep1').collection('assignmentHistory').add({ at: 1 });
    await db.collection('reportPrivate').doc('rep1').set({ authorId: 'author12', name: 'Filan', phone: '+38344111222' });
    await db.collection('workItems').doc('w1').set({ link: { reportId: 'rep1' }, title: 'Shqyrtim' });
    await db.collection('workItems').doc('w2').set({ link: { reportId: 'other' }, title: 'Tjetër' });
    await db.collection('reportTasks').doc('rep1__review').set({ reportId: 'rep1' });
    await db.collection('notifications').doc('n1').set({ link: { reportId: 'rep1' }, title: 'U refuzua' });
    await db.collection('notifications').doc('n2').set({ link: { reportId: 'other' }, title: 'Tjetër' });

    const result = await purgeRejectedReports({ db: () => db, bucket }, NOW);
    expect(result).toMatchObject({ purged: 1, failed: 0 });

    expect((await db.collection('reports').doc('rep1').get()).exists).toBe(false);
    expect((await db.collection('reports').doc('rep1').collection('internalNotes').get()).size).toBe(0);
    expect((await db.collection('reports').doc('rep1').collection('assignmentHistory').get()).size).toBe(0);
    expect((await db.collection('reportPrivate').doc('rep1').get()).exists).toBe(false);
    expect((await db.collection('workItems').doc('w1').get()).exists).toBe(false);
    expect((await db.collection('reportTasks').doc('rep1__review').get()).exists).toBe(false);
    expect((await db.collection('notifications').doc('n1').get()).exists).toBe(false);
    // Other reports' work is untouched.
    expect((await db.collection('workItems').doc('w2').get()).exists).toBe(true);
    expect((await db.collection('notifications').doc('n2').get()).exists).toBe(true);

    expect(prefixes.sort()).toEqual(['reports/author12/rep1/', 'reports/edited/rep1/']);
    expect(files).toEqual(['reports/author12/rep1/a.jpg']);

    const tomb = (await db.collection(TOMBSTONES).doc('ZQ-20261020-AAAA1111').get()).data()!;
    expect(tomb).toMatchObject({ trackingId: 'ZQ-20261020-AAAA1111', status: 'Rejected', purgedAtMs: NOW });
    expect(Object.keys(tomb).sort()).toEqual(['purgedAtMs', 'rejectedAtMs', 'status', 'trackingId']);
  });

  it('leaves a report that was refused less than 24 hours ago, and one that was not refused', async () => {
    await db.collection('reports').doc('fresh').set(report({ trackingId: 'ZQ-20261021-BBBB2222', rejectedAt: hoursAgo(2) }));
    await db.collection('reports').doc('open').set(report({ trackingId: 'ZQ-20261021-CCCC3333', status: 'Approved', rejectedAt: hoursAgo(90) }));
    const result = await purgeRejectedReports({ db: () => db, bucket }, NOW);
    expect(result.purged).toBe(0);
    expect((await db.collection('reports').doc('fresh').get()).exists).toBe(true);
    expect((await db.collection('reports').doc('open').get()).exists).toBe(true);
  });

  it('is safe to run twice', async () => {
    await db.collection('reports').doc('rep2').set(report({ trackingId: 'ZQ-20261020-DDDD4444', rejectedAt: hoursAgo(30) }));
    await purgeRejectedReports({ db: () => db, bucket }, NOW);
    expect(await purgeRejectedReports({ db: () => db, bucket }, NOW)).toMatchObject({ purged: 0, failed: 0 });
  });
});

describe('what the Track ID shows', () => {
  const get = async (id: string) => { const r = await fetch(`${base}/api/v1/public/track/${id}`); return { status: r.status, json: await r.json() as any }; };

  it('shows only the code, "refused" and the reason during the first 24 hours', async () => {
    await db.collection('reports').doc('rep3').set(report({
      trackingId: 'ZQ-20261021-EEEE5555', rejectedAt: hoursAgo(2),
      timeline: [{ id: 't1', status: 'Rejected', date: hoursAgo(2), comment: 'Dublikat i një raporti ekzistues', source: 'admin' }],
    }));
    const { status, json } = await get('ZQ-20261021-EEEE5555');
    expect(status).toBe(200);
    expect(json.report).toMatchObject({ trackingId: 'ZQ-20261021-EEEE5555', status: 'Rejected', title: '', description: '', municipality: '' });
    expect(json.report.rejection.reason).toBe('Dublikat i një raporti ekzistues');
    expect(json.report.timeline).toEqual([]);
    expect(JSON.stringify(json)).not.toContain('Gropë');
  });

  it('says it was refused and deleted once the 24 hours have passed', async () => {
    await db.collection('reports').doc('rep4').set(report({ trackingId: 'ZQ-20261020-FFFF6666', rejectedAt: hoursAgo(26) }));
    await purgeRejectedReports({ db: () => db, bucket }, NOW);
    const { status, json } = await get('ZQ-20261020-FFFF6666');
    expect(status).toBe(200);
    expect(json.report).toMatchObject({ trackingId: 'ZQ-20261020-FFFF6666', status: 'Rejected', purged: true, title: '' });
  });

  it('still answers "not found" for a code that never existed', async () => {
    expect((await get('ZQ-20261020-ZZZZ9999')).status).toBe(404);
  });
});

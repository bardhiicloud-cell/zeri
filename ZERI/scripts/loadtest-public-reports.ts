/**
 * Application-layer load test for GET /api/v1/public/reports.
 *
 * WHAT THIS MEASURES: the Express handler, the allow-list projection, the rate limiter
 * wiring, the in-process cache and JSON serialisation, against an in-memory stand-in for
 * Firestore. It runs entirely on this machine, in one process (so the load generator and
 * the server share the CPU, which makes the numbers conservative).
 *
 * WHAT IT DOES NOT MEASURE: Firestore latency, quotas or cost, network, Cloud Run
 * scaling, the browser, or anything about 200,000 users. Those need an authorised
 * staging project. See docs/CAPACITY_TEST_REPORT.md.
 *
 * Usage:  tsx scripts/loadtest-public-reports.ts [--seconds=10] [--concurrency=50] [--docs=100]
 */
import http from 'node:http';
import express from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { registerPublicReportRoutes } from '../server/publicReports';

const arg = (name: string, fallback: number): number => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  const n = hit ? Number(hit.split('=')[1]) : fallback;
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const SECONDS = arg('seconds', 10);
const CONCURRENCY = arg('concurrency', 50);
const DOCS = arg('docs', 100);

const at = (i: number) => ({ toDate: () => new Date(Date.UTC(2026, 0, 1) + i * 60_000) });
const fakeReport = (i: number) => ({
  trackingId: `ZQ-20260101-${String(i).padStart(8, '0')}`,
  title: `Gropë në rrugën ${i}`, description: 'Përshkrim i gjatë. '.repeat(40), category: 'Rrugë & Infrastrukturë', urgency: 'E lartë',
  status: i % 5 === 0 ? 'Resolved' : 'In Progress', createdAt: at(i),
  location: { address: `Rr. ${i}`, municipality: 'Pejë', lat: 42.66 + i / 1e5, lng: 20.28 },
  responsibleInstitution: 'Drejtoria e Infrastrukturës', authorId: `u${i}`, authorName: 'Filan Fisteku', isAnonymous: false,
  assignedTo: 'Agron Berisha', assignedToUid: 'staff', internalNote: 'x'.repeat(200), aiSummary: 'y'.repeat(300),
  upvotes: i % 17, commentsCount: i % 5,
  media: [{ type: 'image', url: `https://cdn.example/${i}.jpg` }], images: [`https://cdn.example/${i}.jpg`],
  timeline: [
    { id: 'e1', status: 'Pending Review', date: '2026-01-01T10:00:00.000Z', updatedBy: 'Sistemi', source: 'system' },
    { id: 'e2', status: 'Approved', date: '2026-01-02T10:00:00.000Z', updatedBy: 'Agron', source: 'agent', comment: 'Verifikuar.' },
    { id: 'e3', status: 'In Progress', date: '2026-01-03T10:00:00.000Z', updatedBy: 'Komuna', source: 'municipality', comment: 'Ekipi del nesër.' },
  ],
});
const DOC_SET = Array.from({ length: DOCS }, (_, i) => ({ id: `d${i}`, data: fakeReport(i + 1) }));

let dbReads = 0;
const chain: Record<string, unknown> = {};
for (const op of ['where', 'orderBy', 'startAfter', 'limit']) chain[op] = () => chain;
chain.get = async () => { dbReads += 1; return { docs: DOC_SET.map(d => ({ id: d.id, data: () => d.data })) }; };
const fakeDb = { collection: () => chain } as unknown as Firestore;

const percentile = (sorted: number[], p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0;

async function run(label: string, urlFor: (i: number) => string, base: string) {
  dbReads = 0;
  const latencies: number[] = [];
  let errors = 0; let bytes = 0; let sent = 0;
  const cpuStart = process.cpuUsage();
  const wallStart = performance.now();
  const stopAt = wallStart + SECONDS * 1000;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (performance.now() < stopAt) {
      const i = sent++;
      const t0 = performance.now();
      try {
        const res = await fetch(`${base}${urlFor(i)}`);
        const body = await res.arrayBuffer();
        bytes += body.byteLength;
        if (!res.ok) errors += 1;
      } catch { errors += 1; }
      latencies.push(performance.now() - t0);
    }
  }));
  const wall = (performance.now() - wallStart) / 1000;
  const cpu = process.cpuUsage(cpuStart);
  latencies.sort((a, b) => a - b);
  return {
    scenario: label,
    requests: latencies.length,
    reqPerSec: Math.round(latencies.length / wall),
    p50ms: +percentile(latencies, 50).toFixed(2),
    p95ms: +percentile(latencies, 95).toFixed(2),
    p99ms: +percentile(latencies, 99).toFixed(2),
    maxMs: +latencies[latencies.length - 1].toFixed(2),
    errorRatePct: +((errors / Math.max(1, latencies.length)) * 100).toFixed(2),
    dbReads,
    avgResponseKB: +(bytes / Math.max(1, latencies.length) / 1024).toFixed(1),
    cpuSeconds: +((cpu.user + cpu.system) / 1e6).toFixed(2),
    wallSeconds: +wall.toFixed(1),
  };
}

async function main() {
  const app = express();
  registerPublicReportRoutes(app, { db: () => fakeDb, limiter: (_req, _res, next) => next() });
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  console.log(`node ${process.version} | ${process.platform} | cpus=${(await import('node:os')).cpus().length} | concurrency=${CONCURRENCY} | ${SECONDS}s per scenario | ${DOCS} documents per page`);
  await run('warm-up', () => '/api/v1/public/reports', base);

  const results = [];
  results.push(await run('A: same page for everyone (cache hits)', () => '/api/v1/public/reports', base));
  // A client that varies the filter on every request cannot be served from the cache.
  // A client varying the cursor on every request cannot be served from the cache. (Varying `municipality` no longer works: only real names are accepted.)
  results.push(await run('B: every request unique (cache misses, one database read each)', i => `/api/v1/public/reports?cursor=${encodeURIComponent(new Date(Date.UTC(2026, 5, 1) + i).toISOString())}`, base));
  const bogus = await fetch(`${base}/api/v1/public/reports?municipality=M1`);
  console.log(`made-up municipality -> HTTP ${bogus.status}`);
  console.log(JSON.stringify(results, null, 2));
  console.log(`heapUsedMB=${(process.memoryUsage().heapUsed / 1048576).toFixed(0)} rssMB=${(process.memoryUsage().rss / 1048576).toFixed(0)}`);
  await new Promise<void>(resolve => server.close(() => resolve()));
}

void main();

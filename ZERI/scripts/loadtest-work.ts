/**
 * Load test of the work-item API: the real Express routes and the real transactions, on the
 * Firestore EMULATOR, with simulated staff.
 *
 *   firebase emulators:exec --config firebase.rules-test.alt.json --only firestore --project demo-zeri-load \
 *     "node node_modules/tsx/dist/cli.mjs scripts/loadtest-work.ts"
 *
 * Environment: AGENTS (default 40), ITEMS (600), CONCURRENCY (25), DASHBOARDS (4).
 *
 * What the numbers mean and do not mean: the emulator is one local Java process, authentication
 * is a header, there is no network and no Cloud Run. The figures show how the application code
 * and its transactions behave and where they queue; they are NOT a statement about production
 * capacity, which needs a staging project (see docs/LOAD_TEST_REPORT.md).
 */
import express from 'express';
import type { AddressInfo } from 'node:net';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { registerWorkItemRoutes } from '../server/workItemRoutes';
import { PROFILES, WORK, upsertProfile } from '../server/workItems';

const AGENTS = Number(process.env.AGENTS ?? 40);
const ITEMS = Number(process.env.ITEMS ?? 600);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 25);
const DASHBOARDS = Number(process.env.DASHBOARDS ?? 4);

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run through `firebase emulators:exec` (FIRESTORE_EMULATOR_HOST is not set).');
const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-load' }));

const people: Record<string, { role: string }> = { boss: { role: 'admin' } };
for (let i = 0; i < AGENTS; i += 1) people[`agent${i}`] = { role: 'agent' };

const app = express();
app.use(express.json());
registerWorkItemRoutes(app, {
  requireAuth: (req, res, next) => {
    const uid = String(req.header('x-test-uid') ?? '');
    if (!people[uid]) return res.status(401).json({ error: 'Unauthorized' });
    (req as unknown as { user: { uid: string } }).user = { uid };
    next();
  },
  db: () => db,
  authAdmin: () => { throw new Error('not used'); },
  actingUser: req => { const uid = (req as unknown as { user: { uid: string } }).user.uid; return { uid, email: `${uid}@test`, role: people[uid].role, municipality: '', permissions: [] }; },
  audit: () => undefined,
});
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/work`;

type Sample = { ms: number; ok: boolean; status: number };
const samples: Record<string, Sample[]> = {};
async function call(label: string, uid: string, path: string, method = 'GET', body?: unknown): Promise<{ status: number; json: any }> {
  const started = performance.now();
  let status = 0; let json: any = null;
  try {
    const response = await fetch(`${base}${path}`, { method, headers: { 'x-test-uid': uid, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    status = response.status; json = await response.json().catch(() => null);
  } catch { status = 0; }
  (samples[label] ??= []).push({ ms: performance.now() - started, ok: status >= 200 && status < 300, status });
  return { status, json };
}

/** Run `tasks` with at most `limit` in flight. */
async function pool<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (true) { const index = next++; if (index >= tasks.length) return; results[index] = await tasks[index](); }
  }));
  return results;
}

const pct = (values: number[], p: number) => { if (!values.length) return NaN; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]; };
const report = () => Object.entries(samples).map(([label, list]) => {
  const times = list.map(s => s.ms);
  return { operation: label, calls: list.length, errors: list.filter(s => !s.ok).length, p50: pct(times, 50), p95: pct(times, 95), p99: pct(times, 99), max: Math.max(...times) };
});

// ---- setup -------------------------------------------------------------------------------
for (const name of [WORK, PROFILES]) for (const ref of await db.collection(name).listDocuments()) await db.recursiveDelete(ref);
for (let i = 0; i < AGENTS; i += 1) {
  await upsertProfile(db, `agent${i}`, { name: `Agent ${i}`, role: 'agent', municipality: '', capacity: 1000 }, Date.now());
}

const phase: Record<string, number> = {};
const t0 = performance.now();

// ---- 1. ingest: managers create items ----------------------------------------------------
const ids: string[] = [];
await pool(Array.from({ length: ITEMS }, (_, n) => async () => {
  const { json, status } = await call('create item', 'boss', '/items', 'POST', {
    kind: 'internal_task', title: `Detyrë ${n}`, priority: (['low', 'normal', 'normal', 'high', 'urgent'] as const)[n % 5], autoAssign: false, dedupeKey: `load:${n}`,
  });
  if (status === 201 || status === 200) ids.push(json.id);
}), CONCURRENCY);
phase.ingestSeconds = (performance.now() - t0) / 1000;

// ---- 2. race: many managers try to place the same item at once ---------------------------
const raceItem = ids[0];
const raceResults = await Promise.all(Array.from({ length: 12 }, () => call('auto-assign race', 'boss', `/items/${raceItem}/auto-assign`, 'POST', {})));
const winners = raceResults.filter(r => r.json?.outcome === 'assigned').length;
const raceDoc = (await db.collection(WORK).doc(raceItem).get()).data() as { assigneeUid: string | null; version: number };
const raceLoad = raceDoc.assigneeUid ? ((await db.collection(PROFILES).doc(raceDoc.assigneeUid).get()).data() as { load: number }).load : null;

// ---- 3. drain with dashboards running ----------------------------------------------------
const t1 = performance.now();
let draining = true;
const dashboardLoops = Array.from({ length: DASHBOARDS }, async () => {
  while (draining) {
    await call('dashboard: overview', 'boss', '/overview');
    await call('dashboard: unassigned queue page', 'boss', '/items?view=unassigned&limit=50');
    await call('dashboard: team page', 'boss', '/workers?limit=50');
  }
});
const rest = ids.filter(id => id !== raceItem);
await pool(rest.map((id, n) => async () => {
  const agent = `agent${n % AGENTS}`;
  const assigned = await call('assign (manager)', 'boss', `/items/${id}/transition`, 'POST', { action: 'assign', assigneeUid: agent });
  if (assigned.status !== 200) return;
  const fresh = assigned.json.version as number;
  await call('accept (agent)', agent, `/items/${id}/transition`, 'POST', { action: 'accept', expectedVersion: fresh });
  await call('start (agent)', agent, `/items/${id}/transition`, 'POST', { action: 'start', expectedVersion: fresh + 1 });
  await call('complete (agent)', agent, `/items/${id}/transition`, 'POST', { action: 'complete', note: 'U krye gjatë provës së ngarkesës', expectedVersion: fresh + 2 });
  if (n % 10 === 0) await call('my work list (agent)', agent, '/items?view=mine&limit=50');
}), CONCURRENCY);
draining = false;
await Promise.all(dashboardLoops);
phase.drainSeconds = (performance.now() - t1) / 1000;

// ---- 4. consistency: what the counters say against what is stored ------------------------
const open = (await db.collection(WORK).where('open', '==', true).count().get()).data().count;
const done = (await db.collection(WORK).where('open', '==', false).count().get()).data().count;
let drift = 0;
for (let i = 0; i < AGENTS; i += 1) {
  const load = ((await db.collection(PROFILES).doc(`agent${i}`).get()).data() as { load: number }).load;
  const held = (await db.collection(WORK).where('assigneeUid', '==', `agent${i}`).where('open', '==', true).get()).docs.reduce((sum, doc) => sum + (doc.data().weight as number), 0);
  if (load !== held) drift += 1;
}

const rows = report();
const f = (n: number) => (Number.isNaN(n) ? 'n/a' : n.toFixed(1));
console.log(`\nAGENTS=${AGENTS} ITEMS=${ITEMS} CONCURRENCY=${CONCURRENCY} DASHBOARDS=${DASHBOARDS}`);
console.log(`ingest: ${ITEMS} items in ${phase.ingestSeconds.toFixed(1)} s = ${(ITEMS / phase.ingestSeconds * 60).toFixed(0)} items/min`);
console.log(`drain (assign, accept, start, complete) of ${rest.length} items: ${phase.drainSeconds.toFixed(1)} s = ${(rest.length / phase.drainSeconds * 60).toFixed(0)} items/min; backlog recovery ${phase.drainSeconds.toFixed(1)} s`);
console.log(`race on one item, 12 simultaneous auto-assign calls: winners=${winners} (must be 1), stored assignee=${raceDoc.assigneeUid}, assignee load=${raceLoad}`);
console.log(`after: open=${open} done=${done} workers whose stored load differs from the work they hold=${drift}`);
console.log('\n| operation | calls | errors | p50 ms | p95 ms | p99 ms | max ms |\n|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.operation} | ${r.calls} | ${r.errors} | ${f(r.p50)} | ${f(r.p95)} | ${f(r.p99)} | ${f(r.max)} |`);
const totalCalls = rows.reduce((s, r) => s + r.calls, 0);
const totalErrors = rows.reduce((s, r) => s + r.errors, 0);
console.log(`\ntotal calls=${totalCalls} errors=${totalErrors} (${(totalErrors / totalCalls * 100).toFixed(2)}%) wall=${((performance.now() - t0) / 1000).toFixed(1)} s`);
const statuses: Record<string, number> = {};
for (const list of Object.values(samples)) for (const s of list) if (!s.ok) statuses[String(s.status)] = (statuses[String(s.status)] ?? 0) + 1;
console.log('error statuses:', JSON.stringify(statuses));
server.close();
process.exit(0);

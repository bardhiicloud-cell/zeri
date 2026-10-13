/**
 * Live check of who holds a report: claim, "Të miat", hand to an agent, release.
 * Local emulator sandbox only (see qa/user-moderation-api-check.ts for how to run).
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { buildRoleClaims } from '../server/roleClaims';

const projectId = process.env.FIREBASE_PROJECT_ID ?? '';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '';
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3010';
if (!projectId.startsWith('demo-') || !authHost || !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refused: needs a demo- project and both emulator hosts.');
  process.exit(2);
}
initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();
const PASSWORD = 'Test-Pass-12345';

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed += 1; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${name}${ok || !detail ? '' : `  [${detail}]`}`);
}

async function tokenFor(uid: string, role: string) {
  await auth.deleteUser(uid).catch(() => undefined);
  const email = `${uid}@assign-check.test`;
  await auth.createUser({ uid, email, password: PASSWORD });
  await auth.setCustomUserClaims(uid, buildRoleClaims(role, []));
  await db.collection('users').doc(uid).set({ id: uid, name: `Emri ${uid}`, email, role });
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  return ((await response.json()) as any).idToken as string;
}

const call = async (token: string | null, method: string, path: string, body?: unknown) => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try { json = await response.json(); } catch { /* empty */ }
  return { status: response.status, body: json };
};
const report = async (id: string) => (await db.collection('reports').doc(id).get()).data() ?? {};

async function main() {
  const owner = await tokenFor('as-owner', 'superadmin');
  const agentA = await tokenFor('as-agent-a', 'agent');
  const agentB = await tokenFor('as-agent-b', 'agent');
  const muni = await tokenFor('as-muni', 'municipality');
  await tokenFor('as-monitor', 'monitor');

  const base = { title: 'Assign check', status: 'Pending Review', createdAt: new Date().toISOString(), timeline: [], location: { municipality: 'Prishtinë' } };
  await db.collection('reports').doc('as-r1').set(base);
  await db.collection('reports').doc('as-r2').set({ ...base, status: 'Approved' });

  console.log('1. Claiming records the person');
  check('agent A claims', (await call(agentA, 'POST', '/api/v1/reports/as-r1/transition', { transition: 'claim' })).status === 200);
  let r = await report('as-r1');
  check('...the report carries A as a person (uid) and a name', r.assignedToUid === 'as-agent-a' && r.assignedTo === 'Emri as-agent-a' && typeof r.assignedAt === 'string');
  const stolen = await call(agentB, 'POST', '/api/v1/reports/as-r1/transition', { transition: 'claim' });
  check('agent B cannot take a report A holds', stolen.status === 409 && stolen.body?.code === 'ALREADY_CLAIMED', `status ${stolen.status}`);
  check('...it still belongs to A', (await report('as-r1')).assignedToUid === 'as-agent-a');

  console.log('\n2. "Të miat"');
  const mineA = await call(agentA, 'GET', '/api/v1/admin/reports?assignee=me');
  check('A sees the report in "Të miat"', mineA.status === 200 && (mineA.body?.items ?? []).some((i: any) => i.id === 'as-r1'), `status ${mineA.status}`);
  const mineB = await call(agentB, 'GET', '/api/v1/admin/reports?assignee=me&status=unapproved');
  check('B does not', mineB.status === 200 && !(mineB.body?.items ?? []).some((i: any) => i.id === 'as-r1'), `status ${mineB.status}`);
  check('a municipality has no "Të miat"', [400, 403].includes((await call(muni, 'GET', '/api/v1/admin/reports?assignee=me')).status));

  console.log('\n3. Handing over and releasing');
  check('an agent cannot hand a report to someone else', (await call(agentA, 'POST', '/api/v1/reports/as-r1/assign', { uid: 'as-agent-b' })).status === 403);
  check('the owner cannot hand it to a municipality', (await call(owner, 'POST', '/api/v1/reports/as-r1/assign', { uid: 'as-muni' })).status === 400);
  const toMonitor = await call(owner, 'POST', '/api/v1/reports/as-r1/assign', { uid: 'as-monitor' });
  check('...or to a monitor', toMonitor.status === 400, `status ${toMonitor.status} ${JSON.stringify(toMonitor.body)}`);
  check('...or to nobody', (await call(owner, 'POST', '/api/v1/reports/as-r1/assign', { uid: 'no-such-person' })).status === 404);
  check('the owner hands it to B', (await call(owner, 'POST', '/api/v1/reports/as-r1/assign', { uid: 'as-agent-b' })).status === 200);
  r = await report('as-r1');
  check('...now B holds it, and the record says the owner did it', r.assignedToUid === 'as-agent-b' && r.assignedBy === 'as-owner');
  check('A can no longer release it', (await call(agentA, 'POST', '/api/v1/reports/as-r1/assign', { release: true })).status === 403);
  check('B releases it', (await call(agentB, 'POST', '/api/v1/reports/as-r1/assign', { release: true })).status === 200);
  r = await report('as-r1');
  check('...back in the shared queue', r.assignedToUid === '' && r.assignedTo === '' && r.status === 'Pending Review');
  check('an approved report is not assigned here', (await call(owner, 'POST', '/api/v1/reports/as-r2/assign', { uid: 'as-agent-a' })).status === 409);

  await new Promise(resolve => setTimeout(resolve, 800));
  const actions = (await db.collection('auditLogs').get()).docs.map(d => d.data().action as string);
  check('assignments, releases and refusals are audited', ['report.assign', 'report.release', 'report.assign.denied'].every(a => actions.includes(a)));

  await db.collection('reports').doc('as-r1').delete();
  await db.collection('reports').doc('as-r2').delete();
  await Promise.all(['as-owner', 'as-agent-a', 'as-agent-b', 'as-muni', 'as-monitor'].map(u => Promise.all([auth.deleteUser(u).catch(() => undefined), db.collection('users').doc(u).delete()])));
  console.log(`\n${passed} passed, ${failures.length} failed.`);
  if (failures.length) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1); }
}

main().catch(error => { console.error('Check aborted:', error); process.exit(1); });

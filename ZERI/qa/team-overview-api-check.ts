/**
 * Live check of the manager's team view. Local emulator sandbox only
 * (see qa/user-moderation-api-check.ts for how to run).
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
  const email = `${uid}@team-check.test`;
  await auth.createUser({ uid, email, password: PASSWORD });
  await auth.setCustomUserClaims(uid, buildRoleClaims(role, []));
  await db.collection('users').doc(uid).set({ id: uid, name: `Emri ${uid}`, email, role });
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  return ((await response.json()) as any).idToken as string;
}
const call = async (token: string | null, path: string) => {
  const response = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  let json: any = null;
  try { json = await response.json(); } catch { /* empty */ }
  return { status: response.status, body: json };
};

async function main() {
  const owner = await tokenFor('tm-owner', 'superadmin');
  const manager = await tokenFor('tm-manager', 'monitor');
  const agent = await tokenFor('tm-agent', 'agent');
  const muni = await tokenFor('tm-muni', 'municipality');
  // A second agent who holds work but has never acted (no audit rows): the dormant case.
  await db.collection('users').doc('tm-quiet').set({ id: 'tm-quiet', name: 'Agjent i heshtur', email: 'quiet@team-check.test', role: 'agent' });

  const base = { title: 'T', status: 'Pending Review', createdAt: new Date().toISOString(), timeline: [], location: { municipality: 'Teamtown' } };
  const ids = ['tm-r1', 'tm-r2', 'tm-r3', 'tm-r4'];
  await db.collection('reports').doc('tm-r1').set({ ...base, assignedToUid: 'tm-quiet', assignedTo: 'Agjent i heshtur' });
  await db.collection('reports').doc('tm-r2').set({ ...base, assignedToUid: 'tm-quiet', assignedTo: 'Agjent i heshtur' });
  await db.collection('reports').doc('tm-r3').set(base);
  await db.collection('reports').doc('tm-r4').set(base);
  // The active agent claims one through the real route, which also writes an audit row.
  const claim = await fetch(`${BASE}/api/v1/reports/tm-r3/transition`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agent}` }, body: JSON.stringify({ transition: 'claim' }) });
  await new Promise(resolve => setTimeout(resolve, 900));

  console.log('1. Who may see the team');
  check('no token -> 401', (await call(null, '/api/v1/admin/team-overview')).status === 401);
  check('an agent cannot see the team view', (await call(agent, '/api/v1/admin/team-overview')).status === 403);
  check('a municipality cannot', (await call(muni, '/api/v1/admin/team-overview')).status === 403);
  check('the manager can', (await call(manager, '/api/v1/admin/team-overview?fresh=1')).status === 200);

  console.log('\n2. What it says');
  const view = await call(owner, '/api/v1/admin/team-overview?fresh=1');
  const rows: any[] = view.body?.agents ?? [];
  const quiet = rows.find(r => r.uid === 'tm-quiet');
  const active = rows.find(r => r.uid === 'tm-agent');
  check('the owner can too, and gets a generated time', view.status === 200 && typeof view.body?.generatedAt === 'string', `status ${view.status}`);
  check('the agent who claimed holds one report', claim.status === 200 && active?.holding === 1, `claim ${claim.status}, holding ${active?.holding}`);
  check('...and shows recent activity', active?.actions24h >= 1 && active?.lastActionAt && active?.dormant === false);
  check('the quiet agent holds two and is flagged dormant', quiet?.holding === 2 && quiet?.dormant === true && quiet?.lastActionAt === null);
  check('dormant agents come first', rows[0]?.uid === 'tm-quiet');
  check('the queue counts what waits (at least our four)', view.body?.queue?.pending >= 4);
  check('...and what nobody has taken on is pending minus what is held', view.body?.queue?.unassigned === view.body?.queue?.pending - view.body?.team?.totalHeld);
  check('the oldest waiting report is reported', typeof view.body?.queue?.oldestPendingAt === 'string');
  check('the view never contains report titles or citizen data', !JSON.stringify(view.body).includes('"title"') && !JSON.stringify(view.body).includes('authorName'));
  check('it counts the dormant holders', view.body?.team?.dormantHolders >= 1);

  for (const id of ids) await db.recursiveDelete(db.collection('reports').doc(id));
  await db.collection('users').doc('tm-quiet').delete();
  await Promise.all(['tm-owner', 'tm-manager', 'tm-agent', 'tm-muni'].map(u => Promise.all([auth.deleteUser(u).catch(() => undefined), db.collection('users').doc(u).delete()])));
  console.log(`\n${passed} passed, ${failures.length} failed.`);
  if (failures.length) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1); }
}

main().catch(error => { console.error('Check aborted:', error); process.exit(1); });

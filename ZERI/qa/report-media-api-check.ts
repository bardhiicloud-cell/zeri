/**
 * Live check of taking a photo off a report and putting it back.
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

async function tokenFor(uid: string, role: string, municipality = '') {
  await auth.deleteUser(uid).catch(() => undefined);
  const email = `${uid}@media-check.test`;
  await auth.createUser({ uid, email, password: PASSWORD });
  await auth.setCustomUserClaims(uid, { ...buildRoleClaims(role, []), ...(municipality ? { municipality } : {}) });
  await db.collection('users').doc(uid).set({ id: uid, name: uid, email, role: 'citizen' });
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  return ((await response.json()) as any).idToken as string;
}

const call = async (token: string | null, path: string, body?: unknown) => {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  let json: any = null;
  try { json = await response.json(); } catch { /* empty */ }
  return { status: response.status, body: json };
};

async function main() {
  const admin = await tokenFor('media-admin', 'admin');
  const agent = await tokenFor('media-agent', 'agent');
  const monitor = await tokenFor('media-monitor', 'monitor');
  const municipality = await tokenFor('media-municipality', 'municipality', 'Prishtinë');

  const A = 'https://example.test/a.jpg';
  const B = 'https://example.test/b.jpg';
  const id = 'media-check-report';
  await db.collection('reports').doc(id).set({
    title: 'Media check', status: 'Pending Review', createdAt: new Date().toISOString(), timeline: [],
    location: { municipality: 'Prishtinë', address: 'x' },
    media: [{ type: 'image', url: A }, { type: 'image', url: B }], images: [A, B],
  });
  const reason = 'Shfaqet fytyra e një personi';
  const path = (action: string) => `/api/v1/reports/${id}/media/${action}`;

  console.log('1. Who may take a photo down');
  check('no token -> 401', (await call(null, path('remove'), { url: A, reason })).status === 401);
  check('a monitor is refused', (await call(monitor, path('remove'), { url: A, reason })).status === 403);
  check('a municipality is refused', (await call(municipality, path('remove'), { url: A, reason })).status === 403);
  check('a reason is required', (await call(agent, path('remove'), { url: A })).status === 400);
  check('a photo not on the report -> 404', (await call(agent, path('remove'), { url: 'https://example.test/nope.jpg', reason })).status === 404);
  check('...and nothing changed after the refusals', ((await db.collection('reports').doc(id).get()).data()?.images ?? []).length === 2);

  console.log('\n2. Taking it down');
  const removed = await call(agent, path('remove'), { url: A, reason });
  check('an agent removes a photo', removed.status === 200, `status ${removed.status}`);
  let doc = (await db.collection('reports').doc(id).get()).data() ?? {};
  check('it leaves media and images', doc.images?.length === 1 && doc.images[0] === B && doc.media?.length === 1);
  check('the report document no longer carries the removed address anywhere', !JSON.stringify(doc).includes(A));
  const kept = await db.collection('reports').doc(id).collection('removedMedia').get();
  check('it is kept in the private subcollection with who and why', kept.size === 1 && kept.docs[0].data().removedReason === reason && kept.docs[0].data().removedBy === 'media-agent');
  const last = (doc.timeline ?? []).at(-1);
  check('the public timeline says a photo was removed, without the reason', !!last && !String(last.comment).includes('fytyra'));

  console.log('\n3. Putting it back');
  check('a monitor cannot restore', (await call(monitor, path('restore'), { url: A })).status === 403);
  check('a photo that was never removed cannot be restored', (await call(admin, path('restore'), { url: B })).status === 404);
  check('an admin restores it', (await call(admin, path('restore'), { url: A })).status === 200);
  doc = (await db.collection('reports').doc(id).get()).data() ?? {};
  check('both photos are back', doc.images?.length === 2 && doc.media?.length === 2);
  check('the private copy is cleared', (await db.collection('reports').doc(id).collection('removedMedia').get()).size === 0);

  await new Promise(resolve => setTimeout(resolve, 800));
  const actions = (await db.collection('auditLogs').get()).docs.map(d => d.data().action as string);
  check('removal, restore and refusals are audited', ['report.media.remove', 'report.media.restore', 'report.media.remove.denied'].every(a => actions.includes(a)));

  await db.collection('reports').doc(id).delete();
  await Promise.all(['media-admin', 'media-agent', 'media-monitor', 'media-municipality'].map(u => Promise.all([auth.deleteUser(u).catch(() => undefined), db.collection('users').doc(u).delete()])));
  console.log(`\n${passed} passed, ${failures.length} failed.`);
  if (failures.length) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1); }
}

main().catch(error => { console.error('Check aborted:', error); process.exit(1); });

/**
 * Live check of sending a report to an institution (no email provider is configured
 * in the sandbox, so sends are kept in the outbox as "queued"; the provider formats
 * themselves are covered by tests/server/institutionMail.test.ts).
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
  const email = `${uid}@mail-check.test`;
  await auth.createUser({ uid, email, password: PASSWORD });
  await auth.setCustomUserClaims(uid, { ...buildRoleClaims(role, []), ...(municipality ? { municipality } : {}) });
  await db.collection('users').doc(uid).set({ id: uid, name: `Emri ${uid}`, email, role });
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  return ((await response.json()) as any).idToken as string;
}
const call = async (token: string | null, method: string, path: string, body?: unknown) => {
  const response = await fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try { json = await response.json(); } catch { /* empty */ }
  return { status: response.status, body: json };
};

async function main() {
  const owner = await tokenFor('ml-owner', 'superadmin');
  const agent = await tokenFor('ml-agent', 'agent');
  const monitor = await tokenFor('ml-monitor', 'monitor');
  const muni = await tokenFor('ml-muni', 'municipality', 'Pejë');

  const base = { title: 'Gropë në rrugë', description: 'Gropë e thellë.', category: 'Rrugë', urgency: 'E lartë', timeline: [], createdAt: new Date().toISOString(), authorId: 'ml-secret-citizen', authorName: 'Emri Sekret', location: { municipality: 'Pejë', address: 'Rr. Bajram Curri' } };
  await db.collection('reports').doc('ml-ok').set({ ...base, status: 'Approved', trackingId: 'ZQ-ML001' });
  await db.collection('reports').doc('ml-pending').set({ ...base, status: 'Pending Review' });
  await db.collection('reports').doc('ml-gjilan').set({ ...base, status: 'Approved', location: { municipality: 'Gjilan' } });
  await db.collection('reportRoutingContacts').doc('ml-contact').set({ municipality: 'Pejë', institution: 'Drejtoria e Infrastrukturës', name: 'Z. Hoxha', email: 'hoxha@peja.test' });
  await db.collection('reportRoutingContacts').doc('ml-bad').set({ municipality: 'Pejë', institution: 'X', name: 'Y', email: 'not-an-email' });
  const send = (token: string | null, reportId: string, contactId: string, note?: string) =>
    call(token, 'POST', `/api/v1/reports/${reportId}/email-institution`, { contactId, note });

  console.log('1. Who, which report, which contact');
  check('no token -> 401', (await send(null, 'ml-ok', 'ml-contact')).status === 401);
  check('a monitor cannot send', (await send(monitor, 'ml-ok', 'ml-contact')).status === 403);
  check('a report not yet approved is not sent', (await send(owner, 'ml-pending', 'ml-contact')).status === 409);
  check('an unknown report -> 404', (await send(owner, 'ml-nope', 'ml-contact')).status === 404);
  check('an address that is not in the verified directory is refused', (await send(owner, 'ml-ok', 'typed-by-hand@evil.test')).status === 404);
  check('a directory entry with a broken email is refused', (await send(owner, 'ml-ok', 'ml-bad')).status === 400);
  check('a Pejë contact cannot receive a Gjilan report', (await send(owner, 'ml-gjilan', 'ml-contact')).status === 400);
  const basic = await send(muni, 'ml-ok', 'ml-contact');
  check('a municipality on the basic plan cannot send (email is Pro)', basic.status === 403 && basic.body?.code === 'PLAN_REQUIRED', `status ${basic.status}`);

  console.log('\n2. Sending, with no provider configured');
  check('the console can ask whether email is configured', (await call(agent, 'GET', '/api/v1/mail/status')).body?.configured === false);
  const sent = await send(agent, 'ml-ok', 'ml-contact', 'Urgjente, ka rrezik.');
  check('an agent send is kept in the queue, honestly', sent.status === 202 && sent.body?.status === 'queued' && sent.body?.configured === false, `status ${sent.status}`);
  const rows = (await db.collection('emailOutbox').where('reportId', '==', 'ml-ok').get()).docs.map(d => d.data());
  check('...recorded with who, to whom and the report', rows.length === 1 && rows[0].to === 'hoxha@peja.test' && rows[0].byUid === 'ml-agent' && rows[0].trackingId === 'ZQ-ML001');
  check('...and the stored row never names the reporter', !JSON.stringify(rows).includes('Sekret') && !JSON.stringify(rows).includes('ml-secret-citizen'));
  check('the same report to the same address within 24h is refused', (await send(owner, 'ml-ok', 'ml-contact')).status === 409);

  console.log('\n3. History and retry');
  const history = await call(agent, 'GET', '/api/v1/reports/ml-ok/emails');
  check('staff read the history of a report', history.status === 200 && history.body?.items?.length === 1 && history.body.items[0].status === 'queued');
  check('a monitor may read it too', (await call(monitor, 'GET', '/api/v1/reports/ml-ok/emails')).status === 200);
  check('a plain citizen-level account may not', (await call(null, 'GET', '/api/v1/reports/ml-ok/emails')).status === 401);
  const id = history.body?.items?.[0]?.id;
  check('an agent cannot retry', (await call(agent, 'POST', `/api/v1/admin/emails/${id}/retry`)).status === 403);
  const retry = await call(owner, 'POST', `/api/v1/admin/emails/${id}/retry`);
  check('the owner retry says plainly that email is not configured', retry.status === 409 && retry.body?.code === 'NOT_CONFIGURED', `status ${retry.status}`);

  console.log('\n4. Pro municipality');
  await call(owner, 'PUT', '/api/v1/admin/users/ml-muni/plan', { plan: 'pro' });
  await db.collection('emailOutbox').where('reportId', '==', 'ml-ok').get().then(snap => Promise.all(snap.docs.map(d => d.ref.delete())));
  check('on Pro, the municipality sends its own report', (await send(muni, 'ml-ok', 'ml-contact')).status === 202);
  check('...but not another municipality report', (await send(muni, 'ml-gjilan', 'ml-contact')).status === 404);

  await new Promise(resolve => setTimeout(resolve, 800));
  const actions = (await db.collection('auditLogs').get()).docs.map(d => d.data().action as string);
  check('sends and refusals are audited', ['report.email.queued', 'report.email.denied'].every(a => actions.includes(a)));

  for (const id of ['ml-ok', 'ml-pending', 'ml-gjilan']) await db.recursiveDelete(db.collection('reports').doc(id));
  for (const id of ['ml-contact', 'ml-bad']) await db.collection('reportRoutingContacts').doc(id).delete();
  for (const d of (await db.collection('emailOutbox').where('reportId', 'in', ['ml-ok', 'ml-pending', 'ml-gjilan']).get()).docs) await d.ref.delete();
  await Promise.all(['ml-owner', 'ml-agent', 'ml-monitor', 'ml-muni'].map(u => Promise.all([auth.deleteUser(u).catch(() => undefined), db.collection('users').doc(u).delete()])));
  console.log(`\n${passed} passed, ${failures.length} failed.`);
  if (failures.length) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1); }
}

main().catch(error => { console.error('Check aborted:', error); process.exit(1); });

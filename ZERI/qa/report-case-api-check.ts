/**
 * Live check of the conversation around a report: asking the citizen for more, hearing
 * back, internal notes and escalation. Local emulator sandbox only
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

async function tokenFor(uid: string, role: string, municipality = '') {
  await auth.deleteUser(uid).catch(() => undefined);
  const email = `${uid}@case-check.test`;
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
const report = async (id: string) => (await db.collection('reports').doc(id).get()).data() ?? {};

async function main() {
  const owner = await tokenFor('cs-owner', 'superadmin');
  const agent = await tokenFor('cs-agent', 'agent');
  const monitor = await tokenFor('cs-monitor', 'monitor');
  const muni = await tokenFor('cs-muni', 'municipality', 'Pejë');
  // The citizen who filed the report (a plain account), and another citizen.
  const citizen = await tokenFor('cs-citizen', 'citizen');
  const other = await tokenFor('cs-other', 'citizen');

  const base = { createdAt: new Date().toISOString(), timeline: [], title: 'Gropë', description: 'Gropë e thellë', category: 'Rrugë', location: { municipality: 'Pejë' } };
  await db.collection('reports').doc('cs-r1').set({ ...base, status: 'Pending Review', authorId: 'cs-citizen', isAnonymous: true, authorName: 'Anonim', trackingId: 'ZQ-CS001' });
  await db.collection('reports').doc('cs-approved').set({ ...base, status: 'Approved', authorId: 'cs-citizen' });
  const ask = (token: string | null, id: string, question: unknown) => call(token, 'POST', `/api/v1/reports/${id}/request-info`, { question });
  const QUESTION = 'A mund të dërgoni një foto më të qartë të gropës dhe adresën e saktë?';

  console.log('1. Asking the citizen');
  check('no token -> 401', (await ask(null, 'cs-r1', QUESTION)).status === 401);
  check('the citizen cannot ask themselves', (await ask(citizen, 'cs-r1', QUESTION)).status === 403);
  check('a municipality cannot ask', (await ask(muni, 'cs-r1', QUESTION)).status === 403);
  check('a monitor cannot ask', (await ask(monitor, 'cs-r1', QUESTION)).status === 403);
  check('an approved report is not asked about', (await ask(agent, 'cs-approved', QUESTION)).status === 409);
  check('a one-word question is refused', (await ask(agent, 'cs-r1', 'foto')).status === 400);
  const asked = await ask(agent, 'cs-r1', QUESTION);
  check('an agent asks the citizen for more', asked.status === 201, `status ${asked.status}`);
  let r = await report('cs-r1');
  check('the report is flagged as waiting for the citizen', r.awaitingInfo === true);
  const publicEvent = (r.timeline ?? []).at(-1);
  check('the PUBLIC timeline says more was requested, never what was asked', publicEvent?.comment === 'Kërkohet informacion shtesë nga qytetari.' && !JSON.stringify(r).includes('foto më të qartë'));
  check('asking again while waiting is refused', (await ask(owner, 'cs-r1', QUESTION)).status === 409);
  const notified = (await db.collection('notifications').where('userId', '==', 'cs-citizen').get()).docs.map(d => d.data());
  check('the citizen is notified, with the question', notified.some(n => String(n.message).includes('foto')));

  console.log('\n2. Only the citizen who filed it can read and answer');
  const theirs = await call(citizen, 'GET', '/api/v1/reports/cs-r1/case');
  check('the citizen reads the question', theirs.status === 200 && theirs.body?.awaitingInfo === true && theirs.body?.items?.length === 1 && theirs.body.items[0].kind === 'info_request');
  check('...and not who on the staff asked', theirs.body?.items?.[0]?.byUid === undefined);
  check('another citizen sees nothing (looks like it does not exist)', (await call(other, 'GET', '/api/v1/reports/cs-r1/case')).status === 404);
  check('...and cannot answer in their place', (await call(other, 'POST', '/api/v1/reports/cs-r1/provide-info', { answer: 'Ja informacioni.' })).status === 404);
  check('staff cannot answer for the citizen either', (await call(owner, 'POST', '/api/v1/reports/cs-r1/provide-info', { answer: 'Ja informacioni.' })).status === 404);
  check('a municipality cannot read the thread', (await call(muni, 'GET', '/api/v1/reports/cs-r1/case')).status === 404);
  check('an empty answer is refused', (await call(citizen, 'POST', '/api/v1/reports/cs-r1/provide-info', { answer: 'jo' })).status === 400);
  const answered = await call(citizen, 'POST', '/api/v1/reports/cs-r1/provide-info', { answer: 'Ja foto e re; gropa është para shkollës në rrugën Bajram Curri.' });
  check('the citizen answers', answered.status === 201, `status ${answered.status}`);
  r = await report('cs-r1');
  check('the flag clears, and the public timeline says only that information was given', r.awaitingInfo === false && (r.timeline ?? []).at(-1)?.comment === 'Qytetari dha informacionin shtesë.' && !JSON.stringify(r).includes('Bajram Curri.'));
  check('answering again is refused (nothing is being asked)', (await call(citizen, 'POST', '/api/v1/reports/cs-r1/provide-info', { answer: 'Edhe një herë.' })).status === 409);
  const asker = (await db.collection('notifications').where('userId', '==', 'cs-agent').get()).docs.map(d => d.data());
  check('the agent who asked is told the answer arrived', asker.some(n => String(n.title).includes('u përgjigj')));

  console.log('\n2b. The citizen reaches it by the tracking number they hold');
  await db.collection('reports').doc('cs-r2').set({ ...base, status: 'Pending Review', authorId: 'cs-citizen', trackingId: 'ZQ-CS00002', title: 'Dytë' });
  await ask(agent, 'cs-r2', QUESTION);
  const byNumber = await call(citizen, 'GET', '/api/v1/my-reports/ZQ-CS00002/case');
  check('the owner of the report reads the question by tracking number', byNumber.status === 200 && byNumber.body?.awaitingInfo === true, JSON.stringify(byNumber));
  check('someone else with the same number gets "not found"', (await call(other, 'GET', '/api/v1/my-reports/ZQ-CS00002/case')).status === 404);
  check('...and cannot answer by it', (await call(other, 'POST', '/api/v1/my-reports/ZQ-CS00002/provide-info', { answer: 'Ja informacioni.' })).status === 404);
  check('a made-up number is "not found"', (await call(citizen, 'GET', '/api/v1/my-reports/ZQ-NOPE-0000/case')).status === 404);
  check('the owner answers by tracking number', (await call(citizen, 'POST', '/api/v1/my-reports/ZQ-CS00002/provide-info', { answer: 'Ja foto e re nga vendi.' })).status === 201 && (await report('cs-r2')).awaitingInfo === false);

  console.log('\n3. Internal notes stay internal');
  check('a municipality cannot leave a note', (await call(muni, 'POST', '/api/v1/reports/cs-r1/notes', { text: 'Shënim i jashtëm.' })).status === 403);
  check('the citizen cannot leave one', (await call(citizen, 'POST', '/api/v1/reports/cs-r1/notes', { text: 'Shënim i jashtëm.' })).status === 403);
  check('an agent leaves an internal note', (await call(agent, 'POST', '/api/v1/reports/cs-r1/notes', { text: 'Duket autentike, adresa përputhet me hartën.' })).status === 201);
  const staffView = await call(owner, 'GET', '/api/v1/reports/cs-r1/case');
  check('staff see messages and notes together, in order', staffView.body?.items?.length === 3 && staffView.body.items.filter((i: any) => i.internal).length === 1);
  check('the manager reads the same thread', (await call(monitor, 'GET', '/api/v1/reports/cs-r1/case')).body?.items?.length === 3);
  const citizenView = await call(citizen, 'GET', '/api/v1/reports/cs-r1/case');
  check('the citizen sees the two messages but never the internal note', citizenView.body?.items?.length === 2 && !JSON.stringify(citizenView.body).includes('autentike'));
  check('the note is not on the report document the public can read', !JSON.stringify(await report('cs-r1')).includes('autentike'));

  console.log('\n4. Escalation');
  check('an agent escalates, with a reason', (await call(agent, 'POST', '/api/v1/reports/cs-r1/escalate', { reason: 'Rrezik për kalimtarët pranë shkollës.' })).status === 200);
  check('the report is flagged', (await report('cs-r1')).escalated === true);
  check('escalating twice is refused', (await call(owner, 'POST', '/api/v1/reports/cs-r1/escalate', { reason: 'Rrezik për kalimtarët.' })).status === 409);
  check('an agent cannot resolve an escalation', (await call(agent, 'POST', '/api/v1/reports/cs-r1/resolve-escalation', { reason: 'U zgjidh.' })).status === 403);
  const flagged = await call(owner, 'GET', '/api/v1/admin/reports?flag=escalated');
  check('the escalated list finds it', flagged.status === 200 && (flagged.body?.items ?? []).some((i: any) => i.id === 'cs-r1'), `status ${flagged.status}`);
  check('a municipality cannot use the flag lists', (await call(muni, 'GET', '/api/v1/admin/reports?flag=escalated')).status === 403);
  check('the owner resolves it', (await call(owner, 'POST', '/api/v1/reports/cs-r1/resolve-escalation', { reason: 'Ekipi u nis në terren.' })).status === 200 && (await report('cs-r1')).escalated === false);

  await new Promise(resolve => setTimeout(resolve, 800));
  const actions = (await db.collection('auditLogs').get()).docs.map(d => d.data().action as string);
  check('requests, answers, notes, escalations and refusals are audited', ['report.info.request', 'report.info.provide', 'report.note', 'report.escalation.escalate', 'report.info.provide.denied'].every(a => actions.includes(a)));

  for (const id of ['cs-r1', 'cs-r2', 'cs-approved']) await db.recursiveDelete(db.collection('reports').doc(id));
  for (const d of (await db.collection('notifications').where('userId', 'in', ['cs-citizen', 'cs-agent']).get()).docs) await d.ref.delete();
  await Promise.all(['cs-owner', 'cs-agent', 'cs-monitor', 'cs-muni', 'cs-citizen', 'cs-other'].map(u => Promise.all([auth.deleteUser(u).catch(() => undefined), db.collection('users').doc(u).delete()])));
  console.log(`\n${passed} passed, ${failures.length} failed.`);
  if (failures.length) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1); }
}

main().catch(error => { console.error('Check aborted:', error); process.exit(1); });

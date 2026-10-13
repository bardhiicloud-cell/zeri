/**
 * Live check of the municipality desk: requests, outcomes, work, and isolation.
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
  const email = `${uid}@desk-check.test`;
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
  const peja = await tokenFor('dk-peja', 'municipality', 'Pejë');
  const gjilan = await tokenFor('dk-gjilan', 'municipality', 'Gjilan');
  const owner = await tokenFor('dk-owner', 'superadmin');
  const agent = await tokenFor('dk-agent', 'agent');

  const base = { createdAt: new Date().toISOString(), timeline: [], authorId: 'citizen-x', authorName: 'Emri Qytetarit', urgency: 'Mesatare', category: 'Rrugë' };
  await db.collection('reports').doc('dk-r1').set({ ...base, title: 'R1', status: 'Approved', trackingId: 'ZQ-DK001', location: { municipality: 'Pejë', address: 'x' } });
  await db.collection('reports').doc('dk-r2').set({ ...base, title: 'R2 pending', status: 'Pending Review', location: { municipality: 'Pejë' } });
  await db.collection('reports').doc('dk-r3').set({ ...base, title: 'R3 gjilan', status: 'Approved', location: { municipality: 'Gjilan' } });
  const req = (token: string | null, id: string, kind: unknown, note: unknown) =>
    call(token, 'POST', `/api/v1/municipality/reports/${id}/request`, { kind, note });
  const NOTE = 'Ekipi del neser ne terren per ta rregulluar.';

  console.log('0. Plans decide what a municipality may use');
  await db.collection('healthRegistry').doc('dk-hp').set({ fullName: 'P', age: 40, municipality: 'Pejë', category: 'Tjetër', status: 'pending', urgency: 'Mesatare' });
  const basicHealth = await call(peja, 'GET', '/api/v1/municipality/health');
  check('with no plan sold (basic), the health cases are not offered', basicHealth.status === 403 && basicHealth.body?.code === 'PLAN_REQUIRED', `status ${basicHealth.status}`);
  check('...and the message names the plan that includes them', String(basicHealth.body?.error).includes('standard'));
  check('...a health decision is refused for the same reason', (await call(peja, 'POST', '/api/v1/admin/decisions/health/dk-hp', { action: 'approve' })).status === 403);
  check('...registering works is refused too', (await call(peja, 'POST', '/api/v1/municipality/work-facts', { reportId: 'dk-r1', description: 'U rregullua gropa me asfalt.' })).status === 403);
  const basicDesk = await call(peja, 'GET', '/api/v1/municipality/desk');
  check('the desk tells the console the plan and its features', basicDesk.body?.plan === 'basic' && basicDesk.body?.features?.includes('respond') && !basicDesk.body?.features?.includes('health'));
  const setPlan = (token: string, uid: string, plan: unknown) => call(token, 'PUT', `/api/v1/admin/users/${uid}/plan`, { plan });
  check('a municipality cannot set its own plan', (await setPlan(peja, 'dk-peja', 'pro')).status === 403);
  check('an agent cannot set a plan', (await setPlan(agent, 'dk-peja', 'pro')).status === 403);
  check('the plan cannot be set on an agent account', (await setPlan(owner, 'dk-agent', 'pro')).status === 400);
  check('an unknown plan is refused', (await setPlan(owner, 'dk-peja', 'platinum')).status === 400);
  check('the owner sets Standard', (await setPlan(owner, 'dk-peja', 'standard')).status === 200);
  check('...and the profile carries it, where clients cannot write', (await db.collection('users').doc('dk-peja').get()).data()?.municipalityPlan === 'standard');
  check('Standard now includes the health cases', (await call(peja, 'GET', '/api/v1/municipality/health')).status === 200);
  check('...but not email (Pro)', !((await call(peja, 'GET', '/api/v1/municipality/desk')).body?.features ?? []).includes('email'));
  await db.recursiveDelete(db.collection('healthRegistry').doc('dk-hp'));

  console.log('1. Filing requests');
  check('no token -> 401', (await req(null, 'dk-r1', 'respond', NOTE)).status === 401);
  check('an agent cannot use the municipality desk', (await req(agent, 'dk-r1', 'respond', NOTE)).status === 403);
  check('Peja cannot reach the Gjilan report (looks like it does not exist)', (await req(peja, 'dk-r3', 'respond', NOTE)).status === 404);
  check('...nor a report not yet approved', (await req(peja, 'dk-r2', 'respond', NOTE)).status === 404);
  for (const kind of ['delete_report', 'hide', 'edit']) {
    check(`"${kind}" does not exist as a request`, (await req(peja, 'dk-r1', kind, NOTE)).status === 400);
  }
  check('a one-word note is refused', (await req(peja, 'dk-r1', 'respond', 'ok')).status === 400);
  const respond = await req(peja, 'dk-r1', 'respond', NOTE);
  check('an official response is accepted and public at once', respond.status === 201 && respond.body?.status === 'published', `status ${respond.status}`);
  const r = await report('dk-r1');
  const last = (r.timeline ?? []).at(-1);
  check('...it is on the public timeline in the municipality name', last?.updatedBy === 'Komuna e Pejë' && String(last?.comment).includes('Ekipi del') && r.status === 'Approved');
  const dispute = await req(peja, 'dk-r1', 'dispute', 'Adresa e raportuar nuk eshte ne komunen tone.');
  check('a dispute is stored as pending, not published', dispute.status === 201 && dispute.body?.status === 'pending');
  check('...and the timeline did not change', ((await report('dk-r1')).timeline ?? []).length === 1);
  await req(gjilan, 'dk-r3', 'correct_fact', 'Emri i rruges eshte shkruar gabim.');

  console.log('\n2. The municipality own desk');
  const desk = await call(peja, 'GET', '/api/v1/municipality/desk');
  check('Peja sees its two requests', desk.status === 200 && desk.body?.requests?.length === 2, `status ${desk.status}`);
  check('...and none of Gjilan', !JSON.stringify(desk.body).includes('Emri i rruges'));
  check('...and no account ids of staff or citizens', !JSON.stringify(desk.body).includes('dk-peja') && !JSON.stringify(desk.body).includes('citizen-x'));
  check('a non-municipality is refused the desk', (await call(agent, 'GET', '/api/v1/municipality/desk')).status === 403);

  console.log('\n3. Staff answer');
  const queue = await call(owner, 'GET', '/api/v1/admin/municipality-requests?status=pending');
  check('staff see the pending requests of every municipality', queue.status === 200 && queue.body?.items?.length === 2, JSON.stringify(queue.body).slice(0, 120));
  check('a municipality cannot read that queue', (await call(peja, 'GET', '/api/v1/admin/municipality-requests')).status === 403);
  const pendingId = (queue.body?.items ?? []).find((i: any) => i.kind === 'dispute')?.id;
  const decide = (token: string, id: string, action: string, reason?: string) => call(token, 'POST', `/api/v1/admin/decisions/muniRequest/${id}`, { action, reason });
  check('a municipality cannot decide its own request', (await decide(peja, pendingId, 'accept')).status === 403);
  check('declining needs a reason', (await decide(owner, pendingId, 'decline')).status === 400);
  check('staff decline with a reason', (await decide(owner, pendingId, 'decline', 'Adresa eshte te komuna juaj sipas hartes.')).status === 200);
  const after = await call(peja, 'GET', '/api/v1/municipality/desk');
  const declined = (after.body?.requests ?? []).find((i: any) => i.id === pendingId);
  check('the municipality reads the outcome and the reason', declined?.status === 'declined' && declined?.decisionReason === 'Adresa eshte te komuna juaj sipas hartes.');

  console.log('\n4. Doing the work');
  check('Peja takes the work on, with a plan', (await call(peja, 'POST', '/api/v1/reports/dk-r1/transition', { transition: 'municipality_accept', note: 'Ekipi rrugor, brenda 3 ditesh.' })).status === 200);
  check('...status is now In Progress', (await report('dk-r1')).status === 'In Progress');
  check('Gjilan cannot touch the Peja report', (await call(gjilan, 'POST', '/api/v1/reports/dk-r1/transition', { transition: 'municipality_done' })).status === 403);
  const fact = await call(peja, 'POST', '/api/v1/municipality/work-facts', { reportId: 'dk-r1', description: 'U mbulua gropa me asfalt te ri, 4 m2.', performedBy: 'Ndermarrja e rrugeve' });
  check('Peja registers a work fact (pending verification)', fact.status === 201 && fact.body?.review === 'pending', `status ${fact.status}`);
  check('...and it shows on its desk', ((await call(peja, 'GET', '/api/v1/municipality/desk')).body?.workFacts ?? []).length === 1);
  check('Peja marks the work done', (await call(peja, 'POST', '/api/v1/reports/dk-r1/transition', { transition: 'municipality_done' })).status === 200 && (await report('dk-r1')).status === 'Resolved');

  console.log('\n5. Health cases, without the patient');
  await db.collection('healthRegistry').doc('dk-h1').set({ fullName: 'Emri Sekret Pacienti', contactPhone: '+38344111222', contactName: 'Kontakti Sekret', age: 61, gender: 'Femër', municipality: 'Pejë', neighborhood: 'Qyteti', category: 'Diabet me Komplikime', diagnosis: 'Diabet tip 2', urgency: 'Urgjente', needs: ['Insulinë'], description: 'Nevojitet insulinë.', status: 'pending', createdAt: new Date().toISOString() });
  await db.collection('healthRegistry').doc('dk-h2').set({ fullName: 'Tjeter', age: 30, municipality: 'Gjilan', category: 'Tjetër', status: 'pending' });
  const health = await call(peja, 'GET', '/api/v1/municipality/health');
  const text = JSON.stringify(health.body);
  check('Peja sees its own health case', health.status === 200 && health.body?.items?.length === 1 && health.body.items[0].diagnosis === 'Diabet tip 2', `status ${health.status}`);
  check('...with no name, phone or contact name anywhere in the response', !text.includes('Sekret') && !text.includes('+38344'));
  check('...and not Gjilan\'s case', !text.includes('Gjilan') && !text.includes('Tjeter'));
  check('a non-municipality is refused', (await call(agent, 'GET', '/api/v1/municipality/health')).status === 403);
  const verify = await call(peja, 'POST', '/api/v1/admin/decisions/health/dk-h1', { action: 'approve' });
  check('Peja verifies its own case', verify.status === 200 && (await db.collection('healthRegistry').doc('dk-h1').get()).data()?.status === 'verified', `status ${verify.status}`);
  check('Peja cannot reject a case, nor touch Gjilan\'s', (await call(peja, 'POST', '/api/v1/admin/decisions/health/dk-h1', { action: 'reject', reason: 'nuk eshte e vertete' })).status === 403
    && (await call(peja, 'POST', '/api/v1/admin/decisions/health/dk-h2', { action: 'approve' })).status === 403);
  await db.recursiveDelete(db.collection('healthRegistry').doc('dk-h1'));
  await db.recursiveDelete(db.collection('healthRegistry').doc('dk-h2'));

  await new Promise(resolve => setTimeout(resolve, 800));
  const actions = (await db.collection('auditLogs').get()).docs.map(d => d.data().action as string);
  check('requests and refusals are audited', ['municipality.request.respond', 'municipality.request.denied'].every(a => actions.includes(a)));
  const editorial = (await db.collection('editorialLog').get()).docs.map(d => d.data());
  check('the editorial log records the response and the refused delete attempt', editorial.some(e => e.kind === 'response_published') && editorial.some(e => e.kind === 'action_denied' && e.attemptedAction === 'delete_report'));

  for (const id of ['dk-r1', 'dk-r2', 'dk-r3']) await db.recursiveDelete(db.collection('reports').doc(id));
  for (const c of ['municipalityRequests', 'workFacts']) {
    for (const d of (await db.collection(c).where('municipality', 'in', ['Pejë', 'Gjilan']).get()).docs) await db.recursiveDelete(d.ref);
  }
  await Promise.all(['dk-peja', 'dk-gjilan', 'dk-owner', 'dk-agent'].map(u => Promise.all([auth.deleteUser(u).catch(() => undefined), db.collection('users').doc(u).delete()])));
  console.log(`\n${passed} passed, ${failures.length} failed.`);
  if (failures.length) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1); }
}

main().catch(error => { console.error('Check aborted:', error); process.exit(1); });

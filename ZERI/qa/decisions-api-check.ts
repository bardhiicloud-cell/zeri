/**
 * Live check of the acceptance system (POST /api/v1/admin/decisions/:kind/:id).
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

async function tokenFor(uid: string, role: string, permissions: string[] = [], municipality = '') {
  await auth.deleteUser(uid).catch(() => undefined);
  const email = `${uid}@decision-check.test`;
  await auth.createUser({ uid, email, password: PASSWORD });
  await auth.setCustomUserClaims(uid, { ...buildRoleClaims(role, permissions), ...(municipality ? { municipality } : {}) });
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
const decide = (token: string | null, kind: string, id: string, action: string, reason?: string, extra: Record<string, unknown> = {}) =>
  call(token, 'POST', `/api/v1/admin/decisions/${kind}/${id}`, { action, reason, ...extra });
const read = async (collection: string, id: string) => (await db.collection(collection).doc(id).get()).data() ?? {};

async function main() {
  const owner = await tokenFor('dec-owner', 'superadmin');
  const donationsAgent = await tokenFor('dec-agent', 'agent', ['donations']);
  const monitor = await tokenFor('dec-monitor', 'monitor');
  const muni = await tokenFor('dec-muni', 'municipality', [], 'Pejë');

  await db.collection('donationCauses').doc('dec-d1').set({ title: 'D', status: 'pending', createdAt: new Date().toISOString() });
  await db.collection('healthRegistry').doc('dec-h1').set({ fullName: 'X', status: 'pending', municipality: 'Pejë' });
  await db.collection('healthRegistry').doc('dec-h2').set({ fullName: 'Y', status: 'pending', municipality: 'Gjilan' });
  await db.collection('newsArticles').doc('dec-n1').set({ title: 'N', summary: 's', content: 'c', category: 'Lajme', published: false, status: 'Draft' });
  await db.collection('adRequests').doc('dec-a1').set({ businessName: 'B', status: 'pending' });
  await db.collection('forumPosts').doc('dec-f1').set({ content: 'post', authorId: 'someone' });

  console.log('1. Who may decide');
  check('no token -> 401', (await decide(null, 'donation', 'dec-d1', 'approve')).status === 401);
  check('a monitor cannot decide', (await decide(monitor, 'donation', 'dec-d1', 'approve')).status === 403);
  check('an agent without the ads grant cannot decide an ad request', (await decide(donationsAgent, 'adRequest', 'dec-a1', 'reject', 'Nuk ka pagesë')).status === 403);
  check('a municipality cannot decide a donation', (await decide(muni, 'donation', 'dec-d1', 'approve')).status === 403);
  check('a municipality cannot verify another municipality\'s case', (await decide(muni, 'health', 'dec-h2', 'approve')).status === 403);
  check('a municipality cannot reject even its own case', (await decide(muni, 'health', 'dec-h1', 'reject', 'Nuk është e vërtetë')).status === 403);
  check('unknown kind -> 400', (await decide(owner, 'poll', 'x', 'approve')).status === 400);
  check('unknown record -> 404', (await decide(owner, 'donation', 'no-such', 'approve')).status === 404);
  check('...and nothing changed after the refusals', (await read('donationCauses', 'dec-d1')).status === 'pending');

  console.log('\n2. Decisions are applied, with reasons and history');
  check('an agent with the donations grant approves a donation', (await decide(donationsAgent, 'donation', 'dec-d1', 'approve')).status === 200);
  check('...the status is approved', (await read('donationCauses', 'dec-d1')).status === 'approved');
  check('approving again is refused as stale (409)', (await decide(donationsAgent, 'donation', 'dec-d1', 'approve')).status === 409);
  check('rejecting without a reason is refused', (await decide(owner, 'donation', 'dec-d1', 'reject')).status === 400);
  check('the owner rejects with a reason', (await decide(owner, 'donation', 'dec-d1', 'reject', 'Lidhja e donacionit është e rreme')).status === 200);
  const history = await call(owner, 'GET', '/api/v1/admin/decisions/donation/dec-d1');
  const items = history.body?.items ?? [];
  check('the history lists both decisions, newest first, with who and why',
    items.length === 2 && items[0].action === 'reject' && items[0].reason === 'Lidhja e donacionit është e rreme' && items[1].byName === 'Emri dec-agent',
    JSON.stringify(items.map((i: any) => i.action)));
  check('a monitor may read the history', (await call(monitor, 'GET', '/api/v1/admin/decisions/donation/dec-d1')).status === 200);
  check('the public document carries no decider or reason', !JSON.stringify(await read('donationCauses', 'dec-d1')).includes('Lidhja'));

  console.log('\n3. Each kind');
  check('on the basic plan a municipality cannot decide on health cases', (await decide(muni, 'health', 'dec-h1', 'approve')).status === 403);
  await db.collection('users').doc('dec-muni').update({ municipalityPlan: 'standard' });
  check('a municipality verifies its own health case', (await decide(muni, 'health', 'dec-h1', 'approve')).status === 200);
  check('...and closes it', (await decide(muni, 'health', 'dec-h1', 'resolve')).status === 200 && (await read('healthRegistry', 'dec-h1')).status === 'resolved');
  check('the owner publishes a news article', (await decide(owner, 'news', 'dec-n1', 'publish')).status === 200);
  const news = await read('newsArticles', 'dec-n1');
  check('...it is public with a publication time', news.published === true && typeof news.publishedAt === 'string' && news.status === 'Published');
  check('withdrawing needs a reason, then works', (await decide(owner, 'news', 'dec-n1', 'unpublish')).status === 400
    && (await decide(owner, 'news', 'dec-n1', 'unpublish', 'Gabim në emrin e institucionit')).status === 200
    && (await read('newsArticles', 'dec-n1')).published === false);
  check('an ad request: confirm payment, approve with the campaign, close',
    (await decide(owner, 'adRequest', 'dec-a1', 'confirmPayment')).status === 200
    && (await decide(owner, 'adRequest', 'dec-a1', 'approve', undefined, { campaignId: 'camp-1' })).status === 200
    && (await read('adRequests', 'dec-a1')).campaignId === 'camp-1'
    && (await decide(owner, 'adRequest', 'dec-a1', 'complete')).status === 200);
  check('a forum post: hide needs a reason, then approve brings it back',
    (await decide(owner, 'forum', 'dec-f1', 'hide')).status === 400
    && (await decide(owner, 'forum', 'dec-f1', 'hide', 'Gjuhë urrejtjeje')).status === 200
    && (await read('forumPosts', 'dec-f1')).isHidden === true
    && (await decide(owner, 'forum', 'dec-f1', 'approve')).status === 200
    && (await read('forumPosts', 'dec-f1')).isHidden === false);

  console.log('\n4. Two people deciding at once');
  await db.collection('donationCauses').doc('dec-d2').set({ title: 'D2', status: 'pending' });
  const [a, b] = await Promise.all([
    decide(owner, 'donation', 'dec-d2', 'approve'),
    decide(donationsAgent, 'donation', 'dec-d2', 'approve'),
  ]);
  check('exactly one succeeds, the other is told it is stale', [a.status, b.status].sort().join(',') === '200,409', `${a.status},${b.status}`);
  check('...and only one decision is recorded', (await db.collection('donationCauses').doc('dec-d2').collection('decisions').get()).size === 1);

  await new Promise(resolve => setTimeout(resolve, 800));
  const actions = (await db.collection('auditLogs').get()).docs.map(d => d.data().action as string);
  check('decisions and refusals are in the audit log', actions.includes('decision.donation.approve') && actions.includes('decision.donation.denied'));

  for (const [c, id] of [['donationCauses', 'dec-d1'], ['donationCauses', 'dec-d2'], ['healthRegistry', 'dec-h1'], ['healthRegistry', 'dec-h2'], ['newsArticles', 'dec-n1'], ['adRequests', 'dec-a1'], ['forumPosts', 'dec-f1']]) {
    await db.recursiveDelete(db.collection(c).doc(id));
  }
  await Promise.all(['dec-owner', 'dec-agent', 'dec-monitor', 'dec-muni'].map(u => Promise.all([auth.deleteUser(u).catch(() => undefined), db.collection('users').doc(u).delete()])));
  console.log(`\n${passed} passed, ${failures.length} failed.`);
  if (failures.length) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1); }
}

main().catch(error => { console.error('Check aborted:', error); process.exit(1); });

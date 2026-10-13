/**
 * End-to-end authorization check for GET /api/v1/admin/reports.
 *
 * Runs against the LOCAL emulator sandbox only (see `npm run dev:admin-prototype`):
 * it creates real accounts in the Auth emulator, signs in over REST to obtain real
 * ID tokens, and calls the running server. Nothing is mocked — the server verifies
 * the tokens, reads the claims and queries Firestore exactly as in production.
 * Expected results come from an independent oracle: the same reports read straight
 * from Firestore with the Admin SDK, and filtered here.
 *
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_PROJECT_ID=demo-zeri-admin-prototype BASE_URL=http://127.0.0.1:3010 \
 *   npx tsx qa/admin-reports-api-check.ts
 *
 * What it does NOT prove: the emulator does not enforce composite indexes, so a
 * missing index only shows up on a real project. tests/server/reportQuery.test.ts
 * checks the declared indexes against what the planner can emit.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { buildRoleClaims } from '../server/roleClaims';

const projectId = process.env.FIREBASE_PROJECT_ID ?? '';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '';
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3010';

// Refuse to run against anything that is not a local demo project.
if (!projectId.startsWith('demo-') || !authHost || !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refused: needs a demo- project and both emulator hosts. This script never touches a real project.');
  process.exit(2);
}

initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();

const PASSWORD = 'Test-Pass-12345';
const VISIBLE = ['Approved', 'Assigned', 'In Progress', 'Resolved', 'Overdue'];

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed += 1;
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${name}${ok || !detail ? '' : `  [${detail}]`}`);
}

async function makeUser(uid: string, role: string, municipality?: string) {
  await auth.deleteUser(uid).catch(() => undefined);
  const email = `${uid}@rbac-check.test`;
  await auth.createUser({ uid, email, password: PASSWORD });
  await auth.setCustomUserClaims(uid, buildRoleClaims(role, [], municipality));
  return email;
}

async function signIn(email: string): Promise<string> {
  const response = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }) }
  );
  const body: any = await response.json();
  if (!body.idToken) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(body)}`);
  return body.idToken;
}

async function api(token: string | null, query: string) {
  const response = await fetch(`${BASE}/api/v1/admin/reports${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  let body: any = null;
  try { body = await response.json(); } catch { /* non-JSON error body */ }
  return { status: response.status, body };
}

/** Walk every page with the cursor, as a client would. */
async function walk(token: string, query: string, pageSize = 7) {
  const items: any[] = [];
  let cursor: string | null = null;
  let total: number | null = null;
  let pages = 0;
  do {
    const response = await api(token, `?${query}${query ? '&' : ''}limit=${pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    if (response.status !== 200) return { status: response.status, items, total, pages, error: response.body };
    items.push(...response.body.items);
    if (pages === 0) total = response.body.total;
    cursor = response.body.nextCursor;
    pages += 1;
  } while (cursor && pages < 100);
  return { status: 200, items, total, pages, error: null };
}

const millis = (value: any) =>
  typeof value?.toMillis === 'function' ? value.toMillis() : Date.parse(String(value ?? ''));

async function main() {
  // ── Oracle ─────────────────────────────────────────────────────────────────
  const snapshot = await db.collection('reports').get();
  const all = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
  console.log(`Oracle: ${all.length} reports in the emulator.`);
  const byMunicipality = (name: string) => all.filter(r => r.location?.municipality === name);
  const municipalityNames = [...new Set(all.map(r => r.location?.municipality).filter(Boolean))] as string[];
  const mine = municipalityNames.sort((a, b) => byMunicipality(b).length - byMunicipality(a).length)[0];
  const other = municipalityNames.find(name => name !== mine)!;
  console.log(`Municipality under test: ${mine}; a different one: ${other}\n`);

  // ── Accounts ───────────────────────────────────────────────────────────────
  const emails = {
    superadmin: await makeUser('rbac-superadmin', 'superadmin'),
    agent: await makeUser('rbac-agent', 'agent'),
    municipality: await makeUser('rbac-municipality', 'municipality', mine),
    otherMunicipality: await makeUser('rbac-municipality-2', 'municipality', other),
    adsadmin: await makeUser('rbac-adsadmin', 'adsadmin'),
    citizen: await makeUser('rbac-citizen', 'citizen'),
  };
  const tokens = Object.fromEntries(await Promise.all(Object.entries(emails).map(async ([k, e]) => [k, await signIn(e)]))) as Record<keyof typeof emails, string>;

  // ── Authentication and default deny ────────────────────────────────────────
  console.log('Authentication and default deny');
  check('no token -> 401', (await api(null, '')).status === 401);
  check('garbage token -> 401', (await api('not.a.token', '')).status === 401);
  check('citizen -> 403', (await api(tokens.citizen, '')).status === 403);
  check('adsadmin (no reports section) -> 403', (await api(tokens.adsadmin, '')).status === 403);

  // ── Staff: complete, ordered, paginated ────────────────────────────────────
  console.log('\nStaff listing');
  const staff = await walk(tokens.agent, '');
  const ids = staff.items.map(i => i.id);
  check('agent sees every report across all pages', new Set(ids).size === all.length && all.every(r => ids.includes(r.id)),
    `${new Set(ids).size} of ${all.length}`);
  check('no report appears twice across pages', ids.length === new Set(ids).size);
  check('more than one page was needed (cursor exercised)', staff.pages > 1, `pages=${staff.pages}`);
  check('first-page total matches the database', staff.total === all.length, `total=${staff.total}`);
  const times = staff.items.map(i => millis(i.createdAt));
  check('newest first', times.every((t, i) => i === 0 || times[i - 1] >= t));
  check('agent still sees the reporter (staff need it)', staff.items.some(i => 'authorId' in i));

  const pending = await walk(tokens.superadmin, 'status=unapproved');
  const pendingOracle = all.filter(r => r.status === 'Pending Review');
  check('status tab "unapproved" matches', pending.items.length === pendingOracle.length && pending.total === pendingOracle.length);
  const inMunicipality = await walk(tokens.superadmin, `municipality=${encodeURIComponent(other)}&status=in-progress`);
  const inOracle = byMunicipality(other).filter(r => ['Approved', 'Assigned', 'In Progress'].includes(r.status));
  check('municipality + status filter matches', inMunicipality.items.length === inOracle.length, `${inMunicipality.items.length} vs ${inOracle.length}`);

  // ── Municipality isolation ─────────────────────────────────────────────────
  console.log('\nMunicipality isolation');
  const own = await walk(tokens.municipality, '');
  const ownOracle = byMunicipality(mine).filter(r => VISIBLE.includes(r.status));
  check('municipality sees exactly its own public-record reports', own.items.length === ownOracle.length && ownOracle.every(r => own.items.some(i => i.id === r.id)),
    `${own.items.length} vs ${ownOracle.length}`);
  check('every row is in its municipality', own.items.every(i => i.location?.municipality === mine));
  check('no pending, rejected or draft report is ever returned', own.items.every(i => VISIBLE.includes(i.status)));
  check('reporter identity is stripped', own.items.every(i => !('authorId' in i) && !('authorName' in i)));
  check('its total counts only what it may see', own.total === ownOracle.length, `total=${own.total}`);
  check('requesting another municipality -> 403', (await api(tokens.municipality, `?municipality=${encodeURIComponent(other)}`)).status === 403);
  check('requesting its own municipality explicitly works', (await api(tokens.municipality, `?municipality=${encodeURIComponent(mine)}`)).status === 200);
  const hiddenStatus = await api(tokens.municipality, '?status=unapproved');
  check('asking for pending reports returns nothing, not an error', hiddenStatus.status === 200 && hiddenStatus.body.items.length === 0 && hiddenStatus.body.total === 0);
  const rawPending = await api(tokens.municipality, '?status=Pending%20Review');
  check('raw "Pending Review" also returns nothing', rawPending.status === 200 && rawPending.body.items.length === 0);
  const otherOwn = await walk(tokens.otherMunicipality, '');
  check('a different municipality never sees the first one\'s reports', otherOwn.items.every(i => i.location?.municipality === other)
    && !otherOwn.items.some(i => own.items.some(o => o.id === i.id)));
  // Cursor forgery: try to steer a municipality's cursor into another's data.
  const forged = Buffer.from(JSON.stringify(['9999-12-31T00:00:00.000Z', 'zzz'])).toString('base64url');
  const forgedResult = await api(tokens.municipality, `?cursor=${forged}`);
  check('a forged cursor cannot widen a municipality\'s view',
    forgedResult.status !== 200 || forgedResult.body.items.every((i: any) => i.location?.municipality === mine && VISIBLE.includes(i.status)));

  // ── Input hardening ────────────────────────────────────────────────────────
  console.log('\nInput hardening');
  for (const [name, query] of [
    ['non-numeric limit', '?limit=abc'], ['zero limit', '?limit=0'], ['unknown status', '?status=DROP'],
    ['unknown urgency', '?urgency=whenever'], ['garbage cursor', '?cursor=%25%25%25'], ['oversized municipality', `?municipality=${'x'.repeat(200)}`],
  ] as const) {
    check(`${name} -> 400`, (await api(tokens.agent, query)).status === 400);
  }
  const huge = await api(tokens.agent, '?limit=100000');
  check('a huge limit is capped, not honoured', huge.status === 200 && huge.body.items.length <= 50);

  // ── Revocation: a changed role takes effect immediately ────────────────────
  console.log('\nRevocation and role change');
  await new Promise(resolve => setTimeout(resolve, 1500)); // token issue time must precede the revocation second
  check('agent token works before revocation', (await api(tokens.agent, '')).status === 200);
  await auth.revokeRefreshTokens('rbac-agent');
  await new Promise(resolve => setTimeout(resolve, 1200));
  check('the same token is refused right after revocation', (await api(tokens.agent, '')).status === 401);

  await auth.setCustomUserClaims('rbac-municipality', buildRoleClaims('citizen', []));
  await auth.revokeRefreshTokens('rbac-municipality');
  await new Promise(resolve => setTimeout(resolve, 1200));
  check('a demoted municipality\'s old token is refused', (await api(tokens.municipality, '')).status === 401);
  const fresh = await signIn(emails.municipality);
  check('after demotion a fresh sign-in is forbidden, not allowed', (await api(fresh, '')).status === 403);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await Promise.all(['rbac-superadmin', 'rbac-agent', 'rbac-municipality', 'rbac-municipality-2', 'rbac-adsadmin', 'rbac-citizen']
    .map(uid => auth.deleteUser(uid).catch(() => undefined)));

  console.log(`\n${passed} passed, ${failures.length} failed.`);
  if (failures.length) {
    console.log('Failures:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Check aborted:', error);
  process.exit(1);
});

/**
 * End-to-end check of citizen moderation and of the privilege-escalation fix.
 * Local emulator sandbox only; same rules as qa/admin-reports-api-check.ts:
 *
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_PROJECT_ID=demo-zeri-admin-prototype BASE_URL=http://127.0.0.1:3010 \
 *   npx tsx qa/user-moderation-api-check.ts
 *
 * It proves, with real tokens against the running server:
 *   1. the escalation path is closed: a citizen whose profile DOCUMENT says
 *      "superadmin" (as an admin could once write it) gets no admin access;
 *   2. a ban disables the sign-in and ends the session, not just a flag;
 *   3. who may moderate whom, including that staff cannot be moderated here.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { buildRoleClaims } from '../server/roleClaims';

const projectId = process.env.FIREBASE_PROJECT_ID ?? '';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '';
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3010';

if (!projectId.startsWith('demo-') || !authHost || !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refused: needs a demo- project and both emulator hosts. This script never touches a real project.');
  process.exit(2);
}

initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();
const PASSWORD = 'Test-Pass-12345';

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed += 1;
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${name}${ok || !detail ? '' : `  [${detail}]`}`);
}

async function makeUser(uid: string, role: string, extraDoc: Record<string, unknown> = {}) {
  await auth.deleteUser(uid).catch(() => undefined);
  const email = `${uid}@mod-check.test`;
  await auth.createUser({ uid, email, password: PASSWORD });
  if (role) await auth.setCustomUserClaims(uid, buildRoleClaims(role, []));
  await db.collection('users').doc(uid).set({ id: uid, name: uid, email, role: role || 'citizen', isBanned: false, isVerified: false, ...extraDoc });
  return email;
}

async function signIn(email: string): Promise<{ token: string | null; error?: string }> {
  const response = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }) }
  );
  const body: any = await response.json();
  return body.idToken ? { token: body.idToken } : { token: null, error: body.error?.message };
}

const call = async (token: string | null, method: string, path: string, body?: unknown) => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try { json = await response.json(); } catch { /* empty body */ }
  return { status: response.status, body: json };
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const uids = ['mod-admin', 'mod-agent', 'mod-ghost', 'mod-victim', 'mod-victim2', 'mod-staff', 'mod-municipality', 'mod-monitor'];
  const emails = {
    admin: await makeUser('mod-admin', 'admin'),
    agent: await makeUser('mod-agent', 'agent'),
    // The attack: a citizen account whose PROFILE DOCUMENT claims to be a superadmin.
    ghost: await makeUser('mod-ghost', '', { role: 'superadmin', permissions: ['users', 'settings'] }),
    victim: await makeUser('mod-victim', ''),
    victim2: await makeUser('mod-victim2', ''),
    staff: await makeUser('mod-staff', 'agent'),
    municipality: await makeUser('mod-municipality', 'municipality'),
    monitor: await makeUser('mod-monitor', 'monitor'),
  };
  const t = Object.fromEntries(await Promise.all(Object.entries(emails).map(async ([k, e]) => [k, (await signIn(e)).token!]))) as Record<keyof typeof emails, string>;

  console.log('1. The profile-role escalation path is closed');
  check('baseline: a real admin can list users', (await call(t.admin, 'GET', '/api/v1/admin/users')).status === 200);
  const ghostList = await call(t.ghost, 'GET', '/api/v1/admin/users');
  check('a citizen whose profile says "superadmin" is refused (users list)', ghostList.status === 403, `status ${ghostList.status}`);
  const ghostMod = await call(t.ghost, 'POST', '/api/v1/admin/users/mod-victim/moderate', { action: 'verify' });
  check('...and cannot moderate anyone', ghostMod.status === 403, `status ${ghostMod.status}`);
  const ghostRole = await call(t.ghost, 'PUT', '/api/v1/admin/users/mod-victim/role', { role: 'superadmin', permissions: [] });
  check('...and cannot assign roles', ghostRole.status === 403, `status ${ghostRole.status}`);
  const ghostReports = await call(t.ghost, 'GET', '/api/v1/admin/reports');
  check('...and cannot open the admin reports list', ghostReports.status === 403, `status ${ghostReports.status}`);

  console.log('\n2. Who may moderate whom');
  check('no token -> 401', (await call(null, 'POST', '/api/v1/admin/users/mod-victim/moderate', { action: 'verify' })).status === 401);
  check('an agent cannot moderate (no users section)', (await call(t.agent, 'POST', '/api/v1/admin/users/mod-victim/moderate', { action: 'verify' })).status === 403);
  check('a municipal account cannot moderate', (await call(t.municipality, 'POST', '/api/v1/admin/users/mod-victim/moderate', { action: 'verify' })).status === 403);
  check('an admin cannot moderate staff through this route', (await call(t.admin, 'POST', '/api/v1/admin/users/mod-staff/moderate', { action: 'ban', reason: 'testing the boundary' })).status === 403);
  check('an admin cannot moderate themselves', (await call(t.admin, 'POST', '/api/v1/admin/users/mod-admin/moderate', { action: 'ban', reason: 'testing the boundary' })).status === 400);
  check('an unknown action is refused', (await call(t.admin, 'POST', '/api/v1/admin/users/mod-victim/moderate', { action: 'promote' })).status === 400);
  check('a ban without a reason is refused', (await call(t.admin, 'POST', '/api/v1/admin/users/mod-victim/moderate', { action: 'ban' })).status === 400);
  check('an unknown account -> 404', (await call(t.admin, 'POST', '/api/v1/admin/users/no-such-user/moderate', { action: 'verify' })).status === 404);

  console.log('\n3. Verify and unverify');
  check('admin verifies a citizen', (await call(t.admin, 'POST', '/api/v1/admin/users/mod-victim2/moderate', { action: 'verify' })).status === 200);
  check('...and it is stored', (await db.collection('users').doc('mod-victim2').get()).data()?.isVerified === true);

  console.log('\n4. A ban ends access, it is not just a flag');
  await wait(1500);
  check('the citizen can use the API before the ban', (await call(t.victim, 'GET', '/api/v1/users/me')).status !== 401);
  const ban = await call(t.admin, 'POST', '/api/v1/admin/users/mod-victim/moderate', { action: 'ban', reason: 'Spam i përsëritur në forum' });
  check('admin bans the citizen with a reason', ban.status === 200, `status ${ban.status}`);
  await wait(1200);
  const doc = (await db.collection('users').doc('mod-victim').get()).data() ?? {};
  check('the profile records the ban, who did it and why', doc.isBanned === true && doc.bannedBy === 'mod-admin' && doc.banReason === 'Spam i përsëritur në forum');
  check('the Firebase identity is disabled', (await auth.getUser('mod-victim')).disabled === true);
  check('the old session token is refused immediately', (await call(t.victim, 'GET', '/api/v1/users/me')).status === 401);
  const relogin = await signIn(emails.victim);
  check('signing in again is impossible while banned', relogin.token === null, relogin.error);

  const unban = await call(t.admin, 'POST', '/api/v1/admin/users/mod-victim/moderate', { action: 'unban' });
  check('admin lifts the ban', unban.status === 200);
  check('the person can sign in again', (await signIn(emails.victim)).token !== null);
  const after = (await db.collection('users').doc('mod-victim').get()).data() ?? {};
  check('the ban bookkeeping is cleared', after.isBanned === false && !('banReason' in after) && !('bannedBy' in after));

  console.log('\n6. The monitor role reads and changes nothing');
  const pending = (await db.collection('reports').where('status', '==', 'Pending Review').limit(1).get()).docs[0];
  check('a monitor can list reports', (await call(t.monitor, 'GET', '/api/v1/admin/reports')).status === 200);
  check('a monitor sees pending reports (unlike a municipality)',
    ((await call(t.monitor, 'GET', '/api/v1/admin/reports?status=unapproved')).body?.items?.length ?? 0) > 0);
  const move = await call(t.monitor, 'POST', `/api/v1/reports/${pending.id}/transition`, { transition: 'claim' });
  check('a monitor cannot move a report through the pipeline', [400, 403].includes(move.status), `status ${move.status}`);
  check('...and the report is unchanged', (await db.collection('reports').doc(pending.id).get()).data()?.status === 'Pending Review');
  check('a monitor cannot moderate users', (await call(t.monitor, 'POST', '/api/v1/admin/users/mod-victim/moderate', { action: 'verify' })).status === 403);
  check('a monitor cannot assign roles', (await call(t.monitor, 'PUT', '/api/v1/admin/users/mod-victim/role', { role: 'superadmin', permissions: [] })).status === 403);
  check('a monitor cannot create staff', (await call(t.monitor, 'POST', '/api/v1/admin/users', { email: 'x@y.test', name: 'X', role: 'agent' })).status === 403);
  check('a monitor cannot list users', (await call(t.monitor, 'GET', '/api/v1/admin/users')).status === 403);
  check('an admin CAN assign the monitor role', (await call(t.admin, 'PUT', '/api/v1/admin/users/mod-agent/role', { role: 'monitor', permissions: [] })).status === 200);
  const claimsAfter = (await auth.getUser('mod-agent')).customClaims ?? {};
  check('...and the claims become monitor-only (no agent flag)', claimsAfter.role === 'monitor' && claimsAfter.monitor === true && claimsAfter.agent === undefined);

  console.log('\n7. Removing a staff account ends the sign-in, not just the profile');
  const rm = (token: string | null, uid: string, body: unknown) => call(token, 'DELETE', `/api/v1/admin/users/${uid}`, body);
  const staffMail = emails.staff;
  check('no token -> 401', (await rm(null, 'mod-staff', { reason: 'Ka lënë punën', confirmEmail: staffMail })).status === 401);
  const agentTry = await rm(t.agent, 'mod-staff', { reason: 'Ka lënë punën', confirmEmail: staffMail });
  check('an agent (whose session was ended by the role change) cannot remove anyone', [401, 403].includes(agentTry.status), `status ${agentTry.status}`);
  check('a monitor cannot remove anyone', (await rm(t.monitor, 'mod-staff', { reason: 'Ka lënë punën', confirmEmail: staffMail })).status === 403);
  check('a reason is required', (await rm(t.admin, 'mod-staff', { confirmEmail: staffMail })).status === 400);
  check('the wrong email is refused', (await rm(t.admin, 'mod-staff', { reason: 'Ka lënë punën', confirmEmail: 'other@x.test' })).status === 400);
  check('an admin cannot remove themselves', (await rm(t.admin, 'mod-admin', { reason: 'Ka lënë punën', confirmEmail: emails.admin })).status === 400);
  check('a citizen account is not removed here', (await rm(t.admin, 'mod-victim2', { reason: 'Ka lënë punën', confirmEmail: emails.victim2 })).status === 403);
  check('...and the staff account is still there after the refusals', (await db.collection('users').doc('mod-staff').get()).exists);
  const removed = await rm(t.admin, 'mod-staff', { reason: 'Ka lënë punën', confirmEmail: staffMail.toUpperCase() });
  check('an admin removes the agent with reason and typed email', removed.status === 200, `status ${removed.status}`);
  check('the profile is gone', !(await db.collection('users').doc('mod-staff').get()).exists);
  check('the Firebase identity is gone', await auth.getUser('mod-staff').then(() => false, () => true));
  check('the old token no longer works', [401, 403].includes((await call(t.staff, 'GET', '/api/v1/admin/reports')).status));
  check('signing in again is impossible', (await signIn(staffMail)).token === null);
  check('removing an unknown account -> 404', (await rm(t.admin, 'mod-staff', { reason: 'Ka lënë punën', confirmEmail: staffMail })).status === 404);

  console.log('\n5. The attempts are in the audit log');
  await wait(800);
  const audit = await db.collection('auditLogs').get();
  const actions = audit.docs.map(d => d.data().action as string);
  check('bans are audited', actions.includes('admin.user.ban'));
  check('lifting a ban is audited', actions.includes('admin.user.unban'));
  check('refused attempts are audited', actions.includes('admin.user.moderate.denied'));
  check('removals are audited, and so are refused removals', actions.includes('admin.staff.remove') && actions.includes('admin.staff.remove.denied'));

  await Promise.all(uids.map(uid => Promise.all([auth.deleteUser(uid).catch(() => undefined), db.collection('users').doc(uid).delete()])));
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

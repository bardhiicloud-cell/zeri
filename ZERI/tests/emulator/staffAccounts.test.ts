import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { createStaffAccount, parseStaffInput } from '../../server/staffAccounts';
import { invalidatePool, loadPool } from '../../server/reportWorkflow';

/**
 * Agent creation against the Auth and Firestore emulators: the account exists, signs
 * in with its password, carries the right role claim, has its profile and worker
 * profile, and appears in the assignment pool. Failures leave nothing behind.
 * Run with: npm run test:workflow
 */
let db: Firestore;
let auth: Auth;
const ADMIN = { uid: 'owner', role: 'superadmin' };

const signIn = async (email: string, password: string) => {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const response = await fetch(`http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await response.json() as { idToken?: string; error?: { message: string } };
  return { ok: response.ok, body };
};
const claimsOf = (idToken: string) => JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));

const create = (body: Record<string, unknown>, actor = ADMIN) => {
  const parsed = parseStaffInput(body);
  if (parsed.ok === false) return Promise.resolve({ ok: false as const, status: parsed.status, error: parsed.error });
  return createStaffAccount({ db, auth }, actor, parsed.value);
};

beforeAll(() => {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run through `npm run test:workflow` (Auth + Firestore emulators).');
  const app = getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-workflow' });
  db = getFirestore(app);
  auth = getAuth(app);
});

beforeEach(async () => {
  const list = await auth.listUsers(1000);
  if (list.users.length) await auth.deleteUsers(list.users.map(u => u.uid));
  for (const name of ['users', 'workerProfiles', 'reportTasks']) {
    for (const ref of await db.collection(name).listDocuments()) await db.recursiveDelete(ref);
  }
  invalidatePool();
});

describe('creating an agent', () => {
  it('creates an account that signs in, with the role, scope and worker profile, and is assignable', async () => {
    const result = await create({
      name: 'Drita Agjentja', email: 'Drita@Example.test', role: 'agent', password: 'Sekret123',
      permissions: ['reports'], municipality: 'Prishtinë', department: 'Infrastrukturë', skills: ['infrastruktur'], capacity: 6,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canSignIn).toBe(true);

    const login = await signIn('drita@example.test', 'Sekret123');
    expect(login.ok).toBe(true);
    const claims = claimsOf(login.body.idToken!);
    expect(claims.role).toBe('agent');
    expect(claims.agent).toBe(true);
    expect(claims.perm_reports).toBe(true);

    const profile = (await db.collection('users').doc(result.uid).get()).data()!;
    expect(profile).toMatchObject({ role: 'agent', email: 'drita@example.test', municipality: 'Prishtinë', department: 'Infrastrukturë' });
    expect(JSON.stringify(profile)).not.toContain('Sekret123');
    const worker = (await db.collection('workerProfiles').doc(result.uid).get()).data()!;
    expect(worker).toMatchObject({ role: 'agent', capacity: 6, skills: ['infrastruktur'], municipality: 'Prishtinë' });

    const pool = await loadPool(db, auth);
    expect(pool.candidates.map(c => c.uid)).toContain(result.uid);
  });

  it('"manager" creates the dispatcher role, which can sign in and assign', async () => {
    const result = await create({ name: 'Menaxheri', email: 'menaxher@example.test', role: 'manager', password: 'Menaxher1' });
    expect(result).toMatchObject({ ok: true, role: 'dispatcher' });
    const login = await signIn('menaxher@example.test', 'Menaxher1');
    expect(claimsOf(login.body.idToken!).role).toBe('dispatcher');
    invalidatePool();
    const pool = await loadPool(db, auth);
    expect(pool.managerUids).toContain((result as { uid: string }).uid);
  });

  it('a duplicate email is a clear 409 and does not touch the existing account', async () => {
    const first = await create({ name: 'A', email: 'dup@example.test', role: 'agent', password: 'Passw0rd1' });
    expect(first.ok).toBe(true);
    const second = await create({ name: 'B', email: 'dup@example.test', role: 'monitor', password: 'Passw0rd2' });
    expect(second).toMatchObject({ ok: false, status: 409 });
    expect((await signIn('dup@example.test', 'Passw0rd1')).ok).toBe(true);
    expect((await db.collection('users').get()).size).toBe(1);
  });

  it('validation failures create nothing', async () => {
    expect(await create({ name: 'X', email: 'x@example.test', role: 'agent', password: 'short' })).toMatchObject({ ok: false, status: 400 });
    expect(await create({ name: 'X', email: 'not-an-email', role: 'agent' })).toMatchObject({ ok: false, status: 400 });
    expect(await create({ name: 'X', email: 'x@example.test', role: 'superadmin' })).toMatchObject({ ok: false, status: 400 });
    expect(await create({ name: 'X', email: 'x@example.test', role: 'municipality' })).toMatchObject({ ok: false, status: 400 });
    expect((await auth.listUsers()).users.length).toBe(0);
  });

  it('only an administrator may create staff', async () => {
    const res = await create({ name: 'X', email: 'y@example.test', role: 'agent', password: 'Passw0rd1' }, { uid: 'disp', role: 'dispatcher' });
    expect(res).toMatchObject({ ok: false, status: 403 });
    expect((await auth.listUsers()).users.length).toBe(0);
  });

  it('a suspended account is created disabled and cannot sign in', async () => {
    const res = await create({ name: 'Z', email: 'z@example.test', role: 'agent', password: 'Passw0rd1', isBanned: true });
    expect(res).toMatchObject({ ok: true, canSignIn: false });
    expect((await signIn('z@example.test', 'Passw0rd1')).ok).toBe(false);
  });
});

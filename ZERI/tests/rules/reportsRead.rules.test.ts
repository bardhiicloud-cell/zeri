import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore';
import { applyReportsLockdown } from '../../scripts/reportsLockdownRules';

/**
 * Who may read `reports` once the lockdown is applied (scripts/reportsLockdownRules.ts).
 * Run with: npm run test:rules (needs Java 21).
 */
let env: RulesTestEnvironment;

beforeAll(async () => {
  const live = readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-zeri-rules', firestore: { rules: applyReportsLockdown(live) } });
});
afterAll(async () => { await env?.cleanup(); });

const REPORT = (patch: Record<string, unknown> = {}) => ({
  authorId: 'author', authorName: 'Filan', title: 't', description: 'd', category: 'c', status: 'Approved',
  location: { municipality: 'Pejë', lat: 1, lng: 2 }, assignedToUid: 'ana', internalNote: 'private', createdAt: new Date('2026-01-01'),
  ...patch,
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'reports', 'approved'), REPORT());
    await setDoc(doc(db, 'reports', 'pending'), REPORT({ status: 'Pending Review' }));
    await setDoc(doc(db, 'reports', 'gjakove'), REPORT({ location: { municipality: 'Gjakovë', lat: 1, lng: 2 } }));
    await setDoc(doc(db, 'reports', 'mine-pending'), REPORT({ authorId: 'citizen', status: 'Pending Review' }));
    await setDoc(doc(db, 'users', 'banned'), { isBanned: false });
  });
});

const signedIn = (uid: string, claims: Record<string, unknown> = {}) => env.authenticatedContext(uid, claims).firestore();
const guest = (uid = 'guest1') => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();

describe('reports read, after the lockdown', () => {
  it('an unauthenticated visitor reads nothing: not a document, not the collection', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'reports', 'approved')));
    await assertFails(getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100))));
  });

  it('a guest or another citizen cannot read other people\'s reports, by id or by listing', async () => {
    for (const db of [guest(), signedIn('citizen')]) {
      await assertFails(getDoc(doc(db, 'reports', 'approved')));
      await assertFails(getDoc(doc(db, 'reports', 'pending')));
      await assertFails(getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100))));
      await assertFails(getDocs(query(collection(db, 'reports'), where('authorId', '==', 'author'))));
      await assertFails(getDocs(query(collection(db, 'reports'), where('status', '==', 'Approved'))));
    }
  });

  it('a citizen reads their own report, in any status, and lists only their own', async () => {
    const db = signedIn('citizen');
    await assertSucceeds(getDoc(doc(db, 'reports', 'mine-pending')));
    await assertSucceeds(getDocs(query(collection(db, 'reports'), where('authorId', '==', 'citizen'), orderBy('createdAt', 'desc'), limit(50))));
  });

  it('an anonymous guest reads their own report', async () => {
    await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'reports', 'guest-own'), REPORT({ authorId: 'guest1' })); });
    await assertSucceeds(getDoc(doc(guest('guest1'), 'reports', 'guest-own')));
  });

  it.each(['admin', 'superadmin', 'approver', 'agent', 'monitor', 'newsadmin', 'adsadmin'])('%s (token flag) reads every report and lists the collection', async flag => {
    const db = signedIn('staff', { [flag]: true });
    await assertSucceeds(getDoc(doc(db, 'reports', 'pending')));
    await assertSucceeds(getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100))));
  });

  it('a role string without the flag the rules test is not enough (claims are what count)', async () => {
    await assertFails(getDoc(doc(signedIn('x', { role: 'agent' }), 'reports', 'pending')));
  });

  it('a municipality reads its own accepted reports only', async () => {
    const db = signedIn('mayor', { role: 'municipality', municipality_account: true, municipality: 'Pejë' });
    await assertSucceeds(getDoc(doc(db, 'reports', 'approved')));
    await assertFails(getDoc(doc(db, 'reports', 'pending')));
    await assertFails(getDoc(doc(db, 'reports', 'gjakove')));
    await assertFails(getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100))));
    await assertSucceeds(getDocs(query(collection(db, 'reports'), where('location.municipality', '==', 'Pejë'), where('status', 'in', ['Approved', 'Assigned', 'In Progress', 'Resolved', 'Overdue']))));
  });

  it('a municipality claim without a municipality name reads nothing', async () => {
    await assertFails(getDoc(doc(signedIn('mayor2', { municipality_account: true }), 'reports', 'approved')));
  });

  it('a debate admin or moderator-only token (no reports flag) reads nothing', async () => {
    await assertFails(getDoc(doc(signedIn('d', { debatwp: true }), 'reports', 'approved')));
  });
});

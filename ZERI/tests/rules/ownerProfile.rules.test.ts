import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';

/**
 * The owner's profile (flag `isPlatformOwner`, written by scripts/make-owner.ts) changes only by the owner;
 * an admin or superadmin profile is deleted only by the owner; ordinary profiles behave as before.
 * Run with: npm run test:rules
 */
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-zeri-rules',
    firestore: { rules: readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'owner'), { id: 'owner', name: 'Pronari', role: 'superadmin', isPlatformOwner: true });
    await setDoc(doc(db, 'users', 'sa2'), { id: 'sa2', name: 'Superadmin tjetër', role: 'superadmin' });
    await setDoc(doc(db, 'users', 'adm'), { id: 'adm', name: 'Admin', role: 'admin' });
    await setDoc(doc(db, 'users', 'agent1'), { id: 'agent1', name: 'Agjent', role: 'agent' });
    await setDoc(doc(db, 'users', 'cit'), { id: 'cit', name: 'Qytetar', role: 'citizen' });
  });
});

const owner = () => env.authenticatedContext('owner', { role: 'superadmin', admin: true, superadmin: true, owner: true }).firestore();
const superadmin = () => env.authenticatedContext('sa2', { role: 'superadmin', admin: true, superadmin: true }).firestore();
const admin = () => env.authenticatedContext('adm', { role: 'admin', admin: true }).firestore();
const stranger = () => env.authenticatedContext('cit', { role: 'citizen' }).firestore();
/** A token that carries the owner flag but no superadmin claim is not an owner. */
const fakeOwner = () => env.authenticatedContext('adm', { role: 'admin', admin: true, owner: true }).firestore();

describe('the owner’s profile', () => {
  it('is changed by the owner, never by an admin or another superadmin', async () => {
    await assertSucceeds(updateDoc(doc(owner(), 'users', 'owner'), { name: 'Bardh' }));
    await assertFails(updateDoc(doc(superadmin(), 'users', 'owner'), { name: 'Tjetër' }));
    await assertFails(updateDoc(doc(admin(), 'users', 'owner'), { name: 'Tjetër' }));
    await assertFails(updateDoc(doc(stranger(), 'users', 'owner'), { name: 'Tjetër' }));
    await assertFails(updateDoc(doc(fakeOwner(), 'users', 'owner'), { name: 'Tjetër' }));
  });

  it('is deleted by nobody from the client, the owner included', async () => {
    for (const db of [owner(), superadmin(), admin(), stranger()]) {
      await assertFails(deleteDoc(doc(db, 'users', 'owner')));
    }
  });

  it('cannot be flagged onto another profile by its holder', async () => {
    await assertFails(updateDoc(doc(stranger(), 'users', 'cit'), { isPlatformOwner: true }));
  });
});

describe('other profiles', () => {
  it('lets only the owner delete an admin or a superadmin profile', async () => {
    await assertFails(deleteDoc(doc(superadmin(), 'users', 'adm')));
    await assertFails(deleteDoc(doc(admin(), 'users', 'sa2')));
    await assertFails(deleteDoc(doc(fakeOwner(), 'users', 'sa2')));
    await assertSucceeds(deleteDoc(doc(owner(), 'users', 'sa2')));
    await assertSucceeds(deleteDoc(doc(owner(), 'users', 'adm')));
  });

  it('keeps deleting ordinary profiles as before: an admin may, a citizen may not', async () => {
    await assertSucceeds(deleteDoc(doc(admin(), 'users', 'agent1')));
    await assertFails(deleteDoc(doc(stranger(), 'users', 'agent1')));
  });

  it('keeps self-service as before', async () => {
    await assertSucceeds(updateDoc(doc(stranger(), 'users', 'cit'), { name: 'Emër i ri' }));
    await assertFails(updateDoc(doc(stranger(), 'users', 'cit'), { role: 'admin' }));
  });
});

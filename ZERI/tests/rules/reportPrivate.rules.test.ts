import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

/**
 * `reportPrivate`: the name and phone a guest leaves with a report. Only staff and the
 * author read them; the client can create its own once and never edit or delete it.
 * Run with: npm run test:rules (needs Java 21).
 */
let env: RulesTestEnvironment;

beforeAll(async () => {
  const rules = readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-zeri-rules', firestore: { rules } });
});
afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'reportPrivate', 'r1'), { authorId: 'author', name: 'Filan Fisteku', phone: '+38344111222', createdAt: new Date() });
  });
});

const as = (uid: string, claims: Record<string, unknown> = {}) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' }, ...claims }).firestore();
const mine = () => ({ authorId: 'newbie', name: 'Ana', phone: '+38344000111', createdAt: serverTimestamp() });

describe('reportPrivate', () => {
  it('lets staff and the author read it, nobody else', async () => {
    await assertSucceeds(getDoc(doc(as('agent1', { agent: true }), 'reportPrivate', 'r1')));
    await assertSucceeds(getDoc(doc(as('author'), 'reportPrivate', 'r1')));
    await assertFails(getDoc(doc(as('stranger'), 'reportPrivate', 'r1')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'reportPrivate', 'r1')));
  });

  it('lets a citizen create their own contact once, with only the allowed fields', async () => {
    await assertSucceeds(setDoc(doc(as('newbie'), 'reportPrivate', 'r2'), mine()));
    await assertFails(setDoc(doc(as('newbie'), 'reportPrivate', 'r3'), { ...mine(), authorId: 'someone-else' }));
    await assertFails(setDoc(doc(as('newbie'), 'reportPrivate', 'r4'), { ...mine(), email: 'x@y.z' }));
  });

  it('is not editable or deletable from the client', async () => {
    await assertFails(updateDoc(doc(as('author'), 'reportPrivate', 'r1'), { phone: '000' }));
    await assertFails(updateDoc(doc(as('agent1', { agent: true }), 'reportPrivate', 'r1'), { phone: '000' }));
  });
});

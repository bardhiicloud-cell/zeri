import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

/**
 * Case and handover records are written and read only by the server. No client, not even
 * the person who filed the report and not even a signed-in staff token, may touch them.
 * Run with: npm run test:rules (needs Java 21).
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
    await setDoc(doc(db, 'reports', 'r1'), { authorId: 'author', status: 'Pending Review', assignedToUid: 'ana' });
    for (const sub of ['assignmentHistory', 'internalNotes', 'caseMessages']) {
      await setDoc(doc(db, 'reports', 'r1', sub, 'x1'), { text: 'internal', byUid: 'ana' });
    }
  });
});

const who: Record<string, () => ReturnType<RulesTestEnvironment['authenticatedContext']>> = {
  author: () => env.authenticatedContext('author'),
  // The rules read `admin` / `superadmin` booleans; this is the strongest token there is.
  staff: () => env.authenticatedContext('boss', { role: 'superadmin', admin: true, superadmin: true }),
  agent: () => env.authenticatedContext('ana', { role: 'agent' }),
  municipality: () => env.authenticatedContext('mayor', { role: 'municipality', municipality: 'Prishtinë' }),
};

describe.each(['assignmentHistory', 'internalNotes', 'caseMessages'])('reports/{id}/%s', sub => {
  for (const [name, ctx] of Object.entries(who)) {
    it(`${name} cannot read, list, create, edit or delete`, async () => {
      const db = ctx().firestore();
      await assertFails(getDoc(doc(db, 'reports', 'r1', sub, 'x1')));
      await assertFails(getDocs(collection(db, 'reports', 'r1', sub)));
      await assertFails(addDoc(collection(db, 'reports', 'r1', sub), { text: 'forged' }));
      await assertFails(setDoc(doc(db, 'reports', 'r1', sub, 'x1'), { text: 'rewritten history' }));
      await assertFails(deleteDoc(doc(db, 'reports', 'r1', sub, 'x1')));
    });
  }

  it('an unauthenticated visitor cannot read it', async () => {
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'reports', 'r1', sub)));
  });
});

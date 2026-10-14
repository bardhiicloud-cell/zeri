import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

/**
 * Work items are written only by the server (Admin SDK). Clients may read what their role
 * entitles them to and nothing else; none may create, edit or delete, whoever they are.
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
    await setDoc(doc(db, 'workItems', 'mine'), { kind: 'internal_task', assigneeUid: 'ana', municipality: '', status: 'in_progress' });
    await setDoc(doc(db, 'workItems', 'theirs'), { kind: 'internal_task', assigneeUid: 'blerim', municipality: '', status: 'in_progress' });
    await setDoc(doc(db, 'workItems', 'ref-pr'), { kind: 'report_referral', assigneeUid: null, municipality: 'Prishtinë', status: 'pending_acceptance' });
    await setDoc(doc(db, 'workItems', 'mod1'), { kind: 'moderation_case', assigneeUid: null, municipality: '', status: 'flagged' });
    await setDoc(doc(db, 'workItems', 'ref-pz'), { kind: 'report_referral', assigneeUid: null, municipality: 'Prizren', status: 'pending_acceptance' });
    for (const id of ['mine', 'theirs', 'ref-pr']) await setDoc(doc(db, 'workItems', id, 'events', 'e1'), { type: 'transition', note: 'internal note' });
    await setDoc(doc(db, 'workerProfiles', 'ana'), { capacity: 10, load: 2 });
    await setDoc(doc(db, 'workerProfiles', 'blerim'), { capacity: 10, load: 5 });
    await setDoc(doc(db, 'workNotifications', 'n-ana'), { toUid: 'ana', title: 'x', readAtMs: null });
    await setDoc(doc(db, 'workNotifications', 'n-mgr'), { toRole: 'manager', title: 'y', readAtMs: null });
    await setDoc(doc(db, 'workflowConfig', 'sla'), { dueHours: { urgent: 4 } });
  });
});

const ctxs = {
  visitor: () => env.unauthenticatedContext(),
  citizen: () => env.authenticatedContext('cit', { role: 'citizen' }),
  agent: () => env.authenticatedContext('ana', { role: 'agent', agent: true }),
  dispatcher: () => env.authenticatedContext('disp', { role: 'dispatcher', agent: true }),
  admin: () => env.authenticatedContext('boss', { role: 'admin', admin: true }),
  monitor: () => env.authenticatedContext('mon', { role: 'monitor', monitor: true }),
  debatwp: () => env.authenticatedContext('debate', { role: 'debatwp', debatwp: true }),
  muniPr: () => env.authenticatedContext('mayor', { role: 'municipality', municipality_account: true, municipality: 'Prishtinë' }),
};

describe('workItems reads', () => {
  it('supervisors read every item and its event history', async () => {
    for (const who of ['admin', 'dispatcher', 'monitor'] as const) {
      const db = ctxs[who]().firestore();
      await assertSucceeds(getDoc(doc(db, 'workItems', 'theirs')));
      await assertSucceeds(getDocs(collection(db, 'workItems', 'theirs', 'events')));
    }
  });

  it('an agent reads only the items assigned to them', async () => {
    const db = ctxs.agent().firestore();
    await assertSucceeds(getDoc(doc(db, 'workItems', 'mine')));
    await assertSucceeds(getDocs(collection(db, 'workItems', 'mine', 'events')));
    await assertFails(getDoc(doc(db, 'workItems', 'theirs')));
    await assertFails(getDocs(collection(db, 'workItems', 'theirs', 'events')));
    await assertSucceeds(getDocs(query(collection(db, 'workItems'), where('assigneeUid', '==', 'ana'))));
    await assertFails(getDocs(collection(db, 'workItems')));
  });

  it('a municipality reads its own referrals, never another municipality\'s, never the history', async () => {
    const db = ctxs.muniPr().firestore();
    await assertSucceeds(getDoc(doc(db, 'workItems', 'ref-pr')));
    await assertFails(getDoc(doc(db, 'workItems', 'ref-pz')));
    await assertFails(getDoc(doc(db, 'workItems', 'mine')));
    await assertFails(getDocs(collection(db, 'workItems', 'ref-pr', 'events')));
  });

  it('citizens and visitors read nothing', async () => {
    for (const who of ['citizen', 'visitor'] as const) {
      const db = ctxs[who]().firestore();
      await assertFails(getDoc(doc(db, 'workItems', 'mine')));
      await assertFails(getDoc(doc(db, 'workerProfiles', 'ana')));
      await assertFails(getDoc(doc(db, 'workNotifications', 'n-ana')));
      await assertFails(getDoc(doc(db, 'workflowConfig', 'sla')));
    }
  });
});

describe('debate moderators', () => {
  it('read moderation cases only', async () => {
    const db = ctxs.debatwp().firestore();
    await assertSucceeds(getDoc(doc(db, 'workItems', 'mod1')));
    await assertFails(getDoc(doc(db, 'workItems', 'theirs')));
    await assertFails(getDoc(doc(db, 'workItems', 'ref-pr')));
    await assertFails(getDocs(collection(db, 'workItems', 'mod1', 'events')));
  });
});

describe('workItems writes', () => {
  for (const [name, make] of Object.entries(ctxs)) {
    it(`${name} cannot create, edit, delete or forge history`, async () => {
      const db = make().firestore();
      await assertFails(setDoc(doc(db, 'workItems', 'forged'), { kind: 'internal_task', assigneeUid: 'ana', status: 'done' }));
      await assertFails(updateDoc(doc(db, 'workItems', 'mine'), { status: 'done', assigneeUid: 'ana' }));
      await assertFails(deleteDoc(doc(db, 'workItems', 'mine')));
      await assertFails(setDoc(doc(db, 'workItems', 'mine', 'events', 'e2'), { type: 'transition' }));
      await assertFails(updateDoc(doc(db, 'workItems', 'mine', 'events', 'e1'), { note: 'rewritten' }));
      await assertFails(setDoc(doc(db, 'workflowConfig', 'sla'), { dueHours: { urgent: 9999 } }));
      await assertFails(updateDoc(doc(db, 'workerProfiles', 'ana'), { capacity: 9999 }));
    });
  }
});

describe('workerProfiles', () => {
  it('a worker reads their own profile, not a colleague\'s; supervisors read all', async () => {
    const agent = ctxs.agent().firestore();
    await assertSucceeds(getDoc(doc(agent, 'workerProfiles', 'ana')));
    await assertFails(getDoc(doc(agent, 'workerProfiles', 'blerim')));
    await assertSucceeds(getDoc(doc(ctxs.admin().firestore(), 'workerProfiles', 'blerim')));
  });
});

describe('workNotifications', () => {
  it('a recipient reads theirs and may only mark it read', async () => {
    const db = ctxs.agent().firestore();
    await assertSucceeds(getDoc(doc(db, 'workNotifications', 'n-ana')));
    await assertFails(getDoc(doc(db, 'workNotifications', 'n-mgr')));
    await assertSucceeds(updateDoc(doc(db, 'workNotifications', 'n-ana'), { readAtMs: 123 }));
    await assertFails(updateDoc(doc(db, 'workNotifications', 'n-ana'), { toUid: 'someone', readAtMs: 124 }));
    await assertFails(updateDoc(doc(db, 'workNotifications', 'n-ana'), { title: 'tampered' }));
    await assertFails(deleteDoc(doc(db, 'workNotifications', 'n-ana')));
  });

  it('manager notifications go to managers, not to agents or the monitor', async () => {
    await assertSucceeds(getDoc(doc(ctxs.admin().firestore(), 'workNotifications', 'n-mgr')));
    await assertSucceeds(getDoc(doc(ctxs.dispatcher().firestore(), 'workNotifications', 'n-mgr')));
    await assertFails(getDoc(doc(ctxs.agent().firestore(), 'workNotifications', 'n-mgr')));
    await assertFails(getDoc(doc(ctxs.monitor().firestore(), 'workNotifications', 'n-mgr')));
  });
});

describe('moderationEvidence', () => {
  it('no client, not even the owner, reads or writes the evidence of a removed post', async () => {
    await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'moderationEvidence', 'p1'), { post: { content: 'x' } }); });
    for (const who of ['admin', 'debatwp', 'agent', 'citizen'] as const) {
      const db = ctxs[who]().firestore();
      await assertFails(getDoc(doc(db, 'moderationEvidence', 'p1')));
      await assertFails(setDoc(doc(db, 'moderationEvidence', 'p1'), { post: { content: 'rewritten' } }));
      await assertFails(deleteDoc(doc(db, 'moderationEvidence', 'p1')));
    }
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  CONFIG, NOTIFICATIONS, PROFILES, WORK, applyWorkTransition, assignPending, autoAssign, createWorkItem, recomputeLoad, runEscalations, upsertProfile, validateCreate,
  type CreateValue, type Named, type ProfileDoc, type WorkItemDoc,
} from '../../server/workItems';

/**
 * The work-item core against the Firestore emulator: the transaction that changes an
 * item, the person's load, the history and the notifications must land together; two
 * simultaneous requests must not overfill anyone; escalation must be idempotent.
 * Run with: npm run test:rules (or the emulator command in docs).
 */
let db: Firestore;
const NOW = Date.UTC(2026, 9, 14, 9, 0, 0); // Wednesday 11:00 in Pristina
const H = 3_600_000;

const manager: Named = { uid: 'boss', role: 'admin', name: 'Menaxheri' };
const dispatcher: Named = { uid: 'disp', role: 'dispatcher', name: 'Dispatcheri' };
const agent = (uid: string): Named => ({ uid, role: 'agent', name: uid });

const wipe = async () => {
  for (const name of [WORK, PROFILES, NOTIFICATIONS, CONFIG]) for (const ref of await db.collection(name).listDocuments()) await db.recursiveDelete(ref);
};

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through the emulator.');
  db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-workflow' }));
});
afterAll(async () => { await wipe(); });
beforeEach(wipe);

async function worker(uid: string, over: Partial<ProfileDoc> = {}) {
  await upsertProfile(db, uid, { name: uid, role: 'agent', municipality: '', ...over }, NOW);
  const patch: Record<string, unknown> = {};
  for (const key of ['capacity', 'availability', 'skills', 'department', 'schedule', 'disabled'] as const) if (key in over) patch[key] = over[key];
  if (Object.keys(patch).length) await db.collection(PROFILES).doc(uid).update(patch);
}

const value = (over: Partial<CreateValue> = {}): CreateValue => {
  const checked = validateCreate({ kind: 'internal_task', title: 'Kontrollo urën', priority: 'normal', ...over });
  if (checked.outcome === 'invalid') throw new Error(checked.error);
  return checked.value;
};

const profile = async (uid: string) => (await db.collection(PROFILES).doc(uid).get()).data() as ProfileDoc;
const item = async (id: string) => (await db.collection(WORK).doc(id).get()).data() as WorkItemDoc;
const events = async (id: string) => (await db.collection(WORK).doc(id).collection('events').orderBy('atMs').get()).docs.map(doc => ({ id: doc.id, ...doc.data() })) as Array<Record<string, any>>;
const notifications = async () => (await db.collection(NOTIFICATIONS).get()).docs.map(doc => doc.data());

const make = async (over: Partial<CreateValue> = {}, at = NOW) => (await createWorkItem(db, manager, value(over), at)).id;
const act = (itemId: string, actor: Named, request: Record<string, unknown>, nowMs = NOW + 1000) => applyWorkTransition(db, { itemId, actor, request: request as any, nowMs });

describe('creating', () => {
  it('starts in the first state, with a deadline from the priority and a first history entry', async () => {
    const id = await make({ priority: 'urgent' });
    const doc = await item(id);
    expect(doc).toMatchObject({ status: 'unassigned', open: true, assigneeUid: null, version: 1 });
    expect(doc.dueAtMs).toBe(NOW + 4 * H);
    expect((await events(id)).map(event => event.type)).toEqual(['created']);
  });

  it('creates one item however many times, or at once, the same event arrives', async () => {
    const key = { dedupeKey: 'report:r1:institution:peja', kind: 'report_referral' as const, municipality: 'Pejë' };
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => createWorkItem(db, manager, value(key), NOW)));
    expect(new Set(results.map(result => result.id)).size).toBe(1);
    expect(results.filter(result => result.created)).toHaveLength(1);
    expect((await db.collection(WORK).get()).size).toBe(1);
  });
});

describe('automatic assignment', () => {
  it('gives the item to the best eligible person and records load, history and a notification', async () => {
    await worker('ana', { capacity: 5 });
    await worker('off', { availability: 'off' });
    const id = await make();
    const result = await autoAssign(db, id, NOW);
    expect(result).toMatchObject({ outcome: 'assigned', uid: 'ana' });
    expect(await item(id)).toMatchObject({ status: 'assigned', assigneeUid: 'ana', version: 2 });
    expect(await profile('ana')).toMatchObject({ load: 1, activeCount: 1 });
    const log = await events(id);
    expect(log.map(event => event.type).sort()).toEqual(['created', 'transition']); // same millisecond: no defined order
    expect(log.find(event => event.type === 'transition')).toMatchObject({ action: 'assign', auto: true, toAssignee: 'ana', actorUid: 'system' });
    expect((await notifications()).filter(note => note.toUid === 'ana')).toHaveLength(1);
  });

  it('leaves the item unassigned and tells the supervisors when nobody qualifies, once per hour', async () => {
    await worker('nogis', { skills: [] });
    const id = await make({ requiredSkills: ['gis'] });
    expect(await autoAssign(db, id, NOW)).toMatchObject({ outcome: 'unassigned', rejectedBy: { skill: 1 } });
    expect(await autoAssign(db, id, NOW + 60_000)).toMatchObject({ outcome: 'unassigned' });
    expect(await item(id)).toMatchObject({ status: 'unassigned', assigneeUid: null, needsAttention: true });
    expect((await events(id)).filter(event => event.type === 'no_eligible_worker')).toHaveLength(1);
    expect((await notifications()).filter(note => note.toRole === 'manager' && note.action === 'no_eligible_worker')).toHaveLength(1);
    expect(await profile('nogis')).toMatchObject({ load: 0 });
  });

  it('never assigns to an unauthorised or unsuitable person even when it is the only one', async () => {
    await worker('citizenish', { role: 'citizen' });
    await worker('gone', { disabled: true });
    await worker('away', { availability: 'away' });
    await worker('full', { capacity: 1 });
    await db.collection(PROFILES).doc('full').update({ load: 1, activeCount: 1 });
    const id = await make();
    expect((await autoAssign(db, id, NOW)).outcome).toBe('unassigned');
  });

  it('two requests racing for the last free place: exactly one wins', async () => {
    await worker('solo', { capacity: 1 });
    const ids = await Promise.all([make(), make()]);
    const results = await Promise.all(ids.map(id => autoAssign(db, id, NOW)));
    expect(results.filter(result => result.outcome === 'assigned')).toHaveLength(1);
    expect(results.filter(result => result.outcome === 'unassigned')).toHaveLength(1);
    expect(await profile('solo')).toMatchObject({ load: 1, activeCount: 1 });
  });

  it('a burst of 60 items at 12 workers (36 places): nobody exceeds capacity, nothing is assigned twice', async () => {
    for (let i = 0; i < 12; i += 1) await worker(`w${String(i).padStart(2, '0')}`, { capacity: 3 });
    const ids: string[] = [];
    for (let i = 0; i < 60; i += 1) ids.push(await make({ title: `Detyra ${i}` }));

    const results: Array<{ outcome: string }> = [];
    for (let start = 0; start < ids.length; start += 20) {
      results.push(...await Promise.all(ids.slice(start, start + 20).map(id => autoAssign(db, id, NOW))));
    }
    // Under heavy load a request may lose its race more often than it retries and report `contention`: it is
    // left unassigned, never forced. What must hold either way is below; then the sweep picks up the rest.
    expect(results.every(result => ['assigned', 'unassigned', 'contention'].includes(result.outcome))).toBe(true);
    for (let round = 0; round < 6; round += 1) {
      if ((await db.collection(WORK).where('assigneeUid', '!=', null).get()).size === 36) break;
      await assignPending(db, NOW, 100);
    }

    for (let i = 0; i < 12; i += 1) {
      const uid = `w${String(i).padStart(2, '0')}`;
      const stored = await profile(uid);
      expect(stored.load, uid).toBeLessThanOrEqual(3);
      const actual = await recomputeLoad(db, uid, NOW);
      expect({ load: stored.load, activeCount: stored.activeCount }, `${uid} counter matches the work held`).toEqual(actual);
    }
    const held = (await db.collection(WORK).where('assigneeUid', '!=', null).get()).size;
    expect(held).toBe(36);
  }, 180_000);

  it('twelve simultaneous requests for one item: one assigns, the rest return quickly without a retry storm', async () => {
    await worker('ana'); await worker('blerim');
    const id = await make();
    const started = Date.now();
    const results = await Promise.all(Array.from({ length: 12 }, () => autoAssign(db, id, NOW)));
    expect(results.filter(result => result.outcome === 'assigned')).toHaveLength(1);
    expect(results.filter(result => result.outcome === 'not_applicable')).toHaveLength(11);
    expect(Date.now() - started).toBeLessThan(2500);
    expect((await events(id)).filter(event => event.action === 'assign')).toHaveLength(1);
    const total = (await profile('ana')).load + (await profile('blerim')).load;
    expect(total).toBe(1);
  });

  it('the sweep offers waiting work again when a place frees up, oldest first, and leaves manual items alone', async () => {
    await worker('solo', { capacity: 1 });
    const first = await make({ title: 'E para' });
    const second = await make({ title: 'E dyta' });
    const manual = (await createWorkItem(db, manager, value({ title: 'Caktim me dorë', autoAssign: false } as any), NOW)).id;
    expect((await autoAssign(db, first, NOW)).outcome).toBe('assigned');
    expect(await assignPending(db, NOW + 1)).toMatchObject({ assigned: 0 }); // still full
    for (const request of [{ action: 'accept' }, { action: 'start' }, { action: 'complete', note: 'U krye.' }]) await act(first, agent('solo'), request);
    expect(await assignPending(db, NOW + 2)).toMatchObject({ tried: 1, assigned: 1 });
    expect((await item(second)).assigneeUid).toBe('solo');
    expect((await item(manual)).assigneeUid).toBeNull();
    expect((await item(manual)).autoAssign).toBe(false);
  });

  it('does nothing to an item that already has an owner', async () => {
    await worker('ana');
    const id = await make();
    await autoAssign(db, id, NOW);
    expect(await autoAssign(db, id, NOW + 1)).toMatchObject({ outcome: 'not_applicable' });
    expect(await profile('ana')).toMatchObject({ load: 1 });
  });
});

describe('the lifecycle of a task', () => {
  it('runs from assignment to approved completion, and the load follows', async () => {
    await worker('ana', { capacity: 5 });
    const id = await make({ requiresReview: true, weight: 2 });
    expect((await act(id, manager, { action: 'assign', assigneeUid: 'ana' })).outcome).toBe('ok');
    expect(await profile('ana')).toMatchObject({ load: 2, activeCount: 1 });

    expect((await act(id, agent('ana'), { action: 'accept' })).outcome).toBe('ok');
    expect((await act(id, agent('ana'), { action: 'start' })).outcome).toBe('ok');
    expect((await act(id, agent('ana'), { action: 'complete', note: 'Mbyllur' }))).toMatchObject({ outcome: 'fail', code: 'REVIEW_REQUIRED' });
    expect((await act(id, agent('ana'), { action: 'submit', note: 'U kontrollua, shih foto.' })).outcome).toBe('ok');
    expect(await profile('ana')).toMatchObject({ load: 2 }); // still held while in review
    expect((await act(id, manager, { action: 'approve', note: 'Në rregull.' })).outcome).toBe('ok');

    expect(await item(id)).toMatchObject({ status: 'done', open: false, version: 6 });
    expect((await item(id)).doneAtMs).not.toBeNull();
    expect(await profile('ana')).toMatchObject({ load: 0, activeCount: 0 });
    // Steps made in the same millisecond have no defined order; the set is what matters.
    expect((await events(id)).map(event => event.action ?? event.type).sort()).toEqual(['accept', 'approve', 'assign', 'created', 'start', 'submit']);
  });

  it('refuses the wrong person without writing anything', async () => {
    await worker('ana'); await worker('blerim');
    const id = await make();
    await act(id, manager, { action: 'assign', assigneeUid: 'ana' });
    const before = await item(id);
    expect(await act(id, agent('blerim'), { action: 'accept' })).toMatchObject({ outcome: 'fail', code: 'NOT_ASSIGNEE', status: 403 });
    expect(await item(id)).toEqual(before);
    expect((await events(id))).toHaveLength(2);
  });

  it('refuses a stale change: someone else moved the item first', async () => {
    await worker('ana');
    const id = await make();
    const stale = (await item(id)).version;
    await act(id, manager, { action: 'assign', assigneeUid: 'ana' });
    const result = await applyWorkTransition(db, { itemId: id, actor: manager, request: { action: 'cancel', reason: 'Nuk nevojitet më.' }, nowMs: NOW + 5, expectedVersion: stale });
    expect(result).toMatchObject({ outcome: 'fail', code: 'STALE', status: 409 });
    expect((await item(id)).status).toBe('assigned');
  });

  it('declining sends the work back to the queue and frees the place', async () => {
    await worker('ana');
    const id = await make();
    await act(id, manager, { action: 'assign', assigneeUid: 'ana' });
    expect((await act(id, agent('ana'), { action: 'decline', reason: 'Jam në pushim.' })).outcome).toBe('ok');
    expect(await item(id)).toMatchObject({ status: 'unassigned', assigneeUid: null });
    expect(await profile('ana')).toMatchObject({ load: 0, activeCount: 0 });
  });

  it('reassigning moves the load, needs a reason, and tells both people', async () => {
    await worker('ana'); await worker('blerim');
    const id = await make();
    await act(id, manager, { action: 'assign', assigneeUid: 'ana' });
    expect(await act(id, manager, { action: 'reassign', assigneeUid: 'blerim' })).toMatchObject({ outcome: 'fail', code: 'REASON_REQUIRED' });
    expect((await act(id, manager, { action: 'reassign', assigneeUid: 'blerim', reason: 'Ana është e mbingarkuar.' })).outcome).toBe('ok');
    expect(await profile('ana')).toMatchObject({ load: 0 });
    expect(await profile('blerim')).toMatchObject({ load: 1 });
    const notes = await notifications();
    expect(notes.some(note => note.toUid === 'blerim' && note.action === 'reassign')).toBe(true);
    expect(notes.some(note => note.toUid === 'ana' && note.action === 'reassign')).toBe(true);
    expect((await events(id)).find(event => event.action === 'reassign')).toMatchObject({ action: 'reassign', fromAssignee: 'ana', toAssignee: 'blerim', reason: 'Ana është e mbingarkuar.' });
  });

  it('a dispatcher may assign; an agent may not assign work to anyone', async () => {
    await worker('ana');
    const id = await make();
    expect(await act(id, agent('ana'), { action: 'assign', assigneeUid: 'ana' })).toMatchObject({ outcome: 'fail', code: 'WRONG_ROLE' });
    expect((await act(id, dispatcher, { action: 'assign', assigneeUid: 'ana' })).outcome).toBe('ok');
  });

  it('a manager override of capacity needs a reason and is recorded; hard rules cannot be overridden', async () => {
    await worker('full', { capacity: 1 });
    await db.collection(PROFILES).doc('full').update({ load: 1, activeCount: 1 });
    await worker('gone', { disabled: true });
    await worker('citizenish', { role: 'citizen' });
    const id = await make();

    expect(await act(id, manager, { action: 'assign', assigneeUid: 'full' })).toMatchObject({ outcome: 'fail', code: 'OVERRIDE_REASON_REQUIRED' });
    expect(await act(id, manager, { action: 'assign', assigneeUid: 'gone', reason: 'Urgjente, vetëm ai di.' })).toMatchObject({ outcome: 'fail', code: 'NOT_ELIGIBLE' });
    expect(await act(id, manager, { action: 'assign', assigneeUid: 'citizenish', reason: 'Urgjente, vetëm ai di.' })).toMatchObject({ outcome: 'fail', code: 'NOT_ELIGIBLE' });
    expect(await act(id, manager, { action: 'assign', assigneeUid: 'nobody', reason: 'Urgjente.' })).toMatchObject({ outcome: 'fail', code: 'NO_PROFILE' });

    expect((await act(id, manager, { action: 'assign', assigneeUid: 'full', reason: 'Urgjente, ka përvojën.' })).outcome).toBe('ok');
    expect((await events(id)).find(event => event.softOverride === 'capacity')).toMatchObject({ softOverride: 'capacity', reason: 'Urgjente, ka përvojën.' });
    expect(await profile('full')).toMatchObject({ load: 2 });
  });

  it('rework and reopening are counted, and an escalation keeps the state but flags attention', async () => {
    await worker('ana');
    const id = await make({ requiresReview: true });
    await act(id, manager, { action: 'assign', assigneeUid: 'ana' });
    await act(id, agent('ana'), { action: 'accept' });
    await act(id, agent('ana'), { action: 'start' });
    await act(id, agent('ana'), { action: 'submit', note: 'Gati për shqyrtim.' });
    await act(id, manager, { action: 'reject_work', reason: 'Mungon fotoja.' });
    expect(await item(id)).toMatchObject({ status: 'in_progress', reworkCount: 1 });
    await act(id, agent('ana'), { action: 'submit', note: 'Me foto tani.' });
    await act(id, manager, { action: 'approve', note: 'Në rregull.' });
    await act(id, manager, { action: 'reopen', reason: 'Problemi u shfaq përsëri.' });
    expect(await item(id)).toMatchObject({ status: 'in_progress', reopenCount: 1, open: true, doneAtMs: null });
    expect(await profile('ana')).toMatchObject({ load: 1 });
    await act(id, agent('ana'), { action: 'escalate', reason: 'Kam nevojë për ekip shtesë.' });
    expect(await item(id)).toMatchObject({ status: 'in_progress', needsAttention: true, manualEscalations: 1 });
  });
});

describe('moderation cases', () => {
  const mod = (uid: string): Named => ({ uid, role: 'debatwp', name: uid });
  const flagged = async (subject = 'cit1') => (await createWorkItem(db, { uid: 'system', role: 'superadmin' }, value({ kind: 'moderation_case', title: 'Postim i raportuar', subjectUid: subject }), NOW)).id;

  it('a flag is only a flag: a violation exists only after a person decides, with a reason', async () => {
    await worker('m1', { role: 'debatwp' });
    const id = await flagged();
    expect((await item(id)).status).toBe('flagged');
    expect(await act(id, mod('m1'), { action: 'confirm_violation', reason: 'Gjuhë urrejtjeje.' })).toMatchObject({ outcome: 'fail', code: 'WRONG_STATE' });
    expect((await act(id, mod('m1'), { action: 'open_review' })).outcome).toBe('ok');
    expect((await item(id)).assigneeUid).toBe('m1'); // taking an unowned case makes you its holder
    expect(await act(id, mod('m1'), { action: 'confirm_violation' })).toMatchObject({ outcome: 'fail', code: 'REASON_REQUIRED' });
    expect((await act(id, mod('m1'), { action: 'confirm_violation', reason: 'Gjuhë urrejtjeje.' })).outcome).toBe('ok');
    expect((await item(id)).decidedBy).toBe('m1');
  });

  it('an appeal is by the person concerned and reviewed by a different moderator', async () => {
    await worker('m1', { role: 'debatwp' }); await worker('m2', { role: 'debatwp' });
    const id = await flagged('cit1');
    for (const request of [{ action: 'open_review' }, { action: 'confirm_violation', reason: 'Shkelje e qartë.' }, { action: 'restrict', reason: 'Fshehje 7 ditë.' }]) {
      expect((await act(id, mod('m1'), request)).outcome).toBe('ok');
    }
    expect(await act(id, { uid: 'other', role: 'citizen' }, { action: 'appeal', reason: 'Nuk është postimi im.' })).toMatchObject({ outcome: 'fail', status: 404 });
    expect((await act(id, { uid: 'cit1', role: 'citizen' }, { action: 'appeal', reason: 'Postimi nuk shkel rregullat.' })).outcome).toBe('ok');
    expect(await act(id, mod('m1'), { action: 'overturn', reason: 'Rishikim.' })).toMatchObject({ outcome: 'fail', code: 'SAME_REVIEWER' });
    expect((await act(id, mod('m2'), { action: 'overturn', reason: 'Konteksti ishte satirë.' })).outcome).toBe('ok');
    expect((await item(id)).status).toBe('no_violation');
  });

  it('is never given to a non-moderator by the assignment engine', async () => {
    await worker('agentish', { role: 'agent' });
    const id = await flagged();
    expect((await autoAssign(db, id, NOW)).outcome).toBe('unassigned');
    await worker('m1', { role: 'debatwp' });
    expect(await autoAssign(db, id, NOW + 2 * H)).toMatchObject({ outcome: 'assigned', uid: 'm1' });
  });
});

describe('municipal referrals', () => {
  const peja: Named = { uid: 'peja1', role: 'municipality', municipality: 'Pejë', name: 'Komuna Pejë' };
  const gjilan: Named = { uid: 'gji1', role: 'municipality', municipality: 'Gjilan', name: 'Komuna Gjilan' };

  it('is worked only by the municipality it belongs to; another gets "not found"', async () => {
    const id = (await createWorkItem(db, manager, value({ kind: 'report_referral', municipality: 'Pejë', title: 'Referim: gropë' }), NOW)).id;
    await worker('peja1', { role: 'municipality', municipality: 'Pejë' });
    expect(await act(id, gjilan, { action: 'acknowledge' })).toMatchObject({ outcome: 'fail', status: 404, code: 'NOT_FOUND' });
    expect((await act(id, peja, { action: 'acknowledge' })).outcome).toBe('ok');
    expect(await item(id)).toMatchObject({ status: 'acknowledged', assigneeUid: 'peja1' });
  });

  it('taking a referral needs a work profile; without one the claim is refused, not silently accepted', async () => {
    const id = (await createWorkItem(db, manager, value({ kind: 'report_referral', municipality: 'Pejë', title: 'Referim pa profil' }), NOW)).id;
    expect(await act(id, peja, { action: 'acknowledge' })).toMatchObject({ outcome: 'fail', code: 'NO_PROFILE' });
    expect((await item(id)).status).toBe('pending_acceptance');
  });

  it('is offered only to workers of that municipality', async () => {
    await worker('peja1', { role: 'municipality', municipality: 'Pejë' });
    await worker('gji1', { role: 'municipality', municipality: 'Gjilan' });
    const id = (await createWorkItem(db, manager, value({ kind: 'report_referral', municipality: 'Pejë', title: 'Referim' }), NOW)).id;
    expect(await autoAssign(db, id, NOW)).toMatchObject({ outcome: 'assigned', uid: 'peja1' });
    expect(await profile('gji1')).toMatchObject({ load: 0 });
  });

  it('counts the referral in the municipality worker\'s load from the moment it is given', async () => {
    await worker('peja1', { role: 'municipality', municipality: 'Pejë', capacity: 1 });
    const first = (await createWorkItem(db, manager, value({ kind: 'report_referral', municipality: 'Pejë', title: 'Referim A' }), NOW)).id;
    const second = (await createWorkItem(db, manager, value({ kind: 'report_referral', municipality: 'Pejë', title: 'Referim B' }), NOW)).id;
    expect((await autoAssign(db, first, NOW)).outcome).toBe('assigned');
    expect((await autoAssign(db, second, NOW)).outcome).toBe('unassigned');
  });

  it('keeps two institutions\' referrals of one report separate', async () => {
    const a = (await createWorkItem(db, manager, value({ kind: 'report_referral', municipality: 'Pejë', dedupeKey: 'report:r9:peja', link: { reportId: 'r9', institution: 'Komuna Pejë' } as any }), NOW));
    const b = (await createWorkItem(db, manager, value({ kind: 'report_referral', municipality: 'Pejë', dedupeKey: 'report:r9:mmphi', link: { reportId: 'r9', institution: 'MMPHI' } as any }), NOW));
    expect(a.id).not.toBe(b.id);
    await worker('peja1', { role: 'municipality', municipality: 'Pejë' });
    await act(a.id, { uid: 'peja1', role: 'municipality', municipality: 'Pejë' }, { action: 'acknowledge' });
    expect((await item(a.id)).status).toBe('acknowledged');
    expect((await item(b.id)).status).toBe('pending_acceptance');
  });
});

describe('deadline escalation', () => {
  it('raises each overdue step once, even when the scheduler runs again and at the same time', async () => {
    await worker('ana');
    const id = await make({ priority: 'high' }, NOW);                     // due NOW + 24h
    await act(id, manager, { action: 'assign', assigneeUid: 'ana' }, NOW);
    await act(id, agent('ana'), { action: 'accept' }, NOW + 10);
    await act(id, agent('ana'), { action: 'start' }, NOW + 20);
    const later = NOW + 24 * H + 25 * H; // 25 h overdue: rungs 1 and 2
    await db.collection(WORK).doc(id).update({ lastActivityAtMs: later - 1000 }); // active recently, so not "stalled"

    const runs = await Promise.all([runEscalations(db, later), runEscalations(db, later), runEscalations(db, later)]);
    expect(runs.reduce((sum, run) => sum + run.applied, 0)).toBe(2);
    const after = await item(id);
    expect(after).toMatchObject({ escalationLevel: 2, priority: 'urgent' }); // high raised once
    const log = (await events(id)).filter(event => event.type === 'escalation');
    expect(log.map(event => event.id).sort()).toEqual([`${id}:overdue:1`, `${id}:overdue:2`]);

    const again = await runEscalations(db, later + 60_000);
    expect(again.applied).toBe(0);
    expect((await events(id)).filter(event => event.type === 'escalation')).toHaveLength(2);
    expect((await notifications()).filter(note => note.toRole === 'manager' && String(note.action).startsWith('escalation_'))).toHaveLength(2);
    expect(await db.collection(CONFIG).doc('runtime').get().then(doc => doc.data())).toMatchObject({ lastRunOk: true });
  });

  it('continues up the ladder as time passes and never repeats a rung', async () => {
    const id = await make({ priority: 'low' }, NOW);
    await db.collection(WORK).doc(id).update({ dueAtMs: NOW + H });
    const first = await runEscalations(db, NOW + 2 * H);
    expect(first.applied).toBeGreaterThanOrEqual(1);
    await runEscalations(db, NOW + 1 * H + 100 * H);
    const levels = (await events(id)).filter(event => event.escalation === 'overdue').map(event => event.level).sort();
    expect(levels).toEqual([1, 2, 3, 4]);
    expect((await item(id)).needsAttention).toBe(true);
  });

  it('alerts the supervisor about work nobody picked up', async () => {
    const id = await make({ priority: 'urgent' }, NOW);
    const run = await runEscalations(db, NOW + 20 * 60_000);
    expect(run.applied).toBe(1);
    expect((await item(id))).toMatchObject({ unassignedAlerts: 1, needsAttention: true });
    expect((await runEscalations(db, NOW + 21 * 60_000)).applied).toBe(0);
  });

  it('does not touch finished or paused work', async () => {
    await worker('ana');
    const blockedId = await make({ priority: 'urgent' }, NOW);
    await act(blockedId, manager, { action: 'assign', assigneeUid: 'ana' }, NOW);
    await act(blockedId, agent('ana'), { action: 'accept' }, NOW);
    await act(blockedId, agent('ana'), { action: 'start' }, NOW);
    await act(blockedId, agent('ana'), { action: 'block', reason: 'Pret lejen e pronarit.' }, NOW);
    const cancelled = await make({ priority: 'urgent' }, NOW);
    await act(cancelled, manager, { action: 'cancel', reason: 'Nuk nevojitet më.' }, NOW);
    const run = await runEscalations(db, NOW + 1000 * H);
    expect(run.applied).toBe(0);
    expect((await item(blockedId)).escalationLevel).toBe(0);
  });
});

describe('load stays true to the work held', () => {
  it('after a long mixed sequence of moves, every counter equals what is actually held', async () => {
    for (const uid of ['a', 'b', 'c']) await worker(uid, { capacity: 20 });
    const ids: string[] = [];
    for (let i = 0; i < 12; i += 1) ids.push(await make({ weight: 1 + (i % 3), requiresReview: i % 2 === 0, title: `Detyra ${i}` }));
    let clock = NOW;
    const step = (id: string, actor: Named, request: Record<string, unknown>) => act(id, actor, request, (clock += 10));
    const owners = ['a', 'b', 'c'];
    for (const [index, id] of ids.entries()) await step(id, manager, { action: 'assign', assigneeUid: owners[index % 3] });
    for (const [index, id] of ids.entries()) {
      const owner = agent(owners[index % 3]);
      if (index % 4 === 0) { await step(id, owner, { action: 'decline', reason: 'Nuk kam kohë.' }); continue; }
      await step(id, owner, { action: 'accept' });
      await step(id, owner, { action: 'start' });
      if (index % 4 === 1) await step(id, owner, { action: 'block', reason: 'Pret informacion.' });
      if (index % 4 === 2) { await step(id, owner, { action: index % 2 === 0 ? 'submit' : 'complete', note: 'U krye.' }); }
      if (index % 4 === 3) await step(id, manager, { action: 'reassign', assigneeUid: owners[(index + 1) % 3], reason: 'Balancim ngarkese.' });
    }
    for (const uid of owners) {
      const stored = await profile(uid);
      const actual = await recomputeLoad(db, uid, clock);
      expect({ load: stored.load, activeCount: stored.activeCount }, uid).toEqual(actual);
    }
  });
});

describe('creation rules', () => {
  it('validates input', () => {
    expect(validateCreate({ kind: 'nope', title: 'Titull' })).toMatchObject({ outcome: 'invalid' });
    expect(validateCreate({ kind: 'internal_task', title: 'ab' })).toMatchObject({ outcome: 'invalid' });
    expect(validateCreate({ kind: 'internal_task', title: 'Titull', municipality: 'Atlantida' })).toMatchObject({ outcome: 'invalid' });
    expect(validateCreate({ kind: 'internal_task', title: 'Titull', weight: 99 })).toMatchObject({ outcome: 'invalid' });
    expect(validateCreate({ kind: 'internal_task', title: 'Titull', priority: 'whenever' })).toMatchObject({ outcome: 'invalid' });
    expect(validateCreate({ kind: 'internal_task', title: 'Titull', weight: 3, requiredSkills: ['gis', 'gis', ' '] })).toMatchObject({ outcome: 'ok', value: { weight: 3, requiredSkills: ['gis'] } });
  });
});

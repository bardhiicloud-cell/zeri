import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { CASES, EVIDENCE, registerModerationRoutes } from '../../server/moderationCases';
import { registerDebateAdminRoutes } from '../../server/debateAdmin';
import { submitReport } from '../../server/forumReports';
import { isRestricted } from '../../server/accountRestrictions';

/**
 * The moderation routes against the Firestore emulator: a decision must change the real
 * post, comment or account in the same transaction that records it, and be undoable.
 * Authentication is a header; the identity provider is a fixed table.
 * Run with: npm run test:rules
 */
let db: Firestore;
let server: Server;
let base = '';
const authCalls: string[] = [];

const PEOPLE: Record<string, { role: string }> = {
  author1: { role: '' }, rep1: { role: '' }, rep2: { role: '' }, rep3: { role: '' },
  mod1: { role: 'debatwp' }, mod2: { role: 'debatwp' }, boss: { role: 'admin' }, staffer: { role: 'agent' },
};

const wipe = async () => {
  for (const name of [CASES, EVIDENCE, 'forumPosts', 'forumReports', 'users', 'notifications']) {
    for (const ref of await db.collection(name).listDocuments()) await db.recursiveDelete(ref);
  }
};

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through the emulator.');
  db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-moderation' }));
  const app = express();
  app.use(express.json());
  const requireAuth: express.RequestHandler = (req, res, next) => {
    const uid = req.header('x-test-uid');
    if (!uid || !(uid in PEOPLE)) return res.status(401).json({ error: 'Unauthorized' });
    (req as unknown as { user: unknown }).user = { uid, email: `${uid}@test`, role: PEOPLE[uid].role || 'citizen', claims: {} };
    next();
  };
  const authAdmin = () => ({
    getUser: async (uid: string) => {
      if (!(uid in PEOPLE)) throw Object.assign(new Error('nf'), { code: 'auth/user-not-found' });
      return { uid, customClaims: PEOPLE[uid].role ? { role: PEOPLE[uid].role } : {}, disabled: false };
    },
    updateUser: async (uid: string, change: { disabled: boolean }) => { authCalls.push(`${uid}:${change.disabled ? 'disable' : 'enable'}`); },
    revokeRefreshTokens: async (uid: string) => { authCalls.push(`${uid}:revoke`); },
  }) as unknown as Auth;
  const actingUser = (req: express.Request) => {
    const uid = (req as unknown as { user: { uid: string } }).user.uid;
    return { uid, role: PEOPLE[uid].role || 'citizen', permissions: [] as string[] };
  };
  registerModerationRoutes(app, { requireAuth, db: () => db, authAdmin, actingUser, audit: () => undefined });
  registerDebateAdminRoutes(app, { requireAuth, requireDebateSection: (_req, _res, next) => next(), db: () => db, audit: () => undefined });
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server?.close(); await wipe(); });

beforeEach(async () => {
  await wipe();
  authCalls.length = 0;
  for (const uid of Object.keys(PEOPLE)) await db.collection('users').doc(uid).set({ name: uid, role: PEOPLE[uid].role || 'citizen' });
  await db.collection('forumPosts').doc('p1').set({
    authorId: 'author1', authorName: 'Autori', content: 'Një postim i debatit', reportCount: 0, isHidden: false,
    comments: [{ id: 'c1', authorId: 'author1', authorName: 'Autori', content: 'Koment fyes', createdAt: '', replies: [{ id: 'r1', authorId: 'rep1', authorName: 'rep1', content: 'Përgjigje', createdAt: '' }] }],
  });
});

const call = async (uid: string, path: string, body?: unknown) => {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-test-uid': uid, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => null) as any };
};
const reportPost = (uid: string, reason = 'abuse') => call(uid, '/api/v1/forum/posts/p1/report', { reason });
const decide = (uid: string, id: string, body: Record<string, unknown>) => call(uid, `/api/v1/moderation/cases/${id}/decide`, body);
const caseDoc = async (id: string) => (await db.collection(CASES).doc(id).get()).data() as any;
const reason = 'Gjuhë fyese ndaj një qytetari';

describe('reports become one case per target', () => {
  it('counts every reporter once, keeps the reasons, and raises priority with harm', async () => {
    expect((await reportPost('rep1')).status).toBe(201);
    expect((await reportPost('rep2', 'violence')).status).toBe(201);
    expect((await reportPost('rep2')).status).toBe(409);
    const item = await caseDoc('post_p1');
    expect(item).toMatchObject({ kind: 'post', status: 'flagged', open: true, reportCount: 2, subjectUid: 'author1', priority: 'high' });
    expect(item.reasons).toEqual({ abuse: 1, violence: 1 });
    expect(item.snapshot.excerpt).toBe('Një postim i debatit');
  });

  it('opens a case for comment and account reports too', async () => {
    await submitReport(db, { uid: 'rep1', kind: 'comment', targetId: 'c1', postId: 'p1', reason: 'abuse' });
    await submitReport(db, { uid: 'rep2', kind: 'user', targetId: 'author1', reason: 'spam' });
    expect(await caseDoc('comment_c1')).toMatchObject({ reportCount: 1, subjectUid: 'author1', postId: 'p1' });
    expect(await caseDoc('user_author1')).toMatchObject({ reportCount: 1, subjectUid: 'author1' });
  });
});

describe('decisions change the real content', () => {
  it('two moderators claiming at once: exactly one gets it', async () => {
    await reportPost('rep1');
    const [a, b] = await Promise.all([decide('mod1', 'post_p1', { action: 'claim' }), decide('mod2', 'post_p1', { action: 'claim' })]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const item = await caseDoc('post_p1');
    expect(['mod1', 'mod2']).toContain(item.assigneeUid);
    expect(item.status).toBe('under_review');
  });

  it('hides a post, tells the author, and restores it', async () => {
    await reportPost('rep1');
    expect((await decide('mod1', 'post_p1', { action: 'hide', reason })).status).toBe(200);
    expect((await db.collection('forumPosts').doc('p1').get()).data()).toMatchObject({ isHidden: true, needsReview: false });
    expect(await caseDoc('post_p1')).toMatchObject({ status: 'violation_confirmed', open: false, decidedBy: 'mod1', lastEffect: { type: 'hide' } });
    const notes = (await db.collection('notifications').where('userId', '==', 'author1').get()).docs.map(d => d.data().title);
    expect(notes).toContain('Një postim juaj u fsheh nga moderimi');

    expect((await decide('mod1', 'post_p1', { action: 'restore', reason: 'U vlerësua gabimisht' })).status).toBe(200);
    expect((await db.collection('forumPosts').doc('p1').get()).data()?.isHidden).toBe(false);
    const history = (await db.collection(CASES).doc('post_p1').collection('history').orderBy('atMs').get()).docs.map(d => d.data().action);
    expect(history).toEqual(['report', 'hide', 'restore']);
  });

  it('removes a comment with a server-only copy kept, and puts it back where it was', async () => {
    await submitReport(db, { uid: 'rep1', kind: 'comment', targetId: 'c1', postId: 'p1', reason: 'abuse' });
    expect((await decide('mod1', 'comment_c1', { action: 'remove', reason })).status).toBe(200);
    expect(((await db.collection('forumPosts').doc('p1').get()).data()?.comments ?? []).map((c: any) => c.id)).toEqual([]);
    expect((await db.collection(EVIDENCE).doc('comment_c1').get()).data()).toMatchObject({ postId: 'p1', parentId: null, comment: { id: 'c1', content: 'Koment fyes' } });
    expect((await db.collection('forumReports').doc('comment_c1_rep1').get()).data()?.status).toBe('closed');

    expect((await decide('mod1', 'comment_c1', { action: 'restore', reason: 'Gabim i moderatorit' })).status).toBe(200);
    expect(((await db.collection('forumPosts').doc('p1').get()).data()?.comments ?? []).map((c: any) => c.id)).toEqual(['c1']);
  });

  it('soft-deletes a removed post and keeps a full copy', async () => {
    await reportPost('rep1');
    expect((await decide('mod1', 'post_p1', { action: 'remove', reason })).status).toBe(200);
    const post = (await db.collection('forumPosts').doc('p1').get()).data();
    expect(post?.deletedAt).toBeTruthy();
    expect(post?.moderationRemoved).toBe(true);
    expect((await db.collection(EVIDENCE).doc('post_p1').get()).data()?.post.content).toBe('Një postim i debatit');
  });
});

describe('account restrictions and appeals', () => {
  it('suspends for a set number of days; the appeal is decided by another moderator and lifts it', async () => {
    await submitReport(db, { uid: 'rep1', kind: 'user', targetId: 'author1', reason: 'abuse' });
    expect((await decide('mod1', 'user_author1', { action: 'suspend', reason, days: 7 })).status).toBe(200);
    const user = (await db.collection('users').doc('author1').get()).data();
    expect(user).toMatchObject({ isBanned: true, restriction: 'suspension' });
    expect(user!.suspendedUntil.toMillis()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect(isRestricted(user)).toBe(true);

    const mine = await call('author1', '/api/v1/moderation/my-cases');
    expect(mine.json.restriction).toMatchObject({ kind: 'suspension' });
    expect(mine.json.cases[0]).toMatchObject({ id: 'user_author1', canAppeal: true, reason });
    expect((await call('rep1', '/api/v1/moderation/cases/user_author1/appeal', { text: 'Nuk jam unë ai që shkroi.' })).status).toBe(404);
    expect((await call('author1', '/api/v1/moderation/cases/user_author1/appeal', { text: 'Ishte një keqkuptim, ju lutem rishikoni.' })).status).toBe(200);
    expect((await call('author1', '/api/v1/moderation/cases/user_author1/appeal', { text: 'Ishte një keqkuptim, ju lutem rishikoni.' })).status).toBe(409);

    expect((await decide('mod1', 'user_author1', { action: 'overturn', reason: 'Rishikim i vendimit tim' })).json.code).toBe('SAME_REVIEWER');
    expect((await decide('mod2', 'user_author1', { action: 'overturn', reason: 'Apelimi është i bazuar' })).status).toBe(200);
    const after = (await db.collection('users').doc('author1').get()).data();
    expect(after?.isBanned).toBe(false);
    expect(await caseDoc('user_author1')).toMatchObject({ status: 'resolved', appeal: { outcome: 'overturned' } });
  });

  it('keeps permanent bans for administrators, disables the sign-in, and never touches staff accounts', async () => {
    await submitReport(db, { uid: 'rep1', kind: 'user', targetId: 'author1', reason: 'abuse' });
    expect((await decide('mod1', 'user_author1', { action: 'ban', reason })).json.code).toBe('BAN_NOT_ALLOWED');
    expect((await decide('boss', 'user_author1', { action: 'ban', reason })).status).toBe(200);
    expect((await db.collection('users').doc('author1').get()).data()).toMatchObject({ isBanned: true, restriction: 'ban' });
    expect(authCalls).toEqual(['author1:disable', 'author1:revoke']);

    await submitReport(db, { uid: 'rep2', kind: 'user', targetId: 'staffer', reason: 'abuse' });
    expect((await decide('boss', 'user_staffer', { action: 'suspend', reason, days: 3 })).json.code).toBe('STAFF_SUBJECT');
  });

  it('refuses ordinary accounts and stale screens', async () => {
    await reportPost('rep1');
    expect((await call('rep1', '/api/v1/moderation/cases')).status).toBe(403);
    expect((await decide('rep1', 'post_p1', { action: 'hide', reason })).status).toBe(403);
    expect((await decide('mod1', 'post_p1', { action: 'hide', reason, expectedVersion: 99 })).json.code).toBe('STALE');
  });
});

describe('the queue', () => {
  it('lists open cases by priority and pages with a cursor', async () => {
    await reportPost('rep1', 'spam');
    await submitReport(db, { uid: 'rep1', kind: 'comment', targetId: 'c1', postId: 'p1', reason: 'violence' });
    await submitReport(db, { uid: 'rep2', kind: 'user', targetId: 'author1', reason: 'other' });
    const first = await call('mod1', '/api/v1/moderation/cases?view=queue&limit=2');
    expect(first.status).toBe(200);
    expect(first.json.cases.map((c: any) => c.id)).toEqual(['comment_c1', 'user_author1']);
    const second = await call('mod1', `/api/v1/moderation/cases?view=queue&limit=2&cursor=${first.json.nextCursor}`);
    expect(second.json.cases.map((c: any) => c.id)).toEqual(['post_p1']);
    expect(second.json.nextCursor).toBeNull();
    const summary = await call('mod1', '/api/v1/moderation/summary');
    expect(summary.json).toMatchObject({ flagged: 3, underReview: 0, appealed: 0 });
  });
});

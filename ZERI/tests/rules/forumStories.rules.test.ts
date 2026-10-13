import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  Timestamp, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';

/**
 * Story visibility: hidden and expired stories are unreadable to the public
 * even by a hand-written query. Run with: npm run test:rules
 */
let env: RulesTestEnvironment;
const A = 'uidAAAA';
const B = 'uidBBBB';
const HOUR = 3_600_000;

const citizen = (uid: string) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' } }).firestore();
const guest = (uid: string) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const staff = (uid: string) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' }, agent: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const story = (extra: Record<string, unknown> = {}) => ({
  authorId: A, authorName: 'Arta', mediaUrl: 'https://example.test/a.jpg', mediaType: 'image',
  isHidden: false, createdAt: new Date(Date.now() - HOUR), expiresAt: new Date(Date.now() + 5 * HOUR), ...extra,
});
const newStory = (extra: Record<string, unknown> = {}) => ({
  ...story(), createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 24 * HOUR), ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-zeri-stories',
    firestore: { rules: readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const uid of [A, B]) await setDoc(doc(db, 'users', uid), { id: uid, name: uid, role: 'citizen' });
    await setDoc(doc(db, 'forumStories', 'live'), story());
    await setDoc(doc(db, 'forumStories', 'hidden'), story({ isHidden: true }));
    await setDoc(doc(db, 'forumStories', 'expired'), story({ expiresAt: new Date(Date.now() - HOUR) }));
    // A story written before the isHidden field existed: it cannot be proven visible.
    const { isHidden: _omit, ...legacy } = story();
    await setDoc(doc(db, 'forumStories', 'legacy'), legacy);
  });
});

describe('forumStories read', () => {
  it('lets the public read a live, visible story', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'forumStories', 'live')));
    await assertSucceeds(getDoc(doc(citizen(B), 'forumStories', 'live')));
  });

  it('refuses a hidden story to the public and to other citizens, even by id', async () => {
    await assertFails(getDoc(doc(anon(), 'forumStories', 'hidden')));
    await assertFails(getDoc(doc(citizen(B), 'forumStories', 'hidden')));
  });

  it('refuses an expired story to the public', async () => {
    await assertFails(getDoc(doc(anon(), 'forumStories', 'expired')));
    await assertFails(getDoc(doc(citizen(B), 'forumStories', 'expired')));
  });

  it('keeps a story without the isHidden field closed until it is backfilled', async () => {
    await assertFails(getDoc(doc(anon(), 'forumStories', 'legacy')));
  });

  it('lets the author and staff read their own / any story, hidden or expired', async () => {
    await assertSucceeds(getDoc(doc(citizen(A), 'forumStories', 'hidden')));
    await assertSucceeds(getDoc(doc(citizen(A), 'forumStories', 'expired')));
    await assertSucceeds(getDoc(doc(staff(B), 'forumStories', 'hidden')));
    await assertSucceeds(getDoc(doc(staff(B), 'forumStories', 'legacy')));
  });

  it('allows the app\'s feed query: visible, not expired, newest expiry first', async () => {
    const feed = query(collection(anon(), 'forumStories'),
      where('isHidden', '==', false), where('expiresAt', '>', Timestamp.fromMillis(Date.now())), orderBy('expiresAt', 'desc'), limit(100));
    await assertSucceeds(getDocs(feed));
  });

  it('refuses an unfiltered or hidden-inclusive public list', async () => {
    await assertFails(getDocs(collection(anon(), 'forumStories')));
    await assertFails(getDocs(query(collection(anon(), 'forumStories'), where('expiresAt', '>', Timestamp.now()))));
    await assertFails(getDocs(query(collection(anon(), 'forumStories'), where('isHidden', '==', true))));
  });

  it('documents the known limit: a crafted visible-only list can still enumerate expired stories (get cannot)', async () => {
    // Lists cannot be checked against request.time, so expiry on lists is the query's job.
    await assertSucceeds(getDocs(query(collection(anon(), 'forumStories'), where('isHidden', '==', false))));
    await assertFails(getDoc(doc(anon(), 'forumStories', 'expired')));
  });

  it('lets an author list their own stories by authorId (profile), and staff list everything', async () => {
    await assertSucceeds(getDocs(query(collection(citizen(A), 'forumStories'), where('authorId', '==', A), limit(50))));
    await assertSucceeds(getDocs(query(collection(staff(B), 'forumStories'), orderBy('createdAt', 'desc'), limit(50))));
    await assertFails(getDocs(query(collection(citizen(B), 'forumStories'), where('authorId', '==', A), limit(50))));
  });
});

describe('forumStories write', () => {
  it('lets a citizen publish a visible story and refuses a pre-hidden or draft one', async () => {
    await assertSucceeds(setDoc(doc(citizen(A), 'forumStories', 'n1'), newStory()));
    await assertFails(setDoc(doc(citizen(A), 'forumStories', 'n2'), newStory({ isHidden: true })));
    await assertFails(setDoc(doc(citizen(A), 'forumStories', 'n3'), newStory({ status: 'draft' })));
    const { isHidden: _omit, ...withoutFlag } = newStory();
    await assertFails(setDoc(doc(citizen(A), 'forumStories', 'n4'), withoutFlag));
  });

  it('refuses guests and impersonation', async () => {
    await assertFails(setDoc(doc(guest(A), 'forumStories', 'g1'), newStory()));
    await assertFails(setDoc(doc(citizen(B), 'forumStories', 'i1'), newStory()));
  });

  it('stops an author lifting a moderator\'s hide or extending the expiry', async () => {
    await assertFails(updateDoc(doc(citizen(A), 'forumStories', 'hidden'), { isHidden: false }));
    await assertFails(updateDoc(doc(citizen(A), 'forumStories', 'live'), { expiresAt: Timestamp.fromMillis(Date.now() + 99 * HOUR) }));
    await assertFails(updateDoc(doc(citizen(A), 'forumStories', 'live'), { isHidden: true, hiddenBy: A }));
  });

  it('still lets an author edit their caption fields and staff hide or restore', async () => {
    await assertSucceeds(updateDoc(doc(citizen(A), 'forumStories', 'live'), { textOverlay: 'E re' }));
    await assertSucceeds(updateDoc(doc(staff(B), 'forumStories', 'live'), { isHidden: true, hiddenBy: B }));
    await assertSucceeds(updateDoc(doc(staff(B), 'forumStories', 'hidden'), { isHidden: false }));
  });

  it('lets the author or staff delete, nobody else', async () => {
    await assertFails(deleteDoc(doc(citizen(B), 'forumStories', 'live')));
    await assertSucceeds(deleteDoc(doc(citizen(A), 'forumStories', 'live')));
    await assertSucceeds(deleteDoc(doc(staff(B), 'forumStories', 'hidden')));
  });
});

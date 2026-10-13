import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  DmError, blockUser, conversationId, markConversationRead, respondToRequest, sendDirectMessage, setDmPrivacy, unblockUser,
} from '../../server/directMessages';

/**
 * Real transactions against the Firestore emulator.
 * Run with: npm run test:rules   (emulators:exec provides FIRESTORE_EMULATOR_HOST)
 */
let db: Firestore;
const A = 'uidA';
const B = 'uidB';
const C = 'uidC';
const CONV = conversationId(A, B);

const wipe = async () => {
  for (const name of ['users', 'forum_conversations', 'forum_blocks', 'forum_dm_settings', 'notifications']) {
    for (const ref of await db.collection(name).listDocuments()) await db.recursiveDelete(ref);
  }
};

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set - run through `npm run test:rules`.');
  db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-zeri-dm' }));
});

beforeEach(async () => {
  await wipe();
  await db.collection('users').doc(A).set({ name: 'Arta', role: 'citizen', followingIds: [] });
  await db.collection('users').doc(B).set({ name: 'Besa', role: 'citizen', followingIds: [] });
  await db.collection('users').doc(C).set({ name: 'Çlirim', role: 'citizen', followingIds: [] });
});
afterAll(wipe);

const send = (from: string, to: string, text = 'Përshëndetje', imageUrl = '') =>
  sendDirectMessage(db, { senderId: from, receiverId: to, text, imageUrl });

async function errorOf(promise: Promise<unknown>): Promise<DmError> {
  try { await promise; } catch (e) { expect(e).toBeInstanceOf(DmError); return e as DmError; }
  throw new Error('expected a DmError');
}
const conv = async (id = CONV) => (await db.collection('forum_conversations').doc(id).get()).data() as any;
const notes = async (userId: string) => (await db.collection('notifications').where('userId', '==', userId).get()).docs.map((d) => d.data());
const messages = async (id = CONV) => (await db.collection('forum_conversations').doc(id).collection('messages').get()).docs.map((d) => d.data());

describe('sending', () => {
  it('turns a stranger\'s first message into a request, with one notification', async () => {
    const result = await send(A, B);
    expect(result).toMatchObject({ conversationId: CONV, status: 'request' });
    const c = await conv();
    expect(c).toMatchObject({ status: 'request', requestedBy: A, requestMessages: 1, participants: [A, B], lastMessage: 'Përshëndetje' });
    expect(c.unreadCount).toEqual({ [B]: 1, [A]: 0 });
    expect(await messages()).toHaveLength(1);
    const [n] = await notes(B);
    expect(n).toMatchObject({ channel: 'forum_dm', userId: B, actorId: A });
    expect(n.title).toMatch(/Kërkesë e re/);
  });

  it('delivers to the inbox when the receiver follows the sender', async () => {
    await db.collection('users').doc(B).update({ followingIds: [A] });
    expect(await send(A, B)).toMatchObject({ status: 'active' });
    const c = await conv();
    expect(c.status).toBe('active');
    expect(c.requestedBy).toBeUndefined();
  });

  it('allows only one message while a request is pending', async () => {
    await send(A, B);
    expect((await errorOf(send(A, B, 'Edhe një'))).code).toBe('request_pending');
    expect(await messages()).toHaveLength(1);
  });

  it('keeps one notification for a burst of messages in an active thread', async () => {
    await db.collection('users').doc(B).update({ followingIds: [A] });
    await send(A, B, 'm1'); await send(A, B, 'm2'); await send(A, B, 'm3');
    expect((await conv()).unreadCount[B]).toBe(3);
    expect(await notes(B)).toHaveLength(1);
  });

  it('rejects empty, oversized and unsafe-image messages and missing recipients', async () => {
    expect((await errorOf(send(A, B, '   '))).code).toBe('empty');
    expect((await errorOf(send(A, B, 'x'.repeat(2001)))).code).toBe('too_long');
    expect((await errorOf(send(A, B, 'hi', 'javascript:alert(1)'))).code).toBe('bad_image');
    expect((await errorOf(send(A, 'ghost'))).statusCode).toBe(404);
    expect((await errorOf(send(A, 'a/b'))).code).toBe('bad_receiver');
    expect((await errorOf(send(A, A))).code).toBe('self');
    expect(await messages()).toHaveLength(0);
  });

  it('refuses guests and banned accounts', async () => {
    await db.collection('users').doc(C).update({ role: 'guest' });
    expect((await errorOf(send(C, B))).code).toBe('no_account');
    await db.collection('users').doc(B).update({ isBanned: true });
    expect((await errorOf(send(A, B))).statusCode).toBe(404);
  });
});

describe('requests', () => {
  it('lets the receiver accept, which moves the thread to the inbox and clears the request fields', async () => {
    await send(A, B);
    expect(await respondToRequest(db, B, CONV, 'accept')).toBe('active');
    const c = await conv();
    expect(c).toMatchObject({ status: 'active' });
    expect(c.requestedBy).toBeUndefined();
    expect(c.unreadCount[B]).toBe(0);
    expect(await send(A, B, 'Faleminderit')).toMatchObject({ status: 'active' });
  });

  it('shuts the requester out after a decline without telling them', async () => {
    await send(A, B);
    expect(await respondToRequest(db, B, CONV, 'decline')).toBe('declined');
    const err = await errorOf(send(A, B, 'Provoj prapë'));
    expect(err.code).toBe('denied');
    expect(err.message).not.toMatch(/refuz|decline|bllok/i);
  });

  it('counts the receiver replying as accepting', async () => {
    await send(A, B);
    expect(await send(B, A, 'Përshëndetje!')).toMatchObject({ status: 'active' });
    expect((await conv()).status).toBe('active');
  });

  it('refuses the wrong person, the requester, missing and non-request conversations', async () => {
    await send(A, B);
    expect((await errorOf(respondToRequest(db, C, CONV, 'accept'))).code).toBe('forbidden');
    expect((await errorOf(respondToRequest(db, A, CONV, 'accept'))).code).toBe('own_request');
    expect((await errorOf(respondToRequest(db, B, 'nope_x', 'accept'))).statusCode).toBe(404);
    expect((await errorOf(respondToRequest(db, B, CONV, 'bogus' as any))).code).toBe('bad_action');
    await respondToRequest(db, B, CONV, 'accept');
    expect((await errorOf(respondToRequest(db, B, CONV, 'decline'))).code).toBe('not_a_request');
  });
});

describe('blocking', () => {
  it('stops messages both ways and ends the follow relationship', async () => {
    await db.collection('users').doc(A).update({ followingIds: [B] });
    await db.collection('users').doc(B).update({ followingIds: [A] });
    await blockUser(db, B, A);
    expect((await db.collection('forum_blocks').doc(`${B}_${A}`).get()).exists).toBe(true);
    expect((await db.collection('users').doc(A).get()).data()!.followingIds).toEqual([]);
    expect((await db.collection('users').doc(B).get()).data()!.followingIds).toEqual([]);
    expect((await errorOf(send(A, B))).code).toBe('denied');
    expect((await errorOf(send(B, A))).code).toBe('you_blocked');
  });

  it('allows messaging again after unblocking', async () => {
    await blockUser(db, B, A);
    await unblockUser(db, B, A);
    expect(await send(A, B)).toMatchObject({ status: 'request' });
  });

  it('refuses blocking yourself or an invalid id', async () => {
    expect((await errorOf(blockUser(db, A, A))).code).toBe('self');
    expect((await errorOf(blockUser(db, A, 'x/y'))).code).toBe('bad_user');
  });
});

describe('privacy and read state', () => {
  it('"following" privacy refuses strangers but accepts people the receiver follows', async () => {
    expect(await setDmPrivacy(db, B, 'following')).toBe('following');
    expect((await errorOf(send(A, B))).code).toBe('privacy');
    await db.collection('users').doc(B).update({ followingIds: [A] });
    expect(await send(A, B)).toMatchObject({ status: 'active' });
    expect((await errorOf(setDmPrivacy(db, B, 'nobody'))).code).toBe('bad_privacy');
  });

  it('marks a conversation read only for a participant', async () => {
    await db.collection('users').doc(B).update({ followingIds: [A] });
    await send(A, B); await send(A, B);
    expect((await conv()).unreadCount[B]).toBe(2);
    expect((await errorOf(markConversationRead(db, C, CONV))).code).toBe('forbidden');
    await markConversationRead(db, B, CONV);
    expect((await conv()).unreadCount[B]).toBe(0);
  });
});

/**
 * Citizen direct messages: sending, message requests, blocking, privacy and the
 * recipient's notification.
 *
 * Until now the browser wrote everything itself: it created the conversation,
 * the message, the recipient's unread counter and the recipient's notification.
 * That meant a blocked or unwanted person could still message anyone, counters
 * could be set to any value, and nothing stopped a message from a stranger from
 * landing in the main inbox. Now the browser only reads; every write happens
 * here, inside one transaction, after these checks:
 *
 *   • neither side has blocked the other;
 *   • the recipient's privacy setting allows it;
 *   • a first message from someone the recipient does not follow becomes a
 *     message REQUEST: one message, kept apart from the inbox until accepted;
 *   • the recipient replying counts as accepting.
 *
 * The Firestore instance is a parameter so the logic runs against the emulator
 * in tests without the server's global Firebase initialisation.
 */
import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export const DM_MAX_TEXT = 2000;
export const DM_MAX_PENDING_REQUEST_MESSAGES = 1;

export type DmPrivacy = 'everyone' | 'following';
export type ConversationStatus = 'active' | 'request' | 'declined';

export class DmError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 403 | 404 | 409 | 429,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'DmError';
  }
}

export const conversationId = (a: string, b: string): string => [a, b].sort().join('_');
export const blockId = (blocker: string, blocked: string): string => `${blocker}_${blocked}`;

/** A Firestore id that cannot address another path. */
export const isSafeId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/');

const isSafeImageUrl = (value: string): boolean => {
  if (!value || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname));
  } catch {
    return false;
  }
};

/** What the conversation document says right now, or null when none exists. */
export interface ConversationState {
  status?: string;
  requestedBy?: string;
  requestMessages?: number;
}

export interface SendInput {
  senderId: string;
  receiverId: string;
  senderBlockedReceiver: boolean;
  receiverBlockedSender: boolean;
  receiverPrivacy: DmPrivacy;
  receiverFollowsSender: boolean;
  conversation: ConversationState | null;
}

export type SendDecision =
  | { ok: true; status: ConversationStatus; requestedBy?: string; requestMessages: number; becameActive: boolean; isRequestStart: boolean }
  | { ok: false; statusCode: 400 | 403 | 409; code: string; error: string };

const GENERIC_DENIED = 'Nuk mund t’i dërgoni mesazh këtij përdoruesi.';

/** Pure policy: may this message be sent, and in what state does it leave the thread? */
export function decideSend(input: SendInput): SendDecision {
  const { senderId, receiverId, conversation } = input;
  if (senderId === receiverId) return { ok: false, statusCode: 400, code: 'self', error: 'Nuk mund t’i dërgoni mesazh vetes.' };
  if (input.senderBlockedReceiver) {
    return { ok: false, statusCode: 403, code: 'you_blocked', error: 'Keni bllokuar këtë përdorues. Zhbllokojeni për t’i shkruar.' };
  }
  // Deliberately the same wording as a declined request: a block must not be detectable.
  if (input.receiverBlockedSender) return { ok: false, statusCode: 403, code: 'denied', error: GENERIC_DENIED };

  if (conversation) {
    const status = conversation.status ?? 'active';
    if (status === 'active') return { ok: true, status: 'active', requestMessages: 0, becameActive: false, isRequestStart: false };

    const requestedBy = String(conversation.requestedBy ?? '');
    const isRequester = senderId === requestedBy;

    if (status === 'request') {
      if (!isRequester) return { ok: true, status: 'active', requestMessages: 0, becameActive: true, isRequestStart: false };
      const used = Number(conversation.requestMessages) || 0;
      if (used >= DM_MAX_PENDING_REQUEST_MESSAGES) {
        return { ok: false, statusCode: 409, code: 'request_pending', error: 'Kërkesa juaj pret të pranohet. Mund të dërgoni një mesazh të ri pasi ta pranojnë.' };
      }
      return { ok: true, status: 'request', requestedBy, requestMessages: used + 1, becameActive: false, isRequestStart: false };
    }

    // declined: the requester is shut out; the person who declined may still write, which reopens it.
    if (isRequester) return { ok: false, statusCode: 403, code: 'denied', error: GENERIC_DENIED };
    return { ok: true, status: 'active', requestMessages: 0, becameActive: true, isRequestStart: false };
  }

  if (input.receiverPrivacy === 'following' && !input.receiverFollowsSender) {
    return { ok: false, statusCode: 403, code: 'privacy', error: 'Ky përdorues pranon mesazhe vetëm nga njerëzit që ndjek.' };
  }
  if (input.receiverFollowsSender) {
    return { ok: true, status: 'active', requestMessages: 0, becameActive: false, isRequestStart: false };
  }
  return { ok: true, status: 'request', requestedBy: senderId, requestMessages: 1, becameActive: false, isRequestStart: true };
}

/** Sliding-window limiter, one bucket per key. In-memory: it slows abuse on one instance, it is not a quota. */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now: number = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) { hits.set(key, recent); return false; }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}

const str = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);

export interface SendResult {
  conversationId: string;
  messageId: string;
  status: ConversationStatus;
}

export async function sendDirectMessage(
  firestore: Firestore,
  input: { senderId: string; receiverId: string; text: string; imageUrl?: string },
): Promise<SendResult> {
  const { senderId, receiverId } = input;
  if (!isSafeId(senderId) || !isSafeId(receiverId)) throw new DmError('Marrësi nuk është i vlefshëm.', 400, 'bad_receiver');
  const text = str(input.text, DM_MAX_TEXT + 1);
  if (text.length > DM_MAX_TEXT) throw new DmError(`Mesazhi kalon ${DM_MAX_TEXT} shenja.`, 400, 'too_long');
  const imageUrl = String(input.imageUrl ?? '').trim();
  if (imageUrl && !isSafeImageUrl(imageUrl)) throw new DmError('Fotoja nuk është e vlefshme.', 400, 'bad_image');
  if (!text && !imageUrl) throw new DmError('Shkruani një mesazh ose zgjidhni një foto.', 400, 'empty');

  const convId = conversationId(senderId, receiverId);
  const convRef = firestore.collection('forum_conversations').doc(convId);
  const messageRef = convRef.collection('messages').doc();

  return firestore.runTransaction(async (tx) => {
    const [senderDoc, receiverDoc, blockedByMe, blockedMe, settings, convSnap] = await Promise.all([
      tx.get(firestore.collection('users').doc(senderId)),
      tx.get(firestore.collection('users').doc(receiverId)),
      tx.get(firestore.collection('forum_blocks').doc(blockId(senderId, receiverId))),
      tx.get(firestore.collection('forum_blocks').doc(blockId(receiverId, senderId))),
      tx.get(firestore.collection('forum_dm_settings').doc(receiverId)),
      tx.get(convRef),
    ]);

    if (!senderDoc.exists || senderDoc.data()?.role === 'guest') {
      throw new DmError('Kyçuni me llogari për të dërguar mesazhe.', 403, 'no_account');
    }
    if (!receiverDoc.exists || receiverDoc.data()?.isBanned === true) {
      throw new DmError('Marrësi nuk u gjet.', 404, 'not_found');
    }
    if (senderDoc.data()?.isBanned === true) throw new DmError('Llogaria juaj është e kufizuar.', 403, 'banned');

    const receiverFollowing = receiverDoc.data()?.followingIds;
    const conv = convSnap.exists ? (convSnap.data() as ConversationState) : null;
    const decision = decideSend({
      senderId,
      receiverId,
      senderBlockedReceiver: blockedByMe.exists,
      receiverBlockedSender: blockedMe.exists,
      receiverPrivacy: settings.data()?.privacy === 'following' ? 'following' : 'everyone',
      receiverFollowsSender: Array.isArray(receiverFollowing) && receiverFollowing.includes(senderId),
      conversation: conv,
    });
    if (decision.ok === false) throw new DmError(decision.error, decision.statusCode, decision.code);
    // The project is not in strict mode, so the union is not narrowed by the check above.
    const allowed = decision as Extract<SendDecision, { ok: true }>;

    const sender = senderDoc.data() ?? {};
    const receiver = receiverDoc.data() ?? {};
    const senderName = str(sender.name, 120) || 'Qytetar';
    const receiverUnreadBefore = Number((convSnap.data() as any)?.unreadCount?.[receiverId]) || 0;

    tx.create(messageRef, {
      conversationId: convId,
      senderId,
      senderName,
      senderAvatar: str(sender.avatar, 1000),
      text,
      imageUrl,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.set(convRef, {
      participants: [senderId, receiverId],
      participantData: {
        [senderId]: { name: senderName, avatar: str(sender.avatar, 1000) },
        [receiverId]: { name: str(receiver.name, 120) || 'Qytetar', avatar: str(receiver.avatar, 1000) },
      },
      lastMessage: text || '📷 Foto',
      lastMessageAt: FieldValue.serverTimestamp(),
      status: allowed.status,
      // Counters are server-owned: the receiver's goes up, the sender's resets.
      unreadCount: { [receiverId]: FieldValue.increment(1), [senderId]: 0 },
      ...(allowed.status === 'request'
        ? { requestedBy: allowed.requestedBy, requestMessages: allowed.requestMessages }
        : { requestedBy: FieldValue.delete(), requestMessages: FieldValue.delete() }),
      ...(allowed.becameActive ? { acceptedAt: FieldValue.serverTimestamp() } : {}),
    }, { merge: true });

    // One notification per burst: only when the recipient had nothing unread, or
    // when a request first arrives. Ten messages in a row are one bell.
    if (receiverUnreadBefore === 0 || allowed.isRequestStart) {
      tx.create(firestore.collection('notifications').doc(), {
        title: allowed.status === 'request' ? `Kërkesë e re për mesazh nga ${senderName}` : `Mesazh i ri nga ${senderName}`,
        message: (text || '📷 Ju ka dërguar një foto.').slice(0, 200),
        channel: 'forum_dm',
        category: 'forum_dm',
        type: 'info',
        priority: 'normal',
        audience: 'user',
        userId: receiverId,
        actorId: senderId,
        actorName: senderName,
        state: 'published',
        link: '/forum',
        sender: senderName,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return { conversationId: convId, messageId: messageRef.id, status: allowed.status };
  });
}

export async function respondToRequest(
  firestore: Firestore, uid: string, convId: string, action: 'accept' | 'decline',
): Promise<ConversationStatus> {
  if (!isSafeId(uid) || !isSafeId(convId)) throw new DmError('Biseda nuk është e vlefshme.', 400, 'bad_conversation');
  if (action !== 'accept' && action !== 'decline') throw new DmError('Veprimi nuk njihet.', 400, 'bad_action');
  const ref = firestore.collection('forum_conversations').doc(convId);
  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new DmError('Biseda nuk u gjet.', 404, 'not_found');
    const data = snap.data() as any;
    if (!Array.isArray(data.participants) || !data.participants.includes(uid)) {
      throw new DmError('Nuk keni qasje në këtë bisedë.', 403, 'forbidden');
    }
    if (data.status !== 'request') throw new DmError('Kjo bisedë nuk është kërkesë.', 409, 'not_a_request');
    if (data.requestedBy === uid) throw new DmError('Nuk mund ta pranoni kërkesën tuaj.', 403, 'own_request');
    const status: ConversationStatus = action === 'accept' ? 'active' : 'declined';
    tx.update(ref, {
      status,
      // A declined thread must remember who asked: that is how the requester stays
      // shut out while the person who declined can still reopen it. Accepting ends
      // the request, so its bookkeeping goes.
      ...(action === 'accept' ? { requestedBy: FieldValue.delete(), requestMessages: FieldValue.delete() } : {}),
      [action === 'accept' ? 'acceptedAt' : 'declinedAt']: FieldValue.serverTimestamp(),
      [`unreadCount.${uid}`]: 0,
    });
    return status;
  });
}

export async function markConversationRead(firestore: Firestore, uid: string, convId: string): Promise<void> {
  if (!isSafeId(uid) || !isSafeId(convId)) throw new DmError('Biseda nuk është e vlefshme.', 400, 'bad_conversation');
  const ref = firestore.collection('forum_conversations').doc(convId);
  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new DmError('Biseda nuk u gjet.', 404, 'not_found');
    const participants = (snap.data() as any)?.participants;
    if (!Array.isArray(participants) || !participants.includes(uid)) throw new DmError('Nuk keni qasje në këtë bisedë.', 403, 'forbidden');
    tx.update(ref, { [`unreadCount.${uid}`]: 0 });
  });
}

/** Blocking also ends the follow relationship both ways, as on other networks. */
export async function blockUser(firestore: Firestore, blockerId: string, blockedId: string): Promise<void> {
  if (!isSafeId(blockerId) || !isSafeId(blockedId)) throw new DmError('Përdoruesi nuk është i vlefshëm.', 400, 'bad_user');
  if (blockerId === blockedId) throw new DmError('Nuk mund ta bllokoni veten.', 400, 'self');
  const batch = firestore.batch();
  batch.set(firestore.collection('forum_blocks').doc(blockId(blockerId, blockedId)), {
    blockerId, blockedId, createdAt: FieldValue.serverTimestamp(),
  });
  // update() fails on a missing profile; set-merge keeps blocking possible for any id.
  batch.set(firestore.collection('users').doc(blockerId), { followingIds: FieldValue.arrayRemove(blockedId) }, { merge: true });
  batch.set(firestore.collection('users').doc(blockedId), { followingIds: FieldValue.arrayRemove(blockerId) }, { merge: true });
  await batch.commit();
}

export async function unblockUser(firestore: Firestore, blockerId: string, blockedId: string): Promise<void> {
  if (!isSafeId(blockerId) || !isSafeId(blockedId)) throw new DmError('Përdoruesi nuk është i vlefshëm.', 400, 'bad_user');
  await firestore.collection('forum_blocks').doc(blockId(blockerId, blockedId)).delete();
}

export async function setDmPrivacy(firestore: Firestore, uid: string, privacy: unknown): Promise<DmPrivacy> {
  if (!isSafeId(uid)) throw new DmError('Përdoruesi nuk është i vlefshëm.', 400, 'bad_user');
  if (privacy !== 'everyone' && privacy !== 'following') throw new DmError('Opsioni i privatësisë nuk njihet.', 400, 'bad_privacy');
  await firestore.collection('forum_dm_settings').doc(uid).set({ privacy, updatedAt: FieldValue.serverTimestamp() });
  return privacy;
}

export interface DirectMessageDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
}

export function registerDirectMessageRoutes(app: Express, deps: DirectMessageDeps): void {
  // 30 messages a minute per account: far above a conversation, far below spam.
  const allowSend = createRateLimiter(30, 60_000);

  const fail = (res: Response, error: unknown, label: string) => {
    if (error instanceof DmError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
    console.error(`[DM] ${label} failed:`, (error as Error)?.message);
    return res.status(500).json({ error: 'Veprimi dështoi. Provoni përsëri.' });
  };

  app.post('/api/v1/forum/dm/send', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!allowSend(uid)) return res.status(429).json({ error: 'Po dërgoni shumë mesazhe. Prisni pak.', code: 'rate_limited' });
    try {
      const result = await sendDirectMessage(deps.db(), {
        senderId: uid,
        receiverId: str(req.body?.receiverId, 128),
        text: String(req.body?.text ?? ''),
        imageUrl: String(req.body?.imageUrl ?? ''),
      });
      return res.status(201).json(result);
    } catch (error) {
      return fail(res, error, 'send');
    }
  });

  app.post('/api/v1/forum/dm/:convId/respond', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const status = await respondToRequest(deps.db(), uid, req.params.convId, req.body?.action);
      return res.json({ status });
    } catch (error) {
      return fail(res, error, 'respond');
    }
  });

  app.post('/api/v1/forum/dm/:convId/read', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      await markConversationRead(deps.db(), uid, req.params.convId);
      return res.json({ ok: true });
    } catch (error) {
      return fail(res, error, 'read');
    }
  });

  app.put('/api/v1/forum/dm/privacy', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      return res.json({ privacy: await setDmPrivacy(deps.db(), uid, req.body?.privacy) });
    } catch (error) {
      return fail(res, error, 'privacy');
    }
  });

  app.put('/api/v1/forum/blocks/:uid', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      await blockUser(deps.db(), uid, req.params.uid);
      return res.json({ ok: true });
    } catch (error) {
      return fail(res, error, 'block');
    }
  });

  app.delete('/api/v1/forum/blocks/:uid', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      await unblockUser(deps.db(), uid, req.params.uid);
      return res.json({ ok: true });
    } catch (error) {
      return fail(res, error, 'unblock');
    }
  });
}

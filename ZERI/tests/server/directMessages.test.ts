import { describe, expect, it } from 'vitest';
import { conversationId, createRateLimiter, decideSend, isSafeId, type SendInput } from '../../server/directMessages';

const base = (extra: Partial<SendInput> = {}): SendInput => ({
  senderId: 'a', receiverId: 'b',
  senderBlockedReceiver: false, receiverBlockedSender: false,
  receiverPrivacy: 'everyone', receiverFollowsSender: false, conversation: null,
  ...extra,
});

describe('conversationId / isSafeId', () => {
  it('is symmetric and stable', () => {
    expect(conversationId('b', 'a')).toBe('a_b');
    expect(conversationId('a', 'b')).toBe('a_b');
  });
  it('rejects ids that could address another path', () => {
    expect(isSafeId('abc')).toBe(true);
    for (const bad of ['', 'a/b', 'x'.repeat(129), 5, null, undefined]) expect(isSafeId(bad)).toBe(false);
  });
});

describe('decideSend: first contact', () => {
  it('goes straight to the inbox when the receiver follows the sender', () => {
    expect(decideSend(base({ receiverFollowsSender: true }))).toMatchObject({ ok: true, status: 'active', isRequestStart: false });
  });

  it('becomes a request, with one message, from a stranger', () => {
    expect(decideSend(base())).toMatchObject({ ok: true, status: 'request', requestedBy: 'a', requestMessages: 1, isRequestStart: true });
  });

  it('refuses strangers when the receiver only accepts people they follow', () => {
    expect(decideSend(base({ receiverPrivacy: 'following' }))).toMatchObject({ ok: false, statusCode: 403, code: 'privacy' });
    expect(decideSend(base({ receiverPrivacy: 'following', receiverFollowsSender: true }))).toMatchObject({ ok: true, status: 'active' });
  });

  it('refuses messaging yourself', () => {
    expect(decideSend(base({ receiverId: 'a' }))).toMatchObject({ ok: false, statusCode: 400, code: 'self' });
  });
});

describe('decideSend: blocks', () => {
  it('tells the blocker they blocked, but never reveals a block to the blocked person', () => {
    const mine = decideSend(base({ senderBlockedReceiver: true }));
    const theirs = decideSend(base({ receiverBlockedSender: true }));
    expect(mine).toMatchObject({ ok: false, code: 'you_blocked' });
    expect(theirs).toMatchObject({ ok: false, code: 'denied' });
    const declined = decideSend(base({ conversation: { status: 'declined', requestedBy: 'a' } }));
    expect(declined.ok === false && theirs.ok === false && declined.error === theirs.error).toBe(true);
  });

  it('a block beats an active conversation', () => {
    expect(decideSend(base({ conversation: { status: 'active' }, receiverBlockedSender: true }))).toMatchObject({ ok: false });
    expect(decideSend(base({ conversation: { status: 'active' }, senderBlockedReceiver: true }))).toMatchObject({ ok: false });
  });
});

describe('decideSend: existing conversations', () => {
  it('lets an active conversation continue', () => {
    expect(decideSend(base({ conversation: { status: 'active' } }))).toMatchObject({ ok: true, status: 'active', becameActive: false });
    expect(decideSend(base({ conversation: {} }))).toMatchObject({ ok: true, status: 'active' });
  });

  it('limits a pending request to one message', () => {
    const pending = { status: 'request', requestedBy: 'a', requestMessages: 1 };
    expect(decideSend(base({ conversation: pending }))).toMatchObject({ ok: false, statusCode: 409, code: 'request_pending' });
  });

  it('treats the receiver replying to a request as accepting it', () => {
    const pending = { status: 'request', requestedBy: 'b', requestMessages: 1 };
    expect(decideSend(base({ conversation: pending }))).toMatchObject({ ok: true, status: 'active', becameActive: true });
  });

  it('shuts the requester out after a decline, but lets the decliner reopen', () => {
    expect(decideSend(base({ conversation: { status: 'declined', requestedBy: 'a' } }))).toMatchObject({ ok: false, code: 'denied' });
    expect(decideSend(base({ senderId: 'b', receiverId: 'a', conversation: { status: 'declined', requestedBy: 'a' } })))
      .toMatchObject({ ok: true, status: 'active', becameActive: true });
  });
});

describe('createRateLimiter', () => {
  it('allows up to the limit inside the window, then refuses', () => {
    const allow = createRateLimiter(3, 1000);
    expect([allow('u', 0), allow('u', 10), allow('u', 20), allow('u', 30)]).toEqual([true, true, true, false]);
  });

  it('is per key and recovers when the window slides', () => {
    const allow = createRateLimiter(1, 1000);
    expect(allow('x', 0)).toBe(true);
    expect(allow('y', 0)).toBe(true);
    expect(allow('x', 500)).toBe(false);
    expect(allow('x', 1500)).toBe(true);
  });
});

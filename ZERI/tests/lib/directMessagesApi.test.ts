import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/apiAuth', () => ({ authHeaders: async (h: Record<string, string>) => h }));

const { composerState, viewOfConversation } = await import('../../src/lib/directMessagesApi');

describe('viewOfConversation', () => {
  it('shows active and legacy (no status) threads in the inbox', () => {
    expect(viewOfConversation({}, 'me')).toBe('inbox');
    expect(viewOfConversation({ status: 'active' }, 'me')).toBe('inbox');
  });

  it('splits requests by who asked', () => {
    expect(viewOfConversation({ status: 'request', requestedBy: 'them' }, 'me')).toBe('incoming_request');
    expect(viewOfConversation({ status: 'request', requestedBy: 'me' }, 'me')).toBe('outgoing_request');
  });

  it('hides a declined thread from the decliner but never tells the requester', () => {
    expect(viewOfConversation({ status: 'declined', requestedBy: 'them' }, 'me')).toBe('hidden');
    expect(viewOfConversation({ status: 'declined', requestedBy: 'me' }, 'me')).toBe('inbox');
  });
});

describe('composerState', () => {
  it('allows a new or active conversation', () => {
    expect(composerState(null, 'me', false)).toEqual({ canSend: true });
    expect(composerState({ status: 'active' }, 'me', false)).toEqual({ canSend: true });
  });

  it('blocks writing to someone you blocked, before anything else', () => {
    expect(composerState({ status: 'active' }, 'me', true)).toEqual({ canSend: false, reason: 'you_blocked' });
  });

  it('holds the composer for an incoming request until it is answered', () => {
    expect(composerState({ status: 'request', requestedBy: 'them' }, 'me', false)).toEqual({ canSend: false, reason: 'incoming_request' });
  });

  it('allows one message in an outgoing request, then waits', () => {
    expect(composerState({ status: 'request', requestedBy: 'me', requestMessages: 0 }, 'me', false)).toEqual({ canSend: true });
    expect(composerState({ status: 'request', requestedBy: 'me', requestMessages: 1 }, 'me', false)).toEqual({ canSend: false, reason: 'request_pending' });
  });
});

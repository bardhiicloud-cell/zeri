import { authHeaders } from './apiAuth';

/**
 * Client for server/directMessages.ts. Every DM write goes through here: the
 * browser only reads conversations and messages from Firestore.
 */

export type DmPrivacy = 'everyone' | 'following';
export type ConversationStatus = 'active' | 'request' | 'declined';

export class DmApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = 'DmApiError';
  }
}

async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new DmApiError(
      typeof data?.error === 'string' ? data.error : 'Veprimi dështoi. Provoni përsëri.',
      response.status,
      typeof data?.code === 'string' ? data.code : 'error',
    );
  }
  return data as T;
}

export const sendDm = (receiverId: string, text: string, imageUrl = '') =>
  call<{ conversationId: string; messageId: string; status: ConversationStatus }>(
    '/api/v1/forum/dm/send', 'POST', { receiverId, text, imageUrl });

export const respondToDmRequest = (conversationId: string, action: 'accept' | 'decline') =>
  call<{ status: ConversationStatus }>(`/api/v1/forum/dm/${encodeURIComponent(conversationId)}/respond`, 'POST', { action });

export const markDmRead = (conversationId: string) =>
  call<{ ok: true }>(`/api/v1/forum/dm/${encodeURIComponent(conversationId)}/read`, 'POST');

export const setDmPrivacy = (privacy: DmPrivacy) =>
  call<{ privacy: DmPrivacy }>('/api/v1/forum/dm/privacy', 'PUT', { privacy });

export const blockUser = (uid: string) => call<{ ok: true }>(`/api/v1/forum/blocks/${encodeURIComponent(uid)}`, 'PUT');
export const unblockUser = (uid: string) => call<{ ok: true }>(`/api/v1/forum/blocks/${encodeURIComponent(uid)}`, 'DELETE');

/** Which tab and label a conversation belongs to, from its server-owned fields. */
export interface ConversationLike {
  status?: string;
  requestedBy?: string;
  requestMessages?: number;
}

export type ConversationView = 'inbox' | 'incoming_request' | 'outgoing_request' | 'hidden';

/**
 * Where this conversation shows for `me`. Pure, so the rule that a decliner
 * never sees a declined thread (and a requester never learns of it) is tested.
 */
export function viewOfConversation(conv: ConversationLike, me: string): ConversationView {
  const status = conv.status ?? 'active';
  if (status === 'request') return conv.requestedBy === me ? 'outgoing_request' : 'incoming_request';
  if (status === 'declined') return conv.requestedBy === me ? 'inbox' : 'hidden';
  return 'inbox';
}

/** Can `me` type a message right now? Returns a reason when not. */
export function composerState(
  conv: ConversationLike | null, me: string, blockedByMe: boolean,
): { canSend: boolean; reason?: 'you_blocked' | 'request_pending' | 'incoming_request' } {
  if (blockedByMe) return { canSend: false, reason: 'you_blocked' };
  if (!conv) return { canSend: true };
  const view = viewOfConversation(conv, me);
  if (view === 'incoming_request') return { canSend: false, reason: 'incoming_request' };
  if (view === 'outgoing_request' && (Number(conv.requestMessages) || 0) >= 1) return { canSend: false, reason: 'request_pending' };
  return { canSend: true };
}

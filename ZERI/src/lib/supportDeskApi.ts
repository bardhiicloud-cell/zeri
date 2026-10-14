import { describeApiFailure, requireAdminToken } from './adminApi';

/** The support desk actions (server/supportDesk.ts). Agents never write the chat document directly. */
type DeskAction = 'accept' | 'reply' | 'release' | 'transfer' | 'resolve' | 'department';

async function act(chatId: string, action: DeskAction, body: Record<string, unknown> = {}): Promise<{ ok: true; status: string; assignedTo: string | null }> {
  const token = await requireAdminToken();
  const response = await fetch(`/api/v1/support/chats/${encodeURIComponent(chatId)}/${action}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(describeApiFailure(response.status, result)), { code: (result as { code?: string }).code });
  return result;
}

export const supportDesk = {
  accept: (chatId: string) => act(chatId, 'accept'),
  reply: (chatId: string, text: string) => act(chatId, 'reply', { text }),
  release: (chatId: string, reason?: string) => act(chatId, 'release', reason ? { reason } : {}),
  transfer: (chatId: string, uid: string, reason?: string) => act(chatId, 'transfer', { uid, ...(reason ? { reason } : {}) }),
  resolve: (chatId: string, reason?: string) => act(chatId, 'resolve', reason ? { reason } : {}),
  department: (chatId: string, department: string) => act(chatId, 'department', { department }),
  async agents(): Promise<Array<{ uid: string; name: string; role: string }>> {
    const token = await requireAdminToken();
    const response = await fetch('/api/v1/support/agents', { headers: { Authorization: `Bearer ${token}` } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(describeApiFailure(response.status, result));
    return (result as { agents: Array<{ uid: string; name: string; role: string }> }).agents;
  },
};

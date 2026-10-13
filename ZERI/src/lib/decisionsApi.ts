import { requireAdminToken, describeApiFailure } from './adminApi';
import type { DecisionKind } from './decisionRules';

/** One decision as the server keeps it. */
export interface DecisionRecord {
  id: string;
  action: string;
  label: string;
  from: string;
  to: string;
  reason: string | null;
  byName: string;
  byRole: string;
  at: string;
}

async function call(method: 'GET' | 'POST', path: string, body?: unknown) {
  const token = await requireAdminToken();
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(describeApiFailure(response.status, result));
  return result;
}

/** Take a decision; the server checks who, from which state, and the reason. */
export async function takeDecision(
  kind: DecisionKind,
  id: string,
  action: string,
  options: { reason?: string; campaignId?: string } = {}
): Promise<{ state: string }> {
  const result = await call('POST', `/api/v1/admin/decisions/${kind}/${encodeURIComponent(id)}`, { action, ...options });
  return { state: String(result.state ?? '') };
}

export async function loadDecisionHistory(kind: DecisionKind, id: string): Promise<DecisionRecord[]> {
  const result = await call('GET', `/api/v1/admin/decisions/${kind}/${encodeURIComponent(id)}`);
  return Array.isArray(result.items) ? result.items : [];
}

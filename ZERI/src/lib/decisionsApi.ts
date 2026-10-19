import { requireAdminToken, describeApiFailure } from './adminApi';
import { DECISION_KINDS, patchFor, type DecisionKind } from './decisionRules';
import { API_UNAVAILABLE_CODE } from './apiBase';

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
  const result = (await response.json().catch(() => null)) ?? {};
  if (!response.ok) {
    const error = new Error(describeApiFailure(response.status, result)) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = (result as { code?: string }).code;
    throw error;
  }
  return result;
}

/**
 * The same decision written straight to the database, for when the API server is not
 * reachable. Same action table (decisionRules.ts), same "from" check; the database rules
 * decide whether this account may write it. No server-side decision log in this mode,
 * so the record itself carries who and when.
 */
async function takeDecisionDirect(kind: DecisionKind, id: string, action: string, options: { reason?: string; campaignId?: string }): Promise<{ state: string }> {
  const rule = DECISION_KINDS[kind];
  const step = rule?.actions[action];
  if (!step) throw new Error('Veprim i panjohur.');
  if (step.needsReason && !(options.reason ?? '').trim()) throw new Error('Shkruani arsyen.');
  const [{ auth, db }, { doc, getDoc, updateDoc }] = await Promise.all([import('./firebase'), import('firebase/firestore')]);
  const ref = doc(db, rule.collection, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Nuk u gjet.');
  const state = rule.stateOf(snap.data());
  if (!step.from.includes(state)) throw new Error(`Ky veprim nuk lejohet nga gjendja "${state}".`);
  const now = new Date().toISOString();
  try {
    await updateDoc(ref, {
      ...patchFor(kind, action, now, { reason: options.reason ?? '', campaignId: options.campaignId ?? '' }),
      lastDecision: { action, reason: options.reason ?? null, byUid: auth.currentUser?.uid ?? '', byName: auth.currentUser?.displayName ?? '', at: now },
      updatedAt: now,
    });
  } catch (error) {
    if ((error as { code?: string })?.code === 'permission-denied') {
      throw new Error('Serveri nuk është i lidhur dhe kjo llogari nuk mund ta bëjë këtë drejtpërdrejt. Kyçuni si administrator.');
    }
    throw error;
  }
  return { state: step.to };
}

function apiMissing(error: unknown): boolean {
  const e = error as { status?: number; code?: string; message?: string };
  return e?.code === API_UNAVAILABLE_CODE || e?.status === 503 || e?.status === 502 || e?.status === 504 || e?.status === 404
    || (e instanceof TypeError);
}

/** Take a decision; the server checks who, from which state, and the reason. */
export async function takeDecision(
  kind: DecisionKind,
  id: string,
  action: string,
  options: { reason?: string; campaignId?: string } = {}
): Promise<{ state: string }> {
  let result: Record<string, unknown>;
  try {
    result = await call('POST', `/api/v1/admin/decisions/${kind}/${encodeURIComponent(id)}`, { action, ...options });
  } catch (error) {
    if (apiMissing(error)) return takeDecisionDirect(kind, id, action, options);
    throw error;
  }
  return { state: String(result.state ?? '') };
}

export async function loadDecisionHistory(kind: DecisionKind, id: string): Promise<DecisionRecord[]> {
  try {
    const result = await call('GET', `/api/v1/admin/decisions/${kind}/${encodeURIComponent(id)}`);
    return Array.isArray(result.items) ? result.items : [];
  } catch (error) {
    if (apiMissing(error)) return [];
    throw error;
  }
}

/**
 * The one place that knows how to talk to the admin API as the signed-in staff
 * member, and how to explain a refusal in terms the operator can act on.
 *
 * Why this exists: the admin endpoints are guarded by the server's `requireAuth`,
 * which rejects any request without a valid Firebase ID token with the message
 * "Unauthorized: Missing or invalid token". That message is deliberately
 * ambiguous — it never distinguishes "no token" from "expired token" from
 * "wrong account", so that it cannot be used to enumerate accounts.
 *
 * The cost of that choice is that a very ordinary situation produces a very
 * confusing error. If the browser is running as a guest (or the staff member was
 * signed out in another tab), `auth.currentUser` is `null`, no Authorization
 * header is attached, and the server's generic message is what the operator
 * sees — which reads like a server fault rather than "you are not signed in".
 *
 * So the client is the only layer that can tell the two apart, and it must:
 * it knows whether it has a session at all. {@link requireAdminToken} refuses to
 * send a request it knows will fail, with a message that names the real problem,
 * and {@link describeApiFailure} translates the server's 401 back into the same
 * plain language when the token was present but rejected.
 */
import { auth } from './firebase';

/** The server's generic guard message, matched so it can be replaced. */
const SERVER_AUTH_ERROR = 'Missing or invalid token';

/**
 * A short, actionable message for "you are not signed in as staff".
 *
 * Deliberately not the server's wording: the operator needs to know what to do,
 * and "Kyçuni përsëri" is the action, whereas "token" is an implementation
 * detail they cannot act on.
 */
export const NOT_SIGNED_IN_MESSAGE =
  'Nuk jeni të kyçur si staf. Kyçuni me llogari administratori dhe provoni përsëri.';

/**
 * Get an ID token, or explain why there is none.
 *
 * `getIdToken(true)` forces a refresh so a token that expired while the form was
 * open does not produce a spurious 401 — the common case when an operator leaves
 * the panel open and comes back to it.
 */
export async function requireAdminToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error(NOT_SIGNED_IN_MESSAGE);

  try {
    return await user.getIdToken(true);
  } catch (error) {
    // A revoked or deleted account lands here rather than at the fetch, and the
    // distinction matters: signing out is the fix, not retrying.
    console.error('[AdminAPI] Failed to obtain ID token:', (error as Error)?.message);
    throw new Error('Sesioni ka skaduar ose llogaria u revokua. Kyçuni përsëri.');
  }
}

/**
 * Turn an API refusal into a message worth showing.
 *
 * A 401 or 403 from the admin API is never really about the token in front of
 * the operator — it means the session is not a signed-in staff session — so it
 * is reported as such. Any other status keeps the server's own wording, which
 * for validation errors ("Fjalëkalimi duhet të ketë 8–128 shenja") is already
 * the best possible message.
 */
export function describeApiFailure(status: number, body: unknown): string {
  const serverMessage =
    body && typeof body === 'object' && 'error' in body
      ? String((body as { error?: unknown }).error ?? '')
      : '';

  if (status === 401 || status === 403) {
    // Keep the server's wording only when it says something more specific than
    // the generic guard message (e.g. "Forbidden: Requires superadmin").
    if (serverMessage && !serverMessage.includes(SERVER_AUTH_ERROR)) return serverMessage;
    return NOT_SIGNED_IN_MESSAGE;
  }

  return serverMessage || `Kërkesa dështoi (HTTP ${status}).`;
}

/**
 * Move a report along the approval pipeline — through the server, not around it.
 *
 * ─── Why this is a fetch and not an updateDoc ───────────────────────────────
 *
 * Writing `status` from the client is now refused by Firestore rules. The state
 * machine (agent → municipality → staff) lives on the server, in
 * `server/approvalPipeline.ts`, and this is the only door into it. That is what
 * makes the gates real: a client may *ask* to pass a report to a municipality,
 * but it cannot *assert* that it was approved, because the endpoint derives the
 * next status from the rule table rather than from the request body.
 *
 * The guard refuses to send a request it knows will fail — no signed-in session,
 * or a transition the client's own copy of the policy already rules out — so the
 * ordinary "you are not signed in" case produces a message that names the fix
 * instead of a 401 the operator has to interpret.
 */
import type { IssueStatus } from '../types';

export interface TransitionResult {
  id: string;
  status: IssueStatus;
  stage: string;
}

/**
 * Ask the server to apply a transition.
 *
 * `transition` is the *intent* ('pass_to_municipality'), not a status. The server
 * decides what status that means, which is why a modified client cannot turn
 * "claim" into "Approved".
 */
export async function applyTransition(input: {
  reportId: string;
  transition: string;
  note?: string;
  resolvedImage?: string;
  assignedTo?: string;
}): Promise<TransitionResult> {
  const token = await requireAdminToken();

  const response = await fetch(`/api/v1/reports/${encodeURIComponent(input.reportId)}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      transition: input.transition,
      note: input.note ?? '',
      resolvedImage: input.resolvedImage,
      assignedTo: input.assignedTo,
    }),
  });

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // A non-JSON error body is possible (a proxy, a crash page); the status
      // alone is still enough for `describeApiFailure` to produce a message.
    }
    throw new Error(describeApiFailure(response.status, body));
  }

  return (await response.json()) as TransitionResult;
}

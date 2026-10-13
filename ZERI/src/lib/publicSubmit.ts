import { auth } from './firebase';

export interface PublicSubmitResult {
  ok: boolean;
  status: number;
  /** Stored reference, present only when the server confirmed the write. */
  reference: string | null;
  error: string | null;
  fields: Record<string, string>;
}

/**
 * POST to a public server endpoint (contact, ideas, feedback).
 *
 * Success means the server answered 2xx with `ok: true`, nothing else. A network
 * failure, a 4xx/5xx or a malformed reply all come back as `ok: false` with a
 * message the page can show, so no caller can announce a send that did not happen.
 * A signed-in visitor's token is attached when one exists so the server can record
 * the real author; it never waits for a session that is not there.
 */
export async function postPublic(path: string, body: Record<string, unknown>): Promise<PublicSubmitResult> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const user = auth.currentUser;
      if (user && !user.isAnonymous) headers.Authorization = `Bearer ${await user.getIdToken()}`;
    } catch {
      // Anonymous submission is fine.
    }
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok === true) {
      return { ok: true, status: res.status, reference: data.reference ?? null, error: null, fields: {} };
    }
    return {
      ok: false,
      status: res.status,
      reference: null,
      error: typeof data?.error === 'string' ? data.error : 'Dërgimi dështoi. Provoni përsëri.',
      fields: data?.fields && typeof data.fields === 'object' ? data.fields : {},
    };
  } catch {
    return { ok: false, status: 0, reference: null, error: 'Nuk u arrit lidhja me serverin. Kontrolloni internetin dhe provoni përsëri.', fields: {} };
  }
}

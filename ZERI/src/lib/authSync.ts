import type { User } from 'firebase/auth';

/**
 * The server half of signing in: `POST /api/v1/auth/sync` creates the profile on first
 * sign-in (so the role is never chosen by the browser) and confirms it otherwise.
 *
 * It used to be called with `if (!response.ok) throw new Error('Backend sync failed')`.
 * That error has no Firebase `code`, so the login page showed "Hyrja me Google dështoi
 * (gabim i panjohur)" even though Google had accepted the person: the real cause (the
 * server could not verify the token, or could not reach Firestore) was thrown away, and an
 * administrator whose profile already existed was locked out by a step they did not need.
 */

export interface SyncResult {
  ok: boolean;
  /** HTTP status, or 0 when the server could not be reached at all. */
  status: number;
  /** The server's own explanation, when it gave one. */
  serverMessage: string;
}

export const PROFILE_SYNC_FAILED = 'zeri/profile-sync-failed';

export async function syncProfile(user: Pick<User, 'getIdToken'>, body: Record<string, unknown>): Promise<SyncResult> {
  try {
    const token = await user.getIdToken();
    const response = await fetch('/api/v1/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (response.ok) return { ok: true, status: response.status, serverMessage: '' };
    const result = await response.json().catch(() => ({}));
    return { ok: false, status: response.status, serverMessage: typeof result?.error === 'string' ? result.error : '' };
  } catch {
    return { ok: false, status: 0, serverMessage: '' };
  }
}

/**
 * Sync with the server; when the server cannot do it (no Admin credentials, 5xx, offline)
 * fall back to creating the person's own profile from the browser. Firestore rules allow
 * exactly that for a first sign-in as long as no privileged field (role, points, ...) is
 * written, so the account is still a plain citizen. Returns ok when a profile exists.
 */
export async function syncOrCreateProfile(
  user: Pick<User, 'getIdToken' | 'uid'>,
  body: Record<string, unknown>,
): Promise<SyncResult> {
  const sync = await syncProfile(user, body);
  if (sync.ok || sync.status === 400 || sync.status === 429) return sync;
  try {
    const [{ doc, getDoc, setDoc, serverTimestamp }, { db }] = await Promise.all([
      import('firebase/firestore'),
      import('./firebase'),
    ]);
    const ref = doc(db, 'users', user.uid);
    if (!(await getDoc(ref)).exists()) {
      await setDoc(ref, {
        id: user.uid,
        name: typeof body.name === 'string' ? body.name : '',
        avatar: typeof body.avatar === 'string' ? body.avatar : '',
        createdAt: serverTimestamp(),
      });
    }
    return { ok: true, status: 200, serverMessage: '' };
  } catch {
    return sync;
  }
}

/** What to tell the person, in plain Albanian, for a failed sync. Pure. */
export function syncFailureMessage(result: SyncResult): string {
  const detail = result.serverMessage ? ` ${result.serverMessage}` : '';
  switch (result.status) {
    case 0:
      return 'Google ju njohu, por serveri i platformës nuk u arrit. Kontrolloni lidhjen ose që serveri është në punë.';
    case 400:
      return `Google ju njohu, por profili nuk u krijua:${detail || ' të dhënat nuk janë të vlefshme.'}`;
    case 401:
    case 403:
      return `Google ju njohu, por serveri nuk e pranoi hyrjen (${result.status}). Serveri duhet të përdorë të njëjtin projekt Firebase si faqja.${detail}`;
    case 429:
      return 'Shumë përpjekje hyrjeje. Prisni pak minuta dhe provoni përsëri.';
    case 503:
      return 'Google ju njohu, por serveri nuk ka qasje në bazën e të dhënave (503). Administratori duhet të vendosë kredencialet e Firebase Admin në server.';
    default:
      return `Google ju njohu, por serveri ktheu gabim (${result.status}).${detail} Provoni përsëri.`;
  }
}

/** An error carrying the sync failure, so the page's error handling can show it as is. */
export function profileSyncError(result: SyncResult): Error & { code: string } {
  return Object.assign(new Error(syncFailureMessage(result)), { code: PROFILE_SYNC_FAILED });
}

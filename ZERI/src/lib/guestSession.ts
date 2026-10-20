import { signInAnonymously, signInWithCustomToken, type User } from 'firebase/auth';
import { auth } from './firebase';
import { apiReady } from './apiAvailability';
import { fetchWithTimeout, isJsonResponse, withTimeout } from './timeouts';

/**
 * A real, persistent guest identity, whatever the Firebase project allows.
 *
 * 1. Firebase Anonymous auth, when the provider is on.
 * 2. Otherwise a guest session minted by the platform server (POST /api/v1/guest/session):
 *    a custom token for a `guest_…` uid. The visitor is still a Firebase user, so reports,
 *    photos and health cases are stored and tracked exactly as for anyone signed in,
 *    and the session survives reloads.
 *
 * A guest never needs to register. Registering only adds a name and recovery.
 */
export const GUEST_UID_PREFIX = 'guest_';

/** True for an anonymous account and for a server-minted guest. */
export function isGuestFirebaseUser(user: Pick<User, 'isAnonymous' | 'uid'> | null | undefined): boolean {
  return Boolean(user && (user.isAnonymous || user.uid.startsWith(GUEST_UID_PREFIX)));
}

export type GuestSignInResult = { ok: true; uid: string } | { ok: false; reason: string };

let pending: Promise<GuestSignInResult> | null = null;

export function signInAsGuest(): Promise<GuestSignInResult> {
  if (!pending) pending = run().finally(() => { pending = null; });
  return pending;
}

async function run(): Promise<GuestSignInResult> {
  await withTimeout(auth.authStateReady(), 8000, 'timeout').catch(() => undefined);
  // Never replace a session that already exists (a signed-in citizen or staff member).
  if (auth.currentUser?.uid) return { ok: true, uid: auth.currentUser.uid };

  let anonymousCode = '';
  try {
    const credential = await withTimeout(signInAnonymously(auth), 15000, 'timeout');
    return { ok: true, uid: credential.user.uid };
  } catch (error) {
    anonymousCode = (error as { code?: string })?.code || (error as Error)?.message || '';
  }

  try {
    if (!(await apiReady())) {
      return { ok: false, reason: 'Mysafiri nuk mund të hapet: Anonymous Auth është joaktiv dhe serveri i platformës nuk përgjigjet.' };
    }
    const response = await fetchWithTimeout('/api/v1/guest/session', { method: 'POST' }, 15000);
    const body = isJsonResponse(response) ? await response.json().catch(() => null) as { token?: string; error?: string } | null : null;
    if (!response.ok || !body?.token) {
      return { ok: false, reason: body?.error || `Sesioni i mysafirit nuk u krijua (${anonymousCode || response.status}).` };
    }
    const credential = await withTimeout(signInWithCustomToken(auth, body.token), 15000, 'timeout');
    return { ok: true, uid: credential.user.uid };
  } catch (error) {
    return { ok: false, reason: `Sesioni i mysafirit nuk u krijua (${(error as Error)?.message || anonymousCode}).` };
  }
}

import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { getOrCreateGuestUser } from './session';
import { withTimeout } from './timeouts';

/**
 * Guarantees an authenticated Firebase session before a report is written.
 *
 * The `reports` rule requires `authorId == request.auth.uid`, so a report can
 * only be persisted when a real uid exists. Signed-in citizens already have
 * one; visitors are upgraded to an anonymous account when the project allows
 * it. Returning `null` means no write can succeed, and the caller must tell
 * the citizen instead of showing a Track ID for a report that was never saved.
 */
let pendingSession: Promise<string | null> | null = null;

/** One sign-in at a time: the warm-up on page open and the submit share it. */
export function ensureReportSession(): Promise<string | null> {
  if (!pendingSession) {
    pendingSession = startReportSession()
      .then(async (uid) => {
        if (uid && auth.currentUser?.uid === uid) await ensureOwnProfile(uid);
        return uid;
      })
      .finally(() => { pendingSession = null; });
  }
  return pendingSession;
}

const profileReady = new Set<string>();

/**
 * The `reports` create rule calls canAct(), which reads users/{uid} to check for a ban.
 * A first-time anonymous visitor has no profile (the server's /api/v1/auth/sync makes
 * it, and there may be no server), so that read failed and every report was refused.
 * Google and e-mail sign-ups already create their own profile from the browser
 * (authSync.ts); this does the same for a guest, with the fields the users rule
 * allows a person to write for themselves and nothing privileged.
 */
async function ensureOwnProfile(uid: string): Promise<void> {
  if (profileReady.has(uid)) return;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await withTimeout(getDoc(ref), 8000, 'timeout');
    if (!snap.exists()) {
      await withTimeout(setDoc(ref, { id: uid, name: '', avatar: '', createdAt: serverTimestamp() }), 10000, 'timeout');
    }
    profileReady.add(uid);
  } catch {
    // Not fatal here: the write that follows reports its own error to the citizen.
  }
}

async function startReportSession(): Promise<string | null> {
  // Until Firebase has restored a saved session, `currentUser` is null even for a
  // signed-in citizen; signing in anonymously then would replace their account.
  await withTimeout(auth.authStateReady(), 8000, 'timeout').catch(() => undefined);
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  try {
    // Bounded: a blocked App Check token or a dead link left this pending forever.
    const credential = await withTimeout(signInAnonymously(auth), 15000, 'Sesioni nuk u krijua në kohë.');
    return credential.user.uid;
  } catch {
    const guestUser = getOrCreateGuestUser();
    return guestUser.id;
  }
}

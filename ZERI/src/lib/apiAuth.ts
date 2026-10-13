import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';

/**
 * Resolve the signed-in Firebase user, waiting briefly for the anonymous guest
 * session that App.tsx starts on first load.
 *
 * Server routes that call a paid model now require a Firebase ID token. A visitor
 * who opens the dashboard is signed in anonymously a moment *after* first render,
 * so asking for the token immediately would race that sign-in and fail.
 */
function waitForUser(timeoutMs: number): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve) => {
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser);
    }, timeoutMs);
    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Request headers for a same-origin API call, with `Authorization` when a
 * session exists. With no session the call is sent without it and the server
 * answers 401, which every caller already treats as "feature unavailable".
 */
export async function authHeaders(base: Record<string, string> = {}): Promise<Record<string, string>> {
  try {
    const user = await waitForUser(4000);
    if (user) return { ...base, Authorization: `Bearer ${await user.getIdToken()}` };
  } catch {
    // Fall through: no usable session.
  }
  return base;
}

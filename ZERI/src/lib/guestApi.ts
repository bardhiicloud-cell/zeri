import type { User as FirebaseUser } from 'firebase/auth';
import type { User } from '../types';
import { fetchWithTimeout, isJsonResponse } from './timeouts';

/**
 * Gives an anonymous (guest) account its number and profile, through the server
 * (POST /api/v1/guest/register; see server/guestNumbers.ts). Idempotent.
 *
 * If the server cannot be reached the guest still has a real identity: the Firebase uid.
 * They are shown as plain "Mysafir" until the next load succeeds; no number is invented here.
 */
export async function registerGuest(user: Pick<FirebaseUser, 'uid' | 'getIdToken'>): Promise<User> {
  // A sleeping or restarting server answers the first call late or not at all, which used to
  // leave the guest without a number until the next page load. Retry once here; keepRegisteringGuest continues in the background.
  for (const delay of [0, 2000]) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    const profile = await tryRegister(user);
    if (profile) return profile;
  }
  return plainGuest(user.uid);
}

const plainGuest = (uid: string) =>
  ({ id: uid, name: 'Mysafir', email: '', role: 'guest', points: 0, badges: [], isVerified: false } as unknown as User);

async function tryRegister(user: Pick<FirebaseUser, 'uid' | 'getIdToken'>): Promise<User | null> {
  try {
    const token = await user.getIdToken();
    const response = await fetchWithTimeout('/api/v1/guest/register', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }, 15000);
    if (response.ok && isJsonResponse(response)) {
      const body = await response.json();
      if (body?.profile?.id === user.uid) return body.profile as User;
    } else {
      console.warn('[GUEST] number not assigned:', response.status);
    }
  } catch (error) {
    console.warn('[GUEST] number not assigned:', error instanceof Error ? error.message : error);
  }
  return null;
}

/**
 * Keeps trying in the background (every 30 s, up to 20 times) for a guest who is still
 * without a number, and hands the profile over as soon as the server issues it.
 */
export function keepRegisteringGuest(user: Pick<FirebaseUser, 'uid' | 'getIdToken'>, onProfile: (profile: User) => void): () => void {
  let stopped = false;
  let attempts = 0;
  const tick = async () => {
    if (stopped || attempts++ >= 20) return;
    const profile = await tryRegister(user);
    if (stopped) return;
    if (profile) onProfile(profile);
    else setTimeout(tick, 30000);
  };
  const timer = setTimeout(tick, 30000);
  return () => { stopped = true; clearTimeout(timer); };
}

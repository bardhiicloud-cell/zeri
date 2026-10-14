import type { User as FirebaseUser } from 'firebase/auth';
import type { User } from '../types';

/**
 * Gives an anonymous (guest) account its number and profile, through the server
 * (POST /api/v1/guest/register; see server/guestNumbers.ts). Idempotent.
 *
 * If the server cannot be reached the guest still has a real identity: the Firebase uid.
 * They are shown as plain "Mysafir" until the next load succeeds; no number is invented here.
 */
export async function registerGuest(user: Pick<FirebaseUser, 'uid' | 'getIdToken'>): Promise<User> {
  try {
    const token = await user.getIdToken();
    const response = await fetch('/api/v1/guest/register', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) {
      const body = await response.json();
      if (body?.profile?.id === user.uid) return body.profile as User;
    } else {
      console.warn('[GUEST] number not assigned:', response.status);
    }
  } catch (error) {
    console.warn('[GUEST] number not assigned:', error instanceof Error ? error.message : error);
  }
  return { id: user.uid, name: 'Mysafir', email: '', role: 'guest', points: 0, badges: [], isVerified: false } as unknown as User;
}

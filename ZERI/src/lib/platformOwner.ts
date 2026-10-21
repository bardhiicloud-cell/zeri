/**
 * The platform owner's email, for the screen only: to show "Pronar" and to hide controls that can never
 * work on that account. It decides nothing: the server and the Firestore rules read the verified token
 * (server/owner.ts), so editing this constant in a browser grants nothing.
 */
export const PLATFORM_OWNER_EMAIL = 'bardhiicloud@gmail.com';

export const isPlatformOwnerEmail = (email?: string | null): boolean =>
  String(email ?? '').trim().toLowerCase() === PLATFORM_OWNER_EMAIL;

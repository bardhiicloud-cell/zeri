/**
 * The platform owner: the one account above every superadmin.
 *
 * The owner is still a superadmin to every check in the system (role `superadmin`, flags `admin` and
 * `superadmin`), so nothing that works for a superadmin stops working. What the owner adds is
 * authority OVER superadmins: only the owner may create, demote, ban or remove a superadmin, and
 * nobody can change or remove the owner.
 *
 * Authority is never read from a profile document or from anything a browser can write. It is the
 * custom claim `owner: true`, which only scripts/make-owner.ts writes (with the service account), AND
 * the sign-in email being the owner's. Both must hold, so a claim copied onto another account, or an
 * account that merely uses the owner's email without the claim, gets nothing.
 *
 * Protection works the other way round and is deliberately wider: an account counts as "the owner"
 * for protection if it has the claim OR the email, so it fails safe.
 */

export const PLATFORM_OWNER_EMAIL = (process.env.PLATFORM_OWNER_EMAIL || 'bardhiicloud@gmail.com').trim().toLowerCase();

export interface OwnerIdentity {
  email?: string | null;
  claims?: Record<string, unknown> | null;
}

const sameEmail = (email?: string | null) => String(email ?? '').trim().toLowerCase() === PLATFORM_OWNER_EMAIL;

/** Is this signed-in account the owner? Needs the `owner` claim, the `superadmin` claim and the owner's email. */
export function isPlatformOwnerAccount(who: OwnerIdentity): boolean {
  const claims = who.claims ?? {};
  return claims.owner === true && claims.superadmin === true && sameEmail(who.email);
}

/** Must this account be protected as the owner? The claim OR the email is enough. */
export function isProtectedOwner(who: OwnerIdentity): boolean {
  return (who.claims ?? {}).owner === true || sameEmail(who.email);
}

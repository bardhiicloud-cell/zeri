import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db, authAdmin } from './firebaseAdmin';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { AdminSection } from '../src/lib/adminPermissions';
import { mayUseSection } from './policy';

/**
 * Authentication and security middleware.
 *
 * Two things here are load-bearing at national scale:
 *
 *  1. The error handler. Auth failures must never leak whether a given email
 *     exists, so every rejection path returns the same generic message.
 *  2. The audit log. Law 06/L-082 and the platform's own accountability
 *     requirements mean every privileged action has to be attributable.
 */

export interface AuthedUser {
  uid: string;
  email?: string;
  role: string;
  claims: Record<string, unknown>;
}

/** Extend Express's Request with the authenticated principal. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

const BEARER = /^Bearer\s+(.+)$/i;

/** Single generic message: revealing which half failed is a user-enumeration bug. */
export const GENERIC_AUTH_ERROR = 'Unauthorized: Missing or invalid token';

export const requireAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const match = BEARER.exec(req.headers.authorization ?? '');
  if (!match) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="ZERI"');
    return res.status(401).json({ error: GENERIC_AUTH_ERROR });
  }

  try {
    const decoded = await authAdmin().verifyIdToken(match[1], true);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: String((decoded as Record<string, unknown>).role ?? 'citizen'),
      claims: decoded as Record<string, unknown>,
    };
    return next();
  } catch (error) {
    console.error('[AUTH] Token verification failed:', (error as Error)?.message);
    return res.status(401).json({ error: GENERIC_AUTH_ERROR });
  }
};

/**
 * Section permissions granted to the caller, read from the verified token.
 *
 * `buildRoleClaims` flattens every permission into a `perm_<name>` boolean claim
 * that only the Admin SDK can write. The `permissions` array on the profile
 * document is client-writable and must never be used to decide authority.
 */
export function permissionsFromClaims(claims: Record<string, unknown>): string[] {
  return Object.keys(claims)
    .filter((key) => key.startsWith('perm_') && claims[key] === true)
    .map((key) => key.slice('perm_'.length));
}

/**
 * The acting account, resolved from the verified token and nothing else.
 *
 * `municipality` lives under `req.user.claims`; reading it off `req.user`
 * directly always yielded `undefined`, which silently disabled every
 * municipality jurisdiction check that relied on it.
 */
export function actingUser(req: { user?: AuthedUser }) {
  const user = req.user;
  const claims = user?.claims ?? {};
  return {
    uid: String(user?.uid ?? ''),
    email: String(user?.email ?? ''),
    role: String(user?.role || 'citizen'),
    municipality: String(claims.municipality ?? ''),
    permissions: permissionsFromClaims(claims),
  };
}

/** Roles that may reach the admin surface. Mirrors the Firestore rules. */
export const ADMIN_ROLES = new Set([
  'admin', 'superadmin', 'approver', 'adsadmin', 'newsadmin', 'debatwp',
  'agent', 'responder', 'dispatcher', 'moderator', 'monitor',
]);

/**
 * Whether a role stored on the user *document* may stand in for a missing token
 * claim. OFF by default.
 *
 * The profile `role` field is not a safe source of authority: an account holding
 * the `admin` role could write it onto any other user's document and, because that
 * account carried no claim, the server would then treat it as staff. Authority
 * comes from the verified ID token only. Accounts that predate custom claims must
 * be migrated with `npm run claims:sync`; set ALLOW_PROFILE_ROLE_FALLBACK=true
 * only for the short window while that runs, then remove it.
 */
export const PROFILE_ROLE_FALLBACK = process.env.ALLOW_PROFILE_ROLE_FALLBACK === 'true';

/**
 * The caller's role, from verified token claims (and, only if explicitly enabled,
 * the profile document). Returns '' when the token carries no role - the caller
 * is then treated as having none, which every guard denies.
 */
export async function resolveActorRole(user: AuthedUser | undefined): Promise<string> {
  if (!user) return '';
  const claimRole = String(user.claims.role ?? '');
  if (claimRole) return claimRole;
  if (user.claims.admin === true) return 'admin';
  if (!PROFILE_ROLE_FALLBACK) return '';
  try {
    const snap = await db().collection('users').doc(user.uid).get();
    return String(snap.data()?.role ?? '');
  } catch (error) {
    console.error('[AUTH] Role lookup failed:', (error as Error)?.message);
    return '';
  }
}

export const requireAdmin: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // A custom claim is authoritative: it is set by a server-side process and
  // cannot be written by the client, unlike a field on the user document.
  const claimRole = String(req.user.claims.role ?? req.user.claims.admin ?? '');
  if (ADMIN_ROLES.has(claimRole)) {
    return next();
  }

  // The profile document is deliberately not consulted (see PROFILE_ROLE_FALLBACK).
  if (PROFILE_ROLE_FALLBACK && ADMIN_ROLES.has(await resolveActorRole(req.user))) return next();

  return res.status(403).json({ error: 'Forbidden: Requires admin role' });
};

/**
 * Gate a route on an admin section, using the same role -> section table the UI
 * uses (see server/policy.ts). `requireAdmin` only answers "is this any kind of
 * staff?", which let an ads or news editor call endpoints that list every user's
 * profile or review municipal work claims. Use this where a route belongs to a
 * specific section; it must run after `requireAuth`.
 */
export function requireSection(section: AdminSection): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const role = await resolveActorRole(req.user);

    const permissions = permissionsFromClaims(req.user.claims);
    if (ADMIN_ROLES.has(role) && mayUseSection({ role, permissions }, section)) return next();

    return res.status(403).json({ error: 'Forbidden: your role does not include this section' });
  };
}

/**
 * Append-only audit trail.
 *
 * Failures are swallowed on purpose: an audit write must never take down the
 * action it is recording. The log is written with a server timestamp and a
 * random id, never with client-supplied fields.
 */
export function audit(
  action: string,
  req: Request,
  detail: Record<string, unknown> = {}
): void {
  void (async () => {
    try {
      await db().collection('auditLogs').add({
        action,
        actorUid: req.user?.uid ?? null,
        actorEmail: req.user?.email ?? null,
        actorRole: req.user?.role ?? null,
        ip: req.ip ?? null,
        path: req.path,
        method: req.method,
        detail,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error(`[AUDIT] Failed to record "${action}":`, (error as Error)?.message);
    }
  })();
}

/**
 * Security headers that do not belong to helmet's default set.
 *
 * `Permissions-Policy` is the modern replacement for Feature-Policy and is what
 * stops a compromised third-party embed from reaching the microphone, camera or
 * geolocation of a citizen's session.
 */
export const permissionsPolicy = [
  'geolocation=(self)',
  'camera=()',
  'microphone=()',
  'payment=()',
  'usb=()',
  /**
   * Only features this engine recognises are listed.
   *
   * `interest-cohort` (FLoC) and `browsing-topics` are both retired names in
   * current Chromium, and an unrecognised token makes the browser log
   * "Unrecognized feature" on every response. The header is supposed to close
   * privacy-sensitive surfaces, not to generate console noise, so unknown
   * tokens are dropped rather than shipped. Add one back only when the engine
   * being deployed to actually implements it.
   */
].join(', ');

export const securityHeaders: RequestHandler = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Permissions-Policy', permissionsPolicy);
  res.setHeader('X-Robots-Tag', 'index, follow');
  // The API never returns HTML, so a frame or a form post is never legitimate.
  res.setHeader('X-Frame-Options', 'DENY');
  next();
};

/** Constant-time string comparison for tokens and webhook signatures. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

import crypto from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db, authAdmin } from './firebaseAdmin';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

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

/** Roles that may reach the admin surface. Mirrors the Firestore rules. */
export const ADMIN_ROLES = new Set([
  'admin', 'superadmin', 'approver', 'adsadmin', 'newsadmin',
  'agent', 'responder', 'dispatcher', 'moderator',
]);

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

  // Fall back to the profile document for accounts that predate custom claims.
  try {
    const snap = await db().collection('users').doc(req.user.uid).get();
    const role = snap.exists ? String(snap.data()?.role ?? '') : '';
    if (ADMIN_ROLES.has(role)) return next();
  } catch (error) {
    console.error('[AUTH] Role lookup failed:', (error as Error)?.message);
  }

  return res.status(403).json({ error: 'Forbidden: Requires admin role' });
};

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

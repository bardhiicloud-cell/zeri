import crypto from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
const BEARER = /^Bearer\s+(.+)$/i;
/** Single generic message: revealing which half failed is a user-enumeration bug. */
export const GENERIC_AUTH_ERROR = 'Unauthorized: Missing or invalid token';
export const requireAuth = async (req, res, next) => {
    const match = BEARER.exec(req.headers.authorization ?? '');
    if (!match) {
        res.setHeader('WWW-Authenticate', 'Bearer realm="ZERI"');
        return res.status(401).json({ error: GENERIC_AUTH_ERROR });
    }
    try {
        const decoded = await getAuth().verifyIdToken(match[1], true);
        req.user = {
            uid: decoded.uid,
            email: decoded.email,
            role: String(decoded.role ?? 'citizen'),
            claims: decoded,
        };
        return next();
    }
    catch (error) {
        console.error('[AUTH] Token verification failed:', error?.message);
        return res.status(401).json({ error: GENERIC_AUTH_ERROR });
    }
};
/** Roles that may reach the admin surface. Mirrors the Firestore rules. */
export const ADMIN_ROLES = new Set([
    'admin', 'superadmin', 'approver', 'adsadmin', 'newsadmin',
    'agent', 'responder', 'dispatcher', 'moderator',
]);
export const requireAdmin = async (req, res, next) => {
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
        const snap = await getFirestore().collection('users').doc(req.user.uid).get();
        const role = snap.exists ? String(snap.data()?.role ?? '') : '';
        if (ADMIN_ROLES.has(role))
            return next();
    }
    catch (error) {
        console.error('[AUTH] Role lookup failed:', error?.message);
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
export function audit(action, req, detail = {}) {
    void (async () => {
        try {
            await getFirestore().collection('auditLogs').add({
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
        }
        catch (error) {
            console.error(`[AUDIT] Failed to record "${action}":`, error?.message);
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
    'interest-cohort=()',
].join(', ');
export const securityHeaders = (_req, res, next) => {
    res.setHeader('Permissions-Policy', permissionsPolicy);
    res.setHeader('X-Robots-Tag', 'index, follow');
    // The API never returns HTML, so a frame or a form post is never legitimate.
    res.setHeader('X-Frame-Options', 'DENY');
    next();
};
/** Constant-time string comparison for tokens and webhook signatures. */
export function safeEqual(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length)
        return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

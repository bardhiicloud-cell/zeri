import type { Request, Response, NextFunction } from 'express';

/**
 * The public Debate is switched off until the owner reopens it (decision of
 * 2026-10-16: "hidden from the whole site until the expansion work is done").
 *
 * This is the single server switch. It defaults to OFF; the Debate returns only when
 * the environment sets DEBATE_PUBLIC_ENABLED=true. The web client has the matching flag
 * in src/lib/featureFlags.ts. Staff tooling keeps working while it is off: the Debate
 * admin console (/api/v1/debate/*), moderation (/api/v1/moderation/*), and the report
 * and verification queues that staff review.
 */
export const debatePublicEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  String(env.DEBATE_PUBLIC_ENABLED ?? '').toLowerCase() === 'true';

/** Citizen-facing Debate endpoints that must be closed while it is hidden. */
const CITIZEN_PREFIXES = [
  '/api/v1/forum/posts', '/api/v1/forum/reels', '/api/v1/forum/stories', '/api/v1/forum/dm',
  '/api/v1/forum/follow', '/api/v1/forum/followers-feed', '/api/v1/forum/people', '/api/v1/forum/blocks',
  '/api/v1/forum/scheduled', '/api/v1/forum/analytics', '/api/v1/forum/verification/', '/api/v1/forum/verification-requests/mine',
  '/api/v1/forum/verified-ids', '/api/v1/forum/feed',
];

/** Staff moderation of a post stays reachable: removing and restoring content. */
const STAFF_ESCAPES: Array<{ method: string; pattern: RegExp }> = [
  { method: 'DELETE', pattern: /^\/api\/v1\/forum\/posts\/[^/]+$/ },
  { method: 'POST', pattern: /^\/api\/v1\/forum\/posts\/[^/]+\/restore$/ },
];

export function isClosedDebatePath(method: string, path: string): boolean {
  if (!path.startsWith('/api/v1/forum')) return false;
  if (STAFF_ESCAPES.some(rule => rule.method === method.toUpperCase() && rule.pattern.test(path))) return false;
  return CITIZEN_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`) || path === prefix);
}

export function debateGate(enabled: () => boolean = () => debatePublicEnabled()) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (enabled() || !isClosedDebatePath(req.method, req.path)) return next();
    return res.status(404).json({ error: 'Debati publik nuk është i hapur për momentin.', code: 'DEBATE_CLOSED' });
  };
}

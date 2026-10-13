import type { Request, Response, NextFunction } from 'express';
import type { RequestHandler } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Resolve the client IP.
 *
 * Express already does this correctly once `app.set('trust proxy', 1)` is set:
 * it takes the entry the single trusted proxy appended (the one *before* the
 * proxy's own address), which a client cannot forge. Reading the FIRST
 * `X-Forwarded-For` entry by hand, as this function used to, does the opposite:
 * that is the part the caller writes, so sending `X-Forwarded-For: <random>` gave
 * every request a fresh rate-limit bucket and the limiter never limited anything.
 */
export function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

/** A windowed counter keyed by IP, with an escalating temporary ban on abuse. */
export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** After this multiple of `max` within one window the IP is banned outright. */
  floodFactor?: number;
  banMs?: number;
  message: string;
  code: string;
}

export function createIpRateLimiter({
  windowMs,
  max,
  floodFactor = 2,
  banMs = 120_000,
  message,
  code,
}: RateLimitOptions): RequestHandler {
  interface Record_ {
    count: number;
    resetAt: number;
    bannedUntil: number;
  }

  const buckets = new Map<string, Record_>();

  // Periodic sweep so a long-running worker cannot accumulate one entry per
  // attacker IP for the lifetime of the process.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of buckets) {
      if (record.resetAt <= now && record.bannedUntil <= now) {
        buckets.delete(ip);
      }
    }
  }, Math.min(windowMs, 60_000));
  // Never keep the event loop alive just for the sweep.
  if (typeof sweeper.unref === 'function') sweeper.unref();

  const middleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const now = Date.now();

    let record = buckets.get(ip);
    if (!record || (record.resetAt <= now && record.bannedUntil <= now)) {
      record = { count: 0, resetAt: now + windowMs, bannedUntil: 0 };
      buckets.set(ip, record);
    }

    const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000));

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - record.count)));
    res.setHeader('X-RateLimit-Reset', String(retryAfter));

    if (record.bannedUntil > now) {
      const banSeconds = Math.ceil((record.bannedUntil - now) / 1000);
      res.setHeader('Retry-After', String(banSeconds));
      return res.status(429).json({
        error: message,
        code,
        retryAfter: banSeconds,
        status: 'IP_BLOCKED',
      });
    }

    record.count += 1;

    if (record.count > max) {
      if (record.count > max * floodFactor) {
        record.bannedUntil = now + banMs;
        buckets.set(ip, record);
        if (isProduction) {
          console.error(`[SECURITY] IP banuara ${ip} pas ${record.count} kërkesash në ${windowMs}ms`);
        }
        const banSeconds = Math.ceil(banMs / 1000);
        res.setHeader('Retry-After', String(banSeconds));
        return res.status(429).json({
          error: 'Sistemi detektoi trafik agresiv. IP-ja u bllokua përkohësisht.',
          code: 'FLOOD_MITIGATION',
          retryAfter: banSeconds,
          status: 'IP_BLOCKED',
        });
      }

      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: message,
        code,
        retryAfter: retryAfter,
        status: 'RATE_LIMITED',
      });
    }

    return next();
  };

  return middleware;
}

/**
 * The AI widget is the most expensive surface in the app: one chat turn costs
 * more than a thousand cached page views, and it is directly reachable from the
 * browser. Five requests per minute per IP is the documented limit.
 */
export const aiRateLimiter: RequestHandler = createIpRateLimiter({
  windowMs: 60_000,
  max: 5,
  floodFactor: 2,
  banMs: 300_000,
  message: 'Keni tejkaluar limitin prej 5 kërkesash në minutë për shërbimet e inteligjencës artificiale.',
  code: 'AI_RATE_LIMIT',
});

/** Generous ceiling for the rest of the public API (anonymous traffic). */
const anonymousApiLimiter: RequestHandler = createIpRateLimiter({
  windowMs: 60_000,
  max: 120,
  floodFactor: 3,
  banMs: 120_000,
  message: 'Keni tejkaluar limitin e kërkesave për këtë shërbim.',
  code: 'API_RATE_LIMIT',
});

/**
 * Signed-in traffic gets its own, larger bucket.
 *
 * Staff in one municipal office or ministry usually share one public IP, and the
 * admin panel makes many requests (paginated lists, counters, decisions, review
 * mode). At 120 per minute for the whole IP, a team working together was throttled
 * and then blocked as a whole office. Requests that carry a bearer token are
 * counted separately, at 900 per minute per IP.
 *
 * The limiter runs before the token is verified, so a forged header only buys the
 * larger bucket: every protected route still verifies the token, and flooding
 * with forged tokens still ends in the same temporary ban at three times the
 * ceiling. Anonymous traffic keeps the strict 120.
 */
const authenticatedApiLimiter: RequestHandler = createIpRateLimiter({
  windowMs: 60_000,
  max: 900,
  floodFactor: 3,
  banMs: 120_000,
  message: 'Keni tejkaluar limitin e kërkesave për këtë shërbim.',
  code: 'API_RATE_LIMIT',
});

export function hasBearerToken(req: Request): boolean {
  const header = req.headers.authorization;
  return typeof header === 'string' && /^Bearer\s+\S{20,}$/.test(header);
}

export const apiRateLimiter: RequestHandler = (req, res, next) =>
  (hasBearerToken(req) ? authenticatedApiLimiter : anonymousApiLimiter)(req, res, next);

/** Login and registration: strict, because these are the brute-force targets. */
export const authRateLimiter: RequestHandler = createIpRateLimiter({
  windowMs: 15 * 60_000,
  max: 10,
  floodFactor: 1.5,
  banMs: 30 * 60_000,
  message: 'Shumë tentativa të dështuara. Provoni përsëri më vonë.',
  code: 'AUTH_RATE_LIMIT',
});

/** Rate-limit configuration exposed for the readiness probe. */
export const RATE_LIMIT_POLICY = {
  ai: { windowMs: 60_000, max: 5 },
  api: { windowMs: 60_000, max: 120 },
  apiAuthenticated: { windowMs: 60_000, max: 900 },
  auth: { windowMs: 15 * 60_000, max: 10 },
} as const;

/**
 * Origins allowed to call the API.
 *
 * `origin: true` in development keeps the Vite dev server working. In production
 * the list is explicit and a request from anywhere else gets no CORS headers at
 * all, so the browser blocks it before it ever reaches a route handler.
 */
export function resolveAllowedOrigins(): string[] {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured.length > 0) return configured;

  if (process.env.APP_URL) return [process.env.APP_URL];

  if (isProduction) {
    // Fail closed: an unset ALLOWED_ORIGINS in production must not silently
    // become "allow everything".
    return [];
  }

  //
  // The default development ports must stay in step with `vite.config.ts` and
  // `resolvePort()` in server.ts. A mismatch here is not a loud failure: CORS
  // simply returns no headers, the browser drops the response, and the app
  // renders a blank page with a 500 in the network tab — which reads as "the
  // build is broken" rather than "the port moved".
  return [
    'http://localhost:3001', 'http://127.0.0.1:3001',
    'http://localhost:3000', 'http://127.0.0.1:3000',
  ];
}

/**
 * Is this `Origin` the host the request was actually addressed to?
 *
 * Compares host and port only, and ignores the scheme, because a deployment
 * behind a TLS-terminating proxy legitimately sends `Origin: https://host` to a
 * service listening on plain HTTP. The port is what matters here: a request
 * carrying the port this process is bound to cannot have come from anywhere but
 * this document.
 *
 * Returns false for anything unparseable, so a malformed header falls through
 * to the allow-list instead of being trusted.
 */
export function isSameOrigin(origin: string, hostHeader?: string): boolean {
  const host = hostHeader ?? process.env.HOST_HEADER;
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  // Without a Host header to compare against, fall back to the listen address.
  const expectedHost = host ?? `localhost:${process.env.PORT || '3001'}`;
  const [expectedHostname, expectedPort] = expectedHost.split(':');
  const originPort = originUrl.port || (originUrl.protocol === 'https:' ? '443' : '80');
  const targetPort = expectedPort || '80';

  return originUrl.hostname === expectedHostname && originPort === targetPort;
}

export const SECURITY_CONFIG = {
  isProduction,
  allowedOrigins: resolveAllowedOrigins(),
} as const;

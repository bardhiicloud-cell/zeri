const isProduction = process.env.NODE_ENV === 'production';
/**
 * Resolve the client IP.
 *
 * `X-Forwarded-For` is only trustworthy because `app.set('trust proxy', 1)` is set
 * and the service sits behind exactly one known proxy (Cloud Run / App Engine).
 * Taking the *last* entry would be wrong behind multiple proxies, and taking the
 * first is what allows a client to spoof its way past the limiter by sending its
 * own header, so the first hop is used and the deployment guarantees exactly one.
 */
export function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        const first = forwarded.split(',')[0]?.trim();
        if (first)
            return first;
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
        const first = forwarded[0]?.trim();
        if (first)
            return first;
    }
    return req.ip || req.socket.remoteAddress || '127.0.0.1';
}
export function createIpRateLimiter({ windowMs, max, floodFactor = 2, banMs = 120_000, message, code, }) {
    const buckets = new Map();
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
    if (typeof sweeper.unref === 'function')
        sweeper.unref();
    const middleware = (req, res, next) => {
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
export const aiRateLimiter = createIpRateLimiter({
    windowMs: 60_000,
    max: 5,
    floodFactor: 2,
    banMs: 300_000,
    message: 'Keni tejkaluar limitin prej 5 kërkesash në minutë për shërbimet e inteligjencës artificiale.',
    code: 'AI_RATE_LIMIT',
});
/** Generous ceiling for the rest of the public API. */
export const apiRateLimiter = createIpRateLimiter({
    windowMs: 60_000,
    max: 120,
    floodFactor: 3,
    banMs: 120_000,
    message: 'Keni tejkaluar limitin e kërkesave për këtë shërbim.',
    code: 'API_RATE_LIMIT',
});
/** Login and registration: strict, because these are the brute-force targets. */
export const authRateLimiter = createIpRateLimiter({
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
    auth: { windowMs: 15 * 60_000, max: 10 },
};
/**
 * Origins allowed to call the API.
 *
 * `origin: true` in development keeps the Vite dev server working. In production
 * the list is explicit and a request from anywhere else gets no CORS headers at
 * all, so the browser blocks it before it ever reaches a route handler.
 */
export function resolveAllowedOrigins() {
    const configured = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    if (configured.length > 0)
        return configured;
    if (process.env.APP_URL)
        return [process.env.APP_URL];
    if (isProduction) {
        // Fail closed: an unset ALLOWED_ORIGINS in production must not silently
        // become "allow everything".
        return [];
    }
    return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}
export const SECURITY_CONFIG = {
    isProduction,
    allowedOrigins: resolveAllowedOrigins(),
};

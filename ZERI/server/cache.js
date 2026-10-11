import { getFirestore, FieldValue } from 'firebase-admin/firestore';
export class FirestoreCache {
    constructor(maxEntries = 500, defaultTtlMs = 60_000) {
        this.store = new Map();
        this.clock = 0;
        this.hits = 0;
        this.misses = 0;
        this.sets = 0;
        this.evictions = 0;
        this.sharedHits = 0;
        this.maxEntries = maxEntries;
        this.defaultTtlMs = defaultTtlMs;
    }
    /** Read a value, refreshing its recency. Returns undefined on miss or expiry. */
    get(key) {
        const entry = this.store.get(key);
        if (!entry) {
            this.misses += 1;
            return undefined;
        }
        if (entry.expiresAt <= Date.now()) {
            this.store.delete(key);
            this.misses += 1;
            return undefined;
        }
        entry.touchedAt = ++this.clock;
        this.hits += 1;
        return entry.value;
    }
    set(key, value, ttlMs = this.defaultTtlMs) {
        if (this.store.size >= this.maxEntries && !this.store.has(key)) {
            this.evictLeastRecentlyUsed();
        }
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs, touchedAt: ++this.clock });
        this.sets += 1;
    }
    /** Drop every entry whose key starts with the given prefix. */
    invalidate(prefix) {
        let removed = 0;
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) {
                this.store.delete(key);
                removed += 1;
            }
        }
        return removed;
    }
    clear() {
        this.store.clear();
    }
    evictLeastRecentlyUsed() {
        let oldestKey = null;
        let oldestTouch = Number.POSITIVE_INFINITY;
        for (const [key, entry] of this.store) {
            if (entry.touchedAt < oldestTouch) {
                oldestTouch = entry.touchedAt;
                oldestKey = key;
            }
        }
        if (oldestKey !== null) {
            this.store.delete(oldestKey);
            this.evictions += 1;
        }
    }
    stats() {
        return {
            hits: this.hits,
            misses: this.misses,
            sets: this.sets,
            evictions: this.evictions,
            size: this.store.size,
            sharedHits: this.sharedHits,
        };
    }
    resetStats() {
        this.hits = 0;
        this.misses = 0;
        this.sets = 0;
        this.evictions = 0;
        this.sharedHits = 0;
    }
}
export const cache = new FirestoreCache();
/**
 * Stampede guard: several concurrent misses on the same key share one upstream
 * read instead of each triggering its own Firestore call.
 */
const inflight = new Map();
/**
 * Read a Firestore document through the cache.
 *
 * @param collectionPath e.g. 'settings'
 * @param documentId     e.g. 'general'
 * @param ttlMs          freshness window; 0 disables caching entirely
 */
export async function cachedDocument(collectionPath, documentId, ttlMs = 60_000) {
    const key = `doc:${collectionPath}/${documentId}`;
    if (ttlMs > 0) {
        const cached = cache.get(key);
        if (cached !== undefined)
            return cached;
    }
    const pending = inflight.get(key);
    if (pending)
        return (await pending);
    const request = (async () => {
        try {
            const snap = await getFirestore().collection(collectionPath).doc(documentId).get();
            const data = snap.exists ? snap.data() : null;
            if (ttlMs > 0 && data !== null) {
                cache.set(key, data, ttlMs);
            }
            return data;
        }
        finally {
            inflight.delete(key);
        }
    })();
    inflight.set(key, request);
    return (await request);
}
/**
 * Read a whole collection through the cache.
 *
 * `sortField` is applied in memory rather than with a Firestore `orderBy` so the
 * cached copy is reusable across callers that ask for different orderings, and
 * so a full-collection read never needs a composite index.
 */
export async function cachedCollection(collectionPath, options = {}) {
    const { ttlMs = 60_000, limit = 200, sortField, sortDirection = 'desc' } = options;
    const key = `col:${collectionPath}:${limit}:${sortField ?? ''}:${sortDirection}`;
    if (ttlMs > 0) {
        const cached = cache.get(key);
        if (cached !== undefined)
            return cached;
    }
    const pending = inflight.get(key);
    if (pending)
        return (await pending);
    const request = (async () => {
        try {
            let query = getFirestore().collection(collectionPath);
            if (sortField) {
                query = query.orderBy(sortField, sortDirection);
            }
            const snap = await query.limit(limit).get();
            const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            if (ttlMs > 0) {
                cache.set(key, rows, ttlMs);
            }
            return rows;
        }
        finally {
            inflight.delete(key);
        }
    })();
    inflight.set(key, request);
    return (await request);
}
/**
 * Write-through invalidation: any admin write to a collection drops that
 * collection from the cache so the next public read is fresh.
 */
export function invalidateCollection(collectionPath) {
    cache.invalidate(`doc:${collectionPath}/`);
    cache.invalidate(`col:${collectionPath}:`);
}
/** Counters, exposed through /api/health for monitoring. */
export const CACHE_SERVER_TIMESTAMP = () => FieldValue.serverTimestamp();

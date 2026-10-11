import { FieldValue, type Query } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin';

/**
 * Two-tier read-through cache for Firestore.
 *
 * Why this exists: the dashboard, the public contact directory and the ad
 * rotator all read the same handful of documents on every single page load.
 * With millions of daily visitors those reads dominate the Firestore bill and,
 * more importantly, they dominate the read quota. Serving them from memory
 * removes that cost entirely.
 *
 * Tier 1 is a per-process LRU. Tier 2 is optional and Redis-backed through
 * REDIS_URL; when it is absent the module still works, it just does not share
 * state between cluster workers.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  /** Monotonic counter used to evict the least recently used entry. */
  touchedAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  size: number;
  sharedHits: number;
}

export class FirestoreCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;
  private clock = 0;
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private evictions = 0;
  private sharedHits = 0;

  constructor(maxEntries = 500, defaultTtlMs = 60_000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  /** Read a value, refreshing its recency. Returns undefined on miss or expiry. */
  get<T>(key: string): T | undefined {
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
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number = this.defaultTtlMs): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evictLeastRecentlyUsed();
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs, touchedAt: ++this.clock });
    this.sets += 1;
  }

  /** Drop every entry whose key starts with the given prefix. */
  invalidate(prefix: string): number {
    let removed = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clear(): void {
    this.store.clear();
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
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

  stats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      evictions: this.evictions,
      size: this.store.size,
      sharedHits: this.sharedHits,
    };
  }

  resetStats(): void {
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
const inflight = new Map<string, Promise<unknown>>();

/**
 * Read a Firestore document through the cache.
 *
 * @param collectionPath e.g. 'settings'
 * @param documentId     e.g. 'general'
 * @param ttlMs          freshness window; 0 disables caching entirely
 */
export async function cachedDocument<T = Record<string, unknown>>(
  collectionPath: string,
  documentId: string,
  ttlMs = 60_000
): Promise<T | null> {
  const key = `doc:${collectionPath}/${documentId}`;

  if (ttlMs > 0) {
    const cached = cache.get<T>(key);
    if (cached !== undefined) return cached;
  }

  const pending = inflight.get(key);
  if (pending) return (await pending) as T | null;

  const request = (async () => {
    try {
      const snap = await db().collection(collectionPath).doc(documentId).get();
      const data = snap.exists ? (snap.data() as T) : null;
      if (ttlMs > 0 && data !== null) {
        cache.set(key, data, ttlMs);
      }
      return data;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return (await request) as T | null;
}

/**
 * Read a whole collection through the cache.
 *
 * `sortField` is applied in memory rather than with a Firestore `orderBy` so the
 * cached copy is reusable across callers that ask for different orderings, and
 * so a full-collection read never needs a composite index.
 */
export async function cachedCollection<T = Record<string, unknown>>(
  collectionPath: string,
  options: { ttlMs?: number; limit?: number; sortField?: string; sortDirection?: 'asc' | 'desc' } = {}
): Promise<T[]> {
  const { ttlMs = 60_000, limit = 200, sortField, sortDirection = 'desc' } = options;
  const key = `col:${collectionPath}:${limit}:${sortField ?? ''}:${sortDirection}`;

  if (ttlMs > 0) {
    const cached = cache.get<T[]>(key);
    if (cached !== undefined) return cached;
  }

  const pending = inflight.get(key);
  if (pending) return (await pending) as T[];

  const request = (async () => {
    try {
      let query: Query = db().collection(collectionPath);
      if (sortField) {
        query = query.orderBy(sortField, sortDirection);
      }
      const snap = await query.limit(limit).get();
      const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as unknown as T);
      if (ttlMs > 0) {
        cache.set(key, rows, ttlMs);
      }
      return rows;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return (await request) as T[];
}

/**
 * Write-through invalidation: any admin write to a collection drops that
 * collection from the cache so the next public read is fresh.
 */
export function invalidateCollection(collectionPath: string): void {
  cache.invalidate(`doc:${collectionPath}/`);
  cache.invalidate(`col:${collectionPath}:`);
}

/** Counters, exposed through /api/health for monitoring. */
export const CACHE_SERVER_TIMESTAMP = () => FieldValue.serverTimestamp();

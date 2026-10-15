import type { User } from 'firebase/auth';
import type { Report } from '../types';

/**
 * Where the app's list of reports comes from, by who is looking.
 *
 * Staff and the read-only monitor read the `reports` collection directly (the
 * database rules allow exactly them, plus a citizen's own documents). Everyone else
 * reads the public feed, `GET /api/v1/public/reports`, which the server builds from
 * an allow-list, and adds their own reports through a query scoped to their uid.
 * See server/publicReports.ts and docs/ADMIN_SECURITY_REMEDIATION.md.
 */

/** The token flags the database rules treat as "may read every report". Keep in step with isStaff()/isMonitor(). */
const FULL_READ_CLAIMS = ['admin', 'superadmin', 'approver', 'adsadmin', 'newsadmin', 'agent', 'monitor'] as const;

export function claimsGrantFullReportRead(claims: Record<string, unknown> | null | undefined): boolean {
  return Boolean(claims) && FULL_READ_CLAIMS.some(flag => claims![flag] === true);
}

/** Whether this signed-in user may subscribe to the whole collection. Fails closed: any error means "no". */
export async function canReadAllReports(user: Pick<User, 'getIdTokenResult'> | null): Promise<boolean> {
  if (!user) return false;
  try {
    return claimsGrantFullReportRead((await user.getIdTokenResult()).claims);
  } catch {
    return false;
  }
}

export interface PublicFeedPage {
  items: Report[];
  nextCursor: string | null;
}

export async function fetchPublicReports(options: { cursor?: string | null; limit?: number; signal?: AbortSignal } = {}): Promise<PublicFeedPage> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.cursor) params.set('cursor', options.cursor);
  const query = params.toString();
  const response = await fetch(`/api/v1/public/reports${query ? `?${query}` : ''}`, { signal: options.signal });
  if (!response.ok) throw new Error(`Raportimet nuk u ngarkuan (${response.status}).`);
  const body = await response.json();
  return {
    items: Array.isArray(body.items) ? (body.items as Report[]) : [],
    nextCursor: typeof body.nextCursor === 'string' ? body.nextCursor : null,
  };
}

/** A stored report (Timestamps and all) in the shape the pages read. */
export function normalizeStoredReport(id: string, data: Record<string, unknown>): Report {
  const iso = (value: unknown): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    const stamp = value as { toDate?: () => Date; seconds?: number };
    if (typeof stamp.toDate === 'function') return stamp.toDate().toISOString();
    if (typeof stamp.seconds === 'number') return new Date(stamp.seconds * 1000).toISOString();
    return undefined;
  };
  return {
    ...data,
    id,
    createdAt: iso(data.createdAt) ?? new Date().toISOString(),
    resolvedAt: iso(data.resolvedAt),
    timeline: Array.isArray(data.timeline)
      ? data.timeline.map((event: Record<string, unknown>) => ({ ...event, date: iso(event.date) ?? new Date().toISOString() }))
      : [],
  } as Report;
}

/** The feed with the viewer's own reports on top of it; a viewer's own copy wins, newest first. */
export function mergeOwnReports(feed: Report[], own: Report[]): Report[] {
  const byId = new Map<string, Report>(feed.map(report => [report.id, report]));
  for (const report of own) byId.set(report.id, report);
  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export interface PublicSourceHandlers {
  uid: string | null;
  onReports: (reports: Report[]) => void;
  onCursor: (cursor: string | null) => void;
  onReady: () => void;
  /**
   * Called when a refresh of the feed failed. The page must then say "could not load",
   * never "no reports": `onReady` is NOT called for a feed that has never loaded.
   */
  onError: (error: unknown) => void;
}

export const PUBLIC_FEED_REFRESH_MS = 60_000;
/** Before the first successful load the feed is retried sooner, so a brief outage does not last a minute. */
export const PUBLIC_FEED_RETRY_MS = 15_000;

/**
 * Start the non-staff source. Returns a function that stops it.
 * The feed refreshes every minute while the tab is visible; the viewer's own
 * reports stream live (they are the person's own data).
 */
export function startPublicReports(handlers: PublicSourceHandlers): () => void {
  let stopped = false;
  let feed: Report[] = [];
  let own: Report[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let unsubscribeOwn: (() => void) | undefined;
  /** True once the feed has been read successfully at least once. A failed read does not count. */
  let feedLoaded = false;

  const publish = () => {
    if (stopped) return;
    handlers.onReports(mergeOwnReports(feed, own));
    if (feedLoaded) handlers.onReady();
  };

  const refresh = async () => {
    controller?.abort();
    controller = new AbortController();
    try {
      const page = await fetchPublicReports({ signal: controller.signal });
      if (stopped) return;
      feed = page.items;
      feedLoaded = true;
      handlers.onCursor(page.nextCursor);
      publish();
    } catch (error) {
      if (stopped || (error as { name?: string })?.name === 'AbortError') return;
      // Previously: `feedLoaded = true` here, which reported "ready" with an empty
      // list and made an outage look like "no reports". Keep what was loaded before
      // (if anything) and tell the page the refresh failed.
      handlers.onError(error);
      if (own.length > 0) handlers.onReports(mergeOwnReports(feed, own));
    } finally {
      if (!stopped) {
        const delay = feedLoaded ? PUBLIC_FEED_REFRESH_MS : PUBLIC_FEED_RETRY_MS;
        timer = setTimeout(() => {
          if (typeof document !== 'undefined' && document.hidden) { timer = setTimeout(() => void refresh(), delay); return; }
          void refresh();
        }, delay);
      }
    }
  };
  void refresh();

  if (handlers.uid) {
    void (async () => {
      const [{ db }, firestore] = await Promise.all([import('./firebase'), import('firebase/firestore')]);
      if (stopped) return;
      const q = firestore.query(
        firestore.collection(db, 'reports'),
        firestore.where('authorId', '==', handlers.uid),
        firestore.orderBy('createdAt', 'desc'),
        firestore.limit(50)
      );
      unsubscribeOwn = firestore.onSnapshot(
        q,
        snapshot => { own = snapshot.docs.map(doc => normalizeStoredReport(doc.id, doc.data())); publish(); },
        error => { console.error('Raportet e mia nuk u ngarkuan:', error); }
      );
    })();
  }

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    controller?.abort();
    unsubscribeOwn?.();
  };
}

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

/** Statuses a reviewer has accepted; the same list the server feed uses (server/publicReports.ts). */
export const PUBLIC_FEED_STATUSES = ['Approved', 'Assigned', 'In Progress', 'Overdue', 'Resolved', 'Closed'] as const;

export function isAcceptedForPublic(status: unknown): boolean {
  return (PUBLIC_FEED_STATUSES as readonly string[]).includes(String(status ?? ''));
}

const coarse = (value: unknown): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.round(n * 100) / 100;
};

/**
 * The feed read straight from the database, for when the API server is not there.
 * Only accepted reports, and only the fields the server's allow-list would publish:
 * no author id, no street address, coordinates rounded to ~1 km.
 */
async function fetchPublicReportsDirect(max = 100): Promise<PublicFeedPage> {
  const [{ db }, firestore] = await Promise.all([import('./firebase'), import('firebase/firestore')]);
  const snap = await firestore.getDocs(firestore.query(
    firestore.collection(db, 'reports'),
    firestore.where('status', 'in', [...PUBLIC_FEED_STATUSES]),
    firestore.limit(300),
  ));
  const items = snap.docs.map((d) => {
    const r = normalizeStoredReport(d.id, d.data()) as Report & Record<string, unknown> & { isAnonymous?: boolean; upvotes?: number; commentsCount?: number; resolvedImage?: string; responsibleInstitution?: string };
    const loc = (r.location ?? {}) as { lat?: unknown; lng?: unknown; municipality?: unknown };
    return {
      id: r.id,
      trackingId: r.trackingId,
      title: r.title,
      description: r.description,
      category: r.category,
      topicCategory: r.topicCategory,
      urgency: r.urgency,
      status: r.status,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      resolvedImage: r.resolvedImage,
      images: Array.isArray(r.images) ? r.images : [],
      media: Array.isArray(r.media) ? r.media : [],
      timeline: r.timeline,
      upvotes: r.upvotes ?? 0,
      commentsCount: r.commentsCount ?? 0,
      authorId: '',
      authorName: r.isAnonymous ? 'Qytetar Anonim' : 'Qytetar',
      isAnonymous: true,
      responsibleInstitution: r.responsibleInstitution,
      location: { lat: coarse(loc.lat), lng: coarse(loc.lng), address: '', municipality: String(loc.municipality ?? '') },
    } as unknown as Report;
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, max);
  return { items, nextCursor: null };
}

export async function fetchPublicReports(options: { cursor?: string | null; limit?: number; signal?: AbortSignal } = {}): Promise<PublicFeedPage> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.cursor) params.set('cursor', options.cursor);
  const query = params.toString();
  let response: Response | null = null;
  try {
    response = await fetch(`/api/v1/public/reports${query ? `?${query}` : ''}`, { signal: options.signal });
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') throw error;
  }
  const body = response?.ok ? await response.json().catch(() => null) : null;
  if (!body || !Array.isArray(body.items)) {
    // No usable API: the database itself, filtered the same way. A later page has no direct equivalent.
    if (options.cursor) return { items: [], nextCursor: null };
    return fetchPublicReportsDirect(options.limit ?? 100);
  }
  return {
    items: body.items as Report[],
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

/**
 * The feed with the viewer's own *accepted* reports on top of it; a viewer's own copy
 * wins, newest first. A report still waiting for review (or rejected) is NOT merged:
 * it used to appear on the author's own map and feed as if it were already public,
 * which read as "published without approval". It stays on "Raportet e mia".
 */
export function mergeOwnReports(feed: Report[], own: Report[]): Report[] {
  const byId = new Map<string, Report>(feed.map(report => [report.id, report]));
  for (const report of own) if (isAcceptedForPublic(report.status)) byId.set(report.id, report);
  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export interface PublicSourceHandlers {
  uid: string | null;
  onReports: (reports: Report[]) => void;
  onCursor: (cursor: string | null) => void;
  onReady: () => void;
  /** Called when the feed could not be read, so the page can show an honest empty/error state. */
  onError: (error: unknown) => void;
}

export const PUBLIC_FEED_REFRESH_MS = 60_000;

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
      feedLoaded = true;
      handlers.onError(error);
      publish();
    } finally {
      if (!stopped) {
        timer = setTimeout(() => {
          if (typeof document !== 'undefined' && document.hidden) { timer = setTimeout(() => void refresh(), PUBLIC_FEED_REFRESH_MS); return; }
          void refresh();
        }, PUBLIC_FEED_REFRESH_MS);
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

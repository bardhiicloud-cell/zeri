import type { Express, Request, RequestHandler, Response } from 'express';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { buildPublicTrackView } from './trackLookup';
import { createIpRateLimiter } from './security';
import { LOCATION_PRECISION_DECIMALS, normalizeMunicipalityName } from '../src/lib/municipalityNormalizer';

/**
 * The public feed of reports, built from an allow-list.
 *
 * The site used to subscribe to the `reports` collection straight from every
 * visitor's browser, which meant every field of every document left the building:
 * the author's uid, the name of the staff member holding the report, AI analysis,
 * internal flags. This is the enforced replacement: the response is assembled
 * field by field (reusing the allow-list behind the Track ID page), so a field
 * added to a report later stays private until someone decides it is public.
 *
 * Which reports: only those a reviewer has accepted (`FEED_STATUSES`). Drafts,
 * reports still in review and rejected ones are not in the feed; a person who
 * filed one still sees it, through their own author-scoped query, and anyone with
 * the Track ID still reaches its tracking page.
 *
 * The shape is the client's `Report`, with the private parts emptied, so existing
 * pages keep working: `authorId` is '' and `assignedTo` is an institution label,
 * never a person.
 */

export const FEED_STATUSES = ['Approved', 'Assigned', 'In Progress', 'Overdue', 'Resolved', 'Closed'] as const;
export const DEFAULT_FEED_PAGE = 100;
export const MAX_FEED_PAGE = 100;

const str = (value: unknown, max: number): string => String(value ?? '').trim().slice(0, max);
const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
/**
 * Decimal places kept on a public map pin: the project's own privacy policy for transmitted coordinates
 * (src/lib/municipalityNormalizer.ts), 2 decimals, about 1.1 km. Owner decision 2026-10-13. Because that is
 * coarser than a street, the street address is not part of the feed either (the Track ID page, which needs the
 * report's own id, still shows it).
 */
export const FEED_COORDINATE_DECIMALS = LOCATION_PRECISION_DECIMALS;
const coarse = (value: unknown): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const factor = 10 ** FEED_COORDINATE_DECIMALS;
  return Math.round(n * factor) / factor;
};

export interface PublicFeedReport {
  id: string;
  trackingId: string;
  title: string;
  description: string;
  category: string;
  topicCategory?: string;
  urgency: string;
  location: { lat: number; lng: number; address: string; municipality: string; neighborhood?: string };
  images: string[];
  media: Array<{ type: string; url: string; name?: string }>;
  resolvedImage?: string;
  resolvedAt?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  upvotes: number;
  commentsCount: number;
  authorId: '';
  authorName: string;
  isAnonymous: boolean;
  assignedTo: string;
  responsibleInstitution?: string;
  responsibleOffice?: string;
  responsibleLevel?: string;
  responseDueAt?: string;
  timeline: Array<{
    id: string; status: string; date: string; comment?: string; updatedBy: string; actorInstitution: string;
    previousStatus?: string; source: string; attachments: Array<{ type: string; url: string; name?: string }>;
  }>;
}

/** The public feed entry for one stored report, or null when it has no place in the feed. Pure. */
export function buildFeedReport(id: string, report: Record<string, unknown>): PublicFeedReport | null {
  const view = buildPublicTrackView(report);
  if (!view || !(FEED_STATUSES as readonly string[]).includes(view.status) || !view.createdAt) return null;
  const location = (report.location ?? {}) as Record<string, unknown>;
  const resolvedImage = view.resolution.evidenceUrl ?? undefined;
  const assigned = Boolean(str(report.assignedTo, 160));
  return {
    id,
    trackingId: view.trackingId,
    title: view.title,
    description: view.description,
    category: view.category,
    ...(view.topic ? { topicCategory: view.topic } : {}),
    urgency: view.urgency ?? '',
    location: {
      lat: coarse(location.lat),
      lng: coarse(location.lng),
      address: '',
      municipality: view.municipality,
      ...(str(location.neighborhood, 120) ? { neighborhood: str(location.neighborhood, 120) } : {}),
    },
    images: view.evidence.items.filter(item => item.type === 'image').map(item => item.url),
    media: view.evidence.items,
    ...(resolvedImage ? { resolvedImage } : {}),
    ...(view.resolution.resolvedAt ? { resolvedAt: view.resolution.resolvedAt } : {}),
    status: view.status,
    createdAt: view.createdAt,
    ...(view.lastUpdate ? { updatedAt: view.lastUpdate } : {}),
    upvotes: count(report.upvotes),
    commentsCount: count(report.commentsCount),
    authorId: '',
    // A name is public only when the citizen did not ask for anonymity.
    authorName: view.isAnonymous ? 'Anonim' : str(report.authorName, 80),
    isAnonymous: view.isAnonymous,
    // Never the person: the institution that holds it, or nothing.
    assignedTo: assigned ? (view.institution.office || view.institution.name || 'Caktuar') : '',
    ...(view.institution.name ? { responsibleInstitution: view.institution.name } : {}),
    ...(view.institution.office ? { responsibleOffice: view.institution.office } : {}),
    ...(view.institution.level ? { responsibleLevel: view.institution.level } : {}),
    ...(view.institution.responseDueAt ? { responseDueAt: view.institution.responseDueAt } : {}),
    timeline: view.timeline.map(event => ({
      id: event.id,
      status: event.status,
      date: event.date,
      ...(event.comment ? { comment: event.comment } : {}),
      updatedBy: event.institution,
      actorInstitution: event.institution,
      ...(event.previousStatus ? { previousStatus: event.previousStatus } : {}),
      source: event.source,
      attachments: event.attachments,
    })),
  };
}

/** `limit` clamped to 1..MAX_FEED_PAGE; `cursor` an ISO date or nothing. Anything else is rejected. */
export function parseFeedQuery(raw: Record<string, unknown>):
  | { ok: true; limit: number; cursor: Date | null; municipality: string }
  | { ok: false; error: string } {
  let limit = DEFAULT_FEED_PAGE;
  if (raw.limit !== undefined && raw.limit !== '') {
    const parsed = Number(raw.limit);
    if (!Number.isInteger(parsed) || parsed < 1) return { ok: false, error: 'Kufiri nuk është i vlefshëm.' };
    limit = Math.min(parsed, MAX_FEED_PAGE);
  }
  let cursor: Date | null = null;
  if (raw.cursor !== undefined && raw.cursor !== '') {
    const date = new Date(String(raw.cursor));
    if (Number.isNaN(date.getTime())) return { ok: false, error: 'Kursori nuk është i vlefshëm.' };
    cursor = date;
  }
  // Only a real municipality: an arbitrary string would be a different cache key every time, and so a database read every time.
  let municipality = '';
  if (raw.municipality !== undefined && raw.municipality !== '') {
    const canonical = normalizeMunicipalityName(str(raw.municipality, 120));
    if (!canonical) return { ok: false, error: 'Komuna nuk njihet.' };
    municipality = canonical;
  }
  return { ok: true, limit, cursor, municipality };
}

export interface PublicReportsDeps {
  db: () => Firestore;
  /** Test seam: replaces the IP limiter. */
  limiter?: RequestHandler;
  /** Test seam: the clock for cache expiry. */
  now?: () => number;
}

const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 200;

export function registerPublicReportRoutes(app: Express, deps: PublicReportsDeps): void {
  const limiter = deps.limiter ?? createIpRateLimiter({
    windowMs: 60_000,
    max: 60,
    floodFactor: 3,
    banMs: 120_000,
    message: 'Shumë kërkesa për raportimet publike. Provoni përsëri pas pak.',
    code: 'PUBLIC_REPORTS_RATE_LIMIT',
  });
  const now = deps.now ?? Date.now;
  // Everyone gets the same answer for the same page, so one read serves many visitors.
  // The serialized text is what is kept: a page is ~200 KB and stringifying it per request was the cost.
  const cache = new Map<string, { at: number; json: string }>();
  const sendJson = (res: Response, json: string) => res.type('application/json').send(json);

  app.get('/api/v1/public/reports', limiter, async (req: Request, res: Response) => {
    const query = parseFeedQuery(req.query as Record<string, unknown>);
    if (query.ok === false) return res.status(400).json({ error: query.error });

    const key = `${query.limit}|${query.cursor?.toISOString() ?? ''}|${query.municipality}`;
    const hit = cache.get(key);
    res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30');
    if (hit && now() - hit.at < CACHE_TTL_MS) return sendJson(res, hit.json);

    try {
      let ref = deps.db().collection('reports').where('status', 'in', [...FEED_STATUSES]);
      if (query.municipality) ref = ref.where('location.municipality', '==', query.municipality);
      let ordered = ref.orderBy('createdAt', 'desc');
      if (query.cursor) ordered = ordered.startAfter(Timestamp.fromDate(query.cursor));
      const snap = await ordered.limit(query.limit).get();

      const items = snap.docs
        .map(doc => buildFeedReport(doc.id, doc.data()))
        .filter((item): item is PublicFeedReport => item !== null);
      const last = snap.docs[snap.docs.length - 1];
      const lastCreated = last ? (last.data().createdAt as { toDate?: () => Date } | undefined) : undefined;
      const nextCursor = snap.docs.length === query.limit && typeof lastCreated?.toDate === 'function'
        ? lastCreated.toDate().toISOString()
        : null;
      const json = JSON.stringify({ items, nextCursor });
      if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
      cache.set(key, { at: now(), json });
      return sendJson(res, json);
    } catch (error) {
      console.error('[PUBLIC REPORTS] feed failed:', error instanceof Error ? error.message : error);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(500).json({ error: 'Raportimet nuk u ngarkuan. Provoni përsëri.' });
    }
  });
}

import type { Express, Request, RequestHandler, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { createIpRateLimiter, getClientIp } from './security';

/**
 * Public Track ID lookup: what a citizen holding a tracking id may see.
 *
 * The /trackid page used to read the `reports` collection straight from the
 * browser, which means the filtering of private fields was whatever the page
 * happened to render. This module is the enforced version: the response is built
 * from an allow-list (nothing is copied unless named here), so a field added to a
 * report later stays private until someone decides it is public.
 *
 * What never leaves this module: the author's id or name, the author's contact
 * details, the staff member's personal name or uid, internal notes, AI analysis
 * of the photos, exact coordinates, and the media of a report no reviewer has
 * accepted yet.
 *
 * Enumeration: the id is a capability. It is validated by shape, answered with one
 * identical message whether it is malformed, unknown or not for the public, rate
 * limited per IP, and an IP that keeps missing is cut off sooner than one that
 * keeps hitting.
 */

/** Same alphabet the report writer enforces (server/reports.ts). */
export const TRACKING_ID_PATTERN = /^[A-Z0-9][A-Z0-9-]{7,39}$/;

export function normalizeTrackingId(raw: unknown): string | null {
  const value = String(raw ?? '').trim().toUpperCase();
  return TRACKING_ID_PATTERN.test(value) ? value : null;
}

/** Statuses after a reviewer accepted the report: only then is its media public. */
const REVIEWED_STATUSES = ['Approved', 'Assigned', 'In Progress', 'Overdue', 'Resolved', 'Closed'];
/** A draft was never submitted, so it has no public tracking page. */
const HIDDEN_STATUSES = ['Draft'];

export interface PublicMedia {
  type: 'image' | 'video' | 'document' | 'audio';
  url: string;
  name?: string;
}

export interface PublicTimelineEvent {
  id: string;
  status: string;
  previousStatus?: string;
  date: string;
  /** The institution that made the change, never a person. */
  institution: string;
  source: 'admin' | 'municipality' | 'agent' | 'system' | 'citizen';
  comment?: string;
  attachments: PublicMedia[];
}

export interface PublicOfficialResponse {
  id: string;
  date: string;
  institution: string;
  /** Status the report had when the response was published. */
  status: string;
  text: string;
  attachments: PublicMedia[];
}

export type ResolutionState = 'none' | 'awaiting_verification' | 'verified' | 'closed';

export interface PublicTrackView {
  trackingId: string;
  title: string;
  description: string;
  category: string;
  topic: string | null;
  urgency: string | null;
  municipality: string;
  /** The neighbourhood only (may be empty); never a street address. */
  address: string;
  status: string;
  createdAt: string | null;
  lastUpdate: string | null;
  isAnonymous: boolean;
  institution: {
    name: string | null;
    office: string | null;
    level: string | null;
    responseDueAt: string | null;
  };
  evidence: {
    /** False while no reviewer has accepted the report: the files are not public yet. */
    published: boolean;
    totalCount: number;
    items: PublicMedia[];
  };
  timeline: PublicTimelineEvent[];
  officialResponses: PublicOfficialResponse[];
  resolution: {
    state: ResolutionState;
    resolvedAt: string | null;
    explanation: string | null;
    resolvedBy: string | null;
    verifiedAt: string | null;
    verificationNote: string | null;
    evidenceUrl: string | null;
  };
  rejection: { reason: string | null; date: string | null; institution: string | null } | null;
}

const str = (value: unknown, max: number): string => String(value ?? '').trim().slice(0, max);

/** Firestore Timestamp, `{seconds}`, Date or ISO string to an ISO string. */
function toIso(value: unknown): string | null {
  if (!value) return null;
  const v = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
  let date: Date | null = null;
  if (typeof v.toDate === 'function') date = v.toDate();
  else if (typeof v.seconds === 'number') date = new Date(v.seconds * 1000);
  else if (typeof v._seconds === 'number') date = new Date(v._seconds * 1000);
  else if (typeof value === 'string' || typeof value === 'number') date = new Date(value);
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

/** Only https files, with a type the page knows how to show. */
function publicMedia(raw: unknown, limit = 12): PublicMedia[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicMedia[] = [];
  for (const item of raw) {
    if (out.length >= limit) break;
    const url = typeof item === 'string' ? item : (item as { url?: unknown })?.url;
    if (typeof url !== 'string' || !url.startsWith('https://') || url.length > 2048) continue;
    const type = typeof item === 'string' ? 'image' : String((item as { type?: unknown }).type ?? 'image');
    const name = typeof item === 'string' ? undefined : str((item as { name?: unknown }).name, 120) || undefined;
    out.push({
      type: type === 'video' || type === 'document' || type === 'audio' ? type : 'image',
      url,
      ...(name ? { name } : {}),
    });
  }
  return out;
}

const SOURCES = ['admin', 'municipality', 'agent', 'system', 'citizen'] as const;
type Source = (typeof SOURCES)[number];

function eventInstitution(event: Record<string, unknown>, source: Source): string {
  const institution = str(event.actorInstitution, 160);
  if (institution) return institution;
  // `updatedBy` is a personal name when staff typed one; only the neutral
  // system label is safe to fall back to.
  if (source === 'system') return 'Sistemi';
  if (source === 'municipality') return 'Komuna';
  if (source === 'agent') return 'Agjenti i platformës';
  if (source === 'citizen') return 'Qytetari';
  return 'Administrata';
}

/**
 * The public view of one report document, or `null` when it has no public page.
 * Pure: takes the stored document, returns the allow-listed projection.
 */
export function buildPublicTrackView(report: Record<string, any>): PublicTrackView | null {
  const status = str(report.status, 40);
  const trackingId = str(report.trackingId, 40);
  if (!trackingId || HIDDEN_STATUSES.includes(status)) return null;

  const reviewed = REVIEWED_STATUSES.includes(status);
  const createdAt = toIso(report.createdAt);

  const rawTimeline: Array<Record<string, unknown>> = Array.isArray(report.timeline) ? report.timeline : [];
  const timeline: PublicTimelineEvent[] = rawTimeline
    .map((event, index) => {
      const source: Source = (SOURCES as readonly string[]).includes(String(event.source))
        ? (event.source as Source)
        : event.actorRole === 'municipality' ? 'municipality' : 'system';
      const date = toIso(event.date);
      if (!date) return null;
      const comment = str(event.comment, 1500);
      const previous = str(event.previousStatus, 40);
      return {
        id: str(event.id, 80) || `event-${index}`,
        status: str(event.status, 40),
        ...(previous ? { previousStatus: previous } : {}),
        date,
        institution: eventInstitution(event, source),
        source,
        ...(comment ? { comment } : {}),
        attachments: reviewed ? publicMedia(event.attachments, 6) : [],
      } as PublicTimelineEvent;
    })
    .filter((event): event is PublicTimelineEvent => event !== null)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  // A report with no stored history still has one true event: it was submitted.
  if (timeline.length === 0 && createdAt) {
    timeline.push({ id: 'submitted', status: 'Pending Review', date: createdAt, institution: 'Sistemi', source: 'system', attachments: [] });
  }

  // Official responses: what the municipality published under its own name.
  const officialResponses: PublicOfficialResponse[] = timeline
    .filter(event => event.source === 'municipality' && event.comment)
    .map(event => ({
      id: event.id,
      date: event.date,
      institution: event.institution,
      status: event.status,
      text: event.comment as string,
      attachments: event.attachments,
    }));

  const lastEvent = (statuses: string[]) => [...timeline].reverse().find(event => statuses.includes(event.status));
  const rejectedEvent = lastEvent(['Rejected']);

  // The pipeline (server/approvalPipeline.ts) writes `Resolved` twice for a case
  // that is properly finished: first when the institution reports the work done,
  // then again, with the status unchanged, when the platform's staff verify it
  // (`staff_verify`). `Closed` is not written by the pipeline but is honoured
  // if a report carries it. Nothing is inferred beyond those facts.
  const resolvedEvents = timeline.filter(event => event.status === 'Resolved');
  const resolvedEvent = resolvedEvents.find(event => event.previousStatus !== 'Resolved') ?? resolvedEvents[0];
  const closedEvent = resolvedEvents.find(event => event !== resolvedEvent && event.previousStatus === 'Resolved' && event.source !== 'municipality')
    ?? lastEvent(['Closed']);

  let state: ResolutionState = 'none';
  if (status === 'Resolved') state = closedEvent ? 'verified' : 'awaiting_verification';
  else if (status === 'Closed') state = closedEvent ? 'verified' : 'closed';

  const resolvedAt = toIso(report.resolvedAt) ?? resolvedEvent?.date ?? null;
  const resolvedImage = typeof report.resolvedImage === 'string' && report.resolvedImage.startsWith('https://') ? report.resolvedImage : null;

  const evidenceItems = reviewed
    ? publicMedia(Array.isArray(report.media) && report.media.length ? report.media : report.images, 12)
    : [];
  const evidenceTotal = Array.isArray(report.media) && report.media.length
    ? report.media.length
    : Array.isArray(report.images) ? report.images.length : 0;

  const lastUpdate = [toIso(report.updatedAt), createdAt, ...timeline.map(event => event.date)]
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop() ?? null;

  const location = (report.location ?? {}) as Record<string, unknown>;

  return {
    trackingId,
    title: str(report.title, 300),
    description: str(report.description, 6000),
    category: str(report.category, 120),
    topic: str(report.topicCategory, 60) || null,
    urgency: str(report.urgency, 20) || null,
    municipality: str(location.municipality ?? report.municipality, 120),
    // Not the street address: anyone holding the id would learn a numbered address, which identifies a household.
    // The neighbourhood (if the citizen gave one) and the municipality locate the report; the author sees the full
    // address in their own account. Policy: src/lib/municipalityNormalizer.ts (LOCATION_PRECISION_DECIMALS).
    address: str(location.neighborhood, 120),
    status,
    createdAt,
    lastUpdate,
    isAnonymous: report.isAnonymous === true,
    institution: {
      name: str(report.responsibleInstitution, 200) || null,
      office: str(report.responsibleOffice, 200) || null,
      level: str(report.responsibleLevel, 40) || null,
      responseDueAt: toIso(report.responseDueAt),
    },
    evidence: { published: reviewed, totalCount: evidenceTotal, items: evidenceItems },
    timeline,
    officialResponses,
    resolution: {
      state,
      resolvedAt: state === 'none' ? null : resolvedAt,
      explanation: state === 'none' ? null : resolvedEvent?.comment ?? null,
      resolvedBy: state === 'none' ? null : resolvedEvent?.institution ?? null,
      verifiedAt: state === 'verified' || state === 'closed' ? closedEvent?.date ?? null : null,
      verificationNote: state === 'verified' || state === 'closed' ? closedEvent?.comment ?? null : null,
      evidenceUrl: state === 'none' || !reviewed ? null : resolvedImage,
    },
    rejection: status === 'Rejected'
      ? { reason: rejectedEvent?.comment ?? null, date: rejectedEvent?.date ?? null, institution: rejectedEvent?.institution ?? null }
      : null,
  };
}

export const NOT_FOUND_MESSAGE = 'Nuk u gjet asnjë raportim me këtë Track ID.';

export interface TrackLookupDeps {
  db: () => Firestore;
  /** Test seam: replaces the lookup limiter. */
  limiter?: RequestHandler;
}

/**
 * Misses are what an enumerating client produces, so they are budgeted
 * separately: a person mistyping an id spends two or three, a script spends
 * hundreds. Past the budget the IP is told to wait, whatever it asks next.
 */
const MISS_WINDOW_MS = 15 * 60_000;
const MISS_BUDGET = 12;

export function registerTrackLookupRoutes(app: Express, deps: TrackLookupDeps): void {
  const limiter = deps.limiter ?? createIpRateLimiter({
    windowMs: 10 * 60_000,
    max: 40,
    floodFactor: 3,
    banMs: 15 * 60_000,
    message: 'Shumë kërkime Track ID. Provoni përsëri pas pak minutash.',
    code: 'TRACK_RATE_LIMIT',
  });

  const misses = new Map<string, { count: number; resetAt: number }>();
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of misses) if (entry.resetAt <= now) misses.delete(ip);
  }, MISS_WINDOW_MS);
  if (typeof sweeper.unref === 'function') sweeper.unref();

  const recordMiss = (ip: string) => {
    const now = Date.now();
    const entry = misses.get(ip);
    if (!entry || entry.resetAt <= now) misses.set(ip, { count: 1, resetAt: now + MISS_WINDOW_MS });
    else entry.count += 1;
  };

  const missesExhausted = (ip: string): number => {
    const entry = misses.get(ip);
    if (!entry || entry.resetAt <= Date.now()) return 0;
    return entry.count > MISS_BUDGET ? Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000)) : 0;
  };

  app.get('/api/v1/public/track/:trackingId', limiter, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    const ip = getClientIp(req);
    const wait = missesExhausted(ip);
    if (wait) {
      res.setHeader('Retry-After', String(wait));
      return res.status(429).json({ error: 'Shumë kërkime pa rezultat. Provoni përsëri më vonë.', code: 'TRACK_MISS_LIMIT', retryAfter: wait });
    }

    const trackingId = normalizeTrackingId(req.params.trackingId);
    if (!trackingId) {
      recordMiss(ip);
      return res.status(404).json({ error: NOT_FOUND_MESSAGE, code: 'NOT_FOUND' });
    }

    try {
      const snap = await deps.db().collection('reports').where('trackingId', '==', trackingId).limit(1).get();
      const view = snap.empty ? null : buildPublicTrackView(snap.docs[0].data());
      if (!view) {
        recordMiss(ip);
        return res.status(404).json({ error: NOT_FOUND_MESSAGE, code: 'NOT_FOUND' });
      }
      return res.json({ report: view, generatedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error('[TRACK] lookup failed:', error?.message);
      return res.status(500).json({ error: 'Kërkimi nuk u krye. Provoni përsëri.', code: 'LOOKUP_FAILED' });
    }
  });
}

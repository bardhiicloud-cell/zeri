/**
 * The public projection of a report, shared by the server route
 * (server/trackLookup.ts) and the browser's fallback lookup (src/lib/trackApi.ts).
 *
 * Pure and dependency-free on purpose: it must be importable from the client
 * bundle without pulling in Express or the Admin SDK. Whatever path reads the
 * report, the citizen sees exactly the same allow-listed fields.
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
    /** True when the viewer is the report's author: they see their own files whatever the review state. */
    ownerView: boolean;
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
  rejection: {
    reason: string | null;
    date: string | null;
    institution: string | null;
    /** When the report and its files are erased (24 hours after the rejection). */
    deleteAt: string | null;
  } | null;
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

const RETENTION_MS = 24 * 60 * 60_000;

/** Same clock the purge job uses (server/rejectedPurge.ts): 24 hours after the rejection. */
function rejectionDeleteAt(report: { workflow?: { rejectedAtMs?: unknown }; rejectedAt?: unknown }, eventDate: string | null): string | null {
  const stamped = report?.workflow?.rejectedAtMs;
  const from = typeof stamped === 'number' ? new Date(stamped).toISOString() : toIso(report?.rejectedAt) ?? eventDate;
  const ms = from ? Date.parse(from) : NaN;
  return Number.isNaN(ms) ? null : new Date(ms + RETENTION_MS).toISOString();
}

/**
 * The public view of one report document, or `null` when it has no public page.
 * Pure: takes the stored document, returns the allow-listed projection.
 */
export function buildPublicTrackView(report: Record<string, any>, options: { viewerIsAuthor?: boolean } = {}): PublicTrackView | null {
  const status = str(report.status, 40);
  const trackingId = str(report.trackingId, 40);
  if (!trackingId || HIDDEN_STATUSES.includes(status)) return null;

  const ownerView = options.viewerIsAuthor === true;
  const reviewed = REVIEWED_STATUSES.includes(status);
  // The public sees files only after a reviewer accepted the report; the author always sees their own.
  const showMedia = reviewed || ownerView;
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
        attachments: showMedia ? publicMedia(event.attachments, 6) : [],
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
  // then again, with the status unchanged, when the platform's staff verify it.
  // `Closed` is not written by the pipeline but is honoured if present.
  const resolvedEvents = timeline.filter(event => event.status === 'Resolved');
  const declaredEvent = resolvedEvents.find(event => event.previousStatus !== 'Resolved') ?? resolvedEvents[0];
  const verificationEvent = resolvedEvents.find(event => event !== declaredEvent && event.previousStatus === 'Resolved' && event.source !== 'municipality')
    ?? lastEvent(['Closed']);

  let state: ResolutionState = 'none';
  if (status === 'Resolved') state = verificationEvent ? 'verified' : 'awaiting_verification';
  else if (status === 'Closed') state = verificationEvent ? 'verified' : 'closed';
  const resolvedEvent = declaredEvent;
  const closedEvent = verificationEvent;

  const resolvedAt = toIso(report.resolvedAt) ?? resolvedEvent?.date ?? null;
  const resolvedImage = typeof report.resolvedImage === 'string' && report.resolvedImage.startsWith('https://') ? report.resolvedImage : null;

  const evidenceItems = showMedia
    ? publicMedia(Array.isArray(report.media) && report.media.length ? report.media : report.images, 24)
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
    evidence: { published: reviewed, ownerView, totalCount: evidenceTotal, items: evidenceItems },
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
      ? {
        reason: rejectedEvent?.comment ?? null,
        date: rejectedEvent?.date ?? null,
        institution: rejectedEvent?.institution ?? null,
        deleteAt: rejectionDeleteAt(report, rejectedEvent?.date ?? null),
      }
      : null,
  };
}


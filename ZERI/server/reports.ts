/**
 * Building a citizen report on the server.
 *
 * `POST /api/v1/reports` is the enforced writing path for new reports: the client
 * proposes values, the server decides what is stored. This module holds that
 * decision as pure functions so it can be tested without Firebase.
 *
 * It exists partly because the first version of the endpoint stored only a
 * handful of fields. The report form also collects the urgency level and topic and
 * derives the responsible institution, response deadline and accountability
 * status; the direct-write fallback stored all of them, the server path silently
 * dropped them, so reports filed the normal way lost data that 28 files read.
 */
import { getAccountabilityDueDate, getAccountabilityProfile } from '../src/lib/accountability';

export const URGENCY_LEVELS = ['E ulët', 'Mesatare', 'E lartë', 'Kritike'] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

export interface ReportMedia {
  type: 'image' | 'video';
  url: string;
  path?: string;
}

export interface ParsedReport {
  title: string;
  description: string;
  category: string;
  topicCategory: string;
  urgency: Urgency;
  municipality: string;
  address: string;
  lat: number | null;
  lng: number | null;
  authorName: string;
  isAnonymous: boolean;
  media: ReportMedia[];
  /** A tracking id the client proposed; honoured only if well formed and unused. */
  requestedTrackingId: string;
  /** Advisory output of the AI photo analysis, relayed by the client (untrusted). */
  ai: { score?: number; routingReason?: string; forensicsReport?: string };
}

export type ParseResult =
  | { outcome: 'ok'; value: ParsedReport }
  | { outcome: 'invalid'; error: string };

const TOPIC_ID = /^[a-z0-9-]{1,40}$/;
const TRACKING_ID = /^[A-Z0-9-]{8,40}$/;

/** Name stored for an anonymous report, whatever the client sent. */
export const ANONYMOUS_AUTHOR_NAME = 'Qytetar Anonim';

function text(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

function finiteOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

export function parseReportInput(body: unknown): ParseResult {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown> & {
    location?: Record<string, unknown>;
    media?: unknown;
  };

  const title = text(input.title, 200);
  const description = text(input.description, 5000);
  const category = text(input.category, 80);
  const location = input.location && typeof input.location === 'object' ? (input.location as Record<string, unknown>) : null;
  if (!title || !description || !category || !location) {
    return { outcome: 'invalid', error: 'Të dhënat e raportit janë të pavlefshme.' };
  }

  const municipality = text(location.municipality, 80);
  if (!municipality) return { outcome: 'invalid', error: 'Mungon komuna.' };

  const urgency = (URGENCY_LEVELS as readonly string[]).includes(String(input.urgency))
    ? (String(input.urgency) as Urgency)
    : 'Mesatare';

  const topicCandidate = String(input.topicCategory ?? '').trim();
  const topicCategory = TOPIC_ID.test(topicCandidate) ? topicCandidate : '';

  const isAnonymous = input.isAnonymous === true;

  // Media URLs are Storage download URLs - accept only https.
  type RawMedia = { type?: unknown; url?: unknown; path?: unknown };
  const media: ReportMedia[] = (Array.isArray(input.media) ? (input.media as RawMedia[]).slice(0, 6) : [])
    .filter((item) => item && typeof item.url === 'string' && item.url.startsWith('https://'))
    .map((item) => ({
      type: item.type === 'video' ? ('video' as const) : ('image' as const),
      url: String(item.url).slice(0, 2048),
      ...(item.path ? { path: String(item.path).slice(0, 512) } : {}),
    }));

  const requested = text(input.trackingId, 40).toUpperCase();

  const score = Number(input.aiCategoryScore);
  const ai: ParsedReport['ai'] = {};
  if (Number.isFinite(score)) ai.score = Math.min(100, Math.max(0, Math.round(score)));
  if (input.aiRoutingReason) ai.routingReason = text(input.aiRoutingReason, 2000);
  if (input.aiForensicsReport) ai.forensicsReport = text(input.aiForensicsReport, 2000);

  return {
    outcome: 'ok',
    value: {
      title,
      description,
      category,
      topicCategory,
      urgency,
      municipality,
      address: text(location.address, 300),
      lat: finiteOrNull(location.lat),
      lng: finiteOrNull(location.lng),
      authorName: isAnonymous ? ANONYMOUS_AUTHOR_NAME : text(input.authorName, 120),
      isAnonymous,
      media,
      requestedTrackingId: TRACKING_ID.test(requested) ? requested : '',
      ai,
    },
  };
}

/** `ZQ-YYYYMMDD-<time><random>` - the same shape the client has always shown. */
export function generateTrackingId(nowMs: number, randomHex: string): string {
  const day = new Date(nowMs).toISOString().slice(0, 10).replace(/-/g, '');
  return `ZQ-${day}-${nowMs.toString(36).toUpperCase()}${randomHex.toUpperCase()}`;
}

export interface BuildContext {
  uid: string;
  nowMs: number;
  trackingId: string;
  /** `FieldValue.serverTimestamp()` in production; injected so tests need no Firebase. */
  createdAt: unknown;
  /** Random suffix for the first timeline event id. */
  eventSuffix: string;
}

/** The document that is actually stored. Nothing here comes unchecked from the client. */
export function buildReportDocument(report: ParsedReport, context: BuildContext): Record<string, unknown> {
  const nowIso = new Date(context.nowMs).toISOString();
  const accountability = getAccountabilityProfile(report.category);

  const doc: Record<string, unknown> = {
    title: report.title,
    description: report.description,
    category: report.category,
    topicCategory: report.topicCategory,
    urgency: report.urgency,
    location: {
      address: report.address,
      municipality: report.municipality,
      lat: report.lat,
      lng: report.lng,
    },
    authorId: context.uid,
    authorName: report.authorName,
    status: 'Pending Review',
    trackingId: context.trackingId,
    isAnonymous: report.isAnonymous,
    createdAt: context.createdAt,
    // Derived here from the category, not trusted from the client.
    responsibleInstitution: accountability.institution,
    responsibleLevel: accountability.level,
    responsibleOffice: accountability.office,
    responseDueAt: getAccountabilityDueDate(nowIso, accountability.responseHours),
    accountabilityStatus: 'Në pritje',
    timeline: [
      {
        id: `${context.nowMs.toString(36)}${context.eventSuffix.toLowerCase()}`,
        status: 'Pending Review',
        date: nowIso,
        updatedBy: 'Sistemi',
        source: 'system',
      },
    ],
    media: report.media,
    images: report.media.filter((item) => item.type === 'image').map((item) => item.url),
  };

  if (report.ai.score !== undefined) doc.aiCategoryScore = report.ai.score;
  if (report.ai.routingReason) doc.aiRoutingReason = report.ai.routingReason;
  if (report.ai.forensicsReport) doc.aiForensicsReport = report.ai.forensicsReport;

  return doc;
}

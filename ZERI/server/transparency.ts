import type { Express, Request, RequestHandler, Response } from 'express';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { KOSOVO_MUNICIPALITIES } from '../src/lib/constants';

/**
 * The public Transparency Center: what the platform has done, in numbers anyone can
 * check, counted from the database rather than from whatever a browser has loaded.
 *
 * Rules this module keeps:
 *   - aggregates only. No title, description, address, photo, author or note leaves
 *     here, so an anonymous report stays anonymous through every stage;
 *   - every figure is a count over ALL reports (the database's own aggregation),
 *     never a count of loaded rows, and carries the period it covers;
 *   - every rate says what it is divided by (see `definitions`), and a rate with a
 *     zero denominator is `null` (shown as "pa të dhëna"), never 0 and never invented;
 *   - the average time to resolve is measured on a stated sample, and says how many
 *     reports it is based on;
 *   - the answer is cached for five minutes and says when it was made.
 */

export const STATUSES = ['Pending Review', 'Approved', 'Assigned', 'In Progress', 'Overdue', 'Resolved', 'Closed', 'Rejected'] as const;
export type CountedStatus = (typeof STATUSES)[number];

/** Anything a municipality (and so the public) may see: reviewed, accepted, public record. */
const PUBLISHED: readonly CountedStatus[] = ['Approved', 'Assigned', 'In Progress', 'Overdue', 'Resolved', 'Closed'];

export const SAMPLE_SIZE = 500;
export const CACHE_MS = 5 * 60_000;
export const MAX_MONTHS = 24;

export type StatusCounts = Record<CountedStatus, number>;

export interface Rates {
  /** Published ÷ (published + rejected): of the reports a reviewer has decided, how many were accepted. */
  acceptanceRate: number | null;
  /** Resolved ÷ published: of the reports accepted, how many are finished. */
  resolutionRate: number | null;
  /** Overdue ÷ published and not yet resolved. */
  overdueShare: number | null;
}

export interface Summary {
  received: number;
  awaitingReview: number;
  published: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  overdue: number;
  rates: Rates;
}

const pct = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

/** From per-status counts to the figures the page shows. Pure. */
export function summarize(counts: StatusCounts): Summary {
  const sum = (list: readonly CountedStatus[]) => list.reduce((total, status) => total + (counts[status] ?? 0), 0);
  const published = sum(PUBLISHED);
  const resolved = sum(['Resolved', 'Closed']);
  const open = published - resolved;
  return {
    received: sum(STATUSES),
    awaitingReview: counts['Pending Review'] ?? 0,
    published,
    inProgress: sum(['Assigned', 'In Progress']),
    resolved,
    rejected: counts.Rejected ?? 0,
    overdue: counts.Overdue ?? 0,
    rates: {
      acceptanceRate: pct(published, published + (counts.Rejected ?? 0)),
      resolutionRate: pct(resolved, published),
      overdueShare: pct(counts.Overdue ?? 0, open),
    },
  };
}

export interface Durations {
  sampleSize: number;
  averageHours: number | null;
  medianHours: number | null;
}

/** Hours from filing to resolution over a sample; reports without both dates are left out. */
export function durations(rows: ReadonlyArray<{ createdMs: number | null; resolvedMs: number | null }>): Durations {
  const hours = rows
    .filter(row => row.createdMs !== null && row.resolvedMs !== null && (row.resolvedMs as number) >= (row.createdMs as number))
    .map(row => ((row.resolvedMs as number) - (row.createdMs as number)) / 3_600_000)
    .sort((a, b) => a - b);
  if (hours.length === 0) return { sampleSize: 0, averageHours: null, medianHours: null };
  const mid = Math.floor(hours.length / 2);
  const median = hours.length % 2 ? hours[mid] : (hours[mid - 1] + hours[mid]) / 2;
  const average = hours.reduce((a, b) => a + b, 0) / hours.length;
  return { sampleSize: hours.length, averageHours: Math.round(average * 10) / 10, medianHours: Math.round(median * 10) / 10 };
}

export interface Query {
  from: Date | null;
  to: Date | null;
  municipality: string;
  category: string;
}

export type ParsedQuery = { ok: true; query: Query } | { ok: false; error: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function single(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || value.length > max) return null;
  return value.trim();
}

/** Validate the public query string. A bad value is refused, never silently ignored. */
export function parseQuery(raw: Record<string, unknown>, now: Date = new Date()): ParsedQuery {
  const from = single(raw.from, 10);
  const to = single(raw.to, 10);
  const municipality = single(raw.municipality, 80);
  const category = single(raw.category, 80);
  if (from === null || (from && !DAY.test(from))) return { ok: false, error: 'Data e fillimit nuk është e vlefshme (VVVV-MM-DD).' };
  if (to === null || (to && !DAY.test(to))) return { ok: false, error: 'Data e mbarimit nuk është e vlefshme (VVVV-MM-DD).' };
  if (municipality === null) return { ok: false, error: 'Komuna nuk është e vlefshme.' };
  if (category === null) return { ok: false, error: 'Kategoria nuk është e vlefshme.' };

  const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : null;
  // `to` is inclusive for the reader, exclusive for the query.
  const toDate = to ? new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000) : null;
  if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) return { ok: false, error: 'Data nuk ekziston.' };
  if (fromDate && toDate && fromDate >= toDate) return { ok: false, error: 'Data e fillimit duhet të jetë para datës së mbarimit.' };
  if (toDate && toDate.getTime() > now.getTime() + 2 * 86_400_000) return { ok: false, error: 'Data e mbarimit nuk mund të jetë në të ardhmen.' };
  return { ok: true, query: { from: fromDate, to: toDate, municipality: municipality ?? '', category: category ?? '' } };
}

/** The months a trend covers, oldest first, at most MAX_MONTHS. */
export function monthsBetween(from: Date | null, to: Date | null, now: Date = new Date()): Array<{ key: string; start: Date; end: Date }> {
  const end = to ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  let start = from ?? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 12, 1));
  start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const months: Array<{ key: string; start: Date; end: Date }> = [];
  for (let cursor = start; cursor < end && months.length < MAX_MONTHS * 2; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    months.push({ key: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`, start: cursor, end: next });
  }
  return months.slice(-MAX_MONTHS);
}

export const DEFINITIONS = {
  received: 'Të gjitha raportimet e regjistruara në periudhë (pa draftet).',
  awaitingReview: 'Raportime që presin shqyrtimin e parë nga stafi.',
  published: 'Raportime të pranuara nga stafi dhe të hapura për komunën: aprovuar, në trajtim, të vonuara, të zgjidhura.',
  rejected: 'Raportime që stafi i ka refuzuar, gjithmonë me arsye të shkruar.',
  acceptanceRate: 'Të pranuara ÷ (të pranuara + të refuzuara). Nuk përfshin ato që ende presin shqyrtim.',
  resolutionRate: 'Të zgjidhura ÷ të pranuara.',
  overdueShare: 'Të vonuara ÷ të pranuara që ende nuk janë zgjidhur.',
  averageHours: `Koha nga regjistrimi te zgjidhja, e matur mbi deri në ${SAMPLE_SIZE} raportimet më të fundit të zgjidhura në këtë filtër.`,
} as const;

export interface TransparencyDeps {
  db: () => Firestore;
  apiLimiter?: RequestHandler;
}

type Millis = (value: unknown) => number | null;
const toMillis: Millis = value => {
  if (!value) return null;
  const v = value as { toMillis?: () => number };
  if (typeof v.toMillis === 'function') return v.toMillis();
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export function registerTransparencyRoutes(app: Express, deps: TransparencyDeps): void {
  const cache = new Map<string, { at: number; body: unknown }>();
  const inflight = new Map<string, Promise<unknown>>();

  async function compute(query: Query): Promise<unknown> {
    const reports = deps.db().collection('reports');

    /** A count over all reports that match, summing both ways a date can be stored (Timestamp, ISO text). */
    const countWhere = async (extra: (q: FirebaseFirestore.Query) => FirebaseFirestore.Query, range?: { from: Date | null; to: Date | null }) => {
      const build = (lower: unknown, upper: unknown) => {
        let q: FirebaseFirestore.Query = extra(reports);
        if (query.municipality) q = q.where('location.municipality', '==', query.municipality);
        if (query.category) q = q.where('category', '==', query.category);
        if (lower !== null) q = q.where('createdAt', '>=', lower);
        if (upper !== null) q = q.where('createdAt', '<', upper);
        return q;
      };
      const r = range ?? { from: query.from, to: query.to };
      if (!r.from && !r.to) return (await build(null, null).count().get()).data().count;
      const asTimestamp = build(r.from ? Timestamp.fromDate(r.from) : null, r.to ? Timestamp.fromDate(r.to) : null);
      const asText = build(r.from ? r.from.toISOString() : null, r.to ? r.to.toISOString() : null);
      const [a, b] = await Promise.all([asTimestamp.count().get(), asText.count().get()]);
      return a.data().count + b.data().count;
    };

    const counts = Object.fromEntries(
      await Promise.all(STATUSES.map(async status => [status, await countWhere(q => q.where('status', '==', status))] as const))
    ) as StatusCounts;

    // The sample respects the same period and filters as the counts, and reads both ways a
    // date can be stored. Without the period, "no reports this month" would still show an
    // average taken from other months.
    const sampleRows = await (async () => {
      const build = (lower: unknown, upper: unknown) => {
        let q: FirebaseFirestore.Query = reports.where('status', 'in', ['Resolved', 'Closed']);
        if (query.municipality) q = q.where('location.municipality', '==', query.municipality);
        if (query.category) q = q.where('category', '==', query.category);
        if (lower !== null) q = q.where('createdAt', '>=', lower);
        if (upper !== null) q = q.where('createdAt', '<', upper);
        return q.orderBy('createdAt', 'desc').limit(SAMPLE_SIZE).select('createdAt', 'resolvedAt').get();
      };
      const snaps = !query.from && !query.to
        ? [await build(null, null)]
        : await Promise.all([
          build(query.from ? Timestamp.fromDate(query.from) : null, query.to ? Timestamp.fromDate(query.to) : null),
          build(query.from ? query.from.toISOString() : null, query.to ? query.to.toISOString() : null),
        ]);
      return snaps.flatMap(snap => snap.docs.map(doc => ({ createdMs: toMillis(doc.get('createdAt')), resolvedMs: toMillis(doc.get('resolvedAt')) })));
    })().catch(() => []);
    const times = durations(sampleRows
      .sort((a, b) => (b.createdMs ?? 0) - (a.createdMs ?? 0))
      .slice(0, SAMPLE_SIZE));

    const months = monthsBetween(query.from, query.to);
    const monthly = await Promise.all(months.map(async month => ({
      month: month.key,
      received: await countWhere(q => q.where('status', 'in', [...STATUSES]), { from: month.start, to: month.end }),
    })));

    // Per municipality, only when the reader has not already chosen one.
    const byMunicipality = query.municipality
      ? []
      : (await Promise.all(KOSOVO_MUNICIPALITIES.map(async name => {
        const inArea = (q: FirebaseFirestore.Query) => q.where('location.municipality', '==', name);
        const [received, resolved] = await Promise.all([
          countWhere(q => inArea(q).where('status', 'in', [...STATUSES])),
          countWhere(q => inArea(q).where('status', 'in', ['Resolved', 'Closed'])),
        ]);
        return { municipality: name, received, resolved, resolutionRate: pct(resolved, received) };
      }))).filter(row => row.received > 0).sort((a, b) => b.received - a.received);

    // The latest finished cases, as published: title, place, date and the municipality's
    // own public response. No reporter, no photos, no internal note.
    const outcomesSnap = await (() => {
      let q: FirebaseFirestore.Query = reports.where('status', 'in', ['Resolved', 'Closed']);
      if (query.municipality) q = q.where('location.municipality', '==', query.municipality);
      if (query.category) q = q.where('category', '==', query.category);
      return q.orderBy('createdAt', 'desc').limit(8).select('title', 'category', 'trackingId', 'location', 'resolvedAt', 'timeline').get();
    })().catch(() => null);
    const recentOutcomes = (outcomesSnap?.docs ?? []).map(doc => {
      const data = doc.data() as { title?: unknown; category?: unknown; trackingId?: unknown; location?: { municipality?: unknown }; resolvedAt?: unknown; timeline?: unknown };
      const timeline = Array.isArray(data.timeline) ? (data.timeline as Array<{ source?: unknown; actorRole?: unknown; comment?: unknown }>) : [];
      const official = [...timeline].reverse().find(event => (event.source === 'municipality' || event.actorRole === 'municipality') && String(event.comment ?? '').trim());
      const resolvedMs = toMillis(data.resolvedAt);
      return {
        trackingId: String(data.trackingId ?? ''),
        title: String(data.title ?? '').slice(0, 140),
        category: String(data.category ?? ''),
        municipality: String(data.location?.municipality ?? ''),
        resolvedAt: resolvedMs ? new Date(resolvedMs).toISOString().slice(0, 10) : null,
        officialResponse: official ? String(official.comment).slice(0, 300) : null,
      };
    });

    const summary = summarize(counts);
    return {
      generatedAt: new Date().toISOString(),
      cacheSeconds: CACHE_MS / 1000,
      period: { from: query.from ? query.from.toISOString().slice(0, 10) : null, to: query.to ? new Date(query.to.getTime() - 86_400_000).toISOString().slice(0, 10) : null },
      filters: { municipality: query.municipality || null, category: query.category || null },
      summary,
      counts,
      resolutionTime: times,
      monthly,
      byMunicipality,
      recentOutcomes,
      definitions: DEFINITIONS,
    };
  }

  app.get('/api/v1/public/transparency', ...(deps.apiLimiter ? [deps.apiLimiter] : []), async (req: Request, res: Response) => {
    const parsed = parseQuery(req.query as Record<string, unknown>);
    if (parsed.ok === false) return res.status(400).json({ error: parsed.error });
    const { query } = parsed;
    const key = JSON.stringify([query.from?.toISOString() ?? '', query.to?.toISOString() ?? '', query.municipality, query.category]);
    res.setHeader('Cache-Control', `public, max-age=${CACHE_MS / 1000}`);

    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return res.json(hit.body);
    try {
      // Many visitors asking the same question at once share one computation.
      let work = inflight.get(key);
      if (!work) {
        work = compute(query).finally(() => inflight.delete(key));
        inflight.set(key, work);
      }
      const body = await work;
      if (cache.size > 200) cache.clear();
      cache.set(key, { at: Date.now(), body });
      return res.json(body);
    } catch (error: any) {
      const missingIndex = error?.code === 9 || /index/i.test(String(error?.message ?? ''));
      console.error('[TRANSPARENCY] failed:', error?.message);
      return res.status(missingIndex ? 503 : 500).json({ error: missingIndex ? 'Indeksi i kërkuar nuk është aktivizuar ende.' : 'Statistikat nuk u ngarkuan.' });
    }
  });
}

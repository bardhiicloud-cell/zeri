/**
 * Server-side planning of the admin reports list.
 *
 * The admin screens used to hold the newest 100 reports in the browser and
 * filter them there. That stops being true the moment more than 100 exist, and at
 * hundreds of thousands of reports a day it is wrong almost immediately. This
 * module turns a request into a bounded Firestore query instead, and it is where
 * record-level access is decided:
 *
 *   - which statuses and municipality a caller may see is fixed HERE, from the
 *     verified token, never from what the client asks for;
 *   - a municipality account is pinned to its own municipality and to public-
 *     record statuses, whatever filters it sends;
 *   - every filter combination maps onto a composite index that is declared in
 *     REQUIRED_REPORT_INDEXES and checked against firestore.indexes.json by a
 *     test, so a new filter cannot ship without its index.
 *
 * Pure functions only: no Firebase, no Express. The route in adminReports.ts
 * executes the plan.
 */
import { mayUseSection } from './policy';

export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 25;

const LEGAL_STATUSES = [
  'Draft', 'Pending Review', 'Approved', 'Assigned', 'In Progress',
  'Resolved', 'Rejected', 'Overdue', 'Closed',
] as const;

/** Statuses that are public record. Keep in step with editorialFirewall. */
export const MUNICIPALITY_VISIBLE_STATUSES: readonly string[] = [
  'Approved', 'Assigned', 'In Progress', 'Resolved', 'Overdue',
];

/** The status tabs of the reports screen, mapped onto stored statuses. */
const STATUS_GROUPS: Record<string, readonly string[]> = {
  unapproved: ['Pending Review'],
  'in-progress': ['Approved', 'Assigned', 'In Progress'],
  // Work under way: taken on by the municipality (or assigned to it).
  working: ['Assigned', 'In Progress'],
  unresolved: ['Pending Review', 'Approved', 'Assigned', 'In Progress', 'Overdue'],
  resolved: ['Resolved'],
  rejected: ['Rejected'],
  // "Past its deadline" depends on each category's response time, which Firestore
  // cannot compute; the stored `Overdue` status is what the server can filter on.
  overdue: ['Overdue'],
};

const URGENCIES = ['E ulët', 'Mesatare', 'E lartë', 'Kritike'] as const;

/**
 * Where the next page starts: the last row's `createdAt` and id.
 *
 * `value` is milliseconds for a Firestore Timestamp and an ISO string for a
 * document that stored its date as text (legacy and demo data). The cursor keeps
 * whichever the last row had, so the next `startAfter` compares like with like.
 */
export interface Cursor {
  value: number | string;
  id: string;
}

export interface ReportListQuery {
  /**
   * A tracking code or report id: an exact lookup that finds one report among any
   * number, ignoring the other filters (visibility rules still apply).
   */
  code?: string;
  /** A tab key (`unapproved`, `in-progress`, …) or a raw status. Empty = any. */
  status?: string;
  municipality?: string;
  urgency?: string;
  /** `me`: only the reports this caller has taken on ("Të miat"). */
  assignee?: 'me';
  /**
   * `oldest`: the ones that have waited longest first (the work inbox). Default is
   * newest first. Only offered for the filter shapes that have an ascending index.
   */
  order?: 'oldest';
  limit: number;
  cursor?: Cursor;
}

export interface Principal {
  /** Needed only for "Të miat"; the planner refuses that filter without it. */
  uid?: string;
  role: string;
  municipality: string;
  permissions: readonly string[];
}

export interface WhereClause {
  field: string;
  op: '==' | 'in';
  value: string | string[];
}

export interface QueryPlan {
  /** Present for an exact lookup: the code to find. `where` is then unused. */
  code?: string;
  /** True when the caller's visibility and the filters cannot match anything. */
  empty: boolean;
  where: WhereClause[];
  limit: number;
  cursor?: Cursor;
  /** The equality fields used, sorted — identifies the composite index needed. */
  indexKey: string;
  /** `asc` for oldest-first; everything else is newest-first (`desc`). */
  direction?: 'asc' | 'desc';
}

export type PlanResult =
  | { ok: true; plan: QueryPlan }
  | { ok: false; status: 400 | 403; error: string };

/**
 * Every set of equality filters the planner can emit, each followed by
 * `createdAt desc` in the query. Single-field filters need an index too,
 * because they are combined with an ordering on a different field.
 */
export const REQUIRED_REPORT_INDEXES: ReadonlyArray<readonly string[]> = [
  ['status'],
  ['urgency'],
  ['location.municipality'],
  ['location.municipality', 'status'],
  ['status', 'urgency'],
  ['location.municipality', 'urgency'],
  ['location.municipality', 'status', 'urgency'],
  // "Të miat": the reports a person has taken on, alone or by status.
  ['assignedToUid'],
  ['assignedToUid', 'status'],
];

/**
 * Oldest-first needs its own indexes: Firestore cannot read a descending index
 * backwards. Only the shapes the inbox uses are offered ascending.
 */
export const REQUIRED_ASC_REPORT_INDEXES: ReadonlyArray<readonly string[]> = [
  ['status'],
  ['location.municipality', 'status'],
];

const ASC_INDEX_KEYS: ReadonlySet<string> = new Set(REQUIRED_ASC_REPORT_INDEXES.map(fields => [...fields].sort().join('+')));

export const REPORT_INDEX_KEYS: ReadonlySet<string> = new Set([
  '',
  ...REQUIRED_REPORT_INDEXES.map(fields => [...fields].sort().join('+')),
]);

// ── Parsing ──────────────────────────────────────────────────────────────────

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify([cursor.value, cursor.id]), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      ((typeof parsed[0] === 'number' && Number.isFinite(parsed[0])) ||
        (typeof parsed[0] === 'string' && parsed[0].length > 0 && parsed[0].length <= 64)) &&
      typeof parsed[1] === 'string' && parsed[1].length > 0 && parsed[1].length <= 200
    ) {
      return { value: parsed[0], id: parsed[1] };
    }
  } catch {
    // Fall through: a malformed cursor is a client error, not a crash.
  }
  return null;
}

/** A query-string value that must be a single short string (rejects arrays/objects). */
function single(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || value.length > max) return null;
  return value.trim();
}

export type ParseResult =
  | { ok: true; query: ReportListQuery }
  | { ok: false; status: 400; error: string };

export function parseReportListQuery(raw: Record<string, unknown>): ParseResult {
  const bad = (error: string): ParseResult => ({ ok: false, status: 400, error });

  const code = single(raw.code, 40);
  if (code === null || (code && !/^[A-Za-z0-9_-]{3,40}$/.test(code))) return bad('Kodi nuk është i vlefshëm.');
  const status = single(raw.status, 40);
  const municipality = single(raw.municipality, 80);
  const urgency = single(raw.urgency, 20);
  const cursorRaw = single(raw.cursor, 400);
  const assignee = single(raw.assignee, 10);
  if (assignee === null || (assignee && assignee !== 'me')) return bad('Filtri i caktimit nuk njihet.');
  const order = single(raw.order, 10);
  if (order === null || (order && order !== 'oldest')) return bad('Renditja nuk njihet.');
  if (status === null) return bad('Statusi nuk është i vlefshëm.');
  if (municipality === null) return bad('Komuna nuk është e vlefshme.');
  if (urgency === null) return bad('Urgjenca nuk është e vlefshme.');
  if (cursorRaw === null) return bad('Kursori nuk është i vlefshëm.');

  if (status && !(status in STATUS_GROUPS) && !(LEGAL_STATUSES as readonly string[]).includes(status)) {
    return bad('Statusi nuk njihet.');
  }
  if (urgency && !(URGENCIES as readonly string[]).includes(urgency)) return bad('Urgjenca nuk njihet.');

  let limit = DEFAULT_PAGE_SIZE;
  if (raw.limit !== undefined && raw.limit !== '') {
    const parsed = typeof raw.limit === 'string' ? Number(raw.limit) : Number.NaN;
    if (!Number.isInteger(parsed) || parsed < 1) return bad('Madhësia e faqes nuk është e vlefshme.');
    limit = Math.min(parsed, MAX_PAGE_SIZE);
  }

  let cursor: Cursor | undefined;
  if (cursorRaw) {
    const decoded = decodeCursor(cursorRaw);
    if (!decoded) return bad('Kursori nuk është i vlefshëm.');
    cursor = decoded;
  }

  return { ok: true, query: { code, status, municipality, urgency, assignee: assignee ? 'me' : undefined, order: order ? 'oldest' : undefined, limit, cursor } };
}

// ── Planning (authorization lives here) ──────────────────────────────────────

export function planReportQuery(query: ReportListQuery, principal: Principal): PlanResult {
  // Default-deny: the caller must be allowed into the reports section at all.
  if (!mayUseSection({ role: principal.role, permissions: principal.permissions }, 'reports')) {
    return { ok: false, status: 403, error: 'Roli juaj nuk ka qasje te raportet.' };
  }

  const isMunicipality = principal.role === 'municipality';

  // Municipality isolation. The jurisdiction comes from the token alone; a
  // municipality that asks for another one is refused outright (not silently
  // re-scoped), so a probing attempt is visible in the logs.
  let municipality = query.municipality;
  if (isMunicipality) {
    if (!principal.municipality) {
      return { ok: false, status: 403, error: 'Llogaria nuk ka komunë të caktuar.' };
    }
    if (municipality && municipality !== principal.municipality) {
      return { ok: false, status: 403, error: 'Kjo llogari mbulon vetëm komunën e vet.' };
    }
    municipality = principal.municipality;
  }

  // An exact lookup. Visibility is not decided by a query here, so the route
  // checks the row itself (status for a municipality, and its municipality).
  if (query.code) {
    return { ok: true, plan: { empty: false, code: query.code, where: [], limit: 5, indexKey: '' } };
  }

  // Statuses requested, then narrowed to what this caller may see.
  let statuses: string[] | undefined = query.status
    ? [...(STATUS_GROUPS[query.status] ?? [query.status])]
    : undefined;

  if (isMunicipality) {
    const visible = MUNICIPALITY_VISIBLE_STATUSES;
    statuses = (statuses ?? [...visible]).filter(status => visible.includes(status));
    if (statuses.length === 0) {
      // E.g. a municipality asking for "Pending Review": nothing it may see matches.
      return { ok: true, plan: { empty: true, where: [], limit: query.limit, indexKey: '' } };
    }
  }

  const where: WhereClause[] = [];
  if (query.assignee === 'me') {
    if (!principal.uid) return { ok: false, status: 400, error: 'Mungon identiteti për "Të miat".' };
    // A municipality does not take reports on; the queue it answers is its own.
    if (isMunicipality) return { ok: false, status: 400, error: 'Komuna nuk ka "Të miat"; e gjithë radha e saj është e vetja.' };
    // Kept narrow so every combination has an index: mine, optionally by status.
    if (query.municipality || query.urgency) {
      return { ok: false, status: 400, error: '"Të miat" kombinohet vetëm me statusin.' };
    }
    where.push({ field: 'assignedToUid', op: '==', value: principal.uid });
    municipality = undefined;
  }
  if (municipality) where.push({ field: 'location.municipality', op: '==', value: municipality });
  if (statuses) {
    where.push(
      statuses.length === 1
        ? { field: 'status', op: '==', value: statuses[0] }
        : { field: 'status', op: 'in', value: statuses }
    );
  }
  if (query.urgency) where.push({ field: 'urgency', op: '==', value: query.urgency });

  const indexKey = where.map(clause => clause.field).sort().join('+');
  if (!REPORT_INDEX_KEYS.has(indexKey)) {
    // Unreachable by construction; guards a future filter added without its index.
    return { ok: false, status: 400, error: 'Kombinimi i filtrave nuk mbështetet.' };
  }

  const oldest = query.order === 'oldest';
  if (oldest && !ASC_INDEX_KEYS.has(indexKey)) {
    return { ok: false, status: 400, error: '"Më të vjetrat" kombinohet vetëm me statusin dhe komunën.' };
  }

  return {
    ok: true,
    plan: { empty: false, where, limit: query.limit, cursor: query.cursor, indexKey, direction: oldest ? 'asc' : 'desc' },
  };
}

// ── Output ───────────────────────────────────────────────────────────────────

/** Fields a municipality never receives: who reported, and how to reach them. */
const MUNICIPALITY_HIDDEN_FIELDS = ['authorId', 'authorName', 'authorEmail', 'authorPhone', 'reporterEmail'];

/** Converts Firestore Timestamps to ISO strings so the client gets plain JSON. */
function plain(value: unknown): unknown {
  if (value && typeof value === 'object') {
    const v = value as { toDate?: () => Date };
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    if (Array.isArray(value)) return value.map(plain);
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, x]) => [k, plain(x)]));
  }
  return value;
}

/** One report as sent to this caller. */
export function presentReport(id: string, data: Record<string, unknown>, principal: Principal): Record<string, unknown> {
  const out = plain({ id, ...data }) as Record<string, unknown>;
  if (principal.role === 'municipality') {
    for (const field of MUNICIPALITY_HIDDEN_FIELDS) delete out[field];
  }
  return out;
}

import { applyTransition, describeApiFailure, requireAdminToken } from './adminApi';

/**
 * Who holds a report while it is checked. The server records the person (uid),
 * when and by whom; see server/reportAssignment.ts.
 */

export interface Holder {
  assignedToUid: string;
  assignedTo: string;
}

/** "Merr përsipër": the signed-in agent (or owner) takes the report. */
export async function claimReport(reportId: string): Promise<void> {
  await applyTransition({ reportId, transition: 'claim' });
}

async function post(reportId: string, body: Record<string, unknown>): Promise<Holder> {
  const token = await requireAdminToken();
  const response = await fetch(`/api/v1/reports/${encodeURIComponent(reportId)}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(describeApiFailure(response.status, result));
  return { assignedToUid: String(result.assignedToUid ?? ''), assignedTo: String(result.assignedTo ?? '') };
}

/**
 * Optional guards for a change. `expectedHolderUid` is who the screen showed as holder
 * ('' = nobody): if someone changed it meanwhile the server answers 409 and writes nothing.
 * `reason` is required by the server when work is taken from another person.
 */
export interface HandoverOptions {
  reason?: string;
  expectedHolderUid?: string;
}

/** The owner hands the report to a specific agent. */
export const assignReport = (reportId: string, uid: string, options: HandoverOptions = {}) => post(reportId, { uid, ...options });

/** The holder gives the report back to the shared queue (or the owner takes it back). */
export const releaseReport = (reportId: string, options: HandoverOptions = {}) => post(reportId, { release: true, ...options });

export interface HandoverEntry {
  id: string;
  kind: 'assign' | 'release';
  fromUid: string;
  fromName: string;
  toUid: string;
  toName: string;
  byUid: string;
  /** Empty for entries written before names were recorded, and for the system. */
  byName?: string;
  reason: string;
  at: string;
}

export interface HandoverPage {
  items: HandoverEntry[];
  /** Pass back as `before` for the next (older) page; null when this was the last. */
  nextBefore: string | null;
}

/** Newest first, 20 per page by default. Staff, agents and the monitor only; the server answers 403 to anyone else. */
export async function fetchHandovers(reportId: string, options: { before?: string | null; limit?: number } = {}): Promise<HandoverPage> {
  const token = await requireAdminToken();
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.before) params.set('before', options.before);
  const query = params.toString();
  const response = await fetch(`/api/v1/reports/${encodeURIComponent(reportId)}/assignments${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(describeApiFailure(response.status, result));
  return {
    items: Array.isArray(result.items) ? (result.items as HandoverEntry[]) : [],
    nextBefore: typeof result.nextBefore === 'string' && result.nextBefore ? result.nextBefore : null,
  };
}

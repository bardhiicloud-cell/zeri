import { describeApiFailure, requireAdminToken } from './adminApi';

/** The conversation around a report; see server/reportCase.ts. */

export interface CaseItem {
  id: string;
  kind: 'info_request' | 'info_response' | 'note' | 'escalation' | 'escalation_resolved';
  text: string;
  byLabel: string;
  at: string | null;
  /** True for staff-only entries; the citizen's view never contains one. */
  internal: boolean;
}

export interface CaseThread {
  awaitingInfo: boolean;
  /** Present for staff only. */
  escalated?: boolean;
  items: CaseItem[];
}

async function call(method: 'GET' | 'POST', path: string, body?: unknown) {
  const token = await requireAdminToken();
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(describeApiFailure(response.status, result));
  return result;
}

const base = (id: string) => `/api/v1/reports/${encodeURIComponent(id)}`;

export const loadCase = (id: string): Promise<CaseThread> => call('GET', `${base(id)}/case`);
export const requestInfo = (id: string, question: string) => call('POST', `${base(id)}/request-info`, { question });
export const provideInfo = (id: string, answer: string) => call('POST', `${base(id)}/provide-info`, { answer });
export const addNote = (id: string, text: string) => call('POST', `${base(id)}/notes`, { text });
export const escalateReport = (id: string, reason: string) => call('POST', `${base(id)}/escalate`, { reason });
export const resolveEscalation = (id: string, reason: string) => call('POST', `${base(id)}/resolve-escalation`, { reason });

/** The citizen's own door, by the Track ID they hold (404 for anyone else's number). */
export const loadMyCase = (trackingId: string): Promise<CaseThread> => call('GET', `/api/v1/my-reports/${encodeURIComponent(trackingId)}/case`);
export const provideMyInfo = (trackingId: string, answer: string) => call('POST', `/api/v1/my-reports/${encodeURIComponent(trackingId)}/provide-info`, { answer });

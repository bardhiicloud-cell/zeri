import { describeApiFailure, requireAdminToken } from './adminApi';

/**
 * The municipality's desk: requests it filed (with the newsroom's answer) and the
 * work facts it registered. Everything is stored on the server; see
 * server/municipalityDesk.ts.
 */

export type RequestKind = 'respond' | 'correct_fact' | 'dispute' | 'request_removal';
export type RequestStatus = 'published' | 'pending' | 'accepted' | 'declined';

export interface DeskRequest {
  id: string;
  reportId: string;
  trackingId?: string;
  reportTitle?: string;
  kind: RequestKind;
  note: string;
  status: RequestStatus;
  at: string | null;
  decisionReason: string | null;
}

export interface DeskWorkFact {
  id: string;
  reportId: string;
  description: string;
  review: 'pending' | 'confirmed' | 'rejected';
  completedAt: string | null;
  at: string | null;
}

export interface Desk {
  requests: DeskRequest[];
  workFacts: DeskWorkFact[];
  /** The plan sold to this account and what it includes (the server enforces it). */
  plan: string;
  features: string[];
}

/** The cheapest plan that includes a feature, for "available from plan X". */
export const FEATURE_FROM_PLAN: Record<string, string> = {
  respond: 'Bazë', requests: 'Bazë', workFacts: 'Standard', health: 'Standard', export: 'Standard', email: 'Pro',
};

export const REQUEST_LABELS: Record<RequestKind, string> = {
  respond: 'Përgjigje zyrtare',
  correct_fact: 'Kërkesë për korrigjim fakti',
  dispute: 'Kundërshtim i raportit',
  request_removal: 'Kërkesë për heqje',
};

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

export async function loadDesk(): Promise<Desk> {
  const result = await call('GET', '/api/v1/municipality/desk');
  return {
    requests: Array.isArray(result.requests) ? result.requests : [],
    workFacts: Array.isArray(result.workFacts) ? result.workFacts : [],
    plan: typeof result.plan === 'string' ? result.plan : 'basic',
    features: Array.isArray(result.features) ? result.features : [],
  };
}

export const fileRequest = (reportId: string, kind: RequestKind, note: string) =>
  call('POST', `/api/v1/municipality/reports/${encodeURIComponent(reportId)}/request`, { kind, note });

export const addWorkFact = (input: { reportId: string; description: string; completedAt?: string; performedBy?: string; cost?: string }) =>
  call('POST', '/api/v1/municipality/work-facts', input);

/** A health case as a municipality sees it: no name, no contact details. */
export interface MunicipalHealthCase {
  id: string;
  trackingId: string;
  municipality: string;
  neighborhood: string;
  age: number | null;
  gender: string;
  category: string;
  diagnosis: string;
  urgency: string;
  needs: string[];
  description: string;
  status: 'pending' | 'verified' | 'rejected' | 'resolved';
  hospitalNotified: boolean;
  hospitalTarget: string;
  createdAt: string | null;
}

export async function loadHealthCases(): Promise<MunicipalHealthCase[]> {
  const result = await call('GET', '/api/v1/municipality/health');
  return Array.isArray(result.items) ? result.items : [];
}

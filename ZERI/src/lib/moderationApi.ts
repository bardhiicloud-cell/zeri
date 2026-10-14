import { authHeaders } from './apiAuth';

/**
 * Client for the debate moderation cases (server/moderationCases.ts). The server decides
 * what each action does to the content or account; this file only carries the request.
 */
export type CaseKind = 'post' | 'comment' | 'user' | 'ad';
export type CaseStatus = 'flagged' | 'under_review' | 'violation_confirmed' | 'restricted' | 'no_violation' | 'appealed' | 'resolved';
export type CaseAction =
  | 'claim' | 'release' | 'escalate' | 'dismiss' | 'hide' | 'remove' | 'unpromote' | 'warn' | 'suspend' | 'ban'
  | 'restore' | 'uphold' | 'overturn';
export type CaseView = 'queue' | 'mine' | 'escalated' | CaseStatus;

export interface ModerationCase {
  id: string;
  kind: CaseKind;
  targetId: string;
  postId: string;
  subjectUid: string;
  status: CaseStatus;
  open: boolean;
  reportCount: number;
  reasons: Record<string, number>;
  snapshot: { excerpt?: string; authorName?: string; name?: string; imageUrl?: string | null; postId?: string };
  priority: 'low' | 'normal' | 'high' | 'urgent';
  escalated: boolean;
  assigneeUid: string | null;
  assigneeName: string;
  decidedBy: string | null;
  decision: { action: string; reason: string; byUid: string; atMs: number; days?: number } | null;
  lastEffect: { type: string } | null;
  appeal: { text: string; atMs: number; outcome?: 'upheld' | 'overturned' | null } | null;
  firstReportedAtMs: number;
  lastReportedAtMs: number;
  updatedAtMs: number;
  version: number;
}

export interface CaseHistoryEntry {
  id: string;
  type: string;
  action: string;
  from?: string;
  to?: string;
  actorUid: string;
  actorName?: string;
  reason?: string;
  days?: number;
  atMs: number;
}

export interface CaseSubject {
  uid: string;
  name: string;
  warningCount: number;
  restriction: { kind: 'ban' | 'suspension'; untilMs: number | null } | null;
  priorCases: Array<{ id: string; kind: CaseKind; status: CaseStatus; effect: string | null; atMs: number }>;
}

export interface ModerationSummary {
  flagged: number;
  underReview: number;
  appealed: number;
  escalated: number;
  urgent: number;
  mine: number;
  oldestFlaggedAgeHours: number | null;
}

export interface MyModerationCase {
  id: string;
  kind: CaseKind;
  status: CaseStatus;
  effect: string | null;
  reason: string;
  decidedAtMs: number | null;
  excerpt: string;
  appeal: { atMs: number; outcome: 'upheld' | 'overturned' | null } | null;
  canAppeal: boolean;
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(typeof data?.error === 'string' ? data.error : 'Kërkesa dështoi.'), { code: data?.code, status: response.status });
  return data as T;
}

const qs = (params: Record<string, string | number | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const moderationApi = {
  list: (params: { view: CaseView; kind?: CaseKind | ''; cursor?: string | null; limit?: number; uid?: string }) =>
    call<{ cases: ModerationCase[]; nextCursor: string | null }>(`/api/v1/moderation/cases${qs(params)}`),
  summary: () => call<ModerationSummary>('/api/v1/moderation/summary'),
  detail: (id: string) => call<{ case: ModerationCase; history: CaseHistoryEntry[]; subject: CaseSubject | null }>(`/api/v1/moderation/cases/${encodeURIComponent(id)}`),
  decide: (id: string, body: { action: CaseAction; reason?: string; days?: number; expectedVersion?: number }) =>
    call<{ ok: true; case: ModerationCase; warning?: string }>(`/api/v1/moderation/cases/${encodeURIComponent(id)}/decide`, { method: 'POST', body }),
  backfill: () => call<{ created: number; scanned: number; more: boolean }>('/api/v1/moderation/backfill', { method: 'POST', body: {} }),
  myCases: () => call<{ restriction: CaseSubject['restriction']; warningCount: number; cases: MyModerationCase[] }>('/api/v1/moderation/my-cases'),
  appeal: (id: string, text: string) => call<{ ok: true }>(`/api/v1/moderation/cases/${encodeURIComponent(id)}/appeal`, { method: 'POST', body: { text } }),
};

export const KIND_LABELS: Record<CaseKind, string> = { post: 'Postim', comment: 'Koment', user: 'Llogari', ad: 'Reklamë' };
export const STATUS_LABELS: Record<CaseStatus, string> = {
  flagged: 'I raportuar', under_review: 'Në shqyrtim', violation_confirmed: 'Shkelje e konfirmuar', restricted: 'Llogari e kufizuar',
  no_violation: 'Pa shkelje', appealed: 'Me apelim', resolved: 'I mbyllur',
};
export const REASON_LABELS: Record<string, string> = {
  spam: 'Spam', abuse: 'Fyerje / ngacmim', misinformation: 'Dezinformim', violence: 'Dhunë / kërcënim', illegal: 'Përmbajtje e paligjshme',
  impersonation: 'Paraqitje e rreme', other: 'Tjetër',
};
export const EFFECT_LABELS: Record<string, string> = {
  hide: 'Postimi u fsheh', remove_post: 'Postimi u hoq', remove_comment: 'Komenti u hoq', unpromote: 'Promovimi u ndal',
  warn: 'Paralajmërim', suspend: 'Pezullim i përkohshëm', ban: 'Ndalim i përhershëm', dismiss: 'Pa shkelje',
};
export const ACTION_LABELS: Record<CaseAction | 'report' | 'backfill' | 'appeal', string> = {
  claim: 'Merr përsipër', release: 'Lësho', escalate: 'Eskalo', dismiss: 'Pa shkelje', hide: 'Fshih postimin', remove: 'Hiq përmbajtjen',
  unpromote: 'Ndal promovimin', warn: 'Paralajmëro', suspend: 'Pezullo', ban: 'Ndalo përgjithmonë', restore: 'Rikthe', uphold: 'Mbaj vendimin',
  overturn: 'Rrëzo vendimin', report: 'Raportim', backfill: 'Importuar nga raportimet e vjetra', appeal: 'Apelim',
};

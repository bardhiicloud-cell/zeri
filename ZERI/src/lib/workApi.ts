import { describeApiFailure, requireAdminToken } from './adminApi';
import type { WorkKind, WorkPriority } from './workflow/definitions';
import type { OrgSummary, WorkloadState } from './workflow/workload';

/**
 * The browser's door to the work-item API (server/workItemRoutes.ts).
 *
 * Nothing here decides what is allowed. The server returns the actions a person may take
 * on an item (`actions`) and refuses anything else, so the screens draw what they are told
 * and show the server's own reason when a move is refused.
 */
const BASE = '/api/v1/work';

export interface WorkItem {
  id: string;
  kind: WorkKind;
  title: string;
  description: string;
  priority: WorkPriority;
  status: string;
  open: boolean;
  assigneeUid: string | null;
  assigneeName: string;
  municipality: string;
  department: string;
  category: string;
  requiredSkills: string[];
  weight: number;
  requiresReview: boolean;
  requiresEvidence: boolean;
  createdByName: string;
  createdAtMs: number;
  updatedAtMs: number;
  doneAtMs: number | null;
  dueAtMs: number;
  escalationLevel: number;
  needsAttention: boolean;
  reworkCount: number;
  reopenCount: number;
  version: number;
  link?: { reportId?: string; postId?: string; institution?: string };
}

export interface WorkEvent {
  id: string;
  type: string;
  action?: string;
  from?: string;
  to?: string;
  actorUid?: string;
  actorName?: string;
  actorRole?: string;
  note?: string;
  reason?: string;
  override?: boolean;
  atMs: number;
  [key: string]: unknown;
}

export interface AvailableAction { action: string; label: string; requires: string[]; to: string }
export interface WorkflowStates { kind: WorkKind; states: Record<string, { label: string; terminal?: boolean; active?: boolean; waiting?: boolean }> }

export interface WorkDetail { item: WorkItem; events: WorkEvent[]; actions: AvailableAction[]; workflow: WorkflowStates }

export interface WorkerProfile {
  uid: string;
  name: string;
  role: string;
  municipality: string;
  department: string;
  skills: string[];
  capacity: number;
  load: number;
  activeCount: number;
  availability: 'available' | 'busy' | 'away' | 'off';
  disabled: boolean;
  state: WorkloadState;
  utilization?: number | null;
}

export interface WorkerPerformance {
  source: 'system';
  periodDays: number;
  finishedCount: number;
  weightedOutput: number;
  onTimeRate: number | null;
  reworkRate: number;
  reopenRate: number;
  overdueOpen: number;
  avgCycleHours: number | null;
  index: number | null;
  confidence: 'low' | 'ok';
}

export type ListView = 'mine' | 'unassigned' | 'attention' | 'overdue' | 'open' | 'worker' | 'done';

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await requireAdminToken();
  const response = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(describeApiFailure(response.status, result));
  return result as T;
}

const qs = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const workApi = {
  list: (params: { view: ListView; kind?: WorkKind | ''; uid?: string; cursor?: string | null; limit?: number }) =>
    call<{ items: WorkItem[]; nextCursor: string | null }>(`/items${qs(params)}`),
  detail: (id: string) => call<WorkDetail>(`/items/${encodeURIComponent(id)}`),
  create: (body: Record<string, unknown>) =>
    call<{ id: string; created: boolean; assignment: { outcome: string } | null }>('/items', { method: 'POST', body }),
  transition: (id: string, body: { action: string; note?: string; reason?: string; evidence?: string[]; assigneeUid?: string; expectedVersion?: number }) =>
    call<{ id: string; status: string; version: number; override: boolean }>(`/items/${encodeURIComponent(id)}/transition`, { method: 'POST', body }),
  autoAssign: (id: string, dryRun = false) => call<{ outcome: string; [key: string]: unknown }>(`/items/${encodeURIComponent(id)}/auto-assign`, { method: 'POST', body: { dryRun } }),
  overview: () => call<{ generatedAtMs: number; summary: OrgSummary; truncated: { items: boolean; workers: boolean } }>('/overview'),
  workers: (params: { q?: string; availability?: string; state?: string; cursor?: string | null; limit?: number } = {}) =>
    call<{ workers: WorkerProfile[]; nextCursor: string | null }>(`/workers${qs(params)}`),
  worker: (uid: string) => call<{ profile: WorkerProfile; open: WorkItem[]; recentFinished: number; performance: WorkerPerformance }>(`/workers/${encodeURIComponent(uid)}`),
  updateWorker: (uid: string, patch: Record<string, unknown>) => call<{ ok: true }>(`/workers/${encodeURIComponent(uid)}`, { method: 'PUT', body: patch }),
  syncWorkers: () => call<{ created: number; updated: number }>('/workers/sync', { method: 'POST', body: {} }),
  health: () => call<{ scheduler: { stale: boolean; lastRunAtMs?: number | null } | null; items: { open: number; unassigned: number; needsAttention: number } }>('/health'),
  runEscalations: () => call<Record<string, number>>('/run-escalations', { method: 'POST', body: {} }),
  notifications: () => call<{ notifications: Array<{ id: string; itemId: string; title: string; atMs: number; read: boolean }>; unread: number }>('/notifications'),
  markRead: (ids: string[]) => call<{ marked: number }>('/notifications/read', { method: 'POST', body: { ids } }),
  /** The CSV is fetched with the token (an <a href> cannot send it) and handed to the browser as a download. */
  async exportCsv(view: ListView, kind?: WorkKind | ''): Promise<void> {
    const token = await requireAdminToken();
    const response = await fetch(`${BASE}/export/items${qs({ view, kind })}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(describeApiFailure(response.status, await response.json().catch(() => ({}))));
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `detyra-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },
};

export const KIND_LABELS: Record<WorkKind, string> = {
  internal_task: 'Detyrë e brendshme',
  report_referral: 'Referim raporti',
  moderation_case: 'Moderim debati',
};
export const PRIORITY_LABELS: Record<WorkPriority, string> = { low: 'E ulët', normal: 'Normale', high: 'E lartë', urgent: 'Urgjente' };
export const STATE_LABELS: Record<WorkloadState, string> = { overloaded: 'Mbingarkuar', high: 'Ngarkesë e lartë', normal: 'Normale', under: 'Nën-përdorur', unavailable: 'Nuk është i disponueshëm' };

/** Whole hours or days past a deadline, or time left, as a short phrase. Pure. */
export function describeDue(dueAtMs: number | null | undefined, nowMs: number): { text: string; overdue: boolean } {
  if (!dueAtMs) return { text: 'Pa afat', overdue: false };
  const diff = dueAtMs - nowMs;
  const abs = Math.abs(diff);
  const hours = Math.round(abs / 3_600_000);
  const span = hours >= 48 ? `${Math.round(hours / 24)} ditë` : hours >= 1 ? `${hours} orë` : `${Math.max(1, Math.round(abs / 60_000))} min`;
  return diff < 0 ? { text: `${span} vonesë`, overdue: true } : { text: `edhe ${span}`, overdue: false };
}

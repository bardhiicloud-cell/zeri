/**
 * Browser client for the report workflow (server/reportWorkflow.ts). Every call
 * carries the signed-in account's token; the server decides what it may see and do.
 * Nothing here changes a status locally: screens re-read after the server answers.
 */
import { describeApiFailure, requireAdminToken } from './adminApi';
import { API_UNAVAILABLE_MESSAGE } from './apiBase';
import type { AssignmentStatus, PriorityLevel, PriorityRules, ReportAction, ReportQueue, TaskKind, WorkflowRole } from './reportWorkflow';

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const token = await requireAdminToken();
  let response: Response;
  try {
    response = await fetch(path, {
      method: init?.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new Error('Pa lidhje me serverin. Asgjë nuk u ndryshua; provoni përsëri.');
  }
  let body: unknown = null;
  try { body = await response.json(); } catch { /* empty or non-JSON body */ }
  if (!response.ok) {
    const error = new Error(describeApiFailure(response.status, body)) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = (body as { code?: string } | null)?.code;
    throw error;
  }
  // An answer that is not the API's JSON (a static page, an empty body) is not a result.
  if (body === null || typeof body !== 'object') throw new Error(API_UNAVAILABLE_MESSAGE);
  return body as T;
}

export interface QueueRow {
  id: string;
  trackingId: string;
  title: string;
  category: string;
  urgency: string;
  municipality: string;
  sector: string;
  status: string;
  queue: ReportQueue;
  overdue: boolean;
  priorityScore: number;
  priorityLevel: PriorityLevel | '';
  assignedTo: string;
  assigneeUids: string[];
  assignedMunicipalities: string[];
  submittedCount: number;
  assigneeCount: number;
  rejectionReason?: string;
  createdAtMs: number;
  updatedAtMs: number;
  authorName?: string;
  approvedByName?: string;
  thumb?: string;
  /** The one step this viewer would most likely take from the list. */
  quick?: { action: ReportAction; label: string; oneClick: boolean } | null;
}

export interface AssignmentRow {
  key: string;
  type: 'agent' | 'municipality';
  uid?: string | null;
  municipality?: string | null;
  name: string;
  status: AssignmentStatus;
  assignedByName?: string;
  assignedAtMs?: number;
  submittedAtMs?: number | null;
  submittedByName?: string;
  note?: string;
  evidence?: string[];
  returnReason?: string;
  cancelReason?: string;
}

export interface TaskRow {
  id: string;
  reportId: string;
  trackingId: string;
  title: string;
  category: string;
  municipality: string;
  sector: string;
  kind: TaskKind;
  label: string;
  doThis: string;
  status: 'open' | 'done' | 'cancelled';
  assigneeType: 'user' | 'municipality' | 'queue';
  assigneeUid: string | null;
  assigneeName: string;
  assigneeMunicipality: string | null;
  needsAssignment: boolean;
  reportStatus: string;
  priorityScore: number;
  priorityLevel: PriorityLevel;
  priorityReasons?: string[];
  dueAtMs: number;
  createdAtMs: number;
  closedAtMs: number | null;
}

export interface HistoryRow {
  id: string;
  action: string;
  label: string;
  from: ReportQueue;
  to: ReportQueue;
  fromStatus: string;
  toStatus: string;
  actorName: string;
  workflowRole: WorkflowRole | null;
  onBehalf: boolean;
  text: string;
  evidence: string[];
  atMs: number;
}

export interface ActionOption {
  action: ReportAction;
  label: string;
  tone: 'primary' | 'danger' | 'neutral';
  requires: { field: 'reason' | 'note'; min: number; prompt: string } | null;
  to: ReportQueue | null;
}

export interface ReportWorkflowDetail {
  report: QueueRow & {
    description: string;
    address: string;
    images: string[];
    media: Array<{ url: string; type: string; name: string; edited: boolean }>;
    zone: string;
    terrain: string;
    neighborhood: string;
    lat: number | null;
    lng: number | null;
    responsibleInstitution: string;
    responsibleOffice: string;
    responsibleLevel: string;
    topicCategory: string;
    canEditPhotos: boolean;
    resolutionClaim: { note?: string; by?: string; at?: string; evidence?: string[] } | null;
    resolutionSummary: string | null;
    finalOutcome: string | null;
    awaitingInfo: boolean;
    workflow: Record<string, unknown>;
    priorityReasons: string[];
  };
  assignments: AssignmentRow[];
  tasks: TaskRow[];
  history: HistoryRow[];
  timeline: Array<{ status?: string; date?: string; comment?: string; updatedBy?: string }>;
  actions: ActionOption[];
  role: WorkflowRole;
}

export interface CandidateRow {
  uid: string;
  name: string;
  role: string;
  eligible: boolean;
  score: number;
  why: string[];
  excluded: string | null;
  load: number;
  capacity: number;
  department: string;
  municipality: string;
}

export const fetchQueueCounts = () =>
  call<{ counts: Record<ReportQueue, number>; overdue: number; role: WorkflowRole }>('/api/v1/workflow/counts');

export const fetchQueue = (queue: ReportQueue, cursor?: string | null, municipality?: string) => {
  const params = new URLSearchParams({ queue, limit: '25' });
  if (cursor) params.set('cursor', cursor);
  if (municipality) params.set('municipality', municipality);
  return call<{ items: QueueRow[]; nextCursor: string | null }>(`/api/v1/workflow/reports?${params}`);
};

export const fetchReportWorkflow = (reportId: string) =>
  call<ReportWorkflowDetail>(`/api/v1/workflow/reports/${encodeURIComponent(reportId)}`);

/** A fresh id per user intent: a double click or a retry of the same intent is applied once. */
export const newRequestId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

export interface ActionInput {
  action: ReportAction;
  reason?: string;
  note?: string;
  assignees?: Array<{ type: 'agent'; uid: string } | { type: 'municipality'; municipality: string }>;
  evidence?: string[];
  expectedStatus?: string;
  requestId: string;
}

export const runReportAction = (reportId: string, input: ActionInput) =>
  call<{ ok: true; from: ReportQueue; to: ReportQueue; status: string; label: string; replay?: boolean }>(
    `/api/v1/workflow/reports/${encodeURIComponent(reportId)}/action`, { method: 'POST', body: input });

export const fetchCandidates = (reportId: string, kind: 'work' | 'review' = 'work') =>
  call<{ people: CandidateRow[]; municipality: { name: string; hasAccount: boolean } | null }>(
    `/api/v1/workflow/reports/${encodeURIComponent(reportId)}/candidates?kind=${kind}`);

export const autoAssign = (reportId: string, requestId: string) =>
  call<{ ok: true; to: ReportQueue }>(`/api/v1/workflow/reports/${encodeURIComponent(reportId)}/auto-assign`, { method: 'POST', body: { requestId } });

export const fetchTasks = (view: 'mine' | 'queue' | 'all', status: 'open' | 'closed' = 'open') =>
  call<{ items: TaskRow[]; now: number }>(`/api/v1/workflow/tasks?view=${view}&status=${status}`);

export const assignTask = (taskId: string, uid: string, reason?: string) =>
  call<{ ok: true }>(`/api/v1/workflow/tasks/${encodeURIComponent(taskId)}/assign`, { method: 'POST', body: { uid, reason } });

export const syncTasks = () => call<{ scanned: number; synced: number }>('/api/v1/workflow/sync', { method: 'POST', body: {} });

export const fetchPriorityRules = () => call<{ rules: PriorityRules }>('/api/v1/workflow/priority-rules');
export const savePriorityRules = (rules: PriorityRules) => call<{ rules: PriorityRules }>('/api/v1/workflow/priority-rules', { method: 'PUT', body: { rules } });

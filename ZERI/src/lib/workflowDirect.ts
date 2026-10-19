/**
 * The reports panel without the API server.
 *
 * The preferred path is server/reportWorkflow.ts (assignments, tasks, audit log). When
 * that server is not reachable, an administrator must still be able to see what is
 * waiting and approve or reject it, otherwise citizens' reports sit in "Në pritje"
 * forever. The database rules already let an admin/superadmin token write a report's
 * status directly (firestore.rules → reports → `isSuperAdmin()`), so this module does
 * the essential moves itself: list a queue, count it, move a report one stage on,
 * reject it with a reason. Every move appends a public timeline entry, which is what
 * the citizen's Track ID page shows.
 */
import {
  arrayUnion, collection, doc, getCountFromServer, getDocFromServer, getDocsFromServer, limit, query, updateDoc, where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { API_UNAVAILABLE_CODE, API_UNAVAILABLE_MESSAGE } from './apiBase';
import { QUEUE_STATUSES, QUEUE_TEXT, REPORT_QUEUES, REPORT_STAGES, STAGE_STATUS, queueOfStatus, type ReportQueue } from './reportWorkflow';
import type { QueueRow } from './workflowApi';

/** The API is absent or asleep, as opposed to having refused the request. */
export function isApiUnavailableError(error: unknown): boolean {
  const e = error as { code?: string; status?: number; message?: string } | null;
  if (!e) return false;
  if (e.code === API_UNAVAILABLE_CODE || e.status === 503 || e.status === 502 || e.status === 504) return true;
  const message = String(e.message ?? '');
  return message === API_UNAVAILABLE_MESSAGE || message.startsWith('Pa lidhje me serverin') || message.includes('(HTTP 404)');
}

function ms(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'string') return Date.parse(value) || 0;
  const v = value as { toMillis?: () => number; seconds?: number };
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
}

const NEXT_LABEL: Partial<Record<ReportQueue, string>> = {
  pending: 'Aprovo',
  approved: 'Cakto / Kalo në "I caktuar"',
  assigned: 'Fillo procesin',
  in_process: 'Shëno të zgjidhur',
  resolved: 'Mbyll rastin',
};

export function nextQueue(queue: ReportQueue): ReportQueue | null {
  const i = REPORT_STAGES.indexOf(queue as (typeof REPORT_STAGES)[number]);
  if (i < 0 || i >= REPORT_STAGES.length - 1) return null;
  return REPORT_STAGES[i + 1];
}

export function toQueueRow(id: string, d: Record<string, any>): QueueRow {
  const queue = queueOfStatus(d.status);
  const images: string[] = Array.isArray(d.images) ? d.images : [];
  const due = ms(d.responseDueAt);
  const next = nextQueue(queue);
  return {
    id,
    trackingId: String(d.trackingId ?? ''),
    title: String(d.title ?? ''),
    category: String(d.category ?? ''),
    urgency: String(d.urgency ?? ''),
    municipality: String(d.location?.municipality ?? d.municipality ?? ''),
    sector: String(d.topicCategory ?? ''),
    status: String(d.status ?? 'Pending Review'),
    queue,
    overdue: Boolean(due && due < Date.now() && queue !== 'closed' && queue !== 'resolved' && queue !== 'rejected'),
    priorityScore: 0,
    priorityLevel: '',
    assignedTo: String(d.assignedTo ?? ''),
    assigneeUids: [],
    assignedMunicipalities: [],
    submittedCount: 0,
    assigneeCount: 0,
    rejectionReason: d.rejectionReason ? String(d.rejectionReason) : undefined,
    createdAtMs: ms(d.createdAt),
    updatedAtMs: ms(d.updatedAt) || ms(d.createdAt),
    authorName: d.isAnonymous ? 'Anonim' : String(d.authorName ?? ''),
    thumb: images[0],
    quick: next && NEXT_LABEL[queue] ? { action: 'approve_report', label: NEXT_LABEL[queue]!, oneClick: true } : null,
  };
}

export async function directCounts(): Promise<Record<ReportQueue, number>> {
  const entries = await Promise.all(REPORT_QUEUES.map(async (q) => {
    const snap = await getCountFromServer(query(collection(db, 'reports'), where('status', 'in', [...QUEUE_STATUSES[q]])));
    return [q, snap.data().count] as const;
  }));
  return Object.fromEntries(entries) as Record<ReportQueue, number>;
}

/** Newest first. No `orderBy`, so it needs no composite index; sorted here. */
export async function directQueue(queue: ReportQueue, max = 200): Promise<QueueRow[]> {
  const snap = await getDocsFromServer(query(collection(db, 'reports'), where('status', 'in', [...QUEUE_STATUSES[queue]]), limit(max)));
  return snap.docs
    .map(d => toQueueRow(d.id, d.data()))
    .sort((a, b) => (queue === 'pending' ? a.createdAtMs - b.createdAtMs : b.updatedAtMs - a.updatedAtMs));
}

export async function directReport(id: string): Promise<Record<string, any> | null> {
  const snap = await getDocFromServer(doc(db, 'reports', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

function actorName(): string {
  const u = auth.currentUser;
  return u?.displayName || 'Administrata e platformës';
}

const PERMISSION_TEXT = 'Kjo llogari nuk ka të drejtë ta ndryshojë raportin pa serverin. Kyçuni si administrator.';

async function write(id: string, patch: Record<string, unknown>): Promise<void> {
  try {
    await updateDoc(doc(db, 'reports', id), patch);
  } catch (error) {
    if ((error as { code?: string })?.code === 'permission-denied') throw new Error(PERMISSION_TEXT);
    throw error;
  }
}

/** Move one stage on (Në pritje → U aprovua → … → U mbyll). Returns the new queue. */
export async function directAdvance(id: string, currentStatus: string, note = ''): Promise<ReportQueue> {
  const from = queueOfStatus(currentStatus);
  const to = nextQueue(from);
  if (!to) throw new Error('Ky raport nuk ka fazë tjetër.');
  const now = new Date().toISOString();
  const status = STAGE_STATUS[to];
  await write(id, {
    status,
    updatedAt: now,
    ...(to === 'resolved' ? { resolvedAt: now } : {}),
    ...(to === 'closed' ? { closedAt: now } : {}),
    timeline: arrayUnion({
      id: `t_${Date.now().toString(36)}`,
      status,
      previousStatus: currentStatus,
      date: now,
      comment: note || QUEUE_TEXT[to].label,
      updatedBy: actorName(),
      actorRole: 'staff',
      source: 'admin',
    }),
  });
  return to;
}

export async function directReject(id: string, currentStatus: string, reason: string): Promise<void> {
  const text = reason.trim();
  if (text.length < 5) throw new Error('Shkruani arsyen e refuzimit (së paku 5 shenja).');
  const now = new Date().toISOString();
  await write(id, {
    status: 'Rejected',
    rejectionReason: text,
    updatedAt: now,
    timeline: arrayUnion({
      id: `t_${Date.now().toString(36)}`,
      status: 'Rejected',
      previousStatus: currentStatus,
      date: now,
      comment: text,
      updatedBy: actorName(),
      actorRole: 'staff',
      source: 'admin',
    }),
  });
}

/** Rikthe një raport të refuzuar në "Në pritje". */
export async function directReopen(id: string, currentStatus: string): Promise<void> {
  const now = new Date().toISOString();
  await write(id, {
    status: 'Pending Review',
    updatedAt: now,
    timeline: arrayUnion({ id: `t_${Date.now().toString(36)}`, status: 'Pending Review', previousStatus: currentStatus, date: now, comment: 'U rikthye për shqyrtim', updatedBy: actorName(), actorRole: 'staff', source: 'admin' }),
  });
}

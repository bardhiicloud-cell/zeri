import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * A rejected report is not kept. Twenty-four hours after staff reject it (long
 * enough for the citizen to read the reason on /trackid), the report, everything
 * attached to it and its files in Storage are erased.
 *
 * What is left behind is a tombstone with no content (`deletedReports/{trackingId}`:
 * the id, the time, the reason code), so a citizen who comes back with the Track ID
 * is told what happened instead of "not found".
 *
 * The sweep is idempotent: a report is erased only when it is still `Rejected`, and
 * Storage and Firestore deletes ignore what is already gone, so overlapping workers
 * or a restart in the middle of a purge are harmless.
 */

// Firestore documents are untyped data; every field is read through a guard below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportDoc = Record<string, any>;

export const REJECTED_RETENTION_MS = 24 * 60 * 60_000;
export const DELETED_REPORTS = 'deletedReports';

export interface PurgeBucket {
  file(path: string): { delete(options?: { ignoreNotFound?: boolean }): Promise<unknown> };
  deleteFiles(options: { prefix: string; force?: boolean }): Promise<unknown>;
}

const toMs = (value: unknown): number | null => {
  if (!value) return null;
  const v = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const t = Date.parse(value); return Number.isNaN(t) ? null : t; }
  return null;
};

/** When the report was rejected: the pipeline's own stamp, else the newest `Rejected` timeline event. */
export function rejectedAtMs(report: ReportDoc): number | null {
  const stamped = toMs(report?.workflow?.rejectedAtMs) ?? toMs(report?.rejectedAt);
  if (stamped) return stamped;
  const events: Array<Record<string, unknown>> = Array.isArray(report?.timeline) ? report.timeline : [];
  const times = events.filter(event => event?.status === 'Rejected').map(event => toMs(event.date)).filter((t): t is number => t !== null);
  if (times.length) return Math.max(...times);
  return toMs(report?.updatedAt);
}

export function purgeDueAtMs(report: ReportDoc): number | null {
  const at = rejectedAtMs(report);
  return at === null ? null : at + REJECTED_RETENTION_MS;
}

export function isPurgeDue(report: ReportDoc, now: number): boolean {
  if (report?.status !== 'Rejected') return false;
  const due = purgeDueAtMs(report);
  return due !== null && due <= now;
}

/** Object path of a Firebase Storage download URL (`.../o/<encoded path>?...`), or null for any other URL. */
export function storagePathFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const match = /\/o\/([^?#]+)/.exec(url);
  if (!match || !/(firebasestorage|storage\.googleapis)/.test(url)) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

/** Every file the report points at: its own folder plus any other Storage object named by a URL in the document. */
export function reportStorageTargets(report: ReportDoc, reportId: string): { prefixes: string[]; files: string[] } {
  const prefixes = new Set<string>();
  const authorId = String(report?.authorId ?? '');
  if (authorId && reportId) prefixes.add(`reports/${authorId}/${reportId}/`);

  const urls: unknown[] = [];
  const addMedia = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const item of list) urls.push(typeof item === 'string' ? item : (item as { url?: unknown })?.url);
  };
  addMedia(report?.media);
  addMedia(report?.images);
  urls.push(report?.resolvedImage);
  for (const event of Array.isArray(report?.timeline) ? report.timeline : []) addMedia(event?.attachments);

  const files = new Set<string>();
  for (const url of urls) {
    const path = storagePathFromUrl(url);
    if (path) files.add(path);
  }
  return { prefixes: [...prefixes], files: [...files] };
}

async function deleteWhere(db: Firestore, collection: string, field: string, value: string): Promise<void> {
  const snap = await db.collection(collection).where(field, '==', value).limit(400).get();
  if (snap.empty) return;
  const batch = db.batch();
  for (const doc of snap.docs) batch.delete(doc.ref);
  await batch.commit();
}

/** Erases one report completely. Files first: if they fail the document stays, so the next sweep retries with the paths still known. */
export async function purgeReport(db: Firestore, bucket: PurgeBucket | null, reportId: string, report: ReportDoc, now: number): Promise<void> {
  const { prefixes, files } = reportStorageTargets(report, reportId);
  if (bucket) {
    for (const prefix of prefixes) await bucket.deleteFiles({ prefix, force: true });
    for (const path of files) await bucket.file(path).delete({ ignoreNotFound: true });
  } else if (prefixes.length || files.length) {
    throw new Error('No Storage bucket is configured, so the report files could not be erased.');
  }

  await deleteWhere(db, 'reportTasks', 'reportId', reportId);
  await deleteWhere(db, 'workItems', 'link.reportId', reportId);
  await deleteWhere(db, 'report_events', 'reportId', reportId);

  const trackingId = String(report?.trackingId ?? '');
  if (trackingId) {
    await db.collection(DELETED_REPORTS).doc(trackingId).set({
      trackingId, reason: 'rejected', deletedAt: FieldValue.serverTimestamp(), deletedAtMs: now,
    });
  }
  await db.recursiveDelete(db.collection('reports').doc(reportId));
}

export async function purgeRejectedReports(
  db: Firestore, bucket: PurgeBucket | null, now: number = Date.now(), limit = 50,
): Promise<{ purged: number; failed: number }> {
  const snap = await db.collection('reports').where('status', '==', 'Rejected').limit(300).get();
  let purged = 0;
  let failed = 0;
  for (const doc of snap.docs) {
    if (purged + failed >= limit) break;
    const data = doc.data();
    if (!isPurgeDue(data, now)) continue;
    try {
      await purgeReport(db, bucket, doc.id, data, now);
      purged += 1;
    } catch (error) {
      failed += 1;
      console.error('[PURGE] rejected report not erased:', doc.id, (error as Error)?.message);
    }
  }
  return { purged, failed };
}

/** Hourly: a report is gone within an hour of its 24 hours running out. */
export function startRejectedPurge(db: () => Firestore, bucket: () => PurgeBucket | null, everyMs = 60 * 60_000): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await purgeRejectedReports(db(), bucket());
      if (result.purged || result.failed) console.log(`[PURGE] rejected reports erased: ${result.purged}, failed: ${result.failed}`);
    } catch (error) {
      console.error('[PURGE] sweep failed:', (error as Error)?.message);
    } finally { running = false; }
  };
  const timer = setInterval(() => void tick(), everyMs);
  timer.unref?.();
  setTimeout(() => void tick(), 30_000).unref?.();
  return () => clearInterval(timer);
}

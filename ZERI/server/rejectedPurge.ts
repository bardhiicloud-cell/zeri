import type { Firestore } from 'firebase-admin/firestore';

/**
 * A rejected report does not stay in the system.
 *
 * For 24 hours after the rejection the person who filed it can still look the report up by its
 * Track ID and sees only the code and "Refuzuar" (server/trackView.ts). After that the whole report
 * is deleted: the document and everything under it (history, case messages, internal notes,
 * upvotes, removed photos), the private contact (`reportPrivate`), the photos and videos in Storage,
 * the tasks and work items made for it and the notifications that point at it.
 *
 * What stays is a tombstone, `reportTombstones/{trackingId}`, holding the code, the status and the
 * two dates, so the code answers "refused, deleted after 24 hours" instead of "never existed".
 *
 * Every step is idempotent and the report document is deleted last, so a run that stops halfway is
 * finished by the next one, and overlapping workers are safe.
 */

export const PURGE_AFTER_MS = 24 * 3_600_000;
export const TOMBSTONES = 'reportTombstones';

// Firestore documents are untyped data; every field is read through a guard below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{4,128}$/;

function toMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') { const t = Date.parse(value); return Number.isNaN(t) ? null : t; }
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') return (value as { toMillis: () => number }).toMillis();
  if (value && typeof (value as { seconds?: unknown }).seconds === 'number') return (value as { seconds: number }).seconds * 1000;
  return null;
}

/**
 * When the report was last refused: the latest of the date written with the decision and the last
 * "Rejected" entry of its timeline. The latest, so a report that was re-opened and refused again
 * gets a fresh 24 hours instead of inheriting the first refusal's clock.
 */
export function rejectedAtMs(report: Doc): number | null {
  const candidates: number[] = [];
  const direct = toMs(report.rejectedAt);
  if (direct) candidates.push(direct);
  const fromWorkflow = toMs(report.workflow?.rejectedAtMs);
  if (fromWorkflow) candidates.push(fromWorkflow);
  const timeline: Doc[] = Array.isArray(report.timeline) ? report.timeline : [];
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (timeline[i]?.status === 'Rejected') { const t = toMs(timeline[i].date); if (t) candidates.push(t); break; }
  }
  return candidates.length ? Math.max(...candidates) : null;
}

export function isPurgeDue(report: Doc, now: number): boolean {
  if (report.status !== 'Rejected') return false;
  const at = rejectedAtMs(report);
  // A rejected report with no date at all cannot be aged, so it is left for a person to look at.
  return at !== null && now - at >= PURGE_AFTER_MS;
}

/** `reports/…` object paths of the files a report points at (Firebase / emulator download URLs). */
export function storagePathsOf(report: Doc): string[] {
  const urls: string[] = [];
  const push = (value: unknown) => { if (typeof value === 'string') urls.push(value); };
  (Array.isArray(report.images) ? report.images : []).forEach(push);
  (Array.isArray(report.media) ? report.media : []).forEach((m: Doc) => push(m?.url));
  push(report.resolvedImage);
  const paths = new Set<string>();
  for (const url of urls) {
    const match = /\/o\/([^?]+)/.exec(url);
    if (!match) continue;
    try {
      const path = decodeURIComponent(match[1]);
      if (path.startsWith('reports/') && !path.includes('..')) paths.add(path);
    } catch { /* not ours */ }
  }
  return [...paths];
}

export interface PurgeDeps {
  db: () => Firestore;
  /** Storage bucket, or null where none is configured (files are then left for the bucket's own lifecycle rule). */
  bucket?: () => { deleteFiles: (o: { prefix: string; force?: boolean }) => Promise<unknown>; file: (p: string) => { delete: (o?: { ignoreNotFound?: boolean }) => Promise<unknown> } } | null;
}

async function deleteWhere(db: Firestore, collection: string, field: string, value: string): Promise<number> {
  let removed = 0;
  for (;;) {
    const snap = await db.collection(collection).where(field, '==', value).limit(200).get();
    if (snap.empty) return removed;
    for (const doc of snap.docs) { await db.recursiveDelete(doc.ref); removed += 1; }
    if (snap.size < 200) return removed;
  }
}

/** Deletes one report and everything that belongs to it. Throws if a step fails; the report document goes last. */
export async function purgeReport(deps: PurgeDeps, id: string, report: Doc, now: number): Promise<void> {
  const db = deps.db();
  const trackingId = String(report.trackingId ?? '');
  if (!SAFE_SEGMENT.test(id)) throw new Error('unsafe report id');

  if (trackingId) {
    await db.collection(TOMBSTONES).doc(trackingId).set({
      trackingId, status: 'Rejected', rejectedAtMs: rejectedAtMs(report), purgedAtMs: now,
    });
  }

  const bucket = deps.bucket?.() ?? null;
  if (bucket) {
    const author = String(report.authorId ?? '');
    if (SAFE_SEGMENT.test(author)) await bucket.deleteFiles({ prefix: `reports/${author}/${id}/`, force: true });
    await bucket.deleteFiles({ prefix: `reports/edited/${id}/`, force: true });
    for (const path of storagePathsOf(report)) await bucket.file(path).delete({ ignoreNotFound: true });
  }

  await db.collection('reportPrivate').doc(id).delete();
  await deleteWhere(db, 'workItems', 'link.reportId', id);
  await deleteWhere(db, 'reportTasks', 'reportId', id);
  await deleteWhere(db, 'notifications', 'link.reportId', id);

  await db.recursiveDelete(db.collection('reports').doc(id));
}

export interface PurgeResult { scanned: number; purged: number; failed: number }

/** One sweep: every rejected report past 24 hours, at most `limit` per run. */
export async function purgeRejectedReports(deps: PurgeDeps, now = Date.now(), limit = 100): Promise<PurgeResult> {
  const snap = await deps.db().collection('reports').where('status', '==', 'Rejected').limit(500).get();
  const result: PurgeResult = { scanned: snap.size, purged: 0, failed: 0 };
  for (const doc of snap.docs) {
    if (result.purged + result.failed >= limit) break;
    const data = doc.data() as Doc;
    if (!isPurgeDue(data, now)) continue;
    try {
      await purgeReport(deps, doc.id, data, now);
      result.purged += 1;
    } catch (error) {
      result.failed += 1;
      console.warn('[PURGE] report not deleted, will retry:', doc.id, (error as Error)?.message);
    }
  }
  return result;
}

/** Runs the sweep every ten minutes. Overlapping workers are safe (see the note at the top). */
export function startRejectedPurge(deps: PurgeDeps, everyMs = 10 * 60_000): () => void {
  const run = () => { void purgeRejectedReports(deps).then(r => { if (r.purged || r.failed) console.log('[PURGE]', r); }).catch(e => console.warn('[PURGE] run failed:', e?.message)); };
  const first = setTimeout(run, 30_000);
  const timer = setInterval(run, everyMs);
  first.unref?.();
  timer.unref?.();
  return () => { clearTimeout(first); clearInterval(timer); };
}

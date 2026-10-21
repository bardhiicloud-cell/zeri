import { describe, expect, it, vi } from 'vitest';
import {
  isPurgeDue, purgeDueAtMs, purgeReport, rejectedAtMs, reportStorageTargets, storagePathFromUrl, REJECTED_RETENTION_MS,
} from '../../server/rejectedPurge';

const T0 = Date.parse('2026-10-20T15:41:00Z');

describe('rejected report retention', () => {
  it('uses the pipeline stamp, else the newest Rejected event', () => {
    expect(rejectedAtMs({ workflow: { rejectedAtMs: T0 } })).toBe(T0);
    expect(rejectedAtMs({ rejectedAt: new Date(T0).toISOString() })).toBe(T0);
    expect(rejectedAtMs({ timeline: [
      { status: 'Rejected', date: new Date(T0 - 5000).toISOString() },
      { status: 'Rejected', date: new Date(T0).toISOString() },
    ] })).toBe(T0);
  });

  it('is due exactly 24 hours after the rejection, and only for a Rejected report', () => {
    const report = { status: 'Rejected', workflow: { rejectedAtMs: T0 } };
    expect(purgeDueAtMs(report)).toBe(T0 + REJECTED_RETENTION_MS);
    expect(isPurgeDue(report, T0 + REJECTED_RETENTION_MS - 1)).toBe(false);
    expect(isPurgeDue(report, T0 + REJECTED_RETENTION_MS)).toBe(true);
    expect(isPurgeDue({ ...report, status: 'Approved' }, T0 + 10 * REJECTED_RETENTION_MS)).toBe(false);
  });
});

describe('what is erased from Storage', () => {
  it('reads the object path from a download URL', () => {
    expect(storagePathFromUrl('https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/reports%2Fu1%2Fr1%2Fa.jpg?alt=media&token=t')).toBe('reports/u1/r1/a.jpg');
    expect(storagePathFromUrl('https://cdn.example/a.jpg')).toBeNull();
    expect(storagePathFromUrl(undefined)).toBeNull();
  });

  it('covers the report folder and every other file the document points at', () => {
    const url = (p: string) => `https://firebasestorage.googleapis.com/v0/b/b/o/${encodeURIComponent(p)}?alt=media`;
    const targets = reportStorageTargets({
      authorId: 'u1',
      media: [{ type: 'video', url: url('reports/u1/r1/v.mp4') }],
      images: [url('elsewhere/a.jpg')],
      resolvedImage: url('resolved/r1.jpg'),
      timeline: [{ attachments: [{ url: url('timeline/t.jpg') }] }],
    }, 'r1');
    expect(targets.prefixes).toEqual(['reports/u1/r1/']);
    expect(targets.files.sort()).toEqual(['elsewhere/a.jpg', 'reports/u1/r1/v.mp4', 'resolved/r1.jpg', 'timeline/t.jpg']);
  });
});

function fakeDb() {
  const deleted: string[] = [];
  const written: Array<[string, Record<string, unknown>]> = [];
  const batch = { delete: (ref: { path: string }) => deleted.push(ref.path), commit: vi.fn(async () => undefined) };
  const db = {
    collection: (name: string) => ({
      where: () => ({ limit: () => ({ get: async () => ({ empty: false, docs: [{ ref: { path: `${name}/x` } }] }) }) }),
      doc: (id: string) => ({ path: `${name}/${id}`, set: async (data: Record<string, unknown>) => { written.push([`${name}/${id}`, data]); } }),
    }),
    batch: () => batch,
    recursiveDelete: vi.fn(async (ref: { path: string }) => { deleted.push(`recursive:${ref.path}`); }),
  };
  return { db: db as never, deleted, written };
}

describe('purgeReport', () => {
  it('erases files, linked work, the report itself, and leaves a content-free tombstone', async () => {
    const { db, deleted, written } = fakeDb();
    const bucket = { deleteFiles: vi.fn(async () => undefined), file: vi.fn(() => ({ delete: vi.fn(async () => undefined) })) };
    await purgeReport(db, bucket, 'r1', { authorId: 'u1', trackingId: 'ZQ-1', title: 'sekret' }, T0);
    expect(bucket.deleteFiles).toHaveBeenCalledWith({ prefix: 'reports/u1/r1/', force: true });
    expect(deleted).toContain('recursive:reports/r1');
    expect(deleted).toEqual(expect.arrayContaining(['reportTasks/x', 'workItems/x', 'report_events/x']));
    expect(written).toHaveLength(1);
    expect(written[0][0]).toBe('deletedReports/ZQ-1');
    expect(JSON.stringify(written[0][1])).not.toContain('sekret');
  });

  it('keeps the report when the files cannot be erased, so the next sweep retries', async () => {
    const { db, deleted } = fakeDb();
    const bucket = { deleteFiles: vi.fn(async () => { throw new Error('boom'); }), file: vi.fn() };
    await expect(purgeReport(db, bucket, 'r1', { authorId: 'u1', trackingId: 'ZQ-1' }, T0)).rejects.toThrow('boom');
    expect(deleted).not.toContain('recursive:reports/r1');
  });
});

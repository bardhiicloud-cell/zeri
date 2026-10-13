import { createHash, randomUUID } from 'node:crypto';
import type { Express, Request, RequestHandler, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { pipelineRoleOf } from './approvalPipeline';

/**
 * Cropping a report photo: cut out a face, a number plate, or what is not part of
 * the problem, and keep the rest.
 *
 * The cut is made in the reviewer's browser (a canvas), the result is checked and
 * stored here. Two routes:
 *
 *   GET  /api/v1/reports/:id/media/file?url=…   the photo's bytes, same origin, so
 *        the browser may draw it on a canvas (Storage URLs are cross-origin and
 *        would "taint" it).
 *   POST /api/v1/reports/:id/media/crop         the cropped image replaces the photo
 *        in the report; the original moves to the private `removedMedia`
 *        subcollection, so it can be restored and nothing is lost.
 *
 * The server never fetches a URL. A citizen chooses the media URLs of a report, so
 * fetching them would let anyone make the server call any address (SSRF). Instead
 * a photo is read from OUR bucket by its object path, and only under `reports/`
 * - never health documents, private messages or anything else.
 */

const ALLOWED_PREFIX = 'reports/';
const MAX_BYTES = 6 * 1024 * 1024;

/** The Storage object path of a report photo, or null when it is not one of ours. */
export function storagePathOf(item: { url?: unknown; path?: unknown }, bucket: string): string | null {
  const fromPath = typeof item.path === 'string' ? item.path : '';
  const candidate = fromPath || pathFromDownloadUrl(String(item.url ?? ''), bucket) || '';
  if (!candidate.startsWith(ALLOWED_PREFIX)) return null;
  if (candidate.includes('..') || candidate.includes('\\')) return null;
  return candidate;
}

/** `…/v0/b/<bucket>/o/<encoded path>?alt=media…` → path, only for our bucket. */
export function pathFromDownloadUrl(url: string, bucket: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const match = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
  if (!match || match[1] !== bucket) return null;
  try {
    return decodeURIComponent(match[2]);
  } catch {
    return null;
  }
}

const SIGNATURES: Array<{ mime: string; ext: string; test: (b: Buffer) => boolean }> = [
  { mime: 'image/jpeg', ext: 'jpg', test: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', test: b => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', ext: 'webp', test: b => b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
];

export type ParsedImage = { ok: true; bytes: Buffer; mime: string; ext: string } | { ok: false; error: string };

/** A `data:image/…;base64,…` value, checked by its real bytes, not its label. */
export function parseImageDataUrl(value: unknown): ParsedImage {
  if (typeof value !== 'string') return { ok: false, error: 'Mungon imazhi.' };
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return { ok: false, error: 'Lejohen vetëm JPEG, PNG ose WebP.' };
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0) return { ok: false, error: 'Imazhi është bosh.' };
  if (bytes.length > MAX_BYTES) return { ok: false, error: 'Imazhi është më i madh se 6 MB.' };
  const kind = SIGNATURES.find(s => s.test(bytes));
  if (!kind || kind.mime !== match[1]) return { ok: false, error: 'Përmbajtja nuk përputhet me llojin e imazhit.' };
  return { ok: true, bytes, mime: kind.mime, ext: kind.ext };
}

const mayEditPhotos = (actor: { role: string; permissions: readonly string[] }) => {
  const role = pipelineRoleOf(actor.role, actor.permissions);
  return role === 'staff' || role === 'agent';
};

interface MediaItem { type?: string; url?: string; path?: string; [key: string]: unknown }
const list = (value: unknown): MediaItem[] => (Array.isArray(value) ? (value as MediaItem[]).filter(i => i && typeof i === 'object') : []);

/** A report's photos as media items; older reports carry only an `images` list. */
export function photosOf(data: Record<string, any>): MediaItem[] {
  const media = list(data.media);
  if (media.length > 0) return media;
  const images = Array.isArray(data.images) ? (data.images as unknown[]).filter((u): u is string => typeof u === 'string') : [];
  return images.map(url => ({ type: 'image', url }));
}

export interface PhotoEditDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  bucket: () => { name: string; file: (path: string) => any } | null;
  actingUser: (req: Request) => { uid: string; role: string; permissions: string[] };
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
}

/** A public download URL for an object we just wrote (emulator or production). */
function downloadUrl(bucket: string, path: string, token: string): string {
  const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const base = host ? `http://${host}` : 'https://firebasestorage.googleapis.com';
  return `${base}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

export function registerPhotoEditRoutes(app: Express, deps: PhotoEditDeps): void {
  app.get('/api/v1/reports/:id/media/file', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    if (!mayEditPhotos(actor)) return res.status(403).json({ error: 'Nuk keni qasje në fotot e redaktimit.' });
    const bucket = deps.bucket();
    if (!bucket) return res.status(503).json({ error: 'Ruajtja e skedarëve nuk është konfiguruar.' });
    try {
      const snap = await deps.db().collection('reports').doc(String(req.params.id)).get();
      if (!snap.exists) return res.status(404).json({ error: 'Raporti nuk u gjet.' });
      const url = String(req.query.url ?? '');
      const found = photosOf(snap.data() ?? {}).find(m => m.url === url) ?? null;
      if (!found) return res.status(404).json({ error: 'Fotoja nuk është te ky raportim.' });
      const path = storagePathOf(found, bucket.name);
      if (!path) return res.status(422).json({ error: 'Kjo foto nuk ruhet te platforma; mund të hiqet, por jo të pritet.' });
      const [bytes] = await bucket.file(path).download();
      if (bytes.length > MAX_BYTES * 2) return res.status(413).json({ error: 'Fotoja është shumë e madhe për t\'u prerë këtu.' });
      const kind = SIGNATURES.find(s => s.test(bytes));
      if (!kind) return res.status(415).json({ error: 'Ky skedar nuk është foto që mund të pritet.' });
      res.setHeader('Content-Type', kind.mime);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(bytes);
    } catch (error: any) {
      console.error('[REPORTS] photo read failed:', error?.message);
      return res.status(500).json({ error: 'Fotoja nuk u lexua.' });
    }
  });

  app.post('/api/v1/reports/:id/media/crop', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    if (!mayEditPhotos(actor)) return res.status(403).json({ error: 'Vetëm administratori dhe agjenti presin fotot.' });
    const bucket = deps.bucket();
    if (!bucket) return res.status(503).json({ error: 'Ruajtja e skedarëve nuk është konfiguruar.' });
    const reportId = String(req.params.id ?? '').trim();
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    const image = parseImageDataUrl(req.body?.image);
    if (image.ok === false) return res.status(400).json({ error: image.error });

    try {
      const ref = deps.db().collection('reports').doc(reportId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Raporti nuk u gjet.' });
      const data = snap.data() as Record<string, any>;
      const media = photosOf(data);
      const index = media.findIndex(m => m.url === url);
      if (index < 0) return res.status(404).json({ error: 'Fotoja nuk është te ky raportim (ose ka ndryshuar).' });

      const path = `reports/edited/${reportId}/${Date.now().toString(36)}.${image.ext}`;
      const token = randomUUID();
      await bucket.file(path).save(image.bytes, {
        resumable: false,
        contentType: image.mime,
        metadata: { metadata: { firebaseStorageDownloadTokens: token, editedBy: actor.uid, source: url.slice(0, 512) } },
      });
      const newUrl = downloadUrl(bucket.name, path, token);
      const now = new Date().toISOString();
      const original = media[index];
      const nextMedia = media.map((m, i) => (i === index ? { ...m, url: newUrl, path, editedAt: now } : m));
      const nextImages = nextMedia.filter(m => m.type === 'image' && typeof m.url === 'string').map(m => m.url as string);

      const batch = deps.db().batch();
      batch.update(ref, {
        media: nextMedia,
        images: nextImages,
        updatedAt: now,
        timeline: FieldValue.arrayUnion({
          id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
          status: String(data.status ?? ''),
          date: now,
          updatedBy: actor.role === 'agent' ? 'Agjenti i platformës' : 'Administrata',
          previousStatus: String(data.status ?? ''),
          comment: 'Një foto u redaktua (u pre).',
        }),
      });
      // The original stays, privately, so the crop can be undone.
      batch.set(ref.collection('removedMedia').doc(createHash('sha256').update(String(original.url)).digest('hex').slice(0, 32)), {
        ...original,
        removedAt: now,
        removedBy: actor.uid,
        removedReason: 'U zëvendësua nga një version i prerë.',
        replacedBy: newUrl,
      });
      await batch.commit();

      deps.audit('report.media.crop', req, { reportId, from: url.slice(0, 300), to: path });
      return res.json({ ok: true, url: newUrl, images: nextImages });
    } catch (error: any) {
      console.error('[REPORTS] crop failed:', error?.message);
      return res.status(500).json({ error: 'Fotoja e prerë nuk u ruajt.' });
    }
  });

  /** Put the original back where a crop replaced it. Body: `{ url }` = the cropped photo's url. */
  app.post('/api/v1/reports/:id/media/uncrop', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    if (!mayEditPhotos(actor)) return res.status(403).json({ error: 'Vetëm administratori dhe agjenti rikthejnë fotot.' });
    const reportId = String(req.params.id ?? '').trim();
    const croppedUrl = typeof req.body?.url === 'string' ? req.body.url : '';
    if (!reportId || !croppedUrl) return res.status(400).json({ error: 'Kërkesa nuk është e plotë.' });
    try {
      const ref = deps.db().collection('reports').doc(reportId);
      const [snap, kept] = await Promise.all([ref.get(), ref.collection('removedMedia').where('replacedBy', '==', croppedUrl).limit(1).get()]);
      if (!snap.exists) return res.status(404).json({ error: 'Raporti nuk u gjet.' });
      if (kept.empty) return res.status(404).json({ error: 'Ky version nuk ka origjinal të ruajtur.' });
      const original = kept.docs[0].data() as MediaItem;
      const media = photosOf(snap.data() as Record<string, any>);
      const index = media.findIndex(m => m.url === croppedUrl);
      if (index < 0) return res.status(404).json({ error: 'Fotoja e prerë nuk është më te ky raportim.' });

      const { removedAt, removedBy, removedReason, replacedBy, ...restored } = original as Record<string, unknown>;
      void removedAt; void removedBy; void removedReason; void replacedBy;
      const nextMedia = media.map((m, i) => (i === index ? (restored as MediaItem) : m));
      const nextImages = nextMedia.filter(m => m.type === 'image' && typeof m.url === 'string').map(m => m.url as string);
      const now = new Date().toISOString();
      const batch = deps.db().batch();
      batch.update(ref, {
        media: nextMedia,
        images: nextImages,
        updatedAt: now,
        timeline: FieldValue.arrayUnion({
          id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
          status: String(snap.data()?.status ?? ''),
          date: now,
          updatedBy: actor.role === 'agent' ? 'Agjenti i platformës' : 'Administrata',
          previousStatus: String(snap.data()?.status ?? ''),
          comment: 'Një foto u rikthye në versionin origjinal.',
        }),
      });
      batch.delete(kept.docs[0].ref);
      await batch.commit();
      deps.audit('report.media.uncrop', req, { reportId, restored: String(original.url ?? '').slice(0, 300) });
      return res.json({ ok: true, images: nextImages });
    } catch (error: any) {
      console.error('[REPORTS] uncrop failed:', error?.message);
      return res.status(500).json({ error: 'Origjinali nuk u rikthye.' });
    }
  });
}

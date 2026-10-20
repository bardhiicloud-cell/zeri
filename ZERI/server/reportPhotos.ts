import { randomBytes } from 'node:crypto';
import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { createIpRateLimiter } from './security';

/**
 * Report photos kept in Firestore, for a project without Firebase Storage.
 *
 * Firebase Storage needs the paid Blaze plan for a new bucket. Until one exists the
 * photo of a report is stored here instead: the browser sends a small JPEG/PNG/WebP
 * (at most MAX_PHOTO_BYTES, shrunk on the phone first), the server keeps it in
 * `reportPhotos/{id}` and the report's `media` entry points at GET /api/v1/report-photos/:id.
 * Firestore rules deny every direct client access to the collection; only this server reads it.
 */
export const MAX_PHOTO_BYTES = 800 * 1024;

const SIGNATURES: Array<{ mime: string; matches: (b: Buffer) => boolean }> = [
  { mime: 'image/jpeg', matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', matches: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', matches: (b) => b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
];

/** The type is read from the bytes, never taken from what the client says it sent. */
export function sniffImageMime(bytes: Buffer): string | null {
  return SIGNATURES.find((s) => s.matches(bytes))?.mime ?? null;
}

export interface ReportPhotoDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  /** Test seam. */
  limiter?: RequestHandler;
}

export function registerReportPhotoRoutes(app: Express, deps: ReportPhotoDeps): void {
  const limiter = deps.limiter ?? createIpRateLimiter({
    windowMs: 10 * 60_000, max: 60, floodFactor: 3, banMs: 15 * 60_000,
    message: 'Shumë foto u dërguan. Provoni përsëri pas pak.', code: 'PHOTO_RATE_LIMIT',
  });

  app.post('/api/v1/report-photos', limiter, deps.requireAuth, async (req: Request, res: Response) => {
    const uid = String((req.user as { uid?: string } | undefined)?.uid ?? '');
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const body = (req.body ?? {}) as { data?: unknown; reportId?: unknown };
    if (typeof body.data !== 'string' || !body.data) return res.status(400).json({ error: 'Fotoja mungon.' });
    const bytes = Buffer.from(body.data.replace(/^data:[^,]*,/, ''), 'base64');
    if (bytes.length === 0) return res.status(400).json({ error: 'Fotoja është bosh.' });
    if (bytes.length > MAX_PHOTO_BYTES) return res.status(413).json({ error: 'Fotoja është shumë e madhe.' });
    const mime = sniffImageMime(bytes);
    if (!mime) return res.status(400).json({ error: 'Lejohen vetëm foto JPEG, PNG ose WebP.' });

    const id = randomBytes(12).toString('hex');
    try {
      await deps.db().collection('reportPhotos').doc(id).create({
        authorId: uid,
        reportId: typeof body.reportId === 'string' ? body.reportId.slice(0, 64) : '',
        mimeType: mime,
        sizeBytes: bytes.length,
        bytes,
        createdAt: FieldValue.serverTimestamp(),
      });
      return res.status(201).json({ id, mimeType: mime, sizeBytes: bytes.length });
    } catch (error) {
      console.error('[PHOTOS] store failed:', error instanceof Error ? error.message : error);
      return res.status(500).json({ error: 'Fotoja nuk u ruajt. Provoni përsëri.' });
    }
  });

  /** Public, like a Storage download URL: the id is an unguessable 96-bit token. */
  app.get('/api/v1/report-photos/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    if (!/^[0-9a-f]{24}$/.test(id)) return res.status(404).end();
    try {
      const snap = await deps.db().collection('reportPhotos').doc(id).get();
      const data = snap.data() as { bytes?: Buffer | Uint8Array; mimeType?: string } | undefined;
      if (!snap.exists || !data?.bytes) return res.status(404).end();
      res.setHeader('Content-Type', data.mimeType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      // The site and this server are different origins; helmet's default would block the <img>.
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.end(Buffer.from(data.bytes));
    } catch (error) {
      console.error('[PHOTOS] read failed:', error instanceof Error ? error.message : error);
      return res.status(500).end();
    }
  });
}

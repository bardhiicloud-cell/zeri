import { createHash } from 'node:crypto';
import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { pipelineRoleOf } from './approvalPipeline';
import { MAX_REASON, MIN_REASON } from './userModeration';

/**
 * Removing and restoring a photo on a report, done on the server.
 *
 * Reviewing a report often ends with "this photo should not be public": a face,
 * a number plate, an unrelated image. The reviewer needs to act on the photo
 * itself, not reject the whole report.
 *
 * Removal never destroys evidence. The photo leaves `media` and `images` (so the
 * public page and the lists stop showing it) and moves to a PRIVATE subcollection,
 * `reports/{id}/removedMedia`, with who removed it, when and why. It must not stay
 * on the report document: that document is readable by the public, and so would
 * be the address of the photo that was taken down. The file in Storage is kept, so
 * a removal can be undone and a dispute answered. Every removal and restore is a
 * neutral timeline event and a line in the audit log (the reason lives only there).
 *
 * Who: administrators and agents (the pipeline's `staff` and `agent`). A
 * municipality may not remove a citizen's photo, and a monitor only watches.
 */

export type MediaAction = 'remove' | 'restore';

interface MediaItem {
  type?: string;
  url?: string;
  [key: string]: unknown;
}

export interface MediaDecisionInput {
  actor: { role: string; permissions: readonly string[] };
  report: { media?: unknown; images?: unknown };
  /** Photos already taken down, read from the private subcollection. */
  removed: unknown;
  action: MediaAction;
  url: unknown;
  reason: unknown;
}

export type MediaDecision =
  | { outcome: 'allow'; media: MediaItem[]; images: string[]; taken: MediaItem | null; reason: string; url: string }
  | { outcome: 'deny'; status: 400 | 403 | 404; error: string };

const deny = (status: 400 | 403 | 404, error: string): MediaDecision => ({ outcome: 'deny', status, error });
const list = (value: unknown): MediaItem[] => (Array.isArray(value) ? (value as MediaItem[]).filter(item => item && typeof item === 'object') : []);

/** The same set of photos the report API derives `images` from. */
const imageUrls = (media: MediaItem[]): string[] =>
  media.filter(item => item.type === 'image' && typeof item.url === 'string').map(item => item.url as string);

/** May this actor remove or restore this photo, and what does the report look like afterwards? Pure. */
export function decideMediaChange(input: MediaDecisionInput): MediaDecision {
  const pipelineRole = pipelineRoleOf(input.actor.role, input.actor.permissions);
  if (pipelineRole !== 'staff' && pipelineRole !== 'agent') {
    return deny(403, 'Vetëm administratori dhe agjenti mund të ndryshojnë fotot e një raportimi.');
  }
  if (input.action !== 'remove' && input.action !== 'restore') return deny(400, 'Veprimi nuk njihet.');

  const url = typeof input.url === 'string' ? input.url.trim() : '';
  if (!url) return deny(400, 'Mungon fotoja.');

  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (input.action === 'remove') {
    if (reason.length < MIN_REASON) return deny(400, `Arsyeja është e detyrueshme (të paktën ${MIN_REASON} shenja).`);
  }
  if (reason.length > MAX_REASON) return deny(400, `Arsyeja nuk mund të kalojë ${MAX_REASON} shenja.`);

  const media = list(input.report.media);
  const removed = list(input.removed);

  if (input.action === 'remove') {
    // A report may carry only `images` (older documents). Treat those as photos too.
    const inMedia = media.some(item => item.url === url);
    const legacyImages = Array.isArray(input.report.images) ? (input.report.images as unknown[]).filter((u): u is string => typeof u === 'string') : [];
    const inLegacy = legacyImages.includes(url);
    if (!inMedia && !inLegacy) return deny(404, 'Fotoja nuk është te ky raportim.');

    const taken = media.find(item => item.url === url) ?? { type: 'image', url };
    const nextMedia = media.filter(item => item.url !== url);
    const nextImages = inMedia ? imageUrls(nextMedia) : legacyImages.filter(u => u !== url);
    return {
      outcome: 'allow',
      media: nextMedia,
      images: nextImages,
      taken,
      reason,
      url,
    };
  }

  const bring = removed.find(item => item.url === url);
  if (!bring) return deny(404, 'Kjo foto nuk është ndër të hequrat.');
  const nextMedia = [...media, bring];
  const nextImages = media.length === 0 && Array.isArray(input.report.images)
    ? [...(input.report.images as string[]), url]
    : imageUrls(nextMedia);
  return {
    outcome: 'allow',
    media: nextMedia,
    images: nextImages,
    taken: null,
    reason,
    url,
  };
}

export interface ReportMediaDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  actingUser: (req: Request) => { uid: string; role: string; permissions: string[] };
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
}

/** Stable, path-safe id for a photo URL. */
const keyFor = (url: string): string => createHash('sha256').update(url).digest('hex').slice(0, 32);

export function registerReportMediaRoutes(app: Express, deps: ReportMediaDeps): void {
  const handle = (action: MediaAction) => async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const reportId = String(req.params.id ?? '').trim();
    if (!reportId) return res.status(400).json({ error: 'Mungon id e raportit.' });

    try {
      const ref = deps.db().collection('reports').doc(reportId);
      const snapshot = await ref.get();
      if (!snapshot.exists) return res.status(404).json({ error: 'Raporti nuk u gjet.' });
      const report = snapshot.data() as Record<string, any>;
      const removedRef = ref.collection('removedMedia');
      const removedDocs = await removedRef.get();

      const decision = decideMediaChange({
        actor: { role: actor.role, permissions: actor.permissions },
        report,
        removed: removedDocs.docs.map(doc => doc.data()),
        action,
        url: req.body?.url,
        reason: req.body?.reason,
      });
      if (decision.outcome === 'deny') {
        deps.audit(`report.media.${action}.denied`, req, { reportId, reason: decision.error });
        return res.status(decision.status).json({ error: decision.error });
      }

      let actorName = '';
      try {
        const profile = await deps.db().collection('users').doc(actor.uid).get();
        if (profile.exists) actorName = String(profile.data()?.name ?? '');
      } catch {
        /* a display name only */
      }
      const now = new Date().toISOString();
      const label = actorName.trim() || (actor.role === 'agent' ? 'Agjenti i platformës' : 'Administrata');

      const batch = deps.db().batch();
      batch.update(ref, {
        media: decision.media,
        images: decision.images,
        updatedAt: now,
        timeline: FieldValue.arrayUnion({
          id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
          status: String(report.status ?? ''),
          date: now,
          updatedBy: label,
          actorRole: pipelineRoleOf(actor.role, actor.permissions) ?? 'staff',
          previousStatus: String(report.status ?? ''),
          // The timeline is public: say what happened, never the reason or the photo.
          comment: action === 'remove' ? 'Një foto u hoq nga redaktimi.' : 'Një foto u rikthye.',
        }),
      });
      const keep = removedRef.doc(keyFor(decision.url));
      if (action === 'remove' && decision.taken) {
        batch.set(keep, { ...decision.taken, removedAt: now, removedBy: actor.uid, removedByName: label, removedReason: decision.reason });
      } else {
        batch.delete(keep);
      }
      await batch.commit();

      deps.audit(`report.media.${action}`, req, { reportId, url: decision.url, reason: decision.reason || null });
      return res.json({ ok: true, action, media: decision.media, images: decision.images });
    } catch (error) {
      console.error('[REPORTS] media change failed:', error?.message);
      return res.status(500).json({ error: 'Ndryshimi i fotos nuk u krye. Provoni përsëri.' });
    }
  };

  app.post('/api/v1/reports/:id/media/remove', deps.requireAuth, handle('remove'));
  app.post('/api/v1/reports/:id/media/restore', deps.requireAuth, handle('restore'));
}

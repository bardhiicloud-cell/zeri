/**
 * News tips from citizens ("Lajmëro"): a citizen sends what they know (corruption, propaganda,
 * anything of public interest) with photos or video. It is NOT published as sent. The newsroom
 * receives it with a Track-ID, checks it, and — only if it holds up — writes its own article
 * (own layout, own ads, own elements), taking the text, photos and video the citizen supplied as
 * source material. The citizen can follow the stage with the Track-ID and nothing else is shown.
 *
 *   Në pritje → U pranua → Në përpunim (a draft article exists) → U publikua      (+ Të refuzuara)
 *
 *   POST /api/v1/public/news-tips                 submit (rate limited, anonymous allowed)
 *   GET  /api/v1/public/submission-status?ref=    stage of an LJ- (news), DN- (donation) or HC- (health) Track-ID
 *   GET  /api/v1/admin/news-tips?stage=           the newsroom queue
 *   GET  /api/v1/admin/news-tips/:id              full tip with media, for download
 *   POST /api/v1/admin/news-tips/:id/action       accept | reject | create_draft | mark_published
 *
 * Staff only for the queue (news section); the sender's contact is private to staff.
 */
import { randomBytes } from 'node:crypto';
import { reserveReference } from './trackingIds';
import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { createIpRateLimiter } from './security';
import { mayUseSection } from './policy';
import { clean } from './contactMessages';

export const TIP_CATEGORIES = ['korrupsion', 'antipropagande', 'politike', 'ekonomi', 'siguri', 'mjedis', 'shoqeri', 'tjera'] as const;
export const TIP_CATEGORY_LABEL: Record<string, string> = {
  korrupsion: 'Korrupsion', antipropagande: 'Antipropagandë', politike: 'Politikë', ekonomi: 'Ekonomi', siguri: 'Siguri',
  mjedis: 'Mjedis', shoqeri: 'Shoqëri', tjera: 'Tjera',
};

export type TipStage = 'submitted' | 'accepted' | 'in_editing' | 'published' | 'rejected';
export const TIP_STAGES: readonly TipStage[] = ['submitted', 'accepted', 'in_editing', 'published', 'rejected'];
export const TIP_STAGE_LABEL: Record<TipStage, string> = {
  submitted: 'Në pritje', accepted: 'U pranua', in_editing: 'Në përpunim', published: 'U publikua', rejected: 'U refuzua',
};

/** The body ceiling is 1 MB, so the embedded media has to leave room for the text. */
export const TIP_MEDIA_MAX_CHARS = 700_000;
export const TIP_MEDIA_MAX_ITEMS = 3;
const MEDIA_DATA_URI = /^data:(image\/(?:jpeg|png|webp)|video\/(?:mp4|webm));base64,[A-Za-z0-9+/=]+$/;

export interface TipInput {
  title: string; body: string; category: string; municipality: string; place: string;
  anonymous: boolean; contactName: string; contactEmail: string; contactPhone: string;
  media: Array<{ type: 'image' | 'video'; url: string }>;
}

type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export function validateTip(body: unknown): Result<TipInput> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const title = clean(b.title, 160);
  const text = clean(b.body, 6000);
  const category = clean(b.category, 30);
  const anonymous = b.anonymous === true;
  const contactEmail = anonymous ? '' : clean(b.contactEmail, 160);
  const rawMedia = Array.isArray(b.media) ? b.media : [];
  if (title.length < 8) errors.title = 'Titulli duhet të ketë të paktën 8 shkronja.';
  if (text.length < 40) errors.body = 'Shkruani çfarë dini (të paktën 40 shkronja): kush, çfarë, ku dhe kur.';
  if (!(TIP_CATEGORIES as readonly string[]).includes(category)) errors.category = 'Zgjidhni një kategori.';
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail)) errors.contactEmail = 'Emaili nuk është i vlefshëm.';
  if (rawMedia.length > TIP_MEDIA_MAX_ITEMS) errors.media = `Maksimumi ${TIP_MEDIA_MAX_ITEMS} foto ose video.`;
  const media: TipInput['media'] = [];
  let total = 0;
  for (const item of rawMedia.slice(0, TIP_MEDIA_MAX_ITEMS)) {
    const url = typeof item === 'string' ? item : typeof (item as { url?: unknown })?.url === 'string' ? (item as { url: string }).url : '';
    const match = MEDIA_DATA_URI.exec(url.trim());
    total += url.length;
    if (!match) { errors.media = 'Lejohen vetëm foto JPG, PNG, WebP ose video MP4, WebM.'; break; }
    media.push({ type: match[1].startsWith('video') ? 'video' : 'image', url: url.trim() });
  }
  if (total > TIP_MEDIA_MAX_CHARS) errors.media = 'Fotot dhe videoja janë shumë të mëdha; zvogëloni ose dërgoni më pak.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title, body: text, category, anonymous,
      municipality: clean(b.municipality, 80), place: clean(b.place, 200),
      contactName: anonymous ? '' : clean(b.contactName, 120), contactEmail, contactPhone: anonymous ? '' : clean(b.contactPhone, 40),
      media,
    },
  };
}

/* ------------------------------------------------------------------ */
/* The decision                                                        */
/* ------------------------------------------------------------------ */

export type TipAction = 'accept' | 'reject' | 'create_draft' | 'mark_published';
export const TIP_ACTIONS: readonly TipAction[] = ['accept', 'reject', 'create_draft', 'mark_published'];

const MOVES: Record<TipAction, { from: readonly TipStage[]; to: TipStage; label: string; reason?: boolean }> = {
  accept: { from: ['submitted'], to: 'accepted', label: 'Pranoj lajmin' },
  reject: { from: ['submitted', 'accepted', 'in_editing'], to: 'rejected', label: 'Refuzo', reason: true },
  create_draft: { from: ['accepted'], to: 'in_editing', label: 'Krijo artikullin (draft)' },
  mark_published: { from: ['in_editing'], to: 'published', label: 'U publikua' },
};

export const tipActionLabel = (action: TipAction) => MOVES[action].label;
export const tipActionsFrom = (stage: TipStage): TipAction[] => TIP_ACTIONS.filter(a => MOVES[a].from.includes(stage));

export type TipDecision =
  | { outcome: 'allow'; to: TipStage; reason: string }
  | { outcome: 'deny'; status: 400 | 403 | 409; code: string; error: string };

export function decideTipAction(input: { actor: { role: string; permissions: readonly string[] }; stage: TipStage; action: unknown; reason?: unknown }): TipDecision {
  if (!mayUseSection({ role: input.actor.role, permissions: [...input.actor.permissions] }, 'news')) {
    return { outcome: 'deny', status: 403, code: 'WRONG_ROLE', error: 'Vetëm redaksia (lajmet) i pranon dhe i përpunon lajmet e qytetarëve.' };
  }
  if (input.actor.role === 'monitor') return { outcome: 'deny', status: 403, code: 'READ_ONLY', error: 'Monitorimi vëzhgon; nuk ndryshon.' };
  if (typeof input.action !== 'string' || !(TIP_ACTIONS as readonly string[]).includes(input.action)) {
    return { outcome: 'deny', status: 400, code: 'UNKNOWN_ACTION', error: 'Veprimi nuk njihet.' };
  }
  const move = MOVES[input.action as TipAction];
  if (!move.from.includes(input.stage)) {
    return { outcome: 'deny', status: 409, code: 'WRONG_STAGE', error: `"${move.label}" nuk lejohet kur lajmi është "${TIP_STAGE_LABEL[input.stage]}".` };
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (move.reason && (reason.length < 5 || reason.length > 500)) {
    return { outcome: 'deny', status: 400, code: 'REASON_REQUIRED', error: 'Shkruani arsyen e refuzimit (5-500 shenja).' };
  }
  return { outcome: 'allow', to: move.to, reason };
}

/* ------------------------------------------------------------------ */
/* Track-ID lookup for every sector                                    */
/* ------------------------------------------------------------------ */

const DONATION_LABEL: Record<string, string> = { pending: 'Në pritje', submitted: 'Në pritje', approved: 'U aprovua', published: 'U aprovua', active: 'U aprovua', rejected: 'U refuzua' };
const HEALTH_LABEL: Record<string, string> = { pending: 'Në pritje', verified: 'U verifikua', resolved: 'U zgjidh', rejected: 'U refuzua' };

export interface SubmissionStatus { kind: 'news' | 'donation' | 'health'; reference: string; stage: string; rejected: boolean; updatedAt: string | null; createdAt: string | null }

const iso = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const v = value as { toDate?: () => Date };
  return typeof v.toDate === 'function' ? v.toDate().toISOString() : null;
};

/** Public: the stage label only. Never the text, the sender or the staff notes. */
export async function lookupSubmission(db: Firestore, refRaw: string): Promise<SubmissionStatus | null> {
  const ref = refRaw.trim().toUpperCase();
  if (!/^(LJ|DN|HC)-[A-Z0-9]{4,12}$/.test(ref)) return null;
  const prefix = ref.slice(0, 2);
  if (prefix === 'LJ') {
    const snap = await db.collection('newsTips').where('reference', '==', ref).limit(1).get();
    if (snap.empty) return null;
    const d = snap.docs[0].data();
    const stage = (TIP_STAGES as readonly string[]).includes(d.status) ? (d.status as TipStage) : 'submitted';
    return { kind: 'news', reference: ref, stage: TIP_STAGE_LABEL[stage], rejected: stage === 'rejected', updatedAt: iso(d.updatedAt) ?? iso(d.createdAt), createdAt: iso(d.createdAt) };
  }
  if (prefix === 'DN') {
    const snap = await db.collection('donationCauses').where('reference', '==', ref).limit(1).get();
    if (snap.empty) return null;
    const d = snap.docs[0].data();
    const status = String(d.status ?? 'pending');
    return { kind: 'donation', reference: ref, stage: DONATION_LABEL[status] ?? 'Në pritje', rejected: status === 'rejected', updatedAt: iso(d.updatedAt) ?? iso(d.createdAt), createdAt: iso(d.createdAt) };
  }
  const snap = await db.collection('healthRegistry').where('trackingId', '==', ref).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  const status = String(d.status ?? 'pending');
  return { kind: 'health', reference: ref, stage: HEALTH_LABEL[status] ?? 'Në pritje', rejected: status === 'rejected', updatedAt: iso(d.statusUpdatedAt) ?? iso(d.createdAt), createdAt: iso(d.createdAt) };
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

export interface NewsTipDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  actingUser: (req: Request) => { uid: string; email: string; role: string; municipality: string; permissions: string[] };
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
  optionalUid?: (req: Request) => Promise<string | null>;
  limiter?: RequestHandler;
}

export function registerNewsTipRoutes(app: Express, deps: NewsTipDeps): void {
  const limiter = deps.limiter ?? createIpRateLimiter({ windowMs: 60 * 60_000, max: 5, floodFactor: 2, banMs: 30 * 60_000, message: 'Keni dërguar shumë lajme. Provoni përsëri pas pak.', code: 'TIP_RATE_LIMIT' });
  const lookupLimiter = createIpRateLimiter({ windowMs: 60_000, max: 30, floodFactor: 2, banMs: 10 * 60_000, message: 'Shumë kërkesa. Provoni pas pak.', code: 'LOOKUP_RATE_LIMIT' });

  app.post('/api/v1/public/news-tips', limiter, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const parsed = validateTip(req.body);
    if (parsed.ok === false) return res.status(400).json({ error: 'Kontrolloni fushat e shënuara.', code: 'VALIDATION', fields: parsed.errors });
    try {
      const uid = deps.optionalUid ? await deps.optionalUid(req).catch(() => null) : null;
      const db = deps.db();
      const reference = await reserveReference(db, { prefix: 'LJ', kind: 'news', ownerUid: uid, randomBytes });
      const ref = db.collection('newsTips').doc();
      await ref.set({ ...parsed.value, reference, status: 'submitted', authorId: uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return res.status(201).json({ ok: true, reference });
    } catch (error) {
      console.error('[newsTips] store failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Lajmi nuk u ruajt. Provoni përsëri.', code: 'STORE_FAILED' });
    }
  });

  app.get('/api/v1/public/submission-status', lookupLimiter, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const found = await lookupSubmission(deps.db(), String(req.query.ref ?? ''));
      if (!found) return res.status(404).json({ error: 'Nuk u gjet asnjë dërgesë me këtë kod.' });
      return res.json(found);
    } catch (error) {
      console.error('[newsTips] lookup failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Kërkimi dështoi. Provoni përsëri.' });
    }
  });

  const staff = (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    if (!mayUseSection({ role: actor.role, permissions: actor.permissions }, 'news')) { res.status(403).json({ error: 'Vetëm redaksia sheh lajmet e qytetarëve.' }); return null; }
    return actor;
  };

  app.get('/api/v1/admin/news-tips', deps.requireAuth, async (req: Request, res: Response) => {
    if (!staff(req, res)) return;
    const stage = String(req.query.stage ?? 'submitted') as TipStage;
    if (!(TIP_STAGES as readonly string[]).includes(stage)) return res.status(400).json({ error: 'Faza nuk njihet.' });
    try {
      const db = deps.db();
      const counts: Record<string, number> = {};
      await Promise.all(TIP_STAGES.map(async s => { counts[s] = (await db.collection('newsTips').where('status', '==', s).count().get()).data().count; }));
      const snap = await db.collection('newsTips').where('status', '==', stage).orderBy('createdAt', stage === 'submitted' ? 'asc' : 'desc').limit(50).get();
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({
        counts,
        items: snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id, reference: data.reference, title: data.title, category: data.category, municipality: data.municipality ?? '', status: data.status,
            anonymous: data.anonymous === true, mediaCount: Array.isArray(data.media) ? data.media.length : 0, articleId: data.articleId ?? null,
            createdAt: iso(data.createdAt), actions: tipActionsFrom(data.status),
          };
        }),
      });
    } catch (error) {
      console.error('[newsTips] list failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Lista nuk u ngarkua.' });
    }
  });

  app.get('/api/v1/admin/news-tips/:id', deps.requireAuth, async (req: Request, res: Response) => {
    if (!staff(req, res)) return;
    try {
      const ref = deps.db().collection('newsTips').doc(String(req.params.id ?? ''));
      const [snap, events] = await Promise.all([ref.get(), ref.collection('events').orderBy('atMs', 'desc').limit(50).get()]);
      if (!snap.exists) return res.status(404).json({ error: 'Lajmi nuk u gjet.' });
      const d = snap.data()!;
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({
        id: snap.id, reference: d.reference, title: d.title, body: d.body, category: d.category, categoryLabel: TIP_CATEGORY_LABEL[d.category] ?? d.category,
        municipality: d.municipality ?? '', place: d.place ?? '', status: d.status, stageLabel: TIP_STAGE_LABEL[d.status as TipStage] ?? d.status,
        anonymous: d.anonymous === true, contactName: d.contactName ?? '', contactEmail: d.contactEmail ?? '', contactPhone: d.contactPhone ?? '',
        media: Array.isArray(d.media) ? d.media : [], articleId: d.articleId ?? null, rejectionReason: d.rejectionReason ?? '',
        createdAt: iso(d.createdAt), actions: tipActionsFrom(d.status),
        history: events.docs.map(e => e.data()),
      });
    } catch (error) {
      console.error('[newsTips] detail failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Lajmi nuk u ngarkua.' });
    }
  });

  app.post('/api/v1/admin/news-tips/:id/action', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const id = String(req.params.id ?? '');
    const db = deps.db();
    const ref = db.collection('newsTips').doc(id);
    try {
      let actorName = '';
      try { actorName = String((await db.collection('users').doc(actor.uid).get()).data()?.name ?? '').slice(0, 120); } catch { /* name is best effort */ }
      const result = await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) return { ok: false as const, status: 404, error: 'Lajmi nuk u gjet.' };
        const d = snap.data()!;
        const decision = decideTipAction({ actor, stage: (d.status as TipStage) ?? 'submitted', action: req.body?.action, reason: req.body?.reason });
        if (decision.outcome === 'deny') return { ok: false as const, status: decision.status, error: decision.error, code: decision.code };
        const action = req.body.action as TipAction;
        const nowMs = Date.now();
        const patch: Record<string, unknown> = { status: decision.to, updatedAt: FieldValue.serverTimestamp(), lastActionBy: actor.uid };
        let articleId: string | null = d.articleId ?? null;
        if (action === 'reject') patch.rejectionReason = decision.reason;
        if (action === 'accept') Object.assign(patch, { acceptedBy: actor.uid, acceptedByName: actorName, acceptedAtMs: nowMs });
        if (action === 'create_draft') {
          // A draft article for the newsroom to write properly. The citizen's wording is source
          // material in the staff-only tip, not copied into the public draft.
          articleId = d.articleId ?? `news-${nowMs}`;
          const now = new Date(nowMs).toISOString();
          tx.set(db.collection('newsArticles').doc(articleId!), {
            id: articleId, title: String(d.title ?? '').slice(0, 160), summary: '', content: '', category: 'Aktualitet',
            municipality: String(d.municipality ?? ''), author: 'Administrata e Zërit të Qytetarëve', readTime: '1 min', isDemo: false, isTicker: false,
            published: false, publishedAt: null, status: 'Draft', createdAt: now, updatedAt: now, sourceTipReference: d.reference, sourceTipId: id,
            date: new Date(nowMs).toLocaleDateString('sq-AL', { day: '2-digit', month: 'long', year: 'numeric' }),
          }, { merge: true });
          Object.assign(patch, { articleId, draftBy: actor.uid, draftAtMs: nowMs });
        }
        if (action === 'mark_published') {
          const article = articleId ? await tx.get(db.collection('newsArticles').doc(articleId)) : null;
          if (!article || !article.exists || article.get('published') !== true) {
            return { ok: false as const, status: 409, error: 'Artikulli nuk është publikuar ende. Publikojeni te Lajmet, pastaj shënojeni këtu.', code: 'ARTICLE_NOT_PUBLISHED' };
          }
          Object.assign(patch, { publishedAtMs: nowMs });
        }
        tx.update(ref, patch);
        tx.create(ref.collection('events').doc(), { action, from: d.status, to: decision.to, actorUid: actor.uid, actorName, text: decision.reason, atMs: nowMs });
        return { ok: true as const, to: decision.to, from: d.status as TipStage, articleId, action };
      });
      if (result.ok === false) {
        deps.audit('newsTip.denied', req, { id, code: (result as { code?: string }).code, reason: result.error });
        return res.status(result.status).json({ error: result.error, code: (result as { code?: string }).code });
      }
      deps.audit(`newsTip.${result.action}`, req, { id, from: result.from, to: result.to });
      return res.json({ ok: true, stage: result.to, label: TIP_STAGE_LABEL[result.to], articleId: result.articleId });
    } catch (error) {
      console.error('[newsTips] action failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Veprimi nuk u ruajt; asgjë nuk u ndryshua.' });
    }
  });
}

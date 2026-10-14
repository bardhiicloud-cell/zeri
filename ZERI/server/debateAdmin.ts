import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { applyReportToCase, readCaseFor } from './moderationCases';

/**
 * Administration of the public debate, for the `debatwp` role (section `debate`).
 *
 * Every write goes through the Admin SDK, so the Firestore rules stay as they are
 * (a post can only be changed by its author or an owner) and the Debate admin needs
 * no broader client permission. Each action is audited under the staff member.
 *
 *   posts      list / filter, bulk hide · unhide · delete · clear reports · end promotion
 *   promotion  promote a post as a sponsored debate (link + number of days)
 *   reports    citizens report a post; the admin reads the reasons and decides
 *   ad requests  requests made through "Kërko Reklamë" — contacted / approved / rejected / active
 *   ticks      accounts with the verification tick: extend or revoke
 *   stats      the numbers on the console's first screen
 */

export const MAX_BULK = 100;
export const BULK_ACTIONS = ['hide', 'unhide', 'delete', 'clear_reports', 'unpromote'] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];
export const AD_REQUEST_STATUSES = ['pending', 'contacted', 'approved', 'active', 'completed', 'rejected'] as const;
export const REPORT_REASONS = ['spam', 'abuse', 'misinformation', 'violence', 'illegal', 'other'] as const;
/** Reports from this many different accounts flag a post for review. Nothing is hidden automatically. */
export const REVIEW_THRESHOLD = 3;

export type PostFilter = 'all' | 'reported' | 'hidden' | 'promoted' | 'visible';

export interface PostRow {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  category: string | null;
  imageUrl: string | null;
  likes: number;
  comments: number;
  reposts: number;
  viewCount: number;
  reportCount: number;
  isHidden: boolean;
  isAd: boolean;
  promotedUntilMs: number | null;
  createdAtMs: number;
}

const clip = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);
const millis = (value: any): number => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const parsed = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function toPostRow(id: string, data: any): PostRow {
  return {
    id,
    authorId: String(data.authorId ?? ''),
    authorName: clip(data.authorName, 120),
    content: clip(data.content, 500),
    category: data.category ? clip(data.category, 60) : null,
    imageUrl: typeof data.imageUrl === 'string' && data.imageUrl ? data.imageUrl : null,
    likes: Array.isArray(data.likes) ? data.likes.length : 0,
    comments: Array.isArray(data.comments) ? data.comments.length : 0,
    reposts: Array.isArray(data.reposts) ? data.reposts.length : 0,
    viewCount: typeof data.viewCount === 'number' ? data.viewCount : 0,
    reportCount: typeof data.reportCount === 'number' ? data.reportCount : 0,
    isHidden: data.isHidden === true,
    isAd: data.isAd === true,
    promotedUntilMs: data.promotedUntil ? millis(data.promotedUntil) : null,
    createdAtMs: millis(data.createdAt),
  };
}

/** Is a promotion still running at `now`? A promotion with no end date runs until removed. */
export function isPromotionActive(row: Pick<PostRow, 'isAd' | 'promotedUntilMs'>, now: number = Date.now()): boolean {
  return row.isAd && (row.promotedUntilMs === null || row.promotedUntilMs > now);
}

export function filterPosts(rows: readonly PostRow[], filter: PostFilter, query: string, now: number = Date.now()): PostRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter === 'reported' && row.reportCount === 0) return false;
    if (filter === 'hidden' && !row.isHidden) return false;
    if (filter === 'visible' && row.isHidden) return false;
    if (filter === 'promoted' && !isPromotionActive(row, now)) return false;
    if (!needle) return true;
    return row.content.toLowerCase().includes(needle) || row.authorName.toLowerCase().includes(needle) || row.id.toLowerCase() === needle;
  });
}

export type BulkDecision =
  | { outcome: 'ok'; ids: string[]; action: BulkAction }
  | { outcome: 'invalid'; error: string };

/** Validate a bulk request. `delete` must be confirmed explicitly, so a stray click cannot erase posts. */
export function parseBulk(body: any): BulkDecision {
  const action = body?.action;
  if (!(BULK_ACTIONS as readonly string[]).includes(action)) return { outcome: 'invalid', error: 'Veprimi nuk njihet.' };
  const ids = Array.isArray(body?.ids) ? [...new Set<string>(body.ids.map((id: unknown) => String(id)))] : [];
  if (ids.length === 0) return { outcome: 'invalid', error: 'Zgjidhni të paktën një postim.' };
  if (ids.length > MAX_BULK) return { outcome: 'invalid', error: `Maksimumi ${MAX_BULK} postime në një veprim.` };
  if (ids.some((id) => !id || id.length > 128 || id.includes('/'))) return { outcome: 'invalid', error: 'Një nga postimet nuk është i vlefshëm.' };
  if (action === 'delete' && body?.confirm !== true) return { outcome: 'invalid', error: 'Fshirja kërkon konfirmim.' };
  return { outcome: 'ok', ids, action };
}

/**
 * What is kept when a post is removed from public view for good.
 *
 * Deleting a post used to erase the only copy of what was reported, so a later appeal or a
 * legal request had nothing to look at. The deleted post is copied here first, in the same
 * batch as the delete, to `moderationEvidence/{postId}` (server-only: Firestore's default
 * deny applies, so no client can read or change it). Pure, so the shape is tested.
 */
export function evidenceRecord(postId: string, data: Record<string, unknown>, staffUid: string | null, reason: string): Record<string, unknown> {
  return { postId, post: data, removedBy: staffUid, reason: clip(reason, 300), removedAt: FieldValue.serverTimestamp() };
}

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export interface DebateAdminDeps {
  requireAuth: RequestHandler;
  requireDebateSection: RequestHandler;
  db: () => Firestore;
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
}

export function registerDebateAdminRoutes(app: Express, deps: DebateAdminDeps): void {
  const guard = [deps.requireAuth, deps.requireDebateSection];

  /* ------------------------------------------------------------- posts */

  app.get('/api/v1/debate/posts', ...guard, async (req: Request, res: Response) => {
    const filter = (['all', 'reported', 'hidden', 'promoted', 'visible'].includes(String(req.query.filter)) ? req.query.filter : 'all') as PostFilter;
    const q = clip(req.query.q, 100);
    try {
      // A reported or hidden post older than the newest 400 must still be reachable, so those two
      // filters ask the database for exactly those posts instead of searching a recent window.
      const posts = deps.db().collection('forumPosts');
      const source = filter === 'reported' ? posts.where('reportCount', '>', 0).orderBy('reportCount', 'desc')
        : filter === 'hidden' ? posts.where('isHidden', '==', true).orderBy('createdAt', 'desc')
        : posts.orderBy('createdAt', 'desc');
      const [snapshot, reportedCount, hiddenCount] = await Promise.all([
        source.limit(400).get(),
        posts.where('reportCount', '>', 0).count().get(),
        posts.where('isHidden', '==', true).count().get(),
      ]);
      const rows = snapshot.docs.map((doc) => toPostRow(doc.id, doc.data()));
      const filtered = filterPosts(rows, filter, q);
      return res.json({
        posts: filtered.slice(0, 200),
        counts: {
          all: rows.length,
          reported: reportedCount.data().count,
          hidden: hiddenCount.data().count,
          promoted: rows.filter((r) => isPromotionActive(r)).length,
        },
      });
    } catch (error: any) {
      console.error('[DEBATE] posts failed:', error?.message);
      return res.status(500).json({ error: 'Postimet nuk u ngarkuan.' });
    }
  });

  app.post('/api/v1/debate/posts/bulk', ...guard, async (req: Request, res: Response) => {
    const decision = parseBulk(req.body);
    if (decision.outcome === 'invalid') return res.status(400).json({ error: decision.error });
    const { ids, action } = decision;
    const staff = req.user?.uid ?? null;

    try {
      const refs = ids.map((id) => deps.db().collection('forumPosts').doc(id));
      const snaps = await deps.db().getAll(...refs);
      const batch = deps.db().batch();
      const results: Array<{ id: string; result: 'done' | 'missing' }> = [];
      for (const snap of snaps) {
        if (!snap.exists) {
          results.push({ id: snap.id, result: 'missing' });
          continue;
        }
        if (action === 'hide') batch.update(snap.ref, { isHidden: true, hiddenBy: staff, hiddenAt: FieldValue.serverTimestamp() });
        else if (action === 'unhide') batch.update(snap.ref, { isHidden: false, hiddenBy: FieldValue.delete(), hiddenAt: FieldValue.delete() });
        else if (action === 'clear_reports') batch.update(snap.ref, { reportCount: 0, needsReview: false });
        else if (action === 'unpromote') batch.update(snap.ref, { isAd: false, adLink: null, promotedUntil: FieldValue.delete() });
        else if (action === 'delete') {
          batch.set(deps.db().collection('moderationEvidence').doc(snap.id), evidenceRecord(snap.id, snap.data() as Record<string, unknown>, staff, String(req.body?.reason ?? '')));
          batch.delete(snap.ref);
        }
        results.push({ id: snap.id, result: 'done' });
      }
      await batch.commit();
      deps.audit(`debate.posts.${action}`, req, { count: results.filter((r) => r.result === 'done').length, ids: ids.slice(0, 20), reason: clip(req.body?.reason, 300) || null });
      return res.json({ results });
    } catch (error: any) {
      console.error('[DEBATE] bulk failed:', error?.message);
      return res.status(500).json({ error: 'Veprimi nuk u krye.' });
    }
  });

  app.post('/api/v1/debate/posts/:id/promote', ...guard, async (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    const days = Number(req.body?.days);
    const link = req.body?.adLink;
    if (!id || id.includes('/')) return res.status(400).json({ error: 'Postimi nuk është i vlefshëm.' });
    if (!Number.isInteger(days) || days < 1 || days > 90) return res.status(400).json({ error: 'Kohëzgjatja duhet të jetë 1–90 ditë.' });
    if (link !== undefined && link !== '' && !isHttpsUrl(link)) return res.status(400).json({ error: 'Linku duhet të fillojë me https://.' });
    // Optional campaign controls: a click cap and a delayed start (see src/lib/adCampaign.ts).
    const maxClicks = req.body?.maxClicks === undefined || req.body.maxClicks === null || req.body.maxClicks === '' ? null : Number(req.body.maxClicks);
    if (maxClicks !== null && (!Number.isInteger(maxClicks) || maxClicks < 1 || maxClicks > 10_000_000)) return res.status(400).json({ error: 'Kufiri i klikimeve duhet të jetë një numër i plotë pozitiv.' });
    const startInDays = req.body?.startInDays === undefined || req.body.startInDays === null || req.body.startInDays === '' ? 0 : Number(req.body.startInDays);
    if (!Number.isInteger(startInDays) || startInDays < 0 || startInDays > 90) return res.status(400).json({ error: 'Fillimi duhet të jetë brenda 0–90 ditëve.' });

    try {
      const ref = deps.db().collection('forumPosts').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Postimi nuk u gjet.' });
      const startMs = Date.now() + startInDays * 86_400_000;
      await ref.update({
        isAd: true,
        adLink: link ? String(link) : null,
        adStartAt: startInDays > 0 ? Timestamp.fromMillis(startMs) : FieldValue.delete(),
        adMaxClicks: maxClicks ?? FieldValue.delete(),
        promotedUntil: Timestamp.fromMillis(startMs + days * 86_400_000),
        promotedBy: req.user?.uid ?? null,
      });
      deps.audit('debate.post.promote', req, { id, days });
      return res.json({ ok: true });
    } catch (error: any) {
      console.error('[DEBATE] promote failed:', error?.message);
      return res.status(500).json({ error: 'Promovimi nuk u ruajt.' });
    }
  });

  app.get('/api/v1/debate/posts/:id/reports', ...guard, async (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    if (!id || id.includes('/')) return res.status(400).json({ error: 'Postimi nuk është i vlefshëm.' });
    try {
      const snapshot = await deps.db().collection('forumPosts').doc(id).collection('reports').limit(100).get();
      return res.json({
        reports: snapshot.docs
          .map((doc) => ({ reason: String(doc.data().reason ?? 'other'), note: clip(doc.data().note, 300), atMs: millis(doc.data().at) }))
          .sort((a, b) => b.atMs - a.atMs),
      });
    } catch (error: any) {
      console.error('[DEBATE] reports failed:', error?.message);
      return res.status(500).json({ error: 'Raportimet nuk u ngarkuan.' });
    }
  });

  /** A citizen reports a post. One report per account per post. */
  app.post('/api/v1/forum/posts/:id/report', deps.requireAuth, async (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    const uid = req.user?.uid;
    if (!uid || !req.user?.email) return res.status(403).json({ error: 'Regjistrohuni për të raportuar një postim.' });
    if (!id || id.includes('/')) return res.status(400).json({ error: 'Postimi nuk është i vlefshëm.' });
    const reason = (REPORT_REASONS as readonly string[]).includes(req.body?.reason) ? String(req.body.reason) : 'other';

    try {
      const postRef = deps.db().collection('forumPosts').doc(id);
      const reportRef = postRef.collection('reports').doc(uid);
      const outcome = await deps.db().runTransaction(async (transaction) => {
        const [post, report, moderationCase] = await Promise.all([transaction.get(postRef), transaction.get(reportRef), readCaseFor(transaction, deps.db(), 'post', id)]);
        if (!post.exists) return 'missing' as const;
        if (report.exists) return 'duplicate' as const;
        const stored = post.data()?.reportCount;
        const count = (typeof stored === 'number' ? stored : 0) + 1;
        transaction.update(postRef, { reportCount: count, needsReview: count >= REVIEW_THRESHOLD });
        transaction.create(reportRef, { uid, reason, note: clip(req.body?.note, 300), at: FieldValue.serverTimestamp() });
        const p = post.data() ?? {};
        applyReportToCase(transaction, deps.db(), moderationCase, {
          kind: 'post', targetId: id, postId: id, subjectUid: String(p.authorId ?? ''), reason,
          snapshot: { excerpt: clip(p.content, 300), authorName: clip(p.authorName, 120), imageUrl: typeof p.imageUrl === 'string' ? p.imageUrl : null },
        }, Date.now());
        return 'reported' as const;
      });
      if (outcome === 'missing') return res.status(404).json({ error: 'Postimi nuk u gjet.' });
      if (outcome === 'duplicate') return res.status(409).json({ error: 'E keni raportuar tashmë këtë postim.' });
      return res.status(201).json({ ok: true });
    } catch (error: any) {
      console.error('[FORUM] report failed:', error?.message);
      return res.status(500).json({ error: 'Raportimi nuk u dërgua.' });
    }
  });

  /* -------------------------------------------------------- ad requests */

  app.get('/api/v1/debate/ad-requests', ...guard, async (_req, res: Response) => {
    try {
      const snapshot = await deps.db().collection('adRequests').limit(300).get();
      const items = snapshot.docs
        .map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            name: clip(d.name ?? d.businessName, 120),
            businessName: clip(d.businessName, 120),
            phone: clip(d.phone ?? d.contactPhone, 40),
            email: clip(d.userEmail ?? d.contactEmail, 120),
            packageName: clip(d.packageName, 60),
            packageId: clip(d.packageId, 40),
            notes: clip(d.notes ?? d.adNotes, 400),
            postId: clip(d.postId, 300),
            status: AD_REQUEST_STATUSES.includes(d.status) ? d.status : 'pending',
            paymentStatus: d.paymentStatus === 'paid' ? 'paid' : 'unpaid',
            paymentCode: clip(d.paymentCode, 20),
            createdAtMs: millis(d.createdAt),
          };
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      return res.json({ items });
    } catch (error: any) {
      console.error('[DEBATE] ad requests failed:', error?.message);
      return res.status(500).json({ error: 'Kërkesat nuk u ngarkuan.' });
    }
  });

  app.post('/api/v1/debate/ad-requests/:id/status', ...guard, async (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    const status = req.body?.status;
    if (!id || id.includes('/')) return res.status(400).json({ error: 'Kërkesa nuk është e vlefshme.' });
    if (!(AD_REQUEST_STATUSES as readonly string[]).includes(status)) return res.status(400).json({ error: 'Statusi nuk njihet.' });
    try {
      const ref = deps.db().collection('adRequests').doc(id);
      if (!(await ref.get()).exists) return res.status(404).json({ error: 'Kërkesa nuk u gjet.' });
      await ref.update({ status, debateNote: clip(req.body?.note, 300), handledBy: req.user?.uid ?? null, handledAt: FieldValue.serverTimestamp() });
      deps.audit('debate.adRequest.status', req, { id, status });
      return res.json({ ok: true });
    } catch (error: any) {
      console.error('[DEBATE] ad status failed:', error?.message);
      return res.status(500).json({ error: 'Statusi nuk u ruajt.' });
    }
  });

  /* ------------------------------------------------------------- ticks */

  app.get('/api/v1/debate/verified', ...guard, async (_req, res: Response) => {
    try {
      const snapshot = await deps.db().collection('users').where('isVerified', '==', true).limit(500).get();
      const items = snapshot.docs.map((doc) => ({
        uid: doc.id,
        name: clip(doc.data().name, 120),
        untilMs: doc.data().verifiedUntil ? millis(doc.data().verifiedUntil) : null,
      }));
      return res.json({ items });
    } catch (error: any) {
      console.error('[DEBATE] verified list failed:', error?.message);
      return res.status(500).json({ error: 'Lista nuk u ngarkua.' });
    }
  });

  app.post('/api/v1/debate/verified/:uid', ...guard, async (req: Request, res: Response) => {
    const uid = String(req.params.uid ?? '');
    const action = req.body?.action;
    if (!uid || uid.includes('/')) return res.status(400).json({ error: 'Llogaria nuk është e vlefshme.' });
    if (action !== 'revoke' && action !== 'extend') return res.status(400).json({ error: 'Veprimi nuk njihet.' });
    try {
      const ref = deps.db().collection('users').doc(uid);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Profili nuk u gjet.' });
      if (action === 'revoke') {
        await ref.update({ isVerified: false, verifiedUntil: FieldValue.delete() });
      } else {
        const current = millis(snap.data()?.verifiedUntil);
        await ref.update({ isVerified: true, verifiedUntil: Timestamp.fromMillis(Math.max(Date.now(), current) + 30 * 86_400_000), verifiedBy: req.user?.uid ?? null });
      }
      deps.audit(`debate.verified.${action}`, req, { uid });
      return res.json({ ok: true });
    } catch (error: any) {
      console.error('[DEBATE] verified action failed:', error?.message);
      return res.status(500).json({ error: 'Veprimi nuk u krye.' });
    }
  });

  /* ------------------------------------------------------------- stats */

  let statsCache: { at: number; value: unknown } | null = null;
  app.get('/api/v1/debate/stats', ...guard, async (_req, res: Response) => {
    try {
      if (statsCache && Date.now() - statsCache.at < 30_000) return res.json(statsCache.value);
      const db = deps.db();
      const monthAgo = Date.now() - 30 * 86_400_000;
      const [posts, reported, hidden, verified, awaiting, paid] = await Promise.all([
        db.collection('forumPosts').count().get(),
        db.collection('forumPosts').where('reportCount', '>', 0).count().get(),
        db.collection('forumPosts').where('isHidden', '==', true).count().get(),
        db.collection('users').where('isVerified', '==', true).count().get(),
        db.collection('paymentOrders').where('status', '==', 'awaiting').count().get(),
        db.collection('paymentOrders').where('status', '==', 'paid').where('paidAtMs', '>=', monthAgo).limit(500).get(),
      ]);
      const paidSum = paid.docs.reduce((sum, doc) => sum + (Number(doc.data().amountEur) || 0), 0);
      const value = {
        posts: posts.data().count,
        reported: reported.data().count,
        hidden: hidden.data().count,
        verifiedAccounts: verified.data().count,
        paymentsAwaiting: awaiting.data().count,
        paidLast30Days: { count: paid.size, sumEur: Math.round(paidSum * 100) / 100 },
      };
      statsCache = { at: Date.now(), value };
      return res.json(value);
    } catch (error: any) {
      console.error('[DEBATE] stats failed:', error?.message);
      return res.status(500).json({ error: 'Statistikat nuk u ngarkuan.' });
    }
  });
}

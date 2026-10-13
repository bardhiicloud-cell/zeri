/**
 * Scheduled posts. A citizen picks a time; the server keeps the post in `forumScheduled`
 * (readable and writable only through the server) and publishes it into `forumPosts` once it
 * is due, as if the author had posted it at that moment.
 *
 * The post is built here from the author's current profile, not from what the browser sent
 * when scheduling, so a name or role change in between is respected and the client cannot
 * schedule a post that carries forbidden fields (isAd, counters, comments).
 *
 * Publishing is idempotent: the scheduled document becomes `published` in the same transaction
 * that creates the post, so two overlapping runs cannot publish it twice.
 */
import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { extractHashtags } from '../src/lib/forumTrends';
import { POST_MAX, cleanText, isSafeId, notifyAfterPublish } from './forumPosts';
import { createRateLimiter } from './directMessages';

export const MIN_DELAY_MS = 5 * 60_000;
export const MAX_DELAY_MS = 30 * 86_400_000;
export const MAX_PENDING_PER_USER = 20;
export const MAX_IMAGES = 4;

export class ScheduleError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 403 | 404 | 409, public readonly code: string) {
    super(message);
    this.name = 'ScheduleError';
  }
}

export function cleanImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((u): u is string => typeof u === 'string' && /^https:\/\//.test(u) && u.length <= 1500 && !/[\s"'<>]/.test(u))
    .slice(0, MAX_IMAGES);
}

export interface ScheduleInput {
  uid: string;
  content: string;
  category?: string;
  neighborhood?: string;
  imageUrls?: unknown;
  followersOnly?: boolean;
  publishAtMs: number;
}

export async function schedulePost(fs: Firestore, input: ScheduleInput, now: number = Date.now()): Promise<{ id: string; publishAtMs: number }> {
  if (!isSafeId(input.uid)) throw new ScheduleError('Kërkesa nuk është e vlefshme.', 400, 'bad_request');
  const { text, error } = cleanText(input.content, POST_MAX);
  if (error) throw new ScheduleError(error, 400, 'bad_text');
  const delay = input.publishAtMs - now;
  if (!Number.isFinite(delay) || delay < MIN_DELAY_MS) throw new ScheduleError('Zgjidhni një kohë të paktën 5 minuta përpara.', 400, 'too_soon');
  if (delay > MAX_DELAY_MS) throw new ScheduleError('Mund të planifikoni deri në 30 ditë përpara.', 400, 'too_far');

  const user = (await fs.collection('users').doc(input.uid).get()).data();
  if (!user || user.role === 'guest') throw new ScheduleError('Kyçuni me llogari për të planifikuar.', 403, 'no_account');
  if (user.isBanned === true) throw new ScheduleError('Llogaria juaj është e kufizuar.', 403, 'banned');

  const pending = await fs.collection('forumScheduled').where('authorId', '==', input.uid).where('status', '==', 'pending').count().get();
  if (pending.data().count >= MAX_PENDING_PER_USER) throw new ScheduleError('Keni shumë postime të planifikuara. Fshini disa.', 409, 'limit');

  const ref = fs.collection('forumScheduled').doc();
  await ref.set({
    authorId: input.uid,
    content: text,
    category: String(input.category ?? 'all').slice(0, 60),
    neighborhood: String(input.neighborhood ?? '').slice(0, 80),
    imageUrls: cleanImageUrls(input.imageUrls),
    visibility: input.followersOnly ? 'followers' : 'public',
    status: 'pending',
    publishAt: Timestamp.fromMillis(input.publishAtMs),
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, publishAtMs: input.publishAtMs };
}

export async function cancelScheduled(fs: Firestore, uid: string, id: string): Promise<void> {
  if (!isSafeId(uid) || !isSafeId(id)) throw new ScheduleError('Kërkesa nuk është e vlefshme.', 400, 'bad_request');
  await fs.runTransaction(async (tx) => {
    const ref = fs.collection('forumScheduled').doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('authorId') !== uid) throw new ScheduleError('Postimi i planifikuar nuk u gjet.', 404, 'not_found');
    if (snap.get('status') !== 'pending') throw new ScheduleError('Ky postim është publikuar tashmë.', 409, 'not_pending');
    tx.delete(ref);
  });
}

export async function listScheduled(fs: Firestore, uid: string) {
  const snap = await fs.collection('forumScheduled').where('authorId', '==', uid).where('status', '==', 'pending').orderBy('publishAt', 'asc').limit(50).get();
  return snap.docs.map((d) => ({
    id: d.id,
    content: String(d.get('content') ?? ''),
    imageUrls: (d.get('imageUrls') as string[] | undefined) ?? [],
    visibility: d.get('visibility') as string,
    publishAtMs: (d.get('publishAt') as Timestamp).toMillis(),
  }));
}

/** Publishes every due post. Returns the ids created. Safe to run often and concurrently. */
export async function publishDueScheduled(fs: Firestore, now: number = Date.now(), batchSize = 50): Promise<string[]> {
  const due = await fs.collection('forumScheduled').where('status', '==', 'pending').where('publishAt', '<=', Timestamp.fromMillis(now)).limit(batchSize).get();
  const published: string[] = [];
  for (const doc of due.docs) {
    try {
      const created = await fs.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        if (!fresh.exists || fresh.get('status') !== 'pending') return null;
        const data = fresh.data()!;
        const user = (await tx.get(fs.collection('users').doc(data.authorId))).data();
        if (!user || user.isBanned === true || user.role === 'guest') {
          tx.update(doc.ref, { status: 'failed', failedReason: 'account_unavailable' });
          return null;
        }
        const postRef = fs.collection('forumPosts').doc();
        const images: string[] = data.imageUrls ?? [];
        tx.create(postRef, {
          isHidden: false,
          authorId: data.authorId,
          authorName: user.name || 'Qytetar',
          authorAvatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'Q')}&background=0D8ABC&color=fff`,
          authorRole: user.role || 'citizen',
          authorBadge: (user.points ?? 0) > 100 ? 'Përfaqësues Lagjeje' : 'Qytetar i Verifikuar',
          content: data.content,
          hashtags: extractHashtags(data.content).slice(0, 10),
          category: data.category,
          neighborhood: data.neighborhood,
          imageUrl: images[0] ?? '',
          imageUrls: images,
          visibility: data.visibility,
          isAd: false,
          likes: [],
          comments: [],
          reactions: {},
          createdAt: FieldValue.serverTimestamp(),
          scheduledFor: data.publishAt,
        });
        tx.update(doc.ref, { status: 'published', postId: postRef.id, publishedAt: FieldValue.serverTimestamp() });
        return { postId: postRef.id, uid: data.authorId as string };
      });
      if (created) {
        published.push(created.postId);
        void notifyAfterPublish(fs, { postId: created.postId, uid: created.uid }).catch((e) => console.warn('[SCHEDULE] notify failed:', e?.message));
      }
    } catch (error) {
      console.error('[SCHEDULE] publish failed for', doc.id, (error as Error)?.message);
    }
  }
  return published;
}

export interface ScheduledDeps { requireAuth: RequestHandler; db: () => Firestore }

export function registerScheduledPostRoutes(app: Express, deps: ScheduledDeps): void {
  const allow = createRateLimiter(20, 60_000);
  const fail = (res: Response, error: unknown) => {
    if (error instanceof ScheduleError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
    console.error('[SCHEDULE] failed:', (error as Error)?.message);
    return res.status(500).json({ error: 'Veprimi dështoi. Provoni përsëri.' });
  };

  app.post('/api/v1/forum/scheduled', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!allow(uid)) return res.status(429).json({ error: 'Shumë veprime. Prisni pak.', code: 'rate_limited' });
    try {
      return res.json(await schedulePost(deps.db(), {
        uid, content: req.body?.content, category: req.body?.category, neighborhood: req.body?.neighborhood,
        imageUrls: req.body?.imageUrls, followersOnly: req.body?.followersOnly === true, publishAtMs: Number(req.body?.publishAtMs),
      }));
    } catch (e) { return fail(res, e); }
  });

  app.get('/api/v1/forum/scheduled', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try { return res.json({ items: await listScheduled(deps.db(), uid) }); } catch (e) { return fail(res, e); }
  });

  app.delete('/api/v1/forum/scheduled/:id', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try { await cancelScheduled(deps.db(), uid, req.params.id); return res.json({ ok: true }); } catch (e) { return fail(res, e); }
  });
}

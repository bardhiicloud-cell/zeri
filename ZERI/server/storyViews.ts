/**
 * Who saw a story, and replies to it.
 *
 * Views are recorded by the server (one document per viewer, so a second look changes nothing)
 * and only the story's author can list them; the browser never reads or writes this data.
 * A reply is an ordinary direct message to the author, so it follows the same rules as any DM:
 * blocks, the author's message privacy and the request flow for strangers all apply.
 *
 * Viewer documents carry `expireAt` (the story's expiry + 7 days) so a Firestore TTL policy on
 * the `viewers` collection group can remove them; see the deploy notes.
 */
import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { DmError, blockId, createRateLimiter, isSafeId, sendDirectMessage } from './directMessages';

export const VIEWER_LIST_LIMIT = 300;
export const VIEWER_RETENTION_MS = 7 * 86_400_000;
export const STORY_REPLY_MAX = 500;

export class StoryError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 403 | 404 | 410, public readonly code: string) {
    super(message);
    this.name = 'StoryError';
  }
}

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

interface LiveStory { authorId: string; expiresAtMs: number }

async function loadLiveStory(fs: Firestore, storyId: string, now: number): Promise<LiveStory> {
  if (!isSafeId(storyId)) throw new StoryError('Story nuk është e vlefshme.', 400, 'bad_story');
  const snap = await fs.collection('forumStories').doc(storyId).get();
  const data = snap.data();
  if (!snap.exists || !data || data.isHidden === true) throw new StoryError('Story nuk u gjet.', 404, 'not_found');
  const expiresAtMs = typeof data.expiresAt?.toMillis === 'function' ? data.expiresAt.toMillis() : 0;
  if (expiresAtMs <= now) throw new StoryError('Story ka skaduar.', 410, 'expired');
  return { authorId: String(data.authorId ?? ''), expiresAtMs };
}

/** Records that `uid` saw the story. Idempotent; the author's own views and blocked pairs are ignored. */
export async function recordStoryView(fs: Firestore, input: { storyId: string; uid: string }, now: number = Date.now()): Promise<{ recorded: boolean }> {
  if (!isSafeId(input.uid)) throw new StoryError('Kërkesa nuk është e vlefshme.', 400, 'bad_request');
  const story = await loadLiveStory(fs, input.storyId, now);
  if (story.authorId === input.uid) return { recorded: false };

  const viewerRef = fs.collection('forumStories').doc(input.storyId).collection('viewers').doc(input.uid);
  return fs.runTransaction(async (tx) => {
    const [viewer, user, b1, b2] = await Promise.all([
      tx.get(viewerRef),
      tx.get(fs.collection('users').doc(input.uid)),
      tx.get(fs.collection('forum_blocks').doc(blockId(input.uid, story.authorId))),
      tx.get(fs.collection('forum_blocks').doc(blockId(story.authorId, input.uid))),
    ]);
    if (viewer.exists || b1.exists || b2.exists) return { recorded: false };
    if (!user.exists || user.data()?.role === 'guest' || user.data()?.isBanned === true) return { recorded: false };
    tx.create(viewerRef, { uid: input.uid, at: FieldValue.serverTimestamp(), expireAt: Timestamp.fromMillis(story.expiresAtMs + VIEWER_RETENTION_MS) });
    return { recorded: true };
  });
}

export interface StoryViewer { id: string; name: string; avatar: string; atMs: number }

/** The author's list of viewers, newest first. Names come from current profiles. */
export async function listStoryViewers(fs: Firestore, input: { storyId: string; uid: string }): Promise<{ count: number; viewers: StoryViewer[] }> {
  if (!isSafeId(input.storyId) || !isSafeId(input.uid)) throw new StoryError('Kërkesa nuk është e vlefshme.', 400, 'bad_request');
  const storyRef = fs.collection('forumStories').doc(input.storyId);
  const story = await storyRef.get();
  if (!story.exists) throw new StoryError('Story nuk u gjet.', 404, 'not_found');
  if (story.get('authorId') !== input.uid) throw new StoryError('Vetëm autori i sheh shikuesit.', 403, 'forbidden');

  const [countSnap, snap] = await Promise.all([
    storyRef.collection('viewers').count().get(),
    storyRef.collection('viewers').orderBy('at', 'desc').limit(VIEWER_LIST_LIMIT).get(),
  ]);
  const users = await Promise.all(snap.docs.map((d) => fs.collection('users').doc(d.id).get()));
  const viewers: StoryViewer[] = [];
  snap.docs.forEach((d, i) => {
    const u = users[i].data();
    if (!u || u.isBanned === true) return; // erased or banned accounts disappear from the list
    viewers.push({
      id: d.id,
      name: clip(u.name, 120) || 'Qytetar',
      avatar: typeof u.avatar === 'string' && u.avatar.startsWith('https://') ? u.avatar : '',
      atMs: typeof d.get('at')?.toMillis === 'function' ? d.get('at').toMillis() : 0,
    });
  });
  return { count: countSnap.data().count, viewers };
}

/** A reply to a story is a direct message to its author that quotes the story. */
export async function replyToStory(fs: Firestore, input: { storyId: string; uid: string; text: string }, now: number = Date.now()) {
  const text = clip(input.text, STORY_REPLY_MAX + 1);
  if (!text) throw new StoryError('Shkruani një përgjigje.', 400, 'empty');
  if (text.length > STORY_REPLY_MAX) throw new StoryError(`Përgjigjja kalon ${STORY_REPLY_MAX} shenja.`, 400, 'too_long');
  const story = await loadLiveStory(fs, input.storyId, now);
  if (story.authorId === input.uid) throw new StoryError('Nuk mund t’i përgjigjeni story-t tuaj.', 400, 'self');
  return sendDirectMessage(fs, { senderId: input.uid, receiverId: story.authorId, text: `↩ Përgjigje te story juaj: ${text}` });
}

export interface StoryViewDeps { requireAuth: RequestHandler; db: () => Firestore }

export function registerStoryRoutes(app: Express, deps: StoryViewDeps): void {
  const allowView = createRateLimiter(120, 60_000);
  const allowReply = createRateLimiter(20, 60_000);
  const fail = (res: Response, error: unknown) => {
    if (error instanceof StoryError || error instanceof DmError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
    console.error('[STORY] failed:', (error as Error)?.message);
    return res.status(500).json({ error: 'Veprimi dështoi. Provoni përsëri.' });
  };

  app.post('/api/v1/forum/stories/:id/view', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!allowView(uid)) return res.status(429).json({ error: 'Shumë veprime.', code: 'rate_limited' });
    try { return res.json(await recordStoryView(deps.db(), { storyId: req.params.id, uid })); } catch (e) { return fail(res, e); }
  });

  app.get('/api/v1/forum/stories/:id/viewers', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try { return res.json(await listStoryViewers(deps.db(), { storyId: req.params.id, uid })); } catch (e) { return fail(res, e); }
  });

  app.post('/api/v1/forum/stories/:id/reply', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!allowReply(uid)) return res.status(429).json({ error: 'Po dërgoni shumë përgjigje. Prisni pak.', code: 'rate_limited' });
    try { return res.status(201).json(await replyToStory(deps.db(), { storyId: req.params.id, uid, text: String(req.body?.text ?? '') })); } catch (e) { return fail(res, e); }
  });
}

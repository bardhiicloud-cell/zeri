/**
 * Server side of everything that changes a public-debate post after it exists:
 * comments and replies, reactions, poll votes, editing, soft delete / restore,
 * and the notifications those actions produce.
 *
 * Before this the browser rewrote whole `comments` / `reactions` / `poll` arrays
 * in the post document and wrote the recipients' notifications itself. That
 * lost data when two people acted at once, let any signed-in user write a
 * comment in another person's name or change a poll result, and let anyone push
 * a notification to anyone. Now each action is one transaction here, identity
 * comes from the verified token, and notifications are created by the server.
 *
 * The Firestore instance is a parameter so the logic runs against the emulator
 * in tests without the server's global Firebase initialisation.
 */
import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { extractHashtags, extractMentions, toHandle } from '../src/lib/forumTrends';
import { createRateLimiter } from './directMessages';
import { audienceAllows, normalizeForumPrefs, wantsNotification } from '../src/lib/forumPrefs';

export const COMMENT_MAX = 1000;
export const POST_MAX = 5000;
export const MAX_COMMENTS_PER_POST = 300;
export const MAX_REPLIES_PER_COMMENT = 100;
export const MAX_MENTION_NOTIFICATIONS = 5;
export const RESTORE_WINDOW_DAYS = 30;
export const MAX_EDIT_HISTORY = 20;
export const REACTION_TYPES = ['love', 'laugh', 'wow', 'sad', 'angry', 'support'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export class PostError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 403 | 404 | 409 | 410 | 429, public readonly code: string) {
    super(message);
    this.name = 'PostError';
  }
}

const STAFF_CLAIMS = ['admin', 'superadmin', 'agent', 'approver', 'newsadmin', 'adsadmin'];
/** Mirrors isStaff() in firestore.rules. */
export const isStaffClaims = (claims: Record<string, unknown> | undefined): boolean =>
  !!claims && STAFF_CLAIMS.some((c) => claims[c] === true);

export const isSafeId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128 && !v.includes('/');
const clip = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const blockId = (blocker: string, blocked: string) => `${blocker}_${blocked}`;

/* ───────────── Pure helpers (unit-tested) ───────────── */

export function cleanText(raw: unknown, max: number): { text: string; error: string | null } {
  const text = String(raw ?? '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) return { text, error: 'Shkruani një tekst.' };
  if (text.length > max) return { text, error: `Teksti kalon ${max} shenja.` };
  return { text, error: null };
}

export interface PollOption { id: string; text: string; votes: string[] }
export interface Poll { question: string; options: PollOption[]; totalVotes: number }

/**
 * One active vote per account: choosing another option moves it, choosing the
 * same one again withdraws it. Returns the new poll and what the voter now has.
 */
export function applyPollVote(poll: Poll, uid: string, optionId: string): { poll: Poll; votedOptionId: string | null } {
  if (!poll.options.some((o) => o.id === optionId)) throw new PostError('Opsioni i zgjedhur nuk ekziston.', 400, 'bad_option');
  let votedOptionId: string | null = null;
  const options = poll.options.map((o) => {
    const had = o.votes.includes(uid);
    const cleaned = o.votes.filter((id) => id !== uid);
    if (o.id === optionId && !had) { votedOptionId = o.id; return { ...o, votes: [...cleaned, uid] }; }
    return { ...o, votes: cleaned };
  });
  return { poll: { ...poll, options, totalVotes: options.reduce((n, o) => n + o.votes.length, 0) }, votedOptionId };
}

/** One reaction per account; the same type again removes it; null clears. */
export function applyReaction(reactions: Record<string, string[]>, uid: string, type: ReactionType | null): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(reactions)) next[k] = (Array.isArray(v) ? v : []).filter((id) => id !== uid);
  const had = (reactions[type ?? ''] ?? []).includes(uid);
  if (type && !had) next[type] = [...(next[type] ?? []), uid];
  for (const k of Object.keys(next)) if (next[k].length === 0) delete next[k];
  return next;
}

export interface Comment {
  id: string; authorId: string; authorName: string; authorAvatar?: string; content: string; createdAt: string;
  replies?: Comment[]; likes?: string[];
}

/** Removes a comment or reply by id. Returns the new list and the removed item (to check permission first). */
export function findComment(comments: Comment[], id: string): { item: Comment; parentId: string | null } | null {
  for (const c of comments) {
    if (c.id === id) return { item: c, parentId: null };
    for (const r of c.replies ?? []) if (r.id === id) return { item: r, parentId: c.id };
  }
  return null;
}

export function removeComment(comments: Comment[], id: string): Comment[] {
  return comments
    .filter((c) => c.id !== id)
    .map((c) => (c.replies?.some((r) => r.id === id) ? { ...c, replies: (c.replies ?? []).filter((r) => r.id !== id) } : c));
}

/** Days between two instants; used for the restore window. */
export const daysBetween = (fromMs: number, toMs: number) => (toMs - fromMs) / 86_400_000;

/* ───────────── Notifications (server-created) ───────────── */

interface NoteInput {
  userId: string; actorId: string; actorName: string; title: string; message: string;
  category: string; priority?: 'low' | 'normal'; postId?: string; commentId?: string;
}

function noteDoc(n: NoteInput) {
  return {
    title: n.title.slice(0, 300),
    message: n.message.slice(0, 200),
    channel: 'forum',
    category: n.category,
    type: 'info',
    priority: n.priority ?? 'normal',
    audience: 'user',
    userId: n.userId,
    ...(n.postId ? { postId: n.postId } : {}),
    ...(n.commentId ? { commentId: n.commentId } : {}),
    actorId: n.actorId,
    actorName: n.actorName,
    state: 'published',
    link: '/forum',
    sender: n.actorName,
    createdAt: FieldValue.serverTimestamp(),
  };
}

/** A deterministic id makes the notification happen once per (kind, post, actor), however often the action toggles. */
async function notifyOnce(fs: Firestore, id: string, n: NoteInput): Promise<void> {
  try {
    // A person who switched this kind of notification off in their settings does not get it.
    const recipient = await fs.collection('users').doc(n.userId).get();
    if (!wantsNotification(recipient.data(), n.category)) return;
    await fs.collection('notifications').doc(id).create(noteDoc(n));
  } catch (error: any) {
    if (error?.code === 6 || /ALREADY_EXISTS/i.test(String(error?.message))) return;
    console.warn('[FORUM] notification failed:', error?.message);
  }
}

/* ───────────── Transactions ───────────── */

async function loadPost(tx: Transaction, fs: Firestore, postId: string) {
  const ref = fs.collection('forumPosts').doc(postId);
  const snap = await tx.get(ref);
  if (!snap.exists) throw new PostError('Postimi nuk u gjet.', 404, 'not_found');
  const data = snap.data() as Record<string, any>;
  if (data.deletedAt) throw new PostError('Postimi nuk u gjet.', 404, 'not_found');
  return { ref, data };
}

async function loadActor(tx: Transaction, fs: Firestore, uid: string) {
  const snap = await tx.get(fs.collection('users').doc(uid));
  const d = snap.data() as Record<string, any> | undefined;
  if (!snap.exists || d?.role === 'guest') throw new PostError('Kyçuni me llogari për të vazhduar.', 403, 'no_account');
  if (d?.isBanned === true) throw new PostError('Llogaria juaj është e kufizuar.', 403, 'banned');
  return d as Record<string, any>;
}

async function assertNotBlocked(tx: Transaction, fs: Firestore, a: string, b: string) {
  if (!a || !b || a === b) return;
  const [x, y] = await Promise.all([
    tx.get(fs.collection('forum_blocks').doc(blockId(a, b))),
    tx.get(fs.collection('forum_blocks').doc(blockId(b, a))),
  ]);
  if (x.exists || y.exists) throw new PostError('Nuk mund të ndërveproni me këtë postim.', 403, 'denied');
}

export interface AddCommentInput { postId: string; uid: string; text: string; parentId?: string; mentionUids?: string[] }

export async function addComment(fs: Firestore, input: AddCommentInput): Promise<{ comment: Comment; parentId: string | null }> {
  if (!isSafeId(input.postId) || !isSafeId(input.uid)) throw new PostError('Kërkesa nuk është e vlefshme.', 400, 'bad_request');
  const { text, error } = cleanText(input.text, COMMENT_MAX);
  if (error) throw new PostError(error, 400, 'bad_text');
  const mentionUids = [...new Set((input.mentionUids ?? []).filter(isSafeId))].slice(0, MAX_MENTION_NOTIFICATIONS);

  const result = await fs.runTransaction(async (tx) => {
    const { ref, data } = await loadPost(tx, fs, input.postId);
    if (data.isHidden === true) throw new PostError('Postimi nuk u gjet.', 404, 'not_found');
    const actor = await loadActor(tx, fs, input.uid);
    await assertNotBlocked(tx, fs, input.uid, String(data.authorId ?? ''));
    if (data.visibility === 'followers' && data.authorId !== input.uid) {
      const following = Array.isArray(actor.followingIds) ? actor.followingIds : [];
      if (!following.includes(data.authorId)) throw new PostError('Ky postim është vetëm për ndjekësit.', 403, 'followers_only');
    }
    const mentionDocs = await Promise.all(mentionUids.map((id) => tx.get(fs.collection('users').doc(id))));
    // The post's author may limit who comments (everyone / people who follow them / nobody).
    const postAuthorId = String(data.authorId ?? '');
    const actorFollowing: string[] = Array.isArray(actor.followingIds) ? actor.followingIds : [];
    const postAuthorDoc = postAuthorId && postAuthorId !== input.uid ? await tx.get(fs.collection('users').doc(postAuthorId)) : null;
    if (postAuthorDoc && !audienceAllows(normalizeForumPrefs(postAuthorDoc.data()?.forumPrefs).whoCanComment, actorFollowing.includes(postAuthorId))) {
      throw new PostError('Autori e ka kufizuar kush mund të komentojë këtë postim.', 403, 'comments_restricted');
    }

    const comments: Comment[] = Array.isArray(data.comments) ? data.comments : [];
    const authorName = clip(actor.name, 120) || 'Qytetar';
    const item: Comment = {
      id: fs.collection('_').doc().id,
      authorId: input.uid,
      authorName,
      authorAvatar: clip(actor.avatar, 1000) || undefined,
      content: text,
      createdAt: new Date().toISOString(),
    } as Comment;
    if (!item.authorAvatar) delete item.authorAvatar;

    let next: Comment[];
    let notifyUser = '';
    let parentId: string | null = null;
    if (input.parentId) {
      const parent = comments.find((c) => c.id === input.parentId);
      if (!parent) throw new PostError('Komenti nuk u gjet.', 404, 'comment_not_found');
      if ((parent.replies?.length ?? 0) >= MAX_REPLIES_PER_COMMENT) throw new PostError('Ky koment ka arritur kufirin e përgjigjeve.', 409, 'replies_full');
      next = comments.map((c) => (c.id === parent.id ? { ...c, replies: [...(c.replies ?? []), item] } : c));
      notifyUser = parent.authorId;
      parentId = parent.id;
    } else {
      if (comments.length >= MAX_COMMENTS_PER_POST) throw new PostError('Ky postim ka arritur kufirin e komenteve.', 409, 'comments_full');
      next = [...comments, { ...item, replies: [] }];
      notifyUser = String(data.authorId ?? '');
    }
    const notifyDoc = !notifyUser ? null : notifyUser === postAuthorId ? postAuthorDoc : await tx.get(fs.collection('users').doc(notifyUser));
    // The ids of everyone who commented live in a queryable array, so that erasing an account can
    // find and anonymise their comments (they are array elements inside the post and cannot be queried).
    tx.update(ref, { comments: next, commentAuthorIds: FieldValue.arrayUnion(input.uid) });

    const notified = new Set<string>([input.uid]);
    if (notifyUser && !notified.has(notifyUser) && (!notifyDoc || wantsNotification(notifyDoc.data(), 'forum_reply', parentId ? 'reply' : 'comment'))) {
      notified.add(notifyUser);
      tx.create(fs.collection('notifications').doc(), noteDoc({
        userId: notifyUser, actorId: input.uid, actorName: authorName, category: 'forum_reply', postId: input.postId,
        ...(parentId ? { commentId: parentId } : {}),
        title: parentId ? `${authorName} u përgjigj komentit tuaj` : `${authorName} komentoi diskutimin tuaj`,
        message: text,
      }));
    }
    // Mentions are hints from the browser, checked here: the person must really be named in the text.
    const handles = new Set(extractMentions(text));
    mentionDocs.forEach((snap, i) => {
      const id = mentionUids[i];
      if (!snap.exists || notified.has(id) || !handles.has(toHandle(String(snap.data()?.name ?? '')))) return;
      notified.add(id);
      const mentionPrefs = normalizeForumPrefs(snap.data()?.forumPrefs);
      if (!mentionPrefs.notify.mentions || !audienceAllows(mentionPrefs.whoCanMention, actorFollowing.includes(id))) return;
      tx.create(fs.collection('notifications').doc(), noteDoc({
        userId: id, actorId: input.uid, actorName: authorName, category: 'forum_mention', postId: input.postId,
        title: `${authorName} të përmendi`, message: text,
      }));
    });
    return { comment: item, parentId };
  });
  return result;
}

export async function deleteComment(
  fs: Firestore, input: { postId: string; commentId: string; uid: string; staff: boolean },
): Promise<void> {
  if (!isSafeId(input.postId) || !isSafeId(input.commentId) || !isSafeId(input.uid)) throw new PostError('Kërkesa nuk është e vlefshme.', 400, 'bad_request');
  await fs.runTransaction(async (tx) => {
    const { ref, data } = await loadPost(tx, fs, input.postId);
    const comments: Comment[] = Array.isArray(data.comments) ? data.comments : [];
    const found = findComment(comments, input.commentId);
    if (!found) throw new PostError('Komenti nuk u gjet.', 404, 'comment_not_found');
    // The commenter, the post's author (it is their discussion) or staff may remove it.
    if (found.item.authorId !== input.uid && data.authorId !== input.uid && !input.staff) {
      throw new PostError('Nuk keni leje ta fshini këtë koment.', 403, 'forbidden');
    }
    tx.update(ref, { comments: removeComment(comments, input.commentId) });
  });
}

export async function setReaction(
  fs: Firestore, input: { postId: string; uid: string; type: unknown },
): Promise<Record<string, string[]>> {
  if (!isSafeId(input.postId) || !isSafeId(input.uid)) throw new PostError('Kërkesa nuk është e vlefshme.', 400, 'bad_request');
  const type = input.type === null || input.type === undefined ? null : String(input.type);
  if (type !== null && !(REACTION_TYPES as readonly string[]).includes(type)) throw new PostError('Reagimi nuk njihet.', 400, 'bad_reaction');
  return fs.runTransaction(async (tx) => {
    const { ref, data } = await loadPost(tx, fs, input.postId);
    if (data.isHidden === true) throw new PostError('Postimi nuk u gjet.', 404, 'not_found');
    await loadActor(tx, fs, input.uid);
    const next = applyReaction((data.reactions ?? {}) as Record<string, string[]>, input.uid, type as ReactionType | null);
    tx.update(ref, { reactions: next });
    return next;
  });
}

export async function votePostPoll(
  fs: Firestore, input: { postId: string; uid: string; optionId: string },
): Promise<{ poll: Poll; votedOptionId: string | null }> {
  if (!isSafeId(input.postId) || !isSafeId(input.uid) || !isSafeId(input.optionId)) throw new PostError('Kërkesa nuk është e vlefshme.', 400, 'bad_request');
  return fs.runTransaction(async (tx) => {
    const { ref, data } = await loadPost(tx, fs, input.postId);
    if (data.isHidden === true) throw new PostError('Postimi nuk u gjet.', 404, 'not_found');
    await loadActor(tx, fs, input.uid);
    const poll = data.poll as Poll | undefined;
    if (!poll || !Array.isArray(poll.options)) throw new PostError('Ky postim nuk ka sondazh.', 404, 'no_poll');
    const normalised: Poll = {
      ...poll,
      options: poll.options.map((o) => ({ ...o, votes: Array.isArray(o.votes) ? o.votes.map(String) : [] })),
    };
    const result = applyPollVote(normalised, input.uid, input.optionId);
    tx.update(ref, { poll: result.poll });
    return result;
  });
}

export async function editPost(fs: Firestore, input: { postId: string; uid: string; content: string }): Promise<{ content: string }> {
  if (!isSafeId(input.postId) || !isSafeId(input.uid)) throw new PostError('Kërkesa nuk është e vlefshme.', 400, 'bad_request');
  const { text, error } = cleanText(input.content, POST_MAX);
  if (error) throw new PostError(error, 400, 'bad_text');
  await fs.runTransaction(async (tx) => {
    const { ref, data } = await loadPost(tx, fs, input.postId);
    if (data.authorId !== input.uid) throw new PostError('Vetëm autori mund ta redaktojë postimin.', 403, 'forbidden');
    if (data.isHidden === true) throw new PostError('Postimi është fshehur nga moderatorët.', 403, 'hidden');
    await loadActor(tx, fs, input.uid);
    if (text === data.content) return;
    const editsRef = ref.collection('edits');
    const previous = await tx.get(editsRef.orderBy('at', 'desc').limit(MAX_EDIT_HISTORY));
    // Moderators can read the history; it is trimmed so it cannot grow without bound.
    tx.create(editsRef.doc(), { content: String(data.content ?? ''), at: FieldValue.serverTimestamp(), by: input.uid });
    previous.docs.slice(MAX_EDIT_HISTORY - 1).forEach((d) => tx.delete(d.ref));
    tx.update(ref, { content: text, hashtags: extractHashtags(text).slice(0, 10), editedAt: FieldValue.serverTimestamp() });
  });
  return { content: text };
}

export async function softDeletePost(fs: Firestore, uid: string, postId: string): Promise<void> {
  if (!isSafeId(postId) || !isSafeId(uid)) throw new PostError('Kërkesa nuk është e vlefshme.', 400, 'bad_request');
  await fs.runTransaction(async (tx) => {
    const { ref, data } = await loadPost(tx, fs, postId);
    if (data.authorId !== uid) throw new PostError('Vetëm autori mund ta fshijë postimin.', 403, 'forbidden');
    tx.update(ref, { deletedAt: FieldValue.serverTimestamp(), deletedBy: uid });
  });
}

export async function restorePost(fs: Firestore, uid: string, postId: string, now: number = Date.now()): Promise<void> {
  if (!isSafeId(postId) || !isSafeId(uid)) throw new PostError('Kërkesa nuk është e vlefshme.', 400, 'bad_request');
  await fs.runTransaction(async (tx) => {
    const ref = fs.collection('forumPosts').doc(postId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new PostError('Postimi nuk u gjet.', 404, 'not_found');
    const data = snap.data() as Record<string, any>;
    if (data.authorId !== uid) throw new PostError('Vetëm autori mund ta rikthejë postimin.', 403, 'forbidden');
    if (!data.deletedAt) throw new PostError('Ky postim nuk është i fshirë.', 409, 'not_deleted');
    const deletedMs = typeof data.deletedAt.toMillis === 'function' ? data.deletedAt.toMillis() : 0;
    if (daysBetween(deletedMs, now) > RESTORE_WINDOW_DAYS) throw new PostError(`Postimi mund të rikthehej vetëm brenda ${RESTORE_WINDOW_DAYS} ditëve.`, 410, 'restore_expired');
    tx.update(ref, { deletedAt: FieldValue.delete(), deletedBy: FieldValue.delete() });
  });
}

/** The author erases their own post for good (and its comments' history, edits and view marks). */
export async function purgePost(fs: Firestore, uid: string, postId: string): Promise<void> {
  if (!isSafeId(postId) || !isSafeId(uid)) throw new PostError('Kërkesa nuk është e vlefshme.', 400, 'bad_request');
  const ref = fs.collection('forumPosts').doc(postId);
  const snap = await ref.get();
  if (!snap.exists) throw new PostError('Postimi nuk u gjet.', 404, 'not_found');
  if (snap.data()?.authorId !== uid) throw new PostError('Vetëm autori mund ta fshijë postimin.', 403, 'forbidden');
  await fs.recursiveDelete(ref);
}

/** For a daily job: permanently removes posts deleted more than the restore window ago. */
export async function purgeExpiredDeletedPosts(fs: Firestore, now: number = Date.now(), limitCount = 200): Promise<number> {
  const cutoff = new Date(now - RESTORE_WINDOW_DAYS * 86_400_000);
  const snap = await fs.collection('forumPosts').where('deletedAt', '<', cutoff).limit(limitCount).get();
  for (const doc of snap.docs) await fs.recursiveDelete(doc.ref);
  return snap.size;
}

/* ───────────── Notifications after client-side actions ───────────── */

/** Like or repost just turned on: tell the author once (never again for the same person and post). */
export async function notifyPostAction(fs: Firestore, input: { postId: string; uid: string; action: 'like' | 'repost' }): Promise<void> {
  const [post, actor] = await Promise.all([fs.collection('forumPosts').doc(input.postId).get(), fs.collection('users').doc(input.uid).get()]);
  const authorId = String(post.data()?.authorId ?? '');
  if (!post.exists || !authorId || authorId === input.uid) return;
  const name = clip(actor.data()?.name, 120) || 'Një qytetar';
  await notifyOnce(fs, `forum_${input.action}_${input.postId}_${input.uid}`, {
    userId: authorId, actorId: input.uid, actorName: name, category: `forum_${input.action}`, priority: 'low', postId: input.postId,
    title: input.action === 'like' ? `${name} pëlqeu postimin tuaj` : `${name} ripostoi debatin tuaj`,
    message: clip(post.data()?.content, 100),
  });
}

/**
 * After a new post exists: notify the author of a quoted post and the people
 * named in the text. Everything is read from the stored post, so the browser
 * cannot claim a quote or mention that is not in it.
 */
export async function notifyAfterPublish(fs: Firestore, input: { postId: string; uid: string; mentionUids?: string[] }): Promise<void> {
  const postSnap = await fs.collection('forumPosts').doc(input.postId).get();
  const post = postSnap.data() as Record<string, any> | undefined;
  if (!postSnap.exists || post?.authorId !== input.uid) throw new PostError('Postimi nuk u gjet.', 404, 'not_found');
  const name = clip(post?.authorName, 120) || 'Një qytetar';
  const content = String(post?.content ?? '');
  const notified = new Set<string>([input.uid]);

  const quotedId = String(post?.quotedPost?.id ?? '');
  if (isSafeId(quotedId)) {
    const quoted = await fs.collection('forumPosts').doc(quotedId).get();
    const quotedAuthor = String(quoted.data()?.authorId ?? '');
    if (quoted.exists && quotedAuthor && !notified.has(quotedAuthor)) {
      notified.add(quotedAuthor);
      await notifyOnce(fs, `forum_quote_${input.postId}`, {
        userId: quotedAuthor, actorId: input.uid, actorName: name, category: 'forum_quote', postId: input.postId,
        title: `${name} citoi postimin tuaj`, message: content || 'Postimi juaj u citua në Debatin Publik.',
      });
    }
  }
  const handles = new Set(extractMentions(content));
  const hints = [...new Set((input.mentionUids ?? []).filter(isSafeId))].slice(0, MAX_MENTION_NOTIFICATIONS);
  const publisher = hints.length ? await fs.collection('users').doc(input.uid).get() : null;
  const publisherFollowing: string[] = Array.isArray(publisher?.data()?.followingIds) ? publisher?.data()?.followingIds : [];
  for (const id of hints) {
    if (notified.has(id)) continue;
    const user = await fs.collection('users').doc(id).get();
    if (!user.exists || !handles.has(toHandle(String(user.data()?.name ?? '')))) continue;
    notified.add(id);
    const mentionPrefs = normalizeForumPrefs(user.data()?.forumPrefs);
    if (!audienceAllows(mentionPrefs.whoCanMention, publisherFollowing.includes(id))) continue;
    await notifyOnce(fs, `forum_mention_${input.postId}_${id}`, {
      userId: id, actorId: input.uid, actorName: name, category: 'forum_mention', postId: input.postId,
      title: `${name} të përmendi`, message: content,
    });
  }
}

/** A follow just happened (the browser wrote followingIds): verify it, then notify once per pair. */
export async function notifyFollow(fs: Firestore, input: { uid: string; targetId: string }): Promise<void> {
  if (!isSafeId(input.uid) || !isSafeId(input.targetId) || input.uid === input.targetId) throw new PostError('Kërkesa nuk është e vlefshme.', 400, 'bad_request');
  const actor = await fs.collection('users').doc(input.uid).get();
  const following = actor.data()?.followingIds;
  if (!Array.isArray(following) || !following.includes(input.targetId)) throw new PostError('Ndjekja nuk u gjet.', 409, 'not_following');
  const target = await fs.collection('users').doc(input.targetId).get();
  if (!target.exists) return;
  const name = clip(actor.data()?.name, 120) || 'Dikush';
  await notifyOnce(fs, `forum_follow_${input.uid}_${input.targetId}`, {
    userId: input.targetId, actorId: input.uid, actorName: name, category: 'forum_follow',
    title: `${name} filloi t’ju ndjekë`, message: 'Një llogari e re ju ndjek.',
  });
}

/* ───────────── HTTP ───────────── */

export interface ForumPostDeps { requireAuth: RequestHandler; db: () => Firestore }

export function registerForumPostRoutes(app: Express, deps: ForumPostDeps): void {
  const allowComment = createRateLimiter(20, 60_000);
  const allowEdit = createRateLimiter(15, 60_000);
  const allowVote = createRateLimiter(60, 60_000);

  const fail = (res: Response, error: unknown, label: string) => {
    if (error instanceof PostError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
    console.error(`[FORUM] ${label} failed:`, (error as Error)?.message);
    return res.status(500).json({ error: 'Veprimi dështoi. Provoni përsëri.' });
  };
  const uidOf = (req: Request, res: Response): string | null => {
    const uid = req.user?.uid;
    if (!uid) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    return uid;
  };

  app.post('/api/v1/forum/posts/:postId/comments', deps.requireAuth, async (req, res) => {
    const uid = uidOf(req, res); if (!uid) return;
    if (!allowComment(uid)) return res.status(429).json({ error: 'Po komentoni shumë shpejt. Prisni pak.', code: 'rate_limited' });
    try {
      const out = await addComment(deps.db(), {
        postId: req.params.postId, uid, text: String(req.body?.text ?? ''),
        parentId: req.body?.parentId ? String(req.body.parentId) : undefined,
        mentionUids: Array.isArray(req.body?.mentionUids) ? req.body.mentionUids.map(String) : [],
      });
      return res.status(201).json(out);
    } catch (e) { return fail(res, e, 'comment'); }
  });

  app.delete('/api/v1/forum/posts/:postId/comments/:commentId', deps.requireAuth, async (req, res) => {
    const uid = uidOf(req, res); if (!uid) return;
    try {
      await deleteComment(deps.db(), { postId: req.params.postId, commentId: req.params.commentId, uid, staff: isStaffClaims(req.user?.claims) });
      return res.json({ ok: true });
    } catch (e) { return fail(res, e, 'delete comment'); }
  });

  app.put('/api/v1/forum/posts/:postId/reaction', deps.requireAuth, async (req, res) => {
    const uid = uidOf(req, res); if (!uid) return;
    if (!allowVote(uid)) return res.status(429).json({ error: 'Shumë veprime. Prisni pak.', code: 'rate_limited' });
    try { return res.json({ reactions: await setReaction(deps.db(), { postId: req.params.postId, uid, type: req.body?.type }) }); }
    catch (e) { return fail(res, e, 'reaction'); }
  });

  app.post('/api/v1/forum/posts/:postId/poll-vote', deps.requireAuth, async (req, res) => {
    const uid = uidOf(req, res); if (!uid) return;
    if (!allowVote(uid)) return res.status(429).json({ error: 'Shumë veprime. Prisni pak.', code: 'rate_limited' });
    try { return res.json(await votePostPoll(deps.db(), { postId: req.params.postId, uid, optionId: String(req.body?.optionId ?? '') })); }
    catch (e) { return fail(res, e, 'poll vote'); }
  });

  app.patch('/api/v1/forum/posts/:postId', deps.requireAuth, async (req, res) => {
    const uid = uidOf(req, res); if (!uid) return;
    if (!allowEdit(uid)) return res.status(429).json({ error: 'Po redaktoni shumë shpejt. Prisni pak.', code: 'rate_limited' });
    try { return res.json(await editPost(deps.db(), { postId: req.params.postId, uid, content: String(req.body?.content ?? '') })); }
    catch (e) { return fail(res, e, 'edit'); }
  });

  // Default: soft delete (restorable for 30 days). ?permanent=1 erases it for good.
  app.delete('/api/v1/forum/posts/:postId', deps.requireAuth, async (req, res) => {
    const uid = uidOf(req, res); if (!uid) return;
    try {
      if (req.query.permanent === '1') await purgePost(deps.db(), uid, req.params.postId);
      else await softDeletePost(deps.db(), uid, req.params.postId);
      return res.json({ ok: true, permanent: req.query.permanent === '1' });
    } catch (e) { return fail(res, e, 'delete post'); }
  });

  app.post('/api/v1/forum/posts/:postId/restore', deps.requireAuth, async (req, res) => {
    const uid = uidOf(req, res); if (!uid) return;
    try { await restorePost(deps.db(), uid, req.params.postId); return res.json({ ok: true }); }
    catch (e) { return fail(res, e, 'restore'); }
  });

  app.post('/api/v1/forum/posts/:postId/published', deps.requireAuth, async (req, res) => {
    const uid = uidOf(req, res); if (!uid) return;
    try {
      await notifyAfterPublish(deps.db(), { postId: req.params.postId, uid, mentionUids: Array.isArray(req.body?.mentionUids) ? req.body.mentionUids.map(String) : [] });
      return res.json({ ok: true });
    } catch (e) { return fail(res, e, 'published'); }
  });

  app.post('/api/v1/forum/follow-notify', deps.requireAuth, async (req, res) => {
    const uid = uidOf(req, res); if (!uid) return;
    try { await notifyFollow(deps.db(), { uid, targetId: String(req.body?.targetId ?? '') }); return res.json({ ok: true }); }
    catch (e) { return fail(res, e, 'follow notify'); }
  });
}

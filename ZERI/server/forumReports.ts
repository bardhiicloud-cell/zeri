/**
 * Reports of comments, accounts and ads in the public debate (posts have their own flow in
 * server/debateAdmin.ts, Reels in server/forumReels.ts).
 *
 * One document per (kind, target, reporter), so a person can report the same thing once and
 * repeated clicks are harmless. The server checks that the target exists and keeps a short
 * snapshot of what was reported: a comment can be edited or deleted afterwards, and the
 * moderator still needs to see what was actually said. Nothing is hidden automatically.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { createRateLimiter } from './directMessages';
import { applyReportToCase, readCaseFor } from './moderationCases';

export const REPORT_KINDS = ['comment', 'user', 'ad'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
export const REPORT_REASONS = ['spam', 'abuse', 'misinformation', 'violence', 'illegal', 'impersonation', 'other'] as const;
export const DETAILS_MAX = 300;

export class ReportError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 403 | 404, public readonly code: string) {
    super(message);
    this.name = 'ReportError';
  }
}

const isSafeId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128 && !v.includes('/');
const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

interface Comment { id?: string; authorId?: string; authorName?: string; content?: string; replies?: Comment[] }

/** Finds a comment or reply at any depth. */
export function findComment(comments: unknown, id: string): Comment | null {
  if (!Array.isArray(comments)) return null;
  for (const c of comments as Comment[]) {
    if (c?.id === id) return c;
    const nested = findComment(c?.replies, id);
    if (nested) return nested;
  }
  return null;
}

export interface SubmitReportInput {
  uid: string;
  kind: ReportKind;
  targetId: string;
  /** Required for comments and ads. */
  postId?: string;
  reason: string;
  details?: string;
}

export async function submitReport(fs: Firestore, input: SubmitReportInput): Promise<{ status: 'reported' | 'duplicate' }> {
  const { uid, kind, targetId } = input;
  if (!isSafeId(uid) || !(REPORT_KINDS as readonly string[]).includes(kind) || !isSafeId(targetId)) {
    throw new ReportError('Raportimi nuk është i vlefshëm.', 400, 'bad_request');
  }
  const reason = (REPORT_REASONS as readonly string[]).includes(input.reason) ? input.reason : 'other';
  const details = clip(input.details, DETAILS_MAX);
  const postId = kind === 'user' ? '' : input.postId ?? (kind === 'ad' ? targetId : '');
  if (kind !== 'user' && !isSafeId(postId)) throw new ReportError('Raportimi nuk është i vlefshëm.', 400, 'bad_request');

  const reportRef = fs.collection('forumReports').doc(`${kind}_${targetId}_${uid}`);
  return fs.runTransaction(async (tx) => {
    const reporter = await tx.get(fs.collection('users').doc(uid));
    if (!reporter.exists || reporter.data()?.role === 'guest') throw new ReportError('Kyçuni për të raportuar.', 403, 'no_account');

    let snapshot: Record<string, unknown>;
    let reportedUserId: string;
    if (kind === 'user') {
      if (targetId === uid) throw new ReportError('Nuk mund ta raportoni veten.', 400, 'self');
      const target = await tx.get(fs.collection('users').doc(targetId));
      if (!target.exists) throw new ReportError('Përdoruesi nuk u gjet.', 404, 'not_found');
      reportedUserId = targetId;
      snapshot = { name: clip(target.data()?.name, 120) };
    } else {
      const post = await tx.get(fs.collection('forumPosts').doc(postId));
      if (!post.exists || post.data()?.deletedAt) throw new ReportError('Postimi nuk u gjet.', 404, 'not_found');
      if (kind === 'ad') {
        if (post.data()?.isAd !== true) throw new ReportError('Ky postim nuk është reklamë.', 400, 'not_ad');
        reportedUserId = String(post.data()?.authorId ?? '');
        snapshot = { postId, excerpt: clip(post.data()?.content, 200) };
      } else {
        const comment = findComment(post.data()?.comments, targetId);
        if (!comment) throw new ReportError('Komenti nuk u gjet.', 404, 'not_found');
        if (comment.authorId === uid) throw new ReportError('Nuk mund ta raportoni komentin tuaj.', 400, 'self');
        reportedUserId = String(comment.authorId ?? '');
        snapshot = { postId, commentId: targetId, authorName: clip(comment.authorName, 120), excerpt: clip(comment.content, 300) };
      }
    }

    const [existing, moderationCase] = await Promise.all([tx.get(reportRef), readCaseFor(tx, fs, kind, targetId)]);
    if (existing.exists) return { status: 'duplicate' as const };
    tx.create(reportRef, {
      kind, targetId, postId, reportedUserId, reporterId: uid, reason, details, snapshot,
      status: 'open', createdAt: FieldValue.serverTimestamp(),
    });
    // One moderation case per reported thing, however many people report it.
    applyReportToCase(tx, fs, moderationCase, { kind, targetId, postId, subjectUid: reportedUserId, reason, snapshot }, Date.now());
    return { status: 'reported' as const };
  });
}

export interface ForumReportDeps { requireAuth: RequestHandler; db: () => Firestore }

export function registerForumReportRoutes(app: Express, deps: ForumReportDeps): void {
  const allow = createRateLimiter(10, 60_000);
  app.post('/api/v1/forum/reports', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!allow(uid)) return res.status(429).json({ error: 'Shumë raportime. Prisni pak.', code: 'rate_limited' });
    try {
      const result = await submitReport(deps.db(), {
        uid, kind: req.body?.kind, targetId: req.body?.targetId, postId: req.body?.postId,
        reason: String(req.body?.reason ?? ''), details: req.body?.details,
      });
      return res.json(result);
    } catch (error) {
      if (error instanceof ReportError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
      console.error('[REPORTS] failed:', (error as Error)?.message);
      return res.status(500).json({ error: 'Raportimi nuk u dërgua. Provoni përsëri.' });
    }
  });
}

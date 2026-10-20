import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

/**
 * Server side of the public-debate social features:
 *
 *   • post impressions — a view counter that a browser cannot write (the
 *     Firestore rules only let the author or a few listed fields change a post),
 *     deduplicated per account so reloading does not inflate it;
 *   • the verification tick — a paid monthly plan. A citizen *requests* it here;
 *     staff with the users section approve or reject it. Approving sets the same
 *     `isVerified` flag the admin "Verify" action uses, plus `verifiedUntil`, so
 *     the tick lapses on its own when the month ends.
 *
 * No card is charged by this code. The request records the price and the person
 * and the team confirms payment out of band; wiring a payment provider is a
 * separate step.
 */

export const VERIFICATION_PRICE_EUR = 15.99;
export const VERIFICATION_PLAN = 'forum-tick-monthly';
export const VERIFICATION_DAYS = 30;
export const MAX_NOTE = 300;

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

const clip = (value: unknown, max: number): string => String(value ?? '').trim().slice(0, max);

/** Post ids are Firestore auto-ids; anything with a slash would address another path. */
export function isSafeDocId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/');
}

export type RequestDecision =
  | { ok: true; note: string }
  | { ok: false; status: 400 | 403 | 409; error: string };

/** May this account file a verification request right now? Pure: no I/O. */
export function decideVerificationRequest(input: {
  hasEmail: boolean;
  alreadyVerified: boolean;
  existingStatus?: VerificationStatus | null;
  note: unknown;
}): RequestDecision {
  if (!input.hasEmail) {
    return { ok: false, status: 403, error: 'Regjistrohuni me një llogari për të kërkuar verifikim.' };
  }
  if (input.alreadyVerified) {
    return { ok: false, status: 409, error: 'Llogaria juaj është tashmë e verifikuar.' };
  }
  if (input.existingStatus === 'pending') {
    return { ok: false, status: 409, error: 'Kërkesa juaj është në pritje të konfirmimit.' };
  }
  return { ok: true, note: clip(input.note, MAX_NOTE) };
}

export function verifiedUntil(from: Date, days: number = VERIFICATION_DAYS): Date {
  return new Date(from.getTime() + days * 86_400_000);
}

/** Ids whose verification is active at `now` (no `verifiedUntil` means open-ended). Pure. */
export function activeVerifiedIds(
  docs: ReadonlyArray<{ id: string; verifiedUntil?: { toMillis?: () => number } | null }>,
  now: number = Date.now()
): string[] {
  return docs
    .filter((doc) => {
      const until = typeof doc.verifiedUntil?.toMillis === 'function' ? doc.verifiedUntil.toMillis() : null;
      return until === null || until > now;
    })
    .map((doc) => doc.id);
}

export interface ForumSocialDeps {
  requireAuth: RequestHandler;
  /** Must run after requireAuth; gates the approval queue to staff with the users section. */
  requireUsersSection: RequestHandler;
  db: () => Firestore;
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
}

const isAlreadyExists = (error: unknown): boolean =>
  (error as { code?: unknown })?.code === 6 ||
  (error as { code?: unknown })?.code === 'already-exists' ||
  /ALREADY_EXISTS/i.test(String((error as Error)?.message));

export function registerForumSocialRoutes(app: Express, deps: ForumSocialDeps): void {
  /** Count one impression per account per post. */
  app.post('/api/v1/forum/posts/:postId/view', deps.requireAuth, async (req: Request, res: Response) => {
    const postId = req.params.postId;
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!isSafeDocId(postId)) return res.status(400).json({ error: 'Postimi nuk është i vlefshëm.' });

    try {
      const postRef = deps.db().collection('forumPosts').doc(postId);
      const viewerRef = postRef.collection('viewers').doc(uid);
      const result = await deps.db().runTransaction(async (transaction) => {
        const [post, viewer] = await Promise.all([transaction.get(postRef), transaction.get(viewerRef)]);
        if (!post.exists) return { status: 404 as const };
        const stored = post.data()?.viewCount;
        const current = typeof stored === 'number' && Number.isFinite(stored) ? stored : 0;
        if (viewer.exists) return { status: 200 as const, viewCount: current, counted: false };
        transaction.update(postRef, { viewCount: current + 1 });
        transaction.create(viewerRef, { uid, at: FieldValue.serverTimestamp() });
        return { status: 200 as const, viewCount: current + 1, counted: true };
      });
      if (result.status === 404) return res.status(404).json({ error: 'Postimi nuk u gjet.' });
      return res.json({ viewCount: result.viewCount, counted: result.counted });
    } catch (error) {
      // Two simultaneous requests from one account: the second create() fails, which is the guarantee.
      if (isAlreadyExists(error)) return res.json({ counted: false });
      console.error('[FORUM] view failed:', error?.message);
      return res.status(500).json({ error: 'Shfaqja nuk u regjistrua.' });
    }
  });

  /**
   * Who currently has the tick. Public to every signed-in visitor (guests too):
   * a tick has to be visible to be worth anything. Cached for a minute.
   */
  let verifiedCache: { at: number; ids: string[] } | null = null;
  app.get('/api/v1/forum/verified-ids', deps.requireAuth, async (_req, res: Response) => {
    try {
      if (!verifiedCache || Date.now() - verifiedCache.at > 60_000) {
        const snapshot = await deps.db().collection('users').where('isVerified', '==', true).limit(1000).get();
        verifiedCache = {
          at: Date.now(),
          ids: activeVerifiedIds(snapshot.docs.map((doc) => ({ id: doc.id, verifiedUntil: doc.data().verifiedUntil }))),
        };
      }
      return res.json({ ids: verifiedCache.ids });
    } catch (error) {
      console.error('[FORUM] verified ids failed:', error?.message);
      return res.json({ ids: [] });
    }
  });

  /** My own verification state. */
  app.get('/api/v1/forum/verification/me', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const [profile, request] = await Promise.all([
        deps.db().collection('users').doc(uid).get(),
        deps.db().collection('verificationRequests').doc(uid).get(),
      ]);
      const until = profile.data()?.verifiedUntil;
      return res.json({
        verified: profile.data()?.isVerified === true,
        verifiedUntil: typeof until?.toMillis === 'function' ? until.toMillis() : null,
        status: (request.data()?.status as VerificationStatus | undefined) ?? 'none',
        priceEur: VERIFICATION_PRICE_EUR,
      });
    } catch (error) {
      console.error('[FORUM] verification status failed:', error?.message);
      return res.status(500).json({ error: 'Statusi nuk u ngarkua.' });
    }
  });

  /** A citizen asks for the tick. */
  app.post('/api/v1/forum/verification/request', deps.requireAuth, async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const [profile, existing] = await Promise.all([
        deps.db().collection('users').doc(user.uid).get(),
        deps.db().collection('verificationRequests').doc(user.uid).get(),
      ]);
      const decision = decideVerificationRequest({
        hasEmail: Boolean(user.email),
        alreadyVerified: profile.data()?.isVerified === true,
        existingStatus: (existing.data()?.status as VerificationStatus | undefined) ?? null,
        note: req.body?.note,
      });
      if (decision.ok === false) return res.status(decision.status).json({ error: decision.error });

      await deps.db().collection('verificationRequests').doc(user.uid).set({
        uid: user.uid,
        name: clip(profile.data()?.name, 120),
        email: user.email ?? null,
        plan: VERIFICATION_PLAN,
        priceEur: VERIFICATION_PRICE_EUR,
        note: decision.note,
        status: 'pending' as VerificationStatus,
        createdAt: FieldValue.serverTimestamp(),
      });
      deps.audit('forum.verification.request', req, { plan: VERIFICATION_PLAN });
      return res.status(201).json({ status: 'pending', priceEur: VERIFICATION_PRICE_EUR });
    } catch (error) {
      console.error('[FORUM] verification request failed:', error?.message);
      return res.status(500).json({ error: 'Kërkesa nuk u dërgua. Provoni përsëri.' });
    }
  });

  /** Staff: pending requests. */
  app.get('/api/v1/admin/verification-requests', deps.requireAuth, deps.requireUsersSection, async (_req, res: Response) => {
    try {
      const snapshot = await deps.db().collection('verificationRequests').where('status', '==', 'pending').limit(100).get();
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          name: data.name ?? '',
          email: data.email ?? '',
          note: data.note ?? '',
          priceEur: data.priceEur ?? VERIFICATION_PRICE_EUR,
          createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : null,
        };
      });
      return res.json({ items });
    } catch (error) {
      console.error('[ADMIN] verification list failed:', error?.message);
      return res.status(500).json({ error: 'Lista nuk u ngarkua.' });
    }
  });

  /** Staff: approve (payment confirmed) or reject. */
  app.post('/api/v1/admin/verification-requests/:uid/decision', deps.requireAuth, deps.requireUsersSection, async (req: Request, res: Response) => {
    const uid = req.params.uid;
    const decision = req.body?.decision;
    if (!isSafeDocId(uid)) return res.status(400).json({ error: 'Llogaria nuk është e vlefshme.' });
    if (decision !== 'approve' && decision !== 'reject') return res.status(400).json({ error: 'Vendimi nuk njihet.' });

    try {
      const requestRef = deps.db().collection('verificationRequests').doc(uid);
      const userRef = deps.db().collection('users').doc(uid);
      const [request, profile] = await Promise.all([requestRef.get(), userRef.get()]);
      if (!request.exists || request.data()?.status !== 'pending') {
        return res.status(404).json({ error: 'Kërkesa nuk është në pritje.' });
      }
      if (!profile.exists) return res.status(404).json({ error: 'Profili nuk u gjet.' });

      const staffUid = req.user?.uid ?? null;
      if (decision === 'approve') {
        const until = verifiedUntil(new Date());
        await userRef.update({ isVerified: true, verifiedUntil: until, verifiedBy: staffUid });
        await requestRef.update({ status: 'approved', decidedAt: FieldValue.serverTimestamp(), decidedBy: staffUid, verifiedUntil: until });
      } else {
        await requestRef.update({
          status: 'rejected',
          decidedAt: FieldValue.serverTimestamp(),
          decidedBy: staffUid,
          reason: clip(req.body?.reason, MAX_NOTE),
        });
      }
      deps.audit(`forum.verification.${decision}`, req, { targetUid: uid });
      return res.json({ ok: true, decision });
    } catch (error) {
      console.error('[ADMIN] verification decision failed:', error?.message);
      return res.status(500).json({ error: 'Vendimi nuk u ruajt.' });
    }
  });
}

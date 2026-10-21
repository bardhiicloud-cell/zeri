/**
 * Business-account insights for Debati Publik.
 *
 * Browsers report three events about someone else's account — a profile view, a
 * click on a contact button, a Reel view — and this module counts them. Nothing is
 * estimated: each number is an increment the server made after checking who sent it.
 *
 *   • identity comes from the verified token, never from the request body;
 *   • an account cannot count its own activity;
 *   • events are only recorded for accounts that are currently `business`;
 *   • "unique" counts use a marker document per (account, day, metric, viewer), so
 *     reloading a profile ten times is ten views but one viewer;
 *   • everything lands in one document per author per UTC day, so a period is read
 *     with a handful of direct document gets (no composite index, no scan).
 *
 * Clients cannot read these collections (no Firestore rule); they use GET /me.
 */
import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { createRateLimiter } from './directMessages';
import { prefsOf } from '../src/lib/forumPrefs';

export const INSIGHT_EVENTS = ['profile_view', 'contact_click', 'reel_view'] as const;
export type InsightEvent = (typeof INSIGHT_EVENTS)[number];
export const CONTACT_KINDS = ['email', 'phone', 'website'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];
export const INSIGHT_PERIODS = [7, 28, 90] as const;

export interface DailyInsights {
  day: string; // YYYYMMDD (UTC)
  profileViews: number;
  profileViewers: number;
  contactClicks: number;
  contactEmail: number;
  contactPhone: number;
  contactWebsite: number;
  reelViews: number;
  reelViewers: number;
  reels: Record<string, number>;
}

const isSafeId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128 && !v.includes('/');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

/** The last `days` UTC days, oldest first, ending today. */
export function lastDays(days: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(dayKey(new Date(now.getTime() - i * 86_400_000)));
  return out;
}

export function emptyDay(day: string): DailyInsights {
  return { day, profileViews: 0, profileViewers: 0, contactClicks: 0, contactEmail: 0, contactPhone: 0, contactWebsite: 0, reelViews: 0, reelViewers: 0, reels: {} };
}

export function toDaily(day: string, data: Record<string, any> | undefined): DailyInsights {
  const d = data ?? {};
  const reels: Record<string, number> = {};
  if (d.reels && typeof d.reels === 'object') for (const [id, n] of Object.entries(d.reels)) if (num(n) > 0) reels[id] = num(n);
  return {
    day,
    profileViews: num(d.profileViews), profileViewers: num(d.profileViewers),
    contactClicks: num(d.contactClicks), contactEmail: num(d.contactEmail), contactPhone: num(d.contactPhone), contactWebsite: num(d.contactWebsite),
    reelViews: num(d.reelViews), reelViewers: num(d.reelViewers), reels,
  };
}

const isAlreadyExists = (error: unknown): boolean =>
  (error as { code?: unknown })?.code === 6 || (error as { code?: unknown })?.code === 'already-exists' ||
  /ALREADY_EXISTS/i.test(String((error as Error)?.message));

export interface RecordInput { viewerId: string; authorId: string; type: InsightEvent; kind?: ContactKind; reelId?: string; now?: Date }

/** Counts one event. Returns false when it was ignored (own account, not a business, bad input). */
export async function recordInsightEvent(fs: Firestore, input: RecordInput): Promise<boolean> {
  const { viewerId, authorId, type } = input;
  if (!isSafeId(viewerId) || !isSafeId(authorId) || viewerId === authorId) return false;
  if (!INSIGHT_EVENTS.includes(type)) return false;
  if (type === 'contact_click' && !CONTACT_KINDS.includes(input.kind as ContactKind)) return false;
  if (type === 'reel_view' && !isSafeId(input.reelId)) return false;

  const author = await fs.collection('users').doc(authorId).get();
  if (!author.exists || prefsOf(author.data()).accountType !== 'business') return false;
  if (type === 'reel_view') {
    const reel = await fs.collection('forumReels').doc(input.reelId as string).get();
    if (!reel.exists || reel.data()?.authorId !== authorId) return false;
  }

  const day = dayKey(input.now ?? new Date());
  const dailyRef = fs.collection('forumInsightsDaily').doc(`${authorId}_${day}`);
  const patch: Record<string, unknown> = { authorId, day, updatedAt: FieldValue.serverTimestamp() };

  if (type === 'profile_view') patch.profileViews = FieldValue.increment(1);
  if (type === 'contact_click') {
    patch.contactClicks = FieldValue.increment(1);
    patch[`contact${(input.kind as string)[0].toUpperCase()}${(input.kind as string).slice(1)}`] = FieldValue.increment(1);
  }
  if (type === 'reel_view') {
    patch.reelViews = FieldValue.increment(1);
    patch.reels = { [input.reelId as string]: FieldValue.increment(1) };
  }

  const uniqueMetric = type === 'profile_view' ? 'profileViewers' : type === 'reel_view' ? 'reelViewers' : null;
  if (uniqueMetric) {
    try {
      await fs.collection('forumInsightsUniq').doc(`${authorId}_${day}_${uniqueMetric}_${viewerId}`).create({ at: FieldValue.serverTimestamp() });
      patch[uniqueMetric] = FieldValue.increment(1);
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
    }
  }
  await dailyRef.set(patch, { merge: true });
  return true;
}

/** `days` consecutive daily documents for one author (missing days are zero). */
export async function readInsights(fs: Firestore, authorId: string, days: number, now: Date = new Date()): Promise<DailyInsights[]> {
  const keys = lastDays(days, now);
  const refs = keys.map((day) => fs.collection('forumInsightsDaily').doc(`${authorId}_${day}`));
  const snaps = await fs.getAll(...refs);
  return snaps.map((snap, i) => toDaily(keys[i], snap.exists ? snap.data() : undefined));
}

export interface ForumAnalyticsDeps { requireAuth: RequestHandler; db: () => Firestore }

export function registerForumAnalyticsRoutes(app: Express, deps: ForumAnalyticsDeps): void {
  const allow = createRateLimiter(120, 60_000);

  app.post('/api/v1/forum/analytics/event', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!allow(uid)) return res.status(429).json({ error: 'Shumë kërkesa.' });
    try {
      const recorded = await recordInsightEvent(deps.db(), {
        viewerId: uid,
        authorId: String(req.body?.authorId ?? ''),
        type: String(req.body?.type ?? '') as InsightEvent,
        kind: String(req.body?.kind ?? '') as ContactKind,
        reelId: String(req.body?.reelId ?? ''),
      });
      return res.json({ recorded });
    } catch (error) {
      console.warn('[FORUM] insight event failed:', error?.message);
      return res.json({ recorded: false });
    }
  });

  app.get('/api/v1/forum/analytics/me', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const requested = Number(req.query.days);
    const days = (INSIGHT_PERIODS as readonly number[]).includes(requested) ? requested : 28;
    try {
      const profile = await deps.db().collection('users').doc(uid).get();
      if (prefsOf(profile.data()).accountType !== 'business') {
        return res.status(403).json({ error: 'Statistikat e detajuara janë për llogaritë e biznesit.', code: 'not_business' });
      }
      // Current period plus the one before it, for "vs previous period".
      const all = await readInsights(deps.db(), uid, days * 2);
      return res.json({ days, previous: all.slice(0, days), current: all.slice(days) });
    } catch (error) {
      console.error('[FORUM] insights read failed:', error?.message);
      return res.status(500).json({ error: 'Statistikat nuk u ngarkuan.' });
    }
  });
}

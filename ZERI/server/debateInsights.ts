import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { CASES } from './moderationCases';

/**
 * The Debate admin's eyes on the whole social side: stories, reels and the reports about them.
 *
 *   reports   what is being reported, why, how fast it is handled, who is waiting, who keeps
 *             coming back, how the moderators share the load (read from `moderationCases`)
 *   stories   every recent Debat Story with its view count; staff can open the viewer list
 *             (each opening is audited, because it names citizens) and hide a story
 *   reels     every recent Reel with views, likes and reports; staff can hide a Reel
 *
 * Aggregation is pure (`summariseCases`, `tallyReelReports`) so the numbers are tested.
 * Nothing here deletes anything: hiding is reversible and carries who/when/why.
 */

const DAY = 86_400_000;
export const STORY_LIST_LIMIT = 60;
export const REEL_LIST_LIMIT = 100;
export const CASE_SCAN_LIMIT = 1000;
export const VIEWER_PAGE = 300;

const clip = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);
const isSafeId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128 && !v.includes('/');
const millis = (value: any): number => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const parsed = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/* ----------------------------------------------------------- reports */

export interface CaseLite {
  kind: string;
  status: string;
  open: boolean;
  reasons: Record<string, number>;
  reportCount: number;
  priority: string;
  escalated: boolean;
  subjectUid: string;
  subjectName: string;
  assigneeUid: string | null;
  assigneeName: string;
  firstReportedAtMs: number;
  decidedAtMs: number | null;
}

export function toCaseLite(data: Record<string, any>): CaseLite {
  const reasons: Record<string, number> = {};
  if (data.reasons && typeof data.reasons === 'object') for (const [k, v] of Object.entries(data.reasons)) if (Number(v) > 0) reasons[k] = Number(v);
  return {
    kind: String(data.kind ?? 'post'),
    status: String(data.status ?? 'flagged'),
    open: data.open === true,
    reasons,
    reportCount: Number(data.reportCount) || 0,
    priority: String(data.priority ?? 'normal'),
    escalated: data.escalated === true,
    subjectUid: String(data.subjectUid ?? ''),
    subjectName: clip(data.snapshot?.authorName ?? data.snapshot?.name, 120),
    assigneeUid: data.assigneeUid ? String(data.assigneeUid) : null,
    assigneeName: clip(data.assigneeName, 120),
    firstReportedAtMs: Number(data.firstReportedAtMs) || 0,
    decidedAtMs: data.decision?.atMs ? Number(data.decision.atMs) : null,
  };
}

export interface ReportInsights {
  days: number;
  totals: { cases: number; open: number; reports: number; escalated: number; urgentOpen: number };
  byKind: Record<string, number>;
  byReason: Record<string, number>;
  byStatus: Record<string, number>;
  /** Oldest first: one entry per UTC day with cases opened and cases decided that day. */
  trend: Array<{ day: string; opened: number; decided: number }>;
  /** How long the open cases have been waiting. */
  openAge: { under24h: number; day1to3: number; day3to7: number; over7d: number };
  /** Median hours from first report to decision, for cases decided in the period; null with no data. */
  medianResolutionHours: number | null;
  repeatSubjects: Array<{ uid: string; name: string; cases: number; reports: number }>;
  moderators: Array<{ uid: string; name: string; open: number }>;
  unassignedOpen: number;
}

const dayLabel = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Pure: everything the reports analytics screen shows, from the case list and the clock. */
export function summariseCases(cases: readonly CaseLite[], days: number, now: number = Date.now()): ReportInsights {
  const since = now - days * DAY;
  const inPeriod = cases.filter((c) => c.firstReportedAtMs >= since || c.open || (c.decidedAtMs ?? 0) >= since);
  const count = (pick: (c: CaseLite) => string) => {
    const out: Record<string, number> = {};
    for (const c of inPeriod) out[pick(c)] = (out[pick(c)] ?? 0) + 1;
    return out;
  };

  const byReason: Record<string, number> = {};
  for (const c of inPeriod) for (const [reason, n] of Object.entries(c.reasons)) byReason[reason] = (byReason[reason] ?? 0) + n;

  const trendMap = new Map<string, { opened: number; decided: number }>();
  for (let i = days - 1; i >= 0; i--) trendMap.set(dayLabel(now - i * DAY), { opened: 0, decided: 0 });
  for (const c of cases) {
    const opened = trendMap.get(dayLabel(c.firstReportedAtMs));
    if (opened && c.firstReportedAtMs >= since) opened.opened += 1;
    if (c.decidedAtMs) {
      const decided = trendMap.get(dayLabel(c.decidedAtMs));
      if (decided) decided.decided += 1;
    }
  }

  const open = cases.filter((c) => c.open);
  const openAge = { under24h: 0, day1to3: 0, day3to7: 0, over7d: 0 };
  for (const c of open) {
    const age = now - c.firstReportedAtMs;
    if (age < DAY) openAge.under24h += 1;
    else if (age < 3 * DAY) openAge.day1to3 += 1;
    else if (age < 7 * DAY) openAge.day3to7 += 1;
    else openAge.over7d += 1;
  }

  const hours = cases
    .filter((c) => c.decidedAtMs && c.decidedAtMs >= since && c.decidedAtMs >= c.firstReportedAtMs)
    .map((c) => ((c.decidedAtMs as number) - c.firstReportedAtMs) / 3_600_000)
    .sort((a, b) => a - b);
  const medianResolutionHours = hours.length === 0 ? null
    : Math.round((hours.length % 2 ? hours[(hours.length - 1) / 2] : (hours[hours.length / 2 - 1] + hours[hours.length / 2]) / 2) * 10) / 10;

  const subjects = new Map<string, { name: string; cases: number; reports: number }>();
  for (const c of inPeriod) {
    if (!c.subjectUid) continue;
    const s = subjects.get(c.subjectUid) ?? { name: c.subjectName, cases: 0, reports: 0 };
    s.cases += 1;
    s.reports += c.reportCount;
    if (!s.name) s.name = c.subjectName;
    subjects.set(c.subjectUid, s);
  }
  const repeatSubjects = [...subjects.entries()]
    .filter(([, s]) => s.cases >= 2)
    .map(([uid, s]) => ({ uid, ...s }))
    .sort((a, b) => b.cases - a.cases || b.reports - a.reports)
    .slice(0, 10);

  const load = new Map<string, { name: string; open: number }>();
  let unassignedOpen = 0;
  for (const c of open) {
    if (!c.assigneeUid) { unassignedOpen += 1; continue; }
    const m = load.get(c.assigneeUid) ?? { name: c.assigneeName, open: 0 };
    m.open += 1;
    load.set(c.assigneeUid, m);
  }

  return {
    days,
    totals: {
      cases: inPeriod.length,
      open: open.length,
      reports: inPeriod.reduce((sum, c) => sum + c.reportCount, 0),
      escalated: open.filter((c) => c.escalated).length,
      urgentOpen: open.filter((c) => c.priority === 'urgent').length,
    },
    byKind: count((c) => c.kind),
    byReason,
    byStatus: count((c) => c.status),
    trend: [...trendMap.entries()].map(([day, v]) => ({ day, ...v })),
    openAge,
    medianResolutionHours,
    repeatSubjects,
    moderators: [...load.entries()].map(([uid, m]) => ({ uid, ...m })).sort((a, b) => b.open - a.open),
    unassignedOpen,
  };
}

/** Pure: how many reports each reel has, from the report documents. */
export function tallyReelReports(reports: ReadonlyArray<{ reelId?: unknown }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of reports) {
    const id = typeof r.reelId === 'string' ? r.reelId : '';
    if (id) out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

/* ---------------------------------------------------- stories & reels */

export interface StoryRow {
  id: string; authorId: string; authorName: string; mediaUrl: string; mediaType: 'image' | 'video';
  textOverlay: string; createdAtMs: number; expiresAtMs: number; isHidden: boolean; live: boolean; views: number;
}
export interface ReelRow {
  id: string; authorId: string; authorName: string; caption: string; coverUrl: string; mediaUrl: string;
  durationSec: number; views: number; likes: number; reports: number; isHidden: boolean; createdAtMs: number;
}

export function toStoryRow(id: string, data: Record<string, any>, views: number, now: number = Date.now()): StoryRow {
  const expiresAtMs = millis(data.expiresAt);
  return {
    id, authorId: String(data.authorId ?? ''), authorName: clip(data.authorName, 120),
    mediaUrl: typeof data.mediaUrl === 'string' ? data.mediaUrl : '', mediaType: data.mediaType === 'video' ? 'video' : 'image',
    textOverlay: clip(data.textOverlay, 200), createdAtMs: millis(data.createdAt), expiresAtMs,
    isHidden: data.isHidden === true, live: data.isHidden !== true && expiresAtMs > now, views,
  };
}

export function toReelRow(id: string, data: Record<string, any>, reports: number): ReelRow {
  return {
    id, authorId: String(data.authorId ?? ''), authorName: clip(data.authorName, 120), caption: clip(data.caption, 300),
    coverUrl: typeof data.coverUrl === 'string' ? data.coverUrl : '', mediaUrl: typeof data.mediaUrl === 'string' ? data.mediaUrl : '',
    durationSec: Number(data.durationSec) || 0, views: Number(data.viewCount) || 0,
    likes: Array.isArray(data.likedBy) ? data.likedBy.length : 0, reports, isHidden: data.isHidden === true, createdAtMs: millis(data.createdAt),
  };
}

export interface DebateInsightsDeps {
  requireAuth: RequestHandler;
  requireDebateSection: RequestHandler;
  db: () => Firestore;
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
}

export function registerDebateInsightsRoutes(app: Express, deps: DebateInsightsDeps): void {
  const guard = [deps.requireAuth, deps.requireDebateSection];
  const fail = (res: Response, label: string, error: unknown, message: string) => {
    console.error(`[DEBATE] ${label} failed:`, (error as Error)?.message);
    return res.status(500).json({ error: message });
  };

  app.get('/api/v1/debate/insights/reports', ...guard, async (req: Request, res: Response) => {
    const requested = Number(req.query.days);
    const days = [7, 14, 30, 90].includes(requested) ? requested : 30;
    try {
      const snap = await deps.db().collection(CASES).orderBy('updatedAtMs', 'desc').limit(CASE_SCAN_LIMIT).get();
      return res.json(summariseCases(snap.docs.map((d) => toCaseLite(d.data())), days));
    } catch (error) { return fail(res, 'report insights', error, 'Analitika e raporteve nuk u ngarkua.'); }
  });

  app.get('/api/v1/debate/content/stories', ...guard, async (_req: Request, res: Response) => {
    try {
      const fs = deps.db();
      const snap = await fs.collection('forumStories').orderBy('createdAt', 'desc').limit(STORY_LIST_LIMIT).get();
      const counts = await Promise.all(snap.docs.map((d) => d.ref.collection('viewers').count().get()));
      const now = Date.now();
      const stories = snap.docs.map((d, i) => toStoryRow(d.id, d.data(), counts[i].data().count, now));
      return res.json({
        stories,
        totals: {
          live: stories.filter((s) => s.live).length,
          hidden: stories.filter((s) => s.isHidden).length,
          views: stories.reduce((sum, s) => sum + s.views, 0),
        },
      });
    } catch (error) { return fail(res, 'stories', error, 'Stories nuk u ngarkuan.'); }
  });

  /** Who saw a story. Names citizens, so every opening is audited under the staff member. */
  app.get('/api/v1/debate/content/stories/:id/viewers', ...guard, async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!isSafeId(id)) return res.status(400).json({ error: 'Story nuk është e vlefshme.' });
    try {
      const fs = deps.db();
      const storyRef = fs.collection('forumStories').doc(id);
      if (!(await storyRef.get()).exists) return res.status(404).json({ error: 'Story nuk u gjet.' });
      const [total, snap] = await Promise.all([
        storyRef.collection('viewers').count().get(),
        storyRef.collection('viewers').orderBy('at', 'desc').limit(VIEWER_PAGE).get(),
      ]);
      const users = await Promise.all(snap.docs.map((d) => fs.collection('users').doc(d.id).get()));
      const viewers = snap.docs.map((d, i) => ({
        id: d.id,
        name: clip(users[i].data()?.name, 120) || 'Qytetar',
        atMs: millis(d.get('at')),
      }));
      deps.audit('debate.story.viewers', req, { id, shown: viewers.length });
      return res.json({ count: total.data().count, viewers });
    } catch (error) { return fail(res, 'story viewers', error, 'Shikuesit nuk u ngarkuan.'); }
  });

  const hideHandler = (collectionName: 'forumStories' | 'forumReels', auditAction: string, notFound: string) =>
    async (req: Request, res: Response) => {
      const id = req.params.id;
      const hide = req.body?.hide !== false;
      const reason = clip(req.body?.reason, 300);
      if (!isSafeId(id)) return res.status(400).json({ error: 'Përmbajtja nuk është e vlefshme.' });
      if (hide && reason.length < 5) return res.status(400).json({ error: 'Shkruani arsyen (të paktën 5 shenja).' });
      try {
        const ref = deps.db().collection(collectionName).doc(id);
        if (!(await ref.get()).exists) return res.status(404).json({ error: notFound });
        await ref.update(hide
          ? { isHidden: true, hiddenBy: req.user?.uid ?? null, hiddenAt: FieldValue.serverTimestamp(), hiddenReason: reason }
          : { isHidden: false, hiddenBy: FieldValue.delete(), hiddenAt: FieldValue.delete(), hiddenReason: FieldValue.delete() });
        deps.audit(`${auditAction}.${hide ? 'hide' : 'unhide'}`, req, { id, reason: reason || null });
        return res.json({ ok: true });
      } catch (error) { return fail(res, auditAction, error, 'Veprimi nuk u krye.'); }
    };

  app.post('/api/v1/debate/content/stories/:id/hide', ...guard, hideHandler('forumStories', 'debate.story', 'Story nuk u gjet.'));
  app.post('/api/v1/debate/content/reels/:id/hide', ...guard, hideHandler('forumReels', 'debate.reel', 'Reel-i nuk u gjet.'));

  app.get('/api/v1/debate/content/reels', ...guard, async (_req: Request, res: Response) => {
    try {
      const fs = deps.db();
      const [snap, reportSnap] = await Promise.all([
        fs.collection('forumReels').orderBy('createdAt', 'desc').limit(REEL_LIST_LIMIT).get(),
        fs.collection('forumReelReports').limit(500).get(),
      ]);
      const reports = tallyReelReports(reportSnap.docs.map((d) => d.data()));
      const reels = snap.docs.map((d) => toReelRow(d.id, d.data(), reports[d.id] ?? 0));
      return res.json({
        reels,
        totals: { views: reels.reduce((s, r) => s + r.views, 0), likes: reels.reduce((s, r) => s + r.likes, 0), reported: reels.filter((r) => r.reports > 0).length, hidden: reels.filter((r) => r.isHidden).length },
      });
    } catch (error) { return fail(res, 'reels', error, 'Reels nuk u ngarkuan.'); }
  });
}

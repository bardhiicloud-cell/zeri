import type { Express, Request, RequestHandler, Response } from 'express';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { mayUseSection } from './policy';

/**
 * The manager's view of the team: who carries what, who is idle, what waits.
 *
 * The manager of the agents (and the owner) need to answer, at a glance and without
 * opening reports: how much is waiting, how much of it nobody has taken on, how
 * loaded is each agent, and who holds work but has gone quiet. This is computed on
 * the server with counts, never by loading reports into the browser, so it stays
 * cheap with hundreds of thousands of reports. The answer is cached for a minute.
 *
 * Read-only: nothing here changes a report or an account.
 */

export const DORMANT_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
export const AGENT_ROLES = ['agent', 'responder', 'dispatcher', 'moderator', 'approver'] as const;

export interface AgentInput {
  uid: string;
  name: string;
  email: string;
  role: string;
}

export interface AgentLoad {
  holding: number;
  actions24h: number;
  actions7d: number;
  lastActionMs: number | null;
}

export interface TeamRow extends AgentInput, AgentLoad {
  /** Holds work but has done nothing for three days (or ever). */
  dormant: boolean;
  /** Share of the team's held work this agent carries, 0-100. */
  sharePercent: number;
}

export interface TeamSummary {
  rows: TeamRow[];
  totalHeld: number;
  /** Agents holding work that have not acted in three days. */
  dormantHolders: number;
  /** The heaviest load divided by the average: 1 is even, higher is lopsided. */
  imbalance: number;
}

/** Combine the agents with their measured load. Pure: no I/O, `nowMs` is a parameter. */
export function summarizeTeam(agents: readonly AgentInput[], loads: ReadonlyMap<string, AgentLoad>, nowMs: number): TeamSummary {
  const totalHeld = agents.reduce((sum, agent) => sum + (loads.get(agent.uid)?.holding ?? 0), 0);
  const rows: TeamRow[] = agents.map(agent => {
    const load = loads.get(agent.uid) ?? { holding: 0, actions24h: 0, actions7d: 0, lastActionMs: null };
    const quiet = load.lastActionMs === null || nowMs - load.lastActionMs > DORMANT_AFTER_MS;
    return {
      ...agent,
      ...load,
      dormant: load.holding > 0 && quiet,
      sharePercent: totalHeld === 0 ? 0 : Math.round((load.holding / totalHeld) * 100),
    };
  });
  // Trouble first: quiet people holding work, then the heaviest loads.
  rows.sort((a, b) => Number(b.dormant) - Number(a.dormant) || b.holding - a.holding || b.actions24h - a.actions24h || a.name.localeCompare(b.name));
  const active = rows.filter(row => row.holding > 0);
  const average = active.length ? totalHeld / active.length : 0;
  const heaviest = rows.reduce((max, row) => Math.max(max, row.holding), 0);
  return {
    rows,
    totalHeld,
    dormantHolders: rows.filter(row => row.dormant).length,
    imbalance: average > 0 ? Math.round((heaviest / average) * 10) / 10 : 1,
  };
}

/** Who may see the team view: owners, the manager, and anyone granted monitoring. */
export function mayViewTeam(actor: { role: string; permissions: readonly string[] }): boolean {
  return actor.role === 'admin' || actor.role === 'superadmin' || actor.role === 'monitor' ||
    mayUseSection({ role: actor.role, permissions: actor.permissions }, 'monitorim');
}

export interface TeamOverviewDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  actingUser: (req: Request) => { uid: string; role: string; permissions: string[] };
}

const CACHE_MS = 60_000;
const MAX_AGENTS = 200;
const BATCH = 20;

async function inBatches<T, R>(items: readonly T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let start = 0; start < items.length; start += BATCH) {
    out.push(...(await Promise.all(items.slice(start, start + BATCH).map(work))));
  }
  return out;
}

export function registerTeamOverviewRoutes(app: Express, deps: TeamOverviewDeps): void {
  let cache: { at: number; body: unknown } | null = null;

  app.get('/api/v1/admin/team-overview', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    if (!mayViewTeam(actor)) return res.status(403).json({ error: 'Nuk keni qasje te pamja e ekipit.' });
    res.setHeader('Cache-Control', 'private, no-store');
    if (cache && Date.now() - cache.at < CACHE_MS && req.query.fresh !== '1') return res.json(cache.body);

    try {
      const db = deps.db();
      const nowMs = Date.now();
      const since24 = Timestamp.fromMillis(nowMs - 24 * 3600_000);
      const since7d = Timestamp.fromMillis(nowMs - 7 * 24 * 3600_000);
      const reports = db.collection('reports');
      const audit = db.collection('auditLogs');

      const staff = await db.collection('users').where('role', 'in', [...AGENT_ROLES]).limit(MAX_AGENTS).get();
      const agents: AgentInput[] = staff.docs
        .filter(doc => doc.data().isBanned !== true)
        .map(doc => ({ uid: doc.id, name: String(doc.data().name ?? doc.data().email ?? doc.id), email: String(doc.data().email ?? ''), role: String(doc.data().role ?? '') }));

      const count = async (query: FirebaseFirestore.Query) => (await query.count().get()).data().count;

      const [pending, overdue, oldest, perAgent] = await Promise.all([
        count(reports.where('status', '==', 'Pending Review')),
        count(reports.where('status', '==', 'Overdue')),
        reports.where('status', '==', 'Pending Review').orderBy('createdAt', 'asc').limit(1).get(),
        inBatches(agents, async agent => {
          const [holding, a24, a7, last] = await Promise.all([
            count(reports.where('assignedToUid', '==', agent.uid).where('status', '==', 'Pending Review')),
            count(audit.where('actorUid', '==', agent.uid).where('createdAt', '>=', since24)),
            count(audit.where('actorUid', '==', agent.uid).where('createdAt', '>=', since7d)),
            audit.where('actorUid', '==', agent.uid).orderBy('createdAt', 'desc').limit(1).get(),
          ]);
          const lastAt = last.docs[0]?.get('createdAt') as Timestamp | undefined;
          return [agent.uid, { holding, actions24h: a24, actions7d: a7, lastActionMs: lastAt?.toMillis?.() ?? null } as AgentLoad] as const;
        }),
      ]);

      const summary = summarizeTeam(agents, new Map(perAgent), nowMs);
      const oldestAt = oldest.docs[0]?.get('createdAt') as Timestamp | string | undefined;
      const body = {
        generatedAt: new Date(nowMs).toISOString(),
        queue: {
          pending,
          // What nobody has taken on yet (held work is counted per agent above).
          unassigned: Math.max(0, pending - summary.totalHeld),
          overdue,
          oldestPendingAt: typeof oldestAt === 'string' ? oldestAt : oldestAt?.toDate?.().toISOString() ?? null,
        },
        team: { totalHeld: summary.totalHeld, dormantHolders: summary.dormantHolders, imbalance: summary.imbalance, agents: summary.rows.length },
        agents: summary.rows.map(row => ({ ...row, lastActionAt: row.lastActionMs ? new Date(row.lastActionMs).toISOString() : null, lastActionMs: undefined })),
      };
      cache = { at: nowMs, body };
      return res.json(body);
    } catch (error: any) {
      const missingIndex = error?.code === 9 || /index/i.test(String(error?.message ?? ''));
      console.error('[TEAM] overview failed:', error?.message);
      return res.status(missingIndex ? 503 : 500).json({
        error: missingIndex ? 'Indeksi i kërkuar nuk është aktivizuar ende. Njoftoni administratorin e sistemit.' : 'Pamja e ekipit nuk u ngarkua.',
      });
    }
  });
}

/**
 * Read models for auditing ONE actor's history — the superadmin's per-actor
 * drill-down in the moderation centre.
 *
 * The moderation centre already answers "who is active overall". What it could
 * not answer was the question a supervisor actually asks before a decision:
 *
 *   "Show me everything THIS person did — what they changed, what they removed,
 *    when, and in which municipality — for the last 7 days / 30 days / ever."
 *
 * That is a different shape of query. It is per-actor rather than per-log, it
 * needs a time window, and it must classify each entry by what it DID — a
 * deletion reads very differently from an approval — rather than showing a flat
 * wall of action titles.
 *
 * Everything here is pure: it takes the logs and the two ids and returns rows.
 * No store access, so it can be unit-tested and reused by a server route.
 */
import type { AuditLog } from '../types';

/** The window a supervisor is looking through. */
export type AuditWindow = '24h' | '7d' | '30d' | 'all';

export const AUDIT_WINDOWS: readonly AuditWindow[] = ['24h', '7d', '30d', 'all'];

export const WINDOW_LABELS: Record<AuditWindow, string> = {
  '24h': '24 orët e fundit',
  '7d': '7 ditët e fundit',
  '30d': '30 ditët e fundit',
  all: 'Gjithë historia',
};

const WINDOW_MS: Record<AuditWindow, number> = {
  '24h': 24 * 36e5,
  '7d': 7 * 24 * 36e5,
  '30d': 30 * 24 * 36e5,
  all: Number.POSITIVE_INFINITY,
};

/**
 * What an action actually was, in terms a supervisor decides on.
 *
 * The distinction that matters most is `destructive`. A platform where staff
 * can delete things needs a view that surfaces deletions first, because that is
 * the class of action which cannot be undone and which a dispute would be
 * about.
 */
export type ActionKind =
  | 'destructive'   // delete, remove, purge
  | 'suppressive'   // hide, unpublish, reject, ban, deny
  | 'modifying'     // edit, update, change, set, assign
  | 'additive'      // create, add, approve, publish, resolve
  | 'access'        // login, logout, permission, role
  | 'read'          // view, export, download
  | 'other';

export const ACTION_KIND_LABELS: Record<ActionKind, string> = {
  destructive: 'Fshirje',
  suppressive: 'Kufizim',
  modifying: 'Ndryshim',
  additive: 'Shtim / Aprovim',
  access: 'Qasje',
  read: 'Lexim',
  other: 'Tjetër',
};

export const ACTION_KIND_TONES: Record<ActionKind, string> = {
  destructive: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  suppressive: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  modifying: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  additive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  access: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  read: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  other: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

/**
 * Classify an audit entry.
 *
 * Order matters: "delete" beats "approve" when an action string contains both,
 * so the destructive reading wins. Matching is on the action name and the
 * details, because a lot of the log writes the verb into `details` rather than
 * `action`.
 */
export function classifyActionKind(log: AuditLog): ActionKind {
  const hay = `${log.action} ${log.details ?? ''}`.toLowerCase();

  if (/delete|deleted|remove|removed|purge|erase|fshij|fshi|heq/.test(hay)) return 'destructive';
  if (/ban|banned|reject|rejected|hide|hidden|unpublish|deny|denied|suspend|pezull|refuz|fsheh/.test(hay)) return 'suppressive';
  if (/login|logout|signin|sign-in|token|password|role|permission|claim|kyç|fjalëkalim|leje/.test(hay)) return 'access';
  if (/view|read|export|download|print|shiko|lexo/.test(hay)) return 'read';
  if (/create|created|add|added|approve|approved|publish|published|resolve|resolved|shto|krijo|aprov|zgjidh/.test(hay)) return 'additive';
  if (/edit|edited|update|updated|change|changed|set|assign|move|edito|ndrysho|cakto/.test(hay)) return 'modifying';
  return 'other';
}

export interface ActorAuditRow {
  log: AuditLog;
  kind: ActionKind;
}

export interface ActorAuditSummary {
  rows: ActorAuditRow[];
  total: number;
  /** Count per kind, for the header badges. */
  byKind: Record<ActionKind, number>;
  /** Distinct municipalities the actor acted in, inside the window. */
  municipalities: string[];
  /** Earliest and latest entries in the window — the span actually shown. */
  firstAt: string | null;
  lastAt: string | null;
}

/**
 * Does this log belong to this actor?
 *
 * The id is authoritative. The name is a fallback for records written before
 * `userId` existed, and the email last, because an account can be renamed while
 * its history must not move with it.
 */
function belongsTo(log: AuditLog, actorId: string, actorName: string, actorEmail: string): boolean {
  if (actorId && log.userId && log.userId === actorId) return true;
  if (actorEmail && log.userEmail && log.userEmail.toLowerCase() === actorEmail.toLowerCase()) return true;
  if (actorName && log.userName && log.userName === actorName) return true;
  return false;
}

/**
 * Everything one actor did inside a window, newest first.
 *
 * `since` is inclusive and `all` disables it. Entries with an unparseable date
 * are dropped rather than silently treated as "now", which would put corrupt
 * records at the top of the list where they would be read as the latest news.
 */
export function collectActorAudit(
  logs: readonly AuditLog[],
  actor: { id: string; name?: string; email?: string },
  window: AuditWindow
): ActorAuditSummary {
  const now = Date.now();
  const span = WINDOW_MS[window];
  const actorName = actor.name ?? '';
  const actorEmail = actor.email ?? '';

  const rows: ActorAuditRow[] = [];
  const byKind: Record<ActionKind, number> = {
    destructive: 0, suppressive: 0, modifying: 0, additive: 0, access: 0, read: 0, other: 0,
  };
  const municipalities = new Set<string>();
  let firstMs = Number.POSITIVE_INFINITY;
  let lastMs = Number.NEGATIVE_INFINITY;
  let firstAt: string | null = null;
  let lastAt: string | null = null;

  for (const log of logs) {
    if (!belongsTo(log, actor.id, actorName, actorEmail)) continue;

    const at = Date.parse(log.createdAt);
    if (!Number.isFinite(at)) continue;
    if (span !== Number.POSITIVE_INFINITY && at < now - span) continue;

    const kind = classifyActionKind(log);
    rows.push({ log, kind });
    byKind[kind] += 1;

    if (log.municipality) municipalities.add(log.municipality);
    if (at < firstMs) { firstMs = at; firstAt = log.createdAt; }
    if (at > lastMs) { lastMs = at; lastAt = log.createdAt; }
  }

  rows.sort((a, b) => Date.parse(b.log.createdAt) - Date.parse(a.log.createdAt));

  return {
    rows,
    total: rows.length,
    byKind,
    municipalities: [...municipalities].sort(),
    firstAt,
    lastAt,
  };
}

/**
 * Of everything an actor touched, which specific subjects they changed.
 *
 * A supervisor reading a timeline wants to know *what* was affected, not just
 * that an action happened. Report ids are pulled out of the details text — the
 * one place they are reliably recorded — and returned with the count of how
 * many times each was touched, so a subject edited ten times is visible as such.
 */
export function touchedSubjects(summary: ActorAuditSummary): Array<{ id: string; hits: number; lastAt: string }> {
  const seen = new Map<string, { id: string; hits: number; lastAt: string }>();

  for (const { log } of summary.rows) {
    // Report tracking ids look like ZQ-1234 or RPT-abcdef; the pattern is
    // deliberately narrow so a random uppercase token is not mistaken for one.
    const matches = `${log.details ?? ''} ${log.action}`.match(/\b(?:ZQ|RPT)-[A-Za-z0-9-]{3,}\b/g);
    if (!matches) continue;
    for (const id of matches) {
      const current = seen.get(id);
      if (current) {
        current.hits += 1;
        if (Date.parse(log.createdAt) > Date.parse(current.lastAt)) current.lastAt = log.createdAt;
      } else {
        seen.set(id, { id, hits: 1, lastAt: log.createdAt });
      }
    }
  }

  return [...seen.values()].sort((a, b) => b.hits - a.hits || Date.parse(b.lastAt) - Date.parse(a.lastAt));
}

import { WORKFLOWS, isTerminalState, type WorkKind, type WorkPriority } from './definitions';

/**
 * Deadlines and escalation as pure rules.
 *
 * `evaluateEscalations` answers "what should have happened to this item by now?" with a
 * list of events, each with a *key* that is the same every time the question is asked.
 * The server writes each event as a document whose id is that key and treats "already
 * exists" as "already done", so running the check every minute, from two servers, or
 * after a crash never raises the same alert twice and never skips one.
 */
export type EscalationAction = 'notify_supervisor' | 'raise_priority' | 'notify_managers' | 'needs_manager_attention';

export interface LadderRung {
  level: number;
  /** Hours past the deadline at which this rung fires. */
  afterOverdueHours: number;
  action: EscalationAction;
}

export interface SlaConfig {
  /** Hours from creation to the deadline, by priority. */
  dueHours: Record<WorkPriority, number>;
  /** Minutes an item may sit unassigned before the supervisor is told, by priority. */
  unassignedAlertMinutes: Record<WorkPriority, number>;
  /** Hours with no activity before an assigned item counts as stalled, by priority. */
  stalledAfterHours: Record<WorkPriority, number>;
  ladder: readonly LadderRung[];
}

/** Starting values; a manager changes them in the workflow settings. */
export const DEFAULT_SLA: SlaConfig = {
  dueHours: { urgent: 4, high: 24, normal: 72, low: 168 },
  unassignedAlertMinutes: { urgent: 15, high: 60, normal: 240, low: 1440 },
  stalledAfterHours: { urgent: 8, high: 24, normal: 72, low: 168 },
  ladder: [
    { level: 1, afterOverdueHours: 0, action: 'notify_supervisor' },
    { level: 2, afterOverdueHours: 24, action: 'raise_priority' },
    { level: 3, afterOverdueHours: 48, action: 'notify_managers' },
    { level: 4, afterOverdueHours: 96, action: 'needs_manager_attention' },
  ],
};

export function dueAtFor(priority: WorkPriority, createdAtMs: number, config: SlaConfig = DEFAULT_SLA): number {
  return createdAtMs + config.dueHours[priority] * 3_600_000;
}

const ORDER: readonly WorkPriority[] = ['low', 'normal', 'high', 'urgent'];
export function raisePriority(priority: WorkPriority): WorkPriority {
  return ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(priority) + 1)];
}

export interface EscalatableItem {
  id: string;
  kind: WorkKind;
  status: string;
  priority: WorkPriority;
  assigneeUid: string | null;
  createdAtMs: number;
  dueAtMs: number | null;
  lastActivityAtMs: number;
  /** The highest overdue rung already applied. */
  escalationLevel: number;
  /** How many "unassigned too long" alerts were already raised. */
  unassignedAlerts: number;
  /** Which stalled period was last reported (its last-activity time). */
  stalledReportedFor?: number | null;
}

export interface EscalationEvent {
  /** Stable id: the same event always has the same key. */
  key: string;
  type: 'overdue' | 'unassigned' | 'stalled';
  level: number;
  action: EscalationAction | 'alert_supervisor';
  itemId: string;
}

const MAX_UNASSIGNED_ALERTS = 5;

export function evaluateEscalations(item: EscalatableItem, nowMs: number, config: SlaConfig = DEFAULT_SLA): EscalationEvent[] {
  const workflow = WORKFLOWS[item.kind];
  const state = workflow.states[item.status];
  if (!state || isTerminalState(item.kind, item.status)) return [];
  const events: EscalationEvent[] = [];

  // Waiting on someone else (a clarification, a block): the assignee's clock is paused.
  const paused = Boolean(state.waiting);

  // 1. Not picked up.
  if (!item.assigneeUid && item.status === workflow.initial) {
    const everyMs = config.unassignedAlertMinutes[item.priority] * 60_000;
    const due = Math.min(MAX_UNASSIGNED_ALERTS, Math.floor((nowMs - item.createdAtMs) / everyMs));
    for (let n = item.unassignedAlerts + 1; n <= due; n += 1) {
      events.push({ key: `${item.id}:unassigned:${n}`, type: 'unassigned', level: n, action: 'alert_supervisor', itemId: item.id });
    }
  }

  // 2. Past its deadline.
  if (!paused && item.dueAtMs !== null && nowMs > item.dueAtMs) {
    const hoursOver = (nowMs - item.dueAtMs) / 3_600_000;
    for (const rung of config.ladder) {
      if (rung.level > item.escalationLevel && hoursOver >= rung.afterOverdueHours) {
        events.push({ key: `${item.id}:overdue:${rung.level}`, type: 'overdue', level: rung.level, action: rung.action, itemId: item.id });
      }
    }
  }

  // 3. Held but quiet.
  if (!paused && item.assigneeUid && state.active) {
    const quietMs = config.stalledAfterHours[item.priority] * 3_600_000;
    if (nowMs - item.lastActivityAtMs > quietMs && item.stalledReportedFor !== item.lastActivityAtMs) {
      events.push({ key: `${item.id}:stalled:${item.lastActivityAtMs}`, type: 'stalled', level: 1, action: 'notify_supervisor', itemId: item.id });
    }
  }

  return events;
}

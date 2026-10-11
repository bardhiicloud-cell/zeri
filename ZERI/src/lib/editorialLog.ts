/**
 * Append-only log of every editorial action attempted by a municipal account.
 *
 * Two purposes, and the second is the important one:
 *
 *   1. Accountability. A citizen can see that a municipality responded to their
 *      report, when, and with what.
 *   2. Evidence. If a municipality is later accused of pressuring the newsroom —
 *      or the newsroom is accused of ignoring a legitimate correction — the log
 *      is the record. It is append-only by construction: there is no update or
 *      delete function, only `append`.
 *
 * A denial is logged too. Knowing that a municipality *tried* to delete a report
 * and was refused is exactly the event a future dispute would be about, and it
 * would be lost if only successes were recorded.
 */

/** What happened. Mirrors EditorialAction plus the outcome. */
export type EditorialEventKind =
  | 'response_published'
  | 'document_attached'
  | 'correction_requested'
  | 'report_disputed'
  | 'removal_requested'
  | 'work_facts_added'
  | 'request_reviewed'
  | 'action_denied';

export interface EditorialEvent {
  id: string;
  kind: EditorialEventKind;
  /** Report, comment or registry entry the action concerned. */
  subjectId: string;
  subjectType: 'report' | 'comment' | 'health_case' | 'donation' | 'other';
  /** Municipality the acting account represents. */
  actorMunicipality: string;
  actorUserId: string;
  actorEmail: string;
  /** The action that was attempted, e.g. 'delete_report'. */
  attemptedAction: string;
  /** True when the firewall refused it. */
  denied: boolean;
  /** Firewall reason, present when denied. */
  denialReason?: string;
  /** Free-text note, e.g. the correction a municipality is asking for. */
  note?: string;
  /** ISO timestamp, set once and never changed. */
  at: string;
}

/**
 * In-memory mirror for the current session.
 *
 * The durable copy is written to Firestore by the caller; this exists so the UI
 * can render the timeline immediately without a refetch, and so a failure to
 * persist is visible rather than silent.
 */
const session: EditorialEvent[] = [];

let sequence = 0;

function nextId(): string {
  sequence += 1;
  return `ed_${Date.now().toString(36)}_${sequence.toString(36)}`;
}

/**
 * Record an event. There is no corresponding delete or update — deliberately.
 * An editable audit log answers none of the questions an audit log is for.
 */
export function appendEditorialEvent(
  input: Omit<EditorialEvent, 'id' | 'at' | 'denied'> & { denied?: boolean }
): EditorialEvent {
  const event: EditorialEvent = {
    ...input,
    id: nextId(),
    denied: input.denied ?? false,
    at: new Date().toISOString(),
  };
  session.push(event);
  return event;
}

/** Events recorded this session, newest first. */
export function getSessionEvents(): readonly EditorialEvent[] {
  return [...session].reverse();
}

/** Events concerning one subject, newest first — used on the report detail view. */
export function getEventsForSubject(subjectId: string): readonly EditorialEvent[] {
  return session.filter((e) => e.subjectId === subjectId).reverse();
}

/**
 * How many times a municipality was refused a destructive action.
 *
 * Surfaced on the platform's own transparency page rather than hidden: a
 * municipality that repeatedly attempts deletions is information the public is
 * entitled to, and publishing it is the strongest possible disincentive.
 */
export function countDeniedAttempts(municipality?: string): number {
  return session.filter(
    (e) => e.denied && (!municipality || e.actorMunicipality === municipality)
  ).length;
}

/**
 * Moving through a queue of records one by one (Review Mode).
 *
 * The reviewer opens the first record, checks it, acts, and goes to the next
 * without returning to the list. These helpers decide where "next" goes, so the
 * screen stays simple and the rules are testable:
 *
 *  - the list is fixed when the session starts, so the order never shuffles
 *    under the reviewer's hands;
 *  - a record that has been handled (approved, rejected, deleted) is skipped by
 *    "next" but can still be reached with "previous";
 *  - after an action the screen moves forward on its own, wrapping once to
 *    pick up records that were skipped, and ends when nothing is left.
 */

export type Direction = 1 | -1;

/**
 * The index to show next, or null when there is nowhere to go.
 *
 * `skipHandled` is on for moving forward after an action and for "next";
 * "previous" walks back through everything so a decision can be revisited.
 */
export function stepIndex(
  ids: readonly string[],
  handled: ReadonlySet<string>,
  from: number,
  direction: Direction,
  skipHandled = true
): number | null {
  if (ids.length === 0) return null;
  for (let i = from + direction; i >= 0 && i < ids.length; i += direction) {
    if (!skipHandled || !handled.has(ids[i])) return i;
  }
  return null;
}

/**
 * Where to go after the record at `from` has been dealt with: forward first,
 * then wrap to the earliest record not yet handled. Null means the queue is done.
 */
export function advanceAfterAction(ids: readonly string[], handled: ReadonlySet<string>, from: number): number | null {
  const forward = stepIndex(ids, handled, from, 1);
  if (forward !== null) return forward;
  for (let i = 0; i < ids.length; i += 1) {
    if (i !== from && !handled.has(ids[i])) return i;
  }
  return null;
}

export interface ReviewProgress {
  total: number;
  handled: number;
  remaining: number;
  /** 0-100, whole number. */
  percent: number;
}

export function reviewProgress(ids: readonly string[], handled: ReadonlySet<string>): ReviewProgress {
  const done = ids.filter(id => handled.has(id)).length;
  const total = ids.length;
  return { total, handled: done, remaining: total - done, percent: total === 0 ? 100 : Math.round((done / total) * 100) };
}

/** Keep the photo index inside the record's photos after one is removed or the record changes. */
export function clampPhotoIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}

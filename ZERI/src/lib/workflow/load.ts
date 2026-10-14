import { isActiveState, type WorkKind } from './definitions';

/**
 * How a move changes who is carrying how much.
 *
 * A person's load is the weight of the work they hold in an *active* state. Every
 * transition is therefore one subtraction from the old holder (if the old state counted)
 * and one addition to the new one (if the new state counts); the same person on both
 * sides nets out. The server applies exactly these deltas inside the transaction that
 * changes the item, so the counter cannot drift from the work.
 */
export interface LoadMove {
  kind: WorkKind;
  fromStatus: string;
  toStatus: string;
  fromAssignee: string | null;
  toAssignee: string | null;
  weight: number;
}

export function loadDeltas(move: LoadMove): Map<string, number> {
  const deltas = new Map<string, number>();
  const add = (uid: string | null, amount: number) => {
    if (!uid || amount === 0) return;
    deltas.set(uid, (deltas.get(uid) ?? 0) + amount);
  };
  if (move.fromAssignee && isActiveState(move.kind, move.fromStatus)) add(move.fromAssignee, -move.weight);
  if (move.toAssignee && isActiveState(move.kind, move.toStatus)) add(move.toAssignee, move.weight);
  for (const [uid, amount] of [...deltas]) if (amount === 0) deltas.delete(uid);
  return deltas;
}

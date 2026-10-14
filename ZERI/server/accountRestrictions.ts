import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';

/**
 * Whether an account may act in the public debate right now.
 *
 * Two kinds of restriction share the one `isBanned` flag that every write path already
 * checks (the server here, and `isBanned()` in firestore.rules):
 *
 *   ban          `isBanned: true`, no end. Set by the account moderation route, which also
 *                disables the sign-in.
 *   suspension   `isBanned: true` plus `suspendedUntil` (a Timestamp). The person can still
 *                sign in and read; they cannot post, comment, message or record story views
 *                until the end. It lapses on its own: every check below, and the rule, treat
 *                a suspension whose end has passed as no restriction at all, even before the
 *                sweep has cleared the flag.
 *
 * Keeping one flag means no write path can forget the new kind of restriction.
 */
export type RestrictionDoc = { isBanned?: unknown; suspendedUntil?: unknown } | null | undefined;

export function untilMs(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof (value as { toMillis?: unknown }).toMillis === 'function') return (value as Timestamp).toMillis();
  if (value instanceof Date) return value.getTime();
  return null;
}

/** Pure: is this account restricted at `nowMs`? */
export function isRestricted(user: RestrictionDoc, nowMs: number = Date.now()): boolean {
  if (!user || user.isBanned !== true) return false;
  const until = untilMs(user.suspendedUntil);
  return until === null || nowMs < until;
}

/** Pure: a short description of the current restriction, or null. */
export function describeRestriction(user: RestrictionDoc, nowMs: number = Date.now()): { kind: 'ban' | 'suspension'; untilMs: number | null } | null {
  if (!isRestricted(user, nowMs)) return null;
  const until = untilMs(user?.suspendedUntil);
  return until === null ? { kind: 'ban', untilMs: null } : { kind: 'suspension', untilMs: until };
}

/**
 * Clear suspensions whose end has passed, so the account lists stop showing them as
 * restricted. Bounded per run; idempotent (a cleared account no longer matches).
 */
export async function liftExpiredSuspensions(db: Firestore, nowMs: number = Date.now(), max = 200): Promise<number> {
  const due = await db.collection('users')
    .where('isBanned', '==', true)
    .where('suspendedUntil', '<=', Timestamp.fromMillis(nowMs))
    .limit(max)
    .get();
  if (due.empty) return 0;
  const batch = db.batch();
  for (const doc of due.docs) {
    batch.update(doc.ref, { isBanned: false, suspendedUntil: FieldValue.delete(), restriction: FieldValue.delete(), suspensionLiftedAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();
  return due.size;
}

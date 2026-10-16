import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * The single minting point for Track IDs.
 *
 * Every id is first reserved as a document in `trackingIds` with `create()`, which
 * fails when the id exists. Two records can therefore never share an id, and a
 * record gets its id exactly once: the caller stores the id it was handed and
 * never asks for another. The collection is not readable by clients (catch-all
 * rule), so it cannot be used to enumerate ids.
 */
export const TRACKING_REGISTRY = 'trackingIds';

/** `ZQ-YYYYMMDD-<time><random>` - the shape every page has always shown. */
export function formatTrackingId(prefix: string, nowMs: number, randomHex: string): string {
  const day = new Date(nowMs).toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${day}-${nowMs.toString(36).toUpperCase()}${randomHex.toUpperCase()}`;
}

const isAlreadyExists = (error: unknown): boolean => {
  const code = (error as { code?: unknown })?.code;
  return code === 6 || code === 'already-exists' || /ALREADY_EXISTS/i.test(String((error as Error)?.message));
};

export async function reserveTrackingId(
  db: Firestore,
  options: { prefix: string; kind: string; ownerUid: string; nowMs: number; randomHex: () => string }
): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const id = formatTrackingId(options.prefix, options.nowMs, options.randomHex());
    try {
      await db.collection(TRACKING_REGISTRY).doc(id).create({
        kind: options.kind,
        ownerUid: options.ownerUid,
        createdAt: FieldValue.serverTimestamp(),
      });
      return id;
    } catch (error) {
      if (isAlreadyExists(error)) continue;
      throw error;
    }
  }
  throw new Error('Could not reserve a unique tracking id.');
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Short public references (`LJ-`, `DN-`, `ID-`, `SH-` + 8 symbols) for submissions that are
 * not reports. Same guarantee as `reserveTrackingId`: reserved with `create()` in the one
 * registry before the record is written, so it is minted once and never shared.
 */
export async function reserveReference(
  db: Firestore,
  options: { prefix: string; kind: string; ownerUid: string | null; randomBytes: (n: number) => Uint8Array }
): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const bytes = options.randomBytes(8);
    let body = '';
    for (const byte of bytes) body += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
    const id = `${options.prefix}-${body}`;
    try {
      await db.collection(TRACKING_REGISTRY).doc(id).create({
        kind: options.kind,
        ownerUid: options.ownerUid,
        createdAt: FieldValue.serverTimestamp(),
      });
      return id;
    } catch (error) {
      if (isAlreadyExists(error)) continue;
      throw error;
    }
  }
  throw new Error('Could not reserve a unique reference.');
}

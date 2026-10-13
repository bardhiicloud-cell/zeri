import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  ORDER_TTL_DAYS,
  VERIFICATION_DAYS,
  generateOrderCode,
  isOrderExpired,
  settingsFromDoc,
  type PaymentKind,
  type PaymentSettings,
  type PaymentStatus,
  type RandomBytes,
} from './payments';

/**
 * Orders and their fulfilment, against Firestore.
 *
 * Money moves through exactly one function, `confirmOrder`: it runs in a
 * transaction, flips an order from `awaiting` to `paid` once, and applies what the
 * order was for (the tick, an ad package) in the same commit, so an order can never
 * be marked paid without its effect, nor produce the effect twice.
 */

export const ORDERS = 'paymentOrders';

export interface OrderDoc {
  code: string;
  uid: string;
  email: string | null;
  name: string;
  kind: PaymentKind;
  packageId: string | null;
  adRequestId: string | null;
  amountEur: number;
  currency: 'EUR';
  status: PaymentStatus;
  method: 'iban' | 'paysera' | null;
  description: string;
  createdAtMs: number;
  expiresAtMs: number;
  paidAtMs?: number;
  confirmedBy?: string | null;
  bankReference?: string | null;
}

/** What a payer or an admin sees; never the internal fields. */
export function publicOrder(order: OrderDoc, now: number = Date.now()) {
  return {
    code: order.code,
    kind: order.kind,
    packageId: order.packageId,
    amountEur: order.amountEur,
    currency: order.currency,
    status: order.status,
    expired: order.status === 'awaiting' && isOrderExpired(order.createdAtMs, now),
    description: order.description,
    createdAtMs: order.createdAtMs,
    expiresAtMs: order.expiresAtMs,
    paidAtMs: order.paidAtMs ?? null,
    method: order.method,
  };
}

/** Stored in `paymentConfig/main`, a collection the client rules deny entirely (a `settings/*` document would be world-readable). */
export async function loadPaymentSettings(db: Firestore): Promise<PaymentSettings> {
  const snapshot = await db.collection('paymentConfig').doc('main').get();
  return settingsFromDoc(snapshot.exists ? snapshot.data() : undefined);
}

export interface NewOrderInput {
  uid: string;
  email: string | null;
  name: string;
  kind: PaymentKind;
  packageId?: string | null;
  adRequestId?: string | null;
  amountEur: number;
  description: string;
}

/** Create an order under a fresh unique code. The document id *is* the code. */
export async function createOrder(
  db: Firestore,
  input: NewOrderInput,
  now: number = Date.now(),
  rng?: RandomBytes
): Promise<OrderDoc> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateOrderCode(rng);
    const order: OrderDoc = {
      code,
      uid: input.uid,
      email: input.email,
      name: input.name,
      kind: input.kind,
      packageId: input.packageId ?? null,
      adRequestId: input.adRequestId ?? null,
      amountEur: input.amountEur,
      currency: 'EUR',
      status: 'awaiting',
      method: null,
      description: input.description,
      createdAtMs: now,
      expiresAtMs: now + ORDER_TTL_DAYS * 86_400_000,
    };
    try {
      // create() fails when the code already exists, so two orders can never share one.
      await db.collection(ORDERS).doc(code).create({ ...order, createdAt: FieldValue.serverTimestamp() });
      return order;
    } catch (error) {
      const code2 = (error as { code?: unknown }).code;
      if (code2 === 6 || code2 === 'already-exists' || /ALREADY_EXISTS/i.test(String((error as Error)?.message))) continue;
      throw error;
    }
  }
  throw new Error('Nuk u gjenerua dot një kod unik pagese.');
}

export type ConfirmOutcome =
  | { outcome: 'confirmed'; order: OrderDoc }
  | { outcome: 'already_paid'; order: OrderDoc }
  | { outcome: 'cancelled' }
  | { outcome: 'not_found' }
  | { outcome: 'amount_mismatch'; expected: number; received: number };

export interface ConfirmDetails {
  /** Staff uid, or null when the confirmation came from a payment provider. */
  by: string | null;
  method: 'iban' | 'paysera';
  bankReference?: string;
  /** The amount that actually arrived, when known. A different amount is refused unless `acceptAnyAmount`. */
  receivedEur?: number;
  acceptAnyAmount?: boolean;
}

const MONTH_MS = VERIFICATION_DAYS * 86_400_000;

export async function confirmOrder(
  db: Firestore,
  code: string,
  details: ConfirmDetails,
  now: number = Date.now()
): Promise<ConfirmOutcome> {
  const orderRef = db.collection(ORDERS).doc(code);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists) return { outcome: 'not_found' } as ConfirmOutcome;
    const order = snapshot.data() as OrderDoc;

    if (order.status === 'paid') return { outcome: 'already_paid', order } as ConfirmOutcome;
    if (order.status === 'cancelled') return { outcome: 'cancelled' } as ConfirmOutcome;

    if (
      typeof details.receivedEur === 'number' &&
      !details.acceptAnyAmount &&
      Math.abs(details.receivedEur - order.amountEur) >= 0.005
    ) {
      return { outcome: 'amount_mismatch', expected: order.amountEur, received: details.receivedEur } as ConfirmOutcome;
    }

    // Reads first (Firestore requires every read before the first write).
    const userRef = order.kind === 'verification' ? db.collection('users').doc(order.uid) : null;
    const userSnapshot = userRef ? await transaction.get(userRef) : null;
    const requestRef = order.kind === 'verification' ? db.collection('verificationRequests').doc(order.uid) : null;

    transaction.update(orderRef, {
      status: 'paid' as PaymentStatus,
      method: details.method,
      paidAt: FieldValue.serverTimestamp(),
      paidAtMs: now,
      confirmedBy: details.by,
      bankReference: details.bankReference ? details.bankReference.slice(0, 300) : null,
    });

    if (userRef && userSnapshot?.exists) {
      // Renewing early adds a month to the remaining time instead of resetting it.
      const current = userSnapshot.data()?.verifiedUntil;
      const currentMs = typeof current?.toMillis === 'function' ? current.toMillis() : 0;
      const until = Timestamp.fromMillis(Math.max(now, currentMs) + MONTH_MS);
      transaction.update(userRef, { isVerified: true, verifiedUntil: until, verifiedBy: details.by ?? 'paysera' });
    }
    if (requestRef) {
      transaction.set(requestRef, { status: 'approved', decidedAt: FieldValue.serverTimestamp(), decidedBy: details.by, paymentCode: code }, { merge: true });
    }
    if (order.kind === 'ad-package' && order.adRequestId) {
      transaction.set(
        db.collection('adRequests').doc(order.adRequestId),
        { paymentStatus: 'paid', paymentCode: code, paidAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }

    return { outcome: 'confirmed', order: { ...order, status: 'paid', method: details.method, paidAtMs: now } } as ConfirmOutcome;
  });
}

export async function cancelOrder(db: Firestore, code: string, by: string | null, reason: string): Promise<'cancelled' | 'not_found' | 'already_paid'> {
  const ref = db.collection(ORDERS).doc(code);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return 'not_found' as const;
    const status = snapshot.data()?.status;
    if (status === 'paid') return 'already_paid' as const;
    transaction.update(ref, { status: 'cancelled', cancelledBy: by, cancelReason: reason.slice(0, 300), cancelledAt: FieldValue.serverTimestamp() });
    return 'cancelled' as const;
  });
}

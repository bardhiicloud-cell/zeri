import { describe, expect, it } from 'vitest';
import { cancelOrder, confirmOrder, createOrder, publicOrder, type OrderDoc } from '../../server/paymentOrders';
import { isValidOrderCode } from '../../server/payments';

/** A minimal in-memory Firestore: enough for transactions, create(), update(), set({merge}). */
function fakeDb(seed: Record<string, Record<string, any>> = {}) {
  const store = new Map<string, any>();
  for (const [path, value] of Object.entries(seed)) store.set(path, value);

  const ref = (path: string) => ({
    path,
    id: path.split('/').pop()!,
    async get() {
      return snapshot(path);
    },
    async create(data: any) {
      if (store.has(path)) throw Object.assign(new Error('ALREADY_EXISTS'), { code: 6 });
      store.set(path, data);
    },
  });
  const snapshot = (path: string) => ({ exists: store.has(path), id: path.split('/').pop(), data: () => store.get(path) });

  const db: any = {
    collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
    async runTransaction(fn: (tx: any) => Promise<any>) {
      const writes: Array<() => void> = [];
      const tx = {
        get: async (r: any) => snapshot(r.path),
        update: (r: any, data: any) => writes.push(() => store.set(r.path, { ...store.get(r.path), ...data })),
        set: (r: any, data: any, options?: { merge?: boolean }) =>
          writes.push(() => store.set(r.path, options?.merge ? { ...(store.get(r.path) ?? {}), ...data } : data)),
      };
      const result = await fn(tx);
      writes.forEach((w) => w());
      return result;
    },
  };
  return { db, store };
}

const NOW = Date.parse('2026-10-12T12:00:00Z');
const input = { uid: 'u1', email: 'a@b.c', name: 'Arben', kind: 'verification' as const, amountEur: 15.99, description: 'Tick' };

describe('creating orders', () => {
  it('stores the order under its own code and returns it', async () => {
    const { db, store } = fakeDb();
    const order = await createOrder(db, input, NOW);
    expect(isValidOrderCode(order.code)).toBe(true);
    expect(store.get(`paymentOrders/${order.code}`)).toMatchObject({ uid: 'u1', status: 'awaiting', amountEur: 15.99, createdAtMs: NOW });
  });

  it('never reuses a code that exists: it draws again', async () => {
    const { db, store } = fakeDb();
    let calls = 0;
    // the first draw repeats an existing code, the second is new
    const first = await createOrder(db, input, NOW, () => Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
    const rng = (n: number) => (++calls === 1 ? Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) : Uint8Array.from(Array.from({ length: n }, (_, i) => 20 + i)));
    const second = await createOrder(db, input, NOW, rng);
    expect(second.code).not.toBe(first.code);
    expect(store.size).toBe(2);
  });
});

describe('confirming a verification payment', () => {
  const seed = (order: Partial<OrderDoc> = {}, user: any = { name: 'Arben' }) => {
    const base: OrderDoc = {
      code: 'ZQAAAAAAA', uid: 'u1', email: 'a@b.c', name: 'Arben', kind: 'verification', packageId: null, adRequestId: null,
      amountEur: 15.99, currency: 'EUR', status: 'awaiting', method: null, description: 'Tick', createdAtMs: NOW, expiresAtMs: NOW + 1,
      ...order,
    };
    return fakeDb({ [`paymentOrders/${base.code}`]: base, 'users/u1': user });
  };

  it('marks the order paid and switches the tick on for 30 days', async () => {
    const { db, store } = seed();
    const result = await confirmOrder(db, 'ZQAAAAAAA', { by: 'staff1', method: 'iban', bankReference: 'REF 123', receivedEur: 15.99 }, NOW);
    expect(result.outcome).toBe('confirmed');
    expect(store.get('paymentOrders/ZQAAAAAAA')).toMatchObject({ status: 'paid', method: 'iban', confirmedBy: 'staff1', bankReference: 'REF 123', paidAtMs: NOW });
    const user = store.get('users/u1');
    expect(user.isVerified).toBe(true);
    expect(user.verifiedUntil.toMillis()).toBe(NOW + 30 * 86_400_000);
  });

  it('adds a month to a tick that is still running instead of resetting it', async () => {
    const { Timestamp } = await import('firebase-admin/firestore');
    const until = NOW + 10 * 86_400_000;
    const { db, store } = seed({}, { isVerified: true, verifiedUntil: Timestamp.fromMillis(until) });
    await confirmOrder(db, 'ZQAAAAAAA', { by: 's', method: 'iban' }, NOW);
    expect(store.get('users/u1').verifiedUntil.toMillis()).toBe(until + 30 * 86_400_000);
  });

  it('is idempotent: a second confirmation changes nothing', async () => {
    const { db, store } = seed();
    await confirmOrder(db, 'ZQAAAAAAA', { by: 's', method: 'iban' }, NOW);
    const before = JSON.stringify(store.get('users/u1'));
    const again = await confirmOrder(db, 'ZQAAAAAAA', { by: 's2', method: 'iban' }, NOW + 1000);
    expect(again.outcome).toBe('already_paid');
    expect(JSON.stringify(store.get('users/u1'))).toBe(before);
    expect(store.get('paymentOrders/ZQAAAAAAA').confirmedBy).toBe('s');
  });

  it('refuses a different amount unless the admin accepts it', async () => {
    const { db, store } = seed();
    const refused = await confirmOrder(db, 'ZQAAAAAAA', { by: 's', method: 'iban', receivedEur: 10 }, NOW);
    expect(refused).toEqual({ outcome: 'amount_mismatch', expected: 15.99, received: 10 });
    expect(store.get('paymentOrders/ZQAAAAAAA').status).toBe('awaiting');
    expect(store.get('users/u1').isVerified).toBeUndefined();
    const accepted = await confirmOrder(db, 'ZQAAAAAAA', { by: 's', method: 'iban', receivedEur: 10, acceptAnyAmount: true }, NOW);
    expect(accepted.outcome).toBe('confirmed');
  });

  it('reports unknown and cancelled orders', async () => {
    const { db } = seed({ status: 'cancelled' });
    expect((await confirmOrder(db, 'ZQAAAAAAA', { by: 's', method: 'iban' }, NOW)).outcome).toBe('cancelled');
    expect((await confirmOrder(db, 'ZQBBBBBBB', { by: 's', method: 'iban' }, NOW)).outcome).toBe('not_found');
  });

  it('records a provider confirmation with no staff member', async () => {
    const { db, store } = seed();
    await confirmOrder(db, 'ZQAAAAAAA', { by: null, method: 'paysera', bankReference: 'Paysera' }, NOW);
    expect(store.get('paymentOrders/ZQAAAAAAA')).toMatchObject({ confirmedBy: null, method: 'paysera' });
    expect(store.get('users/u1').verifiedBy).toBe('paysera');
  });
});

describe('confirming an ad package', () => {
  it('flags the linked ad request as paid', async () => {
    const order: OrderDoc = {
      code: 'ZQAAAAAAA', uid: 'u1', email: 'a@b.c', name: 'Biznes', kind: 'ad-package', packageId: '1_week', adRequestId: 'req1',
      amountEur: 20, currency: 'EUR', status: 'awaiting', method: null, description: 'Reklamë', createdAtMs: NOW, expiresAtMs: NOW + 1,
    };
    const { db, store } = fakeDb({ 'paymentOrders/ZQAAAAAAA': order, 'adRequests/req1': { status: 'pending', userId: 'u1' } });
    await confirmOrder(db, 'ZQAAAAAAA', { by: 's', method: 'iban', receivedEur: 20 }, NOW);
    expect(store.get('adRequests/req1')).toMatchObject({ status: 'pending', paymentStatus: 'paid', paymentCode: 'ZQAAAAAAA' });
  });
});

describe('cancelling', () => {
  it('cancels an awaiting order but never a paid one', async () => {
    const base = { code: 'ZQAAAAAAA', status: 'awaiting' };
    const a = fakeDb({ 'paymentOrders/ZQAAAAAAA': base });
    expect(await cancelOrder(a.db, 'ZQAAAAAAA', 's', 'gabim')).toBe('cancelled');
    const b = fakeDb({ 'paymentOrders/ZQAAAAAAA': { ...base, status: 'paid' } });
    expect(await cancelOrder(b.db, 'ZQAAAAAAA', 's', '')).toBe('already_paid');
    expect(await cancelOrder(b.db, 'ZQNOPE', 's', '')).toBe('not_found');
  });
});

describe('public shape', () => {
  it('hides the payer e-mail and uid, and flags expiry', () => {
    const order: OrderDoc = {
      code: 'ZQAAAAAAA', uid: 'u1', email: 'secret@x.y', name: 'A', kind: 'verification', packageId: null, adRequestId: null, amountEur: 15.99,
      currency: 'EUR', status: 'awaiting', method: null, description: 'Tick', createdAtMs: NOW - 20 * 86_400_000, expiresAtMs: NOW - 6 * 86_400_000,
    };
    const shown = publicOrder(order, NOW);
    expect(JSON.stringify(shown)).not.toContain('secret@x.y');
    expect(shown).not.toHaveProperty('uid');
    expect(shown.expired).toBe(true);
  });
});

import type { Express, Request, RequestHandler, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import {
  ORDERS,
  cancelOrder,
  confirmOrder,
  createOrder,
  loadPaymentSettings,
  publicOrder,
  type OrderDoc,
} from './paymentOrders';
import {
  buildPayseraUrl,
  extractCodes,
  isValidOrderCode,
  matchStatement,
  parsePaymentSettings,
  payseraConfigFromEnv,
  payseraPaymentIsValid,
  priceFor,
  verifyPayseraCallback,
  type MatchableOrder,
  type PayseraConfig,
  type PaymentKind,
} from './payments';

/**
 * Payment endpoints.
 *
 *   citizen   POST /api/v1/payments/orders            create an order, get the code + IBAN
 *             GET  /api/v1/payments/orders/mine       my orders
 *             GET  /api/v1/payments/config            prices and which methods are on
 *             POST /api/v1/payments/orders/:code/paysera   redirect URL for Paysera
 *   Paysera   GET|POST /api/v1/payments/paysera/callback   signed notification
 *   debate admin (section `debate`)
 *             GET  /api/v1/debate/payments            orders + totals
 *             POST /api/v1/debate/payments/:code/confirm | /cancel
 *             POST /api/v1/debate/payments/statement          match a pasted bank statement
 *             POST /api/v1/debate/payments/statement/apply    confirm the matched lines
 *             GET|PUT /api/v1/debate/payments/settings        IBAN, beneficiary, prices
 *
 * Every confirmation is audited under the staff member's own account.
 */

export interface PaymentRouteDeps {
  requireAuth: RequestHandler;
  requireDebateSection: RequestHandler;
  db: () => Firestore;
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
  payseraConfig?: () => PayseraConfig | null;
}

const KIND_LABEL: Record<PaymentKind, string> = {
  verification: 'Verifikimi i llogarisë (1 muaj)',
  'ad-package': 'Paketë reklamimi në Debatin Publik',
};

function baseUrl(req: Request): string {
  const configured = process.env.APP_URL;
  if (configured && /^https?:\/\//i.test(configured)) return configured.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

const clip = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

export function registerPaymentRoutes(app: Express, deps: PaymentRouteDeps): void {
  const paysera = deps.payseraConfig ?? (() => payseraConfigFromEnv());

  /* ---------------------------------------------------------------- citizen */

  app.get('/api/v1/payments/config', deps.requireAuth, async (_req, res: Response) => {
    try {
      const settings = await loadPaymentSettings(deps.db());
      return res.json({
        verificationPriceEur: settings.verificationPriceEur,
        adPackagePrices: settings.adPackagePrices,
        methods: { iban: Boolean(settings.iban), paysera: Boolean(paysera()) },
      });
    } catch (error) {
      console.error('[PAY] config failed:', error?.message);
      return res.status(500).json({ error: 'Cilësimet e pagesës nuk u ngarkuan.' });
    }
  });

  app.post('/api/v1/payments/orders', deps.requireAuth, async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!user.email) return res.status(403).json({ error: 'Regjistrohuni me një llogari për të bërë një pagesë.' });

    const kind = req.body?.kind as PaymentKind;
    if (kind !== 'verification' && kind !== 'ad-package') return res.status(400).json({ error: 'Lloji i pagesës nuk njihet.' });
    const packageId = kind === 'ad-package' ? clip(req.body?.packageId, 40) : '';
    const adRequestId = kind === 'ad-package' ? clip(req.body?.adRequestId, 128) : '';
    if (adRequestId.includes('/')) return res.status(400).json({ error: 'Kërkesa e reklamës nuk është e vlefshme.' });

    try {
      const db = deps.db();
      const settings = await loadPaymentSettings(db);
      if (!settings.iban && !paysera()) {
        return res.status(503).json({ error: 'Pagesat nuk janë konfiguruar ende. Kontaktoni ekipin.' });
      }
      const price = priceFor(settings, kind, packageId || undefined);
      if (price === null) return res.status(409).json({ error: 'Çmimi për këtë shërbim nuk është caktuar ende.' });

      const profile = await db.collection('users').doc(user.uid).get();
      if (kind === 'verification' && profile.data()?.isVerified === true) {
        return res.status(409).json({ error: 'Llogaria juaj është tashmë e verifikuar. Rinovimi hapet kur t’i afrohet skadimi.' });
      }
      if (kind === 'ad-package' && adRequestId) {
        const request = await db.collection('adRequests').doc(adRequestId).get();
        if (!request.exists || request.data()?.userId !== user.uid) {
          return res.status(403).json({ error: 'Kjo kërkesë reklame nuk është e juaja.' });
        }
      }

      // One open order per (account, thing): asking twice returns the same code,
      // so a payer never has two codes for the same purchase.
      const existing = await db.collection(ORDERS).where('uid', '==', user.uid).where('status', '==', 'awaiting').limit(20).get();
      const open = existing.docs
        .map((doc) => doc.data() as OrderDoc)
        .find((o) => o.kind === kind && (o.packageId ?? '') === packageId && o.amountEur === price);

      const order =
        open ??
        (await createOrder(db, {
          uid: user.uid,
          email: user.email ?? null,
          name: clip(profile.data()?.name, 120),
          kind,
          packageId: packageId || null,
          adRequestId: adRequestId || null,
          amountEur: price,
          description: kind === 'ad-package' ? `${KIND_LABEL[kind]} (${packageId})` : KIND_LABEL[kind],
        }));

      deps.audit('payment.order.create', req, { code: order.code, kind, amountEur: price, reused: Boolean(open) });
      return res.status(open ? 200 : 201).json({
        order: publicOrder(order),
        bank: settings.iban
          ? { iban: settings.iban, beneficiary: settings.beneficiary, bank: settings.bank, bic: settings.bic, note: settings.note }
          : null,
        payseraEnabled: Boolean(paysera()),
      });
    } catch (error) {
      console.error('[PAY] create order failed:', error?.message);
      return res.status(500).json({ error: 'Kodi i pagesës nuk u krijua. Provoni përsëri.' });
    }
  });

  app.get('/api/v1/payments/orders/mine', deps.requireAuth, async (req: Request, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const snapshot = await deps.db().collection(ORDERS).where('uid', '==', uid).limit(50).get();
      const orders = snapshot.docs
        .map((doc) => doc.data() as OrderDoc)
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
        .map((order) => publicOrder(order));
      const settings = await loadPaymentSettings(deps.db());
      return res.json({
        orders,
        bank: settings.iban ? { iban: settings.iban, beneficiary: settings.beneficiary, bank: settings.bank, bic: settings.bic, note: settings.note } : null,
      });
    } catch (error) {
      console.error('[PAY] my orders failed:', error?.message);
      return res.status(500).json({ error: 'Pagesat nuk u ngarkuan.' });
    }
  });

  app.post('/api/v1/payments/orders/:code/paysera', deps.requireAuth, async (req: Request, res: Response) => {
    const config = paysera();
    if (!config) return res.status(503).json({ error: 'Paysera nuk është aktivizuar.' });
    const code = String(req.params.code ?? '').toUpperCase();
    if (!isValidOrderCode(code)) return res.status(400).json({ error: 'Kodi nuk është i vlefshëm.' });

    try {
      const snapshot = await deps.db().collection(ORDERS).doc(code).get();
      const order = snapshot.data() as OrderDoc | undefined;
      if (!order || order.uid !== req.user?.uid) return res.status(404).json({ error: 'Pagesa nuk u gjet.' });
      if (order.status !== 'awaiting') return res.status(409).json({ error: 'Kjo pagesë nuk është më në pritje.' });

      const base = baseUrl(req);
      const url = buildPayseraUrl(
        config,
        { code, amountEur: order.amountEur, description: order.description, email: order.email ?? undefined },
        {
          accept: `${base}/forum?payment=ok&code=${code}`,
          cancel: `${base}/forum?payment=cancelled&code=${code}`,
          callback: `${base}/api/v1/payments/paysera/callback`,
        }
      );
      return res.json({ url });
    } catch (error) {
      console.error('[PAY] paysera url failed:', error?.message);
      return res.status(500).json({ error: 'Lidhja me Paysera dështoi.' });
    }
  });

  /* ---------------------------------------------------------------- Paysera */

  const payseraCallback: RequestHandler = async (req: Request, res: Response) => {
    const config = paysera();
    if (!config) return res.status(503).type('text').send('disabled');
    const source = { ...(req.query as Record<string, unknown>), ...((req.body as Record<string, unknown>) ?? {}) };
    const verified = verifyPayseraCallback({ data: source.data, ss1: source.ss1 }, config.signPassword);
    if (verified.outcome === 'invalid') {
      console.warn('[PAY] paysera callback refused:', verified.reason);
      return res.status(400).type('text').send('invalid');
    }
    // status 2 = accepted but not executed yet: nothing to do, ask Paysera to stop retrying.
    if (verified.status !== '1') return res.type('text').send('OK');

    try {
      const snapshot = await deps.db().collection(ORDERS).doc(verified.code).get();
      const order = snapshot.data() as OrderDoc | undefined;
      if (!order) return res.status(404).type('text').send('unknown order');
      if (!payseraPaymentIsValid(verified, order)) {
        console.warn('[PAY] paysera amount/currency mismatch for', verified.code);
        return res.status(400).type('text').send('amount mismatch');
      }
      const outcome = await confirmOrder(deps.db(), verified.code, { by: null, method: 'paysera', bankReference: 'Paysera' });
      deps.audit('payment.paysera.confirmed', req, { code: verified.code, outcome: outcome.outcome });
      return res.type('text').send('OK');
    } catch (error) {
      console.error('[PAY] paysera callback failed:', error?.message);
      return res.status(500).type('text').send('error');
    }
  };
  app.get('/api/v1/payments/paysera/callback', payseraCallback);
  app.post('/api/v1/payments/paysera/callback', payseraCallback);

  /* ------------------------------------------------------------ debate admin */

  app.get('/api/v1/debate/payments', deps.requireAuth, deps.requireDebateSection, async (req: Request, res: Response) => {
    const status = String(req.query.status ?? 'all');
    try {
      let query: FirebaseFirestore.Query = deps.db().collection(ORDERS);
      if (['awaiting', 'paid', 'cancelled'].includes(status)) query = query.where('status', '==', status);
      const snapshot = await query.limit(500).get();
      const now = Date.now();
      const all = snapshot.docs.map((doc) => doc.data() as OrderDoc).sort((a, b) => b.createdAtMs - a.createdAtMs);
      const totals = { awaiting: { count: 0, sumEur: 0 }, paid: { count: 0, sumEur: 0 }, cancelled: { count: 0, sumEur: 0 } };
      for (const order of all) {
        totals[order.status].count += 1;
        totals[order.status].sumEur = Math.round((totals[order.status].sumEur + order.amountEur) * 100) / 100;
      }
      return res.json({
        // Name is shown so the admin can read the statement against a person; the e-mail stays server-side.
        orders: all.slice(0, 300).map((order) => ({ ...publicOrder(order, now), name: order.name, confirmedBy: order.confirmedBy ?? null })),
        totals,
      });
    } catch (error) {
      console.error('[DEBATE] payments list failed:', error?.message);
      return res.status(500).json({ error: 'Pagesat nuk u ngarkuan.' });
    }
  });

  app.post('/api/v1/debate/payments/:code/confirm', deps.requireAuth, deps.requireDebateSection, async (req: Request, res: Response) => {
    const code = String(req.params.code ?? '').toUpperCase();
    if (!isValidOrderCode(code)) return res.status(400).json({ error: 'Kodi nuk është i vlefshëm.' });
    const receivedRaw = req.body?.amountEur;
    const received = receivedRaw === undefined || receivedRaw === '' ? undefined : Number(receivedRaw);
    if (received !== undefined && !Number.isFinite(received)) return res.status(400).json({ error: 'Shuma nuk është e vlefshme.' });

    try {
      const outcome = await confirmOrder(deps.db(), code, {
        by: req.user?.uid ?? null,
        method: 'iban',
        bankReference: clip(req.body?.bankReference, 300),
        receivedEur: received,
        acceptAnyAmount: req.body?.acceptAnyAmount === true,
      });
      deps.audit('payment.confirm', req, { code, outcome: outcome.outcome });
      switch (outcome.outcome) {
        case 'confirmed': return res.json({ ok: true, order: publicOrder(outcome.order) });
        case 'already_paid': return res.status(409).json({ error: 'Kjo pagesë është konfirmuar tashmë.' });
        case 'cancelled': return res.status(409).json({ error: 'Kjo pagesë është anuluar.' });
        case 'not_found': return res.status(404).json({ error: 'Kodi nuk u gjet.' });
        case 'amount_mismatch':
          return res.status(409).json({ error: `Shuma ${outcome.received.toFixed(2)} € nuk përputhet me ${outcome.expected.toFixed(2)} €. Konfirmojeni vetëm nëse e pranoni diferencën.`, expected: outcome.expected });
      }
    } catch (error) {
      console.error('[DEBATE] confirm failed:', error?.message);
      return res.status(500).json({ error: 'Konfirmimi nuk u ruajt.' });
    }
  });

  app.post('/api/v1/debate/payments/:code/cancel', deps.requireAuth, deps.requireDebateSection, async (req: Request, res: Response) => {
    const code = String(req.params.code ?? '').toUpperCase();
    if (!isValidOrderCode(code)) return res.status(400).json({ error: 'Kodi nuk është i vlefshëm.' });
    try {
      const result = await cancelOrder(deps.db(), code, req.user?.uid ?? null, clip(req.body?.reason, 300));
      deps.audit('payment.cancel', req, { code, result });
      if (result === 'not_found') return res.status(404).json({ error: 'Kodi nuk u gjet.' });
      if (result === 'already_paid') return res.status(409).json({ error: 'Pagesa është konfirmuar; nuk anulohet.' });
      return res.json({ ok: true });
    } catch (error) {
      console.error('[DEBATE] cancel failed:', error?.message);
      return res.status(500).json({ error: 'Anulimi nuk u ruajt.' });
    }
  });

  /** Read the orders a statement mentions: one batched read, not a scan. */
  async function ordersForText(text: string): Promise<Map<string, MatchableOrder & { name: string; kind: PaymentKind }>> {
    const codes = extractCodes(text).slice(0, 400);
    const map = new Map<string, MatchableOrder & { name: string; kind: PaymentKind }>();
    if (codes.length === 0) return map;
    const refs = codes.map((code) => deps.db().collection(ORDERS).doc(code));
    for (let i = 0; i < refs.length; i += 100) {
      const snaps = await deps.db().getAll(...refs.slice(i, i + 100));
      for (const snap of snaps) {
        if (!snap.exists) continue;
        const order = snap.data() as OrderDoc;
        map.set(order.code, { code: order.code, amountEur: order.amountEur, status: order.status, name: order.name, kind: order.kind });
      }
    }
    return map;
  }

  app.post('/api/v1/debate/payments/statement', deps.requireAuth, deps.requireDebateSection, async (req: Request, res: Response) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    if (!text.trim()) return res.status(400).json({ error: 'Ngjitni pasqyrën bankare ose skedarin CSV.' });
    if (text.length > 400_000) return res.status(413).json({ error: 'Pasqyra është shumë e gjatë (maksimumi 400 000 shenja).' });
    try {
      const orders = await ordersForText(text);
      const entries = matchStatement(text, orders).map((entry) => ({
        ...entry,
        name: orders.get(entry.code)?.name ?? null,
        kind: orders.get(entry.code)?.kind ?? null,
      }));
      return res.json({ entries, summary: { lines: entries.length, matched: entries.filter((e) => e.outcome === 'match').length } });
    } catch (error) {
      console.error('[DEBATE] statement failed:', error?.message);
      return res.status(500).json({ error: 'Pasqyra nuk u analizua.' });
    }
  });

  app.post('/api/v1/debate/payments/statement/apply', deps.requireAuth, deps.requireDebateSection, async (req: Request, res: Response) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const wanted = new Set<string>((Array.isArray(req.body?.codes) ? req.body.codes : []).map((c: unknown) => String(c).toUpperCase()));
    if (!text.trim() || wanted.size === 0) return res.status(400).json({ error: 'Zgjidhni të paktën një pagesë.' });
    if (text.length > 400_000) return res.status(413).json({ error: 'Pasqyra është shumë e gjatë.' });

    try {
      // The server re-reads the statement itself: a client cannot claim a match it does not have.
      const orders = await ordersForText(text);
      const entries = matchStatement(text, orders).filter((entry) => wanted.has(entry.code));
      const results: Array<{ code: string; result: string }> = [];
      for (const entry of entries) {
        if (entry.outcome !== 'match') {
          results.push({ code: entry.code, result: entry.outcome });
          continue;
        }
        const outcome = await confirmOrder(deps.db(), entry.code, {
          by: req.user?.uid ?? null,
          method: 'iban',
          bankReference: entry.line,
          receivedEur: entry.amounts.find((a) => Math.abs(a - (entry.orderAmountEur ?? -1)) < 0.005),
        });
        results.push({ code: entry.code, result: outcome.outcome });
      }
      deps.audit('payment.statement.apply', req, { requested: wanted.size, confirmed: results.filter((r) => r.result === 'confirmed').length });
      return res.json({ results });
    } catch (error) {
      console.error('[DEBATE] statement apply failed:', error?.message);
      return res.status(500).json({ error: 'Konfirmimet nuk u ruajtën.' });
    }
  });

  app.get('/api/v1/debate/payments/settings', deps.requireAuth, deps.requireDebateSection, async (_req, res: Response) => {
    try {
      const settings = await loadPaymentSettings(deps.db());
      return res.json({ settings, paysera: { enabled: Boolean(paysera()), test: paysera()?.test ?? false } });
    } catch (error) {
      console.error('[DEBATE] settings failed:', error?.message);
      return res.status(500).json({ error: 'Cilësimet nuk u ngarkuan.' });
    }
  });

  app.put('/api/v1/debate/payments/settings', deps.requireAuth, deps.requireDebateSection, async (req: Request, res: Response) => {
    const decision = parsePaymentSettings(req.body);
    if (decision.outcome === 'invalid') return res.status(400).json({ error: decision.error });
    try {
      await deps.db().collection('paymentConfig').doc('main').set(decision.settings);
      deps.audit('payment.settings.update', req, { ibanSet: Boolean(decision.settings.iban), verificationPriceEur: decision.settings.verificationPriceEur });
      return res.json({ ok: true, settings: decision.settings });
    } catch (error) {
      console.error('[DEBATE] settings save failed:', error?.message);
      return res.status(500).json({ error: 'Cilësimet nuk u ruajtën.' });
    }
  });
}

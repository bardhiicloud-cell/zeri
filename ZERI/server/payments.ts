import { createHash, randomBytes } from 'node:crypto';

/**
 * Payment codes, bank-statement matching and the Paysera protocol, as pure
 * functions.
 *
 * ─── How a bank-transfer payment works here ──────────────────────────────────
 *
 *   1. The citizen asks to pay for something (the verification tick, an ad
 *      package). The server creates an *order* with a unique code, e.g. ZQK7M3P9X.
 *   2. The citizen sends the amount to the platform's IBAN and writes the code in
 *      the payment reference ("Përshkrimi / Reference").
 *   3. The code is how the money is recognised. The Debate admin pastes the bank
 *      statement (or its CSV); every line that contains a valid code is matched to
 *      its order and the amount is compared. Confirming an order fulfils it.
 *
 * The code carries a check character, so a mistyped code (one wrong letter) is
 * rejected instead of silently matching somebody else's order, and the alphabet
 * leaves out 0/O/1/I/L so a code read from a phone screen is hard to get wrong.
 *
 * Nothing in this file talks to a bank. Banks in Kosovo (Raiffeisen, NLB, TEB,
 * ProCredit …) are matched through their statement export; Paysera, which has a
 * public checkout and callback protocol, is implemented at the bottom.
 */

export const CODE_PREFIX = 'ZQ';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 31 symbols: no I, L, O, 0, 1
const BODY_LENGTH = 6;
const CODE_PATTERN = new RegExp(`${CODE_PREFIX}[${ALPHABET}]{${BODY_LENGTH + 1}}`, 'g');

export type RandomBytes = (size: number) => Uint8Array;

function checkChar(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += (i + 1) * ALPHABET.indexOf(body[i]);
  return ALPHABET[sum % ALPHABET.length];
}

/** A new code: prefix + 6 random symbols + 1 check symbol (9 characters). */
export function generateOrderCode(rng: RandomBytes = randomBytes): string {
  // Rejection sampling keeps every symbol equally likely.
  const limit = 256 - (256 % ALPHABET.length);
  let body = '';
  while (body.length < BODY_LENGTH) {
    for (const byte of rng(BODY_LENGTH * 2)) {
      if (byte < limit && body.length < BODY_LENGTH) body += ALPHABET[byte % ALPHABET.length];
    }
  }
  return CODE_PREFIX + body + checkChar(body);
}

export function isValidOrderCode(code: unknown): code is string {
  if (typeof code !== 'string') return false;
  const upper = code.trim().toUpperCase();
  if (upper.length !== CODE_PREFIX.length + BODY_LENGTH + 1) return false;
  if (!upper.startsWith(CODE_PREFIX)) return false;
  const body = upper.slice(CODE_PREFIX.length, -1);
  if ([...body].some((ch) => ALPHABET.indexOf(ch) < 0)) return false;
  return checkChar(body) === upper[upper.length - 1];
}

/**
 * Every valid order code found in free text (a statement line, a reference).
 * Banks and people insert spaces and dashes ("ZQ-K7M3 P9X"), so a second pass runs
 * over the text with separators removed.
 */
export function extractCodes(text: string): string[] {
  const found = new Set<string>();
  const scan = (source: string) => {
    for (const match of source.toUpperCase().matchAll(CODE_PATTERN)) {
      if (isValidOrderCode(match[0])) found.add(match[0]);
    }
  };
  scan(text);
  scan(text.replace(/[\s\-_./]+/g, ''));
  return [...found];
}

/* ------------------------------------------------------------------ IBAN */

export { formatIban, isValidIban, normalizeIban } from '../src/lib/iban';
import { isValidIban, normalizeIban } from '../src/lib/iban';

/* --------------------------------------------------------------- amounts */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "1.234,56", "1,234.56", "15.99", "15,99" → number; null when it is not an amount. */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  const decimalAt = Math.max(lastDot, lastComma);
  if (decimalAt < 0 || cleaned.length - decimalAt - 1 !== 2) return null;
  const whole = cleaned.slice(0, decimalAt).replace(/[.,]/g, '');
  const fraction = cleaned.slice(decimalAt + 1);
  const value = Number(`${whole || '0'}.${fraction}`);
  return Number.isFinite(value) ? round2(value) : null;
}

/** Every monetary amount that appears in a line of text. */
export function extractAmounts(line: string): number[] {
  const out: number[] = [];
  // `(?![\d]|[.,]\d)` keeps dates ("12.10.2026") from being read as 12,10.
  for (const match of line.matchAll(/(?<![\d.,])\d{1,3}(?:[.,]\d{3})*[.,]\d{2}(?!\d|[.,]\d)|(?<![\d.,])\d+[.,]\d{2}(?!\d|[.,]\d)/g)) {
    const value = parseAmount(match[0]);
    if (value !== null) out.push(value);
  }
  return out;
}

/* ------------------------------------------------------ statement matching */

export type StatementOutcome =
  | 'match'            // code found, order awaiting, amount equals
  | 'amount_mismatch'  // code found, order awaiting, but no amount on the line equals the price
  | 'amount_unknown'   // code found, order awaiting, the line has no amount at all
  | 'already_paid'     // code belongs to an order that is already paid
  | 'cancelled'        // order was cancelled
  | 'unknown_code';    // valid-looking code with no order

export interface StatementEntry {
  line: string;
  code: string;
  amounts: number[];
  outcome: StatementOutcome;
  orderAmountEur?: number;
}

export interface MatchableOrder {
  code: string;
  amountEur: number;
  status: 'awaiting' | 'paid' | 'cancelled';
}

/** Read a pasted statement / CSV: one entry per (line, code). Lines without a code are ignored. */
export function matchStatement(text: string, orders: ReadonlyMap<string, MatchableOrder>): StatementEntry[] {
  const entries: StatementEntry[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const amounts = extractAmounts(trimmed);
    for (const code of extractCodes(trimmed)) {
      if (seen.has(code)) continue; // the same transfer is often printed on two lines
      seen.add(code);
      const order = orders.get(code);
      let outcome: StatementOutcome;
      if (!order) outcome = 'unknown_code';
      else if (order.status === 'paid') outcome = 'already_paid';
      else if (order.status === 'cancelled') outcome = 'cancelled';
      else if (amounts.length === 0) outcome = 'amount_unknown';
      else outcome = amounts.some((a) => Math.abs(a - order.amountEur) < 0.005) ? 'match' : 'amount_mismatch';
      entries.push({ line: trimmed.slice(0, 300), code, amounts, outcome, orderAmountEur: order?.amountEur });
    }
  }
  return entries;
}

/* ---------------------------------------------------------- order lifecycle */

export type PaymentKind = 'verification' | 'ad-package';
export type PaymentStatus = 'awaiting' | 'paid' | 'cancelled';
export const ORDER_TTL_DAYS = 14;
export const VERIFICATION_DAYS = 30;

/** An order that has waited past its window. It stays confirmable: late money is still money. */
export function isOrderExpired(createdAtMs: number | null | undefined, now: number = Date.now()): boolean {
  return typeof createdAtMs === 'number' && now - createdAtMs > ORDER_TTL_DAYS * 86_400_000;
}

export interface PaymentSettings {
  iban: string;
  beneficiary: string;
  bank: string;
  bic: string;
  /** Free text appended to the payer's instructions (e.g. "Pagesa brenda 3 ditëve"). */
  note: string;
  verificationPriceEur: number | null;
  /** Ad package id → price. A package without a price cannot be ordered. */
  adPackagePrices: Record<string, number>;
}

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  iban: '',
  beneficiary: '',
  bank: '',
  bic: '',
  note: '',
  verificationPriceEur: 15.99,
  adPackagePrices: {},
};

const clip = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

export type SettingsDecision =
  | { outcome: 'ok'; settings: PaymentSettings }
  | { outcome: 'invalid'; error: string };

/** Validate an admin's edit of the payment settings. Pure. */
export function parsePaymentSettings(input: any): SettingsDecision {
  const iban = input?.iban ? normalizeIban(String(input.iban)) : '';
  if (iban && !isValidIban(iban)) return { outcome: 'invalid', error: 'IBAN-i nuk është i vlefshëm (kontrolli mod-97 dështoi).' };

  const price = (value: unknown): number | null | 'bad' => {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 10000) return 'bad';
    return round2(n);
  };

  const verification = price(input?.verificationPriceEur);
  if (verification === 'bad') return { outcome: 'invalid', error: 'Çmimi i verifikimit nuk është i vlefshëm.' };

  const adPackagePrices: Record<string, number> = {};
  for (const [id, value] of Object.entries(input?.adPackagePrices ?? {})) {
    if (!/^[a-z0-9_]{1,40}$/.test(id)) return { outcome: 'invalid', error: 'Paketa e reklamës nuk njihet.' };
    const parsed = price(value);
    if (parsed === 'bad') return { outcome: 'invalid', error: `Çmimi i paketës ${id} nuk është i vlefshëm.` };
    if (parsed !== null) adPackagePrices[id] = parsed;
  }

  return {
    outcome: 'ok',
    settings: {
      iban,
      beneficiary: clip(input?.beneficiary, 120),
      bank: clip(input?.bank, 80),
      bic: clip(input?.bic, 20).toUpperCase(),
      note: clip(input?.note, 300),
      verificationPriceEur: verification,
      adPackagePrices,
    },
  };
}

/** Merge a stored document over the defaults, tolerating missing or odd fields. */
export function settingsFromDoc(data: any): PaymentSettings {
  const base = { ...DEFAULT_PAYMENT_SETTINGS };
  if (!data || typeof data !== 'object') return base;
  const verification = data.verificationPriceEur;
  return {
    iban: typeof data.iban === 'string' ? data.iban : '',
    beneficiary: typeof data.beneficiary === 'string' ? data.beneficiary : '',
    bank: typeof data.bank === 'string' ? data.bank : '',
    bic: typeof data.bic === 'string' ? data.bic : '',
    note: typeof data.note === 'string' ? data.note : '',
    verificationPriceEur:
      verification === null ? null : typeof verification === 'number' && Number.isFinite(verification) ? verification : base.verificationPriceEur,
    adPackagePrices: data.adPackagePrices && typeof data.adPackagePrices === 'object' ? { ...data.adPackagePrices } : {},
  };
}

export function priceFor(settings: PaymentSettings, kind: PaymentKind, packageId?: string): number | null {
  if (kind === 'verification') return settings.verificationPriceEur;
  const price = packageId ? settings.adPackagePrices[packageId] : undefined;
  return typeof price === 'number' ? price : null;
}

/* ------------------------------------------------------------------ Paysera */

/**
 * Paysera "Checkout" (a.k.a. WebToPay) as documented by Paysera:
 *
 *   data = base64url(querystring(params))          // '+' → '-', '/' → '_'
 *   sign = md5(data + signPassword)
 *   pay  → https://www.paysera.com/pay/?data=…&sign=…
 *
 * and the callback to `callbackurl` carries `data` and `ss1 = md5(data +
 * signPassword)`; the merchant answers with the text `OK`. `status` is 1 when the
 * payment was made, 0 when it was not, 2 when it was accepted but not yet executed.
 *
 * The project id and sign password come from the Paysera project settings and live
 * in environment variables; with them unset the integration is simply off. Run a
 * `test=1` payment from Paysera's test mode before relying on it: this code follows
 * the published protocol but has not been exercised against a live Paysera project.
 */
export const PAYSERA_PAY_URL = 'https://www.paysera.com/pay/';

const md5 = (value: string) => createHash('md5').update(value).digest('hex');
const toBase64Url = (value: string) => Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
const fromBase64Url = (value: string) => Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

export interface PayseraConfig {
  projectId: string;
  signPassword: string;
  test: boolean;
}

export function payseraConfigFromEnv(env: Record<string, string | undefined> = process.env): PayseraConfig | null {
  const projectId = env.PAYSERA_PROJECT_ID?.trim();
  const signPassword = env.PAYSERA_SIGN_PASSWORD?.trim();
  if (!projectId || !signPassword) return null;
  return { projectId, signPassword, test: env.PAYSERA_TEST === '1' || env.PAYSERA_TEST === 'true' };
}

export interface PayseraOrder {
  code: string;
  amountEur: number;
  description: string;
  email?: string;
}

export function buildPayseraUrl(
  config: PayseraConfig,
  order: PayseraOrder,
  urls: { accept: string; cancel: string; callback: string }
): string {
  const params: Record<string, string> = {
    projectid: config.projectId,
    orderid: order.code,
    accepturl: urls.accept,
    cancelurl: urls.cancel,
    callbackurl: urls.callback,
    version: '1.6',
    amount: String(Math.round(order.amountEur * 100)), // cents
    currency: 'EUR',
    paytext: order.description.slice(0, 255),
  };
  if (order.email) params.p_email = order.email;
  if (config.test) params.test = '1';

  const data = toBase64Url(new URLSearchParams(params).toString());
  const sign = md5(data + config.signPassword);
  return `${PAYSERA_PAY_URL}?data=${encodeURIComponent(data)}&sign=${sign}`;
}

export type PayseraCallbackResult =
  | { outcome: 'ok'; code: string; status: string; amountCents: number | null; currency: string }
  | { outcome: 'invalid'; reason: string };

/** Verify a Paysera callback's signature and read its fields. */
export function verifyPayseraCallback(query: { data?: unknown; ss1?: unknown }, signPassword: string): PayseraCallbackResult {
  const data = typeof query.data === 'string' ? query.data : '';
  const ss1 = typeof query.ss1 === 'string' ? query.ss1 : '';
  if (!data || !ss1) return { outcome: 'invalid', reason: 'missing data or signature' };
  if (md5(data + signPassword) !== ss1.toLowerCase()) return { outcome: 'invalid', reason: 'signature mismatch' };

  const params = new URLSearchParams(fromBase64Url(data));
  const code = String(params.get('orderid') ?? '').toUpperCase();
  if (!isValidOrderCode(code)) return { outcome: 'invalid', reason: 'unknown order id' };
  const amount = Number(params.get('amount'));
  return {
    outcome: 'ok',
    code,
    status: String(params.get('status') ?? ''),
    amountCents: Number.isFinite(amount) ? amount : null,
    currency: String(params.get('currency') ?? '').toUpperCase(),
  };
}

/** A completed payment from Paysera: status 1, in EUR, for exactly the order's amount. */
export function payseraPaymentIsValid(result: { status: string; amountCents: number | null; currency: string }, order: { amountEur: number }): boolean {
  return result.status === '1' && result.currency === 'EUR' && result.amountCents === Math.round(order.amountEur * 100);
}

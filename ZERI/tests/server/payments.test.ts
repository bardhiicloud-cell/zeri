import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildPayseraUrl,
  extractAmounts,
  extractCodes,
  formatIban,
  generateOrderCode,
  isOrderExpired,
  isValidIban,
  isValidOrderCode,
  matchStatement,
  parseAmount,
  parsePaymentSettings,
  payseraConfigFromEnv,
  payseraPaymentIsValid,
  priceFor,
  settingsFromDoc,
  verifyPayseraCallback,
  type MatchableOrder,
} from '../../server/payments';

const seeded = (bytes: number[]) => (n: number) => Uint8Array.from(Array.from({ length: n }, (_, i) => bytes[i % bytes.length]));

describe('order codes', () => {
  it('generates 9-character codes that validate', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOrderCode();
      expect(code).toHaveLength(9);
      expect(code.startsWith('ZQ')).toBe(true);
      expect(isValidOrderCode(code)).toBe(true);
    }
  });

  it('never uses confusable characters', () => {
    for (let i = 0; i < 300; i++) expect(generateOrderCode().slice(2)).not.toMatch(/[ILO01]/);
  });

  it('is deterministic for a given random source, and avoids modulo bias bytes', () => {
    expect(generateOrderCode(seeded([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]))).toBe(generateOrderCode(seeded([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])));
    // bytes ≥ 248 (the rejection limit for a 31-symbol alphabet) are skipped, not wrapped
    expect(isValidOrderCode(generateOrderCode(seeded([255, 250, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])))).toBe(true);
  });

  it('rejects a single mistyped character through the check symbol', () => {
    const code = generateOrderCode();
    const body = code.slice(0, -1);
    const tampered = body.slice(0, 4) + (body[4] === 'A' ? 'B' : 'A') + body.slice(5) + code.slice(-1);
    expect(isValidOrderCode(tampered)).toBe(false);
  });

  it('rejects wrong prefix, length and alphabet', () => {
    expect(isValidOrderCode('XXABCDEFG')).toBe(false);
    expect(isValidOrderCode('ZQABC')).toBe(false);
    expect(isValidOrderCode('ZQ0OIL1AA')).toBe(false);
    expect(isValidOrderCode(undefined)).toBe(false);
  });

  it('finds codes in free text, with spaces and dashes inserted by banks', () => {
    const code = generateOrderCode();
    const spaced = `${code.slice(0, 2)}-${code.slice(2, 5)} ${code.slice(5)}`;
    expect(extractCodes(`Pagese verifikim ${code} Klient X`)).toEqual([code]);
    expect(extractCodes(`REF ${spaced.toLowerCase()} 15,99`)).toEqual([code]);
    expect(extractCodes('asnje kod ketu ZQAAAAAAB')).toEqual([]);
  });
});

describe('IBAN', () => {
  it('accepts valid IBANs and rejects altered ones', () => {
    expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true);
    expect(isValidIban('GB82WEST12345698765432')).toBe(true);
    expect(isValidIban('DE89 3704 0044 0532 0130 01')).toBe(false);
    expect(isValidIban('')).toBe(false);
    expect(isValidIban(undefined)).toBe(false);
  });

  it('formats in groups of four', () => {
    expect(formatIban('de89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00');
  });
});

describe('amounts', () => {
  it('parses European and English formats', () => {
    expect(parseAmount('15,99')).toBe(15.99);
    expect(parseAmount('15.99')).toBe(15.99);
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('15')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });

  it('extracts every amount in a line', () => {
    expect(extractAmounts('12.10.2026  Pagese ZQ  15,99 EUR  Saldo 1.204,50')).toEqual([15.99, 1204.5]);
  });
});

describe('statement matching', () => {
  const a = generateOrderCode();
  const b = generateOrderCode();
  const c = generateOrderCode();
  const d = generateOrderCode();
  const ghost = generateOrderCode();
  const orders = new Map<string, MatchableOrder>([
    [a, { code: a, amountEur: 15.99, status: 'awaiting' }],
    [b, { code: b, amountEur: 20, status: 'awaiting' }],
    [c, { code: c, amountEur: 15.99, status: 'paid' }],
    [d, { code: d, amountEur: 35, status: 'cancelled' }],
  ]);

  const statement = [
    `Data;Pershkrimi;Shuma`,
    `12.10.2026;Pagese verifikim ${a};15,99`,
    `13.10.2026;REF ${b} reklame;19,00`,
    `13.10.2026;Gjeni ${c};15,99`,
    `14.10.2026;${d} paketa;35,00`,
    `14.10.2026;Transfer ${ghost};10,00`,
    `15.10.2026;Pa kod fare;99,00`,
    `15.10.2026;Ref ${a} (dyfishim i njejti transfer);15,99`,
  ].join('\n');

  it('classifies every line that carries a code, once per code', () => {
    const entries = matchStatement(statement, orders);
    const outcome = (code: string) => entries.find((e) => e.code === code)?.outcome;
    expect(outcome(a)).toBe('match');
    expect(outcome(b)).toBe('amount_mismatch');
    expect(outcome(c)).toBe('already_paid');
    expect(outcome(d)).toBe('cancelled');
    expect(outcome(ghost)).toBe('unknown_code');
    expect(entries).toHaveLength(5); // lines without a code, and the repeat of `a`, are not entries
  });

  it('reports an awaiting order with no amount on its line', () => {
    expect(matchStatement(`kodi ${a}`, orders)[0].outcome).toBe('amount_unknown');
  });
});

describe('settings', () => {
  it('validates the IBAN and prices', () => {
    expect(parsePaymentSettings({ iban: 'DE89 3704 0044 0532 0130 01' })).toMatchObject({ outcome: 'invalid' });
    expect(parsePaymentSettings({ verificationPriceEur: -1 })).toMatchObject({ outcome: 'invalid' });
    expect(parsePaymentSettings({ adPackagePrices: { 'bad id': 5 } })).toMatchObject({ outcome: 'invalid' });
    const ok = parsePaymentSettings({
      iban: 'de89 3704 0044 0532 0130 00', beneficiary: '  Zeri  ', bic: 'abcdkosx', verificationPriceEur: '15,99',
      adPackagePrices: { '1_week': '20', '2_weeks': '', '1_month': 60 },
    });
    expect(ok.outcome).toBe('ok');
    if (ok.outcome === 'ok') {
      expect(ok.settings).toMatchObject({ iban: 'DE89370400440532013000', beneficiary: 'Zeri', bic: 'ABCDKOSX', verificationPriceEur: 15.99 });
      expect(ok.settings.adPackagePrices).toEqual({ '1_week': 20, '1_month': 60 });
    }
  });

  it('defaults the tick to 15.99 and leaves ad packages without a price', () => {
    const settings = settingsFromDoc(undefined);
    expect(priceFor(settings, 'verification')).toBe(15.99);
    expect(priceFor(settings, 'ad-package', '1_week')).toBeNull();
    expect(priceFor(settingsFromDoc({ adPackagePrices: { '1_week': 20 } }), 'ad-package', '1_week')).toBe(20);
    expect(priceFor(settingsFromDoc({ verificationPriceEur: null }), 'verification')).toBeNull();
  });

  it('expires orders after the window but only as a flag', () => {
    const now = Date.parse('2026-10-30T00:00:00Z');
    expect(isOrderExpired(Date.parse('2026-10-20T00:00:00Z'), now)).toBe(false);
    expect(isOrderExpired(Date.parse('2026-10-01T00:00:00Z'), now)).toBe(true);
    expect(isOrderExpired(null, now)).toBe(false);
  });
});

describe('Paysera', () => {
  const config = { projectId: '123456', signPassword: 'secret', test: true };
  const md5 = (v: string) => createHash('md5').update(v).digest('hex');
  const encode = (params: Record<string, string>) =>
    Buffer.from(new URLSearchParams(params).toString()).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

  it('is off unless both environment values are present', () => {
    expect(payseraConfigFromEnv({})).toBeNull();
    expect(payseraConfigFromEnv({ PAYSERA_PROJECT_ID: '1' })).toBeNull();
    expect(payseraConfigFromEnv({ PAYSERA_PROJECT_ID: '1', PAYSERA_SIGN_PASSWORD: 'x', PAYSERA_TEST: '1' })).toEqual({ projectId: '1', signPassword: 'x', test: true });
  });

  it('builds a signed checkout URL with the amount in cents', () => {
    const code = generateOrderCode();
    const url = new URL(buildPayseraUrl(config, { code, amountEur: 15.99, description: 'Verifikim' }, { accept: 'https://a', cancel: 'https://c', callback: 'https://cb' }));
    const data = url.searchParams.get('data')!;
    expect(url.origin + url.pathname).toBe('https://www.paysera.com/pay/');
    expect(url.searchParams.get('sign')).toBe(md5(data + 'secret'));
    const params = new URLSearchParams(Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    expect(params.get('amount')).toBe('1599');
    expect(params.get('orderid')).toBe(code);
    expect(params.get('currency')).toBe('EUR');
    expect(params.get('test')).toBe('1');
  });

  it('verifies a callback signature and reads the payment', () => {
    const code = generateOrderCode();
    const data = encode({ orderid: code, status: '1', amount: '1599', currency: 'EUR' });
    const ok = verifyPayseraCallback({ data, ss1: md5(data + 'secret') }, 'secret');
    expect(ok).toMatchObject({ outcome: 'ok', code, status: '1', amountCents: 1599, currency: 'EUR' });
    if (ok.outcome === 'ok') {
      expect(payseraPaymentIsValid(ok, { amountEur: 15.99 })).toBe(true);
      expect(payseraPaymentIsValid(ok, { amountEur: 20 })).toBe(false);
      expect(payseraPaymentIsValid({ ...ok, status: '0' }, { amountEur: 15.99 })).toBe(false);
    }
  });

  it('refuses a forged or incomplete callback', () => {
    const data = encode({ orderid: generateOrderCode(), status: '1', amount: '1599', currency: 'EUR' });
    expect(verifyPayseraCallback({ data, ss1: 'deadbeef' }, 'secret')).toMatchObject({ outcome: 'invalid' });
    expect(verifyPayseraCallback({ data: '', ss1: '' }, 'secret')).toMatchObject({ outcome: 'invalid' });
    const badId = encode({ orderid: 'NOTACODE', status: '1' });
    expect(verifyPayseraCallback({ data: badId, ss1: md5(badId + 'secret') }, 'secret')).toMatchObject({ outcome: 'invalid' });
  });
});

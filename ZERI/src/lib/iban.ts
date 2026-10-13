/** IBAN helpers shared by the server (validation on save) and the console (live feedback). */

export const normalizeIban = (iban: string): string => iban.replace(/\s+/g, '').toUpperCase();

/** ISO 13616 mod-97 check. Accepts any country; Kosovo IBANs start with XK. */
export function isValidIban(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export const formatIban = (iban: string): string => normalizeIban(iban).replace(/(.{4})/g, '$1 ').trim();

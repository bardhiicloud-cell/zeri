/**
 * The admin ad-settings form used to seed `settings/general` with these sample
 * contacts, so they were saved into the live document and the public site showed
 * them as if they were real. Treating them as "not set" keeps invented contact
 * details off public pages until the owner enters real ones.
 */
const PLACEHOLDERS = new Set([
  '+38344123456',
  '+383 44 123 456',
  '038344123456',
  'reklama@qytetari.ks',
]);

const squash = (value: string) => value.replace(/[\s()-]/g, '').toLowerCase();
const PLACEHOLDER_KEYS = new Set([...PLACEHOLDERS].map(squash));

/** The value, or '' when it is empty or one of the known sample contacts. */
export function realContactOrEmpty(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed && !PLACEHOLDER_KEYS.has(squash(trimmed)) ? trimmed : '';
}

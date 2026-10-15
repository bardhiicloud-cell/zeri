/**
 * The date shown on a post card. `createdAt` is a Firestore Timestamp (or an ISO string for older
 * data); `new Date(timestamp)` is an Invalid Date, which is what every card used to show.
 * A post that was just published has no server time yet (`null`): it is shown as "Tani".
 */
export function postMillis(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') return (value as { toMillis: () => number }).toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function postDateLabel(value: unknown, locale = 'sq-AL'): string {
  const ms = postMillis(value);
  if (ms === null) return 'Tani';
  return new Date(ms).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

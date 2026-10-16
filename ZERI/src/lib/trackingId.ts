/**
 * The one place the site decides how a Track ID is shown.
 *
 * Track IDs are minted exactly once, on the server, when the record is created
 * (`server/trackingIds.ts` reserves them in a unique registry). Pages must never
 * invent their own: they read the stored value through this helper. The fallback
 * only exists for records created before the ID was stored, and it is derived
 * from the record id so every page prints the same thing for the same record.
 */
export function trackingIdOf(record: { id: string; trackingId?: string | null }): string {
  return record.trackingId || `ZQ-${record.id.substring(0, 8).toUpperCase()}`;
}

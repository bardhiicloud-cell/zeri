/**
 * Session-only recovery for the report form.
 *
 * Why sessionStorage and only these fields: a refresh, an accidental back
 * navigation or a failed submit should not cost a citizen their text, but a
 * report form also holds a name, a phone number and evidence. Those never leave
 * memory. The draft lives in the tab (gone when the tab closes), is tied to the
 * account that wrote it, and is deleted when the report is sent or discarded.
 */
export const REPORT_DRAFT_KEY = 'zeri.reportDraft.v2';
/** The previous, never-restored key; always removed so no old copy lingers. */
export const LEGACY_REPORT_DRAFT_KEY = 'reportDraft';

const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const DEFAULT_CENTRE: [number, number] = [42.6629, 21.1655];

export type LocationSource = 'default' | 'municipality' | 'pin' | 'gps' | 'search';

export interface ReportDraft {
  owner: string;
  savedAt: number;
  title: string;
  description: string;
  category: string;
  topicCategory: string;
  urgency: string;
  municipality: string;
  address: string;
  coordinates: [number, number];
  locationSource: LocationSource;
}

const SOURCES: readonly string[] = ['default', 'municipality', 'pin', 'gps', 'search'];

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export function draftOwner(user: { id?: string; role?: string } | null | undefined): string {
  return user?.id && user.role !== 'guest' ? user.id : 'guest';
}

export function serializeDraft(draft: Omit<ReportDraft, 'savedAt'>, now = Date.now()): string | null {
  const hasContent = Boolean(
    draft.title.trim() || draft.description.trim() || draft.address.trim() || draft.category || draft.topicCategory,
  );
  if (!hasContent) return null;
  // Built field by field: anything else on the object (a name, a phone number)
  // is dropped on purpose.
  const safe: ReportDraft = {
    owner: draft.owner,
    savedAt: now,
    title: str(draft.title, 200),
    description: str(draft.description, 5000),
    category: str(draft.category, 200),
    topicCategory: str(draft.topicCategory, 40),
    urgency: str(draft.urgency, 20),
    municipality: str(draft.municipality, 80),
    address: str(draft.address, 300),
    coordinates: draft.coordinates,
    locationSource: draft.locationSource,
  };
  return JSON.stringify(safe);
}

/** Returns the draft only if it is well formed, fresh and belongs to `owner`. */
export function parseDraft(raw: string | null, owner: string, now = Date.now()): ReportDraft | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<ReportDraft> & { coordinates?: unknown };
    if (!data || typeof data !== 'object') return null;
    if (data.owner !== owner) return null;
    if (typeof data.savedAt !== 'number' || now - data.savedAt > MAX_AGE_MS || data.savedAt > now + 60_000) return null;
    const coords = data.coordinates;
    const validCoords =
      Array.isArray(coords) && coords.length === 2 && coords.every(n => typeof n === 'number' && Number.isFinite(n));
    return {
      owner,
      savedAt: data.savedAt,
      title: str(data.title, 200),
      description: str(data.description, 5000),
      category: str(data.category, 200),
      topicCategory: str(data.topicCategory, 40),
      urgency: str(data.urgency, 20),
      municipality: str(data.municipality, 80),
      address: str(data.address, 300),
      coordinates: validCoords ? [coords[0] as number, coords[1] as number] : DEFAULT_CENTRE,
      locationSource:
        SOURCES.includes(String(data.locationSource)) && validCoords ? (data.locationSource as LocationSource) : 'default',
    };
  } catch {
    return null;
  }
}

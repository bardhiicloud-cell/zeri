/**
 * The one place that knows what "the municipality you are looking at" means.
 *
 * Before this module the scope was expressed four incompatible ways at once:
 *
 *   • `null`               (store default, before the detector had run)
 *   • `'Të gjitha Komunat'`  (MapPage, Dashboard, store setter)
 *   • `'Kosova (të gjitha komunat)'` (the option label in the top-bar profile menu)
 *   • `''`                 (the empty string every page's <select> defaults to)
 *
 * Each page compared against whichever of those it had heard of, so switching
 * the scope from the profile menu left the map, the statistics page and the
 * forum showing a different place. Everything now normalises through
 * {@link normalizeScope} and every caller compares against {@link ALL_SCOPE}.
 */
import { KOSOVO_MUNICIPALITIES } from './constants';
import { normalizeMunicipalityName } from './municipalityNormalizer';

/** The canonical "whole country" scope. The only value meaning "not filtered". */
export const ALL_SCOPE = 'Të gjitha Komunat';

/** The 38 municipalities, sorted, as the single canonical registry. */
export const ALL_MUNICIPALITIES: readonly string[] = Object.freeze([...KOSOVO_MUNICIPALITIES]);

/**
 * Every spelling of "no filter" that has ever reached this module, mapped to the
 * canonical sentinel. Kept explicit rather than regex-matched so a new stray
 * literal shows up in review instead of quietly becoming a municipality name.
 */
const ALL_SCOPE_ALIASES: readonly string[] = [
  ALL_SCOPE,
  'Kosova (të gjitha komunat)',
  'Të gjitha',
  'Të gjitha komunat',
  'Kosova',
  'All Municipalities',
  'all',
  '*',
];

/**
 * Reduce any stored or user-supplied scope to either a canonical municipality
 * name or {@link ALL_SCOPE}.
 *
 * Unknown, empty and `null` all resolve to {@link ALL_SCOPE}: showing the whole
 * country is the safe failure mode, whereas inventing a municipality would
 * silently hide every record outside it.
 */
export function normalizeScope(value: string | null | undefined): string {
  if (value === null || value === undefined) return ALL_SCOPE;
  const trimmed = String(value).trim();
  if (!trimmed) return ALL_SCOPE;
  if (ALL_SCOPE_ALIASES.includes(trimmed)) return ALL_SCOPE;

  // Fast path: an exact member of the 38-name registry is already canonical. This
  // runs before the alias table so a stored value can never be rewritten to a
  // different-but-similar name (Ranillug/Ranillug, Mamushë/Mamusha).
  const direct = ALL_MUNICIPALITIES.find((name) => name === trimmed);
  if (direct) return direct;

  return normalizeMunicipalityName(trimmed) ?? trimmed;
}

/** True when the scope is a specific municipality rather than the whole country. */
export function isSpecificScope(scope: string | null | undefined): boolean {
  return normalizeScope(scope) !== ALL_SCOPE;
}

/** The scope as a comparable key, safe for `===` against report data. */
export function scopeKey(scope: string | null | undefined): string {
  return normalizeScope(scope);
}

/**
 * Does a record belong to the given scope?
 *
 * Reports, forum posts and health records do not agree on where the municipality
 * lives — some carry `location.municipality`, some a flat `municipality`, some
 * only a free-text `address`. All three are read here so no page has to grow its
 * own half-correct predicate.
 */
export function recordMatchesScope(record: unknown, scope: string | null | undefined): boolean {
  const wanted = scopeKey(scope);
  if (wanted === ALL_SCOPE) return true;
  if (!record || typeof record !== 'object') return false;

  const row = record as Record<string, any>;
  const candidates = [
    row.municipality,
    row.location?.municipality,
    row.neighborhood,
    row.location?.neighborhood,
    row.location?.address,
    row.address,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  const wantedKey = normalizeMunicipalityName(wanted) ?? wanted.toLowerCase();
  return candidates.some((candidate) => {
    if (candidate === wanted) return true;
    const resolved = normalizeMunicipalityName(candidate);
    if (resolved === wanted) return true;
    return candidate.toLowerCase().includes(wantedKey);
  });
}

/** Filter any list of records down to the active scope. */
export function filterByScope<T>(records: readonly T[] | undefined | null, scope: string | null | undefined): T[] {
  if (!records) return [];
  const wanted = scopeKey(scope);
  if (wanted === ALL_SCOPE) return [...records];
  return records.filter((record) => recordMatchesScope(record, wanted));
}

/** Storage key. One key, written by one setter, read on boot. */
export const MUNICIPALITY_STORAGE_KEY = 'kosova_user_muni';

/**
 * Case- and accent-insensitive prefix search over the 38 names.
 *
 * A plain `includes` on the raw string is useless for a citizen who types
 * "prishtine" or "PEJ", so the comparison runs through the same normaliser the
 * geocoder path uses.
 */
export function searchMunicipalities(query: string): string[] {
  const needle = (query ?? '').trim();
  if (!needle) return [...ALL_MUNICIPALITIES];
  const normalizedNeedle = normalizeMunicipalityName(needle) ?? needle.toLowerCase();
  return ALL_MUNICIPALITIES.filter((name) => {
    const normalizedName = normalizeMunicipalityName(name) ?? name.toLowerCase();
    return normalizedName.includes(normalizedNeedle);
  });
}

/** Read the persisted scope at boot, falling back to the whole country. */
export function readPersistedScope(): string {
  if (typeof localStorage === 'undefined') return ALL_SCOPE;
  try {
    return normalizeScope(localStorage.getItem(MUNICIPALITY_STORAGE_KEY));
  } catch {
    // Private-mode Safari throws on localStorage access rather than returning null.
    return ALL_SCOPE;
  }
}

/**
 * Has this browser ever stored a choice?
 *
 * The geolocation prompt keys off this rather than off the current scope: a
 * citizen who deliberately chose "whole country" must not be asked again on
 * every reload, which is exactly what `userMunicipality !== null` used to do
 * once the sentinel string replaced null.
 */
export function hasPersistedScope(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(MUNICIPALITY_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

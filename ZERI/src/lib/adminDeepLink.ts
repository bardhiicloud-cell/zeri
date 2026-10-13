import type { AdminSection } from './adminPermissions';

/**
 * Which admin section a URL hash names, if any.
 *
 * Staff arrive from a notification or a support ticket, and dropping them on the
 * dashboard loses the context of why they clicked. All of these open Reports:
 *
 *     /admin#reports      /admin#/reports      /admin#/admin/reports
 *     /admin#/approvals   (the legacy path, kept so old links still work)
 *
 * Segments are compared whole. The previous implementation tested
 * `hash.includes('/' + id)`, which never matched the `#reports` form its own
 * comment documented and would have matched `/ads` inside any longer word.
 */
const LEGACY_ALIASES: Readonly<Record<string, AdminSection>> = {
  approvals: 'reports',
};

export function sectionFromHash(
  hash: string,
  knownSections: readonly AdminSection[]
): AdminSection | null {
  const segments = hash
    .replace(/^#/, '')
    .split(/[/?]/)
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);

  // The last segment wins, so `/admin/reports` resolves to `reports` even though
  // `admin` is not a section.
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    const alias = LEGACY_ALIASES[segment];
    if (alias) return alias;
    const match = knownSections.find((section) => section === segment);
    if (match) return match;
  }
  return null;
}

/**
 * Parameters after the section, e.g. `#reports?open=abc123` -> { open: 'abc123' }.
 * Used so a link from the inbox opens a specific record, not just its section.
 */
export function paramsFromHash(hash: string): Record<string, string> {
  const query = hash.split('?')[1] ?? '';
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const [rawKey, ...rest] = pair.split('=');
    if (!rawKey) continue;
    try {
      params[decodeURIComponent(rawKey)] = decodeURIComponent(rest.join('='));
    } catch {
      // A malformed escape is ignored rather than breaking the whole link.
    }
  }
  return params;
}

/** The hash that reopens a section, or '' for the default (dashboard) view. */
export function hashForSection(section: AdminSection, params?: Record<string, string>): string {
  if (section === 'dashboard') return '';
  const query = params
    ? Object.entries(params)
        .filter(([, value]) => value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&')
    : '';
  return `#${section}${query ? `?${query}` : ''}`;
}

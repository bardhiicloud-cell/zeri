/**
 * Which URLs are real pages.
 *
 * The router serves the same HTML for every path, so "is this a real page?" has
 * to be answered in two places that must agree: the client (to render the 404
 * page instead of the home page) and the server (to answer with HTTP 404 so
 * crawlers drop the URL). Both read this one table.
 *
 * Only the first path segment is checked. Deeper segments (a Track ID, a
 * chapter, an entry) are data; the page itself shows its own "not found" state
 * for those.
 */
import { SEO_LOCALES } from './seo';

/** First segments that have a page. Keep in step with the route table in App.tsx. */
export const KNOWN_PAGE_ROOTS: readonly string[] = [
  '', 'login', 'register', 'detailed-registry', 'trackid', 'raportet-e-mia', 'lajmero', 'moderimi-im',
  'verifikimi', 'ndihma', 'regjistri', 'registry', 'raporto', 'harta', 'statistikat', 'transparenca',
  'shendetesia', 'semundjet', 'sondazhet', 'sondazhe', 'komunat', 'sherbimet', 'Idea', 'projektet',
  'lajme', 'lajmet', 'kontakt', 'kontakte', 'kontakt-numrat', 'rreth-projektit', 'rreth-nesh',
  'kushtet-e-perdorimit', 'terms', 'privatesia', 'politika-e-priveritetit', 'politika-e-cookies', 'donacion',
  'partneret', 'zeri-qytetar', 'kosova', 'historia-e-uck',
  // Staff consoles: they exist, they are just not public pages.
  'komuna-panel', 'komuna', 'debatwp', 'debatiwp', 'agent', 'monitorim', 'menagjer', 'moderim', 'admin', 'approvals',
];

/** Language prefixes that have a URL space (`/en/...`). Albanian is unprefixed. */
export function isLocalePrefix(segment: string | undefined): boolean {
  if (!segment) return false;
  return Object.values(SEO_LOCALES).some((locale) => locale.pathPrefix !== '' && locale.pathPrefix === segment);
}

/** True when `pathname` (with or without a language prefix) names a real page. */
export function isKnownPagePath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && isLocalePrefix(segments[0])) segments.shift();
  return KNOWN_PAGE_ROOTS.includes(segments[0] ?? '');
}

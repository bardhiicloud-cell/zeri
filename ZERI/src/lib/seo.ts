/**
 * Per-language SEO configuration.
 *
 * Everything Google reads about a page has to change with the language, not
 * just the visible text: the <title>, the description, the Open Graph locale,
 * and — most importantly — the URL. A crawler will not treat /sherbimet and
 * /en/sherbimet as two language versions of one page unless we say so with
 * hreflang, so the tags are generated from this table rather than hand-written.
 *
 * Keeping the locale strings here (sq_AL, en_US, ...) rather than inline means
 * a new language cannot be added without also deciding its SEO identity.
 */
import type { SupportedLanguageCode } from './languageConstants';

export interface SeoLocale {
  /** Open Graph locale, e.g. sq_AL. */
  ogLocale: string;
  /** Native language name, used in the title suffix. */
  nativeName: string;
  /** URL path prefix. Albanian is the default and stays unprefixed. */
  pathPrefix: string;
}

export const SEO_LOCALES: Record<SupportedLanguageCode, SeoLocale> = {
  sq: { ogLocale: 'sq_AL', nativeName: 'Shqip', pathPrefix: '' },
  en: { ogLocale: 'en_US', nativeName: 'English', pathPrefix: 'en' },
  de: { ogLocale: 'de_DE', nativeName: 'Deutsch', pathPrefix: 'de' },
  bs: { ogLocale: 'bs_BA', nativeName: 'Bosanski', pathPrefix: 'bs' },
  ar: { ogLocale: 'ar_SA', nativeName: 'العربية', pathPrefix: 'ar' },
  tr: { ogLocale: 'tr_TR', nativeName: 'Türkçe', pathPrefix: 'tr' },
  sr: { ogLocale: 'sr_RS', nativeName: 'Srpski', pathPrefix: 'sr' },
  fr: { ogLocale: 'fr_FR', nativeName: 'Français', pathPrefix: 'fr' },
  it: { ogLocale: 'it_IT', nativeName: 'Italiano', pathPrefix: 'it' },
  pt: { ogLocale: 'pt_PT', nativeName: 'Português', pathPrefix: 'pt' },
  gsw: { ogLocale: 'de_CH', nativeName: 'Deutsch (Schweiz)', pathPrefix: 'ch' },
  mk: { ogLocale: 'mk_MK', nativeName: 'Македонски', pathPrefix: 'mk' },
  sl: { ogLocale: 'sl_SI', nativeName: 'Slovenščina', pathPrefix: 'sl' },
  hr: { ogLocale: 'hr_HR', nativeName: 'Hrvatski', pathPrefix: 'hr' },
  sv: { ogLocale: 'sv_SE', nativeName: 'Svenska', pathPrefix: 'sv' },
  nb: { ogLocale: 'nb_NO', nativeName: 'Norsk', pathPrefix: 'nb' },
  nl: { ogLocale: 'nl_NL', nativeName: 'Nederlands', pathPrefix: 'nl' },
  ja: { ogLocale: 'ja_JP', nativeName: '日本語', pathPrefix: 'ja' },
  ko: { ogLocale: 'ko_KR', nativeName: '한국어', pathPrefix: 'ko' },
  pl: { ogLocale: 'pl_PL', nativeName: 'Polski', pathPrefix: 'pl' },
  bg: { ogLocale: 'bg_BG', nativeName: 'Български', pathPrefix: 'bg' },
  /*
   * Regional English. Canada and Australia reuse the `en` translation (Canada
   * also offers French), so they carry their own prefix and og locale while the
   * rendered strings resolve through the English table. Without a distinct
   * og:locale a shared /ca/… link looks identical to /en/… to a crawler.
   */
  ca: { ogLocale: 'en_CA', nativeName: 'Canada (English/Français)', pathPrefix: 'ca' },
  au: { ogLocale: 'en_AU', nativeName: 'Australia (English)', pathPrefix: 'au' },
};

/** Production origin, used to build absolute canonical and hreflang URLs. */
export const SITE_ORIGIN = 'https://zeriqytetarve.com';

/**
 * Split a pathname into its language and the page beneath it.
 *
 * Albanian has no prefix, so `/sherbimet` is Albanian and `/en/sherbimet` is
 * English. Returns the language plus the unprefixed rest of the path, which is
 * what the router needs after stripping the locale segment.
 */
export function parseLocalePath(pathname: string): {
  language: SupportedLanguageCode;
  pagePath: string;
} {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];

  const match = (Object.entries(SEO_LOCALES) as [SupportedLanguageCode, SeoLocale][])
    .find(([, locale]) => locale.pathPrefix !== '' && locale.pathPrefix === first);

  if (match) {
    return { language: match[0], pagePath: '/' + segments.slice(1).join('/') };
  }
  return { language: 'sq', pagePath: pathname || '/' };
}

/**
 * Which translation table a language should read from.
 *
 * Canada and Australia are real destinations but not real translations: their
 * visitors read English (Canada also French, which is reachable because `fr`
 * sits next to `ca` in the switcher). Resolving them through the English table
 * means the overlay does not have to hold two duplicate copies of every string,
 * and a fix made in English reaches all three variants at once.
 */
export function translationLanguageFor(language: SupportedLanguageCode): SupportedLanguageCode {
  if (language === 'ca' || language === 'au') return 'en';
  return language;
}

/**
 * Build the URL for a page in a given language.
 *
 * This is what makes switching language keep you on the same page: the caller
 * passes the current pagePath and gets the same page under the new prefix.
 */
export function buildLocalizedPath(pagePath: string, language: SupportedLanguageCode): string {
  const prefix = SEO_LOCALES[language]?.pathPrefix ?? '';
  const clean = pagePath === '/' ? '' : pagePath;
  return '/' + [prefix, clean.replace(/^\//, '')].filter(Boolean).join('/');
}

/**
 * Pages that exist only at one address, with no `/en/...` twin: sign-in and the
 * staff consoles. Prefixing them with the visitor's language sent anyone who had
 * picked English (or any non-Albanian language) from /login or /admin to
 * /en/admin, which is a 404, so staff could not open the panel in any language
 * but Albanian. They still render in the chosen language; only the URL is left
 * alone.
 */
const UNLOCALIZED_ROUTES = [
  '/login', '/register', '/admin', '/approvals', '/agent', '/menagjer',
  '/monitorim', '/moderim', '/komuna', '/komuna-panel', '/debatwp', '/debatiwp',
] as const;

export function isUnlocalizedPath(pagePath: string): boolean {
  const first = '/' + (pagePath.split('/').filter(Boolean)[0] ?? '');
  return (UNLOCALIZED_ROUTES as readonly string[]).includes(first);
}

/** Absolute URL for canonical/hreflang tags. */
export function absoluteUrl(pagePath: string, language: SupportedLanguageCode): string {
  return SITE_ORIGIN + buildLocalizedPath(pagePath, language);
}

/**
 * JavaScript twin of src/lib/seo.ts.
 *
 * The client imports the TypeScript module through the bundler. This copy exists
 * for Node-side tooling (the i18n verifier) and for anything the server needs,
 * neither of which can import a .ts file at runtime.
 *
 * Keep the two in sync when adding a language: the language code, its URL
 * prefix and its Open Graph locale all have to be declared in both, or the
 * sitemap and the rendered page will disagree about where a language lives.
 */

/** Open Graph locale, native name and URL prefix per language. */
export const SEO_LOCALES = {
  sq: { ogLocale: 'sq_AL', nativeName: 'Shqip', pathPrefix: '' },
  en: { ogLocale: 'en_US', nativeName: 'English', pathPrefix: 'en' },
  de: { ogLocale: 'de_DE', nativeName: 'Deutsch', pathPrefix: 'de' },
  bs: { ogLocale: 'bs_BA', nativeName: 'Bosanski', pathPrefix: 'bs' },
  ar: { ogLocale: 'ar_SA', nativeName: 'العربية', pathPrefix: 'ar' },
  tr: { ogLocale: 'tr_TR', nativeName: 'Türkçe', pathPrefix: 'tr' },
  sr: { ogLocale: 'sr_RS', nativeName: 'Srpski', pathPrefix: 'sr' },
  fr: { ogLocale: 'fr_FR', nativeName: 'Français', pathPrefix: 'fr' },
  it: { ogLocale: 'it_IT', nativeName: 'Italiano', pathPrefix: 'it' },
  es: { ogLocale: 'es_ES', nativeName: 'Español', pathPrefix: 'es' },
  pt: { ogLocale: 'pt_PT', nativeName: 'Português', pathPrefix: 'pt' },
  gsw: { ogLocale: 'de_CH', nativeName: 'Deutsch (Schweiz)', pathPrefix: 'ch' },
  mk: { ogLocale: 'mk_MK', nativeName: 'Македонски', pathPrefix: 'mk' },
  sl: { ogLocale: 'sl_SI', nativeName: 'Slovenščina', pathPrefix: 'sl' },
  hr: { ogLocale: 'hr_HR', nativeName: 'Hrvatski', pathPrefix: 'hr' },
  ro: { ogLocale: 'ro_RO', nativeName: 'Română', pathPrefix: 'ro' },
  sv: { ogLocale: 'sv_SE', nativeName: 'Svenska', pathPrefix: 'sv' },
  nb: { ogLocale: 'nb_NO', nativeName: 'Norsk', pathPrefix: 'nb' },
  hy: { ogLocale: 'hy_AM', nativeName: 'Հայերեն', pathPrefix: 'hy' },
  nl: { ogLocale: 'nl_NL', nativeName: 'Nederlands', pathPrefix: 'nl' },
};

/** Production origin for canonical and hreflang URLs. */
export const SITE_ORIGIN = 'https://zeriqytetare.republiks';

/** Split `/en/sherbimet` into `{ language: 'en', pagePath: '/sherbimet' }`. */
export function parseLocalePath(pathname) {
  const segments = String(pathname || '').split('/').filter(Boolean);
  const first = segments[0];

  const match = Object.entries(SEO_LOCALES)
    .find(([, locale]) => locale.pathPrefix !== '' && locale.pathPrefix === first);

  if (match) {
    return { language: match[0], pagePath: '/' + segments.slice(1).join('/') };
  }
  return { language: 'sq', pagePath: pathname || '/' };
}

/** Build the URL for a page in a language, preserving the page itself. */
export function buildLocalizedPath(pagePath, language) {
  const prefix = SEO_LOCALES[language]?.pathPrefix ?? '';
  const clean = pagePath === '/' ? '' : pagePath;
  return '/' + [prefix, clean.replace(/^\//, '')].filter(Boolean).join('/');
}

/** Absolute URL for canonical/hreflang tags. */
export function absoluteUrl(pagePath, language) {
  return SITE_ORIGIN + buildLocalizedPath(pagePath, language);
}

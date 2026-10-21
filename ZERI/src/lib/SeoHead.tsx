/**
 * Injects the per-language SEO tags into <head> on every route change.
 *
 * A single-page app serves one index.html for every URL, so without this every
 * page and every language would look identical to a crawler: same title, same
 * description, no hreflang. This component rewrites the tags that matter —
 * title, description, canonical, the 20 hreflang alternates and the Open Graph
 * block — whenever either the page or the language changes.
 *
 * The tags are created once and then updated in place; repeatedly appending
 * would leave 20 stale hreflang links behind after clicking through a few pages.
 */
import { useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { dt } from './dt';
import { SUPPORTED_LANGUAGES } from './languageConstants';
import { SEO_LOCALES, absoluteUrl } from './seo';
import { SITE_ORIGIN } from './seo';
import { HOME_DESCRIPTION, HOME_TITLE } from './routeSeo';

const BRAND = 'Zëri Qytetarëve';

/** Create the tag once and reuse it, so we never stack duplicates. */
function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function upsertLink(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

interface SeoHeadProps {
  /** Unprefixed path of the current page, e.g. "/sherbimet". */
  pagePath: string;
  /** Page-specific title in Albanian; translated here for the active language. */
  title?: string;
  /** Page-specific description in Albanian; translated here. */
  description?: string;
}

export function SeoHead({ pagePath, title, description }: SeoHeadProps) {
  const { language } = useLanguage();

  useEffect(() => {
    const locale = SEO_LOCALES[language];
    const isHome = pagePath === '/' || pagePath === '';

    // Translate the page title/description through the same dt() pipeline the
    // UI uses, so SEO text and on-screen text can never disagree.
    const pageTitle = title ? dt(title) : '';
    const pageDesc = description
      ? dt(description)
      : language === 'sq' ? HOME_DESCRIPTION : dt(HOME_DESCRIPTION);

    const fullTitle = isHome
      ? (language === 'sq' ? HOME_TITLE : `${dt(BRAND)} — ${dt('Platforma Kombëtare e Angazhimit Qytetar të Republikës së Kosovës')}`)
      : `${pageTitle || dt(BRAND)} — ${dt(BRAND)}`;

    document.title = fullTitle;

    upsertMeta('meta[name="description"]', { name: 'description', content: pageDesc });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: pageDesc });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: locale.ogLocale });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: dt(BRAND) });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: absoluteUrl(pagePath, language) });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: pageDesc });

    // Canonical points at this page in this language.
    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: absoluteUrl(pagePath, language) });

    // One hreflang alternate per language, plus x-default for Albanian.
    // Stale alternates from a previous language are removed first.
    document.head.querySelectorAll('link[data-seo-alt]').forEach((n) => n.remove());
    for (const lang of SUPPORTED_LANGUAGES) {
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', SEO_LOCALES[lang].ogLocale.replace('_', '-'));
      link.setAttribute('href', absoluteUrl(pagePath, lang));
      link.setAttribute('data-seo-alt', '1');
      document.head.appendChild(link);
    }
    const xDefault = document.createElement('link');
    xDefault.setAttribute('rel', 'alternate');
    xDefault.setAttribute('hreflang', 'x-default');
    xDefault.setAttribute('href', SITE_ORIGIN + pagePath);
    xDefault.setAttribute('data-seo-alt', '1');
    document.head.appendChild(xDefault);
  }, [language, pagePath, title, description]);

  return null;
}

import { useEffect } from 'react';
import { SITE_ORIGIN, SEO_LOCALES } from './seo';
import { readStoredLanguage } from './languageConstants';
import { HOME_DESCRIPTION, HOME_TITLE } from './routeSeo';
import { dt } from './dt';

/**
 * Per-page document title, description, canonical URL, Open Graph tags and
 * hreflang alternates.
 *
 * Every route previously inherited the static tags from index.html, so a page
 * opened from a shared link or a search result showed the same title, the same
 * canonical URL and the same OG card no matter which of the 27 routes was open.
 * That is both a usability failure and an SEO one: a crawler sees one site,
 * social shares always preview the homepage, and the hreflang set never matches
 * the page actually served.
 *
 * Canonical/OG/hreflang were previously owned by the separate `SeoHead`
 * component, which was written but never mounted anywhere — so those tags were
 * permanently the homepage's. The logic is merged here: one system, driven by
 * the route table, with no duplicated wiring to forget. `SeoHead` still works
 * if a page mounts it directly, but it is no longer required.
 */
export function usePageMeta(title: string, description?: string, options?: { noindex?: boolean }) {
  const noindex = options?.noindex === true;
  useEffect(() => {
    // Error pages must not be indexed. The tag is removed again on the next page.
    document.head.querySelectorAll('meta[data-seo-noindex]').forEach((n) => n.remove());
    if (noindex) {
      const robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      robots.setAttribute('content', 'noindex, follow');
      robots.setAttribute('data-seo-noindex', '1');
      document.head.appendChild(robots);
    }

    const BRAND = 'Zëri Qytetarëve';
    // The router serves one HTML shell for every path, so the page is identified
    // by the URL, not by the title string (the home route's title is "Ballina").
    const location = window.location.pathname;
    const locSegments = location.split('/').filter(Boolean);
    const locales0 = SEO_LOCALES as Record<string, { pathPrefix: string }>;
    const lang0 = readStoredLanguage();
    const prefixed0 = locales0[lang0]?.pathPrefix !== '' && locales0[lang0]?.pathPrefix === locSegments[0];
    const routePath = '/' + (prefixed0 ? locSegments.slice(1) : locSegments).join('/');
    const isHome = routePath === '/';

    // Albanian home uses the exact title that index.html ships, so the tab does
    // not change when the app mounts. Other languages keep the translated form.
    document.title = isHome
      ? (lang0 === 'sq' ? HOME_TITLE : `${BRAND} — ${dt('Platforma Kombëtare e Angazhimit Qytetar të Republikës së Kosovës')}`)
      : `${title} — ${BRAND}`;

    const metaDescription = description ?? (isHome ? HOME_DESCRIPTION : undefined);
    if (metaDescription) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', 'description');
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', metaDescription);
    }

    // ── Canonical + OG + hreflang ────────────────────────────────────────
    // The router serves the same HTML for every path, so the canonical URL and
    // the language alternates have to be derived from the current location.
    // The language prefix (e.g. /en) is stripped before the page path is
    // rebuilt for each alternate, so a German reader on /de/komunat gets
    // /de/komunat for de and /komunat for sq, not a double prefix.
    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    const first = segments[0];
    const locales = SEO_LOCALES as Record<string, { pathPrefix: string; ogLocale: string }>;
    const isPrefixed =
      locales[readStoredLanguage()]?.pathPrefix === first && locales[readStoredLanguage()]?.pathPrefix !== '';
    const pagePath = isPrefixed ? '/' + segments.slice(1).join('/') : path;

    const buildFor = (lang: string) => {
      const prefix = locales[lang]?.pathPrefix ?? '';
      const clean = pagePath === '/' ? '' : pagePath;
      return SITE_ORIGIN + '/' + [prefix, clean.replace(/^\//, '')].filter(Boolean).join('/');
    };

    const canonicalUrl = buildFor(readStoredLanguage());

    const upsertMeta = (selector: string, attrs: Record<string, string>) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        document.head.appendChild(el);
      }
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    };
    const upsertLink = (selector: string, attrs: Record<string, string>) => {
      let el = document.head.querySelector(selector) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement('link');
        document.head.appendChild(el);
      }
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    };

    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: document.title });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: document.title });
    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl });

    // Refresh the hreflang set: one alternate per supported language plus
    // x-default, all pointing at this page. Stale entries are removed first so
    // navigating between languages never stacks duplicates.
    document.head.querySelectorAll('link[data-seo-alt]').forEach((n) => n.remove());
    for (const [code, locale] of Object.entries(locales)) {
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', locale.ogLocale.replace('_', '-'));
      link.setAttribute('href', buildFor(code));
      link.setAttribute('data-seo-alt', '1');
      document.head.appendChild(link);
    }
    const xDefault = document.createElement('link');
    xDefault.setAttribute('rel', 'alternate');
    xDefault.setAttribute('hreflang', 'x-default');
    xDefault.setAttribute('href', SITE_ORIGIN + pagePath);
    xDefault.setAttribute('data-seo-alt', '1');
    document.head.appendChild(xDefault);
  }, [title, description, noindex]);
}

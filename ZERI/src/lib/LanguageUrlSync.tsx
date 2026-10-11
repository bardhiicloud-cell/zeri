/**
 * Language-aware URL handling.
 *
 * Two jobs, both required for a site that Google can index per language and a
 * user can switch without losing their place:
 *
 *   1. Read the language out of the URL on load. `/en/sherbimet` must render the
 *      services page in English, and the stored preference must not fight the
 *      URL — the URL wins, because a shared link has to open in the language it
 *      was shared in.
 *
 *   2. Rewrite the URL when the language changes, keeping the page. Switching
 *      from /en/sherbimet to German has to land on /de/sherbimet, not on the
 *      home page. That is the "pa humbur faqen" requirement.
 *
 * The path segment is the canonical signal; the LanguageProvider remains the
 * source of truth for rendering.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from './LanguageContext';
import { buildLocalizedPath, parseLocalePath } from './seo';
import type { SupportedLanguageCode } from './languageConstants';

/**
 * Sync the URL and the active language in both directions.
 *
 * Mount this inside the Router (it needs useLocation/useNavigate) but outside
 * the routes, so it observes every navigation without rendering anything.
 */
export function LanguageUrlSync() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();

  /**
   * URL -> language, without clobbering a deliberate choice.
   *
   * The bug this guards against: an internal <Link to="/sherbimet"> has no
   * language prefix, so `parseLocalePath` reports Albanian and the effect reset
   * the visitor's German back to Albanian every time they opened a section. The
   * rule is therefore:
   *
   *   - a prefixed URL wins, always — a shared /ar/... link must open in Arabic
   *   - an unprefixed URL is ambiguous, so it only selects Albanian when the
   *     visitor has no stored preference; otherwise the choice stands
   *   - and either way the URL is rewritten to carry the active language, so the
   *     address bar, the sitemap and the shared link all agree
   */
  useEffect(() => {
    const { language: urlLanguage, pagePath } = parseLocalePath(location.pathname);
    const hadPrefix = location.pathname.split('/').filter(Boolean)[0] !== pagePath.split('/').filter(Boolean)[0];

    // A prefixed URL is authoritative. An unprefixed one only sets Albanian when
    // nothing was chosen yet (readStoredLanguage already defaults to Albanian).
    const nextLanguage = hadPrefix ? urlLanguage : language;

    if (nextLanguage !== language) {
      setLanguage(nextLanguage as SupportedLanguageCode);
    }

    // Rewrite the URL to carry the language, keeping the page the visitor is on.
    const expected = buildLocalizedPath(pagePath, nextLanguage);
    if (expected.replace(/\/$/, '') !== location.pathname.replace(/\/$/, '')) {
      navigate(expected + location.search + location.hash, { replace: true });
    }
    // Keyed on the pathname only: reacting to `language` would loop against the
    // switch hook that also writes the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
}

/**
 * Switch language while staying on the current page.
 *
 * Exposed as a hook so the navbar (and anywhere else) calls one function and
 * gets both the state change and the URL rewrite, instead of each call site
 * remembering to do both.
 */
export function useLanguageSwitch() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();

  const switchLanguage = (next: SupportedLanguageCode) => {
    if (next === language) return;

    const { pagePath } = parseLocalePath(location.pathname);
    const target = buildLocalizedPath(pagePath, next);

    setLanguage(next);
    // replace: switching language should not fill the back button with history
    // entries the user has to press through to leave the page.
    navigate(target + location.search + location.hash, { replace: true });
  };

  return { language, switchLanguage };
}

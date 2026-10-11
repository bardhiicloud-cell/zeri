import { useEffect } from 'react';
/**
 * Per-page document title and description.
 *
 * Every route previously inherited the static title from index.html, so a page
 * opened from a shared link or a search result showed "Zëri Qytetarëve" with no
 * indication of which section it was. On a platform with 27 routes that is both
 * a usability failure and an SEO one.
 *
 * The suffix is added for every route except the dashboard, which keeps the
 * bare brand name.
 */
export function usePageMeta(title, description) {
    useEffect(() => {
        const BRAND = 'Zëri Qytetarëve';
        const isHome = title === BRAND;
        document.title = isHome
            ? `${BRAND} — Platforma Kombëtare e Angazhimit Qytetar të Republikës së Kosovës`
            : `${title} — ${BRAND}`;
        if (description) {
            let tag = document.querySelector('meta[name="description"]');
            if (!tag) {
                tag = document.createElement('meta');
                tag.setAttribute('name', 'description');
                document.head.appendChild(tag);
            }
            tag.setAttribute('content', description);
        }
    }, [title, description]);
}

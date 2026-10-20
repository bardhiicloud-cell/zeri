import DOMPurify from 'dompurify';

/**
 * Sanitise HTML ad creative before it is injected.
 *
 * This used to call `window.DOMPurify` when present and an identity function
 * otherwise. Nothing ever put DOMPurify on `window`, so the "sanitiser" was a
 * no-op and any ad document with `mediaType: 'html'` rendered as raw HTML on
 * every visitor's page. The import is explicit now, the policy is https-only,
 * and iframes are forced into a sandbox without `allow-same-origin`, so a
 * hostile creative cannot reach the host page's storage or auth session.
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'IFRAME') {
    node.setAttribute('sandbox', 'allow-scripts allow-popups');
    node.setAttribute('referrerpolicy', 'no-referrer');
  }
  if (node.tagName === 'A') {
    node.setAttribute('rel', 'noopener noreferrer sponsored');
  }
});

function sanitizeAdHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['iframe', 'img', 'div', 'span', 'a'],
    ALLOWED_ATTR: ['src', 'href', 'class', 'width', 'height', 'frameborder', 'allowfullscreen', 'target'],
    ALLOWED_URI_REGEXP: /^https:/i,
  });
}

/**
 * Kept in its own module so DOMPurify (~20 kB gzipped) is only downloaded when an
 * ad with HTML creative is actually shown, not with every page.
 */
export default function SanitizedAdHtml({ html }: { html: string }) {
  return <div className="contents" dangerouslySetInnerHTML={{ __html: sanitizeAdHtml(html) }} />;
}

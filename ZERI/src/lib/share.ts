/**
 * One share implementation for the whole platform.
 *
 * Three surfaces previously shared content three different ways: the forum
 * copied `window.location.href` (which for a hash-routed SPA is the router
 * root, so every shared post pointed at the dashboard), the news page did the
 * same thing, and only the polls page used the Web Share API. Nothing shared
 * to a specific platform, and nothing carried a title or an excerpt, so a link
 * posted to WhatsApp arrived as a bare URL.
 *
 * This module centralises the decision:
 *
 *   1. If the browser has Web Share API *and* it can share this payload, use
 *      the OS sheet. On Android and iOS that sheet is the entry point to every
 *      installed app — WhatsApp, Viber, Telegram, Instagram, Mail — which is
 *      what "share on all platforms" actually means on a phone. There is no
 *      way to enumerate or deep-link those apps from the web.
 *   2. Otherwise open the platform's own web-intent URL (`wa.me`, `t.me`, the
 *      Facebook sharer, the X/Twitter intent, a Viber deep link, a mailto:).
 *      Those are the documented, allowed entry points; building our own
 *      "share to X" list without them would mean asking for each provider's
 *      API keys.
 *
 * Clipboard is the fallback, not the primary path: it is the only option that
 * works everywhere, but on a phone it is a worse outcome than opening the
 * share sheet, and on desktop it is what the platforms' own buttons do.
 */

export interface ShareTarget {
  /** Canonical page URL. Absolute, so a copied link is never relative. */
  url: string;
  /** Headline. Used as the share title and the WhatsApp/Telegram text prefix. */
  title: string;
  /** One-line excerpt. Optional; platforms that ignore it simply omit it. */
  text?: string;
  /** Mail subject override, defaults to the title. */
  subject?: string;
}

export interface ShareChannel {
  id: string;
  label: string;
  /** Builds the provider URL for this payload. */
  href: (target: ShareTarget) => string;
}

/** Absolute URL for the current document, safe to paste anywhere. */
export function currentUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.location.href;
}

/**
 * Channels offered when the OS share sheet is unavailable (every desktop
 * browser, and any mobile browser without `navigator.share`).
 *
 * The order is deliberate: WhatsApp and Viber are the two messaging apps a
 * Kosovo citizen is most likely to have, so they lead.
 */
export const SHARE_CHANNELS: readonly ShareChannel[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    href: (t) => `https://wa.me/?text=${encodeURIComponent(compose(t))}`,
  },
  {
    id: 'viber',
    label: 'Viber',
    href: (t) => `viber://forward?text=${encodeURIComponent(compose(t))}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    href: (t) => `https://t.me/share/url?url=${encodeURIComponent(t.url)}&text=${encodeURIComponent(t.title)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    href: (t) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(t.url)}`,
  },
  {
    id: 'x',
    label: 'X',
    href: (t) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(t.url)}&text=${encodeURIComponent(t.title)}`,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    href: (t) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(t.url)}`,
  },
  {
    id: 'email',
    label: 'Email',
    href: (t) => `mailto:?subject=${encodeURIComponent(t.subject ?? t.title)}&body=${encodeURIComponent(compose(t))}`,
  },
];

/** Title + excerpt + URL, the shape every messaging app expects. */
export function compose(target: ShareTarget): string {
  const lines = [target.title];
  if (target.text) lines.push(target.text);
  lines.push(target.url);
  return lines.join('\n\n');
}

/** Can this browser drive the native share sheet for this payload? */
export function canUseNativeShare(target: ShareTarget): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  // `navigator.canShare` is absent on some engines that still expose `share`;
  // treat its absence as permission rather than falling back unnecessarily.
  if (typeof navigator.canShare !== 'function') return true;
  try {
    return navigator.canShare({ title: target.title, text: target.text, url: target.url });
  } catch {
    return false;
  }
}

/**
 * Native share, with a clipboard fallback.
 *
 * Returns `'shared'`, `'copied'` or `'dismissed'` so the caller can decide what
 * to tell the citizen — an aborted sheet is not an error and must not raise an
 * error toast, which is what the previous `navigator.share(...).catch(() => {})`
 * silently swallowed on every share.
 */
export async function shareNatively(target: ShareTarget): Promise<'shared' | 'copied' | 'dismissed'> {
  if (canUseNativeShare(target)) {
    try {
      await navigator.share({ title: target.title, text: target.text, url: target.url });
      return 'shared';
    } catch (error) {
      // AbortError means the citizen closed the sheet: not a failure.
      if (error instanceof Error && error.name === 'AbortError') return 'dismissed';
      // Any other failure falls through to the clipboard rather than dead-ending.
    }
  }

  const copied = await copyToClipboard(compose(target));
  return copied ? 'copied' : 'dismissed';
}

/** Clipboard write that never throws, and reports whether it worked. */
export async function copyToClipboard(value: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Insecure contexts and some in-app browsers reject the async API.
  }

  // Legacy path: a detached textarea and execCommand. Deprecated, but it is the
  // only thing that works in those in-app browsers.
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Resets every scroll container on navigation.
 *
 * Two things made this unreliable before:
 *
 *  1. The scroll must be instant. `'instant'` is the only value that is: `'auto'`
 *     defers to the CSS `scroll-behavior`, which is `smooth` on this site.
 *  2. Pages like the Forum and the Map scroll an inner div rather than the
 *     window. Resetting only `window` left the reader halfway down a thread
 *     after following a link, so the query has to cover every scrollable
 *     element on the page rather than a hardcoded list.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // A route change is a jump, not a gesture, so it must not animate. 'auto' is
    // NOT instant: it means "whatever CSS says", and index.css sets
    // `html { scroll-behavior: smooth }`. So every navigation opened the new page
    // at the old offset (often the footer) and then slid it up to the top. On
    // iOS that slide runs while Safari's toolbar grows back, which is when the
    // fixed bottom dock was seen floating mid-screen. 'instant' ignores the CSS.
    const behavior: ScrollBehavior = 'instant';

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior });
    }

    const reset = () => {
      const candidates: Element[] = [
        document.documentElement,
        document.body,
        ...Array.from(document.querySelectorAll<HTMLElement>('*')),
      ];

      for (const element of candidates) {
        // Only elements that can actually scroll, and that are not already at
        // the top, are worth writing to.
        if (element.scrollHeight <= element.clientHeight) continue;
        if (element.scrollTop === 0) continue;
        element.scrollTo({ top: 0, left: 0, behavior });
      }
    };

    reset();
    // A lazy route has not painted when the effect runs, so the new content
    // would be appended to a container still sitting at its previous offset.
    const frame = window.requestAnimationFrame(reset);
    const settle = window.setTimeout(reset, 120);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [pathname]);

  return null;
}

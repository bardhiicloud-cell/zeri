import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { dt } from '@/src/lib/dt';

/** Pixels scrolled before the button appears: roughly one and a half screens. */
const SHOW_AFTER = 1200;

/**
 * "Shko lart" for the long pages (the home page, the Kosovo and UÇK archives).
 * It sits above the assistant button so neither covers the other, and it jumps
 * instantly for visitors who ask for reduced motion.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  const goTop = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={goTop}
      aria-label={dt('Shko lart')}
      title={dt('Shko lart')}
      className="fixed bottom-[calc(10.5rem+env(safe-area-inset-bottom))] right-4 z-[55] grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:bg-slate-50 active:scale-95 md:bottom-24 md:right-6 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 print:hidden"
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

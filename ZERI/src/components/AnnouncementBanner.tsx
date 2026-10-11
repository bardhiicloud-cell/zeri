import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Megaphone, X } from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import { dt } from '@/src/lib/dt';
import { isSpecificScope, scopeKey } from '../lib/municipalityScope';

interface Announcement {
  id: string;
  title: string;
  summary?: string;
  municipality?: string;
  category?: string;
  isTicker?: boolean;
  published?: boolean;
  date?: string;
  createdAt?: string;
  publishedAt?: string;
}

/**
 * Municipality announcement banner.
 *
 * The report was that a citizen who was told "your municipality has an
 * announcement" had no way to find it: notices were published into the same
 * grid as editorial news and scrolled away. This strip sits directly under the
 * header, is scoped to the active municipality, and links straight to the
 * specific notice.
 *
 * It is a *banner*, not a modal, and it can be dismissed:
 *
 *  • A modal on load is the pattern every one of the scam sites uses, and a
 *    platform whose next job is to ask for donations must not look like one.
 *  • Dismissal is remembered per notice id in localStorage, so re-opening the
 *    page does not re-nag — but a *new* notice always shows.
 *  • At most one notice is shown. A stack of banners is a page nobody reads.
 */
const DISMISS_KEY = 'zeri_dismissed_announcements';

function readDismissed(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function AnnouncementBanner() {
  const userMunicipality = useStore((state) => state.userMunicipality);
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  /**
   * Only published notices are requested, and only the newest handful.
   * `where('published','==',true)` keeps drafts off the wire rather than
   * filtering them in the browser after they have already been downloaded.
   */
  useEffect(() => onSnapshot(
    query(
      collection(db, 'newsArticles'),
      where('published', '==', true),
      orderBy('createdAt', 'desc'),
      limit(100)
    ),
    (snapshot) => {
      setItems(snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() } as Announcement))
        .filter(item => item.published === true && item.isTicker === true && item.category === 'Njoftim Zyrtar')
        .sort((left, right) => {
          const leftDate = Date.parse(left.publishedAt || left.createdAt || left.date || '');
          const rightDate = Date.parse(right.publishedAt || right.createdAt || right.date || '');
          return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
        }));
    },
    // A notice banner must never be the reason a page fails to render.
    () => setItems([])
  ), []);

  const active = useMemo(() => {
    const scoped = isSpecificScope(userMunicipality)
      ? scopeKey(userMunicipality)
      : null;

    return items.find((item) => {
      if (dismissed.includes(item.id)) return false;
      // A notice with no municipality is a national announcement and is shown
      // to everyone; one with a municipality is only shown to that scope.
      if (!scoped) return true;
      return !item.municipality || item.municipality === scoped;
    }) ?? null;
  }, [items, dismissed, userMunicipality]);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next.slice(-40)));
    } catch {
      // Storage unavailable; the banner simply reappears on the next load.
    }
  };

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="w-full px-3 pt-3 sm:px-5 lg:px-8"
        >
          <div
            className={cn(
              'mx-auto flex max-w-[1600px] items-start gap-3 rounded-2xl border p-3.5 sm:items-center',
              'border-blue-200 bg-gradient-to-r from-blue-50 via-sky-50 to-white',
              'dark:border-blue-900/60 dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900'
            )}
            role="status"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Megaphone className="h-4 w-4" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
                <span className="inline-flex items-center gap-1">
                  <Bell className="h-3 w-3" aria-hidden="true" />
                  {dt('Njoftim i ri')}
                </span>
                {active.municipality && (
                  <span className="rounded-full bg-blue-600/10 px-2 py-0.5 normal-case tracking-normal text-blue-800 dark:bg-blue-400/10 dark:text-blue-200">
                    {dt('Komuna e')} {active.municipality}
                  </span>
                )}
              </p>
              <p className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-white">
                {active.title}
              </p>
              {active.summary && (
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                  {active.summary}
                </p>
              )}
            </div>

            <Link
              to={`/lajme?njoftim=${encodeURIComponent(active.id)}`}
              className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-black text-white transition-colors hover:bg-blue-700 sm:inline-flex"
            >
              {dt('Lexo më shumë')}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>

            <Link
              to={`/lajme?njoftim=${encodeURIComponent(active.id)}`}
              aria-label={dt('Lexo më shumë')}
              className="shrink-0 rounded-lg p-2 text-blue-700 transition-colors hover:bg-blue-600/10 sm:hidden dark:text-blue-300"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={() => dismiss(active.id)}
              aria-label={dt('Fshih njoftimin')}
              className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

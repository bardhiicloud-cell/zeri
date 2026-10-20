import { dt } from '@/src/lib/dt';
import { InstallAppBanner } from '../InstallAppPrompt';
import { Suspense, useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { useLanguage } from '../../lib/LanguageContext';
import { NetworkStatus } from './NetworkStatus';
import { NearbyAlerts } from './NearbyAlerts';
import { InstallPrompt } from './InstallPrompt';
import { LeaderboardModal } from '../LeaderboardModal';
import { UserProfileModal } from '../UserProfileModal.tsx';
import { QuickReportModal } from '../QuickReportModal';
import { LocationDetectorModal } from '../LocationDetectorModal';
import { AppFooter } from '../AppFooter.tsx';
import AdBanner from '../AdBanner.tsx';
import { TopNavbar } from './TopNavbar.tsx';
import { AppSidebar } from './AppSidebar.tsx';
import { MobileNav } from './MobileNav.tsx';
import { SearchPalette, useGlobalSearch } from './GlobalSearch';
import { AnnouncementBanner } from '../AnnouncementBanner.tsx';
import { BroadcastPopup, BroadcastStrip } from '../BroadcastLayer';
import { canAccessAdmin } from '../../lib/adminPermissions';
import GuidedTour from '../GuidedTour';

/** Shown inside the shell while a lazily loaded page downloads. */
function PageLoading() {
  return (
    <div className="flex min-h-[50vh] w-full flex-1 items-center justify-center" role="status" aria-live="polite">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
      <span className="sr-only">{dt('Duke ngarkuar seksionin...')}</span>
    </div>
  );
}

/**
 * The application shell: a top bar for the institutional sections, a left
 * sidebar for the working modules, and the routed content in between.
 *
 * Both navigation surfaces read from src/lib/navigation.ts, so a route renamed
 * in one place cannot stay stale in the other — which is how the sidebar ended
 * up advertising a page that 404'd. The mobile sheet renders the same links
 * rather than a second, hand-maintained list.
 */
export function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isForumPage = pathname === '/forum';
  const isNewsPage = pathname === '/lajme' || pathname === '/lajmet';
  // The house ad slot belongs on browsing pages only. Task pages (report, track, map, legal, contact, polls,
  // statistics, which carry their own inline slot) stay free of it so a citizen's first screen is the task.
  const showTopAd = ['/', '/komunat', '/projektet', '/sherbimet'].includes(pathname);
  const { language } = useLanguage();
  const currentUser = useStore((state) => state.currentUser);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isQuickReportOpen, setIsQuickReportOpen] = useState(false);

  const searchState = useGlobalSearch();

  useEffect(() => {
    const openProfile = () => setIsProfileModalOpen(true);
    window.addEventListener('zeri:open-profile', openProfile);
    return () => window.removeEventListener('zeri:open-profile', openProfile);
  }, []);

  const goTo = (href: string) => {
    navigate(href);
  };

  return (
    /**
     * The shell is an explicit two-row grid on desktop: the top bar owns row 1
     * across both columns, and row 2 holds the sidebar beside the routed page.
     * Every one of the three named its own cell, because auto-placement is what
     * produced the blank centre — with only the sidebar pinned to row 1, `main`
     * was dropped into a second implicit row sized by the sidebar's height, so on
     * a 900px viewport the whole page began at y=900 and looked empty.
     *
     * `items-start` is deliberately gone. It stopped the grid stretching its
     * items, which is the opposite of what a full-height shell wants; the sidebar
     * pins itself with `md:self-start` instead, which is the only place that
     * behaviour is actually needed.
     *
     * On mobile the shell is a single column and the top bar is not rendered at
     * all: navigation lives in a bottom tab bar plus a sheet, which is the pattern
     * citizens already have in their thumb.
     *
     * `md:pt-0` cancels `mobile-top-safe` below the breakpoint; the utility adds
     * `padding-top: 64px` at every width, and without the override the shell
     * started 64px below the top of the page, leaving a permanent gap.
     *
     * `md:pb-0` does the same for `mobile-bottom-safe`. That utility reserves room
     * for the mobile dock, and on desktop the dock does not exist — the padding
     * became a stray 36px third grid row, which is what the row trace showed as
     * `56px 3171px 36px`. Padding on a grid container creates a row; a shell that
     * declares two rows must not carry padding that invents a third.
     *
     * The shell is two nested elements, and that split is the fix.
     *
     * The outer element is the page background and the overlay host; the inner one
     * is the grid, and it contains *only* the sidebar and the routed page. Every
     * modal, palette and banner is a sibling of the grid rather than a child of it.
     *
     * Keeping overlays inside the grid is what broke the layout. A CSS grid lays
     * out every in-flow child, so each overlay claimed an implicit row of its own:
     * the track list read `56px 3171px 36px`, where the trailing tracks were an
     * overlay and not content. `main` was pushed down the page and the sticky
     * header had no room to travel. Marking an overlay `fixed` does not help —
     * Chrome still generates the track for an auto-placed grid item whose own
     * position is `fixed`.
     *
     * The top bar is *not* a grid item either. `position: sticky` can only travel
     * inside its containing block, and any cell it occupies is exactly as tall as
     * the bar itself, so it could never pin — it just scrolled away. A `fixed` bar
     * has no such constraint, and `app-shell-desktop` carries the matching
     * `padding-top` so the grid still starts below it.
     *
     * `relative` on the outer element gives the absolutely-positioned overlays a
     * containing block, so they stay pinned to the viewport-sized shell rather
     * than escaping to the nearest positioned ancestor.
     *
     * The debate page is deliberately excluded: it owns a fixed-height shell and
     * renders neither the top bar nor the sidebar.
     */
    <div className={isForumPage
      ? "relative h-dvh w-full max-w-full overflow-hidden bg-(--color-page) font-sans text-(--color-text) dark:bg-(--color-brand-dark) dark:text-white"
      : isNewsPage
        ? "relative min-h-screen w-full max-w-full bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100"
        : "relative min-h-screen w-full max-w-full bg-(--color-page) font-sans text-(--color-text) transition-colors mobile-bottom-safe md:pb-0 dark:bg-(--color-brand-dark) dark:text-white"}>
      {/*
        Overlays. They are siblings of the grid, never children of it, so they
        cannot claim a grid track no matter how they position themselves.
      */}
      <LocationDetectorModal />

      <div className="pointer-events-none fixed left-0 right-0 top-0 z-[9999]">
        <NetworkStatus />
      </div>

      {!isForumPage && !isNewsPage && <NearbyAlerts />}
      <InstallPrompt />

      {/*
        The top bar exists on desktop only. On mobile the brand, the search and
        the section links are unreachable from it, so it is hidden below `md`
        rather than shown as a cramped, half-functional row.
      */}
      {!isForumPage && !isNewsPage && (
        <div className="app-shell-header hidden md:block">
          <TopNavbar onOpenMobileMenu={() => goTo('/')} />
        </div>
      )}

      <div className={isForumPage
        ? "grid h-full w-full grid-cols-1"
        : isNewsPage
          ? "grid min-h-screen w-full grid-cols-1"
          : "grid w-full grid-cols-1 app-shell-desktop"}>

      {/*
        The top bar exists on desktop only. On mobile the brand, the search and
        the section links are unreachable from it, so it is hidden below `md`
        rather than shown as a cramped, half-functional row.

        `TopNavbar` renders its own `sticky top-0` header, and sticky is
        constrained by its containing block: it can only travel inside the element
        it lives in. This wrapper therefore spans the whole of row 1
        (`md:col-span-2`) and stretches to that row's full height; the shell's
        `padding-top` is what gives the bar its fixed offset.
      */}
      {!isForumPage && !isNewsPage && (
        <div className="app-shell-header col-span-1 hidden md:col-span-2 md:row-start-1 md:block">
          <TopNavbar onOpenMobileMenu={() => goTo('/')} />
        </div>
      )}

      {!isForumPage && !isNewsPage && <AppSidebar onNavigate={() => navigate(pathname)} />}

      <main
        key={language}
        className={isForumPage
          ? "col-span-1 flex h-full min-h-0 min-w-0 flex-col items-stretch overflow-hidden"
          : isNewsPage
            ? "col-span-1 flex min-w-0 flex-col items-stretch overflow-x-hidden"
            : "app-shell-main col-span-1 flex min-w-0 flex-col items-stretch overflow-x-hidden md:col-start-2"}
      >
        {/*
          No vertical padding and no `mb-4` on the ad banner. The earlier
          `pt-16`/`py-6` chain plus a 24px banner gap pushed the page heading
          below the fold on a 900px-tall laptop, so the first thing a citizen saw
          was empty space. The banner now sits flush against the bar and the
          routed page supplies its own rhythm.
        */}
        <div className={isForumPage
          ? "relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
          : "relative flex w-full min-w-0 flex-1 flex-col overflow-x-hidden"}>
          {/*
            No wrapper margin and no vertical padding here. The previous
            `mb-4` around the ad banner plus each page's own `py-6` stacked into
            ~40px of dead space between the bar and the first heading, which
            pushed the dashboard hero below the fold on a 900px-tall laptop.
          */}
          {/*
            Municipality announcement strip. It sits above the routed page so a
            citizen sees an explicitly selected public notice before the
            advertising slot and routed page. Renders nothing when there is no
            published announcement.
          */}
          {!isForumPage && !isNewsPage && <BroadcastStrip placement="banner" />}
          {!isForumPage && !isNewsPage && <AnnouncementBanner />}
          {!isForumPage && !isNewsPage && showTopAd && <AdBanner position="top" />}
          {/*
            The routed page fades in on every navigation (opacity only: a transform
            would turn this wrapper into the containing block of fixed modals while
            it runs). The local Suspense keeps the navigation bar and sidebar on
            screen while a page chunk downloads, instead of swapping the whole
            shell for a full-screen spinner.
          */}
          <div
            key={isForumPage ? 'forum' : pathname}
            className={isForumPage
              ? "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
              : "page-enter flex w-full min-w-0 flex-1 flex-col"}
          >
            <Suspense fallback={<PageLoading />}>
              <Outlet />
              <GuidedTour />
            </Suspense>
          </div>
          <BroadcastPopup />
          <InstallAppBanner />
          {!isForumPage && !isNewsPage && <AppFooter />}
        </div>
      </main>
      </div>

      {!isForumPage && !isNewsPage && <MobileNav />}

      {/*
        One search palette for the whole app. Mounted here rather than in the
        top bar, because the bar no longer owns the state: on phones it is
        opened from the sheet, on desktop from Ctrl/⌘+K. The hook here is what
        registers that shortcut and gives both surfaces a single `isOpen`.
      */}
      <SearchPalette {...searchState} />

      <LeaderboardModal isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} />
      <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      <QuickReportModal isOpen={isQuickReportOpen} onClose={() => setIsQuickReportOpen(false)} />
    </div>
  );
}

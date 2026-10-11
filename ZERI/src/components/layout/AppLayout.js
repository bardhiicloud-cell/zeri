import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { useLanguage } from '../../lib/LanguageContext';
import { NetworkStatus } from './NetworkStatus';
import { NearbyAlerts } from './NearbyAlerts';
import { LeaderboardModal } from '../LeaderboardModal';
import { UserProfileModal } from '../UserProfileModal';
import { QuickReportModal } from '../QuickReportModal';
import { LocationDetectorModal } from '../LocationDetectorModal';
import { AppFooter } from '../AppFooter';
import AdBanner from '../AdBanner';
import NotificationsMenu from '../NotificationsMenu';
import { TopNavbar } from './TopNavbar';
import { AppSidebar } from './AppSidebar';
import { MobileNav } from './MobileNav';
import { SearchPalette, useGlobalSearch } from './GlobalSearch';
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
    const { language } = useLanguage();
    const currentUser = useStore((state) => state.currentUser);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [isQuickReportOpen, setIsQuickReportOpen] = useState(false);
    const searchState = useGlobalSearch();
    const goTo = (href) => {
        navigate(href);
    };
    return (
    /**
     * The shell is a vertical stack on mobile, and a CSS grid on desktop.
     *
     * On mobile the top bar is gone entirely and navigation lives in a bottom
     * tab bar plus a sheet, which is the pattern citizens already have in their
     * thumb. The desktop grid keeps the top bar and left sidebar, because on a
     * 24-inch monitor a bottom bar is 1400px away from the content.
     *
     * `md:pt-0` cancels `mobile-top-safe` below the breakpoint; the utility adds
     * `padding-top: 64px` at every width, and without the override the shell
     * started 64px below the top of the page, leaving a permanent gap.
     */
    _jsxs("div", { className: "grid min-h-screen w-full max-w-full grid-cols-1 bg-(--color-page) font-sans text-(--color-text) transition-colors mobile-bottom-safe md:pt-0 dark:bg-(--color-brand-dark) dark:text-white md:grid-cols-[248px_minmax(0,1fr)] md:grid-rows-[56px_minmax(0,1fr)]", children: [_jsx(LocationDetectorModal, {}), _jsx("div", { className: "pointer-events-none absolute left-0 right-0 top-0 z-[9999]", children: _jsx(NetworkStatus, {}) }), _jsx(NearbyAlerts, {}), _jsx("div", { className: "col-span-1 hidden md:col-span-2 md:block", children: _jsx(TopNavbar, { onOpenMobileMenu: () => goTo('/') }) }), _jsx(AppSidebar, { onNavigate: () => navigate(location.pathname) }), _jsx("main", { className: "col-span-1 flex min-w-0 flex-col items-stretch overflow-x-hidden md:col-start-2 md:row-start-2", children: _jsxs("div", { className: "relative flex w-full min-w-0 flex-1 flex-col overflow-x-hidden", children: [_jsx(AdBanner, { position: "top" }), _jsx(Outlet, {}), _jsx(AppFooter, {})] }) }, language), _jsx(MobileNav, {}), _jsx(SearchPalette, { ...searchState }), _jsx(LeaderboardModal, { isOpen: isLeaderboardOpen, onClose: () => setIsLeaderboardOpen(false) }), _jsx(UserProfileModal, { isOpen: isProfileModalOpen, onClose: () => setIsProfileModalOpen(false) }), _jsx(QuickReportModal, { isOpen: isQuickReportOpen, onClose: () => setIsQuickReportOpen(false) }), _jsx(NotificationsMenu, {})] }));
}

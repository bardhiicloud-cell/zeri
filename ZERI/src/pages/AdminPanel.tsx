import { dt } from '@/src/lib/dt';
import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { useStore } from '../lib/store';
import { BookOpen, Loader2, Menu, Search, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useLanguage } from '../lib/LanguageContext';
import {
  canAccessAdmin,
  canAccessSection,
  roleLabel,
  type AdminSection,
} from '../lib/adminPermissions';
import { MunicipalityScopeControl } from '../components/admin/MunicipalityScopeControl';
import { hashForSection, paramsFromHash, sectionFromHash } from '../lib/adminDeepLink';
import { AdminCountsProvider, useAdminCounts } from '../components/admin/AdminCountsContext';
import { NAV_BY_ID, NAV_SECTIONS, moduleTabs, sidebarSections } from '../components/admin/nav/navConfig';
import { SidebarNav, shortcutLabel } from '../components/admin/nav/SidebarNav';
import { CommandPalette } from '../components/admin/nav/CommandPalette';
import SectionGuidePanel from '../components/admin/SectionGuidePanel';
import { SECTION_GUIDES } from '../lib/adminGuides';
import { CONSOLES, CONSOLE_ROUTES, consolePathsFor, viewerFor, type ConsoleVariant } from '../lib/roleHome';

/**
 * The panel is the heaviest surface in the product: sixteen views over
 * hundreds of thousands of documents. Importing all of them eagerly made the
 * admin bundle as large as the whole public site, so a district officer on a
 * slow connection paid for the security console before seeing a single report.
 * Each view is code-split and fetched the first time it is opened.
 */
const AdminInbox = lazy(() => import('../components/admin/AdminInbox.tsx'));
const AdminDashboard = lazy(() => import('../components/admin/AdminDashboard.tsx'));
const AdminReports = lazy(() => import('../components/admin/AdminReports.tsx'));
const AdminUsers = lazy(() => import('../components/admin/AdminUsers.tsx'));
const AdminGIS = lazy(() => import('../components/admin/AdminGIS.tsx'));
const AdminSecurity = lazy(() => import('../components/admin/AdminSecurity.tsx'));
const AdminSettings = lazy(() => import('../components/admin/AdminSettings.tsx'));
const AdminAds = lazy(() => import('../components/admin/AdminAds.tsx'));
const AdminVideos = lazy(() => import('../components/admin/AdminVideos.tsx'));
const AdminNotifications = lazy(() => import('../components/admin/AdminNotifications.tsx'));
const AdminDonations = lazy(() => import('../components/admin/AdminDonations.tsx'));
const AdminAgents = lazy(() => import('../components/admin/AdminAgents.tsx'));
const AdminHealthRegistry = lazy(() => import('../components/admin/AdminHealthRegistry.tsx'));
const AdminForum = lazy(() => import('../components/admin/AdminForum.tsx'));
const AdminPolls = lazy(() => import('../components/admin/AdminPolls.tsx'));
const AdminNews = lazy(() => import('../components/admin/AdminNews.tsx'));
import { SupportRequestAlert } from '../components/admin/SupportRequestAlert';
const ReportTasksPanel = lazy(() => import('../components/admin/workflow/ReportTasksPanel.tsx'));
const ReportsSection = lazy(() => import('../components/admin/workflow/ReportsSection.tsx'));
const WorkflowCenter = lazy(() => import('../components/admin/workflow/WorkflowCenter.tsx'));
const AdminSupportChats = lazy(() => import('../components/admin/AdminSupportChats.tsx'));
const SupportOverview = lazy(() => import('../components/admin/SupportOverview.tsx'));
const AdminUpdates = lazy(() => import('../components/admin/AdminUpdates.tsx'));
const AdminAgentMonitoring = lazy(() => import('../components/admin/AdminAgentMonitoring.tsx'));
const MunicipalityProvisioning = lazy(() => import('../components/admin/MunicipalityProvisioning.tsx'));
const MonitoringPage = lazy(() => import('./MonitoringPage.tsx'));
const AgentPanelPage = lazy(() => import('./AgentPanelPage.tsx'));
const DebateConsole = lazy(() => import('../components/debate/DebateConsole').then((m) => ({ default: m.DebateConsole })));
const MunicipalityPanelPage = lazy(() => import('./MunicipalityPanelPage.tsx'));
const ModerationCenterPage = lazy(() => import('./ModerationCenterPage.tsx'));
const AdminWorkFacts = lazy(() => import('../components/admin/AdminWorkFacts.tsx'));
const AdminRoles = lazy(() => import('../components/admin/AdminRoles.tsx'));

const COLLAPSED_KEY = 'admin.nav.collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** True when the key event came from somewhere the person is typing. */
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable === true;
}

export default function AdminPanel({ variant = 'admin' }: { variant?: ConsoleVariant }) {
  const currentUser = useStore(state => state.currentUser);

  // NOTE: every hook must run before any conditional return. This component
  // renders a "Qasje e Mohuar" pane when the viewer loses admin rights (e.g.
  // they sign out while on /admin), and an early return above the hooks used to
  // crash with "Rendered fewer hooks than expected". The panel proper lives in
  // AdminPanelShell so the counters (which open Firestore queries) are only
  // created for a viewer who is actually allowed in.
  if (!canAccessAdmin(currentUser)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-slate-50 dark:bg-slate-900 transition-colors">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 dark:border-white/5 flex flex-col items-center max-w-lg">
          <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mb-6 border border-rose-100">
            <ShieldAlert className="w-12 h-12 text-rose-500" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 title-serif">{dt(`Qasje e Mohuar`)}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{dt(`Kjo faqe është rreptësisht e rezervuar për stafin e autorizuar dhe administratorët e sistemit.`)}</p>
          <button onClick={() => window.location.href = '#/login'} className="mt-8 px-8 py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] dark:shadow-none transition-all active:scale-95 w-full">{dt(`Kthehu tek Hyrja`)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminCountsProvider>
      <AdminPanelShell variant={variant} />
    </AdminCountsProvider>
  );
}

function AdminPanelShell({ variant }: { variant: ConsoleVariant }) {
  const currentUser = useStore(state => state.currentUser)!;
  const logout = useStore(state => state.logout);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { counts } = useAdminCounts();

  const brand = CONSOLES[variant];
  // An owner opening /agent or /menagjer sees that role's menu (and a banner says so).
  const { viewer, previewing } = useMemo(() => viewerFor(variant, currentUser), [variant, currentUser]);

  // Owners land on the overview; an agent on the work waiting for them; a
  // manager on the monitoring of the team.
  const [activeTab, setActiveTab] = useState<AdminSection>(() => {
    if (variant === 'manager' && canAccessSection(viewer, 'monitorim')) return 'monitorim';
    if (variant === 'admin' && (currentUser.role === 'admin' || currentUser.role === 'superadmin')) return 'dashboard';
    return 'inbox';
  });
  // Parameters carried by the link that opened the current section, e.g. the
  // report to open. Cleared when the person moves to another section.
  const [linkParams, setLinkParams] = useState<Record<string, string>>(() => paramsFromHash(window.location.hash));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(readCollapsed);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  // Sections whose guide this person has already opened: the button shows a dot on
  // the ones they have not, so a first-day user is pointed to the explanation.
  const [seenGuides, setSeenGuides] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('admin.guides.seen') ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });
  const openGuide = () => {
    setIsGuideOpen(true);
    setSeenGuides(previous => {
      if (previous.includes(activeTab)) return previous;
      const next = [...previous, activeTab];
      try { localStorage.setItem('admin.guides.seen', JSON.stringify(next)); } catch { /* the dot just returns next visit */ }
      return next;
    });
  };
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  /**
   * The visible list comes from a single capability check. Adding a role or a
   * section is one edit in adminPermissions.ts, and the sidebar can no longer
   * drift out of sync with what the server will actually accept.
   */
  const visibleSections = useMemo(
    () => NAV_SECTIONS.filter(section => canAccessSection(viewer, section.id)),
    [viewer]
  );

  const activeSection = NAV_BY_ID.get(activeTab);
  const activeVisible = visibleSections.some(section => section.id === activeTab);

  /** Where work is waiting, shown as a count beside the section. */
  const badges = useMemo<Partial<Record<AdminSection, number>>>(
    () => ({
      reports: counts.reportsPending ?? 0,
      support: counts.supportWaiting ?? 0,
    }),
    [counts.reportsPending, counts.supportWaiting]
  );

  /**
   * Opening a section also writes it to the URL hash, so a reload, a bookmark or
   * a pasted link returns to the same place. `replaceState` rather than a push:
   * moving between sections is not a page the Back button should walk through.
   */
  const selectSection = (id: AdminSection, params?: Record<string, string>) => {
    setActiveTab(id);
    setLinkParams(params ?? {});
    const target = `${window.location.pathname}${window.location.search}${hashForSection(id, params)}`;
    window.history.replaceState(window.history.state, '', target);
  };

  const toggleCollapsed = () => {
    setIsSidebarCollapsed(collapsed => {
      const next = !collapsed;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // Not persisted in private mode; the rail still collapses for this visit.
      }
      return next;
    });
  };

  /**
   * Deep linking. Staff arrive from a notification or a support ticket, and
   * dropping them on the dashboard loses the context of why they clicked, so
   * /admin#reports (and the legacy /approvals path) open the matching section.
   *
   * The hash is applied once, the first time the staffer has any visible
   * section. It used to be re-read on every render, so after arriving through a
   * deep link every click on another tab was immediately reverted to the linked
   * section.
   */
  const appliedDeepLink = useRef(false);
  useEffect(() => {
    if (visibleSections.length === 0) return;

    if (!appliedDeepLink.current) {
      appliedDeepLink.current = true;
      const linked = sectionFromHash(
        window.location.hash,
        visibleSections.map(section => section.id)
      );
      if (linked) {
        setActiveTab(linked);
        setLinkParams(paramsFromHash(window.location.hash));
        return;
      }
      // A link to a section this person cannot open lands on their own start page;
      // the address is rewritten to say so instead of keeping the refused section.
      if (window.location.hash) {
        const target = `${window.location.pathname}${window.location.search}${hashForSection(activeTab)}`;
        window.history.replaceState(window.history.state, '', target);
      }
    }

    // A staffer whose role cannot open the current section is moved to the first
    // one they can, rather than being shown an empty pane.
    if (!visibleSections.some(section => section.id === activeTab)) {
      setActiveTab(visibleSections[0].id);
    }
  }, [visibleSections, activeTab]);

  /**
   * A link followed while the panel is already open (a notification, a pasted
   * URL) changes only the hash, so the page does not reload and the mount-time
   * read above never sees it. `selectSection` writes the hash with replaceState,
   * which does not fire this event, so the panel cannot trigger itself.
   */
  useEffect(() => {
    const onHashChange = () => {
      const linked = sectionFromHash(
        window.location.hash,
        visibleSections.map(section => section.id)
      );
      if (linked) {
        setActiveTab(linked);
        setLinkParams(paramsFromHash(window.location.hash));
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [visibleSections]);

  // Ctrl/⌘+K opens "Shko te…" from anywhere; "/" does too, unless the person is
  // typing in a field. Esc closes the mobile drawer.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsPaletteOpen(open => !open);
      } else if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        setIsPaletteOpen(true);
      } else if (event.key === 'Escape') {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLogout = async () => {
    await signOut(auth).catch(() => undefined);
    logout();
    navigate('/login');
  };

  // A folded module highlights its parent in the sidebar; its own tab is in the strip above the page.
  const tabs = moduleTabs(activeTab, visibleSections);
  const sidebarActive = activeSection?.mergedInto && visibleSections.some(section => section.id === activeSection.mergedInto) ? activeSection.mergedInto : activeTab;
  const sidebarProps = {
    sections: sidebarSections(visibleSections),
    activeId: sidebarActive,
    onSelect: selectSection,
    badges,
    onOpenPalette: () => {
      setIsDrawerOpen(false);
      setIsPaletteOpen(true);
    },
    onGoToSite: () => navigate('/'),
    onLogout: handleLogout,
    // Only an owner gets these doors; for everyone else the list is empty.
    consoles: consolePathsFor(currentUser.role).includes('/agent') ? CONSOLE_ROUTES : [],
    brand,
    onOpenConsole: (path: string) => navigate(path),
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50 font-sans transition-colors dark:bg-slate-900">
      {/* Desktop rail */}
      <aside
        className={cn(
          'relative z-30 hidden shrink-0 border-r border-white/5 bg-slate-950 shadow-2xl transition-[width] duration-200 ease-in-out md:block',
          isSidebarCollapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <SidebarNav {...sidebarProps} collapsed={isSidebarCollapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      {/* Mobile drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[550] md:hidden" role="dialog" aria-modal="true" aria-label={dt(`Menyja e administrimit`)}>
          <button
            type="button"
            aria-label={dt(`Mbyll menunë`)}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsDrawerOpen(false)}
          />
          <div className="relative h-full w-72 max-w-[85vw] bg-slate-950 shadow-2xl">
            <SidebarNav {...sidebarProps} onClose={() => setIsDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-3 py-3 backdrop-blur-md sm:px-6 dark:border-white/10 dark:bg-slate-900/90">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label={dt(`Hap menunë`)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 md:hidden dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-xl dark:text-white">
              {activeVisible && activeSection ? activeSection.label : dt('Paneli Administrativ')}
            </h1>
            {activeVisible && activeSection && (
              <p className="hidden truncate text-[11px] text-slate-400 sm:block">{activeSection.hint}</p>
            )}
          </div>

          {SECTION_GUIDES[activeTab] && (
            <button
              type="button"
              onClick={openGuide}
              title={dt('Si punon ky seksion')}
              aria-label={dt('Si punon ky seksion')}
              className="relative inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{dt('Si punon')}</span>
              {!seenGuides.includes(activeTab) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-900" aria-hidden="true" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsPaletteOpen(true)}
            aria-label={dt(`Shko te…`)}
            title={`${dt(`Shko te…`)} (${shortcutLabel()})`}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 lg:min-w-[11rem] dark:border-white/10 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden flex-1 text-left lg:block">{dt(`Shko te…`)}</span>
            <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 lg:block dark:border-white/10">{shortcutLabel()}</kbd>
          </button>

          {/* The administrator works on one municipality at a time, and that
              choice has to be visible in the header of every section — the
              reports queue, the statistics, the map. A per-section dropdown
              was how a supervisor approved Prizren while believing they were
              looking at Prishtinë. */}
          <MunicipalityScopeControl />

          <div className="hidden flex-col text-right md:flex">
            <span className="max-w-[10rem] truncate text-xs font-bold text-slate-900 dark:text-white">{currentUser.name}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">{roleLabel(currentUser, language)}</span>
          </div>
          <div className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-xs font-bold text-rose-400 shadow-xs sm:flex dark:bg-slate-800">
            {currentUser.name.charAt(0)}
          </div>
        </header>

        {previewing && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 sm:px-6 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" role="status">
            <span>
              {variant === 'agent' ? dt('Po e shihni si Agjent.') : dt('Po e shihni si Menaxher i agjentëve.')}{' '}
              <span className="font-normal">{dt('Menuja është ajo e këtij roli; veprimet kryhen me të drejtat tuaja si administrator.')}</span>
            </span>
            <button type="button" onClick={() => navigate('/admin')} className="ml-auto rounded-lg bg-amber-900 px-3 py-1 text-[11px] font-bold text-white hover:bg-amber-800">
              {dt('Kthehu te Admin')}
            </button>
          </div>
        )}

        {/* Content */}
        <main className="custom-scrollbar relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/50 p-3 sm:p-6 lg:p-8 dark:bg-slate-950/40">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mx-auto min-h-full max-w-[1600px]"
            >
              {tabs.length > 0 && (
                <div role="tablist" aria-label={dt('Pjesët e modulit')} className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={tab.id === activeTab}
                      onClick={() => selectSection(tab.id)}
                      className={cn('-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-semibold', tab.id === activeTab ? 'border-rose-600 text-rose-700 dark:text-rose-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}
                    >
                      {dt(tab.nav)}
                    </button>
                  ))}
                </div>
              )}
              <Suspense fallback={
                <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                  <span className="text-xs font-semibold">{dt('Duke ngarkuar seksionin...')}</span>
                </div>
              }>
              {activeTab === 'inbox' && <AdminInbox onOpen={(section, params) => selectSection(section, params)} />}
              {activeTab === 'dashboard' && <AdminDashboard onTabChange={selectSection} />}
              {activeTab === 'updates' && <AdminUpdates onTabChange={(t: string) => selectSection(t as AdminSection)} />}
              {activeTab === 'reports' && <ReportsSection openReportId={linkParams.open} />}
              {activeTab === 'health' && <AdminHealthRegistry />}
              {activeTab === 'donations' && <AdminDonations />}
              {activeTab === 'users' && <AdminUsers />}
              {activeTab === 'agents' && <AdminAgents />}
              {activeTab === 'roles' && <AdminRoles />}
              {activeTab === 'workfacts' && <AdminWorkFacts />}
              {activeTab === 'municipalities' && <MunicipalityProvisioning />}
              {activeTab === 'monitoring' && <AdminAgentMonitoring />}
              {activeTab === 'monitorim' && <MonitoringPage />}
              {activeTab === 'agentpanel' && <AgentPanelPage />}
              {activeTab === 'komunapanel' && <MunicipalityPanelPage />}
              {activeTab === 'moderim' && <ModerationCenterPage />}
              {activeTab === 'ads' && <AdminAds />}
              {activeTab === 'videos' && <AdminVideos />}
              {activeTab === 'notifications' && (
                <AdminNotifications
                  onOpenPublicNews={canAccessSection(currentUser, 'news') ? () => selectSection('news') : undefined}
                />
              )}
              {activeTab === 'forum' && <AdminForum />}
              {activeTab === 'debate' && <DebateConsole />}
              {activeTab === 'support' && (<><SupportOverview /><AdminSupportChats openChatId={linkParams.open} /></>)}
              {activeTab === 'polls' && <AdminPolls />}
              {activeTab === 'news' && <AdminNews />}
              {activeTab === 'work' && <ReportTasksPanel />}
              {activeTab === 'workflow' && <WorkflowCenter />}
              {activeTab === 'security' && <AdminSecurity />}
              {activeTab === 'settings' && <AdminSettings />}
              {activeTab === 'categories' && <AdminGIS />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {isGuideOpen && (
        <SectionGuidePanel
          sectionId={activeTab}
          role={currentUser.role}
          onClose={() => setIsGuideOpen(false)}
          onGo={id => selectSection(id)}
          openable={new Set(visibleSections.map(section => section.id))}
        />
      )}

      {canAccessSection(viewer, 'support') && <SupportRequestAlert onOpen={(chatId) => selectSection('support', { open: chatId })} />}
      <CommandPalette
        open={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        sections={visibleSections}
        activeId={activeTab}
        badges={badges}
        onSelect={selectSection}
      />
    </div>
  );
}

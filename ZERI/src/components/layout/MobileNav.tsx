import { dt } from '@/src/lib/dt';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, PlusCircle, Menu, X, ShieldAlert, UserRound,
  LogOut, Search, ChevronRight, ChevronDown, Sun, Moon, MapPin, Building2,
  Plus, Check, Compass, Lightbulb, Vote, Wallet, Sparkles, LogIn, Handshake, Newspaper, Globe, FolderOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import { useGlobalSearch } from './GlobalSearch';
import { ALL_SIDEBAR_LINKS, LEGAL_NAV, isNavActive } from '../../lib/navigation';
import { SOCIAL_LINKS } from '../SocialIcons';
import { canAccessAdmin } from '../../lib/adminPermissions';
import { useThemePreference } from '../../lib/themePreference';
import { MunicipalitySwitcher } from './MunicipalitySwitcher.tsx';
import { ResponseNotificationsBell } from '../NewNewsBadge';
import { LANGUAGE_OPTIONS } from '../../lib/languageConstants';
import { useLanguageSwitch } from '../../lib/LanguageUrlSync';
import {
  ALL_SCOPE,
  isSpecificScope,
  scopeKey,
} from '../../lib/municipalityScope';

/**
 * Mobile navigation — floating dock, command sheet and municipality rail.
 *
 * Three decisions shape this file:
 *
 *  1. The dock is a *dock*, not a toolbar. It floats above a glass scrim with a
 *     raised centre action, and each tab carries its own active beam so a
 *     citizen can see where they are without reading labels.
 *
 *  2. The sheet is a *command surface*. It leads with the municipality control,
 *     because that is the one thing a citizen actually changes — and it used to
 *     stay out of the way until requested. The current municipality remains
 *     visible in a compact "Zona juaj" control, and the picker expands on tap.
 *
 *  3. Every reachable module is grouped under the same headings the desktop
 *     sidebar uses, so a citizen who learns the platform on a phone is not
 *     re-taught it on a laptop. The list is derived from src/lib/navigation.ts
 *     and never hand-maintained.
 */

/** Dock slots. Five fits a 360px device; six wraps. */
const TABS = [
  { href: '/', label: 'Ballina', icon: Home },
  { href: '/harta', label: 'Harta', icon: MapPin },
  { href: '/raporto', label: 'Raporto', icon: PlusCircle, primary: true },
  { href: '/lajme', label: 'Lajme', icon: Newspaper },
] as const;

/** The quick-action rail inside the sheet: things a citizen does, not reads. */
const QUICK_ACTIONS = [
  { href: '/raporto', label: 'Raporto', hint: 'Problem i ri', icon: PlusCircle, tone: 'from-blue-600 to-blue-800' },
  { href: '/raportet-e-mia', label: 'Të miat', hint: 'Raportet e mia · Track ID', icon: FolderOpen, tone: 'from-sky-500 to-cyan-700' },
  { href: '/lajmero', label: 'Lajm', hint: 'Raporto një lajm', icon: Newspaper, tone: 'from-emerald-600 to-teal-700' },
  { href: '/partneret', label: 'Partner', hint: 'Bëhuni partner', icon: Handshake, tone: 'from-amber-500 to-orange-600' },
] as const;

/** What the centre "+" offers: everything a citizen can send or look up in one tap. */
const CREATE_ACTIONS = [
  { id: 'report', label: 'Raporto një problem', hint: 'Dërgo foto dhe vendndodhje te komuna', icon: PlusCircle, tone: 'from-blue-500 to-blue-800', href: '/raporto' },
  { id: 'mine', label: 'Raportet e mia · Track ID', hint: 'Statusi i çdo dërgese; kërkoni edhe me Track ID', icon: FolderOpen, tone: 'from-sky-500 to-cyan-700', href: '/raportet-e-mia' },
  { id: 'news', label: 'Raporto një lajm', hint: 'Dërgo lajm, foto ose video te redaksia', icon: Newspaper, tone: 'from-emerald-500 to-teal-700', href: '/lajmero' },
  { id: 'idea', label: 'Propozo një ide', hint: 'Banka e ideve për përmirësimin e komunës', icon: Lightbulb, tone: 'from-amber-500 to-orange-600', href: '/Idea' },
  { id: 'poll', label: 'Voto në sondazhe', hint: 'Shpreh mendimin për çështje publike', icon: Vote, tone: 'from-rose-500 to-pink-700', href: '/sondazhet' },
  { id: 'help', label: 'Ndihmë dhe donacione', hint: 'Raste sociale dhe fonde', icon: Wallet, tone: 'from-indigo-500 to-violet-700', href: '/donacion' },
  { id: 'partner', label: 'Bëhuni partner', hint: 'Partneritet dhe reklamim në platformë', icon: Handshake, tone: 'from-orange-500 to-amber-700', href: '/partneret' },
] as const;

/** Municipalities surfaced as one-tap chips before the full 38-name picker. */
const SCOPE_SHORTCUTS = ['Prishtinë', 'Prizren', 'Pejë', 'Gjilan', 'Ferizaj', 'Mitrovicë', 'Gjakovë'] as const;

/** Module groups, mirroring the desktop sidebar's vocabulary. */
const GROUP_SPECS: { id: string; title: string; hrefs: string[] }[] = [
  { id: 'primary', title: 'Kryesore', hrefs: ['/', '/raporto', '/raportet-e-mia', '/harta', '/detailed-registry', '/lajme'] },
  { id: 'kosova', title: 'Kosova & Historia', hrefs: ['/kosova'] },
  { id: 'participate', title: 'Pjesëmarrja qytetare', hrefs: ['/Idea', '/sondazhet', '/projektet'] },
  {
    id: 'services',
    title: 'Shërbime & transparencë',
    hrefs: ['/shendetesia', '/sherbimet', '/komunat', '/kontakt-numrat', '/ndihma', '/donacion', '/statistikat'],
  },
];

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const logout = useStore((state) => state.logout);
  const userMunicipality = useStore((state) => state.userMunicipality);
  const setUserMunicipality = useStore((state) => state.setUserMunicipality);
  const { open: openSearch } = useGlobalSearch();
  const { isDark, toggleTheme } = useThemePreference();

  const isGuest = !currentUser || currentUser.role === 'guest';
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isScopeExpanded, setIsScopeExpanded] = useState(false);
  const [isLanguageExpanded, setIsLanguageExpanded] = useState(false);
  // Same URL-aware switch as the desktop top bar, so the visitor stays on the page they are reading.
  const { language, switchLanguage } = useLanguageSwitch();
  const currentLanguage = LANGUAGE_OPTIONS.find((l) => l.code === language) ?? LANGUAGE_OPTIONS[0];
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const isActive = (path: string) => isNavActive(path, location.pathname);

  const scoped = isSpecificScope(userMunicipality);
  const activeScope = scoped ? scopeKey(userMunicipality) : ALL_SCOPE;

  const grouped = useMemo(() => {
    const claimed = new Set(GROUP_SPECS.flatMap((spec) => spec.hrefs));
    const groups = GROUP_SPECS.map((spec) => ({
      id: spec.id,
      title: spec.title,
      items: ALL_SIDEBAR_LINKS.filter((link) => spec.hrefs.includes(link.href)),
    })).filter((group) => group.items.length > 0);

    // Anything added to navigation.ts but not claimed above still renders, so a
    // new module can never be silently unreachable on a phone.
    const leftovers = ALL_SIDEBAR_LINKS.filter((link) => !claimed.has(link.href));
    if (leftovers.length > 0) {
      groups.push({ id: 'other', title: 'Të tjera', items: leftovers });
    }
    return groups;
  }, []);

  /**
   * Groups start folded, except "Kryesore" and the group of the page being read:
   * the sheet used to unfold every module at once, a long list to scroll past
   * on a phone. One tap opens a group.
   */
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(['primary']));
  useEffect(() => {
    if (!isSheetOpen) return;
    const current = grouped.find((group) => group.items.some((item) => isNavActive(item.href, location.pathname)));
    setOpenGroups(new Set(['primary', ...(current ? [current.id] : [])]));
  }, [isSheetOpen, grouped, location.pathname]);
  const toggleGroup = (id: string) => setOpenGroups((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const close = () => {
    setIsSheetOpen(false);
    setIsScopeExpanded(false);
    setIsCreateOpen(false);
  };

  const startCreate = (href: string) => {
    setIsCreateOpen(false);
    navigate(href);
  };

  // Leaving the page by any route closes the menu.
  useEffect(() => {
    setIsCreateOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isCreateOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCreateOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCreateOpen]);
  const goTo = (href: string) => {
    close();
    navigate(href);
  };

  /**
   * Opening the sheet must not leave the page behind it scrollable: on iOS the
   * sheet drifts under the thumb while the body scrolls. The previous overflow
   * is restored rather than set to a hard-coded value, because a page that had
   * locked scrolling itself would otherwise be unlocked by closing this sheet.
   */
  useEffect(() => {
    if (!isSheetOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isSheetOpen]);

  return (
    <>
      {/*
        Floating dock. `fixed` with a safe-area inset, and the shell carries
        `mobile-bottom-safe` to reserve the space, so the last card on a page is
        never hidden behind it.
      */}
      <nav
        aria-label={dt('Navigimi kryesor')}
        className={cn('fixed inset-x-0 bottom-0 md:hidden', isCreateOpen ? 'z-[46]' : 'z-40')}
      >
        {/* Gradient scrim: keeps the dock legible over any page content. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-(--color-page) via-(--color-page)/85 to-transparent dark:from-(--color-brand-dark) dark:via-(--color-brand-dark)/85"
        />

        <div className="relative px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          <div className="relative mx-auto max-w-md">
            {/*
              Ambient glow behind the dock. The "advanced" read comes from this
              light rather than from heavier borders or louder gradients on the
              buttons themselves, which is what keeps it from looking like a
              toy at night.
            */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-2 -top-3 bottom-0 rounded-[28px] bg-gradient-to-r from-blue-500/0 via-blue-500/15 to-cyan-400/0 blur-xl dark:via-blue-400/25"
            />

            <ul className="relative grid grid-cols-5 items-end rounded-[22px] border border-white/60 bg-white/85 px-1 pt-1 shadow-[0_18px_45px_-20px_rgba(15,23,42,0.45)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-900/80 dark:shadow-[0_18px_45px_-18px_rgba(0,0,0,0.85)]">
              {TABS.slice(0, 2).map((tab) => (
                <li key={tab.href}>
                  <DockTab tab={tab} active={isActive(tab.href)} onClick={() => goTo(tab.href)} />
                </li>
              ))}

              {/* Raised primary action, centred between the other tabs. */}
              <li className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen((open) => !open)}
                  aria-label={dt('Krijo')}
                  aria-haspopup="menu"
                  aria-expanded={isCreateOpen}
                  className={cn(
                    'relative -mt-7 flex h-[58px] w-[58px] items-center justify-center rounded-[20px]',
                    'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800 text-white',
                    'shadow-[0_14px_30px_-8px_rgba(37,99,235,0.85)]',
                    'ring-4 ring-(--color-page) transition-transform active:scale-95',
                    'dark:ring-(--color-brand-dark)'
                  )}
                >
                  {/*
                    Slow halo pulse — reads as "this is the primary action".
                    `motion-safe` keeps it off for citizens who have asked the
                    operating system for reduced motion; it stops while open.
                  */}
                  {!isCreateOpen && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-[20px] bg-blue-400/40 motion-safe:animate-ping motion-safe:[animation-duration:3.2s]"
                    />
                  )}
                  <motion.span
                    aria-hidden="true"
                    animate={{ rotate: isCreateOpen ? 135 : 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                    className="relative flex"
                  >
                    <Plus className="h-7 w-7" strokeWidth={2.4} />
                  </motion.span>
                </button>
              </li>

              {/* Sign-in lives at the top of the Menu sheet for visitors. */}
              {TABS.slice(3).map((tab) => (
                <li key={tab.href}>
                  <DockTab tab={tab} active={isActive(tab.href)} onClick={() => goTo(tab.href)} />
                </li>
              ))}

              {/* "Menu" opens the sheet; it is the fifth slot so the grid stays 5-up. */}
              <li>
                <button
                  type="button"
                  onClick={() => setIsSheetOpen(true)}
                  aria-label={dt('Menuja')}
                  aria-expanded={isSheetOpen}
                  className={cn(
                    'flex w-full flex-col items-center gap-1 rounded-2xl py-2 text-[10px] font-bold transition-colors',
                    isSheetOpen
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  )}
                >
                  <Menu className="h-[22px] w-[22px]" aria-hidden="true" />
                  <span>{dt('Menu')}</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Create menu: rises from the centre button, one staggered card per action. */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-[45] md:hidden">
            <motion.button
              type="button"
              aria-label={dt('Mbyll')}
              onClick={() => setIsCreateOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-slate-950/55 md:backdrop-blur-md"
            />
            <div className="absolute inset-x-0 bottom-0 px-4 pb-[calc(max(env(safe-area-inset-bottom),0.5rem)+5.5rem)]">
              {/* Eight actions: on a short phone the list scrolls instead of running off the top. */}
              <ul role="menu" aria-label={dt('Krijo')} className="mx-auto flex max-h-[calc(100dvh-9rem)] max-w-md flex-col gap-2 overflow-y-auto overscroll-contain">
                {CREATE_ACTIONS.map((action, index) => (
                  <motion.li
                    key={action.id}
                    role="none"
                    initial={{ opacity: 0, y: 36, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 30, delay: (CREATE_ACTIONS.length - 1 - index) * 0.045 } }}
                    exit={{ opacity: 0, y: 24, scale: 0.96, transition: { duration: 0.14, delay: index * 0.02 } }}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => startCreate(action.href)}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-white/60 bg-white/92 p-2.5 text-left shadow-[0_16px_40px_-18px_rgba(15,23,42,0.55)] backdrop-blur-xl transition-transform active:scale-[0.98] dark:border-white/10 dark:bg-slate-900/90"
                    >
                      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br text-white shadow-sm', action.tone)}>
                        <action.icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-black text-slate-900 dark:text-white">{dt(action.label)}</span>
                        <span className="block truncate text-xs font-medium text-slate-500 dark:text-slate-400">{dt(action.hint)}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-active:translate-x-0.5 dark:text-slate-600" aria-hidden="true" />
                    </button>
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Sheet */}
      <AnimatePresence>
        {isSheetOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={dt('Menuja')}
            className="fixed inset-0 z-50 md:hidden"
          >
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              aria-label={dt('Mbyll menunë')}
              className="absolute inset-0 bg-slate-950/60 md:backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', duration: 0.34, bounce: 0 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                // A deliberate downward flick dismisses; a small wobble does not.
                if (info.offset.y > 120 || info.velocity.y > 700) close();
              }}
              className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[28px] border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl dark:border-white/10 dark:bg-slate-900"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-2.5" aria-hidden="true">
                <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>

              {/*
                Identity strip. The active scope is printed next to the brand so
                a citizen always sees which municipality the rest of the app is
                filtered to — the label used to exist only inside the desktop
                sidebar.
              */}
              <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-900 text-xs font-black text-white">
                    Z
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-slate-900 dark:text-white">
                      {dt('Menuja')}
                    </span>
                    <span className="block truncate text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      {scoped ? activeScope : dt('Të gjitha 38 komunat')}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <ResponseNotificationsBell />
                  <button
                    type="button"
                    onClick={toggleTheme}
                    aria-label={isDark ? dt('Ndërro te dita') : dt('Ndërro te natë')}
                    title={isDark ? dt('Ndërro te dita') : dt('Ndërro te natë')}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {isDark ? <Sun className="h-4 w-4 text-amber-500" aria-hidden="true" /> : <Moon className="h-4 w-4 text-blue-600" aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    aria-label={dt('Mbyll menunë')}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </span>
              </div>

              {/* Search sits directly under the identity strip: the only search on mobile. */}
              <div className="shrink-0 px-4 pb-3">
                <button
                  type="button"
                  onClick={() => {
                    close();
                    // Deferred so the sheet is gone before the palette mounts.
                    window.setTimeout(openSearch, 120);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-left text-sm font-semibold text-slate-500 transition-colors hover:border-blue-300 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400"
                >
                  <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {dt('Kërko faqe, komunë...')}
                  <span className="ml-auto rounded-md border border-slate-200 px-1.5 py-0.5 text-[9px] font-black text-slate-400 dark:border-white/10">
                    ⌘K
                  </span>
                </button>
              </div>

              <nav
                aria-label={dt('Modulet qytetare')}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 [overscroll-behavior:contain]"
              >
                {/*
                  Municipality scope stays compact until requested, keeping the
                  command sheet focused while leaving the full picker one tap
                  away.
                */}
                <section aria-labelledby="mobile-scope-heading" className="mb-4">
                  <button
                    id="mobile-scope-heading"
                    type="button"
                    aria-expanded={isScopeExpanded}
                    onClick={() => setIsScopeExpanded((expanded) => !expanded)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3.5 text-left transition-colors hover:border-blue-300 dark:border-white/10 dark:bg-slate-800/60"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                      <Compass className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        {dt('Zona juaj')}
                      </span>
                      <span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                        {scoped ? activeScope : dt('Të gjitha 38 komunat')}
                      </span>
                    </span>
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', isScopeExpanded && 'rotate-180')} aria-hidden="true" />
                  </button>

                  {isScopeExpanded && (
                    <div className="mt-2 rounded-2xl border border-slate-200/80 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-800/40">
                      <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-2">
                        <ScopeChip
                          label={dt('Kosova')}
                          hint="38"
                          active={!scoped}
                          icon={Building2}
                          onClick={() => {
                            setUserMunicipality(ALL_SCOPE);
                            setIsScopeExpanded(false);
                          }}
                        />
                        {SCOPE_SHORTCUTS.map((name) => (
                          <ScopeChip
                            key={name}
                            label={name}
                            active={scoped && activeScope === name}
                            icon={MapPin}
                            onClick={() => {
                              setUserMunicipality(name);
                              setIsScopeExpanded(false);
                            }}
                          />
                        ))}
                      </div>

                      <div className="rounded-xl border border-slate-200/80 bg-white px-1 pb-1 dark:border-white/10 dark:bg-slate-900/70">
                        <MunicipalitySwitcher inline />
                      </div>
                    </div>
                  )}
                </section>

                {/* Language picker: sits directly under the municipality selector, same row pattern. */}
                <section aria-labelledby="mobile-language-heading" className="mb-4 -mt-2">
                  <button
                    id="mobile-language-heading"
                    type="button"
                    aria-expanded={isLanguageExpanded}
                    onClick={() => setIsLanguageExpanded((expanded) => !expanded)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3.5 text-left transition-colors hover:border-blue-300 dark:border-white/10 dark:bg-slate-800/60"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                      <Globe className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        {dt('Gjuha')}
                      </span>
                      <span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                        <span aria-hidden="true">{currentLanguage.flag}</span> {currentLanguage.fullName}
                      </span>
                    </span>
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', isLanguageExpanded && 'rotate-180')} aria-hidden="true" />
                  </button>

                  {isLanguageExpanded && (
                    <div
                      role="radiogroup"
                      aria-label={dt('Gjuha')}
                      className="mt-2 grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/80 bg-slate-50 p-2 dark:border-white/10 dark:bg-slate-800/40"
                    >
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          role="radio"
                          aria-checked={language === lang.code}
                          onClick={() => {
                            switchLanguage(lang.code);
                            setIsLanguageExpanded(false);
                          }}
                          className={cn(
                            'flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-left text-xs font-bold transition-colors',
                            language === lang.code
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-slate-700 hover:bg-blue-50 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800'
                          )}
                        >
                          <span aria-hidden="true">{lang.flag}</span>
                          <span className="flex-1 truncate">{lang.fullName}</span>
                          {language === lang.code && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {/*
                  Account entry for guests, placed above everything else in the
                  sheet: signing in is what unlocks tracking one's own reports
                  and notifications, so it must not sit below the module list.
                */}
                {isGuest && (
                  <section aria-label={dt('Llogaria juaj')} className="mb-4 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-3.5 dark:border-blue-900/60 dark:from-blue-950/40 dark:to-slate-900">
                    <p className="text-sm font-black text-slate-900 dark:text-white">{dt('Llogaria juaj')}</p>
                    <p className="mt-0.5 text-[11px] font-medium leading-snug text-slate-500 dark:text-slate-400">
                      {dt('Ndiqni raportimet tuaja dhe merrni njoftime për përgjigjet.')}
                    </p>
                    <p className="mt-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:bg-white/5 dark:text-slate-200" data-testid="guest-id">
                      {dt('ID-ja juaj')}:{' '}
                      <span className="font-black text-blue-700 dark:text-blue-300">
                        {(currentUser as { guestLabel?: string } | null)?.guestLabel
                          ?? (currentUser?.name?.startsWith('Mysafir-') ? currentUser.name : dt('po caktohet…'))}
                      </span>
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Link
                        to="/login"
                        onClick={close}
                        className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 text-sm font-black text-white shadow-sm transition-transform active:scale-95"
                      >
                        <LogIn className="h-4 w-4" aria-hidden="true" />
                        {dt('Hyr')}
                      </Link>
                      <Link
                        to="/register"
                        onClick={close}
                        className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-800 transition-transform active:scale-95 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
                      >
                        {dt('Regjistrohu')}
                      </Link>
                    </div>
                  </section>
                )}

                {/*
                  Quick actions: the four things a citizen does rather than
                  reads. Every one of them is at most two taps from anywhere in
                  the app on a phone.
                */}
                <section aria-labelledby="mobile-actions-heading" className="mb-4">
                  <h3
                    id="mobile-actions-heading"
                    className="mb-2 flex items-center gap-2 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    {dt('Veprime të shpejta')}
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {QUICK_ACTIONS.map((action) => (
                      <Link
                        key={action.href}
                        to={action.href}
                        onClick={close}
                        className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white px-1 py-2.5 text-center transition-transform active:scale-95 dark:border-white/10 dark:bg-slate-800/60"
                      >
                        <span className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
                          action.tone
                        )}>
                          <action.icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="text-[10px] font-black leading-none text-slate-800 dark:text-slate-100">
                          {dt(action.label)}
                        </span>
                        <span className="text-[8px] font-semibold uppercase tracking-wider text-slate-400">
                          {dt(action.hint)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>

                {/*
                  Profile entry. This is where "my data, my password, my city"
                  lives on a phone: the account controls used to be reachable
                  only from a desktop-only menu, so a citizen on a phone could
                  not change their own name or password at all.
                */}
                {currentUser && currentUser.role !== 'guest' && (
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      window.setTimeout(() => window.dispatchEvent(new Event('zeri:open-profile')), 120);
                    }}
                    className="mb-4 flex min-h-12 w-full items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-3.5 text-left text-sm font-bold text-blue-900 transition-colors hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100 dark:hover:bg-blue-950/50"
                  >
                    <UserRound className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{currentUser.name || dt('Profili im')}</span>
                      <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-blue-700/70 dark:text-blue-200/70">
                        {dt('Profili, fjalëkalimi, qyteti')}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
                  </button>
                )}

                {/* Grouped module list, under the same headings the desktop sidebar uses. */}
                <div className="space-y-4">
                  {grouped.map((group) => {
                    const open = openGroups.has(group.id);
                    return (
                    <section key={group.id}>
                      <h3 className="mb-1.5">
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={`mobile-group-${group.id}`}
                          onClick={() => toggleGroup(group.id)}
                          className="flex min-h-10 w-full items-center gap-2 rounded-xl px-1 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <span className="flex-1">{dt(group.title)}</span>
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">{group.items.length}</span>
                          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
                        </button>
                      </h3>
                      {open && (
                      <ul id={`mobile-group-${group.id}`} className="space-y-0.5">
                        {group.items.map((item) => {
                          const active = isActive(item.href);
                          return (
                            <li key={item.href}>
                              <Link
                                to={item.href}
                                onClick={close}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                  'flex min-h-12 items-center gap-3 rounded-2xl px-3 transition-colors',
                                  active
                                    ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100'
                                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                                )}
                              >
                                <span className={cn(
                                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                                  active
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                )}>
                                  <item.icon className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-bold">{dt(item.label)}</span>
                                  {item.hint && (
                                    <span className="block truncate text-[10px] font-medium text-slate-400">
                                      {dt(item.hint)}
                                    </span>
                                  )}
                                </span>
                                <ChevronRight className="h-4 w-4 shrink-0 opacity-30" aria-hidden="true" />
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                      )}
                    </section>
                    );
                  })}
                </div>

                {canAccessAdmin(currentUser) && (
                  <>
                    <div className="my-3 h-px bg-slate-100 dark:bg-white/5" />
                    <Link
                      to="/admin"
                      onClick={close}
                      className="flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                      <ShieldAlert className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      {dt('Paneli Administrativ')}
                    </Link>
                  </>
                )}

                <div className="my-3 h-px bg-slate-100 dark:bg-white/5" />

                <Link
                  to="/partneret"
                  onClick={close}
                  className="mb-1 flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200/80 px-3 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Handshake className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{dt('Bëhu partner')}</span>
                    <span className="block truncate text-[10px] font-medium text-slate-400">{dt('Për institucione, biznese dhe OJQ')}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-30" aria-hidden="true" />
                </Link>

                {LEGAL_NAV.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={close}
                    className="flex min-h-11 items-center rounded-2xl px-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    {dt(link.label)}
                  </Link>
                ))}

                {/*
                  Social profiles. The desktop footer carries the same list, but on
                  a phone the footer sits at the bottom of a very long page — a
                  citizen would have to scroll past the entire dashboard to find it.
                  Repeating it here makes the accounts reachable from the one menu
                  that is always a single tap away.
                */}
                <div className="mt-3 rounded-2xl border border-slate-200/80 px-3 py-3 dark:border-white/10">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    {dt('Na ndiqni')}
                  </h3>
                  <ul className="mt-2.5 flex items-center gap-2">
                    {SOCIAL_LINKS.map(({ id, label, href, Icon }) => (
                      <li key={id}>
                        <a
                          href={href}
                          target="_blank"
                          rel="me noopener noreferrer"
                          aria-label={label}
                          title={label}
                          onClick={close}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-transparent hover:bg-slate-900 hover:text-white active:scale-95 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white dark:hover:text-slate-900"
                        >
                          <Icon className="h-[18px] w-[18px]" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {currentUser && currentUser.role !== 'guest' && (
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      logout();
                    }}
                    className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400"
                  >
                    <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    {dt('Dil nga llogaria')}
                  </button>
                )}
              </nav>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * One dock slot.
 *
 * The active marker is a shared `layoutId`, so framer-motion slides the beam
 * from the old tab to the new one instead of the marker blinking out and in —
 * that motion is what makes the dock read as a single control rather than five
 * independent buttons.
 */
function DockTab({
  tab,
  active,
  onClick,
}: {
  tab: { href: string; label: string; icon: typeof Home };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      to={tab.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={dt(tab.label)}
      className={cn(
        'relative flex w-full flex-col items-center gap-1 rounded-2xl py-2 text-[10px] font-bold transition-colors',
        active
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
      )}
    >
      {active && (
        <motion.span
          layoutId="mobile-dock-beam"
          aria-hidden="true"
          className="absolute inset-x-2 top-0 h-[3px] rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
      <tab.icon className="h-[22px] w-[22px]" aria-hidden="true" />
      <span>{dt(tab.label)}</span>
    </Link>
  );
}

/** A municipality shortcut in the sheet's horizontal rail. */
function ScopeChip({
  label,
  hint,
  active,
  icon: Icon,
  onClick,
}: {
  label: string;
  hint?: string;
  active: boolean;
  icon: typeof MapPin;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors',
        active
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300'
      )}
    >
      {active ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span className="whitespace-nowrap">{label}</span>
      {hint && (
        <span
          className={cn(
            'text-[9px] font-black uppercase tracking-wider',
            active ? 'text-blue-100' : 'text-slate-400'
          )}
        >
          {hint}
        </span>
      )}
    </button>
  );
}

import { dt } from '@/src/lib/dt';
import { BrandLogo } from '@/src/components/BrandLogo';
import { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import {
  ChevronDown, PlusCircle, FileText, LogIn, LogOut, ShieldAlert,
  Globe, Sun, Moon, Menu, Check, Home, UserRound,
} from 'lucide-react';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { TOP_NAV, LEGAL_NAV, type NavLink as NavLinkDef } from '../../lib/navigation';
import { canAccessAdmin } from '../../lib/adminPermissions';
import { isSpecificScope } from '../../lib/municipalityScope';
import { useThemePreference } from '../../lib/themePreference';
import { ResponseNotificationsBell } from '../NewNewsBadge';

import { LANGUAGE_OPTIONS } from '../../lib/languageConstants';
import { useLanguageSwitch } from '../../lib/LanguageUrlSync';

/**
 * Top navigation bar.
 *
 * Three zones: brand on the left, the primary sections centred, and the action
 * cluster on the right. Everything operational lives in the sidebar, so this row
 * stays short enough to be read at a glance and does not compete with it.
 */
export function TopNavbar({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const location = useLocation();
  // Switching language has to keep the visitor on the page they are reading,
  // so the switch goes through the URL helper rather than setLanguage alone.
  const { language, switchLanguage } = useLanguageSwitch();
  const currentUser = useStore((state) => state.currentUser);
  const logout = useStore((state) => state.logout);

  const { isDark, toggleTheme } = useThemePreference();
  const [openDropdown, setOpenDropdown] = useState<'none' | 'language' | 'profile'>('none');

  // Any route change closes whatever was open, otherwise the dropdown survives
  // a navigation and appears to be attached to the wrong page.
  useEffect(() => {
    setOpenDropdown('none');
  }, [location.pathname]);

  useEffect(() => {
    if (openDropdown === 'none') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenDropdown('none');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openDropdown]);

  const toggleDropdown = (name: typeof openDropdown) =>
    setOpenDropdown((current) => (current === name ? 'none' : name));

  const currentLanguage = LANGUAGE_OPTIONS.find((l) => l.code === language) ?? LANGUAGE_OPTIONS[0];
  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // The local session is cleared regardless, so the citizen is not stuck.
    }
    logout();
  };

  return (
    <header
      className="relative flex h-14 w-full shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 backdrop-blur-md sm:gap-4 sm:px-4 dark:border-white/10 dark:bg-slate-900"
    >
      {/*
        Mobile menu trigger. It lives in the same row on every breakpoint and is
        the first child so it always sits on the left edge. It used to be
        `md:hidden` inside a `hidden md:flex` header, which made it invisible at
        every width: hidden by the header below md, hidden by itself above md.
      */}
      <button
        type="button"
        onClick={onOpenMobileMenu}
        aria-label={dt('Menuja')}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50 md:hidden dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Brand */}
      <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label={dt('Zëri Qytetarëve — Ballina')}>
        <BrandLogo />
      </Link>

      {/* Primary links */}
      <nav
        aria-label={dt('Navigimi kryesor')}
        className="hidden min-w-0 flex-1 overflow-x-auto overflow-y-visible scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] md:block [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex w-max min-w-full items-center gap-0.5">
          {/*
            "Kryefaqja" is written out here rather than taken from TOP_NAV: it and
            "Komunat" occupy fixed positions (first and second) while the rest of
            the list is data-driven. Slicing TOP_NAV for "the first one" broke the
            moment an item was reordered, which is how the bar ended up rendering
            "Shërbimet Publike" in the home slot.
          */}
          <li className="shrink-0">
            <NavBarLink
              link={{ label: dt('Kryefaqja'), href: '/', icon: Home }}
              active={isActive('/')}
            />
          </li>

          {TOP_NAV.map((link) => (
            <li key={link.href} className="shrink-0">
              <NavBarLink link={link} active={isActive(link.href)} />
            </li>
          ))}
        </ul>
      </nav>

      {/*
        No search anywhere in this row. The palette is opened from the mobile
        sheet on phones and from Ctrl/⌘+K on desktop; a field here would compete
        with the seven links for the same 56px.
      */}

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* THE single notification bell — municipal responses to my reports */}
        <ResponseNotificationsBell />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? dt('Ndërro te dita') : dt('Ndërro te natë')}
          title={isDark ? dt('Ndërro te dita') : dt('Ndërro te natë')}
          className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 sm:flex dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {isDark ? <Sun className="h-4 w-4 text-amber-500" aria-hidden="true" /> : <Moon className="h-4 w-4 text-indigo-600" aria-hidden="true" />}
        </button>

        {/* Language */}
        <div className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => toggleDropdown('language')}
            aria-expanded={openDropdown === 'language'}
            aria-haspopup="true"
            aria-label={dt('Ndrysho gjuhën')}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-mono text-[10px] font-black uppercase">{currentLanguage.label}</span>
          </button>

          {/*
            The list is longer than the viewport can show at 23 languages
            (23 rows x 36px plus padding is ~850px), so the menu scrolls with a
            cap rather than running off the bottom of the screen and leaving the
            last entries — Australia, Canada — unreachable. `w-56` gives the
            longer native names room to sit on one line.
          */}
          {openDropdown === 'language' && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] z-50 max-h-[min(24rem,calc(100vh-6rem))] w-56 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-1.5 shadow-(--shadow-floating) dark:border-white/10 dark:bg-slate-900"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={language === lang.code}
                  onClick={() => {
                    switchLanguage(lang.code);
                    setOpenDropdown('none');
                  }}
                  className={cn(
                    'flex min-h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-xs font-bold transition-colors',
                    language === lang.code
                      ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                  )}
                >
                  <span aria-hidden="true">{lang.flag}</span>
                  <span className="flex-1 truncate">{lang.fullName}</span>
                  {language === lang.code && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <Link
          to="/trackid"
          className="hidden min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 lg:inline-flex dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          {dt('Track ID')}
        </Link>

        <Link
          to="/raporto"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-900 px-3 text-xs font-black text-white transition hover:brightness-110"
        >
          <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{dt('Raporto')}</span>
        </Link>

        {/* Account — guests (anonymous visitors) see the Sign-in button, not a profile */}
        {currentUser && currentUser.role !== 'guest' ? (
          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => toggleDropdown('profile')}
              aria-expanded={openDropdown === 'profile'}
              aria-haspopup="true"
              aria-label={dt('Menuja e profilit')}
              className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-2 transition-colors hover:bg-slate-50 dark:border-white/10 dark:hover:bg-slate-800"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-[10px] font-black text-white">
                {currentUser.name.charAt(0)}
              </span>
              <span className="hidden max-w-[7rem] truncate text-xs font-bold text-slate-700 lg:inline dark:text-slate-200">
                {currentUser.name}
              </span>
            </button>

            {openDropdown === 'profile' && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-(--shadow-floating) dark:border-white/10 dark:bg-slate-900">
                <div className="px-2.5 py-2">
                  <p className="truncate text-xs font-black text-slate-900 dark:text-white">{currentUser.name}</p>
                  <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                    {currentUser.email || dt('Përdorues i regjistruar')}
                  </p>
                </div>

                <div className="my-1 border-t border-slate-100 dark:border-white/5" />

                <button
                  type="button"
                  onClick={() => {
                    setOpenDropdown('none');
                    window.dispatchEvent(new Event('zeri:open-profile'));
                  }}
                  className="flex min-h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                  {dt('Profili im dhe cilësimet')}
                </button>

                {canAccessAdmin(currentUser) && (
                  <Link
                    to="/admin"
                    className="flex min-h-9 items-center gap-2.5 rounded-xl px-2.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    {dt('Paneli Administrativ')}
                  </Link>
                )}

                {LEGAL_NAV.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="flex min-h-9 items-center rounded-xl px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {dt(link.label)}
                  </Link>
                ))}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex min-h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  {dt('Dil')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
          {currentUser && (
            <span
              data-testid="guest-id"
              title={dt('ID-ja juaj si mysafir')}
              className="hidden h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-700 lg:inline-flex dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-[10px] font-black text-white" aria-hidden="true">M</span>
              {(currentUser as { guestLabel?: string }).guestLabel
                ?? (currentUser.name?.startsWith('Mysafir-') ? currentUser.name : dt('Mysafir • po caktohet…'))}
            </span>
          )}
          <Link
            to="/login"
            className="hidden h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-black text-white transition-colors hover:bg-slate-800 sm:inline-flex dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            {dt('Hyr')}
          </Link>
          </>
        )}
      </div>
    </header>
  );
}

function NavBarLink({ link, active }: { link: NavLinkDef; active: boolean }) {
  return (
    <NavLink
      to={link.href}
      end={link.href === '/'}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-9 items-center rounded-lg px-3 text-xs font-bold transition-colors',
        active
          ? 'text-(--color-brand-primary)'
          : 'text-slate-600 hover:bg-slate-50 hover:text-(--color-brand-primary) dark:text-slate-300 dark:hover:bg-slate-800'
      )}
    >
      <span className={cn('relative', active && 'after:absolute after:-bottom-1 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-(--color-brand-primary)')}>
        {dt(link.label)}
      </span>
    </NavLink>
  );
}

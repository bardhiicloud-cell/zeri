import { dt } from '@/src/lib/dt';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  PanelLeftClose, PanelLeftOpen, ShieldAlert, LogOut, FileText,
} from 'lucide-react';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import { ALL_SIDEBAR_LINKS, LEGAL_NAV, TOP_NAV_HREFS, isNavActive, type NavLink } from '../../lib/navigation';
import { SOCIAL_LINKS } from '../SocialIcons';
import { canAccessAdmin } from '../../lib/adminPermissions';
import { MunicipalitySwitcher } from './MunicipalitySwitcher';

/**
 * Left sidebar — the working modules, and only the working modules.
 *
 * It deliberately does NOT repeat what the top bar already shows. Komunat,
 * Shërbimet Publike, Projektet, Lajme, Kontakt and Rreth Projektit live in the
 * top bar on desktop; listing them here too meant the same six pages were
 * advertised twice on one screen and the column read as a duplicate menu rather
 * than as the task rail it is.
 *
 * The subtraction is `SIDEBAR_SUPPRESSED_HREFS` below — the top bar's section
 * links *plus* the two pages its action cluster owns (`/raporto`, `/trackid`).
 * It is applied to every group *and* to the "Të tjera" bucket — the bucket
 * catches anything the specs below forget, so without that filter an excluded
 * link would silently reappear there. The links themselves stay in
 * `navigation.ts`: on a phone there is no top bar, and the mobile sheet still
 * needs them.
 *
 * Density still matters. Rows are 32px with a 2px gap, a 13px label and an 18px
 * icon, so the whole list fits a 1080p screen without scrolling.
 */

/**
 * Hrefs the desktop sidebar must not render, because the top bar already does.
 *
 * The top bar has two zones: its section links (`TOP_NAV_HREFS`) and its action
 * cluster, which is always on screen and carries "Raporto" and "Track ID".
 * Both zones count, so both are listed here — a page shown twice in the same
 * 56px of chrome is exactly the duplication this removes.
 */
const SIDEBAR_SUPPRESSED_HREFS: ReadonlySet<string> = new Set([
  ...TOP_NAV_HREFS,
  '/raporto',
  '/trackid',
]);

const GROUP_SPECS: { id: string; title: string; hrefs: string[] }[] = [
  {
    id: 'primary',
    title: 'Kryesore',
    hrefs: ['/', '/raporto', '/harta', '/detailed-registry', '/trackid'],
  },
  {
    id: 'kosova',
    title: 'Kosova & Historia',
    hrefs: ['/kosova'],
  },
  {
    id: 'participate',
    title: 'Pjesëmarrja qytetare',
    // "Buxhetimi me pjesëmarrje" (/buxheti) is intentionally NOT listed here: the
    // page was never routed, so the entry was a dead link in the sidebar. Remove
    // the route and the link together — never re-add one without the other.
    hrefs: ['/idea', '/sondazhet'],
  },
  {
    id: 'services',
    title: 'Shërbime & transparencë',
    hrefs: ['/kontakt-numrat', '/ndihma', '/donacion', '/shendetesia', '/statistikat'],
  },
];

interface Group {
  id: string;
  title: string;
  items: NavLink[];
}
export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const currentUser = useStore((state) => state.currentUser);
  const logout = useStore((state) => state.logout);
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path: string) => isNavActive(path, location.pathname);

  const grouped: Group[] = GROUP_SPECS.map((spec) => ({
    id: spec.id,
    title: spec.title,
    items: ALL_SIDEBAR_LINKS.filter(
      (link) => spec.hrefs.includes(link.href) && !SIDEBAR_SUPPRESSED_HREFS.has(link.href)
    ),
  })).filter((group) => group.items.length > 0);

  // Anything added to navigation.ts but not claimed above still renders — the
  // "Të tjera" bucket catches it, so no module can go missing. The top-bar
  // filter applies here too, otherwise an excluded link would reappear in it.
  const claimed = new Set(GROUP_SPECS.flatMap((spec) => spec.hrefs));
  const leftovers = ALL_SIDEBAR_LINKS.filter(
    (link) => !claimed.has(link.href) && !SIDEBAR_SUPPRESSED_HREFS.has(link.href)
  );
  if (leftovers.length > 0) {
    grouped.push({ id: 'other', title: 'Të tjera', items: leftovers });
  }

  return (
    /**
     * The column is `sticky` to the viewport, not stretched by the grid row.
     *
     * `md:top-14` pins it directly under the 56px fixed top bar, and `md:sticky`
     * keeps it there for the entire scroll. `md:self-start` is what actually makes
     * `sticky` work inside a grid: without it the item is stretched to the row's
     * full height, so it has no room to travel and sticky silently does nothing.
     * The cell itself spans the whole row (`grid-row: 1 / -1` in index.css), which
     * is what gives that travel.
     *
     * The height is `100dvh - 56px` so the column ends exactly at the viewport's
     * bottom edge, leaving its own nav scrollable rather than pushing legal links
     * and the logout button past the fold.
     *
     * The aside is not rendered at all on the debate page (AppLayout skips it),
     * because that page owns a fixed-height shell of its own.
     */
    <aside
      className={cn(
        'app-shell-sidebar hidden shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900',
        'md:sticky md:top-14 md:col-start-1 md:col-span-1 md:flex md:h-[calc(100dvh-56px)] md:self-start',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'md:w-14' : 'md:w-[248px]'
      )}
    >
      {/*
        No separate "Ballina" button at the top. It is already the first entry of
        the "Kryesore" group below, and a second copy directly above it read as
        a duplicated control. "Raporto" is likewise owned by the top bar's action
        cluster rather than repeated here.
      */}

      {/*
        The whole column is one scroll container with `min-h-0`, so the list
        shrinks to the height it is given and scrolls internally rather than
        growing past the viewport. The footer — which now carries the global
        municipality switcher — sits outside it and is therefore always visible.
      */}
      <nav
        aria-label={dt('Modulet qytetare')}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 [overscroll-behavior:contain] [scrollbar-width:thin]"
      >
        {grouped.map((group) =>
          group.items.length === 0 ? null : (
            <div key={group.id} className="mb-3 last:mb-0">
              {!collapsed && (
                <>
                  <h2 className="mb-1 px-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400">
                    {dt(group.title)}
                  </h2>
                  <div className="mb-1.5 h-px bg-slate-100 dark:bg-white/5" />
                </>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        data-tour-menu={item.href}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        title={collapsed ? dt(item.label) : undefined}
                        className={cn(
                          'group relative flex h-8 items-center rounded-lg py-1.5 text-[13px] font-semibold transition-colors',
                          collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
                          active
                            ? 'bg-slate-100 text-slate-900 before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-blue-600 dark:bg-slate-800 dark:text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                        )}
                      >
                        <item.icon
                          className={cn(
                            'h-[18px] w-[18px] shrink-0 transition-colors',
                            active
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                          )}
                          aria-hidden="true"
                        />
                        {!collapsed && <span className="truncate leading-none">{dt(item.label)}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        )}

        {canAccessAdmin(currentUser) && (
          <>
            <div className="my-2 h-px bg-slate-100 dark:bg-white/5" />
            <Link
              to="/admin"
              onClick={onNavigate}
              title={collapsed ? dt('Paneli Administrativ') : undefined}
              className={cn(
                'group relative flex h-8 items-center rounded-lg py-1.5 text-[13px] font-bold text-rose-700 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30',
                collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
              )}
            >
              <ShieldAlert className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate leading-none">{dt('Paneli Administrativ')}</span>}
            </Link>
          </>
        )}
      </nav>

      {/*
        The global scope control. It is the first thing in the footer, above the
        legal links, so it reads as a page-level control rather than as one more
        link — and because the footer is outside the scroll container, changing
        the municipality is always one click away no matter how long the module
        list is.
      */}
      <MunicipalitySwitcher collapsed={collapsed} />

      {/* Footer — outside the scroll area, so it never scrolls out of view. */}
      <div className="shrink-0 px-1.5 pb-1.5">
        {/*
          Social profiles, above the legal links.

          The sidebar footer is pinned outside the nav's scroll container, so
          these are on screen for the whole session rather than only after
          scrolling to the page footer — which on a long dashboard is several
          screens away. When the column is collapsed there is no room for a row
          of icons, so the group is hidden rather than squeezed.
        */}
        {!collapsed && (
          <div className="mb-1 px-2.5 pt-1">
            <h2 className="text-xs font-black uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400">
              {dt('Na ndiqni')}
            </h2>
            <ul className="mt-1.5 flex items-center gap-1.5">
              {SOCIAL_LINKS.map(({ id, label, href, Icon }) => (
                <li key={id}>
                  <a
                    href={href}
                    target="_blank"
                    rel="me noopener noreferrer"
                    aria-label={label}
                    title={label}
                    onClick={onNavigate}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-transparent hover:bg-slate-900 hover:text-white dark:border-white/10 dark:text-slate-400 dark:hover:bg-white dark:hover:text-slate-900"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {LEGAL_NAV.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            onClick={onNavigate}
            title={collapsed ? dt(link.label) : undefined}
            className={cn(
              'flex h-7 items-center rounded-lg py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800',
              collapsed ? 'justify-center px-0' : 'gap-2 px-2.5'
            )}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate leading-none">{dt(link.label)}</span>}
          </Link>
        ))}

        {currentUser && currentUser.role !== 'guest' && (
          <button
            type="button"
            onClick={() => {
              logout();
              onNavigate?.();
            }}
            title={collapsed ? dt('Dil nga llogaria') : undefined}
            className={cn(
              'flex h-7 w-full items-center rounded-lg py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:text-slate-500 dark:hover:bg-rose-950/30',
              collapsed ? 'justify-center px-0' : 'gap-2 px-2.5'
            )}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate leading-none">{dt('Dil nga llogaria')}</span>}
          </button>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? dt('Zgjero menunë') : dt('Mblidh menunë')}
          aria-expanded={!collapsed}
          title={collapsed ? dt('Zgjero menunë') : dt('Mblidh menunë')}
          className={cn(
            'mt-0.5 flex h-7 w-full items-center rounded-lg py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200',
            collapsed ? 'justify-center px-0' : 'gap-2 px-2.5'
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <>
              <PanelLeftClose className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate leading-none">{dt('Mblidh menunë')}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

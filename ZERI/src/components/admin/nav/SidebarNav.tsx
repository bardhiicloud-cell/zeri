import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, Search, Shield, X } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../../lib/utils';
import type { AdminSection } from '../../../lib/adminPermissions';
import { resolveOpenGroups, toggleGroup } from '../../../lib/adminNav';
import { NAV_BY_ID, NAV_GROUPS, groupVisible, type NavGroupId, type NavSection } from './navConfig';

/**
 * The admin sidebar, used both as the desktop rail and inside the mobile drawer.
 *
 * What changed and why:
 *  - The six things staff open every shift sit at the top, always visible. The
 *    rest are in three groups that stay open until you close them; before, every
 *    click closed the other groups, so moving between two related pages meant
 *    reopening a menu each time.
 *  - Counts on Reports and Support say where work is waiting without opening
 *    anything.
 *  - "Shko te…" (Ctrl+K) reaches any page by typing a word, in Albanian or
 *    English, with or without accents.
 */

const GROUPS_KEY = 'admin.nav.groups';

function readOpenGroups(): NavGroupId[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(GROUPS_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((id): id is NavGroupId => typeof id === 'string' && id in NAV_GROUPS && id !== 'daily')
      : [];
  } catch {
    return [];
  }
}

function saveOpenGroups(groups: NavGroupId[]): void {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  } catch {
    // Private mode or blocked storage: the menu simply forgets between visits.
  }
}

/** "⌘K" on a Mac, "Ctrl K" elsewhere. */
export function shortcutLabel(): string {
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform || navigator.userAgent;
  return /mac|iphone|ipad/i.test(platform) ? '⌘K' : 'Ctrl K';
}

const RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950';

function Badge({ count, active }: { count: number; active: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'ml-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums',
        active ? 'bg-white/25 text-white' : 'bg-rose-500 text-white'
      )}
      aria-label={`${count} ${dt(`në pritje`)}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function NavButton({
  section,
  active,
  badge,
  collapsed,
  onSelect,
}: {
  section: NavSection;
  active: boolean;
  badge: number;
  collapsed: boolean;
  onSelect: (id: AdminSection) => void;
}) {
  const Icon = section.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(section.id)}
      title={collapsed ? `${section.nav}${badge > 0 ? ` (${badge})` : ''}` : section.hint}
      aria-label={collapsed ? section.nav : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex w-full items-center rounded-lg text-[13px] font-medium transition-colors',
        collapsed ? 'min-h-10 justify-center' : 'min-h-9 gap-2.5 px-2.5',
        active ? 'bg-rose-600 font-semibold text-white shadow-md shadow-rose-600/25' : 'text-slate-300 hover:bg-white/5 hover:text-white',
        RING
      )}
    >
      <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200')} aria-hidden={true} />
      {!collapsed && <span className="truncate">{section.nav}</span>}
      {!collapsed && <Badge count={badge} active={active} />}
      {collapsed && badge > 0 && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-400 ring-2 ring-slate-950" aria-hidden="true" />
      )}
    </button>
  );
}

export interface SidebarNavProps {
  /** Only the sections this viewer may open. */
  sections: readonly NavSection[];
  activeId: AdminSection;
  onSelect: (id: AdminSection) => void;
  /** Work waiting per section, e.g. pending reports. Zero or missing shows nothing. */
  badges: Partial<Record<AdminSection, number>>;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onOpenPalette: () => void;
  onGoToSite: () => void;
  onLogout: () => void;
  /** Present in the mobile drawer: shows a close button. */
  onClose?: () => void;
  /** Other roles' places an owner may open. Empty for everyone else. */
  consoles?: readonly { path: string; label: string; hint: string }[];
  onOpenConsole?: (path: string) => void;
  /** The wordmark for this place (Admin, Agjent, Menaxher). */
  brand?: { name: string; subtitle: string };
}

export function SidebarNav({
  sections,
  activeId,
  onSelect,
  badges,
  collapsed = false,
  onToggleCollapsed,
  onOpenPalette,
  onGoToSite,
  onLogout,
  onClose,
  consoles = [],
  onOpenConsole,
  brand = { name: 'Admin', subtitle: 'Sistemi Qendror' },
}: SidebarNavProps) {
  const groups = useMemo(() => groupVisible(sections), [sections]);
  const activeGroup = NAV_BY_ID.get(activeId)?.group ?? null;

  const [remembered, setRemembered] = useState<NavGroupId[]>(readOpenGroups);
  const open = resolveOpenGroups(remembered, activeGroup);

  const toggle = (group: NavGroupId) => {
    // The group holding the current page stays open so the page is never hidden.
    if (group === activeGroup) return;
    setRemembered(previous => {
      const next = toggleGroup(previous, group);
      saveOpenGroups(next);
      return next;
    });
  };

  const select = (id: AdminSection) => {
    onSelect(id);
    onClose?.();
  };

  const item = (section: NavSection) => (
    <li key={section.id}>
      <NavButton
        section={section}
        active={section.id === activeId}
        badge={badges[section.id] ?? 0}
        collapsed={collapsed}
        onSelect={select}
      />
    </li>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Brand */}
      <div className={cn('flex shrink-0 items-center border-b border-white/10 p-3', collapsed ? 'justify-center' : 'justify-between')}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 shadow-lg shadow-rose-500/25">
            <Shield className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-lg font-bold leading-none tracking-wide text-white">
                {dt(brand.name)}<span className="text-rose-500">.</span>KS
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{dt(brand.subtitle)}</p>
            </div>
          )}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={dt(`Mbyll menunë`)} className={cn('rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white', RING)}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        {!onClose && onToggleCollapsed && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={dt(`Palos menunë`)}
            aria-label={dt(`Palos menunë`)}
            className={cn('hidden rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white md:flex', RING)}
          >
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Go to… */}
      <div className={cn('shrink-0 px-2 pt-3', collapsed && 'flex flex-col items-center gap-1')}>
        {collapsed ? (
          <>
            <button
              type="button"
              onClick={onOpenPalette}
              title={`${dt(`Shko te…`)} (${shortcutLabel()})`}
              aria-label={dt(`Shko te…`)}
              className={cn('flex h-10 w-full items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white', RING)}
            >
              <Search className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            {onToggleCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                title={dt(`Zgjero menunë`)}
                aria-label={dt(`Zgjero menunë`)}
                className={cn('hidden h-10 w-full items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white md:flex', RING)}
              >
                <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onOpenPalette}
            className={cn('flex h-9 w-full items-center gap-2 rounded-lg bg-white/5 px-3 text-[13px] text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200', RING)}
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">{dt(`Shko te…`)}</span>
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{shortcutLabel()}</kbd>
          </button>
        )}
      </div>

      {/* Sections */}
      <nav aria-label={dt(`Menyja e administrimit`)} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group, index) => {
          const isDaily = group.id === 'daily';
          const isOpen = isDaily || open.includes(group.id);

          return (
            <section key={group.id} className={cn(index > 0 && (collapsed ? 'mt-2 border-t border-white/10 pt-2' : 'mt-3'))}>
              {!collapsed && !isDaily && (
                <button
                  type="button"
                  onClick={() => toggle(group.id)}
                  aria-expanded={isOpen}
                  aria-controls={`admin-nav-${group.id}`}
                  className={cn(
                    'mb-1 flex min-h-7 w-full items-center justify-between rounded-md px-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-colors',
                    group.id === activeGroup ? 'cursor-default' : 'hover:text-slate-300',
                    RING
                  )}
                >
                  <span>{dt(group.label)}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen ? 'rotate-180' : '')} aria-hidden="true" />
                </button>
              )}
              {isOpen && (
                <ul id={`admin-nav-${group.id}`} className="space-y-0.5">
                  {group.items.map(item)}
                </ul>
              )}
            </section>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn('flex shrink-0 flex-col gap-1.5 border-t border-white/10 p-2')}>
        {consoles.length > 0 && onOpenConsole && !collapsed && (
          <div className="mb-1">
            <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{dt(`Hap si…`)}</p>
            <ul className="space-y-0.5">
              {consoles.map(console => (
                <li key={console.path}>
                  <button
                    type="button"
                    onClick={() => onOpenConsole(console.path)}
                    title={dt(console.hint)}
                    className={cn('flex min-h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium text-slate-300 hover:bg-white/5 hover:text-white', RING)}
                  >
                    <span className="truncate">{dt(console.label)}</span>
                    <span className="ml-auto font-mono text-[10px] text-slate-500">{console.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={onGoToSite}
          title={collapsed ? dt(`Shiko Platformën`) : undefined}
          aria-label={collapsed ? dt(`Shiko Platformën`) : undefined}
          className={cn(
            'flex w-full items-center rounded-lg bg-white/5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white',
            collapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-2.5',
            RING
          )}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span>{dt(`Shiko Platformën`)}</span>}
        </button>
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? dt(`Mbyll Sesionin`) : undefined}
          aria-label={collapsed ? dt(`Mbyll Sesionin`) : undefined}
          className={cn(
            'flex w-full items-center rounded-lg bg-rose-500/10 text-xs font-semibold text-rose-400 transition-colors hover:bg-rose-600 hover:text-white',
            collapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-2.5',
            RING
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span>{dt(`Mbyll Sesionin`)}</span>}
        </button>
      </div>
    </div>
  );
}

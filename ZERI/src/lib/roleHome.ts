/**
 * Where each kind of account works.
 *
 * People do not sign in to "the admin"; they sign in to their own place:
 *
 *   /admin     owners (superadmin, admin)
 *   /agent     everyone an administrator gave access to something - approvals,
 *              donations, health, news, ads - whatever mix they were granted
 *   /menagjer  the manager of the agents: monitoring, read-only
 *   /komuna    a municipality's own console
 *   /          citizens and guests (the public site)
 *
 * The URL is only a doorway. What opens inside it is decided by the role and by
 * the sections the administrator granted, on the server as well as in the page.
 */

export type ConsoleVariant = 'admin' | 'agent' | 'manager';

export interface ConsoleBrand {
  /** The wordmark in the sidebar, e.g. "Agjent". The ".KS" is appended. */
  name: string;
  /** The small line under it. */
  subtitle: string;
  /** The section a person lands on after signing in. */
  landing: 'dashboard' | 'inbox' | 'monitorim';
}

export const CONSOLES: Record<ConsoleVariant, ConsoleBrand> = {
  admin: { name: 'Admin', subtitle: 'Sistemi Qendror', landing: 'dashboard' },
  agent: { name: 'Agjent', subtitle: 'Paneli i punës', landing: 'inbox' },
  manager: { name: 'Menaxher', subtitle: 'Mbikëqyrja e ekipit', landing: 'monitorim' },
};

const OWNER_ROLES = ['admin', 'superadmin'];
/** Every account that works through grants: the old editorial roles are just mixes of them. */
const AGENT_ROLES = ['agent', 'responder', 'dispatcher', 'moderator', 'approver', 'newsadmin', 'adsadmin'];

export function homeForRole(role: string | null | undefined): string {
  if (!role) return '/';
  if (OWNER_ROLES.includes(role)) return '/admin';
  if (role === 'municipality') return '/komuna';
  if (role === 'debatwp') return '/debatwp';
  if (role === 'monitor') return '/menagjer';
  if (AGENT_ROLES.includes(role)) return '/agent';
  return '/';
}

/** The doors an owner can open to look at, or work in, any other role's place. */
export const CONSOLE_ROUTES = [
  { path: '/agent', label: 'Agjentët', hint: 'Si e shohin punën agjentët' },
  { path: '/menagjer', label: 'Menaxheri', hint: 'Mbikëqyrja e ekipit' },
  { path: '/komuna', label: 'Komunat', hint: 'Konsola e një komune' },
  { path: '/debatwp', label: 'Debati', hint: 'Admini i debatit publik' },
] as const;

/**
 * Every console path this account may open.
 *
 * The owner (admin, superadmin) may open all of them: the superadmin is the one
 * person who must be able to see exactly what an agent, a manager or a
 * municipality sees, including a municipality's own account. Everyone else may
 * open only their own home. The server enforces the real limits; this decides
 * only which doors the page shows.
 */
export function consolePathsFor(role: string | null | undefined): string[] {
  const home = homeForRole(role);
  if (home === '/admin') return ['/admin', ...CONSOLE_ROUTES.map(route => route.path)];
  return home === '/' ? [] : [home];
}

/** Which console a role belongs to, or null for roles with no console of their own. */
export function consoleFor(role: string | null | undefined): ConsoleVariant | null {
  const home = homeForRole(role);
  if (home === '/admin') return 'admin';
  if (home === '/agent') return 'agent';
  if (home === '/menagjer') return 'manager';
  return null;
}

export interface Viewer {
  role: string;
  email?: string;
  permissions?: readonly string[];
}

/**
 * Whose menu to draw.
 *
 * An owner who opens /agent or /menagjer is there to see what that role sees, so
 * the menu is built for a plain account of that role with no extra grants. Anyone
 * else gets their own menu whatever the address says: the address never widens
 * what a person may open. `previewing` tells the page to say so in a banner.
 * Only the menu changes; the server still judges every action by who the owner is.
 */
export function viewerFor(variant: ConsoleVariant, user: Viewer): { viewer: Viewer; previewing: boolean } {
  const isOwner = user.role === 'admin' || user.role === 'superadmin';
  if (!isOwner || variant === 'admin') return { viewer: user, previewing: false };
  return { viewer: { role: variant === 'agent' ? 'agent' : 'monitor', permissions: [] }, previewing: true };
}

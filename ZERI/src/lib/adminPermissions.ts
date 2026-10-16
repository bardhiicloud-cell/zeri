import type { User } from '../types';

/** The role values the backend can assign. Kept aligned with types.ts. */
type UserRole = User['role'];

/**
 * Central capability map for the admin panel.
 *
 * The previous implementation spread the same role checks across thirteen
 * places in the UI. That is not only verbose, it is a security smell: a
 * frontend check is a usability affordance, never an authorisation decision, and
 * having it duplicated in a dozen components is how one copy drifts from the
 * others and quietly exposes a tab the backend was already protecting.
 *
 * The authoritative decision is always made by the server, in
 * `server/auth.ts::requireAdmin`, from a custom claim that the client cannot
 * write. This module exists so the UI can hide what the user cannot do without
 * re-deriving the policy in every component.
 */

export type StaffRole =
  | 'admin'
  | 'superadmin'
  | 'approver'
  | 'adsadmin'
  | 'newsadmin'
  /** Admin of the public debate: payments, verification, debate ads and post moderation. */
  | 'debatwp'
  | 'agent'
  | 'responder'
  | 'dispatcher'
  | 'monitor'
  | 'municipality';

/** A role as stored on a record, which may predate the current union. */
export type UserRoleLike = User['role'];

export type AdminSection =
  | 'dashboard'
  /**
   * The work inbox. Derived, never granted: whoever may open the dashboard sees
   * what is waiting on them, and each item inside is still filtered by the
   * section it belongs to (a record is only listed if its own section is open).
   */
  | 'inbox'
  | 'updates'
  | 'reports'
  | 'workfacts'
  | 'health'
  | 'donations'
  | 'users'
  | 'agents'
  | 'municipalities'
  | 'monitoring'
  /**
   * The three role consoles, exposed as admin sections so the owner reaches
   * them from the sidebar. They are the same pages the roles themselves use at
   * `/monitorim`, `/agent` and `/komuna` — one implementation, two doorways,
   * so the owner and the agent can never be looking at different numbers.
   */
  | 'monitorim'
  | 'agentpanel'
  | 'komunapanel'
  /** The moderation centre, so it can be granted to a field agent too. */
  | 'moderim'
  /**
   * The role catalogue: a complete, readable description of every role's access.
   * Read-only — a reference for whoever is assigning access, not a way to grant
   * it. Only owners (admin/superadmin) see it.
   */
  | 'roles'
  | 'ads'
  | 'videos'
  | 'notifications'
  | 'forum'
  /** The public-debate console (`/debatwp`): payments, ticks, debate ads, post moderation. */
  | 'debate'
  /**
   * The staged approval board: reports, donations, health cases and news on one set of
   * stages. It has no grant of its own - it opens for whoever may open any of those
   * four, and each move is still checked by the server for the field it belongs to.
   */
  | 'workflow'
  /** The work queue (tasks, referrals, moderation cases). Derived like the inbox: the server decides what each role may see in it. */
  | 'work'
  | 'support'
  | 'polls'
  | 'news'
  /** The Kosovo identity & history archive (/kosova, /historia-e-uck): articles, timelines, sources, workflow. */
  | 'heritage'
  | 'security'
  | 'settings'
  | 'categories';

/**
 * Sections an administrator or superadmin may open.
 *
 * `municipalities` is in the full-access list but in no other role's list: only
 * a superadmin may create a municipal account, because creating one means
 * accepting the editorial firewall clause on the platform's behalf.
 */
export const FULL_ACCESS: readonly AdminSection[] = [
  'dashboard', 'updates', 'reports', 'workfacts', 'health', 'donations', 'users',
  'agents', 'municipalities', 'monitoring', 'monitorim', 'agentpanel', 'komunapanel', 'moderim',
  'roles',
  'ads', 'videos', 'notifications', 'forum', 'debate', 'support', 'polls', 'news', 'heritage', 'security', 'settings', 'categories',
];

/**
 * The role → section map.
 *
 * Exported so the role catalogue (`roleCatalog.ts`) can *describe* a role from
 * the same table the guard *enforces* from — one definition, two readers, no
 * chance of the documentation drifting away from the behaviour.
 */
/** Least-privilege grants per role. Keys mirror the User['role'] union. */
export const BY_ROLE: Partial<Record<UserRole, readonly AdminSection[]>> = {
  admin: FULL_ACCESS,
  superadmin: FULL_ACCESS,

  // Municipal approver: works the incoming queue, not the platform settings.
  approver: ['dashboard', 'reports', 'workfacts', 'health', 'donations', 'notifications', 'forum', 'polls', 'categories', 'support'],

  // Commercial: ad inventory and the campaigns it appears in. Nothing else.
  adsadmin: ['dashboard', 'ads', 'videos', 'notifications'],

  // Editorial: publishes news and moderates the public debate.
  newsadmin: ['dashboard', 'notifications', 'news', 'heritage', 'videos', 'forum', 'polls'],

  // Public debate: owns the debate's payments, verification ticks, ads and post moderation.
  // Deliberately no reports, users, health or platform settings.
  debatwp: ['dashboard', 'debate', 'forum'],

  // Frontline staff: handle the queue, moderate the public debate, publish
  // notices and answer citizen support — change no platform setting.
  // `forum`, `news` and `support` are granted so a section lead can spread the
  // work without granting full admin. Removing one is a single-array edit.
  agent: ['dashboard', 'reports', 'support', 'forum', 'news', 'notifications', 'agentpanel'],
  responder: ['dashboard', 'reports', 'support', 'forum', 'agentpanel'],
  dispatcher: ['dashboard', 'reports', 'support', 'forum', 'notifications', 'agentpanel'],

  /**
   * Paying municipal account.
   *
   * Deliberately narrow. A municipality is the *subject* of the reporting, so it
   * gets the tools to answer and to correct facts, and nothing that removes
   * content:
   *
   *   - `reports`  : read the queue for its own municipality and respond to it
   *   - `health`   : the same for the health registry
   *   - `donations`: acknowledge and co-sign donation appeals
   *
   * It does NOT get `users`, `agents`, `monitoring`, `security`, `settings`,
   * `ads` or `news`. Those would let a customer see citizen identities, watch
   * staff, or shape what gets published — each one a censorship path.
   *
   * The remaining restrictions live in editorialFirewall.ts, which denies the
   * destructive actions even where a section is otherwise visible.
   */
  municipality: ['dashboard', 'reports', 'health', 'donations'],

  /**
   * Oversight. Reads the reports queue, the monitoring consoles and the audit
   * trail; every write path (status changes, assignments, moderation, user
   * management) refuses this role on the server, so these sections open in a
   * read-only state. It has no health, donations, users, ads, news or settings.
   */
  monitor: ['dashboard', 'reports', 'monitorim', 'updates', 'security'],
};

export const STAFF_ROLES: readonly StaffRole[] = [
  'admin', 'superadmin', 'approver', 'adsadmin', 'newsadmin', 'debatwp',
  'agent', 'responder', 'dispatcher', 'monitor', 'municipality',
];

export const isStaffRole = (role: unknown): role is StaffRole =>
  typeof role === 'string' && (STAFF_ROLES as readonly string[]).includes(role);

/**
 * Accounts that predate the custom-claim system.
 *
 * Previously this list also contained a hard-coded `admin@kosova.com` that
 * granted full access from a Firestore field — meaning anyone able to write
 * that document could promote themselves. The list is now empty by design and
 * kept only as a migration seam: add an entry, deploy, then remove it.
 */
const LEGACY_FULL_ACCESS_EMAILS: readonly string[] = [];

export function canAccessAdmin(user: Pick<User, 'role' | 'email'> | null | undefined): boolean {
  if (!user) return false;
  if (isStaffRole(user.role)) return true;
  return LEGACY_FULL_ACCESS_EMAILS.includes(user.email ?? '');
}

export function canAccessSection(
  user: { role: string; email?: string; permissions?: readonly string[] } | null | undefined,
  section: AdminSection
): boolean {
  if (!user) return false;

  if (section === 'inbox') return canAccessSection(user, 'dashboard');
  if (section === 'work') return canAccessSection(user, 'dashboard');
  if (section === 'workflow') {
    return (['reports', 'donations', 'health', 'news'] as const).some(s => canAccessSection(user, s));
  }

  // A full admin always has every section.
  if (user.role === 'admin' || user.role === 'superadmin') return true;
  if (LEGACY_FULL_ACCESS_EMAILS.includes(user.email ?? '')) return true;

  // An explicit per-section grant from the backend wins over the role defaults,
  // so an administrator can widen a single staffer's access without inventing
  // a new role.
  if (Array.isArray(user.permissions) && user.permissions.includes(section as never)) {
    return true;
  }

  /**
   * Alias: the sidebar section and the page grant are spelled differently.
   *
   * The pages live at `/monitorim`, `/agent` and `/komuna`, while the sidebar
   * sections are `monitorim`, `agentpanel` and `komunapanel`. An operator
   * ticking "Paneli i Agjentit" stores `agents` (the grant the route checks),
   * so without this mapping the menu item never appears even though the page
   * itself would open — the exact "I granted it and nothing happened" report.
   */
  const GRANT_ALIASES: Partial<Record<AdminSection, readonly string[]>> = {
    agentpanel: ['agents', 'agent'],
    komunapanel: ['municipalities', 'komuna'],
    monitorim: ['monitorim', 'monitoring'],
    moderim: ['moderim', 'moderation', 'monitoring'],
  };
  const aliases = GRANT_ALIASES[section];
  if (aliases && Array.isArray(user.permissions)) {
    if (aliases.some((alias) => user.permissions!.includes(alias as never))) return true;
  }

  if (!isStaffRole(user.role)) return false;
  return (BY_ROLE[user.role as StaffRole] ?? []).includes(section);
}

/** Human-readable role label for the header. */
export function roleLabel(user: Pick<User, 'role' | 'name'> | null | undefined, language: string): string {
  if (!user) return '';
  const english = language !== 'sq';
  switch (user.role) {
    case 'superadmin': return english ? 'Super Administrator' : 'Super Administrator';
    case 'admin': return english ? 'Administrator' : 'Administrator';
    case 'approver': return english ? 'Approval Officer' : 'Zyrtar Aprovimi';
    case 'adsadmin': return english ? 'Ads Manager' : 'Menaxher Reklamash';
    case 'newsadmin': return english ? 'News Editor' : 'Redaktor i Lajmeve';
    case 'debatwp': return english ? 'Debate Admin' : 'Admin i Debatit Publik';
    case 'agent': return english ? 'Field Agent' : 'Agjent Terreni';
    case 'responder': return english ? 'Responder' : 'Përgjegjës';
    case 'dispatcher': return english ? 'Dispatcher' : 'Dispatcher';
    case 'monitor': return english ? 'Monitor (read-only)' : 'Monitorues (vetëm lexim)';
    case 'municipality': return english ? 'Municipality' : 'Komuna';
    default: return english ? 'Staff' : 'Staf';
  }
}

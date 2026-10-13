/**
 * Authorization decisions as pure functions.
 *
 * The routes in server.ts used to inline these checks, which made them
 * impossible to unit-test and easy to get subtly wrong (see the role-change
 * route: its comment promised a self-lockout guard that did not exist). Each
 * function takes plain values and returns a decision the route can send as is.
 */
import { canAccessSection, type AdminSection } from '../src/lib/adminPermissions';

/** Roles a platform staff account can hold (what `/admin/users/:uid/role` may assign). */
export const ASSIGNABLE_STAFF_ROLES: readonly string[] = [
  'agent',
  'approver',
  'adsadmin',
  'newsadmin',
  'debatwp',
  'responder',
  'dispatcher',
  'moderator',
  'monitor',
  'admin',
  'superadmin',
];

const OWNER_LEVEL_ROLES = new Set(['admin', 'superadmin']);

/** Every role that works on the platform side of a conversation with a municipality. */
const STAFF_SIDE_ROLES = new Set([
  'admin',
  'superadmin',
  'approver',
  'adsadmin',
  'newsadmin',
  'debatwp',
  'agent',
  'responder',
  'dispatcher',
  'moderator',
]);

/**
 * `outcome` is a string discriminant rather than a boolean: the project does not
 * enable `strictNullChecks`, and without it TypeScript will not narrow a union on
 * `ok: true | false`.
 */
export type Decision =
  | { outcome: 'allow' }
  | { outcome: 'deny'; status: 400 | 403; error: string };

const allow: Decision = { outcome: 'allow' };
const deny = (status: 400 | 403, error: string): Decision => ({ outcome: 'deny', status, error });

export interface RoleChange {
  actorUid: string;
  actorRole: string;
  targetUid: string;
  /** The role currently stored for the target. */
  currentTargetRole: string;
  /** The role being assigned. */
  nextRole: string;
}

/**
 * May `actor` change `target` to `nextRole`?
 *
 *  - only admin / superadmin manage staff roles;
 *  - nobody changes their own role or ban state (a superadmin demoting
 *    themselves would lock the platform out of its owner);
 *  - touching an admin / superadmin account, or granting either role, is reserved
 *    for the superadmin: otherwise an admin could demote or ban their peers.
 */
export function checkRoleChange(input: RoleChange): Decision {
  if (!ASSIGNABLE_STAFF_ROLES.includes(input.nextRole)) return deny(400, 'Invalid role');
  if (!OWNER_LEVEL_ROLES.has(input.actorRole)) return deny(403, 'Kërkohet roli administrator.');
  if (input.actorUid === input.targetUid) {
    return deny(400, 'Nuk mund të ndryshoni rolin ose aksesin e llogarisë suaj.');
  }
  if (
    input.actorRole !== 'superadmin' &&
    (OWNER_LEVEL_ROLES.has(input.currentTargetRole) || OWNER_LEVEL_ROLES.has(input.nextRole))
  ) {
    return deny(403, 'Forbidden: Requires superadmin');
  }
  return allow;
}

/**
 * Staff <-> municipality correspondence only.
 *
 * The thread API is documented as a direct line between platform staff and a
 * municipality. Without this check any signed-in account - guests included -
 * could message any other account, which is a spam channel and a way to confirm
 * which user ids exist.
 */
export function checkMessageParties(senderRole: string, receiverRole: string): Decision {
  const staffToMunicipality = STAFF_SIDE_ROLES.has(senderRole) && receiverRole === 'municipality';
  const municipalityToStaff = senderRole === 'municipality' && STAFF_SIDE_ROLES.has(receiverRole);
  return staffToMunicipality || municipalityToStaff
    ? allow
    : deny(403, 'Mesazhet lejohen vetëm mes stafit të platformës dhe një llogarie komunale.');
}

/**
 * Whether an account may use an admin section, by the same table the UI uses
 * (`BY_ROLE` and per-section grants in adminPermissions.ts), fed only from
 * verified token data. One policy, enforced in the browser for convenience and
 * here for real.
 */
export function mayUseSection(
  actor: { role: string; permissions: readonly string[] },
  section: AdminSection
): boolean {
  return canAccessSection({ role: actor.role, permissions: actor.permissions }, section);
}

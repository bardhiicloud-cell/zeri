/**
 * Custom claims for platform roles — the single definition.
 *
 * Firestore rules read boolean flags (`token.admin`, `token.agent`, …) while the
 * UI and the Express server reason about a `role` string and `perm_*` section
 * grants. Both shapes are written together, and they are written from here, so
 * the admin routes in server.ts, the claims sync script and the owner bootstrap
 * script can never drift apart (the owner script once set `{role, admin}` and
 * forgot the `superadmin` flag the rules test).
 *
 * Pure functions only: no Firebase imports, so they are trivially unit-tested.
 */

/** Platform staff roles. Each one maps to the flag the Firestore rules test. */
export const STAFF_ROLES = [
  'admin',
  'superadmin',
  'approver',
  'adsadmin',
  'newsadmin',
  /** Public-debate admin: payments, ticks, debate ads, post moderation. */
  'debatwp',
  'agent',
  'responder',
  'dispatcher',
  'moderator',
  /** Read-only oversight: sees reports, deadlines and the audit trail; changes nothing. */
  'monitor',
] as const;

/** Every role whose authority lives in token claims (staff plus municipalities). */
export const CLAIM_ROLES: ReadonlySet<string> = new Set<string>([...STAFF_ROLES, 'municipality']);

/** Firebase rejects a custom-claims payload above 1000 bytes. */
export const MAX_CLAIMS_BYTES = 1000;

const MANAGED_CLAIM_KEYS: ReadonlySet<string> = new Set([
  'role',
  'permissions',
  'admin',
  'superadmin',
  'approver',
  'adsadmin',
  'newsadmin',
  'debatwp',
  'agent',
  'monitor',
  'municipality_account',
  'municipality',
]);

/** A claim this module owns (and may therefore add, change or remove). */
export function isManagedClaimKey(key: string): boolean {
  return MANAGED_CLAIM_KEYS.has(key) || key.startsWith('perm_');
}

/** Section names are identifiers; anything else (for example `*`) is not a grant. */
const PERMISSION_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

export function sanitizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter((name) => PERMISSION_NAME.test(name)))];
}

/**
 * Claims for a role.
 *
 * The rules file tests boolean flags (`token.admin == true`, `token.agent ==
 * true`, …), while the UI reasons about a single `role` string. Writing only the
 * string left every newly created staffer unauthorized against Firestore — the
 * classic "I created an agent but notifications won't send" failure. Both shapes
 * are written so either consumer keeps working.
 */
export function buildRoleClaims(
  role: string,
  permissions: string[],
  municipality?: string
): Record<string, unknown> {
  const claims: Record<string, unknown> = { role, permissions };
  if (role === 'admin' || role === 'superadmin') claims.admin = true;
  if (role === 'superadmin') claims.superadmin = true;
  if (role === 'approver') claims.approver = true;
  if (role === 'adsadmin') claims.adsadmin = true;
  if (role === 'newsadmin') claims.newsadmin = true;
  if (role === 'debatwp') claims.debatwp = true;
  if (role === 'agent' || role === 'responder' || role === 'dispatcher' || role === 'moderator') claims.agent = true;
  // Deliberately NOT `agent`: a monitor is outside every write path of the pipeline.
  if (role === 'monitor') claims.monitor = true;
  /**
   * The municipality claims the Firestore rules read. `isMunicipality()` and
   * `ownMunicipality()` in firestore.rules test `token.municipality_account`
   * and `token.municipality`; without them every rules-side municipality
   * grant is dead code and the account can only act through the server.
   * A missing name would make `ownMunicipality()` compare against undefined,
   * so the claim is only written when the provisioning call supplied one.
   */
  if (role === 'municipality') {
    claims.municipality_account = true;
    if (municipality) claims.municipality = municipality;
  }
  // Section permissions are also flattened so rules could reference them.
  for (const permission of permissions) {
    if (PERMISSION_NAME.test(permission)) claims[`perm_${permission}`] = true;
  }
  return claims;
}

export function claimsByteLength(claims: Record<string, unknown>): number {
  return Buffer.byteLength(JSON.stringify(claims), 'utf8');
}

export interface ProfileForClaims {
  role: string;
  /** Client-writable in older rules versions: treat as untrusted input. */
  permissions?: unknown;
  /** Client-writable in older rules versions: treat as untrusted input. */
  municipality?: unknown;
}

export interface ReconcileOptions {
  /**
   * Take `permissions` and `municipality` from the profile document when the
   * token has none. Off by default: before the rules were tightened an account
   * could write both fields on its own profile, so they are reviewed by a human
   * before they become claims.
   */
  acceptProfileData?: boolean;
}

export interface ReconcileResult {
  /** The full claims object to store (unmanaged claims preserved). */
  next: Record<string, unknown>;
  /** Human-readable list of managed claims that would be added/changed/removed. */
  changes: string[];
  /** Things that would be added but need `acceptProfileData` (or a human) first. */
  pending: string[];
  /** Reasons this account must not be touched automatically. */
  conflicts: string[];
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Work out the claims an account should carry, given what it has now and what
 * its profile says.
 *
 * Deliberately conservative:
 *  - never changes the `role` claim: a role that disagrees with the profile is a
 *    conflict for a human to resolve (the claim is the authority, and silently
 *    "correcting" it could promote or demote someone);
 *  - never removes claims it does not own;
 *  - fills in what is derivable from the role alone (boolean flags);
 *  - leaves anything that comes from profile *content* pending until accepted.
 */
export function reconcileClaims(
  existing: Record<string, unknown>,
  profile: ProfileForClaims,
  options: ReconcileOptions = {}
): ReconcileResult {
  const role = String(profile.role ?? '');
  const result: ReconcileResult = { next: existing, changes: [], pending: [], conflicts: [] };

  if (!CLAIM_ROLES.has(role)) {
    result.conflicts.push(`profile role "${role}" does not carry claims`);
    return result;
  }

  const existingRole = typeof existing.role === 'string' ? existing.role : '';
  if (existingRole && existingRole !== role) {
    result.conflicts.push(`claims role "${existingRole}" differs from profile role "${role}"`);
    return result;
  }

  // Section grants: keep what the token already has; otherwise they come from
  // the profile and need acceptance. Admins have full access by role, so they
  // carry no section list. An EMPTY list in the token counts as "not set": the
  // first (role-only) pass of this script writes `permissions: []`, and that must
  // not stop a later, reviewed --accept-profile-data pass from importing them.
  const claimPermissions = Array.isArray(existing.permissions) ? sanitizePermissions(existing.permissions) : [];
  const profilePermissions = sanitizePermissions(profile.permissions);
  let permissions: string[];
  if (claimPermissions.length > 0) {
    permissions = claimPermissions;
  } else if (role === 'admin' || role === 'superadmin' || profilePermissions.length === 0) {
    permissions = [];
  } else if (options.acceptProfileData) {
    permissions = profilePermissions;
  } else {
    permissions = [];
    result.pending.push(`permissions from profile: ${profilePermissions.join(', ')}`);
  }

  // Municipality jurisdiction: same rule — the token wins, the profile needs a human.
  let municipality: string | undefined;
  if (role === 'municipality') {
    const claimMunicipality = typeof existing.municipality === 'string' ? existing.municipality.trim() : '';
    const profileMunicipality = typeof profile.municipality === 'string' ? profile.municipality.trim() : '';
    if (claimMunicipality) {
      municipality = claimMunicipality;
    } else if (profileMunicipality && options.acceptProfileData) {
      municipality = profileMunicipality;
    } else if (profileMunicipality) {
      result.pending.push(`municipality from profile: ${profileMunicipality}`);
    } else {
      result.conflicts.push('municipality account has no municipality in its claims or its profile');
    }
  }

  const expected = buildRoleClaims(role, permissions, municipality);

  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(existing)) {
    if (!isManagedClaimKey(key)) next[key] = value;
  }
  Object.assign(next, expected);

  for (const key of Object.keys(expected)) {
    if (!(key in existing)) result.changes.push(`+${key}`);
    else if (!sameValue(existing[key], expected[key])) result.changes.push(`~${key}`);
  }
  for (const key of Object.keys(existing)) {
    if (isManagedClaimKey(key) && !(key in expected)) result.changes.push(`-${key}`);
  }

  const size = claimsByteLength(next);
  if (size > MAX_CLAIMS_BYTES) {
    result.conflicts.push(`claims would be ${size} bytes (Firebase limit ${MAX_CLAIMS_BYTES})`);
    result.changes = [];
    return result;
  }

  result.next = next;
  return result;
}

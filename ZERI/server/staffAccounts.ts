/**
 * Creating a staff account (agent, approver, manager/dispatcher, monitor, …).
 *
 * What "the agent was created" has to mean, and what each step guards:
 *   1. the caller is an administrator, and may grant this role (server/policy.ts);
 *   2. the email is not taken (checked first, so nothing half-exists on a clash);
 *   3. the Authentication account exists, with a password only when one was typed;
 *   4. the role claims — the only authority the server and the rules trust — are set,
 *      including the scope fields, and are read back to prove they took;
 *   5. the profile document and the worker profile (sector, municipality, capacity)
 *      exist, so the person appears at once in the assignment lists;
 *   6. any failure after step 3 undoes everything, and the caller gets the error —
 *      never a success message for an account that cannot sign in or work.
 * The password goes to Firebase Authentication only: it is never stored or logged.
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { buildRoleClaims, claimsByteLength, MAX_CLAIMS_BYTES } from './roleClaims';
import { checkRoleChange } from './policy';

/** Roles this form creates. Municipalities have their own provisioning (`/admin/municipalities`). */
export const CREATABLE_ROLES = ['agent', 'approver', 'responder', 'dispatcher', 'moderator', 'monitor', 'newsadmin', 'adsadmin', 'debatwp'] as const;

/** "Menaxher" in the brief is the dispatcher role (assigns work, sees team load). */
const ROLE_ALIASES: Record<string, string> = { manager: 'dispatcher', menaxher: 'dispatcher', monitoring: 'monitor' };

/** Roles that hold report work and so get a worker profile. */
const WORKING_ROLES = new Set(['agent', 'approver', 'responder', 'dispatcher', 'moderator']);

export const ALLOWED_SECTIONS = new Set([
  'dashboard', 'updates', 'reports', 'workfacts', 'health', 'donations', 'users', 'forum',
  'polls', 'agents', 'municipalities', 'monitoring', 'monitorim', 'agentpanel', 'komunapanel', 'moderim',
  'support', 'chat', 'ads', 'notifications', 'news', 'debate',
  'categories', 'security', 'settings',
]);

export interface StaffInput {
  email: string;
  name: string;
  role: string;
  phone: string;
  permissions: string[];
  isBanned: boolean;
  password: string;
  municipality: string;
  department: string;
  skills: string[];
  capacity: number;
}

export type ParseResult = { ok: true; value: StaffInput } | { ok: false; status: 400; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Validate the request body. Pure. */
export function parseStaffInput(body: unknown): ParseResult {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const bad = (error: string): ParseResult => ({ ok: false, status: 400, error });
  const email = String(b.email ?? '').trim().toLowerCase();
  const name = String(b.name ?? '').trim();
  const requested = String(b.role ?? 'agent').trim().toLowerCase();
  const role = ROLE_ALIASES[requested] ?? requested;
  if (!name || name.length > 120) return bad('Emri është i detyrueshëm (deri 120 shenja).');
  if (!EMAIL.test(email) || email.length > 254) return bad('Shkruani një email të vlefshëm.');
  if (!(CREATABLE_ROLES as readonly string[]).includes(role)) {
    return bad(requested === 'municipality'
      ? 'Llogaritë komunale krijohen te "Komunat", me komunën e tyre.'
      : 'Roli i zgjedhur nuk mund të caktohet nga ky formular.');
  }
  const permissions = Array.isArray(b.permissions) ? [...new Set(b.permissions.map(String))] : [];
  if (permissions.some(p => !ALLOWED_SECTIONS.has(p))) return bad('Lista e lejeve përmban një modul të panjohur.');
  const password = typeof b.password === 'string' ? b.password : '';
  if (password) {
    if (password.length < 8 || password.length > 128) return bad('Fjalëkalimi duhet të ketë 8–128 shenja.');
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return bad('Fjalëkalimi duhet të përmbajë shkronja dhe numra.');
  }
  const municipality = String(b.municipality ?? '').trim();
  const department = String(b.department ?? '').trim();
  if (municipality.length > 80 || department.length > 120) return bad('Komuna ose sektori është shumë i gjatë.');
  const skills = Array.isArray(b.skills) ? [...new Set(b.skills.map(s => String(s).trim()).filter(s => s && s.length <= 60))].slice(0, 20) : [];
  const capacityRaw = Number(b.capacity ?? 8);
  const capacity = Number.isFinite(capacityRaw) && capacityRaw >= 1 ? Math.min(50, Math.round(capacityRaw)) : 8;
  const phone = String(b.phone ?? '').trim().slice(0, 40);
  return { ok: true, value: { email, name, role, phone, permissions, isBanned: b.isBanned === true, password, municipality, department, skills, capacity } };
}

export type CreateResult =
  | { ok: true; uid: string; email: string; role: string; isBanned: boolean; passwordSet: boolean; canSignIn: boolean }
  | { ok: false; status: number; error: string };

export async function createStaffAccount(
  deps: { db: Firestore; auth: Auth },
  actor: { uid: string; role: string },
  input: StaffInput,
): Promise<CreateResult> {
  // Same authority rule as changing a role: admin-level caller; owner-level roles need a superadmin.
  const allowed = checkRoleChange({ actorUid: actor.uid, actorRole: actor.role, targetUid: '__new__', currentTargetRole: '', nextRole: input.role });
  if (allowed.outcome === 'deny') return { ok: false, status: allowed.status, error: allowed.error };

  try {
    await deps.auth.getUserByEmail(input.email);
    return { ok: false, status: 409, error: 'Ky email ka tashmë një llogari.' };
  } catch (error) {
    if ((error as { code?: string })?.code !== 'auth/user-not-found') throw error;
  }

  const claims = buildRoleClaims(input.role, input.permissions);
  if (claimsByteLength(claims) > MAX_CLAIMS_BYTES) return { ok: false, status: 400, error: 'Shumë leje për një llogari; zgjidhni më pak module.' };

  let uid: string | null = null;
  try {
    const user = await deps.auth.createUser({
      email: input.email,
      displayName: input.name,
      emailVerified: false,
      disabled: input.isBanned,
      ...(input.password ? { password: input.password } : {}),
    });
    uid = user.uid;
    await deps.auth.setCustomUserClaims(uid, claims);

    // Read back: a claim that did not take is an account with no authority.
    const check = await deps.auth.getUser(uid);
    if (String((check.customClaims ?? {}).role ?? '') !== input.role) throw new Error('role claim did not persist');

    const nowMs = Date.now();
    const batch = deps.db.batch();
    batch.set(deps.db.collection('users').doc(uid), {
      id: uid, name: input.name, email: input.email, phone: input.phone, role: input.role, permissions: input.permissions,
      municipality: input.municipality, department: input.department,
      points: 0, badges: ['Staff Agent'], isVerified: false, isBanned: input.isBanned,
      createdAt: FieldValue.serverTimestamp(), createdBy: actor.uid,
    });
    if (WORKING_ROLES.has(input.role)) {
      batch.set(deps.db.collection('workerProfiles').doc(uid), {
        uid, name: input.name, email: input.email, role: input.role, municipality: input.municipality, department: input.department,
        skills: input.skills, capacity: input.capacity, availability: 'available', disabled: input.isBanned,
        lastAssignedAtMs: null, createdAtMs: nowMs, updatedAtMs: nowMs,
      });
    }
    await batch.commit();
    return { ok: true, uid, email: input.email, role: input.role, isBanned: input.isBanned, passwordSet: Boolean(input.password), canSignIn: Boolean(input.password) && !input.isBanned };
  } catch (error) {
    if (uid) {
      await deps.db.collection('workerProfiles').doc(uid).delete().catch(() => undefined);
      await deps.db.collection('users').doc(uid).delete().catch(() => undefined);
      await deps.auth.deleteUser(uid).catch(() => undefined);
    }
    if ((error as { code?: string })?.code === 'auth/email-already-exists') return { ok: false, status: 409, error: 'Ky email ka tashmë një llogari.' };
    if ((error as { code?: string })?.code === 'auth/invalid-password') return { ok: false, status: 400, error: 'Fjalëkalimi nuk pranohet nga shërbimi i identifikimit.' };
    console.error('[staff] creation failed:', (error as Error)?.message);
    return { ok: false, status: 500, error: 'Llogaria nuk u krijua; asgjë nuk mbeti gjysmë e krijuar. Provoni përsëri.' };
  }
}

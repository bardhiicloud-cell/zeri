/**
 * Re-issue custom claims for existing staff and municipality accounts.
 *
 * Why this exists: authority now comes only from verified token claims. Accounts
 * provisioned before claims existed — or by `scripts/make-owner.ts`, which set
 * `{ role, admin }` but not `superadmin` — would otherwise be refused by the
 * server (`server/auth.ts`) and by `firestore.rules`. This script reads the
 * `role` stored on each profile document and brings the token claims in line.
 *
 * It is deliberately conservative:
 *   - DRY RUN by default. Nothing is written without --apply.
 *   - It never changes an existing `role` claim. A claim that disagrees with the
 *     profile is reported as a CONFLICT and left alone.
 *   - It only fills in what the role itself implies (admin / superadmin / agent …
 *     flags). Section permissions and a municipality name come from the profile,
 *     which accounts could write themselves under the old rules, so they are
 *     listed as PENDING and applied only with --accept-profile-data after review.
 *   - Writing to a real (non-emulator) project also requires --confirm-project
 *     with the exact project id.
 *
 * Usage:
 *   npx tsx scripts/sync-claims.ts                       # report only
 *   npx tsx scripts/sync-claims.ts --uid <uid>           # report one account
 *   npx tsx scripts/sync-claims.ts --apply --confirm-project <project-id>
 *   npx tsx scripts/sync-claims.ts --apply --confirm-project <project-id> --accept-profile-data --revoke
 *
 * Flags:
 *   --apply                 write the changes
 *   --confirm-project <id>  required with --apply unless using the local emulator
 *   --accept-profile-data   also take permissions / municipality from the profile
 *   --revoke                revoke refresh tokens so new claims apply at once
 *                           (otherwise they arrive with the next token refresh, ≤ 1 h)
 *   --uid <uid>             limit to one account
 *
 * Credentials come from the same place as the server: FIREBASE_SERVICE_ACCOUNT
 * or FIREBASE_SERVICE_ACCOUNT_PATH in .env.local, or the Auth/Firestore
 * emulator hosts with a demo-* project id.
 */
import '../server/loadEnv';
import {
  FIREBASE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  authAdmin,
  db,
  hasAdminCredentials,
  isLocalFirebaseEmulator,
} from '../server/firebaseAdmin';
import { CLAIM_ROLES, reconcileClaims } from '../server/roleClaims';

const args = process.argv.slice(2);

function hasFlag(name: string): boolean {
  return args.includes(name);
}

function valueOf(name: string): string | undefined {
  const index = args.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (index === -1) return undefined;
  const inline = args[index].split('=')[1];
  return inline !== undefined ? inline : args[index + 1];
}

const apply = hasFlag('--apply');
const revoke = hasFlag('--revoke');
const acceptProfileData = hasFlag('--accept-profile-data');
const onlyUid = valueOf('--uid');
const confirmProject = valueOf('--confirm-project');

interface Row {
  uid: string;
  email: string;
  role: string;
  detail: string;
}

async function main(): Promise<number> {
  if (!hasAdminCredentials) {
    console.error(
      'No Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_PATH (or FIREBASE_SERVICE_ACCOUNT) in .env.local,\n' +
        'or start the emulators with a demo-* FIREBASE_PROJECT_ID and the *_EMULATOR_HOST variables.'
    );
    return 2;
  }

  if (apply && !isLocalFirebaseEmulator && confirmProject !== FIREBASE_PROJECT_ID) {
    console.error(
      `Refusing to write to project "${FIREBASE_PROJECT_ID}" without confirmation.\n` +
        `Re-run with: --apply --confirm-project ${FIREBASE_PROJECT_ID}`
    );
    return 2;
  }

  console.log(`Project:   ${FIREBASE_PROJECT_ID}${isLocalFirebaseEmulator ? '  (local emulator)' : ''}`);
  console.log(`Database:  ${FIRESTORE_DATABASE_ID ?? '(default)'}`);
  console.log(
    `Mode:      ${apply ? 'APPLY' : 'DRY RUN (nothing will be written)'}` +
      `${acceptProfileData ? ' · accepting profile permissions/municipality' : ''}${revoke ? ' · revoking tokens' : ''}`
  );
  console.log('');

  const upToDate: Row[] = [];
  const toUpdate: Row[] = [];
  const pending: Row[] = [];
  const conflicts: Row[] = [];
  const missingAuth: Row[] = [];
  const failed: Row[] = [];
  let written = 0;

  const seen = new Set<string>();
  const profiles: Array<{ uid: string; data: Record<string, unknown> }> = [];

  if (onlyUid) {
    const snapshot = await db().collection('users').doc(onlyUid).get();
    if (!snapshot.exists) {
      console.error(`No profile document users/${onlyUid}.`);
      return 2;
    }
    profiles.push({ uid: snapshot.id, data: snapshot.data() as Record<string, unknown> });
  } else {
    // One equality query per role: no composite index needed.
    for (const role of CLAIM_ROLES) {
      const snapshot = await db().collection('users').where('role', '==', role).limit(5000).get();
      if (snapshot.size === 5000) console.warn(`Warning: 5000 profiles with role "${role}" - results may be truncated.`);
      for (const doc of snapshot.docs) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);
        profiles.push({ uid: doc.id, data: doc.data() as Record<string, unknown> });
      }
    }
  }

  for (const { uid, data } of profiles) {
    const role = String(data.role ?? '');
    const email = String(data.email ?? '');
    const row = (detail: string): Row => ({ uid, email, role, detail });

    if (!CLAIM_ROLES.has(role)) {
      conflicts.push(row(`profile role "${role}" does not carry claims`));
      continue;
    }

    let authUser;
    try {
      authUser = await authAdmin().getUser(uid);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'auth/user-not-found') missingAuth.push(row('profile exists but there is no Auth user'));
      else failed.push(row(`could not read Auth user: ${(error as Error).message}`));
      continue;
    }

    const existing = (authUser.customClaims ?? {}) as Record<string, unknown>;
    const result = reconcileClaims(
      existing,
      { role, permissions: data.permissions, municipality: data.municipality },
      { acceptProfileData }
    );

    if (result.conflicts.length > 0) {
      conflicts.push(row(result.conflicts.join('; ')));
      continue;
    }
    if (result.pending.length > 0) pending.push(row(result.pending.join('; ')));

    if (result.changes.length === 0) {
      upToDate.push(row('claims already match'));
      continue;
    }

    toUpdate.push(row(result.changes.join(' ')));

    if (apply) {
      try {
        await authAdmin().setCustomUserClaims(uid, result.next);
        if (revoke) await authAdmin().revokeRefreshTokens(uid);
        written += 1;
      } catch (error) {
        failed.push(row(`write failed: ${(error as Error).message}`));
      }
    }
  }

  const print = (title: string, rows: Row[]) => {
    if (rows.length === 0) return;
    console.log(`${title} (${rows.length})`);
    for (const r of rows) console.log(`  ${r.uid}  ${r.role.padEnd(12)} ${r.email}\n      ${r.detail}`);
    console.log('');
  };

  print(apply ? 'UPDATED' : 'WOULD UPDATE', toUpdate);
  print('PENDING - needs --accept-profile-data after you have reviewed the profile values', pending);
  print('CONFLICT - not touched, resolve by hand in the admin panel', conflicts);
  print('NO AUTH USER', missingAuth);
  print('FAILED', failed);

  console.log(
    `Summary: ${profiles.length} account(s) checked · ${upToDate.length} up to date · ` +
      `${toUpdate.length} ${apply ? 'updated' : 'to update'} · ${pending.length} pending review · ` +
      `${conflicts.length} conflict(s) · ${missingAuth.length} without Auth user · ${failed.length} failed`
  );
  if (!apply && toUpdate.length > 0) {
    console.log(
      isLocalFirebaseEmulator
        ? '\nRe-run with --apply to write these changes.'
        : `\nRe-run with --apply --confirm-project ${FIREBASE_PROJECT_ID} to write these changes.`
    );
  }
  if (apply && written > 0 && !revoke) {
    console.log('\nNew claims reach users with their next token refresh (up to an hour), or when they sign in again.');
  }

  return failed.length > 0 ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
    // firebase-admin keeps handles open; exit explicitly once the report is out.
    setTimeout(() => process.exit(code), 100);
  },
  (error) => {
    console.error(error);
    process.exit(1);
  }
);

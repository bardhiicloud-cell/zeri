/**
 * Sets bardhiicloud@gmail.com as the platform owner (superadmin).
 *
 *  1. Writes the Firestore profile document users/{uid} with role 'superadmin'.
 *  2. Sets the custom claims { role: 'superadmin', admin: true } — the
 *     security boundary trusted by requireAdmin.
 *
 * Run:  npx tsx scripts/make-owner.ts
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8')
);

const PROJECT_ID = 'gen-lang-client-0907710011';
const DATABASE_ID = 'ai-studio-ba83412d-22cf-4764-9885-a01600d542ae';
const OWNER_EMAIL = 'bardhiicloud@gmail.com';

initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });
const db = getFirestore(DATABASE_ID);

async function main() {
  const user = await getAuth().getUserByEmail(OWNER_EMAIL);
  console.log('Found user:', user.uid, user.email);

  await getAuth().setCustomUserClaims(user.uid, { role: 'superadmin', admin: true });
  console.log('Custom claims set: { role: superadmin, admin: true }');

  await db.collection('users').doc(user.uid).set(
    {
      id: user.uid,
      email: user.email,
      name: user.displayName || 'Bardh Berisha',
      avatar: user.photoURL || '',
      role: 'superadmin',
      isVerified: true,
      isOwner: true,
      permissions: ['*'],
      points: 0,
      badges: [],
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log('Firestore users/{uid} written with role=superadmin, isOwner=true');

  // Force token refresh so new claims apply immediately.
  await getAuth().revokeRefreshTokens(user.uid);
  console.log('Refresh tokens revoked — next sign-in carries the new claims.');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);

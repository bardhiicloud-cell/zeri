import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(svc), projectId: 'gen-lang-client-0907710011' });

const DB_ID = 'ai-studio-ba83412d-22cf-4764-9885-a01600d542ae';
const auth = getAuth();
const db = getFirestore(undefined, DB_ID);

// 1) bardhiicloud@gmail.com -> superadmin
const email = 'bardhiicloud@gmail.com';
const user = await auth.getUserByEmail(email);
console.log('User:', user.uid, user.email);

await auth.setCustomUserClaims(user.uid, { admin: true, superadmin: true });
console.log('Claims set: admin + superadmin');

await db.collection('users').doc(user.uid).set({
  email,
  name: user.displayName || 'Bardh Berisha',
  role: 'superadmin',
  permissions: [],
  points: 0,
  badges: [],
  isVerified: true,
  isBanned: false,
  avatar: user.photoURL || '',
  createdAt: new Date().toISOString(),
}, { merge: true });
console.log('Firestore profile created (role: superadmin)');

await auth.revokeRefreshTokens(user.uid);
console.log('Refresh tokens revoked — hyrje e re do të marrë rolin.');

// 2) admin@kosova.com -> also give it a superadmin profile (it had none)
try {
  const admin2 = await auth.getUserByEmail('admin@kosova.com');
  await auth.setCustomUserClaims(admin2.uid, { admin: true, superadmin: true });
  await db.collection('users').doc(admin2.uid).set({
    email: 'admin@kosova.com',
    name: 'Admin',
    role: 'superadmin',
    permissions: [],
    points: 0,
    badges: [],
    isVerified: true,
    isBanned: false,
    createdAt: new Date().toISOString(),
  }, { merge: true });
  await auth.revokeRefreshTokens(admin2.uid);
  console.log('admin@kosova.com: claims + profile u vendosën (superadmin).');
} catch (e) {
  console.log('admin@kosova.com:', e.message);
}
process.exit(0);

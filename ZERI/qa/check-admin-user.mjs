import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(svc), projectId: 'gen-lang-client-0907710011' });

const db = getFirestore();
// The app uses a non-default Firestore database (ai-studio-...). Query both.
const DB_ID = 'ai-studio-ba83412d-22cf-4764-9885-a01600d542ae';
const uid = 'bC6W310rcycGAIoZHpM6jIIuo993'; // admin@kosova.com in users.json

for (const [label, d] of [['default', getFirestore()], ['ai-studio', getFirestore(undefined, DB_ID)]]) {
  const doc = await d.collection('users').doc(uid).get().catch(e => ({ error: e.message }));
  console.log(`=== FIRESTORE [${label}] users/${uid} ===`);
  console.log(doc.error ? 'ERR: ' + doc.error : (doc.exists ? JSON.stringify(doc.data(), null, 2) : 'NO DOCUMENT'));
}

console.log('\n=== FIREBASE AUTH ===');
try {
  const u = await getAuth().getUser(uid);
  console.log(JSON.stringify({
    email: u.email,
    emailVerified: u.emailVerified,
    disabled: u.disabled,
    customClaims: u.customClaims,
    providers: u.providerData.map(p => p.providerId),
  }, null, 2));
} catch (e) {
  console.log('AUTH lookup failed:', e.message);
}
process.exit(0);

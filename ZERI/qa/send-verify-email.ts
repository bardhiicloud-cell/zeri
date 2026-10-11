/**
 * Sends a real verification email to a given address and reports the result.
 * Usage: npx tsx qa/send-verify-email.ts <email>
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8')
);
initializeApp({ credential: cert(serviceAccount), projectId: 'gen-lang-client-0907710011' });

const API_KEY = 'AIzaSyABHsGey8wTC4-VAZwMgJ-oPBjDzGY5T24';
const email = process.argv[2];
if (!email || !email.includes('@')) {
  console.error('Perdorimi: npx tsx qa/send-verify-email.ts <email-i-joteg>');
  process.exit(1);
}

async function main() {
  const auth = getAuth();
  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log('User ekziston:', user.uid, 'verified:', user.emailVerified);
  } catch {
    user = await auth.createUser({ email, password: 'TempHyrje2026!', displayName: 'Verifikim Test' });
    console.log('U krijua llogari e re testuese:', user.uid);
  }

  const customToken = await auth.createCustomToken(user.uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) }
  );
  const data: any = await res.json();
  if (!data.idToken) { console.error('token failed:', data); process.exit(1); }

  const send = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken: data.idToken }) }
  );
  console.log('sendOobCode:', send.status, JSON.stringify(await send.json()).slice(0, 200));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });

/**
 * Sends a real password-reset email to a given address and reports the result.
 * Usage: npx tsx qa/send-reset-email.ts <email>
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const serviceAccount = JSON.parse(
  readFileSync(new URL('../ZERI/serviceAccountKey.json', import.meta.url), 'utf8')
);
initializeApp({ credential: cert(serviceAccount), projectId: 'gen-lang-client-0907710011' });

const API_KEY = 'AIzaSyABHsGey8wTC4-VAZwMgJ-oPBjDzGY5T24';
const email = process.argv[2];
if (!email || !email.includes('@')) {
  console.error('Perdorimi: npx tsx qa/send-reset-email.ts <email-i-joteg>');
  process.exit(1);
}

async function main() {
  const auth = getAuth();
  try {
    const user = await auth.getUserByEmail(email);
    console.log('User ekziston:', user.uid, 'verified:', user.emailVerified);
  } catch {
    console.error('Nuk ekziston llogari me kete email — Firebase nuk do ta dergoje emailin.');
    process.exit(1);
  }

  // PASSWORD_RESET nuk kerkon idToken, vetem email.
  const send = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }) }
  );
  console.log('sendOobCode:', send.status, JSON.stringify(await send.json()).slice(0, 200));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });

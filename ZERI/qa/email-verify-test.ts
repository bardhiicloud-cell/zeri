/**
 * Test email verification delivery end-to-end:
 *  1. Create a throwaway account with a real inbox-safe address.
 *  2. Call sendOobCode (what sendEmailVerification uses).
 *  3. Report the exact API error, if any.
 *  4. Clean up the throwaway.
 *
 * Run:  npx tsx qa/email-verify-test.ts
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8')
);
initializeApp({ credential: cert(serviceAccount), projectId: 'gen-lang-client-0907710011' });

const API_KEY = 'AIzaSyABHsGey8wTC4-VAZwMgJ-oPBjDzGY5T24';
const TEST_EMAIL = `verify-test-${Date.now()}@example.com`;

async function main() {
  const auth = getAuth();

  // 1. Create the throwaway user.
  const user = await auth.createUser({ email: TEST_EMAIL, password: 'TestPassword1!', displayName: 'Verify Test' });
  console.log('created:', user.uid);

  // 2. Mint an ID token for them.
  const customToken = await auth.createCustomToken(user.uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) }
  );
  const data: any = await res.json();
  if (!data.idToken) {
    console.error('token exchange failed:', data);
    await auth.deleteUser(user.uid).catch(() => undefined);
    process.exit(1);
  }

  // 3. Send the verification email exactly like the client SDK does.
  const send = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken: data.idToken }) }
  );
  const sendResult: any = await send.json();
  console.log('sendOobCode status:', send.status);
  console.log('sendOobCode body:', JSON.stringify(sendResult).slice(0, 500));

  // 4. Clean up.
  await auth.deleteUser(user.uid);
  console.log('throwaway deleted');
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });

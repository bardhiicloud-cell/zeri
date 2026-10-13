import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const svc = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(svc), projectId: 'gen-lang-client-0907710011' });
const dbs = [getFirestore(), getFirestore(undefined, 'ai-studio-ba83412d-22cf-4764-9885-a01600d542ae')];
for (const [i, d] of dbs.entries()) {
  try {
    const snap = await d.collection('users').limit(20).get();
    console.log(`--- DB[${i}] users: ${snap.size} docs ---`);
    snap.forEach(doc => console.log(' ', doc.id, '->', JSON.stringify({email: doc.data().email, role: doc.data().role, name: doc.data().name})));
  } catch (e) { console.log(`DB[${i}] error:`, e.message.slice(0, 120)); }
}
process.exit(0);

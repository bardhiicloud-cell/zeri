/**
 * Live check that the work inbox is answered by the server, longest-waiting first,
 * and that paging through it is stable. Emulator sandbox only.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { buildRoleClaims } from '../server/roleClaims';

const projectId = process.env.FIREBASE_PROJECT_ID ?? '';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '';
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3010';
if (!projectId.startsWith('demo-') || !authHost || !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refused: needs a demo- project and both emulator hosts.');
  process.exit(2);
}
initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed += 1; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${name}${ok || !detail ? '' : `  [${detail}]`}`);
}

async function main() {
  await auth.deleteUser('io-owner').catch(() => undefined);
  await auth.createUser({ uid: 'io-owner', email: 'io-owner@order-check.test', password: 'Test-Pass-12345' });
  await auth.setCustomUserClaims('io-owner', buildRoleClaims('superadmin', []));
  const sign = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'io-owner@order-check.test', password: 'Test-Pass-12345', returnSecureToken: true }),
  });
  const token = ((await sign.json()) as any).idToken as string;
  const get = async (query: string) => {
    const response = await fetch(`${BASE}/api/v1/admin/reports?${query}`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: response.status, body: (await response.json().catch(() => ({}))) as any };
  };

  // 120 pending reports in a marker municipality, created one hour apart (index 0 = oldest).
  const base = Date.parse('2026-01-01T00:00:00.000Z');
  const ids: string[] = [];
  for (let start = 0; start < 120; start += 30) {
    const batch = db.batch();
    for (let i = start; i < start + 30; i += 1) {
      const id = `io-r${String(i).padStart(3, '0')}`;
      ids.push(id);
      batch.set(db.collection('reports').doc(id), {
        title: `Order ${i}`, status: 'Pending Review', urgency: i === 7 ? 'Kritike' : 'Mesatare', category: 'x', timeline: [],
        createdAt: new Date(base + i * 3_600_000).toISOString(), location: { municipality: 'Ordertown' },
      });
    }
    await batch.commit();
  }

  console.log('1. Oldest first, from the whole collection');
  const first = await get('municipality=Ordertown&status=unapproved&order=oldest&limit=50');
  check('the request is accepted', first.status === 200, `status ${first.status} ${JSON.stringify(first.body).slice(0, 120)}`);
  check('the exact total is reported', first.body.total === 120);
  check('page one starts with the report that has waited longest', first.body.items?.[0]?.id === 'io-r000');
  check('...and runs in waiting order', (first.body.items ?? []).every((r: any, i: number) => r.id === `io-r${String(i).padStart(3, '0')}`));

  const second = await get(`municipality=Ordertown&status=unapproved&order=oldest&limit=50&cursor=${encodeURIComponent(first.body.nextCursor)}`);
  const third = await get(`municipality=Ordertown&status=unapproved&order=oldest&limit=50&cursor=${encodeURIComponent(second.body.nextCursor)}`);
  const all = [...first.body.items, ...second.body.items, ...third.body.items].map((r: any) => r.id);
  check('paging by cursor covers every report once, in order', all.length === 120 && all.join() === ids.join(), `got ${all.length}`);
  check('the last page has no further cursor', third.body.nextCursor === null);

  console.log('\n2. Newest first is unchanged');
  const newest = await get('municipality=Ordertown&status=unapproved&limit=5');
  check('default order is newest first', newest.body.items?.[0]?.id === 'io-r119');

  console.log('\n3. What is not offered');
  check('oldest + urgency has no index and is refused', (await get('status=unapproved&urgency=Kritike&order=oldest')).status === 400);
  check('an unknown order is refused', (await get('order=random')).status === 400);
  check('critical open reports are found by their own query', ((await get('municipality=Ordertown&status=unresolved&urgency=Kritike')).body.items ?? []).some((r: any) => r.id === 'io-r007'));

  for (let start = 0; start < 120; start += 30) {
    const batch = db.batch();
    ids.slice(start, start + 30).forEach(id => batch.delete(db.collection('reports').doc(id)));
    await batch.commit();
  }
  await auth.deleteUser('io-owner').catch(() => undefined);
  console.log(`\n${passed} passed, ${failures.length} failed.`);
  if (failures.length) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1); }
}

main().catch(error => { console.error('Check aborted:', error); process.exit(1); });

/**
 * Live check of cropping a report photo (read our own photo, store the cut).
 * Local emulator sandbox only; also needs FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { buildRoleClaims } from '../server/roleClaims';

const projectId = process.env.FIREBASE_PROJECT_ID ?? '';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '';
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3010';
const BUCKET = `${projectId}.firebasestorage.app`;
if (!projectId.startsWith('demo-') || !authHost || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  console.error('Refused: needs a demo- project and the auth, Firestore and Storage emulator hosts.');
  process.exit(2);
}
initializeApp({ projectId, storageBucket: BUCKET });
const auth = getAuth();
const db = getFirestore();
const bucket = getStorage().bucket(BUCKET);
const PASSWORD = 'Test-Pass-12345';

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed += 1; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${name}${ok || !detail ? '' : `  [${detail}]`}`);
}

async function tokenFor(uid: string, role: string) {
  await auth.deleteUser(uid).catch(() => undefined);
  const email = `${uid}@crop-check.test`;
  await auth.createUser({ uid, email, password: PASSWORD });
  await auth.setCustomUserClaims(uid, buildRoleClaims(role, []));
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  return ((await response.json()) as any).idToken as string;
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

async function main() {
  const agent = await tokenFor('crop-agent', 'agent');
  const monitor = await tokenFor('crop-monitor', 'monitor');

  const path = 'reports/crop-user/crop-r1/a.png';
  await bucket.file(path).save(PNG, { contentType: 'image/png', resumable: false, metadata: { metadata: { firebaseStorageDownloadTokens: 't1' } } });
  const original = `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=t1`;
  const foreign = 'http://169.254.169.254/latest/meta-data';
  await db.collection('reports').doc('crop-r1').set({
    title: 'Crop check', status: 'Pending Review', createdAt: new Date().toISOString(), timeline: [],
    media: [{ type: 'image', url: original, path }, { type: 'image', url: foreign }], images: [original, foreign],
  });

  const get = (token: string, url: string) => fetch(`${BASE}/api/v1/reports/crop-r1/media/file?url=${encodeURIComponent(url)}`, { headers: { Authorization: `Bearer ${token}` } });
  const crop = (token: string, url: string, image: string) => fetch(`${BASE}/api/v1/reports/crop-r1/media/crop`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ url, image }),
  });

  console.log('1. Reading the photo for the cropper');
  const ok = await get(agent, original);
  const bytes = Buffer.from(await ok.arrayBuffer());
  check('an agent gets the photo bytes, same origin', ok.status === 200 && bytes.equals(PNG) && ok.headers.get('content-type') === 'image/png', `status ${ok.status}`);
  check('a monitor is refused', (await get(monitor, original)).status === 403);
  check('a foreign address is never fetched by the server', (await get(agent, foreign)).status === 422);
  check('a URL not on the report -> 404', (await get(agent, 'https://example.com/x.png')).status === 404);

  console.log('\n2. Storing the cut');
  check('a fake image (SVG) is refused', (await crop(agent, original, `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`)).status === 400);
  check('a label that lies about the bytes is refused', (await crop(agent, original, `data:image/png;base64,${JPEG.toString('base64')}`)).status === 400);
  check('a monitor cannot crop', (await crop(monitor, original, `data:image/jpeg;base64,${JPEG.toString('base64')}`)).status === 403);
  const done = await crop(agent, original, `data:image/jpeg;base64,${JPEG.toString('base64')}`);
  const body: any = await done.json();
  check('an agent stores the cropped photo', done.status === 200 && typeof body.url === 'string', `status ${done.status}`);
  const report = (await db.collection('reports').doc('crop-r1').get()).data() ?? {};
  check('...it replaces the original in the same place', report.media?.[0]?.url === body.url && report.images?.[0] === body.url && report.media?.length === 2);
  const [exists] = await bucket.file(report.media?.[0]?.path ?? 'x').exists();
  check('...the cut is stored under reports/', exists && String(report.media?.[0]?.path).startsWith('reports/edited/crop-r1/'));
  const kept = await db.collection('reports').doc('crop-r1').collection('removedMedia').get();
  check('...the original is kept privately and can be restored', kept.size === 1 && kept.docs[0].data().url === original && kept.docs[0].data().replacedBy === body.url);
  check('...and the original file is untouched', (await bucket.file(path).exists())[0]);

  console.log('\n3. Undoing the crop');
  const uncrop = (token: string, url: string) => fetch(`${BASE}/api/v1/reports/crop-r1/media/uncrop`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ url }),
  });
  check('a monitor cannot undo a crop', (await uncrop(monitor, body.url)).status === 403);
  check('a photo that was never cropped has no original', (await uncrop(agent, 'https://example.com/none.png')).status === 404);
  const undone = await uncrop(agent, body.url);
  check('the agent restores the original', undone.status === 200, `status ${undone.status}`);
  const restored = (await db.collection('reports').doc('crop-r1').get()).data() ?? {};
  check('...the original is back in the same place', restored.media?.[0]?.url === original && restored.images?.[0] === original && restored.media?.length === 2);
  check('...with no leftover crop marker, and the private copy is cleared', !restored.media?.[0]?.editedAt && !restored.media?.[0]?.replacedBy
    && (await db.collection('reports').doc('crop-r1').collection('removedMedia').get()).size === 0);

  await db.recursiveDelete(db.collection('reports').doc('crop-r1'));
  await bucket.deleteFiles({ prefix: 'reports/crop-user/' }).catch(() => undefined);
  await bucket.deleteFiles({ prefix: 'reports/edited/crop-r1/' }).catch(() => undefined);
  await Promise.all(['crop-agent', 'crop-monitor'].map(u => auth.deleteUser(u).catch(() => undefined)));
  console.log(`\n${passed} passed, ${failures.length} failed.`);
  if (failures.length) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1); }
}

main().catch(error => { console.error('Check aborted:', error); process.exit(1); });

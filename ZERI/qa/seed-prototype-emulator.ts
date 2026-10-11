import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { PROTOTYPE_ADMIN, PROTOTYPE_COLLECTIONS, PROTOTYPE_SETTINGS, PROTOTYPE_USERS } from './prototype-emulator-data';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || '';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '';

if (!projectId.startsWith('demo-') || !authHost.startsWith('127.0.0.1:') || !firestoreHost.startsWith('127.0.0.1:')) {
  throw new Error('Seed-i u ndal: kërkohen projekt demo-* dhe emulators Auth/Firestore në 127.0.0.1.');
}
if (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  throw new Error('Seed-i u ndal: kredencialet e shërbimit nuk lejohen në prototip.');
}

const app = getApps()[0] || initializeApp({ projectId });
const auth = getAuth(app);
const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

async function seed() {
  let adminUser;
  try {
    adminUser = await auth.getUserByEmail(PROTOTYPE_ADMIN.email);
    adminUser = await auth.updateUser(adminUser.uid, {
      password: PROTOTYPE_ADMIN.password,
      displayName: PROTOTYPE_ADMIN.name,
      emailVerified: true,
      disabled: false,
    });
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    adminUser = await auth.createUser({
      uid: PROTOTYPE_ADMIN.uid,
      email: PROTOTYPE_ADMIN.email,
      password: PROTOTYPE_ADMIN.password,
      displayName: PROTOTYPE_ADMIN.name,
      emailVerified: true,
      disabled: false,
    });
  }

  await auth.setCustomUserClaims(adminUser.uid, {
    role: 'superadmin',
    admin: true,
    superadmin: true,
    permissions: [],
  });

  const userProfile = {
    ...PROTOTYPE_USERS.find((user) => user.id === adminUser.uid)!,
    id: adminUser.uid,
  };
  await db.collection('users').doc(adminUser.uid).set(userProfile, { merge: true });

  let batch = db.batch();
  let writes = 0;
  const commit = async () => {
    if (writes === 0) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  };

  for (const [collectionName, records] of Object.entries(PROTOTYPE_COLLECTIONS)) {
    for (const record of records) {
      const { id, ...fields } = record;
      if (!id) throw new Error(`Mungon id në koleksionin ${collectionName}.`);
      batch.set(db.collection(collectionName).doc(String(id)), fields, { merge: true });
      writes += 1;
      if (writes >= 400) await commit();
    }
  }

  batch.set(db.collection('settings').doc('general'), PROTOTYPE_SETTINGS, { merge: true });
  writes += 1;
  batch.set(db.collection('settings').doc('ads-private'), {
    adSenseEnabled: false,
    adSenseClientId: '',
    adSenseSlot: '',
    adSenseCode: '',
  }, { merge: true });
  writes += 1;
  batch.set(db.collection('settings').doc('prototype-seed'), {
    environment: 'Firebase Emulator lokal',
    seededAt: FieldValue.serverTimestamp(),
    projectId,
  }, { merge: true });
  writes += 1;
  await commit();

  console.log(`U mbollën të dhënat e prototipit në ${projectId}: ${Object.entries(PROTOTYPE_COLLECTIONS).map(([name, rows]) => `${name}=${rows.length}`).join(', ')}`);
  console.log(`Hyrja lokale: ${PROTOTYPE_ADMIN.email}`);
}

seed().catch((error) => {
  console.error('Dështoi seed-i i emulatorit:', error);
  process.exitCode = 1;
});

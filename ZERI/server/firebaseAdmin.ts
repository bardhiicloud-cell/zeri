/**
 * Firebase Admin access, resolved in one place.
 *
 * The server and the browser must agree on *which* Firebase project and *which*
 * Firestore database they are talking to. They did not:
 *
 *   - the web SDK (src/lib/firebase.ts) reads `gen-lang-client-0907710011` and a
 *     named database id from `VITE_FIREBASE_DATABASE_ID`;
 *   - the Admin SDK was initialised with a hardcoded fallback project id and
 *     called `getFirestore()` with no argument, which targets the `(default)`
 *     database that this project does not have.
 *
 * Every server-side read therefore hit a different, empty database, and once the
 * default credentials were also missing it failed outright with
 * "Could not load the default credentials" instead of returning data.
 *
 * Everything server-side now goes through `db()` so the two halves can only
 * diverge here.
 */
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import appletConfig from '../firebase-applet-config.json';
import { readFileSync } from 'node:fs';

export const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  'gen-lang-client-0907710011';

/**
 * The named database id.
 *
 * `getFirestore()` without an id targets `(default)`. When the project was
 * created with a named database instead, that call either throws or silently
 * addresses a database nobody writes to.
 */
export const FIRESTORE_DATABASE_ID =
  process.env.FIREBASE_DATABASE_ID ||
  process.env.VITE_FIREBASE_DATABASE_ID ||
  undefined;

/** Service-account credentials from the environment, when present. */
function resolveServiceAccount(): Record<string, unknown> | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) {
    try {
      return JSON.parse(inline);
    } catch {
      console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT nuk është JSON i vlefshëm.');
    }
  }

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (filePath) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.error('[firebase-admin] Nuk mund të lexohet FIREBASE_SERVICE_ACCOUNT_PATH:', error);
    }
  }

  return null;
}

const serviceAccount = resolveServiceAccount();

/**
 * Emulator access is valid only for a local demo project with both Auth and
 * Firestore hosts configured, and only when no service-account secret exists.
 */
export const isLocalFirebaseEmulator =
  process.env.NODE_ENV !== 'production' &&
  FIREBASE_PROJECT_ID.startsWith('demo-') &&
  Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST) &&
  Boolean(process.env.FIRESTORE_EMULATOR_HOST) &&
  !serviceAccount;

/**
 * Whether the Admin SDK can actually authenticate.
 *
 * Routes that read through Admin check this and answer 503 rather than 500: the
 * data is not gone, the server is simply not configured, and a 503 is the honest
 * status for that.
 */
export const hasAdminCredentials = Boolean(serviceAccount) || isLocalFirebaseEmulator;

let appInstance: App | null = null;

export function adminApp(): App {
  if (!appInstance) {
    if (!getApps().length) {
      initializeApp({
        projectId: FIREBASE_PROJECT_ID,
        ...(serviceAccount ? { credential: cert(serviceAccount as any) } : {}),
      });
    }
    appInstance = getApps()[0];
  }
  return appInstance;
}

let firestoreInstance: Firestore | null = null;

/**
 * Firestore bound to the same named database the web client uses.
 *
 * `ignoreUndefinedProperties` is on because the code base writes `value || undefined`
 * throughout to mean "leave this field out". Without the setting the Admin SDK
 * rejects the whole write ("Cannot use undefined as a Firestore value"), which
 * made report creation fail for any report with an attachment and made the live
 * report-event feed fail for any status change without a note. `settings()` may be
 * called only once and only before first use, hence the single shared instance.
 */
export function db(): Firestore {
  if (!firestoreInstance) {
    adminApp();
    firestoreInstance = FIRESTORE_DATABASE_ID ? getFirestore(FIRESTORE_DATABASE_ID) : getFirestore();
    firestoreInstance.settings({ ignoreUndefinedProperties: true });
  }
  return firestoreInstance;
}

/**
 * Default Storage bucket. The web SDK reads the same value from its config; the
 * server needs it to erase a person's uploaded files.
 */
export const STORAGE_BUCKET: string =
  process.env.FIREBASE_STORAGE_BUCKET ||
  process.env.VITE_FIREBASE_STORAGE_BUCKET ||
  (appletConfig as { storageBucket?: string }).storageBucket ||
  '';

/** The Storage bucket, or null when none is configured. */
export function storageBucket() {
  if (!STORAGE_BUCKET) return null;
  adminApp();
  return getStorage().bucket(STORAGE_BUCKET);
}

/** Admin Auth handle. */
export function authAdmin(): Auth {
  adminApp();
  return getAuth();
}

if (!serviceAccount && !isLocalFirebaseEmulator) {
  console.warn(
    '[firebase-admin] Pa kredenciale shërbimi. Endpointet që lexojnë Firestore nga serveri do të ' +
    'kthejnë 503 derisa FIREBASE_SERVICE_ACCOUNT ose FIREBASE_SERVICE_ACCOUNT_PATH të vendoset. ' +
    'Klienti web vazhdon të punojë normalisht me SDK-në e tij.'
  );
}

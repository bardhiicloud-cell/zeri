import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  connectAuthEmulator,
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  AuthProvider,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import appletConfig from '../../firebase-applet-config.json';

const usePrototypeEmulators =
  import.meta.env.DEV &&
  import.meta.env.VITE_PROTOTYPE_ADMIN === 'true' &&
  import.meta.env.VITE_PROTOTYPE_FIREBASE_EMULATORS === 'true';

const configuredProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId;
if (usePrototypeEmulators && !configuredProjectId.startsWith('demo-')) {
  throw new Error('Prototipi lokal kërkon project ID demo-*; ndaloni para se të lidheni me Firebase real.');
}

const firebaseConfig = usePrototypeEmulators
  ? {
      apiKey: 'demo-api-key',
      authDomain: `${configuredProjectId}.firebaseapp.com`,
      projectId: configuredProjectId,
      storageBucket: `${configuredProjectId}.firebasestorage.app`,
      messagingSenderId: '000000000000',
      appId: '1:000000000000:web:prototype-local-only',
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
      projectId: configuredProjectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
      appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId,
    };

const isFirstInit = !getApps().length;
const app = isFirstInit ? initializeApp(firebaseConfig) : getApp();

/**
 * App Check, required once it is enforced for Authentication.
 *
 * With enforcement on, the Identity Toolkit API answers every request that has
 * no App Check token with `401 Firebase App Check token is invalid`. That
 * blocks Google sign-in, email sign-in and the anonymous guest session alike,
 * and the popup surfaces it as a vague `auth/internal-error`. It has to be
 * initialised straight after `initializeApp` and before the first Auth call.
 *
 * Opt-in: nothing happens until a site key is configured, so an environment
 * without enforcement behaves exactly as before. Skipped for the emulators,
 * which do not check tokens.
 */
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
if (isFirstInit && appCheckSiteKey && !usePrototypeEmulators) {
  if (import.meta.env.DEV) {
    // localhost cannot pass reCAPTCHA. The debug token is generated once, logged
    // to the console, and must be registered under Firebase Console → App Check
    // → the web app → Manage debug tokens. Never shipped in a production build.
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN || true;
  }
  initializeAppCheck(app, {
    provider: import.meta.env.VITE_FIREBASE_APPCHECK_PROVIDER === 'enterprise'
      ? new ReCaptchaEnterpriseProvider(appCheckSiteKey)
      : new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

const configuredDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId;
const firestoreDatabaseId = usePrototypeEmulators ? import.meta.env.VITE_FIREBASE_DATABASE_ID : configuredDatabaseId;
const firestoreConfig = firestoreDatabaseId && firestoreDatabaseId !== '(default)'
  ? { databaseId: firestoreDatabaseId }
  : undefined;

export const auth = getAuth(app);
export const db = firestoreConfig?.databaseId
  ? getFirestore(app, firestoreConfig.databaseId)
  : getFirestore(app);

/**
 * Cloud Storage is only needed when someone uploads or opens an attachment, so
 * its ~130 kB SDK is fetched on first use instead of on every page view. Both
 * the module and the instance are created once.
 */
let storageSdk: Promise<{ sdk: typeof import('firebase/storage'); storage: FirebaseStorage }> | null = null;
export function loadStorage() {
  storageSdk ??= import('firebase/storage').then((sdk) => {
    const storage = sdk.getStorage(app);
    // Fail a dead transfer in half a minute instead of the SDK default of ten minutes.
    storage.maxUploadRetryTime = 30000;
    storage.maxOperationRetryTime = 20000;
    if (usePrototypeEmulators) sdk.connectStorageEmulator(storage, '127.0.0.1', 9199);
    return { sdk, storage };
  }).catch((error) => {
    storageSdk = null;
    throw error;
  });
  return storageSdk;
}

if (usePrototypeEmulators) {
  // These fixed loopback endpoints are used only in a Vite development build
  // with the explicit prototype + emulator flags and a demo-* project id.
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export const isPrototypeEmulatorMode = usePrototypeEmulators;

// Security: allowed MIME types for upload
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif'
]);
const ALLOWED_VIDEO_TYPES = new Set([
  // video/quicktime is what an iPhone records (.mov).
  'video/mp4', 'video/webm', 'video/quicktime'
]);
/**
 * Documents and audio are accepted as report evidence ("mos humb asnjë
 * attachment"). Kept to a conservative, non-executable set: PDF and common
 * office/text formats, plus standard audio containers. Executables and archives
 * are deliberately excluded so a report can never carry a payload.
 */
const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm',
]);
const ALLOWED_HEALTH_DOCUMENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf'
]);

/**
 * Root buckets writable by citizens/admin, mirroring storage.rules:
 *   reports/{uid}/{scope}/{file}   → 10 MB
 *   avatars/{uid}/{file}           →  2 MB
 *   health/{uid}/{scope}/{file}    →  5 MB
 * Anything outside these prefixes is denied by the deployed rules.
 */
export type UploadKind = 'reports' | 'avatars' | 'health' | 'forum_dms';

export const MAX_UPLOAD_BYTES: Record<UploadKind, number> = {
  reports: 10 * 1024 * 1024,
  avatars: 2 * 1024 * 1024,
  health: 5 * 1024 * 1024,
  /** Direct-message images share the health limit: private, small media. */
  forum_dms: 5 * 1024 * 1024,
};

/** A 30-second phone video is far larger than a photo, so videos get their own cap. */
export const MAX_REPORT_VIDEO_BYTES = 50 * 1024 * 1024;
/** Report evidence limits shown to the citizen. */
export const REPORT_MEDIA_LIMITS = { images: 10, videos: 3, videoSeconds: 30 } as const;

export const formatBytes = (bytes: number): string =>
  `${Math.round(bytes / (1024 * 1024))}MB`;

/**
 * Google sign-in with popup, falling back to a full-page redirect.
 *
 * `auth/internal-error` from a popup almost always means the popup could not
 * talk back to the opener — third-party cookies blocked, private browsing, or
 * an embedded browser. The redirect flow does not need that handshake, so it
 * succeeds where the popup fails. The result of a redirect flow is picked up
 * once on the next load by `readGoogleRedirectResult`.
 */
let redirectFlowStarted = false;

export async function signInWithGoogle(provider: AuthProvider): Promise<import('firebase/auth').UserCredential> {
  try {
    return await signInWithPopup(auth, provider);
  } catch (err: any) {
    const code = err?.code || '';
    const userCancelled =
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request';
    const popupUnusable =
      code === 'auth/internal-error' ||
      code === 'auth/popup-blocked' ||
      code === 'auth/popup-blocked-by-browsers' ||
      code === 'auth/operation-not-supported-in-this-environment';
    if (!userCancelled && popupUnusable && !redirectFlowStarted) {
      redirectFlowStarted = true;
      await signInWithRedirect(auth, provider);
      // Control leaves this page; the promise never settles in practice.
      return new Promise(() => {});
    }
    throw err;
  }
}

/** Resolves a pending redirect sign-in on page load, if one is in flight. */
export function readGoogleRedirectResult() {
  return getRedirectResult(auth);
}

export async function getUserIdTokenResult(): Promise<any> {
  const u = auth.currentUser;
  if (!u) return null;
  return u.getIdTokenResult();
}

export async function isUserAdmin(): Promise<boolean> {
  const claims = await getUserIdTokenResult();
  return !!claims?.claims?.admin || !!claims?.claims?.superadmin;
}

export async function getUserRole(): Promise<string | null> {
  const claims = await getUserIdTokenResult();
  if (claims?.claims?.superadmin) return 'superadmin';
  if (claims?.claims?.admin) return 'admin';
  if (claims?.claims?.approver) return 'approver';
  if (claims?.claims?.adsadmin) return 'adsadmin';
  if (claims?.claims?.newsadmin) return 'newsadmin';
  if (claims?.claims?.debatwp) return 'debatwp';
  if (claims?.claims?.agent) return 'agent';
  return 'citizen';
}

/**
 * Security-hardened upload helper.
 *
 * Builds the storage path so it always matches the deployed storage.rules:
 *   reports/{uid}/{scope}/{file}   10 MB
 *   avatars/{uid}/{file}            2 MB
 *   health/{uid}/{scope}/{file}     5 MB
 *
 * `scope` groups files inside the owner's namespace (a report id, 'ads',
 * 'forum', …) and defaults to 'media', so a caller can never escape the
 * owner prefix. Anything outside these prefixes is denied by the rules.
 */
export const uploadFileToStorage = async (
  file: File,
  kind: UploadKind,
  options?: { userId?: string; scope?: string; onProgress?: (sent: number, total: number) => void }
): Promise<string> => {
  if (!file) throw new Error("Asnjë fajll nuk u dha.");

  const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.has(file.type);
  const isDocument = ALLOWED_DOCUMENT_TYPES.has(file.type);
  const isAudio = ALLOWED_AUDIO_TYPES.has(file.type);

  // Documents and audio are report evidence only; avatars and health uploads
  // keep their narrower whitelists.
  const allowedForKind =
    kind === 'reports' ? (isImage || isVideo || isDocument || isAudio) : (isImage || isVideo);

  if (!allowedForKind) {
    throw new Error(
      kind === 'reports'
        ? `Formati "${file.type || 'i panjohur'}" nuk lejohet. Lejohen JPEG, PNG, WebP, GIF, video MP4/WebM, dokumente PDF/DOCX/TXT dhe audio MP3/WAV/OGG.`
        : `Formati "${file.type || 'i panjohur'}" nuk lejohet. Lejohen JPEG, PNG, WebP, GIF dhe video MP4/WebM.`
    );
  }

  const maxBytes = kind === 'reports' && isVideo ? MAX_REPORT_VIDEO_BYTES : MAX_UPLOAD_BYTES[kind];
  if (file.size > maxBytes) {
    throw new Error(`Fajlli "${file.name}" është ${(file.size / 1024 / 1024).toFixed(1)}MB dhe tejkalon kufirin prej ${formatBytes(maxBytes)}.`);
  }

  const uid = options?.userId || auth.currentUser?.uid;
  if (!uid) {
    throw new Error("Ngarkimi kërkon një sesion aktiv. Kyçuni ose vazhdoni si mysafir.");
  }

  const safeScope = (options?.scope || 'media').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'media';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  const uniqueName = `${Date.now()}_${safeName}`;

  const fullPath = kind === 'avatars'
    ? `avatars/${uid}/${uniqueName}`
    : `${kind}/${uid}/${safeScope}/${uniqueName}`;

  const { sdk: storageSdkApi, storage } = await loadStorage();
  const storageRef = storageSdkApi.ref(storage, fullPath);

  const uploadTask = storageSdkApi.uploadBytesResumable(storageRef, file, { contentType: file.type });

  /*
   * Firebase Storage retries a failing transfer for up to ten minutes by itself, so
   * a bucket that is missing, blocked by App Check or unreachable looked like an
   * upload that "never finishes". Two bounds replace that: a stall bound (no byte
   * moved for STALL_MS) and an overall ceiling. Either one cancels the transfer and
   * gives the citizen a clear message to retry or send without the file.
   */
  const STALL_MS = isVideo ? 45000 : 20000;
  const overallMs = isVideo ? 180000 : 60000;

  return await new Promise<string>((resolve, reject) => {
    let settled = false;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    const overallTimer = setTimeout(() => fail(new Error(`Ngarkimi i "${file.name}" zgjati shumë. Provoni përsëri.`)), overallMs);
    const finish = () => { settled = true; clearTimeout(stallTimer); clearTimeout(overallTimer); };
    const fail = (error: Error) => {
      if (settled) return;
      finish();
      try { uploadTask.cancel(); } catch { /* transfer already settled */ }
      reject(error);
    };
    const armStall = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(
        () => fail(new Error(`Lidhja me ruajtjen e fajllave nuk po përgjigjet (${file.name}). Kontrolloni internetin dhe provoni përsëri.`)),
        STALL_MS,
      );
    };
    armStall();
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        armStall();
        options?.onProgress?.(snapshot.bytesTransferred, snapshot.totalBytes);
      },
      (error) => fail(new Error(describeStorageError(error, file.name))),
      () => {
        storageSdkApi.getDownloadURL(uploadTask.snapshot.ref).then(
          (url) => { if (!settled) { finish(); resolve(url); } },
          (error) => fail(new Error(describeStorageError(error, file.name))),
        );
      },
    );
  });
};

/** A citizen-readable reason for a Storage failure (the SDK's own text is English and technical). */
function describeStorageError(error: unknown, name: string): string {
  const code = (error as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'storage/unauthorized':
    case 'storage/unauthenticated':
      return `Ngarkimi i "${name}" u refuzua: sesioni ose lejet e ruajtjes nuk e lejuan. Rifreskoni faqen dhe provoni përsëri.`;
    case 'storage/retry-limit-exceeded':
    case 'storage/network-request-failed':
      return `Lidhja u ndërpre gjatë ngarkimit të "${name}". Provoni përsëri.`;
    case 'storage/quota-exceeded':
      return 'Hapësira e ruajtjes është e plotë; njoftoni administratorin.';
    case 'storage/bucket-not-found':
    case 'storage/project-not-found':
      return 'Vendi ku ruhen fotot nuk është i konfiguruar; njoftoni administratorin.';
    case 'storage/canceled':
      return `Ngarkimi i "${name}" u ndalua.`;
    default:
      return `Ngarkimi i "${name}" dështoi${code ? ` (${code})` : ''}. Provoni përsëri.`;
  }
}

/** Uploads a private health attachment and returns its storage path, never a public download token URL. */
export async function uploadPrivateHealthDocument(file: File, scope = 'registry'): Promise<string> {
  if (!file || !ALLOWED_HEALTH_DOCUMENT_TYPES.has(file.type)) {
    throw new Error('Lejohen fotografi JPG/PNG/WebP dhe dokumente PDF.');
  }
  if (file.size > MAX_UPLOAD_BYTES.health) {
    throw new Error(`Dokumenti tejkalon kufirin prej ${formatBytes(MAX_UPLOAD_BYTES.health)}.`);
  }

  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Ngarkimi i dokumentit kërkon një llogari të regjistruar.');

  const safeScope = scope.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'registry';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  const path = `health/${uid}/${safeScope}/${Date.now()}_${safeName}`;
  const { sdk, storage } = await loadStorage();
  const uploadTask = sdk.uploadBytesResumable(sdk.ref(storage, path), file, { contentType: file.type });
  await uploadTask;
  return path;
}

export async function readPrivateHealthDocument(path: string): Promise<Blob> {
  if (!path.startsWith('health/')) throw new Error('Shtegu i dokumentit shëndetësor nuk është i vlefshëm.');
  const { sdk, storage } = await loadStorage();
  return sdk.getBlob(sdk.ref(storage, path), MAX_UPLOAD_BYTES.health);
}

export default app;

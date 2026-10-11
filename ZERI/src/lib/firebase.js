import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import appletConfig from '../../firebase-applet-config.json';

const usePrototypeEmulators = import.meta.env.DEV &&
    import.meta.env.VITE_PROTOTYPE_ADMIN === 'true' &&
    import.meta.env.VITE_PROTOTYPE_FIREBASE_EMULATORS === 'true';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId;
if (usePrototypeEmulators && !projectId.startsWith('demo-')) {
    throw new Error('Prototipi lokal kërkon project ID demo-*; ndaloni para se të lidheni me Firebase real.');
}
const firebaseConfig = usePrototypeEmulators ? {
    apiKey: 'demo-api-key',
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: `${projectId}.firebasestorage.app`,
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:prototype-local-only',
} : {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId,
};
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const databaseId = usePrototypeEmulators
    ? import.meta.env.VITE_FIREBASE_DATABASE_ID
    : (import.meta.env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId);
const firestoreConfig = databaseId && databaseId !== '(default)' ? { databaseId } : undefined;
export const auth = getAuth(app);
export const db = firestoreConfig?.databaseId
    ? getFirestore(app, firestoreConfig.databaseId)
    : getFirestore(app);
export const storage = getStorage(app);
if (usePrototypeEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
}
export const isPrototypeEmulatorMode = usePrototypeEmulators;
// Security: allowed MIME types for upload
const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif'
]);
const ALLOWED_VIDEO_TYPES = new Set([
    'video/mp4', 'video/webm'
]);
export const MAX_UPLOAD_BYTES = {
    reports: 10 * 1024 * 1024,
    avatars: 2 * 1024 * 1024,
    health: 5 * 1024 * 1024,
};
export const formatBytes = (bytes) => `${Math.round(bytes / (1024 * 1024))}MB`;
export async function getUserIdTokenResult() {
    const u = auth.currentUser;
    if (!u)
        return null;
    return u.getIdTokenResult();
}
export async function isUserAdmin() {
    const claims = await getUserIdTokenResult();
    return !!claims?.claims?.admin || !!claims?.claims?.superadmin;
}
export async function getUserRole() {
    const claims = await getUserIdTokenResult();
    if (claims?.claims?.superadmin)
        return 'superadmin';
    if (claims?.claims?.admin)
        return 'admin';
    if (claims?.claims?.approver)
        return 'approver';
    if (claims?.claims?.adsadmin)
        return 'adsadmin';
    if (claims?.claims?.newsadmin)
        return 'newsadmin';
    if (claims?.claims?.agent)
        return 'agent';
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
export const uploadFileToStorage = async (file, kind, options) => {
    if (!file)
        throw new Error("Asnjë fajll nuk u dha.");
    const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.has(file.type);
    if (!isImage && !isVideo) {
        throw new Error(`Formati "${file.type || 'i panjohur'}" nuk lejohet. Lejohen JPEG, PNG, WebP, GIF dhe video MP4/WebM.`);
    }
    const maxBytes = MAX_UPLOAD_BYTES[kind];
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
    const storageRef = ref(storage, fullPath);
    const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type });
    const uploadPromise = (async () => {
        const snapshot = await uploadTask;
        return (await getDownloadURL(snapshot.ref));
    })();
    // Generous ceiling: a 10 MB video over a slow mobile link needs far more than
    // the old 8s, which made normal uploads look like failures.
    const timeoutMs = isVideo ? 180000 : 60000;
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            // Stop the transfer so a timed-out upload stops consuming bandwidth.
            try {
                uploadTask.cancel();
            }
            catch {
                /* transfer already settled */
            }
            reject(new Error(`Ngarkimi i "${file.name}" zgjati shumë. Provoni përsëri.`));
        }, timeoutMs);
    });
    return (await Promise.race([uploadPromise, timeoutPromise]));
};
export default app;

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Consent-gated GA4 measurement id. Left empty unless analytics are wanted. */
  readonly VITE_GA_MEASUREMENT_ID?: string;
  /** Connect every Firebase web SDK to local emulators; development only. */
  readonly VITE_PROTOTYPE_FIREBASE_EMULATORS?: 'true' | 'false';
  readonly VITE_FIREBASE_AUTH_EMULATOR_HOST?: string;
  readonly VITE_FIREBASE_FIRESTORE_EMULATOR_HOST?: string;
  readonly VITE_FIREBASE_STORAGE_EMULATOR_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Consent-gated GA4 measurement id. Left empty unless analytics are wanted. */
  readonly VITE_GA_MEASUREMENT_ID?: string;
  /** Connect every Firebase web SDK to local emulators; development only. */
  readonly VITE_PROTOTYPE_FIREBASE_EMULATORS?: 'true' | 'false';
  readonly VITE_FIREBASE_AUTH_EMULATOR_HOST?: string;
  readonly VITE_FIREBASE_FIRESTORE_EMULATOR_HOST?: string;
  readonly VITE_FIREBASE_STORAGE_EMULATOR_HOST?: string;
  /** reCAPTCHA site key registered in Firebase App Check. Required once App Check is enforced for Authentication. */
  readonly VITE_FIREBASE_APPCHECK_SITE_KEY?: string;
  /** Which reCAPTCHA product the site key belongs to. Defaults to 'v3'. */
  readonly VITE_FIREBASE_APPCHECK_PROVIDER?: 'v3' | 'enterprise';
  /** Optional fixed debug token for local development; unset prints a fresh one to the console. */
  readonly VITE_FIREBASE_APPCHECK_DEBUG_TOKEN?: string;
  /** Address of the Express API when it is not served from the same origin, e.g. https://zeri-api.onrender.com. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

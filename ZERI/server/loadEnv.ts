/**
 * Environment loading, in one place, imported first by `server.ts`.
 *
 * Two things make this its own module rather than a line in the server:
 *
 *  1. ORDER. `server/firebaseAdmin.ts` reads the service account at module-load
 *     time. Any module that imports it must do so only after the environment is
 *     populated, so the loading has to happen in a module that is imported
 *     before everything else — not as a statement inside `server.ts`, which would
 *     run after its own imports have already been evaluated.
 *
 *  2. ORDER OF FILES. The credentials live in `.env.local`, which is what
 *     Create React App and Vite conventions both use for machine-local secrets
 *     that must not be committed. `dotenv/config` reads only `.env`, so relying
 *     on it silently found nothing. Each file is loaded explicitly, and a real
 *     environment variable always wins over a file — that is dotenv's default
 *     and the correct behaviour for deployment, where the platform injects the
 *     secrets and no file exists.
 *
 * A missing file is not an error: production supplies the variables through the
 * environment, and the absence of `.env.local` there is expected.
 */
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Files to try, most specific first. A later file never overwrites an earlier one. */
const ENV_FILES = ['.env.local', '.env'];

let loaded = false;

/** The names that actually enable Firebase Admin, for the startup log. */
function reportCredentialStatus(): void {
  const hasInline = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
  const pathValue = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const hasFile = Boolean(pathValue) && existsSync(path.resolve(process.cwd(), pathValue as string));

  if (hasInline || hasFile) {
    console.log(
      `[env] Firebase Admin credentials: ${hasInline ? 'FIREBASE_SERVICE_ACCOUNT (inline)' : `file ${pathValue}`}`
    );
    return;
  }

  /**
   * Worth a loud warning rather than silence.
   *
   * Without credentials the Admin SDK cannot verify an ID token, so every
   * authenticated request fails with a generic 401 and the UI reports
   * "Unauthorized: Missing or invalid token" for a sign-in that is in fact
   * perfectly valid. That failure mode is indistinguishable from a bad password
   * or a missing session, so it costs hours to diagnose. Saying it at startup
   * turns a mysterious runtime error into a one-line fix.
   */
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
  if (projectId.startsWith('demo-')) return; // Local emulator: verified via emulator, no key needed.

  console.warn(
    '[env] ASNJË kredencial Firebase Admin. Token-i nuk mund të verifikohet, ' +
      'prandaj çdo veprim admin kthen 401 ("Unauthorized: Missing or invalid token"). ' +
      'Vendosni FIREBASE_SERVICE_ACCOUNT_PATH (p.sh. ./serviceAccountKey.json) ose ' +
      'FIREBASE_SERVICE_ACCOUNT me përmbajtjen JSON të llogarisë së shërbimit.'
  );
}

/**
 * Populate `process.env` from the environment files, once.
 *
 * Idempotent: the server can be imported by tests and tooling that also load it,
 * and re-reading the files would be wasted work and could re-log the warning.
 */
export function loadEnvironment(): void {
  if (loaded) return;
  loaded = true;

  for (const file of ENV_FILES) {
    const filePath = path.resolve(process.cwd(), file);
    if (!existsSync(filePath)) continue;
    // `quiet` keeps the startup log free of dotenv's own banner; the credential
    // report below is the message that actually matters.
    config({ path: filePath, quiet: true });
  }

  reportCredentialStatus();
}

// Loading on import is the point of the module: `server.ts` imports it first and
// relies on the side effect having happened before `firebaseAdmin` is evaluated.
loadEnvironment();

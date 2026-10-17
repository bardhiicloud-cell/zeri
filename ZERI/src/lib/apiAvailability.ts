import { fetchWithTimeout, isJsonResponse } from './timeouts';

/**
 * Whether the `/api` server is reachable *and* can read and write Firestore.
 *
 * A static host (Firebase Hosting) without the `/api` rewrite answers
 * every path with `index.html`; a server without its service account answers
 * but cannot store anything; a sleeping free-plan server answers after ~30 s.
 * In all three cases the citizen's report and Track ID lookup go straight to
 * Firestore, so asking the server first only adds waiting. One short probe of
 * `/api/health` decides, and the answer is reused for the rest of the visit.
 */
const PROBE_TIMEOUT_MS = 3000;
/** A negative answer is re-checked after this long, so a server that wakes up is used again. */
const RETRY_AFTER_MS = 60_000;

let cached: { ready: boolean; at: number } | null = null;
let inFlight: Promise<boolean> | null = null;

async function probe(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout('/api/health', { headers: { Accept: 'application/json' }, cache: 'no-store' }, PROBE_TIMEOUT_MS);
    if (!response.ok || !isJsonResponse(response)) return false;
    const body = await response.json().catch(() => null) as { status?: string; dataSource?: string } | null;
    return body?.status === 'ok' && body?.dataSource === 'firestore';
  } catch {
    return false;
  }
}

export function apiReady(): Promise<boolean> {
  if (cached && (cached.ready || Date.now() - cached.at < RETRY_AFTER_MS)) return Promise.resolve(cached.ready);
  if (!inFlight) {
    inFlight = probe().then((ready) => {
      cached = { ready, at: Date.now() };
      inFlight = null;
      return ready;
    });
  }
  return inFlight;
}

/** The server answered in a way that shows it is not usable after all. */
export function markApiUnavailable(): void {
  cached = { ready: false, at: Date.now() };
}

/** Test seam. */
export function resetApiAvailability(): void {
  cached = null;
  inFlight = null;
}

/**
 * Where `/api/*` lives, and what a page sees when it is not there.
 *
 * The site is served by Firebase Hosting, which cannot forward `/api/*` to a server
 * outside Google Cloud. The Express server (server.ts) therefore runs elsewhere
 * (Render, Cloud Run) and its address is baked in at build time as `VITE_API_BASE`
 * (GitHub → Settings → Variables → `API_BASE_URL`, read by deploy-hosting.yml).
 *
 * `installApiFetch()` wraps `window.fetch` once, before the app renders, so every one
 * of the many `fetch('/api/...')` calls in the app goes to that server without being
 * rewritten one by one.
 *
 * It also fixes the failure that showed as "null is not an object (evaluating
 * 'z.items')": without a server, Firebase Hosting answers every `/api/...` path with
 * `200 index.html`. Callers read that as JSON, got `null`, and crashed on `.items`.
 * Such an answer is now turned into a `503` JSON error with a message an operator can
 * act on, so every screen shows "the server is not connected" instead of crashing.
 */

const RAW_BASE = (import.meta.env.VITE_API_BASE ?? '').trim();

/** `https://zeri-api.onrender.com`, or '' when `/api` is same-origin. */
export const API_BASE = RAW_BASE.replace(/\/+$/, '');

export const API_UNAVAILABLE_CODE = 'api_unavailable';

export const API_UNAVAILABLE_MESSAGE =
  'Serveri i platformës nuk është i lidhur tani. Raportet e qytetarëve ruhen gjithsesi; veprimet e administratës kërkojnë serverin. Provoni përsëri pas pak.';

/** `/api/...` → full URL on the API host (unchanged when the API is same-origin). */
export function apiUrl(path: string): string {
  if (!API_BASE || !isApiPath(path)) return path;
  return `${API_BASE}${path}`;
}

export function isApiPath(path: string): boolean {
  return path === '/api' || path.startsWith('/api/') || path.startsWith('/api?');
}

function unavailable(): Response {
  return new Response(JSON.stringify({ error: API_UNAVAILABLE_MESSAGE, code: API_UNAVAILABLE_CODE }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

let installed = false;

export function installApiFetch(): void {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let path: string | null = null;
    if (typeof input === 'string') path = input;
    else if (input instanceof URL) path = input.origin === window.location.origin ? input.pathname + input.search : null;
    else if (input instanceof Request) {
      const url = new URL(input.url);
      path = url.origin === window.location.origin ? url.pathname + url.search : null;
    }

    if (!path || !isApiPath(path)) return nativeFetch(input, init);

    const target = apiUrl(path);
    const request = input instanceof Request ? new Request(target, input) : target;
    const response = await nativeFetch(request, init);

    // A static host answering an API path with its SPA page: there is no API here.
    const type = (response.headers.get('content-type') || '').toLowerCase();
    if (type.includes('text/html')) return unavailable();
    return response;
  };
}

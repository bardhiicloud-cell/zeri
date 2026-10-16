/**
 * Every network step of a citizen submission has an upper bound.
 *
 * Firebase calls (`signInAnonymously`, `setDoc`, `addDoc`) and `fetch` have no
 * deadline of their own: on a dead mobile link, behind a blocked App Check token
 * or against a sleeping backend they simply never settle, and the page that
 * awaited them stayed on its spinner forever. These helpers turn "never" into a
 * clear error the page can show, so the citizen always ends on either a Track ID
 * or a message saying what to do.
 */

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/**
 * `fetch` that aborts after `ms`. A caller-supplied signal still cancels it.
 * A timeout rejects with `TimeoutError`; a caller abort keeps its `AbortError`.
 */
export async function fetchWithTimeout(input: string, init: RequestInit = {}, ms = 30000): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  const outer = init.signal;
  const forward = () => controller.abort();
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', forward, { once: true });
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new TimeoutError('Serveri nuk u përgjigj në kohë.');
    throw error;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', forward);
  }
}

/**
 * True when the response really came from the API. On a static host without the
 * `/api` forward, every path answers 200 with `index.html`; reading that as JSON
 * used to throw deep inside the submit flow.
 */
export function isJsonResponse(response: Response): boolean {
  return (response.headers.get('content-type') || '').toLowerCase().includes('application/json');
}

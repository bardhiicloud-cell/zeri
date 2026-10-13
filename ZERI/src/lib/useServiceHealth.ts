import { useCallback, useEffect, useState } from 'react';

/**
 * A measured view of whether the platform is answering.
 *
 * The dashboard used to print a fixed "18ms • E lidhur" and "Gatishmëri 100%"
 * next to a LIVE SYNC badge. Those strings were constants, so they stayed green
 * through an outage — worst of all on the one screen an operator opens to find
 * out whether something is wrong. This hook measures instead: it times a real
 * round trip to `/api/health` (unauthenticated, counters only) and reports what
 * came back.
 */

export type ServiceState = 'checking' | 'ok' | 'degraded' | 'down';

export interface ServiceHealth {
  state: ServiceState;
  /** Round-trip time of the last successful check. */
  latencyMs: number | null;
  uptimeSeconds: number | null;
  /** `firestore` when the server can reach its data source, else `unavailable`. */
  dataSource: string | null;
  checkedAt: number | null;
  /** The browser's own view of its connection. */
  online: boolean;
}

/** Above this the API still answers but is slow enough to deserve a warning. */
export const SLOW_RESPONSE_MS = 2000;

const CHECK_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 8_000;

interface Probe {
  /** The request completed with a success status and a parseable body. */
  reachable: boolean;
  latencyMs: number | null;
  dataSource: string | null;
}

/** Turns one probe into the single state the dashboard shows. */
export function classifyService(probe: Probe, online: boolean): ServiceState {
  if (!online || !probe.reachable) return 'down';
  if (probe.dataSource !== 'firestore') return 'degraded';
  if (probe.latencyMs !== null && probe.latencyMs > SLOW_RESPONSE_MS) return 'degraded';
  return 'ok';
}

const INITIAL: ServiceHealth = {
  state: 'checking',
  latencyMs: null,
  uptimeSeconds: null,
  dataSource: null,
  checkedAt: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
};

export function useServiceHealth(): ServiceHealth & { recheck: () => void } {
  const [health, setHealth] = useState<ServiceHealth>(INITIAL);
  const [tick, setTick] = useState(0);

  const recheck = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const check = async () => {
      const online = navigator.onLine;
      const startedAt = performance.now();
      let probe: Probe = { reachable: false, latencyMs: null, dataSource: null };
      let uptimeSeconds: number | null = null;

      try {
        const response = await fetch('/api/health', { cache: 'no-store', signal: controller.signal });
        const latencyMs = Math.round(performance.now() - startedAt);
        const body = response.ok ? await response.json().catch(() => null) : null;
        if (body && typeof body === 'object') {
          probe = {
            reachable: true,
            latencyMs,
            dataSource: typeof body.dataSource === 'string' ? body.dataSource : null,
          };
          uptimeSeconds = typeof body.uptimeSeconds === 'number' ? body.uptimeSeconds : null;
        }
      } catch {
        // Network failure or timeout: the probe stays unreachable.
      } finally {
        window.clearTimeout(timeout);
      }

      if (cancelled) return;
      setHealth({
        state: classifyService(probe, online),
        latencyMs: probe.latencyMs,
        uptimeSeconds,
        dataSource: probe.dataSource,
        checkedAt: Date.now(),
        online,
      });
    };

    void check();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [tick]);

  // Re-probe on a slow cadence while the tab is visible, and immediately when
  // the browser reports that its connection changed.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!document.hidden) recheck();
    }, CHECK_INTERVAL_MS);
    window.addEventListener('online', recheck);
    window.addEventListener('offline', recheck);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', recheck);
      window.removeEventListener('offline', recheck);
    };
  }, [recheck]);

  return { ...health, recheck };
}

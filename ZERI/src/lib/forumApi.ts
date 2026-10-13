import { useEffect, useRef, useState } from 'react';
import { authHeaders } from './apiAuth';

/** Client for the public-debate endpoints in server/forumSocial.ts. */

export const VERIFICATION_PRICE_LABEL = '15,99 €';

export type VerificationState = {
  verified: boolean;
  verifiedUntil: number | null;
  status: 'none' | 'pending' | 'approved' | 'rejected';
  priceEur: number;
};

export type VerificationRequestItem = {
  uid: string;
  name: string;
  email: string;
  note: string;
  priceEur: number;
  createdAt: number | null;
};

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Kërkesa dështoi.');
  return data as T;
}

export const getMyVerification = () => call<VerificationState>('/api/v1/forum/verification/me');

export const requestVerification = (note: string) =>
  call<{ status: 'pending'; priceEur: number }>('/api/v1/forum/verification/request', { method: 'POST', body: { note } });

export const listVerificationRequests = () =>
  call<{ items: VerificationRequestItem[] }>('/api/v1/admin/verification-requests');

export const decideVerification = (uid: string, decision: 'approve' | 'reject', reason?: string) =>
  call<{ ok: true }>(`/api/v1/admin/verification-requests/${encodeURIComponent(uid)}/decision`, {
    method: 'POST',
    body: { decision, reason },
  });

/** Accounts whose tick is active. Refreshed every few minutes; empty until the first answer. */
export function useVerifiedIds(): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await call<{ ids: string[] }>('/api/v1/forum/verified-ids');
        if (!cancelled) setIds(new Set(data.ids));
      } catch {
        // No tick is shown rather than a wrong one.
      }
    };
    void load();
    const timer = window.setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
  return ids;
}

const VIEWED_KEY = 'zeri-forum-viewed';

function alreadyViewedThisSession(postId: string): boolean {
  try {
    const seen: string[] = JSON.parse(sessionStorage.getItem(VIEWED_KEY) || '[]');
    return seen.includes(postId);
  } catch {
    return false;
  }
}

function markViewed(postId: string): void {
  try {
    const seen: string[] = JSON.parse(sessionStorage.getItem(VIEWED_KEY) || '[]');
    seen.push(postId);
    sessionStorage.setItem(VIEWED_KEY, JSON.stringify(seen.slice(-300)));
  } catch {
    // Without sessionStorage the server still counts one view per account.
  }
}

/**
 * Count an impression when at least half of the post has been on screen for
 * under a second. Demo posts and posts the visitor wrote themselves are skipped.
 * The server deduplicates per account, so this is only an optimisation.
 */
export function usePostView(postId: string, enabled: boolean) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element || postId.startsWith('demo-') || alreadyViewedThisSession(postId)) return;
    if (typeof IntersectionObserver === 'undefined') return;

    let timer: number | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
        if (visible && timer === undefined) {
          timer = window.setTimeout(async () => {
            observer.disconnect();
            markViewed(postId);
            try {
              await call(`/api/v1/forum/posts/${encodeURIComponent(postId)}/view`, { method: 'POST', body: {} });
            } catch {
              // A missed impression is not worth a visible error.
            }
          }, 900);
        } else if (!visible && timer !== undefined) {
          window.clearTimeout(timer);
          timer = undefined;
        }
      },
      { threshold: [0, 0.5] }
    );
    observer.observe(element);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [postId, enabled]);

  return ref;
}

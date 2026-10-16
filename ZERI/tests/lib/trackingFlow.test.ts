import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeoutError, fetchWithTimeout, isJsonResponse, withTimeout } from '../../src/lib/timeouts';
import { createTrackingId } from '../../src/lib/session';
import { SUBMISSION_REFERENCE_PATTERN } from '../../server/newsTips';
import { TRACKING_ID_PATTERN, buildPublicTrackView } from '../../server/trackView';
import * as lookup from '../../server/trackLookup';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('withTimeout', () => {
  it('turns a promise that never settles into a TimeoutError', async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise<never>(() => {}), 1000, 'zgjati shumë');
    vi.advanceTimersByTime(1001);
    await expect(pending).rejects.toBeInstanceOf(TimeoutError);
  });

  it('passes a settled value through', async () => {
    await expect(withTimeout(Promise.resolve(7), 1000, 'x')).resolves.toBe(7);
  });
});

describe('fetchWithTimeout', () => {
  it('aborts a request that hangs and reports a timeout', async () => {
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    await expect(fetchWithTimeout('/api/v1/reports', {}, 20)).rejects.toBeInstanceOf(TimeoutError);
  });

  it('keeps an AbortError when the caller cancels', async () => {
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    const controller = new AbortController();
    const call = fetchWithTimeout('/x', { signal: controller.signal }, 5000);
    controller.abort();
    await expect(call).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('isJsonResponse', () => {
  it('rejects the index.html a static host returns for /api paths', () => {
    expect(isJsonResponse(new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }))).toBe(false);
    expect(isJsonResponse(new Response('{}', { headers: { 'content-type': 'application/json; charset=utf-8' } }))).toBe(true);
  });
});

describe('createTrackingId (browser fallback)', () => {
  it('keeps the lower-case letters of a Firestore id instead of dropping them', () => {
    const id = createTrackingId('ZQ', 'aB3dEfGhIjKlMnOpQrSt');
    expect(id).toMatch(/^ZQ-\d{8}-AB3DEFGHIJKL$/);
    expect(TRACKING_ID_PATTERN.test(id)).toBe(true);
  });
});

describe('sector references', () => {
  it('accepts every code the sectors issue, including two-part health cases', () => {
    for (const ref of ['LJ-ABCD2345', 'DN-XYZ23456', 'HC-ABCD1234', 'HC-MGT3XYZ1-AB12']) {
      expect(SUBMISSION_REFERENCE_PATTERN.test(ref)).toBe(true);
    }
    for (const ref of ['ZQ-20260101-ABC', 'HC-', 'HC-AB', 'XX-ABCD1234']) {
      expect(SUBMISSION_REFERENCE_PATTERN.test(ref)).toBe(false);
    }
  });
});

describe('shared public view', () => {
  it('is the same function the server route uses', () => {
    expect(lookup.buildPublicTrackView).toBe(buildPublicTrackView);
  });

  it('builds the allow-listed view without private fields', () => {
    const view = buildPublicTrackView({
      trackingId: 'ZQ-20260101-ABCD1234', status: 'Pending Review', title: 'T', description: 'D', category: 'C',
      authorId: 'secret-uid', authorName: 'Emri', location: { lat: 42.1, lng: 21.1, address: 'Rr. 1 nr. 5', municipality: 'Prishtinë' },
      media: [{ type: 'video', url: 'https://x/v.mp4' }], createdAt: '2026-01-01T10:00:00Z',
    });
    expect(view?.trackingId).toBe('ZQ-20260101-ABCD1234');
    expect(view?.evidence).toMatchObject({ published: false, totalCount: 1, items: [] });
    expect(JSON.stringify(view)).not.toMatch(/secret-uid|Emri|Rr\. 1/);
  });
});

describe('mintReference (browser path for LJ-/DN-)', () => {
  it('has the shape the server lookup and the rules accept', async () => {
    const { mintReference } = await import('../../src/lib/directSubmissions');
    for (let i = 0; i < 50; i++) {
      expect(mintReference('LJ')).toMatch(/^LJ-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/);
      expect(SUBMISSION_REFERENCE_PATTERN.test(mintReference('DN'))).toBe(true);
    }
  });
});

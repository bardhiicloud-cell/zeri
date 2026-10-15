import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUBLIC_FEED_REFRESH_MS, PUBLIC_FEED_RETRY_MS, startPublicReports } from '../../src/lib/publicReportsApi';

const report = (id: string) => ({ id, title: `Rast ${id}`, createdAt: '2026-10-01T10:00:00.000Z' });

function handlers() {
  return {
    uid: null as string | null,
    onReports: vi.fn(),
    onCursor: vi.fn(),
    onReady: vi.fn(),
    onError: vi.fn(),
  };
}

const respond = (status: number, body: unknown = {}) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('public reports status (PUB-UI-017 / PUB-UI-018: failed is not empty)', () => {
  it('reports an error, not "ready with zero reports", when the first load fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(500)));
    const h = handlers();
    const stop = startPublicReports(h);
    await vi.advanceTimersByTimeAsync(0);

    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onReady).not.toHaveBeenCalled();
    expect(h.onReports).not.toHaveBeenCalled();
    stop();
  });

  it('retries sooner than the normal refresh and recovers to "ready" with the data', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => respond(500))
      .mockImplementation(() => respond(200, { items: [report('a'), report('b')], nextCursor: null }));
    vi.stubGlobal('fetch', fetchMock);
    const h = handlers();
    const stop = startPublicReports(h);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.onReady).not.toHaveBeenCalled();

    expect(PUBLIC_FEED_RETRY_MS).toBeLessThan(PUBLIC_FEED_REFRESH_MS);
    await vi.advanceTimersByTimeAsync(PUBLIC_FEED_RETRY_MS);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(h.onReady).toHaveBeenCalledTimes(1);
    expect(h.onReports).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })]);
    stop();
  });

  it('keeps the reports it already has when a later refresh fails, and reports the failure', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => respond(200, { items: [report('a')], nextCursor: null }))
      .mockImplementation(() => respond(503));
    vi.stubGlobal('fetch', fetchMock);
    const h = handlers();
    const stop = startPublicReports(h);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.onReady).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(PUBLIC_FEED_REFRESH_MS);
    expect(h.onError).toHaveBeenCalledTimes(1);
    // No second onReports call with an empty list: the loaded data is kept.
    expect(h.onReports).toHaveBeenCalledTimes(1);
    stop();
  });

  it('a genuinely empty feed is still "ready" with zero reports', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(200, { items: [], nextCursor: null })));
    const h = handlers();
    const stop = startPublicReports(h);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.onReady).toHaveBeenCalledTimes(1);
    expect(h.onError).not.toHaveBeenCalled();
    expect(h.onReports).toHaveBeenCalledWith([]);
    stop();
  });
});

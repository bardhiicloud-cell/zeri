import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiReady, markApiUnavailable, resetApiAvailability } from '../../src/lib/apiAvailability';
import { validateDonationApplication, validateTip } from '../../server/submissionValidation';
import * as newsTips from '../../server/newsTips';
import * as publicSubmissions from '../../server/publicSubmissions';

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

beforeEach(() => resetApiAvailability());
afterEach(() => vi.unstubAllGlobals());

describe('apiReady', () => {
  it('is false on a static host that answers /api/health with index.html', async () => {
    vi.stubGlobal('fetch', async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }));
    expect(await apiReady()).toBe(false);
  });

  it('is false for a server without its data source, true for one with it', async () => {
    vi.stubGlobal('fetch', async () => json({ status: 'ok', dataSource: 'unavailable' }));
    expect(await apiReady()).toBe(false);
    resetApiAvailability();
    vi.stubGlobal('fetch', async () => json({ status: 'ok', dataSource: 'firestore' }));
    expect(await apiReady()).toBe(true);
  });

  it('asks once per visit and shares one probe between callers', async () => {
    const fetchMock = vi.fn(async () => json({ status: 'ok', dataSource: 'firestore' }));
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([apiReady(), apiReady(), apiReady()]);
    await apiReady();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops using a server that failed mid-visit', async () => {
    vi.stubGlobal('fetch', async () => json({ status: 'ok', dataSource: 'firestore' }));
    expect(await apiReady()).toBe(true);
    markApiUnavailable();
    expect(await apiReady()).toBe(false);
  });

  it('is false when the probe errors', async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
    expect(await apiReady()).toBe(false);
  });
});

describe('shared submission validation', () => {
  it('is the very function the server routes use', () => {
    expect(newsTips.validateTip).toBe(validateTip);
    expect(publicSubmissions.validateDonationApplication).toBe(validateDonationApplication);
  });

  it('accepts a valid tip and a valid donation application', () => {
    expect(validateTip({ title: 'Titull i gjatë mjaft', body: 'x'.repeat(45), category: 'korrupsion', anonymous: true, media: [] }).ok).toBe(true);
    expect(validateDonationApplication({ title: 'Ndihmë', description: 'y'.repeat(25), category: 'shtepi', mediaUrl: 'data:image/png;base64,AAAA' }).ok).toBe(true);
  });
});

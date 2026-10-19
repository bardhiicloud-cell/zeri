import { afterEach, describe, expect, it, vi } from 'vitest';

describe('apiBase', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it('leaves /api same-origin when no base is configured', async () => {
    vi.stubEnv('VITE_API_BASE', '');
    const { apiUrl, isApiPath } = await import('../../src/lib/apiBase');
    expect(apiUrl('/api/v1/x')).toBe('/api/v1/x');
    expect(isApiPath('/api/health')).toBe(true);
    expect(isApiPath('/apiary')).toBe(false);
  });

  it('sends /api to the configured server, and nothing else', async () => {
    vi.stubEnv('VITE_API_BASE', 'https://zeri-api.onrender.com/');
    const { apiUrl } = await import('../../src/lib/apiBase');
    expect(apiUrl('/api/v1/reports?x=1')).toBe('https://zeri-api.onrender.com/api/v1/reports?x=1');
    expect(apiUrl('/raporto')).toBe('/raporto');
  });
});

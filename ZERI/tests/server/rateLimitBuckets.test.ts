import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { apiRateLimiter, hasBearerToken } from '../../server/security';

const TOKEN = 'a'.repeat(40);

const request = (authorization: string | undefined, ip: string): Request =>
  ({ headers: { ...(authorization ? { authorization } : {}), 'x-forwarded-for': ip }, ip, socket: { remoteAddress: ip }, connection: { remoteAddress: ip } }) as unknown as Request;

function hit(req: Request): number {
  let status = 200;
  const res = {
    setHeader: () => res,
    status(code: number) { status = code; return res; },
    json: () => res,
  } as unknown as Response;
  apiRateLimiter(req, res, () => { status = 200; });
  return status;
}

describe('hasBearerToken', () => {
  it('recognises a bearer token, and nothing else', () => {
    expect(hasBearerToken(request(`Bearer ${TOKEN}`, '1.1.1.1'))).toBe(true);
    expect(hasBearerToken(request(undefined, '1.1.1.1'))).toBe(false);
    expect(hasBearerToken(request('Bearer x', '1.1.1.1'))).toBe(false);
    expect(hasBearerToken(request('Basic abcdefghijklmnopqrstuvwxyz', '1.1.1.1'))).toBe(false);
  });
});

describe('apiRateLimiter - one office behind one IP', () => {
  it('lets many signed-in staff work from one IP where anonymous traffic would be limited', () => {
    const ip = '10.0.0.1';
    // 300 requests in a minute from one shared address: far above the anonymous 120.
    const results = Array.from({ length: 300 }, () => hit(request(`Bearer ${TOKEN}`, ip)));
    expect(results.every(status => status === 200)).toBe(true);
  });

  it('keeps the strict limit for anonymous traffic', () => {
    const ip = '10.0.0.2';
    const results = Array.from({ length: 130 }, () => hit(request(undefined, ip)));
    expect(results.slice(0, 120).every(status => status === 200)).toBe(true);
    expect(results.slice(120).some(status => status === 429)).toBe(true);
  });

  it('does not let signed-in traffic use up the anonymous bucket, or the reverse', () => {
    const ip = '10.0.0.3';
    for (let i = 0; i < 125; i += 1) hit(request(undefined, ip));
    expect(hit(request(undefined, ip))).toBe(429);
    expect(hit(request(`Bearer ${TOKEN}`, ip))).toBe(200);
  });

  it('still stops a flood even with a bearer header', () => {
    const ip = '10.0.0.4';
    const results = Array.from({ length: 2800 }, () => hit(request(`Bearer ${TOKEN}`, ip)));
    expect(results.some(status => status === 429)).toBe(true);
  });
});

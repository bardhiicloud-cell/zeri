import { describe, expect, it, vi } from 'vitest';
import { debateGate, debatePublicEnabled, isClosedDebatePath } from '../../server/debateGate';

const run = (enabled: boolean, method: string, path: string) => {
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  debateGate(() => enabled)({ method, path } as any, res, next);
  return { res, next };
};

describe('the public Debate switch', () => {
  it('is off unless the environment says true', () => {
    expect(debatePublicEnabled({} as any)).toBe(false);
    expect(debatePublicEnabled({ DEBATE_PUBLIC_ENABLED: 'false' } as any)).toBe(false);
    expect(debatePublicEnabled({ DEBATE_PUBLIC_ENABLED: 'true' } as any)).toBe(true);
  });

  it('closes the citizen endpoints with a 404 while hidden', () => {
    for (const path of ['/api/v1/forum/posts/abc/comments', '/api/v1/forum/dm/send', '/api/v1/forum/people', '/api/v1/forum/reels/x', '/api/v1/forum/stories/1/view', '/api/v1/forum/verification/request', '/api/v1/forum/follow/u1']) {
      const { res, next } = run(false, 'POST', path);
      expect(next, path).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    }
  });

  it('leaves staff tooling and unrelated routes open', () => {
    for (const [method, path] of [['GET', '/api/v1/forum/reports'], ['GET', '/api/v1/forum/verification-requests'], ['DELETE', '/api/v1/forum/posts/p1'], ['POST', '/api/v1/forum/posts/p1/restore'], ['GET', '/api/v1/debate/payments'], ['GET', '/api/v1/moderation/cases'], ['GET', '/api/v1/public/reports']]) {
      expect(isClosedDebatePath(method, path), `${method} ${path}`).toBe(false);
    }
  });

  it('opens everything again when enabled', () => {
    const { next } = run(true, 'POST', '/api/v1/forum/dm/send');
    expect(next).toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';
import { sponsoredLift, summarizeInsights, type InsightPost } from '../../src/lib/forumInsights';

const post = (extra: Partial<InsightPost> = {}): InsightPost => ({
  authorId: 'me', viewCount: 0, likes: [], comments: [], reposts: [], ...extra,
});

describe('summarizeInsights', () => {
  it('splits sponsored from organic and ignores other authors', () => {
    const result = summarizeInsights([
      post({ viewCount: 100, likes: ['a', 'b'], comments: ['c'], reposts: [] }),
      post({ isAd: true, viewCount: 200, likes: ['a'], comments: [], reposts: ['x', 'y'] }),
      post({ authorId: 'someone-else', viewCount: 9999, likes: ['q'] }),
    ], 'me');
    expect(result.organic).toMatchObject({ posts: 1, views: 100, likes: 2, replies: 1, reposts: 0, interactions: 3 });
    expect(result.sponsored).toMatchObject({ posts: 1, views: 200, likes: 1, reposts: 2, interactions: 3 });
    expect(result.total).toMatchObject({ posts: 2, views: 300, interactions: 6 });
  });

  it('computes engagement rate and per-post averages', () => {
    const { organic } = summarizeInsights([post({ viewCount: 200, likes: ['a', 'b', 'c', 'd'] })], 'me');
    expect(organic.engagementRate).toBe(2);
    expect(organic.perPost).toBe(4);
  });

  it('reports null, not zero or NaN, when there is nothing to divide by', () => {
    const { organic, sponsored } = summarizeInsights([post({ viewCount: 0, likes: ['a'] })], 'me');
    expect(organic.engagementRate).toBeNull();
    expect(sponsored.perPost).toBeNull();
    expect(sponsored.posts).toBe(0);
  });

  it('caps the rate at 100% and survives malformed counters', () => {
    const { organic } = summarizeInsights([
      post({ viewCount: 1, likes: ['a', 'b', 'c'] }),
      { authorId: 'me', viewCount: -5, likes: 'nope' as any, comments: null as any },
      { authorId: 'me', viewCount: Number.NaN },
    ], 'me');
    expect(organic.engagementRate).toBe(100);
    expect(organic.views).toBe(1);
    expect(organic.posts).toBe(3);
  });

  it('handles an empty feed', () => {
    expect(summarizeInsights([], 'me').total).toMatchObject({ posts: 0, views: 0, engagementRate: null });
  });
});

describe('sponsored link clicks', () => {
  it('counts clicks and CTR for sponsored posts only', () => {
    const r = summarizeInsights([
      post({ isAd: true, viewCount: 200, adClicks: 10 }),
      post({ isAd: true, viewCount: 100, adClicks: 5 }),
      post({ viewCount: 500, adClicks: 999 }), // an organic post never has clicks, whatever the field says
    ], 'me');
    expect(r.sponsored).toMatchObject({ clicks: 15, views: 300, ctr: 5 });
    expect(r.organic).toMatchObject({ clicks: 0 });
    expect(r.total.clicks).toBe(15);
    expect(r.total.ctr).toBeNull();
  });

  it('has no CTR without views and ignores malformed counters', () => {
    const r = summarizeInsights([post({ isAd: true, viewCount: 0, adClicks: 3 }), post({ isAd: true, adClicks: -4 }), post({ isAd: true, adClicks: Number.NaN })], 'me');
    expect(r.sponsored.ctr).toBeNull();
    expect(r.sponsored.clicks).toBe(3);
  });
});

describe('sponsoredLift', () => {
  it('compares rates only when both have views', () => {
    const insights = summarizeInsights([
      post({ viewCount: 100, likes: ['a', 'b'] }),
      post({ isAd: true, viewCount: 100, likes: ['a', 'b', 'c', 'd'] }),
    ], 'me');
    expect(sponsoredLift(insights)).toBe(100);
  });

  it('is null without both sides', () => {
    expect(sponsoredLift(summarizeInsights([post({ viewCount: 100, likes: ['a'] })], 'me'))).toBeNull();
    expect(sponsoredLift(summarizeInsights([], 'me'))).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { adStatus, adVisibleInFeed, isAdLive, toMillis } from '../../src/lib/adCampaign';

const NOW = Date.UTC(2026, 9, 13, 12);
const DAY = 86_400_000;

describe('adStatus', () => {
  it('is not_ad for ordinary posts', () => {
    expect(adStatus({}, NOW)).toBe('not_ad');
    expect(adStatus({ isAd: false, promotedUntil: NOW - 1 }, NOW)).toBe('not_ad');
  });

  it('runs until removed when there is no end date', () => {
    expect(adStatus({ isAd: true }, NOW)).toBe('live');
  });

  it('is scheduled before the start, live inside the window and ended after it', () => {
    expect(adStatus({ isAd: true, adStartAt: NOW + DAY }, NOW)).toBe('scheduled');
    expect(adStatus({ isAd: true, adStartAt: NOW - DAY, promotedUntil: NOW + DAY }, NOW)).toBe('live');
    expect(adStatus({ isAd: true, promotedUntil: NOW }, NOW)).toBe('ended');
    expect(adStatus({ isAd: true, promotedUntil: NOW - 1 }, NOW)).toBe('ended');
  });

  it('stops at the click cap', () => {
    expect(adStatus({ isAd: true, adMaxClicks: 100, adClicks: 99 }, NOW)).toBe('live');
    expect(adStatus({ isAd: true, adMaxClicks: 100, adClicks: 100 }, NOW)).toBe('capped');
    expect(adStatus({ isAd: true, adMaxClicks: 0, adClicks: 5 }, NOW)).toBe('live'); // 0 / unset means no cap
  });

  it('reads Firestore timestamps, dates and ISO strings', () => {
    expect(toMillis({ toMillis: () => 5 })).toBe(5);
    expect(toMillis({ seconds: 2 })).toBe(2000);
    expect(toMillis(new Date(7))).toBe(7);
    expect(toMillis('2026-10-13T00:00:00Z')).toBe(Date.UTC(2026, 9, 13));
    expect(toMillis('nonsense')).toBeNull();
    expect(isAdLive({ isAd: true, promotedUntil: { toMillis: () => NOW + 1 } }, NOW)).toBe(true);
  });
});

describe('adVisibleInFeed', () => {
  const ended = { isAd: true, promotedUntil: NOW - 1, authorId: 'owner' };
  it('hides ended campaigns from the public but not from the owner or staff', () => {
    expect(adVisibleInFeed(ended, { id: 'x' }, NOW)).toBe(false);
    expect(adVisibleInFeed(ended, {}, NOW)).toBe(false);
    expect(adVisibleInFeed(ended, { id: 'owner' }, NOW)).toBe(true);
    expect(adVisibleInFeed(ended, { id: 'y', isStaff: true }, NOW)).toBe(true);
  });
  it('always shows organic and live ones', () => {
    expect(adVisibleInFeed({ authorId: 'a' }, {}, NOW)).toBe(true);
    expect(adVisibleInFeed({ isAd: true }, {}, NOW)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { dayKey, emptyDay, lastDays, toDaily } from '../../server/forumAnalytics';
import {
  audienceAllows, canViewProfile, canViewReels, normalizeForumPrefs, normalizeWebsite, wantsNotification,
} from '../../src/lib/forumPrefs';

describe('insight day helpers', () => {
  it('keys days in UTC', () => {
    expect(dayKey(new Date('2026-03-05T23:59:59Z'))).toBe('20260305');
  });

  it('returns consecutive days, oldest first, ending today', () => {
    const days = lastDays(3, new Date('2026-03-01T10:00:00Z'));
    expect(days).toEqual(['20260227', '20260228', '20260301']);
  });

  it('turns a missing or malformed document into zeros', () => {
    expect(toDaily('20260301', undefined)).toEqual(emptyDay('20260301'));
    const row = toDaily('20260301', { profileViews: 'x', contactClicks: -4, reelViews: 3.7, reels: { a: 2, b: 'no' } });
    expect(row.profileViews).toBe(0);
    expect(row.contactClicks).toBe(0);
    expect(row.reelViews).toBe(3);
    expect(row.reels).toEqual({ a: 2 });
  });
});

describe('forum preferences', () => {
  it('falls back to safe defaults for junk input', () => {
    const prefs = normalizeForumPrefs({ profileVisibility: 'everyone-lol', whoCanComment: 7, accountType: 'admin' });
    expect(prefs.profileVisibility).toBe('public');
    expect(prefs.whoCanComment).toBe('everyone');
    expect(prefs.accountType).toBe('personal');
    expect(prefs.reelsVisibility).toBe('public');
  });

  it('only keeps http(s) websites', () => {
    expect(normalizeWebsite('javascript:alert(1)')).toBe('');
    expect(normalizeWebsite('data:text/html,hi')).toBe('');
    expect(normalizeWebsite('biznesi.com')).toBe('https://biznesi.com/');
    expect(normalizeWebsite('http://a.com/x')).toBe('http://a.com/x');
  });

  it('cleans business contact details', () => {
    const prefs = normalizeForumPrefs({
      accountType: 'business',
      business: { category: 'Nuk ekziston', email: 'not-an-email', phone: '+383 44 <b>1</b>', website: 'javascript:1', address: 'Rruga A' },
    });
    expect(prefs.accountType).toBe('business');
    expect(prefs.business.category).toBe('Tjetër');
    expect(prefs.business.email).toBe('');
    expect(prefs.business.phone).not.toMatch(/[<>b]/);
    expect(prefs.business.website).toBe('');
    expect(prefs.business.address).toBe('Rruga A');
  });

  it('applies audience rules', () => {
    expect(audienceAllows('everyone', false)).toBe(true);
    expect(audienceAllows('followers', false)).toBe(false);
    expect(audienceAllows('followers', true)).toBe(true);
    expect(audienceAllows('nobody', true)).toBe(false);
  });

  it('gates profile and reels, always letting the owner and staff through', () => {
    const priv = normalizeForumPrefs({ profileVisibility: 'private', reelsVisibility: 'followers' });
    expect(canViewProfile(priv, { isOwner: false, viewerFollowsOwner: true })).toBe(false);
    expect(canViewProfile(priv, { isOwner: true, viewerFollowsOwner: false })).toBe(true);
    expect(canViewProfile(priv, { isOwner: false, viewerFollowsOwner: false, viewerIsStaff: true })).toBe(true);
    expect(canViewReels(priv, { isOwner: false, viewerFollowsOwner: true })).toBe(true);
    expect(canViewReels(priv, { isOwner: false, viewerFollowsOwner: false })).toBe(false);
  });

  it('maps notification categories to the right switch', () => {
    const off = normalizeForumPrefs({ notify: { likes: false, replies: false } });
    expect(wantsNotification({ forumPrefs: off }, 'forum_like')).toBe(false);
    expect(wantsNotification({ forumPrefs: off }, 'forum_reply', 'reply')).toBe(false);
    expect(wantsNotification({ forumPrefs: off }, 'forum_reply', 'comment')).toBe(true);
    expect(wantsNotification({ forumPrefs: off }, 'forum_mention')).toBe(true);
    expect(wantsNotification(undefined, 'forum_like')).toBe(true);
  });
});

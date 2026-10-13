import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/firebase', () => ({ auth: {}, db: {}, storage: {} }));

const {
  REEL_CAPTION_MAX,
  REEL_MAX_BYTES,
  extractHashtags,
  normalizeCaption,
  toReel,
  toggleLike,
  validateReelDuration,
  validateReelFile,
} = await import('../../src/lib/reels');

describe('validateReelFile', () => {
  it('accepts MP4 and WebM within the storage limit', () => {
    expect(validateReelFile({ type: 'video/mp4', size: 5_000_000 })).toBeNull();
    expect(validateReelFile({ type: 'video/webm', size: REEL_MAX_BYTES })).toBeNull();
  });

  it('rejects formats storage.rules would refuse', () => {
    expect(validateReelFile({ type: 'video/quicktime', size: 10 })).toMatch(/nuk lejohet/);
    expect(validateReelFile({ type: 'image/png', size: 10 })).toMatch(/nuk lejohet/);
    expect(validateReelFile({ type: '', size: 10 })).toMatch(/i panjohur/);
  });

  it('rejects empty, missing and oversized files', () => {
    expect(validateReelFile(null)).toBeTruthy();
    expect(validateReelFile({ type: 'video/mp4', size: 0 })).toMatch(/bosh/);
    expect(validateReelFile({ type: 'video/mp4', size: REEL_MAX_BYTES + 1 })).toMatch(/30 MB/);
  });
});

describe('validateReelDuration', () => {
  it('accepts 1–90 seconds', () => {
    expect(validateReelDuration(1)).toBeNull();
    expect(validateReelDuration(90)).toBeNull();
    expect(validateReelDuration(90.4)).toBeNull();
  });

  it('rejects unreadable, too short and too long videos', () => {
    expect(validateReelDuration(Number.NaN)).toMatch(/nuk mund të lexohet/);
    expect(validateReelDuration(Infinity)).toBeTruthy();
    expect(validateReelDuration(0.5)).toMatch(/shkurtër/);
    expect(validateReelDuration(91)).toMatch(/90 sekonda/);
  });
});

describe('normalizeCaption', () => {
  it('trims and collapses blank lines', () => {
    expect(normalizeCaption('  a\r\n\r\n\r\n\r\nb  ')).toEqual({ caption: 'a\n\nb', error: null });
  });

  it('enforces the length limit after trimming', () => {
    expect(normalizeCaption(` ${'x'.repeat(REEL_CAPTION_MAX)} `).error).toBeNull();
    expect(normalizeCaption('x'.repeat(REEL_CAPTION_MAX + 1)).error).toMatch(/kufiri/);
  });
});

describe('extractHashtags', () => {
  it('finds unique lower-cased tags including Albanian letters', () => {
    expect(extractHashtags('#Prishtina rruga #ujë #prishtina #Ndriçimi')).toEqual(['prishtina', 'ujë', 'ndriçimi']);
  });

  it('ignores anchors inside words, single letters and URLs fragments', () => {
    expect(extractHashtags('email#tag #a https://x.test/#frag')).toEqual([]);
  });

  it('caps the number of tags', () => {
    const text = Array.from({ length: 15 }, (_, i) => `#tag${i}`).join(' ');
    expect(extractHashtags(text)).toHaveLength(10);
  });
});

describe('toReel', () => {
  const base = {
    authorId: 'u1', authorName: 'Arta', mediaType: 'video',
    mediaUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/forum_reels%2Fu1%2Fa.mp4',
    caption: 'Hi', hashtags: ['a'], likedBy: ['u2'], isHidden: false,
    createdAt: { toMillis: () => 1_700_000_000_000 },
  };

  it('maps a valid document', () => {
    expect(toReel('r1', base)).toMatchObject({ id: 'r1', authorName: 'Arta', likedBy: ['u2'], createdAtMs: 1_700_000_000_000 });
  });

  it('drops hidden, non-video and unsafe-URL documents', () => {
    expect(toReel('r', { ...base, isHidden: true })).toBeNull();
    expect(toReel('r', { ...base, mediaType: 'image' })).toBeNull();
    expect(toReel('r', { ...base, mediaUrl: 'javascript:alert(1)' })).toBeNull();
    expect(toReel('r', { ...base, mediaUrl: 'http://evil.test/a.mp4' })).toBeNull();
    expect(toReel('r', { ...base, authorId: '' })).toBeNull();
    expect(toReel('r', undefined)).toBeNull();
  });

  it('allows http only for the local emulator and drops unsafe avatars', () => {
    expect(toReel('r', { ...base, mediaUrl: 'http://127.0.0.1:9199/x.mp4' })).not.toBeNull();
    expect(toReel('r', { ...base, authorAvatar: 'javascript:1' })?.authorAvatar).toBeNull();
  });

  it('fills safe defaults for malformed fields', () => {
    const reel = toReel('r', { ...base, authorName: ' ', likedBy: 'x', hashtags: [1, 'b'], createdAt: null });
    expect(reel).toMatchObject({ authorName: 'Qytetar', likedBy: [], hashtags: ['b'], createdAtMs: null });
  });
});

describe('toggleLike', () => {
  it('adds and removes only the given user', () => {
    expect(toggleLike(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleLike(['a', 'b'], 'a')).toEqual(['b']);
  });
});

import { describe, expect, it } from 'vitest';
import { computeTrends, extractHashtags, extractMentions, toHandle } from '../../src/lib/forumTrends';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe('hashtags and mentions', () => {
  it('extracts unique lower-case hashtags, including Albanian letters', () => {
    expect(extractHashtags('Rruga #Prishtinë dhe #rruga #Prishtinë!')).toEqual(['prishtinë', 'rruga']);
  });

  it('ignores hashtags glued to words and numbers-only noise', () => {
    expect(extractHashtags('abc#nope #x')).toEqual([]);
  });

  it('extracts mentions', () => {
    expect(extractMentions('Ju lutem @Bardh dhe @komuna.prishtine')).toEqual(['bardh', 'komuna.prishtine']);
  });

  it('turns a display name into a comparable handle', () => {
    expect(toHandle('Bardh Qytetar')).toBe('bardhqytetar');
    expect(toHandle('Ëndrra K.')).toBe('endrrak');
  });
});

describe('trends', () => {
  const post = (id: string, content: string, over = {}) => ({
    id, authorId: id, content, likes: [], comments: [], reposts: [], createdAt: ago(2), ...over,
  });

  it('is empty without posts: no placeholder topics', () => {
    expect(computeTrends([], { now: NOW })).toEqual([]);
  });

  it('counts real posts per hashtag and ranks by engagement', () => {
    const trends = computeTrends(
      [
        post('1', 'Uji #uji'),
        post('2', 'Rruga #rruga', { likes: ['a', 'b', 'c'] }),
        post('3', 'Edhe rruga #rruga'),
      ],
      { now: NOW }
    );
    expect(trends[0]).toMatchObject({ label: '#rruga', posts: 2, interactions: 3 });
    expect(trends.map((t) => t.label)).toContain('#uji');
  });

  it('ignores posts older than the window', () => {
    expect(computeTrends([post('1', '#vjeter', { createdAt: ago(24 * 30) })], { now: NOW })).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { mergeTagPosts, normalizeTag, postHasTag, type TagPost } from '../../src/lib/hashtagPage';

const p = (id: string, extra: Partial<TagPost> = {}): TagPost => ({ id, content: '', visibility: 'public', createdAtMs: 1, ...extra });

describe('hashtag pages', () => {
  it('normalises tags typed or clicked in any form', () => {
    expect(normalizeTag('#Zgjedhjet')).toBe('zgjedhjet');
    expect(normalizeTag(' ##Rruga! ')).toBe('rruga');
  });

  it('matches by field or, for older posts, by text', () => {
    expect(postHasTag({ hashtags: ['rruga'] }, 'rruga')).toBe(true);
    expect(postHasTag({ content: 'Rruga e prishur #Rruga sot' }, 'rruga')).toBe(true);
    expect(postHasTag({ content: 'link http://x.org/#rruga' }, 'rruga')).toBe(false);
  });

  it('merges query and local posts without duplicates, hidden, deleted or non-public ones, newest first', () => {
    const queried = [p('a', { hashtags: ['tg'], createdAtMs: 5 }), p('b', { hashtags: ['tg'], createdAtMs: 9, isHidden: true })];
    const local = [p('a', { hashtags: ['tg'], createdAtMs: 5 }), p('c', { content: 'x #tg', createdAtMs: 7 }),
      p('d', { hashtags: ['tg'], visibility: 'followers' }), p('e', { hashtags: ['tg'], deletedAt: 1 }), p('f', { hashtags: ['other'] })];
    expect(mergeTagPosts('tg', queried, local).map((x) => x.id)).toEqual(['c', 'a']);
  });
});

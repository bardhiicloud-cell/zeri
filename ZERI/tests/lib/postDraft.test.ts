import { describe, expect, it } from 'vitest';
import { DRAFT_MAX_AGE_MS, clearDraft, loadDraft, saveDraft } from '../../src/lib/postDraft';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), data };
};

describe('post draft', () => {
  it('round-trips for the same account only', () => {
    const s = memory();
    saveDraft({ uid: 'a', content: 'Rruga e prishur', category: 'infra', followersOnly: true }, 1000, s);
    expect(loadDraft('a', 2000, s)).toMatchObject({ content: 'Rruga e prishur', category: 'infra', followersOnly: true });
    expect(loadDraft('b', 2000, s)).toBeNull();
  });

  it('removes the draft when the text is emptied and after clearing', () => {
    const s = memory();
    saveDraft({ uid: 'a', content: 'x', category: 'all', followersOnly: false }, 1, s);
    saveDraft({ uid: 'a', content: '   ', category: 'all', followersOnly: false }, 2, s);
    expect(s.data.size).toBe(0);
    saveDraft({ uid: 'a', content: 'y', category: 'all', followersOnly: false }, 3, s);
    clearDraft(s);
    expect(loadDraft('a', 4, s)).toBeNull();
  });

  it('forgets old drafts and survives corrupt or unavailable storage', () => {
    const s = memory();
    saveDraft({ uid: 'a', content: 'x', category: 'all', followersOnly: false }, 0, s);
    expect(loadDraft('a', DRAFT_MAX_AGE_MS + 1, s)).toBeNull();
    s.data.set('zeri_post_draft_v1', '{not json');
    expect(loadDraft('a', 1, s)).toBeNull();
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(loadDraft('a', 1, broken)).toBeNull();
    expect(() => saveDraft({ uid: 'a', content: 'x', category: 'all', followersOnly: false }, 1, broken)).not.toThrow();
    expect(() => clearDraft(broken)).not.toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import {
  PostError, applyPollVote, applyReaction, cleanText, daysBetween, findComment, isStaffClaims, removeComment,
  type Comment, type Poll,
} from '../../server/forumPosts';

const poll = (): Poll => ({
  question: 'q', totalVotes: 1,
  options: [{ id: 'a', text: 'A', votes: ['u1'] }, { id: 'b', text: 'B', votes: [] }],
});

describe('cleanText', () => {
  it('trims, normalises line breaks and rejects empty or oversized text', () => {
    expect(cleanText('  a\r\n\r\n\r\n\r\nb ', 50)).toEqual({ text: 'a\n\nb', error: null });
    expect(cleanText('   ', 50).error).toMatch(/tekst/);
    expect(cleanText('x'.repeat(51), 50).error).toMatch(/kalon 50/);
    expect(cleanText(undefined, 50).error).toBeTruthy();
  });
});

describe('applyPollVote', () => {
  it('moves one vote between options and keeps the total honest', () => {
    const r = applyPollVote(poll(), 'u1', 'b');
    expect(r.votedOptionId).toBe('b');
    expect(r.poll.options.map((o) => o.votes)).toEqual([[], ['u1']]);
    expect(r.poll.totalVotes).toBe(1);
  });

  it('withdraws the vote when the same option is chosen again', () => {
    const r = applyPollVote(poll(), 'u1', 'a');
    expect(r.votedOptionId).toBeNull();
    expect(r.poll.totalVotes).toBe(0);
  });

  it('counts a new voter once and never lets one account hold two votes', () => {
    const first = applyPollVote(poll(), 'u2', 'a');
    expect(first.poll.options[0].votes).toEqual(['u1', 'u2']);
    const second = applyPollVote(first.poll, 'u2', 'b');
    expect(second.poll.options.flatMap((o) => o.votes).filter((v) => v === 'u2')).toHaveLength(1);
  });

  it('rejects an option that does not exist', () => {
    expect(() => applyPollVote(poll(), 'u1', 'zzz')).toThrow(PostError);
  });
});

describe('applyReaction', () => {
  it('keeps one reaction per account', () => {
    const a = applyReaction({}, 'u1', 'love');
    expect(a).toEqual({ love: ['u1'] });
    expect(applyReaction(a, 'u1', 'wow')).toEqual({ wow: ['u1'] });
  });

  it('removes on repeat or null and drops empty buckets', () => {
    expect(applyReaction({ love: ['u1'] }, 'u1', 'love')).toEqual({});
    expect(applyReaction({ love: ['u1', 'u2'] }, 'u1', null)).toEqual({ love: ['u2'] });
  });
});

describe('comment helpers', () => {
  const tree = (): Comment[] => [
    { id: 'c1', authorId: 'a', authorName: 'A', content: 'x', createdAt: '', replies: [{ id: 'r1', authorId: 'b', authorName: 'B', content: 'y', createdAt: '' }] },
    { id: 'c2', authorId: 'c', authorName: 'C', content: 'z', createdAt: '', replies: [] },
  ];

  it('finds comments and replies and reports the parent', () => {
    expect(findComment(tree(), 'c2')).toMatchObject({ item: { id: 'c2' }, parentId: null });
    expect(findComment(tree(), 'r1')).toMatchObject({ item: { id: 'r1' }, parentId: 'c1' });
    expect(findComment(tree(), 'nope')).toBeNull();
  });

  it('removes a comment with its replies, or a single reply', () => {
    expect(removeComment(tree(), 'c1').map((c) => c.id)).toEqual(['c2']);
    const afterReply = removeComment(tree(), 'r1');
    expect(afterReply[0].replies).toEqual([]);
    expect(afterReply).toHaveLength(2);
  });
});

describe('misc', () => {
  it('daysBetween measures the restore window', () => {
    expect(daysBetween(0, 30 * 86_400_000)).toBe(30);
  });

  it('isStaffClaims mirrors the rules and ignores non-true values', () => {
    expect(isStaffClaims({ agent: true })).toBe(true);
    expect(isStaffClaims({ admin: 'yes', monitor: true })).toBe(false);
    expect(isStaffClaims(undefined)).toBe(false);
  });
});

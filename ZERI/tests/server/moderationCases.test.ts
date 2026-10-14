import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { decideAppeal, decideCase, priorityFor, reinsertComment, type CaseDoc } from '../../server/moderationCases';
import { describeRestriction, isRestricted } from '../../server/accountRestrictions';

const NOW = Date.UTC(2026, 9, 14, 12);
const debatwp = { uid: 'mod1', role: 'debatwp', permissions: [] };
const otherMod = { uid: 'mod2', role: 'debatwp', permissions: [] };
const admin = { uid: 'boss', role: 'admin', permissions: [] };
const citizen = { uid: 'cit', role: 'citizen', permissions: [] };

const item = (over: Partial<CaseDoc> = {}) => ({
  kind: 'post' as const, status: 'flagged' as const, assigneeUid: null, decidedBy: null, lastEffect: null, subjectUid: 'author1', ...over,
});
const reason = 'Shkel rregullat e komunitetit';

describe('priority', () => {
  it('puts reported violence or illegal content ahead of volume', () => {
    expect(priorityFor({ violence: 3 }, 3)).toBe('urgent');
    expect(priorityFor({ illegal: 1 }, 1)).toBe('high');
    expect(priorityFor({ abuse: 2 }, 2)).toBe('high');
    expect(priorityFor({ other: 5 }, 5)).toBe('high');
    expect(priorityFor({ spam: 1 }, 1)).toBe('low');
    expect(priorityFor({ misinformation: 1 }, 1)).toBe('normal');
  });
});

describe('who may decide', () => {
  it('refuses accounts that do not moderate the debate', () => {
    expect(decideCase({ actor: citizen, item: item(), action: 'hide', reason })).toMatchObject({ outcome: 'deny', code: 'WRONG_ROLE' });
  });

  it('claims a flagged case once; a second moderator is told it is taken', () => {
    expect(decideCase({ actor: debatwp, item: item(), action: 'claim' })).toMatchObject({ outcome: 'allow', to: 'under_review' });
    expect(decideCase({ actor: otherMod, item: item({ status: 'under_review', assigneeUid: 'mod1' }), action: 'claim' })).toMatchObject({ outcome: 'deny', code: 'WRONG_STATE' });
    expect(decideCase({ actor: otherMod, item: item({ status: 'under_review', assigneeUid: 'mod1' }), action: 'hide', reason })).toMatchObject({ outcome: 'deny', code: 'ALREADY_CLAIMED' });
  });

  it('needs a reason for every decision, because the person is told it', () => {
    for (const action of ['dismiss', 'hide', 'remove', 'warn', 'suspend']) {
      expect(decideCase({ actor: debatwp, item: item(), action, reason: 'ok', days: 3 })).toMatchObject({ outcome: 'deny', code: 'REASON_REQUIRED' });
    }
  });

  it('applies the right effect for each kind of content', () => {
    expect(decideCase({ actor: debatwp, item: item(), action: 'hide', reason })).toMatchObject({ outcome: 'allow', effect: 'hide', to: 'violation_confirmed' });
    expect(decideCase({ actor: debatwp, item: item(), action: 'remove', reason })).toMatchObject({ outcome: 'allow', effect: 'remove_post' });
    expect(decideCase({ actor: debatwp, item: item({ kind: 'comment' }), action: 'remove', reason })).toMatchObject({ outcome: 'allow', effect: 'remove_comment' });
    expect(decideCase({ actor: debatwp, item: item({ kind: 'comment' }), action: 'hide', reason })).toMatchObject({ outcome: 'deny', code: 'WRONG_KIND' });
    expect(decideCase({ actor: debatwp, item: item({ kind: 'user' }), action: 'remove', reason })).toMatchObject({ outcome: 'deny', code: 'WRONG_KIND' });
    expect(decideCase({ actor: debatwp, item: item({ kind: 'ad' }), action: 'unpromote', reason })).toMatchObject({ outcome: 'allow', effect: 'unpromote' });
    expect(decideCase({ actor: debatwp, item: item(), action: 'dismiss', reason })).toMatchObject({ outcome: 'allow', effect: null, to: 'no_violation' });
  });

  it('bounds a suspension to 1-90 days and keeps permanent bans for administrators', () => {
    expect(decideCase({ actor: debatwp, item: item(), action: 'suspend', reason, days: 0 })).toMatchObject({ outcome: 'deny', code: 'BAD_DAYS' });
    expect(decideCase({ actor: debatwp, item: item(), action: 'suspend', reason, days: 91 })).toMatchObject({ outcome: 'deny', code: 'BAD_DAYS' });
    expect(decideCase({ actor: debatwp, item: item(), action: 'suspend', reason, days: 7 })).toMatchObject({ outcome: 'allow', effect: 'suspend', days: 7, to: 'restricted' });
    expect(decideCase({ actor: debatwp, item: item(), action: 'ban', reason })).toMatchObject({ outcome: 'deny', code: 'BAN_NOT_ALLOWED' });
    expect(decideCase({ actor: admin, item: item(), action: 'ban', reason })).toMatchObject({ outcome: 'allow', effect: 'ban' });
  });

  it('does not decide a case twice; a decision is undone with "restore" or through an appeal', () => {
    const decided = item({ status: 'violation_confirmed', decidedBy: 'mod1', lastEffect: { type: 'hide' } });
    expect(decideCase({ actor: debatwp, item: decided, action: 'remove', reason })).toMatchObject({ outcome: 'deny', code: 'WRONG_STATE' });
    expect(decideCase({ actor: debatwp, item: decided, action: 'restore', reason })).toMatchObject({ outcome: 'allow', effect: 'undo', to: 'resolved' });
    expect(decideCase({ actor: debatwp, item: item({ status: 'restricted', lastEffect: { type: 'ban' } }), action: 'restore', reason })).toMatchObject({ outcome: 'deny', code: 'BAN_NOT_ALLOWED' });
  });

  it('has an appeal decided by a different moderator than the one who decided', () => {
    const appealed = item({ status: 'appealed', decidedBy: 'mod1', lastEffect: { type: 'suspend' } });
    expect(decideCase({ actor: debatwp, item: appealed, action: 'overturn', reason })).toMatchObject({ outcome: 'deny', code: 'SAME_REVIEWER' });
    expect(decideCase({ actor: debatwp, item: appealed, action: 'claim' })).toMatchObject({ outcome: 'deny', code: 'SAME_REVIEWER' });
    expect(decideCase({ actor: otherMod, item: appealed, action: 'overturn', reason })).toMatchObject({ outcome: 'allow', effect: 'undo', to: 'resolved' });
    expect(decideCase({ actor: otherMod, item: appealed, action: 'uphold', reason })).toMatchObject({ outcome: 'allow', effect: null, to: 'resolved' });
  });
});

describe('appeals', () => {
  const decided = { status: 'restricted' as const, subjectUid: 'author1', appeal: null, decision: { action: 'suspend', reason, byUid: 'mod1', atMs: NOW } };
  const explanation = 'Nuk kam shkruar asgjë fyese, ishte një citim.';

  it('lets only the person concerned appeal, once, within 30 days, with an explanation', () => {
    expect(decideAppeal(decided, 'someone-else', explanation, NOW)).toMatchObject({ outcome: 'deny', status: 404 });
    expect(decideAppeal(decided, 'author1', 'pse?', NOW)).toMatchObject({ outcome: 'deny', status: 400 });
    expect(decideAppeal(decided, 'author1', explanation, NOW + 31 * 86_400_000)).toMatchObject({ outcome: 'deny', status: 409 });
    expect(decideAppeal({ ...decided, appeal: { text: 'x', atMs: NOW } }, 'author1', explanation, NOW)).toMatchObject({ outcome: 'deny', status: 409 });
    expect(decideAppeal({ ...decided, status: 'no_violation' }, 'author1', explanation, NOW)).toMatchObject({ outcome: 'deny', status: 409 });
    expect(decideAppeal(decided, 'author1', explanation, NOW)).toEqual({ outcome: 'allow', text: explanation });
  });
});

describe('putting a removed comment back', () => {
  const comment = (id: string, replies: any[] = []) => ({ id, authorId: 'a', authorName: 'A', content: id, createdAt: '', replies });
  it('returns a reply under its parent and a top-level comment at the end, never twice', () => {
    const thread = [comment('c1', [comment('r1')]), comment('c2')];
    expect(reinsertComment(thread, comment('r2'), 'c1')[0].replies!.map(r => r.id)).toEqual(['r1', 'r2']);
    expect(reinsertComment(thread, comment('c3'), null).map(c => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(reinsertComment(thread, comment('r1'), 'c1')).toBe(thread);
    expect(reinsertComment(thread, comment('r9'), 'gone').map(c => c.id)).toEqual(['c1', 'c2', 'r9']);
  });
});

describe('account restrictions', () => {
  it('a ban has no end; a suspension ends by itself', () => {
    expect(isRestricted({ isBanned: true }, NOW)).toBe(true);
    expect(isRestricted({ isBanned: true, suspendedUntil: Timestamp.fromMillis(NOW + 1000) }, NOW)).toBe(true);
    expect(isRestricted({ isBanned: true, suspendedUntil: Timestamp.fromMillis(NOW - 1000) }, NOW)).toBe(false);
    expect(isRestricted({ isBanned: false }, NOW)).toBe(false);
    expect(isRestricted(undefined, NOW)).toBe(false);
    expect(describeRestriction({ isBanned: true, suspendedUntil: Timestamp.fromMillis(NOW + 5000) }, NOW)).toEqual({ kind: 'suspension', untilMs: NOW + 5000 });
    expect(describeRestriction({ isBanned: true }, NOW)).toEqual({ kind: 'ban', untilMs: null });
  });
});

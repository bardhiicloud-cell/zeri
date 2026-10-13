import { describe, expect, it } from 'vitest';
import { MAX_REASON, decideModeration, type ModerationInput } from '../../server/userModeration';

const base = (over: Partial<ModerationInput> = {}): ModerationInput => ({
  actor: { uid: 'admin1', role: 'admin', permissions: [] },
  targetUid: 'citizen1',
  targetRole: '',
  action: 'ban',
  reason: 'Spam i përsëritur në forum',
  ...over,
});

const denied = (input: ModerationInput) => {
  const d = decideModeration(input);
  return d.outcome === 'deny' ? d : null;
};

describe('who may moderate citizens', () => {
  it('allows owner-level roles', () => {
    for (const role of ['admin', 'superadmin']) {
      expect(decideModeration(base({ actor: { uid: 'a', role, permissions: [] } })).outcome).toBe('allow');
    }
  });

  it('denies roles without the users section', () => {
    for (const role of ['agent', 'responder', 'adsadmin', 'newsadmin', 'municipality', 'citizen', '']) {
      const d = denied(base({ actor: { uid: 'a', role, permissions: [] } }));
      expect(d?.status, role).toBe(403);
    }
  });

  it('lets an explicit users grant open it for another role', () => {
    expect(decideModeration(base({ actor: { uid: 'a', role: 'agent', permissions: ['users'] } })).outcome).toBe('allow');
  });
});

describe('who can be moderated', () => {
  it('accepts a plain citizen, with or without a citizen claim', () => {
    expect(decideModeration(base({ targetRole: '' })).outcome).toBe('allow');
    expect(decideModeration(base({ targetRole: 'citizen' })).outcome).toBe('allow');
  });

  it('refuses staff and municipal accounts, even for a superadmin', () => {
    for (const targetRole of ['agent', 'admin', 'superadmin', 'municipality', 'approver']) {
      const d = denied(base({ actor: { uid: 'a', role: 'superadmin', permissions: [] }, targetRole }));
      expect(d?.status, targetRole).toBe(403);
    }
  });

  it('refuses moderating oneself', () => {
    expect(denied(base({ targetUid: 'admin1' }))?.status).toBe(400);
  });

  it('refuses an empty target', () => {
    expect(denied(base({ targetUid: '' }))?.status).toBe(400);
  });
});

describe('actions and reasons', () => {
  it('accepts exactly the four actions', () => {
    for (const action of ['ban', 'unban', 'verify', 'unverify']) {
      expect(decideModeration(base({ action, reason: 'Arsye e mjaftueshme' })).outcome).toBe('allow');
    }
    for (const action of ['delete', 'promote', '', null, undefined, 5, ['ban']]) {
      expect(denied(base({ action }))?.status).toBe(400);
    }
  });

  it('requires a real reason to ban', () => {
    for (const reason of ['', '   ', 'ok', undefined, null, 12345]) {
      expect(denied(base({ action: 'ban', reason }))?.status).toBe(400);
    }
  });

  it('does not require a reason for the other actions', () => {
    for (const action of ['unban', 'verify', 'unverify']) {
      expect(decideModeration(base({ action, reason: undefined })).outcome).toBe('allow');
    }
  });

  it('caps the reason length', () => {
    expect(denied(base({ reason: 'x'.repeat(MAX_REASON + 1) }))?.status).toBe(400);
    expect(decideModeration(base({ reason: 'x'.repeat(MAX_REASON) })).outcome).toBe('allow');
  });

  it('trims the reason it returns', () => {
    const d = decideModeration(base({ reason: '   Spam i përsëritur   ' }));
    expect(d.outcome === 'allow' && d.reason).toBe('Spam i përsëritur');
  });
});

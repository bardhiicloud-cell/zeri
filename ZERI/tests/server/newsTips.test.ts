import { describe, expect, it } from 'vitest';
import { decideTipAction, tipActionsFrom, validateTip } from '../../server/newsTips';

const GOOD = { title: 'Tender i dyshimtë në komunë', body: 'Tenderi për rrugën u dha pa konkurrim; dokumentet janë publike dhe e dëshmojnë këtë qartë.', category: 'korrupsion' };
const IMG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

describe('validating a news tip', () => {
  it('accepts a complete tip and keeps contact private for anonymous senders', () => {
    const r = validateTip({ ...GOOD, anonymous: true, contactEmail: 'a@b.co', contactName: 'X', media: [IMG] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.contactEmail).toBe('');
      expect(r.value.contactName).toBe('');
      expect(r.value.media).toEqual([{ type: 'image', url: IMG }]);
    }
  });

  it('refuses short text, an unknown category, a bad email and non-media files', () => {
    expect(validateTip({ ...GOOD, body: 'shkurt' })).toMatchObject({ ok: false, errors: { body: expect.any(String) } });
    expect(validateTip({ ...GOOD, category: 'hack' })).toMatchObject({ ok: false, errors: { category: expect.any(String) } });
    expect(validateTip({ ...GOOD, anonymous: false, contactEmail: 'nope' })).toMatchObject({ ok: false, errors: { contactEmail: expect.any(String) } });
    expect(validateTip({ ...GOOD, media: ['data:text/html;base64,PHNjcmlwdD4='] })).toMatchObject({ ok: false, errors: { media: expect.any(String) } });
    expect(validateTip({ ...GOOD, media: [IMG, IMG, IMG, IMG] })).toMatchObject({ ok: false, errors: { media: expect.any(String) } });
  });
});

describe('who may do what with a tip', () => {
  const editor = { role: 'newsadmin', permissions: [] as string[] };
  it('follows Në pritje → U pranua → Në përpunim → U publikua, nothing skipped', () => {
    expect(tipActionsFrom('submitted')).toEqual(['accept', 'reject']);
    expect(tipActionsFrom('accepted')).toEqual(['reject', 'create_draft']);
    expect(tipActionsFrom('in_editing')).toEqual(['reject', 'mark_published']);
    expect(tipActionsFrom('published')).toEqual([]);
    expect(tipActionsFrom('rejected')).toEqual([]);
    expect(decideTipAction({ actor: editor, stage: 'submitted', action: 'create_draft' })).toMatchObject({ outcome: 'deny', code: 'WRONG_STAGE' });
    expect(decideTipAction({ actor: editor, stage: 'submitted', action: 'mark_published' })).toMatchObject({ outcome: 'deny', code: 'WRONG_STAGE' });
    expect(decideTipAction({ actor: editor, stage: 'accepted', action: 'create_draft' })).toMatchObject({ outcome: 'allow', to: 'in_editing' });
  });

  it('rejection needs a written reason', () => {
    expect(decideTipAction({ actor: editor, stage: 'submitted', action: 'reject', reason: '' })).toMatchObject({ outcome: 'deny', code: 'REASON_REQUIRED' });
    expect(decideTipAction({ actor: editor, stage: 'submitted', action: 'reject', reason: 'Nuk verifikohet.' })).toMatchObject({ outcome: 'allow', to: 'rejected' });
  });

  it('only the newsroom acts: not the municipality, the debate admin, the monitor or a citizen', () => {
    for (const role of ['municipality', 'debatwp', 'monitor', 'citizen', 'adsadmin']) {
      expect(decideTipAction({ actor: { role, permissions: [] }, stage: 'submitted', action: 'accept' })).toMatchObject({ outcome: 'deny', status: 403 });
    }
    for (const role of ['superadmin', 'admin', 'newsadmin', 'agent']) {
      expect(decideTipAction({ actor: { role, permissions: [] }, stage: 'submitted', action: 'accept' }).outcome).toBe('allow');
    }
  });
});

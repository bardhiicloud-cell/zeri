import { describe, expect, it } from 'vitest';
import {
  checkTransition, nextMoves, parseEntryInput, parseSource, publishBlockers, type Actor,
} from '../../src/lib/heritage/workflow';
import { entry, claim, l } from '../../src/lib/heritage/seed/helpers';
import type { HeritageEntry, HeritageSource } from '../../src/lib/heritage/types';

const src = (id: string): HeritageSource => ({ id, title: 'T', publisher: 'P', type: 'court', linkChecked: false, origin: 'cms' });
const sources = new Map([['a', src('a')], ['b', src('b')]]);

const good = (over: Partial<HeritageEntry> = {}): HeritageEntry => entry({
  id: 'ok-entry', area: 'kosova', section: 'historia',
  title: l('Titull', 'Title'), summary: l('Përmbledhje', 'Summary'), body: l('Tekst i mjaftueshëm.', 'Enough text.'),
  evidence: 'established', sourceIds: ['a'], status: 'draft',
  verification: { state: 'verified', by: 'x@y', at: '2026-01-01', note: 'kontrolluar' },
  ...over,
});

const editor: Actor = { uid: 'u-ed', role: 'newsadmin' };
const admin: Actor = { uid: 'u-ad', role: 'admin' };
const superadmin: Actor = { uid: 'u-su', role: 'superadmin' };

describe('transitions', () => {
  it('only allows the documented moves', () => {
    expect(nextMoves('draft').map((m) => m.to)).toEqual(['review', 'archived']);
    expect(nextMoves('published').map((m) => m.to)).toEqual(['archived', 'draft']);
    expect(checkTransition({ status: 'draft' }, 'published', admin, '')).toMatchObject({ ok: false, status: 409 });
  });

  it('demands a reason when content goes backwards or comes down', () => {
    expect(checkTransition({ status: 'review' }, 'draft', editor, 'x')).toMatchObject({ ok: false, status: 400 });
    expect(checkTransition({ status: 'review' }, 'draft', editor, 'burimi nuk përputhet')).toEqual({ ok: true });
    expect(checkTransition({ status: 'published' }, 'archived', admin, '')).toMatchObject({ ok: false, status: 400 });
  });

  it('four-eyes: the last editor cannot approve their own work, a second person can', () => {
    const e = { status: 'review' as const, updatedBy: 'u-ed', editedBy: 'u-ed' };
    expect(checkTransition(e, 'approved', editor, '')).toMatchObject({ ok: false, status: 403 });
    expect(checkTransition(e, 'approved', admin, '')).toEqual({ ok: true });
  });

  it('a status change by someone else does not make the editor a stranger to their own content', () => {
    // updatedBy moved to the verifier, but the *content* editor is still u-ed.
    const e = { status: 'review' as const, updatedBy: 'u-ad', editedBy: 'u-ed' };
    expect(checkTransition(e, 'approved', editor, '')).toMatchObject({ ok: false, status: 403 });
  });

  it('a lone superadmin is not locked out of their own archive', () => {
    expect(checkTransition({ status: 'review', editedBy: 'u-su' }, 'approved', superadmin, '')).toEqual({ ok: true });
  });

  it('only admins publish or take content down', () => {
    expect(checkTransition({ status: 'approved' }, 'published', editor, '')).toMatchObject({ ok: false, status: 403 });
    expect(checkTransition({ status: 'approved' }, 'published', admin, '')).toEqual({ ok: true });
    expect(checkTransition({ status: 'published' }, 'draft', editor, 'gabim në datë')).toMatchObject({ ok: false, status: 403 });
  });

  it('roles outside the heritage section have no rights at all', () => {
    expect(checkTransition({ status: 'draft' }, 'review', { uid: 'x', role: 'agent' }, '')).toMatchObject({ ok: false, status: 403 });
    expect(checkTransition({ status: 'draft' }, 'review', { uid: 'x', role: 'agent', permissions: ['heritage'] }, '')).toEqual({ ok: true });
  });
});

describe('publishBlockers', () => {
  const codes = (e: HeritageEntry) => publishBlockers(e, sources).map((b) => b.code);

  it('passes a complete, verified, sourced entry', () => {
    expect(codes(good())).toEqual([]);
  });

  it('requires English, a source, and a second-person verification', () => {
    expect(codes(good({ title: l('Titull', ''), sourceIds: [], verification: { state: 'unverified' } }))).toEqual(expect.arrayContaining(['english', 'sources', 'verification']));
  });

  it('rejects a source that is not in the register', () => {
    expect(codes(good({ sourceIds: ['ghost'] }))).toContain('source-missing');
  });

  it('every claim needs a source and an as-of date', () => {
    const bad = good({ claims: [claim('c1', l('13.535 persona', '13,535 persons'), 'estimate', '', [])] });
    expect(codes(bad)).toEqual(expect.arrayContaining(['claim-source', 'claim-date']));
    const fine = good({ claims: [claim('c1', l('13.535 persona', '13,535 persons'), 'estimate', '2000-12-31', ['a'])] });
    expect(codes(fine)).toEqual([]);
  });

  it('a victim figure written into prose without a declared claim is blocked', () => {
    expect(codes(good({ body: l('U vranë 120 persona në fshat.', 'x') }))).toContain('quantity');
    expect(codes(good({ body: l('U vranë 120 persona në fshat.', 'x'), claims: [claim('c', l('120', '120'), 'estimate', '1999', ['a'])] }))).not.toContain('quantity');
  });

  it('media needs alt text, a known right, credit, and privacy clearance on sensitive pages', () => {
    const media = { id: 'm', kind: 'image' as const, url: 'https://x/y.jpg', alt: l('', ''), caption: l('', ''), credit: '', rights: 'unknown' as const, rightsRef: '', privacyCleared: false };
    const list = codes(good({ media: [media], sensitive: 'graphic' }));
    expect(list).toEqual(expect.arrayContaining(['alt', 'rights', 'privacy']));
  });

  it('sexual-violence pages may carry no photos or video at all', () => {
    const media = { id: 'm', kind: 'image' as const, url: 'https://x/y.jpg', alt: l('a', 'a'), caption: l('', ''), credit: 'C', rights: 'licensed' as const, rightsRef: 'ref', privacyCleared: true };
    expect(codes(good({ sensitive: 'sexual-violence', media: [media] }))).toContain('sensitive-media');
  });

  it('an allegation must say in its text that it is unproven; a living person needs a consent note', () => {
    expect(codes(good({ evidence: 'allegation' }))).toContain('allegation-wording');
    expect(codes(good({ evidence: 'allegation', summary: l('Pretendim i pavërtetuar', 'x') }))).not.toContain('allegation-wording');
    expect(codes(good({ livingPerson: true }))).toContain('consent');
    expect(codes(good({ livingPerson: true, consentNote: 'figurë publike' }))).not.toContain('consent');
  });
});

describe('input parsing', () => {
  const base = { id: 'beteja-1389', area: 'kosova', section: 'historia', kind: 'event', evidence: 'contested', title: { sq: 'T', en: '' }, summary: { sq: 'S', en: '' }, body: { sq: 'B', en: '' } };

  it('accepts a minimal Albanian entry and normalises it', () => {
    const r = parseEntryInput({ ...base, tags: ['  UNESCO ', ''] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.tags).toEqual(['unesco']);
  });

  it('refuses a section that belongs to the other area, a bad slug, an unknown evidence status', () => {
    const r = parseEntryInput({ ...base, area: 'uck', id: 'Bad Slug!', evidence: 'rumour' });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(Object.keys(r.errors).sort()).toEqual(['evidence', 'id', 'section']);
  });

  it('strips control characters and bounds lengths', () => {
    const r = parseEntryInput({ ...base, title: { sq: 'Tit\u0000ull', en: '' }, body: { sq: 'x'.repeat(30000), en: '' } });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.title.sq).toBe('Titull'); expect(r.value.body.sq.length).toBe(24000); }
  });

  it('media must be https and dates must be ISO-partial', () => {
    expect(parseEntryInput({ ...base, media: [{ url: 'javascript:alert(1)' }] }).ok).toBe(false);
    expect(parseEntryInput({ ...base, date: { from: '17/02/2008' } }).ok).toBe(false);
    expect(parseEntryInput({ ...base, date: { from: '2008-02-17', precision: 'day' } }).ok).toBe(true);
  });

  it('sources: https only, slug id, and linkChecked is a claim the server stamps', () => {
    expect(parseSource({ id: 'icty', title: 'T', publisher: 'P', type: 'court', url: 'http://x' }).ok).toBe(false);
    const ok = parseSource({ id: 'icty', title: 'T', publisher: 'P', type: 'court', url: 'https://x', linkChecked: true });
    expect(ok.ok).toBe(true);
  });
});

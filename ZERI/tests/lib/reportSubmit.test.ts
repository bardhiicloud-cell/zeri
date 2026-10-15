import { describe, expect, it } from 'vitest';
import { checkEvidenceFile, classifyServerResponse, evidenceKind, MAX_REPORT_FILES } from '../../src/lib/reportSubmit';
import { parseDraft, serializeDraft, type ReportDraft } from '../../src/lib/reportDraft';

describe('classifyServerResponse', () => {
  it('treats 201 and 200 (idempotent retry) with an id as created', () => {
    expect(classifyServerResponse(201, { id: 'abc', trackingId: 'ZQ-1-ABC' })).toEqual({ kind: 'created', id: 'abc', trackingId: 'ZQ-1-ABC' });
    expect(classifyServerResponse(200, { id: 'abc', trackingId: 'ZQ-1-ABC', alreadyStored: true }).kind).toBe('created');
  });
  it('never reports success without an id', () => {
    expect(classifyServerResponse(201, {}).kind).toBe('retry');
    expect(classifyServerResponse(200, null).kind).toBe('retry');
  });
  it('surfaces the reason of a deliberate refusal', () => {
    expect(classifyServerResponse(409, { error: 'Raport i ngjashëm', code: 'DUPLICATE_WINDOW' })).toEqual({ kind: 'refused', message: 'Raport i ngjashëm', code: 'DUPLICATE_WINDOW' });
    expect(classifyServerResponse(429, {}).kind).toBe('refused');
  });
  it('does not bypass server validation through the direct-write fallback', () => {
    expect(classifyServerResponse(400, { error: 'Mungon komuna.' })).toEqual({ kind: 'invalid', message: 'Mungon komuna.' });
    expect(classifyServerResponse(413, {}).kind).toBe('invalid');
  });
  it('asks for a new sign-in on 401/403', () => {
    expect(classifyServerResponse(401, {}).kind).toBe('session');
    expect(classifyServerResponse(403, {}).kind).toBe('session');
  });
  it('only falls back to a direct write when the server is unreachable', () => {
    for (const status of [404, 502, 503, 504]) expect(classifyServerResponse(status, {}).kind).toBe('fallback');
    expect(classifyServerResponse(500, {}).kind).toBe('retry');
  });
});

describe('checkEvidenceFile', () => {
  const opts = { maxBytes: 10 * 1024 * 1024, currentCount: 0 };
  it('accepts the documented formats', () => {
    const files = [
      ['a.jpg', 'image/jpeg'],
      ['a.mp4', 'video/mp4'],
      ['a.mp3', 'audio/mpeg'],
      ['a.pdf', 'application/pdf'],
      ['a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ] as const;
    for (const [name, type] of files) expect(checkEvidenceFile({ name, size: 100, type }, opts)).toBeNull();
  });
  it('falls back to the extension only when the browser gave no type', () => {
    expect(checkEvidenceFile({ name: 'scan.pdf', size: 100, type: '' }, opts)).toBeNull();
    expect(checkEvidenceFile({ name: 'run.exe', size: 100, type: '' }, opts)).toBe('unsupported');
  });
  it('rejects a file whose declared type is not allowed, whatever its extension', () => {
    expect(checkEvidenceFile({ name: 'x.pdf', size: 100, type: 'application/x-msdownload' }, opts)).toBe('unsupported');
  });
  it('rejects oversized, empty and surplus files', () => {
    expect(checkEvidenceFile({ name: 'a.jpg', size: opts.maxBytes + 1, type: 'image/jpeg' }, opts)).toBe('too_large');
    expect(checkEvidenceFile({ name: 'a.jpg', size: 0, type: 'image/jpeg' }, opts)).toBe('empty');
    expect(checkEvidenceFile({ name: 'a.jpg', size: 1, type: 'image/jpeg' }, { ...opts, currentCount: MAX_REPORT_FILES })).toBe('limit');
  });
  it('classifies media kinds', () => {
    expect(evidenceKind('image/png')).toBe('image');
    expect(evidenceKind('application/pdf')).toBe('document');
    expect(evidenceKind('')).toBe('document');
  });
});

describe('report draft', () => {
  const base = {
    owner: 'guest',
    title: 'Gropë',
    description: 'Pranë shkollës',
    category: '',
    topicCategory: 'rruge',
    urgency: 'Mesatare',
    municipality: 'Prizren',
    address: '',
    coordinates: [42.2, 20.7] as [number, number],
    locationSource: 'municipality' as const,
  };
  it('does not store an empty form', () => {
    expect(serializeDraft({ ...base, title: '', description: '', topicCategory: '' })).toBeNull();
  });
  it('round-trips for the same owner and contains no personal fields', () => {
    const raw = serializeDraft({ ...base, guestPhone: '+38344111222', guestName: 'Arta' } as never)!;
    expect(raw).not.toContain('38344111222');
    expect(raw).not.toContain('Arta');
    const draft = parseDraft(raw, 'guest') as ReportDraft;
    expect(draft.title).toBe('Gropë');
    expect(draft.locationSource).toBe('municipality');
  });
  it('never restores a draft into another account', () => {
    expect(parseDraft(serializeDraft(base)!, 'user-7')).toBeNull();
  });
  it('drops stale, future-dated and corrupt drafts', () => {
    const raw = serializeDraft(base, 1_000)!;
    expect(parseDraft(raw, 'guest', 1_000 + 7 * 60 * 60 * 1000)).toBeNull();
    expect(parseDraft(serializeDraft(base, 10_000_000)!, 'guest', 1_000)).toBeNull();
    expect(parseDraft('{not json', 'guest')).toBeNull();
    expect(parseDraft(null, 'guest')).toBeNull();
  });
  it('repairs invalid coordinates to the default centre', () => {
    const raw = JSON.stringify({ ...JSON.parse(serializeDraft(base)!), coordinates: ['x', 1], locationSource: 'pin' });
    const draft = parseDraft(raw, 'guest')!;
    expect(draft.coordinates).toEqual([42.6629, 21.1655]);
    expect(draft.locationSource).toBe('default');
  });
});

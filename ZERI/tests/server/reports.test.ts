import { describe, expect, it } from 'vitest';
import {
  ANONYMOUS_AUTHOR_NAME,
  buildReportDocument,
  generateTrackingId,
  parseReportInput,
  type ParsedReport,
} from '../../server/reports';
import { getAccountabilityProfile } from '../../src/lib/accountability';

const valid = {
  title: '  Gropë në rrugë  ',
  description: 'Një gropë e madhe pranë shkollës.',
  category: 'Rrugë',
  topicCategory: 'rruge',
  urgency: 'E lartë',
  location: { municipality: 'Prishtinë', address: 'Rr. Nënë Tereza', lat: 42.66, lng: 21.16 },
  media: [{ type: 'image', url: 'https://storage.example/a.jpg' }],
  isAnonymous: false,
  authorName: 'Arta',
};

function parsed(overrides: Record<string, unknown> = {}): ParsedReport {
  const result = parseReportInput({ ...valid, ...overrides });
  if (result.outcome !== 'ok') throw new Error(`expected a valid report: ${result.error}`);
  return result.value;
}

/** Firestore rejects `undefined` anywhere in a document. */
function findUndefined(value: unknown, path = ''): string[] {
  if (value === undefined) return [path];
  if (Array.isArray(value)) return value.flatMap((item, i) => findUndefined(item, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => findUndefined(child, `${path}.${key}`));
  }
  return [];
}

describe('parseReportInput', () => {
  it('accepts a complete report and trims text', () => {
    const report = parsed();
    expect(report.title).toBe('Gropë në rrugë');
    expect(report.municipality).toBe('Prishtinë');
    expect(report.urgency).toBe('E lartë');
    expect(report.topicCategory).toBe('rruge');
  });

  it('rejects missing essentials', () => {
    expect(parseReportInput({ ...valid, title: '' }).outcome).toBe('invalid');
    expect(parseReportInput({ ...valid, description: '' }).outcome).toBe('invalid');
    expect(parseReportInput({ ...valid, category: '' }).outcome).toBe('invalid');
    expect(parseReportInput({ ...valid, location: null }).outcome).toBe('invalid');
    expect(parseReportInput({ ...valid, location: { municipality: '  ' } }).outcome).toBe('invalid');
    expect(parseReportInput(null).outcome).toBe('invalid');
    expect(parseReportInput('nope').outcome).toBe('invalid');
  });

  it('keeps the urgency the citizen chose, and falls back to Mesatare for anything else', () => {
    for (const level of ['E ulët', 'Mesatare', 'E lartë', 'Kritike']) {
      expect(parsed({ urgency: level }).urgency).toBe(level);
    }
    expect(parsed({ urgency: 'urgent!!' }).urgency).toBe('Mesatare');
    expect(parsed({ urgency: undefined }).urgency).toBe('Mesatare');
  });

  it('only accepts a well-formed topic id', () => {
    expect(parsed({ topicCategory: 'polici-siguri' }).topicCategory).toBe('polici-siguri');
    expect(parsed({ topicCategory: '<script>' }).topicCategory).toBe('');
    expect(parsed({ topicCategory: 'x'.repeat(41) }).topicCategory).toBe('');
  });

  it('keeps only https media, at most thirteen (10 photos + 3 videos), and never emits an undefined path', () => {
    const report = parsed({
      media: [
        { type: 'image', url: 'https://ok.example/1.jpg' },
        { type: 'video', url: 'https://ok.example/2.mp4', path: 'reports/u/r/2.mp4' },
        { type: 'image', url: 'http://insecure.example/3.jpg' },
        { type: 'image', url: 'javascript:alert(1)' },
        { type: 'image' },
        null,
      ],
    });
    expect(report.media.map((item) => item.url)).toEqual(['https://ok.example/1.jpg', 'https://ok.example/2.mp4']);
    expect(report.media[0]).not.toHaveProperty('path');
    expect(report.media[1].path).toBe('reports/u/r/2.mp4');
    expect(report.media[1].type).toBe('video');

    const many = parsed({ media: Array.from({ length: 10 }, (_, i) => ({ url: `https://x.example/${i}.jpg` })) });
    expect(many.media.length).toBe(6);
  });

  it('masks the name of an anonymous report whatever the client sent', () => {
    const report = parsed({ isAnonymous: true, authorName: 'Arta Krasniqi' });
    expect(report.isAnonymous).toBe(true);
    expect(report.authorName).toBe(ANONYMOUS_AUTHOR_NAME);
  });

  it('accepts a well-formed tracking id and ignores a malformed one', () => {
    expect(parsed({ trackingId: 'zq-20261011-abcdef123456' }).requestedTrackingId).toBe('ZQ-20261011-ABCDEF123456');
    expect(parsed({ trackingId: '<b>x</b>' }).requestedTrackingId).toBe('');
    expect(parsed({ trackingId: 'short' }).requestedTrackingId).toBe('');
    expect(parsed({}).requestedTrackingId).toBe('');
  });

  it('clamps client-relayed AI output', () => {
    const report = parsed({ aiCategoryScore: 1e9, aiRoutingReason: 'r'.repeat(5000), aiForensicsReport: 'f' });
    expect(report.ai.score).toBe(100);
    expect(report.ai.routingReason?.length).toBe(2000);
    expect(report.ai.forensicsReport).toBe('f');
    expect(parsed({ aiCategoryScore: 'not a number' }).ai.score).toBeUndefined();
  });

  it('treats a zero or non-numeric coordinate as unknown', () => {
    expect(parsed({ location: { municipality: 'Prizren', lat: 0, lng: 'x' } }).lat).toBeNull();
    expect(parsed({ location: { municipality: 'Prizren', lat: 0, lng: 'x' } }).lng).toBeNull();
  });
});

describe('buildReportDocument', () => {
  const NOW = Date.UTC(2026, 9, 11, 12, 0, 0);
  const context = {
    uid: 'user-1',
    nowMs: NOW,
    trackingId: 'ZQ-20261011-ABC',
    createdAt: '<server-timestamp>',
    eventSuffix: 'ab12cd',
  };

  it('stores the pipeline fields the server path used to drop', () => {
    const doc = buildReportDocument(parsed(), context);
    expect(doc.urgency).toBe('E lartë');
    expect(doc.topicCategory).toBe('rruge');
    expect(doc.accountabilityStatus).toBe('Në pritje');
    expect(typeof doc.responsibleInstitution).toBe('string');
    expect(doc.responsibleInstitution).toBeTruthy();
  });

  it('derives the accountability block from the category, not from the client', () => {
    const doc = buildReportDocument(parsed({ category: 'Rrugë' }), context);
    const profile = getAccountabilityProfile('Rrugë');
    expect(doc.responsibleInstitution).toBe(profile.institution);
    expect(doc.responsibleLevel).toBe(profile.level);
    expect(doc.responsibleOffice).toBe(profile.office);
    expect(doc.responseDueAt).toBe(new Date(NOW + profile.responseHours * 3_600_000).toISOString());
  });

  it('always starts a report in Pending Review, owned by the caller, with one timeline event', () => {
    const doc = buildReportDocument(parsed(), context) as { status: string; authorId: string; trackingId: string; timeline: Array<Record<string, unknown>>; createdAt: unknown };
    expect(doc.status).toBe('Pending Review');
    expect(doc.authorId).toBe('user-1');
    expect(doc.trackingId).toBe('ZQ-20261011-ABC');
    expect(doc.timeline).toHaveLength(1);
    expect(doc.timeline[0]).toMatchObject({ status: 'Pending Review', updatedBy: 'Sistemi', source: 'system' });
    expect(doc.createdAt).toBe('<server-timestamp>');
  });

  it('derives images from image media only', () => {
    const doc = buildReportDocument(
      parsed({ media: [{ type: 'image', url: 'https://x/a.jpg' }, { type: 'video', url: 'https://x/b.mp4' }] }),
      context
    ) as { images: string[]; media: unknown[] };
    expect(doc.images).toEqual(['https://x/a.jpg']);
    expect(doc.media).toHaveLength(2);
  });

  it('never produces an undefined value, which Firestore rejects', () => {
    const withMedia = buildReportDocument(parsed(), context);
    const withoutAnything = buildReportDocument(parsed({ media: [], location: { municipality: 'Prizren' } }), context);
    expect(findUndefined(withMedia)).toEqual([]);
    expect(findUndefined(withoutAnything)).toEqual([]);
  });

  it('includes the AI advisory fields only when supplied', () => {
    expect(buildReportDocument(parsed(), context)).not.toHaveProperty('aiCategoryScore');
    expect(buildReportDocument(parsed({ aiCategoryScore: 80 }), context)).toMatchObject({ aiCategoryScore: 80 });
  });
});

describe('generateTrackingId', () => {
  it('has the shape citizens already see', () => {
    const id = generateTrackingId(Date.UTC(2026, 9, 11), 'a1b2c3d4');
    expect(id).toMatch(/^ZQ-20261011-[A-Z0-9]+$/);
    expect(id.endsWith('A1B2C3D4')).toBe(true);
  });

  it('is unique for different random parts', () => {
    expect(generateTrackingId(1, 'aaaa')).not.toBe(generateTrackingId(1, 'bbbb'));
  });
});

describe('clientReportId', () => {
  it('keeps a well-formed Firestore auto id and drops anything else', () => {
    expect(parsed({ clientReportId: 'aB3dE5gH7jK9mN1pQ3sT' }).clientReportId).toBe('aB3dE5gH7jK9mN1pQ3sT');
    expect(parsed({ clientReportId: '../../x' }).clientReportId).toBe('');
    expect(parsed({}).clientReportId).toBe('');
  });
});

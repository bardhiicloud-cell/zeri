import { describe, expect, it } from 'vitest';
import { decideMediaChange, type MediaDecisionInput } from '../../server/reportMedia';

const report = {
  media: [
    { type: 'image', url: 'https://x/a.jpg' },
    { type: 'image', url: 'https://x/b.jpg' },
    { type: 'video', url: 'https://x/v.mp4' },
  ],
  images: ['https://x/a.jpg', 'https://x/b.jpg'],
};
const base: MediaDecisionInput = {
  actor: { role: 'agent', permissions: [] },
  report,
  removed: [],
  action: 'remove',
  url: 'https://x/a.jpg',
  reason: 'Shfaqet fytyra e një personi',
};
const run = (patch: Partial<MediaDecisionInput>) => decideMediaChange({ ...base, ...patch });

describe('decideMediaChange - remove', () => {
  it('takes the photo out of media and images and hands it back to be kept', () => {
    const out = run({});
    if (out.outcome !== 'allow') throw new Error('expected allow');
    expect(out.media.map(m => m.url)).toEqual(['https://x/b.jpg', 'https://x/v.mp4']);
    expect(out.images).toEqual(['https://x/b.jpg']);
    expect(out.taken).toMatchObject({ url: 'https://x/a.jpg' });
  });

  it('lets an admin and an agent, and refuses municipality, monitor, citizen', () => {
    expect(run({ actor: { role: 'admin', permissions: [] } }).outcome).toBe('allow');
    expect(run({ actor: { role: 'superadmin', permissions: [] } }).outcome).toBe('allow');
    for (const role of ['municipality', 'monitor', 'citizen', '']) {
      expect(run({ actor: { role, permissions: [] } }), role).toMatchObject({ outcome: 'deny', status: 403 });
    }
  });

  it('needs a reason', () => {
    expect(run({ reason: '' })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ reason: 'x'.repeat(301) })).toMatchObject({ outcome: 'deny', status: 400 });
  });

  it('refuses a photo that is not on this report, and a missing url', () => {
    expect(run({ url: 'https://x/other.jpg' })).toMatchObject({ outcome: 'deny', status: 404 });
    expect(run({ url: '' })).toMatchObject({ outcome: 'deny', status: 400 });
    expect(run({ url: 42 })).toMatchObject({ outcome: 'deny', status: 400 });
  });

  it('handles older reports that only have an images array', () => {
    const out = run({ report: { images: ['https://x/a.jpg', 'https://x/c.jpg'] } });
    if (out.outcome !== 'allow') throw new Error('expected allow');
    expect(out.images).toEqual(['https://x/c.jpg']);
    expect(out.taken).toMatchObject({ url: 'https://x/a.jpg' });
  });
});

describe('decideMediaChange - restore', () => {
  const removed = [{ type: 'image', url: 'https://x/z.jpg' }];

  it('puts a removed photo back and needs no reason', () => {
    const out = run({ action: 'restore', url: 'https://x/z.jpg', reason: '', removed });
    if (out.outcome !== 'allow') throw new Error('expected allow');
    expect(out.media.map(m => m.url)).toContain('https://x/z.jpg');
    expect(out.images).toContain('https://x/z.jpg');
  });

  it('cannot restore a photo that was never removed', () => {
    expect(run({ action: 'restore', url: 'https://x/z.jpg', removed: [] })).toMatchObject({ outcome: 'deny', status: 404 });
  });

  it('is closed to municipalities and monitors too', () => {
    expect(run({ action: 'restore', url: 'https://x/z.jpg', removed, actor: { role: 'municipality', permissions: [] } })).toMatchObject({ outcome: 'deny', status: 403 });
  });
});

import { describe, expect, it } from 'vitest';
import { isLive, pickFor, placementsOf } from '../../src/lib/notificationPlacements';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const n = (id: string, over: Record<string, unknown> = {}) => ({ id, state: 'published', createdAt: '2026-10-14T10:00:00Z', ...over });

describe('notification placements', () => {
  it('every notification is on the bell; older ones are bell-only', () => {
    expect(placementsOf({})).toEqual(['bell']);
    expect(placementsOf({ placements: ['popup', 'banner', 'junk'] })).toEqual(['bell', 'banner', 'popup']);
  });

  it('only published, unexpired notifications are live', () => {
    expect(isLive({ state: 'draft' }, NOW)).toBe(false);
    expect(isLive({ state: 'archived' }, NOW)).toBe(false);
    expect(isLive({ state: 'published', expiresAt: '2026-10-14T11:00:00Z' }, NOW)).toBe(false);
    expect(isLive({ state: 'published', expiresAt: '2026-10-15T11:00:00Z' }, NOW)).toBe(true);
    expect(isLive({}, NOW)).toBe(true);
  });

  it('a placement shows only notifications that chose it, urgent first, then newest', () => {
    const items = [
      n('old', { placements: ['banner'], createdAt: '2026-10-13T10:00:00Z' }),
      n('new', { placements: ['banner'] }),
      n('urgent', { placements: ['banner'], urgent: true, createdAt: '2026-10-12T10:00:00Z' }),
      n('bellOnly'),
      n('draft', { placements: ['banner'], state: 'draft' }),
      n('expired', { placements: ['banner'], expiresAt: '2026-10-14T09:00:00Z' }),
      n('popup', { placements: ['popup'] }),
    ];
    expect(pickFor(items, 'banner', NOW).map(i => i.id)).toEqual(['urgent', 'new', 'old']);
    expect(pickFor(items, 'popup', NOW).map(i => i.id)).toEqual(['popup']);
    expect(pickFor(items, 'news', NOW)).toEqual([]);
    expect(pickFor(items, 'bell', NOW).map(i => i.id).sort()).toEqual(['bellOnly', 'new', 'old', 'popup', 'urgent']);
  });
});

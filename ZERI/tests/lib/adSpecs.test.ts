import { describe, expect, it } from 'vitest';
import { AD_MAX_BYTES, AD_POSITION_SPECS, describeAdSpec } from '../../src/lib/adSpecs';

// The placements the admin create form offers (AdminAds.tsx position select).
const ADMIN_POSITIONS = ['top', 'article', 'inline', 'feed', 'sidebar', 'banner'];

describe('ad creative specifications', () => {
  it('covers every placement the admin can choose', () => {
    for (const position of ADMIN_POSITIONS) {
      expect(AD_POSITION_SPECS[position], position).toBeDefined();
    }
  });

  it('keeps the ideal size at exactly 2x the minimum (retina rule)', () => {
    for (const [position, spec] of Object.entries(AD_POSITION_SPECS)) {
      expect(spec.ideal.w, position).toBe(spec.min.w * 2);
      expect(spec.ideal.h, position).toBe(spec.min.h * 2);
      expect(spec.min, position).toEqual(spec.display);
    }
  });

  it('caps video above images and GIFs', () => {
    expect(AD_MAX_BYTES.video).toBeGreaterThan(AD_MAX_BYTES.image);
    expect(AD_MAX_BYTES.image).toBeGreaterThan(AD_MAX_BYTES.gif);
  });

  it('describes the exact pixel size for a placement', () => {
    expect(describeAdSpec('top', 'image')).toContain('1792 × 152 px');
    expect(describeAdSpec('sidebar', 'video')).toContain('30 sekonda');
    expect(describeAdSpec('unknown', 'image')).toMatch(/Përzgjidhni një pozicion/);
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import L from 'leaflet';
import { installLeafletSafeRemove } from '../../src/lib/leafletLifecycle';

type Internals = L.Map & {
  _animatingZoom?: boolean;
  _animateToCenter?: L.LatLng;
  _animateToZoom?: number;
  _onZoomTransitionEnd: () => void;
};

/** A map that is in the middle of an animated zoom, exactly as `_animateZoom` leaves it. */
function mapMidZoom(): Internals {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: 400 });
  Object.defineProperty(container, 'clientHeight', { value: 300 });
  document.body.appendChild(container);
  const map = L.map(container, { zoomAnimation: false }).setView([42.66, 21.16], 10) as Internals;
  map._animatingZoom = true;
  map._animateToCenter = L.latLng(42.7, 21.2);
  map._animateToZoom = 12;
  return map;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('Leaflet map removal during a zoom animation (PUB-UI-017)', () => {
  it('installs once and survives the 250 ms fallback timer after remove()', () => {
    installLeafletSafeRemove();
    installLeafletSafeRemove(); // idempotent
    const map = mapMidZoom();
    map.remove();
    // This is the timer `_animateZoom` leaves behind. Unpatched Leaflet throws
    // "Cannot read properties of undefined (reading '_leaflet_pos')" here.
    expect(() => map._onZoomTransitionEnd()).not.toThrow();
  });

  it('still lets a live map finish its zoom animation normally', () => {
    const map = mapMidZoom();
    expect(() => map._onZoomTransitionEnd()).not.toThrow();
    expect(map._animatingZoom).toBe(false);
    expect(map.getZoom()).toBe(12);
    map.remove();
  });

  it('reproduces the upstream defect with the original remove() (so the test is meaningful)', () => {
    const original = (L.Map.prototype as unknown as { __zeriOriginalRemove: (this: L.Map) => L.Map }).__zeriOriginalRemove;
    const map = mapMidZoom();
    original.call(map);
    expect(() => map._onZoomTransitionEnd()).toThrow(/_leaflet_pos/);
  });
});

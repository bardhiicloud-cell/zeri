/**
 * Fixes "Cannot read properties of undefined (reading '_leaflet_pos')".
 *
 * Root cause (Leaflet 1.9.4, `Map._animateZoom`): every animated zoom or fly
 * schedules `setTimeout(this._onZoomTransitionEnd, 250)` as a fallback for
 * browsers that do not fire `transitionend`. `Map.remove()` stops pan and fly
 * animations but never cancels that timer and leaves `_animatingZoom` set.
 * If a map is removed within 250 ms of a zoom (React unmounting the route, a
 * step change, hot reload), the timer fires on a map whose `_mapPane` has been
 * deleted; `_onZoomTransitionEnd` goes on to `_move()` -> `_getMapPanePos()` ->
 * `getPosition(undefined)` and throws `_leaflet_pos`.
 *
 * Fix: clear `_animatingZoom` before the original `remove()` runs. The late timer
 * then takes its own `if (!this._animatingZoom) return` early exit. Nothing is
 * suppressed and animations are untouched while a map is alive.
 *
 * Applied once, for every map in the app, because react-leaflet calls
 * `map.remove()` from `MapContainer`'s cleanup on every unmount.
 */
import L from 'leaflet';

type LeafletMapInternals = L.Map & { _animatingZoom?: boolean; __zeriSafeRemove?: true; __zeriOriginalRemove?: () => L.Map };

export function installLeafletSafeRemove(map: typeof L.Map = L.Map): void {
  const proto = map.prototype as LeafletMapInternals;
  if (proto.__zeriSafeRemove) return;
  const originalRemove = proto.remove;
  proto.remove = function patchedRemove(this: LeafletMapInternals) {
    this._animatingZoom = false;
    return originalRemove.call(this);
  };
  proto.__zeriSafeRemove = true;
  // Kept so the regression test can show what the unpatched method does.
  proto.__zeriOriginalRemove = originalRemove;
}

installLeafletSafeRemove();

import L from 'leaflet';

/**
 * `leaflet.heat@0.2.0` ships a plain UMD bundle (dist/leaflet-heat.js) that reads a
 * bare global `L` instead of importing Leaflet. Inside a bundler Leaflet is an ES
 * module that never assigns `window.L`, so a static `import 'leaflet.heat'` can throw
 * `ReferenceError: L is not defined` while the module is still being evaluated -
 * which takes the whole map page down before React ever renders it.
 *
 * Loading it lazily, after publishing the Leaflet namespace on `window`, keeps the
 * heatmap working and makes a plugin failure non-fatal for the rest of the map.
 */
let heatPluginPromise: Promise<boolean> | null = null;

type LeafletWithHeat = typeof L & { heatLayer?: (...args: unknown[]) => unknown };

function hasHeatLayer(): boolean {
  return typeof (L as LeafletWithHeat).heatLayer === 'function';
}

export function loadLeafletHeat(): Promise<boolean> {
  if (hasHeatLayer()) {
    return Promise.resolve(true);
  }

  if (!heatPluginPromise) {
    (window as unknown as { L: typeof L }).L = L;
    heatPluginPromise = import('leaflet.heat')
      .then(() => hasHeatLayer())
      .catch((error: unknown) => {
        console.error('[leaflet.heat] Nuk u ngarkua dot plugin-i i heatmap-it:', error);
        return false;
      });
  }

  return heatPluginPromise;
}

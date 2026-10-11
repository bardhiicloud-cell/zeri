import L from 'leaflet';
import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import { loadLeafletHeat } from '../../lib/leafletHeat';

/** `[latitude, longitude, intensity]` — the shape `leaflet.heat` expects. */
export type HeatPoint = [number, number, number];

const HEAT_OPTIONS = {
  radius: 30,
  blur: 20,
  maxZoom: 17,
  minOpacity: 0.35,
};

type LeafletWithHeat = typeof L & {
  heatLayer?: (points: HeatPoint[], options: typeof HEAT_OPTIONS) => L.Layer;
};

interface HeatmapLayerProps {
  /** Must be referentially stable (memoised by the caller) or the layer is redrawn on every render. */
  points: HeatPoint[];
}

/**
 * Renders the report density heatmap. The plugin is loaded lazily so a failure there
 * can never break the surrounding map.
 */
export function HeatmapLayer({ points }: HeatmapLayerProps) {
  const map = useMap();
  const [isPluginReady, setIsPluginReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    loadLeafletHeat().then((isReady) => {
      if (isMounted) {
        setIsPluginReady(isReady);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isPluginReady || points.length === 0) {
      return;
    }

    const createHeatLayer = (L as LeafletWithHeat).heatLayer;
    if (typeof createHeatLayer !== 'function') {
      return;
    }

    const heatLayer = createHeatLayer(points, HEAT_OPTIONS);
    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [isPluginReady, map, points]);

  return null;
}

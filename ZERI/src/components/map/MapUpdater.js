import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
const FLY_DURATION_SECONDS = 1.2;
const RESIZE_SETTLE_MS = 650;
/** Keeps the imperative Leaflet instance in sync with the React state of the page. */
export function MapUpdater({ center, zoom, resizeKey }) {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, zoom, { duration: FLY_DURATION_SECONDS });
    }, [center, map, zoom]);
    useEffect(() => {
        const invalidateSize = () => map.invalidateSize({ pan: false, animate: false });
        const animationFrame = window.requestAnimationFrame(invalidateSize);
        // Layout transitions are animated, so a single measurement is not enough.
        const settleTimer = window.setTimeout(invalidateSize, RESIZE_SETTLE_MS);
        const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(invalidateSize) : null;
        resizeObserver?.observe(map.getContainer());
        window.addEventListener('resize', invalidateSize);
        return () => {
            window.cancelAnimationFrame(animationFrame);
            window.clearTimeout(settleTimer);
            resizeObserver?.disconnect();
            window.removeEventListener('resize', invalidateSize);
        };
    }, [map, resizeKey]);
    return null;
}

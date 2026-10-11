const OPEN_STREET_MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
/**
 * Esri World Imagery is used for the satellite view instead of Google's
 * `mt1.google.com/vt/...` endpoint: that one is undocumented, has no published
 * terms of use and Google blocks it without notice, so the layer would silently
 * break in production.
 */
const ESRI_IMAGERY_ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, Maxar, Earthstar Geographics';
const OPEN_STREET_MAP_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ESRI_IMAGERY_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const MAP_TILE_LAYERS = {
    light: {
        url: OPEN_STREET_MAP_URL,
        className: '',
        attribution: OPEN_STREET_MAP_ATTRIBUTION,
        label: 'Pamje ditore',
    },
    dark: {
        url: OPEN_STREET_MAP_URL,
        className: 'map-tiles-dark',
        attribution: OPEN_STREET_MAP_ATTRIBUTION,
        label: 'Pamje nate',
    },
    satellite: {
        url: ESRI_IMAGERY_URL,
        className: '',
        attribution: ESRI_IMAGERY_ATTRIBUTION,
        label: 'Satelit',
    },
};
/** Cycling order used by the "change theme" buttons: night → day → satellite. */
export const MAP_THEME_ORDER = ['dark', 'light', 'satellite'];
export function getNextMapTheme(theme) {
    const currentIndex = MAP_THEME_ORDER.indexOf(theme);
    return MAP_THEME_ORDER[(currentIndex + 1) % MAP_THEME_ORDER.length];
}
/** Kosovo overview used whenever no municipality is selected. */
export const KOSOVO_OVERVIEW_CENTER = [42.58, 20.9];
export const KOSOVO_OVERVIEW_ZOOM = 8.5;
/** Leaflet snaps zoom levels to `zoomSnap`; fractional steps need an explicit value. */
export const MAP_ZOOM_SNAP = 0.5;
export const MAP_MIN_ZOOM = 8.5;
export const MAP_MAX_ZOOM = 12;

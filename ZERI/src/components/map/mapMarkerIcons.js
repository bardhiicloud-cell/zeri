import L from 'leaflet';
/** Design-system colours per urgency level, reused by the map legend. */
export const URGENCY_COLORS = {
    Kritike: 'bg-red-500 shadow-red-500/50',
    'E lartë': 'bg-orange-500 shadow-orange-500/50',
    Mesatare: 'bg-amber-400 shadow-amber-400/50',
    'E ulët': 'bg-emerald-500 shadow-emerald-500/50',
    Baxhë: 'bg-blue-500 shadow-blue-500/50',
};
const FALLBACK_URGENCY_COLOR = 'bg-blue-500';
const MARKER_SIZE = 32;
/**
 * Leaflet renders marker icons as raw HTML, so the Tailwind classes used here must
 * exist as literal strings in this file for the Tailwind scanner to pick them up.
 */
export function createUrgencyMarkerIcon(urgency) {
    const colorClass = URGENCY_COLORS[urgency] ?? FALLBACK_URGENCY_COLOR;
    return L.divIcon({
        className: 'custom-icon',
        html: `<div class="relative w-8 h-8 flex items-center justify-center">
             <div class="absolute inset-1 rounded-full animate-ping opacity-40 ${colorClass}" style="animation-duration: 3s;"></div>
             <div class="relative w-5 h-5 rounded-full border-[2.5px] border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none z-10 ${colorClass} flex items-center justify-center">
                <div class="w-1.5 h-1.5 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] rounded-full"></div>
             </div>
           </div>`,
        iconSize: [MARKER_SIZE, MARKER_SIZE],
        iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
    });
}
/** Restores the bundled Leaflet marker artwork that Leaflet 1.9 no longer resolves by itself. */
export function configureDefaultLeafletIcons() {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
}

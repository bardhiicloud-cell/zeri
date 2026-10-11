import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useStore } from '../lib/store';
import { MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
const defaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = defaultIcon;
const createCustomIcon = (urgency) => {
    const colors = {
        'Kritike': '#ef4444',
        'E lartë': '#f97316',
        'Mesatare': '#eab308',
        'E ulët': '#22c55e'
    };
    const color = colors[urgency] || '#3b82f6';
    return L.divIcon({
        html: `
      <div style="
        background-color: ${color};
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 9999px;
        border: 3px solid white;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      "></div>
    `,
        className: 'custom-marker-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    });
};
export function InteractiveDashboardMap({ customReports }) {
    const storeReports = useStore(state => state.reports);
    const currentUser = useStore(state => state.currentUser);
    const baseReports = customReports || storeReports;
    const visibleReports = customReports ? customReports : baseReports.filter(r => {
        if (currentUser?.role === 'admin')
            return true;
        if (currentUser && r.authorId === currentUser.id && r.authorId !== 'guest')
            return true;
        return r.status !== 'Pending Review' && r.status !== 'Rejected' && r.status !== 'Resolved';
    });
    const navigate = useNavigate();
    // Filter reports with coordinates
    const mapReports = visibleReports.filter(r => r.location.lat && r.location.lng);
    return (_jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-2xl shadow-sm dark:shadow-none border border-slate-200/60 dark:border-white/10 overflow-hidden mt-6 mb-6", children: [_jsxs("div", { className: "p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between", children: [_jsxs("h3", { className: "font-bold text-slate-900 dark:text-white flex items-center gap-2", children: [_jsx(MapPin, { className: "w-5 h-5 text-blue-600" }), dt(`Harta Live e Raportimeve`)] }), _jsx("button", { onClick: () => navigate('/harta'), className: "text-sm font-medium text-blue-600 hover:text-blue-700", children: dt(`Shiko të plotë`) })] }), _jsx("div", { className: "h-[400px] w-full z-0 relative", children: _jsxs(MapContainer, { center: [42.6026, 20.9029], zoom: 8, style: { height: '100%', width: '100%' }, zoomControl: false, scrollWheelZoom: false, children: [_jsx(TileLayer, { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", className: "map-tiles-dark", attribution: '\u00A9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }), _jsx(MarkerClusterGroup, { chunkedLoading: true, maxClusterRadius: 40, children: mapReports.map((report) => (_jsx(Marker, { position: [report.location.lat, report.location.lng], icon: createCustomIcon(report.urgency), eventHandlers: { click: () => navigate("/harta") } }, report.id))) })] }) })] }));
}

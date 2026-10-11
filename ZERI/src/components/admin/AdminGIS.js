import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useStore } from '../../lib/store';
import { formatDistanceToNow } from 'date-fns';
import { sq } from 'date-fns/locale';
import { Navigation, ShieldAlert, Zap, Radio, Moon, Sun } from 'lucide-react';
import { cn } from '../../lib/utils';
import { KOSOVO_MUNICIPALITIES, KOSOVO_BOUNDS, MUNICIPALITY_COORDINATES } from '../../lib/constants';
import { useLanguage } from '../../lib/LanguageContext';
// Fix for default Leaflet icon in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});
const urgencyColors = {
    'Kritike': 'bg-red-500 shadow-red-500/50',
    'E lartë': 'bg-orange-500 shadow-orange-500/50',
    'Mesatare': 'bg-yellow-500 shadow-yellow-500/50',
    'E ulët': 'bg-green-500 shadow-green-500/50',
    'Baxhë': 'bg-blue-500 shadow-blue-500/50',
};
const urgencyStrokes = {
    'Kritike': '#ef4444',
    'E lartë': '#f97316',
    'Mesatare': '#eab308',
    'E ulët': '#22c55e',
    'Baxhë': '#3b82f6',
};
const createCustomIcon = (urgency) => {
    const colorClass = urgencyColors[urgency] || 'bg-blue-500';
    return L.divIcon({
        className: 'custom-icon',
        html: `<div class="relative w-10 h-10 flex items-center justify-center">
             <div class="absolute inset-0 rounded-full animate-ping opacity-30 ${colorClass}"></div>
             <div class="w-6 h-6 rounded-full border-2 border-slate-200/60 dark:border-white/10 rounded-xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] dark:shadow-none z-10 ${colorClass}"></div>
           </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
    });
};
function MapUpdater({ mapCenter }) {
    const map = useMap();
    React.useEffect(() => {
        map.flyTo(mapCenter, map.getZoom(), { duration: 1.5 });
    }, [mapCenter, map]);
    return null;
}
export default function AdminGIS() {
    const { dt } = useLanguage();
    const reports = useStore(state => state.reports);
    const [selectedMunicipality, setSelectedMunicipality] = useState('');
    const [activeFilter, setActiveFilter] = useState('Të gjitha');
    const [mapTheme, setMapTheme] = useState('dark');
    const defaultPosition = [42.6629, 21.1655]; // Prishtina center
    let filteredReports = [...reports];
    if (selectedMunicipality) {
        filteredReports = filteredReports.filter(r => r.location?.municipality === selectedMunicipality);
    }
    if (activeFilter === 'Kritike') {
        filteredReports = filteredReports.filter(r => r.urgency === 'Kritike');
    }
    else if (activeFilter === 'Urgjente') {
        filteredReports = filteredReports.filter(r => r.urgency === 'Kritike' || r.urgency === 'E lartë');
    }
    else if (activeFilter === 'Në Proces') {
        filteredReports = filteredReports.filter(r => r.status === 'Assigned' || r.status === 'In Progress');
    }
    else if (activeFilter === 'Zgjidhur') {
        filteredReports = filteredReports.filter(r => r.status === 'Resolved');
    }
    const mapCenter = selectedMunicipality && MUNICIPALITY_COORDINATES[selectedMunicipality]
        ? MUNICIPALITY_COORDINATES[selectedMunicipality]
        : defaultPosition;
    return (_jsxs("div", { className: "h-[calc(100vh-220px)] w-full relative flex flex-col font-sans overflow-hidden bg-slate-900 border-2 border-slate-200/60 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] dark:shadow-none transition-all duration-300 rounded-xl", children: [_jsxs("div", { className: "bg-slate-900 p-4 flex flex-col md:flex-row justify-between items-center z-[400] relative border-b-2 border-blue-500/30 gap-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "w-10 h-10 border-2 border-blue-500/50 bg-[#c71f16] flex items-center justify-center animate-pulse", children: _jsx(Radio, { className: "w-5 h-5 text-white" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-white font-bold tracking-wide text-lg leading-none", children: dt(`NOC GIS Engine`) }), _jsx("p", { className: "text-blue-400 text-xs font-bold tracking-wide mt-1", children: dt(`Live Sentinel Operations`) })] })] }), _jsxs("div", { className: "flex gap-2 w-full md:w-auto", children: [_jsxs("div", { className: "relative flex-1 md:w-64", children: [_jsx(Navigation, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" }), _jsxs("select", { value: selectedMunicipality, onChange: (e) => setSelectedMunicipality(e.target.value), className: "w-full pl-10 pr-4 py-2 bg-[#040814] border border-blue-500/50 text-white text-xs font-bold tracking-wide outline-none focus:border-blue-400 appearance-none cursor-pointer", children: [_jsx("option", { value: "", children: dt(`TERRITORI NACIONAL`) }), KOSOVO_MUNICIPALITIES.map(m => (_jsx("option", { value: m, children: m }, m)))] })] }), _jsx("button", { onClick: () => setMapTheme(mapTheme === 'light' ? 'dark' : 'light'), className: "flex-none px-4 py-2 bg-[#040814] border border-blue-500/50 text-white flex items-center justify-center hover:bg-blue-900/50 transition-colors", title: dt(`Ndrysho Temën e Hartës`), children: mapTheme === 'light' ? _jsx(Moon, { className: "w-4 h-4" }) : _jsx(Sun, { className: "w-4 h-4" }) }), _jsx("div", { className: "flex gap-1 text-xs uppercase font-bold tracking-widest bg-[#040814] p-1 border border-blue-500/50 overflow-x-auto w-full md:w-auto", children: ['Të gjitha', 'Kritike', 'Urgjente', 'Në Proces', 'Zgjidhur'].map(f => (_jsx("button", { onClick: () => setActiveFilter(f), className: cn("px-4 py-2 transition-colors whitespace-nowrap", activeFilter === f ? "bg-blue-600 text-white" : "text-blue-500 hover:bg-blue-900/50 hover:text-white"), children: dt(f) }, f))) })] })] }), _jsxs("div", { className: "flex-1 w-full bg-[\\#040814] relative min-h-[500px] h-full", children: [_jsxs(MapContainer, { center: mapCenter, zoom: 13, scrollWheelZoom: true, className: "w-full h-full", zoomControl: false, maxBounds: KOSOVO_BOUNDS, children: [_jsx(ZoomControl, { position: "bottomright" }), _jsx(MapUpdater, { mapCenter: mapCenter }), _jsx(TileLayer, { attribution: "", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", className: mapTheme === 'dark' ? 'map-tiles-dark' : '' }), filteredReports.filter(r => r.location?.lat && r.location?.lng).map(report => (_jsxs(React.Fragment, { children: [_jsx(Marker, { position: [report.location.lat, report.location.lng], icon: createCustomIcon(report.urgency), children: _jsxs(Popup, { className: "custom-popup rounded-xl border-0", children: [_jsx("style", { children: `
                     .leaflet-popup-content-wrapper { padding: 0; border: 2px solid #ef4444; border-radius: 0; background: #0f172a; color: white; }
                     .leaflet-popup-content { margin: 0; width: 300px !important; }
                     .leaflet-popup-tip { border-top: 10px solid #ef4444; }
                   ` }), _jsx("div", { className: "w-full", children: _jsxs("div", { className: "p-4 bg-slate-900", children: [_jsxs("div", { className: "flex justify-between items-start mb-2 border-b border-red-500/30 pb-2", children: [_jsxs("span", { className: "text-xs font-bold tracking-wide text-red-400", children: [dt(`ID: #`), report.id.substring(0, 8)] }), _jsx("span", { className: cn("text-xs font-bold tracking-wide px-2 py-0.5", report.status === 'Resolved' ? "bg-emerald-500/20 text-emerald-400" :
                                                                            report.status === 'Pending Review' ? "bg-amber-500/20 text-amber-400" :
                                                                                "bg-blue-500/20 text-blue-400"), children: dt(report.status) })] }), _jsx("h3", { className: "font-bold text-white leading-tight mb-2 text-sm", children: report.title }), _jsxs("div", { className: "space-y-1 mb-4 border-b border-blue-500/20 pb-4", children: [_jsxs("p", { className: "text-xs font-bold text-neutral-500 dark:text-slate-400 tracking-wide flex justify-between", children: [_jsx("span", { children: dt(`Kategoria:`) }), " ", _jsx("span", { className: "text-white", children: dt(report.category) })] }), _jsxs("p", { className: "text-xs font-bold text-neutral-500 dark:text-slate-400 tracking-wide flex justify-between", children: [_jsx("span", { children: dt(`Urgjenca:`) }), " ", _jsx("span", { className: cn("text-white", report.urgency === 'Kritike' ? 'text-red-400' : ''), children: dt(report.urgency) })] }), _jsxs("p", { className: "text-xs font-bold text-neutral-500 dark:text-slate-400 tracking-wide flex justify-between", children: [_jsx("span", { children: dt(`Identifikuesi:`) }), " ", _jsx("span", { className: "text-white", children: report.authorName })] })] }), _jsxs("div", { className: "text-xs font-bold tracking-wide text-slate-700 dark:text-slate-200 dark:text-slate-300 flex items-center justify-between", children: [_jsx("span", { children: formatDistanceToNow(new Date(report.createdAt), { addSuffix: true, locale: sq }) }), report.urgency === 'Kritike' && _jsx(ShieldAlert, { className: "w-4 h-4 text-red-500 animate-pulse" })] })] }) })] }) }), (report.urgency === 'Kritike' || report.urgency === 'E lartë') && (_jsx(Circle, { center: [report.location.lat, report.location.lng], radius: 300, pathOptions: {
                                            color: urgencyStrokes[report.urgency] || '#3b82f6',
                                            fillColor: urgencyStrokes[report.urgency] || '#3b82f6',
                                            fillOpacity: 0.1,
                                            weight: 1,
                                            dashArray: '4'
                                        } }))] }, report.id)))] }), _jsx("div", { className: "absolute top-4 right-4 z-[400] w-48 space-y-2 pointer-events-none hidden md:block", children: _jsxs("div", { className: "bg-slate-900/90 border border-blue-500/50 p-3 pointer-events-auto backdrop-blur-md", children: [_jsx("p", { className: "text-xs text-blue-400 font-bold tracking-wide mb-2 border-b border-blue-500/30 pb-1", children: dt(`Metrikat e Zonës`) }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between items-center text-xs", children: [_jsx("span", { className: "text-neutral-500 dark:text-slate-400", children: dt(`Totali Detektuar`) }), _jsx("span", { className: "font-bold text-white", children: filteredReports.length })] }), _jsxs("div", { className: "flex justify-between items-center text-xs", children: [_jsx("span", { className: "text-neutral-500 dark:text-slate-400", children: dt(`Rrezik i Lartë`) }), _jsx("span", { className: "font-bold text-red-400", children: filteredReports.filter(r => r.urgency === 'Kritike').length })] }), _jsxs("div", { className: "flex justify-between items-center text-xs", children: [_jsx("span", { className: "text-neutral-500 dark:text-slate-400", children: dt(`Përditësimi`) }), _jsxs("span", { className: "font-bold text-emerald-400 flex items-center gap-1", children: [_jsx(Zap, { className: "w-3 h-3" }), dt(`LIVE`)] })] })] })] }) })] })] }));
}

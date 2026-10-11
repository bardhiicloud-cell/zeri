import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus, MapPin, ArrowRight, Filter, Sun, Moon, Satellite, RotateCcw } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { cn } from '../lib/utils';
import { useStore } from '../lib/store';
import { KOSOVO_MUNICIPALITIES, KOSOVO_BOUNDS, MUNICIPALITY_COORDINATES } from '../lib/constants';
import { KOSOVO_OVERVIEW_CENTER, KOSOVO_OVERVIEW_ZOOM, MAP_MAX_ZOOM, MAP_MIN_ZOOM, MAP_TILE_LAYERS, MAP_ZOOM_SNAP, } from '../lib/mapTiles';
import { configureDefaultLeafletIcons } from './map/mapMarkerIcons';
configureDefaultLeafletIcons();
const ZOOM_STEP = 0.5;
/** Zoom used when flying to a municipality - close enough for streets, wide enough for the whole town. */
const MUNICIPALITY_ZOOM = 11.5;
function MapSizeController() {
    const map = useMap();
    useEffect(() => {
        const invalidate = () => map.invalidateSize({ pan: false, animate: false });
        const frame = window.requestAnimationFrame(invalidate);
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(invalidate) : null;
        observer?.observe(map.getContainer());
        window.addEventListener('resize', invalidate);
        return () => {
            window.cancelAnimationFrame(frame);
            observer?.disconnect();
            window.removeEventListener('resize', invalidate);
        };
    }, [map]);
    return null;
}
// Custom Leaflet Circle Pin generator matching screenshot colors exactly
const createPinIcon = (status) => {
    const colors = {
        'Të raportuar': '#2563eb', // Blue
        'Në trajtim': '#f59e0b', // Amber
        'Të zgjidhur': '#10b981', // Emerald
        'Urgjent': '#ef4444' // Red
    };
    const color = colors[status] || '#2563eb';
    return L.divIcon({
        className: 'custom-dashboard-marker',
        html: `
      <div style="
        background-color: ${color};
        width: 14px;
        height: 14px;
        border-radius: 9999px;
        border: 2.5px solid #ffffff;
        box-shadow: 0 2px 5px rgba(0,0,0,0.35);
        cursor: pointer;
        transition: transform 0.15s ease;
      "></div>
    `,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        popupAnchor: [0, -10]
    });
};
/**
 * Drives the imperative Leaflet view from React state.
 *
 * The previous implementation used two independent effects - a `flyTo` and a
 * `setZoom` - that both ran on mount, so the zoom effect immediately cancelled the
 * flight and picking a municipality looked like it did nothing.
 */
function MapViewController({ selectedMunicipality, zoomLevel }) {
    const map = useMap();
    const previousMunicipality = useRef(selectedMunicipality);
    const previousZoom = useRef(zoomLevel);
    useEffect(() => {
        if (previousMunicipality.current === selectedMunicipality)
            return;
        previousMunicipality.current = selectedMunicipality;
        const municipalityCenter = selectedMunicipality
            ? MUNICIPALITY_COORDINATES[selectedMunicipality]
            : undefined;
        if (municipalityCenter) {
            map.flyTo(municipalityCenter, Math.max(zoomLevel, MUNICIPALITY_ZOOM), { duration: 1 });
        }
        else {
            map.flyTo(KOSOVO_OVERVIEW_CENTER, KOSOVO_OVERVIEW_ZOOM, { duration: 1 });
        }
    }, [map, selectedMunicipality, zoomLevel]);
    useEffect(() => {
        if (previousZoom.current === zoomLevel)
            return;
        previousZoom.current = zoomLevel;
        map.setZoom(zoomLevel);
    }, [map, zoomLevel]);
    return null;
}
// Marker component with auto-open on the default active report (#ZQ-4587 in Prishtina)
function ReportMarker({ point, isDefaultOpen, onNavigate }) {
    const markerRef = useRef(null);
    useEffect(() => {
        if (isDefaultOpen && markerRef.current) {
            const timer = setTimeout(() => {
                try {
                    markerRef.current?.openPopup();
                }
                catch (e) {
                    // ignore
                }
            }, 400);
            return () => clearTimeout(timer);
        }
    }, [isDefaultOpen]);
    return (_jsx(Marker, { ref: markerRef, position: [point.lat, point.lng], icon: createPinIcon(point.status), children: _jsx(Popup, { closeButton: false, className: "dashboard-popup-clean", children: _jsxs("div", { onClick: onNavigate, className: "text-left p-1 w-44 cursor-pointer select-none font-sans", children: [_jsx("div", { className: "text-[10px] font-mono font-bold text-slate-500 mb-0.5", children: point.code }), _jsx("div", { className: "text-xs font-bold text-slate-900 leading-tight mb-0.5 truncate", children: point.category }), _jsx("div", { className: "text-[11px] text-slate-500 mb-1.5", children: point.municipality }), _jsx("div", { className: "mb-1", children: _jsx("span", { className: cn("inline-block px-2 py-0.5 rounded text-[10px] font-semibold border", point.status === 'Në trajtim' && "bg-amber-50 text-amber-700 border-amber-200", point.status === 'Të raportuar' && "bg-blue-50 text-blue-700 border-blue-200", point.status === 'Të zgjidhur' && "bg-emerald-50 text-emerald-700 border-emerald-200", point.status === 'Urgjent' && "bg-red-50 text-red-700 border-red-200"), children: point.status }) }), _jsx("div", { className: "text-[10px] text-slate-400 mb-1.5", children: point.date }), _jsxs("div", { className: "text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1", children: [_jsx("span", { children: "Shiko raportin" }), _jsx(ArrowRight, { className: "w-3 h-3" })] })] }) }) }));
}
export function KosovoDashboardMap({ reports, onNavigateToMap, selectedMunicipality = '', onMunicipalityChange }) {
    const navigate = useNavigate();
    // Filters state matching screenshot
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedUrgency, setSelectedUrgency] = useState('all');
    const [currentZoom, setCurrentZoom] = useState(KOSOVO_OVERVIEW_ZOOM);
    const [tileMode, setTileMode] = useState('dark');
    const siteCategories = useStore(state => state.categories);
    const handleGoToMap = () => {
        if (onNavigateToMap) {
            onNavigateToMap();
        }
        else {
            navigate('/harta');
        }
    };
    const handleReset = () => {
        setSelectedCategory('all');
        setSelectedStatus('all');
        setSelectedUrgency('all');
        setCurrentZoom(KOSOVO_OVERVIEW_ZOOM);
        setTileMode('dark');
        if (onMunicipalityChange) {
            onMunicipalityChange('');
        }
    };
    // Merge live store reports that have location coordinates
    const allMapPoints = useMemo(() => {
        const list = [];
        reports.forEach((rep, idx) => {
            if (rep.status === 'Pending Review' || rep.status === 'Rejected' || rep.status === 'Draft')
                return;
            let lat = rep.location?.lat;
            let lng = rep.location?.lng;
            const muni = rep.location?.municipality || 'Prishtinë';
            if (!lat || !lng) {
                const fallback = MUNICIPALITY_COORDINATES[muni] || [42.6629, 21.1655];
                lat = fallback[0] + (((idx * 13) % 7) - 3.5) * 0.005;
                lng = fallback[1] + (((idx * 17) % 7) - 3.5) * 0.005;
            }
            let statusType = 'Në trajtim';
            if (rep.urgency === 'Kritike')
                statusType = 'Urgjent';
            else if (rep.status === 'Resolved')
                statusType = 'Të zgjidhur';
            else if (rep.status === 'Approved' || rep.status === 'In Progress')
                statusType = 'Në trajtim';
            else
                statusType = 'Të raportuar';
            list.push({
                id: rep.id,
                code: rep.trackingId || rep.id,
                title: rep.title,
                category: rep.category || 'Rrugë & Infrastrukturë',
                municipality: muni,
                date: new Date(rep.createdAt || Date.now()).toLocaleDateString('de-DE'),
                status: statusType,
                urgency: rep.urgency || 'Mesatare',
                lat,
                lng
            });
        });
        return list;
    }, [reports]);
    const categoryOptions = useMemo(() => Array.from(new Set([
        ...siteCategories.map(category => category.name),
        ...allMapPoints.map(point => point.category)
    ])).sort(), [allMapPoints, siteCategories]);
    // Filtered points based on dropdown selection
    const filteredPoints = useMemo(() => {
        return allMapPoints.filter(pt => {
            if (selectedCategory !== 'all' && pt.category !== selectedCategory)
                return false;
            if (selectedStatus !== 'all' && pt.status !== selectedStatus)
                return false;
            if (selectedUrgency !== 'all' && pt.urgency !== selectedUrgency)
                return false;
            if (selectedMunicipality && selectedMunicipality !== 'Të gjitha Komunat' && selectedMunicipality !== 'Të gjitha' && selectedMunicipality !== '') {
                if (pt.municipality.toLowerCase() !== selectedMunicipality.toLowerCase())
                    return false;
            }
            return true;
        });
    }, [allMapPoints, selectedCategory, selectedStatus, selectedUrgency, selectedMunicipality]);
    return (_jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs overflow-hidden", children: [_jsxs("div", { className: "p-4 sm:p-5 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsxs("h3", { className: "text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2", children: [_jsx(MapPin, { className: "w-5 h-5 text-blue-600" }), _jsx("span", { children: "Harta e Raportimeve" })] }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-0.5", children: "Shikoni problemet e raportuara n\u00EB t\u00EB gjith\u00EB Kosov\u00EBn" })] }), _jsxs("div", { className: "flex items-center gap-2 self-start sm:self-auto", children: [_jsxs("button", { onClick: handleReset, className: "text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors", children: [_jsx(RotateCcw, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "Rikthe" })] }), _jsxs("button", { onClick: handleGoToMap, className: "text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer", children: [_jsx("span", { children: "Harta e plot\u00EB" }), _jsx(ArrowRight, { className: "w-3.5 h-3.5" })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-12 gap-0", children: [_jsxs("div", { className: "dashboard-map-filters md:col-span-4 lg:col-span-3 p-4 sm:p-5 border-b md:border-b-0 md:border-r border-slate-100 dark:border-white/5 flex flex-col justify-between space-y-4", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs font-semibold text-slate-700 dark:text-slate-300", children: "Kategoria" }), _jsxs("div", { className: "relative", children: [_jsxs("select", { value: selectedCategory, onChange: (e) => setSelectedCategory(e.target.value), className: "w-full appearance-none text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg pl-3 pr-6 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer shadow-2xs", children: [_jsx("option", { value: "all", children: "T\u00EB gjitha kategorit\u00EB" }), categoryOptions.map(category => (_jsx("option", { value: category, children: category }, category)))] }), _jsx("div", { className: "absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400", children: _jsx("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z", clipRule: "evenodd" }) }) })] })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs font-semibold text-slate-700 dark:text-slate-300", children: "Statusi" }), _jsxs("div", { className: "relative", children: [_jsxs("select", { value: selectedStatus, onChange: (e) => setSelectedStatus(e.target.value), className: "w-full appearance-none text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg pl-3 pr-6 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer shadow-2xs", children: [_jsx("option", { value: "all", children: "T\u00EB gjitha statuset" }), _jsx("option", { value: "T\u00EB raportuar", children: "T\u00EB raportuar" }), _jsx("option", { value: "N\u00EB trajtim", children: "N\u00EB trajtim" }), _jsx("option", { value: "T\u00EB zgjidhur", children: "T\u00EB zgjidhur" }), _jsx("option", { value: "Urgjent", children: "Urgjent" })] }), _jsx("div", { className: "absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400", children: _jsx("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z", clipRule: "evenodd" }) }) })] })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs font-semibold text-slate-700 dark:text-slate-300", children: "Komuna" }), _jsxs("div", { className: "relative", children: [_jsxs("select", { value: selectedMunicipality, onChange: (e) => onMunicipalityChange && onMunicipalityChange(e.target.value), className: "w-full appearance-none text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg pl-3 pr-6 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer shadow-2xs", children: [_jsx("option", { value: "", children: "T\u00EB gjitha komunat" }), KOSOVO_MUNICIPALITIES.map(m => (_jsx("option", { value: m, children: m }, m)))] }), _jsx("div", { className: "absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400", children: _jsx("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z", clipRule: "evenodd" }) }) })] })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs font-semibold text-slate-700 dark:text-slate-300", children: "Urgjenca" }), _jsxs("div", { className: "relative", children: [_jsxs("select", { value: selectedUrgency, onChange: (e) => setSelectedUrgency(e.target.value), className: "w-full appearance-none text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg pl-3 pr-6 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer shadow-2xs", children: [_jsx("option", { value: "all", children: "T\u00EB gjitha nivelet" }), _jsx("option", { value: "Kritike", children: "Kritike" }), _jsx("option", { value: "E lart\u00EB", children: "E lart\u00EB" }), _jsx("option", { value: "Mesatare", children: "Mesatare" }), _jsx("option", { value: "E ul\u00EBt", children: "E ul\u00EBt" })] }), _jsx("div", { className: "absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400", children: _jsx("svg", { className: "w-3.5 h-3.5", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z", clipRule: "evenodd" }) }) })] })] }), _jsxs("button", { type: "button", onClick: () => { }, className: "w-full py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer mt-2", children: [_jsx(Filter, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "Filtro" })] })] }), _jsxs("div", { className: "space-y-2 pt-2 text-xs text-slate-600 dark:text-slate-300", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-[#2563eb] shrink-0" }), _jsx("span", { children: "T\u00EB raportuar" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-[#f59e0b] shrink-0" }), _jsx("span", { children: "N\u00EB trajtim" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-[#10b981] shrink-0" }), _jsx("span", { children: "T\u00EB zgjidhur" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-[#ef4444] shrink-0" }), _jsx("span", { children: "Urgjent" })] })] })] }), _jsxs("div", { className: "md:col-span-8 lg:col-span-9 relative h-[340px] sm:h-[380px] lg:h-[400px] bg-slate-200 dark:bg-[#0c162c] overflow-hidden leaflet-host", children: [_jsxs("div", { className: "absolute top-3 left-3 z-[1000] flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden", children: [_jsx("button", { type: "button", onClick: () => setCurrentZoom(z => Math.min(z + ZOOM_STEP, MAP_MAX_ZOOM)), className: "w-7 h-7 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors", title: "Zmadho", children: _jsx(Plus, { className: "w-3.5 h-3.5" }) }), _jsx("div", { className: "h-[1px] bg-slate-200 dark:bg-white/10" }), _jsx("button", { type: "button", onClick: () => setCurrentZoom(z => Math.max(z - ZOOM_STEP, MAP_MIN_ZOOM)), className: "w-7 h-7 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors", title: "Zvog\u00EBlo", children: _jsx(Minus, { className: "w-3.5 h-3.5" }) })] }), _jsxs("div", { className: "absolute top-3 right-3 z-[1000] flex items-center gap-0.5 bg-slate-950/90 backdrop-blur-sm p-1 rounded-lg shadow-lg border border-white/15", children: [_jsx("button", { type: "button", onClick: () => setTileMode('light'), className: cn('w-7 h-7 rounded-md flex items-center justify-center', tileMode === 'light' ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white'), title: "Pamje ditore", children: _jsx(Sun, { className: "w-3.5 h-3.5" }) }), _jsx("button", { type: "button", onClick: () => setTileMode('dark'), className: cn('w-7 h-7 rounded-md flex items-center justify-center', tileMode === 'dark' ? 'bg-blue-600 text-white' : 'text-white/70 hover:text-white'), title: "Night mode", children: _jsx(Moon, { className: "w-3.5 h-3.5" }) }), _jsx("button", { type: "button", onClick: () => setTileMode('satellite'), className: cn('w-7 h-7 rounded-md flex items-center justify-center', tileMode === 'satellite' ? 'bg-emerald-500 text-white' : 'text-white/70 hover:text-white'), title: "Satelit", children: _jsx(Satellite, { className: "w-3.5 h-3.5" }) })] }), _jsxs("div", { className: "absolute bottom-3 left-3 z-[1000] text-[9px] font-mono text-slate-600 dark:text-slate-400 font-semibold flex flex-col gap-0.5 pointer-events-none bg-white/80 dark:bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-white/10 backdrop-blur-xs", children: [_jsxs("div", { className: "flex justify-between w-20 px-0.5", children: [_jsx("span", { children: "0" }), _jsx("span", { children: "25" }), _jsx("span", { children: "50 km" })] }), _jsxs("div", { className: "w-20 h-1 bg-slate-300 dark:bg-slate-600 rounded-xs flex border border-slate-400/50", children: [_jsx("div", { className: "w-1/2 bg-slate-800 dark:bg-slate-200" }), _jsx("div", { className: "w-1/2 bg-white dark:bg-slate-800" })] })] }), _jsx("div", { className: "absolute bottom-3 right-3 z-[1000] pointer-events-none text-[8px] font-medium text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-white/10", children: "\u00A9 OpenStreetMap" }), _jsxs(MapContainer, { center: KOSOVO_OVERVIEW_CENTER, zoom: currentZoom, style: { width: '100%', height: '100%' }, zoomControl: false, scrollWheelZoom: false, attributionControl: false, maxBounds: KOSOVO_BOUNDS, maxBoundsViscosity: 1, zoomSnap: MAP_ZOOM_SNAP, minZoom: MAP_MIN_ZOOM, maxZoom: MAP_MAX_ZOOM, children: [_jsx(TileLayer, { url: MAP_TILE_LAYERS[tileMode].url, className: MAP_TILE_LAYERS[tileMode].className }, tileMode), _jsx(MapSizeController, {}), _jsx(MapViewController, { selectedMunicipality: selectedMunicipality, zoomLevel: currentZoom }), _jsx(MarkerClusterGroup, { chunkedLoading: true, maxClusterRadius: 40, children: filteredPoints.map((pt) => (_jsx(ReportMarker, { point: pt, isDefaultOpen: pt.code === 'ZQ-4587', onNavigate: handleGoToMap }, pt.id))) })] })] })] })] }));
}

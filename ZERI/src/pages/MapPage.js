import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import { useStore } from '../lib/store';
import { formatDistanceToNow } from 'date-fns';
import { sq } from 'date-fns/locale';
import { MapPin, Search, Filter, Layers, Clock, X, ChevronRight, Moon, Sun, Maximize, Minimize, LocateFixed, Activity, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { KOSOVO_MUNICIPALITIES, KOSOVO_BOUNDS, MUNICIPALITY_COORDINATES } from '../lib/constants';
import { ALL_KOSOVO_MUNICIPALITY_NEIGHBORHOODS, getMunicipalNeighborhoods } from '../lib/kosovoNeighborhoods';
import ReportDetailModal from '../components/ReportDetailModal';
import { useLanguage } from '../lib/LanguageContext';
import toast from 'react-hot-toast';
import { getNextMapTheme, MAP_TILE_LAYERS } from '../lib/mapTiles';
import { HeatmapLayer } from '../components/map/HeatmapLayer';
import { MapUpdater } from '../components/map/MapUpdater';
import { createUrgencyMarkerIcon, URGENCY_COLORS, configureDefaultLeafletIcons } from '../components/map/mapMarkerIcons';
configureDefaultLeafletIcons();
const urgencyColors = URGENCY_COLORS;
const createCustomIcon = createUrgencyMarkerIcon;
export const MUNICIPALITY_NEIGHBORHOODS = ALL_KOSOVO_MUNICIPALITY_NEIGHBORHOODS;
export const NEIGHBORHOOD_COORDINATES = {
    // Prishtinë
    'Dardania': [42.6558, 21.1528],
    'Ulpiana': [42.6531, 21.1601],
    'Lakrishte': [42.6588, 21.1472],
    'Mati 1': [42.6465, 21.1788],
    'Kodra e Trimave': [42.6781, 21.1610],
    'Tophane': [42.6685, 21.1625],
    'Arbëria (Dragodan)': [42.6644, 21.1461],
    'Bregu i Diellit': [42.6515, 21.1795],
    'Qendra': [42.6629, 21.1655],
    // Prizren
    'Shadërvan': [42.2081, 20.7415],
    'Ortakoll': [42.2154, 20.7310],
    'Kurrillë': [42.2120, 20.7490],
    // Pejë
    'Karagaq': [42.6525, 20.2885],
    'Çarshia e Gjatë': [42.6610, 20.2920],
    'Jarina': [42.6590, 20.3010],
};
export default function MapPage() {
    const { t, dt } = useLanguage();
    const reports = useStore(state => state.reports);
    const currentUser = useStore(state => state.currentUser);
    const userMunicipality = useStore(state => state.userMunicipality);
    const setUserMunicipality = useStore(state => state.setUserMunicipality);
    const [selectedMunicipality, setSelectedMunicipality] = useState(userMunicipality && userMunicipality !== 'Të gjitha Komunat' && userMunicipality !== 'Kosova (të gjitha komunat)' ? userMunicipality : '');
    const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
    const [mapZoom, setMapZoom] = useState(13);
    const [activeFilter, setActiveFilter] = useState('map_all');
    const [selectedReportId, setSelectedReportId] = useState(null);
    const [activePreviewReport, setActivePreviewReport] = useState(null);
    const [isHudOpen, setIsHudOpen] = useState(window.innerWidth >= 1024);
    const [isAdVisible, setIsAdVisible] = useState(false);
    const [mapTheme, setMapTheme] = useState('dark');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isHeatmapView, setIsHeatmapView] = useState(false);
    const [legendFilters, setLegendFilters] = useState({
        'Kritike': true,
        'E lartë': true,
        'Mesatare': true,
        'E ulët': true,
        'Baxhë': true,
    });
    const defaultPosition = [42.6629, 21.1655]; // Prishtina center
    const [mapCenter, setMapCenter] = useState(defaultPosition);
    React.useEffect(() => {
        const municipality = userMunicipality === 'Të gjitha Komunat' ? '' : (userMunicipality || '');
        setSelectedMunicipality(municipality);
        setSelectedNeighborhood('');
    }, [userMunicipality]);
    const currentNeighborhoods = React.useMemo(() => {
        return getMunicipalNeighborhoods(selectedMunicipality, reports);
    }, [selectedMunicipality, reports]);
    // Update map center and zoom when municipality/neighborhood changes
    React.useEffect(() => {
        if (selectedNeighborhood && NEIGHBORHOOD_COORDINATES[selectedNeighborhood]) {
            setMapCenter(NEIGHBORHOOD_COORDINATES[selectedNeighborhood]);
            setMapZoom(15); // Zoom closer for neighborhood street-view
        }
        else if (selectedMunicipality && MUNICIPALITY_COORDINATES[selectedMunicipality]) {
            setMapCenter(MUNICIPALITY_COORDINATES[selectedMunicipality]);
            setMapZoom(13); // Zoom to city level
        }
    }, [selectedNeighborhood, selectedMunicipality]);
    const handleResetMap = () => {
        setMapCenter(defaultPosition);
        setMapZoom(13);
        setSelectedMunicipality('');
        setSelectedNeighborhood('');
        setActiveFilter('map_all');
        setIsHeatmapView(false);
        setMapTheme('dark');
        setIsFullscreen(false);
        setLegendFilters({
            'Kritike': true,
            'E lartë': true,
            'Mesatare': true,
            'E ulët': true,
            'Baxhë': true,
        });
        setUserMunicipality('Të gjitha Komunat');
        toast.success(t('map_reset') + '!');
    };
    const handleMyLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                setMapCenter([position.coords.latitude, position.coords.longitude]);
                setMapZoom(14);
            }, (error) => {
                console.error("Geolocation error:", error);
                toast.error("Nuk mund të qasemi në lokacionin tuaj. Sigurohuni që keni dhënë leje për lokacionin në shfletues.");
            });
        }
        else {
            toast.error("Shfletuesi juaj nuk mbështet kërkimin e lokacionit.");
        }
    };
    /**
     * The filtered list drives the markers, the heatmap and every counter, and the
     * heatmap effect keys off its identity - so it must be memoised instead of being
     * rebuilt (with new array identities) on each render.
     */
    const filteredReports = useMemo(() => {
        const isVisibleToViewer = (report) => {
            if (currentUser?.role === 'admin')
                return true;
            if (currentUser && report.authorId === currentUser.id && report.authorId !== 'guest')
                return true;
            return report.status !== 'Rejected';
        };
        const neighborhoodQuery = selectedNeighborhood.trim().toLowerCase();
        return reports.filter((report) => {
            if (!isVisibleToViewer(report))
                return false;
            if (selectedMunicipality && report.location?.municipality !== selectedMunicipality)
                return false;
            if (neighborhoodQuery) {
                const searchableText = [report.location?.address, report.title, report.description]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!searchableText.includes(neighborhoodQuery))
                    return false;
            }
            if (activeFilter === 'map_critical' && report.urgency !== 'Kritike')
                return false;
            if (activeFilter === 'map_urgent' && report.urgency !== 'Kritike' && report.urgency !== 'E lartë')
                return false;
            return legendFilters[report.urgency] !== false;
        });
    }, [reports, currentUser, selectedMunicipality, selectedNeighborhood, activeFilter, legendFilters]);
    /** Only reports with real coordinates can be drawn. */
    const mappableReports = useMemo(() => filteredReports.filter((report) => {
        const lat = Number(report.location?.lat);
        const lng = Number(report.location?.lng);
        return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    }), [filteredReports]);
    const heatmapPoints = useMemo(() => mappableReports.map((report) => [report.location.lat, report.location.lng, (report.upvotes || 1) * 10]), [mappableReports]);
    const handleMunicipalityChange = (municipality) => {
        setIsSearching(true);
        setSelectedMunicipality(municipality);
        setUserMunicipality(municipality || 'Të gjitha Komunat');
        // Simulate searching effect
        setTimeout(() => {
            setIsSearching(false);
            // If we're on mobile, close the HUD after selection to show the map
            if (window.innerWidth < 1024) {
                setIsHudOpen(false);
            }
        }, 1000);
    };
    const getUrgencyTranslation = (filter) => {
        if (filter === 'map_all')
            return t('map_all');
        if (filter === 'map_urgent')
            return t('map_urgent');
        if (filter === 'map_critical')
            return t('map_critical');
        return filter;
    };
    return (_jsxs(motion.div, { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }, className: cn("w-full relative flex flex-col font-sans overflow-hidden bg-slate-900 transition-all duration-300 animate-in fade-in duration-700 zoom-in-[0.98]", isFullscreen
            ? "fixed inset-0 h-[100dvh] w-screen z-[10000] border-0"
            : "flex-1 h-full min-h-[50vh] z-0"), children: [isSearching && (_jsxs("div", { className: "absolute inset-0 z-[12000] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500 text-[var(--color-text)] dark:text-[var(--color-surface)]", children: [_jsx("div", { className: "w-16 h-16 border-8 border-slate-900 dark:border-slate-700 border-t-rose-600 rounded-full animate-spin mb-6" }), _jsx("h3", { className: "text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-surface)] tracking-wide title-serif", children: t('map_searching') }), _jsx("p", { className: "text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-300 mt-2 tracking-wide", children: selectedMunicipality || t('map_all_kosovo') })] })), isFullscreen && (_jsxs("button", { "aria-label": "Mbyll", onClick: () => setIsFullscreen(false), className: "fixed top-4 right-4 md:top-6 md:right-6 z-[11000] bg-rose-600 text-white p-4 sm:p-5 border-2 border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] transition-all duration-300 rounded-xl md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] transition-all duration-300 rounded-xl active:shadow-none active:translate-x-1 active:translate-y-1 transition-all pointer-events-auto flex items-center gap-2 font-bold uppercase text-sm sm:text-xs tracking-widest group min-h-[48px]", children: [_jsx(X, { className: "w-6 h-6 group-hover:rotate-90 transition-transform" }), _jsxs("span", { className: "hidden sm:inline", children: [t('map_close'), " ", t('map_fullscreen')] }), _jsx("span", { className: "sm:hidden", children: t('map_close').toUpperCase() })] })), !isFullscreen && (_jsx("div", { className: "lg:hidden absolute top-4 left-4 right-4 z-[2000] pointer-events-none", children: _jsxs("div", { className: "bg-white/95 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-all duration-300 flex items-center p-1.5 pointer-events-auto text-[var(--color-text)] dark:text-[var(--color-surface)]", children: [_jsx("div", { className: "w-10 h-10 flex items-center justify-center text-slate-400 shrink-0", children: _jsx(Search, { className: "w-5 h-5" }) }), _jsxs("div", { className: "flex-1 relative h-10", children: [_jsxs("select", { value: selectedMunicipality, onChange: (e) => handleMunicipalityChange(e.target.value), className: "absolute inset-0 w-full h-full bg-transparent font-bold text-[var(--color-text)] dark:text-[var(--color-surface)] text-sm outline-none tracking-wide cursor-pointer appearance-none px-2 z-10", children: [_jsx("option", { value: "", children: t('map_filter_city').toUpperCase() }), KOSOVO_MUNICIPALITIES.map(m => (_jsx("option", { value: m, children: m }, m)))] }), _jsx("div", { className: "absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none z-0", children: _jsx(ChevronRight, { className: "w-4 h-4 text-slate-400 rotate-90" }) })] }), _jsx("button", { onClick: () => setIsHudOpen(!isHudOpen), className: cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ml-1", isHudOpen ? "bg-rose-600 text-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shadow-rose-600/20" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"), children: isHudOpen ? _jsx(X, { className: "w-5 h-5" }) : _jsx(Filter, { className: "w-5 h-5" }) })] }) })), _jsxs("div", { className: cn("hidden lg:flex absolute z-[1000] flex-col gap-4 pointer-events-none transition-all duration-500", isHudOpen
                    ? "top-6 left-6 w-[360px]"
                    : "top-6 -left-[320px] w-[360px]"), children: [_jsx("button", { onClick: () => setIsHudOpen(!isHudOpen), className: cn("absolute z-[1001] transition-all duration-500 pointer-events-auto flex items-center justify-center shadow-xl backdrop-blur-md", isHudOpen
                            ? "top-4 -right-14 bg-white/10 text-white p-3 rounded-2xl border border-white/20 hover:bg-white/20"
                            : "top-4 left-[340px] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] text-[var(--color-text)] dark:text-[var(--color-surface)] p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none hover:scale-110"), children: isHudOpen ? _jsx(X, { className: "w-5 h-5" }) : _jsx(ChevronRight, { className: "w-5 h-5" }) }), _jsxs("div", { className: "bg-slate-900/90 dark:bg-black/80 backdrop-blur-3xl border border-white/20 dark:border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 overflow-hidden pointer-events-auto", children: [_jsx("div", { className: "p-5 border-b border-white/10 bg-transparent relative", children: _jsxs("div", { className: "flex items-center gap-3 text-white", children: [_jsx("div", { className: "w-10 h-10 bg-neutral-100 border border-slate-200 dark:border-white/10 rounded-xl flex items-center justify-center shrink-0", children: _jsx(MapPin, { className: "w-5 h-5 text-rose-600" }) }), _jsxs("div", { children: [_jsx("h2", { className: "font-bold text-sm md:text-base tracking-wide leading-none text-white", children: t('map_navigator') }), _jsx("p", { className: "text-xs font-bold text-slate-300 mt-1 tracking-normal", children: t('map_location_system') })] })] }) }), _jsx("div", { className: "p-4 md:p-5", children: _jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-bold text-white tracking-wide ml-1", children: t('map_search_city') }), _jsx("div", { className: "flex gap-2", children: _jsxs("div", { className: "relative flex-1", children: [_jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" }), _jsxs("select", { value: selectedMunicipality, onChange: (e) => handleMunicipalityChange(e.target.value), className: "w-full pl-9 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl font-bold text-white text-sm md:text-xs outline-none transition-all focus:border-white focus:ring-1 focus:ring-white cursor-pointer tracking-wide appearance-none", children: [_jsx("option", { value: "", children: t('map_search_city').toUpperCase() }), KOSOVO_MUNICIPALITIES.map(m => (_jsx("option", { value: m, children: m }, m)))] })] }) })] }), selectedMunicipality && currentNeighborhoods.length > 0 && (_jsxs("div", { className: "space-y-1 animate-in fade-in slide-in-from-top-2 duration-300", children: [_jsxs("label", { className: "text-xs font-bold text-white tracking-wide ml-1 flex items-center gap-1", children: [_jsx(MapPin, { className: "w-3.5 h-3.5 text-rose-500" }), dt(`Filtro sipas Lagjes`)] }), _jsx("div", { className: "relative", children: _jsxs("select", { value: selectedNeighborhood, onChange: (e) => setSelectedNeighborhood(e.target.value), className: "w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl font-bold text-white text-sm md:text-xs outline-none transition-all focus:border-white focus:ring-1 focus:ring-white cursor-pointer tracking-wide appearance-none", children: [_jsxs("option", { value: "", children: [dt(`TË GJITHA LAGJET`), " (", currentNeighborhoods.length, ")"] }), currentNeighborhoods.map(n => (_jsx("option", { value: n, children: n }, n)))] }) })] })), _jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { onClick: () => setMapTheme(getNextMapTheme(mapTheme)), className: "flex-1 py-3 bg-white/10 border border-white/10 rounded-xl font-bold text-xs text-white tracking-wide hover:bg-white/20 transition-all flex items-center justify-center gap-2", children: [mapTheme === 'dark' && _jsxs(_Fragment, { children: [_jsx(Sun, { className: "w-4 h-4" }), " ", t('map_theme_day').toUpperCase()] }), mapTheme === 'light' && _jsxs(_Fragment, { children: [_jsx(Layers, { className: "w-4 h-4" }), dt(`SATELIT`)] }), mapTheme === 'satellite' && _jsxs(_Fragment, { children: [_jsx(Moon, { className: "w-4 h-4" }), " ", t('map_theme_night').toUpperCase()] })] }), _jsx("button", { onClick: () => setIsFullscreen(!isFullscreen), className: "flex-1 py-3 bg-white/10 border border-white/10 rounded-xl font-bold text-xs text-white tracking-wide hover:bg-white/20 transition-all flex items-center justify-center gap-2", children: isFullscreen ? _jsxs(_Fragment, { children: [_jsx(Minimize, { className: "w-4 h-4" }), " ", t('map_minimize').toUpperCase()] }) : _jsxs(_Fragment, { children: [_jsx(Maximize, { className: "w-4 h-4" }), " ", t('map_fullscreen').toUpperCase()] }) })] }), _jsx("div", { className: "grid grid-cols-3 gap-1 p-1 bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl", children: ['map_all', 'map_urgent', 'map_critical'].map(f => (_jsx("button", { onClick: () => setActiveFilter(f), className: cn("py-2 text-xs font-bold tracking-normal transition-all", activeFilter === f ? 'bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] text-rose-600' : 'text-white hover:bg-white/10'), children: getUrgencyTranslation(f) }, f))) })] }) })] }), _jsxs("div", { className: cn("bg-slate-900/90 dark:bg-black/80 backdrop-blur-3xl border border-white/20 dark:border-white/10 p-5 pointer-events-auto flex items-center justify-between transition-all duration-300 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-[2rem]", isHudOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"), children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-2 h-2 bg-[#10B981] animate-pulse" }), _jsx("span", { className: "text-xs font-bold text-slate-300 tracking-wider", children: t('active_reports') })] }), _jsxs("span", { className: "text-2xl font-black text-white drop-shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none", children: [filteredReports.length, " ", _jsx("span", { className: "text-neutral-500 dark:text-slate-400 text-xs font-bold tracking-normal", children: t('nav_report') })] })] }), isHudOpen && (_jsx("div", { className: "pointer-events-auto bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] p-2 border-2 border-slate-200/60 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none", children: _jsx("div", { className: "text-xs text-slate-500 dark:text-slate-400 font-medium", children: t('map_legend') }) }))] }), _jsx(AnimatePresence, { children: isHudOpen && (_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, onClick: () => setIsHudOpen(false), className: "lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] cursor-pointer" })) }), _jsx("div", { className: cn("lg:hidden absolute inset-x-0 bottom-0 z-[10001] bg-slate-900/95 dark:bg-black/95 backdrop-blur-3xl border-t border-white/20 dark:border-white/10 rounded-t-[40px] transition-transform duration-500 pointer-events-auto shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.5)] max-h-[85dvh] overscroll-contain overflow-y-auto", isHudOpen ? "translate-y-0" : "translate-y-full"), children: _jsxs("div", { className: "p-6 md:p-8 pb-10", children: [_jsx("div", { className: "w-16 h-1.5 bg-white/20 rounded-full mx-auto mb-8" }), _jsxs("div", { className: "flex justify-between items-center mb-8", children: [_jsxs("h3", { className: "font-black text-white tracking-tight text-xl flex items-center gap-2 drop-shadow-sm dark:shadow-none", children: [_jsx(Filter, { className: "w-5 h-5 text-rose-600" }), t('map_filters')] }), _jsx("button", { "aria-label": "Mbyll", onClick: () => setIsHudOpen(false), className: "w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors border border-white/10", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "space-y-3", children: [_jsx("label", { className: "text-[10px] font-bold text-slate-400 tracking-widest uppercase", children: t('map_urgency_level') }), _jsx("div", { className: "grid grid-cols-3 gap-2", children: ['map_all', 'map_urgent', 'map_critical'].map(f => (_jsxs("button", { onClick: () => setActiveFilter(f), className: cn("py-3 font-bold text-xs sm:text-sm tracking-wide rounded-2xl transition-all active:scale-[0.98] w-full flex items-center justify-center gap-2 border", activeFilter === f ? 'bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] text-black dark:text-white border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'), children: [activeFilter === f && _jsx("div", { className: "w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" }), getUrgencyTranslation(f)] }, f))) })] }), selectedMunicipality && currentNeighborhoods.length > 0 && (_jsxs("div", { className: "space-y-3 animate-in fade-in duration-300", children: [_jsxs("label", { className: "text-[10px] font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1", children: [_jsx(MapPin, { className: "w-3.5 h-3.5 text-rose-500" }), dt(`Lagjet e Qytetit (`), selectedMunicipality, ")"] }), _jsx("div", { className: "relative", children: _jsxs("select", { value: selectedNeighborhood, onChange: (e) => setSelectedNeighborhood(e.target.value), className: "w-full px-4 py-3.5 bg-black/40 border border-white/10 rounded-2xl font-bold text-white text-sm outline-none cursor-pointer tracking-wide focus:border-white focus:ring-1 focus:ring-white transition-all appearance-none", children: [_jsxs("option", { value: "", children: [dt(`TË GJITHA LAGJET`), " (", currentNeighborhoods.length, ")"] }), currentNeighborhoods.map(n => (_jsx("option", { value: n, children: n }, n)))] }) })] })), _jsxs("div", { className: "space-y-3", children: [_jsx("label", { className: "text-[10px] font-bold text-slate-400 tracking-widest uppercase", children: t('map_display') }), _jsxs("div", { className: "grid grid-cols-2 gap-2 sm:gap-3", children: [_jsxs("button", { onClick: () => setMapTheme(getNextMapTheme(mapTheme)), className: "py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl font-bold text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 active:bg-white/20 transition-colors text-white", children: [mapTheme === 'dark' && _jsxs(_Fragment, { children: [_jsx(Sun, { className: "w-4 h-4 text-amber-500" }), " ", t('map_theme_day').toUpperCase()] }), mapTheme === 'light' && _jsxs(_Fragment, { children: [_jsx(Layers, { className: "w-4 h-4 text-indigo-500" }), dt(`SATELIT`)] }), mapTheme === 'satellite' && _jsxs(_Fragment, { children: [_jsx(Moon, { className: "w-4 h-4 text-slate-400" }), " ", t('map_theme_night').toUpperCase()] })] }), _jsx("button", { onClick: () => setIsFullscreen(!isFullscreen), className: "py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl font-bold text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 active:bg-white/20 transition-colors text-white", children: isFullscreen ? _jsxs(_Fragment, { children: [_jsx(Minimize, { className: "w-4 h-4 text-slate-400" }), " ", t('map_minimize').toUpperCase()] }) : _jsxs(_Fragment, { children: [_jsx(Maximize, { className: "w-4 h-4 text-slate-400" }), " ", t('map_fullscreen').toUpperCase()] }) })] })] }), _jsxs("div", { className: "bg-black/40 border border-white/10 p-5 rounded-[2rem] flex justify-between items-center text-white shadow-inner mt-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "relative flex w-3 h-3", children: [_jsx("div", { className: "absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" }), _jsx("div", { className: "relative inline-flex rounded-full w-3 h-3 bg-emerald-500" })] }), _jsx("span", { className: "text-xs font-bold tracking-widest uppercase text-slate-300", children: t('map_results_found').toUpperCase() })] }), _jsx("span", { className: "font-bold text-2xl md:text-3xl", children: filteredReports.length })] })] })] }) }), _jsxs("div", { className: cn("absolute right-4 z-[1500] flex flex-col gap-3 pointer-events-none transition-all duration-300", isFullscreen
                    ? "bottom-6"
                    : isHudOpen
                        ? "bottom-[52%] lg:bottom-24"
                        : "bottom-28 lg:bottom-24"), children: [_jsx("button", { onClick: handleMyLocation, className: "w-14 h-14 md:w-12 md:h-12 bg-white/95 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none flex items-center justify-center text-[var(--color-text)] dark:text-[var(--color-surface)] pointer-events-auto hover:bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:hover:bg-slate-800 active:scale-95 transition-all", title: t('map_my_location'), children: _jsx(LocateFixed, { className: "w-7 h-7 md:w-6 md:h-6" }) }), _jsx("button", { onClick: () => setIsHeatmapView(!isHeatmapView), className: cn("w-14 h-14 md:w-12 md:h-12 border rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.16)] flex items-center justify-center pointer-events-auto active:scale-95 transition-all mt-3", isHeatmapView ? "bg-rose-600 border-rose-600 text-white shadow-rose-600/30" : "bg-white/95 backdrop-blur-md border-slate-200/60 dark:border-white/10 text-[var(--color-text)] dark:text-[var(--color-surface)] hover:bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:hover:bg-slate-800"), title: t('map_heatmap'), children: _jsx(Activity, { className: "w-7 h-7 md:w-6 md:h-6" }) }), _jsx("button", { onClick: handleResetMap, className: "w-14 h-14 md:w-12 md:h-12 bg-white/95 backdrop-blur-md border border-slate-200/60 dark:border-white/10 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.16)] flex items-center justify-center text-[var(--color-text)] dark:text-[var(--color-surface)] pointer-events-auto hover:bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:hover:bg-slate-800 active:scale-95 transition-all mt-3", title: t('map_reset'), children: _jsx(RotateCcw, { className: "w-7 h-7 md:w-6 md:h-6" }) })] }), isAdVisible && (_jsx("div", { className: "absolute inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 pointer-events-none bg-black/40 backdrop-blur-sm", children: _jsxs("div", { className: "pointer-events-auto relative bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col", children: [_jsxs("div", { className: "p-3 bg-neutral-50 dark:bg-slate-900/50 border-b border-neutral-100 flex items-center justify-between z-10 shrink-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" }), _jsx("span", { className: "text-xs font-bold tracking-wide text-[var(--color-text-muted)]", children: t('map_ad_space') })] }), _jsx("button", { "aria-label": "Mbyll", onClick: () => setIsAdVisible(false), className: "text-slate-400 hover:text-slate-700 dark:text-slate-300 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] hover:bg-neutral-100 p-1.5 rounded-2xl border border-transparent hover:border-slate-200/60 dark:border-white/10 transition-colors", title: t('map_close_ad'), children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsx("div", { className: "p-4 sm:p-6 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] flex-1", children: _jsxs("div", { className: "text-center py-8 text-slate-500 dark:text-slate-400", children: [_jsx(MapPin, { className: "w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" }), _jsx("p", { className: "text-sm font-medium", children: "Harta e raportimeve t\u00EB gjith\u00EB Kosov\u00EBs" }), _jsx("p", { className: "text-xs mt-1", children: "Kliko n\u00EB ndonj\u00EB gjasht\u00EB p\u00EBr t\u00EB shfaqur detajet" })] }) })] }) })), _jsx("div", { className: "flex-1 w-full bg-slate-900 z-0 relative min-h-[60vh] md:min-h-[500px]", children: _jsxs("div", { className: "absolute inset-0", children: [_jsxs(MapContainer, { center: mapCenter, zoom: 13, scrollWheelZoom: true, className: "w-full h-full z-0", style: { background: '#e2e8f0' }, zoomControl: false, maxBounds: KOSOVO_BOUNDS, maxBoundsViscosity: 0.9, minZoom: 7, maxZoom: 18, children: [_jsx(ZoomControl, { position: "bottomright" }), _jsx(MapUpdater, { center: mapCenter, zoom: mapZoom, resizeKey: `${isHudOpen ? 'hud-open' : 'hud-closed'}-${isFullscreen ? 'fullscreen' : 'inline'}` }), _jsx(TileLayer, { url: MAP_TILE_LAYERS[mapTheme].url, className: MAP_TILE_LAYERS[mapTheme].className, attribution: MAP_TILE_LAYERS[mapTheme].attribution }, mapTheme), isHeatmapView ? (_jsx(HeatmapLayer, { points: heatmapPoints })) : (_jsx(MarkerClusterGroup, { chunkedLoading: true, children: mappableReports.map(report => {
                                        const lat = Number(report.location?.lat);
                                        const lng = Number(report.location?.lng);
                                        if (!Number.isFinite(lat) || !Number.isFinite(lng))
                                            return null;
                                        return (_jsx(Marker, { position: [lat, lng], icon: createCustomIcon(report.urgency), eventHandlers: { click: () => setActivePreviewReport(report) } }, report.id));
                                    }) }))] }), _jsx(AnimatePresence, { children: activePreviewReport && (_jsxs(motion.div, { initial: { opacity: 0, y: 20, scale: 0.95 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 20, scale: 0.95 }, className: "absolute bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 lg:left-auto lg:-translate-x-0 lg:right-6 z-[1000] w-[calc(100%-2rem)] lg:w-85 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10", children: [_jsx("button", { onClick: () => setActivePreviewReport(null), className: "absolute top-2 right-2 bg-black/40 hover:bg-black/60 text-white p-1.5 rounded-full z-10 transition-colors backdrop-blur-sm", children: _jsx(X, { className: "w-4 h-4" }) }), activePreviewReport.images?.length > 0 && (_jsxs("div", { className: "relative h-32 w-full", children: [_jsx("img", { src: activePreviewReport.images[0], className: "w-full h-full object-cover", alt: activePreviewReport.title }), _jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" }), _jsx("span", { className: "absolute bottom-3 left-3 px-2 py-0.5 rounded text-xs font-bold tracking-wide text-white backdrop-blur-md bg-white/20 border border-white/30", children: dt(activePreviewReport.category) })] })), _jsxs("div", { className: "p-4", children: [_jsxs("div", { className: "flex items-center gap-1.5 mb-2 flex-wrap", children: [_jsx("span", { className: cn("px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider text-white", activePreviewReport.urgency === 'Kritike' ? 'bg-rose-600 shadow-sm dark:shadow-none shadow-rose-600/10' :
                                                            activePreviewReport.urgency === 'E lartë' ? 'bg-orange-500 shadow-sm dark:shadow-none shadow-orange-500/10' :
                                                                activePreviewReport.urgency === 'Mesatare' ? 'bg-amber-500 shadow-sm dark:shadow-none shadow-amber-500/10' :
                                                                    'bg-emerald-600 shadow-sm dark:shadow-none shadow-emerald-600/10'), children: activePreviewReport.urgency }), _jsx("span", { className: cn("px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider", activePreviewReport.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-blue-100 text-blue-800 border border-blue-200'), children: activePreviewReport.status === 'Resolved' ? t('dash_resolved') : "Në Proces" })] }), _jsx("h3", { className: "font-bold text-[var(--color-text)] dark:text-[var(--color-surface)] leading-tight mb-2 text-base line-clamp-2", children: activePreviewReport.title }), _jsxs("div", { className: "flex flex-col gap-1.5 mb-4", children: [_jsxs("p", { className: "text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5", children: [_jsx(Clock, { className: "w-3.5 h-3.5 text-slate-400" }), " ", formatDistanceToNow(new Date(activePreviewReport.createdAt), { addSuffix: true, locale: sq }), dt(`nga`), " ", _jsx("span", { className: "text-[var(--color-text)] dark:text-[var(--color-surface)] font-semibold", children: activePreviewReport.authorName })] }), _jsxs("p", { className: "text-xs font-medium text-[var(--color-text-muted)] tracking-wide flex items-center gap-1.5 truncate", children: [_jsx(MapPin, { className: "w-3.5 h-3.5 text-rose-500 shrink-0" }), " ", _jsx("span", { className: "truncate", children: activePreviewReport.location?.address || 'Nuk ka adresë' })] })] }), _jsxs("button", { onClick: () => {
                                                    setSelectedReportId(activePreviewReport.id);
                                                    setActivePreviewReport(null);
                                                }, className: "w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-sm dark:shadow-none hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none", children: [_jsx(Activity, { className: "w-4 h-4" }), t('map_details')] })] })] })) }), _jsxs("div", { className: "absolute bottom-6 left-6 z-[1000] hidden md:flex flex-col gap-3 bg-slate-900/95 backdrop-blur-xl p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/15 animate-in slide-in-from-bottom-4 duration-500 min-w-[200px]", children: [_jsx("div", { className: "text-[10px] font-black tracking-widest text-rose-400 uppercase mb-1.5 border-b border-white/10 pb-1", children: t('map_urgency_level') }), Object.entries(urgencyColors).map(([level, colorClass]) => {
                                    const isActive = legendFilters[level] !== false;
                                    return (_jsxs("button", { onClick: () => setLegendFilters(prev => ({ ...prev, [level]: !isActive })), className: `flex items-center justify-between w-full text-left transition-all py-1 ${!isActive ? 'opacity-30 grayscale' : 'opacity-100 hover:translate-x-1'}`, children: [_jsx("span", { className: "text-xs font-extrabold text-slate-200", children: level }), _jsx("div", { className: `relative w-4 h-4 rounded-full border-2 border-slate-900 shadow-sm dark:shadow-none flex items-center justify-center ${colorClass}`, children: _jsx("div", { className: "w-1 h-1 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] rounded-full" }) })] }, level));
                                })] })] }) }), selectedReportId && (() => {
                const selectedReport = reports.find(r => r.id === selectedReportId);
                if (!selectedReport)
                    return null;
                return (_jsx(ReportDetailModal, { report: selectedReport, onClose: () => setSelectedReportId(null) }));
            })()] }));
}

import { dt } from '@/src/lib/dt';
import { isAcceptedForPublic } from '../lib/publicReportsApi';
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
import { useLocation } from 'react-router-dom';
import { KOSOVO_MUNICIPALITIES, KOSOVO_BOUNDS, MUNICIPALITY_COORDINATES } from '../lib/constants';
import { ALL_KOSOVO_MUNICIPALITY_NEIGHBORHOODS, getMunicipalNeighborhoods } from '../lib/kosovoNeighborhoods';
import ReportDetailModal from '../components/ReportDetailModal.tsx';
import { Report } from '../types';
import { useLanguage } from '../lib/LanguageContext';
import toast from 'react-hot-toast';
import { getNextMapTheme, MAP_TILE_LAYERS, type MapTheme, KOSOVO_OVERVIEW_CENTER, KOSOVO_OVERVIEW_ZOOM } from '../lib/mapTiles';
import { HeatmapLayer, type HeatPoint } from '../components/map/HeatmapLayer';
import { MapUpdater } from '../components/map/MapUpdater';
import { createUrgencyMarkerIcon, URGENCY_COLORS, configureDefaultLeafletIcons } from '../components/map/mapMarkerIcons';
import { getReportTopic, getReportTopicValueLabel, REPORT_TOPICS } from '../lib/reportTopics';
import { ALL_SCOPE, isSpecificScope, scopeKey } from '../lib/municipalityScope';

configureDefaultLeafletIcons();

const urgencyColors = URGENCY_COLORS;
const createCustomIcon = createUrgencyMarkerIcon;

export const MUNICIPALITY_NEIGHBORHOODS: Record<string, string[]> = ALL_KOSOVO_MUNICIPALITY_NEIGHBORHOODS;

export const NEIGHBORHOOD_COORDINATES: Record<string, [number, number]> = {
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
  const location = useLocation();
  const { t, dt } = useLanguage();
  const reports = useStore(state => state.reports);
  const currentUser = useStore(state => state.currentUser);
  const userMunicipality = useStore(state => state.userMunicipality);
  const setUserMunicipality = useStore(state => state.setUserMunicipality);

  /**
   * Scope priority, in order:
   *
   *   1. `?municipality=` in the URL — an explicit, shareable intent.
   *   2. the global scope, which the sidebar switcher and the dashboard write.
   *   3. no filter at all.
   *
   * Rule 2 is what the "Pejë sent me to the whole-country map" report was
   * about. The dashboard's full-map link used to pass the *hero* municipality
   * (which falls back to Prishtinë when nothing is selected) instead of the
   * active scope, so a citizen who had never chosen anything landed on a map
   * filtered to a city they had not picked — and a citizen scoped to Pejë who
   * arrived without a query string had their scope ignored on the first paint
   * because the effect below ran after the map was already centred.
   *
   * The value is read once, at mount, so the first render is already correct.
   */
  const requestedMunicipality = new URLSearchParams(location.search).get('municipality') || '';
  const resolveScope = React.useCallback(
    (requested: string, global: string) => (
      isSpecificScope(requested)
        ? scopeKey(requested)
        : isSpecificScope(global) ? scopeKey(global) : ''
    ),
    []
  );

  const [selectedMunicipality, setSelectedMunicipality] = useState(() =>
    resolveScope(requestedMunicipality, userMunicipality)
  );
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [mapZoom, setMapZoom] = useState(() => {
    const initialScope = resolveScope(requestedMunicipality, userMunicipality);
    return initialScope ? 13 : 13;
  });
  const [activeFilter, setActiveFilter] = useState('map_all');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [activePreviewReport, setActivePreviewReport] = useState<Report | null>(null);
  const [isHudOpen, setIsHudOpen] = useState(window.innerWidth >= 1024);
  const [isAdVisible, setIsAdVisible] = useState(false);
  const [mapTheme, setMapTheme] = useState<'light' | 'dark' | 'satellite'>('dark');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isHeatmapView, setIsHeatmapView] = useState(false);
  const [legendFilters, setLegendFilters] = useState<Record<string, boolean>>({
    'Kritike': true,
    'E lartë': true,
    'Mesatare': true,
    'E ulët': true,
    'Baxhë': true,
  });

  const defaultPosition: [number, number] = [42.6629, 21.1655]; // Prishtina center

  /**
   * The map opens on the scoped municipality, not on the country centre.
   * Leaving the centre at Prishtinë while the filter said Pejë is exactly how
   * the page read as "it sent me to the big map, not to Pejë".
   */
  const [mapCenter, setMapCenter] = useState<[number, number]>(() => {
    const initialScope = resolveScope(requestedMunicipality, userMunicipality);
    return (initialScope && MUNICIPALITY_COORDINATES[initialScope]) || defaultPosition;
  });

  React.useEffect(() => {
    // One source of truth. The previous comparison listed the two "all"
    // spellings it had heard of, so a scope written by the sidebar switcher in
    // any other casing left the map on the old municipality while the rest of
    // the site had moved.
    const nextMunicipality = resolveScope(requestedMunicipality, userMunicipality);
    setSelectedMunicipality(nextMunicipality);

    /**
     * Arriving with `?municipality=Pejë` promotes that municipality to the
     * global scope, so the sidebar, the dashboard and every other page agree
     * with the map the citizen is looking at. Arriving with no query string
     * must NOT write anything: the global scope is the input here, and echoing
     * it back into the store on mount is what produced a stale choice after a
     * reload.
     */
    if (isSpecificScope(requestedMunicipality)) {
      setUserMunicipality(scopeKey(requestedMunicipality));
    }
    setSelectedNeighborhood('');
  }, [requestedMunicipality, resolveScope, setUserMunicipality, userMunicipality]);

  const currentNeighborhoods = React.useMemo(() => {
    return getMunicipalNeighborhoods(selectedMunicipality, reports);
  }, [selectedMunicipality, reports]);

  /**
   * Update map centre and zoom when municipality/neighborhood changes.
   *
   * The no-selection branch is deliberate: deselecting used to leave the map
   * parked on the previous town with a country-wide filter, so the pins on
   * screen and the count in the HUD described different sets of reports.
   */
  React.useEffect(() => {
    if (selectedNeighborhood && NEIGHBORHOOD_COORDINATES[selectedNeighborhood]) {
      setMapCenter(NEIGHBORHOOD_COORDINATES[selectedNeighborhood]);
      setMapZoom(15); // Zoom closer for neighborhood street-view
    } else if (selectedMunicipality && MUNICIPALITY_COORDINATES[selectedMunicipality]) {
      setMapCenter(MUNICIPALITY_COORDINATES[selectedMunicipality]);
      setMapZoom(13); // Zoom to city level
    } else {
      setMapCenter(KOSOVO_OVERVIEW_CENTER);
      setMapZoom(KOSOVO_OVERVIEW_ZOOM);
    }
  }, [selectedNeighborhood, selectedMunicipality]);

  const handleResetMap = () => {
    setMapCenter(defaultPosition);
    setMapZoom(13);
    setSelectedMunicipality('');
    setSelectedNeighborhood('');
    setSelectedTopic('');
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
    setUserMunicipality(ALL_SCOPE);
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
    } else {
      toast.error("Shfletuesi juaj nuk mbështet kërkimin e lokacionit.");
    }
  };

  /**
   * The filtered list drives the markers, the heatmap and every counter, and the
   * heatmap effect keys off its identity - so it must be memoised instead of being
   * rebuilt (with new array identities) on each render.
   */
  const filteredReports = useMemo(() => {
    // The public map shows only what a reviewer has accepted, for everyone, staff
    // included: a report in "Në pritje" on the map looked published without approval.
    // Staff see pending reports in the admin queue; authors on "Raportet e mia".
    const isVisibleToViewer = (report: Report) => isAcceptedForPublic(report.status);

    const neighborhoodQuery = selectedNeighborhood.trim().toLowerCase();

    return reports.filter((report) => {
      if (!isVisibleToViewer(report)) return false;

      if (selectedMunicipality && report.location?.municipality !== selectedMunicipality) return false;

      if (neighborhoodQuery) {
        const searchableText = [report.location?.address, report.title, report.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!searchableText.includes(neighborhoodQuery)) return false;
      }

      if (activeFilter === 'map_critical' && report.urgency !== 'Kritike') return false;
      if (activeFilter === 'map_urgent' && report.urgency !== 'Kritike' && report.urgency !== 'E lartë') return false;
      if (selectedTopic && getReportTopic(report)?.id !== selectedTopic) return false;

      return legendFilters[report.urgency] !== false;
    });
  }, [reports, selectedMunicipality, selectedNeighborhood, activeFilter, selectedTopic, legendFilters]);

  /** Only reports with real coordinates can be drawn. */
  const mappableReports = useMemo(
    () => filteredReports.filter((report) => {
      const lat = Number(report.location?.lat);
      const lng = Number(report.location?.lng);
      return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    }),
    [filteredReports]
  );

  const heatmapPoints = useMemo<HeatPoint[]>(
    () => mappableReports.map((report) => [report.location.lat, report.location.lng, (report.upvotes || 1) * 10]),
    [mappableReports]
  );

  const handleMunicipalityChange = (municipality: string) => {
    setIsSearching(true);
    setSelectedMunicipality(municipality);
    setUserMunicipality(municipality || ALL_SCOPE);
    
    // Simulate searching effect
    setTimeout(() => {
      setIsSearching(false);
      // If we're on mobile, close the HUD after selection to show the map
      if (window.innerWidth < 1024) {
        setIsHudOpen(false);
      }
    }, 1000);
  };

  const getUrgencyTranslation = (filter: string) => {
    if (filter === 'map_all') return t('map_all');
    if (filter === 'map_urgent') return t('map_urgent');
    if (filter === 'map_critical') return t('map_critical');
    return filter;
  };

  const getUrgencyLabel = (level: string) => {
    const translationKeys = {
      Kritike: 'report_urgency_critical',
      'E lartë': 'report_urgency_high',
      Mesatare: 'report_urgency_medium',
      'E ulët': 'report_urgency_low',
      Baxhë: 'report_urgency_trivial',
    } as const;
    const key = translationKeys[level as keyof typeof translationKeys];
    return key ? t(key) : level;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
      "w-full relative flex flex-col font-sans overflow-hidden bg-slate-900 transition-all duration-300 animate-in fade-in duration-700 zoom-in-[0.98]",
      isFullscreen 
        ? "fixed inset-0 h-[100dvh] w-screen z-[10000] border-0" 
        : "flex-1 h-full min-h-[50vh] z-0"
    )}>
      {/* Searching Overlay */}
      {isSearching && (
        <div className="absolute inset-0 z-[12000] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500 text-[var(--color-text)] dark:text-[var(--color-surface)]">
          <div className="w-16 h-16 border-8 border-slate-900 dark:border-slate-700 border-t-rose-600 rounded-full animate-spin mb-6" />
          <h3 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-surface)] tracking-wide title-serif">
            {t('map_searching')}
          </h3>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-300 mt-2 tracking-wide">{selectedMunicipality || t('map_all_kosovo')}</p>
        </div>
      )}

      {/* Dedicated Exit Fullscreen Button - Only visible in fullscreen */}
      {isFullscreen && (
        <button aria-label={dt('Mbyll')}  
          onClick={() => setIsFullscreen(false)}
          className="fixed top-4 right-4 md:top-6 md:right-6 z-[11000] bg-rose-600 text-white p-4 sm:p-5 border-2 border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] transition-all duration-300 rounded-xl md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] transition-all duration-300 rounded-xl active:shadow-none active:translate-x-1 active:translate-y-1 transition-all pointer-events-auto flex items-center gap-2 font-bold uppercase text-sm sm:text-xs tracking-widest group min-h-[48px]"
        >
<X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
          <span className="hidden sm:inline">{t('map_close')} {t('map_fullscreen')}</span>
          <span className="sm:hidden">{t('map_close').toUpperCase()}</span>
        </button>
      )}

      {/* Mobile Floating Search Bar - Improved styling and functionality */}
      {!isFullscreen && (
        <div data-tour="map-search" className="lg:hidden absolute top-4 left-4 right-4 z-[2000] pointer-events-none">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-all duration-300 flex items-center p-1.5 pointer-events-auto text-[var(--color-text)] dark:text-[var(--color-surface)]">
            <div className="w-10 h-10 flex items-center justify-center text-slate-400 shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div className="flex-1 relative h-10">
              <select 
                value={selectedMunicipality}
                onChange={(e) => handleMunicipalityChange(e.target.value)}
                className="absolute inset-0 w-full h-full bg-transparent font-bold text-[var(--color-text)] dark:text-[var(--color-surface)] text-sm outline-none tracking-wide cursor-pointer appearance-none px-2 z-10"
              >
                <option value="">{t('map_all_kosovo')} ({KOSOVO_MUNICIPALITIES.length})</option>
                {KOSOVO_MUNICIPALITIES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none z-0">
                 <ChevronRight className="w-4 h-4 text-slate-400 rotate-90" />
              </div>
            </div>
            <button 
              onClick={() => setIsHudOpen(!isHudOpen)}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition shrink-0 ml-1",
                isHudOpen ? "bg-rose-600 text-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shadow-rose-600/20" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              )}
            >
              {isHudOpen ? <X className="w-5 h-5" /> : <Filter className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      {/* Desktop HUD Container */}
      <div className={cn(
        "hidden lg:flex absolute z-[1000] flex-col gap-4 pointer-events-none transition-all duration-500",
        selectedReportId && "hidden",
        isHudOpen 
          ? "top-6 left-6 w-[360px]" 
          : "top-6 -left-[320px] w-[360px]"
      )}>
        
        {/* Toggle Button for Desktop */}
        <button 
          onClick={() => setIsHudOpen(!isHudOpen)}
          className={cn(
            "absolute z-[1001] transition-all duration-500 pointer-events-auto flex items-center justify-center shadow-xl backdrop-blur-md",
            isHudOpen 
              ? "top-4 -right-14 bg-white/10 text-white p-3 rounded-2xl border border-white/20 hover:bg-white/20"
              : "top-4 left-[340px] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] text-[var(--color-text)] dark:text-[var(--color-surface)] p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none hover:scale-110"
          )}
        >
          {isHudOpen ? <X className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>

        {/* Main Controls Panel (Desktop) */}
        <div className="bg-slate-900/90 dark:bg-black/80 backdrop-blur-3xl border border-white/20 dark:border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition duration-300 overflow-hidden pointer-events-auto">
          <div className="p-5 border-b border-white/10 bg-transparent relative">
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 bg-neutral-100 border border-slate-200 dark:border-white/10 rounded-xl flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h2 className="font-bold text-sm md:text-base tracking-wide leading-none text-white">
                  {t('map_navigator')}
                </h2>
                <p className="text-xs font-bold text-slate-300 mt-1 tracking-normal">
                   {t('map_location_system')}
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-4 md:p-5">
            <div className="flex flex-col gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white tracking-wide ml-1">
                   {t('map_search_city')}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select 
                      value={selectedMunicipality}
                      onChange={(e) => handleMunicipalityChange(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl font-bold text-white text-sm md:text-xs outline-none transition focus:border-white focus:ring-1 focus:ring-white cursor-pointer tracking-wide appearance-none"
                    >
                      <option value="">{t('map_all_kosovo')} ({KOSOVO_MUNICIPALITIES.length})</option>
                      {KOSOVO_MUNICIPALITIES.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="map-topic-filter" className="text-xs font-bold text-white tracking-wide ml-1">{dt('Tema e raportimit')}</label>
                <select
                  id="map-topic-filter"
                  value={selectedTopic}
                  onChange={event => setSelectedTopic(event.target.value)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl font-bold text-white text-sm md:text-xs outline-none transition focus:border-white focus:ring-1 focus:ring-white cursor-pointer tracking-wide"
                >
                  <option value="">{dt('Të gjitha temat')}</option>
                  {REPORT_TOPICS.map(topic => <option key={topic.id} value={topic.id}>{getReportTopicValueLabel(topic.id)}</option>)}
                </select>
              </div>

              {selectedMunicipality && currentNeighborhoods.length > 0 && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-xs font-bold text-white tracking-wide ml-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />{dt(`Filtro sipas Lagjes`)}
                  </label>
                  <div className="relative">
                    <select 
                      value={selectedNeighborhood}
                      onChange={(e) => setSelectedNeighborhood(e.target.value)}
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl font-bold text-white text-sm md:text-xs outline-none transition focus:border-white focus:ring-1 focus:ring-white cursor-pointer tracking-wide appearance-none"
                    >
                      <option value="">{dt(`TË GJITHA LAGJET`)} ({currentNeighborhoods.length})</option>
                      {currentNeighborhoods.map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                 <button
                    onClick={() => setMapTheme(getNextMapTheme(mapTheme))}
                    className="flex-1 py-3 bg-white/10 border border-white/10 rounded-xl font-bold text-xs text-white tracking-wide hover:bg-white/20 transition flex items-center justify-center gap-2"
                  >
                    {mapTheme === 'dark' && <><Sun className="w-4 h-4" /> {t('map_theme_day').toUpperCase()}</>}
                    {mapTheme === 'light' && <><Layers className="w-4 h-4" />{dt(`SATELIT`)}</>}
                    {mapTheme === 'satellite' && <><Moon className="w-4 h-4" /> {t('map_theme_night').toUpperCase()}</>}
                  </button>
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="flex-1 py-3 bg-white/10 border border-white/10 rounded-xl font-bold text-xs text-white tracking-wide hover:bg-white/20 transition flex items-center justify-center gap-2"
                  >
                    {isFullscreen ? <><Minimize className="w-4 h-4" /> {t('map_minimize').toUpperCase()}</> : <><Maximize className="w-4 h-4" /> {t('map_fullscreen').toUpperCase()}</>}
                  </button>
              </div>

              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl">
                 {['map_all', 'map_urgent', 'map_critical'].map(f => (
                   <button 
                     key={f}
                     onClick={() => setActiveFilter(f)} 
                     className={cn(
                       "py-2 text-xs font-bold tracking-normal transition",
                       activeFilter === f ? 'bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] text-rose-600' : 'text-white hover:bg-white/10'
                     )}
                   >
                     {getUrgencyTranslation(f)}
                   </button>
                 ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Panel (Desktop) */}
        <div className={cn(
          "bg-slate-900/90 dark:bg-black/80 backdrop-blur-3xl border border-white/20 dark:border-white/10 p-5 pointer-events-auto flex items-center justify-between transition-all duration-300 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-[2rem]",
          isHudOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}>
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 bg-[#10B981] animate-pulse" />
             <span className="text-xs font-bold text-slate-300 tracking-wider">{t('active_reports')}</span>
           </div>
           <span className="text-2xl font-black text-white drop-shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">{filteredReports.length} <span className="text-neutral-500 dark:text-slate-400 text-xs font-bold tracking-normal">
             {t('nav_report')}
           </span></span>
        </div>
        
         {isHudOpen && (
          <div className="pointer-events-auto bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] p-2 border-2 border-slate-200/60 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {t('map_legend')}
            </div>
          </div>
        )}
      </div>

      {/* Backdrop Dimmer for Mobile Bottom Sheet */}
      <AnimatePresence>
        {isHudOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsHudOpen(false)}
            className="lg:hidden fixed inset-0 bg-slate-900/60 md:backdrop-blur-sm z-[10000] cursor-pointer"
          />
        )}
      </AnimatePresence>

      {/* Mobile Bottom Sheets / Filter Panel - Professional Style */}
      <div className={cn(
        "lg:hidden absolute inset-x-0 bottom-0 z-[10001] bg-slate-900/95 dark:bg-black/95 backdrop-blur-3xl border-t border-white/20 dark:border-white/10 rounded-t-[40px] transition-transform duration-500 pointer-events-auto shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.5)] max-h-[85dvh] overscroll-contain overflow-y-auto",
        selectedReportId && "hidden",
        isHudOpen ? "translate-y-0" : "translate-y-full"
      )}>
        <div className="p-6 md:p-8 pb-10">
          <div className="w-16 h-1.5 bg-white/20 rounded-full mx-auto mb-8" />
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-white tracking-tight text-xl flex items-center gap-2 drop-shadow-sm dark:shadow-none">
               <Filter className="w-5 h-5 text-rose-600" />
               {t('map_filters')}
            </h3>
            <button aria-label={dt('Mbyll')}  onClick={() => setIsHudOpen(false)} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors border border-white/10">
<X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="map-topic-filter-mobile" className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{dt('Tema e raportimit')}</label>
              <select
                id="map-topic-filter-mobile"
                value={selectedTopic}
                onChange={event => setSelectedTopic(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-white"
              >
                <option value="">{dt('Të gjitha temat')}</option>
                {REPORT_TOPICS.map(topic => <option key={topic.id} value={topic.id}>{getReportTopicValueLabel(topic.id)}</option>)}
              </select>
            </div>
            <div className="space-y-3">
               <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{t('map_urgency_level')}</label>
              <div className="grid grid-cols-3 gap-2">
                {['map_all', 'map_urgent', 'map_critical'].map(f => (
                  <button 
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={cn(
                      "py-3 font-bold text-xs sm:text-sm tracking-wide rounded-2xl transition active:scale-[0.98] w-full flex items-center justify-center gap-2 border",
                      activeFilter === f ? 'bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] text-black dark:text-white border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                    )}
                  >
                    {activeFilter === f && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                    {getUrgencyTranslation(f)}
                  </button>
                ))}
              </div>
            </div>

            {selectedMunicipality && currentNeighborhoods.length > 0 && (
              <div className="space-y-3 animate-in fade-in duration-300">
                <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />{dt(`Lagjet e Qytetit (`)}{selectedMunicipality})
                </label>
                <div className="relative">
                  <select 
                    value={selectedNeighborhood}
                    onChange={(e) => setSelectedNeighborhood(e.target.value)}
                    className="w-full px-4 py-3.5 bg-black/40 border border-white/10 rounded-2xl font-bold text-white text-sm outline-none cursor-pointer tracking-wide focus:border-white focus:ring-1 focus:ring-white transition appearance-none"
                  >
                    <option value="">{dt(`TË GJITHA LAGJET`)} ({currentNeighborhoods.length})</option>
                    {currentNeighborhoods.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{t('map_display')}</label>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button 
                  onClick={() => setMapTheme(getNextMapTheme(mapTheme))}
                  className="py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl font-bold text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 active:bg-white/20 transition-colors text-white"
                >
                  {mapTheme === 'dark' && <><Sun className="w-4 h-4 text-amber-500" /> {t('map_theme_day').toUpperCase()}</>}
                  {mapTheme === 'light' && <><Layers className="w-4 h-4 text-indigo-500" />{dt(`SATELIT`)}</>}
                  {mapTheme === 'satellite' && <><Moon className="w-4 h-4 text-slate-400" /> {t('map_theme_night').toUpperCase()}</>}
                </button>
                <button 
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl font-bold text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 active:bg-white/20 transition-colors text-white"
                >
                   {isFullscreen ? <><Minimize className="w-4 h-4 text-slate-400" /> {t('map_minimize').toUpperCase()}</> : <><Maximize className="w-4 h-4 text-slate-400" /> {t('map_fullscreen').toUpperCase()}</>}
                </button>
              </div>
            </div>

            <div className="bg-black/40 border border-white/10 p-5 rounded-[2rem] flex justify-between items-center text-white shadow-inner mt-6">
              <div className="flex items-center gap-3">
                <div className="relative flex w-3 h-3">
                  <div className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <div className="relative inline-flex rounded-full w-3 h-3 bg-emerald-500" />
                </div>
                <span className="text-xs font-bold tracking-widest uppercase text-slate-300">

                   {t('map_results_found').toUpperCase()}
                </span>
              </div>
              <span className="font-bold text-2xl md:text-3xl">{filteredReports.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Buttons Area (Mobile & Desktop) */}
      <div className={cn(
        "absolute right-4 z-[1500] flex flex-col gap-3 pointer-events-none transition-all duration-300",
        isFullscreen 
          ? "bottom-6"
          : isHudOpen
            ? "bottom-[52%] lg:bottom-24"
            : "bottom-28 lg:bottom-24"
      )}>
        <button 
          onClick={handleMyLocation}
          className="w-14 h-14 md:w-12 md:h-12 bg-white/95 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none flex items-center justify-center text-[var(--color-text)] dark:text-[var(--color-surface)] pointer-events-auto hover:bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:hover:bg-slate-800 active:scale-95 transition-all"
          title={t('map_my_location')}
        >
          <LocateFixed className="w-7 h-7 md:w-6 md:h-6" />
        </button>
        <button 
          onClick={() => setIsHeatmapView(!isHeatmapView)}
          className={cn(
            "w-14 h-14 md:w-12 md:h-12 border rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.16)] flex items-center justify-center pointer-events-auto active:scale-95 transition-all mt-3",
            isHeatmapView ? "bg-rose-600 border-rose-600 text-white shadow-rose-600/30" : "bg-white/95 backdrop-blur-md border-slate-200/60 dark:border-white/10 text-[var(--color-text)] dark:text-[var(--color-surface)] hover:bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:hover:bg-slate-800"
          )}
          title={t('map_heatmap')}
        >
          <Activity className="w-7 h-7 md:w-6 md:h-6" />
        </button>
        <button 
          onClick={handleResetMap}
          className="w-14 h-14 md:w-12 md:h-12 bg-white/95 backdrop-blur-md border border-slate-200/60 dark:border-white/10 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.16)] flex items-center justify-center text-[var(--color-text)] dark:text-[var(--color-surface)] pointer-events-auto hover:bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:hover:bg-slate-800 active:scale-95 transition-all mt-3"
          title={t('map_reset')}
        >
          <RotateCcw className="w-7 h-7 md:w-6 md:h-6" />
        </button>
      </div>

      {/* Floating Center Ad Banner */}
      {isAdVisible && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 pointer-events-none bg-black/40 md:backdrop-blur-sm">
          <div className="pointer-events-auto relative bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col">
            <div className="p-3 bg-neutral-50 dark:bg-slate-900/50 border-b border-neutral-100 flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                 <span className="text-xs font-bold tracking-wide text-[var(--color-text-muted)]">
                    {t('map_ad_space')}
                 </span>
              </div>
              <button aria-label={dt('Mbyll')} 
                onClick={() => setIsAdVisible(false)}
                className="text-slate-400 hover:text-slate-700 dark:text-slate-300 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] hover:bg-neutral-100 p-1.5 rounded-2xl border border-transparent hover:border-slate-200/60 dark:border-white/10 transition-colors"
                title={t('map_close_ad')}
              >
<X className="w-5 h-5" />
              </button>
            </div>
             <div className="p-4 sm:p-6 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] flex-1">
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <MapPin className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium">{dt('Harta e raportimeve të gjithë Kosovës')}</p>
                  <p className="text-xs mt-1">{dt('Kliko në ndonjë gjashtë për të shfaqur detajet')}</p>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Map Content */}
      <div data-tour="map-canvas" className="flex-1 w-full bg-slate-900 z-0 relative min-h-[60vh] md:min-h-[500px]">
        <div className="absolute inset-0">
          <MapContainer
            center={mapCenter}
            zoom={13}
            scrollWheelZoom={true}
            className="w-full h-full z-0"
            style={{ background: '#e2e8f0' }}
            zoomControl={false}
            maxBounds={KOSOVO_BOUNDS}
            maxBoundsViscosity={0.9}
            minZoom={7}
            maxZoom={18}
          >
          <ZoomControl position="bottomright" />
          <MapUpdater
            center={mapCenter}
            zoom={mapZoom}
            resizeKey={`${isHudOpen ? 'hud-open' : 'hud-closed'}-${isFullscreen ? 'fullscreen' : 'inline'}`}
          />
          {/*
            `key` forces a remount: Leaflet only applies `className` when the layer is
            created, so switching day/night would otherwise keep the night filter applied.
          */}
          <TileLayer
            key={mapTheme}
            url={MAP_TILE_LAYERS[mapTheme].url}
            className={MAP_TILE_LAYERS[mapTheme].className}
            attribution={MAP_TILE_LAYERS[mapTheme].attribution}
          />

          {isHeatmapView ? (
            <HeatmapLayer points={heatmapPoints} />
          ) : (
            <MarkerClusterGroup chunkedLoading>
              {mappableReports.map(report => {
                const lat = Number(report.location?.lat);
                const lng = Number(report.location?.lng);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

                return (
                  <Marker
                    key={report.id}
                    position={[lat, lng]}
                    icon={createCustomIcon(report.urgency)}
                    eventHandlers={{ click: () => setActivePreviewReport(report) }}
                  />
                );
              })}
            </MarkerClusterGroup>
          )}
        </MapContainer>
        
        {/* Custom Marker Popup Card */}
        <AnimatePresence>
          {activePreviewReport && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="absolute bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 lg:left-auto lg:-translate-x-0 lg:right-6 z-[1000] w-[calc(100%-2rem)] lg:w-85 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10"
            >
              <button 
                onClick={() => setActivePreviewReport(null)}
                className="absolute top-2 right-2 bg-black/40 hover:bg-black/60 text-white p-1.5 rounded-full z-10 transition-colors backdrop-blur-sm"
              >
                <X className="w-4 h-4" />
              </button>
              
              {activePreviewReport.images?.length > 0 && (
                <div className="relative h-32 w-full">
                  <img src={activePreviewReport.images[0]} className="w-full h-full object-cover" alt={activePreviewReport.title} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded text-xs font-bold tracking-wide text-white backdrop-blur-md bg-white/20 border border-white/30">
                    {dt(activePreviewReport.category)}
                  </span>
                </div>
              )}
              
              <div className="p-4">
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider text-white",
                    activePreviewReport.urgency === 'Kritike' ? 'bg-rose-600 shadow-sm dark:shadow-none shadow-rose-600/10' :
                    activePreviewReport.urgency === 'E lartë' ? 'bg-orange-500 shadow-sm dark:shadow-none shadow-orange-500/10' :
                    activePreviewReport.urgency === 'Mesatare' ? 'bg-amber-500 shadow-sm dark:shadow-none shadow-amber-500/10' :
                    'bg-emerald-600 shadow-sm dark:shadow-none shadow-emerald-600/10'
                  )}>
                    {getUrgencyLabel(activePreviewReport.urgency)}
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider",
                    activePreviewReport.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                  )}>
                    {activePreviewReport.status === 'Resolved' ? t('dash_resolved') : "Në Proces"}
                  </span>
                </div>
                <h3 className="font-bold text-[var(--color-text)] dark:text-[var(--color-surface)] leading-tight mb-2 text-base line-clamp-2">{activePreviewReport.title}</h3>
                {getReportTopic(activePreviewReport) && (
                  <p className="mb-2 inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200">
                    {getReportTopic(activePreviewReport)?.icon} {getReportTopic(activePreviewReport) && getReportTopicValueLabel(getReportTopic(activePreviewReport)!.id)}
                  </p>
                )}
                <div className="flex flex-col gap-1.5 mb-4">
                  <p className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> {formatDistanceToNow(new Date(activePreviewReport.createdAt), { addSuffix: true, locale: sq })}{dt(`nga`)} <span className="text-[var(--color-text)] dark:text-[var(--color-surface)] font-semibold">{activePreviewReport.authorName}</span>
                  </p>
                  <p className="text-xs font-medium text-[var(--color-text-muted)] tracking-wide flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" /> <span className="truncate">{activePreviewReport.location?.address || 'Nuk ka adresë'}</span>
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedReportId(activePreviewReport.id);
                    setActivePreviewReport(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-sm dark:shadow-none hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none"
                >
                  <Activity className="w-4 h-4" />
                  {t('map_details')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modern Map Legend */}
        <div className={cn("absolute bottom-6 left-6 z-[1000] hidden md:flex flex-col gap-3 bg-slate-900/95 backdrop-blur-xl p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/15 animate-in slide-in-from-bottom-4 duration-500 min-w-[200px]", selectedReportId && "hidden")}>
          <div className="text-[10px] font-black tracking-widest text-rose-400 uppercase mb-1.5 border-b border-white/10 pb-1">{t('map_urgency_level')}</div>
          <p className="max-w-56 text-[11px] leading-relaxed text-slate-400">{dt('Numri në rreth tregon raportimet e grupuara në atë zonë. Kliko rrethin për t’i parë më afër.')}</p>
          {Object.entries(urgencyColors).map(([level, colorClass]) => {
            const isActive = legendFilters[level] !== false;
            return (
             <button 
               key={level} 
               onClick={() => setLegendFilters(prev => ({...prev, [level]: !isActive}))}
               className={`flex items-center justify-between w-full text-left transition-all py-1 ${!isActive ? 'opacity-30 grayscale' : 'opacity-100 hover:translate-x-1'}`}
             >
               <span className="text-xs font-extrabold text-slate-200">{getUrgencyLabel(level)}</span>
               <div className={`relative w-4 h-4 rounded-full border-2 border-slate-900 shadow-sm dark:shadow-none flex items-center justify-center ${colorClass}`}>
                  <div className="w-1 h-1 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] rounded-full"></div>
               </div>
             </button>
            )
          })}
        </div>
        </div>
      </div>

      {selectedReportId && (() => {
        const selectedReport = reports.find(r => r.id === selectedReportId);
        if (!selectedReport) return null;
        return (
          <ReportDetailModal
            report={selectedReport}
            onClose={() => setSelectedReportId(null)}
          />
        );
      })()}
    </motion.div>
  );
}

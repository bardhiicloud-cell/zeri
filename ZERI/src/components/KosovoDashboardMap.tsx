import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Minus, MapPin, ArrowRight, Filter, Sun, Moon, Satellite, RotateCcw
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import '../lib/leafletLifecycle';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Report } from '../types';
import { cn } from '../lib/utils';
import { useStore } from '../lib/store';
import { KOSOVO_MUNICIPALITIES, KOSOVO_BOUNDS, MUNICIPALITY_COORDINATES } from '../lib/constants';
import {
  KOSOVO_OVERVIEW_CENTER,
  KOSOVO_OVERVIEW_ZOOM,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_TILE_LAYERS,
  MAP_ZOOM_SNAP,
} from '../lib/mapTiles';
import { configureDefaultLeafletIcons } from './map/mapMarkerIcons';

import { dt } from '@/src/lib/dt';
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

interface KosovoDashboardMapProps {
  reports: Report[];
  onNavigateToMap?: () => void;
  selectedMunicipality?: string;
  onMunicipalityChange?: (muni: string) => void;
}

// Custom Leaflet Circle Pin generator matching screenshot colors exactly
const createPinIcon = (status: string) => {
  const colors: Record<string, string> = {
    'Të raportuar': '#2563eb', // Blue
    'Në trajtim': '#f59e0b',   // Amber
    'Të zgjidhur': '#10b981',  // Emerald
    'Urgjent': '#ef4444'       // Red
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
function MapViewController({
  selectedMunicipality,
  zoomLevel
}: {
  selectedMunicipality: string;
  zoomLevel: number;
}) {
  const map = useMap();
  const previousMunicipality = useRef(selectedMunicipality);
  const previousZoom = useRef(zoomLevel);

  useEffect(() => {
    if (previousMunicipality.current === selectedMunicipality) return;
    previousMunicipality.current = selectedMunicipality;

    const municipalityCenter = selectedMunicipality
      ? MUNICIPALITY_COORDINATES[selectedMunicipality]
      : undefined;

    if (municipalityCenter) {
      map.flyTo(municipalityCenter, Math.max(zoomLevel, MUNICIPALITY_ZOOM), { duration: 1 });
    } else {
      map.flyTo(KOSOVO_OVERVIEW_CENTER, KOSOVO_OVERVIEW_ZOOM, { duration: 1 });
    }
  }, [map, selectedMunicipality, zoomLevel]);

  useEffect(() => {
    if (previousZoom.current === zoomLevel) return;
    previousZoom.current = zoomLevel;
    map.setZoom(zoomLevel);
  }, [map, zoomLevel]);

  return null;
}

// Marker component with auto-open on the default active report (#ZQ-4587 in Prishtina)
function ReportMarker({ 
  point, 
  isDefaultOpen, 
  onNavigate 
}: { 
  point: any; 
  isDefaultOpen: boolean; 
  onNavigate: () => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    if (isDefaultOpen && markerRef.current) {
      const timer = setTimeout(() => {
        try {
          markerRef.current?.openPopup();
        } catch (e) {
          // ignore
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isDefaultOpen]);

  return (
    <Marker
      ref={markerRef}
      position={[point.lat, point.lng]}
      icon={createPinIcon(point.status)}
    >
      <Popup closeButton={false} className="dashboard-popup-clean">
        <div 
          onClick={onNavigate}
          className="text-left p-1 w-44 cursor-pointer select-none font-sans"
        >
          <div className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 mb-0.5">
            {point.code}
          </div>

          <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight mb-0.5 truncate">
            {point.category}
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
            {point.municipality}
          </div>

          <div className="mb-1">
            <span className={cn(
              "inline-block px-2 py-0.5 rounded text-[10px] font-semibold border",
              point.status === 'Në trajtim' && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60",
              point.status === 'Të raportuar' && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60",
              point.status === 'Të zgjidhur' && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60",
              point.status === 'Urgjent' && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60"
            )}>
              {point.status}
            </span>
          </div>

          <div className="text-[10px] text-slate-400 mb-1.5">
            {point.date}
          </div>

          <div className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1">
            <span>{dt('Shiko raportin')}</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export function KosovoDashboardMap({ 
  reports, 
  onNavigateToMap,
  selectedMunicipality = '',
  onMunicipalityChange
}: KosovoDashboardMapProps) {
  const navigate = useNavigate();

  // Filters state matching screenshot
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('all');
  const [currentZoom, setCurrentZoom] = useState<number>(KOSOVO_OVERVIEW_ZOOM);
  const [tileMode, setTileMode] = useState<'dark' | 'light' | 'satellite'>('dark');
  const siteCategories = useStore(state => state.categories);

  const handleGoToMap = () => {
    if (onNavigateToMap) {
      onNavigateToMap();
    } else {
      navigate('/harta');
    }
  };

  const handleReset = () => {
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSelectedUrgency('all');
    setCurrentZoom(KOSOVO_OVERVIEW_ZOOM);
    setTileMode('dark');
    // Clearing the filter must clear the *global* scope too. Previously this
    // reset only the chip row, so the page showed "all municipalities" while
    // the sidebar and the rest of the site stayed on the previous one.
    onMunicipalityChange?.('');
  };

  // Merge live store reports that have location coordinates
  const allMapPoints = useMemo(() => {
    const list: any[] = [];

    reports.forEach((rep, idx) => {
      if (rep.status === 'Pending Review' || rep.status === 'Rejected' || rep.status === 'Draft') return;
      let lat = rep.location?.lat;
      let lng = rep.location?.lng;
      const muni = rep.location?.municipality || 'Prishtinë';

      if (!lat || !lng) {
        const fallback = MUNICIPALITY_COORDINATES[muni] || [42.6629, 21.1655];
        lat = fallback[0] + (((idx * 13) % 7) - 3.5) * 0.005;
        lng = fallback[1] + (((idx * 17) % 7) - 3.5) * 0.005;
      }

      let statusType: 'Të raportuar' | 'Në trajtim' | 'Të zgjidhur' | 'Urgjent' = 'Në trajtim';
      if (rep.urgency === 'Kritike') statusType = 'Urgjent';
      else if (rep.status === 'Resolved') statusType = 'Të zgjidhur';
      else if (rep.status === 'Approved' || rep.status === 'In Progress') statusType = 'Në trajtim';
      else statusType = 'Të raportuar';

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
      if (selectedCategory !== 'all' && pt.category !== selectedCategory) return false;
      if (selectedStatus !== 'all' && pt.status !== selectedStatus) return false;
      if (selectedUrgency !== 'all' && pt.urgency !== selectedUrgency) return false;
      if (selectedMunicipality && selectedMunicipality !== 'Të gjitha Komunat' && selectedMunicipality !== 'Të gjitha' && selectedMunicipality !== '') {
        if (pt.municipality.toLowerCase() !== selectedMunicipality.toLowerCase()) return false;
      }
      return true;
    });
  }, [allMapPoints, selectedCategory, selectedStatus, selectedUrgency, selectedMunicipality]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs overflow-hidden">
      
      {/* 1. Header Row (100% matching screenshot) */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span>{dt('Harta e Raportimeve')}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {dt('Shikoni problemet e raportuara në të gjithë Kosovën')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleReset}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{dt('Rikthe')}</span>
          </button>
          <button
            onClick={handleGoToMap}
            className="min-h-10 md:min-h-0 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <span>{dt('Harta e plotë')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Interactive Body Grid (Left: Filters & Legend | Right: Authentic Leaflet World Map of Kosovo) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
        
        {/* Left Sub-Column: Dropdown Selectors & Legend */}
        <div className="dashboard-map-filters md:col-span-4 lg:col-span-3 p-4 sm:p-5 border-b md:border-b-0 md:border-r border-slate-100 dark:border-white/5 flex flex-col justify-between space-y-4">
          
          <div className="space-y-3">
            {/* Kategoria */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{dt('Kategoria')}</label>
              <div className="relative">
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full appearance-none text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg pl-3 pr-6 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer shadow-2xs"
                >
                  <option value="all">{dt('Të gjitha kategoritë')}</option>
                  {categoryOptions.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Statusi */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{dt('Statusi')}</label>
              <div className="relative">
                <select 
                  value={selectedStatus} 
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full appearance-none text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg pl-3 pr-6 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer shadow-2xs"
                >
                  <option value="all">{dt('Të gjitha statuset')}</option>
                  <option value="Të raportuar">{dt('Të raportuar')}</option>
                  <option value="Në trajtim">{dt('Në trajtim')}</option>
                  <option value="Të zgjidhur">{dt('Të zgjidhur')}</option>
                  <option value="Urgjent">Urgjent</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Komuna */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{dt('Komuna')}</label>
              <div className="relative">
                <select 
                  value={selectedMunicipality} 
                  onChange={(e) => onMunicipalityChange && onMunicipalityChange(e.target.value)}
                  className="w-full appearance-none text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg pl-3 pr-6 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer shadow-2xs"
                >
                  <option value="">{dt('Të gjitha komunat')}</option>
                  {KOSOVO_MUNICIPALITIES.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Urgjenca */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{dt('Urgjenca')}</label>
              <div className="relative">
                <select 
                  value={selectedUrgency} 
                  onChange={(e) => setSelectedUrgency(e.target.value)}
                  className="w-full appearance-none text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg pl-3 pr-6 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer shadow-2xs"
                >
                  <option value="all">{dt('Të gjitha nivelet')}</option>
                  <option value="Kritike">{dt('Kritike')}</option>
                  <option value="E lartë">{dt('E lartë')}</option>
                  <option value="Mesatare">{dt('Mesatare')}</option>
                  <option value="E ulët">{dt('E ulët')}</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Filtro Button (solid blue with filter icon) */}
            <button 
              type="button"
              onClick={() => {}}
              className="w-full py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer mt-2"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtro</span>
            </button>
          </div>

          {/* Stacked Legend Items (100% identical to screenshot) */}
          <div className="space-y-2 pt-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] shrink-0" />
              <span>{dt('Të raportuar')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shrink-0" />
              <span>{dt('Në trajtim')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shrink-0" />
              <span>{dt('Të zgjidhur')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shrink-0" />
              <span>Urgjent</span>
            </div>
          </div>

        </div>

         {/* Right Sub-Column: Authentic Leaflet Map Container */}
         <div className="md:col-span-8 lg:col-span-9 relative h-[340px] sm:h-[380px] lg:h-[400px] bg-slate-200 dark:bg-[#0c162c] overflow-hidden leaflet-host">

          {/* Top-Left Zoom Controls */}
          <div className="absolute top-3 left-3 z-[1000] flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
            <button 
              type="button" 
              onClick={() => setCurrentZoom(z => Math.min(z + ZOOM_STEP, MAP_MAX_ZOOM))}
              className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title={dt('Zmadho')}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <div className="h-[1px] bg-slate-200 dark:bg-white/10" />
            <button 
              type="button" 
              onClick={() => setCurrentZoom(z => Math.max(z - ZOOM_STEP, MAP_MIN_ZOOM))}
              className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title={dt('Zvogëlo')}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Professional map mode switcher: light, night and satellite. */}
          <div className="absolute top-3 right-3 z-[1000] flex items-center gap-0.5 bg-slate-950/90 backdrop-blur-sm p-1 rounded-lg shadow-lg border border-white/15">
            <button type="button" onClick={() => setTileMode('light')} className={cn('w-7 h-7 rounded-md flex items-center justify-center', tileMode === 'light' ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white')} title="Pamje ditore">
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setTileMode('dark')} className={cn('w-7 h-7 rounded-md flex items-center justify-center', tileMode === 'dark' ? 'bg-blue-600 text-white' : 'text-white/70 hover:text-white')} title="Night mode">
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setTileMode('satellite')} className={cn('w-7 h-7 rounded-md flex items-center justify-center', tileMode === 'satellite' ? 'bg-emerald-500 text-white' : 'text-white/70 hover:text-white')} title="Satelit">
              <Satellite className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bottom-Left Scale Bar */}
          <div className="absolute bottom-3 left-3 z-[1000] text-[9px] font-mono text-slate-600 dark:text-slate-400 font-semibold flex flex-col gap-0.5 pointer-events-none bg-white/80 dark:bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-white/10 backdrop-blur-xs">
            <div className="flex justify-between w-20 px-0.5">
              <span>0</span>
              <span>25</span>
              <span>50 km</span>
            </div>
            <div className="w-20 h-1 bg-slate-300 dark:bg-slate-600 rounded-xs flex border border-slate-400/50">
              <div className="w-1/2 bg-slate-800 dark:bg-slate-200" />
              <div className="w-1/2 bg-white dark:bg-slate-800" />
            </div>
          </div>

          {/* OSM attribution is mandatory; kept compact so the card layout is preserved. */}
          <div className="absolute bottom-3 right-3 z-[1000] pointer-events-none text-[8px] font-medium text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-white/10">
            &copy; OpenStreetMap
          </div>

          {/* Real Leaflet Map of Kosovo */}
          <MapContainer
            center={KOSOVO_OVERVIEW_CENTER}
            zoom={currentZoom}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
            scrollWheelZoom={false}
            attributionControl={false}
            maxBounds={KOSOVO_BOUNDS}
            maxBoundsViscosity={1}
            zoomSnap={MAP_ZOOM_SNAP}
            minZoom={MAP_MIN_ZOOM}
            maxZoom={MAP_MAX_ZOOM}
          >
            {/*
              `key` forces a remount: Leaflet applies `className` only at creation time,
              so without it the night filter would stick after switching back to day.
            */}
            <TileLayer
              key={tileMode}
              url={MAP_TILE_LAYERS[tileMode].url}
              className={MAP_TILE_LAYERS[tileMode].className}
            />
            <MapSizeController />

            <MapViewController
              selectedMunicipality={selectedMunicipality}
              zoomLevel={currentZoom}
            />

            <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
              {filteredPoints.map((pt) => (
                <ReportMarker
                  key={pt.id}
                  point={pt}
                  isDefaultOpen={pt.code === 'ZQ-4587'}
                  onNavigate={handleGoToMap}
                />
              ))}
            </MarkerClusterGroup>
          </MapContainer>

        </div>

      </div>

    </div>
  );
}

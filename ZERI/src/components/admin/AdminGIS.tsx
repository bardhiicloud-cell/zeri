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
import { getReportTopic, getReportTopicValueLabel, REPORT_TOPICS } from '../../lib/reportTopics';

// Fix for default Leaflet icon in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const urgencyColors: Record<string, string> = {
  'Kritike': 'bg-red-500 shadow-red-500/50',
  'E lartë': 'bg-orange-500 shadow-orange-500/50',
  'Mesatare': 'bg-yellow-500 shadow-yellow-500/50',
  'E ulët': 'bg-green-500 shadow-green-500/50',
  'Baxhë': 'bg-blue-500 shadow-blue-500/50',
};

const urgencyStrokes: Record<string, string> = {
  'Kritike': '#ef4444',
  'E lartë': '#f97316',
  'Mesatare': '#eab308',
  'E ulët': '#22c55e',
  'Baxhë': '#3b82f6',
};

const createCustomIcon = (urgency: string) => {
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

function MapUpdater({ mapCenter }: { mapCenter: [number, number] }) {
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
  const [selectedTopic, setSelectedTopic] = useState('');
  const [mapTheme, setMapTheme] = useState<'light' | 'dark'>('dark');

  const defaultPosition: [number, number] = [42.6629, 21.1655]; // Prishtina center

  let filteredReports = [...reports];
  if (selectedMunicipality) {
    filteredReports = filteredReports.filter(r => r.location?.municipality === selectedMunicipality);
  }
  if (selectedTopic) filteredReports = filteredReports.filter(report => getReportTopic(report)?.id === selectedTopic);

  if (activeFilter === 'Kritike') {
    filteredReports = filteredReports.filter(r => r.urgency === 'Kritike');
  } else if (activeFilter === 'Urgjente') {
    filteredReports = filteredReports.filter(r => r.urgency === 'Kritike' || r.urgency === 'E lartë');
  } else if (activeFilter === 'Në Proces') {
    filteredReports = filteredReports.filter(r => r.status === 'Assigned' || r.status === 'In Progress');
  } else if (activeFilter === 'Zgjidhur') {
    filteredReports = filteredReports.filter(r => r.status === 'Resolved');
  }

  const mapCenter = selectedMunicipality && MUNICIPALITY_COORDINATES[selectedMunicipality]
    ? MUNICIPALITY_COORDINATES[selectedMunicipality]
    : defaultPosition;

  return (
    <div className="h-[calc(100vh-220px)] w-full relative flex flex-col font-sans overflow-hidden bg-slate-900 border-2 border-slate-200/60 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] dark:shadow-none transition duration-300 rounded-xl">
      
      {/* Top Bar for NOC */}
      <div className="bg-slate-900 p-4 flex flex-col md:flex-row justify-between items-center z-[400] relative border-b-2 border-blue-500/30 gap-4">
        <div className="flex items-center gap-4">
           <div className="w-10 h-10 border-2 border-blue-500/50 bg-[#c71f16] flex items-center justify-center animate-pulse">
             <Radio className="w-5 h-5 text-white" />
           </div>
           <div>
             <h2 className="text-white font-bold tracking-wide text-lg leading-none">{dt(`NOC GIS Engine`)}</h2>
             <p className="text-blue-400 text-xs font-bold tracking-wide mt-1">{dt(`Live Sentinel Operations`)}</p>
           </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
            <select 
              value={selectedMunicipality}
              onChange={(e) => setSelectedMunicipality(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#040814] border border-blue-500/50 text-white text-xs font-bold tracking-wide outline-none focus:border-blue-400 appearance-none cursor-pointer"
            >
              <option value="">{dt(`TERRITORI NACIONAL`)}</option>
              {KOSOVO_MUNICIPALITIES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <select
            value={selectedTopic}
            onChange={event => setSelectedTopic(event.target.value)}
            aria-label={dt('Filtro hartën sipas temës')}
            className="min-w-40 flex-1 border border-blue-500/50 bg-[#040814] px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-400 md:w-56"
          >
            <option value="">{dt('Të gjitha temat')}</option>
            {REPORT_TOPICS.map(topic => <option key={topic.id} value={topic.id}>{getReportTopicValueLabel(topic.id)}</option>)}
          </select>
          <button
            onClick={() => setMapTheme(mapTheme === 'light' ? 'dark' : 'light')}
            className="flex-none px-4 py-2 bg-[#040814] border border-blue-500/50 text-white flex items-center justify-center hover:bg-blue-900/50 transition-colors"
            title={dt(`Ndrysho Temën e Hartës`)}
          >
            {mapTheme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          
          <div className="flex gap-1 text-xs uppercase font-bold tracking-widest bg-[#040814] p-1 border border-blue-500/50 overflow-x-auto w-full md:w-auto">
             {['Të gjitha', 'Kritike', 'Urgjente', 'Në Proces', 'Zgjidhur'].map(f => (
               <button 
                 key={f}
                 onClick={() => setActiveFilter(f)}
                 className={cn(
                   "px-4 py-2 transition-colors whitespace-nowrap",
                   activeFilter === f ? "bg-blue-600 text-white" : "text-blue-500 hover:bg-blue-900/50 hover:text-white"
                 )}
               >
                 {dt(f)}
               </button>
             ))}
          </div>
        </div>
      </div>

      <div className="flex-1 w-full bg-[\#040814] relative min-h-[500px] h-full">
        <MapContainer center={mapCenter} zoom={13} scrollWheelZoom={true} className="w-full h-full" zoomControl={false} maxBounds={KOSOVO_BOUNDS}>
          <ZoomControl position="bottomright" />
          <MapUpdater mapCenter={mapCenter} />
          
          <TileLayer
            attribution=""
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className={mapTheme === 'dark' ? 'map-tiles-dark' : ''}
          />
          
          {filteredReports.filter(r => r.location?.lat && r.location?.lng).map(report => (
            <React.Fragment key={report.id}>
               <Marker 
                 position={[report.location.lat, report.location.lng]}
                 icon={createCustomIcon(report.urgency)}
               >
                 <Popup className="custom-popup rounded-xl border-0">
                   <style>{`
                     .leaflet-popup-content-wrapper { padding: 0; border: 2px solid #ef4444; border-radius: 0; background: #0f172a; color: white; }
                     .leaflet-popup-content { margin: 0; width: 300px !important; }
                     .leaflet-popup-tip { border-top: 10px solid #ef4444; }
                   `}</style>
                   <div className="w-full">
                     <div className="p-4 bg-slate-900">
                       <div className="flex justify-between items-start mb-2 border-b border-red-500/30 pb-2">
                         <span className="text-xs font-bold tracking-wide text-red-400">{dt(`ID: #`)}{report.id.substring(0, 8)}</span>
                         <span className={cn("text-xs font-bold tracking-wide px-2 py-0.5", 
                            report.status === 'Resolved' ? "bg-emerald-500/20 text-emerald-400" :
                            report.status === 'Pending Review' ? "bg-amber-500/20 text-amber-400" : 
                            "bg-blue-500/20 text-blue-400"
                         )}>
                           {dt(report.status)}
                         </span>
                       </div>
                       
                       <h3 className="font-bold text-white leading-tight mb-2 text-sm">{report.title}</h3>
                       
                       <div className="space-y-1 mb-4 border-b border-blue-500/20 pb-4">
                         <p className="text-xs font-bold text-neutral-500 dark:text-slate-400 tracking-wide flex justify-between">
                           <span>{dt('Tema')}</span> <span className="text-white">{getReportTopic(report) ? `${getReportTopic(report)?.icon} ${getReportTopic(report) && getReportTopicValueLabel(getReportTopic(report)!.id)}` : dt('Pa temë')} · {dt(report.category)}</span>
                         </p>
                         <p className="text-xs font-bold text-neutral-500 dark:text-slate-400 tracking-wide flex justify-between">
                           <span>{dt(`Urgjenca:`)}</span> <span className={cn("text-white", report.urgency === 'Kritike' ? 'text-red-400' : '')}>{dt(report.urgency)}</span>
                         </p>
                         <p className="text-xs font-bold text-neutral-500 dark:text-slate-400 tracking-wide flex justify-between">
                           <span>{dt(`Identifikuesi:`)}</span> <span className="text-white">{report.authorName}</span>
                         </p>
                       </div>
                       <div className="text-xs font-bold tracking-wide text-slate-700 dark:text-slate-200 dark:text-slate-300 flex items-center justify-between">
                          <span>{formatDistanceToNow(new Date(report.createdAt), { addSuffix: true, locale: sq })}</span>
                          {report.urgency === 'Kritike' && <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />}
                       </div>
                     </div>
                   </div>
                 </Popup>
               </Marker>

               {/* Draw response radius for Critical/High issues */}
               {(report.urgency === 'Kritike' || report.urgency === 'E lartë') && (
                 <Circle 
                   center={[report.location.lat, report.location.lng]} 
                   radius={300} // 300 meters response radius indication
                   pathOptions={{ 
                     color: urgencyStrokes[report.urgency] || '#3b82f6', 
                     fillColor: urgencyStrokes[report.urgency] || '#3b82f6', 
                     fillOpacity: 0.1, 
                     weight: 1, 
                     dashArray: '4' 
                   }}
                 />
               )}
            </React.Fragment>
          ))}
        </MapContainer>

        {/* Floating Side Info Panel inside Map */}
        <div className="absolute top-4 right-4 z-[400] w-48 space-y-2 pointer-events-none hidden md:block">
           <div className="bg-slate-900/90 border border-blue-500/50 p-3 pointer-events-auto backdrop-blur-md">
              <p className="text-xs text-blue-400 font-bold tracking-wide mb-2 border-b border-blue-500/30 pb-1">{dt(`Metrikat e Zonës`)}</p>
              <div className="space-y-2">
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-500 dark:text-slate-400">{dt(`Totali Detektuar`)}</span>
                    <span className="font-bold text-white">{filteredReports.length}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-500 dark:text-slate-400">{dt(`Rrezik i Lartë`)}</span>
                    <span className="font-bold text-red-400">{filteredReports.filter(r => r.urgency === 'Kritike').length}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-500 dark:text-slate-400">{dt(`Përditësimi`)}</span>
                    <span className="font-bold text-emerald-400 flex items-center gap-1"><Zap className="w-3 h-3" />{dt(`LIVE`)}</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

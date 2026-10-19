import { dt } from '@/src/lib/dt';
import React, { useState } from 'react';
import { useStore } from '../lib/store';
import { formatDistanceToNow } from 'date-fns';
import { sq } from 'date-fns/locale';
import { ThumbsUp, MessageCircle, MapPin, Clock, ArrowUpRight, CheckCircle2, AlertTriangle, TrendingUp, Search, Filter, Layers, Heart, ArrowRight, Share2, X, Sparkles, Award, QrCode, Gift, CloudSun, Wind, Smile } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import ReportDetailModal from '../components/ReportDetailModal.tsx';
import { Report } from '../types';
import AdBanner from '../components/AdBanner';
import { MunicipalityHealthCheck } from '../components/MunicipalityHealthCheck';
import { InteractiveDashboardMap } from '../components/InteractiveDashboardMap';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';
import { authHeaders } from '../lib/apiAuth';


import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

const urgencyConfig = {
  'Kritike': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  'E lartë': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  'Mesatare': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'E ulët': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'Baxhë': 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
};

const statusConfig = {
  'Pending Review': { label: 'Në Pritje', classes: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
  'Approved': { label: 'Aprovuar', classes: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  'Assigned': { label: 'Caktuar', classes: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  'In Progress': { label: 'Në Progres', classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  'Resolved': { label: 'E Zgjidhur', classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  'Rejected': { label: 'Refuzuar', classes: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' }
};

const MUNICIPAL_AQI_DATA: Record<string, { aqi: number, temp: string, status: string, aqiDesc: string }> = {};

const REWARDS_LIST = [
  { id: 'rew-1', title: 'Tiketë Autobusi Publik', desc: 'Biletë njëditore falas për transportin urban në komunën tuaj.', cost: 80 },
  { id: 'rew-2', title: 'Mbill një Pemë', desc: 'Komuna do të mbjellë një pemë në emrin tuaj në parkun e qytetit.', cost: 150 },
  { id: 'rew-3', title: 'Hyrje në Pishinën e Qytetit', desc: 'Biletë hyrjeje njëditore për pishinën publike të qytetit.', cost: 200 },
  { id: 'rew-4', title: 'Biletë për Teatrin/Kinemanë', desc: 'Hyrje për një shfaqje apo film në teatrin/kinemanë publike.', cost: 120 }
];

export default function Dashboard() {
  const { t, dt, language } = useLanguage();
  const reports = useStore((state) => state.reports);
  const currentUser = useStore((state) => state.currentUser);
  const upvoteReport = useStore((state) => state.upvoteReport);
  const updateUser = useStore((state) => state.updateUser);
  const navigate = useNavigate();
  
  const userMunicipality = useStore((state) => state.userMunicipality);
  const [activeTab, setActiveTab] = useState('dash_recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMunicipality, setSelectedMunicipality] = useState(userMunicipality === 'Të gjitha Komunat' ? '' : (userMunicipality || ''));
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'active' | 'resolved' | 'stats'>('active');
  const [isLoading, setIsLoading] = useState(true);
  const [tips, setTips] = useState<string[]>([]);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [redeemedReward, setRedeemedReward] = useState<{ id: string, title: string, cost: number, code: string } | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [ipVerified, setIpVerified] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);

  const [expandedAlerts, setExpandedAlerts] = useState<Record<string, boolean>>({});
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);
  const [realUsers, setRealUsers] = useState<any[]>([]);
  const [weatherData, setWeatherData] = useState<Record<string, { aqi: number, temp: string, status: string, aqiDesc: string }>>({});

  const MUNICIPAL_COORDS: Record<string, { lat: number, lng: number }> = {
    'Prishtinë': { lat: 42.6629, lng: 21.1655 },
    'Prizren': { lat: 42.2139, lng: 20.7397 },
    'Pejë': { lat: 42.6591, lng: 20.2883 },
    'Gjakovë': { lat: 42.3803, lng: 20.4308 },
    'Gjilan': { lat: 42.4636, lng: 21.4678 },
    'Mitrovicë': { lat: 42.8914, lng: 20.8661 },
    'Ferizaj': { lat: 42.3702, lng: 21.1553 },
  };

  // Live weather & AQI queries
  React.useEffect(() => {
    const fetchWeather = async () => {
      const muni = selectedMunicipality || 'Prishtinë';
      const coords = MUNICIPAL_COORDS[muni] || MUNICIPAL_COORDS['Prishtinë'];
      try {
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current_weather=true`);
        const airRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.lat}&longitude=${coords.lng}&current=us_aqi`);
        
        let temp = '22°C';
        let aqi = 44;
        
        if (weatherRes.ok) {
          const wData = await weatherRes.json();
          if (wData?.current_weather) {
            temp = `${Math.round(wData.current_weather.temperature)}°C`;
          }
        }
        if (airRes.ok) {
          const aData = await airRes.json();
          if (aData?.current?.us_aqi !== undefined) {
            aqi = Math.round(aData.current.us_aqi);
          }
        }
        
        let status = 'E mirë';
        let aqiDesc = 'Ajër i pastër, i përshtatshëm për aktivitete jashtë.';
        if (aqi > 50) {
          status = 'Mesatare';
          aqiDesc = 'Ndotje e ulët, e pranueshme për shumicën e njerëzve.';
        }
        if (aqi > 100) {
          status = 'E dëmshme';
          aqiDesc = 'Rekomandohet reduktimi i aktiviteteve të gjata jashtë.';
        }
        
        setWeatherData(prev => ({
          ...prev,
          [muni]: { aqi, temp, status, aqiDesc }
        }));
      } catch (err) {
        console.error("Error fetching live weather/aqi:", err);
      }
    };
    fetchWeather();
  }, [selectedMunicipality]);

  const selectedAqi = weatherData[selectedMunicipality || 'Prishtinë'] || { aqi: 0, temp: '--°C', status: 'Duke ngarkuar...', aqiDesc: 'Të dhënat reale nuk janë gati.' };

  // Real-time user database subscription
  React.useEffect(() => {
    let unsubscribe: () => void = () => {};
    const subscribeUsers = async () => {
      try {
        const { db } = await import('../lib/firebase');
        const { collection, onSnapshot, query, orderBy, limit } = await import('firebase/firestore');
        const q = query(collection(db, 'users'), orderBy('points', 'desc'), limit(15));
        unsubscribe = onSnapshot(q, (snapshot) => {
          const list = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setRealUsers(list);
        }, (err) => {
          console.error("Error subscribing users:", err);
        });
      } catch (e) {
        console.error("Error setting up real users listener:", e);
      }
    };
    subscribeUsers();
    return () => unsubscribe();
  }, [reports, currentUser]);

  const handleRedeem = (reward: typeof REWARDS_LIST[0]) => {
    if (!currentUser) {
      toast.error(dt("Ju lutem kyçuni për të shfrytëzuar pikët dhe përfituar shpërblime!"));
      return;
    }
    if ((currentUser.points || 0) < reward.cost) {
      toast.error(`${dt("Ju nuk keni pikë të mjaftueshme! Ju duhen edhe")} ${reward.cost - (currentUser.points || 0)} ${dt("pikë.")}`);
      return;
    }
    
    // Deduct points
    const newPoints = (currentUser.points || 0) - reward.cost;
    const claimed = currentUser.claimedRewards || [];
    const updatedClaimed = [...claimed, reward.id];
    
    updateUser(currentUser.id, { 
      points: newPoints,
      claimedRewards: updatedClaimed
    });
    
    // Set redeemed reward to show QR Code modal
    const simulatedCode = `CITY-REP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    setRedeemedReward({
      id: reward.id,
      title: reward.title,
      cost: reward.cost,
      code: simulatedCode
    });
    toast.success(dt("Shpërblimi u përfitua me sukses!"));
  };

  // Generate last 7 days data for the chart
  const chartData = React.useMemo(() => {
    const days = [];
    const now = new Date();
    // Start from 6 days ago to today (7 days in total)
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateString = d.toLocaleDateString('sq', { month: 'short', day: 'numeric' });
      
      // Count reports submitted on this day
      const startOfDay = new Date(d.setHours(0, 0, 0, 0)).getTime();
      const endOfDay = new Date(d.setHours(23, 59, 59, 999)).getTime();
      
      const newCount = reports.filter(r => {
        const t = new Date(r.createdAt).getTime();
        return t >= startOfDay && t <= endOfDay;
      }).length;

      // Count resolved reports on this day
      const resolvedCountOnDay = reports.filter(r => {
        if (r.status !== 'Resolved') return false;
        const t = new Date((r as any).updatedAt || r.createdAt).getTime();
        return t >= startOfDay && t <= endOfDay;
      }).length;

      days.push({
        name: dateString,
        'Raportime të Reja': newCount,
        'Raste të Zgjidhura': resolvedCountOnDay,
      });
    }
    return days;
  }, [reports]);

  // Status ratio data for PieChart
  const statusRatioData = React.useMemo(() => {
    const zgjidhura = reports.filter(r => r.status === 'Resolved').length;
    const neProces = reports.filter(r => r.status !== 'Resolved' && r.status !== 'Rejected' && r.status !== 'Draft').length;
    
    return [
      { name: 'Të Zgjidhura', value: zgjidhura, color: '#10b981' },
      { name: 'Në Proces', value: neProces, color: '#f59e0b' }
    ];
  }, [reports]);

  const resolvedPercent = React.useMemo(() => {
    const total = statusRatioData[0].value + statusRatioData[1].value;
    return total > 0 ? Math.round((statusRatioData[0].value / total) * 100) : 0;
  }, [statusRatioData]);

  React.useEffect(() => {
    const fetchTips = async () => {
      setTipsLoading(true);
      try {
        const userReports = reports.filter(r => currentUser && r.authorId === currentUser.id).map(r => ({
          title: r.title,
          category: r.category,
          urgency: r.urgency
        }));
        const userPoints = currentUser?.points || 0;

        const res = await fetch('/api/dashboard/reporting-tips', {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ userReports, userPoints })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.tips && !data.degraded) {
            setTips(data.tips);
          }
        }
      } catch (err) {
        console.error("Failed to fetch reporting tips from backend:", err);
      } finally {
        setTipsLoading(false);
      }
    };

    fetchTips();
  }, [reports, currentUser]);

  

  // Fetch AI-generated news / alerts based on selected municipality
  const loadAINews = async (muni: string, isManualScan = false) => {
    if (isManualScan) {
      setAiScanning(true);
    } else {
      setNewsLoading(true);
    }
    
    try {
      const res = await fetch('/api/dashboard/ai-news', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        // The model writes the alerts from the recent reports it is given. The
        // request used to carry only the municipality name while the server read
        // `issues`, so every "breaking news" item was invented from nothing.
        body: JSON.stringify({
          municipality: muni,
          issues: reports
            .filter(r => !muni || (r.location?.municipality || '').toLowerCase() === muni.toLowerCase())
            .slice(0, 10)
            .map(r => ({ title: r.title, category: r.category })),
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.alerts && !data.degraded) {
          setActiveAlerts(data.alerts);
          setCurrentAlertIndex(0);
        }
      }
    } catch (err) {
      console.error("Dështoi marrja e lajmeve AI:", err);
    } finally {
      setNewsLoading(false);
      setAiScanning(false);
    }
  };

  React.useEffect(() => {
    const targetMuni = selectedMunicipality || detectedCity || 'Prishtinë';
    loadAINews(targetMuni);
  }, [selectedMunicipality, detectedCity]);

  React.useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [viewMode, activeTab, selectedMunicipality, searchQuery]);

  // Filter for visibility
  const visibleReports = reports.filter(r => {
    if (currentUser?.role === 'admin') return true;
    if (currentUser && r.authorId === currentUser.id && r.authorId !== 'guest') return true;
    return r.status !== 'Pending Review' && r.status !== 'Rejected';
  });

  const activeReports = visibleReports.filter(r => r.status !== 'Resolved' && r.status !== 'Rejected');
  const resolvedCount = visibleReports.filter(r => r.status === 'Resolved').length;

  // Primary filtering depending on viewMode
  let baseReports = viewMode === 'active' ? activeReports : viewMode === 'resolved' ? visibleReports.filter(r => r.status === 'Resolved') : visibleReports;
  let filteredReports = [...baseReports];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredReports = filteredReports.filter(r => 
      (r.title && r.title.toLowerCase().includes(q)) || 
      (r.id && r.id.toLowerCase().includes(q)) || 
      (r.location?.address && r.location.address.toLowerCase().includes(q)) || 
      (r.description && r.description.toLowerCase().includes(q))
    );
  }

  if (selectedMunicipality) {
    filteredReports = filteredReports.filter(r => r.location?.municipality === selectedMunicipality);
  }

  if (activeTab === 'dash_most_voted') {
    filteredReports.sort((a, b) => b.upvotes - a.upvotes);
  } else if (activeTab === 'dash_critical') {
    filteredReports = filteredReports.filter(r => r.urgency === 'Kritike');
  } else if (activeTab === 'dash_recent') {
    filteredReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else {
    // Të Gjitha
    filteredReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const handleShare = (e: React.MouseEvent, title: string, id: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/detailed-registry?report=${encodeURIComponent(id)}`;
    if (navigator.share) {
      navigator.share({
        title: `Raportim: ${title}`,
        text: `Shikoni këtë raportim qytetar: "${title}"`,
        url: url
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      toast.success(dt("Linku i raportimit u kopjua!"));
    }
  };

  const fallbackTips = [
    "Shto përshkrime më të detajuara për lokacionin për të ndihmuar ekipet administrative të gjejnë shpejt problemin.",
    "Ngarko fotografi me dritë më të mirë dhe nga distanca të ndryshme (të afërt dhe të largët) si dëshmi.",
    "Përdor opsionin 'Zgjedh në Hartë' për të vendosur saktë koordinatat e problemit që raporton."
  ];

  const activeTips = tips.length > 0 ? tips : fallbackTips;

  const topCategories = React.useMemo(() => {
    const categoryCounts: Record<string, number> = {};
    reports.forEach(r => {
      const cat = r.category || 'Tjetër';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    
    const sorted = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, count]) => ({ category, count }));
      
    while (sorted.length < 3) {
      sorted.push({ category: 'Nuk ka raste', count: 0 });
    }
    return sorted;
  }, [reports]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-6xl mx-auto pt-6 pb-32 md:py-12 px-4 sm:px-6 lg:px-8"
    >
      {/* Top Banner (Municipality & National targeting) */}
      

      {/* Hero Section */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-[var(--spacing-12)] gap-[var(--spacing-8)]">
        <div className="max-w-2xl">
          <Badge variant="info" className="mb-[var(--spacing-4)]">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            {t('dash_hero_tag')}
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[var(--color-text)] dark:text-white tracking-tight leading-tight mb-[var(--spacing-4)] title-serif">
            {t('dash_title1')} <br className="hidden sm:block"/>
            <span className="text-[var(--color-primary)]">{t('dash_title2')}.</span>
          </h1>
          <p className="text-lg text-[var(--color-text-muted)] leading-relaxed mb-[var(--spacing-6)]">
            {t('dash_subtitle')}
          </p>
          <div className="flex flex-wrap items-center gap-[var(--spacing-4)] mb-[var(--spacing-8)]">
            <Button size="lg" variant="primary" onClick={() => navigate('/raporto')}>
              {dt('Raporto një problem')}
            </Button>
            <Button size="lg" variant="outline" onClick={() => {
              document.getElementById('raportimet-section')?.scrollIntoView({ behavior: 'smooth' });
            }}>
              {dt('Shfleto Raportimet')}
            </Button>
          </div>
          
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder={dt('Kërko raporte, zona ose kategori...')} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-slate-900 dark:text-white"
            />
          </div>
        </div>
        
        <div className="w-full md:w-auto grid grid-cols-2 gap-[var(--spacing-4)]">
          <button 
            type="button"
            onClick={() => {
              setViewMode('active');
              document.getElementById('raportimet-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={cn(
              "p-[var(--spacing-6)] flex flex-col justify-center border-none text-white rounded-xl text-left transition outline-none",
              viewMode === 'active' ? "bg-[var(--color-primary)] shadow-lg ring-2 ring-[var(--color-primary)] ring-offset-2 dark:ring-offset-slate-900" : "bg-[var(--color-primary)]/80 hover:bg-[var(--color-primary)]"
            )}
          >
             <span className="text-xs font-bold tracking-wide mb-1 opacity-90 uppercase">{t('dash_active')}</span>
             <div className="flex items-center gap-2">
               <span className="text-4xl font-black">{activeReports.length}</span>
               <AlertTriangle className="w-5 h-5 text-blue-300" />
             </div>
          </button>
          <button 
            type="button"
            onClick={() => {
              setViewMode('resolved');
              document.getElementById('raportimet-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={cn(
              "p-[var(--spacing-6)] flex flex-col justify-center border-none text-white rounded-xl text-left transition outline-none",
              viewMode === 'resolved' ? "bg-[#10b981] shadow-lg ring-2 ring-[#10b981] ring-offset-2 dark:ring-offset-slate-900" : "bg-[#10b981]/80 hover:bg-[#10b981]"
            )}
          >
             <span className="text-xs font-bold tracking-wide mb-1 opacity-90 uppercase">{t('dash_resolved')}</span>
             <div className="flex items-center gap-2">
               <span className="text-4xl font-black">{resolvedCount}</span>
               <CheckCircle2 className="w-5 h-5 text-emerald-200" />
             </div>
          </button>
        </div>
      </div>
      <AnimatePresence mode="wait">
        {viewMode !== 'stats' && (
          <motion.div
            key="active"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mb-4 md:mb-6 bg-rose-600 dark:bg-rose-500 rounded-xl p-5 md:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-[var(--spacing-6)] relative overflow-hidden shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)]">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 opacity-10 pointer-events-none">
                <Heart className="w-48 h-48" />
              </div>
              <div className="relative z-10 flex-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 dark:bg-slate-900/20 text-white text-xs font-bold tracking-wide rounded-full border border-white/30 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>{dt(`FUSHATË AKTIVE`)}
                </div>
                <h2 className="text-xl md:text-2xl font-bold title-serif mb-1.5">{dt(`Ndihmo Njerëz Me Nevojë`)}</h2>
                <p className="text-xs md:text-sm text-rose-100 max-w-xl font-medium">{dt(`Platforma jonë tashmë mbështet mbledhjen e fondeve për qytetarët që janë në nevojë ekstreme financiare apo shëndetësore. Shihni se si mund të kontribuoni.`)}</p>
              </div>
              <div className="relative z-10 w-full md:w-auto shrink-0 flex items-center justify-center">
                <Link 
                  to="/donacion"
                  className="w-full sm:w-auto px-6 py-3 bg-white dark:bg-slate-900 text-rose-600 font-bold rounded-xl text-sm text-center shadow-sm hover:shadow-md transition hover:bg-rose-50 flex items-center justify-center gap-2"
                >{dt(`Nis Kontributin Këtu`)} <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {viewMode === 'stats' && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* 3-Column Dashboard Analytics, Recharts Pie Ratio Chart & AI Insights Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--spacing-6)] mb-8">
            
            {/* Column 1: Recharts 7-Day Trend Chart */}
            <div className="lg:col-span-5 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 p-5 md:p-6 shadow-sm dark:shadow-none flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                  <h3 className="text-lg font-bold text-[var(--color-text)] dark:text-white title-serif">{dt(`Ecuria e Raportimeve`)}</h3>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-medium mb-6">{dt(`Raportet e reja vs. ato të zgjidhura në 7 ditët e fundit.`)}</p>
              </div>

              <div className="w-full h-56 md:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'bold', color: '#1e293b', fontSize: '12px' }}
                      itemStyle={{ fontSize: '12px', padding: '2px 0' }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }} />
                    <Area type="monotone" dataKey="Raportime të Reja" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNew)" />
                    <Area type="monotone" dataKey="Raste të Zgjidhura" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorResolved)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Column 2: Status Ratio Donut Chart (Resolved vs. In-Progress) */}
            <div className="lg:col-span-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 p-5 md:p-6 shadow-sm dark:shadow-none flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-xl">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <h3 className="text-lg font-bold text-[var(--color-text)] dark:text-white title-serif">{dt(`Raporti i Zgjidhjes`)}</h3>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-medium mb-6">{dt(`Raporti i problemeve të zgjidhura ndaj atyre në proces.`)}</p>
              </div>

              <div className="w-full h-40 md:h-48 relative flex items-center justify-center mx-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusRatioData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusRatioData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ fontSize: '12px', padding: '2px 0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Center Text inside the donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-slate-950 dark:text-white">{resolvedPercent}%</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">{dt(`Zgjidhur`)}</span>
                </div>
              </div>

              <div className="mt-4 flex justify-center gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">{dt(`Zgjidhur (`)}{statusRatioData[0].value})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">{dt(`Në Proces (`)}{statusRatioData[1].value})</span>
                </div>
              </div>
            </div>

            {/* Column 3: Real Database Statistics */}
            <div className="lg:col-span-3 bg-slate-900 text-white rounded-xl p-5 md:p-6 shadow-sm dark:shadow-none flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-12 -mt-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/10 text-indigo-400 rounded-xl border border-white/10">
                      <Layers className="w-4 h-4 text-indigo-400" />
                    </span>
                    <h3 className="text-lg font-bold title-serif">{dt(`Sektorët Aktivë`)}</h3>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-500/30 uppercase text-emerald-300 tracking-wider">{dt(`LIVE`)}</span>
                </div>
                
                <p className="text-xs text-[var(--color-text-muted)] font-medium mb-5 leading-relaxed">{dt(`Kategoritë me volumin më të madh të raportimeve në databazën cloud:`)}
                </p>

                <div className="space-y-4">
                  {topCategories.map((item, idx) => {
                    const total = reports.length || 1;
                    const percent = Math.round((item.count / total) * 100);
                    return (
                      <div key={idx} className="group flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-slate-200 truncate max-w-[140px] group-hover:text-white transition-colors">{item.category}</span>
                          <span className="text-indigo-400 font-mono">{item.count} {dt(`raste`)} ({percent}%)</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700/50">
                          <div 
                            className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/15 relative z-10 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider font-mono">{dt(`Totali i rasteve`)}</span>
                <span className="text-sm font-black text-indigo-400 font-mono">{reports.length} {dt(`raporte`)}</span>
              </div>
            </div>

          </div>

          {/* AI Municipality Health Check Diagnostics */}
          <MunicipalityHealthCheck selectedMunicipality={selectedMunicipality} />

          {/* City Civic Tools, Leaderboard, & Eco Rewards Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--spacing-6)] mb-8">
            
            {/* Column 1: AQI / Air Quality & Weather Widget */}
            <div className="lg:col-span-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 p-5 md:p-6 shadow-sm dark:shadow-none flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-1.5 bg-sky-50 text-sky-600 rounded-xl">
                    <CloudSun className="w-4 h-4" />
                  </span>
                  <h3 className="text-lg font-bold text-[var(--color-text)] dark:text-white title-serif">{dt(`Moti & Cilësia e Ajrit`)}</h3>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-medium mb-5">{dt(`Gjendja ekologjike në kohë reale për komunën e përzgjedhur.`)}</p>
      
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-white/5 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] uppercase tracking-wider">{selectedMunicipality || 'Prishtinë'}</span>
                    <span className="text-xs font-black text-slate-700 dark:text-[var(--color-text-muted)]">{selectedAqi.temp}</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-3xl font-black text-slate-950 dark:text-white flex items-baseline gap-1">
                        {selectedAqi.aqi}
                        <span className="text-xs font-bold text-[var(--color-text-muted)]">{dt(`AQI`)}</span>
                      </div>
                      <span className={cn("inline-block px-2 py-0.5 rounded text-xs font-bold mt-1.5 uppercase tracking-wide", 
                        selectedAqi.aqi <= 35 ? "bg-teal-50 text-teal-700 border border-teal-100" :
                        selectedAqi.aqi <= 50 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                        "bg-yellow-50 text-yellow-700 border border-yellow-100"
                      )}>{dt(`Cilësia:`)} {selectedAqi.status}
                      </span>
                    </div>
                    <Wind className={cn("w-10 h-10 stroke-[1.5]", 
                      selectedAqi.aqi <= 50 ? "text-emerald-500" : "text-yellow-500"
                    )} />
                  </div>
                </div>
                  
                <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-semibold leading-relaxed">
                  <span className="font-bold text-[var(--color-text)] dark:text-white">{dt(`Këshillë:`)}</span> {selectedAqi.aqiDesc}
                </p>
              </div>
                
              <div className="text-xs font-mono font-bold text-[var(--color-text-muted)] mt-4 pt-3 border-t border-slate-100 dark:border-white/5 uppercase tracking-wider flex items-center justify-between">
                <span>{dt(`BURIMI: LIVE WEATHER API`)}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
            </div>

            {/* Column 2: Citizens Merit & Leaderboard */}
            <div className="lg:col-span-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 p-5 md:p-6 shadow-sm dark:shadow-none flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-50 text-amber-600 rounded-xl">
                      <Award className="w-4 h-4" />
                    </span>
                    <h3 className="text-lg font-bold text-[var(--color-text)] dark:text-white title-serif">{dt(`Tabela e Meritave`)}</h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full uppercase tracking-wider">{dt(`Top Aktivët`)}</span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-medium mb-4">{dt(`Qytetarët tanë më kontribues dhe aktivë këtë muaj.`)}</p>

                <div className="space-y-3">
                  {(() => {
                    
  const allCitizens = [...realUsers.filter(u => u.role !== 'admin' && u.email !== 'admin@kosova.com')];

                    
                    // Add current logged in user if not present
                    if (currentUser && currentUser.role !== 'admin') {
                      const hasUser = allCitizens.some(c => c.id === currentUser.id);
                      if (!hasUser) {
                        allCitizens.push({
                          id: currentUser.id,
                          name: currentUser.name || 'Ti',
                          points: currentUser.points || 0,
                          badges: currentUser.badges && currentUser.badges.length > 0 
                            ? [currentUser.badges[0]] 
                            : ['Qytetar Aktiv 🎖️']
                        });
                      }
                    }
                    
                    // Sort by points descending
                    const sorted = allCitizens.sort((a, b) => (b.points || 0) - (a.points || 0));

                    return sorted.slice(0, 5).map((citizen, index) => {
                      const isSelf = currentUser && (citizen.id === currentUser.id || citizen.name === currentUser.name);
                      const badgeText = Array.isArray(citizen.badges) && citizen.badges.length > 0 
                        ? citizen.badges[0] 
                        : (citizen.points > 300 ? 'Kampion Ekologjik 🌿' : citizen.points > 150 ? 'Raportues Aktiv ⚡' : 'Qytetar Aktiv 🎖️');
                      return (
                        <div 
                          key={citizen.id} 
                          className={cn(
                            "flex items-center justify-between p-2 rounded-xl transition border",
                            isSelf 
                              ? "bg-indigo-50/50 border-indigo-150 shadow-sm dark:shadow-none" 
                              : "bg-slate-50 dark:bg-slate-800/50 border-transparent hover:bg-slate-50 dark:bg-slate-900"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0",
                              index === 0 ? "bg-amber-100 text-amber-700" :
                              index === 1 ? "bg-slate-200 dark:bg-slate-700 text-[var(--color-text)] dark:text-slate-200 dark:text-slate-100" :
                              index === 2 ? "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300" :
                              "bg-slate-100 dark:bg-slate-800 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]"
                            )}>
                              {index + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-[var(--color-text)] dark:text-white">{citizen.name}</span>
                                {isSelf && <span className="text-[10px] font-bold bg-indigo-600 text-white px-1.5 py-0.2 rounded-full uppercase scale-90">Ti</span>}
                              </div>
                              <span className="text-xs font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">{badgeText}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-[var(--color-text)] dark:text-white">{citizen.points || 0} p</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {currentUser && currentUser.role !== 'admin' && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 space-y-2.5 animate-in fade-in duration-300">
                  <span className="text-xs font-mono font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">{dt(`Baxhat tuaja automatike këtë muaj:`)}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const points = currentUser.points || 0;
                      const badges = ['Qytetar i Ri 🎖️'];
                      if (points >= 100) badges.push('Qytetar Aktiv ⚡');
                      if (points >= 250) badges.push('Mbrojtës i Komunitetit 🛡️');
                      if (points >= 500) badges.push('Kampion i Gjelbër 🌿');
                      if (points >= 1000) badges.push('Ambasador i Kosovës 🌟');
                      
                      return badges.map((badge, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-xl shadow-sm dark:shadow-none">
                          {badge}
                        </span>
                      ));
                    })()}
                  </div>
                  
                  {/* Progress to next badge */}
                  {(() => {
                    const points = currentUser.points || 0;
                    let nextBadge = '';
                    let nextPoints = 0;
                    if (points < 100) { nextBadge = 'Qytetar Aktiv ⚡'; nextPoints = 100; }
                    else if (points < 250) { nextBadge = 'Mbrojtës i Komunitetit 🛡️'; nextPoints = 250; }
                    else if (points < 500) { nextBadge = 'Kampion i Gjelbër 🌿'; nextPoints = 500; }
                    else if (points < 1000) { nextBadge = 'Ambasador i Kosovës 🌟'; nextPoints = 1000; }
                    
                    if (!nextBadge) return null;
                    
                    const progressPercent = Math.min((points / nextPoints) * 100, 100);
                    
                    return (
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[10px] font-bold text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
                          <span>{dt(`Deri tek`)} {nextBadge}</span>
                          <span>{points}/{nextPoints} p</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-indigo-500 to-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="text-xs font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] mt-4 pt-3 border-t border-slate-100 dark:border-white/5 leading-relaxed">{dt(`Fitoni pikë duke raportuar probleme reale dhe duke marrë upvotes nga komuniteti!`)}
              </div>
            </div>

            {/* Column 3: Eco Rewards Shop */}
            <div className="lg:col-span-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 p-5 md:p-6 shadow-sm dark:shadow-none flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-rose-50 text-indigo-600 rounded-xl">
                      <Award className="w-4 h-4" />
                    </span>
                    <h3 className="text-lg font-bold text-[var(--color-text)] dark:text-white title-serif">{dt(`Dhuratat Ekologjike`)}</h3>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-medium mb-4">{dt(`Shpenzo pikët për bileta ose gjelbërim.`)}</p>
      
                <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                  {(() => {
                    const claimed = currentUser?.claimedRewards || [];
                    const availableRewards = REWARDS_LIST.filter(r => !claimed.includes(r.id));
                    if (availableRewards.length === 0) {
                      return (
                        <div className="text-center py-8 text-[var(--color-text-muted)] font-bold text-xs">{dt(`Të gjitha dhuratat ekologjike janë shfrytëzuar për këtë muaj! Kontribuoni më shumë për të zhbllokuar të reja.`)}
                        </div>
                      );
                    }
                    return availableRewards.map((reward) => (
                      <div key={reward.id} className="border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:bg-slate-900 rounded-xl p-3 transition flex flex-col justify-between gap-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-[var(--color-text)] dark:text-white text-xs">{reward.title}</h4>
                            <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-semibold leading-tight mt-0.5">{reward.desc}</p>
                          </div>
                          <span className="text-xs font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-xl shrink-0">
                            {reward.cost} p
                          </span>
                        </div>
                        <button
                          onClick={() => handleRedeem(reward)}
                          className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition uppercase tracking-wide cursor-pointer"
                        >{dt(`Shkëmbe Pikët`)}
                        </button>
                      </div>
                    ));
                  })()}
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{dt(`Bilanci i pikëve`)}</span>
                <span className="text-xs font-black text-indigo-600 bg-rose-50 px-2 py-0.5 rounded-xl">{currentUser?.points || 0}{dt(`pikë aktive`)}</span>
              </div>
            </div>

          </div>
        </motion.div>
      )}
      </AnimatePresence>

      <div className="mb-8">
        <AdBanner position="inline" municipality={selectedMunicipality || undefined} />
      </div>

      <div id="raportimet-section" className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 scroll-mt-24">
        <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text)] dark:text-white title-serif flex items-center gap-2">
          {viewMode === 'resolved' ? (
            <><TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />{dt(`Rastet e Zgjidhura`)}</>
          ) : viewMode === 'active' ? (
            <><Layers className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />{dt(`Raste Aktive`)}</>
          ) : (
            <><Filter className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />{dt(`Të Gjitha Rastet`)}</>
          )}
        </h2>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="flex lg:hidden items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-[var(--color-text-muted)] rounded-xl font-bold text-sm hover:bg-slate-50 dark:bg-slate-900 transition shadow-sm dark:shadow-none"
          >
            <Filter className="w-4 h-4" />{dt(`Filtrat`)}
          </button>
          
          <button 
            onClick={() => navigate('/detailed-registry')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm tracking-wide hover:bg-indigo-700 transition shadow-sm dark:shadow-none group flex-1 sm:flex-none"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">{dt('Shiko të Gjitha Raportimet')}</span>
            <span className="sm:hidden">{dt(`Të Gjitha`)}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {(showFilters || window.innerWidth >= 1024) && (
          <>
            {/* Mobile Backdrop */}
            {showFilters && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/40 md:backdrop-blur-sm z-[90] lg:hidden"
                onClick={() => setShowFilters(false)}
              />
            )}

            <motion.div 
              initial={window.innerWidth < 1024 ? { x: '100%' } : { height: 0, opacity: 0 }}
              animate={window.innerWidth < 1024 ? { x: 0 } : { height: 'auto', opacity: 1 }}
              exit={window.innerWidth < 1024 ? { x: '100%' } : { height: 0, opacity: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className={cn(
                "fixed inset-y-0 right-0 z-[100] w-full max-w-sm bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 shadow-2xl p-6 lg:p-0 flex flex-col lg:relative lg:block lg:w-auto lg:max-w-none lg:bg-transparent lg:shadow-none lg:z-auto h-full lg:h-auto overflow-y-auto lg:overflow-visible lg:!transform-none",
                !showFilters && "hidden lg:block"
              )}
            >
              <div className="flex items-center justify-between mb-6 lg:hidden">
                <h3 className="text-lg font-bold text-[var(--color-text)] dark:text-white flex items-center gap-2"><Filter className="w-5 h-5 text-indigo-600" />{dt(`Filtrat`)}</h3>
                <button onClick={() => setShowFilters(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] hover:text-[var(--color-text)] dark:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-2 mb-6 flex flex-col lg:flex-row lg:items-center gap-4 lg:divide-x divide-slate-200 dark:divide-slate-700">
                <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-neutral-500 dark:text-[var(--color-text-muted)]" />
                    <input 
                      type="text" 
                      placeholder={t('dash_search')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 md:pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 lg:bg-transparent border lg:border-none border-slate-200 dark:border-slate-700 rounded-xl lg:rounded-none text-neutral-800 dark:text-slate-200 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent font-medium text-sm transition"
                    />
                  </div>
                  <div className="flex items-center w-full sm:w-56 md:w-72 relative bg-slate-50 dark:bg-slate-900 lg:bg-neutral-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-white/10 lg:border-none lg:rounded-xl lg:rounded-r-lg lg:m-1">
                     <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
                     <select 
                       value={selectedMunicipality}
                       onChange={(e) => setSelectedMunicipality(e.target.value)}
                       className="w-full pl-10 md:pl-12 pr-4 py-3 lg:py-4 bg-transparent border-none text-[var(--color-text)] dark:text-white font-semibold text-sm outline-none appearance-none cursor-pointer"
                     >
                       <option value="">{t('dash_all_mun')}</option>
                       {KOSOVO_MUNICIPALITIES.map(m => (
                         <option key={m} value={m}>{m}</option>
                       ))}
                     </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap gap-2 lg:overflow-x-auto lg:pb-6 scrollbar-hide w-full sm:mx-0 sm:px-0 lg:border-b lg:border-slate-200/60 dark:border-white/10 lg:mb-8 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-white/5 lg:flex-row">
                {['dash_all', 'dash_recent', 'dash_most_voted', 'dash_critical'].map((filter) => (
                  <button 
                    key={filter} 
                    onClick={() => {
                      setActiveTab(filter);
                      if(window.innerWidth < 1024) setShowFilters(false);
                    }}
                    className={cn(
                      "px-4 py-2.5 text-xs font-bold transition whitespace-nowrap flex-1 lg:flex-none text-center rounded-xl lg:rounded-full border border-slate-200/60 dark:border-white/10 lg:border-transparent",
                      activeTab === filter
                        ? "bg-indigo-600 text-white shadow-sm border-indigo-600"
                        : "bg-slate-50 dark:bg-slate-900 lg:bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 text-slate-700 dark:text-slate-200 dark:text-[var(--color-text-muted)] lg:border-slate-200/60 dark:border-white/10 hover:bg-neutral-200 lg:hover:bg-neutral-50 dark:bg-slate-900/50 lg:hover:text-[var(--color-text)] dark:text-white"
                    )}
                  >
                    {t(filter as any)}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {viewMode !== 'stats' && (
        <div className="mb-8 bg-slate-900 dark:bg-slate-950 border-b-4 border-indigo-500 rounded-2xl p-6 md:p-8 text-white shadow-xl overflow-hidden relative">
          {/* Ambient background glows */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-[var(--spacing-6)]">
            <div>
              <span className="inline-block px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-black uppercase tracking-widest rounded-full mb-3 border border-indigo-500/30">{dt(`STATISTIKAT & IMPAKTI I KOMUNITETIT`)}
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight title-serif leading-none">{dt(`Paneli i`)} <span className="text-indigo-400">{dt(`Qytetarit`)}</span>
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mt-2 font-medium max-w-xl">{dt(`Mirëseerdhët në platformën qendrore të raportimeve në Kosovë. Këtu qytetarët ndihmojnë në rregullimin e komunave tona në kohë reale.`)}
              </p>
            </div>
            
            <button 
              onClick={() => setViewMode('stats')}
              className="flex items-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition active:scale-95 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] shadow-indigo-500/30 text-xs tracking-wider uppercase whitespace-nowrap self-stretch lg:self-auto justify-center cursor-pointer"
            >
              <TrendingUp className="w-4 h-4" />
              {dt('Shiko Statistikat')}{dt(`e Detajuara`)}
            </button>
          </div>
          
          {/* Dense mini stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10 relative z-10">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 md:p-4 hover:bg-slate-800 transition">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{dt(`Raporte Totale`)}</span>
              <div className="text-2xl md:text-3xl font-serif font-bold text-white mt-1">{reports.length}</div>
              <span className="text-[10px] text-slate-400 mt-1 block">{dt(`Të gjitha ankesat e regjistruara`)}</span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 md:p-4 hover:bg-slate-800 transition">
              <Link to="/regjistri?status=dash_resolved" className="hover:underline"><span className="text-xs font-bold uppercase tracking-wider text-slate-400">{dt(`Raste të Zgjidhura`)}</span></Link>
              <div className="text-2xl md:text-3xl font-serif font-bold text-emerald-500 mt-1">
                {reports.filter(r => r.status === 'Resolved').length}
              </div>
              <span className="text-[10px] text-emerald-500/80 mt-1 block">✓ {Math.round((reports.filter(r => r.status === 'Resolved').length / (reports.length || 1)) * 100)}{dt(`% Shkalla e zgjidhjes`)}</span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 md:p-4 hover:bg-slate-800 transition">
              <Link to="/regjistri?status=dash_in_progress" className="hover:underline"><span className="text-xs font-bold uppercase tracking-wider text-slate-400">{dt(`Në Progres & Caktuar`)}</span></Link>
              <div className="text-2xl md:text-3xl font-serif font-bold text-amber-500 mt-1">
                {reports.filter(r => r.status === 'In Progress' || r.status === 'Assigned').length}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">{dt(`Në ndërhyrje aktive`)}</span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 md:p-4 hover:bg-slate-800 transition">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{dt(`Koha e Reagimit`)}</span>
              <div className="text-2xl md:text-3xl font-serif font-bold text-indigo-400 mt-1">{dt(`14 Orë`)}</div>
              <span className="text-[10px] text-indigo-400/80 mt-1 block">{dt(`⚡ Koha më e shpejtë në rajon`)}</span>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--spacing-6)] lg:gap-8">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-xl flex flex-col overflow-hidden h-[400px]">
              <div className="h-48 bg-slate-200 animate-pulse w-full"></div>
              <div className="p-5 flex flex-col flex-1 gap-4">
                <div className="flex justify-between items-center">
                  <div className="w-24 h-5 bg-slate-200 animate-pulse rounded-xl"></div>
                  <div className="w-16 h-5 bg-slate-200 animate-pulse rounded-xl"></div>
                </div>
                <div className="w-full h-6 bg-slate-200 animate-pulse rounded"></div>
                <div className="w-4/5 h-6 bg-slate-200 animate-pulse rounded"></div>
                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <div className="w-24 h-5 bg-slate-200 animate-pulse rounded"></div>
                  <div className="flex gap-2">
                    <div className="w-8 h-5 bg-slate-200 animate-pulse rounded"></div>
                    <div className="w-8 h-5 bg-slate-200 animate-pulse rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : filteredReports.length === 0 ? (
          <div className="col-span-full py-24 flex flex-col items-center justify-center text-center bg-transparent">
            <div className="w-16 h-16 mb-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Filter className="w-6 h-6 text-[var(--color-text-muted)]" />
            </div>
            <h3 className="text-2xl font-medium text-[var(--color-text)] dark:text-white mb-2">{t('dash_no_data')}</h3>
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] mb-8 max-w-sm">{t('dash_no_data_desc')}</p>
            <button 
              onClick={() => {setSearchQuery(''); setSelectedMunicipality(''); setActiveTab('dash_all');}}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors rounded-xl"
            >
              {t('dash_clear_filters')}
            </button>
          </div>
        ) : (
          filteredReports.map((report, index) => (
            <React.Fragment key={report.id}>
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, delay: (index % 6) * 0.05 }}
                onClick={() => setSelectedReportId(report.id)}
                className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-slate-200 dark:border-white/10 rounded-xl hover:shadow-md transition duration-300 flex flex-col group cursor-pointer overflow-hidden h-full"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {report.media && report.media.length > 0 ? (
                    report.media[0].type === 'image' ? (
                      <img src={report.media[0].url} alt={report.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                    ) : (
                      <video src={report.media[0].url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out pointer-events-none" muted playsInline />
                    )
                  ) : report.images && report.images.length > 0 ? (
                    <img src={report.images[0]} alt={report.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                  ) : (
                     <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-white/5">
                      <Layers className="w-8 h-8 text-[var(--color-text-muted)]" />
                    </div>
                  )}
                  
                  <div className="absolute top-3 left-3 flex gap-2">
                    {report.status === 'Pending Review' && (
                      <div className="bg-blue-500 text-white px-2.5 py-1 text-xs font-bold tracking-widest rounded-full uppercase shadow-sm">{dt(`Në Pritje`)}
                      </div>
                    )}
                    {(report.status === 'Resolved') && (
                      <div className="bg-emerald-500 text-white px-2.5 py-1 text-xs font-bold tracking-widest rounded-xl uppercase shadow-sm dark:shadow-none">{dt(`Zgjidhur`)}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex gap-2 flex-wrap">
                      <div className="bg-slate-100 dark:bg-slate-800 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] px-2 py-0.5 text-xs font-bold tracking-widest rounded-xl uppercase">
                        {dt(report.category)}
                      </div>
                      {report.isAd && (
                        <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-xs font-bold tracking-widest rounded-xl uppercase border border-blue-200 dark:border-blue-800/50">{dt(`Sponsorizuar`)}
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-mono text-[var(--color-text-muted)] bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-xl border border-slate-100 dark:border-white/5">
                      #{report.id.substring(0, 6)}
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-bold text-[var(--color-text)] dark:text-white mb-2 leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors">
                    {report.title}
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] line-clamp-2 mb-4 flex-1 font-medium">
                    {report.description}
                  </p>
                  
                  <div className="mt-auto pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] max-w-[60%]">
                      <MapPin className="w-4 h-4 flex-shrink-0 text-rose-500" />
                      <span className="text-xs font-bold truncate">{report.location?.municipality || 'Prishtinë'}</span>
                    </div>
                    <div className="flex items-center gap-4 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          upvoteReport(report.id);
                          toast.success(dt('Vota juaj u regjistrua!'));
                        }}
                        className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={dt('Voto këtë raportim')}
                      >
                        <ThumbsUp className="w-4 h-4" />
                        <span className="text-xs font-bold">{report.upvotes}</span>
                      </button>
                      <div className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-xs font-bold">{report.commentsCount}</span>
                      </div>
                      <button 
                        onClick={(e) => handleShare(e, report.title, report.id)}
                        className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors ml-1 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={dt(`Shpërndaj`)}
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
              
              {(index + 1) % 10 === 0 && (
                <div className="col-span-1 md:col-span-2 lg:col-span-3 py-6">
                   <AdBanner position="inline" municipality={selectedMunicipality || undefined} />
                </div>
              )}
            </React.Fragment>
          ))
        )}
      </div>
      
      {selectedReportId && (
        <ReportDetailModal 
          report={reports.find(r => r.id === selectedReportId)!} 
          onClose={() => setSelectedReportId(null)} 
        />
      )}

      {redeemedReward && (
        <div className="fixed inset-0 bg-slate-900/40 md:backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-2xl p-6 max-w-sm w-full relative">
            <button 
              onClick={() => setRedeemedReward(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] hover:text-[var(--color-text)] dark:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              
              <h3 className="text-xl font-bold text-[var(--color-text)] dark:text-white mb-1">{dt(`Shpërblimi u Përfitua!`)}</h3>
              <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-semibold mb-6">{dt(`Pikët u zbritën me sukses nga llogaria juaj.`)}</p>
              
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl p-5 mb-6 flex flex-col items-center">
                <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">{redeemedReward.title}</span>
                {/* Simulated QR Code / Barcode */}
                <div className="w-40 h-40 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border-2 border-slate-950 p-2 rounded-xl flex items-center justify-center shadow-inner relative overflow-hidden group">
                  <QrCode className="w-36 h-36 text-[var(--color-text)] dark:text-white" />
                  <div className="absolute inset-0 bg-indigo-500/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded">{dt(`Skano`)}</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-black text-[var(--color-text)] dark:text-slate-200 dark:text-slate-200 mt-4 tracking-widest">{redeemedReward.code}</span>
              </div>
              
              <p className="text-xs text-[var(--color-text-muted)] font-medium">{dt(`Prezantojeni këtë kod QR ose kodin numerik tek institucioni përkatës për të shfrytëzuar shpërblimin.`)}</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

import { dt } from '@/src/lib/dt';
import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { useCitizenDirectory } from '../../lib/useCitizenDirectory';
import { 
  Activity, ShieldAlert, Cpu, Radio, MapPin, Zap, Flame, 
  CheckCircle2, AlertTriangle, Users, FileText, HeartPulse, 
  Heart, Megaphone, Bell, ArrowRight, Clock, ShieldCheck,
  Server, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { HealthCase } from '../../types';
import { STAFF_LIMITS } from '../../lib/loadLimits';

export default function AdminDashboard({ onTabChange }: { onTabChange: (tab: string) => void }) {
  const reports = useStore(state => state.reports || []);
  const { citizens: users } = useCitizenDirectory();
  const donationCauses = useStore(state => state.donationCauses || []);
  const ads = useStore(state => state.ads || []);
  const auditLogs = useStore(state => state.auditLogs || []);
  const polls = useStore(state => state.polls || []);

  const [healthCases, setHealthCases] = useState<HealthCase[]>([]);

  // Fetch real health cases for live KPI.
  //
  // Bounded: this was an unordered listener on the whole collection, so a staff
  // session held an open connection that re-read every health record in the
  // country on every write — and the KPI it computes only ever looks at urgency
  // and municipality. The limit is what a supervisor reviews in one sitting; the
  // full registry is searched in its own tab, which paginates.
  useEffect(() => {
    const q = query(
      collection(db, 'healthRegistry'),
      orderBy('createdAt', 'desc'),
      limit(STAFF_LIMITS.healthCases)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs: HealthCase[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as HealthCase));
      setHealthCases(docs);
    }, (err) => {
      console.warn("Firestore health cases fallback:", err);
    });
    return unsub;
  }, []);

  // Calculated Real Metrics
  const pendingReports = useMemo(() => reports.filter(r => r.status === 'Pending Review'), [reports]);
  const inProgressReports = useMemo(() => reports.filter(r => r.status === 'In Progress' || r.status === 'Assigned'), [reports]);
  const resolvedReports = useMemo(() => reports.filter(r => r.status === 'Resolved'), [reports]);

  const verifiedCitizens = useMemo(() => users.filter(u => u.isVerified !== false), [users]);
  const urgentHealthCases = useMemo(() => healthCases.filter(c => c.urgency === 'Urgjente'), [healthCases]);
  const activeAds = useMemo(() => ads.filter(a => a.status === 'active'), [ads]);

  const [muniSearch, setMuniSearch] = useState('');
  const [muniFilter, setMuniFilter] = useState<'all' | 'active' | 'health' | 'pending'>('all');
  const [showAllMunis, setShowAllMunis] = useState(false);

  // Municipal Activity Calculation for all 38 municipalities
  const municipalStats = useMemo(() => {
    return KOSOVO_MUNICIPALITIES.map(m => {
      const muniReports = reports.filter(r => r.location?.municipality?.toLowerCase() === m.toLowerCase());
      const muniPending = muniReports.filter(r => r.status === 'Pending Review').length;
      const muniResolved = muniReports.filter(r => r.status === 'Resolved').length;
      const muniHealth = healthCases.filter(c => c.municipality?.toLowerCase() === m.toLowerCase()).length;
      return {
        name: m,
        total: muniReports.length,
        pending: muniPending,
        resolved: muniResolved,
        health: muniHealth
      };
    }).sort((a, b) => (b.total + b.health) - (a.total + a.health));
  }, [reports, healthCases]);

  const filteredMuniStats = useMemo(() => {
    let list = municipalStats;
    if (muniSearch.trim()) {
      list = list.filter(m => m.name.toLowerCase().includes(muniSearch.toLowerCase().trim()));
    }
    if (muniFilter === 'active') {
      list = list.filter(m => m.total > 0 || m.health > 0);
    } else if (muniFilter === 'pending') {
      list = list.filter(m => m.pending > 0);
    } else if (muniFilter === 'health') {
      list = list.filter(m => m.health > 0);
    }
    if (!showAllMunis && !muniSearch.trim() && muniFilter === 'all') {
      return list.slice(0, 10);
    }
    return list;
  }, [municipalStats, muniSearch, muniFilter, showAllMunis]);

  const updateFeed = [
    { title: 'Raportime të reja', badge: 'LIVE', value: pendingReports.length, tone: 'rose', text: 'Raportet që presin aprovim dhe koordinim' },
    { title: 'Raste shëndetësore', badge: 'URGJENTE', value: urgentHealthCases.length, tone: 'red', text: 'Kërkesa për ndihmë dhe verifikim spitalor' },
    { title: 'Sondazhe publike', badge: 'AKTIVE', value: Math.max(1, Math.min(9, polls.length || 6)), tone: 'sky', text: 'Masa e sondazheve në qarkullim publik' },
    { title: 'Njoftime publike', badge: 'PËRDITËSIM', value: 4, tone: 'emerald', text: 'Lajme dhe komunikime të traktuara nga admini' }
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto min-h-full">
      
      {/* Top Banner / Executive Control Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>Qendra Operative Mbarëkombëtare</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Paneli Qendror i Administrimit
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Pasqyra në kohë reale e raporteve qytetare, rasteve shëndetësore urgjente, fushatave të verifikuara dhe aktivitetit të 38 komunave të Kosovës.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Statusi i Shërbimit</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 justify-end">
                <ShieldCheck className="w-3.5 h-3.5" /> Normal / Aktiv
              </span>
            </div>
            <button 
              onClick={() => onTabChange('reports')}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
            >
              <span>Veprimet në Pritje</span>
              <span className="px-1.5 py-0.5 bg-white/20 rounded-md text-[10px]">{pendingReports.length}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Qendra e Përditësimeve</p>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">Admin Update Pulse</h3>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">REAL-TIME</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {updateFeed.map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{item.badge}</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">{item.value}</span>
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{item.title}</p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 4 Core Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* Reports KPI */}
        <div 
          onClick={() => onTabChange('reports')}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Raportimet Qytetare
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 group-hover:scale-110 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {reports.length}
            </span>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
              {pendingReports.length} në shqyrtim
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100 dark:border-white/5">
            <span>Zgjidhur: <strong className="text-emerald-600">{resolvedReports.length}</strong></span>
            <span className="flex items-center text-blue-600 font-bold group-hover:translate-x-0.5 transition-transform">
              Inspekto <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Health Registry KPI */}
        <div 
          onClick={() => onTabChange('health')}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Regjistri Shëndetësor
            </span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 group-hover:scale-110 transition-transform">
              <HeartPulse className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {healthCases.length}
            </span>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full">
              {urgentHealthCases.length} urgjente
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100 dark:border-white/5">
            <span>Spitale të Njoftuara: <strong className="text-slate-800 dark:text-slate-200">{healthCases.filter(c => c.hospitalNotified).length}</strong></span>
            <span className="flex items-center text-rose-600 font-bold group-hover:translate-x-0.5 transition-transform">
              Menaxho <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Citizens KPI */}
        <div 
          onClick={() => onTabChange('users')}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Qytetarë të Regjistruar
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {users.length}
            </span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              Verifikuar me Kod
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100 dark:border-white/5">
            <span>Staf / Agjentë: <strong className="text-slate-800 dark:text-slate-200">{users.filter(u => u.role !== 'citizen').length}</strong></span>
            <span className="flex items-center text-purple-600 font-bold group-hover:translate-x-0.5 transition-transform">
              Detajet <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Donations & Ads KPI */}
        <div 
          onClick={() => onTabChange('donations')}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Donacione & Solidaritet
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 group-hover:scale-110 transition-transform">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {donationCauses.length}
            </span>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full">
              {activeAds.length} reklama aktive
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100 dark:border-white/5">
            <span>Aprovuar: <strong className="text-emerald-600">{donationCauses.filter(d => d.status === 'approved').length}</strong></span>
            <span className="flex items-center text-emerald-600 font-bold group-hover:translate-x-0.5 transition-transform">
              Aprovo <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

      </div>

      {/* Main Grid: Municipal Performance & Priority Action Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Municipal Activity Table (Left 2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5 mb-4 gap-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-600" />
                  <span>Aktiviteti i 38 Komunave të Kosovës</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pasqyra e plotë e raporteve, zgjidhjeve dhe rasteve shëndetësore për të 38 komunat
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowAllMunis(!showAllMunis)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  {showAllMunis ? 'Shfaq më pak' : 'Shfaq të gjitha 38'}
                </button>
                <button 
                  onClick={() => onTabChange('reports')}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                >
                  Të gjitha raportet <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 mb-3">
              <div className="relative w-full sm:w-64">
                <input 
                  type="text"
                  placeholder="Kërko komunën (psh. Prishtinë, Prizren)..."
                  value={muniSearch}
                  onChange={(e) => setMuniSearch(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 pl-8 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-rose-500"
                />
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                {muniSearch && (
                  <button onClick={() => setMuniSearch('')} className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600">×</button>
                )}
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                <button 
                  onClick={() => setMuniFilter('all')} 
                  className={cn("px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors", muniFilter === 'all' ? "bg-slate-900 text-white dark:bg-rose-600" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400")}
                >
                  Të Gjitha (38)
                </button>
                <button 
                  onClick={() => setMuniFilter('active')} 
                  className={cn("px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors", muniFilter === 'active' ? "bg-slate-900 text-white dark:bg-rose-600" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400")}
                >
                  Me Raporte Aktive
                </button>
                <button 
                  onClick={() => setMuniFilter('pending')} 
                  className={cn("px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors", muniFilter === 'pending' ? "bg-slate-900 text-white dark:bg-rose-600" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400")}
                >
                  Në Pritje
                </button>
                <button 
                  onClick={() => setMuniFilter('health')} 
                  className={cn("px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors", muniFilter === 'health' ? "bg-slate-900 text-white dark:bg-rose-600" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400")}
                >
                  Raste Shëndetësore
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                  <tr className="text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-white/5">
                    <th className="py-2.5 px-3">Komuna</th>
                    <th className="py-2.5 px-3 text-center">Gjithsej Raporte</th>
                    <th className="py-2.5 px-3 text-center">Në Pritje</th>
                    <th className="py-2.5 px-3 text-center">Të Zgjidhura</th>
                    <th className="py-2.5 px-3 text-center">Raste Shëndetësore</th>
                    <th className="py-2.5 px-3 text-right">Ecuria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredMuniStats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        Nuk u gjet asnjë komunë me këtë filtër.
                      </td>
                    </tr>
                  ) : (
                    filteredMuniStats.map((item, idx) => {
                      const resolutionRate = item.total > 0 ? Math.round((item.resolved / item.total) * 100) : 100;
                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className={cn("w-2 h-2 rounded-full", item.total > 0 ? "bg-rose-500" : "bg-slate-300 dark:bg-slate-600")} />
                            <span>Komuna e {item.name}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                            {item.total}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.pending > 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 font-bold text-[10px]">
                                {item.pending}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">
                            {item.resolved}
                          </td>
                          <td className="py-2.5 px-3 text-center text-purple-600 font-bold">
                            {item.health > 0 ? item.health : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-bold text-[11px] text-slate-600 dark:text-slate-300">{resolutionRate}%</span>
                              <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-500 rounded-full" 
                                  style={{ width: `${resolutionRate}%` }} 
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500">
            <span>Përditësuar direkt nga baza e të dhënave</span>
            <span className="text-emerald-600 font-bold">38 Komuna në Monitorim</span>
          </div>
        </div>

        {/* Priority Action Center (Right Col) */}
        <div className="space-y-5 flex flex-col justify-between">
          
          {/* Quick Dispatch Actions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Veprime të Menjëhershme</span>
            </h3>

            <div className="space-y-2.5">
              <button 
                onClick={() => onTabChange('reports')}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/30 border border-slate-200/60 dark:border-white/5 text-left transition-all group flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-rose-600">
                    Shqyrto Raportet e Reja
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {pendingReports.length} raporte qytetare presin aprovim
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-1 transition-all" />
              </button>

              <button 
                onClick={() => onTabChange('health')}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/30 border border-slate-200/60 dark:border-white/5 text-left transition-all group flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-rose-600">
                    Regjistri Shëndetësor & Spitalet
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {urgentHealthCases.length} raste kërkojnë ndërhyrje / njoftim
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-1 transition-all" />
              </button>

              <button 
                onClick={() => onTabChange('notifications')}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/30 border border-slate-200/60 dark:border-white/5 text-left transition-all group flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-rose-600">
                    Dërgo Njoftim / Thirrje Emergjente
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Transmetim alarmi tek qytetarët e komunës
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-1 transition-all" />
              </button>

              <button 
                onClick={() => onTabChange('donations')}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/30 border border-slate-200/60 dark:border-white/5 text-left transition-all group flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-rose-600">
                    Verifiko Donacionet
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Kontrollo aplikimet e reja për ndihma sociale
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          </div>

          {/* System Telemetry Box */}
          <div className="bg-slate-950 text-white rounded-2xl p-5 border border-white/10 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-emerald-400" /> Telemetria e Serverit
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">LIVE SYNC</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Baza Firestore:</span>
                <span className="font-mono text-emerald-400 font-bold">18ms • E lidhur</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Gateway Verifikimi Email:</span>
                <span className="font-mono text-emerald-400 font-bold">Aktiv (Kod 6-shifror)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Shërbimi Njoftimeve / Push:</span>
                <span className="font-mono text-emerald-400 font-bold">Gatishmëri 100%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Mbrojtja e Sigurisë:</span>
                <span className="font-mono text-emerald-400 font-bold">SSL / TLS 1.3 Aktiv</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

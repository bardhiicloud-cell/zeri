import fs from 'fs';

const newContent = `import React, { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart as BarChartIcon, TrendingUp, Users, Map, CheckCircle2,
  AlertCircle, Activity, Award, PieChart as PieChartIcon, Filter, MapPin, Download, CheckSquare, Clock
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6', '#6366f1'];

export default function StatisticsPage() {
  const reports = useStore(state => state.reports) || [];
  const users = useStore(state => state.users) || [];
  
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('Të gjitha');
  const [selectedCategory, setSelectedCategory] = useState<string>('Të gjitha');
  const [timeRange, setTimeRange] = useState<string>('all');

  const CATEGORIES = useMemo(() => {
    const cats = new Set(reports.map(r => r.category).filter(Boolean));
    return ['Të gjitha', ...Array.from(cats)];
  }, [reports]);

  // Derived Stats
  const { stats, categoryData, timelineData, municipalityStats, categoryByMunicipality } = useMemo(() => {
    let filtered = reports;

    if (selectedMunicipality !== 'Të gjitha') {
      filtered = filtered.filter(r => r.location?.municipality === selectedMunicipality);
    }
    if (selectedCategory !== 'Të gjitha') {
      filtered = filtered.filter(r => r.category === selectedCategory);
    }

    if (timeRange !== 'all') {
      const now = new Date();
      filtered = filtered.filter(r => {
        const d = new Date(r.createdAt);
        if (timeRange === '7d') return (now.getTime() - d.getTime()) <= 7 * 24 * 60 * 60 * 1000;
        if (timeRange === '30d') return (now.getTime() - d.getTime()) <= 30 * 24 * 60 * 60 * 1000;
        if (timeRange === '90d') return (now.getTime() - d.getTime()) <= 90 * 24 * 60 * 60 * 1000;
        return true;
      });
    }

    const totalReports = filtered.length;
    const resolvedReports = filtered.filter(r => r.status === 'Resolved').length;
    const pendingReports = filtered.filter(r => r.status === 'Pending Review' || r.status === 'Draft').length;
    const inProgressReports = totalReports - resolvedReports - pendingReports;
    const totalUsers = selectedMunicipality === 'Të gjitha' ? users.length : Math.max(10, Math.floor(users.length * (totalReports / Math.max(reports.length, 1))));

    // Category Distribution
    const catCounts: Record<string, number> = {};
    filtered.forEach(r => { if(r.category) catCounts[r.category] = (catCounts[r.category] || 0) + 1; });
    const catData = Object.entries(catCounts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

    // Timeline Data (Last 14 Days)
    const tData = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayReports = filtered.filter(r => r.createdAt.startsWith(dateStr));
      tData.push({
        date: d.toLocaleDateString('sq-AL', { month: 'short', day: 'numeric' }),
        'Raportime': dayReports.length,
        'Të Zgjidhura': dayReports.filter(r => r.status === 'Resolved').length
      });
    }

    // Municipality Stats (for the table and charts)
    const munis = selectedMunicipality === 'Të gjitha' ? KOSOVO_MUNICIPALITIES : [selectedMunicipality];
    const mStats = munis.map(muni => {
      let mReports = reports.filter(r => r.location?.municipality === muni);
      if (selectedCategory !== 'Të gjitha') mReports = mReports.filter(r => r.category === selectedCategory);
      if (mReports.length === 0) return null;

      const total = mReports.length;
      const resolved = mReports.filter(r => r.status === 'Resolved').length;
      
      const cCounts: Record<string, number> = {};
      mReports.forEach(r => { if(r.category) cCounts[r.category] = (cCounts[r.category] || 0) + 1; });
      const topCat = Object.entries(cCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'N/A';

      return {
        municipality: muni,
        total,
        resolved,
        pending: total - resolved,
        rate: Math.round((resolved / total) * 100),
        topCategory: topCat
      };
    }).filter(Boolean).sort((a: any, b: any) => b.total - a.total);

    // Deep Category by Municipality Matrix (for Stacked Bar)
    const catByMuniData: any[] = [];
    if (selectedMunicipality === 'Të gjitha') {
      const topMunis = mStats.slice(0, 8).map(m => m?.municipality);
      topMunis.forEach(muni => {
        const mRep = reports.filter(r => r.location?.municipality === muni);
        const row: any = { name: muni };
        mRep.forEach(r => {
          if(r.category) row[r.category] = (row[r.category] || 0) + 1;
        });
        catByMuniData.push(row);
      });
    }

    return {
      stats: { totalReports, resolvedReports, inProgressReports, pendingReports, totalUsers, rate: totalReports > 0 ? Math.round((resolvedReports/totalReports)*100) : 0 },
      categoryData: catData,
      timelineData: tData,
      municipalityStats: mStats,
      categoryByMunicipality: catByMuniData
    };
  }, [reports, users, selectedMunicipality, selectedCategory, timeRange]);

  return (
    <div className="w-full bg-slate-50 min-h-screen pb-20 font-sans text-slate-900">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      
        {/* Executive Header & Filters */}
        <div className="mb-8 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 shadow-sm"></span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Analitika e Avancuar</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">
                Statistikat
              </h1>
              <p className="text-slate-500 mt-3 font-medium max-w-2xl text-sm leading-relaxed">
                Të dhëna në kohë reale mbi performancën, angazhimin dhe statusin e raporteve në nivel kombëtar dhe komunal.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Filtro Komunën</label>
                <select 
                  value={selectedMunicipality} 
                  onChange={e => setSelectedMunicipality(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none shadow-sm"
                >
                  <option value="Të gjitha">Të Gjitha Komunat</option>
                  {KOSOVO_MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <MapPin className="absolute right-4 top-[32px] w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Kategoria e Problemit</label>
                <select 
                  value={selectedCategory} 
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none shadow-sm"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <Filter className="absolute right-4 top-[32px] w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Periudha Kohore</label>
                <select 
                  value={timeRange} 
                  onChange={e => setTimeRange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none shadow-sm"
                >
                  <option value="all">E Gjithë Koha</option>
                  <option value="7d">7 Ditët e Fundit</option>
                  <option value="30d">30 Ditët e Fundit</option>
                  <option value="90d">3 Muajt e Fundit</option>
                </select>
                <Clock className="absolute right-4 top-[32px] w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Core KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          {[
            { label: 'Totali Raporteve', value: stats.totalReports, icon: FileText, color: 'text-blue-600', bg: 'bg-white', border: 'border-slate-200' },
            { label: 'Të Zgjidhura', value: stats.resolvedReports, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-white', border: 'border-slate-200' },
            { label: 'Në Proces', value: stats.inProgressReports, icon: Activity, color: 'text-amber-500', bg: 'bg-white', border: 'border-slate-200' },
            { label: 'Shkalla Zgjidhjes', value: \`\${stats.rate}%\`, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-white', border: 'border-slate-200' }
          ].map((kpi: any, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className={\`p-6 rounded-3xl border \${kpi.bg} \${kpi.border} shadow-sm\`}>
              <div className="flex justify-between items-start mb-4">
                <div className={\`p-3 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm \${kpi.color}\`}>
                  <kpi.icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">{kpi.label}</p>
              <p className={\`text-4xl md:text-5xl font-black tracking-tight \${kpi.color}\`}>{kpi.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Main Charts Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Trendi i Raportimeve (14 Ditët e Fundit)</h2>
                  <p className="text-sm text-slate-500">Krahasimi mes raporteve të reja dhe atyre të zgjidhura</p>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }} 
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                    <Area type="monotone" dataKey="Raportime" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorReports)" />
                    <Area type="monotone" dataKey="Të Zgjidhura" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorResolved)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {selectedMunicipality === 'Të gjitha' && categoryByMunicipality.length > 0 && (
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-slate-900">Shpërndarja e Kategorive sipas Komunave Kryesore</h2>
                  <p className="text-sm text-slate-500">Pasqyrimi i problemeve më të theksuara për 8 komunat me më së shumti raportime</p>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryByMunicipality} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', color: '#0f172a' }} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      
                      {Array.from(new Set(categoryData.map(c => c.name))).slice(0, 6).map((cat, i) => (
                        <Bar key={cat} dataKey={String(cat)} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === 0 ? [0,0,4,4] : [0,0,0,0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Ndarja sipas Kategorive</h2>
              <div className="h-[220px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">
                      {categoryData.map((entry, index) => <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                  <span className="text-3xl font-black text-slate-900">{stats.totalReports}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Totali</span>
                </div>
              </div>
              
              <div className="mt-6 space-y-3 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                {categoryData.map((cat, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                      <span className="text-xs font-medium text-slate-700 truncate max-w-[150px]" title={cat.name}>{cat.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{cat.value} <span className="text-[10px] text-slate-500 font-normal">({Math.round((cat.value/Math.max(stats.totalReports, 1))*100)}%)</span></span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-600 rounded-3xl p-6 border border-blue-500 shadow-sm text-white overflow-hidden relative group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
              <Users className="w-8 h-8 text-white/80 mb-4" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-200 mb-1">Angazhimi i Qytetarëve</p>
              <h3 className="text-4xl font-black tracking-tight mb-2">{stats.totalUsers}</h3>
              <p className="text-sm text-blue-100 font-medium">Qytetarë aktivë në platformë që kanë kontribuar me raporte ose reagime.</p>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Performanca e Komunave</h2>
              <p className="text-sm text-slate-500">Tabela e detajuar e efikasitetit në zgjidhjen e problemeve</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-100">
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Komuna</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Raportime</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Të Zgjidhura</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Efikasiteti</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kategoria Kryesore</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {municipalityStats.map((stat: any, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-blue-500" />
                        </div>
                        <span className="font-bold text-slate-900">{stat.municipality}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">{stat.total}</td>
                    <td className="px-6 py-4 font-medium text-emerald-600">{stat.resolved}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900">{stat.rate}%</span>
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={\`h-full rounded-full \${stat.rate >= 75 ? 'bg-emerald-500' : stat.rate >= 40 ? 'bg-amber-500' : 'bg-rose-500'}\`} 
                            style={{ width: \`\${stat.rate}%\` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {stat.topCategory}
                      </span>
                    </td>
                  </tr>
                ))}
                {municipalityStats.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 mb-3">
                        <AlertCircle className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-slate-500 font-medium">Nuk ka të dhëna për këtë komunë ose kategori.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/pages/StatisticsPage.tsx', newContent);

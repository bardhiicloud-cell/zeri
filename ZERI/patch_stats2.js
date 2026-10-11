import fs from 'fs';
let content = fs.readFileSync('src/pages/StatisticsPage.tsx', 'utf8');

const oldKPIs = `      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        {[
          { label: 'Totali i Dosjeve', value: stats.totalReports, icon: Activity, color: 'text-slate-900', bg: 'bg-white', border: 'border-slate-200' },
          { label: 'Raste të Zgjidhura', value: stats.resolvedReports, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          { label: 'Në Procedim', value: stats.inProgressReports, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Efikasiteti', value: \`\${stats.rate}%\`, icon: Award, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className={\`p-6 rounded-3xl border \${kpi.bg} \${kpi.border} shadow-sm relative overflow-hidden group\`}>
            <div className="flex justify-between items-start mb-4">
              <div className={\`p-3 rounded-2xl bg-white/50 backdrop-blur-md border border-white/20 shadow-sm \${kpi.color}\`}>
                <kpi.icon className="w-6 h-6" />
              </div>
            </div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">{kpi.label}</p>
            <p className={\`text-4xl md:text-5xl font-extrabold title-serif tracking-tight \${kpi.color}\`}>{kpi.value}</p>
          </motion.div>
        ))}
      </div>`;

const newKPIs = `      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        {[
          { label: 'Totali i Dosjeve', value: stats.totalReports, icon: Activity, color: 'text-white', bg: 'bg-white/5', border: 'border-white/10' },
          { label: 'Raste të Zgjidhura', value: stats.resolvedReports, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          { label: 'Në Procedim', value: stats.inProgressReports, icon: TrendingUp, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
          { label: 'Efikasiteti', value: \`\${stats.rate}%\`, icon: Award, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className={\`p-6 rounded-3xl border \${kpi.bg} \${kpi.border} shadow-2xl relative overflow-hidden group backdrop-blur-md\`}>
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={\`p-3 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-inner \${kpi.color}\`}>
                <kpi.icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1 relative z-10">{kpi.label}</p>
            <p className={\`text-4xl md:text-5xl font-black tracking-tight relative z-10 \${kpi.color}\`}>{kpi.value}</p>
          </motion.div>
        ))}
      </div>`;

content = content.replace(oldKPIs, newKPIs);

// Chart containers replacement
content = content.replace(/bg-white rounded-3xl p-6 border border-slate-200 shadow-sm/g, 'bg-white/5 rounded-3xl p-6 border border-white/10 shadow-2xl backdrop-blur-md');
content = content.replace(/text-slate-900/g, 'text-white');
content = content.replace(/text-slate-500/g, 'text-slate-400');
content = content.replace(/stroke="#f1f5f9"/g, 'stroke="#ffffff15"');
content = content.replace(/fill: '#64748b'/g, "fill: '#94a3b8'");
content = content.replace(/fill: '#f8fafc'/g, "fill: '#ffffff0a'");
content = content.replace(/boxShadow: '0 4px 6px -1px rgb\(0 0 0 \/ 0\.1\)'/g, "boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)'");
content = content.replace(/contentStyle=\{\{ borderRadius: '12px', border: 'none'/g, "contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.8)'");

fs.writeFileSync('src/pages/StatisticsPage.tsx', content);

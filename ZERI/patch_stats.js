import fs from 'fs';
let content = fs.readFileSync('src/pages/StatisticsPage.tsx', 'utf8');

// Replace the main container classes
content = content.replace(
  /<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 bg-slate-50 min-h-screen">/,
  '<div className="w-full bg-[#0a0a0a] min-h-screen pb-20 font-sans selection:bg-indigo-500/30 text-slate-200"><div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">'
);

// Replace Header & Filters
content = content.replace(
  /<div className="mb-8 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">/,
  '<div className="mb-8 bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden"><div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"></div>'
);

content = content.replace(
  /<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"><\/span>/,
  '<span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.8)]"></span>'
);

content = content.replace(
  /<h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight title-serif">/,
  '<h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">'
);

content = content.replace(
  /<span className="text-emerald-600">Statistikat<\/span>/,
  '<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Statistikat</span>'
);

content = content.replace(
  /<p className="text-slate-500 mt-2 font-medium max-w-2xl text-sm leading-relaxed">/,
  '<p className="text-slate-400 mt-3 font-medium max-w-2xl text-sm leading-relaxed">'
);

// Filters
const filterRegex = /<select[\s\S]*?<\/select>/g;
let match;
let i = 0;
content = content.replace(filterRegex, (match) => {
  return match.replace(
    /className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500\/20 appearance-none"/,
    'className="w-full bg-black/40 border border-white/10 text-white text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 appearance-none shadow-inner"'
  );
});

content = content.replace(/text-slate-500 uppercase tracking-widest/g, "text-slate-400 uppercase tracking-widest");

// KPIs
const kpiRegex = /\{\[\s*\{ label: 'Totali i Dosjeve'[\s\S]*?\}\]\.map\(\(kpi, i\) => \([\s\S]*?<\/motion\.div>\s*\)\)\}/;
const newKPIs = `
        {[
          { label: 'Totali i Dosjeve', value: stats.totalReports, icon: Activity, color: 'text-white', bg: 'bg-white/5', border: 'border-white/10' },
          { label: 'Raste të Zgjidhura', value: stats.resolvedReports, icon: CheckCircle2, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
          { label: 'Në Procedim', value: stats.inProgressReports, icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
          { label: 'Efikasiteti', value: \`\${stats.rate}%\`, icon: Award, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className={\`p-6 rounded-3xl border \${kpi.bg} \${kpi.border} shadow-2xl relative overflow-hidden group backdrop-blur-md\`}>
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors"></div>
            <div className="flex justify-between items-start mb-4">
              <div className={\`p-3 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-inner \${kpi.color}\`}>
                <kpi.icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">{kpi.label}</p>
            <p className={\`text-4xl md:text-5xl font-black tracking-tight \${kpi.color}\`}>{kpi.value}</p>
          </motion.div>
        ))}
`;
content = content.replace(kpiRegex, newKPIs.trim());

fs.writeFileSync('src/pages/StatisticsPage.tsx', content);

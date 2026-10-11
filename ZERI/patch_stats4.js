import fs from 'fs';
let content = fs.readFileSync('src/pages/StatisticsPage.tsx', 'utf8');

// The Table Section
const oldTable = `<div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-white">Raporti i Detajuar Rajonal</h2>
            <p className="text-xs text-slate-400 font-medium">Të dhëna të plota për secilën komunë të regjistruar</p>
          </div>
          <button className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-colors">
            <Download className="w-4 h-4" /> Eksporto
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Komuna</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Raste Totale</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Zgjidhura</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Problemi Dominant</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 w-48">Norma e Zgjidhjes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.municipalityStats.map((muni: any, index: number) => (
                <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-slate-400" />
                      </div>
                      <span className="font-bold text-white text-sm">{muni.municipality}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-slate-700">{muni.total}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">{muni.resolved}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-slate-200">
                      {muni.topCategory}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className={\`h-full rounded-full \${muni.rate > 70 ? 'bg-emerald-500' : muni.rate > 40 ? 'bg-amber-500' : 'bg-rose-500'}\`}
                          style={{ width: \`\${muni.rate}%\` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-slate-600 w-10 text-right">{muni.rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {stats.municipalityStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Filter className="w-8 h-8 text-slate-300 mb-3" />
                      <p className="text-slate-400 font-medium text-sm">Nuk ka të dhëna për kriteret e zgjedhura.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>`;

const newTable = `<div className="bg-white/5 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md overflow-hidden">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
          <div>
            <h2 className="text-lg font-bold text-white">Raporti i Detajuar Rajonal</h2>
            <p className="text-xs text-slate-400 font-medium">Të dhëna të plota për secilën komunë të regjistruar</p>
          </div>
          <button className="px-4 py-2 bg-white/10 border border-white/20 hover:bg-white/20 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-colors">
            <Download className="w-4 h-4" /> Eksporto
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-black/40">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/10">Komuna</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/10 text-right">Raste Totale</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/10 text-right">Zgjidhura</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/10">Problemi Dominant</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/10 w-48">Norma e Zgjidhjes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {stats.municipalityStats.map((muni: any, index: number) => (
                <tr key={index} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-slate-400" />
                      </div>
                      <span className="font-bold text-white text-sm">{muni.municipality}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-white/80">{muni.total}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-emerald-400">{muni.resolved}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-white/10 text-white/80 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-white/10">
                      {muni.topCategory}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 bg-white/10 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className={\`h-full rounded-full \${muni.rate > 70 ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : muni.rate > 40 ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]' : 'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.8)]'}\`}
                          style={{ width: \`\${muni.rate}%\` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white w-10 text-right">{muni.rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {stats.municipalityStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Filter className="w-8 h-8 text-white/20 mb-3" />
                      <p className="text-slate-400 font-medium text-sm">Nuk ka të dhëna për kriteret e zgjedhura.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>`;

content = content.replace(oldTable, newTable);
content = content.replace(/text-slate-600/g, 'text-slate-300');
fs.writeFileSync('src/pages/StatisticsPage.tsx', content);

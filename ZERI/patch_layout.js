import fs from 'fs';

let content = fs.readFileSync('src/pages/ForumPage.tsx', 'utf8');

// Change left sidebar from col-span-4 to col-span-3
content = content.replace(/className="hidden lg:block lg:col-span-4/g, 'className="hidden lg:block lg:col-span-3');

// Change middle column from lg:col-span-8 to lg:col-span-6
content = content.replace(/className="col-span-1 lg:col-span-8 space-y-6 w-full/g, 'className="col-span-1 lg:col-span-6 space-y-6 w-full');

// Add right sidebar after the main column closing div
const rightSidebar = `
        {/* Right Sidebar (Groups & Friends) */}
        <div className="hidden lg:block lg:col-span-3 sticky top-[72px] h-[calc(100vh-140px)] overflow-y-auto hide-scrollbar pb-6 space-y-6 pt-1">
          {/* My Groups */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-[15px] font-bold text-slate-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              Grupet e Mia
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Zhvillimi Ekonomik</h4>
                  <p className="text-[12px] text-slate-500">1.2k anëtarë • 2 postime të reja</p>
                </div>
              </div>
              <div className="flex items-center gap-3 cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 group-hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/></svg>
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Aktivistët e Qytetit</h4>
                  <p className="text-[12px] text-slate-500">845 anëtarë • 5 postime të reja</p>
                </div>
              </div>
              <div className="flex items-center gap-3 cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Rinia & Inovacioni</h4>
                  <p className="text-[12px] text-slate-500">2.5k anëtarë</p>
                </div>
              </div>
            </div>
            <button className="mt-5 w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors border border-slate-200">Shiko të gjitha</button>
          </div>

          {/* Friends Activity */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-[15px] font-bold text-slate-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Miqtë Aktivë
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-500 text-sm">AG</div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-slate-900">Arben Gashi</h4>
                  <p className="text-[12px] text-slate-500">Duke raportuar një problem</p>
                </div>
              </div>
              <div className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-500 text-sm">MB</div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-slate-900">Mimoza Bytyqi</h4>
                  <p className="text-[12px] text-slate-500">Komentoi në Debat</p>
                </div>
              </div>
              <div className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-500 text-sm">EK</div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-slate-900">Enver Krasniqi</h4>
                  <p className="text-[12px] text-slate-500">Online</p>
                </div>
              </div>
            </div>
          </div>
        </div>
`;

// Insert the right sidebar right before the final closing div of the grid
const gridEndRegex = /(<\/\s*div>\s*<\/\s*div>\s*<LegalModal)/;
if (gridEndRegex.test(content)) {
  content = content.replace(gridEndRegex, `  ${rightSidebar}\n$1`);
  fs.writeFileSync('src/pages/ForumPage.tsx', content);
  console.log('Layout patched');
} else {
  console.log('Failed to patch layout');
}

import fs from 'fs';

let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

const navCode = `
      {/* Bottom Navigation for Reels */}
      <div className="absolute bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-black/80 backdrop-blur-xl border-t border-white/10 z-[120] pb-safe">
        <div className="flex items-center justify-between px-6 py-3">
          <button className="flex flex-col items-center gap-1 text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span className="text-[10px] font-bold">Kryefaqja</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-white/60 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <span className="text-[10px] font-bold">Zbulo</span>
          </button>
          <button onClick={() => { if(requireAuth()) setShowCreate(true); }} className="w-12 h-8 bg-gradient-to-r from-cyan-400 to-[#fe2c55] rounded-xl flex items-center justify-center -translate-y-2 cursor-pointer shadow-[0_0_15px_rgba(254,44,85,0.3)]">
            <div className="bg-white w-[calc(100%-4px)] h-[calc(100%-4px)] rounded-[10px] flex items-center justify-center text-black">
              <Plus className="w-5 h-5 font-bold" />
            </div>
          </button>
          <button className="flex flex-col items-center gap-1 text-white/60 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span className="text-[10px] font-bold">Mesazhet</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-white/60 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span className="text-[10px] font-bold">Profili</span>
          </button>
        </div>
      </div>
`;

// Inject before the end of the main container but after comments modal
content = content.replace(/<\/div>\s*<\/div>\s*\)\s*;\s*\}\s*;\s*const ReelItem/m, `${navCode}\n      </div>\n    </div>\n  );\n};\n\nconst ReelItem`);

fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);

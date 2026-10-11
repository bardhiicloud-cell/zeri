import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

// Add state for activeReelsTab
content = content.replace(
  "const [isPhoto, setIsPhoto] = useState(false);",
  "const [isPhoto, setIsPhoto] = useState(false);\n  const [activeReelsTab, setActiveReelsTab] = useState<'kryefaqja' | 'miqte' | 'inbox' | 'profili'>('kryefaqja');"
);

// We need to render the feed only if activeReelsTab === 'kryefaqja'
// The feed container:
const feedContainerRegex = /<div className="flex-1 w-full max-w-\[480px\] mx-auto h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar pb-\[70px\]">/;

content = content.replace(
  feedContainerRegex,
  `{activeReelsTab === 'kryefaqja' && (
        <div className="flex-1 w-full max-w-[480px] mx-auto h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar pb-[70px]">`
);

// We need to close it and add other tabs
const endOfFeedRegex = /<\/div>\n\n\s*\{\/\* TikTok-style Comments Modal \*\/\}/;
content = content.replace(
  endOfFeedRegex,
  `</div>
      )}

      {activeReelsTab === 'miqte' && (
        <div className="flex-1 w-full max-w-[480px] mx-auto h-full overflow-y-auto pb-[70px] bg-black text-white p-4">
          <div className="pt-20 flex flex-col items-center justify-center h-full opacity-50">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <p className="font-bold text-lg">Miqtë</p>
            <p className="text-sm mt-2 text-center text-white/70">Këtu do të shfaqen videot e miqve tuaj.</p>
          </div>
        </div>
      )}

      {activeReelsTab === 'inbox' && (
        <div className="flex-1 w-full max-w-[480px] mx-auto h-full overflow-y-auto pb-[70px] bg-black text-white p-4">
          <div className="pt-20 flex flex-col items-center justify-center h-full opacity-50">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <p className="font-bold text-lg">Inbox</p>
            <p className="text-sm mt-2 text-center text-white/70">Mesazhet dhe njoftimet tuaja.</p>
          </div>
        </div>
      )}

      {activeReelsTab === 'profili' && (
        <div className="flex-1 w-full max-w-[480px] mx-auto h-full overflow-y-auto pb-[70px] bg-black text-white p-4">
          <div className="pt-20 flex flex-col items-center justify-center h-full opacity-50">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <p className="font-bold text-lg">Profili</p>
            <p className="text-sm mt-2 text-center text-white/70">Reels dhe videot tuaja të postuara.</p>
          </div>
        </div>
      )}

      {/* TikTok-style Comments Modal */}`
);

// Update bottom navigation to set activeReelsTab
const bottomNavRegexRe = /\{\/\* Bottom Navigation for Reels \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\};\s*$/;

const newBottomNav = `{/* Bottom Navigation for Reels */}
      <div className="absolute bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-black border-t border-white/10 z-[120] pb-safe">
        <div className="flex items-center justify-between px-6 py-2">
          <button onClick={() => setActiveReelsTab('kryefaqja')} className={\`flex flex-col items-center gap-1 \${activeReelsTab === 'kryefaqja' ? 'text-white' : 'text-white/50 hover:text-white'}\`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span className="text-[10px] font-bold">Kryefaqja</span>
          </button>
          
          <button onClick={() => setActiveReelsTab('miqte')} className={\`flex flex-col items-center gap-1 \${activeReelsTab === 'miqte' ? 'text-white' : 'text-white/50 hover:text-white'}\`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span className="text-[10px] font-bold">Miqtë</span>
          </button>
          
          <button onClick={() => { if(requireAuth()) setShowCreate(true); }} className="w-12 h-8 bg-gradient-to-r from-cyan-400 to-[#fe2c55] rounded-xl flex items-center justify-center cursor-pointer">
            <div className="bg-white w-[calc(100%-4px)] h-[calc(100%-4px)] rounded-[10px] flex items-center justify-center text-black">
              <Plus className="w-5 h-5 font-bold" />
            </div>
          </button>
          
          <button onClick={() => setActiveReelsTab('inbox')} className={\`flex flex-col items-center gap-1 \${activeReelsTab === 'inbox' ? 'text-white' : 'text-white/50 hover:text-white'}\`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span className="text-[10px] font-bold">Inbox</span>
          </button>
          
          <button onClick={() => setActiveReelsTab('profili')} className={\`flex flex-col items-center gap-1 \${activeReelsTab === 'profili' ? 'text-white' : 'text-white/50 hover:text-white'}\`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span className="text-[10px] font-bold">Profili</span>
          </button>
        </div>
      </div>
    </div>
  );
};
`;

content = content.replace(bottomNavRegexRe, newBottomNav);
fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);

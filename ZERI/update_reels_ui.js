import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

const regexMiqte = /\{activeReelsTab === 'miqte' && \([\s\S]*?\}\)/;
const replacementMiqte = `{activeReelsTab === 'miqte' && (
        <div className="flex-1 w-full max-w-[480px] mx-auto h-full overflow-hidden bg-black text-white relative">
          <div className="absolute top-0 left-0 right-0 p-4 pt-12 z-10 flex justify-between items-center pointer-events-none">
             <div className="flex-1"></div>
             <div className="flex-1 flex justify-center items-center gap-4 text-lg font-bold drop-shadow-md">
                <button onClick={() => setActiveReelsTab('miqte')} className="text-white">Miqtë</button>
             </div>
             <div className="flex-1 flex justify-end">
                <Search className="w-6 h-6 drop-shadow-md pointer-events-auto" />
             </div>
          </div>
          <div className="h-full w-full flex items-center justify-center flex-col p-8 text-center bg-zinc-900/40">
             <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center mb-6">
               <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
             </div>
             <h3 className="text-xl font-bold mb-2">Lidhu me miqtë</h3>
             <p className="text-white/60 text-sm mb-6">Shiko videot më të fundit nga miqtë tuaj në Reels.</p>
             <button className="w-full bg-[#fe2c55] text-white py-3.5 rounded-lg font-bold text-[15px]">
               Gjej miq
             </button>
          </div>
        </div>
      )}`;

content = content.replace(regexMiqte, replacementMiqte);

const regexInbox = /\{activeReelsTab === 'inbox' && \([\s\S]*?\}\)/;
const replacementInbox = `{activeReelsTab === 'inbox' && (
        <div className="flex-1 w-full max-w-[480px] mx-auto h-full overflow-y-auto pb-[70px] bg-black text-white">
          <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 p-4 pt-10 flex justify-between items-center border-b border-white/10">
            <div className="flex-1"></div>
            <h2 className="text-lg font-bold flex-1 text-center">Inbox</h2>
            <div className="flex-1 flex justify-end">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </div>
          </div>
          <div className="p-4 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center relative">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#fe2c55] rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-black">3</div>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm">Ndjekës të rinj</h4>
                <p className="text-xs text-white/50 mt-0.5">Filan dhe 2 të tjerë filluan t'ju ndjekin.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#fe2c55]/20 flex items-center justify-center">
                <Heart className="w-6 h-6 text-[#fe2c55]" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm">Aktiviteti</h4>
                <p className="text-xs text-white/50 mt-0.5">Pëlqime, komente dhe përmendje.</p>
              </div>
            </div>

            <h3 className="font-bold text-white mt-6 mb-4">Mesazhet</h3>
            <div className="flex flex-col items-center justify-center py-10 opacity-60">
               <p className="text-sm">Nuk ka mesazhe.</p>
            </div>
          </div>
        </div>
      )}`;

content = content.replace(regexInbox, replacementInbox);

const regexProfili = /\{activeReelsTab === 'profili' && \([\s\S]*?\}\)/;
const replacementProfili = `{activeReelsTab === 'profili' && (
        <div className="flex-1 w-full max-w-[480px] mx-auto h-full overflow-y-auto pb-[70px] bg-black text-white">
          <div className="sticky top-0 bg-black/90 backdrop-blur-md z-10 p-4 pt-10 flex justify-between items-center">
            <div className="flex flex-1 items-center gap-2">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-4"/></svg>
            </div>
            <div className="flex items-center gap-1 flex-2 justify-center cursor-pointer">
              <h2 className="text-base font-bold truncate max-w-[150px]">{currentUser ? currentUser.name : 'Profili im'}</h2>
              <ChevronDown className="w-4 h-4" />
            </div>
            <div className="flex flex-1 justify-end items-center gap-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="18" y2="18"/></svg>
            </div>
          </div>

          <div className="flex flex-col items-center px-4 pt-4 pb-6 border-b border-white/10">
            <div className="w-24 h-24 rounded-full bg-slate-800 border-[1.5px] border-white/20 mb-3 overflow-hidden flex items-center justify-center">
               {currentUser?.photoURL ? <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" /> : <span className="text-3xl font-bold">{currentUser?.name?.substring(0,2) || 'UN'}</span>}
            </div>
            <h3 className="font-bold text-lg mb-4">@{currentUser ? currentUser.name.toLowerCase().replace(/ /g, '') : 'username'}</h3>
            
            <div className="flex items-center gap-6 mb-4">
              <div className="flex flex-col items-center"><span className="font-bold text-[17px]">12</span><span className="text-xs text-white/60">Duke ndjekur</span></div>
              <div className="flex flex-col items-center"><span className="font-bold text-[17px]">450</span><span className="text-xs text-white/60">Ndjekës</span></div>
              <div className="flex flex-col items-center"><span className="font-bold text-[17px]">2.1k</span><span className="text-xs text-white/60">Pëlqime</span></div>
            </div>
            
            <div className="flex items-center gap-2 w-full max-w-[250px]">
              <button className="flex-1 bg-white/10 hover:bg-white/20 py-2.5 rounded-lg font-bold text-[15px] transition-colors border border-white/5">Ndrysho</button>
              <button className="flex-1 bg-white/10 hover:bg-white/20 py-2.5 rounded-lg font-bold text-[15px] transition-colors border border-white/5">Ndaj profilin</button>
            </div>
          </div>

          <div className="flex items-center justify-around border-b border-white/10">
            <button className="flex-1 py-3 flex justify-center border-b-2 border-white text-white">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>
            </button>
            <button className="flex-1 py-3 flex justify-center border-b-2 border-transparent text-white/50">
               <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </button>
            <button className="flex-1 py-3 flex justify-center border-b-2 border-transparent text-white/50">
               <Heart className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-0.5 mt-0.5">
             {/* Map over user's reels. For now, empty state or mock ones */}
             {reels.filter(r => r.authorId === currentUser?.id).length > 0 ? (
                reels.filter(r => r.authorId === currentUser?.id).map(r => (
                  <div key={r.id} className="aspect-[3/4] bg-zinc-900 relative">
                     {r.mediaUrl?.includes('.mp4') ? (
                       <video src={r.mediaUrl} className="w-full h-full object-cover" />
                     ) : (
                       <img src={r.mediaUrl} className="w-full h-full object-cover" />
                     )}
                     <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[11px] font-bold">
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                       {Math.floor(Math.random() * 500) + 10}
                     </div>
                  </div>
                ))
             ) : (
               <div className="col-span-3 py-16 flex flex-col items-center opacity-60">
                 <p className="text-sm font-bold">Nuk keni asnjë postim ende.</p>
               </div>
             )}
          </div>
        </div>
      )}`;

content = content.replace(regexProfili, replacementProfili);

fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);

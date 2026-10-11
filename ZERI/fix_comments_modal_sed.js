import fs from 'fs';
let lines = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8').split('\n');

const commentsModalStr = `
      {/* Comments Modal */}
      {activeCommentsReel && (
        <div className="absolute inset-0 z-[200] bg-black/60 flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-white text-black w-full max-w-[480px] mx-auto rounded-t-2xl h-[70vh] flex flex-col animate-in slide-in-from-bottom-full duration-300">
             <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-center flex-1 text-[15px]">{activeCommentsReel.comments?.length || 0} komente</h3>
                <button onClick={() => setActiveCommentsReel(null)} className="p-1"><X className="w-6 h-6"/></button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
               {(!activeCommentsReel.comments || activeCommentsReel.comments.length === 0) ? (
                 <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <MessageCircle className="w-12 h-12 mb-2 opacity-20" />
                    <p className="font-bold">Bëhu i pari që komenton.</p>
                 </div>
               ) : (
                 activeCommentsReel.comments.map((c: any) => (
                   <div key={c.id} className="flex gap-3">
                     <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-500 text-xs">
                        {c.authorName?.substring(0,2)}
                     </div>
                     <div className="flex-1">
                        <p className="text-[13px] font-bold text-slate-500 mb-0.5">{c.authorName}</p>
                        <p className="text-[14px] leading-snug">{c.content}</p>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500 font-bold">
                           <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                           <button>Përgjigju</button>
                        </div>
                     </div>
                     <div className="flex flex-col items-center text-slate-400">
                        <Heart className="w-4 h-4 mb-1" />
                     </div>
                   </div>
                 ))
               )}
             </div>
             <div className="p-4 border-t border-slate-100 flex gap-3 items-center">
               <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-500 text-xs">
                 {currentUser ? currentUser.name?.substring(0,2) : 'U'}
               </div>
               <form 
                 onSubmit={(e) => {
                   e.preventDefault();
                   if (!requireAuth()) return;
                   if (!newComment.trim()) return;
                   
                   const newC = {
                     id: Date.now().toString(),
                     content: newComment,
                     authorId: currentUser.id,
                     authorName: currentUser.name,
                     createdAt: new Date().toISOString(),
                   };
                   
                   const updatedComments = [...(activeCommentsReel.comments || []), newC];
                   
                   // Update store
                   useStore.getState().updateReel(activeCommentsReel.id, { comments: updatedComments });
                   
                   setActiveCommentsReel({ ...activeCommentsReel, comments: updatedComments });
                   setNewComment('');
                 }}
                 className="flex-1 flex bg-slate-100 rounded-full px-4 py-2.5"
               >
                 <input
                    type="text"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Shto komentin tënd..."
                    className="flex-1 bg-transparent border-none text-[14px] outline-none placeholder-slate-500"
                  />
                 <button
                    type="submit"
                    disabled={!newComment.trim()}
                    className="text-[#fe2c55] font-bold text-[14px] disabled:opacity-50 ml-2"
                 >
                   Posto
                 </button>
               </form>
             </div>
          </div>
        </div>
      )}
`;

// lines 277 to 302 inclusive (index 276 to 301)
lines.splice(276, 27, commentsModalStr);

fs.writeFileSync('src/components/forum/ReelsTab.tsx', lines.join('\n'));

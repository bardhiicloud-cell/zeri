const fs = require('fs');
let code = fs.readFileSync('src/pages/ForumPage.tsx', 'utf8');

// Replace the wrapper of the feed
code = code.replace(
  /<div className="max-w-xl mx-auto w-full border-x border-slate-200 dark:border-slate-200 dark:border-zinc-800\/80 min-h-full pb-32">/g,
  `<div className="max-w-6xl mx-auto w-full min-h-full pb-32 px-4 flex gap-6">
    {/* Left Sidebar */}
    <div className="hidden lg:block w-64 shrink-0 mt-4">
      <div className="sticky top-28 bg-white dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
        <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">{dt(\`Kategoritë\`)}</h3>
        <div className="flex flex-col gap-2">
          {FORUM_CATEGORIES.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setActiveCategoryFilter(cat.id)}
              className={\`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold transition-all \${activeCategoryFilter === cat.id ? 'bg-slate-900 text-white dark:bg-white dark:text-black' : 'hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-zinc-900'}\`}
            >
              {dt(cat.name)}
              {activeCategoryFilter === cat.id && <ChevronRight className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </div>
    </div>
    
    {/* Main Feed */}
    <div className="flex-1 max-w-xl w-full mx-auto border-x border-slate-200 dark:border-zinc-800/80 min-h-full">`
);

// Close the wrapper of the feed at the end
code = code.replace(
  /<\/div>\s*<\/div>\s*\}\)\s*\{\s*activeTab === 'reels'/g,
  `</div>
      {/* Right Sidebar */}
      <div className="hidden xl:block w-72 shrink-0 mt-4">
        <div className="sticky top-28 bg-white dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">{dt(\`Trending & Rregullat\`)}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-4">{dt(\`Ky është debati publik qendror. Sigurohuni që të mbani një gjuhë profesionale, pa fyerje dhe të përqendruar te zgjidhjet.\`)}</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-indigo-500" />
              <div className="text-xs font-bold">{dt(\`Zero tolerancë për gjuhë urrejtjeje\`)}</div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl">
              <Users className="w-5 h-5 text-emerald-500" />
              <div className="text-xs font-bold">{dt(\`Diskutime me interes publik\`)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
{activeTab === 'reels'`
);

fs.writeFileSync('src/pages/ForumPage.tsx', code);
console.log("Patched ForumPage.tsx");

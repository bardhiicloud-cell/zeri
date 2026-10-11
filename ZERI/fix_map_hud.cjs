const fs = require('fs');
let content = fs.readFileSync('src/pages/MapPage.tsx', 'utf-8');

// Replace 1: Header texts
content = content.replace(
  'h2 className="font-bold text-sm md:text-base tracking-wide leading-none text-[var(--color-text)] dark:text-[var(--color-surface)]"',
  'h2 className="font-bold text-sm md:text-base tracking-wide leading-none text-white"'
);
content = content.replace(
  'p className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-300 mt-1 tracking-normal"',
  'p className="text-xs font-bold text-slate-300 mt-1 tracking-normal"'
);

// Replace 2: map_search_city label
content = content.replace(
  'label className="text-xs font-bold text-[var(--color-text)] dark:text-[var(--color-surface)] tracking-wide ml-1"',
  'label className="text-xs font-bold text-white tracking-wide ml-1"'
);

// Replace 3: Filter by Neighborhood label
content = content.replace(
  'label className="text-xs font-bold text-[var(--color-text)] dark:text-[var(--color-surface)] tracking-wide ml-1 flex items-center gap-1"',
  'label className="text-xs font-bold text-white tracking-wide ml-1 flex items-center gap-1"'
);

// Replace 4: Neighborhood select
content = content.replace(
  'className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-[var(--color-text)] dark:text-[var(--color-surface)] text-sm md:text-xs outline-none transition-all focus:bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:focus:bg-slate-900 cursor-pointer tracking-wide"',
  'className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl font-bold text-white text-sm md:text-xs outline-none transition-all focus:border-white focus:ring-1 focus:ring-white cursor-pointer tracking-wide appearance-none"'
);

// Replace 5: Buttons
// There are two buttons with this exact class
content = content.replace(
  /className="flex-1 py-3 bg-neutral-50 dark:bg-slate-900\/50 border border-slate-200 dark:border-white\/10 rounded-xl font-bold text-xs tracking-wide hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center gap-2"/g,
  'className="flex-1 py-3 bg-white/10 border border-white/10 rounded-xl font-bold text-xs text-white tracking-wide hover:bg-white/20 transition-all flex items-center justify-center gap-2"'
);

// Fix wrapper text color just in case
content = content.replace(
  'className="flex items-center gap-3 text-[var(--color-text)] dark:text-[var(--color-surface)]"',
  'className="flex items-center gap-3 text-white"'
);

fs.writeFileSync('src/pages/MapPage.tsx', content);

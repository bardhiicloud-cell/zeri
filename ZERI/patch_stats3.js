import fs from 'fs';
let content = fs.readFileSync('src/pages/StatisticsPage.tsx', 'utf8');

// Replace table related slate classes
content = content.replace(/border-slate-100/g, 'border-white/10');
content = content.replace(/border-slate-200/g, 'border-white/10');
content = content.replace(/bg-slate-50\/50/g, 'bg-white/5');
content = content.replace(/bg-slate-50/g, 'bg-white/5');
content = content.replace(/bg-slate-100/g, 'bg-white/10');
content = content.replace(/text-slate-700/g, 'text-white');
content = content.replace(/bg-white/g, 'bg-transparent'); // Be careful, but since we already replaced main bg-white... wait
// Actually, let's just do targeted replace for the table section.

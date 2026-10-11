import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

content = content.replace(/onClick=\{\(\) => navigate\('\/'\)\}/g, '');
content = content.replace(/onClick=\{\(\) => navigate\('\/forum'\)\}/g, '');
content = content.replace(/onClick=\{\(\) => navigate\('\/raporto'\)\}/g, '');
content = content.replace(/onClick=\{\(\) => navigate\('\/harta'\)\}/g, '');

content = content.replace(
  /<span className="text-\[10px\] font-bold">Debati Publik<\/span>/,
  '<span className="text-[10px] font-bold">Miqtë</span>'
);

content = content.replace(
  /<span className="text-\[10px\] font-bold">Raporto<\/span>/,
  '<span className="text-[10px] font-bold">Inbox</span>'
);

content = content.replace(
  /<span className="text-\[10px\] font-bold">Harta<\/span>/,
  '<span className="text-[10px] font-bold">Profili</span>'
);

// We need to restore original TikTok icons.
// For Home:
// <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
//
// For Friends:
// <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
//
// For Inbox:
// <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
//
// For Profile:
// <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>

content = content.replace(
  /<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"\/><line x1="12" y1="8" x2="12" y2="16"\/><line x1="8" y1="12" x2="16" y2="12"\/><\/svg>/,
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
);

content = content.replace(
  /<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"\/><line x1="9" y1="3" x2="9" y2="21"\/><line x1="15" y1="3" x2="15" y2="21"\/><\/svg>/,
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
);

fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);

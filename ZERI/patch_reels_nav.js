import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

// Add useNavigate import if not exists
if (!content.includes("useNavigate")) {
  content = content.replace("import { Heart", "import { useNavigate } from 'react-router-dom';\nimport { Heart");
}

// Inside ReelsTab component, add navigate
content = content.replace("export const ReelsTab = ({ requireAuth, currentUser, onClose }: { requireAuth: () => boolean, currentUser: any, onClose?: () => void }) => {", "export const ReelsTab = ({ requireAuth, currentUser, onClose }: { requireAuth: () => boolean, currentUser: any, onClose?: () => void }) => {\n  const navigate = useNavigate();");

// Replace buttons with proper onClick navigation
content = content.replace(
  "<button className=\"flex flex-col items-center gap-1 text-white\">",
  "<button onClick={() => navigate('/')} className=\"flex flex-col items-center gap-1 text-white/60 hover:text-white\">"
);
content = content.replace(
  /<button className="flex flex-col items-center gap-1 text-white\/60 hover:text-white">\s*<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"\/><path d="m21 21-4.3-4.3"\/><\/svg>\s*<span className="text-\[10px\] font-bold">Zbulo<\/span>\s*<\/button>/,
  `<button onClick={() => navigate('/forum')} className="flex flex-col items-center gap-1 text-white/60 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span className="text-[10px] font-bold">Debati Publik</span>
          </button>`
);

content = content.replace(
  /<button className="flex flex-col items-center gap-1 text-white\/60 hover:text-white">\s*<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"\/><\/svg>\s*<span className="text-\[10px\] font-bold">Mesazhet<\/span>\s*<\/button>/,
  `<button onClick={() => navigate('/raporto')} className="flex flex-col items-center gap-1 text-white/60 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            <span className="text-[10px] font-bold">Raporto</span>
          </button>`
);

content = content.replace(
  /<button className="flex flex-col items-center gap-1 text-white\/60 hover:text-white">\s*<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"\/><circle cx="12" cy="7" r="4"\/><\/svg>\s*<span className="text-\[10px\] font-bold">Profili<\/span>\s*<\/button>/,
  `<button onClick={() => navigate('/harta')} className="flex flex-col items-center gap-1 text-white/60 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            <span className="text-[10px] font-bold">Harta</span>
          </button>`
);

fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);

import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

// Move the create button to the top header instead of the bottom nav
content = content.replace(
  /<div className="pointer-events-auto">\s*\{!showCreate && \(\s*<button onClick=\{\(\) => \{ if\(requireAuth\(\)\) setShowCreate\(true\); \}\} className="w-10 h-10 bg-black\/20 hover:bg-black\/40 backdrop-blur-md rounded-full flex items-center justify-center transition-all text-white border border-white\/10 shadow-lg">\s*<Camera className="w-5 h-5" \/>\s*<\/button>\s*\)\}\s*<\/div>/,
  `<div className="pointer-events-auto">
           {!showCreate && (
             <button onClick={() => { if(requireAuth()) setShowCreate(true); }} className="w-10 h-10 bg-[#fe2c55] hover:bg-[#e62a4d] backdrop-blur-md rounded-full flex items-center justify-center transition-all text-white shadow-[0_0_15px_rgba(254,44,85,0.4)]">
               <Plus className="w-6 h-6" />
             </button>
           )}
        </div>`
);

// Remove the bottom navigation entirely
const bottomNavRegex = /\{\/\* Bottom Navigation for Reels \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\};\s*$/;
content = content.replace(bottomNavRegex, `      </div>\n    </div>\n  );\n};\n`);

// Also fix the upload UI for professional look
// The user says "sistemi postimi me upload foto video me muzik hstags si tik tok copy paste"
// The upload UI is already updated, but I will make sure it looks very pro.

fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);

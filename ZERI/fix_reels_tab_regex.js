import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

// Remove the stray )}
content = content.replace(
  `          )}
        </div>
      )}

      {activeReelsTab === 'miqte' && (`,
  `          )}
        </div>

      {activeReelsTab === 'miqte' && (`
);

// Now wrap the feed with activeReelsTab
content = content.replace(
  `      {/* Main Reels Feed */}
      <div className="h-[100dvh] w-full max-w-[480px] bg-black overflow-hidden relative">`,
  `      {/* Main Reels Feed */}
      {activeReelsTab === 'kryefaqja' && (
      <div className="h-[100dvh] w-full max-w-[480px] bg-black overflow-hidden relative">`
);

// Add the closing tag for kryefaqja BEFORE {activeReelsTab === 'miqte'
content = content.replace(
  `      {activeReelsTab === 'miqte' && (`,
  `      )}
      
      {activeReelsTab === 'miqte' && (`
);

fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);

import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

const oldPhoto = `<div className="w-full h-full flex items-center justify-center bg-black">
          <img 
            src={mediaSource} 
            alt="Reel content" 
            className="w-full h-auto max-h-full object-contain"
            onError={(e) => e.currentTarget.style.display = 'none'}
          />
        </div>`;

const newPhoto = `<div className="w-full h-full flex items-center justify-center bg-black">
          {reel.music && <audio ref={audioRef} src={getMusicUrl(reel.music)} loop />}
          <img 
            src={mediaSource} 
            alt="Reel content" 
            className="w-full h-auto max-h-full object-contain"
            onError={(e) => e.currentTarget.style.display = 'none'}
          />
        </div>`;

content = content.replace(oldPhoto, newPhoto);
fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);

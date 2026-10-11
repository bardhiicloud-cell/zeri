import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

const invalidVideo = `      ) : (
        {reel.music && <audio ref={audioRef} src={getMusicUrl(reel.music)} loop />}
        <video 
          ref={videoRef} 
          src={mediaSource} 
          className="w-full h-full object-cover"
          muted={muted || !!reel.music}
          loop
          playsInline
          muted={muted}
        />
      )}`;

const validVideo = `      ) : (
        <>
          {reel.music && <audio ref={audioRef} src={getMusicUrl(reel.music)} loop />}
          <video 
            ref={videoRef} 
            src={mediaSource} 
            className="w-full h-full object-cover"
            muted={muted || !!reel.music}
            loop
            playsInline
          />
        </>
      )}`;

content = content.replace(invalidVideo, validVideo);
fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);

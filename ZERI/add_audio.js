import fs from 'fs';
let content = fs.readFileSync('src/components/forum/ReelsTab.tsx', 'utf8');

const audioMap = `
const MUSIC_TRACKS: Record<string, string> = {
  "Original Sound - Trending": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  "Dua Lipa - Houdini": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  "Elvana Gjata - Pow": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  "Dafina Zeqiri - Si Mua": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  "Ghetto Geasy - Moti": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
  "Bebe Rexha - I'm Good": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
  "Noizy - JENA MBRET": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
  "Loredana - Intro": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  "Epic Cinematic Background": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
  "Funny Comedy Sound": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3"
};

const getMusicUrl = (musicName: string) => {
  if (!musicName) return null;
  return MUSIC_TRACKS[musicName] || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
};
`;

content = content.replace("export default function ReelsTab({ requireAuth, currentUser }: any) {", audioMap + "\nexport default function ReelsTab({ requireAuth, currentUser }: any) {");

// Add audioRef to ReelItem
content = content.replace(
  "const videoRef = useRef<HTMLVideoElement>(null);",
  "const videoRef = useRef<HTMLVideoElement>(null);\n  const audioRef = useRef<HTMLAudioElement>(null);"
);

// Update useEffect in ReelItem
const oldEffect = `  useEffect(() => {
    if (!isPhoto) {
      if (isActive && videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(e => console.log('Autoplay prevented'));
      } else if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  }, [isActive, isPhoto]);`;

const newEffect = `  useEffect(() => {
    if (!isPhoto) {
      if (isActive && videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(e => console.log('Autoplay prevented'));
      } else if (videoRef.current) {
        videoRef.current.pause();
      }
    }
    
    if (isActive && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.muted = muted;
      audioRef.current.play().catch(e => console.log('Audio autoplay prevented'));
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [isActive, isPhoto, muted]);`;

content = content.replace(oldEffect, newEffect);

// Add audio element to render
const photoRenderRegex = /<img src=\{mediaSource\} alt="Reel" className="w-full h-full object-cover" \/>/;
content = content.replace(photoRenderRegex, `<img src={mediaSource} alt="Reel" className="w-full h-full object-cover" />
        {reel.music && <audio ref={audioRef} src={getMusicUrl(reel.music)} loop />}`);

const videoRenderRegex = /<video\s*ref=\{videoRef\}\s*src=\{mediaSource\}\s*className="w-full h-full object-cover"/;
content = content.replace(videoRenderRegex, `{reel.music && <audio ref={audioRef} src={getMusicUrl(reel.music)} loop />}
        <video 
          ref={videoRef} 
          src={mediaSource} 
          className="w-full h-full object-cover"
          muted={muted || !!reel.music}`); // mute video if we have separate music

fs.writeFileSync('src/components/forum/ReelsTab.tsx', content);

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Music2, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import type { HeritageLang } from '../../lib/heritage/types';
import { PLAYLIST, hasEmbed, searchUrl, type Track } from '../../lib/heritage/playlist';

type Phase = 'hidden' | 'invite' | 'dock';
const KEY = 'hx-uck-music';

interface YTPlayer { loadVideoById(id: string): void; playVideo(): void; pauseVideo(): void; destroy(): void }
interface YTApi { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer }
declare global { interface Window { YT?: YTApi; onYouTubeIframeAPIReady?: () => void } }

let apiPromise: Promise<YTApi> | null = null;
function loadYouTube(): Promise<YTApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<YTApi>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT!); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => { apiPromise = null; reject(new Error('youtube')); };
    document.head.appendChild(s);
  });
  return apiPromise;
}

const read = (): string | null => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
const write = (v: string) => { try { sessionStorage.setItem(KEY, v); } catch { /* private mode: the question simply returns next visit */ } };

/**
 * Asks once whether to play the music of the liberation war; on "yes" a slim player docks at the bottom
 * with play/pause, previous/next and an X that removes it. Playback starts from the click, so browsers allow sound.
 */
export function MusicDock({ lang, tracks = PLAYLIST }: { lang: HeritageLang; tracks?: readonly Track[] }) {
  const sq = lang === 'sq';
  const [phase, setPhase] = useState<Phase>('hidden');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const embed = hasEmbed(tracks);
  const queue = embed ? tracks.filter((t) => t.videoId) : tracks;
  const track = queue[index % queue.length];

  useEffect(() => {
    if (read()) return;
    const t = window.setTimeout(() => setPhase('invite'), 1800);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => () => { player.current?.destroy(); player.current = null; }, []);

  const start = useCallback(async () => {
    write('yes');
    setPhase('dock');
    if (!embed) return;
    try {
      const YT = await loadYouTube();
      if (!host.current) return;
      const mount = document.createElement('div');
      host.current.appendChild(mount);
      player.current = new YT.Player(mount, {
        height: '1', width: '1', videoId: queue[0].videoId,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: (e: { target: YTPlayer }) => { e.target.playVideo(); setPlaying(true); },
          onStateChange: (e: { data: number }) => {
            if (e.data === 1) setPlaying(true);
            if (e.data === 2) setPlaying(false);
            if (e.data === 0) setIndex((i) => (i + 1) % queue.length);
          },
        },
      });
    } catch { setPlaying(false); }
  }, [embed, queue]);

  useEffect(() => { if (player.current && track?.videoId) player.current.loadVideoById(track.videoId); }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => { if (!player.current) return; if (playing) player.current.pauseVideo(); else player.current.playVideo(); };
  const step = (d: number) => setIndex((i) => (i + d + queue.length) % queue.length);
  const close = () => { player.current?.destroy(); player.current = null; setPlaying(false); write('closed'); setPhase('hidden'); };
  const decline = () => { write('no'); setPhase('hidden'); };

  if (phase === 'hidden') return null;

  return (
    <div className="hx-dock" role="region" aria-label={sq ? 'Muzika e luftës' : 'Music of the war'}>
      {phase === 'invite' && (
        <div className="hx-dock-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#c8102e] text-white"><Music2 className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <p className="hx-serif text-lg font-black leading-snug">
                {sq ? 'A do ta përjetosh muzikën e luftës së pastër të Ushtrisë Çlirimtare të Kosovës?' : 'Would you like to experience the music of the Kosovo Liberation Army’s just war?'}
              </p>
              <p className="mt-1 text-xs text-white/65">{sq ? 'Luhet nga YouTube. Mund ta ndalosh kur të duash.' : 'Plays from YouTube. You can stop it at any time.'}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={start} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#c8102e] px-4 text-sm font-black text-white transition hover:bg-[#e0132f]">
                  <Play className="h-4 w-4" aria-hidden="true" />{sq ? 'Po, luaje' : 'Yes, play it'}
                </button>
                <button type="button" onClick={decline} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 px-4 text-sm font-bold text-white/85 transition hover:bg-white/10">
                  {sq ? 'Jo, faleminderit' : 'No, thanks'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {phase === 'dock' && (
        <div className="hx-dock-card flex items-center gap-3 p-3 pr-2">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#c8102e]" aria-hidden="true">
            <span className="hx-eq flex h-4 items-end gap-0.5" data-paused={!playing}><span /><span /><span /></span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{track.title}</p>
            <p className="truncate text-xs text-white/65">{track.artist}</p>
          </div>
          {embed ? (
            <>
              <button type="button" onClick={() => step(-1)} aria-label={sq ? 'Kënga e mëparshme' : 'Previous track'} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"><SkipBack className="h-4 w-4" /></button>
              <button type="button" onClick={toggle} aria-label={playing ? (sq ? 'Ndalo' : 'Pause') : (sq ? 'Luaj' : 'Play')} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#160a0c] transition hover:scale-105">
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button type="button" onClick={() => step(1)} aria-label={sq ? 'Kënga tjetër' : 'Next track'} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"><SkipForward className="h-4 w-4" /></button>
            </>
          ) : (
            <a href={searchUrl(track)} target="_blank" rel="noreferrer" aria-label={sq ? 'Hap në YouTube' : 'Open on YouTube'} className="flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-black text-[#160a0c]">
              <Play className="h-4 w-4" aria-hidden="true" />YouTube<ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
          <button type="button" onClick={close} aria-label={sq ? 'Mbyll muzikën' : 'Close the music'} className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
      )}
      <div ref={host} className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true" />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Image as ImageIcon, Music2, Pause, Play, Scissors, SlidersHorizontal, Trash2, Volume2, VolumeX } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { getAudioCatalog } from '../../lib/audioCatalog';
import {
  REEL_FILTERS, REEL_MAX_TRIM_SEC, REEL_MIN_TRIM_SEC, audioTitleFromFile, clampTrim, filterById, formatClock, validateAudioFile,
  type EditState, type EditorSupport,
} from '../../lib/reelEditor';

interface Props {
  previewUrl: string;
  duration: number;
  edit: EditState;
  onChange: (next: EditState) => void;
  support: EditorSupport;
  disabled?: boolean;
  /** The composer reads the cover frame from this element. */
  videoRef: RefObject<HTMLVideoElement | null>;
}

type Tab = 'trim' | 'filters' | 'music' | 'cover';
const TABS: { id: Tab; label: string; icon: typeof Scissors }[] = [
  { id: 'trim', label: 'Prerje', icon: Scissors },
  { id: 'filters', label: 'Filtra', icon: SlidersHorizontal },
  { id: 'music', label: 'Muzikë', icon: Music2 },
  { id: 'cover', label: 'Kopertina', icon: ImageIcon },
];

/**
 * Editor for one video. Every control changes what gets exported: trim range,
 * filter, music (with offset and volume), original-sound volume and the cover
 * frame. When the browser cannot re-encode, the controls are shown disabled with
 * the reason instead of pretending to work.
 */
export function ReelEditor({ previewUrl, duration, edit, onChange, support, disabled, videoRef }: Props) {
  const [tab, setTab] = useState<Tab>('trim');
  const [playing, setPlaying] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioLength, setAudioLength] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const catalog = getAudioCatalog();
  const filter = filterById(edit.filterId);

  const musicUrl = useMemo(() => (edit.music ? URL.createObjectURL(edit.music.file) : null), [edit.music?.file]);
  useEffect(() => () => { if (musicUrl) URL.revokeObjectURL(musicUrl); }, [musicUrl]);

  const set = (patch: Partial<EditState>) => onChange({ ...edit, ...patch });

  // Keep the preview inside the trim range and the music in step with the video.
  const syncAudio = () => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v || !a || !edit.music) return;
    const expected = edit.music.offsetSec + Math.max(0, v.currentTime - edit.trimStart);
    if (Math.abs(a.currentTime - expected) > 0.3) a.currentTime = Math.min(expected, a.duration || expected);
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime >= edit.trimEnd - 0.03 || v.currentTime < edit.trimStart - 0.3) {
      v.currentTime = edit.trimStart;
      syncAudio();
    }
    if (audioRef.current && !v.paused) syncAudio();
  };

  useEffect(() => {
    const v = videoRef.current;
    if (v) { v.volume = edit.originalVolume; v.muted = !soundOn; }
    const a = audioRef.current;
    if (a && edit.music) { a.volume = edit.music.volume; a.muted = !soundOn; }
  }, [edit.originalVolume, edit.music?.volume, soundOn, musicUrl]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < edit.trimStart || v.currentTime >= edit.trimEnd) v.currentTime = edit.trimStart;
      void v.play().catch(() => undefined);
      syncAudio();
      void audioRef.current?.play().catch(() => undefined);
      setPlaying(true);
    } else {
      v.pause();
      audioRef.current?.pause();
      setPlaying(false);
    }
  };

  const seekPreview = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    audioRef.current?.pause();
    setPlaying(false);
    v.currentTime = t;
  };

  const changeTrim = (which: 'start' | 'end', value: number) => {
    const next = which === 'start'
      ? clampTrim(value, edit.trimEnd, duration, 'start')
      : clampTrim(edit.trimStart, value, duration, 'end');
    set({
      trimStart: next.start,
      trimEnd: next.end,
      coverTime: Math.min(Math.max(edit.coverTime, next.start), next.end),
    });
    seekPreview(which === 'start' ? next.start : Math.max(next.start, next.end - 0.1));
  };

  const pickMusic = (file: File | undefined) => {
    if (!file) return;
    const error = validateAudioFile(file);
    setAudioError(error);
    if (error) return;
    setAudioLength(0);
    set({ music: { file, offsetSec: 0, volume: 0.7 }, musicRightsConfirmed: false });
  };

  const exportOff = !support.export;
  const cannot = disabled || exportOff;
  const range = 'w-full accent-blue-600 disabled:opacity-50';

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-[9/16] max-h-[48dvh] overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          src={previewUrl}
          playsInline
          muted={!soundOn}
          loop={false}
          onTimeUpdate={onTimeUpdate}
          onEnded={() => { if (videoRef.current) { videoRef.current.currentTime = edit.trimStart; } setPlaying(false); }}
          onClick={togglePlay}
          style={{ filter: filter.css === 'none' ? undefined : filter.css }}
          className="h-full w-full cursor-pointer object-contain"
        />
        {musicUrl && <audio ref={audioRef} src={musicUrl} preload="auto" onLoadedMetadata={(e) => setAudioLength(e.currentTarget.duration || 0)} />}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-2 text-white">
          <button type="button" onClick={togglePlay} aria-label={playing ? dt('Pauzë') : dt('Luaj')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            {playing ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
          </button>
          <span className="text-xs font-bold tabular-nums">{formatClock(edit.trimEnd - edit.trimStart)}</span>
          <button type="button" onClick={() => setSoundOn((s) => !s)} aria-pressed={soundOn} aria-label={soundOn ? dt('Hiq zërin e parapamjes') : dt('Ndiz zërin e parapamjes')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            {soundOn ? <Volume2 className="h-5 w-5" aria-hidden="true" /> : <VolumeX className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {exportOff && (
        <p role="note" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {dt('Ky shfletues nuk mund ta përpunojë videon, ndaj prerja, filtrat dhe muzika janë joaktive. Videoja do të publikohet siç është. Provoni Chrome, Edge ose Firefox.')}
        </p>
      )}

      <div role="tablist" aria-label={dt('Mjetet e redaktimit')} className="grid grid-cols-4 rounded-xl bg-slate-100 p-1 text-xs font-bold dark:bg-zinc-800">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg transition ${tab === id ? 'bg-white text-blue-700 shadow-sm dark:bg-zinc-900 dark:text-blue-300' : 'text-slate-500'}`}>
            <Icon className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">{dt(label)}</span>
          </button>
        ))}
      </div>

      {tab === 'trim' && (
        <div role="tabpanel" className="space-y-3 text-xs">
          <label className="block">
            <span className="flex justify-between font-bold"><span>{dt('Fillimi')}</span><span className="tabular-nums">{formatClock(edit.trimStart)}</span></span>
            <input type="range" min={0} max={duration} step={0.1} value={edit.trimStart} disabled={cannot} className={range}
              onChange={(e) => changeTrim('start', Number(e.target.value))} aria-label={dt('Fillimi i videos')} />
          </label>
          <label className="block">
            <span className="flex justify-between font-bold"><span>{dt('Fundi')}</span><span className="tabular-nums">{formatClock(edit.trimEnd)}</span></span>
            <input type="range" min={0} max={duration} step={0.1} value={edit.trimEnd} disabled={cannot} className={range}
              onChange={(e) => changeTrim('end', Number(e.target.value))} aria-label={dt('Fundi i videos')} />
          </label>
          <p className="text-slate-500 dark:text-slate-400">
            {dt('Gjatësia e re')}: {(edit.trimEnd - edit.trimStart).toFixed(1)} s · {dt('minimumi')} {REEL_MIN_TRIM_SEC} s, {dt('maksimumi')} {REEL_MAX_TRIM_SEC} s.
          </p>
        </div>
      )}

      {tab === 'filters' && (
        <div role="tabpanel" className="space-y-2">
          {!support.filters && (
            <p role="note" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {dt('Ky shfletues nuk i zbaton filtrat në video të eksportuar, ndaj janë joaktive. Provoni Chrome, Edge ose Firefox.')}
            </p>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="radiogroup" aria-label={dt('Filtrat')}>
            {REEL_FILTERS.map((f) => {
              const off = cannot || (!support.filters && f.id !== 'original');
              return (
                <button key={f.id} type="button" role="radio" aria-checked={edit.filterId === f.id} disabled={off}
                  onClick={() => set({ filterId: f.id })}
                  className={`shrink-0 rounded-xl border-2 p-1 text-center text-[11px] font-bold transition disabled:opacity-40 ${edit.filterId === f.id ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-slate-500'}`}>
                  <span className="mb-1 block h-14 w-14 rounded-lg bg-gradient-to-br from-rose-400 via-amber-300 to-sky-400" style={{ filter: f.css === 'none' ? undefined : f.css }} />
                  {dt(f.label)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'music' && (
        <div role="tabpanel" className="space-y-3 text-xs">
          {catalog ? (
            <p className="text-slate-500">{dt('Katalogu')}: {catalog.name}</p>
          ) : (
            <p role="note" className="rounded-xl bg-slate-50 p-3 text-slate-600 dark:bg-zinc-800 dark:text-slate-300">
              {dt('Nuk ka katalog muzikor të licencuar të lidhur. Shtoni audio që e zotëroni ose keni leje ta përdorni.')}
            </p>
          )}

          {!edit.music ? (
            <label className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-3 text-sm font-bold text-blue-700 dark:border-zinc-700 dark:text-blue-300 ${cannot ? 'pointer-events-none opacity-50' : ''}`}>
              <Music2 className="h-4 w-4" aria-hidden="true" /> {dt('Shto audio (MP3, WAV, OGG, M4A, deri 15 MB)')}
              <input type="file" accept="audio/*" className="hidden" disabled={cannot}
                onChange={(e) => { pickMusic(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-zinc-700">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate font-black">♪ {audioTitleFromFile(edit.music.file.name)}</p>
                <button type="button" onClick={() => set({ music: null, musicRightsConfirmed: false })} aria-label={dt('Hiq muzikën')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <label className="block">
                <span className="flex justify-between font-bold"><span>{dt('Nis muzikën nga')}</span><span className="tabular-nums">{formatClock(edit.music.offsetSec)}</span></span>
                <input type="range" min={0} max={Math.max(0, Math.floor(audioLength) - 1)} step={0.5} value={edit.music.offsetSec} disabled={cannot || audioLength === 0} className={range}
                  onChange={(e) => { set({ music: { ...edit.music!, offsetSec: Number(e.target.value) } }); seekPreview(edit.trimStart); }} aria-label={dt('Pozita e fillimit të muzikës')} />
              </label>
              <label className="block">
                <span className="flex justify-between font-bold"><span>{dt('Volumi i muzikës')}</span><span>{Math.round(edit.music.volume * 100)}%</span></span>
                <input type="range" min={0} max={1} step={0.05} value={edit.music.volume} disabled={cannot} className={range}
                  onChange={(e) => set({ music: { ...edit.music!, volume: Number(e.target.value) } })} aria-label={dt('Volumi i muzikës')} />
              </label>
              <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <input type="checkbox" className="mt-0.5" checked={edit.musicRightsConfirmed} onChange={(e) => set({ musicRightsConfirmed: e.target.checked })} />
                <span>{dt('Konfirmoj që e zotëroj këtë audio ose kam leje ta përdor në një video publike. Emri i saj do të shfaqet si kredit.')}</span>
              </label>
            </div>
          )}
          {audioError && <p role="alert" className="font-semibold text-rose-600">{audioError}</p>}

          <label className="block">
            <span className="flex justify-between font-bold"><span>{dt('Zëri origjinal i videos')}</span><span>{Math.round(edit.originalVolume * 100)}%</span></span>
            <input type="range" min={0} max={1} step={0.05} value={edit.originalVolume} disabled={cannot} className={range}
              onChange={(e) => set({ originalVolume: Number(e.target.value) })} aria-label={dt('Zëri origjinal')} />
          </label>
          <button type="button" disabled={cannot} onClick={() => set({ originalVolume: edit.originalVolume === 0 ? 1 : 0 })}
            className="rounded-full border border-slate-300 px-3 py-1.5 font-bold disabled:opacity-50 dark:border-zinc-700">
            {edit.originalVolume === 0 ? dt('Rikthe zërin origjinal') : dt('Heshto zërin origjinal')}
          </button>
        </div>
      )}

      {tab === 'cover' && (
        <div role="tabpanel" className="space-y-2 text-xs">
          <label className="block">
            <span className="flex justify-between font-bold"><span>{dt('Kuadri i kopertinës')}</span><span className="tabular-nums">{formatClock(edit.coverTime)}</span></span>
            <input type="range" min={edit.trimStart} max={edit.trimEnd} step={0.1} value={Math.min(Math.max(edit.coverTime, edit.trimStart), edit.trimEnd)}
              disabled={disabled} className={range} aria-label={dt('Kuadri i kopertinës')}
              onChange={(e) => { const t = Number(e.target.value); set({ coverTime: t }); seekPreview(t); }} />
          </label>
          <p className="text-slate-500 dark:text-slate-400">{dt('Kopertina shfaqet para se videoja të luajë dhe në rrjetën e profilit.')}</p>
        </div>
      )}
    </div>
  );
}

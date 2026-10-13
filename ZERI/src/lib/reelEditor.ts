/**
 * Reel editing: trim, colour filters, an optional music track and a cover frame.
 *
 * What is REAL here: the edit is baked into the file that gets uploaded. The
 * export plays the chosen range of the video through a canvas (applying the
 * filter to every frame), mixes the original audio and the music with Web
 * Audio, and records the result with MediaRecorder. So trim, filter, volumes
 * and music all end up in the published video, not just in a preview overlay.
 *
 * Honest limits: it re-encodes in real time (a 30 s clip takes about 30 s) and
 * the tab must stay open; output is WebM (VP8/VP9); output is capped at 720 px
 * on the long side; canvas filters need a browser that supports `ctx.filter`
 * (Chrome, Edge, Firefox; not Safari), so filters are disabled where it is
 * missing. Photos-to-slideshow, split/reorder of clips and voice-over are not
 * implemented.
 */

export const REEL_EXPORT_MAX_SIDE = 720;
export const REEL_EXPORT_VIDEO_BPS = 2_000_000;
export const REEL_EXPORT_AUDIO_BPS = 128_000;
export const REEL_MIN_TRIM_SEC = 1;
export const REEL_MAX_TRIM_SEC = 90;
export const AUDIO_MAX_BYTES = 15 * 1024 * 1024;
export const AUDIO_ALLOWED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/webm'] as const;

export interface ReelFilter {
  id: string;
  label: string;
  /** A CSS filter string: used for the live preview and for `ctx.filter` in the export. */
  css: string;
}

export const REEL_FILTERS: readonly ReelFilter[] = [
  { id: 'original', label: 'Origjinale', css: 'none' },
  { id: 'warm', label: 'Ngrohtë', css: 'sepia(0.25) saturate(1.3) hue-rotate(-8deg) brightness(1.05)' },
  { id: 'cool', label: 'Ftohtë', css: 'saturate(1.1) hue-rotate(12deg) brightness(1.02) contrast(1.05)' },
  { id: 'cinematic', label: 'Kinematik', css: 'contrast(1.2) saturate(0.85) brightness(0.92) sepia(0.12)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.55) contrast(0.95) saturate(0.85) brightness(1.05)' },
  { id: 'bw', label: 'E bardhë & e zezë', css: 'grayscale(1) contrast(1.1)' },
  { id: 'contrast', label: 'Kontrast', css: 'contrast(1.35) saturate(1.1)' },
  { id: 'soft', label: 'E butë', css: 'brightness(1.08) contrast(0.88) saturate(0.95) blur(0.4px)' },
];

export const filterById = (id: string): ReelFilter => REEL_FILTERS.find((f) => f.id === id) ?? REEL_FILTERS[0];

/**
 * Keeps a trim range inside the video, at least `min` and at most `max` seconds
 * long, with start before end. `moved` says which handle the user dragged so
 * the other one yields instead of the dragged one snapping back.
 */
export function clampTrim(
  start: number, end: number, duration: number,
  moved: 'start' | 'end' = 'end', min = REEL_MIN_TRIM_SEC, max = REEL_MAX_TRIM_SEC,
): { start: number; end: number } {
  const total = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const lo = Math.max(0, Math.min(Number.isFinite(start) ? start : 0, total));
  const hi = Math.max(0, Math.min(Number.isFinite(end) ? end : total, total));
  const minLen = Math.min(min, total);
  const maxLen = Math.min(max, total);
  let s = lo;
  let e = hi;
  if (moved === 'start') {
    if (e - s < minLen) s = Math.max(0, e - minLen);
    if (e - s > maxLen) s = e - maxLen;
    if (e - s < minLen) e = Math.min(total, s + minLen);
  } else {
    if (e - s < minLen) e = Math.min(total, s + minLen);
    if (e - s > maxLen) e = s + maxLen;
    if (e - s < minLen) s = Math.max(0, e - minLen);
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { start: r(s), end: r(e) };
}

export interface EditState {
  trimStart: number;
  trimEnd: number;
  filterId: string;
  music: { file: File; offsetSec: number; volume: number } | null;
  originalVolume: number; // 0 mutes the original audio
  coverTime: number; // seconds into the ORIGINAL video
  musicRightsConfirmed: boolean;
}

export const defaultEdit = (duration: number): EditState => ({
  trimStart: 0,
  trimEnd: Math.min(duration, REEL_MAX_TRIM_SEC),
  filterId: 'original',
  music: null,
  originalVolume: 1,
  coverTime: 0,
  musicRightsConfirmed: false,
});

/** True when the file must be re-encoded; otherwise the original is uploaded untouched. */
export function needsExport(edit: EditState, duration: number): boolean {
  return (
    edit.trimStart > 0.05 ||
    edit.trimEnd < duration - 0.05 ||
    edit.filterId !== 'original' ||
    edit.music !== null ||
    edit.originalVolume !== 1
  );
}

export function trimmedDuration(edit: EditState): number {
  return Math.max(0, Math.round((edit.trimEnd - edit.trimStart) * 100) / 100);
}

/** Scales to a long side of `maxSide` (never up) and rounds to even numbers, which encoders need. */
export function outputSize(width: number, height: number, maxSide = REEL_EXPORT_MAX_SIDE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: even(width), height: even(height) };
}

/** First container/codec the browser can record, preferring VP9, or null when none works. */
export function pickRecorderMime(isSupported: (type: string) => boolean): string | null {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((t) => isSupported(t)) ?? null;
}

export function validateAudioFile(file: { type: string; size: number } | null | undefined): string | null {
  if (!file) return 'Zgjidhni një skedar audio.';
  if (!(AUDIO_ALLOWED_TYPES as readonly string[]).includes(file.type)) return `Formati "${file.type || 'i panjohur'}" nuk lejohet. Lejohen MP3, WAV, OGG, M4A ose AAC.`;
  if (file.size <= 0) return 'Skedari audio është bosh.';
  if (file.size > AUDIO_MAX_BYTES) return `Audio është ${(file.size / 1024 / 1024).toFixed(1)} MB; kufiri është 15 MB.`;
  return null;
}

/** A short, display-safe track name from a file name. */
export function audioTitleFromFile(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Audio';
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Everything the editor needs from the browser, so unsupported ones can be switched off with a reason. */
export interface EditorSupport {
  export: boolean;
  filters: boolean;
}

export function detectEditorSupport(): EditorSupport {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') return { export: false, filters: false };
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const canCapture = typeof (canvas as HTMLCanvasElement & { captureStream?: unknown }).captureStream === 'function';
  const hasAudio = typeof AudioContext !== 'undefined';
  const mime = pickRecorderMime((t) => MediaRecorder.isTypeSupported(t));
  return { export: !!ctx && canCapture && hasAudio && !!mime, filters: !!ctx && 'filter' in ctx };
}

const once = (el: EventTarget, type: string, errorType = 'error') =>
  new Promise<void>((resolve, reject) => {
    const ok = () => { cleanup(); resolve(); };
    const bad = () => { cleanup(); reject(new Error('Video nuk u lexua.')); };
    const cleanup = () => { el.removeEventListener(type, ok); el.removeEventListener(errorType, bad); };
    el.addEventListener(type, ok, { once: true });
    el.addEventListener(errorType, bad, { once: true });
  });

export interface ExportOptions {
  file: File;
  start: number;
  end: number;
  filterCss: string;
  originalVolume: number;
  music?: { file: File; offsetSec: number; volume: number } | null;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export class ExportCancelled extends Error {
  constructor() { super('Përpunimi u anulua.'); this.name = 'ExportCancelled'; }
}

/**
 * Plays [start, end] of the video through a canvas and records it with the
 * filter and the mixed audio applied. Resolves with a WebM blob.
 */
export async function exportEditedReel(o: ExportOptions): Promise<Blob> {
  const url = URL.createObjectURL(o.file);
  const video = document.createElement('video');
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  let audioCtx: AudioContext | null = null;
  let timer: number | undefined;
  try {
    await once(video, 'loadedmetadata');
    const { width, height } = outputSize(video.videoWidth, video.videoHeight);
    if (!width || !height) throw new Error('Video nuk ka dimensione të vlefshme.');

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas nuk mbështetet.');

    audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    const original = audioCtx.createGain();
    original.gain.value = Math.max(0, Math.min(1, o.originalVolume));
    // Routed ONLY into the recorder: the user hears nothing while exporting.
    audioCtx.createMediaElementSource(video).connect(original).connect(dest);

    let musicNode: AudioBufferSourceNode | null = null;
    if (o.music) {
      const buffer = await audioCtx.decodeAudioData(await o.music.file.arrayBuffer());
      musicNode = audioCtx.createBufferSource();
      musicNode.buffer = buffer;
      const gain = audioCtx.createGain();
      gain.gain.value = Math.max(0, Math.min(1, o.music.volume));
      musicNode.connect(gain).connect(dest);
    }

    const mime = pickRecorderMime((t) => MediaRecorder.isTypeSupported(t));
    if (!mime) throw new Error('Ky shfletues nuk mund të regjistrojë video.');
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const recorder = new MediaRecorder(stream, {
      mimeType: mime, videoBitsPerSecond: REEL_EXPORT_VIDEO_BPS, audioBitsPerSecond: REEL_EXPORT_AUDIO_BPS,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

    video.currentTime = Math.max(0, o.start);
    await once(video, 'seeked');
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    ctx.filter = o.filterCss || 'none';
    const drawFrame = () => ctx.drawImage(video, 0, 0, width, height);
    drawFrame();
    recorder.start(250);
    musicNode?.start(0, Math.max(0, o.music?.offsetSec ?? 0));
    await video.play();

    const span = Math.max(0.1, o.end - o.start);
    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (o.signal?.aborted) { reject(new ExportCancelled()); return; }
        drawFrame();
        o.onProgress?.(Math.max(0, Math.min(1, (video.currentTime - o.start) / span)));
        if (video.currentTime >= o.end || video.ended) resolve();
      };
      // A timer, not requestAnimationFrame: rAF stops in a background tab.
      timer = window.setInterval(tick, 1000 / 30);
    });

    video.pause();
    try { musicNode?.stop(); } catch { /* already stopped */ }
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;
    o.onProgress?.(1);
    return new Blob(chunks, { type: mime.split(';')[0] });
  } finally {
    if (timer !== undefined) window.clearInterval(timer);
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
    if (audioCtx && audioCtx.state !== 'closed') void audioCtx.close();
  }
}

/** One frame of `video` at `time` (with the filter) as a JPEG, for the cover. */
export async function captureCoverFrame(video: HTMLVideoElement, time: number, filterCss: string): Promise<Blob> {
  const { width, height } = outputSize(video.videoWidth, video.videoHeight);
  if (!width || !height) throw new Error('Video nuk është gati.');
  const previous = video.currentTime;
  const wasPlaying = !video.paused;
  video.pause();
  video.currentTime = time;
  await once(video, 'seeked');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nuk mbështetet.');
  ctx.filter = filterCss || 'none';
  ctx.drawImage(video, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  video.currentTime = previous;
  if (wasPlaying) void video.play().catch(() => undefined);
  if (!blob) throw new Error('Kopertina nuk u krijua.');
  return blob;
}

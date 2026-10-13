import { useEffect, useRef, useState } from 'react';
import { Film, Loader2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { UploadTask } from 'firebase/storage';
import { dt } from '@/src/lib/dt';
import {
  REEL_CAPTION_MAX,
  REEL_MAX_DURATION_SEC,
  extractHashtags,
  normalizeCaption,
  publishReel,
  readVideoDuration,
  validateReelDuration,
  validateReelFile,
} from '../../lib/reels';
import {
  ExportCancelled,
  audioTitleFromFile,
  captureCoverFrame,
  defaultEdit,
  detectEditorSupport,
  exportEditedReel,
  filterById,
  needsExport,
  trimmedDuration,
  type EditState,
} from '../../lib/reelEditor';
import { ReelEditor } from './ReelEditor';

interface ReelComposerProps {
  author: { id: string; name: string; avatar?: string | null };
  onClose: () => void;
  onPublished: (reelId: string) => void;
}

type Phase = 'idle' | 'checking' | 'processing' | 'uploading' | 'error';

/**
 * Create a Reel from one vertical video: pick or drop it, edit it (trim, filter,
 * music, cover), write a caption, publish.
 *
 * Edits are baked into the uploaded file (see lib/reelEditor.ts). Not
 * implemented: photo slideshows, splitting or reordering clips, voice-over,
 * transitions and text overlays. They are not shown as controls.
 */
export function ReelComposer({ author, onClose, onPublished }: ReelComposerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [caption, setCaption] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [support] = useState(detectEditorSupport);
  const taskRef = useRef<UploadTask | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const submittingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => { dialogRef.current?.focus(); }, []);

  const busy = phase === 'checking' || phase === 'processing' || phase === 'uploading';

  const requestClose = () => {
    if (phase === 'processing') { abortRef.current?.abort(); return; }
    if (phase === 'uploading') { taskRef.current?.cancel(); return; } // the publish promise rejects and resets the phase
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const choose = async (picked: File | undefined) => {
    if (!picked || busy) return;
    setError(null);
    const fileError = validateReelFile(picked);
    if (fileError) { setError(fileError); return; }
    setPhase('checking');
    const seconds = await readVideoDuration(picked);
    // The file may be longer than 90 s when the author will trim it; the limit applies to the result.
    const durationError = validateReelDuration(Math.min(seconds, REEL_MAX_DURATION_SEC));
    if (Number.isNaN(seconds) || durationError) { setError(durationError ?? 'Kohëzgjatja e videos nuk mund të lexohet.'); setPhase('idle'); return; }
    if (seconds > REEL_MAX_DURATION_SEC + 0.5 && !support.export) {
      setError(`Video zgjat ${Math.round(seconds)} sekonda dhe ky shfletues nuk mund ta presë. Kufiri është ${REEL_MAX_DURATION_SEC} sekonda.`);
      setPhase('idle');
      return;
    }
    setFile(picked);
    setDuration(seconds);
    setEdit(defaultEdit(seconds));
    setPreviewUrl(URL.createObjectURL(picked));
    setPhase('idle');
  };

  const { error: captionError } = normalizeCaption(caption);
  const hashtags = extractHashtags(caption);
  const musicBlocked = !!edit?.music && !edit.musicRightsConfirmed;
  const canPublish = !!file && duration !== null && !!edit && !captionError && !musicBlocked && !busy;

  const publish = async () => {
    if (!canPublish || !file || duration === null || !edit || submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    try {
      let finalFile = file;
      let finalDuration = duration;
      const exporting = support.export && needsExport(edit, duration);

      if (exporting) {
        setPhase('processing');
        setProgress(0);
        abortRef.current = new AbortController();
        const blob = await exportEditedReel({
          file,
          start: edit.trimStart,
          end: edit.trimEnd,
          filterCss: filterById(edit.filterId).css,
          originalVolume: edit.originalVolume,
          music: edit.music,
          onProgress: setProgress,
          signal: abortRef.current.signal,
        });
        finalFile = new File([blob], 'reel.webm', { type: blob.type || 'video/webm' });
        finalDuration = trimmedDuration(edit);
        const sizeError = validateReelFile(finalFile);
        if (sizeError) throw new Error(`${sizeError} Shkurtoni videon ose heqni muzikën.`);
      } else if (duration > REEL_MAX_DURATION_SEC + 0.5) {
        throw new Error(`Video zgjat më shumë se ${REEL_MAX_DURATION_SEC} sekonda. Shkurtojeni te skeda Prerje.`);
      }

      // The cover is best effort: a reel without one still publishes.
      let cover: Blob | null = null;
      if (support.export && videoRef.current) {
        try {
          cover = await captureCoverFrame(videoRef.current, edit.coverTime, support.filters ? filterById(edit.filterId).css : 'none');
        } catch (coverError) {
          console.warn('Kopertina nuk u krijua:', coverError);
        }
      }

      setPhase('uploading');
      setProgress(0);
      const id = await publishReel({
        file: finalFile,
        caption,
        durationSec: finalDuration,
        cover,
        audioTitle: edit.music ? audioTitleFromFile(edit.music.file.name) : null,
        author,
        onProgress: setProgress,
        onTask: (task) => { taskRef.current = task; },
      });
      toast.success(dt('Reel-i u publikua.'));
      onPublished(id);
    } catch (e: any) {
      const cancelled = e instanceof ExportCancelled || e?.code === 'storage/canceled';
      setPhase(cancelled ? 'idle' : 'error');
      setError(cancelled ? dt('Veprimi u anulua.') : (e?.message || dt('Publikimi dështoi. Provoni përsëri.')));
    } finally {
      taskRef.current = null;
      abortRef.current = null;
      submittingRef.current = false;
    }
  };

  const resetFile = () => { setFile(null); setDuration(null); setEdit(null); setPreviewUrl(null); setError(null); };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center" onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reel-composer-title"
        className="flex max-h-[95dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white text-slate-900 shadow-2xl outline-none dark:bg-zinc-900 dark:text-white sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <h2 id="reel-composer-title" className="flex items-center gap-2 text-base font-black">
            <Film className="h-5 w-5 text-blue-600" aria-hidden="true" /> {dt('Krijo Reel')}
          </h2>
          <button type="button" onClick={requestClose} aria-label={phase === 'uploading' || phase === 'processing' ? dt('Anulo') : dt('Mbyll')}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {!file || !edit || !previewUrl || duration === null ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); void choose(e.dataTransfer.files?.[0]); }}
              disabled={busy}
              className={`flex aspect-[9/12] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 text-center transition ${
                dragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-300 hover:border-blue-400 dark:border-zinc-700'
              }`}
            >
              {phase === 'checking' ? <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden="true" /> : <Upload className="h-8 w-8 text-blue-600" aria-hidden="true" />}
              <span className="text-sm font-black">{phase === 'checking' ? dt('Po kontrollohet video…') : dt('Zgjidh ose tërhiq një video')}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {dt('MP4 ose WebM, deri në 30 MB. Rezultati mund të zgjasë deri')} {REEL_MAX_DURATION_SEC} {dt('sekonda; mund ta shkurtoni më pas. Formati vertikal 9:16 duket më mirë.')}
              </span>
            </button>
          ) : (
            <>
              <ReelEditor previewUrl={previewUrl} duration={duration} edit={edit} onChange={setEdit} support={support} disabled={busy} videoRef={videoRef} />
              {!busy && (
                <button type="button" onClick={resetFile} className="text-xs font-bold text-blue-600 hover:underline dark:text-blue-400">
                  {dt('Zgjidh një video tjetër')}
                </button>
              )}
            </>
          )}
          <input ref={inputRef} type="file" accept="video/mp4,video/webm" className="hidden"
            onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ''; }} />

          <label className="block">
            <span className="mb-1 block text-sm font-bold">{dt('Përshkrimi')}</span>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={busy}
              rows={3}
              maxLength={REEL_CAPTION_MAX + 50}
              placeholder={dt('Çfarë po tregon? Shto #tema për ta gjetur më lehtë.')}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <span className={`mt-1 flex justify-between text-xs ${captionError ? 'text-rose-600' : 'text-slate-500 dark:text-slate-400'}`}>
              <span>{hashtags.length ? hashtags.map((t) => `#${t}`).join(' ') : ''}</span>
              <span>{caption.trim().length}/{REEL_CAPTION_MAX}</span>
            </span>
          </label>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {dt('Reel-i është publik dhe mbetet në profilin tuaj derisa ta fshini. Publikoni vetëm video dhe muzikë që keni të drejtë t’i ndani.')}
          </p>

          {(phase === 'processing' || phase === 'uploading') && (
            <div role="status" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
                <div className="h-full bg-blue-600 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {phase === 'processing' ? dt('Po përpunohet videoja (mbajeni këtë skedë të hapur)') : dt('Po ngarkohet')} {Math.round(progress * 100)}%
              </p>
            </div>
          )}
          {musicBlocked && !busy && <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{dt('Konfirmoni të drejtat e muzikës te skeda Muzikë për të publikuar.')}</p>}
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-zinc-800">
          <button type="button" onClick={requestClose}
            className="flex-1 rounded-full border border-slate-300 py-2.5 text-sm font-black dark:border-zinc-700">
            {phase === 'uploading' || phase === 'processing' ? dt('Anulo') : dt('Mbyll')}
          </button>
          <button type="button" onClick={() => void publish()} disabled={!canPublish}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-blue-600 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
            {(phase === 'uploading' || phase === 'processing') && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {phase === 'error' ? dt('Provo përsëri') : phase === 'processing' ? dt('Po përpunohet…') : phase === 'uploading' ? dt('Po publikohet…') : dt('Publiko')}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Crop, Loader2, X } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cropReportPhoto, fetchReportPhoto } from '../../lib/reportMediaApi';

/**
 * Cut a report photo down to the part that matters.
 *
 * Drag a rectangle over the photo (mouse or finger). "Ruaj prerjen" cuts it at the
 * photo's full resolution and sends it to the server, which keeps the original
 * privately so the change can be undone. The photo is loaded through our own
 * server, because a cross-origin image cannot be cut in the browser.
 */

interface Rect { x: number; y: number; w: number; h: number }

export interface PhotoCropperProps {
  reportId: string;
  url: string;
  onClose: () => void;
  onCropped: (images: string[]) => void;
}

const MIN_SIZE = 24;

export default function PhotoCropper({ reportId, url, onClose, onCropped }: PhotoCropperProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchReportPhoto(reportId, url)
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(err => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reportId, url]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    // A drag may end outside the photo (or the browser may drop the capture):
    // ending it anywhere keeps the selection from following the pointer around.
    const endDrag = () => { start.current = null; };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [onClose]);

  /** A pointer position inside the shown image, in its displayed pixels. */
  const point = (event: React.PointerEvent) => {
    const box = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(event.clientX - box.left, 0), box.width),
      y: Math.min(Math.max(event.clientY - box.top, 0), box.height),
    };
  };

  const onDown = (event: React.PointerEvent) => {
    if (!imgRef.current) return;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    start.current = point(event);
    setRect({ ...start.current, w: 0, h: 0 });
  };
  const onMove = (event: React.PointerEvent) => {
    if (!start.current || event.buttons === 0) { start.current = null; return; }
    const p = point(event);
    setRect({
      x: Math.min(start.current.x, p.x),
      y: Math.min(start.current.y, p.y),
      w: Math.abs(p.x - start.current.x),
      h: Math.abs(p.y - start.current.y),
    });
  };
  const onUp = () => { start.current = null; };

  const valid = rect && rect.w >= MIN_SIZE && rect.h >= MIN_SIZE;

  const save = async () => {
    const img = imgRef.current;
    if (!img || !rect || !valid) return;
    setSaving(true);
    try {
      // From displayed pixels to the photo's own pixels.
      const scaleX = img.naturalWidth / img.clientWidth;
      const scaleY = img.naturalHeight / img.clientHeight;
      const sx = Math.round(rect.x * scaleX);
      const sy = Math.round(rect.y * scaleY);
      const sw = Math.round(rect.w * scaleX);
      const sh = Math.round(rect.h * scaleY);
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const result = await cropReportPhoto(reportId, url, dataUrl);
      toast.success(dt('Fotoja u pre. Origjinali ruhet dhe mund të rikthehet.'));
      onCropped(result.images);
    } catch (err) {
      toast.error((err as Error).message || dt('Prerja nuk u ruajt.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[580] flex flex-col bg-slate-950" role="dialog" aria-modal="true" aria-label={dt('Prit foton')}>
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 text-white">
        <Crop className="h-4 w-4" aria-hidden="true" />
        <span className="text-sm font-bold">{dt('Prit foton')}</span>
        <span className="hidden text-xs text-slate-400 sm:inline">{dt('Tërhiqni mbi foto për të zgjedhur pjesën që mbetet.')}</span>
        <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="ml-auto rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-4">
        {error ? (
          <p className="max-w-md text-center text-sm text-rose-300">{error}</p>
        ) : !src ? (
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-label={dt('Duke ngarkuar')} />
        ) : (
          <div
            className="relative touch-none select-none"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <img ref={imgRef} src={src} alt="" draggable={false} className="block max-h-[70vh] max-w-full cursor-crosshair" />
            {rect && rect.w > 0 && (
              <div
                className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(2,6,23,0.65)]"
                style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
        {rect && !valid && rect.w > 0 && <span className="mr-auto text-xs text-amber-300">{dt('Zgjidhni një pjesë më të madhe.')}</span>}
        <button type="button" onClick={() => setRect(null)} disabled={!rect || saving} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-30">
          {dt('Fshi zgjedhjen')}
        </button>
        <button type="button" onClick={() => void save()} disabled={!valid || saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} {dt('Ruaj prerjen')}
        </button>
      </div>
    </div>
  );
}

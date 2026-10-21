import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Music, Play, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { dt } from '@/src/lib/dt';

/** The shape the public Track ID view hands out (server/trackView.ts PublicMedia). */
export interface GalleryItem {
  type: 'image' | 'video' | 'document' | 'audio';
  url: string;
  name?: string;
}

interface MediaGalleryProps {
  items: GalleryItem[];
  /** `large`: the citizen's own submission. `compact`: thumbnails inside a history entry. */
  size?: 'large' | 'compact';
  /** Accessible prefix for the alt text, e.g. "Foto e dërguar". */
  label?: string;
}

/**
 * Photos, videos, documents and voice notes of a report, shown as they were sent.
 * Photos and videos open in a full-screen viewer (arrow keys / swipe buttons / Esc),
 * documents download, audio plays in place. Nothing is dropped: every item the
 * report carries is rendered.
 */
export function MediaGallery({ items, size = 'large', label = 'Dëshmi' }: MediaGalleryProps) {
  const visual = items.filter(item => item.type === 'image' || item.type === 'video');
  const others = items.filter(item => item.type === 'document' || item.type === 'audio');
  const [open, setOpen] = useState<number | null>(null);

  if (items.length === 0) return null;
  const compact = size === 'compact';

  return (
    <div className="space-y-3">
      {visual.length > 0 && (
        <ul className={cn('grid gap-2.5', compact ? 'grid-cols-3 sm:grid-cols-4' : visual.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3')}>
          {visual.map((item, index) => (
            <li key={`${item.url}-${index}`}>
              <button
                type="button"
                onClick={() => setOpen(index)}
                aria-label={`${dt(item.type === 'video' ? 'Hap videon' : 'Zmadho foton')} ${index + 1}`}
                className={cn(
                  'group relative block w-full overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200 transition hover:ring-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-slate-800 dark:ring-white/10',
                  compact ? 'aspect-square' : visual.length === 1 ? 'aspect-[4/3] sm:aspect-video' : 'aspect-square',
                )}
              >
                {item.type === 'video' ? (
                  <>
                    {/* #t=0.1 makes the browser paint the first frame as a poster */}
                    <video src={`${item.url}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
                    <span className="absolute inset-0 grid place-items-center bg-slate-950/25 transition group-hover:bg-slate-950/40">
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-slate-900 shadow-lg">
                        <Play className="h-5 w-5 translate-x-0.5" aria-hidden="true" fill="currentColor" />
                      </span>
                    </span>
                  </>
                ) : (
                  <img src={item.url} alt={`${dt(label)} ${index + 1}`} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 && (
        <ul className="space-y-2">
          {others.map((item, index) => (
            <li key={`${item.url}-${index}`}>
              {item.type === 'audio' ? (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Music className="h-4 w-4" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{item.name || dt('Regjistrim audio')}</p>
                    <audio src={item.url} controls preload="metadata" className="mt-1 h-9 w-full" />
                  </div>
                </div>
              ) : (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-blue-300 dark:border-white/10 dark:bg-slate-900">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><FileText className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800 dark:text-slate-100">{item.name || dt('Dokument')}</span>
                  <Download className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {open !== null && <Lightbox items={visual} start={open} label={label} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Lightbox({ items, start, label, onClose }: { items: GalleryItem[]; start: number; label: string; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const item = items[index];
  const many = items.length > 1;

  const go = useCallback((delta: number) => setIndex(current => (current + delta + items.length) % items.length), [items.length]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [go, onClose]);

  if (!item) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={dt('Pamja e plotë e dëshmisë')} className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95" onClick={onClose}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white" onClick={event => event.stopPropagation()}>
        <p className="text-xs font-bold tabular-nums">{index + 1} / {items.length}</p>
        <div className="flex items-center gap-2">
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-bold hover:bg-white/20">
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> {dt('Hap origjinalin')}
          </a>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={dt('Mbyll')} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6 sm:px-14" onClick={event => event.stopPropagation()}>
        {item.type === 'video' ? (
          <video key={item.url} src={item.url} controls autoPlay playsInline className="max-h-full max-w-full rounded-xl bg-black" />
        ) : (
          <img key={item.url} src={item.url} alt={`${dt(label)} ${index + 1}`} className="max-h-full max-w-full rounded-xl object-contain" />
        )}
        {many && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label={dt('E mëparshmja')} className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/30 sm:left-3">
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label={dt('Tjetra')} className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/30 sm:right-3">
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default MediaGallery;

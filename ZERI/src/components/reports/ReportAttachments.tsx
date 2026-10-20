import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, FileText, Film, Image as ImageIcon, Music, X } from 'lucide-react';
import type { MediaItem } from '@/src/types';
import { formatBytes } from '@/src/lib/firebase';

/**
 * Renders every attachment a citizen submitted, by kind.
 *
 * The spec is explicit: "Mos humb asnjë attachment." Reports can carry images,
 * videos, documents and audio; each kind needs a different affordance (a photo
 * is viewed, a video is played, a document is downloaded, audio is listened to).
 * This component normalizes the two storage shapes a report uses — a legacy
 * `images: string[]` and the richer `media: MediaItem[]` — into one list so no
 * attachment is dropped regardless of which field it lives in.
 */

interface ReportAttachmentsProps {
  images?: string[];
  media?: MediaItem[];
  /** Optional heading; hidden when there is nothing to show. */
  title?: string;
  /** Grid density: 'grid' for the detail aside, 'row' for inline timeline use. */
  layout?: 'grid' | 'row';
  emptyText?: string;
}

function normalizeAttachments(images: string[] | undefined, media: MediaItem[] | undefined): MediaItem[] {
  const fromMedia = (media || []).filter((m) => m && m.url);
  const mediaUrls = new Set(fromMedia.map((m) => m.url));
  const fromImages = (images || [])
    .filter((url) => url && !mediaUrls.has(url))
    .map((url) => ({ url, type: 'image' as const }));
  return [...fromMedia, ...fromImages];
}

function kindIcon(type: MediaItem['type']) {
  switch (type) {
    case 'video': return Film;
    case 'document': return FileText;
    case 'audio': return Music;
    default: return ImageIcon;
  }
}

/** Full-screen photo viewer shared by every place attachments are listed. */
function PhotoViewer({ photos, index, onIndex, onClose }: { photos: MediaItem[]; index: number; onIndex: (next: number) => void; onClose: () => void }) {
  const go = (delta: number) => onIndex((index + delta + photos.length) % photos.length);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft') onIndex((index - 1 + photos.length) % photos.length);
      else if (event.key === 'ArrowRight') onIndex((index + 1) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return createPortal(
    <div className="fixed inset-0 z-[12100] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Galeria e fotove" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tabular-nums">{index + 1} / {photos.length}</span>
        <button type="button" onClick={onClose} aria-label="Mbyll" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"><X className="h-5 w-5" aria-hidden="true" /></button>
      </div>
      <div className="relative min-h-0 flex-1 px-2 pb-4 sm:px-16" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
        <img src={photos[index].url} alt={photos[index].name || `Dëshmi ${index + 1}`} className="h-full w-full object-contain" draggable={false} />
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Fotoja paraprake" className="absolute left-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 sm:left-4"><ChevronLeft className="h-6 w-6" aria-hidden="true" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Fotoja pasuese" className="absolute right-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 sm:right-4"><ChevronRight className="h-6 w-6" aria-hidden="true" /></button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

export function ReportAttachments({
  images,
  media,
  title = 'Dëshmitë e raportimit',
  layout = 'grid',
  emptyText = 'Pa media të bashkangjitura',
}: ReportAttachmentsProps) {
  const items = normalizeAttachments(images, media);
  const photos = items.filter(item => item.type !== 'video' && item.type !== 'audio' && item.type !== 'document');
  const [viewing, setViewing] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-(--color-surface-subtle) p-4 text-sm text-(--color-text-muted)">
        <FileText className="h-4 w-4" /> {emptyText}
      </div>
    );
  }

  return (
    <div>
      {title && (
        <h3 className="mb-3 text-sm font-black text-(--color-text)">{title}</h3>
      )}
      <div className={layout === 'grid' ? 'grid grid-cols-2 gap-3' : 'flex flex-wrap gap-3'}>
        {items.map((item, index) => {
          const Icon = kindIcon(item.type);
          const key = `${item.url}-${index}`;

          if (item.type === 'video') {
            return (
              <video
                key={key}
                src={item.url}
                controls
                preload="metadata"
                className="aspect-square w-full rounded-xl bg-black object-cover"
              />
            );
          }

          if (item.type === 'audio') {
            return (
              <div
                key={key}
                className="col-span-2 flex items-center gap-3 rounded-xl border border-(--color-border-soft) bg-(--color-surface) p-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--color-primary)/12 text-(--color-primary)">
                  <Music className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-(--color-text)">{item.name || 'Regjistrim audio'}</p>
                  <audio src={item.url} controls preload="metadata" className="mt-1 h-9 w-full" />
                </div>
              </div>
            );
          }

          if (item.type === 'document') {
            return (
              <a
                key={key}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-2 flex items-center gap-3 rounded-xl border border-(--color-border-soft) bg-(--color-surface) p-3 transition hover:bg-(--color-surface-elevated)"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--color-info)/12 text-(--color-info)">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-(--color-text)">{item.name || 'Dokument'}</p>
                  <p className="text-[11px] text-(--color-text-muted)">
                    {item.mimeType || 'Dokument'}{item.sizeBytes ? ` · ${formatBytes(item.sizeBytes)}` : ''}
                  </p>
                </div>
                <Download className="h-4 w-4 shrink-0 text-(--color-text-muted)" />
              </a>
            );
          }

          // Default: image, opened in the viewer.
          const photoIndex = photos.indexOf(item);
          return (
            <button key={key} type="button" onClick={() => setViewing(photoIndex)} className="group relative block cursor-zoom-in overflow-hidden rounded-xl" aria-label={item.name || `Zmadho dëshminë ${index + 1}`}>
              <img
                src={item.url}
                alt={item.name || `Dëshmi ${index + 1}`}
                loading="lazy"
                className="aspect-square w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <span className="sr-only"><Icon className="h-0 w-0" /></span>
            </button>
          );
        })}
      </div>
      {viewing !== null && photos[viewing] && <PhotoViewer photos={photos} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

export default ReportAttachments;

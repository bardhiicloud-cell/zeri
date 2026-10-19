import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { dt } from '@/src/lib/dt';

/** Photos of a post: one image as before, or a 2x2 grid that opens a viewer with arrows. */
export function PostGallery({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <div className="mb-3 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/40">
        <img src={urls[0]} className="max-h-[500px] w-full object-cover" alt="" loading="lazy" />
      </div>
    );
  }

  const shown = urls.slice(0, 4);
  const go = (delta: number) => setOpen((i) => (i === null ? i : (i + delta + urls.length) % urls.length));
  return (
    <>
      <div className={`mb-3 grid gap-1 overflow-hidden rounded-[1.25rem] border border-slate-200 dark:border-zinc-800 ${shown.length === 3 ? 'grid-cols-2' : 'grid-cols-2'}`}>
        {shown.map((url, i) => (
          <button key={url} type="button" onClick={() => setOpen(i)} aria-label={`${dt('Hap foton')} ${i + 1} / ${urls.length}`}
            className={`relative bg-slate-100 dark:bg-zinc-800 ${shown.length === 3 && i === 0 ? 'row-span-2' : ''}`}>
            <img src={url} alt="" loading="lazy" className="h-full max-h-64 w-full object-cover" />
          </button>
        ))}
      </div>
      {open !== null && (
        <div role="dialog" aria-modal="true" aria-label={dt('Fotot e postimit')} className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/90"
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(null); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}>
          <button type="button" autoFocus onClick={() => setOpen(null)} aria-label={dt('Mbyll')} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"><X className="h-5 w-5" aria-hidden="true" /></button>
          <button type="button" onClick={() => go(-1)} aria-label={dt('Para')} className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"><ChevronLeft className="h-6 w-6" aria-hidden="true" /></button>
          <img loading="lazy" decoding="async" src={urls[open]} alt="" className="max-h-[90dvh] max-w-[92vw] object-contain" />
          <button type="button" onClick={() => go(1)} aria-label={dt('Pas')} className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"><ChevronRight className="h-6 w-6" aria-hidden="true" /></button>
          <span className="absolute bottom-4 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">{open + 1} / {urls.length}</span>
        </div>
      )}
    </>
  );
}

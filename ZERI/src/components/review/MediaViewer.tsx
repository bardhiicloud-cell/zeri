import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Music, X, ZoomIn, ZoomOut } from 'lucide-react';
import { dt } from '../../lib/dt';

/**
 * Full-screen viewer for what a citizen attached: photos and videos side by side in one
 * sequence, with arrows and keyboard (← → Esc, + for zoom), a counter, a thumbnail strip,
 * and a link to the original file. Documents and voice notes open as cards with the file.
 */
export interface ViewerItem { url: string; type: 'image' | 'video' | 'document' | 'audio'; name?: string }

export function MediaViewer({ items, start, onClose }: { items: ViewerItem[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const [zoom, setZoom] = useState(false);
  const item = items[index];
  const go = (delta: number) => { setZoom(false); setIndex(i => (i + delta + items.length) % items.length); };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === '+' || event.key === '=') setZoom(z => !z);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={dt('Media e raportimit')} className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/95 text-white">
      <header className="flex items-center gap-2 px-4 py-3 text-sm">
        <span className="font-bold tabular-nums">{index + 1} / {items.length}</span>
        <span className="truncate text-white/60">{item.name || (item.type === 'video' ? dt('Video') : item.type === 'image' ? dt('Fotografi') : dt('Skedar'))}</span>
        <div className="ml-auto flex gap-1">
          {item.type === 'image' && <button type="button" onClick={() => setZoom(z => !z)} aria-label={zoom ? dt('Zvogëlo') : dt('Zmadho')} className="rounded-lg p-2 hover:bg-white/10">{zoom ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}</button>}
          <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={dt('Hap origjinalin')} className="rounded-lg p-2 hover:bg-white/10"><ExternalLink className="h-5 w-5" /></a>
          <a href={item.url} download aria-label={dt('Shkarko')} className="rounded-lg p-2 hover:bg-white/10"><Download className="h-5 w-5" /></a>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="rounded-lg p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        {item.type === 'image' && (
          <div className={zoom ? 'h-full w-full overflow-auto' : 'contents'}>
            <img loading="lazy" decoding="async" src={item.url} alt={dt('Fotografi e raportimit')} onClick={() => setZoom(z => !z)}
              className={zoom ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in rounded-lg object-contain'} />
          </div>
        )}
        {item.type === 'video' && <video key={item.url} src={item.url} controls autoPlay playsInline preload="metadata" className="max-h-full max-w-full rounded-lg bg-black" />}
        {item.type === 'audio' && <div className="rounded-2xl bg-white/10 p-6 text-center"><Music className="mx-auto h-10 w-10" /><p className="mt-2 text-sm">{item.name}</p><audio src={item.url} controls className="mt-3" /></div>}
        {item.type === 'document' && <a href={item.url} target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-white/10 p-6 text-center hover:bg-white/15"><FileText className="mx-auto h-10 w-10" /><p className="mt-2 text-sm font-bold">{item.name || dt('Dokument')}</p><p className="text-xs text-white/60">{dt('Hap dokumentin')}</p></a>}
        {items.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label={dt('E mëparshmja')} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20"><ChevronLeft className="h-6 w-6" /></button>
            <button type="button" onClick={() => go(1)} aria-label={dt('Tjetra')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20"><ChevronRight className="h-6 w-6" /></button>
          </>
        )}
      </div>
      {items.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-4">
          {items.map((entry, i) => (
            <button key={`${entry.url}_${i}`} type="button" onClick={() => { setZoom(false); setIndex(i); }} aria-label={`${i + 1}`}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}>
              {entry.type === 'image' ? <img src={entry.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                : entry.type === 'video' ? <video src={entry.url} muted preload="metadata" className="h-full w-full object-cover" />
                : <span className="grid h-full w-full place-items-center bg-white/10 text-[10px]">{entry.type === 'audio' ? 'Audio' : 'Doc'}</span>}
              {entry.type === 'video' && <span className="absolute inset-0 grid place-items-center text-lg">▶</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

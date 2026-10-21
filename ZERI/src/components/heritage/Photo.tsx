import { useState } from 'react';
import { Camera } from 'lucide-react';
import { PHOTO_CREDITS } from '../../lib/heritage/photoCredits';

/**
 * A photograph from /public/heritage/photos/<name>.webp (made by scripts/crop-heritage-photos.mjs). When the file is not there (or fails to load)
 * the frame stays as a quiet plate, so a missing image never breaks a card. `credit` is shown on the
 * photo itself — a picture without its author and licence should not be published.
 */
export function Photo({ name, alt, credit, className = '', position = 'center', ext = 'webp', bare = false, noCredit = false }: {
  name: string; alt: string; credit?: string; className?: string; position?: string; ext?: 'jpg' | 'webp' | 'png';
  /** Draw nothing when the file is missing, so the art behind the frame shows instead of a plate. */
  bare?: boolean;
  /** The caller shows the credit itself (for example inside a card that is already a link). */
  noCredit?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const found = noCredit ? undefined : PHOTO_CREDITS[name];
  const shownCredit = credit ?? (found ? `${found.author} · ${found.license}` : undefined);
  if (failed && bare) return null;
  return (
    <div className={`hx-photo ${className}`}>
      {failed
        ? <span className="hx-photo-fallback" aria-hidden="true"><Camera className="h-6 w-6" /></span>
        : ext === 'webp'
          ? <img src={`/heritage/photos/${name}.webp`} srcSet={`/heritage/photos/${name}-640.webp 640w, /heritage/photos/${name}.webp 1600w`} sizes="(max-width: 640px) 100vw, 480px"
              alt={alt} loading="lazy" decoding="async" style={{ objectPosition: position }} onError={() => setFailed(true)} />
          : <img src={`/heritage/photos/${name}.${ext}`} alt={alt} loading="lazy" decoding="async" style={{ objectPosition: position }} onError={() => setFailed(true)} />}
      {shownCredit && !failed && (found && !credit
        ? <a href={found.source} target="_blank" rel="noopener noreferrer" className="absolute bottom-0 right-1 z-10 inline-flex min-h-6 max-w-[70%] items-center truncate rounded bg-black/55 px-2 text-[9px] font-semibold text-white/85 hover:text-white">© {shownCredit}</a>
        : <span className="absolute bottom-1 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white/85">© {shownCredit}</span>)}
    </div>
  );
}

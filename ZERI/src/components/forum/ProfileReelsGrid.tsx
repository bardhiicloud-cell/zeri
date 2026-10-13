import { useEffect, useState } from 'react';
import { EyeOff, Film, Heart, Loader2, RefreshCw } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import type { Reel } from '../../lib/reels';
import { fetchReelsByAuthor } from '../../lib/reelsSocial';

interface Props {
  authorId: string;
  /** The owner also sees reels hidden by moderation, marked as such. */
  isOwner: boolean;
  onOpen: (reel: Reel) => void;
  onCreate?: () => void;
}

type Row = Reel & { hidden?: boolean };

/** Reels tab of a profile: a grid of the author's real Reels, newest first. */
export function ProfileReelsGrid({ authorId, isOwner, onOpen, onCreate }: Props) {
  const [reels, setReels] = useState<Row[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchReelsByAuthor(authorId, isOwner)
      .then((list) => { if (!cancelled) { setReels(list); setStatus('ready'); } })
      .catch((error) => { console.error('Reels e profilit nuk u ngarkuan:', error); if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [authorId, isOwner, attempt]);

  if (status === 'loading') {
    return <div role="status" className="col-span-full flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden="true" /><span className="sr-only">{dt('Po ngarkohen Reels…')}</span></div>;
  }
  if (status === 'error') {
    return (
      <div className="col-span-full flex flex-col items-center gap-3 py-12 text-sm text-slate-500">
        <p>{dt('Reels nuk u ngarkuan.')}</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white dark:bg-white dark:text-slate-900">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Provo përsëri')}
        </button>
      </div>
    );
  }
  if (reels.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 py-16 text-slate-500 dark:border-zinc-700">
        <Film className="h-6 w-6 text-rose-500" aria-hidden="true" />
        <p className="text-sm font-bold">{isOwner ? dt('Nuk keni publikuar Reels ende.') : dt('Ky profil nuk ka Reels.')}</p>
        {isOwner && onCreate && (
          <button type="button" onClick={onCreate} className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400">{dt('Krijo Reel')}</button>
        )}
      </div>
    );
  }
  return (
    <>
      {reels.map((reel) => (
        <button key={reel.id} type="button" onClick={() => onOpen(reel)}
          aria-label={reel.caption ? reel.caption.slice(0, 90) : dt('Hap Reel-in')}
          className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-slate-200 text-left dark:bg-zinc-900">
          {reel.coverUrl ? (
            <img src={reel.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            /* #t=0.1 shows the first frame as a poster without downloading the whole video. */
            <video src={`${reel.mediaUrl}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} className="h-full w-full object-cover" />
          )}
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white">
            <Heart className="h-3 w-3" aria-hidden="true" /> {reel.likedBy.length}
          </span>
          {isOwner && (reel as Row).hidden && (
            <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-rose-600 px-2 py-1 text-[10px] font-bold text-white">
              <EyeOff className="h-3 w-3" aria-hidden="true" /> {dt('Fshehur')}
            </span>
          )}
        </button>
      ))}
    </>
  );
}

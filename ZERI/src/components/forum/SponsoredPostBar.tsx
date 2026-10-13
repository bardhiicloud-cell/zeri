import { ExternalLink, Megaphone } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { safeAdUrl } from '../../lib/forumPostsApi';

/**
 * Disclosure for a paid post. A sponsored post must be recognisable as one, so
 * this is rendered for every post with `isAd`. The button goes through the
 * server redirect (`/api/v1/ads/r/:postId`), which counts the click once per
 * visitor per day before sending them on; the link itself is validated (https
 * only) and opened with rel="sponsored nofollow noopener noreferrer".
 */
export function SponsoredPostBar({ postId, adLink }: { postId: string; adLink?: string | null }) {
  const safe = safeAdUrl(adLink);
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <Megaphone className="h-3 w-3" aria-hidden="true" /> {dt('Sponsorizuar')}
      </span>
      {safe && (
        <a href={`/api/v1/ads/r/${encodeURIComponent(postId)}`} target="_blank" rel="sponsored nofollow noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-black text-white hover:bg-amber-600">
          {dt('Mëso më shumë')} <ExternalLink className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">({dt('hapet në skedë të re, reklamë')})</span>
        </a>
      )}
    </div>
  );
}

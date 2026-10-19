import { apiUrl } from '../../lib/apiBase';
import { useState } from 'react';
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
export function SponsoredPostBar({ postId, adLink, onReport }: { postId: string; adLink?: string | null; onReport?: () => void }) {
  const safe = safeAdUrl(adLink);
  const [why, setWhy] = useState(false);
  return (
    <div className="mb-2">
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <Megaphone className="h-3 w-3" aria-hidden="true" /> {dt('Sponsorizuar')}
      </span>
      <button type="button" onClick={() => setWhy((v) => !v)} aria-expanded={why} className="text-[11px] font-bold text-slate-500 underline-offset-2 hover:underline">
        {dt('Pse e shoh këtë?')}
      </button>
      {onReport && (
        <button type="button" onClick={onReport} className="text-[11px] font-bold text-slate-500 underline-offset-2 hover:text-rose-600 hover:underline">
          {dt('Raporto reklamën')}
        </button>
      )}
      {safe && (
        <a href={apiUrl(`/api/v1/ads/r/${encodeURIComponent(postId)}`)} target="_blank" rel="sponsored nofollow noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-black text-white hover:bg-amber-600">
          {dt('Mëso më shumë')} <ExternalLink className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">({dt('hapet në skedë të re, reklamë')})</span>
        </a>
      )}
    </div>
    {why && (
      <p role="note" className="mt-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        {dt('Ky është postim i sponsorizuar nga ekipi i platformës. Shfaqet për të gjithë njësoj: nuk e targetojmë sipas historikut tuaj dhe nuk shesim të dhëna personale.')}
      </p>
    )}
    </div>
  );
}

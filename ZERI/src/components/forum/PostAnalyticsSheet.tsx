import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, Eye, Heart, MessageCircle, Repeat2, TrendingUp, X } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { engagementPoints, postAgeHours, scorePost, type RankablePost } from '../../lib/forumRanking';

/**
 * Per-post analytics for the author. Every figure is a real count read from the
 * post; nothing is estimated. Impressions come from the server-side view
 * counter and start at zero for posts published before it existed.
 */
interface Props {
  post: RankablePost & { viewCount?: number; content?: string; isAd?: boolean };
  verified: boolean;
  onClose: () => void;
}

export function PostAnalyticsSheet({ post, verified, onClose }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const views = Math.max(post.viewCount ?? 0, 0);
  const likes = post.likes?.length ?? 0;
  const replies = post.comments?.length ?? 0;
  const reposts = post.reposts?.length ?? 0;
  const interactions = likes + replies + reposts;
  const rate = views > 0 ? Math.min(100, (interactions / views) * 100) : null;
  const ageHours = postAgeHours(post, Date.now());
  const score = scorePost(post, { verifiedIds: verified ? [post.authorId] : [] });

  const rows = [
    { icon: Eye, label: 'Shfaqje', value: views.toLocaleString('de-DE') },
    { icon: Heart, label: 'Pëlqime', value: likes },
    { icon: MessageCircle, label: 'Përgjigje', value: replies },
    { icon: Repeat2, label: 'Ripostime', value: reposts },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={dt('Analitika e postimit')} className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
            <BarChart3 className="h-5 w-5 text-blue-600" aria-hidden="true" />
            {dt('Analitika e postimit')}
          </h2>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p className={`mb-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${post.isAd ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'}`}>
          {post.isAd ? dt('Postim i sponsorizuar') : dt('Postim organik')}
        </p>
        <p className="line-clamp-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-zinc-800 dark:text-slate-200">{post.content}</p>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl border border-slate-200 p-3 dark:border-zinc-700">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {dt(label)}
              </dt>
              <dd className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 rounded-2xl border border-slate-200 p-3 dark:border-zinc-700">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />{dt('Shkalla e angazhimit')}</span>
            <span>{rate === null ? '—' : `${rate.toFixed(1)}%`}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${rate ?? 0}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            {dt('Ndërveprime ndaj shfaqjeve. Postimet e vjetra para numëruesit mund të tregojnë 0 shfaqje.')}
          </p>
        </div>

        <div className="mt-3 rounded-2xl bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          <p className="font-black">{dt('Si renditet ky postim')}</p>
          <p className="mt-1 leading-relaxed">
            {dt('Pikët e angazhimit')}: <strong>{engagementPoints(post)}</strong> · {dt('Mosha')}: <strong>{Math.round(ageHours)} {dt('orë')}</strong> · {dt('Rezultati')}: <strong>{score.toFixed(1)}</strong>
            {verified && <> · {dt('Llogaria e verifikuar merr një rritje të vogël në renditje.')}</>}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

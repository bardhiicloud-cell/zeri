import { useEffect, useMemo, useState } from 'react';
import { Film, Hash, MapPin, Search, TrendingUp, UserPlus, UserCheck, X } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import type { TrendItem } from '../../lib/forumTrends';
import { VerifiedBadge } from './VerifiedBadge';
import type { Reel } from '../../lib/reels';
import { fetchReelsByHashtag, normalizeHashtag } from '../../lib/reelsSocial';

export interface ExplorePerson {
  id: string;
  name: string;
  avatar?: string;
  followers: number;
  verified: boolean;
}

interface Props {
  query: string;
  onQuery: (value: string) => void;
  trends: TrendItem[];
  people: ExplorePerson[];
  followedIds: readonly string[];
  matchingPosts: number;
  onToggleFollow: (id: string, name: string) => void;
  onOpenPerson: (person: ExplorePerson) => void;
  /** Show the posts for a topic/hashtag in the feed. */
  onPickTopic: (label: string) => void;
  onShowPosts: () => void;
  /** Opens the Reels player on a search result. */
  onOpenReel: (reel: Reel, tag: string) => void;
}

type Tab = 'trending' | 'people';

/**
 * "Explore": search, what is being talked about, and who to follow. Everything
 * shown is computed from real posts and real accounts; with none, it says so.
 */
export function ForumExplore({
  query, onQuery, trends, people, followedIds, matchingPosts, onToggleFollow, onOpenPerson, onPickTopic, onShowPosts, onOpenReel,
}: Props) {
  const [tab, setTab] = useState<Tab>('trending');
  const searching = query.trim().length > 0;

  // Reels are searched by hashtag only: caption text cannot be indexed in
  // Firestore, and downloading every reel to filter it here would not scale.
  // A single word or #tag in the box is treated as a hashtag, after a pause.
  const [reelTag, setReelTag] = useState<string | null>(null);
  const [reelResults, setReelResults] = useState<Reel[]>([]);
  const [reelStatus, setReelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  useEffect(() => {
    const tag = normalizeHashtag(query);
    if (!tag) { setReelTag(null); setReelResults([]); setReelStatus('idle'); return; }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setReelTag(tag);
      setReelStatus('loading');
      fetchReelsByHashtag(tag, 12)
        .then((list) => { if (!cancelled) { setReelResults(list); setReelStatus('ready'); } })
        .catch((error) => { console.error('Kërkimi i Reels dështoi:', error); if (!cancelled) { setReelResults([]); setReelStatus('error'); } });
    }, 400);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query]);
  const visiblePeople = useMemo(() => people.slice(0, 20), [people]);

  return (
    <section aria-label={dt('Eksploro')} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="forum-explore-search"
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={dt('Kërko në debat, tema ose profile...')}
            aria-label={dt('Kërko në debat publik')}
            className="h-11 w-full rounded-full border border-slate-200 bg-slate-100 pl-10 pr-10 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          {searching && (
            <button type="button" onClick={() => onQuery('')} aria-label={dt('Pastro kërkimin')} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-700">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </label>

        <div role="tablist" className="mt-3 grid grid-cols-2 text-center text-sm font-bold">
          {([
            { id: 'trending', label: 'Në trend' },
            { id: 'people', label: 'Njerëz' },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                'relative min-h-11 transition-colors',
                tab === item.id ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800'
              )}
            >
              {dt(item.label)}
              {tab === item.id && <span className="absolute inset-x-1/4 bottom-0 h-1 rounded-full bg-blue-500" />}
            </button>
          ))}
        </div>
      </div>

      {searching && (
        <button
          type="button"
          onClick={onShowPosts}
          className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm font-semibold text-blue-600 hover:bg-blue-50/60 dark:border-zinc-800 dark:text-blue-300 dark:hover:bg-zinc-800"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="flex-1 truncate">{dt('Shiko postimet për')} “{query.trim()}”</span>
          <span className="text-xs text-slate-500">{matchingPosts}</span>
        </button>
      )}

      {reelTag && (
        <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-rose-600">
            <Film className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Reels me')} #{reelTag}
          </p>
          {reelStatus === 'loading' && <p role="status" className="py-4 text-center text-xs text-slate-500">{dt('Po kërkohen Reels…')}</p>}
          {reelStatus === 'error' && <p className="py-4 text-center text-xs text-slate-500">{dt('Reels nuk u ngarkuan. Provoni përsëri më vonë.')}</p>}
          {reelStatus === 'ready' && reelResults.length === 0 && (
            <p className="py-4 text-center text-xs text-slate-500">{dt('Asnjë Reel nuk ka këtë hashtag.')}</p>
          )}
          {reelResults.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {reelResults.map((reel) => (
                <button key={reel.id} type="button" onClick={() => onOpenReel(reel, reelTag)}
                  aria-label={reel.caption ? reel.caption.slice(0, 90) : dt('Hap Reel-in')}
                  className="relative aspect-[9/16] overflow-hidden rounded-xl bg-slate-200 dark:bg-zinc-800">
                  <video src={`${reel.mediaUrl}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} className="h-full w-full object-cover" />
                  <span className="absolute bottom-1.5 left-1.5 truncate rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">{reel.authorName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'trending' ? (
        trends.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            {dt('Ende nuk ka tema në trend. Hapni një debat me një #hashtag.')}
          </p>
        ) : (
          <ol>
            {trends.map((trend, index) => (
              <li key={`${trend.kind}-${trend.label}`}>
                <button
                  type="button"
                  onClick={() => onPickTopic(trend.label)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-zinc-800/60"
                >
                  <span className="mt-0.5 text-xs font-bold text-slate-400">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      {trend.kind === 'hashtag' ? <Hash className="h-3 w-3" aria-hidden="true" /> : <MapPin className="h-3 w-3" aria-hidden="true" />}
                      {trend.kind === 'hashtag' ? dt('Trend në Kosovë') : dt('Temë')}
                    </span>
                    <span className="block truncate text-[15px] font-black text-slate-900 dark:text-white">{trend.label}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {trend.posts} {dt('postime')} · {trend.interactions} {dt('ndërveprime')}
                    </span>
                  </span>
                  <TrendingUp className="mt-1 h-4 w-4 text-slate-300" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        )
      ) : visiblePeople.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {searching ? dt('Asnjë profil nuk përputhet me kërkimin.') : dt('Nuk ka sugjerime tani.')}
        </p>
      ) : (
        <ul>
          {visiblePeople.map((person) => {
            const following = followedIds.includes(person.id);
            return (
              <li key={person.id} className="flex items-center gap-3 px-4 py-3">
                <button type="button" onClick={() => onOpenPerson(person)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <img src={person.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}`} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-full bg-slate-200 object-cover" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-black text-slate-900 dark:text-white">
                      <span className="truncate">{person.name}</span>
                      {person.verified && <VerifiedBadge />}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{person.followers} {dt('ndjekës')}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFollow(person.id, person.name)}
                  aria-pressed={following}
                  className={cn(
                    'inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-xs font-black transition',
                    following
                      ? 'border border-slate-300 text-slate-700 hover:border-rose-300 hover:text-rose-600 dark:border-zinc-600 dark:text-slate-200'
                      : 'bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900'
                  )}
                >
                  {following ? <UserCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}
                  {following ? dt('Duke ndjekur') : dt('Ndiq')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

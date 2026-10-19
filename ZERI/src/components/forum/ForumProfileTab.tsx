import { dt } from '@/src/lib/dt';
import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, Timestamp, limit } from 'firebase/firestore';
import { BarChart3, Film, Trash2, Grid, Heart, Bookmark, Play, Plus, Settings, ShieldCheck, Sparkles, Users, UserMinus, UserPlus, Search as SearchIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { ProfileReelsGrid } from './ProfileReelsGrid';
import { ForumSettingsPanel } from './ForumSettingsPanel';
import { isBusiness, prefsOf } from '../../lib/forumPrefs';
import type { Reel } from '../../lib/reels';

export default function ForumProfileTab({
  currentUser,
  setActiveTab,
  posts,
  savedPostIds,
  followingCount,
  followersCount = 0,
  followersList = [],
  followingList = [],
  notFollowedBack = [],
  suggestions = [],
  onToggleFollow,
  onCreateStory,
  onOpenReel,
  onCreateReel,
  onOpenInsights,
  deletedCount = 0,
  onOpenTrash,
}: {
  /** Number of the author's soft-deleted posts (restorable for 30 days). */
  deletedCount?: number;
  onOpenTrash?: () => void;
  /** Opens account insights (sponsored vs organic). */
  onOpenInsights?: () => void;
  /** Opens the Reels player on one of this profile's reels. */
  onOpenReel?: (reel: Reel) => void;
  onCreateReel?: () => void;
  currentUser: any;
  setActiveTab: (tab: 'feed' | 'profile') => void;
  posts: any[];
  savedPostIds: string[];
  followingCount: number;
  followersCount?: number;
  followersList?: { id: string; name: string; avatar: string }[];
  followingList?: { id: string; name: string; avatar: string }[];
  notFollowedBack?: { id: string; name: string; avatar: string }[];
  suggestions?: { id: string; name: string; avatar: string; followers: number }[];
  onToggleFollow?: (targetId: string, name?: string) => void | Promise<void>;
  onCreateStory: () => void;
}) {
  const [stories, setStories] = useState<any[]>([]);
  const [activeProfileTab, setActiveProfileTab] = useState<'posts' | 'reels' | 'liked' | 'saved' | 'followers' | 'following' | 'settings'>('posts');
  const [socialSearch, setSocialSearch] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    const openSettings = () => setActiveProfileTab('settings');
    window.addEventListener('zeri:open-forum-settings', openSettings);
    return () => window.removeEventListener('zeri:open-forum-settings', openSettings);
  }, []);
  const systemSettings = useStore(state => state.systemSettings);
  const showReels = systemSettings?.showReels ?? true;

  useEffect(() => {
    if (!currentUser) return;
    const fetchUserStories = async () => {
      try {
        const q = query(collection(db, 'forumStories'), where('authorId', '==', currentUser.id), limit(50));
        const snap = await getDocs(q);
        const now = Timestamp.now();
        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((story: any) => !story.isHidden && story.expiresAt?.toMillis?.() > now.toMillis());
        setStories(data);
      } catch (error) {
        console.error('Nuk u ngarkuan story-t e profilit:', error);
        setStories([]);
      }
    };
    void fetchUserStories();
  }, [currentUser?.id]);

  const business = isBusiness(currentUser);
  const ownPosts = posts.filter(post => post.authorId === currentUser?.id);
  /*
   * A profile's post list honours post visibility: a followers-only post from
   * someone the viewer does not follow is hidden here exactly as it is hidden
   * in the feed. The author always sees their own restricted posts, and
   * moderators see everything for moderation purposes.
   */
  /*
   * This tab renders the signed-in citizen's OWN profile, so they see every
   * one of their posts — including followers-only ones. The visibility filter
   * that hides restricted posts from other viewers lives in the feed filter
   * (ForumPage displayPosts) and in the other-profile modal (ForumProfileModal),
   * which are the two places a stranger's posts are listed.
   */
  const likedPosts = posts.filter(post => post.likes?.includes(currentUser?.id));
  const savedPosts = posts.filter(post => savedPostIds.includes(post.id));
  const totalLikes = ownPosts.reduce((total, post) => total + (post.likes?.length || 0), 0) +
    stories.reduce((total, story) => total + (story.likes?.length || 0), 0);
  const activePosts = activeProfileTab === 'posts' ? ownPosts : activeProfileTab === 'liked' ? likedPosts : activeProfileTab === 'saved' ? savedPosts : [];

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <p>{dt(`Duhet të logoheni për të parë profilin.`)}</p>
        <button onClick={() => navigate('/login')} className="mt-4 px-6 py-2 bg-rose-500 text-white rounded-full font-bold">{dt(`Kyçu`)}</button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-slate-50 pb-24 pt-4 text-slate-900 dark:bg-slate-950 dark:text-white">
      <section className="mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="relative h-32 overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-600 to-violet-700 sm:h-44">
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full border-[28px] border-white/10" />
          <div className="absolute -bottom-28 left-1/3 h-52 w-52 rounded-full bg-sky-300/20 blur-2xl" />
        </div>
        <div className="relative px-4 pb-5 sm:px-7">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-3">
              <div className="h-24 w-24 shrink-0 rounded-full bg-white p-1 shadow-lg dark:bg-zinc-900 sm:h-28 sm:w-28">
                <img loading="lazy" decoding="async"
                  src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=1d4ed8&color=fff`}
                  alt={`Profili i ${currentUser.name}`}
                  className="h-full w-full rounded-full object-cover"
                />
              </div>
              <div className="min-w-0 pb-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {business ? `Biznes · ${prefsOf(currentUser).business.category}` : 'Profil qytetar'}
                </span>
                <h2 className="mt-1 truncate text-xl font-black sm:text-2xl">{currentUser.name}</h2>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  @{currentUser.name?.replace(/\s+/g, '').toLowerCase() || 'qytetar'} · Kosovë
                </p>
              </div>
            </div>
            <div className="flex gap-2 sm:pb-1">
              <button
                type="button"
                onClick={onCreateStory}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-3 text-xs font-black text-white transition hover:bg-blue-800 sm:flex-none"
              >
                <Plus className="h-4 w-4" /> Debat Story
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('zeri:open-profile'))}
                className="min-h-10 flex-1 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-slate-200 dark:hover:bg-zinc-800 sm:flex-none"
              >
                {dt('Edit profile')}
              </button>
            </div>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {currentUser.bio?.trim() || 'Qytetar aktiv i Kosovës. Ndaj ide, ndjek çështjet lokale dhe marr pjesë në vendimmarrje.'}
          </p>

          {onOpenTrash && deletedCount > 0 && (
            <button type="button" onClick={onOpenTrash}
              className="mt-4 ml-2 inline-flex min-h-10 items-center gap-2 rounded-full border border-rose-300 px-4 text-xs font-black text-rose-600 transition hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30">
              <Trash2 className="h-4 w-4" aria-hidden="true" /> {dt('Postimet e fshira')} ({deletedCount})
            </button>
          )}
          {onOpenInsights && (
            <button type="button" onClick={onOpenInsights}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-300 px-4 text-xs font-black text-slate-700 transition hover:border-blue-400 hover:text-blue-700 dark:border-zinc-700 dark:text-slate-200">
              <BarChart3 className="h-4 w-4" aria-hidden="true" /> {business ? dt('Statistikat e biznesit') : dt('Statistikat e llogarisë')}
            </button>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { value: ownPosts.length, label: 'Postime' },
              { value: stories.length, label: 'Story aktive' },
              { value: followersCount, label: 'Followers' },
              { value: followingCount, label: 'Duke ndjekur' },
              { value: totalLikes, label: 'Pëlqime' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-zinc-800/70">
                <p className="text-lg font-black">{stat.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div role="tablist" aria-label="Përmbajtja e profilit" className="sticky top-0 z-10 mx-auto mt-4 flex w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {([
          { id: 'posts', label: 'Publikimet', Icon: Grid },
          ...(showReels ? [{ id: 'reels', label: 'Reels', Icon: Film }] as const : []),
          { id: 'liked', label: 'Pëlqyera', Icon: Heart },
          { id: 'saved', label: 'Të ruajtura', Icon: Bookmark },
          { id: 'followers', label: `Followers (${followersList.length})`, Icon: Users },
          { id: 'following', label: `Duke ndjekur (${followingList.length})`, Icon: SearchIcon },
          { id: 'settings', label: 'Cilësimet', Icon: Settings },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-label={label}
            aria-selected={activeProfileTab === id}
            onClick={() => setActiveProfileTab(id)}
            className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-bold transition-colors ${activeProfileTab === id ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-zinc-800'}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="mx-auto mt-3 w-full max-w-3xl">
        {(activeProfileTab === 'followers' || activeProfileTab === 'following') && (() => {
          const list = activeProfileTab === 'followers' ? followersList : followingList;
          const term = socialSearch.trim().toLowerCase();
          const filtered = term
            ? list.filter(person => person.name.toLowerCase().includes(term))
            : list;
          return (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="relative mb-4">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={socialSearch}
                  onChange={(event) => setSocialSearch(event.target.value)}
                  placeholder={activeProfileTab === 'followers' ? 'Kërko në followers...' : 'Kërko tek duke ndjekur...'}
                  aria-label="Kërko përdorues"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              {activeProfileTab === 'following' && notFollowedBack.length > 0 && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    <UserMinus className="h-3.5 w-3.5" /> Nuk e kanë kthyer follow-in ({notFollowedBack.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {notFollowedBack.map(person => (
                      <div key={person.id} className="flex items-center gap-1.5 rounded-full bg-white px-2 py-1 dark:bg-zinc-900">
                        <img loading="lazy" decoding="async" src={person.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&background=1d4ed8&color=fff`} className="h-6 w-6 rounded-full" alt="" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{person.name}</span>
                        <button
                          type="button"
                          onClick={() => onToggleFollow?.(person.id, person.name)}
                          aria-label={`Ndalo ndjekjen e ${person.name}`}
                          className="rounded-full p-1 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/40"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filtered.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  {term ? 'Askujt nuk e gjetëm me këtë emër.' : activeProfileTab === 'followers' ? 'Ndonjëri ende nuk të ndjek. Publiko më shpesh për të ndërtuar audiencën!' : 'Nuk ndjek askend ende.'}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filtered.map(person => (
                    <li key={person.id} className="flex items-center gap-3 py-2.5">
                      <img loading="lazy" decoding="async" src={person.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&background=1d4ed8&color=fff`} className="h-10 w-10 rounded-full object-cover" alt="" />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900 dark:text-white">{person.name}</span>
                      <button
                        type="button"
                        onClick={() => onToggleFollow?.(person.id, person.name)}
                        aria-pressed={followingList.some(f => f.id === person.id)}
                        className={`rounded-full px-3.5 py-1.5 text-[11px] font-black transition ${
                          followingList.some(f => f.id === person.id)
                            ? 'border border-slate-300 text-slate-600 hover:border-rose-300 hover:text-rose-500 dark:border-zinc-700 dark:text-slate-300'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {followingList.some(f => f.id === person.id) ? 'Duke ndjekur' : 'Ndjek'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {activeProfileTab === 'followers' && suggestions.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-zinc-800">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    <UserPlus className="h-3.5 w-3.5" /> Sugjerime për ty
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {suggestions.map(person => (
                      <div key={person.id} className="flex w-36 shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-slate-200 p-3 text-center dark:border-zinc-800">
                        <img loading="lazy" decoding="async" src={person.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&background=1d4ed8&color=fff`} className="h-12 w-12 rounded-full object-cover" alt="" />
                        <span className="w-full truncate text-xs font-bold text-slate-900 dark:text-white">{person.name}</span>
                        <span className="text-[10px] text-slate-500">{person.followers} followers</span>
                        <button
                          type="button"
                          onClick={() => onToggleFollow?.(person.id, person.name)}
                          className="w-full rounded-full bg-blue-600 py-1.5 text-[10px] font-black text-white hover:bg-blue-700"
                        >
                          Ndjek
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {activeProfileTab === 'settings' && (
        <div className="mx-auto mt-3 w-full max-w-3xl">
          <ForumSettingsPanel />
        </div>
      )}

      <div className={`mx-auto mt-3 grid min-h-52 w-full max-w-3xl grid-cols-2 content-start gap-2 sm:grid-cols-3 ${activeProfileTab === 'settings' ? 'hidden' : ''}`}>
        {activeProfileTab === 'reels' && showReels && (
          <ProfileReelsGrid authorId={currentUser.id} isOwner onOpen={(reel) => onOpenReel?.(reel)} onCreate={onCreateReel} />
        )}
        {activeProfileTab === 'posts' && showReels && stories.map(story => (
          <div key={story.id} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-slate-200 dark:bg-zinc-900">
            {story.isPhoto ? (
              <img loading="lazy" decoding="async" src={story.mediaUrl} className="w-full h-full object-cover" alt="" />
            ) : (
              <video src={story.mediaUrl} className="w-full h-full object-cover" />
            )}
            <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white">
              <Play className="w-3 h-3" />
              {story.views || 0}
            </div>
          </div>
        ))}
        {activePosts.map(post => (
          <button key={post.id} type="button" onClick={() => setActiveTab('feed')} aria-label={post.content?.slice(0, 90) || 'Hap postimin'} className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-slate-200 bg-white text-left dark:border-zinc-800 dark:bg-zinc-900">
            {post.imageUrl ? <img loading="lazy" decoding="async" src={post.imageUrl} className="h-full w-full object-cover" alt="" /> : <span className="line-clamp-6 p-3 text-xs leading-relaxed text-slate-700 dark:text-slate-200">{post.content}</span>}
            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white"><Heart className="h-3 w-3" />{post.likes?.length || 0}</span>
          </button>
        ))}
        {activeProfileTab === 'posts' && !showReels && stories.length > 0 && (
          <div className="col-span-full py-4 text-center text-xs text-slate-500">{dt('Debat Story-t janë çaktivizuar nga administratori.')}</div>
        )}
        {activeProfileTab !== 'reels' && activePosts.length === 0 && !(activeProfileTab === 'posts' && showReels && stories.length > 0) && (
          <div className="col-span-full flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 py-16 text-slate-500 dark:border-zinc-700">
            <Sparkles className="h-6 w-6 text-blue-500" aria-hidden="true" />
            <p className="text-sm font-bold">{activeProfileTab === 'posts' ? 'Nuk keni publikuar ende.' : activeProfileTab === 'liked' ? 'Nuk keni pëlqyer ende postime.' : activeProfileTab === 'saved' ? 'Nuk keni ruajtur ende postime.' : 'Nuk keni ruajtur ende postime.'}</p>
            {activeProfileTab === 'posts'
              ? <button type="button" onClick={onCreateStory} className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400">Publiko Debat Story</button>
              : <button type="button" onClick={() => setActiveProfileTab('posts')} className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400">{dt('Kthehu te publikimet')}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

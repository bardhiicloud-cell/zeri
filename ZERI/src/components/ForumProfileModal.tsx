import { dt } from '@/src/lib/dt';
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User as UserIcon, MessageSquare, Calendar, Megaphone,
  ShieldCheck, UserPlus, UserCheck, Play, Radio, Share2, Award, MapPin,
  ExternalLink, Heart, Eye, Sparkles, Lock, Mail, Phone, Globe, Briefcase
} from 'lucide-react';
import { addDoc, collection, serverTimestamp, getDocs, query, where, updateDoc, doc, limit } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useStore } from '../lib/store';
import { recordMatchesScope, isSpecificScope } from '../lib/municipalityScope';
import { PUBLIC_LIMITS } from '../lib/loadLimits';
import { fetchReelsByAuthor } from '../lib/reelsSocial';
import type { Reel } from '../lib/reels';
import { shareNatively } from '../lib/share';
import { canViewProfile, canViewReels, prefsOf } from '../lib/forumPrefs';
import { trackInsight, type ContactKind } from '../lib/forumAnalyticsApi';
import toast from 'react-hot-toast';

export function ForumProfileModal({
  isOpen,
  onClose,
  authorName,
  authorId,
  authorAvatar,
  posts = [],
  followed = false,
  onToggleFollow,
  onOpenDM,
  onOpenReel,
  authorProfile,
}: {
  isOpen: boolean;
  onClose: () => void;
  authorName: string;
  authorId: string;
  authorAvatar?: string;
  posts?: any[];
  followed?: boolean;
  onToggleFollow?: (targetId: string, name: string) => void | Promise<void>;
  onOpenDM?: (user: { id: string; name: string; avatar?: string }) => void;
  /** Opens the Reels player on one reel of this profile. */
  onOpenReel?: (reel: Reel) => void;
  /** The author's users/{id} document, for their bio and Debati Publik privacy choices. */
  authorProfile?: { bio?: string; forumPrefs?: unknown };
}) {
  const currentUser = useStore(state => state.currentUser);
  const userMunicipality = useStore(state => state.userMunicipality);
  const systemSettings = useStore(state => state.systemSettings);
  /*
   * The follower count used to be a hardcoded 142 with an optimistic bump on
   * follow — a number that lied on every profile. The real count is derived
   * from the users collection the page already holds (every profile document
   * carries `followingIds`), and follow/unfollow still adjusts it optimistically
   * from that true base instead of from a fabricated one.
   */
  const allUsers = useStore(state => (state as any).allForumUsers);
  const realFollowerCount = useMemo(
    () => (Array.isArray(allUsers) ? allUsers.filter((u: any) => Array.isArray(u.followingIds) && u.followingIds.includes(authorId)).length : 0),
    [allUsers, authorId]
  );
  const [followerDelta, setFollowerDelta] = useState(0);
  const authorPrefs = prefsOf(authorProfile);
  const viewerOpts = {
    isOwner: currentUser?.id === authorId,
    viewerFollowsOwner: Array.isArray((currentUser as any)?.followingIds) && ((currentUser as any).followingIds as string[]).includes(authorId),
    viewerIsStaff: ['admin', 'superadmin', 'debatwp'].includes(currentUser?.role || ''),
  };
  const canSeeReels = canViewReels(authorPrefs, viewerOpts);
  const isBiz = authorPrefs.accountType === 'business';
  // A business account learns how many people opened its profile (server counts once per day per person).
  useEffect(() => {
    if (isOpen && authorId && currentUser?.id && currentUser.role !== 'guest') trackInsight({ authorId, type: 'profile_view' }, currentUser.id);
  }, [isOpen, authorId, currentUser?.id]);
  const contactClick = (kind: ContactKind) => {
    if (currentUser?.id && currentUser.role !== 'guest') trackInsight({ authorId, type: 'contact_click', kind }, currentUser.id);
  };
  const canView = canViewProfile(authorPrefs, {
    isOwner: currentUser?.id === authorId,
    viewerFollowsOwner: Array.isArray((currentUser as any)?.followingIds) && ((currentUser as any).followingIds as string[]).includes(authorId),
    viewerIsStaff: ['admin', 'superadmin', 'debatwp'].includes(currentUser?.role || ''),
  });
  const [activeTab, setActiveTab] = useState<'reels' | 'debates' | 'bio'>('debates');
  const showReels = systemSettings?.showReels ?? true;
  const [userReels, setUserReels] = useState<any[]>([]);
  const [loadingReels, setLoadingReels] = useState(false);

  // Fetch author's reels from Firestore when modal opens
  useEffect(() => {
    if (!isOpen || !authorId) return;

    const fetchAuthorReels = async () => {
      setLoadingReels(true);
      try {
        // Real Reels (forumReels). The author also sees their own moderated ones.
        setUserReels(await fetchReelsByAuthor(authorId, currentUser?.id === authorId, PUBLIC_LIMITS.profileReels));
      } catch (err) {
        console.error('Error fetching author reels:', err);
      } finally {
        setLoadingReels(false);
      }
    };

    fetchAuthorReels();
  }, [isOpen, authorId]);

  const stats = useMemo(() => {
    const viewerFollowsAuthor = Array.isArray((currentUser as any)?.followingIds)
      ? ((currentUser as any).followingIds as string[]).includes(authorId)
      : false;
    const isOwnProfile = currentUser?.id === authorId;
    /*
     * A followers-only post is invisible to a stranger browsing this profile —
     * the same rule the feed enforces. The author sees their own restricted
     * posts, and the count reflects exactly what the list below will show.
     */
    const userPosts = (posts || []).filter(p =>
      (p.authorId === authorId || p.author === authorName)
      && (p.visibility !== 'followers' || isOwnProfile || viewerFollowsAuthor));
    const postCount = userPosts.length;
    const totalPostLikes = userPosts.reduce((acc, p) => acc + (p.likes?.length || 0), 0);
    const totalReelLikes = userReels.reduce((acc, r) => acc + (r.likedBy?.length || 0), 0);
    const totalViews = 0;
    return { postCount, reelCount: userReels.length, totalLikes: totalPostLikes + totalReelLikes, totalViews, userPosts };
  }, [posts, authorId, authorName, userReels]);

  if (!isOpen) return null;

  const handleAdvertiseRequest = async () => {
    if (!currentUser) {
      toast.error("Ju lutem kyçuni për të kërkuar reklamim.");
      return;
    }
    if (currentUser.role === 'guest') {
      toast.error("Si mysafir nuk mund të kërkoni reklamim.");
      return;
    }
    try {
      await addDoc(collection(db, 'adRequests'), {
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        userPhone: currentUser.phone || '',
        targetAuthorId: authorId,
        targetAuthorName: authorName,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      toast.success("Kërkesa për reklamim u dërgua me sukses! Do t'ju kontaktojmë së shpejti.");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Pati një problem gjatë dërgimit të kërkesës.");
    }
  };

  const toggleFollow = async () => {
    if (!onToggleFollow) return;
    if (!currentUser || currentUser.role === 'guest') {
      toast.error(dt('Kyçuni për të ndjekur këtë profil.'));
      return;
    }
    // Optimistic count, then the page's writer confirms and may roll the whole
    // thing back — the same contract as the follow button on a post card.
    setFollowerDelta((prev) => (followed ? Math.max(0, realFollowerCount + prev - 1) : prev + 1) - realFollowerCount);
    try {
      await onToggleFollow(authorId, authorName);
    } catch {
      setFollowerDelta(0);
    }
  };

  const shareProfile = async () => {
    const result = await shareNatively({
      // A profile has no route of its own — the modal is opened from a post —
      // so the link points at the debate feed, which is where the person's
      // posts are listed. Copying `window.location.href` was worse than that:
      // it copied the router root, so the link promised nothing.
      url: `${window.location.origin}${window.location.pathname}#/forum`,
      title: `${authorName} — Debati Publik`,
      text: dt('Shiko profilin dhe debatet e këtij qytetari në platformë.'),
    });
    if (result === 'copied') toast.success(dt('Linku i profilit u kopjua.'));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            className="bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden text-white relative max-h-[90vh] flex flex-col"
          >
            {/* Header Banner */}
            <div className="relative h-32 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 shrink-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />

              <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                <button
                  onClick={shareProfile}
                  className="p-2 bg-black/30 hover:bg-black/50 text-white rounded-full backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                  title={dt(`Shpërndaj profilin`)}
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 bg-black/30 hover:bg-black/50 text-white rounded-full backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="absolute top-3 left-4 flex items-center gap-1.5 px-3 py-1 bg-black/30 backdrop-blur-md rounded-full border border-white/20 text-[10px] font-black text-amber-300">
                <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />{dt(`Profil Zyrtar I Verifikuar`)}
              </div>
            </div>

            {/* Profile Avatar & Primary Info */}
            <div className="px-6 pb-4 pt-0 relative shrink-0">
              <div className="flex justify-between items-end -mt-12 mb-3">
                <div className="relative">
                  <div className="w-24 h-24 rounded-[2rem] p-1 bg-gradient-to-tr from-blue-500 via-indigo-500 to-pink-500 shadow-2xl">
                    <img
                      src={authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=3b82f6&color=fff`}
                      alt={authorName}
                      className="w-full h-full rounded-[1.25rem] object-cover bg-slate-800"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 p-1 bg-blue-600 text-white rounded-full border-2 border-slate-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex gap-2">
                  {currentUser && currentUser.id !== authorId && onOpenDM && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenDM({ id: authorId, name: authorName, avatar: authorAvatar });
                      }}
                      className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-400 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      title={dt('Dërgo Mesazh Privat')}
                    >
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      {dt(`Mesazh`)}
                    </button>
                  )}
                  <button
                    onClick={toggleFollow}
                    className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] flex items-center gap-1.5 cursor-pointer ${
                      followed
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/30'
                    }`}
                  >
                    {followed ? <><UserCheck className="w-4 h-4 text-emerald-400" />{dt(`Ndiqet`)}</> : <><UserPlus className="w-4 h-4" />{dt(`Ndiq Profilin`)}</>}
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  {authorName}
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-medium">
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-rose-400" />{dt(`Kosovë`)}</span>
                  <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5 text-amber-400" />{dt(`Gazetar Qytetar`)}</span>
                </div>
              </div>

              {isBiz && (
                <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-blue-300">
                    <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />{dt('Biznes')} · {authorPrefs.business.category}
                  </p>
                  {authorPrefs.business.address && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-300"><MapPin className="h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden="true" />{authorPrefs.business.address}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {authorPrefs.business.phone && (
                      <a href={`tel:${authorPrefs.business.phone.replace(/[^\d+]/g, '')}`} onClick={() => contactClick('phone')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">
                        <Phone className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />{dt('Telefono')}
                      </a>
                    )}
                    {authorPrefs.business.email && (
                      <a href={`mailto:${authorPrefs.business.email}`} onClick={() => contactClick('email')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">
                        <Mail className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />{dt('Email')}
                      </a>
                    )}
                    {authorPrefs.business.website && (
                      <a href={authorPrefs.business.website} target="_blank" rel="noopener noreferrer nofollow" onClick={() => contactClick('website')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">
                        <Globe className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />{dt('Faqja')}
                      </a>
                    )}
                    {!authorPrefs.business.phone && !authorPrefs.business.email && !authorPrefs.business.website && (
                      <p className="text-[11px] text-slate-400">{dt('Ky biznes nuk ka shtuar ende të dhëna kontakti.')}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Stats Bar */}
              {canView && <div className="grid grid-cols-4 gap-2 my-4 p-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-center">
                <div>
                  <div className="text-sm font-black text-white">{authorPrefs.showFollowLists || currentUser?.id === authorId ? Math.max(0, realFollowerCount + followerDelta) : '—'}</div>
                  <div className="text-[10px] font-bold text-slate-400">{dt(`Ndjekës`)}</div>
                </div>
                <div>
                  <div className="text-sm font-black text-rose-400">{stats.reelCount}</div>
                  <div className="text-[10px] font-bold text-slate-400">{dt(`Reels`)}</div>
                </div>
                <div>
                  <div className="text-sm font-black text-blue-400">{stats.postCount}</div>
                  <div className="text-[10px] font-bold text-slate-400">{dt(`Debate`)}</div>
                </div>
                <div>
                  <div className="text-sm font-black text-emerald-400">{stats.totalLikes}</div>
                  <div className="text-[10px] font-bold text-slate-400">{dt(`Pëlqime`)}</div>
                </div>
              </div>}

              {/* Tab Selection */}
              {canView && <div className="flex border-b border-slate-800 font-extrabold text-xs">
                <button 
                  onClick={() => setActiveTab('reels')} 
                  className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                    activeTab === 'reels' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />{dt(`Reels (`)}{stats.reelCount})
                </button>
                <button 
                  onClick={() => setActiveTab('debates')} 
                  className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                    activeTab === 'debates' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />{dt(`Debatet (`)}{stats.postCount})
                </button>
                <button 
                  onClick={() => setActiveTab('bio')} 
                  className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                    activeTab === 'bio' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5" />{dt(`Rreth Meje`)}
                </button>
              </div>}
            </div>

            {/* Tab Content Area */}
            <div className="px-6 pb-6 overflow-y-auto flex-1 min-h-[180px] space-y-3">
              {!canView && (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-10 text-center">
                  <Lock className="h-6 w-6 text-slate-400" aria-hidden="true" />
                  <p className="text-sm font-extrabold text-white">{authorPrefs.profileVisibility === 'private' ? dt('Ky profil është privat') : dt('Ky profil është vetëm për ndjekësit')}</p>
                  <p className="text-xs text-slate-400">{authorPrefs.profileVisibility === 'private' ? dt('Ky qytetar nuk i shfaq postimet dhe reels te profili.') : dt('Ndiq këtë qytetar për të parë postimet, reels dhe bio-n e tij.')}</p>
                </div>
              )}
              {canView && activeTab === 'reels' && !canSeeReels && (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-8 text-center">
                  <Lock className="h-5 w-5 text-slate-400" aria-hidden="true" />
                  <p className="text-xs font-extrabold text-white">{dt('Reels-et e këtij qytetari nuk janë publike')}</p>
                </div>
              )}
              {canView && canSeeReels && activeTab === 'reels' && (
                <div>
                  {loadingReels ? (
                    <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 font-bold">{dt(`Po ngarkohen videot reels...`)}</div>
                  ) : userReels.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs font-bold bg-slate-950/50 rounded-2xl border border-slate-800">{dt(`Ky përdorues nuk ka publikuar ende asnjë video Reel.`)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {userReels.map((reel) => (
                        <button key={reel.id} type="button" onClick={() => onOpenReel?.(reel)}
                          aria-label={reel.caption ? reel.caption.slice(0, 90) : dt('Hap Reel-in')}
                          className="group relative aspect-[9/16] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-left">
                          <video src={`${reel.mediaUrl}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent p-2 text-white">
                            <span className="flex items-center gap-0.5 text-[10px] font-black text-rose-400"><Heart className="w-2.5 h-2.5 fill-current" /> {reel.likedBy.length}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {canView && activeTab === 'debates' && (
                <div className="space-y-2">
                  {stats.userPosts.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs font-bold bg-slate-950/50 rounded-2xl border border-slate-800">{dt(`Nuk ka debate publike të hapura nga ky anëtar.`)}
                    </div>
                  ) : (
                    stats.userPosts.map((post) => (
                      <div key={post.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                          <span className="text-blue-400">#{post.category || 'Debat'}</span>
                          <span>{post.timestamp ? new Date(post.timestamp).toLocaleDateString('sq-AL') : 'Sot'}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-200 line-clamp-2">{post.content}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {canView && activeTab === 'bio' && (
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3 text-xs leading-relaxed text-slate-300">
                  <p className="font-medium">{authorProfile?.bio?.trim() || dt(`🇦🇱 Qytetar aktiv i Kosovës i përkushtuar për ngritjen e zërit publik, rregullimin e hapësirave publike dhe promovimin e kulturës dixhitale lokale.`)}
                  </p>
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between"><span className="text-slate-500 dark:text-slate-400">{dt(`I bashkuar:`)}</span> <span className="font-bold text-slate-200">{dt(`Qershor 2024`)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-500 dark:text-slate-400">{dt(`Ndërveprimi Publik:`)}</span> <span className="font-bold text-emerald-400">{dt(`Super Aktiv`)}</span></div>
                  </div>
                </div>
              )}

              {/* Action Button: Ad request */}
              <button 
                onClick={handleAdvertiseRequest} 
                className="w-full mt-2 py-3 bg-gradient-to-r from-indigo-900/60 to-purple-900/60 hover:from-indigo-900 hover:to-purple-900 text-indigo-200 font-extrabold rounded-2xl transition-all border border-indigo-700/50 flex items-center justify-center gap-2 text-xs cursor-pointer shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none"
              >
                <Megaphone className="w-4 h-4 text-indigo-400" />{dt(`Reklamo apo Sponzorizo me këtë Krijues`)}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}


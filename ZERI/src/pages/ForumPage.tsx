import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { dt } from '@/src/lib/dt';
import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { ALL_SCOPE, isSpecificScope, scopeKey } from '../lib/municipalityScope';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { ForumProfileModal } from '../components/ForumProfileModal';
import { 
  Send, Heart, MessageCircle, Share2, MoreHorizontal, ShieldCheck, 
  Image as ImageIcon, ThumbsUp, MessageSquare, Smile, X, 
  Search, Bell, Trash2, Home, User, Loader2, ArrowUpRight, Globe, Video, Users, Eye, EyeOff, Hash, Filter, ChevronDown, Check, AlertTriangle, TrendingUp, UserPlus, Sparkles, MapPin, BarChart3, CornerDownRight, Award, BadgeCheck, Flame, PieChart, Layers, ArrowLeft, SlidersHorizontal, Plus, Shield, Megaphone, DollarSign, Radio, Bookmark, LockKeyhole, Settings2
, RefreshCw, Film, Flag} from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { auth, db, uploadFileToStorage } from '../lib/firebase';
import { 
  collection, query, orderBy, onSnapshot, addDoc,  limit,
  serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove, deleteDoc , where, getDocs
} from 'firebase/firestore';
import { PostFormatter } from "../components/PostFormatter";
import { HashtagSheet } from '../components/forum/HashtagSheet';
import { adVisibleInFeed } from '../lib/adCampaign';
import { Clock as ClockIcon, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { PostGallery } from '../components/forum/PostGallery';
import { ScheduledPostsSheet } from '../components/forum/ScheduledPostsSheet';
import { localInputToMs, msToLocalInput, schedulePostApi } from '../lib/forumScheduleApi';
import { clearDraft, loadDraft, saveDraft } from '../lib/postDraft';
import { LegalModal } from "../components/LegalModal";
import { GuestGuard } from '../components/GuestGuard';
import ForumProfileTab from '../components/forum/ForumProfileTab';
import { ForumStories } from '../components/forum/ForumStories';
import { VerifiedBadge } from '../components/forum/VerifiedBadge';
import { ForumExplore, type ExplorePerson } from '../components/forum/ForumExplore';
import { ForumNotificationsView, isForumNotification } from '../components/forum/ForumNotificationsView';
import { VerificationModal } from '../components/forum/VerificationModal';
import { PostAnalyticsSheet } from '../components/forum/PostAnalyticsSheet';
import { AccountInsightsSheet } from '../components/forum/AccountInsightsSheet';
import { PostOwnerMenu } from '../components/forum/PostOwnerMenu';
import { LoadMore } from '../components/forum/LoadMore';
import { fetchPeople, followApi, unfollowApi } from '../lib/forumPeopleApi';
import { useForumFeed } from '../lib/useForumFeed';
import { reelIdFromSearch } from '../lib/reelsApi';
import { PostEditSheet } from '../components/forum/PostEditSheet';
import { SponsoredPostBar } from '../components/forum/SponsoredPostBar';
import { DeletedPostsSheet, type DeletedPost } from '../components/forum/DeletedPostsSheet';
import {
  addCommentApi, deleteCommentApi, deletePostApi, notifyFollowApi, notifyPublishedApi, restorePostApi, setReactionApi, votePollApi,
} from '../lib/forumPostsApi';
import { PostViewSensor } from '../components/forum/PostViewSensor';
import { ReportPostSheet } from '../components/forum/ReportPostSheet';
import { ReportTargetSheet, type ReportTarget } from '../components/forum/ReportTargetSheet';
import { useVerifiedIds } from '../lib/forumApi';
import { rankForYou, hotScore as rankHotScore, trendingScore as rankTrendingScore } from '../lib/forumRanking';
import { computeTrends, extractHashtags, extractMentions, toHandle } from '../lib/forumTrends';
import { audienceAllows, canViewReels, isBusiness, prefsOf, wantsNotification } from '../lib/forumPrefs';
import { AdRequestModal } from '../components/AdRequestModal.tsx';
import { ShareSheet } from '../components/ShareSheet.tsx';
import { DirectMessagesModal } from '../components/forum/DirectMessagesModal';
import { ReelsViewer, type ReelsSource } from '../components/forum/ReelsViewer';
import { ReelComposer } from '../components/forum/ReelComposer';
import { CreateMenuSheet, type CreateAction } from '../components/forum/CreateMenuSheet';
import { FORUM_MUNICIPALITIES } from '../lib/constants';

// Static forum data lives in src/lib/constants.ts on purpose: a page module that
// exports plain values alongside its component breaks Vite's React Fast Refresh
// boundary ("Could not Fast Refresh ... export is incompatible").
const FORUM_CATEGORIES = [
  { id: 'all', name: 'Të Gjitha' },
  { id: 'infrastrukture', name: 'Infrastrukturë', color: 'bg-blue-500' },
  { id: 'mjedis', name: 'Mjedis & Pemë', color: 'bg-emerald-500' },
  { id: 'arsim', name: 'Arsim & Shkolla', color: 'bg-amber-500' },
  { id: 'transport', name: 'Transport & Trafik', color: 'bg-rose-500' },
  { id: 'kulture', name: 'Kulturë & Rini', color: 'bg-purple-500' },
  { id: 'shendetesi', name: 'Shëndetësi', color: 'bg-teal-500' },
  { id: 'siguri', name: 'Siguri Qytetare', color: 'bg-indigo-500' }
];

const KOSOVO_MUNICIPALITIES = FORUM_MUNICIPALITIES;

interface CommentReply {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
}

interface ForumComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
  replies?: CommentReply[];
  likes?: string[];
}

interface PostPollOption {
  id: string;
  text: string;
  votes: string[];
}

interface PostPoll {
  question: string;
  options: PostPollOption[];
  totalVotes: number;
}

interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  authorAvatar?: string;
  authorRole: string;
  authorBadge?: string;
  content: string;
  imageUrl?: string;
  category?: string;
  neighborhood?: string;
  poll?: PostPoll;
  quotedPost?: {
    id: string;
    authorName: string;
    authorAvatar?: string;
    authorBadge?: string;
    content: string;
    imageUrl?: string;
    createdAt?: any;
  };
  isApproved?: boolean;
  isHidden?: boolean;
  likes: string[];
  reposts?: string[];
  reactions?: Record<string, string[]>;
  isAd?: boolean;
  adLink?: string;
  /** Post audience: 'public' everywhere, 'followers' only to people who follow the author. Legacy posts have no field and are treated as public. */
  visibility?: 'public' | 'followers';
  comments: ForumComment[];
  aiSentiment?: {
    positivePct: number;
    negativePct: number;
    neutralPct: number;
    summaryText: string;
  };
  /** Impressions, counted server-side once per account. */
  viewCount?: number;
  /** Set by the server when the author edits the text. */
  editedAt?: any;
  /** Set by the server on soft delete; the post is hidden from the feed and restorable for 30 days. */
  deletedAt?: any;
  /** Counted by the server redirect, once per visitor per day. */
  adClicks?: number;
  createdAt: any;
}




// No placeholder institutions or topics: only real accounts and real posts are shown.
const DEFAULT_OFFICIAL_PROFILES: any[] = [];

const DEFAULT_TRENDS: any[] = [];

export default function ForumPage() {
  const navigate = useNavigate();
  const { dt } = useLanguage();
  const currentUser = useStore(state => state.currentUser);
  const systemSettings = useStore(state => state.systemSettings);
  const showReels = systemSettings?.showReels ?? true;

  // Public posts (live), my own (live), followers-only posts of people I follow (server) and older pages.
  const { posts, setPosts, trash: trashPosts, isLoading, hasMore, loadingMore, loadMore } = useForumFeed<Post>({
    uid: currentUser?.id ?? null,
    isGuest: !currentUser || currentUser.role === 'guest',
    followingKey: (((currentUser as any)?.followingIds as string[] | undefined) ?? []).join(','),
  });
  const [newPostContent, setNewPostContent] = useState('');
  // Up to four photos per post.
  const [newPostImages, setNewPostImages] = useState<File[]>([]);
  // `datetime-local` value; empty means publish now.
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduledSheetOpen, setScheduledSheetOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Active Filter States
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const userMunicipality = useStore(state => state.userMunicipality);
  const setUserMunicipality = useStore(state => state.setUserMunicipality);

  // A new post is filed into the globally active municipality by default, so the
  // author does not have to re-pick the same name on every submission. It stays
  // local state: posting about a neighbour must not move the platform scope.
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(
    isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : ALL_SCOPE
  );

  /**
   * The neighbourhood filter is a view of the global scope, not a second scope.
   * It was seeded once from the store and then diverged: changing the
   * municipality in the sidebar left the forum showing the previous one's posts
   * while its label still read the new one.
   */
  const [activeNeighborhoodFilter, setActiveNeighborhoodFilter] = useState(
    isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : ALL_SCOPE
  );
  useEffect(() => {
    setActiveNeighborhoodFilter(isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : ALL_SCOPE);
  }, [userMunicipality]);

  // Writing through the store keeps the two in lockstep in both directions.
  const handleNeighborhoodFilter = (value: string) => {
    setActiveNeighborhoodFilter(value);
    setUserMunicipality(value || ALL_SCOPE);
  };

  // Algorithmic State with robust defaults
  const [currentTrends, setCurrentTrends] = useState<any[]>(DEFAULT_TRENDS.slice(0, 3));
  const [currentProfiles, setCurrentProfiles] = useState<any[]>(DEFAULT_OFFICIAL_PROFILES.slice(0, 3));
  const [allProfiles, setAllProfiles] = useState<any[]>(DEFAULT_OFFICIAL_PROFILES);

  // Fetch official profiles from DB with fallback
  useEffect(() => {
    try {
      // Bounded: official profiles are a curated admin list, but the rules of
      // this codebase forbid unbounded listeners regardless of current size.
      const q = query(collection(db, 'officialProfiles'), limit(200));
      const unsub = onSnapshot(q, snap => {
        const p = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const list = p.length > 0 ? p : DEFAULT_OFFICIAL_PROFILES;
        setAllProfiles(list);
        setCurrentProfiles(list.slice(0, 3));
      }, (err) => {
        console.warn('Could not fetch officialProfiles, using defaults:', err);
        setAllProfiles(DEFAULT_OFFICIAL_PROFILES);
        setCurrentProfiles(DEFAULT_OFFICIAL_PROFILES.slice(0, 3));
      });
      return () => unsub();
    } catch (e) {
      console.warn('Error setting up officialProfiles listener:', e);
    }
  }, []);

  // Compute actual trends from `posts` state or fallback
  // Trends come from real posts only (hashtags and categories); no posts, no trends.
  const computedTrends = React.useMemo(
    () =>
      computeTrends(posts as any, { limit: 10 }).map((trend, index) => ({
        id: `${trend.kind}-${trend.label}`,
        category: trend.kind === 'hashtag' ? 'Trend' : 'Temë',
        location: 'Kosovë',
        title: trend.label,
        discussions: `${trend.posts} postime · ${trend.interactions} ndërveprime`,
        rank: index + 1,
      })),
    [posts]
  );

  const [feedSortBy, setFeedSortBy] = useState('foryou'); // 'foryou' (ranked), 'recent', 'trending', 'hot'
  const [feedTab, setFeedTab] = useState<'forYou' | 'following' | 'municipality' | 'polls' | 'official' | 'saved'>('forYou');
  const [isAdRequestModalOpen, setIsAdRequestModalOpen] = useState(false);
  const [adModalPostId, setAdModalPostId] = useState<string | undefined>(undefined);
  const [adModalPostContent, setAdModalPostContent] = useState<string | undefined>(undefined);
  const [showAllOfficialProfiles, setShowAllOfficialProfiles] = useState(false);

  // Direct Messages & Quote Posts State
  const [isDMModalOpen, setIsDMModalOpen] = useState(false);
  // Desktop left rail: open (labels) or closed (icons only). Remembered per browser.
  const [railCollapsed, setRailCollapsed] = useState(() => {
    try { return localStorage.getItem('zeri:forum-rail-collapsed') === '1'; } catch { return false; }
  });
  const toggleRail = () => setRailCollapsed((value) => {
    const next = !value;
    try { localStorage.setItem('zeri:forum-rail-collapsed', next ? '1' : '0'); } catch { /* storage unavailable */ }
    return next;
  });
  const [dmTargetUser, setDmTargetUser] = useState<{ id: string; name: string; avatar?: string } | null>(null);

  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteTargetPost, setQuoteTargetPost] = useState<Post | null>(null);
  const [quoteText, setQuoteText] = useState('');

  const handleOpenDM = (user?: { id: string; name: string; avatar?: string }) => {
    if (user) setDmTargetUser(user);
    setIsDMModalOpen(true);
  };

  /**
   * Live unread-DM counter for the header badge.
   *
   * One listener over this user's conversations — the same collection the DM
   * modal already reads — so the badge lights up in real time without the
   * modal being open. The counter sums only the per-participant unread counts
   * the sender increments; the listener stops when the modal opens (where the
   * full view clears them anyway) to avoid two listeners on one collection.
   */
  const [totalUnreadDMs, setTotalUnreadDMs] = useState(0);
  useEffect(() => {
    if (!currentUser || currentUser.role === 'guest' || isDMModalOpen) {
      setTotalUnreadDMs(0);
      return;
    }
    const q = query(
      collection(db, 'forum_conversations'),
      where('participants', 'array-contains', currentUser.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      let total = 0;
      snap.docs.forEach(d => {
        const data = d.data() as any;
        total += Number(data?.unreadCount?.[currentUser.id]) || 0;
      });
      setTotalUnreadDMs(total);
    }, () => setTotalUnreadDMs(0));
    return () => unsub();
  }, [currentUser?.id, currentUser?.role, isDMModalOpen]);

  const handleOpenQuoteModal = (post: Post) => {
    setQuoteTargetPost(post);
    setQuoteText('');
    setIsQuoteModalOpen(true);
  };

  const handleCreateQuotePost = async () => {
    if (!quoteTargetPost || !currentUser || currentUser.role === 'guest') return;

    setIsSubmitting(true);
    try {
      const created = await addDoc(collection(db, 'forumPosts'), {
        isHidden: false,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=0D8ABC&color=fff`,
        authorRole: currentUser.role,
        authorBadge: currentUser.points > 100 ? 'Përfaqësues Lagjeje' : 'Qytetar',
        content: quoteText,
        hashtags: extractHashtags(quoteText).slice(0, 10),
        category: quoteTargetPost.category || 'all',
        neighborhood: selectedNeighborhood,
        quotedPost: {
          id: quoteTargetPost.id,
          authorName: quoteTargetPost.authorName,
          authorAvatar: quoteTargetPost.authorAvatar,
          authorBadge: quoteTargetPost.authorBadge,
          content: quoteTargetPost.content,
          imageUrl: quoteTargetPost.imageUrl || '',
        },
        visibility: 'public',
        likes: [],
        comments: [],
        reactions: {},
        createdAt: serverTimestamp()
      });

      // The quoted author's bell and any mentions are handled by the server after it checks the stored post.
      void notifyPublishedApi(created.id, resolveMentionUids(quoteText));

      setQuoteTargetPost(null);
      setQuoteText('');
      setIsQuoteModalOpen(false);
      toast.success('U publikua me citat!');
    } catch (err) {
      console.error(err);
      toast.error('Nuk u publikua citati.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guest follows/bookmarks stay on this device; signed-in follows sync to the profile document.
  const [followedUserIds, setFollowedUserIds] = useState<string[]>(() => {
    const profileFollowing = (currentUser as any)?.followingIds;
    if (Array.isArray(profileFollowing)) return profileFollowing;
    try {
      const saved = localStorage.getItem('followed_user_ids');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });
  const [savedPostIds, setSavedPostIds] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('saved_forum_post_ids') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  /*
   * Post visibility toggle. When on, the new post is written with
   * `visibility: 'followers'` and is hidden from anyone who does not follow
   * the author (enforced at read time in the feed and on profiles).
   */
  const [followersOnly, setFollowersOnly] = useState(false);

  /**
   * Real social graph. Every signed-in profile document carries `followingIds`,
   * so one read of the users collection is enough to derive follower counts,
   * who did not follow back, and suggestions — without a counter collection.
   */
  const [allForumUsers, setAllForumUsers] = useState<any[]>([]);
  // A one-off read, refreshed when the tab regains focus (at most every 5 min).
  // This used to be a live onSnapshot over 500 user documents, so every profile
  // edit anywhere was pushed to every open forum tab. Follower counts do not
  // need second-by-second freshness; the user's own follows update locally.
  useEffect(() => {
    if (!currentUser || currentUser.role === 'guest') return;
    let cancelled = false;
    let lastLoad = 0;
    // The server computes counts and the follow relationships (a citizen cannot read other
    // profiles directly, which left this list empty). Each person carries `followers`, the
    // public forum preferences, and `followingIds: [me]` only when they follow me.
    const load = async () => {
      if (Date.now() - lastLoad < 60_000) return;
      lastLoad = Date.now();
      try {
        const { people } = await fetchPeople();
        if (!cancelled) setAllForumUsers(Array.isArray(people) ? people : []);
      } catch {
        if (!cancelled) setAllForumUsers([]);
      }
    };
    void load();
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); };
  }, [currentUser?.id, currentUser?.role]);

  const followingIdsOf = React.useCallback((userId: string): string[] => {
    const profile = allForumUsers.find(u => u.id === userId);
    return Array.isArray(profile?.followingIds) ? profile.followingIds : [];
  }, [allForumUsers]);

  const followerCountOf = React.useCallback((userId: string): number => {
    const person = allForumUsers.find(u => u.id === userId);
    // The server sends the real count; the fallback only serves lists built in the browser.
    if (typeof person?.followers === 'number') return person.followers;
    return allForumUsers.filter(u => Array.isArray(u.followingIds) && u.followingIds.includes(userId)).length;
  }, [allForumUsers]);

  /*
   * Debati Publik preferences of other citizens (users/{id}.forumPrefs). Used on
   * the sender's side: skip notifications a person switched off, and refuse
   * comments / mentions / reposts they restricted.
   */
  const forumProfileOf = React.useCallback((userId?: string) => allForumUsers.find(u => u.id === userId), [allForumUsers]);
  const notifAllowed = React.useCallback(
    (userId: string | undefined, category: string, kind?: 'comment' | 'reply') =>
      wantsNotification(forumProfileOf(userId), category, kind),
    [forumProfileOf]);

  /** People I follow who do not follow me back. */
  const notFollowedBack = React.useMemo(
    () => followedUserIds.filter(id => !followingIdsOf(id).includes(currentUser?.id || '')),
  [followedUserIds, followingIdsOf, currentUser?.id]);

  /** Suggestions: active citizens I do not follow yet, ranked by follower count. */
  const followSuggestions = React.useMemo(() => {
    const seenIds = new Set([currentUser?.id, ...followedUserIds]);
    return allForumUsers
      .filter(u => !seenIds.has(u.id))
      .map(u => ({ id: u.id, name: u.name || 'Qytetar', avatar: u.avatar || '', followers: followerCountOf(u.id) }))
      .sort((a, b) => b.followers - a.followers)
      .slice(0, 5);
  }, [allForumUsers, followedUserIds, currentUser?.id, followerCountOf]);

  useEffect(() => {
    const profileFollowing = (currentUser as any)?.followingIds;
    if (Array.isArray(profileFollowing)) setFollowedUserIds(profileFollowing);
  }, [currentUser?.id]);

  const forumNotifications = useStore((state) => state.notifications);
  const unreadForumCount = React.useMemo(
    () => (forumNotifications ?? []).filter((n) => isForumNotification(n, currentUser?.id) && !n.isRead).length,
    [forumNotifications, currentUser?.id]
  );

  /** Tell people they were mentioned (@handle). Skips yourself and anyone already notified. */
  /** Resolves @mentions in a text to account ids. The server re-checks that each person is really named. */
  const resolveMentionUids = (text: string): string[] => {
    if (!currentUser || currentUser.role === 'guest') return [];
    const handles = extractMentions(text);
    if (handles.length === 0) return [];
    return allForumUsers
      .filter(u => u.id !== currentUser.id && handles.includes(toHandle(u.name || '')))
      .slice(0, 5)
      .map(u => u.id);
  };

  const handleToggleFollow = async (targetId: string, name?: string) => {
    const isFollowing = followedUserIds.includes(targetId);
    const updated = isFollowing ? followedUserIds.filter(id => id !== targetId) : [...followedUserIds, targetId];
    if (currentUser && currentUser.role !== 'guest' && auth.currentUser) {
      try {
        // The server writes the follow (blocks respected, counters consistent) and notifies once.
        await (isFollowing ? unfollowApi(targetId) : followApi(targetId));
        useStore.getState().setCurrentUser({ ...currentUser, followingIds: updated } as any);
        setAllForumUsers(prev => prev.map(p => p.id === targetId
          ? { ...p, followers: Math.max(0, (typeof p.followers === 'number' ? p.followers : 0) + (isFollowing ? -1 : 1)) }
          : p));
      } catch (error) {
        console.error('Following nuk u ruajt:', error);
        toast.error(error instanceof Error ? error.message : 'Ndjekja nuk u ruajt. Provoni përsëri.');
        return;
      }
    }
    setFollowedUserIds(updated);
    try { localStorage.setItem('followed_user_ids', JSON.stringify(updated)); } catch { /* Storage may be unavailable. */ }
    if (isFollowing) toast(`Ndalove ndjekjen e ${name || 'përdoruesit'}`);
    else toast.success(`Tani po ndjek ${name || 'përdoruesin'}.`);
  };

  const handleToggleSavedPost = (postId: string) => {
    const updated = savedPostIds.includes(postId)
      ? savedPostIds.filter(id => id !== postId)
      : [...savedPostIds, postId];
    setSavedPostIds(updated);
    try { localStorage.setItem('saved_forum_post_ids', JSON.stringify(updated)); } catch { /* Storage may be unavailable. */ }
    toast.success(savedPostIds.includes(postId) ? 'Postimi u hoq nga të ruajturat.' : 'Postimi u ruajt.');
  };

  const persistPostAction = async (postId: string, action: 'like' | 'repost') => {
    if (postId.startsWith('demo-') || !currentUser || currentUser.role === 'guest' || !auth.currentUser) return;
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/v1/forum/posts/${encodeURIComponent(postId)}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Veprimi nuk u ruajt.');
    return result as { active: boolean; count: number };
  };

  useEffect(() => {
    const trendsPool = computedTrends.length > 0 ? computedTrends : DEFAULT_TRENDS;
    const profilesPool = allProfiles.length > 0 ? allProfiles : DEFAULT_OFFICIAL_PROFILES;

    const interval = setInterval(() => {
      setCurrentTrends(() => {
        if (trendsPool.length <= 3) return trendsPool;
        let shuffled = [...trendsPool].sort(() => 0.5 - Math.random());
        shuffled.sort((a, b) => a.rank - b.rank);
        return shuffled.slice(0, 3);
      });
      setCurrentProfiles(() => {
        if (profilesPool.length <= 3) return profilesPool;
        let shuffled = [...profilesPool].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 3);
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [computedTrends, allProfiles]);

  // Seed initial trends
  useEffect(() => {
    if (computedTrends.length > 0) {
      setCurrentTrends(computedTrends.slice(0, 3));
    }
  }, [computedTrends]);


  /**
   * Engagement score shared by every tab and every sort button.
   *
   *   likes ×2 + comments ×3 + reposts ×4, decayed by post age.
   *
   * The weights encode reach: a comment is worth more than a like because
   * writing takes effort, and a repost is worth most because it carries the
   * post to the reposter's own audience. The half-life decay keeps a post from
   * pinning itself to the top forever on a spike of old engagement — every 24
   * hours its score halves, so today's debate beats last week's viral one.
   */
  const engagementScore = React.useCallback((post: Post): number => {
    const raw =
      (post.likes?.length || 0) * 2 +
      (post.comments?.length || 0) * 3 +
      (post.reposts?.length || 0) * 4;
    const created = post.createdAt?.toMillis
      ? post.createdAt.toMillis()
      : Date.parse(post.createdAt || '') || 0;
    const ageHours = created > 0 ? Math.max(0, (Date.now() - created) / 3_600_000) : 0;
    return raw / Math.pow(2, ageHours / 24);
  }, []);

  // Compute Algorithmic Feed
  const sortedPosts = React.useMemo(() => {
    let sorted = [...posts];
    if (feedSortBy === 'trending') {
      sorted.sort((a, b) => engagementScore(b) - engagementScore(a));
    } else if (feedSortBy === 'hot') {
      // Hot: a steeper decay (6-hour half-life) over a fresher window, so a
      // burst of engagement this afternoon beats the same burst yesterday.
      const hotScore = (post: Post) => {
        const created = post.createdAt?.toMillis
          ? post.createdAt.toMillis()
          : Date.parse(post.createdAt || '') || 0;
        const ageHours = created > 0 ? Math.max(0, (Date.now() - created) / 3_600_000) : 0;
        const raw = (post.likes?.length || 0) * 2 + (post.comments?.length || 0) * 3 + (post.reposts?.length || 0) * 4;
        return raw / Math.pow(2, ageHours / 6);
      };
      sorted.sort((a, b) => hotScore(b) - hotScore(a));
    } else {
      // Recent (default by createdAt from Firebase)
      // Usually Firebase returns sorted, but just in case
    }
    return sorted;
  }, [posts, feedSortBy, engagementScore]);



  // Poll Creation State
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['Po', 'Jo', 'Me Kushte']);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCommentPost, setActiveCommentPost] = useState<string | null>(null);
  const [newCommentContent, setNewCommentContent] = useState('');

  // Nested Reply State
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // AI Summary Toggle State
  const [activeAiSummaryPost, setActiveAiSummaryPost] = useState<string | null>(null);

  const [activeLegalModal, setLegalModalType] = useState<'privacy' | 'terms' | 'ads' | 'cookies' | null>(null);
  const [profileModalData, setProfileModalData] = useState<{isOpen: boolean, authorId: string, authorName: string, authorAvatar?: string}>({isOpen: false, authorId: '', authorName: '', authorAvatar: ''});
  /**
   * The post currently being shared, if any. A single sheet at page level is
   * used rather than one per card: forty mounted dialogs in a feed is forty
   * trees of DOM that will never be opened, and it keeps the scroll container
   * from having to lay them all out.
   */
  const [sharingPost, setSharingPost] = useState<Post | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'profile' | 'explore' | 'notifications'>('feed');
  // The mobile tab is derived from what is on screen, so it can never disagree with it.
  const activeMobileNav: 'home' | 'explore' | 'notifications' | 'messages' | 'profile' =
    isDMModalOpen ? 'messages' : activeTab === 'explore' ? 'explore' : activeTab === 'notifications' ? 'notifications' : activeTab === 'profile' ? 'profile' : 'home';
  const [composeOpen, setComposeOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [reelsOpen, setReelsOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  // Editing and the author's own deleted posts (restorable for 30 days).
  const [editingPost, setEditingPost] = useState<{ id: string; content: string } | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  // What the player shows: the public feed, one author's reels, or one hashtag.
  const [reelsView, setReelsView] = useState<{ source: ReelsSource; startReelId?: string }>({ source: { kind: 'feed' } });
  const openReels = (view: { source: ReelsSource; startReelId?: string } = { source: { kind: 'feed' } }) => {
    setReelsView(view);
    setReelsOpen(true);
  };
  // A shared link (/forum?reel=ID) opens that reel straight away.
  useEffect(() => {
    const id = reelIdFromSearch(window.location.search);
    if (id && showReels) openReels({ source: { kind: 'single', reelId: id }, startReelId: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Mirrors isStaff() in firestore.rules; the rules remain the real gate.
  const isStaffUser = ['admin', 'superadmin', 'agent', 'approver', 'newsadmin', 'adsadmin'].includes(String(currentUser?.role));
  const [reelComposerOpen, setReelComposerOpen] = useState(false);
  // Bumped after a publish so the viewer reloads and shows the new reel first.
  const [reelsVersion, setReelsVersion] = useState(0);
  const isSignedInCitizen = !!currentUser && currentUser.role !== 'guest';
  const openCreateMenu = () => {
    if (!isSignedInCitizen) { setShowAuthPrompt(true); return; }
    setCreateMenuOpen(true);
  };
  const handleCreateAction = (action: CreateAction) => {
    setCreateMenuOpen(false);
    if (!isSignedInCitizen) { setShowAuthPrompt(true); return; }
    if (action === 'reel') { setReelComposerOpen(true); return; }
    setReelsOpen(false);
    setIsDMModalOpen(false);
    setActiveTab('feed');
    if (action === 'story') {
      // ForumStories owns the story editor and listens for this event.
      window.dispatchEvent(new Event('zeri:open-forum-story'));
      return;
    }
    setComposeOpen(true);
    setShowPollCreator(action === 'poll');
    window.setTimeout(() => {
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      textareaRef.current?.focus();
    }, 120);
  };
  // The mobile dock's "+" sends citizens here with `?create=post|story|reel|ad` (or the
  // `zeri:forum-create` event when the forum is already open).
  const createFromDockRef = useRef<(kind: string) => void>(() => {});
  createFromDockRef.current = (kind: string) => {
    if (kind === 'ad') {
      if (!isSignedInCitizen) { setShowAuthPrompt(true); return; }
      setAdModalPostId(undefined);
      setAdModalPostContent(undefined);
      setIsAdRequestModalOpen(true);
    } else if (kind === 'story') {
      // Deferred so ForumStories has mounted and is listening on a fresh navigation.
      window.setTimeout(() => handleCreateAction('story'), 450);
    } else if (kind === 'reel' || kind === 'post') {
      handleCreateAction(kind);
    }
  };
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kind = params.get('create');
    if (kind) {
      params.delete('create');
      const rest = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
      createFromDockRef.current(kind);
    }
    const onCreate = (event: Event) => createFromDockRef.current(String((event as CustomEvent).detail ?? ''));
    window.addEventListener('zeri:forum-create', onCreate);
    return () => window.removeEventListener('zeri:forum-create', onCreate);
  }, []);
  const [showVerification, setShowVerification] = useState(false);
  const [analyticsPost, setAnalyticsPost] = useState<Post | null>(null);
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  // Back from Paysera: say what happened, then clean the address so a refresh does not repeat it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('payment');
    if (!outcome) return;
    if (outcome === 'ok') toast.success(dt('Faleminderit! Pagesa po konfirmohet; shërbimi aktivizohet sapo të vërtetohet.'), { duration: 7000 });
    else toast(dt('Pagesa u anulua. Kodi juaj mbetet i vlefshëm për pagesë me IBAN.'), { duration: 7000 });
    params.delete('payment');
    params.delete('code');
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  }, []);
  const verifiedIds = useVerifiedIds();
  const [searchQuery, setSearchQuery] = useState('');
  const [hashtagPage, setHashtagPage] = useState<string | null>(null);
  // Closed on load: a guest can read, search and filter first; the prompt opens only when they try to act.
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const shouldGateForum = !currentUser || currentUser.role === 'guest';

  // Ad state
  const [isAdPost, setIsAdPost] = useState(false);
  const [adLink, setAdLink] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length) {
      if (newPostImages.length + picked.length > 4) toast(dt('Mund të shtoni deri në 4 foto.'));
      setNewPostImages(prev => [...prev, ...picked].slice(0, 4));
    }
    e.target.value = '';
  };

  // The post being written survives a refresh: text, category and audience are kept per account.
  const draftRestored = useRef(false);
  useEffect(() => {
    if (draftRestored.current || !currentUser || currentUser.role === 'guest') return;
    draftRestored.current = true;
    const draft = loadDraft(currentUser.id);
    if (draft && !newPostContent) {
      setNewPostContent(draft.content);
      setSelectedCategory(draft.category);
      setFollowersOnly(draft.followersOnly);
      toast(dt('Skica juaj u rikthye.'), { icon: '📝' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);
  useEffect(() => {
    if (!draftRestored.current || !currentUser || currentUser.role === 'guest') return;
    const timer = setTimeout(() => saveDraft({ uid: currentUser.id, content: newPostContent, category: selectedCategory, followersOnly }), 600);
    return () => clearTimeout(timer);
  }, [newPostContent, selectedCategory, followersOnly, currentUser?.id]);


  const getCitizenBadge = (post: Post) => {
    if (['admin', 'moderator', 'zyrtar'].includes(post.authorRole)) {
      return { label: 'Zyrtar Komunal', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: ShieldCheck };
    }
    if (post.authorBadge) {
      return { label: post.authorBadge, color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Award };
    }
    if (post.comments?.length > 2 || post.likes?.length > 5) {
      return { label: 'Debatues Aktiv', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: Flame };
    }
    return { label: 'Qytetar', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: User };
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.role === 'guest') {
      setShowAuthPrompt(true);
      return;
    }
    if (!newPostContent.trim() && newPostImages.length === 0 && !pollQuestion.trim()) return;

    const scheduledMs = scheduleAt ? localInputToMs(scheduleAt) : NaN;
    if (scheduleAt) {
      if (!newPostContent.trim()) { toast.error(dt('Shkruani tekstin e postimit për ta planifikuar.')); return; }
      if (showPollCreator && pollQuestion.trim()) { toast.error(dt('Sondazhi nuk mund të planifikohet. Postojeni menjëherë.')); return; }
      if (!Number.isFinite(scheduledMs) || scheduledMs - Date.now() < 5 * 60_000) { toast.error(dt('Zgjidhni një kohë të paktën 5 minuta përpara.')); return; }
    }

    setIsSubmitting(true);
    let imageUrl = '';
    const imageUrls: string[] = [];

    try {
      for (const file of newPostImages) {
        const url = await uploadFileToStorage(file, 'reports', { scope: 'forum' });
        if (url) imageUrls.push(url);
      }
      imageUrl = imageUrls[0] ?? '';

      if (scheduleAt) {
        await schedulePostApi({
          content: newPostContent, category: selectedCategory, neighborhood: selectedNeighborhood,
          imageUrls, followersOnly, publishAtMs: scheduledMs,
        });
        clearDraft();
        setComposeOpen(false);
        setNewPostContent('');
        setNewPostImages([]);
        setScheduleAt('');
        toast.success(`${dt('Postimi u planifikua për')} ${new Date(scheduledMs).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' })}.`);
        return;
      }

      const isAdsAdmin = currentUser.role === 'adsadmin' || currentUser.email === 'reklama@ks.com' || currentUser.email === 'reklama@kosova.com';

      // Build Poll Object if created
      let pollData: PostPoll | null = null;
      if (showPollCreator && pollQuestion.trim()) {
        const validOpts = pollOptions.filter(o => o.trim().length > 0);
        if (validOpts.length >= 2) {
          pollData = {
            question: pollQuestion,
            totalVotes: 0,
            options: validOpts.map((opt, i) => ({
              id: `opt-${i}-${Date.now()}`,
              text: opt,
              votes: []
            }))
          };
        }
      }

      const created = await addDoc(collection(db, 'forumPosts'), {
        isHidden: false,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=0D8ABC&color=fff`,
        authorRole: currentUser.role,
        authorBadge: currentUser.points > 100 ? 'Përfaqësues Lagjeje' : 'Qytetar i Verifikuar',
        content: newPostContent,
        hashtags: extractHashtags(newPostContent).slice(0, 10),
        category: selectedCategory,
        neighborhood: selectedNeighborhood,
        poll: pollData,
        imageUrl,
        imageUrls,
        /*
         * Post visibility. `followersOnly` hides the post from anyone who does
         * not follow the author — the rule the feed and profile enforce at read
         * time, not a hard Firestore filter (the collection stays readable by
         * the rules for track-id style lookups; enforcement is client-side
         * like every other social surface here).
         */
        visibility: followersOnly ? 'followers' : 'public',
        isAd: isAdsAdmin && isAdPost,
        adLink: isAdsAdmin && isAdPost ? adLink : null,
        likes: [],
        comments: [],
        reactions: {},
        createdAt: serverTimestamp()
      });
      void notifyPublishedApi(created.id, resolveMentionUids(newPostContent));
      setComposeOpen(false);

      clearDraft();
      setNewPostContent('');
      setNewPostImages([]);
      setScheduleAt('');
      setPollQuestion('');
      setShowPollCreator(false);
      setIsAdPost(false);
      setAdLink('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      toast.success(dt('forum.postCreated') || 'Debati u publikua me sukses!');
    } catch (error) {
      console.error(error);
      toast.error('Gabim gjatë publikimit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVotePoll = async (postId: string, optionId: string) => {
    const voterId = currentUser?.id || 'qytetar-aktiv';
    try {
      const post = posts.find(p => p.id === postId);
      if (!post || !post.poll) return;

      const updatedOptions = (post.poll.options || []).map(opt => {
        const hasVotedThis = opt.votes.includes(voterId);
        const cleanedVotes = opt.votes.filter(uid => uid !== voterId);
        if (opt.id === optionId && !hasVotedThis) {
          return { ...opt, votes: [...cleanedVotes, voterId] };
        }
        return { ...opt, votes: cleanedVotes };
      });

      const total = updatedOptions.reduce((acc, curr) => acc + curr.votes.length, 0);
      const updatedPoll = { ...post.poll, options: updatedOptions, totalVotes: total };

      // Instant optimistic state update
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, poll: updatedPoll } : p));

      if (!postId.startsWith('demo-') && currentUser && currentUser.role !== 'guest') {
        votePollApi(postId, optionId)
          .then((r) => setPosts(prev => prev.map(p => p.id === postId ? { ...p, poll: r.poll } : p)))
          .catch((err) => {
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, poll: post.poll } : p));
            toast.error(err instanceof Error ? err.message : 'Vota nuk u ruajt.');
          });
      }

      toast.success('Vota juaj u regjistrua me sukses!');
    } catch (e) {
      toast.error('Gabim gjatë votimit');
    }
  };

  const handleRepost = async (postId: string) => {
    const actorId = currentUser?.id || 'qytetar-aktiv';
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;
      const currentReposts = post.reposts || [];
      const hasReposted = currentReposts.includes(actorId);
      if (!hasReposted && post.authorId !== actorId && prefsOf(forumProfileOf(post.authorId)).allowReposts === false) {
        toast.error('Ky përdorues nuk lejon riposto të postimeve të tij.');
        return;
      }
      const newReposts = hasReposted ? currentReposts.filter(id => id !== actorId) : [...currentReposts, actorId];

      setPosts(prev => prev.map(p => p.id === postId ? { ...p, reposts: newReposts } : p));
      try {
        await persistPostAction(postId, 'repost');
        // The author's bell is written by the server (once per person and post).
      } catch (error) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, reposts: currentReposts } : p));
        toast.error(error instanceof Error ? error.message : 'Rishpërndarja nuk u ruajt.');
        return;
      }
      toast.success(hasReposted ? 'U hoq rishpërndarja' : 'U rishpërnda me sukses!');
    } catch (e) { console.error(e); }
  };

  const handleReaction = async (postId: string, reactionType: string) => {
    const actorId = currentUser?.id || 'qytetar-aktiv';
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      if (reactionType === 'like') {
        const hasLiked = (post.likes || []).includes(actorId);
        const currentLikes = post.likes || [];
        const newLikes = hasLiked ? currentLikes.filter(id => id !== actorId) : [...currentLikes, actorId];
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: newLikes } : p));
        try {
          await persistPostAction(postId, 'like');
          // The author's bell is written by the server (once per person and post).
        } catch (error) {
          setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: currentLikes } : p));
          toast.error(error instanceof Error ? error.message : 'Pëlqimi nuk u ruajt.');
        }
      } else {
        const currentReactions = post.reactions || {};
        const typeReactions = currentReactions[reactionType] || [];
        const hasReacted = typeReactions.includes(actorId);

        const updatedReactions = { ...currentReactions };
        if (hasReacted) {
          updatedReactions[reactionType] = typeReactions.filter(id => id !== actorId);
        } else {
          Object.keys(updatedReactions).forEach(k => {
            updatedReactions[k] = (updatedReactions[k] || []).filter(id => id !== actorId);
          });
          updatedReactions[reactionType] = [...(updatedReactions[reactionType] || []), actorId];
        }

        // Instant optimistic state update
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions: updatedReactions } : p));

        if (!postId.startsWith('demo-') && currentUser && currentUser.role !== 'guest') {
          setReactionApi(postId, hasReacted ? null : reactionType).catch((err) => {
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions: currentReactions } : p));
            toast.error(err instanceof Error ? err.message : 'Reagimi nuk u ruajt.');
          });
        }
      }
    } catch (e) { console.error(e); }
  };

  /** The author may restrict who comments; tell the commenter why instead of failing silently. */
  const canCommentOn = (post?: { authorId?: string }): boolean => {
    if (!post?.authorId || !currentUser || post.authorId === currentUser.id) return true;
    const allowed = audienceAllows(prefsOf(forumProfileOf(post.authorId)).whoCanComment, followedUserIds.includes(post.authorId));
    if (!allowed) toast.error('Autori e ka kufizuar kush mund të komentojë këtë postim.');
    return allowed;
  };

  const handleAddComment = async (postId: string) => {
    if (!currentUser || currentUser.role === 'guest') {
      setShowAuthPrompt(true);
      return;
    }
    if (!newCommentContent.trim()) return;
    if (!canCommentOn(posts.find(p => p.id === postId))) return;

    const commentText = newCommentContent;
    setNewCommentContent('');
    try {
      // The server stores the comment under the verified account and notifies the
      // post's author (and verified mentions); two people commenting at once no longer lose one.
      const { comment } = await addCommentApi(postId, commentText, { mentionUids: resolveMentionUids(commentText) });
      setPosts(prev => prev.map(p => p.id === postId && !(p.comments || []).some(c => c.id === comment.id)
        ? { ...p, comments: [...(p.comments || []), { ...comment, replies: [] } as ForumComment] }
        : p));
      toast.success('Komenti u shtua!');
    } catch (error) {
      setNewCommentContent(commentText);
      toast.error(error instanceof Error ? error.message : 'Komenti nuk u shtua.');
    }
  };

  // Add Nested Reply to Comment
  const handleAddReply = async (postId: string, commentId: string) => {
    if (!currentUser || currentUser.role === 'guest') {
      setShowAuthPrompt(true);
      return;
    }
    if (!replyContent.trim()) return;

    const repText = replyContent;
    setReplyContent('');
    try {
      const { comment } = await addCommentApi(postId, repText, { parentId: commentId, mentionUids: resolveMentionUids(repText) });
      setReplyingCommentId(null);
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        return {
          ...p,
          comments: (p.comments || []).map(c => c.id === commentId && !(c.replies || []).some(r => r.id === comment.id)
            ? { ...c, replies: [...(c.replies || []), comment as unknown as CommentReply] }
            : c),
        };
      }));
      toast.success('Përgjigjja u dërgua!');
    } catch (error) {
      setReplyContent(repText);
      toast.error(error instanceof Error ? error.message : 'Përgjigjja nuk u dërgua.');
    }
  };

  /** The commenter, the post's author or staff may remove a comment or reply; the server decides. */
  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!window.confirm('Ta fshij këtë koment?')) return;
    const before = posts;
    setPosts(prev => prev.map(p => p.id !== postId ? p : {
      ...p,
      comments: (p.comments || [])
        .filter(c => c.id !== commentId)
        .map(c => ({ ...c, replies: (c.replies || []).filter(r => r.id !== commentId) })),
    }));
    try {
      await deleteCommentApi(postId, commentId);
    } catch (error) {
      setPosts(before);
      toast.error(error instanceof Error ? error.message : 'Komenti nuk u fshi.');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Ta fshij postimin? Mund ta rikthesh brenda 30 ditëve nga profili yt.')) return;
    const before = posts;
    setPosts(prev => prev.filter(p => p.id !== postId));
    try {
      await deletePostApi(postId);
      toast((t) => (
        <span className="flex items-center gap-3 text-sm">
          Postimi u fshi.
          <button type="button" className="font-black text-blue-600"
            onClick={async () => {
              toast.dismiss(t.id);
              try { await restorePostApi(postId); toast.success('Postimi u rikthye.'); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'Rikthimi dështoi.'); }
            }}>
            Zhfshi
          </button>
        </span>
      ), { duration: 8000 });
    } catch (error) {
      setPosts(before);
      toast.error(error instanceof Error ? error.message : 'Gabim gjatë fshirjes');
    }
  };

  const isAdsAdmin = currentUser?.role === 'adsadmin' || currentUser?.email === 'reklama@ks.com' || currentUser?.email === 'reklama@kosova.com';
  const explorePeople = React.useMemo<ExplorePerson[]>(() => {
    const q = toHandle(searchQuery.replace(/^@/, ''));
    return allForumUsers
      .filter((u) => u.id !== currentUser?.id && (!q || toHandle(u.name || '').includes(q)))
      .map((u) => ({
        id: u.id,
        name: u.name || 'Qytetar',
        avatar: u.avatar || '',
        followers: followerCountOf(u.id),
        verified: verifiedIds.has(u.id),
      }))
      .sort((a, b) => Number(b.verified) - Number(a.verified) || b.followers - a.followers);
  }, [allForumUsers, searchQuery, currentUser?.id, followerCountOf, verifiedIds]);

  const isModerator = currentUser?.role === 'admin';

  // Unified displayPosts respecting tabs, filters, and algorithmic sorting
  const displayPosts = React.useMemo(() => {
    let result = posts.filter(p => {
      if (p.isHidden && !isModerator && !isAdsAdmin) return false;
      // Sponsored posts leave the feed when the campaign ends, has not started or hit its click cap.
      if (!adVisibleInFeed(p as any, { id: currentUser?.id, isStaff: isStaffUser })) return false;
      /*
       * Followers-only posts. A post the author restricted is visible to the
       * author and to people the author's followers list contains — which, per
       * the social graph above, is anyone whose `followingIds` includes the
       * author. Everyone else never sees it, exactly as a private post in a
       * social feed is expected to behave.
       */
      if (p.visibility === 'followers' && p.authorId !== currentUser?.id) {
        if (!followedUserIds.includes(p.authorId)) return false;
      }
      if (searchQuery) {
        const search = searchQuery.trim().toLocaleLowerCase();
        const matchesSearch = [
          p.content,
          p.authorName,
          p.category,
          p.neighborhood,
        ].some(value => value?.toLocaleLowerCase().includes(search));
        if (!matchesSearch) return false;
      }
      if (activeCategoryFilter !== 'all' && p.category !== activeCategoryFilter) {
        return false;
      }
      /*
       * 'Gjithë Qyteti' is a legacy forum label that meant "no filter"; it is
       * not a municipality and is not in the 38-name registry. Comparing it by
       * name here — rather than normalising — is why selecting it still narrowed
       * the feed to posts whose neighborhood happened to be empty.
       */
      const neighborhoodFilterIsReal = isSpecificScope(activeNeighborhoodFilter) && activeNeighborhoodFilter !== 'Gjithë Qyteti';
      if (neighborhoodFilterIsReal && p.neighborhood && p.neighborhood !== activeNeighborhoodFilter && p.neighborhood !== 'Të gjitha Komunat' && p.neighborhood !== 'Gjithë Qyteti') {
        return false;
      }

      // X-Style Feed Tabs
      if (feedTab === 'following') {
        const isFollowed = followedUserIds.includes(p.authorId) || followedUserIds.includes(p.authorEmail || '') || p.authorRole === 'admin' || p.authorBadge === 'Zyrtar Komunal';
        if (!isFollowed) return false;
      } else if (feedTab === 'polls') {
        if (!p.poll) return false;
      } else if (feedTab === 'saved') {
        if (!savedPostIds.includes(p.id)) return false;
      } else if (feedTab === 'official') {
        if (p.authorRole !== 'admin' && p.authorBadge !== 'Zyrtar Komunal') return false;
      } else if (feedTab === 'municipality') {
        // The tab means "my municipality", so it reads the global scope. It used
        // to fall back to the private filter, which could name a municipality
        // the rest of the site was not scoped to and return an empty feed.
        const mun = isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : null;
        if (mun && p.neighborhood && p.neighborhood !== mun) {
          return false;
        }
      }

      return true;
    });

    // One ranking module for every sort (see src/lib/forumRanking.ts).
    if (feedSortBy === 'foryou') {
      return rankForYou(result as any, {
        followedIds: followedUserIds,
        verifiedIds,
        municipality: isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : null,
      }) as Post[];
    }
    if (feedSortBy === 'trending') {
      result.sort((a, b) => rankTrendingScore(b as any) - rankTrendingScore(a as any));
    } else if (feedSortBy === 'hot') {
      result.sort((a, b) => rankHotScore(b as any) - rankHotScore(a as any));
    }

    return result;
  }, [posts, searchQuery, activeCategoryFilter, activeNeighborhoodFilter, feedTab, followedUserIds, savedPostIds, userMunicipality, feedSortBy, isModerator, isAdsAdmin, verifiedIds]);

  return (
    /**
     * The forum owns its own scroll container: a fixed 100dvh shell with
     * `overflow-hidden` on the wrapper and `overflow-y-auto` on the feed.
     *
     * That means `scroll-behavior: smooth` on `html` never applies here — the
     * window does not scroll at all on this page, the inner div does. Without
     * the class below, every flick of the wheel jumped instantly and the feed
     * felt broken, which is exactly the report from the page.
     *
     * `overscroll-contain` stops the scroll chain from reaching the page behind,
     * so reaching the end of the feed does not start moving the shell.
     * `scroll-padding-top` keeps an anchored heading clear of the fixed header.
     */
    <div className="h-[100dvh] w-full bg-[#f4f7fb] dark:bg-[#121212] font-sans overflow-hidden flex flex-col text-[var(--color-text)] dark:text-white relative transition-colors">

      <div className="forum-scroll relative h-full min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar overscroll-contain pb-24 lg:pb-8">
        <AnimatePresence>
          {showAuthPrompt && shouldGateForum && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[50] flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-[2px]"
            >
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.99 }}
                className="w-full max-w-md overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/95 shadow-[0_22px_70px_-28px_rgba(15,23,42,0.38)] dark:border-white/10 dark:bg-slate-900/95"
              >
                <div className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 p-6 text-white">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {dt('Debati Publik')}
                  </div>
                  <h3 className="mt-4 text-3xl font-black leading-tight text-white">{dt('Vazhdoni me siguri')}</h3>
                </div>

                <div className="p-6">
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {dt('Për të komentuar, votuar dhe ndjekur diskutimet, mund të vazhdoni si mysafir ose të hyni në llogarinë tuaj.')}
                  </p>

                  <div className="mt-6 space-y-3">
                    <button
                      onClick={() => setShowAuthPrompt(false)}
                      className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      {dt('Vazhdoni si Mysafir')}
                    </button>
                    <button
                      onClick={() => navigate('/login')}
                      className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500"
                    >
                      {dt('Kyçu me llogari')}
                    </button>
                    <button
                      onClick={() => navigate('/register')}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {dt('Regjistrohu')}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phones: a compact app bar (back, profile, search, settings), like X. */}
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden dark:border-white/10 dark:bg-zinc-950/95">
          <div className="flex h-14 items-center gap-2 px-3">
            <button type="button" onClick={() => navigate('/')} aria-label={dt('Kthehu te platforma')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setActiveTab('profile')} aria-label={dt('Profili im')} className="shrink-0">
              <img src={currentUser?.avatar || 'https://ui-avatars.com/api/?name=U'} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-200 dark:ring-white/10" />
            </button>
            <button type="button" onClick={() => setActiveTab('explore')} className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 text-left text-sm text-slate-500 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-400">
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{dt('Kërko')}</span>
            </button>
            <button type="button" onClick={() => { setIsDMModalOpen(false); setActiveTab('notifications'); }} aria-label={`${dt('Njoftimet')}${unreadForumCount ? ` (${unreadForumCount})` : ''}`} aria-current={activeTab === 'notifications' ? 'page' : undefined} className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10">
              <Bell className="h-5 w-5" aria-hidden="true" />
              {unreadForumCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-zinc-950">
                  {unreadForumCount > 9 ? '9+' : unreadForumCount}
                </span>
              )}
            </button>
            <button type="button" onClick={() => setShowVerification(true)} aria-label={dt('Verifikimi')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10">
              <Settings2 className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="sticky top-0 z-40 hidden w-full border-b border-slate-200 bg-white shadow-sm lg:block dark:border-white/10 dark:bg-[#121b2b]">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>{dt('Kthehu te platforma')}</span>
            </button>

            <div className="flex min-w-0 items-center gap-2 text-slate-900 dark:text-white">
              <Radio className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
              <span className="truncate text-sm font-bold">{dt('Debati Publik')}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setActiveTab('feed'); setFeedTab('following'); }}
                className="hidden rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 sm:inline-flex dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Ndjek
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('feed');
                  window.setTimeout(() => {
                    textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    textareaRef.current?.focus();
                  }, 0);
                }}
                className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-800"
              >
                {dt('Posto')}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full min-h-full flex gap-6 lg:gap-8 justify-center pt-5">

          {/*
            Left rail — compact identity, then navigation.

            Two problems made this feel weak. First, `sticky top-6 h-fit` on a
            column taller than the viewport: the rail pinned and then its lower
            half was simply unreachable, which reads as broken rather than
            fixed. Second, the profile card spent 96px on an empty gradient and
            then showed a hardcoded "0 Ndikimi" that is always zero — a statistic
            that never changes teaches the reader to ignore the whole card.

            Now: no empty banner, real numbers only, and the rail scrolls with
            the page instead of pinning a column that cannot fit.
          */}
          <div className={`hidden lg:flex shrink-0 flex-col gap-4 lg:sticky lg:top-4 lg:self-start transition-[width] duration-200 ease-out ${railCollapsed ? 'w-[68px]' : 'w-64'}`}>
             <button
               type="button"
               onClick={toggleRail}
               aria-label={railCollapsed ? dt('Zgjero menunë') : dt('Mblidh menunë')}
               aria-expanded={!railCollapsed}
               title={railCollapsed ? dt('Zgjero menunë') : dt('Mblidh menunë')}
               className={`flex h-9 items-center rounded-xl border border-slate-200/80 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 ${railCollapsed ? 'w-9 justify-center self-center' : 'w-full gap-2 px-3 text-xs font-bold'}`}
             >
               {railCollapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : (<><PanelLeftClose className="h-4 w-4" aria-hidden="true" /><span>{dt('Mblidh menunë')}</span></>)}
             </button>
             <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 overflow-hidden">
               <div className={`flex items-center gap-3 ${railCollapsed ? 'justify-center p-2.5' : 'p-4'}`}>
                 <img
                   src={currentUser?.avatar || 'https://ui-avatars.com/api/?name=U'}
                   className="h-12 w-12 shrink-0 rounded-full border border-slate-200 bg-white object-cover dark:border-zinc-700"
                   alt=""
                 />
                 {!railCollapsed && (
                 <div className="min-w-0 flex-1">
                   <h3 className="truncate text-sm font-black text-slate-900 dark:text-white">
                     {currentUser?.name || dt('Përdorues i Paidentifikuar')}
                   </h3>
                   <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                     {currentUser?.role === 'guest' ? dt('Mysafir') : dt('Qytetar')}
                   </p>
                 </div>
                 )}
               </div>
               {/* Only the post count is real; the influence figure was a literal 0. */}
               <button
                 type="button"
                 onClick={() => setActiveTab('profile')}
                 className={`${railCollapsed ? 'hidden' : 'flex'} w-full items-center justify-between border-t border-slate-100 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50`}
               >
                 <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{dt('Postime')}</span>
                 <span className="text-sm font-black text-slate-900 dark:text-white">
                   {posts.filter(p => p.authorId === currentUser?.id).length}
                 </span>
               </button>
             </div>

             <nav
               aria-label={dt('Navigimi i debatit')}
               className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-white p-2 dark:border-zinc-800/80 dark:bg-zinc-900"
             >
               {[
                 {
                   key: 'home', label: 'Rrjeti i Diskutimeve', icon: Home,
                   active: activeTab === 'feed' && feedTab === 'forYou',
                   onClick: () => { setActiveTab('feed'); setFeedTab('forYou'); },
                 },
                 {
                   key: 'explore', label: 'Eksploro', icon: Search, active: activeTab === 'explore',
                   onClick: () => setActiveTab('explore'),
                 },
                 ...(showReels ? [{
                   key: 'reels', label: 'Reels', icon: Film, active: reelsOpen,
                   onClick: () => openReels(),
                 }] : []),
                 {
                   key: 'notifications', label: 'Njoftimet', icon: Bell, active: activeTab === 'notifications',
                   badge: unreadForumCount,
                   onClick: () => setActiveTab('notifications'),
                 },
                 {
                   key: 'messages', label: 'Mesazhet', icon: MessageCircle, active: false,
                   onClick: () => setIsDMModalOpen(true),
                 },
                 {
                   key: 'saved', label: 'Të ruajturat', icon: Bookmark,
                   active: activeTab === 'feed' && feedTab === 'saved',
                   badge: savedPostIds.length,
                   onClick: () => { setActiveTab('feed'); setFeedTab('saved'); },
                 },
                 {
                   key: 'official', label: 'Zyrtare', icon: ShieldCheck,
                   active: activeTab === 'feed' && feedTab === 'official',
                   onClick: () => { setActiveTab('feed'); setFeedTab('official'); },
                 },
                 {
                   key: 'profile', label: 'Profili Qytetar', icon: User,
                   active: activeTab === 'profile',
                   onClick: () => setActiveTab('profile'),
                 },
                 {
                   key: 'verify', label: 'Verifikimi', icon: BadgeCheck, active: false,
                   onClick: () => setShowVerification(true),
                 },
               ].map(({ key, label, icon: Icon, active, onClick, badge }) => (
                 <button
                   key={key}
                   type="button"
                   onClick={onClick}
                   aria-current={active ? 'page' : undefined}
                   aria-label={railCollapsed ? dt(label) : undefined}
                   title={railCollapsed ? dt(label) : undefined}
                   className={`relative flex min-h-11 items-center rounded-xl py-2.5 text-sm font-bold transition-colors ${
                     railCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'
                   } ${
                     active
                       ? 'bg-blue-50 text-blue-700 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                       : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-zinc-800/50'
                   }`}
                 >
                   <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                   {!railCollapsed && <span className="flex-1 text-left">{dt(label)}</span>}
                   {badge ? (
                     <span className={`rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white ${railCollapsed ? 'absolute right-1 top-1' : ''}`}>{badge}</span>
                   ) : null}
                 </button>
               ))}
               <button
                 type="button"
                 onClick={openCreateMenu}
                 aria-haspopup="dialog"
                 aria-label={railCollapsed ? dt('Krijo') : undefined}
                 title={railCollapsed ? dt('Krijo') : undefined}
                 className={`mt-1 flex min-h-11 items-center justify-center gap-2 rounded-full bg-blue-600 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] ${railCollapsed ? 'px-0' : 'px-4'}`}
               >
                 <Plus className="h-4 w-4" aria-hidden="true" />
                 {!railCollapsed && dt('Krijo')}
               </button>
             </nav>
          </div>

          {/* Center Main Feed */}
          <div className="flex-1 max-w-2xl w-full flex flex-col gap-6">

             {/* The profile entry now lives in the phone app bar. */}
             <button
               type="button"
               onClick={() => { setActiveTab('profile'); }}
               className="hidden w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition hover:border-blue-300 dark:border-zinc-800 dark:bg-zinc-900"
             >
               <img
                 src={currentUser?.avatar || 'https://ui-avatars.com/api/?name=U'}
                 className="h-11 w-11 rounded-full object-cover ring-2 ring-blue-100 dark:ring-blue-500/20"
                 alt=""
               />
               <span className="min-w-0 flex-1">
                 <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{dt('Profili im')}</span>
                 <span className="block truncate text-sm font-black text-slate-900 dark:text-white">
                   {currentUser?.name || 'Qytetar'}
                 </span>
               </span>
               <ArrowUpRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
             </button>

             {(activeTab === 'feed' || activeTab === 'profile') && (
               <ForumStories
                 currentUser={currentUser}
                 followedUserIds={followedUserIds}
                 isActive={activeTab === 'feed'}
                 onRequireAuth={() => setShowAuthPrompt(true)}
               />
             )}

             {activeTab === 'feed' && showReels && (
               <button
                 type="button"
                 onClick={() => openReels()}
                 className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-900 to-zinc-800 p-3 text-left text-white shadow-sm transition hover:from-slate-800 hover:to-zinc-700 dark:border-zinc-800"
               >
                 <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                   <Film className="h-5 w-5" aria-hidden="true" />
                 </span>
                 <span className="min-w-0 flex-1">
                   <span className="block text-sm font-black">{dt('Reels')}</span>
                   <span className="block truncate text-xs text-white/70">{dt('Video të shkurtra vertikale nga qytetarët')}</span>
                 </span>
                 <ArrowUpRight className="h-4 w-4 text-white/60" aria-hidden="true" />
               </button>
             )}

             {activeTab === 'explore' && (
               <ForumExplore
                 query={searchQuery}
                 onQuery={setSearchQuery}
                 trends={computeTrends(posts as any, { limit: 12 })}
                 people={explorePeople}
                 followedIds={followedUserIds}
                 matchingPosts={searchQuery.trim() ? posts.filter((p) => (p.content || '').toLowerCase().includes(searchQuery.trim().toLowerCase())).length : 0}
                 onToggleFollow={handleToggleFollow}
                 onOpenPerson={(person) => setProfileModalData({ isOpen: true, authorId: person.id, authorName: person.name, authorAvatar: person.avatar || '' })}
                 onPickTopic={(label) => { setSearchQuery(label); setActiveTab('feed'); setFeedTab('forYou'); }}
                 onShowPosts={() => { setActiveTab('feed'); setFeedTab('forYou'); }}
                 onOpenReel={(reel, tag) => openReels({ source: { kind: 'hashtag', tag }, startReelId: reel.id })}
               />
             )}

             {activeTab === 'notifications' && <ForumNotificationsView onOpenMessages={() => setIsDMModalOpen(true)} />}

             {activeTab === 'feed' && (
               <>
               <section aria-label="Debati publik" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Radio className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                    <div className="min-w-0">
                      <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">{dt('Debati Publik')}</h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                        {displayPosts.length} {displayPosts.length === 1 ? 'postim' : 'postime'} · renditur sipas angazhimit
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDMModalOpen(true)}
                    className="relative shrink-0 px-3.5 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title={dt('Hap bisedat e mesazheve private')}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline sm:inline">Mesazhet Private</span>
                    <span className="sm:hidden">{dt('Mesazhe')}</span>
                    {totalUnreadDMs > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-zinc-900">
                        {totalUnreadDMs > 9 ? '9+' : totalUnreadDMs}
                      </span>
                    )}
                  </button>
                </div>
                 <label className="relative mt-3 block">
                   <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                   <input
                     id="forum-search"
                     type="search"
                     value={searchQuery}
                     onChange={(event) => setSearchQuery(event.target.value)}
                     placeholder={dt('Kërko në debat, tema ose profile...')}
                     aria-label={dt('Kërko në debat publik')}
                     className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:ring-blue-900/40"
                   />
                 </label>
                 <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label={dt('Filtroni sipas temës')}>
                   {[
                     { label: 'Të gjitha', id: 'all' },
                     { label: 'Rrugët', id: 'infrastrukture' },
                     { label: 'Mjedisi', id: 'mjedis' },
                     { label: 'Shëndeti', id: 'shendetesi' },
                     { label: 'Arsimi', id: 'arsim' },
                   ].map((topic) => (
                     <button
                       key={topic.id}
                       type="button"
                       aria-pressed={activeCategoryFilter === topic.id}
                       onClick={() => { setActiveCategoryFilter(topic.id); setFeedTab('forYou'); }}
                       className={cn(
                         'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                         activeCategoryFilter === topic.id
                           ? 'border-blue-600 bg-blue-600 text-white'
                           : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                       )}
                     >
                       {topic.label}
                     </button>
                   ))}
                 </div>
               </section>

               {/* Composer: a card on desktop, a full-screen sheet on phones (opened by the + button). */}
               <div
                 className={cn(
                   'lg:overflow-hidden lg:rounded-[28px] lg:border lg:border-slate-200/80 lg:bg-white lg:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.18)] dark:lg:border-zinc-800 dark:lg:bg-zinc-900',
                   composeOpen
                     ? 'fixed inset-0 z-[90] overflow-y-auto bg-white pt-[env(safe-area-inset-top)] dark:bg-zinc-900 lg:static lg:z-auto lg:pt-0'
                     : 'hidden lg:block'
                 )}
               >
                {composeOpen && (
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2 lg:hidden dark:border-zinc-800 dark:bg-zinc-900">
                    <button type="button" onClick={() => setComposeOpen(false)} className="min-h-10 rounded-full px-3 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-zinc-800">
                      {dt('Anulo')}
                    </button>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{dt('Postim i ri')}</span>
                    <span className="w-16" aria-hidden="true" />
                  </div>
                )}
                <div className="border-b border-slate-200/60 bg-gradient-to-r from-sky-50 via-white to-indigo-50 p-4 dark:border-zinc-800 dark:from-sky-950/20 dark:via-zinc-900 dark:to-indigo-950/20">
                  <div className="flex items-start gap-3">
                    <img src={currentUser?.avatar || 'https://ui-avatars.com/api/?name=U'} className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-white dark:ring-zinc-900" alt="" />
                    <div className="flex-1">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{dt('Komuniteti Qytetar')}</div>
                        <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Live
                        </div>
                      </div>
                      <textarea
                        ref={textareaRef}
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        placeholder={dt(`Çfarë po ndodh?`)}
                        className="w-full bg-transparent border-none text-[var(--color-text)] dark:text-white resize-none focus:ring-0 p-0 placeholder:text-[var(--color-text-muted)] dark:placeholder:text-[var(--color-text-muted)] text-lg sm:text-xl mt-1 mb-2 outline-none"
                        rows={newPostContent ? 3 : 1}
                      />

                      <div className="flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors">
                            <ImageIcon className="w-5 h-5" />
                          </button>
                          <input type="file" accept="image/*,video/*" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                          <button type="button" onClick={() => setScheduleAt(v => (v ? '' : msToLocalInput(Date.now() + 60 * 60_000)))} aria-pressed={!!scheduleAt}
                            title={dt('Planifiko postimin')} aria-label={dt('Planifiko postimin')}
                            className={`p-2 rounded-full transition-colors ${scheduleAt ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}>
                            <ClockIcon className="w-5 h-5" aria-hidden="true" />
                          </button>

                          <button onClick={() => setShowPollCreator(!showPollCreator)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full transition-colors" title="Krijo Sondazh">
                            <SlidersHorizontal className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAdModalPostId(undefined);
                              setAdModalPostContent(undefined);
                              setIsAdRequestModalOpen(true);
                            }}
                            className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold rounded-full transition-all flex items-center gap-1.5"
                            title="Kërko reklamim me pagesë bankare (IBAN)"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span className="hidden sm:inline">{dt('Kërko Reklamë / IBAN')}</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          {/*
                           * Followers-only toggle. A citizen who wants a
                           * smaller audience keeps the toggle on; the post is
                           * then written with `visibility: 'followers'` and the
                           * feed filter hides it from non-followers.
                           */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={followersOnly}
                            onClick={() => setFollowersOnly(v => !v)}
                            title={followersOnly ? 'Vetëm ndjekësit tuaj e shohin këtë postim' : 'Postim publik — e sheh gjithë Kosova'}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                              followersOnly
                                ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300'
                                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {followersOnly ? <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> : <Globe className="h-3.5 w-3.5" aria-hidden="true" />}
                            <span className="hidden sm:inline">{followersOnly ? dt('Vetëm ndjekësit') : dt('Publik')}</span>
                          </button>
                          <button
                          onClick={handleCreatePost}
                          disabled={isSubmitting || (!newPostContent.trim() && newPostImages.length === 0 && !pollQuestion)}
                          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-black rounded-full transition-all shadow-md shadow-blue-600/20 active:scale-95"
                        >
                          {scheduleAt ? dt('Planifiko') : dt(`Posto`)}
                        </button>
                        </div>
                      </div>

                    {/* Poll Creator */}
                    {showPollCreator && (
                      <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-zinc-800 space-y-2">
                        <input type="text" placeholder={dt(`Bëj një pyetje...`)} className="w-full bg-slate-50 dark:bg-zinc-800/80 border border-slate-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none" value={pollQuestion || ''} onChange={e => setPollQuestion(e.target.value)} />
                        {(pollOptions || ['', '']).map((opt, i) => (
                          <input key={i} type="text" placeholder={`Opsioni ${i+1}`} className="w-full bg-slate-50 dark:bg-zinc-800/80 border border-slate-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none" value={opt} onChange={e => { const newOpts = [...pollOptions]; newOpts[i] = e.target.value; setPollOptions(newOpts); }} />
                        ))}
                      </div>
                    )}
                    {/* Selected File Preview */}
                    {newPostImages.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-2" aria-label={dt('Media e zgjedhur')}>
                        {newPostImages.map((file, index) => (
                          <li key={`${file.name}-${index}`} className="relative flex items-center gap-2 rounded-xl border border-slate-200/60 bg-slate-100 py-1 pl-2 pr-8 text-xs text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-slate-200">
                            <span className="max-w-[10rem] truncate">{file.name}</span>
                            <button type="button" onClick={() => setNewPostImages(prev => prev.filter((_, i) => i !== index))} aria-label={`${dt('Hiq')} ${file.name}`} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-slate-200 dark:hover:bg-zinc-800"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {scheduleAt && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 p-2 text-xs text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100">
                        <label className="flex items-center gap-2 font-bold">
                          {dt('Publiko më')}
                          <input type="datetime-local" value={scheduleAt} min={msToLocalInput(Date.now() + 5 * 60_000)} onChange={(e) => setScheduleAt(e.target.value)}
                            className="rounded-lg border border-violet-300 bg-white px-2 py-1 text-sm text-slate-900 dark:border-violet-500/40 dark:bg-zinc-900 dark:text-white" />
                        </label>
                        <button type="button" onClick={() => setScheduledSheetOpen(true)} className="ml-auto font-bold underline underline-offset-2">{dt('Të planifikuarat')}</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              </div>

              {/*
                Feed controls, on one row.

                This used to be two separate control clusters: a row of five
                filter pills (Për Ty / Duke Ndjekur / Komuna Ime / Sondazhe /
                Zyrtare) and, to their right, a three-way sort switch (Të Rejat /
                Në Trend / Hot). Eight controls that all read as "what am I
                looking at", which left the reader unsure which row was the
                filter and which the order.

                They are now visually distinct by role: filters are outlined
                pills that carry a count, the sort is a single segmented control.
                One row, two clearly different jobs.
              */}
              <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {[
                      { id: 'forYou', label: 'Për Ty', icon: Sparkles },
                      { id: 'following', label: 'Duke Ndjekur', icon: Users },
                      { id: 'municipality', label: isSpecificScope(userMunicipality) ? `📍 ${userMunicipality}` : 'Komuna Ime', icon: MapPin },
                      { id: 'polls', label: 'Sondazhe', icon: BarChart3 },
                      { id: 'saved', label: 'Të ruajturat', icon: Bookmark },
                      { id: 'official', label: 'Zyrtare', icon: ShieldCheck }
                    ].map(tab => {
                      const Icon = tab.icon;
                      const isActive = feedTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setFeedTab(tab.id as any)}
                          aria-pressed={isActive}
                          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors flex items-center gap-1.5 ${
                            isActive
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:text-slate-300 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5 self-end rounded-full bg-slate-100 p-0.5 dark:bg-zinc-800/80 sm:self-auto" role="group" aria-label={dt('Renditja')}>
                    <button
                      onClick={() => setFeedSortBy('foryou')}
                      aria-pressed={feedSortBy === 'foryou'}
                      className={`flex items-center gap-1 rounded-full px-3 py-2 text-[11px] font-bold transition-colors md:py-1 ${feedSortBy === 'foryou' ? 'bg-white text-indigo-600 shadow-xs dark:bg-zinc-700 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      <Sparkles className="w-3 h-3" />
                      {dt('Për Ty')}
                    </button>
                    <button
                      onClick={() => setFeedSortBy('recent')}
                      aria-pressed={feedSortBy === 'recent'}
                      className={`rounded-full px-3 py-2 text-[11px] font-bold transition-colors md:py-1 ${feedSortBy === 'recent' ? 'bg-white text-slate-900 shadow-xs dark:bg-zinc-700 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      {dt('Të Rejat')}
                    </button>
                    <button
                      onClick={() => setFeedSortBy('trending')}
                      aria-pressed={feedSortBy === 'trending'}
                      className={`flex items-center gap-1 rounded-full px-3 py-2 text-[11px] font-bold transition-colors md:py-1 ${feedSortBy === 'trending' ? 'bg-white text-blue-600 shadow-xs dark:bg-zinc-700 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      <TrendingUp className="w-3 h-3" />
                      {dt('Në Trend')}
                    </button>
                    <button
                      onClick={() => setFeedSortBy('hot')}
                      aria-pressed={feedSortBy === 'hot'}
                      className={`flex items-center gap-1 rounded-full px-3 py-2 text-[11px] font-bold transition-colors md:py-1 ${feedSortBy === 'hot' ? 'bg-white text-rose-500 shadow-xs dark:bg-zinc-700' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      <Flame className="w-3 h-3" />
                      {dt('Hot')}
                    </button>
                  </div>
                </div>

                {feedTab === 'following' && followedUserIds.length === 0 && (
                  <div className="p-3 text-center text-xs text-slate-500">
                    Ende nuk keni ndjekur asnjë përdorues. Klikoni butonin <span className="font-bold text-slate-800 dark:text-slate-200">"Ndjek"</span> te postimet ose profilet zyrtare për t'i parë këtu!
                  </div>
                )}
              </div>

              {/* Feed of Text Posts */}
              <div className="space-y-4">

              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="border-b border-slate-200/60 dark:border-slate-200/60 dark:border-zinc-800/80 p-4 animate-pulse flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 shrink-0"></div>
                    <div className="flex-1 space-y-3">
                      <div className="flex gap-2 items-center">
                        <div className="h-4 w-32 bg-zinc-800 rounded"></div>
                        <div className="h-3 w-16 bg-zinc-800/50 rounded"></div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 w-full bg-zinc-800 rounded"></div>
                        <div className="h-3 w-5/6 bg-zinc-800 rounded"></div>
                        <div className="h-3 w-4/6 bg-zinc-800 rounded"></div>
                      </div>
                      <div className="h-32 w-full bg-zinc-800/50 rounded-[1rem] mt-3"></div>
                      <div className="flex gap-6 mt-4">
                        <div className="h-4 w-12 bg-zinc-800 rounded"></div>
                        <div className="h-4 w-12 bg-zinc-800 rounded"></div>
                        <div className="h-4 w-12 bg-zinc-800 rounded"></div>
                      </div>
                    </div>
                  </div>
                ))
              ) : posts.length === 0 ? (
                <div className="p-8 text-center text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] dark:text-zinc-500">{dt(`Nuk u gjetën postime.`)}</div>
              ) : displayPosts.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{dt(`Nuk u gjetën postime për këtë filtër.`)}</p>
                  <p className="text-xs text-slate-400 mt-1">{dt('Provo të ndryshosh kategorinë ose zgjidh një rubrikë tjetër.')}</p>
                </div>
              ) : displayPosts.map((post, postIndex) => (
                <React.Fragment key={post.id}>
                <div className="group relative rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_22px_-14px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-16px_rgba(15,23,42,0.24)] dark:border-zinc-800 dark:bg-zinc-900 border-l-4 border-l-blue-500/90">
                  <PostViewSensor postId={post.id} enabled={!isLoading} />
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                        {post.category || 'Debati'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 dark:bg-zinc-800 dark:text-slate-300">
                        {post.neighborhood || 'Qyteti'}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {new Date(post.createdAt).toLocaleDateString('sq-AL', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <img  alt=""
                      src={post.authorAvatar}
                      className="w-10 h-10 rounded-full object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setProfileModalData({isOpen: true, authorId: post.authorId, authorName: post.authorName, authorAvatar: post.authorAvatar})}
                    />
                    <div className="flex-1 min-w-0">
                      {post.isAd && <SponsoredPostBar postId={post.id} adLink={post.adLink} onReport={currentUser && currentUser.role !== 'guest' ? () => setReportTarget({ kind: 'ad', targetId: post.id, postId: post.id }) : undefined} />}
                      {/* Header Row */}
                      <div className="flex items-center gap-1.5 text-[15px] mb-0.5 flex-wrap">
                        <span
                          className="font-bold text-slate-900 dark:text-white hover:underline cursor-pointer truncate max-w-[150px] sm:max-w-[200px] text-[15px]"
                          onClick={() => setProfileModalData({isOpen: true, authorId: post.authorId, authorName: post.authorName, authorAvatar: post.authorAvatar})}
                        >
                          {post.authorName}
                        </span>
                        {(post.authorBadge === 'Zyrtar Komunal' || post.authorRole === 'admin') && (
                          <span title="Zyrtar i Verifikuar">
                            <BadgeCheck className="w-4 h-4 text-blue-500 shrink-0" />
                          </span>
                        )}
                        {verifiedIds.has(post.authorId) && post.authorBadge !== 'Zyrtar Komunal' && post.authorRole !== 'admin' && <VerifiedBadge />}
                        <span className="text-slate-400 dark:text-slate-500 truncate text-xs">@{(post.authorName || 'user').replace(/\s+/g, '').toLowerCase()}</span>
                        {/* Real interactive follow button directly on post */}
                        {post.authorId !== currentUser?.id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFollow(post.authorId, post.authorName);
                            }}
                            className={`ml-auto px-3 py-1 rounded-full text-xs font-bold transition-all ${
                              followedUserIds.includes(post.authorId)
                                ? 'bg-transparent border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:text-rose-500 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-blue-600 dark:hover:bg-blue-500 dark:hover:text-white shadow-xs'
                            }`}
                          >
                            {followedUserIds.includes(post.authorId) ? 'Duke ndjekur' : 'Ndjek'}
                          </button>
                        )}
                        {post.authorId === currentUser?.id && (
                          <PostOwnerMenu
                            onEdit={() => setEditingPost({ id: post.id, content: post.content })}
                            onDelete={() => void handleDeletePost(post.id)}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div className="text-[15px] text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed mb-3 break-words mt-1">
                        <PostFormatter content={post.content} onHashtagClick={(tag) => setHashtagPage(tag.replace(/^#/, '').toLowerCase())} />
                      </div>

                      {post.editedAt && <p className="-mt-2 mb-2 text-[11px] text-slate-400">{dt('i redaktuar')}</p>}
                      {/* Media */}
                      {(post.imageUrl || (post as any).imageUrls?.length > 0) && (
                        <PostGallery urls={Array.isArray((post as any).imageUrls) && (post as any).imageUrls.length > 0 ? (post as any).imageUrls : [post.imageUrl as string]} />
                      )}

                      {/* Poll */}
                      {post.poll && (
                        <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 mb-4 bg-slate-50 dark:bg-zinc-800/40 shadow-xs">
                          <span className="font-bold text-sm mb-3 block text-slate-900 dark:text-white">{dt(post.poll.question)}</span>
                          <div className="space-y-2">
                            {(post.poll.options || []).map((opt, i) => {
                              const voterId = currentUser?.id || 'qytetar-aktiv';
                              const hasVoted = (opt.votes || []).includes(voterId);
                              const totalVotes = post.poll?.totalVotes || 1;
                              const percentage = Math.round(((opt.votes?.length || 0) / totalVotes) * 100) || 0;
                              return (
                                <button
                                  key={i}
                                  onClick={() => handleVotePoll(post.id, opt.id)}
                                  className={`w-full ${
                                    hasVoted
                                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-600 dark:text-blue-400 font-black'
                                      : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-slate-200 hover:border-blue-400 font-bold'
                                  } border rounded-xl py-2.5 px-4 text-xs transition-all text-left flex justify-between relative overflow-hidden`}
                                >
                                  <div className="absolute left-0 top-0 bottom-0 bg-blue-100/70 dark:bg-blue-500/20 transition-all duration-300" style={{ width: `${percentage}%` }} />
                                  <span className="relative z-10 flex items-center gap-1.5">
                                    {hasVoted && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                                    {dt(opt.text)}
                                  </span>
                                  <span className="relative z-10 font-mono font-bold">{percentage}%</span>
                                </button>
                              );
                            })}
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-2.5">{post.poll.totalVotes || 0} {dt('vota gjithsej')}</span>
                        </div>
                      )}

                      {/* Quoted Post Preview — a framed reference inside the main post */}
                      {post.quotedPost && (
                        <div className="relative mt-2 mb-3 pl-3">
                          {/* Accent bar: reads as "this block quotes something" */}
                          <span aria-hidden="true" className="absolute left-0 top-1 bottom-1 w-1 rounded-full bg-gradient-to-b from-blue-500 to-emerald-500" />
                          <div className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 rounded-2xl p-3 text-xs hover:border-blue-300 dark:hover:border-blue-500/40 transition-colors">
                            <div className="flex items-center gap-2 mb-1.5 min-w-0">
                              <img
                                src={post.quotedPost.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.quotedPost.authorName)}`}
                                className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-200 dark:ring-zinc-600 shrink-0"
                                alt={post.quotedPost.authorName}
                                loading="lazy"
                              />
                              <span className="font-bold text-slate-900 dark:text-slate-200 truncate">{post.quotedPost.authorName}</span>
                              <BadgeCheck className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                              {post.quotedPost.authorBadge && (
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate hidden sm:inline">· {post.quotedPost.authorBadge}</span>
                              )}
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed line-clamp-4">{post.quotedPost.content}</p>
                            {post.quotedPost.imageUrl && (
                              <img
                                src={post.quotedPost.imageUrl}
                                alt="Postimi i cituar"
                                loading="lazy"
                                className="w-full max-h-44 object-cover rounded-xl mt-2 border border-slate-200 dark:border-zinc-700"
                              />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action Row */}
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 max-w-md pr-4 mt-3 border-t border-slate-100 dark:border-zinc-800 pt-3">
                        <button
                          onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)}
                          className={`flex items-center gap-2 text-[13px] group transition-colors ${activeCommentPost === post.id ? 'text-blue-600' : 'hover:text-blue-600'}`}
                        >
                          <div className={`p-2 rounded-full transition-colors ${activeCommentPost === post.id ? 'bg-blue-50 dark:bg-blue-500/10' : 'group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10'}`}>
                            <MessageCircle className={`w-4 h-4 ${activeCommentPost === post.id ? 'fill-blue-600/20 text-blue-600' : ''}`} />
                          </div>
                          <span className="font-bold">{post.comments?.length || 0}</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRepost(post.id)}
                            className={`flex items-center gap-1.5 text-[13px] group transition-colors ${(post.reposts || []).includes(currentUser?.id || 'qytetar-aktiv') ? 'text-emerald-600' : 'hover:text-emerald-600'}`}
                            title="Riposto menjëherë"
                          >
                            <div className={`p-2 rounded-full transition-colors ${(post.reposts || []).includes(currentUser?.id || 'qytetar-aktiv') ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'group-hover:bg-emerald-50 dark:group-hover:bg-emerald-500/10'}`}>
                              <RefreshCw className={`w-4 h-4 ${(post.reposts || []).includes(currentUser?.id || 'qytetar-aktiv') ? 'text-emerald-600' : ''}`} />
                            </div>
                            <span className="font-bold">{(post.reposts || []).length}</span>
                          </button>
                          <button
                            onClick={() => handleOpenQuoteModal(post)}
                            className="text-[10px] font-extrabold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/20 transition-all cursor-pointer"
                            title="Riposto me citat"
                          >
                            + Citat
                          </button>
                        </div>

                        <button
                          onClick={() => handleReaction(post.id, 'like')}
                          className={`flex items-center gap-2 text-[13px] group transition-colors ${(post.likes || []).includes(currentUser?.id || 'qytetar-aktiv') ? 'text-rose-500' : 'hover:text-rose-500'}`}
                        >
                          <div className={`p-2 rounded-full transition-colors ${(post.likes || []).includes(currentUser?.id || 'qytetar-aktiv') ? 'bg-rose-50 dark:bg-rose-500/10' : 'group-hover:bg-rose-50 dark:group-hover:bg-rose-500/10'}`}>
                            <Heart className={`w-4 h-4 ${(post.likes || []).includes(currentUser?.id || 'qytetar-aktiv') ? 'fill-rose-500 text-rose-500' : ''}`} />
                          </div>
                          <span className={`font-bold ${(post.likes || []).includes(currentUser?.id || 'qytetar-aktiv') ? 'text-rose-500' : 'group-hover:text-rose-500'}`}>
                            {(post.likes || []).length}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={!(post.authorId === currentUser?.id || isModerator)}
                          onClick={() => setAnalyticsPost(post)}
                          className="flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors enabled:hover:text-blue-600 disabled:cursor-default dark:text-slate-400"
                          title={post.authorId === currentUser?.id || isModerator ? dt('Analitika e postimit') : dt('Shfaqje')}
                          aria-label={`${post.viewCount || 0} ${dt('shfaqje')}`}
                        >
                          <span className="rounded-full p-2"><BarChart3 className="h-4 w-4" aria-hidden="true" /></span>
                          <span className="font-bold">{post.viewCount || 0}</span>
                        </button>

                        <button
                          onClick={() => setSharingPost(post)}
                          className="flex items-center gap-2 text-[13px] hover:text-blue-500 group transition-colors"
                          title={dt('Shpërndaj në të gjitha platformat')}
                          aria-label={dt('Shpërndaj postimin')}
                        >
                          <div className="p-2 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 transition-colors">
                            <Share2 className="w-4 h-4" />
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleSavedPost(post.id)}
                          aria-label={savedPostIds.includes(post.id) ? 'Hiq nga postimet e ruajtura' : 'Ruaj postimin'}
                          aria-pressed={savedPostIds.includes(post.id)}
                          className={`flex items-center gap-2 text-[13px] transition-colors ${savedPostIds.includes(post.id) ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600 dark:text-slate-400'}`}
                          title={savedPostIds.includes(post.id) ? 'Hiq nga të ruajturat' : 'Ruaj'}
                        >
                          <span className="rounded-full p-2 hover:bg-blue-50 dark:hover:bg-blue-500/10">
                            <Bookmark className={`h-4 w-4 ${savedPostIds.includes(post.id) ? 'fill-blue-600 text-blue-600' : ''}`} />
                          </span>
                        </button>

                        {post.authorId !== currentUser?.id && !post.id.startsWith('demo-') && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!currentUser || currentUser.role === 'guest') { setShowAuthPrompt(true); return; }
                              setReportingPostId(post.id);
                            }}
                            aria-label={dt('Raporto postimin')}
                            title={dt('Raporto postimin')}
                            className="flex items-center text-[13px] text-slate-500 transition-colors hover:text-rose-600 dark:text-slate-400"
                          >
                            <span className="rounded-full p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Flag className="h-4 w-4" aria-hidden="true" /></span>
                          </button>
                        )}

                        {/* Direct Ad Promotion Trigger for this Post */}
                        <button
                          type="button"
                          onClick={() => {
                            setAdModalPostId(post.id);
                            setAdModalPostContent(post.content);
                            setIsAdRequestModalOpen(true);
                          }}
                          className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 px-2 py-1 rounded-full hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors font-bold"
                          title="Promovo këtë postim me pagesë bankare"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Promovo</span>
                        </button>
                      </div>

                      {/* Comments Section Overlay */}
                      <AnimatePresence>
                        {activeCommentPost === post.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                              <div className="space-y-3 mb-4">
                                {(post.comments || []).length === 0 && (
                                  <p className="text-slate-400 text-xs italic text-center py-3">{dt(`Nuk ka ende komente. Bëhu i pari!`)}</p>
                                )}
                                {(post.comments || []).map((comment: any) => (
                                  <div key={comment.id} className="flex gap-2.5">
                                    <img src={comment.authorAvatar || 'https://ui-avatars.com/api/?name=U'} className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" alt="" />
                                    <div className="flex-1">
                                      <div className="bg-slate-100 dark:bg-zinc-800/80 rounded-2xl px-4 py-2.5 border border-slate-200 dark:border-zinc-700">
                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                          <span className="font-bold text-xs text-slate-900 dark:text-white">{(comment.authorName || 'user')}</span>
                                          <span className="text-[10px] text-slate-400">{new Date(comment.createdAt).toLocaleDateString('sq-AL')}</span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{comment.content}</p>
                                      </div>
                                      <div className="flex items-center gap-3 mt-1 px-2 text-[11px] font-bold text-slate-500">
                                        <button
                                          className="hover:text-blue-600 transition-colors"
                                          onClick={() => setReplyingCommentId(replyingCommentId === comment.id ? null : comment.id)}
                                        >
                                          {dt(`Përgjigju`)}
                                        </button>
                                        {(comment.authorId === currentUser?.id || post.authorId === currentUser?.id || isStaffUser) && (
                                          <button
                                            type="button"
                                            className="hover:text-rose-600 transition-colors"
                                            onClick={() => void handleDeleteComment(post.id, comment.id)}
                                            aria-label={dt('Fshi komentin')}
                                          >
                                            {dt('Fshi')}
                                          </button>
                                        )}
                                        {currentUser && currentUser.role !== 'guest' && comment.authorId !== currentUser.id && (
                                          <button
                                            type="button"
                                            className="hover:text-rose-600 transition-colors"
                                            onClick={() => setReportTarget({ kind: 'comment', targetId: comment.id, postId: post.id })}
                                            aria-label={dt('Raporto komentin')}
                                          >
                                            {dt('Raporto')}
                                          </button>
                                        )}
                                      </div>

                                      {/* Replies List */}
                                      {comment.replies && comment.replies.length > 0 && (
                                        <div className="mt-2.5 space-y-2 pl-3 border-l-2 border-slate-200 dark:border-zinc-700">
                                          {(comment.replies || []).map((reply: any) => (
                                            <div key={reply.id} className="flex gap-2">
                                              <img src={reply.authorAvatar || 'https://ui-avatars.com/api/?name=U'} className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" alt="" />
                                              <div className="flex-1 bg-slate-50 dark:bg-zinc-800/50 rounded-xl px-3 py-2 border border-slate-200 dark:border-zinc-700/60">
                                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                                  <span className="font-bold text-[11px] text-slate-900 dark:text-white">{(reply.authorName || 'user')}</span>
                                                  <span className="text-[9px] text-slate-400">{new Date(reply.createdAt).toLocaleDateString('sq-AL')}</span>
                                                </div>
                                                <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{reply.content}</p>
                                                {(reply.authorId === currentUser?.id || comment.authorId === currentUser?.id || post.authorId === currentUser?.id || isStaffUser) && (
                                                  <button
                                                    type="button"
                                                    className="mt-1 text-[10px] font-bold text-slate-400 hover:text-rose-600"
                                                    onClick={() => void handleDeleteComment(post.id, reply.id)}
                                                    aria-label={dt('Fshi përgjigjen')}
                                                  >
                                                    {dt('Fshi')}
                                                  </button>
                                                )}
                                                {currentUser && currentUser.role !== 'guest' && reply.authorId !== currentUser.id && (
                                                  <button
                                                    type="button"
                                                    className="mt-1 ml-3 text-[10px] font-bold text-slate-400 hover:text-rose-600"
                                                    onClick={() => setReportTarget({ kind: 'comment', targetId: reply.id, postId: post.id })}
                                                    aria-label={dt('Raporto përgjigjen')}
                                                  >
                                                    {dt('Raporto')}
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Reply Input Form */}
                                      {replyingCommentId === comment.id && (
                                        <div className="mt-2.5 flex gap-2 pl-2 border-l-2 border-blue-500">
                                          <img src={currentUser?.avatar || 'https://ui-avatars.com/api/?name=U'} className="w-6 h-6 rounded-full object-cover shrink-0" alt="" />
                                          <div className="flex-1 flex bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-full overflow-hidden focus-within:border-blue-500 transition-colors">
                                            <input
                                              type="text"
                                              value={replyContent}
                                              onChange={(e) => setReplyContent(e.target.value)}
                                              placeholder={`Përgjigju ${(comment.authorName || 'user')}...`}
                                              className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white px-3.5 py-1.5 focus:outline-none"
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                  e.preventDefault();
                                                  handleAddReply(post.id, comment.id);
                                                }
                                              }}
                                            />
                                            <button
                                              onClick={() => handleAddReply(post.id, comment.id)}
                                              disabled={!replyContent.trim()}
                                              className="px-3 text-blue-600 hover:text-blue-700 disabled:opacity-40 transition-colors font-bold text-xs"
                                            >
                                              <Send className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Primary Comment Textarea */}
                              <div className="flex items-start gap-2.5 mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
                                <img src={currentUser?.avatar || 'https://ui-avatars.com/api/?name=U'} className="w-8 h-8 rounded-full object-cover shrink-0 mt-1" alt="" />
                                <div className="flex-1 flex flex-col relative">
                                  <textarea
                                    value={newCommentContent}
                                    onChange={e => setNewCommentContent(e.target.value)}
                                    placeholder={dt(`Posto komentin tuaj publik...`)}
                                    className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-2xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none resize-none min-h-[44px]"
                                    rows={newCommentContent ? 2 : 1}
                                  />
                                  <div className="flex justify-end items-center mt-2">
                                    <button
                                      onClick={() => handleAddComment(post.id)}
                                      disabled={!newCommentContent.trim() || isSubmitting}
                                      className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-full transition-all shadow-xs"
                                    >
                                      {dt(`Përgjigju`)}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  </div>
                </div>

                </React.Fragment>
              ))}
            </div>
            {!isLoading && displayPosts.length > 0 && feedTab !== 'saved' && (
              <LoadMore hasMore={hasMore} loading={loadingMore} onLoad={() => void loadMore()} />
            )}


               </>
             )}
             {activeTab === 'profile' && (
               <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none min-h-[60vh] overflow-hidden">
                 <ForumProfileTab
                   currentUser={currentUser}
                   onOpenReel={(reel) => openReels({ source: { kind: 'author', authorId: reel.authorId, includeHidden: reel.authorId === currentUser?.id }, startReelId: reel.id })}
                   onCreateReel={() => setReelComposerOpen(true)}
                   onOpenInsights={() => setInsightsOpen(true)}
                   deletedCount={trashPosts.length}
                   onOpenTrash={() => setTrashOpen(true)}
                   setActiveTab={setActiveTab}
                   posts={posts}
                   savedPostIds={savedPostIds}
                   followingCount={followedUserIds.length}
                   followersCount={followerCountOf(currentUser?.id || '')}
                   followersList={allForumUsers
                     .filter(u => Array.isArray(u.followingIds) && u.followingIds.includes(currentUser?.id))
                     .map(u => ({ id: u.id, name: u.name || 'Qytetar', avatar: u.avatar || '' }))}
                   followingList={followedUserIds
                     .map(id => allForumUsers.find(u => u.id === id))
                     .filter(Boolean)
                     .map(u => ({ id: u!.id, name: u!.name || 'Qytetar', avatar: u!.avatar || '' }))}
                   notFollowedBack={notFollowedBack
                     .map(id => allForumUsers.find(u => u.id === id))
                     .filter(Boolean)
                     .map(u => ({ id: u!.id, name: u!.name || 'Qytetar', avatar: u!.avatar || '' }))}
                   suggestions={followSuggestions}
                   onToggleFollow={handleToggleFollow}
                   onCreateStory={() => {
                     setActiveTab('feed');
                     window.setTimeout(() => window.dispatchEvent(new Event('zeri:open-forum-story')), 0);
                   }}
                 />
               </div>
             )}
          </div>

          {/*
            Right rail — trends, sponsor, official profiles.

            Same sticky problem as the left rail: `sticky top-6 h-fit` on a
            column taller than the viewport pins the top and hides the rest, so
            the last card could never be read. It scrolls with the page now.

            Narrowed from 320px to 288px so the two rails plus the feed fit on a
            1280px laptop without the feed being squeezed to an unreadable
            column.
          */}
          <div className="hidden xl:flex w-72 shrink-0 flex-col gap-4">
             {currentTrends.length > 0 && (
             <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none p-5">
               <h3 className="font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2 title-serif text-lg"><TrendingUp className="w-5 h-5 text-blue-500"/> {dt('Në Qendër Të Vëmendjes')}</h3>
               <div className="space-y-5 relative min-h-[200px]">
                 <AnimatePresence mode="popLayout">
                   {currentTrends.map((trend, i) => (
                       <motion.div
                         key={trend.id}
                         layout
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         exit={{ opacity: 0, x: -10 }}
                         transition={{ duration: 0.4 }}
                         className="cursor-pointer group flex gap-3"
                         onClick={() => { setSearchQuery(trend.title); setActiveTab('feed'); setFeedTab('forYou'); }}
                       >
                         {/* Modern X/Twitter style trend */}
                         <div className="flex-1">
                           <p className="text-[13px] text-slate-500 flex justify-between items-center w-full">
                             <span>{trend.rank} · {trend.category} · {trend.location}</span>
                             <MoreHorizontal className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"/>
                           </p>
                           <p className="text-[15px] font-bold text-slate-900 dark:text-white mt-0.5 group-hover:text-blue-500 transition-colors">
                             {trend.title}
                           </p>
                           <p className="text-[13px] text-slate-500 mt-0.5">{trend.discussions}</p>
                         </div>
                       </motion.div>
                     ))}
                 </AnimatePresence>
               </div>
             </div>
             )}

             {allProfiles.length > 0 && (
             <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none p-5">
               <h3 className="font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2 title-serif text-lg"><Users className="w-5 h-5 text-indigo-500"/> {dt('Profilet Zyrtare')}</h3>
               <div className="space-y-5 relative min-h-[140px]">
                 <AnimatePresence mode="popLayout">
                   {(showAllOfficialProfiles ? allProfiles : currentProfiles).map(profile => (
                     <motion.div
                       key={profile.id}
                       layout
                       initial={{ opacity: 0, x: 20 }}
                       animate={{ opacity: 1, x: 0 }}
                       exit={{ opacity: 0, x: -20 }}
                       transition={{ duration: 0.5, type: 'spring' }}
                       className="flex items-center gap-3 cursor-pointer group"
                     >
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${profile.color}`}>
                         {profile.initials}
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-1">
                           <p className="font-bold text-[15px] text-slate-900 dark:text-white truncate group-hover:underline">{profile.name}</p>
                           {profile.verified && <BadgeCheck className="w-4 h-4 text-blue-500 shrink-0"/>}
                         </div>
                         <p className="text-[13px] text-slate-500 truncate">{profile.handle}</p>
                       </div>
                       <button
                         type="button"
                         onClick={() => handleToggleFollow(profile.id, profile.name)}
                         aria-pressed={followedUserIds.includes(profile.id)}
                         className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all shrink-0 flex items-center gap-1.5 ${
                           followedUserIds.includes(profile.id)
                             ? 'bg-transparent border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:text-rose-500 hover:border-rose-300'
                             : 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 shadow-xs'
                         }`}
                       >
                         {followedUserIds.includes(profile.id)
                           ? <><Check className="w-3.5 h-3.5" />{dt('Duke ndjekur')}</>
                           : <><Plus className="w-3.5 h-3.5" />{dt('Ndjek')}</>}
                       </button>
                     </motion.div>
                   ))}
                 </AnimatePresence>
               </div>
               {/*
                 The button only appears when there is something behind it. With
                 three profiles loaded against a three-profile window, the old
                 unconditional "Shfaq të gjitha profilet" toggled a state that
                 changed nothing on screen — which read as a broken button.
               */}
               {allProfiles.length > currentProfiles.length && (
                 <button
                   type="button"
                   onClick={() => setShowAllOfficialProfiles(value => !value)}
                   aria-expanded={showAllOfficialProfiles}
                   className="w-full mt-5 py-2.5 text-sm font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-500/10 rounded-xl transition-colors"
                 >
                   {showAllOfficialProfiles
                     ? dt('Shfaq më pak')
                     : `${dt('Shfaq të gjitha profilet')} (${allProfiles.length})`}
                 </button>
               )}
             </div>
             )}

             <div className="text-xs text-slate-400 dark:text-slate-500 flex flex-wrap gap-x-3 gap-y-2 px-2 mt-1">
               <a href="#" className="hover:underline transition-all">{dt('Privatësia')}</a>
               <a href="#" className="hover:underline transition-all">Kushtet</a>
               <a href="#" className="hover:underline transition-all">Reklamimi</a>
               <a href="#" className="hover:underline transition-all">Rreth Nesh</a>
               <a href="#" className="hover:underline transition-all">{dt('Aksesueshmëria')}</a>
               <span className="w-full mt-1">© 2026 Platforma Raporto</span>
             </div>
          </div>

        </div>
      </div>

      <nav
        aria-label={dt('Navigimi i debatit publik')}
        className="z-40 grid shrink-0 grid-cols-5 items-center border-t border-slate-200 bg-white/95 px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-950/95 lg:hidden"
      >
        {([
          { id: 'home', label: 'Ballina', icon: Home, onClick: () => { setActiveTab('feed'); setFeedTab('forYou'); setIsDMModalOpen(false); document.querySelector('.forum-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }); } },
          { id: 'explore', label: 'Eksploro', icon: Search, onClick: () => setActiveTab('explore') },
        ] as const).map(({ id, label, icon: Icon, onClick }) => (
          <button key={id} type="button" onClick={onClick} aria-label={dt(label)} aria-current={activeMobileNav === id ? 'page' : undefined}
            className={`flex min-h-12 items-center justify-center rounded-xl transition-colors ${activeMobileNav === id ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
            <Icon className="h-6 w-6" strokeWidth={activeMobileNav === id ? 2.7 : 2} aria-hidden="true" />
          </button>
        ))}

        {/* The centre slot opens the create menu: post, story, reel, poll. */}
        <button
          type="button"
          onClick={openCreateMenu}
          aria-label={dt('Krijo')}
          aria-haspopup="dialog"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30 transition active:scale-95"
        >
          <Plus className="h-6 w-6" strokeWidth={2.6} aria-hidden="true" />
        </button>

        <button type="button" onClick={() => setIsDMModalOpen(true)} aria-label={`${dt('Mesazhet')}${totalUnreadDMs ? ` (${totalUnreadDMs})` : ''}`} aria-current={activeMobileNav === 'messages' ? 'page' : undefined}
          className={`relative flex min-h-12 items-center justify-center rounded-xl transition-colors ${activeMobileNav === 'messages' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
          <MessageCircle className="h-6 w-6" strokeWidth={activeMobileNav === 'messages' ? 2.7 : 2} aria-hidden="true" />
          {totalUnreadDMs > 0 && (
            <span className="absolute right-[28%] top-1.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-zinc-950">
              {totalUnreadDMs > 9 ? '9+' : totalUnreadDMs}
            </span>
          )}
        </button>

        <button type="button" onClick={() => { setIsDMModalOpen(false); setActiveTab('profile'); }} aria-label={dt('Profili im')} aria-current={activeMobileNav === 'profile' ? 'page' : undefined}
          className={`flex min-h-12 items-center justify-center rounded-xl transition-colors ${activeMobileNav === 'profile' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
          <User className="h-6 w-6" strokeWidth={activeMobileNav === 'profile' ? 2.7 : 2} aria-hidden="true" />
        </button>
      </nav>

      {createMenuOpen && (
        <CreateMenuSheet allowReels={showReels} onSelect={handleCreateAction} onClose={() => setCreateMenuOpen(false)} />
      )}
      {reelsOpen && showReels && (
        <ReelsViewer
          key={`${reelsVersion}:${reelsView.source.kind}:${reelsView.startReelId ?? ''}`}
          source={reelsView.source}
          startReelId={reelsView.startReelId}
          currentUser={currentUser ? { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar } : null}
          isStaff={isStaffUser}
          currentUserId={currentUser?.id ?? null}
          canInteract={isSignedInCitizen}
          isFollowing={(id) => followedUserIds.includes(id)}
          canViewAuthorReels={(authorId) => canViewReels(prefsOf(forumProfileOf(authorId)), {
            isOwner: authorId === currentUser?.id,
            viewerFollowsOwner: followedUserIds.includes(authorId),
            viewerIsStaff: isStaffUser,
          })}
          onToggleFollow={(id) => void handleToggleFollow(id)}
          onOpenProfile={(authorId, authorName, authorAvatar) => {
            setReelsOpen(false);
            setProfileModalData({ isOpen: true, authorId, authorName, authorAvatar });
          }}
          onRequireAuth={() => { setReelsOpen(false); setShowAuthPrompt(true); }}
          onCreateReel={() => setReelComposerOpen(true)}
          onClose={() => {
            setReelsOpen(false);
            // Leave the shared link's address so a refresh does not reopen the reel.
            if (reelIdFromSearch(window.location.search)) window.history.replaceState(window.history.state, '', window.location.pathname);
          }}
        />
      )}
      {reelComposerOpen && currentUser && isSignedInCitizen && (
        <ReelComposer
          author={{ id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }}
          onClose={() => setReelComposerOpen(false)}
          onPublished={() => {
            setReelComposerOpen(false);
            setReelsVersion((v) => v + 1);
            openReels();
          }}
        />
      )}

      <ForumProfileModal
        isOpen={profileModalData.isOpen}
        onClose={() => setProfileModalData({ ...profileModalData, isOpen: false })}
        authorId={profileModalData.authorId}
        authorName={profileModalData.authorName}
        authorAvatar={profileModalData.authorAvatar}
        posts={posts.filter(p => p.authorId === profileModalData.authorId)}
        followed={followedUserIds.includes(profileModalData.authorId)}
        authorProfile={forumProfileOf(profileModalData.authorId)}
        onToggleFollow={handleToggleFollow}
        onOpenDM={handleOpenDM}
        onOpenReel={(reel) => {
          setProfileModalData({ ...profileModalData, isOpen: false });
          openReels({ source: { kind: 'author', authorId: reel.authorId, includeHidden: reel.authorId === currentUser?.id }, startReelId: reel.id });
        }}
      />

      {reportingPostId && <ReportPostSheet postId={reportingPostId} onClose={() => setReportingPostId(null)} />}
      {scheduledSheetOpen && <ScheduledPostsSheet onClose={() => setScheduledSheetOpen(false)} />}
      {reportTarget && <ReportTargetSheet target={reportTarget} onClose={() => setReportTarget(null)} />}
      {showVerification && <VerificationModal onClose={() => setShowVerification(false)} />}
      {editingPost && (
        <PostEditSheet
          postId={editingPost.id}
          initialContent={editingPost.content}
          onClose={() => setEditingPost(null)}
          onSaved={(content) => setPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, content, editedAt: new Date() } : p))}
        />
      )}
      {trashOpen && <DeletedPostsSheet posts={trashPosts} onClose={() => setTrashOpen(false)} />}
      {hashtagPage && <HashtagSheet tag={hashtagPage} localPosts={posts as any[]} onClose={() => setHashtagPage(null)} />}
      {insightsOpen && currentUser && isSignedInCitizen && (
        <AccountInsightsSheet
          authorId={currentUser.id}
          posts={posts as any}
          isBusiness={isBusiness(currentUser)}
          followersCount={followerCountOf(currentUser.id)}
          onUpgrade={() => { setActiveTab('profile'); window.dispatchEvent(new Event('zeri:open-forum-settings')); }}
          onClose={() => setInsightsOpen(false)}
        />
      )}
      {analyticsPost && (
        <PostAnalyticsSheet post={analyticsPost as any} verified={verifiedIds.has(analyticsPost.authorId)} onClose={() => setAnalyticsPost(null)} />
      )}

      {/* Direct Messages Modal */}
      <DirectMessagesModal
        isOpen={isDMModalOpen}
        onClose={() => setIsDMModalOpen(false)}
        targetUser={dmTargetUser}
      />

      {/* Quote Repost Modal */}
      {isQuoteModalOpen && quoteTargetPost && (
        <AnimatePresence>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 text-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-emerald-400" />
                  Riposto me Citat
                </h3>
                <button onClick={() => setIsQuoteModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <textarea
                value={quoteText}
                onChange={(e) => setQuoteText(e.target.value)}
                placeholder={dt('Shto mendimin tënd mbi këtë postim...')}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 mb-3"
              />

              {/* Preview of Quoted Post */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs mb-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <img
                    src={quoteTargetPost.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(quoteTargetPost.authorName)}`}
                    className="w-5 h-5 rounded-full object-cover"
                    alt={quoteTargetPost.authorName}
                  />
                  <span className="font-semibold text-slate-200">{quoteTargetPost.authorName}</span>
                  <BadgeCheck className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <p className="text-slate-300 text-[11px] line-clamp-2">{quoteTargetPost.content}</p>
                {quoteTargetPost.imageUrl && (
                  <img src={quoteTargetPost.imageUrl} alt="Quote media" className="w-full h-24 object-cover rounded-lg mt-2" />
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsQuoteModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  {dt('Anulo')}
                </button>
                <button
                  onClick={handleCreateQuotePost}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  {isSubmitting ? 'Po publikohet...' : 'Publiko Citatin'}
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>
      )}

      {/* Ad Request Modal with Bank Payment (IBAN) */}
      <AdRequestModal
        isOpen={isAdRequestModalOpen}
        onClose={() => setIsAdRequestModalOpen(false)}
        initialPostId={adModalPostId}
        initialPostContent={adModalPostContent}
      />

      {/*
        Share sheet. The link is a deep link to the feed plus the post id, not
        `window.location.href`: this router is hash-based, so the raw URL is the
        app root and every shared post used to land the recipient on the
        dashboard with no idea what had been sent.
      */}
      <ShareSheet
        isOpen={Boolean(sharingPost)}
        onClose={() => setSharingPost(null)}
        target={{
          url: `${window.location.origin}${window.location.pathname}#/forum?post=${encodeURIComponent(sharingPost?.id ?? '')}`,
          title: sharingPost ? `${dt('Debat nga')} ${sharingPost.authorName}` : '',
          text: sharingPost?.content ? sharingPost.content.slice(0, 160) : undefined,
        }}
      />
    </div>
  );
}

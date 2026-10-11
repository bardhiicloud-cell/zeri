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
  Search, Bell, Trash2, Home, User, Loader2, ArrowUpRight, Globe, Video, Users, Eye, EyeOff, Hash, Filter, ChevronDown, Check, AlertTriangle, TrendingUp, UserPlus, Sparkles, MapPin, BarChart3, CornerDownRight, Award, BadgeCheck, Flame, PieChart, Layers, ArrowLeft, SlidersHorizontal, Plus, Shield, Megaphone, DollarSign, Radio, Bookmark, LockKeyhole
, RefreshCw} from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { auth, db, uploadFileToStorage } from '../lib/firebase';
import { 
  collection, query, orderBy, onSnapshot, addDoc,  limit,
  serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove, deleteDoc , where
} from 'firebase/firestore';
import { PostFormatter } from "../components/PostFormatter";
import { LegalModal } from "../components/LegalModal";
import { GuestGuard } from '../components/GuestGuard';
import ForumProfileTab from '../components/forum/ForumProfileTab';
import { ForumStories } from '../components/forum/ForumStories';
import AdBanner from '../components/AdBanner.tsx';
import { AdRequestModal } from '../components/AdRequestModal.tsx';
import { ShareSheet } from '../components/ShareSheet.tsx';
import { DirectMessagesModal } from '../components/forum/DirectMessagesModal';
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
  createdAt: any;
}




const DEFAULT_OFFICIAL_PROFILES = [
  { id: 'off-1', name: 'Komuna e Prishtinës', handle: '@prishtina_official', verified: true, followers: '45.2K', initials: 'KP', color: 'bg-blue-600' },
  { id: 'off-2', name: 'Policia e Kosovës', handle: '@policiakosoves', verified: true, followers: '68.9K', initials: 'PK', color: 'bg-indigo-600' },
  { id: 'off-3', name: 'Ministria e Mjedisit', handle: '@mjedisiks', verified: true, followers: '22.1K', initials: 'MM', color: 'bg-emerald-600' },
  { id: 'off-4', name: 'Shërbimet Publike', handle: '@sherbimetpublike', verified: true, followers: '19.4K', initials: 'SHP', color: 'bg-amber-600' },
  { id: 'off-5', name: 'Inspektorati Komunal', handle: '@inspektoratiks', verified: true, followers: '14.8K', initials: 'IK', color: 'bg-rose-600' }
];

const DEFAULT_TRENDS = [
  { id: 101, category: 'Infrastrukturë', location: 'Prishtinë', title: 'Zgjerimi i rrugëve dhe unaza e kryeqytetit', discussions: '142 diskutime', rank: 1 },
  { id: 102, category: 'Mjedis & Gjelbërim', location: 'Kosovë', title: 'Fushata kombëtare për pastrimin e parqeve', discussions: '98 diskutime', rank: 2 },
  { id: 103, category: 'Siguri Publike', location: 'Prizren', title: 'Vendosja e kamerave të sigurisë në qendër', discussions: '76 diskutime', rank: 3 },
  { id: 104, category: 'Transport Publik', location: 'Trafiku Urban', title: 'Linjat e reja të autobusëve elektrikë', discussions: '64 diskutime', rank: 4 }
];

export default function ForumPage() {
  const navigate = useNavigate();
  const { dt } = useLanguage();
  const currentUser = useStore(state => state.currentUser);
  const systemSettings = useStore(state => state.systemSettings);
  const showReels = systemSettings?.showReels ?? true;

  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
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
  const computedTrends = React.useMemo(() => {
    if (!posts || posts.length === 0) return DEFAULT_TRENDS;

    // 1. Group posts by category/location
    const topics: Record<string, { id: number, category: string, location: string, title: string, engagement: number }> = {};

    posts.forEach((post, index) => {
      const title = post.content.substring(0, 30) + (post.content.length > 30 ? '...' : '');
      const cat = post.category || 'Tjera';
      const loc = post.neighborhood || 'Kosovë';

      const engagement = (post.likes?.length || 0) + (post.comments?.length || 0) * 2;
      topics[post.id] = {
        id: index,
        category: cat,
        location: loc,
        title: title,
        engagement: engagement
      };
    });

    // 2. Sort by highest engagement
    const sorted = Object.values(topics).sort((a, b) => b.engagement - a.engagement);
    if (sorted.length === 0) return DEFAULT_TRENDS;

    // 3. Map to trend object
    return sorted.map((t, i) => ({
      id: t.id,
      category: t.category,
      location: t.location,
      title: t.title,
      discussions: `${Math.max(t.engagement * 3, 14)} diskutime`,
      rank: i + 1
    }));
  }, [posts]);

  const [feedSortBy, setFeedSortBy] = useState('trending'); // 'recent', 'trending', 'hot'
  const [feedTab, setFeedTab] = useState<'forYou' | 'following' | 'municipality' | 'polls' | 'official'>('forYou');
  const [isAdRequestModalOpen, setIsAdRequestModalOpen] = useState(false);
  const [adModalPostId, setAdModalPostId] = useState<string | undefined>(undefined);
  const [adModalPostContent, setAdModalPostContent] = useState<string | undefined>(undefined);
  const [showAllOfficialProfiles, setShowAllOfficialProfiles] = useState(false);

  // Direct Messages & Quote Posts State
  const [isDMModalOpen, setIsDMModalOpen] = useState(false);
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
      await addDoc(collection(db, 'forumPosts'), {
        isHidden: false,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorEmail: currentUser.email,
        authorAvatar: currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=0D8ABC&color=fff`,
        authorRole: currentUser.role,
        authorBadge: currentUser.points > 100 ? 'Përfaqësues Lagjeje' : 'Qytetar i Verifikuar',
        content: quoteText,
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
        aiSentiment: {
          positivePct: 80,
          negativePct: 10,
          neutralPct: 10,
          summaryText: 'Citat dhe analizë nga qytetari mbi debatin publik.'
        },
        createdAt: serverTimestamp()
      });

      if (quoteTargetPost.authorId && quoteTargetPost.authorId !== currentUser.id) {
        try {
          await addDoc(collection(db, 'notifications'), {
            title: `${currentUser.name} citoi postimin tuaj`,
            message: quoteText.slice(0, 150) || 'Postimi juaj u citua në Debatin Publik.',
            channel: 'forum',
            category: 'forum_quote',
            type: 'info',
            priority: 'normal',
            audience: 'user',
            userId: quoteTargetPost.authorId,
            actorId: currentUser.id,
            actorName: currentUser.name,
            state: 'published',
            link: '/forum',
            sender: currentUser.name,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn('Could not write quote notification:', err);
        }
      }

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
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [savedPostIds, setSavedPostIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('saved_forum_post_ids') || '[]'); }
    catch { return []; }
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
  useEffect(() => {
    if (!currentUser || currentUser.role === 'guest') return;
    const usersQuery = query(collection(db, 'users'), limit(500));
    return onSnapshot(usersQuery, (snap) => {
      setAllForumUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => setAllForumUsers([]));
  }, [currentUser?.id, currentUser?.role]);

  const followingIdsOf = React.useCallback((userId: string): string[] => {
    const profile = allForumUsers.find(u => u.id === userId);
    return Array.isArray(profile?.followingIds) ? profile.followingIds : [];
  }, [allForumUsers]);

  const followerCountOf = React.useCallback((userId: string): number =>
    allForumUsers.filter(u => Array.isArray(u.followingIds) && u.followingIds.includes(userId)).length,
  [allForumUsers]);

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

  const handleToggleFollow = async (targetId: string, name?: string) => {
    const isFollowing = followedUserIds.includes(targetId);
    const updated = isFollowing ? followedUserIds.filter(id => id !== targetId) : [...followedUserIds, targetId];
    if (currentUser && currentUser.role !== 'guest' && auth.currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.id), { followingIds: updated });
        useStore.getState().setCurrentUser({ ...currentUser, followingIds: updated } as any);
      } catch (error) {
        console.error('Following nuk u ruajt:', error);
        toast.error('Ndjekja nuk u ruajt. Provoni përsëri.');
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
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'feed' | 'profile'>('feed');
  const [activeMobileNav, setActiveMobileNav] = useState<'debate' | 'search' | 'post' | 'profile'>('debate');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAuthPrompt, setShowAuthPrompt] = useState(true);
  const shouldGateForum = !currentUser || currentUser.role === 'guest';

  // Ad state
  const [isAdPost, setIsAdPost] = useState(false);
  const [adLink, setAdLink] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) setNewPostImage(e.target.files[0]); };

  useEffect(() => {
    /**
     * The feed is capped at the newest 50 posts.
     *
     * Without a limit, `orderBy('createdAt','desc')` still delivers the entire
     * collection to the browser and keeps a live listener on every one of them.
     * The forum is the highest-traffic page on the platform, so that is a
     * per-visitor cost that grows with total history rather than with what the
     * visitor can see. Older posts are reachable by scrolling through the
     * server's paginated endpoint.
     */
    const q = query(collection(db, 'forumPosts'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snapshot) => {
      const p = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post));

      setPosts(p);
      setIsLoading(false);
    }, (error) => {
      console.warn('Could not fetch live forum posts, proceeding with default state:', error);
      setIsLoading(false);
    });

    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => {
      clearTimeout(safetyTimer);
      unsub();
    };
  }, []);

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
    return { label: 'Qytetar i Verifikuar', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: BadgeCheck };
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.role === 'guest') {
      setShowAuthPrompt(true);
      return;
    }
    if (!newPostContent.trim() && !newPostImage && !pollQuestion.trim()) return;

    setIsSubmitting(true);
    let imageUrl = '';

    try {
      if (newPostImage) {
        const url = await uploadFileToStorage(newPostImage, 'reports', { scope: 'forum' });
        if (url) imageUrl = url;
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

      await addDoc(collection(db, 'forumPosts'), {
        isHidden: false,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorEmail: currentUser.email,
        authorAvatar: currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=0D8ABC&color=fff`,
        authorRole: currentUser.role,
        authorBadge: currentUser.points > 100 ? 'Përfaqësues Lagjeje' : 'Qytetar i Verifikuar',
        content: newPostContent,
        category: selectedCategory,
        neighborhood: selectedNeighborhood,
        poll: pollData,
        imageUrl,
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
        aiSentiment: {
          positivePct: 75,
          negativePct: 15,
          neutralPct: 10,
          summaryText: 'Debat aktiv qytetar mbi propozimin lokal. AI Analiza tregon mbështetje pozitive.'
        },
        createdAt: serverTimestamp()
      });

      setNewPostContent('');
      setNewPostImage(null);
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
        updateDoc(doc(db, 'forumPosts', postId), { poll: updatedPoll }).catch(console.error);
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
      const newReposts = hasReposted ? currentReposts.filter(id => id !== actorId) : [...currentReposts, actorId];

      setPosts(prev => prev.map(p => p.id === postId ? { ...p, reposts: newReposts } : p));
      try {
        await persistPostAction(postId, 'repost');
        /**
         * Real-time bell: the author learns their post is circulating the
         * moment the repost lands. Only on the first repost — un-reposting is
         * not something worth a notification.
         */
        if (!hasReposted && post.authorId && currentUser && post.authorId !== currentUser.id) {
          addDoc(collection(db, 'notifications'), {
            title: `${currentUser.name} ripostoi debatin tuaj`,
            message: post.content.slice(0, 100),
            channel: 'forum',
            category: 'forum_repost',
            type: 'info',
            priority: 'low',
            audience: 'user',
            userId: post.authorId,
            actorId: currentUser.id,
            actorName: currentUser.name,
            state: 'published',
            link: '/forum',
            sender: currentUser.name,
            createdAt: serverTimestamp(),
          }).catch(console.warn);
        }
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
          if (!hasLiked && post.authorId && currentUser && post.authorId !== currentUser.id) {
            addDoc(collection(db, 'notifications'), {
              title: `${currentUser.name} pëlqeu postimin tuaj`,
              message: post.content.slice(0, 100),
              channel: 'forum',
              category: 'forum_like',
              type: 'info',
              priority: 'low',
              audience: 'user',
              userId: post.authorId,
              actorId: currentUser.id,
              actorName: currentUser.name,
              state: 'published',
              link: '/forum',
              sender: currentUser.name,
              createdAt: serverTimestamp(),
            }).catch(console.warn);
          }
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
          updateDoc(doc(db, 'forumPosts', postId), { reactions: updatedReactions }).catch(console.error);
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleAddComment = async (postId: string) => {
    if (!currentUser || currentUser.role === 'guest') {
      setShowAuthPrompt(true);
      return;
    }
    if (!newCommentContent.trim()) return;

    const commentText = newCommentContent;
    setNewCommentContent('');

    const newComment: ForumComment = {
      id: Math.random().toString(36).substring(2, 9),
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=0D8ABC&color=fff`,
      content: commentText,
      createdAt: new Date().toISOString(),
      replies: []
    };

    // Instant optimistic state update
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), newComment] } : p));
    toast.success('Komenti u shtua!');

    try {
      if (!postId.startsWith('demo-')) {
        await updateDoc(doc(db, 'forumPosts', postId), {
          comments: arrayUnion(newComment)
        });

        /*
         * Notify the post author that someone commented. The bell already
         * renders `channel: 'forum'` documents, so this completes the loop:
         * before this block a reply was written silently and the author never
         * knew their discussion had an answer. Self-comments don't notify —
         * the author already knows what they just wrote.
         */
        const post = posts.find(p => p.id === postId);
        if (post && post.authorId && post.authorId !== currentUser.id) {
          try {
            await addDoc(collection(db, 'notifications'), {
              title: `${currentUser.name} komentoi diskutimin tuaj`,
              message: commentText.slice(0, 200),
              channel: 'forum',
              category: 'forum_reply',
              type: 'info',
              priority: 'normal',
              audience: 'user',
              userId: post.authorId,
              postId,
              actorId: currentUser.id,
              actorName: currentUser.name,
              state: 'published',
              link: '/forum',
              sender: currentUser.name,
              createdAt: serverTimestamp(),
            });
          } catch (notifError) {
            // A failed notification must not fail the comment that was already
            // written — the discussion itself is the primary data.
            console.warn('Forum notification write failed:', notifError);
          }
        }
      }
    } catch (error) {
      console.error(error);
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
    setReplyingCommentId(null);

    const newReply: CommentReply = {
      id: Math.random().toString(36).substring(2, 9),
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=0D8ABC&color=fff`,
      content: repText,
      createdAt: new Date().toISOString()
    };

    // Instant optimistic state update
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const updatedComments = (p.comments || []).map(c => {
        if (c.id === commentId) {
          return { ...c, replies: [...(c.replies || []), newReply] };
        }
        return c;
      });
      return { ...p, comments: updatedComments };
    }));
    toast.success('Përgjigjja u dërgua!');

    try {
      const post = posts.find(p => p.id === postId);
      if (post && !postId.startsWith('demo-')) {
        const updatedComments = (post.comments || []).map(c => {
          if (c.id === commentId) {
            return { ...c, replies: [...(c.replies || []), newReply] };
          }
          return c;
        });
        await updateDoc(doc(db, 'forumPosts', postId), { comments: updatedComments });

        /*
         * Notify the comment author that their comment got a reply. This is
         * the conversation loop the forum was missing: a nested reply was
         * written silently, so the person being answered never returned.
         * Notifies the comment's author (not the post's), and never the
         * replier themselves.
         */
        const parent = (post.comments || []).find(c => c.id === commentId);
        if (parent && parent.authorId && parent.authorId !== currentUser.id) {
          try {
            await addDoc(collection(db, 'notifications'), {
              title: `${currentUser.name} u përgjigj komentit tuaj`,
              message: repText.slice(0, 200),
              channel: 'forum',
              category: 'forum_reply',
              type: 'info',
              priority: 'normal',
              audience: 'user',
              userId: parent.authorId,
              postId,
              commentId,
              actorId: currentUser.id,
              actorName: currentUser.name,
              state: 'published',
              link: '/forum',
              sender: currentUser.name,
              createdAt: serverTimestamp(),
            });
          } catch (notifError) {
            console.warn('Forum reply notification write failed:', notifError);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('A jeni të sigurt? Kjo fshin postimin përgjithmonë.')) return;
    try {
      if (!postId.startsWith('demo-')) {
        await deleteDoc(doc(db, 'forumPosts', postId));
      } else {
        setPosts(prev => prev.filter(p => p.id !== postId));
      }
      toast.success('Postimi u fshi!');
    } catch(e) {
      toast.error('Gabim gjatë fshirjes');
    }
  };

  const isAdsAdmin = currentUser?.role === 'adsadmin' || currentUser?.email === 'reklama@ks.com' || currentUser?.email === 'reklama@kosova.com';
  const isModerator = currentUser?.role === 'admin';

  // Unified displayPosts respecting tabs, filters, and algorithmic sorting
  const displayPosts = React.useMemo(() => {
    let result = posts.filter(p => {
      if (p.isHidden && !isModerator && !isAdsAdmin) return false;
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

    if (feedSortBy === 'trending') {
      result.sort((a, b) => engagementScore(b) - engagementScore(a));
    } else if (feedSortBy === 'hot') {
      const hotScore = (post: Post) => {
        const created = post.createdAt?.toMillis
          ? post.createdAt.toMillis()
          : Date.parse(post.createdAt || '') || 0;
        const ageHours = created > 0 ? Math.max(0, (Date.now() - created) / 3_600_000) : 0;
        const raw = (post.likes?.length || 0) * 2 + (post.comments?.length || 0) * 3 + (post.reposts?.length || 0) * 4;
        return raw / Math.pow(2, ageHours / 6);
      };
      result.sort((a, b) => hotScore(b) - hotScore(a));
    }

    return result;
  }, [posts, searchQuery, activeCategoryFilter, activeNeighborhoodFilter, feedTab, followedUserIds, userMunicipality, feedSortBy, isModerator, isAdsAdmin, engagementScore]);

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
                    Debati Publik
                  </div>
                  <h3 className="mt-4 text-3xl font-black leading-tight text-white">Vazhdoni me siguri</h3>
                </div>

                <div className="p-6">
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Për të komentuar, votuar dhe ndjekur diskutimet, mund të vazhdoni si mysafir ose të hyni në llogarinë tuaj.
                  </p>

                  <div className="mt-6 space-y-3">
                    <button
                      onClick={() => setShowAuthPrompt(false)}
                      className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      Vazhdoni si Mysafir
                    </button>
                    <button
                      onClick={() => navigate('/login')}
                      className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500"
                    >
                      Kyçu me llogari
                    </button>
                    <button
                      onClick={() => navigate('/register')}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Regjistrohu
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#121b2b]">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Kthehu te platforma</span>
            </button>

            <div className="flex min-w-0 items-center gap-2 text-slate-900 dark:text-white">
              <Radio className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
              <span className="truncate text-sm font-bold">Debati Publik</span>
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
                Posto
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6 lg:px-8">
          <AdBanner position="top" />
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
          <div className="hidden lg:flex w-64 shrink-0 flex-col gap-4">
             <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 overflow-hidden">
               <div className="flex items-center gap-3 p-4">
                 <img
                   src={currentUser?.avatar || 'https://ui-avatars.com/api/?name=U'}
                   className="h-12 w-12 shrink-0 rounded-full border border-slate-200 bg-white object-cover dark:border-zinc-700"
                   alt=""
                 />
                 <div className="min-w-0 flex-1">
                   <h3 className="truncate text-sm font-black text-slate-900 dark:text-white">
                     {currentUser?.name || dt('Përdorues i Paidentifikuar')}
                   </h3>
                   <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                     {currentUser?.role === 'guest' ? dt('Mysafir') : dt('Qytetar')}
                   </p>
                 </div>
               </div>
               {/* Only the post count is real; the influence figure was a literal 0. */}
               <button
                 type="button"
                 onClick={() => setActiveTab('profile')}
                 className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
               >
                 <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{dt('Postime')}</span>
                 <span className="text-sm font-black text-slate-900 dark:text-white">
                   {posts.filter(p => p.authorId === currentUser?.id).length}
                 </span>
               </button>
             </div>

             <div className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-white p-2 dark:border-zinc-800/80 dark:bg-zinc-900">
               {[
                 { id: 'feed', label: 'Rrjeti i Diskutimeve', icon: Home },
                 { id: 'profile', label: 'Profili Qytetar', icon: User },
               ].map(({ id, label, icon: Icon }) => (
                 <button
                   key={id}
                   type="button"
                   onClick={() => setActiveTab(id as typeof activeTab)}
                   aria-current={activeTab === id ? 'page' : undefined}
                   className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors ${
                     activeTab === id
                       ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                       : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-zinc-800/50'
                   }`}
                 >
                   <Icon className="h-4.5 w-4.5" />
                   {dt(label)}
                 </button>
               ))}
             </div>
          </div>

          {/* Center Main Feed */}
          <div className="flex-1 max-w-2xl w-full flex flex-col gap-6">

             {/* The citizen profile is the first mobile entry point. */}
             <button
               type="button"
               onClick={() => { setActiveTab('profile'); setActiveMobileNav('profile'); }}
               className="lg:hidden flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition hover:border-blue-300 dark:border-zinc-800 dark:bg-zinc-900"
             >
               <img
                 src={currentUser?.avatar || 'https://ui-avatars.com/api/?name=U'}
                 className="h-11 w-11 rounded-full object-cover ring-2 ring-blue-100 dark:ring-blue-500/20"
                 alt=""
               />
               <span className="min-w-0 flex-1">
                 <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Profili im</span>
                 <span className="block truncate text-sm font-black text-slate-900 dark:text-white">
                   {currentUser?.name || 'Qytetar'}
                 </span>
               </span>
               <ArrowUpRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
             </button>

             <ForumStories
               currentUser={currentUser}
               followedUserIds={followedUserIds}
               isActive={activeTab === 'feed'}
               onRequireAuth={() => setShowAuthPrompt(true)}
             />

             {activeTab === 'feed' && (
               <>
               <section aria-label="Debati publik" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Radio className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                    <div className="min-w-0">
                      <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">Debati Publik</h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                        {displayPosts.length} {displayPosts.length === 1 ? 'postim' : 'postime'} · renditur sipas angazhimit
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDMModalOpen(true)}
                    className="relative shrink-0 px-3.5 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Hap bisedat e mesazheve private"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline sm:inline">Mesazhet Private</span>
                    <span className="sm:hidden">Mesazhe</span>
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
                     placeholder="Kërko në debat, tema ose profile..."
                     aria-label="Kërko në debat publik"
                     className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:ring-blue-900/40"
                   />
                 </label>
                 <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="Filtroni sipas temës">
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

               {/* Composer wrapped in a professional card */}
               <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.18)] dark:border-zinc-800 dark:bg-zinc-900">
                <div className="border-b border-slate-200/60 bg-gradient-to-r from-sky-50 via-white to-indigo-50 p-4 dark:border-zinc-800 dark:from-sky-950/20 dark:via-zinc-900 dark:to-indigo-950/20">
                  <div className="flex items-start gap-3">
                    <img src={currentUser?.avatar || 'https://ui-avatars.com/api/?name=U'} className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-white dark:ring-zinc-900" alt="" />
                    <div className="flex-1">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Komuniteti Qytetar</div>
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
                          <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />

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
                            <span className="hidden sm:inline">Kërko Reklamë / IBAN</span>
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
                          disabled={isSubmitting || (!newPostContent.trim() && !newPostImage && !pollQuestion)}
                          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-black rounded-full transition-all shadow-md shadow-blue-600/20 active:scale-95"
                        >
                          {dt(`Posto`)}
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
                    {newPostImage && (
                      <div className="mt-3 relative rounded-[1rem] overflow-hidden bg-slate-100 dark:bg-zinc-950 border border-slate-200/60 dark:border-slate-200/60 dark:border-zinc-800 p-1">
                         <span className="text-xs text-emerald-400 px-2">{dt(`Media e zgjedhur:`)} {newPostImage.name}</span>
                         <button onClick={() => setNewPostImage(null)} className="absolute top-1 right-1 p-1 bg-[var(--color-secondary)]/50 rounded-full"><X className="w-4 h-4 text-[var(--color-text)] dark:text-white" /></button>
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
                      onClick={() => setFeedSortBy('recent')}
                      aria-pressed={feedSortBy === 'recent'}
                      className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${feedSortBy === 'recent' ? 'bg-white text-slate-900 shadow-xs dark:bg-zinc-700 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      {dt('Të Rejat')}
                    </button>
                    <button
                      onClick={() => setFeedSortBy('trending')}
                      aria-pressed={feedSortBy === 'trending'}
                      className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${feedSortBy === 'trending' ? 'bg-white text-blue-600 shadow-xs dark:bg-zinc-700 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      <TrendingUp className="w-3 h-3" />
                      {dt('Në Trend')}
                    </button>
                    <button
                      onClick={() => setFeedSortBy('hot')}
                      aria-pressed={feedSortBy === 'hot'}
                      className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${feedSortBy === 'hot' ? 'bg-white text-rose-500 shadow-xs dark:bg-zinc-700' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
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
                  <p className="text-xs text-slate-400 mt-1">Provo të ndryshosh kategorinë ose zgjidh një rubrikë tjetër.</p>
                </div>
              ) : displayPosts.map((post, postIndex) => (
                <React.Fragment key={post.id}>
                <div className="group rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_22px_-14px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-16px_rgba(15,23,42,0.24)] dark:border-zinc-800 dark:bg-zinc-900 border-l-4 border-l-blue-500/90">
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
                      </div>

                      {/* Content */}
                      <div className="text-[15px] text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed mb-3 break-words mt-1">
                        <PostFormatter content={post.content} />
                      </div>

                      {/* Media */}
                      {post.imageUrl && (
                        <div className="rounded-[1.25rem] overflow-hidden border border-slate-200 dark:border-zinc-800 mb-3 bg-slate-50 dark:bg-zinc-800/40">
                          <img src={post.imageUrl} className="w-full max-h-[500px] object-cover" alt="" />
                        </div>
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

                {/* Targeted in-feed campaign with a direct sponsor request action. */}
                {((postIndex + 1) % (systemSettings?.adFrequencyPosts || 4) === 0) && (
                  <AdBanner
                    position="feed"
                    municipality={isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : undefined}
                  />
                )}
                </React.Fragment>
              ))}
            </div>


               </>
             )}
             {activeTab === 'profile' && (
               <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none min-h-[60vh] overflow-hidden">
                 <ForumProfileTab
                   currentUser={currentUser}
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
                     setActiveMobileNav('post');
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

             {/* Dedicated Ad Placement in Forum Sidebar */}
             <AdBanner position="sidebar" />

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

             <div className="text-xs text-slate-400 dark:text-slate-500 flex flex-wrap gap-x-3 gap-y-2 px-2 mt-1">
               <a href="#" className="hover:underline transition-all">Privatësia</a>
               <a href="#" className="hover:underline transition-all">Kushtet</a>
               <a href="#" className="hover:underline transition-all">Reklamimi</a>
               <a href="#" className="hover:underline transition-all">Rreth Nesh</a>
               <a href="#" className="hover:underline transition-all">Aksesueshmëria</a>
               <span className="w-full mt-1">© 2026 Platforma Raporto</span>
             </div>
          </div>

        </div>
      </div>

      <nav
        aria-label="Navigimi i debatit publik"
        className="z-40 grid shrink-0 grid-cols-4 border-t border-slate-200 bg-white/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-18px_rgba(15,23,42,0.3)] backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-950/95 lg:hidden"
      >
        <button
          type="button"
          onClick={() => { setActiveMobileNav('debate'); setActiveTab('feed'); setFeedTab('forYou'); }}
          aria-current={activeMobileNav === 'debate' ? 'page' : undefined}
          className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition-colors ${activeMobileNav === 'debate' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
        >
          <Home className="h-5 w-5" aria-hidden="true" />
          Debati
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveMobileNav('search');
            setActiveTab('feed');
            window.setTimeout(() => {
              const search = document.getElementById('forum-search');
              search?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              search?.focus();
            }, 0);
          }}
          aria-current={activeMobileNav === 'search' ? 'page' : undefined}
          className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition-colors ${activeMobileNav === 'search' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
        >
          <Search className="h-5 w-5" aria-hidden="true" />
          Kërko
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveMobileNav('post');
            setActiveTab('feed');
            window.setTimeout(() => {
              textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              textareaRef.current?.focus();
            }, 0);
          }}
          aria-current={activeMobileNav === 'post' ? 'page' : undefined}
          className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition-colors ${activeMobileNav === 'post' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          Posto
        </button>
        <button
          type="button"
          onClick={() => { setActiveMobileNav('profile'); setActiveTab('profile'); }}
          aria-current={activeMobileNav === 'profile' ? 'page' : undefined}
          className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition-colors ${activeMobileNav === 'profile' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
        >
          <User className="h-5 w-5" aria-hidden="true" />
          Profili
        </button>
      </nav>

      <ForumProfileModal
        isOpen={profileModalData.isOpen}
        onClose={() => setProfileModalData({ ...profileModalData, isOpen: false })}
        authorId={profileModalData.authorId}
        authorName={profileModalData.authorName}
        authorAvatar={profileModalData.authorAvatar}
        posts={posts.filter(p => p.authorId === profileModalData.authorId)}
        followed={followedUserIds.includes(profileModalData.authorId)}
        onToggleFollow={handleToggleFollow}
        onOpenDM={handleOpenDM}
      />

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
                placeholder="Shto mendimin tënd mbi këtë postim..."
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
                  Anulo
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

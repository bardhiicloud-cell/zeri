import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useStore, DEMO_PUBLIC_POSTS } from '../lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { ForumProfileModal } from '../components/ForumProfileModal';
import { Send, Heart, MessageCircle, Share2, MoreHorizontal, ShieldCheck, Image as ImageIcon, MessageSquare, X, Home, User, Users, Check, TrendingUp, Sparkles, MapPin, BarChart3, Award, BadgeCheck, Flame, ArrowLeft, SlidersHorizontal, Radio, RefreshCw } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { db, uploadFileToStorage } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, limit, serverTimestamp, updateDoc, doc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { PostFormatter } from "../components/PostFormatter";
import ForumProfileTab from '../components/forum/ForumProfileTab';
import AdBanner from '../components/AdBanner';
import { AdRequestModal } from '../components/AdRequestModal';
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
    const [posts, setPosts] = useState([]);
    const [newPostContent, setNewPostContent] = useState('');
    const [newPostImage, setNewPostImage] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedNeighborhood, setSelectedNeighborhood] = useState('Të gjitha Komunat');
    // Active Filter States
    const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
    const userMunicipality = useStore(state => state.userMunicipality);
    const [activeNeighborhoodFilter, setActiveNeighborhoodFilter] = useState(userMunicipality || 'Të gjitha Komunat');
    // Algorithmic State with robust defaults
    const [currentTrends, setCurrentTrends] = useState(DEFAULT_TRENDS.slice(0, 3));
    const [currentProfiles, setCurrentProfiles] = useState(DEFAULT_OFFICIAL_PROFILES.slice(0, 3));
    const [allProfiles, setAllProfiles] = useState(DEFAULT_OFFICIAL_PROFILES);
    // Fetch official profiles from DB with fallback
    useEffect(() => {
        try {
            const q = query(collection(db, 'officialProfiles'));
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
        }
        catch (e) {
            console.warn('Error setting up officialProfiles listener:', e);
        }
    }, []);
    // Compute actual trends from `posts` state or fallback
    const computedTrends = React.useMemo(() => {
        if (!posts || posts.length === 0)
            return DEFAULT_TRENDS;
        // 1. Group posts by category/location
        const topics = {};
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
        if (sorted.length === 0)
            return DEFAULT_TRENDS;
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
    const [feedTab, setFeedTab] = useState('forYou');
    const [isAdRequestModalOpen, setIsAdRequestModalOpen] = useState(false);
    const [adModalPostId, setAdModalPostId] = useState(undefined);
    const [adModalPostContent, setAdModalPostContent] = useState(undefined);
    // Persistent real following state
    const [followedUserIds, setFollowedUserIds] = useState(() => {
        try {
            const saved = localStorage.getItem('followed_user_ids');
            return saved ? JSON.parse(saved) : ['off-1', 'off-2', 'off-3'];
        }
        catch (e) {
            return ['off-1', 'off-2', 'off-3'];
        }
    });
    const handleToggleFollow = (targetId, name) => {
        setFollowedUserIds(prev => {
            const isFollowing = prev.includes(targetId);
            const updated = isFollowing ? prev.filter(id => id !== targetId) : [...prev, targetId];
            try {
                localStorage.setItem('followed_user_ids', JSON.stringify(updated));
            }
            catch (e) { }
            if (isFollowing) {
                toast(`Ndalove ndjekjen e ${name || 'përdoruesit'}`, { icon: '👋' });
            }
            else {
                toast.success(`Tani po ndjek ${name || 'përdoruesin'}! Postimet do të shfaqen te 'Duke Ndjekur'`);
            }
            return updated;
        });
    };
    useEffect(() => {
        const trendsPool = computedTrends.length > 0 ? computedTrends : DEFAULT_TRENDS;
        const profilesPool = allProfiles.length > 0 ? allProfiles : DEFAULT_OFFICIAL_PROFILES;
        const interval = setInterval(() => {
            setCurrentTrends(() => {
                if (trendsPool.length <= 3)
                    return trendsPool;
                let shuffled = [...trendsPool].sort(() => 0.5 - Math.random());
                shuffled.sort((a, b) => a.rank - b.rank);
                return shuffled.slice(0, 3);
            });
            setCurrentProfiles(() => {
                if (profilesPool.length <= 3)
                    return profilesPool;
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
    // Compute Algorithmic Feed
    const sortedPosts = React.useMemo(() => {
        let sorted = [...posts];
        if (feedSortBy === 'trending') {
            // Sort by engagement (likes + comments)
            sorted.sort((a, b) => ((b.likes?.length || 0) + (b.comments?.length || 0)) - ((a.likes?.length || 0) + (a.comments?.length || 0)));
        }
        else if (feedSortBy === 'hot') {
            // Hot: favors recent high engagement
            sorted.sort((a, b) => {
                const scoreA = (a.likes?.length || 0) * 2 + (a.comments?.length || 0) * 3;
                const scoreB = (b.likes?.length || 0) * 2 + (b.comments?.length || 0) * 3;
                return scoreB - scoreA;
            });
        }
        else {
            // Recent (default by createdAt from Firebase)
            // Usually Firebase returns sorted, but just in case
        }
        return sorted;
    }, [posts, feedSortBy]);
    // Poll Creation State
    const [showPollCreator, setShowPollCreator] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['Po', 'Jo', 'Me Kushte']);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeCommentPost, setActiveCommentPost] = useState(null);
    const [newCommentContent, setNewCommentContent] = useState('');
    // Nested Reply State
    const [replyingCommentId, setReplyingCommentId] = useState(null);
    const [replyContent, setReplyContent] = useState('');
    // AI Summary Toggle State
    const [activeAiSummaryPost, setActiveAiSummaryPost] = useState(null);
    const [activeLegalModal, setLegalModalType] = useState(null);
    const [profileModalData, setProfileModalData] = useState({ isOpen: false, authorId: '', authorName: '', authorAvatar: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('feed');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAuthPrompt, setShowAuthPrompt] = useState(true);
    const shouldGateForum = !currentUser || currentUser.role === 'guest';
    // Ad state
    const [isAdPost, setIsAdPost] = useState(false);
    const [adLink, setAdLink] = useState('');
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const handleFileSelect = (e) => { if (e.target.files?.[0])
        setNewPostImage(e.target.files[0]); };
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
            const p = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            // Fallback demo posts if none exist
            if (p.length === 0) {
                setPosts(DEMO_PUBLIC_POSTS);
            }
            else {
                setPosts(p);
            }
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
    const getCitizenBadge = (post) => {
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
    const handleCreatePost = async (e) => {
        e.preventDefault();
        if (!currentUser || currentUser.role === 'guest') {
            setShowAuthPrompt(true);
            return;
        }
        if (!newPostContent.trim() && !newPostImage && !pollQuestion.trim())
            return;
        setIsSubmitting(true);
        let imageUrl = '';
        try {
            if (newPostImage) {
                const url = await uploadFileToStorage(newPostImage, 'reports', { scope: 'forum' });
                if (url)
                    imageUrl = url;
            }
            const isAdsAdmin = currentUser.role === 'adsadmin' || currentUser.email === 'reklama@ks.com' || currentUser.email === 'reklama@kosova.com';
            // Build Poll Object if created
            let pollData = null;
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
            if (textareaRef.current)
                textareaRef.current.style.height = 'auto';
            toast.success(dt('forum.postCreated') || 'Debati u publikua me sukses!');
        }
        catch (error) {
            console.error(error);
            toast.error('Gabim gjatë publikimit');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleVotePoll = async (postId, optionId) => {
        const voterId = currentUser?.id || 'qytetar-aktiv';
        try {
            const post = posts.find(p => p.id === postId);
            if (!post || !post.poll)
                return;
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
        }
        catch (e) {
            toast.error('Gabim gjatë votimit');
        }
    };
    const handleRepost = async (postId) => {
        const actorId = currentUser?.id || 'qytetar-aktiv';
        try {
            const post = posts.find(p => p.id === postId);
            if (!post)
                return;
            const currentReposts = post.reposts || [];
            const hasReposted = currentReposts.includes(actorId);
            const newReposts = hasReposted ? currentReposts.filter(id => id !== actorId) : [...currentReposts, actorId];
            // Instant optimistic state update
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, reposts: newReposts } : p));
            if (!postId.startsWith('demo-') && currentUser && currentUser.role !== 'guest') {
                updateDoc(doc(db, 'forumPosts', postId), { reposts: newReposts }).catch(console.error);
            }
            toast.success(hasReposted ? 'U hoq rishpërndarja' : 'U rishpërnda me sukses!');
        }
        catch (e) {
            console.error(e);
        }
    };
    const handleReaction = async (postId, reactionType) => {
        const actorId = currentUser?.id || 'qytetar-aktiv';
        try {
            const post = posts.find(p => p.id === postId);
            if (!post)
                return;
            if (reactionType === 'like') {
                const hasLiked = (post.likes || []).includes(actorId);
                const newLikes = hasLiked ? (post.likes || []).filter(id => id !== actorId) : [...(post.likes || []), actorId];
                // Instant optimistic state update
                setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: newLikes } : p));
                if (!postId.startsWith('demo-') && currentUser && currentUser.role !== 'guest') {
                    updateDoc(doc(db, 'forumPosts', postId), { likes: newLikes }).catch(console.error);
                }
            }
            else {
                const currentReactions = post.reactions || {};
                const typeReactions = currentReactions[reactionType] || [];
                const hasReacted = typeReactions.includes(actorId);
                const updatedReactions = { ...currentReactions };
                if (hasReacted) {
                    updatedReactions[reactionType] = typeReactions.filter(id => id !== actorId);
                }
                else {
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
        }
        catch (e) {
            console.error(e);
        }
    };
    const handleAddComment = async (postId) => {
        if (!currentUser || currentUser.role === 'guest') {
            setShowAuthPrompt(true);
            return;
        }
        if (!newCommentContent.trim())
            return;
        const commentText = newCommentContent;
        setNewCommentContent('');
        const newComment = {
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
            }
        }
        catch (error) {
            console.error(error);
        }
    };
    // Add Nested Reply to Comment
    const handleAddReply = async (postId, commentId) => {
        if (!currentUser || currentUser.role === 'guest') {
            setShowAuthPrompt(true);
            return;
        }
        if (!replyContent.trim())
            return;
        const repText = replyContent;
        setReplyContent('');
        setReplyingCommentId(null);
        const newReply = {
            id: Math.random().toString(36).substring(2, 9),
            authorId: currentUser.id,
            authorName: currentUser.name,
            authorAvatar: currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=0D8ABC&color=fff`,
            content: repText,
            createdAt: new Date().toISOString()
        };
        // Instant optimistic state update
        setPosts(prev => prev.map(p => {
            if (p.id !== postId)
                return p;
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
            }
        }
        catch (e) {
            console.error(e);
        }
    };
    const handleDeletePost = async (postId) => {
        if (!window.confirm('A jeni të sigurt? Kjo fshin postimin përgjithmonë.'))
            return;
        try {
            if (!postId.startsWith('demo-')) {
                await deleteDoc(doc(db, 'forumPosts', postId));
            }
            else {
                setPosts(prev => prev.filter(p => p.id !== postId));
            }
            toast.success('Postimi u fshi!');
        }
        catch (e) {
            toast.error('Gabim gjatë fshirjes');
        }
    };
    const isAdsAdmin = currentUser?.role === 'adsadmin' || currentUser?.email === 'reklama@ks.com' || currentUser?.email === 'reklama@kosova.com';
    const isModerator = currentUser?.role === 'admin';
    // Unified displayPosts respecting tabs, filters, and algorithmic sorting
    const communityPulse = React.useMemo(() => [
        { label: 'Debate aktive', value: posts.length.toString(), tone: 'blue', icon: MessageSquare },
        { label: 'Qytetarë aktivë', value: `${Math.max(120, posts.reduce((sum, post) => sum + (post.likes?.length || 0), 0))}`, tone: 'emerald', icon: Users },
        { label: 'Komuna të përfshira', value: `${new Set(posts.map(post => post.neighborhood).filter(Boolean)).size || 8}`, tone: 'amber', icon: MapPin },
        { label: 'Zyrtarë të verifikuar', value: `${allProfiles.length}`, tone: 'violet', icon: ShieldCheck }
    ], [posts, allProfiles]);
    const socialPhases = React.useMemo(() => [
        { label: 'Faza 01', title: 'Debati', accent: 'from-sky-500 to-blue-600', text: 'Diskutime të gjalla' },
        { label: 'Faza 02', title: 'Ndjekja', accent: 'from-violet-500 to-indigo-600', text: 'Profilet e interesuara' },
        { label: 'Faza 03', title: 'Sondazhet', accent: 'from-emerald-500 to-teal-600', text: 'Votime civike' },
        { label: 'Faza 04', title: 'Verifikimi', accent: 'from-amber-500 to-orange-500', text: 'Burime të besueshme' }
    ], []);
    const displayPosts = React.useMemo(() => {
        let result = posts.filter(p => {
            if (p.isHidden && !isModerator && !isAdsAdmin)
                return false;
            if (searchQuery) {
                const matchesSearch = p.content.toLowerCase().includes(searchQuery.toLowerCase()) || p.authorName.toLowerCase().includes(searchQuery.toLowerCase());
                if (!matchesSearch)
                    return false;
            }
            if (activeCategoryFilter !== 'all' && p.category !== activeCategoryFilter) {
                return false;
            }
            if (activeNeighborhoodFilter !== 'Të gjitha Komunat' && activeNeighborhoodFilter !== 'Gjithë Qyteti' && p.neighborhood && p.neighborhood !== activeNeighborhoodFilter && p.neighborhood !== 'Të gjitha Komunat' && p.neighborhood !== 'Gjithë Qyteti') {
                return false;
            }
            // X-Style Feed Tabs
            if (feedTab === 'following') {
                const isFollowed = followedUserIds.includes(p.authorId) || followedUserIds.includes(p.authorEmail || '') || p.authorRole === 'admin' || p.authorBadge === 'Zyrtar Komunal';
                if (!isFollowed)
                    return false;
            }
            else if (feedTab === 'polls') {
                if (!p.poll)
                    return false;
            }
            else if (feedTab === 'official') {
                if (p.authorRole !== 'admin' && p.authorBadge !== 'Zyrtar Komunal')
                    return false;
            }
            else if (feedTab === 'municipality') {
                const mun = userMunicipality || activeNeighborhoodFilter;
                if (mun && mun !== 'Të gjitha Komunat' && p.neighborhood && p.neighborhood !== mun) {
                    return false;
                }
            }
            return true;
        });
        if (feedSortBy === 'trending') {
            result.sort((a, b) => ((b.likes?.length || 0) + (b.comments?.length || 0) * 2) - ((a.likes?.length || 0) + (a.comments?.length || 0) * 2));
        }
        else if (feedSortBy === 'hot') {
            result.sort((a, b) => ((b.likes?.length || 0) * 2 + (b.comments?.length || 0) * 3) - ((a.likes?.length || 0) * 2 + (a.comments?.length || 0) * 3));
        }
        return result;
    }, [posts, searchQuery, activeCategoryFilter, activeNeighborhoodFilter, feedTab, followedUserIds, userMunicipality, feedSortBy, isModerator, isAdsAdmin]);
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
    _jsxs("div", { className: "h-[100dvh] w-full bg-[#f4f7fb] dark:bg-[#121212] font-sans overflow-hidden flex flex-col text-[var(--color-text)] dark:text-white relative transition-colors", children: [_jsxs("div", { className: "forum-scroll flex-1 w-full relative h-full overflow-y-auto overflow-x-hidden hide-scrollbar pt-24 pb-20 overscroll-contain", children: [_jsx(AnimatePresence, { children: showAuthPrompt && shouldGateForum && (_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, className: "fixed inset-0 z-[50] flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-[2px]", children: _jsxs(motion.div, { initial: { opacity: 0, y: 24, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 12, scale: 0.99 }, className: "w-full max-w-md overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/95 shadow-[0_22px_70px_-28px_rgba(15,23,42,0.38)] dark:border-white/10 dark:bg-slate-900/95", children: [_jsxs("div", { className: "bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 p-6 text-white", children: [_jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em]", children: [_jsx(ShieldCheck, { className: "h-3.5 w-3.5" }), "Debati Publik"] }), _jsx("h3", { className: "mt-4 text-3xl font-black leading-tight text-white", children: "Vazhdoni me siguri" })] }), _jsxs("div", { className: "p-6", children: [_jsx("p", { className: "text-sm leading-relaxed text-slate-600 dark:text-slate-300", children: "P\u00EBr t\u00EB komentuar, votuar dhe ndjekur diskutimet, mund t\u00EB vazhdoni si mysafir ose t\u00EB hyni n\u00EB llogarin\u00EB tuaj." }), _jsxs("div", { className: "mt-6 space-y-3", children: [_jsx("button", { onClick: () => setShowAuthPrompt(false), className: "w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200", children: "Vazhdoni si Mysafir" }), _jsx("button", { onClick: () => navigate('/login'), className: "w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500", children: "Ky\u00E7u me llogari" }), _jsx("button", { onClick: () => navigate('/register'), className: "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700", children: "Regjistrohu" })] })] })] }) })) }), _jsx("div", { className: "sticky top-0 z-40 w-full border-b border-slate-200/80 bg-slate-900/95 backdrop-blur-md shadow-sm transition-all dark:border-white/10 dark:bg-[#0B1320]/95", children: _jsxs("div", { className: "mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8", children: [_jsxs("button", { type: "button", onClick: () => navigate('/'), className: "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-200 transition hover:border-sky-400/40 hover:bg-white/10 hover:text-sky-300", children: [_jsx(ArrowLeft, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), _jsx("span", { className: "hidden sm:inline", children: "Kthehu" })] }), _jsxs("div", { className: "flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-sky-300", children: [_jsx(Radio, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), _jsx("span", { className: "hidden xs:inline sm:inline", children: "Debati Publik" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", className: "rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 hover:text-white", children: "Ndjek" }), _jsx("button", { type: "button", className: "rounded-full bg-blue-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-500", children: "Pjes\u00EBmarrja" })] })] }) }), _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full min-h-full flex gap-6 lg:gap-8 justify-center pt-5", children: [_jsxs("div", { className: "hidden lg:flex w-72 shrink-0 flex-col gap-5 sticky top-6 h-fit", children: [_jsxs("div", { className: "bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none overflow-hidden hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] transition-shadow", children: [_jsx("div", { className: "h-24 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 relative overflow-hidden", children: _jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.24),transparent_30%),linear-gradient(135deg,rgba(59,130,246,0.8),rgba(99,102,241,0.82),rgba(168,85,247,0.8))]" }) }), _jsxs("div", { className: "px-5 pb-5 pt-0 relative flex flex-col items-center", children: [_jsx("img", { src: currentUser?.avatar || 'https://ui-avatars.com/api/?name=U', className: "w-20 h-20 rounded-full border-4 border-white dark:border-zinc-900 -mt-10 bg-white shadow-sm z-10", alt: "" }), _jsx("div", { className: "mt-2 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300", children: currentUser?.role === 'guest' ? 'Mysafir' : 'Përdorues' }), _jsx("h3", { className: "font-black text-lg dark:text-white mt-2 title-serif", children: currentUser?.name || 'Përdorues i Paidentifikuar' }), _jsx("p", { className: "text-[13px] text-slate-500 font-medium mb-2", children: currentUser?.id ? `ID: ${currentUser.id}` : 'Nuk ka të dhëna' }), _jsx("p", { className: "text-[12px] text-slate-500 font-medium mb-4", children: currentUser?.email || 'Pjesëmarrja ruhet në këtë pajisje' }), _jsxs("div", { className: "flex w-full gap-2 text-center divide-x divide-slate-100 dark:divide-zinc-800/50 border-t border-slate-100 dark:border-zinc-800/50 pt-4", children: [_jsxs("div", { className: "flex-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-lg py-1 transition-colors", onClick: () => setActiveTab('profile'), children: [_jsx("p", { className: "text-xl font-black text-slate-800 dark:text-white", children: posts.filter(p => p.authorId === currentUser?.id).length }), _jsx("p", { className: "text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-0.5", children: dt('Postime') })] }), _jsxs("div", { className: "flex-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-lg py-1 transition-colors", children: [_jsx("p", { className: "text-xl font-black text-slate-800 dark:text-white", children: "0" }), _jsx("p", { className: "text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-0.5", children: dt('Ndikimi') })] })] })] })] }), _jsxs("div", { className: "bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none p-3 flex flex-col gap-1.5", children: [_jsxs("button", { onClick: () => setActiveTab('feed'), className: `flex items-center gap-3.5 px-4 py-3.5 rounded-xl font-bold transition-all ${activeTab === 'feed' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800/50'}`, children: [_jsx(Home, { className: `w-5 h-5 ${activeTab === 'feed' ? 'fill-blue-600/20' : ''}` }), " ", dt('Rrjeti i Diskutimeve')] }), _jsxs("button", { onClick: () => setActiveTab('profile'), className: `flex items-center gap-3.5 px-4 py-3.5 rounded-xl font-bold transition-all ${activeTab === 'profile' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800/50'}`, children: [_jsx(User, { className: `w-5 h-5 ${activeTab === 'profile' ? 'fill-blue-600/20' : ''}` }), " ", dt('Profili Qytetar')] }), _jsxs("button", { className: "flex items-center gap-3.5 px-4 py-3.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-all", children: [_jsx(Flame, { className: "w-5 h-5" }), " ", dt('Top Trendet')] })] })] }), _jsxs("div", { className: "flex-1 max-w-2xl w-full flex flex-col gap-6", children: [_jsxs("div", { className: "lg:hidden flex bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 p-1 mb-2 shadow-sm", children: [_jsx("button", { onClick: () => setActiveTab('feed'), className: `flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'feed' ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`, children: dt('Debati') }), _jsx("button", { onClick: () => setActiveTab('profile'), className: `flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'profile' ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`, children: dt('Profili') })] }), activeTab === 'feed' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "rounded-[30px] border border-slate-200/80 bg-gradient-to-br from-white via-sky-50 to-indigo-50 p-5 text-slate-900 shadow-[0_18px_50px_-22px_rgba(59,130,246,0.22)] dark:border-white/10 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950 dark:text-white", children: _jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-end md:justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300", children: [_jsx(Radio, { className: "h-3.5 w-3.5" }), "Debati Publik"] }), _jsx("h2", { className: "mt-3 text-3xl font-black leading-tight text-slate-900 dark:text-white md:text-4xl", children: "Pjes\u00EBmarrja qytetare, n\u00EB nj\u00EB platform\u00EB t\u00EB qart\u00EB dhe profesionale" })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: ['Rrugët', 'Mjedisi', 'Shëndeti', 'Arsimi'].map((tag) => (_jsx("span", { className: "rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-200", children: tag }, tag))) })] }) }), _jsx("div", { className: "grid grid-cols-2 xl:grid-cols-4 gap-3", children: communityPulse.map((item) => {
                                                    const Icon = item.icon;
                                                    return (_jsxs("div", { className: "rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900", children: [_jsx("div", { className: cn('inline-flex rounded-xl p-2', item.tone === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300', item.tone === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', item.tone === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300', 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300'), children: _jsx(Icon, { className: "w-4 h-4" }) }), _jsx("div", { className: "mt-3 text-2xl font-black text-slate-900 dark:text-white", children: item.value }), _jsx("div", { className: "mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400", children: item.label })] }, item.label));
                                                }) }), _jsxs("div", { className: "grid gap-3 lg:grid-cols-[1.2fr_0.8fr]", children: [_jsxs("div", { className: "overflow-hidden rounded-[26px] border border-slate-200/80 bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 p-4 text-white shadow-[0_18px_35px_-18px_rgba(37,99,235,0.55)] dark:border-white/10", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-100", children: [_jsx(MapPin, { className: "h-3.5 w-3.5" }), "Infrastruktur\u00EB"] }), _jsx("span", { className: "text-[10px] font-bold uppercase tracking-[0.18em] text-sky-100/80", children: "Prishtin\u00EB" })] }), _jsx("h3", { className: "mt-4 text-2xl font-black leading-tight", children: "Rrug\u00EBt e qytetit" }), _jsx("p", { className: "mt-2 max-w-md text-sm text-sky-50/90", children: "P\u00EBrmir\u00EBsimet e rrug\u00EBve dhe qasja ndaj sh\u00EBrbimeve publike kan\u00EB prioritet t\u00EB par\u00EB p\u00EBr qytetar\u00EBt n\u00EB zonat kryesore urbane." }), _jsxs("div", { className: "mt-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.15em] text-sky-100/80", children: [_jsx("span", { children: "Gjall\u00EBri publike" }), _jsx("span", { className: "h-1 w-1 rounded-full bg-sky-200/80" }), _jsx("span", { children: "Kosov\u00EB" })] })] }), _jsxs("div", { className: "grid gap-3", children: [_jsxs("div", { className: "rounded-[24px] border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm dark:border-emerald-700/20 dark:from-emerald-950/20 dark:to-slate-900", children: [_jsx("div", { className: "text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300", children: "Mjedisi" }), _jsx("h4", { className: "mt-2 text-xl font-black text-slate-900 dark:text-white", children: "Mjedisi dhe parqet" }), _jsx("p", { className: "mt-1 text-sm text-slate-600 dark:text-slate-300", children: "Sektori social \u2022 Qendra" })] }), _jsxs("div", { className: "rounded-[24px] border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm dark:border-amber-700/20 dark:from-amber-950/20 dark:to-slate-900", children: [_jsx("div", { className: "text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300", children: "Sh\u00EBndeti" }), _jsx("h4", { className: "mt-2 text-xl font-black text-slate-900 dark:text-white", children: "Sh\u00EBndeti dhe publiku" }), _jsx("p", { className: "mt-1 text-sm text-slate-600 dark:text-slate-300", children: "Sh\u00EBrbimet duhet t\u00EB ndahen n\u00EB m\u00EBnyr\u00EB m\u00EB t\u00EB qart\u00EB p\u00EBr t\u00EB mbajtur fokusin strategjik n\u00EB zonat viktima." })] })] })] }), _jsx("div", { className: "mt-4 rounded-[24px] border border-slate-200/80 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900", children: _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300", children: _jsx(TrendingUp, { className: "h-4 w-4" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400", children: "N\u00EB fokus" }), _jsx("div", { className: "text-sm font-black text-slate-900 dark:text-white", children: "Rrug\u00EBt \u2022 Mjedisi \u2022 Sh\u00EBndeti \u2022 Arsimi" })] })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: ['Live', 'Publike', 'Qytetarët', 'Prioritet'].map((pill) => (_jsx("span", { className: "rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-300", children: pill }, pill))) })] }) }), _jsx("div", { className: "overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.18)] dark:border-zinc-800 dark:bg-zinc-900", children: _jsx("div", { className: "border-b border-slate-200/60 bg-gradient-to-r from-sky-50 via-white to-indigo-50 p-4 dark:border-zinc-800 dark:from-sky-950/20 dark:via-zinc-900 dark:to-indigo-950/20", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("img", { src: currentUser?.avatar || 'https://ui-avatars.com/api/?name=U', className: "w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-white dark:ring-zinc-900", alt: "" }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between gap-2", children: [_jsx("div", { className: "text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400", children: "Komuniteti Qytetar" }), _jsxs("div", { className: "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300", children: [_jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-emerald-500" }), "Live"] })] }), _jsx("textarea", { ref: textareaRef, value: newPostContent, onChange: (e) => setNewPostContent(e.target.value), placeholder: dt(`Çfarë po ndodh?`), className: "w-full bg-transparent border-none text-[var(--color-text)] dark:text-white resize-none focus:ring-0 p-0 placeholder:text-[var(--color-text-muted)] dark:placeholder:text-[var(--color-text-muted)] text-lg sm:text-xl mt-1 mb-2 outline-none", rows: newPostContent ? 3 : 1 }), _jsxs("div", { className: "flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-zinc-800", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => fileInputRef.current?.click(), className: "p-2 text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors", children: _jsx(ImageIcon, { className: "w-5 h-5" }) }), _jsx("input", { type: "file", accept: "image/*,video/*", className: "hidden", ref: fileInputRef, onChange: handleFileSelect }), _jsx("button", { onClick: () => setShowPollCreator(!showPollCreator), className: "p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full transition-colors", title: "Krijo Sondazh", children: _jsx(SlidersHorizontal, { className: "w-5 h-5" }) }), _jsxs("button", { type: "button", onClick: () => {
                                                                                            setAdModalPostId(undefined);
                                                                                            setAdModalPostContent(undefined);
                                                                                            setIsAdRequestModalOpen(true);
                                                                                        }, className: "px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold rounded-full transition-all flex items-center gap-1.5", title: "K\u00EBrko reklamim me pages\u00EB bankare (IBAN)", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5 text-amber-500" }), _jsx("span", { className: "hidden sm:inline", children: "K\u00EBrko Reklam\u00EB / IBAN" })] })] }), _jsx("button", { onClick: handleCreatePost, disabled: isSubmitting || (!newPostContent.trim() && !newPostImage && !pollQuestion), className: "px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-black rounded-full transition-all shadow-md shadow-blue-600/20 active:scale-95", children: dt(`Posto`) })] }), showPollCreator && (_jsxs("div", { className: "mt-3 pt-3 border-t border-slate-200/60 dark:border-zinc-800 space-y-2", children: [_jsx("input", { type: "text", placeholder: dt(`Bëj një pyetje...`), className: "w-full bg-slate-50 dark:bg-zinc-800/80 border border-slate-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none", value: pollQuestion || '', onChange: e => setPollQuestion(e.target.value) }), (pollOptions || ['', '']).map((opt, i) => (_jsx("input", { type: "text", placeholder: `Opsioni ${i + 1}`, className: "w-full bg-slate-50 dark:bg-zinc-800/80 border border-slate-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none", value: opt, onChange: e => { const newOpts = [...pollOptions]; newOpts[i] = e.target.value; setPollOptions(newOpts); } }, i)))] })), newPostImage && (_jsxs("div", { className: "mt-3 relative rounded-[1rem] overflow-hidden bg-slate-100 dark:bg-zinc-950 border border-slate-200/60 dark:border-slate-200/60 dark:border-zinc-800 p-1", children: [_jsxs("span", { className: "text-xs text-emerald-400 px-2", children: [dt(`Media e zgjedhur:`), " ", newPostImage.name] }), _jsx("button", { onClick: () => setNewPostImage(null), className: "absolute top-1 right-1 p-1 bg-[var(--color-secondary)]/50 rounded-full", children: _jsx(X, { className: "w-4 h-4 text-[var(--color-text)] dark:text-white" }) })] }))] })] }) }) }), _jsxs("div", { className: "mb-4 rounded-[22px] border border-slate-200/80 bg-white p-2 shadow-[0_8px_26px_-18px_rgba(15,23,42,0.22)] dark:border-zinc-800 dark:bg-zinc-900", children: [_jsxs("div", { className: "flex flex-col gap-2 border-b border-slate-100 pb-2 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between", children: [_jsx("div", { className: "flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5", children: [
                                                                    { id: 'forYou', label: 'Për Ty', icon: Sparkles },
                                                                    { id: 'following', label: 'Duke Ndjekur', icon: Users },
                                                                    { id: 'municipality', label: userMunicipality ? `📍 ${userMunicipality}` : 'Komuna Ime', icon: MapPin },
                                                                    { id: 'polls', label: 'Sondazhe', icon: BarChart3 },
                                                                    { id: 'official', label: 'Zyrtare', icon: ShieldCheck }
                                                                ].map(tab => {
                                                                    const Icon = tab.icon;
                                                                    const isActive = feedTab === tab.id;
                                                                    return (_jsxs("button", { onClick: () => setFeedTab(tab.id), className: `shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 ${isActive
                                                                            ? 'bg-blue-600 text-white shadow-xs'
                                                                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-800'}`, children: [_jsx(Icon, { className: "w-3.5 h-3.5" }), _jsx("span", { children: tab.label })] }, tab.id));
                                                                }) }), _jsxs("div", { className: "flex items-center gap-1 self-end rounded-xl bg-slate-100 p-1 dark:bg-zinc-800/80 sm:self-auto", children: [_jsx("button", { onClick: () => setFeedSortBy('recent'), className: `rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${feedSortBy === 'recent' ? 'bg-white text-slate-900 shadow-xs dark:bg-zinc-700 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`, children: dt('Të Rejat') }), _jsxs("button", { onClick: () => setFeedSortBy('trending'), className: `flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${feedSortBy === 'trending' ? 'bg-white text-blue-600 shadow-xs dark:bg-zinc-700 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`, children: [_jsx(TrendingUp, { className: "w-3 h-3" }), dt('Në Trend')] }), _jsxs("button", { onClick: () => setFeedSortBy('hot'), className: `flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${feedSortBy === 'hot' ? 'bg-white text-rose-500 shadow-xs dark:bg-zinc-700' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`, children: [_jsx(Flame, { className: "w-3 h-3" }), dt('Hot')] })] })] }), feedTab === 'following' && followedUserIds.length === 0 && (_jsxs("div", { className: "p-3 text-center text-xs text-slate-500", children: ["Ende nuk keni ndjekur asnj\u00EB p\u00EBrdorues. Klikoni butonin ", _jsx("span", { className: "font-bold text-slate-800 dark:text-slate-200", children: "\"Ndjek\"" }), " te postimet ose profilet zyrtare p\u00EBr t'i par\u00EB k\u00EBtu!"] }))] }), _jsx("div", { className: "space-y-4", children: isLoading ? (Array.from({ length: 5 }).map((_, i) => (_jsxs("div", { className: "border-b border-slate-200/60 dark:border-slate-200/60 dark:border-zinc-800/80 p-4 animate-pulse flex gap-3", children: [_jsx("div", { className: "w-10 h-10 rounded-full bg-zinc-800 shrink-0" }), _jsxs("div", { className: "flex-1 space-y-3", children: [_jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("div", { className: "h-4 w-32 bg-zinc-800 rounded" }), _jsx("div", { className: "h-3 w-16 bg-zinc-800/50 rounded" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "h-3 w-full bg-zinc-800 rounded" }), _jsx("div", { className: "h-3 w-5/6 bg-zinc-800 rounded" }), _jsx("div", { className: "h-3 w-4/6 bg-zinc-800 rounded" })] }), _jsx("div", { className: "h-32 w-full bg-zinc-800/50 rounded-[1rem] mt-3" }), _jsxs("div", { className: "flex gap-6 mt-4", children: [_jsx("div", { className: "h-4 w-12 bg-zinc-800 rounded" }), _jsx("div", { className: "h-4 w-12 bg-zinc-800 rounded" }), _jsx("div", { className: "h-4 w-12 bg-zinc-800 rounded" })] })] })] }, i)))) : posts.length === 0 ? (_jsx("div", { className: "p-8 text-center text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] dark:text-zinc-500", children: dt(`Nuk u gjetën postime.`) })) : displayPosts.length === 0 ? (_jsxs("div", { className: "p-8 text-center text-slate-500 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800", children: [_jsx("p", { className: "font-bold text-sm text-slate-700 dark:text-slate-300", children: dt(`Nuk u gjetën postime për këtë filtër.`) }), _jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Provo t\u00EB ndryshosh kategorin\u00EB ose zgjidh nj\u00EB rubrik\u00EB tjet\u00EBr." })] })) : displayPosts.map((post, postIndex) => (_jsxs(React.Fragment, { children: [_jsxs("div", { className: "group rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_22px_-14px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-16px_rgba(15,23,42,0.24)] dark:border-zinc-800 dark:bg-zinc-900 border-l-4 border-l-blue-500/90", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between gap-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300", children: post.category || 'Debati' }), _jsx("span", { className: "rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 dark:bg-zinc-800 dark:text-slate-300", children: post.neighborhood || 'Qyteti' })] }), _jsx("span", { className: "text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500", children: new Date(post.createdAt).toLocaleDateString('sq-AL', { month: 'short', day: 'numeric' }) })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("img", { alt: "", src: post.authorAvatar, className: "w-10 h-10 rounded-full object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity", onClick: () => setProfileModalData({ isOpen: true, authorId: post.authorId, authorName: post.authorName, authorAvatar: post.authorAvatar }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-[15px] mb-0.5 flex-wrap", children: [_jsx("span", { className: "font-bold text-slate-900 dark:text-white hover:underline cursor-pointer truncate max-w-[150px] sm:max-w-[200px] text-[15px]", onClick: () => setProfileModalData({ isOpen: true, authorId: post.authorId, authorName: post.authorName, authorAvatar: post.authorAvatar }), children: post.authorName }), (post.authorBadge === 'Zyrtar Komunal' || post.authorRole === 'admin') && (_jsx("span", { title: "Zyrtar i Verifikuar", children: _jsx(BadgeCheck, { className: "w-4 h-4 text-blue-500 shrink-0" }) })), _jsxs("span", { className: "text-slate-400 dark:text-slate-500 truncate text-xs", children: ["@", (post.authorName || 'user').replace(/\s+/g, '').toLowerCase()] }), post.authorId !== currentUser?.id && (_jsx("button", { type: "button", onClick: (e) => {
                                                                                                e.stopPropagation();
                                                                                                handleToggleFollow(post.authorId, post.authorName);
                                                                                            }, className: `ml-auto px-3 py-1 rounded-full text-xs font-bold transition-all ${followedUserIds.includes(post.authorId)
                                                                                                ? 'bg-transparent border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:text-rose-500 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                                                                                : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-blue-600 dark:hover:bg-blue-500 dark:hover:text-white shadow-xs'}`, children: followedUserIds.includes(post.authorId) ? 'Duke ndjekur' : 'Ndjek' }))] }), _jsx("div", { className: "text-[15px] text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed mb-3 break-words mt-1", children: _jsx(PostFormatter, { content: post.content }) }), post.imageUrl && (_jsx("div", { className: "rounded-[1.25rem] overflow-hidden border border-slate-200 dark:border-zinc-800 mb-3 bg-slate-50 dark:bg-zinc-800/40", children: _jsx("img", { src: post.imageUrl, className: "w-full max-h-[500px] object-cover", alt: "" }) })), post.poll && (_jsxs("div", { className: "border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 mb-4 bg-slate-50 dark:bg-zinc-800/40 shadow-xs", children: [_jsx("span", { className: "font-bold text-sm mb-3 block text-slate-900 dark:text-white", children: dt(post.poll.question) }), _jsx("div", { className: "space-y-2", children: (post.poll.options || []).map((opt, i) => {
                                                                                                const voterId = currentUser?.id || 'qytetar-aktiv';
                                                                                                const hasVoted = (opt.votes || []).includes(voterId);
                                                                                                const totalVotes = post.poll?.totalVotes || 1;
                                                                                                const percentage = Math.round(((opt.votes?.length || 0) / totalVotes) * 100) || 0;
                                                                                                return (_jsxs("button", { onClick: () => handleVotePoll(post.id, opt.id), className: `w-full ${hasVoted
                                                                                                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-600 dark:text-blue-400 font-black'
                                                                                                        : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-slate-200 hover:border-blue-400 font-bold'} border rounded-xl py-2.5 px-4 text-xs transition-all text-left flex justify-between relative overflow-hidden`, children: [_jsx("div", { className: "absolute left-0 top-0 bottom-0 bg-blue-100/70 dark:bg-blue-500/20 transition-all duration-300", style: { width: `${percentage}%` } }), _jsxs("span", { className: "relative z-10 flex items-center gap-1.5", children: [hasVoted && _jsx(Check, { className: "w-3.5 h-3.5 text-blue-600 dark:text-blue-400" }), dt(opt.text)] }), _jsxs("span", { className: "relative z-10 font-mono font-bold", children: [percentage, "%"] })] }, i));
                                                                                            }) }), _jsxs("span", { className: "text-[11px] text-slate-500 block mt-2.5", children: [post.poll.totalVotes || 0, " ", dt('vota gjithsej')] })] })), _jsxs("div", { className: "flex items-center justify-between text-slate-500 dark:text-slate-400 max-w-md pr-4 mt-3 border-t border-slate-100 dark:border-zinc-800 pt-3", children: [_jsxs("button", { onClick: () => setActiveCommentPost(activeCommentPost === post.id ? null : post.id), className: `flex items-center gap-2 text-[13px] group transition-colors ${activeCommentPost === post.id ? 'text-blue-600' : 'hover:text-blue-600'}`, children: [_jsx("div", { className: `p-2 rounded-full transition-colors ${activeCommentPost === post.id ? 'bg-blue-50 dark:bg-blue-500/10' : 'group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10'}`, children: _jsx(MessageCircle, { className: `w-4 h-4 ${activeCommentPost === post.id ? 'fill-blue-600/20 text-blue-600' : ''}` }) }), _jsx("span", { className: "font-bold", children: post.comments?.length || 0 })] }), _jsxs("button", { onClick: () => handleRepost(post.id), className: `flex items-center gap-2 text-[13px] group transition-colors ${(post.reposts || []).includes(currentUser?.id || 'qytetar-aktiv') ? 'text-emerald-600' : 'hover:text-emerald-600'}`, children: [_jsx("div", { className: `p-2 rounded-full transition-colors ${(post.reposts || []).includes(currentUser?.id || 'qytetar-aktiv') ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'group-hover:bg-emerald-50 dark:group-hover:bg-emerald-500/10'}`, children: _jsx(RefreshCw, { className: `w-4 h-4 ${(post.reposts || []).includes(currentUser?.id || 'qytetar-aktiv') ? 'text-emerald-600' : ''}` }) }), _jsx("span", { className: "font-bold", children: (post.reposts || []).length })] }), _jsxs("button", { onClick: () => handleReaction(post.id, 'like'), className: `flex items-center gap-2 text-[13px] group transition-colors ${(post.likes || []).includes(currentUser?.id || 'qytetar-aktiv') ? 'text-rose-500' : 'hover:text-rose-500'}`, children: [_jsx("div", { className: `p-2 rounded-full transition-colors ${(post.likes || []).includes(currentUser?.id || 'qytetar-aktiv') ? 'bg-rose-50 dark:bg-rose-500/10' : 'group-hover:bg-rose-50 dark:group-hover:bg-rose-500/10'}`, children: _jsx(Heart, { className: `w-4 h-4 ${(post.likes || []).includes(currentUser?.id || 'qytetar-aktiv') ? 'fill-rose-500 text-rose-500' : ''}` }) }), _jsx("span", { className: `font-bold ${(post.likes || []).includes(currentUser?.id || 'qytetar-aktiv') ? 'text-rose-500' : 'group-hover:text-rose-500'}`, children: (post.likes || []).length })] }), _jsx("button", { onClick: () => {
                                                                                                if (navigator.share) {
                                                                                                    navigator.share({
                                                                                                        title: `Postimi nga ${post.authorName}`,
                                                                                                        text: (post.content || '').substring(0, 100) + '...',
                                                                                                        url: window.location.href,
                                                                                                    }).catch(() => { });
                                                                                                }
                                                                                                else {
                                                                                                    navigator.clipboard.writeText(window.location.href);
                                                                                                    toast.success('Linku u kopjua në clipboard!');
                                                                                                }
                                                                                            }, className: "flex items-center gap-2 text-[13px] hover:text-blue-500 group transition-colors", title: "Shp\u00EBrndaj", children: _jsx("div", { className: "p-2 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 transition-colors", children: _jsx(Share2, { className: "w-4 h-4" }) }) }), _jsxs("button", { type: "button", onClick: () => {
                                                                                                setAdModalPostId(post.id);
                                                                                                setAdModalPostContent(post.content);
                                                                                                setIsAdRequestModalOpen(true);
                                                                                            }, className: "flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 px-2 py-1 rounded-full hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors font-bold", title: "Promovo k\u00EBt\u00EB postim me pages\u00EB bankare", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5" }), _jsx("span", { className: "hidden sm:inline", children: "Promovo" })] })] }), _jsx(AnimatePresence, { children: activeCommentPost === post.id && (_jsx(motion.div, { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 }, className: "overflow-hidden", children: _jsxs("div", { className: "mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800", children: [_jsxs("div", { className: "space-y-3 mb-4", children: [(post.comments || []).length === 0 && (_jsx("p", { className: "text-slate-400 text-xs italic text-center py-3", children: dt(`Nuk ka ende komente. Bëhu i pari!`) })), (post.comments || []).map((comment) => (_jsxs("div", { className: "flex gap-2.5", children: [_jsx("img", { src: comment.authorAvatar || 'https://ui-avatars.com/api/?name=U', className: "w-8 h-8 rounded-full object-cover shrink-0 mt-0.5", alt: "" }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "bg-slate-100 dark:bg-zinc-800/80 rounded-2xl px-4 py-2.5 border border-slate-200 dark:border-zinc-700", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 mb-0.5", children: [_jsx("span", { className: "font-bold text-xs text-slate-900 dark:text-white", children: (comment.authorName || 'user') }), _jsx("span", { className: "text-[10px] text-slate-400", children: new Date(comment.createdAt).toLocaleDateString('sq-AL') })] }), _jsx("p", { className: "text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap", children: comment.content })] }), _jsx("div", { className: "flex items-center gap-3 mt-1 px-2 text-[11px] font-bold text-slate-500", children: _jsx("button", { className: "hover:text-blue-600 transition-colors", onClick: () => setReplyingCommentId(replyingCommentId === comment.id ? null : comment.id), children: dt(`Përgjigju`) }) }), comment.replies && comment.replies.length > 0 && (_jsx("div", { className: "mt-2.5 space-y-2 pl-3 border-l-2 border-slate-200 dark:border-zinc-700", children: (comment.replies || []).map((reply) => (_jsxs("div", { className: "flex gap-2", children: [_jsx("img", { src: reply.authorAvatar || 'https://ui-avatars.com/api/?name=U', className: "w-6 h-6 rounded-full object-cover shrink-0 mt-0.5", alt: "" }), _jsxs("div", { className: "flex-1 bg-slate-50 dark:bg-zinc-800/50 rounded-xl px-3 py-2 border border-slate-200 dark:border-zinc-700/60", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 mb-0.5", children: [_jsx("span", { className: "font-bold text-[11px] text-slate-900 dark:text-white", children: (reply.authorName || 'user') }), _jsx("span", { className: "text-[9px] text-slate-400", children: new Date(reply.createdAt).toLocaleDateString('sq-AL') })] }), _jsx("p", { className: "text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap", children: reply.content })] })] }, reply.id))) })), replyingCommentId === comment.id && (_jsxs("div", { className: "mt-2.5 flex gap-2 pl-2 border-l-2 border-blue-500", children: [_jsx("img", { src: currentUser?.avatar || 'https://ui-avatars.com/api/?name=U', className: "w-6 h-6 rounded-full object-cover shrink-0", alt: "" }), _jsxs("div", { className: "flex-1 flex bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-full overflow-hidden focus-within:border-blue-500 transition-colors", children: [_jsx("input", { type: "text", value: replyContent, onChange: (e) => setReplyContent(e.target.value), placeholder: `Përgjigju ${(comment.authorName || 'user')}...`, className: "flex-1 bg-transparent text-xs text-slate-900 dark:text-white px-3.5 py-1.5 focus:outline-none", onKeyDown: (e) => {
                                                                                                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                                                                                                    e.preventDefault();
                                                                                                                                                    handleAddReply(post.id, comment.id);
                                                                                                                                                }
                                                                                                                                            } }), _jsx("button", { onClick: () => handleAddReply(post.id, comment.id), disabled: !replyContent.trim(), className: "px-3 text-blue-600 hover:text-blue-700 disabled:opacity-40 transition-colors font-bold text-xs", children: _jsx(Send, { className: "w-3.5 h-3.5" }) })] })] }))] })] }, comment.id)))] }), _jsxs("div", { className: "flex items-start gap-2.5 mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800", children: [_jsx("img", { src: currentUser?.avatar || 'https://ui-avatars.com/api/?name=U', className: "w-8 h-8 rounded-full object-cover shrink-0 mt-1", alt: "" }), _jsxs("div", { className: "flex-1 flex flex-col relative", children: [_jsx("textarea", { value: newCommentContent, onChange: e => setNewCommentContent(e.target.value), placeholder: dt(`Posto komentin tuaj publik...`), className: "w-full bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-2xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none resize-none min-h-[44px]", rows: newCommentContent ? 2 : 1 }), _jsx("div", { className: "flex justify-end items-center mt-2", children: _jsx("button", { onClick: () => handleAddComment(post.id), disabled: !newCommentContent.trim() || isSubmitting, className: "px-5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-full transition-all shadow-xs", children: dt(`Përgjigju`) }) })] })] })] }) })) })] })] })] }), ((postIndex + 1) % (systemSettings?.adFrequencyPosts || 4) === 0) && (_jsxs("div", { className: "bg-gradient-to-r from-blue-50/80 to-amber-50/60 dark:from-zinc-900 dark:to-zinc-900 rounded-2xl border border-blue-200/80 dark:border-zinc-800 p-5 shadow-xs transition-all", children: [_jsxs("div", { className: "flex items-center justify-between mb-2 text-xs", children: [_jsxs("span", { className: "flex items-center gap-1.5 font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5" }), "Reklam\u00EB e Sponsorizuar"] }), _jsx("button", { onClick: () => {
                                                                                setAdModalPostId(undefined);
                                                                                setAdModalPostContent(undefined);
                                                                                setIsAdRequestModalOpen(true);
                                                                            }, className: "text-[11px] font-bold text-slate-500 hover:text-blue-600 underline", children: "Reklamo me IBAN" })] }), systemSettings?.adSenseEnabled && systemSettings?.adSenseSlot ? (_jsx("div", { className: "text-center py-4 bg-white dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/50", children: _jsxs("p", { className: "text-xs text-slate-400 font-mono", children: ["Google AdSense Partner \u2022 Slot #", systemSettings.adSenseSlot] }) })) : (_jsxs("div", { className: "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "font-bold text-sm text-slate-900 dark:text-white", children: "Promovo biznesin ose sh\u00EBrbimin t\u00EBnd n\u00EB platform\u00EB" }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-0.5", children: "Arrij mij\u00EBra qytetar\u00EB n\u00EB t\u00EB gjitha komunat me pages\u00EB t\u00EB drejtp\u00EBrdrejt\u00EB bankare." })] }), _jsx("button", { type: "button", onClick: () => {
                                                                                setAdModalPostId(undefined);
                                                                                setAdModalPostContent(undefined);
                                                                                setIsAdRequestModalOpen(true);
                                                                            }, className: "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shrink-0 shadow-xs", children: "K\u00EBrko Reklam\u00EB" })] }))] }))] }, post.id))) })] })), activeTab === 'profile' && (_jsx("div", { className: "bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none min-h-[60vh] overflow-hidden", children: _jsx(ForumProfileTab, { currentUser: currentUser, setActiveTab: setActiveTab }) }))] }), _jsxs("div", { className: "hidden xl:flex w-80 shrink-0 flex-col gap-5 sticky top-6 h-fit", children: [_jsxs("div", { className: "bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none p-5", children: [_jsxs("h3", { className: "font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2 title-serif text-lg", children: [_jsx(TrendingUp, { className: "w-5 h-5 text-blue-500" }), " ", dt('Në Qendër Të Vëmendjes')] }), _jsx("div", { className: "space-y-5 relative min-h-[200px]", children: _jsx(AnimatePresence, { mode: "popLayout", children: currentTrends.map((trend, i) => (_jsx(motion.div, { layout: true, initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, x: -10 }, transition: { duration: 0.4 }, className: "cursor-pointer group flex gap-3", children: _jsxs("div", { className: "flex-1", children: [_jsxs("p", { className: "text-[13px] text-slate-500 flex justify-between items-center w-full", children: [_jsxs("span", { children: [trend.rank, " \u00B7 ", trend.category, " \u00B7 ", trend.location] }), _jsx(MoreHorizontal, { className: "w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100" })] }), _jsx("p", { className: "text-[15px] font-bold text-slate-900 dark:text-white mt-0.5 group-hover:text-blue-500 transition-colors", children: trend.title }), _jsx("p", { className: "text-[13px] text-slate-500 mt-0.5", children: trend.discussions })] }) }, trend.id))) }) })] }), _jsx(AdBanner, { position: "sidebar" }), _jsxs("div", { className: "bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none p-5", children: [_jsxs("h3", { className: "font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2 title-serif text-lg", children: [_jsx(Users, { className: "w-5 h-5 text-indigo-500" }), " ", dt('Profilet Zyrtare')] }), _jsx("div", { className: "space-y-5 relative min-h-[140px]", children: _jsx(AnimatePresence, { mode: "popLayout", children: currentProfiles.map(profile => (_jsxs(motion.div, { layout: true, initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -20 }, transition: { duration: 0.5, type: 'spring' }, className: "flex items-center gap-3 cursor-pointer group", children: [_jsx("div", { className: `w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${profile.color}`, children: profile.initials }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("p", { className: "font-bold text-[15px] text-slate-900 dark:text-white truncate group-hover:underline", children: profile.name }), profile.verified && _jsx(BadgeCheck, { className: "w-4 h-4 text-blue-500 shrink-0" })] }), _jsx("p", { className: "text-[13px] text-slate-500 truncate", children: profile.handle })] }), _jsx("button", { onClick: () => handleToggleFollow(profile.id, profile.name), className: `px-4 py-1.5 text-xs font-bold rounded-full transition-all shrink-0 ${followedUserIds.includes(profile.id)
                                                                    ? 'bg-transparent border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:text-rose-500 hover:border-rose-300'
                                                                    : 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 shadow-xs'}`, children: followedUserIds.includes(profile.id) ? 'Duke ndjekur' : 'Ndjek' })] }, profile.id))) }) }), _jsx("button", { className: "w-full mt-5 py-2.5 text-sm font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-colors", children: dt('Shfaq Më Shumë') })] }), _jsxs("div", { className: "text-xs text-slate-400 dark:text-slate-500 flex flex-wrap gap-x-3 gap-y-2 px-2 mt-1", children: [_jsx("a", { href: "#", className: "hover:underline transition-all", children: "Privat\u00EBsia" }), _jsx("a", { href: "#", className: "hover:underline transition-all", children: "Kushtet" }), _jsx("a", { href: "#", className: "hover:underline transition-all", children: "Reklamimi" }), _jsx("a", { href: "#", className: "hover:underline transition-all", children: "Rreth Nesh" }), _jsx("a", { href: "#", className: "hover:underline transition-all", children: "Aksesueshm\u00EBria" }), _jsx("span", { className: "w-full mt-1", children: "\u00A9 2026 Platforma Raporto" })] })] })] })] }), _jsx(ForumProfileModal, { isOpen: profileModalData.isOpen, onClose: () => setProfileModalData({ ...profileModalData, isOpen: false }), authorId: profileModalData.authorId, authorName: profileModalData.authorName, authorAvatar: profileModalData.authorAvatar, posts: posts.filter(p => p.authorId === profileModalData.authorId) }), _jsx(AdRequestModal, { isOpen: isAdRequestModalOpen, onClose: () => setIsAdRequestModalOpen(false), initialPostId: adModalPostId, initialPostContent: adModalPostContent })] }));
}

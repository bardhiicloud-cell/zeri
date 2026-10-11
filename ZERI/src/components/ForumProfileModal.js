import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User as UserIcon, MessageSquare, Megaphone, ShieldCheck, UserPlus, UserCheck, Radio, Share2, Award, MapPin, Heart, Eye, Sparkles } from 'lucide-react';
import { addDoc, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../lib/store';
import toast from 'react-hot-toast';
export function ForumProfileModal({ isOpen, onClose, authorName, authorId, authorAvatar, posts = [] }) {
    const currentUser = useStore(state => state.currentUser);
    const systemSettings = useStore(state => state.systemSettings);
    const showReels = systemSettings?.showReels ?? true;
    const [activeTab, setActiveTab] = useState('debates');
    const [isFollowing, setIsFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(142);
    const [userReels, setUserReels] = useState([]);
    const [loadingReels, setLoadingReels] = useState(false);
    // Fetch author's reels from Firestore when modal opens
    useEffect(() => {
        if (!isOpen || !authorId)
            return;
        const fetchAuthorReels = async () => {
            setLoadingReels(true);
            try {
                const q = query(collection(db, 'forum_reels'), where('authorId', '==', authorId));
                const snap = await getDocs(q);
                const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setUserReels(list);
            }
            catch (err) {
                console.error('Error fetching author reels:', err);
            }
            finally {
                setLoadingReels(false);
            }
        };
        fetchAuthorReels();
    }, [isOpen, authorId]);
    const stats = useMemo(() => {
        const userPosts = (posts || []).filter(p => p.authorId === authorId || p.author === authorName);
        const postCount = userPosts.length;
        const totalPostLikes = userPosts.reduce((acc, p) => acc + (p.likes?.length || 0), 0);
        const totalReelLikes = userReels.reduce((acc, r) => acc + (r.likes?.length || 0), 0);
        const totalViews = userReels.reduce((acc, r) => acc + (r.views || 0), 0);
        return { postCount, reelCount: userReels.length, totalLikes: totalPostLikes + totalReelLikes, totalViews, userPosts };
    }, [posts, authorId, authorName, userReels]);
    if (!isOpen)
        return null;
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
        }
        catch (err) {
            console.error(err);
            toast.error("Pati një problem gjatë dërgimit të kërkesës.");
        }
    };
    const toggleFollow = () => {
        if (isFollowing) {
            setIsFollowing(false);
            setFollowerCount(prev => prev - 1);
            toast('Sapo e hiqët këtë profil nga ndjekja');
        }
        else {
            setIsFollowing(true);
            setFollowerCount(prev => prev + 1);
            toast.success(`Tani po ndiqni ${authorName}!`);
        }
    };
    const shareProfile = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(window.location.href);
            toast.success('Linku i profilit u kopjua ne clipboard!');
        }
    };
    return (_jsx(AnimatePresence, { children: isOpen && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md", children: _jsxs(motion.div, { initial: { opacity: 0, scale: 0.92, y: 15 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.92, y: 15 }, className: "bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden text-white relative max-h-[90vh] flex flex-col", children: [_jsxs("div", { className: "relative h-32 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 shrink-0", children: [_jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" }), _jsxs("div", { className: "absolute top-3 right-3 flex items-center gap-2 z-10", children: [_jsx("button", { onClick: shareProfile, className: "p-2 bg-black/30 hover:bg-black/50 text-white rounded-full backdrop-blur-md border border-white/20 transition-all cursor-pointer", title: dt(`Shpërndaj profilin`), children: _jsx(Share2, { className: "w-4 h-4" }) }), _jsx("button", { onClick: onClose, className: "p-2 bg-black/30 hover:bg-black/50 text-white rounded-full backdrop-blur-md border border-white/20 transition-all cursor-pointer", children: _jsx(X, { className: "w-4 h-4" }) })] }), _jsxs("div", { className: "absolute top-3 left-4 flex items-center gap-1.5 px-3 py-1 bg-black/30 backdrop-blur-md rounded-full border border-white/20 text-[10px] font-black text-amber-300", children: [_jsx(Sparkles, { className: "w-3 h-3 text-amber-400 animate-pulse" }), dt(`Profil Zyrtar I Verifikuar`)] })] }), _jsxs("div", { className: "px-6 pb-4 pt-0 relative shrink-0", children: [_jsxs("div", { className: "flex justify-between items-end -mt-12 mb-3", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: "w-24 h-24 rounded-[2rem] p-1 bg-gradient-to-tr from-blue-500 via-indigo-500 to-pink-500 shadow-2xl", children: _jsx("img", { src: authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=3b82f6&color=fff`, alt: authorName, className: "w-full h-full rounded-[1.25rem] object-cover bg-slate-800" }) }), _jsx("div", { className: "absolute -bottom-1 -right-1 p-1 bg-blue-600 text-white rounded-full border-2 border-slate-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none", children: _jsx(ShieldCheck, { className: "w-4 h-4" }) })] }), _jsx("div", { className: "flex gap-2", children: _jsx("button", { onClick: toggleFollow, className: `px-5 py-2.5 rounded-2xl font-black text-xs transition-all shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] flex items-center gap-1.5 cursor-pointer ${isFollowing
                                                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/30'}`, children: isFollowing ? _jsxs(_Fragment, { children: [_jsx(UserCheck, { className: "w-4 h-4 text-emerald-400" }), dt(`Ndiqet`)] }) : _jsxs(_Fragment, { children: [_jsx(UserPlus, { className: "w-4 h-4" }), dt(`Ndiq Profilin`)] }) }) })] }), _jsxs("div", { children: [_jsxs("h2", { className: "text-xl font-extrabold text-white flex items-center gap-2", children: [authorName, _jsx(ShieldCheck, { className: "w-4 h-4 text-blue-400" })] }), _jsxs("div", { className: "flex items-center gap-3 text-xs text-slate-400 mt-1 font-medium", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(MapPin, { className: "w-3.5 h-3.5 text-rose-400" }), dt(`Kosovë`)] }), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Award, { className: "w-3.5 h-3.5 text-amber-400" }), dt(`Gazetar Qytetar`)] })] })] }), _jsxs("div", { className: "grid grid-cols-4 gap-2 my-4 p-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-center", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-black text-white", children: followerCount }), _jsx("div", { className: "text-[10px] font-bold text-slate-400", children: dt(`Ndjekës`) })] }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-black text-rose-400", children: stats.reelCount }), _jsx("div", { className: "text-[10px] font-bold text-slate-400", children: dt(`Reels`) })] }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-black text-blue-400", children: stats.postCount }), _jsx("div", { className: "text-[10px] font-bold text-slate-400", children: dt(`Debate`) })] }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-black text-emerald-400", children: stats.totalLikes }), _jsx("div", { className: "text-[10px] font-bold text-slate-400", children: dt(`Pëlqime`) })] })] }), _jsxs("div", { className: "flex border-b border-slate-800 font-extrabold text-xs", children: [_jsxs("button", { onClick: () => setActiveTab('reels'), className: `flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${activeTab === 'reels' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`, children: [_jsx(Radio, { className: "w-3.5 h-3.5" }), dt(`Reels (`), stats.reelCount, ")"] }), _jsxs("button", { onClick: () => setActiveTab('debates'), className: `flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${activeTab === 'debates' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`, children: [_jsx(MessageSquare, { className: "w-3.5 h-3.5" }), dt(`Debatet (`), stats.postCount, ")"] }), _jsxs("button", { onClick: () => setActiveTab('bio'), className: `flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${activeTab === 'bio' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`, children: [_jsx(UserIcon, { className: "w-3.5 h-3.5" }), dt(`Rreth Meje`)] })] })] }), _jsxs("div", { className: "px-6 pb-6 overflow-y-auto flex-1 min-h-[180px] space-y-3", children: [activeTab === 'reels' && (_jsx("div", { children: loadingReels ? (_jsx("div", { className: "py-8 text-center text-xs text-slate-500 dark:text-slate-400 font-bold", children: dt(`Po ngarkohen videot reels...`) })) : userReels.length === 0 ? (_jsx("div", { className: "py-8 text-center text-slate-500 dark:text-slate-400 text-xs font-bold bg-slate-950/50 rounded-2xl border border-slate-800", children: dt(`Ky përdorues nuk ka publikuar ende asnjë video Reel.`) })) : (_jsx("div", { className: "grid grid-cols-3 gap-2", children: userReels.map((reel) => (_jsxs("div", { className: "group relative aspect-[9/16] rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none", children: [reel.videoUrl ? (_jsx("video", { src: reel.videoUrl, className: "w-full h-full object-cover" })) : (_jsx("img", { src: reel.imageUrl || reel.thumbnail || authorAvatar, alt: "", className: "w-full h-full object-cover" })), _jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 text-white", children: _jsxs("div", { className: "flex items-center justify-between text-[10px] font-black", children: [_jsxs("span", { className: "flex items-center gap-0.5 text-rose-400", children: [_jsx(Heart, { className: "w-2.5 h-2.5 fill-current" }), " ", reel.likes?.length || 0] }), _jsxs("span", { className: "flex items-center gap-0.5 text-slate-300", children: [_jsx(Eye, { className: "w-2.5 h-2.5" }), " ", reel.views || 1] })] }) })] }, reel.id))) })) })), activeTab === 'debates' && (_jsx("div", { className: "space-y-2", children: stats.userPosts.length === 0 ? (_jsx("div", { className: "py-8 text-center text-slate-500 dark:text-slate-400 text-xs font-bold bg-slate-950/50 rounded-2xl border border-slate-800", children: dt(`Nuk ka debate publike të hapura nga ky anëtar.`) })) : (stats.userPosts.map((post) => (_jsxs("div", { className: "p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1", children: [_jsxs("div", { className: "flex items-center justify-between text-[10px] font-bold text-slate-400", children: [_jsxs("span", { className: "text-blue-400", children: ["#", post.category || 'Debat'] }), _jsx("span", { children: post.timestamp ? new Date(post.timestamp).toLocaleDateString('sq-AL') : 'Sot' })] }), _jsx("p", { className: "text-xs font-semibold text-slate-200 line-clamp-2", children: post.content })] }, post.id)))) })), activeTab === 'bio' && (_jsxs("div", { className: "p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3 text-xs leading-relaxed text-slate-300", children: [_jsx("p", { className: "font-medium", children: dt(`🇦🇱 Qytetar aktiv i Kosovës i përkushtuar për ngritjen e zërit publik, rregullimin e hapësirave publike dhe promovimin e kulturës dixhitale lokale.`) }), _jsxs("div", { className: "pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px]", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-slate-500 dark:text-slate-400", children: dt(`I bashkuar:`) }), " ", _jsx("span", { className: "font-bold text-slate-200", children: dt(`Qershor 2024`) })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-slate-500 dark:text-slate-400", children: dt(`Ndërveprimi Publik:`) }), " ", _jsx("span", { className: "font-bold text-emerald-400", children: dt(`Super Aktiv`) })] })] })] })), _jsxs("button", { onClick: handleAdvertiseRequest, className: "w-full mt-2 py-3 bg-gradient-to-r from-indigo-900/60 to-purple-900/60 hover:from-indigo-900 hover:to-purple-900 text-indigo-200 font-extrabold rounded-2xl transition-all border border-indigo-700/50 flex items-center justify-center gap-2 text-xs cursor-pointer shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none", children: [_jsx(Megaphone, { className: "w-4 h-4 text-indigo-400" }), dt(`Reklamo apo Sponzorizo me këtë Krijues`)] })] })] }) })) }));
}

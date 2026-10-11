import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { db } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ThumbsUp, MessageSquare, Send, Trash2, User, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sq } from 'date-fns/locale';
import { cn } from '../lib/utils';
export default function SocialFeed() {
    const currentUser = useStore(state => state.currentUser);
    const [posts, setPosts] = useState([]);
    const [newPostContent, setNewPostContent] = useState('');
    const [loading, setLoading] = useState(false);
    // Comments mapping
    const [comments, setComments] = useState({});
    const [newCommentContent, setNewCommentContent] = useState({});
    const [expandedComments, setExpandedComments] = useState({});
    useEffect(() => {
        const q = query(collection(db, 'socialPosts'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPosts(postsData);
            // Load comments for each post
            postsData.forEach(post => {
                const cq = query(collection(db, `socialPosts/${post.id}/comments`), orderBy('createdAt', 'asc'));
                onSnapshot(cq, (cSnapshot) => {
                    setComments(prev => ({
                        ...prev,
                        [post.id]: cSnapshot.docs.map(cdoc => ({ id: cdoc.id, ...cdoc.data() }))
                    }));
                });
            });
        });
        return () => unsubscribe();
    }, []);
    const handleCreatePost = async (e) => {
        e.preventDefault();
        if (!currentUser || !newPostContent.trim())
            return;
        setLoading(true);
        try {
            await addDoc(collection(db, 'socialPosts'), {
                authorId: currentUser.id,
                authorName: currentUser.name,
                authorAvatar: currentUser.avatar || '',
                content: newPostContent.trim(),
                likes: [],
                createdAt: serverTimestamp()
            });
            setNewPostContent('');
        }
        catch (error) {
            console.error("Error creating post:", error);
            alert("Nuk mund të publikohej postimi. Sigurohuni që jeni i verifikuar.");
        }
        finally {
            setLoading(false);
        }
    };
    const handleLikePost = async (postId, currentLikes) => {
        if (!currentUser)
            return;
        const postRef = doc(db, 'socialPosts', postId);
        try {
            let newLikes = [...(currentLikes || [])];
            if (newLikes.includes(currentUser.id)) {
                newLikes = newLikes.filter(id => id !== currentUser.id);
            }
            else {
                newLikes.push(currentUser.id);
            }
            await updateDoc(postRef, { likes: newLikes });
        }
        catch (error) {
            console.error("Error toggling like:", error);
        }
    };
    const handleDeletePost = async (postId) => {
        if (!window.confirm("A jeni të sigurt që doni të fshini këtë postim?"))
            return;
        try {
            await deleteDoc(doc(db, 'socialPosts', postId));
        }
        catch (error) {
            console.error("Error deleting post:", error);
        }
    };
    const handleCreateComment = async (postId, e) => {
        e.preventDefault();
        const content = newCommentContent[postId];
        if (!currentUser || !content?.trim())
            return;
        try {
            await addDoc(collection(db, `socialPosts/${postId}/comments`), {
                authorId: currentUser.id,
                authorName: currentUser.name,
                authorAvatar: currentUser.avatar || '',
                content: content.trim(),
                createdAt: serverTimestamp()
            });
            setNewCommentContent(prev => ({ ...prev, [postId]: '' }));
        }
        catch (error) {
            console.error("Error creating comment:", error);
            alert("Nuk mund të publikohej komenti. Sigurohuni që jeni i verifikuar.");
        }
    };
    const handleDeleteComment = async (postId, commentId) => {
        if (!window.confirm("A jeni të sigurt që doni të fshini këtë koment?"))
            return;
        try {
            await deleteDoc(doc(db, `socialPosts/${postId}/comments`, commentId));
        }
        catch (error) {
            console.error("Error deleting comment:", error);
        }
    };
    return (_jsxs("div", { className: "w-full space-y-6", children: [_jsxs("div", { className: "flex items-center gap-3 mb-6 border-b-2 border-slate-900 pb-2", children: [_jsx(MessageSquare, { className: "w-6 h-6 text-blue-600" }), _jsx("h2", { className: "text-2xl font-bold title-serif uppercase text-slate-900 dark:text-white", children: dt(`Diskutimet e Qytetarëve`) })] }), currentUser ? (_jsx("form", { onSubmit: handleCreatePost, className: "bg-white dark:bg-slate-900 p-4 md:p-6 rounded-xl border-2 border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none mb-8", children: _jsxs("div", { className: "flex gap-4", children: [_jsx("div", { className: "w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center shrink-0 border border-slate-300", children: currentUser.avatar ? (_jsx("img", { src: currentUser.avatar, alt: "Avatar", className: "w-full h-full rounded-full object-cover" })) : (_jsx(User, { className: "w-5 h-5 text-slate-400" })) }), _jsxs("div", { className: "flex-1 space-y-3", children: [_jsx("textarea", { value: newPostContent, onChange: e => setNewPostContent(e.target.value), placeholder: `Çfarë keni në mendje rreth këtyre sondazheve, ${currentUser.name}?`, className: "w-full min-h-[100px] p-3 bg-neutral-50 border border-slate-200/60 rounded-xl resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400" }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { type: "submit", disabled: loading || !newPostContent.trim(), className: "px-6 py-2 bg-blue-600 text-white font-bold rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm", children: loading ? _jsx("span", { className: "animate-pulse", children: dt(`Duke publikuar...`) }) : _jsxs(_Fragment, { children: [_jsx(Send, { className: "w-4 h-4" }), dt(`Publiko`)] }) }) })] })] }) })) : (_jsx("div", { className: "bg-blue-50 border border-blue-200 rounded-xl p-4 text-center mb-8", children: _jsx("p", { className: "text-blue-800 font-medium", children: dt(`Duhet të identifikoheni për të marrë pjesë në diskutim.`) }) })), _jsx("div", { className: "space-y-6", children: posts.map(post => {
                    const postComments = comments[post.id] || [];
                    const likesCount = post.likes?.length || 0;
                    const isLiked = currentUser ? post.likes?.includes(currentUser.id) : false;
                    const isExpanded = expandedComments[post.id];
                    return (_jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl shadow-sm dark:shadow-none overflow-hidden", children: [_jsxs("div", { className: "p-4 md:p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center shrink-0 border border-slate-300", children: post.authorAvatar ? (_jsx("img", { src: post.authorAvatar, alt: "Avatar", className: "w-full h-full rounded-full object-cover" })) : (_jsx(User, { className: "w-5 h-5 text-slate-400" })) }), _jsxs("div", { children: [_jsx("p", { className: "font-bold text-slate-900 dark:text-white", children: post.authorName }), _jsxs("p", { className: "text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1", children: [_jsx(Clock, { className: "w-3 h-3" }), post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { locale: sq, addSuffix: true }) : 'Tani'] })] })] }), currentUser && (currentUser.id === post.authorId || currentUser.role === 'admin') && (_jsx("button", { onClick: () => handleDeletePost(post.id), className: "text-slate-400 hover:text-rose-600 transition-colors p-2 rounded-full hover:bg-rose-50", children: _jsx(Trash2, { className: "w-4 h-4" }) }))] }), _jsx("p", { className: "text-slate-800 dark:text-slate-200 dark:text-slate-200 whitespace-pre-wrap", children: post.content })] }), _jsxs("div", { className: "px-4 md:px-6 py-3 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800 flex items-center gap-6", children: [_jsxs("button", { onClick: () => handleLikePost(post.id, post.likes), className: cn("flex items-center gap-2 text-sm font-bold transition-colors", isLiked ? "text-blue-600" : "text-slate-500 dark:text-slate-400 hover:text-blue-600"), children: [_jsx(ThumbsUp, { className: cn("w-4 h-4", isLiked && "fill-current") }), likesCount, " ", likesCount === 1 ? 'Pëlqim' : 'Pëlqime'] }), _jsxs("button", { onClick: () => setExpandedComments(prev => ({ ...prev, [post.id]: !prev[post.id] })), className: "flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-colors", children: [_jsx(MessageSquare, { className: "w-4 h-4" }), postComments.length, " ", postComments.length === 1 ? 'Koment' : 'Komente'] })] }), isExpanded && (_jsxs("div", { className: "bg-slate-50 dark:bg-slate-800 px-4 md:px-6 py-4 border-t border-slate-200/60 dark:border-white/10", children: [_jsx("div", { className: "space-y-4 mb-4", children: postComments.map(comment => (_jsxs("div", { className: "flex gap-3", children: [_jsx("div", { className: "w-8 h-8 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none mt-1", children: comment.authorAvatar ? (_jsx("img", { src: comment.authorAvatar, alt: "Avatar", className: "w-full h-full rounded-full object-cover" })) : (_jsx(User, { className: "w-4 h-4 text-slate-400" })) }), _jsxs("div", { className: "flex-1 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none relative group", children: [_jsxs("div", { className: "flex justify-between items-start mb-1", children: [_jsx("p", { className: "text-sm font-bold text-slate-900 dark:text-white", children: comment.authorName }), _jsx("p", { className: "text-[10px] text-slate-400", children: comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { locale: sq }) : 'Tani' })] }), _jsx("p", { className: "text-sm text-slate-700 dark:text-slate-300", children: comment.content }), currentUser && (currentUser.id === comment.authorId || currentUser.role === 'admin') && (_jsx("button", { onClick: () => handleDeleteComment(post.id, comment.id), className: "absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-opacity p-1 bg-white dark:bg-slate-900 rounded-full shadow-sm dark:shadow-none border border-slate-100 dark:border-white/5", children: _jsx(Trash2, { className: "w-3 h-3" }) }))] })] }, comment.id))) }), currentUser && (_jsxs("form", { onSubmit: (e) => handleCreateComment(post.id, e), className: "flex gap-3", children: [_jsx("input", { type: "text", value: newCommentContent[post.id] || '', onChange: e => setNewCommentContent(prev => ({ ...prev, [post.id]: e.target.value })), placeholder: dt(`Shkruaj një koment...`), className: "flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-full text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" }), _jsx("button", { type: "submit", disabled: !newCommentContent[post.id]?.trim(), className: "w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:bg-blue-700 transition-colors disabled:opacity-50", children: _jsx(Send, { className: "w-4 h-4 ml-0.5" }) })] }))] }))] }, post.id));
                }) })] }));
}

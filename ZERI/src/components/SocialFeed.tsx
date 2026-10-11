import { dt } from '@/src/lib/dt';
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { db } from '../lib/firebase';
import { PUBLIC_LIMITS, CONTENT_LIMITS } from '../lib/loadLimits';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp, limit } from 'firebase/firestore';
import { ThumbsUp, MessageSquare, Send, Trash2, User, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sq } from 'date-fns/locale';
import { cn } from '../lib/utils';

export default function SocialFeed() {
  const currentUser = useStore(state => state.currentUser);
  const [posts, setPosts] = useState<any[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [loading, setLoading] = useState(false);

  // Comments mapping
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [newCommentContent, setNewCommentContent] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    /*
     * Bounded reads. At national scale this collection grows without limit, so
     * the feed loads only the newest page (PUBLIC_LIMITS.socialFeed) instead of
     * downloading every post ever written on every mount.
     */
    const q = query(collection(db, 'socialPosts'), orderBy('createdAt', 'desc'), limit(CONTENT_LIMITS.socialFeed));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(postsData);
    });
    return unsubscribe;
  }, []);

  /*
   * Comments are loaded on demand, one bounded query per opened post, instead
   * of the earlier behaviour: an unconditional onSnapshot per post, which meant
   * N posts opened N live subscriptions and charged N full-collection reads on
   * every page view even if the citizen never opened a single comment thread.
   */
  useEffect(() => {
    for (const postId of Object.keys(expandedComments)) {
      if (!expandedComments[postId] || comments[postId]) continue;
      const cq = query(collection(db, `socialPosts/${postId}/comments`), orderBy('createdAt', 'asc'), limit(CONTENT_LIMITS.socialComments));
      const unsub = onSnapshot(cq, (cSnapshot) => {
        setComments(prev => ({
          ...prev,
          [postId]: cSnapshot.docs.map(cdoc => ({ id: cdoc.id, ...cdoc.data() }))
        }));
      });
      commentUnsubsRef.current.set(postId, unsub);
    }
  }, [expandedComments]);

  const commentUnsubsRef = useRef<Map<string, () => void>>(new Map());
  useEffect(() => () => {
    commentUnsubsRef.current.forEach(unsub => unsub());
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newPostContent.trim()) return;
    
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
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Nuk mund të publikohej postimi. Sigurohuni që jeni i verifikuar.");
    } finally {
      setLoading(false);
    }
  };

  const handleLikePost = async (postId: string, currentLikes: string[]) => {
    if (!currentUser) return;
    const postRef = doc(db, 'socialPosts', postId);
    try {
      let newLikes = [...(currentLikes || [])];
      if (newLikes.includes(currentUser.id)) {
        newLikes = newLikes.filter(id => id !== currentUser.id);
      } else {
        newLikes.push(currentUser.id);
      }
      await updateDoc(postRef, { likes: newLikes });
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("A jeni të sigurt që doni të fshini këtë postim?")) return;
    try {
      await deleteDoc(doc(db, 'socialPosts', postId));
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const handleCreateComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    const content = newCommentContent[postId];
    if (!currentUser || !content?.trim()) return;
    
    try {
      await addDoc(collection(db, `socialPosts/${postId}/comments`), {
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar || '',
        content: content.trim(),
        createdAt: serverTimestamp()
      });
      setNewCommentContent(prev => ({ ...prev, [postId]: '' }));
    } catch (error) {
      console.error("Error creating comment:", error);
      alert("Nuk mund të publikohej komenti. Sigurohuni që jeni i verifikuar.");
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!window.confirm("A jeni të sigurt që doni të fshini këtë koment?")) return;
    try {
      await deleteDoc(doc(db, `socialPosts/${postId}/comments`, commentId));
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3 mb-6 border-b-2 border-slate-900 pb-2">
        <MessageSquare className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold title-serif uppercase text-slate-900 dark:text-white">{dt(`Diskutimet e Qytetarëve`)}</h2>
      </div>

      {currentUser ? (
        <form onSubmit={handleCreatePost} className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-xl border-2 border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none mb-8">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center shrink-0 border border-slate-300">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <div className="flex-1 space-y-3">
              <textarea
                value={newPostContent}
                onChange={e => setNewPostContent(e.target.value)}
                placeholder={`Çfarë keni në mendje rreth këtyre sondazheve, ${currentUser.name}?`}
                className="w-full min-h-[100px] p-3 bg-neutral-50 border border-slate-200/60 rounded-xl resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading || !newPostContent.trim()}
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
                >
                  {loading ? <span className="animate-pulse">{dt(`Duke publikuar...`)}</span> : <><Send className="w-4 h-4" />{dt(`Publiko`)}</>}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center mb-8">
          <p className="text-blue-800 font-medium">{dt(`Duhet të identifikoheni për të marrë pjesë në diskutim.`)}</p>
        </div>
      )}

      <div className="space-y-6">
        {posts.map(post => {
          const postComments = comments[post.id] || [];
          const likesCount = post.likes?.length || 0;
          const isLiked = currentUser ? post.likes?.includes(currentUser.id) : false;
          const isExpanded = expandedComments[post.id];

          return (
            <div key={post.id} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl shadow-sm dark:shadow-none overflow-hidden">
              <div className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center shrink-0 border border-slate-300">
                      {post.authorAvatar ? (
                        <img src={post.authorAvatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{post.authorName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { locale: sq, addSuffix: true }) : 'Tani'}
                      </p>
                    </div>
                  </div>
                  {currentUser && (currentUser.id === post.authorId || currentUser.role === 'admin') && (
                    <button 
                      onClick={() => handleDeletePost(post.id)}
                      className="text-slate-400 hover:text-rose-600 transition-colors p-2 rounded-full hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-slate-800 dark:text-slate-200 dark:text-slate-200 whitespace-pre-wrap">{post.content}</p>
              </div>

              <div className="px-4 md:px-6 py-3 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800 flex items-center gap-6">
                <button 
                  onClick={() => handleLikePost(post.id, post.likes)}
                  className={cn("flex items-center gap-2 text-sm font-bold transition-colors", 
                    isLiked ? "text-blue-600" : "text-slate-500 dark:text-slate-400 hover:text-blue-600"
                  )}
                >
                  <ThumbsUp className={cn("w-4 h-4", isLiked && "fill-current")} />
                  {likesCount} {likesCount === 1 ? 'Pëlqim' : 'Pëlqime'}
                </button>
                <button 
                  onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                  className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  {postComments.length} {postComments.length === 1 ? 'Koment' : 'Komente'}
                </button>
              </div>

              {isExpanded && (
                <div className="bg-slate-50 dark:bg-slate-800 px-4 md:px-6 py-4 border-t border-slate-200/60 dark:border-white/10">
                  <div className="space-y-4 mb-4">
                    {postComments.map(comment => (
                      <div key={comment.id} className="flex gap-3">
                        <div className="w-8 h-8 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none mt-1">
                          {comment.authorAvatar ? (
                            <img src={comment.authorAvatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none relative group">
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{comment.authorName}</p>
                            <p className="text-[10px] text-slate-400">
                              {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { locale: sq }) : 'Tani'}
                            </p>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-300">{comment.content}</p>
                          
                          {currentUser && (currentUser.id === comment.authorId || currentUser.role === 'admin') && (
                            <button 
                              onClick={() => handleDeleteComment(post.id, comment.id)}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-opacity p-1 bg-white dark:bg-slate-900 rounded-full shadow-sm dark:shadow-none border border-slate-100 dark:border-white/5"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {currentUser && (
                    <form onSubmit={(e) => handleCreateComment(post.id, e)} className="flex gap-3">
                      <input
                        type="text"
                        value={newCommentContent[post.id] || ''}
                        onChange={e => setNewCommentContent(prev => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder={dt(`Shkruaj një koment...`)}
                        className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-full text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      />
                      <button 
                        type="submit"
                        disabled={!newCommentContent[post.id]?.trim()}
                        className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <Send className="w-4 h-4 ml-0.5" />
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

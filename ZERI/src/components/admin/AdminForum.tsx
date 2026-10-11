import { dt } from '@/src/lib/dt';
import React, { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, limit } from 'firebase/firestore';
import { Trash2, MessageSquare, Search, AlertCircle, CheckCircle, CirclePlay } from 'lucide-react';
import { cn } from '../../lib/utils';
import { STAFF_LIMITS } from '../../lib/loadLimits';
import AdminForumStories from './AdminForumStories.tsx';

export default function AdminForum() {
  const [posts, setPosts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [forumTab, setForumTab] = useState<'posts' | 'stories'>('posts');
  const currentUser = useStore(state => state.currentUser);

  useEffect(() => {
    if (forumTab !== 'posts') return;
    const q = query(collection(db, 'forumPosts'), orderBy('createdAt', 'desc'), limit(STAFF_LIMITS.forumPosts));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPosts(postsData);
    });
    return () => unsubscribe();
  }, [forumTab]);

  const handleDelete = async (id: string) => {
    if (window.confirm("A jeni të sigurt që dëshironi ta fshini këtë postim?")) {
      try {
        await deleteDoc(doc(db, 'forumPosts', id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleToggleVisibility = async (id: string, isHidden: boolean) => {
    try {
      await updateDoc(doc(db, 'forumPosts', id), { isHidden: !isHidden });
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (id: string, isApproved: boolean) => {
    try {
      await updateDoc(doc(db, 'forumPosts', id), { isApproved: !isApproved });
    } catch (err) {
      console.error(err);
    }
  };

  const filteredPosts = posts.filter(p => 
    p.content?.toLowerCase().includes(search.toLowerCase()) || 
    p.authorName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6">
      {/* Sub-navigation: public-debate posts vs. ephemeral Debat Stories */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setForumTab('posts')}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all',
            forumTab === 'posts'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-white/10 dark:hover:bg-slate-800',
          )}
        >
          <MessageSquare className="w-4 h-4" /> {dt('Postimet e Debatit')}
        </button>
        <button
          type="button"
          onClick={() => setForumTab('stories')}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all',
            forumTab === 'stories'
              ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/25'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-white/10 dark:hover:bg-slate-800',
          )}
        >
          <CirclePlay className="w-4 h-4" /> {dt('Debat Story')}
        </button>
      </div>

      {forumTab === 'stories' ? (
        <AdminForumStories />
      ) : (
        <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white title-serif flex items-center gap-3">
             <MessageSquare className="w-8 h-8 text-emerald-600" />{dt(`Menaxhimi i Forumit`)}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{dt(`Moderoni postimet, aprovoni përmbajtjen dhe fshini postimet banale.`)}</p>
        </div>
        
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder={dt(`Kërko postime ose autorë...`)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200/60 dark:border-white/10">
              <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{dt(`Autori`)}</th>
              <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{dt(`Përmbajtja`)}</th>
              <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{dt(`Data`)}</th>
              <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{dt(`Dukshmëria`)}</th>
              <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">{dt(`Veprimet`)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {filteredPosts.map(post => (
              <tr key={post.id} className="hover:bg-slate-50 dark:bg-slate-800 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900 dark:text-white text-sm">{post.authorName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{post.authorRole}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-700 dark:text-slate-300 max-w-md truncate">
                    {post.content}
                  </div>
                </td>
                <td className="px-6 py-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {post.createdAt?.toDate ? new Date(post.createdAt.toDate()).toLocaleDateString('sq-AL') : 'Sapo postuar'}
                </td>
                <td className="px-6 py-4">
                  {post.isApproved ? (
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                       <CheckCircle className="w-3 h-3" />{dt(`Aprovuar`)}
                     </span>
                  ) : (
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
                       <AlertCircle className="w-3 h-3" />{dt(`Në Pritje`)}
                     </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => handleApprove(post.id, !!post.isApproved)}
                      className={cn(
                        "p-2 rounded-2xl transition-colors",
                        post.isApproved ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"
                      )}
                      title={post.isApproved ? "Hiq Aprovimin" : "Aprovo"}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(post.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-2xl transition-colors"
                      title={dt(`Fshij Postimin`)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredPosts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 font-medium">{dt(`Nuk u gjet asnjë postim.`)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}

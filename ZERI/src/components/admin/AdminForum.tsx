import { dt } from '@/src/lib/dt';
import React, { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, limit } from 'firebase/firestore';
import { Trash2, MessageSquare, Search, AlertCircle, CheckCircle, CirclePlay, EyeOff, Film } from 'lucide-react';
import toast from 'react-hot-toast';
import DecisionBar from './DecisionBar';
import { DECISION_KINDS } from '../../lib/decisionRules';
import { cn } from '../../lib/utils';
import { STAFF_LIMITS } from '../../lib/loadLimits';
import AdminForumStories from './AdminForumStories.tsx';
import AdminReelReports from './AdminReelReports.tsx';

export default function AdminForum() {
  const [posts, setPosts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [forumTab, setForumTab] = useState<'posts' | 'stories' | 'reels'>('posts');
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

  // Deleting is permanent and reserved to the superadmin by the rules; hiding (with a
  // reason, kept in the history) is the normal way to take a post down.
  const canDelete = currentUser?.role === 'superadmin';
  const [view, setView] = useState<'pending' | 'approved' | 'hidden' | 'all'>('pending');

  const handleDelete = async (id: string) => {
    if (!window.confirm(dt('Të fshihet përgjithmonë ky postim? Për ta hequr nga publiku mjafton "Fshih nga publiku".'))) return;
    try {
      await deleteDoc(doc(db, 'forumPosts', id));
      toast.success(dt('Postimi u fshi.'));
    } catch (err) {
      console.error(err);
      toast.error(dt('Postimi nuk u fshi.'));
    }
  };

  const stateOf = (p: any) => DECISION_KINDS.forum.stateOf(p);
  const counts = { pending: 0, approved: 0, hidden: 0, all: posts.length };
  for (const p of posts) counts[stateOf(p) as 'pending' | 'approved' | 'hidden'] += 1;
  const filteredPosts = posts.filter(p =>
    (view === 'all' || stateOf(p) === view) &&
    (p.content?.toLowerCase().includes(search.toLowerCase()) ||
     p.authorName?.toLowerCase().includes(search.toLowerCase()))
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
        <button
          type="button"
          onClick={() => setForumTab('reels')}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all',
            forumTab === 'reels'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-white/10 dark:hover:bg-slate-800',
          )}
        >
          <Film className="w-4 h-4" /> {dt('Raportimet e Reels')}
        </button>
      </div>

      {forumTab === 'reels' ? (
        <AdminReelReports />
      ) : forumTab === 'stories' ? (
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

      <div className="flex flex-wrap gap-2">
        {([['pending', 'Në pritje'], ['approved', 'Aprovuar'], ['hidden', 'Të fshehura'], ['all', 'Të gjitha']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-pressed={view === id}
            className={cn('rounded-xl px-3.5 py-2 text-xs font-bold', view === id ? 'bg-slate-900 text-white dark:bg-emerald-600' : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300')}
          >
            {dt(label)} <span className="ml-1 tabular-nums opacity-70">{counts[id]}</span>
          </button>
        ))}
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
                  <div className="text-sm text-slate-700 dark:text-slate-300 max-w-md line-clamp-3 whitespace-pre-wrap">
                    {post.content}
                  </div>
                </td>
                <td className="px-6 py-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {post.createdAt?.toDate ? new Date(post.createdAt.toDate()).toLocaleDateString('sq-AL') : 'Sapo postuar'}
                </td>
                <td className="px-6 py-4">
                  {stateOf(post) === 'hidden' ? (
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 text-[10px] font-bold uppercase tracking-wider">
                       <EyeOff className="w-3 h-3" />{dt(`E fshehur`)}
                     </span>
                  ) : stateOf(post) === 'approved' ? (
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                       <CheckCircle className="w-3 h-3" />{dt(`Aprovuar`)}
                     </span>
                  ) : (
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
                       <AlertCircle className="w-3 h-3" />{dt(`Në Pritje`)}
                     </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col items-end gap-2">
                    <DecisionBar kind="forum" id={post.id} doc={post} />
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {dt(`Fshi përgjithmonë`)}
                      </button>
                    )}
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

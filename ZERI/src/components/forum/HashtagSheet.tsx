import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { Hash, Heart, MessageCircle, X } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { db } from '../../lib/firebase';
import { mergeTagPosts, type TagPost } from '../../lib/hashtagPage';

interface SheetPost extends TagPost {
  authorName?: string;
  likes?: string[];
  comments?: unknown[];
}

interface Props {
  tag: string;
  /** Posts the feed already holds, so older posts without the `hashtags` field still show. */
  localPosts: readonly any[];
  onClose: () => void;
}

const toMs = (value: any): number => (typeof value?.toMillis === 'function' ? value.toMillis() : typeof value === 'number' ? value : 0);

const normalise = (post: any): SheetPost => ({
  id: post.id,
  content: post.content,
  hashtags: post.hashtags,
  visibility: post.visibility ?? 'public',
  isHidden: post.isHidden,
  deletedAt: post.deletedAt,
  authorName: post.authorName,
  likes: post.likes,
  comments: post.comments,
  createdAtMs: toMs(post.createdAt) || toMs(post.timestamp) || 0,
});

/** The page of one hashtag: every public post that carries it. */
export function HashtagSheet({ tag, localPosts, onClose }: Props) {
  const [queried, setQueried] = useState<SheetPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDocs(query(
      collection(db, 'forumPosts'),
      where('visibility', '==', 'public'),
      where('hashtags', 'array-contains', tag),
      orderBy('createdAt', 'desc'),
      limit(40),
    ))
      .then((snap) => { if (!cancelled) setQueried(snap.docs.map((d) => normalise({ id: d.id, ...d.data() }))); })
      .catch(() => { if (!cancelled) setQueried([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tag]);

  const posts = useMemo(() => mergeTagPosts(tag, queried, localPosts.map(normalise)), [tag, queried, localPosts]);

  return (
    <div className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="hashtag-title"
        className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-zinc-900 sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <h2 id="hashtag-title" className="flex items-center gap-1.5 text-base font-black text-slate-900 dark:text-white">
            <Hash className="h-4 w-4 text-emerald-600" aria-hidden="true" />{tag}
          </h2>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto p-4">
          {loading && posts.length === 0 && <li className="py-8 text-center text-sm text-slate-500">{dt('Po ngarkohet…')}</li>}
          {!loading && posts.length === 0 && <li className="py-8 text-center text-sm text-slate-500">{dt('Nuk ka ende postime me këtë hashtag.')}</li>}
          {posts.map((p) => (
            <li key={p.id} className="rounded-2xl border border-slate-200 p-3 dark:border-zinc-700">
              <p className="text-xs font-bold text-slate-500">{p.authorName}</p>
              <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-slate-800 dark:text-slate-100">{p.content}</p>
              <p className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" aria-hidden="true" />{p.likes?.length ?? 0}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" aria-hidden="true" />{p.comments?.length ?? 0}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

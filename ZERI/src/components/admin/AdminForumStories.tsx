import { useEffect, useMemo, useState } from 'react';
import {
  CirclePlay, Search, Trash2, Eye, EyeOff, Loader2, Clock, X,
  ImageIcon, Video, AlertTriangle,
} from 'lucide-react';
import {
  collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, updateDoc, Timestamp,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { auth, db } from '../../lib/firebase';
import { useStore } from '../../lib/store';
import { dt } from '../../lib/dt';
import { cn } from '../../lib/utils';
import { STAFF_LIMITS } from '../../lib/loadLimits';
import { askConfirm, askReason } from '../../lib/dialogs';

/**
 * Staff-side moderation of "Debat Story" — the ephemeral 24h media stories
 * citizens publish from the forum. The public strip (`ForumStories.tsx`) shows
 * only unexpired, non-hidden stories; this panel is the other half of that
 * contract. Moderators see the whole recent set, preview a story exactly as a
 * citizen would, hide it (a reversible flag that removes it from the public
 * strip without destroying evidence), or delete it outright for serious
 * violations. Hiding is stamped with who did it and when, so moderation is
 * auditable.
 */

interface StoryDoc {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  textOverlay?: string;
  effect?: string;
  overlayX?: number;
  overlayY?: number;
  overlayColor?: string;
  overlaySize?: number;
  createdAt?: Timestamp;
  expiresAt?: Timestamp;
  isHidden?: boolean;
  hiddenBy?: string;
  hiddenAt?: string;
}

const EFFECT_CLASS: Record<string, string> = {
  natural: '',
  vivid: 'saturate-150 contrast-110',
  warm: 'sepia-[.28] saturate-125',
  mono: 'grayscale',
};

const effectClass = (effect?: string) => (effect ? EFFECT_CLASS[effect] ?? '' : '');
const toMillis = (value?: Timestamp) => (value && typeof value.toMillis === 'function' ? value.toMillis() : 0);

interface Expiry { label: string; tone: 'live' | 'soon' | 'expired' }
type EnrichedStory = StoryDoc & { _expiry: Expiry; _exp: number };

function relativeExpiry(expiresAt: number, now: number): Expiry {
  const diff = expiresAt - now;
  if (diff <= 0) return { label: dt('Skaduar'), tone: 'expired' };
  const hours = diff / 3_600_000;
  if (hours <= 1) return { label: `${Math.max(1, Math.round(diff / 60_000))} min`, tone: 'soon' };
  if (hours <= 24) return { label: `${Math.round(hours)} orë`, tone: hours <= 3 ? 'soon' : 'live' };
  return { label: `${Math.round(hours / 24)} ditë`, tone: 'live' };
}

export default function AdminForumStories() {
  const currentUser = useStore((s) => s.currentUser);
  const staffId = auth.currentUser?.uid || currentUser?.id || 'stafi';

  const [stories, setStories] = useState<StoryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState<'all' | 'live' | 'soon' | 'expired' | 'hidden'>('all');
  const [search, setSearch] = useState('');
  const [previewing, setPreviewing] = useState<EnrichedStory | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'forumStories'),
      orderBy('createdAt', 'desc'),
      limit(STAFF_LIMITS.forumStories),
    );
    return onSnapshot(
      q,
      (snap) => {
        setStories(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as StoryDoc[]);
        setLoadError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Debat Story-t nuk u ngarkuan për stafin:', err);
        setLoadError('Story-t nuk u ngarkuan. Kontrolloni lejet dhe lidhjen, pastaj provoni përsëri.');
        setLoading(false);
        toast.error(dt('Debat Story-t nuk u ngarkuan.'));
      },
    );
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const enriched = useMemo(
    () =>
      stories.map((s) => {
        const exp = toMillis(s.expiresAt);
        return { ...s, _expiry: relativeExpiry(exp, now), _exp: exp };
      }),
    [stories, now],
  );

  const stats = useMemo(() => {
    let live = 0, soon = 0, expired = 0, hidden = 0;
    for (const s of enriched) {
      if (s.isHidden) hidden += 1;
      if (s._expiry.tone === 'expired') expired += 1;
      else if (s._expiry.tone === 'soon') soon += 1;
      else live += 1;
    }
    return { total: enriched.length, live, soon, expired, hidden };
  }, [enriched]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return enriched.filter((s) => {
      const matchSearch =
        !needle ||
        s.authorName?.toLowerCase().includes(needle) ||
        s.textOverlay?.toLowerCase().includes(needle);
      const matchFilter =
        filter === 'all' ||
        (filter === 'hidden' ? Boolean(s.isHidden) : s._expiry.tone === filter);
      return matchSearch && matchFilter;
    });
  }, [enriched, filter, search]);

  const toggleHide = async (s: StoryDoc) => {
    const next = !s.isHidden;
    try {
      const patch: Record<string, any> = next
        ? { isHidden: true, hiddenBy: staffId, hiddenAt: new Date().toISOString() }
        : { isHidden: false };
      await updateDoc(doc(db, 'forumStories', s.id), patch);
      setStories((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...patch } : x)));
      setPreviewing((prev) => (prev?.id === s.id ? { ...prev, ...patch } : prev));
      toast.success(next ? 'Story u fsheh nga publiku.' : 'Story u rikthye publik.');
    } catch (err) {
      console.error('Ndryshimi i dukshmërisë dështoi:', err);
      toast.error(dt('Dukshmëria nuk u ndryshua. Kontrolloni lejet dhe provoni përsëri.'));
    }
  };

  const remove = async (s: StoryDoc) => {
    if (!await askConfirm(`Fshi përgjithmonë story-n e "${s.authorName}"? Ky veprim nuk mund të kthehet.`)) return;
    try {
      await deleteDoc(doc(db, 'forumStories', s.id));
      setStories((prev) => prev.filter((x) => x.id !== s.id));
      if (previewing?.id === s.id) setPreviewing(null);
      toast.success(dt('Story u fshi.'));
    } catch (err) {
      console.error('Story nuk u fshi:', err);
      toast.error(dt('Fshirja dështoi. Kontrolloni lejet dhe provoni përsëri.'));
    }
  };

  const toneCls = (tone: 'live' | 'soon' | 'expired') =>
    tone === 'live'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
      : tone === 'soon'
        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50'
        : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';

  const FILTERS: { id: typeof filter; label: string }[] = [
    { id: 'all', label: dt('Të gjitha') },
    { id: 'live', label: dt('Aktive') },
    { id: 'soon', label: dt('Skadojnë shpejt') },
    { id: 'expired', label: dt('Skaduara') },
    { id: 'hidden', label: dt('Të fshehura') },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-slate-700 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-5 text-white shadow-[0_28px_80px_-40px_rgba(15,23,42,0.8)] sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl" />
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-fuchsia-400/10 text-fuchsia-300 ring-1 ring-fuchsia-300/10">
            <CirclePlay className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-xl font-black text-white sm:text-2xl">{dt('Moderimi i Debat Story')}</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">
              {dt('Story-t janë publike për 24 orë. Fshihni ose fshehni përmbajtjen që shkel rregullat e komunitetit.')}
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div role="status" className="flex items-center gap-2 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-3 text-xs font-semibold text-cyan-800 dark:text-cyan-200">
          <Loader2 className="h-4 w-4 animate-spin" /> {dt('Po sinkronizohen story-t...')}
        </div>
      )}
      {loadError && (
        <div role="alert" className="rounded-2xl border border-rose-300/30 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
          <p className="font-black flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {dt('Sinkronizimi dështoi')}</p>
          <p className="mt-1 text-xs">{loadError}</p>
        </div>
      )}

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-500">{dt('Aktive')}</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.live}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[11px] font-black uppercase tracking-wider text-amber-500">{dt('Skadojnë shpejt')}</p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{stats.soon}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{dt('Skaduara')}</p>
          <p className="text-2xl font-black text-slate-500 dark:text-slate-400 mt-1">{stats.expired}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[11px] font-black uppercase tracking-wider text-rose-500">{dt('Të fshehura')}</p>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{stats.hidden}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={dt('Kërko sipas autorit ose tekstit...')}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-fuchsia-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-[11px] font-bold border transition',
                filter === f.id
                  ? 'border-fuchsia-600 bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Story grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 py-16 text-center text-sm text-slate-400 shadow-sm">
          {dt('Nuk u gjet asnjë story me këta filtra.')}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((s) => (
            <li
              key={s.id}
              className={cn(
                'group relative overflow-hidden rounded-2xl border bg-slate-900 shadow-sm transition',
                s.isHidden ? 'border-rose-400/50 opacity-70' : 'border-slate-700',
              )}
            >
              {/* Media thumbnail (9:16 story frame) */}
              <button
                type="button"
                onClick={() => setPreviewing(s)}
                className="relative block aspect-[9/16] w-full overflow-hidden"
                aria-label={dt('Shiko story-n')}
              >
                {s.mediaType === 'video' ? (
                  <video src={s.mediaUrl} muted playsInline preload="metadata" className={cn('h-full w-full object-cover', effectClass(s.effect))} />
                ) : (
                  <img src={s.mediaUrl} alt="" loading="lazy" className={cn('h-full w-full object-cover', effectClass(s.effect))} />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
                {s.textOverlay && (
                  <span
                    className="pointer-events-none absolute max-w-[85%] -translate-x-1/2 -translate-y-1/2 px-2 text-center font-black drop-shadow"
                    style={{
                      left: `${s.overlayX ?? 50}%`,
                      top: `${s.overlayY ?? 85}%`,
                      color: s.overlayColor || '#fff',
                      fontSize: `${Math.min(s.overlaySize ?? 18, 22)}px`,
                      textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                    }}
                  >
                    {s.textOverlay}
                  </span>
                )}
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-bold text-white">
                  {s.mediaType === 'video' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                  {s.mediaType === 'video' ? dt('Video') : dt('Foto')}
                </span>
                <span className={cn('absolute right-2 top-2 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black', toneCls(s._expiry.tone))}>
                  <Clock className="w-3 h-3" /> {s._expiry.label}
                </span>
                {s.isHidden && (
                  <span className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-1 bg-rose-600/90 py-1 text-[11px] font-black uppercase tracking-wide text-white">
                    <EyeOff className="w-3.5 h-3.5" /> {dt('E fshehur')}
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-900">
                    <Eye className="w-4 h-4" /> {dt('Parashiko')}
                  </span>
                </span>
              </button>

              {/* Footer: author + actions */}
              <div className="flex items-center justify-between gap-2 bg-white px-3 py-2.5 dark:bg-slate-900">
                <div className="flex min-w-0 items-center gap-2">
                  <img
                    src={s.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.authorName || '?')}`}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                  />
                  <span className="min-w-0 truncate text-xs font-bold text-slate-800 dark:text-slate-200">{s.authorName}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleHide(s)}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      s.isHidden
                        ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40',
                    )}
                    title={s.isHidden ? dt('Rikthe publik') : dt('Fshih nga publiku')}
                  >
                    {s.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title={dt('Fshi story-n')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Preview modal — renders exactly as the citizen viewer does */}
      {previewing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4 md:backdrop-blur-sm" onClick={() => setPreviewing(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Story nga ${previewing.authorName}`}
            className="relative flex h-[min(88dvh,46rem)] w-full max-w-xs items-center justify-center overflow-hidden rounded-3xl bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {previewing.mediaType === 'video' ? (
              <video key={previewing.id} src={previewing.mediaUrl} autoPlay controls playsInline className={cn('h-full w-full object-contain', effectClass(previewing.effect))} />
            ) : (
              <img src={previewing.mediaUrl} alt="" className={cn('h-full w-full object-contain', effectClass(previewing.effect))} />
            )}
            {previewing.textOverlay && (
              <p
                className="pointer-events-none absolute max-w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-xl px-4 py-3 text-center font-black drop-shadow-lg"
                style={{
                  left: `${previewing.overlayX ?? 50}%`,
                  top: `${previewing.overlayY ?? 85}%`,
                  color: previewing.overlayColor || '#ffffff',
                  fontSize: `${previewing.overlaySize ?? 20}px`,
                  textShadow: '0 1px 4px rgba(0,0,0,0.55)',
                }}
              >
                {previewing.textOverlay}
              </p>
            )}
            <div className="absolute inset-x-3 top-3 flex items-center gap-2 text-white">
              <img
                src={previewing.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(previewing.authorName || '?')}`}
                alt=""
                className="h-8 w-8 rounded-full border border-white/40 object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{previewing.authorName}</span>
              <span className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black', toneCls(previewing._expiry.tone))}>
                <Clock className="w-3 h-3" /> {previewing._expiry.label}
              </span>
            </div>
            <button type="button" onClick={() => setPreviewing(null)} aria-label={dt('Mbyll')} className="absolute right-3 bottom-3 rounded-full bg-white/15 p-2 text-white hover:bg-white/25">
              <X className="h-5 w-5" />
            </button>
            <div className="absolute left-3 bottom-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleHide(previewing)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black text-white transition-colors',
                  previewing.isHidden ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700',
                )}
              >
                {previewing.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {previewing.isHidden ? dt('Rikthe') : dt('Fshih')}
              </button>
              <button
                type="button"
                onClick={() => remove(previewing)}
                className="flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-2 text-xs font-black text-white hover:bg-rose-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> {dt('Fshi')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { applySignal, loadProfile, rankReels, saveProfile, type Signal } from '../../lib/reelInterest';
import { Eye, EyeOff, Flag, Heart, Loader2, MessageCircle, MoreVertical, Pencil, Play, Plus, RefreshCw, Share2, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import {
  REEL_REPORT_REASONS, fetchReelsPage, reportReel, setReelLiked, toggleLike,
  type Reel, type ReelReportReason, type ReelsCursor,
} from '../../lib/reels';
import { fetchReelsByAuthor, fetchReelsByHashtag } from '../../lib/reelsSocial';
import { ReelCommentsSheet } from './ReelCommentsSheet';
import { ReelApiError, deleteReelApi, recordReelViewApi, shareReel, updateReelCaption } from '../../lib/reelsApi';
import { fetchReelForReview } from '../../lib/reelsSocial';
import { trackInsight } from '../../lib/forumAnalyticsApi';
import { askConfirm } from '../../lib/dialogs';

/** Where the player gets its reels: the public feed, one author, or one hashtag. */
export type ReelsSource =
  | { kind: 'feed' }
  | { kind: 'author'; authorId: string; includeHidden: boolean }
  | { kind: 'hashtag'; tag: string }
  /** One reel opened from a shared link. */
  | { kind: 'single'; reelId: string };

interface ReelsViewerProps {
  source?: ReelsSource;
  /** Scroll to this reel once loaded (opened from a grid). */
  startReelId?: string;
  currentUser?: { id: string; name: string; avatar?: string | null } | null;
  isStaff?: boolean;
  currentUserId: string | null;
  canInteract: boolean;
  isFollowing: (userId: string) => boolean;
  /** Hides Reels whose author limited them to followers / themselves. Absent = show all. */
  canViewAuthorReels?: (authorId: string) => boolean;
  onToggleFollow: (userId: string) => void;
  onOpenProfile: (authorId: string, authorName: string, authorAvatar?: string) => void;
  onRequireAuth: () => void;
  onCreateReel: () => void;
  onClose: () => void;
}

const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));

/**
 * Full-screen vertical Reels player.
 *
 * Bandwidth: only the active reel and the next one get a `src`; everything
 * else is an empty frame, so scrolling a long feed never downloads it all.
 * Playback: only the active reel plays. It starts muted, which browsers allow
 * without a gesture; the sound toggle applies to every reel after that.
 */
export function ReelsViewer({
  source = { kind: 'feed' }, startReelId, currentUser = null, isStaff = false,
  currentUserId, canInteract, isFollowing, canViewAuthorReels, onToggleFollow, onOpenProfile, onRequireAuth, onCreateReel, onClose,
}: ReelsViewerProps) {
  const [commentsFor, setCommentsFor] = useState<Reel | null>(null);
  const sourceKey = source.kind === 'feed' ? 'feed' : source.kind === 'author' ? `author:${source.authorId}:${source.includeHidden}` : source.kind === 'single' ? `single:${source.reelId}` : `tag:${source.tag}`;
  const [reels, setReels] = useState<Reel[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState<Record<string, true>>({});
  const [pendingLike, setPendingLike] = useState<Record<string, true>>({});

  // What this person likes, kept on this device (src/lib/reelInterest.ts). Only the main feed is ranked.
  const interestRef = useRef(loadProfile(currentUserId ?? 'anon'));
  const learn = useCallback((reel: Reel, signal: Signal) => {
    if (!currentUserId || reel.authorId === currentUserId) return;
    interestRef.current = applySignal(interestRef.current, reel, signal);
    saveProfile(currentUserId, interestRef.current);
  }, [currentUserId]);

  const cursorRef = useRef<ReelsCursor>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const closeRef = useRef<HTMLButtonElement>(null);

  const loadPage = useCallback(async (reset: boolean) => {
    if (reset) {
      cursorRef.current = null;
      setStatus('loading');
    } else {
      setLoadingMore(true);
    }
    try {
      // Author and hashtag views are one bounded query; only the feed pages.
      const page = source.kind === 'feed'
        ? await fetchReelsPage(reset ? null : cursorRef.current)
        : {
            reels: await (source.kind === 'author'
              ? fetchReelsByAuthor(source.authorId, source.includeHidden)
              : source.kind === 'single'
                ? fetchReelForReview(source.reelId).then((r) => (r && !r.isHidden ? [r] : []))
                : fetchReelsByHashtag(source.tag)),
            cursor: null as ReelsCursor,
            done: true,
          };
      const allowed = canViewAuthorReels ? page.reels.filter((r) => canViewAuthorReels(r.authorId)) : page.reels;
      const visibleReels = source.kind === 'feed' && currentUserId ? rankReels(allowed, interestRef.current) : allowed;
      cursorRef.current = page.cursor;
      setDone(page.done);
      setReels((prev) => {
        if (reset) return visibleReels;
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...visibleReels.filter((r) => !seen.has(r.id))];
      });
      setStatus('ready');
    } catch (error) {
      console.error('Reels nuk u ngarkuan:', error);
      if (reset) setStatus('error');
      else toast.error(dt('Reels të tjera nuk u ngarkuan.'));
    } finally {
      setLoadingMore(false);
    }
    // `source` is represented by its key so a new object each render does not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  useEffect(() => { void loadPage(true); }, [loadPage]);

  // Opened from a grid: jump to the chosen reel as soon as the list is rendered.
  const jumpedRef = useRef(false);
  useEffect(() => {
    if (!startReelId || jumpedRef.current || status !== 'ready') return;
    const index = reels.findIndex((r) => r.id === startReelId);
    if (index < 0) return;
    jumpedRef.current = true;
    requestAnimationFrame(() => {
      scrollerRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'start' });
    });
  }, [startReelId, status, reels]);

  // Focus the dialog and lock the page behind it.
  useEffect(() => {
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  // The most visible slide becomes active.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || reels.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (Number.isFinite(index)) setActive(index);
          }
        }
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll<HTMLElement>('[data-reel-slide]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [reels.length]);

  // Fetch the next page when the user reaches the last two slides.
  useEffect(() => {
    if (status === 'ready' && !done && !loadingMore && reels.length > 0 && active >= reels.length - 2) {
      void loadPage(false);
    }
  }, [active, done, loadingMore, reels.length, status, loadPage]);

  // Play the active reel, pause everything else.
  useEffect(() => {
    setProgress(0);
    setPaused(false);
    videoRefs.current.forEach((video, id) => {
      if (reels[active]?.id === id) {
        video.currentTime = 0;
        video.muted = muted;
        video.play().catch(() => {
          // Autoplay with sound refused: fall back to muted, which is always allowed.
          video.muted = true;
          setMuted(true);
          video.play().catch(() => setPaused(true));
        });
      } else {
        video.pause();
      }
    });
    // `muted` is applied separately below; restarting on mute toggle would be wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reels]);

  useEffect(() => {
    const video = reels[active] && videoRefs.current.get(reels[active].id);
    if (video) video.muted = muted;
  }, [muted, active, reels]);

  // A Reel counts as viewed (for its author's business insights) after 1.5 s on screen.
  useEffect(() => {
    const reel = reels[active];
    if (!reel || !currentUserId || !canInteract) return;
    const timer = window.setTimeout(() => {
      trackInsight({ authorId: reel.authorId, type: 'reel_view', reelId: reel.id }, currentUserId);
      learn(reel, 'watch');
      // The reel's own view counter (one per account, counted by the server).
      if (reel.authorId !== currentUserId) {
        void recordReelViewApi(reel.id).then((n) => {
          if (n !== null) setReels((prev) => prev.map((r) => (r.id === reel.id ? { ...r, viewCount: n } : r)));
        });
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [active, reels, currentUserId, canInteract]);

  // Pause when the tab is hidden; resume only if the user had not paused.
  useEffect(() => {
    const onVisibility = () => {
      const video = reels[active] && videoRefs.current.get(reels[active].id);
      if (!video) return;
      if (document.hidden) video.pause();
      else if (!paused) video.play().catch(() => setPaused(true));
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [active, paused, reels]);

  const scrollToIndex = useCallback((index: number) => {
    const target = scrollerRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const togglePlay = useCallback(() => {
    const video = reels[active] && videoRefs.current.get(reels[active].id);
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setPaused(false)).catch(() => setPaused(true));
    } else {
      video.pause();
      setPaused(true);
    }
  }, [active, reels]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowDown' || event.key === 'j') { event.preventDefault(); scrollToIndex(Math.min(active + 1, reels.length - 1)); }
      else if (event.key === 'ArrowUp' || event.key === 'k') { event.preventDefault(); scrollToIndex(Math.max(active - 1, 0)); }
      else if (event.key === 'm' || event.key === 'M') setMuted((m) => !m);
      else if (event.key === ' ' && target?.tagName !== 'BUTTON') { event.preventDefault(); togglePlay(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, reels.length, onClose, scrollToIndex, togglePlay]);

  const [reporting, setReporting] = useState<Reel | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [busyOwner, setBusyOwner] = useState(false);

  const removeReel = async (reel: Reel) => {
    setMenuFor(null);
    if (!await askConfirm(dt('Ta fshij këtë Reel? Videoja, komentet dhe raportimet fshihen përgjithmonë.'))) return;
    setBusyOwner(true);
    try {
      await deleteReelApi(reel.id);
      setReels((prev) => prev.filter((r) => r.id !== reel.id));
      toast.success(dt('Reel-i u fshi.'));
    } catch (error) {
      toast.error(error instanceof ReelApiError ? error.message : dt('Reel-i nuk u fshi.'));
    } finally {
      setBusyOwner(false);
    }
  };

  const saveCaption = async () => {
    if (!editing || busyOwner) return;
    setBusyOwner(true);
    try {
      const caption = await updateReelCaption(editing.id, editing.text);
      setReels((prev) => prev.map((r) => (r.id === editing.id ? { ...r, caption } : r)));
      setEditing(null);
      toast.success(dt('Përshkrimi u ruajt.'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dt('Përshkrimi nuk u ruajt.'));
    } finally {
      setBusyOwner(false);
    }
  };

  const share = async (reel: Reel) => {
    const result = await shareReel(reel.id, reel.caption ? reel.caption.slice(0, 80) : dt('Reel në Zëri i Qytetarëve'));
    if (result === 'copied') toast.success(dt('Lidhja u kopjua.'));
    else if (result === 'failed') toast.error(dt('Lidhja nuk u kopjua.'));
  };
  const [reportReason, setReportReason] = useState<ReelReportReason>('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);

  const submitReport = async () => {
    if (!reporting || reportBusy) return;
    setReportBusy(true);
    try {
      const result = await reportReel(reporting.id, reportReason, reportDetails);
      toast.success(result === 'sent' ? dt('Faleminderit. Raportimi u dërgua te moderatorët.') : dt('E keni raportuar tashmë këtë Reel.'));
      setReporting(null);
      setReportDetails('');
    } catch (error) {
      console.error('Raportimi i Reel dështoi:', error);
      toast.error(dt('Raportimi nuk u dërgua. Provoni përsëri.'));
    } finally {
      setReportBusy(false);
    }
  };

  const notInterested = (reel: Reel) => {
    if (!canInteract || !currentUserId) { onRequireAuth(); return; }
    learn(reel, 'not_interested');
    setReels((prev) => prev.filter((r) => r.id !== reel.id));
    toast(dt('Do të shohësh më pak si ky.'), { icon: '👍' });
  };

  const handleLike = async (reel: Reel) => {
    if (!canInteract || !currentUserId) { onRequireAuth(); return; }
    if (pendingLike[reel.id]) return;
    const nowLiked = !reel.likedBy.includes(currentUserId);
    const apply = (likedBy: string[]) => setReels((prev) => prev.map((r) => (r.id === reel.id ? { ...r, likedBy } : r)));
    apply(toggleLike(reel.likedBy, currentUserId));
    if (nowLiked) learn(reel, 'like');
    setPendingLike((p) => ({ ...p, [reel.id]: true }));
    try {
      await setReelLiked(reel.id, nowLiked);
    } catch (error) {
      console.error('Pëlqimi i Reel dështoi:', error);
      apply(reel.likedBy);
      toast.error(dt('Pëlqimi nuk u ruajt. Provoni përsëri.'));
    } finally {
      setPendingLike(({ [reel.id]: _, ...rest }) => rest);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dt('Reels')}
      className="fixed inset-0 z-[70] flex justify-center bg-black text-white"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h2 className="pointer-events-auto text-lg font-black tracking-tight drop-shadow">{dt('Reels')}</h2>
        <div className="pointer-events-auto flex items-center gap-2">
          {canInteract && (
            <button type="button" onClick={onCreateReel} aria-label={dt('Krijo Reel')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? dt('Aktivizo zërin') : dt('Hiq zërin')} aria-pressed={!muted}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25">
            {muted ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
          </button>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={dt('Mbyll Reels')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {status === 'loading' && (
        <div className="flex h-full w-full max-w-[min(100vw,calc(100dvh*9/16))] items-center justify-center bg-zinc-900" role="status">
          <Loader2 className="h-8 w-8 animate-spin text-white/70" aria-hidden="true" />
          <span className="sr-only">{dt('Po ngarkohen Reels…')}</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex h-full max-w-sm flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-base font-bold">{dt('Reels nuk u ngarkuan.')}</p>
          <p className="text-sm text-white/60">{dt('Kontrolloni lidhjen dhe provoni përsëri.')}</p>
          <button type="button" onClick={() => void loadPage(true)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-black">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> {dt('Provo përsëri')}
          </button>
        </div>
      )}

      {status === 'ready' && reels.length === 0 && (
        <div className="flex h-full max-w-sm flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-xl font-black">{dt('Ende nuk ka Reels')}</p>
          <p className="text-sm text-white/60">{dt('Ndani një video të shkurtër vertikale për një çështje në komunën tuaj.')}</p>
          {canInteract ? (
            <button type="button" onClick={onCreateReel} className="rounded-full bg-white px-5 py-2.5 text-sm font-black text-black">
              {dt('Krijo Reel-in e parë')}
            </button>
          ) : (
            <button type="button" onClick={onRequireAuth} className="rounded-full bg-white px-5 py-2.5 text-sm font-black text-black">
              {dt('Kyçu për të krijuar')}
            </button>
          )}
        </div>
      )}

      {commentsFor && (
        <ReelCommentsSheet
          reel={commentsFor}
          currentUser={currentUser}
          canInteract={canInteract}
          isStaff={isStaff}
          onRequireAuth={onRequireAuth}
          onClose={() => setCommentsFor(null)}
        />
      )}

      {editing && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center" onMouseDown={(e) => { if (e.target === e.currentTarget && !busyOwner) setEditing(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="reel-edit-title" className="w-full max-w-md rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-slate-900 dark:bg-zinc-900 dark:text-white sm:rounded-3xl">
            <h3 id="reel-edit-title" className="mb-2 text-base font-black">{dt('Redakto përshkrimin')}</h3>
            <textarea value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} rows={4} maxLength={350} autoFocus
              aria-label={dt('Përshkrimi')} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
            <p className="mt-1 text-right text-xs text-slate-500">{editing.text.trim().length}/300</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setEditing(null)} disabled={busyOwner} className="flex-1 rounded-full border border-slate-300 py-2.5 text-sm font-black dark:border-zinc-700">{dt('Anulo')}</button>
              <button type="button" onClick={() => void saveCaption()} disabled={busyOwner} className="flex-1 rounded-full bg-blue-600 py-2.5 text-sm font-black text-white disabled:opacity-60">{busyOwner ? dt('Po ruhet…') : dt('Ruaj')}</button>
            </div>
          </div>
        </div>
      )}

      {reporting && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setReporting(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="reel-report-title"
            className="w-full max-w-md rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-slate-900 dark:bg-zinc-900 dark:text-white sm:rounded-3xl">
            <h3 id="reel-report-title" className="mb-3 text-base font-black">{dt('Raporto këtë Reel')}</h3>
            <fieldset className="space-y-1">
              <legend className="sr-only">{dt('Arsyeja')}</legend>
              {REEL_REPORT_REASONS.map((r) => (
                <label key={r.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800">
                  <input type="radio" name="reel-report-reason" checked={reportReason === r.id} onChange={() => setReportReason(r.id)} />
                  {dt(r.label)}
                </label>
              ))}
            </fieldset>
            <textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} maxLength={300} rows={2}
              placeholder={dt('Detaje (opsionale)')} aria-label={dt('Detaje')}
              className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setReporting(null)} className="flex-1 rounded-full border border-slate-300 py-2.5 text-sm font-black dark:border-zinc-700">{dt('Anulo')}</button>
              <button type="button" onClick={() => void submitReport()} disabled={reportBusy}
                className="flex-1 rounded-full bg-rose-600 py-2.5 text-sm font-black text-white disabled:opacity-60">
                {reportBusy ? dt('Po dërgohet…') : dt('Dërgo raportimin')}
              </button>
            </div>
          </div>
        </div>
      )}

      {status === 'ready' && reels.length > 0 && (
        <div
          ref={scrollerRef}
          className="h-full w-full max-w-[min(100vw,calc(100dvh*9/16))] snap-y snap-mandatory overflow-y-auto overscroll-contain no-scrollbar"
        >
          {reels.map((reel, index) => {
            const loadSrc = index === active || index === active + 1;
            const liked = currentUserId ? reel.likedBy.includes(currentUserId) : false;
            const isOwn = currentUserId === reel.authorId;
            return (
              <section
                key={reel.id}
                data-reel-slide
                data-index={index}
                aria-label={`${dt('Reel nga')} ${reel.authorName}`}
                className="relative h-[100dvh] w-full snap-start snap-always overflow-hidden bg-zinc-950"
              >
                {failed[reel.id] ? (
                  <div className="flex h-full items-center justify-center px-8 text-center text-sm text-white/60">
                    {dt('Kjo video nuk është e disponueshme.')}
                  </div>
                ) : (
                  <video
                    ref={(el) => { if (el) videoRefs.current.set(reel.id, el); else videoRefs.current.delete(reel.id); }}
                    src={loadSrc ? reel.mediaUrl : undefined}
                    poster={reel.coverUrl ?? undefined}
                    preload={index === active ? 'auto' : 'metadata'}
                    playsInline
                    loop
                    muted={muted}
                    onClick={togglePlay}
                    onTimeUpdate={index === active ? (e) => {
                      const v = e.currentTarget;
                      if (v.duration) setProgress(v.currentTime / v.duration);
                    } : undefined}
                    onError={() => setFailed((f) => ({ ...f, [reel.id]: true }))}
                    className="h-full w-full cursor-pointer object-cover"
                  />
                )}

                {index === active && paused && !failed[reel.id] && (
                  <button type="button" onClick={togglePlay} aria-label={dt('Luaj')}
                    className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45">
                    <Play className="ml-1 h-8 w-8 fill-white" aria-hidden="true" />
                  </button>
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/80 to-transparent" />

                <div className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-3 right-20 space-y-2">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onOpenProfile(reel.authorId, reel.authorName, reel.authorAvatar ?? undefined)}
                      className="flex min-w-0 items-center gap-2 text-left">
                      {reel.authorAvatar ? (
                        <img src={reel.authorAvatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white/40" />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-black ring-2 ring-white/40" aria-hidden="true">
                          {reel.authorName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="truncate text-sm font-black drop-shadow">{reel.authorName}</span>
                    </button>
                    {!isOwn && (
                      <button type="button"
                        onClick={() => (canInteract ? onToggleFollow(reel.authorId) : onRequireAuth())}
                        className="shrink-0 rounded-full border border-white/70 px-3 py-1 text-xs font-black hover:bg-white/15">
                        {isFollowing(reel.authorId) ? dt('Duke ndjekur') : dt('Ndiq')}
                      </button>
                    )}
                  </div>
                  {reel.caption && (
                    <p className="line-clamp-3 whitespace-pre-line text-sm leading-snug drop-shadow">{reel.caption}</p>
                  )}
                  {reel.audioTitle && (
                    <p className="flex items-center gap-1 text-xs font-bold text-white/90 drop-shadow">
                      <span aria-hidden="true">♪</span> {reel.audioTitle}
                      <span className="font-normal text-white/60">· {dt('audio e shtuar nga autori')}</span>
                    </p>
                  )}
                  {reel.viewCount > 0 && (
                    <p className="flex items-center gap-1 text-[11px] text-white/70"><Eye className="h-3 w-3" aria-hidden="true" /> {formatCount(reel.viewCount)} {dt('shikime')}</p>
                  )}
                  {reel.createdAtMs && (
                    <p className="text-[11px] text-white/60">{new Date(reel.createdAtMs).toLocaleDateString('sq-AL', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  )}
                </div>

                <div className="absolute bottom-[max(2rem,env(safe-area-inset-bottom))] right-2 flex flex-col items-center gap-1">
                  <button type="button" onClick={() => void handleLike(reel)} disabled={!!pendingLike[reel.id]}
                    aria-pressed={liked} aria-label={liked ? dt('Hiq pëlqimin') : dt('Pëlqe')}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-black/25 disabled:opacity-70">
                    <Heart className={`h-7 w-7 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} aria-hidden="true" />
                  </button>
                  <span className="text-xs font-bold drop-shadow">{formatCount(reel.likedBy.length)}</span>
                  <button type="button" onClick={() => setCommentsFor(reel)} aria-label={dt('Komentet')}
                    className="mt-2 flex h-12 w-12 items-center justify-center rounded-full bg-black/25">
                    <MessageCircle className="h-6 w-6" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => void share(reel)} aria-label={dt('Shpërndaj')}
                    className="mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/25">
                    <Share2 className="h-5 w-5" aria-hidden="true" />
                  </button>
                  {isOwn && (
                    <div className="relative">
                      <button type="button" onClick={() => setMenuFor(menuFor === reel.id ? null : reel.id)} aria-haspopup="menu" aria-expanded={menuFor === reel.id}
                        aria-label={dt('Veprime për Reel-in')} className="mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/25">
                        <MoreVertical className="h-5 w-5" aria-hidden="true" />
                      </button>
                      {menuFor === reel.id && (
                        <div role="menu" className="absolute bottom-12 right-0 z-20 w-44 overflow-hidden rounded-xl bg-white py-1 text-slate-800 shadow-xl">
                          <button type="button" role="menuitem" onClick={() => { setMenuFor(null); setEditing({ id: reel.id, text: reel.caption }); }}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold hover:bg-slate-50">
                            <Pencil className="h-4 w-4" aria-hidden="true" /> {dt('Redakto përshkrimin')}
                          </button>
                          <button type="button" role="menuitem" onClick={() => void removeReel(reel)} disabled={busyOwner}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60">
                            <Trash2 className="h-4 w-4" aria-hidden="true" /> {dt('Fshi Reel-in')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {!isOwn && source.kind === 'feed' && (
                    <button type="button" onClick={() => notInterested(reel)} aria-label={dt('Nuk më intereson')} title={dt('Nuk më intereson')}
                      className="mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/25">
                      <EyeOff className="h-5 w-5" aria-hidden="true" />
                    </button>
                  )}
                  {!isOwn && (
                    <button type="button" onClick={() => (canInteract ? setReporting(reel) : onRequireAuth())}
                      aria-label={dt('Raporto Reel-in')}
                      className="mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/25">
                      <Flag className="h-5 w-5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {index === active && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20" aria-hidden="true">
                    <div className="h-full bg-white" style={{ width: `${Math.min(100, progress * 100)}%` }} />
                  </div>
                )}
              </section>
            );
          })}
          {loadingMore && (
            <div className="flex h-24 items-center justify-center" role="status">
              <Loader2 className="h-6 w-6 animate-spin text-white/70" aria-hidden="true" />
            </div>
          )}
          {done && reels.length > 1 && (
            <p className="py-8 text-center text-xs text-white/50">{dt('Keni parë të gjitha Reels.')}</p>
          )}
        </div>
      )}
    </div>
  );
}

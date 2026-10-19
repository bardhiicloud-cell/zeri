import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Check,
  Eye,
  Send,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  ImagePlus,
  Plus,
  Sparkles,
  Type,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, db, MAX_UPLOAD_BYTES, uploadFileToStorage } from '../../lib/firebase';
import type { User } from '../../types';
import { fetchStoryViewersApi, recordStoryViewApi, replyToStoryApi, type StoryViewer } from '../../lib/storyApi';


import { dt } from '@/src/lib/dt';
type StoryEffect = 'natural' | 'vivid' | 'warm' | 'cool' | 'fade' | 'drama' | 'mono' | 'noir';

interface ForumStory {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  textOverlay: string;
  effect: StoryEffect;
  /** Stored as 0-100 percentages so any screen size shows the same position. */
  overlayX?: number;
  overlayY?: number;
  overlayColor?: string;
  overlaySize?: number;
  createdAt?: Timestamp;
  expiresAt: Timestamp;
  /** Set by staff moderation; a hidden story is pulled from the public strip. */
  isHidden?: boolean;
}

interface ForumStoriesProps {
  currentUser: User | null;
  followedUserIds: string[];
  onRequireAuth: () => void;
  isActive: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const OVERLAY_COLORS = ['#ffffff', '#000000', '#fbbf24', '#f43f5e', '#22d3ee', '#a78bfa', '#34d399'];
const OVERLAY_SIZES = [14, 18, 24, 32];
const EFFECTS: { id: StoryEffect; label: string; className: string }[] = [
  { id: 'natural', label: 'Natyrale', className: '' },
  { id: 'vivid', label: 'Gjallëruese', className: 'saturate-150 contrast-110' },
  { id: 'warm', label: 'E ngrohtë', className: 'sepia-[.28] saturate-125' },
  { id: 'cool', label: 'E ftohtë', className: 'hue-rotate-[-14deg] saturate-110 brightness-105' },
  { id: 'fade', label: 'E zbehtë', className: 'contrast-75 brightness-110 saturate-75' },
  { id: 'drama', label: 'Dramatike', className: 'contrast-125 saturate-110 brightness-90' },
  { id: 'mono', label: 'Bardh e zi', className: 'grayscale' },
  { id: 'noir', label: 'Noir', className: 'grayscale contrast-125 brightness-90' },
];

const effectClass = (effect: string) =>
  EFFECTS.find((item) => item.id === effect)?.className ?? '';

const toMillis = (value: Timestamp | undefined) =>
  value && typeof value.toMillis === 'function' ? value.toMillis() : 0;

export function ForumStories({ currentUser, followedUserIds, onRequireAuth, isActive }: ForumStoriesProps) {
  const [stories, setStories] = useState<ForumStory[]>([]);
  const [now, setNow] = useState(Date.now());
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textOverlay, setTextOverlay] = useState('');
  const [effect, setEffect] = useState<StoryEffect>('natural');
  /** Position and style of the text overlay, stored as percentages of the frame. */
  const [overlayPos, setOverlayPos] = useState({ x: 50, y: 85 });
  const [overlayColor, setOverlayColor] = useState('#ffffff');
  const [overlaySize, setOverlaySize] = useState(18);
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
  const [isDropping, setIsDropping] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [tool, setTool] = useState<'filters' | 'text'>('filters');
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState<ForumStory[] | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [viewers, setViewers] = useState<{ count: number; list: StoryViewer[] } | null>(null);
  const [showViewers, setShowViewers] = useState(false);
  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : ''),
    [selectedFile],
  );

  useEffect(() => {
    const storiesQuery = query(
      collection(db, 'forumStories'),
      // `isHidden == false` is what the rules need to allow this list at all.
      where('isHidden', '==', false),
      where('expiresAt', '>', Timestamp.fromMillis(Date.now())),
      orderBy('expiresAt', 'desc'),
      limit(100),
    );
    return onSnapshot(
      storiesQuery,
      (snapshot) => {
        setStories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ForumStory));
      },
      (error) => {
        console.error('Debat Story nuk u ngarkuan:', error);
        toast.error('Story-t nuk u ngarkuan. Ju lutemi rifreskoni faqen.');
      },
    );
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const openComposer = () => {
      if (!currentUser || currentUser.role === 'guest') {
        onRequireAuth();
        return;
      }
      setIsComposerOpen(true);
    };
    window.addEventListener('zeri:open-forum-story', openComposer);
    return () => window.removeEventListener('zeri:open-forum-story', openComposer);
  }, [currentUser, onRequireAuth]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!activeStoryGroup) return;
    const story = activeStoryGroup[activeStoryIndex];
    if (!story || story.mediaType === 'video' || replyText || showViewers) return;
    const timer = window.setTimeout(() => {
      if (activeStoryIndex < activeStoryGroup.length - 1) {
        setActiveStoryIndex((index) => index + 1);
      } else {
        setActiveStoryGroup(null);
      }
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [activeStoryGroup, activeStoryIndex, replyText, showViewers]);

  const currentStory = activeStoryGroup?.[activeStoryIndex] ?? null;
  const viewerUid = auth.currentUser?.uid ?? currentUser?.id ?? '';
  const isOwnActiveStory = !!currentStory && currentStory.authorId === viewerUid;
  useEffect(() => {
    setReplyText('');
    setShowViewers(false);
    setViewers(null);
    if (!currentStory || !currentUser || currentUser.role === 'guest') return;
    if (isOwnActiveStory) {
      let cancelled = false;
      fetchStoryViewersApi(currentStory.id).then((r) => { if (!cancelled) setViewers({ count: r.count, list: r.viewers }); }).catch(() => undefined);
      return () => { cancelled = true; };
    }
    // Best effort: a failed view mark must never get in the way of watching.
    void recordStoryViewApi(currentStory.id).catch(() => undefined);
  }, [currentStory?.id, isOwnActiveStory, currentUser?.id]);

  const sendReply = async () => {
    if (!currentStory || isReplying || !replyText.trim()) return;
    setIsReplying(true);
    try {
      await replyToStoryApi(currentStory.id, replyText.trim());
      setReplyText('');
      toast.success(dt('Përgjigjja u dërgua.'));
    } catch (error: any) {
      toast.error(error?.message || dt('Përgjigjja nuk u dërgua.'));
    } finally {
      setIsReplying(false);
    }
  };

  const visibleStories = useMemo(
    () => stories.filter((story) => !story.isHidden && toMillis(story.expiresAt) > now),
    [stories, now],
  );

  const storyGroups = useMemo(() => {
    const followed = new Set(followedUserIds);
    const byAuthor = new Map<string, ForumStory[]>();
    for (const story of visibleStories) {
      const isOwnStory = story.authorId === currentUser?.id || story.authorId === auth.currentUser?.uid;
      if (!isOwnStory && !followed.has(story.authorId)) continue;
      const group = byAuthor.get(story.authorId) ?? [];
      group.push(story);
      byAuthor.set(story.authorId, group);
    }
    return [...byAuthor.values()].map((group) => group.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt)));
  }, [visibleStories, followedUserIds, currentUser?.id]);

  const ownStories = storyGroups.find((group) =>
    group[0]?.authorId === currentUser?.id || group[0]?.authorId === auth.currentUser?.uid
  );
  const followedGroups = storyGroups.filter((group) => group !== ownStories);

  const openStory = (group: ForumStory[]) => {
    setActiveStoryGroup(group);
    setActiveStoryIndex(0);
  };

  const goToStory = (direction: -1 | 1) => {
    if (!activeStoryGroup) return;
    const nextIndex = activeStoryIndex + direction;
    if (nextIndex < 0) {
      setActiveStoryGroup(null);
    } else if (nextIndex >= activeStoryGroup.length) {
      setActiveStoryGroup(null);
    } else {
      setActiveStoryIndex(nextIndex);
    }
  };

  /** Validates at pick time, so a too-large file is refused before any editing. */
  const pickFile = (file: File | null) => {
    if (!file) return;
    if (!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm))$/.test(file.type)) {
      toast.error('Formati nuk mbështetet. Zgjidhni JPG, PNG, WebP, GIF, MP4 ose WebM.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES.reports) {
      toast.error('Media duhet të jetë më e vogël se 10 MB.');
      return;
    }
    setSelectedFile(file);
    setTool('filters');
  };

  const resetComposer = () => {
    setEditingText(false);
    setTool('filters');
    setIsComposerOpen(false);
    setSelectedFile(null);
    setTextOverlay('');
    setEffect('natural');
    setOverlayPos({ x: 50, y: 85 });
    setOverlayColor('#ffffff');
    setOverlaySize(18);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const publishStory = async () => {
    if (!currentUser || !auth.currentUser || currentUser.role === 'guest') {
      onRequireAuth();
      return;
    }
    if (!selectedFile) {
      toast.error('Zgjidhni një fotografi ose video për story-n.');
      return;
    }
    if (selectedFile.size > MAX_UPLOAD_BYTES.reports) {
      toast.error('Media duhet të jetë më e vogël se 10 MB.');
      return;
    }

    setIsPublishing(true);
    try {
      const mediaUrl = await uploadFileToStorage(selectedFile, 'reports', {
        scope: `story-${auth.currentUser.uid}`,
      });
      await addDoc(collection(db, 'forumStories'), {
        authorId: auth.currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar || '',
        mediaUrl,
        mediaType: selectedFile.type.startsWith('video/') ? 'video' : 'image',
        textOverlay: textOverlay.trim().slice(0, 180),
        effect,
        overlayX: Math.round(overlayPos.x),
        overlayY: Math.round(overlayPos.y),
        overlayColor,
        overlaySize,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + DAY_MS),
        // Required by the rules: visibility is a stored flag so that hiding a story
        // is enforced server-side, not only filtered here.
        isHidden: false,
      });
      toast.success('Debat Story u publikua dhe do të jetë aktiv për 24 orë.');
      resetComposer();
    } catch (error) {
      console.error('Story nuk u publikua:', error);
      toast.error('Story nuk u publikua. Kontrolloni lidhjen dhe provoni përsëri.');
    } finally {
      setIsPublishing(false);
    }
  };

  const renderStoryBubble = (group: ForumStory[], own = false) => {
    const story = group[0];
    if (!story) return null;
    return (
      <button
        key={story.authorId}
        type="button"
        onClick={() => openStory(group)}
        aria-label={`Shiko Debat Story të ${story.authorName}`}
        className="group flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 text-center"
      >
        <span className="rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-violet-600 p-[2px] transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none">
          <img loading="lazy" decoding="async"
            src={story.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(story.authorName)}`}
            alt=""
            className="h-12 w-12 rounded-full border-2 border-white object-cover dark:border-zinc-900"
          />
        </span>
        <span className="w-full truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          {own ? 'Story im' : story.authorName}
        </span>
      </button>
    );
  };

  const activeStory = activeStoryGroup?.[activeStoryIndex];

  return (
    <>
      <section
        aria-label="Debat Story"
        className={`${isActive ? '' : 'hidden'} rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Debat Story</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{dt('Ide, foto dhe video nga komuniteti • 24 orë')}</p>
          </div>
          <CirclePlay className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => {
              if (!currentUser || currentUser.role === 'guest') {
                onRequireAuth();
                return;
              }
              setIsComposerOpen(true);
            }}
            aria-label="Krijo Debat Story"
            className="group flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 text-center"
          >
            <span className="relative flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full border-2 border-dashed border-blue-400 bg-blue-50 text-blue-700 transition group-hover:bg-blue-100 dark:border-blue-500/60 dark:bg-blue-950/40 dark:text-blue-300">
              {ownStories ? (
                <img loading="lazy" decoding="async" src={ownStories[0].authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'Q')}`} alt="" className="h-full w-full rounded-full object-cover" />
              ) : <ImagePlus className="h-5 w-5" aria-hidden="true" />}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white dark:border-zinc-900">
                <Plus className="h-3 w-3" aria-hidden="true" />
              </span>
            </span>
            <span className="w-full truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">Story im</span>
          </button>
          {ownStories && renderStoryBubble(ownStories, true)}
          {followedGroups.map((group) => renderStoryBubble(group))}
        </div>
      </section>

      {isComposerOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/90 p-0 md:backdrop-blur-md sm:p-5" onClick={resetComposer}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            className="hidden"
            onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="forum-story-title"
            className="relative flex h-full w-full flex-col overflow-hidden bg-zinc-950 text-white shadow-2xl sm:h-auto sm:max-h-[94dvh] sm:w-auto sm:rounded-3xl sm:border sm:border-white/10"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="forum-story-title" className="sr-only">Krijo Debat Story</h2>

            {!selectedFile ? (
              /* Step 1 — Instagram-style: the only decision is the media. */
              <div className="flex h-full flex-col sm:w-[min(92vw,30rem)]">
                <header className="flex items-center justify-between px-4 py-3">
                  <span className="text-base font-black">{dt('Story i ri')}</span>
                  <button type="button" onClick={resetComposer} aria-label={dt('Mbyll')} className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </header>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => { event.preventDefault(); setIsDropping(true); }}
                  onDragLeave={() => setIsDropping(false)}
                  onDrop={(event) => { event.preventDefault(); setIsDropping(false); pickFile(event.dataTransfer.files?.[0] ?? null); }}
                  className={`mx-4 mb-4 flex min-h-[26rem] flex-1 flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed p-8 text-center transition-colors sm:aspect-[9/14] sm:flex-none ${isDropping ? 'border-blue-400 bg-blue-500/10' : 'border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10'}`}
                >
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-violet-600 shadow-lg shadow-rose-500/20">
                    <ImagePlus className="h-9 w-9 text-white" aria-hidden="true" />
                  </span>
                  <span className="text-xl font-black">{dt('Zgjidh foto ose video')}</span>
                  <span className="max-w-[16rem] text-sm text-white/60">{dt('Tërhiqe këtu ose kliko për ta zgjedhur. Pastaj shton tekst, ngjyra dhe efekte.')}</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-black text-white">
                    <Upload className="h-4 w-4" aria-hidden="true" /> {dt('Zgjidh nga pajisja')}
                  </span>
                  <span className="text-[11px] text-white/40">{dt('JPG, PNG, WebP, GIF, MP4 ose WebM • deri në 10 MB • aktive 24 orë')}</span>
                </button>
              </div>
            ) : (
              /* Step 2 — full-bleed 9:16 editor with the tools floating on the canvas. */
              <div
                ref={overlayRef}
                className="relative h-full w-full select-none overflow-hidden bg-black sm:h-[min(88dvh,50rem)] sm:w-[calc(min(88dvh,50rem)*9/16)]"
                style={{ aspectRatio: '9 / 16' }}
              >
                {selectedFile.type.startsWith('video/') ? (
                  <video src={previewUrl} className={`absolute inset-0 h-full w-full object-cover ${effectClass(effect)}`} autoPlay loop muted playsInline />
                ) : (
                  <img loading="lazy" decoding="async" src={previewUrl} alt="Parapamje e story-t" className={`absolute inset-0 h-full w-full object-cover ${effectClass(effect)}`} draggable={false} />
                )}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/80 to-transparent" />

                {/* Top bar */}
                <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3">
                  <button type="button" onClick={() => { setSelectedFile(null); setEditingText(false); }} aria-label={dt('Ndrysho median')} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur hover:bg-black/60">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setTool('text'); setEditingText(true); }}
                      aria-label={dt('Shto tekst')}
                      className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur ${tool === 'text' ? 'bg-white text-black' : 'bg-black/40 hover:bg-black/60'}`}
                    >
                      <Type className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTool('filters'); setEditingText(false); }}
                      aria-label={dt('Efektet')}
                      className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur ${tool === 'filters' ? 'bg-white text-black' : 'bg-black/40 hover:bg-black/60'}`}
                    >
                      <Sparkles className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={resetComposer} aria-label={dt('Mbyll')} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur hover:bg-black/60">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Text on the canvas: drag to move, tap to edit. */}
                {textOverlay && !editingText && (
                  <span
                    role="slider"
                    tabIndex={0}
                    aria-label="Pozicioni i tekstit — tërhiqe për ta zhvendosur, kliko për ta ndryshuar"
                    aria-valuetext={`x ${Math.round(overlayPos.x)}%, y ${Math.round(overlayPos.y)}%`}
                    onKeyDown={(event) => { if (event.key === 'Enter') setEditingText(true); }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const container = overlayRef.current;
                      if (!container) return;
                      const rect = container.getBoundingClientRect();
                      const startX = event.clientX;
                      const startY = event.clientY;
                      let moved = false;
                      setIsDraggingOverlay(true);
                      const move = (e: PointerEvent) => {
                        if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 4) moved = true;
                        setOverlayPos({
                          x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
                          y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
                        });
                      };
                      const up = () => {
                        setIsDraggingOverlay(false);
                        window.removeEventListener('pointermove', move);
                        window.removeEventListener('pointerup', up);
                        if (!moved) { setTool('text'); setEditingText(true); }
                      };
                      window.addEventListener('pointermove', move);
                      window.addEventListener('pointerup', up);
                    }}
                    className={`absolute z-10 max-w-[85%] -translate-x-1/2 -translate-y-1/2 whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-center font-black drop-shadow-md ${isDraggingOverlay ? 'cursor-grabbing ring-2 ring-white/70' : 'cursor-grab'}`}
                    style={{
                      left: `${overlayPos.x}%`,
                      top: `${overlayPos.y}%`,
                      color: overlayColor,
                      fontSize: `${overlaySize}px`,
                      textShadow: '0 1px 4px rgba(0,0,0,0.55)',
                      background: overlayColor === '#ffffff' || overlayColor === '#000000' ? 'rgba(0,0,0,0.35)' : 'transparent',
                    }}
                  >
                    {textOverlay}
                  </span>
                )}

                {/* Text editing mode — scrim, live input, colour dots and size. */}
                {editingText && (
                  <div className="absolute inset-0 z-30 flex flex-col bg-black/65 md:backdrop-blur-sm">
                    <div className="flex items-center justify-between p-3">
                      <span className="text-xs font-bold text-white/60">{textOverlay.length}/180</span>
                      <button type="button" onClick={() => setEditingText(false)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-black text-black">
                        <Check className="h-4 w-4" /> {dt('Gati')}
                      </button>
                    </div>
                    <div className="flex flex-1 items-center justify-center px-6">
                      <textarea
                        autoFocus
                        value={textOverlay}
                        onChange={(event) => setTextOverlay(event.target.value.slice(0, 180))}
                        maxLength={180}
                        rows={4}
                        placeholder={dt('Shkruaj diçka…')}
                        aria-label="Teksti mbi media"
                        className="w-full resize-none bg-transparent text-center font-black outline-none placeholder:text-white/40"
                        style={{ color: overlayColor, fontSize: `${overlaySize}px`, textShadow: '0 1px 4px rgba(0,0,0,0.55)' }}
                      />
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex items-center justify-center gap-2.5" role="group" aria-label="Ngjyra e tekstit">
                        {OVERLAY_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            aria-label={`Ngjyra ${color}`}
                            aria-pressed={overlayColor === color}
                            onClick={() => setOverlayColor(color)}
                            className={`h-8 w-8 rounded-full border-2 transition ${overlayColor === color ? 'scale-125 border-white' : 'border-white/40'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-center gap-2" role="group" aria-label={dt('Madhësia e tekstit')}>
                        {OVERLAY_SIZES.map((size) => (
                          <button
                            key={size}
                            type="button"
                            aria-pressed={overlaySize === size}
                            onClick={() => setOverlaySize(size)}
                            className={`h-9 w-12 rounded-full text-xs font-black transition ${overlaySize === size ? 'bg-white text-black' : 'bg-white/15 text-white hover:bg-white/25'}`}
                          >
                            {size === 14 ? 'S' : size === 18 ? 'M' : size === 24 ? 'L' : 'XL'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom: filter strip + publish */}
                {!editingText && (
                  <div className="absolute inset-x-0 bottom-0 z-20 space-y-3 p-3">
                    {tool === 'filters' && (
                      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="Efektet e medias">
                        {EFFECTS.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            aria-pressed={effect === item.id}
                            onClick={() => setEffect(item.id)}
                            className="flex w-16 shrink-0 flex-col items-center gap-1"
                          >
                            <span className={`relative block h-20 w-16 overflow-hidden rounded-xl border-2 transition ${effect === item.id ? 'border-white' : 'border-transparent opacity-80'}`}>
                              {selectedFile.type.startsWith('video/') ? (
                                <video src={previewUrl} muted preload="metadata" className={`h-full w-full object-cover ${item.className}`} />
                              ) : (
                                <img loading="lazy" decoding="async" src={previewUrl} alt="" draggable={false} className={`h-full w-full object-cover ${item.className}`} />
                              )}
                            </span>
                            <span className={`text-[10px] font-bold ${effect === item.id ? 'text-white' : 'text-white/60'}`}>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {tool === 'text' && !textOverlay && (
                      <button type="button" onClick={() => setEditingText(true)} className="mx-auto flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur hover:bg-white/25">
                        <Type className="h-4 w-4" /> {dt('Prek për të shtuar tekst')}
                      </button>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] leading-snug text-white/60">{dt('Publik • zhduket pas 24 orësh')}</p>
                      <button
                        type="button"
                        onClick={() => void publishStory()}
                        disabled={isPublishing}
                        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-black text-white shadow-lg transition hover:bg-blue-500 disabled:opacity-60"
                      >
                        {isPublishing ? <span className="animate-spin">◌</span> : <Send className="h-4 w-4" />}
                        {dt('Shpërndaje')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {activeStory && activeStoryGroup && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 p-0 sm:p-5" onClick={() => setActiveStoryGroup(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Debat Story nga ${activeStory.authorName}`}
            className="relative flex h-full w-full max-w-md items-center justify-center overflow-hidden bg-black sm:h-[min(90dvh,52rem)] sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
              {activeStoryGroup.map((story, index) => (
                <span key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                  <span className={`block h-full rounded-full ${index < activeStoryIndex ? 'w-full bg-white' : index === activeStoryIndex ? 'w-1/3 bg-white' : 'w-0'}`} />
                </span>
              ))}
            </div>
            <div className="absolute inset-x-3 top-7 z-20 flex items-center gap-2 text-white">
              <img loading="lazy" decoding="async" src={activeStory.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeStory.authorName)}`} alt="" className="h-9 w-9 rounded-full border border-white/40 object-cover" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{activeStory.authorName}</span>
              <button type="button" onClick={() => setActiveStoryGroup(null)} aria-label="Mbyll story-n" className="rounded-full bg-black/30 p-2 text-white hover:bg-black/50">
                <X className="h-5 w-5" />
              </button>
            </div>
            {activeStory.mediaType === 'video' ? (
              <video
                key={activeStory.id}
                src={activeStory.mediaUrl}
                autoPlay
                controls
                playsInline
                onEnded={() => goToStory(1)}
                className={`h-full w-full object-contain ${effectClass(activeStory.effect)}`}
              />
            ) : (
              <img loading="lazy" decoding="async" src={activeStory.mediaUrl} alt="" className={`h-full w-full object-contain ${effectClass(activeStory.effect)}`} />
            )}
            {activeStory.textOverlay && (
              <p
                className="pointer-events-none absolute max-w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-xl px-4 py-3 text-center font-black drop-shadow-lg"
                style={{
                  left: `${activeStory.overlayX ?? 50}%`,
                  top: `${activeStory.overlayY ?? 92}%`,
                  color: activeStory.overlayColor || '#ffffff',
                  fontSize: `${activeStory.overlaySize ?? 20}px`,
                  textShadow: '0 1px 4px rgba(0,0,0,0.55)',
                  background: !activeStory.overlayColor || activeStory.overlayColor === '#ffffff' ? 'rgba(0,0,0,0.45)' : 'transparent',
                }}
              >
                {activeStory.textOverlay}
              </p>
            )}
            {currentUser && currentUser.role !== 'guest' && (
              <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
                {isOwnActiveStory ? (
                  <>
                    {showViewers && (
                      <ul className="mb-2 max-h-48 space-y-1 overflow-y-auto rounded-2xl bg-black/70 p-2 text-white" aria-label={dt('Shikuesit')}>
                        {viewers?.list.length === 0 && <li className="p-2 text-xs text-white/70">{dt('Askush nuk e ka parë ende.')}</li>}
                        {viewers?.list.map((v) => (
                          <li key={v.id} className="flex items-center gap-2 p-1 text-sm">
                            <img loading="lazy" decoding="async" src={v.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.name)}`} alt="" className="h-7 w-7 rounded-full object-cover" />
                            <span className="truncate">{v.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button type="button" onClick={() => setShowViewers((v) => !v)} aria-expanded={showViewers}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-bold text-white">
                      <Eye className="h-4 w-4" aria-hidden="true" /> {viewers ? viewers.count : '…'} {dt('shikues')}
                    </button>
                  </>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); void sendReply(); }} className="flex items-center gap-2">
                    <input value={replyText} onChange={(e) => setReplyText(e.target.value.slice(0, 500))} placeholder={dt('Përgjigju…')} aria-label={dt('Përgjigju story-t')}
                      className="min-h-11 flex-1 rounded-full border border-white/40 bg-black/40 px-4 text-base text-white placeholder:text-white/60 outline-none focus:border-white" />
                    <button type="submit" disabled={isReplying || !replyText.trim()} aria-label={dt('Dërgo')}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-50"><Send className="h-4 w-4" aria-hidden="true" /></button>
                  </form>
                )}
              </div>
            )}
            <button type="button" onClick={() => goToStory(-1)} aria-label="Story e mëparshme" className="absolute inset-y-16 left-0 z-10 flex w-1/4 items-center justify-start pl-2 text-white/70 hover:text-white">
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button type="button" onClick={() => goToStory(1)} aria-label="Story tjetër" className="absolute inset-y-16 right-0 z-10 flex w-1/4 items-center justify-end pr-2 text-white/70 hover:text-white">
              <ChevronRight className="h-7 w-7" />
            </button>
          </section>
        </div>
      )}
    </>
  );
}

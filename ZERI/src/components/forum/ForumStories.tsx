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
  Camera,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  ImagePlus,
  Move,
  Palette,
  Plus,
  Type,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, db, MAX_UPLOAD_BYTES, uploadFileToStorage } from '../../lib/firebase';
import type { User } from '../../types';

type StoryEffect = 'natural' | 'vivid' | 'warm' | 'mono';

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
  { id: 'mono', label: 'Bardh e zi', className: 'grayscale' },
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState<ForumStory[] | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : ''),
    [selectedFile],
  );

  useEffect(() => {
    const storiesQuery = query(
      collection(db, 'forumStories'),
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
    if (!story || story.mediaType === 'video') return;
    const timer = window.setTimeout(() => {
      if (activeStoryIndex < activeStoryGroup.length - 1) {
        setActiveStoryIndex((index) => index + 1);
      } else {
        setActiveStoryGroup(null);
      }
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [activeStoryGroup, activeStoryIndex]);

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

  const resetComposer = () => {
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
          <img
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
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Ide, foto dhe video nga komuniteti • 24 orë</p>
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
                <img src={ownStories[0].authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'Q')}`} alt="" className="h-full w-full rounded-full object-cover" />
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
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5" onClick={resetComposer}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="forum-story-title"
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl dark:bg-zinc-950"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
              <div>
                <h2 id="forum-story-title" className="font-black text-slate-900 dark:text-white">Krijo Debat Story</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Foto ose video, aktive për 24 orë</p>
              </div>
              <button type="button" onClick={resetComposer} aria-label="Mbyll" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 overflow-y-auto">
              {/* Preview with draggable text overlay */}
              <div className="flex min-w-0 flex-1 flex-col p-4">
              <div
                ref={overlayRef}
                className="relative flex min-h-[20rem] flex-1 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-100 text-slate-500 select-none dark:border-zinc-700 dark:bg-zinc-900"
              >
                {selectedFile ? (
                  selectedFile.type.startsWith('video/') ? (
                    <video src={previewUrl} className={`absolute inset-0 h-full w-full object-cover ${effectClass(effect)}`} controls playsInline />
                  ) : (
                    <img src={previewUrl} alt="Parapamje e story-t" className={`absolute inset-0 h-full w-full object-cover ${effectClass(effect)}`} draggable={false} />
                  )
                ) : (
                  <span className="flex flex-col items-center gap-2 p-6 text-center">
                    <Camera className="h-9 w-9 text-blue-600" />
                    <span className="font-bold text-slate-800 dark:text-white">Zgjidh media</span>
                    <span className="text-xs">JPG, PNG, WebP, GIF, MP4 ose WebM • deri në 10 MB</span>
                  </span>
                )}
                {textOverlay && selectedFile && (
                  <span
                    role="slider"
                    aria-label="Pozicioni i tekstit — tërhiqe për ta zhvendosur"
                    aria-valuetext={`x ${Math.round(overlayPos.x)}%, y ${Math.round(overlayPos.y)}%`}
                    onPointerDown={(event) => {
                      /*
                       * The drag used to live on the whole preview container, so
                       * clicking anywhere on the photo/video and moving the
                       * mouse dragged the text by accident — it read as the
                       * whole editor being “grabbed”. The pointer capture now
                       * starts on the text itself, which is the only element a
                       * citizen intends to move.
                       */
                      event.preventDefault();
                      event.stopPropagation();
                      setIsDraggingOverlay(true);
                      const container = overlayRef.current;
                      if (!container) return;
                      const rect = container.getBoundingClientRect();
                      const move = (e: PointerEvent) => {
                        setOverlayPos({
                          x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
                          y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
                        });
                      };
                      const up = () => {
                        setIsDraggingOverlay(false);
                        window.removeEventListener('pointermove', move);
                        window.removeEventListener('pointerup', up);
                      };
                      window.addEventListener('pointermove', move);
                      window.addEventListener('pointerup', up);
                    }}
                    className={`absolute max-w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-center font-black drop-shadow-md ${isDraggingOverlay ? 'cursor-grabbing ring-2 ring-blue-400/70' : 'cursor-grab'}`}
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
                {selectedFile && textOverlay && (
                  <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white">
                    <Move className="h-3 w-3" /> Tërhiqe tekstin ku të duash
                  </span>
                )}
              </div>
              </div>

              {/* Sidebar: text + effects, like a real story editor */}
              <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                  className="hidden"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-200 dark:hover:bg-zinc-800">
                  <Upload className="h-4 w-4" /> {selectedFile ? 'Ndrysho median' : 'Ngarko foto/video'}
                </button>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <Type className="h-3.5 w-3.5" /> Teksti mbi media
                  </span>
                  <textarea
                    value={textOverlay}
                    onChange={(event) => setTextOverlay(event.target.value.slice(0, 180))}
                    maxLength={180}
                    rows={3}
                    placeholder="Shkruaj një mesazh të shkurtër..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:ring-blue-900/40"
                  />
                  <span className="mt-1 block text-right text-[11px] text-slate-400">{textOverlay.length}/180</span>
                </label>

                {textOverlay && (
                  <>
                    <fieldset>
                      <legend className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-300">Ngjyra e tekstit</legend>
                      <div className="flex flex-wrap gap-2">
                        {OVERLAY_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            aria-label={`Ngjyra ${color}`}
                            aria-pressed={overlayColor === color}
                            onClick={() => setOverlayColor(color)}
                            className={`h-7 w-7 rounded-full border-2 transition ${overlayColor === color ? 'border-blue-600 scale-110' : 'border-white/60 dark:border-zinc-600'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-300">Madhësia e tekstit</legend>
                      <div className="grid grid-cols-4 gap-1.5">
                        {OVERLAY_SIZES.map((size) => (
                          <button
                            key={size}
                            type="button"
                            aria-pressed={overlaySize === size}
                            onClick={() => setOverlaySize(size)}
                            className={`rounded-lg border py-1.5 text-[10px] font-black transition ${overlaySize === size ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-zinc-700 dark:text-slate-300 dark:hover:bg-zinc-800'}`}
                          >
                            {size === 14 ? 'S' : size === 18 ? 'M' : size === 24 ? 'L' : 'XL'}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </>
                )}

                <fieldset>
                  <legend className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <Palette className="h-3.5 w-3.5" /> Efektet e medias
                  </legend>
                  <div className="grid gap-1.5">
                    {EFFECTS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={effect === item.id}
                        onClick={() => setEffect(item.id)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold transition ${effect === item.id ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:text-slate-300 dark:hover:bg-zinc-800'}`}
                      >
                        {item.label}
                        <span className={`h-5 w-9 rounded-md bg-gradient-to-br from-slate-300 to-slate-400 ${item.className} dark:from-zinc-500 dark:to-zinc-700`} />
                      </button>
                    ))}
                  </div>
                </fieldset>

                <p className="mt-auto text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Debat Story është publik dhe zhduket nga debati pas 24 orësh.
                </p>
                <button
                  type="button"
                  onClick={() => void publishStory()}
                  disabled={!selectedFile || isPublishing}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPublishing ? <span className="animate-spin">◌</span> : <Plus className="h-4 w-4" />}
                  Publiko Story
                </button>
              </aside>
            </div>
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
              <img src={activeStory.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeStory.authorName)}`} alt="" className="h-9 w-9 rounded-full border border-white/40 object-cover" />
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
              <img src={activeStory.mediaUrl} alt="" className={`h-full w-full object-contain ${effectClass(activeStory.effect)}`} />
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

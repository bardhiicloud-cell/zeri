import { dt } from '@/src/lib/dt';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useStore } from '../lib/store';
import { Report } from '../types';
import { formatDistanceToNow, format } from 'date-fns';
import { sq } from 'date-fns/locale';
import {
  ThumbsUp, MessageCircle, MapPin, X, Send, Edit3, Trash2, Share2, Wand2, ArrowUpRight, ChevronLeft, ChevronRight,
  ImageOff, FileText, Music, Download, Maximize2, Play, Building2, Calendar, Tag, Gauge, ShieldCheck, Copy, Navigation,
  History, Settings2, Info,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { validateComment } from '../lib/moderation';
import { useLanguage } from '../lib/LanguageContext';
import { ReportTimeline } from './reports/ReportTimeline';
import { applyTransition } from '../lib/adminApi';
import { trackingIdOf } from '../lib/trackingId';
import { getReportTopic } from '../lib/reportTopics';
import { StatusPill } from './registry/RegistryCard';

interface ReportDetailModalProps {
  report: Report;
  onClose: () => void;
}

const statusConfig = {
  'Pending Review': { label: 'Në Pritje' },
  'Approved': { label: 'Aprovuar' },
  'Assigned': { label: 'Caktuar' },
  'In Progress': { label: 'Në Progres' },
  'Resolved': { label: 'E Zgjidhur' },
  'Rejected': { label: 'Refuzuar' },
};

type Tab = 'details' | 'timeline' | 'comments' | 'manage';

/** One thing to look at in the media stage: a photo, video, recording or document. */
interface Slide {
  kind: 'image' | 'video' | 'audio' | 'file';
  url: string;
  name?: string;
  /** Set on the before/after pair of a resolved report. */
  tag?: 'before' | 'after';
}

/** Every attachment of a report as one ordered list, whichever field it lives in. */
function buildSlides(report: Report): Slide[] {
  const fromMedia: Slide[] = (report.media ?? [])
    .filter(item => item?.url)
    .map(item => ({
      kind: item.type === 'image' || item.type === 'video' || item.type === 'audio' ? item.type : 'file',
      url: item.url,
      name: item.name,
    }));
  const slides: Slide[] = fromMedia.length
    ? fromMedia
    : (report.images ?? []).filter(Boolean).map(url => ({ kind: 'image' as const, url }));

  if (report.resolvedImage) {
    const before = slides.length ? { ...slides[0], tag: 'before' as const } : { kind: 'image' as const, url: report.images?.[0] ?? '', tag: 'before' as const };
    const after: Slide = { kind: 'image', url: report.resolvedImage, tag: 'after' };
    return [before, after, ...slides.slice(1)].filter(slide => slide.url);
  }
  return slides;
}

interface DialogState {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  input?: { placeholder: string; label: string };
  onConfirm: (value?: string) => void;
}

/** Small confirmation / one-field dialog that sits inside the viewer, replacing the browser's confirm() and prompt(). */
function ActionDialog({ dialog, onClose }: { dialog: DialogState; onClose: () => void }) {
  const [value, setValue] = useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    dialog.onConfirm(value.trim() || undefined);
    onClose();
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={submit} role="alertdialog" aria-modal="true" aria-labelledby="action-dialog-title" className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h3 id="action-dialog-title" className="text-lg font-black text-slate-950 dark:text-white">{dialog.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{dialog.message}</p>
        {dialog.input && (
          <input autoFocus type="url" value={value} onChange={event => setValue(event.target.value)} placeholder={dialog.input.placeholder} aria-label={dialog.input.label} className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white" />
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800">{dt('Anulo')}</button>
          <button type="submit" autoFocus={!dialog.input} className={cn('h-10 rounded-xl px-4 text-sm font-black text-white transition', dialog.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-700 hover:bg-blue-800')}>{dialog.confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}

const safeDate = (value?: string) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

/** A single slide, filling its container. Photos are contained, never cropped. */
function SlideView({ slide, onOpen, className }: { slide: Slide; onOpen?: () => void; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [slide.url]);

  if (slide.kind === 'image') {
    return failed ? (
      <div className={cn('flex h-full w-full flex-col items-center justify-center gap-2 text-white/50', className)}>
        <ImageOff className="h-9 w-9" aria-hidden="true" />
        <span className="text-xs font-semibold">{dt('Fotoja nuk u ngarkua')}</span>
      </div>
    ) : (
      <button type="button" onClick={onOpen} disabled={!onOpen} className={cn('group/img relative block h-full w-full', onOpen ? 'cursor-zoom-in' : 'cursor-default', className)} aria-label={dt('Zmadho foton')}>
        <img src={slide.url} alt="" onError={() => setFailed(true)} className="h-full w-full object-contain" draggable={false} />
        {onOpen && (
          <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition group-hover/img:opacity-100 group-focus-visible/img:opacity-100">
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </button>
    );
  }
  if (slide.kind === 'video') {
    return <video key={slide.url} src={slide.url} controls playsInline preload="metadata" className={cn('h-full w-full bg-black object-contain', className)} />;
  }
  if (slide.kind === 'audio') {
    return (
      <div className={cn('flex h-full w-full flex-col items-center justify-center gap-4 px-8 text-center', className)}>
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white/10 text-white/70"><Music className="h-7 w-7" aria-hidden="true" /></span>
        <p className="text-sm font-bold text-white">{slide.name || dt('Regjistrim audio')}</p>
        <audio src={slide.url} controls preload="metadata" className="w-full max-w-sm" />
      </div>
    );
  }
  return (
    <a href={slide.url} target="_blank" rel="noopener noreferrer" className={cn('flex h-full w-full flex-col items-center justify-center gap-4 px-8 text-center transition hover:bg-white/5', className)}>
      <span className="grid h-16 w-16 place-items-center rounded-full bg-white/10 text-white/70"><FileText className="h-7 w-7" aria-hidden="true" /></span>
      <p className="text-sm font-bold text-white">{slide.name || dt('Dokument')}</p>
      <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold text-white"><Download className="h-4 w-4" aria-hidden="true" /> {dt('Shkarko dokumentin')}</span>
    </a>
  );
}

function SlideThumb({ slide, active, onClick, index }: { slide: Slide; active: boolean; onClick: () => void; index: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${dt('Media')} ${index + 1}`}
      aria-current={active}
      className={cn('relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/10 ring-2 ring-offset-2 ring-offset-slate-950 transition sm:h-16 sm:w-16', active ? 'ring-white' : 'opacity-60 ring-transparent hover:opacity-100')}
    >
      {slide.kind === 'image' ? (
        <img src={slide.url} alt="" loading="lazy" className="h-full w-full object-cover" draggable={false} />
      ) : slide.kind === 'video' ? (
        <>
          <video src={slide.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
          <span className="absolute inset-0 grid place-items-center bg-black/35"><Play className="h-4 w-4 fill-white text-white" aria-hidden="true" /></span>
        </>
      ) : (
        <span className="grid h-full w-full place-items-center text-white/70">{slide.kind === 'audio' ? <Music className="h-5 w-5" aria-hidden="true" /> : <FileText className="h-5 w-5" aria-hidden="true" />}</span>
      )}
    </button>
  );
}

/** Full-screen viewer for the same slides. Arrow keys and Esc work; Esc closes only this layer. */
function Lightbox({ slides, index, onIndex, onClose }: { slides: Slide[]; index: number; onIndex: (next: number) => void; onClose: () => void }) {
  const slide = slides[index];
  const go = useCallback((delta: number) => onIndex((index + delta + slides.length) % slides.length), [index, onIndex, slides.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [go, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[12100] flex flex-col bg-black/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={dt('Galeria e medias')}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tabular-nums">{index + 1} / {slides.length}</span>
        <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"><X className="h-5 w-5" aria-hidden="true" /></button>
      </div>
      <div className="relative min-h-0 flex-1 px-2 pb-4 sm:px-16" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
        {slide.tag && (
          <span className={cn('absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white', slide.tag === 'after' ? 'bg-emerald-600' : 'bg-slate-700')}>
            {slide.tag === 'after' ? dt('Pas ndërhyrjes') : dt('Para ndërhyrjes')}
          </span>
        )}
        <SlideView slide={slide} />
        {slides.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label={dt('Media paraprake')} className="absolute left-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 sm:left-4"><ChevronLeft className="h-6 w-6" aria-hidden="true" /></button>
            <button type="button" onClick={() => go(1)} aria-label={dt('Media pasuese')} className="absolute right-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 sm:right-4"><ChevronRight className="h-6 w-6" aria-hidden="true" /></button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function ReportDetailModal({ report, onClose }: ReportDetailModalProps) {
  const { t, dt } = useLanguage();
  const currentUser = useStore(state => state.currentUser);
  const upvoteReport = useStore(state => state.upvoteReport);
  const updateReport = useStore(state => state.updateReport);
  const addComment = useStore(state => state.addComment);
  const updateReportStatus = useStore(state => state.updateReportStatus);

  const [tab, setTab] = useState<Tab>('details');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const slides = useMemo(() => buildSlides(report), [report]);
  const slide = slides[Math.min(slideIndex, Math.max(0, slides.length - 1))];
  const topic = getReportTopic(report);
  const trackingId = trackingIdOf(report);
  const created = safeDate(report.createdAt);
  const comments = report.comments ?? [];
  const commentTotal = comments.length || report.commentsCount || 0;

  const isStaff = Boolean(currentUser?.role && ['admin', 'approver'].includes(currentUser.role)) || Boolean(currentUser?.permissions?.includes('reports'));

  const stepSlide = useCallback((delta: number) => {
    setSlideIndex(index => (slides.length ? (index + delta + slides.length) % slides.length : 0));
  }, [slides.length]);

  // Lock page scroll, move focus into the dialog and hand it back on close.
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  // Esc closes; arrows browse the media unless the visitor is typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (lightboxOpen || dialog) return;
      const typing = event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
      if (event.key === 'Escape') onClose();
      else if (!typing && event.key === 'ArrowLeft' && slides.length > 1) stepSlide(-1);
      else if (!typing && event.key === 'ArrowRight' && slides.length > 1) stepSlide(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, dialog, onClose, slides.length, stepSlide]);

  // Calculate Community Impact & Urgency Score
  const getImpactScore = () => {
    let catWeight = 15;
    const cat = report.category || '';
    if (cat.includes('rrug') || cat.includes('Infrastrukturë')) catWeight = 30;
    else if (cat.includes('Mbeturina') || cat.includes('Ndotje')) catWeight = 25;
    else if (cat.includes('Ndriçim')) catWeight = 20;
    else if (cat.includes('Ujë') || cat.includes('Kanalizim')) catWeight = 30;
    else if (cat.includes('Siguri')) catWeight = 35;

    let urgWeight = 10;
    const urg = report.urgency || '';
    if (urg === 'Kritike') urgWeight = 45;
    else if (urg === 'E lartë') urgWeight = 35;
    else if (urg === 'Mesatare') urgWeight = 20;
    else if (urg === 'E ulët') urgWeight = 10;

    const upvotesCount = report.upvotes || 0;
    const commentsCount = (report.comments && report.comments.length) || report.commentsCount || 0;

    return Math.min(100, catWeight + urgWeight + (upvotesCount * 5) + (commentsCount * 5));
  };

  const impactScore = getImpactScore();
  const impactInfo = impactScore >= 80
    ? { label: 'Prioritet i jashtëzakonshëm', text: 'text-rose-700 dark:text-rose-300', bar: 'bg-rose-500' }
    : impactScore >= 50
      ? { label: 'Prioritet i lartë', text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-500' }
      : { label: 'Prioritet normal', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500' };

  const getUrgencyLabel = (urgency: string) => {
    const translationKeys = {
      Kritike: 'report_urgency_critical',
      'E lartë': 'report_urgency_high',
      Mesatare: 'report_urgency_medium',
      'E ulët': 'report_urgency_low',
      Baxhë: 'report_urgency_trivial',
    } as const;
    const key = translationKeys[urgency as keyof typeof translationKeys];
    return key ? t(key) : dt(urgency);
  };

  /**
   * Apply a status change through the pipeline.
   *
   * `updateReportStatus` now goes via the server, which may refuse the move (a
   * gate the caller does not own, or a report in the wrong stage). That refusal
   * arrives as a rejection carrying the server's own explanation, so it is shown
   * rather than left to become an unhandled promise rejection in the console.
   */
  const applyStatus = async (status: string, evidenceUrl?: string) => {
    try {
      if (status === 'Resolved') {
        await updateReportStatus(report.id, status as any, adminResponse || adminReason || "Puna u krye me sukses.", evidenceUrl || undefined);
      } else {
        await updateReportStatus(report.id, status as any, adminResponse || adminReason);
      }
    } catch (error) {
      toast.error((error as Error)?.message || 'Statusi nuk u ndryshua.');
    }
  };
  const handleStatusChangeClick = (status: string) => {
    if (status === 'Resolved') {
      setDialog({
        title: dt('Shëno si të zgjidhur'),
        message: dt('Mund të shtoni lidhjen e fotos si provë e punës së kryer (opsionale).'),
        input: { placeholder: 'https://…', label: dt('Lidhja e fotos') },
        confirmLabel: dt('Shëno si të zgjidhur'),
        onConfirm: value => void applyStatus(status, value),
      });
    } else {
      void applyStatus(status);
    }
  };
  const [editForm, setEditForm] = useState({
    title: report.title,
    description: report.description,
    category: report.category,
    urgency: report.urgency,
    images: [...report.images],
    address: report.location?.address || ''
  });

  const [aiResponseGenerating, setAiResponseGenerating] = useState(false);
  const [adminReason, setAdminReason] = useState('');
  const [adminResponse, setAdminResponse] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [verifying, setVerifying] = useState(false);
  const claim = (report as Report & { resolutionClaimed?: boolean; resolutionClaim?: { by?: string; at?: string; note?: string; image?: string } });

  /** Confirm or send back a municipality's claim that the work is done (server: staff_verify / staff_return). */
  const decideClaim = async (transition: 'staff_verify' | 'staff_return') => {
    if (transition === 'staff_return' && returnNote.trim().length < 5) { toast.error(dt('Shkruani çka mungon ose çka nuk u konfirmua (të paktën 5 shenja).')); return; }
    setVerifying(true);
    try {
      await applyTransition({ reportId: report.id, transition, note: transition === 'staff_return' ? returnNote.trim() : dt('Zgjidhja u verifikua nga platforma.') });
      toast.success(transition === 'staff_verify' ? dt('Zgjidhja u verifikua; raportimi u mbyll si i zgjidhur.') : dt('Raportimi u kthye te komuna me arsyen tuaj.'));
      setReturnNote('');
    } catch (error) {
      toast.error((error as Error)?.message || dt('Veprimi dështoi.'));
    } finally { setVerifying(false); }
  };

  const generateAIResponse = async () => {
    if (!adminReason) {
      toast.error("Ju lutem shënoni një arsye të shkurtër (psh. nuk është pronë komunale).");
      return;
    }
    setAiResponseGenerating(true);
    try {
      const res = await fetch('/api/admin/generate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: report.title,
          description: report.description,
          reason: adminReason
        })
      });
      const data = await res.json();
      setAdminResponse(data.response);
    } catch (e) {
      console.error(e);
    }
    setAiResponseGenerating(false);
  };

  const shareUrl = `${window.location.origin}/detailed-registry?report=${encodeURIComponent(report.id)}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Raportim: ${report.title}`,
          text: `Shikoni këtë raportim qytetar: "${report.title}"`,
          url: shareUrl
        });
      } catch (err) {
        console.error("Gabim gjatë shpërndarjes:", err);
      }
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => toast.success(dt('Linku u kopjua.')), () => toast.error(dt('Linku nuk u kopjua.')));
    }
  };

  const copyTrackingId = () => {
    navigator.clipboard.writeText(trackingId).then(() => toast.success(dt('ID u kopjua.')), () => toast.error(dt('ID nuk u kopjua.')));
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (!currentUser) {
      toast.error("Kërkohet kyçje për të komentuar.");
      return;
    }

    const validation = validateComment(commentText);
    if (!validation.valid) {
      toast.error(validation.error ?? dt('Komenti nuk u pranua.'));
      return;
    }

    addComment(report.id, commentText, currentUser);
    setCommentText('');
  };

  const handleSaveEdit = () => {
    updateReport(report.id, {
      title: editForm.title,
      description: editForm.description,
      category: editForm.category,
      urgency: editForm.urgency as any,
      images: editForm.images,
      location: {
        lat: report.location?.lat || 0,
        lng: report.location?.lng || 0,
        municipality: report.location?.municipality || 'Prishtinë',
        address: editForm.address
      }
    });
    setIsEditing(false);
  };

  const tabs: Array<{ id: Tab; label: string; icon: typeof Info; count?: number }> = [
    { id: 'details', label: dt('Detajet'), icon: Info },
    { id: 'timeline', label: dt('Historia'), icon: History },
    { id: 'comments', label: dt('Komentet'), icon: MessageCircle, count: commentTotal },
    ...(isStaff ? [{ id: 'manage' as Tab, label: dt('Menaxhimi'), icon: Settings2 }] : []),
  ];

  const mapsHref = report.location?.lat && report.location?.lng
    ? `https://www.google.com/maps/search/?api=1&query=${report.location.lat},${report.location.lng}`
    : null;
  const streetViewHref = report.location?.lat && report.location?.lng
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${report.location.lat},${report.location.lng}`
    : null;

  const facts: Array<{ icon: typeof MapPin; label: string; value: React.ReactNode }> = [
    {
      icon: MapPin,
      label: dt('Vendndodhja'),
      value: (
        <>
          <span className="block">{report.location?.municipality || 'Kosovë'}{report.location?.address ? ` · ${report.location.address}` : ''}</span>
          {(mapsHref || streetViewHref) && (
            <span className="mt-1.5 flex flex-wrap gap-3 text-xs font-bold">
              {mapsHref && <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline dark:text-blue-300"><Navigation className="h-3 w-3" aria-hidden="true" />{dt('Hap në hartë')}</a>}
              {streetViewHref && <a href={streetViewHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline dark:text-blue-300">{dt('Street View')}<ArrowUpRight className="h-3 w-3" aria-hidden="true" /></a>}
            </span>
          )}
        </>
      ),
    },
    { icon: Calendar, label: dt('Raportuar'), value: created ? `${format(created, 'dd MMMM yyyy, HH:mm', { locale: sq })} · ${formatDistanceToNow(created, { locale: sq, addSuffix: true })}` : '—' },
    { icon: Tag, label: dt('Kategoria'), value: [...new Set([topic ? `${topic.icon} ${topic.label}` : null, dt(report.category)].filter(Boolean))].join(' · ') },
    ...(report.responsibleInstitution ? [{ icon: Building2, label: dt('Institucioni përgjegjës'), value: dt(report.responsibleInstitution) }] : []),
    { icon: Gauge, label: dt('Urgjenca'), value: getUrgencyLabel(report.urgency) },
  ];

  const iconButton = 'grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-blue-400 hover:text-blue-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200';
  const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-900 dark:text-white';

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-center justify-center overflow-hidden p-0 md:p-6" role="dialog" aria-modal="true" aria-label={report.title}>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

      <div ref={dialogRef} tabIndex={-1} className="relative flex h-[100dvh] w-full max-w-[72rem] flex-col overflow-hidden bg-white shadow-2xl outline-none dark:bg-slate-900 md:h-[min(92dvh,880px)] md:flex-row md:rounded-3xl md:border md:border-white/10">

        {/* Phones: the close button floats over the photo. */}
        <button type="button" aria-label={dt('Mbyll')} onClick={onClose} className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 md:hidden">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Media stage */}
        <section aria-label={dt('Media e raportimit')} className="relative flex h-[38dvh] min-h-[240px] shrink-0 flex-col bg-slate-950 md:h-full md:w-[56%]">
          <div
            className="relative min-h-0 flex-1 overflow-hidden"
            onTouchStart={event => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
            onTouchEnd={event => {
              const start = touchStartX.current;
              touchStartX.current = null;
              if (start === null || slides.length < 2) return;
              const delta = (event.changedTouches[0]?.clientX ?? start) - start;
              if (Math.abs(delta) > 50) stepSlide(delta < 0 ? 1 : -1);
            }}
          >
            {slide ? (
              <>
                {/* Soft blurred copy of the photo fills the letterbox. */}
                {slide.kind === 'image' && <img src={slide.url} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />}
                <div className="relative h-full w-full">
                  <SlideView slide={slide} onOpen={slide.kind === 'image' ? () => setLightboxOpen(true) : undefined} />
                </div>
                {slide.tag && (
                  <span className={cn('absolute left-1/2 top-3 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-lg', slide.tag === 'after' ? 'bg-emerald-600' : 'bg-slate-700/90 backdrop-blur')}>
                    {slide.tag === 'after' ? dt('Pas ndërhyrjes') : dt('Para ndërhyrjes')}
                  </span>
                )}
                {slides.length > 1 && (
                  <>
                    <button type="button" onClick={() => stepSlide(-1)} aria-label={dt('Media paraprake')} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/75"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
                    <button type="button" onClick={() => stepSlide(1)} aria-label={dt('Media pasuese')} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/75"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
                    <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white backdrop-blur">{Math.min(slideIndex, slides.length - 1) + 1} / {slides.length}</span>
                  </>
                )}
              </>
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-900 to-slate-800 text-center text-white/50">
                <div>
                  <ImageOff className="mx-auto h-10 w-10" aria-hidden="true" />
                  <p className="mt-2 text-xs font-semibold">{dt('Ky raportim nuk ka media')}</p>
                </div>
              </div>
            )}
          </div>

          {slides.length > 1 && (
            <div className="flex shrink-0 gap-2 overflow-x-auto bg-slate-950 px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label={dt('Miniaturat e medias')}>
              {slides.map((item, index) => <SlideThumb key={`${item.url}-${index}`} slide={item} index={index} active={index === Math.min(slideIndex, slides.length - 1)} onClick={() => setSlideIndex(index)} />)}
            </div>
          )}
        </section>

        {/* Information panel */}
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-slate-900">

          <header className="shrink-0 space-y-3 border-b border-slate-100 px-5 pb-0 pt-4 dark:border-white/10 md:px-6 md:pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <StatusPill status={report.status} />
                <button type="button" onClick={copyTrackingId} title={dt('Kopjo ID')} className="group inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
                  #{trackingId}<Copy className="h-3 w-3 opacity-50 transition group-hover:opacity-100" aria-hidden="true" />
                </button>
                {report.isAd && <span className="rounded-md bg-slate-900 px-2 py-1 text-[11px] font-bold text-white">{dt('Sponsorizuar')}</span>}
              </div>
              <button type="button" aria-label={dt('Mbyll')} onClick={onClose} className="hidden h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white md:grid">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <h2 className="font-serif text-xl font-black leading-snug tracking-tight text-slate-950 dark:text-white md:text-2xl">{report.title}</h2>

            <div className="flex flex-wrap items-center gap-2 pb-3">
              <button type="button" onClick={() => upvoteReport(report.id)} className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-blue-400 hover:text-blue-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200" aria-label={dt('Mbështet raportimin')}>
                <ThumbsUp className="h-4 w-4" aria-hidden="true" />{report.upvotes || 0}
              </button>
              <button type="button" onClick={() => setTab('comments')} className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-blue-400 hover:text-blue-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200" aria-label={dt('Komentet')}>
                <MessageCircle className="h-4 w-4" aria-hidden="true" />{commentTotal}
              </button>
              <button type="button" onClick={handleShare} className={iconButton} title={dt('Shpërndaj Raportimin')} aria-label={dt('Shpërndaj Raportimin')}>
                <Share2 className="h-4 w-4" aria-hidden="true" />
              </button>
              {isStaff && !isEditing && (
                <>
                  <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-white/10" aria-hidden="true" />
                  <button type="button" onClick={() => { setTab('details'); setIsEditing(true); }} className={iconButton} title={dt('Edit')} aria-label={dt('Edit')}><Edit3 className="h-4 w-4" aria-hidden="true" /></button>
                  <button
                    type="button"
                    onClick={() => setDialog({
                      title: dt('Fshi raportimin?'),
                      message: dt('Ky veprim nuk mund të kthehet mbrapsht.'),
                      confirmLabel: dt('Fshi'),
                      danger: true,
                      onConfirm: () => { useStore.getState().deleteReport(report.id); onClose(); },
                    })}
                    className="grid h-10 w-10 place-items-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10"
                    title={dt('Delete')} aria-label={dt('Delete')}
                  ><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                </>
              )}
            </div>

            <div role="tablist" aria-label={dt('Pjesët e raportimit')} className="-mx-1 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map(item => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={`report-tab-${item.id}`}
                    aria-selected={active}
                    aria-controls="report-tabpanel"
                    onClick={() => setTab(item.id)}
                    className={cn('relative inline-flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-black transition-colors', active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white')}
                  >
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                    {item.count !== undefined && item.count > 0 && <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] tabular-nums', active ? 'bg-blue-100 text-blue-800 dark:bg-blue-400/20 dark:text-blue-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{item.count}</span>}
                    {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-700 dark:bg-blue-300" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </header>

          <div id="report-tabpanel" role="tabpanel" aria-labelledby={`report-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-6">

            {tab === 'details' && (
              <div className="space-y-6">
                {isEditing && (
                  <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-500/30 dark:bg-blue-500/5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200">{dt('Modifiko Raportin')}</h3>
                    <input type="text" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className={fieldClass} placeholder={dt('Titulli...')} aria-label={dt('Titulli...')} />
                    <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className={cn(fieldClass, 'h-28 resize-none')} placeholder={dt('Përshkrimi...')} aria-label={dt('Përshkrimi...')} />
                    <input type="text" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} className={fieldClass} placeholder={dt('Adresa...')} aria-label={dt('Adresa...')} />
                    <div className="flex gap-2">
                      <button type="button" onClick={handleSaveEdit} className="h-10 flex-1 rounded-xl bg-blue-700 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-800">{dt('Ruaj')}</button>
                      <button type="button" onClick={() => setIsEditing(false)} className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-xs font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">{dt('Anulo')}</button>
                    </div>
                  </div>
                )}

                {report.description && (
                  <section>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{dt('Përshkrimi')}</h3>
                    <p className="mt-2 whitespace-pre-line text-[15px] leading-7 text-slate-700 dark:text-slate-200">{report.description}</p>
                  </section>
                )}

                {report.isAd && report.adLink && (
                  <a href={report.adLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900">{dt('Mëso më shumë')} <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>
                )}

                <dl className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 dark:divide-white/10 dark:border-white/10">
                  {facts.map(fact => (
                    <div key={fact.label} className="flex gap-3 px-4 py-3">
                      <fact.icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <dt className="text-[11px] font-black uppercase tracking-wider text-slate-400">{fact.label}</dt>
                        <dd className="mt-0.5 text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">{fact.value}</dd>
                      </div>
                    </div>
                  ))}
                </dl>

                <section className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{dt('Indeksi i ndikimit')}</h3>
                    <span className={cn('text-xs font-black', impactInfo.text)}>{dt(impactInfo.label)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">{impactScore}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuenow={impactScore} aria-valuemin={0} aria-valuemax={100} aria-label={dt('Indeksi i ndikimit')}>
                      <div className={cn('h-full rounded-full transition-all duration-700', impactInfo.bar)} style={{ width: `${impactScore}%` }} />
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {dt('Llogaritet automatikisht nga kategoria, urgjenca dhe mbështetja e qytetarëve.')}
                  </p>
                </section>

                <div className="flex items-center gap-3 text-sm">
                  <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black', report.isAnonymous ? 'bg-slate-100 text-slate-500 dark:bg-slate-800' : 'bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200')}>
                    {report.isAnonymous ? <ShieldCheck className="h-4 w-4" aria-hidden="true" /> : (report.authorName || '?').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900 dark:text-white">{report.isAnonymous ? dt('Qytetar anonim') : report.authorName}</p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{dt('Qytetar deklarues')}</p>
                  </div>
                </div>
              </div>
            )}

            {tab === 'timeline' && (
              <div>
                <h3 className="mb-4 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{dt('Historia e trajtimit')}</h3>
                <ReportTimeline events={report.timeline || []} />
              </div>
            )}

            {tab === 'comments' && (
              comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800"><MessageCircle className="h-6 w-6" aria-hidden="true" /></span>
                  <p className="mt-3 text-sm font-black text-slate-800 dark:text-slate-100">{dt('Nuk ka ende komente')}</p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">{dt('Bëhu i pari që jep mendimin për këtë raportim.')}</p>
                </div>
              ) : (
                <ul className="space-y-5">
                  {comments.map(comment => {
                    const when = safeDate(comment.createdAt);
                    return (
                      <li key={comment.id} className="flex gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-black text-slate-600 dark:bg-slate-800 dark:text-slate-200" aria-hidden="true">{(comment.authorName || '?').charAt(0).toUpperCase()}</span>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                            <span className="font-black text-slate-900 dark:text-white">{comment.authorName}</span>
                            {when && <time dateTime={when.toISOString()} className="text-xs font-medium text-slate-400">{formatDistanceToNow(when, { locale: sq, addSuffix: true })}</time>}
                          </p>
                          <p className="mt-0.5 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700 dark:text-slate-300">{comment.content}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            )}

            {tab === 'manage' && isStaff && (
              <div className="space-y-6">
                {claim.resolutionClaimed === true && ['admin', 'superadmin'].includes(currentUser?.role ?? '') && (
                  <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
                    <p className="text-sm font-bold text-blue-900 dark:text-blue-200">{dt('Komuna raporton se punimet u kryen. Raportimi mbyllet vetëm pasi ta verifikoni.')}</p>
                    {claim.resolutionClaim?.note && <p className="text-sm text-blue-900/80 dark:text-blue-100/80">{claim.resolutionClaim.note}</p>}
                    {claim.resolutionClaim?.image && <a href={claim.resolutionClaim.image} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-bold text-blue-700 underline">{dt('Shiko dëshminë')}</a>}
                    <textarea value={returnNote} onChange={(e) => setReturnNote(e.target.value)} rows={2} maxLength={1000} placeholder={dt('Nëse e ktheni: çka mungon ose çka nuk u konfirmua (e lexon komuna)')} aria-label={dt('Arsyeja e kthimit')} className={cn(fieldClass, 'resize-none')} />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={verifying} onClick={() => void decideClaim('staff_verify')} className="h-10 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-50">{dt('Verifiko zgjidhjen')}</button>
                      <button type="button" disabled={verifying} onClick={() => void decideClaim('staff_return')} className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">{dt('Kthe te komuna')}</button>
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{dt('Përditëso statusin')}</h3>
                  {report.status === 'Pending Review' && (
                    <button
                      type="button"
                      onClick={() => useStore.getState().updateReportStatus(report.id, 'Approved').catch((e: Error) => toast.error(e.message))}
                      className="mt-3 h-11 w-full rounded-xl bg-blue-700 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-800"
                    >{dt('Aprovo raportimin (bëje publik)')}</button>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.keys(statusConfig).map(status => {
                      const isActive = report.status === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleStatusChangeClick(status)}
                          disabled={isActive}
                          aria-pressed={isActive}
                          className={cn('h-9 rounded-full border px-4 text-xs font-black transition', isActive ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200')}
                        >
                          {dt(status)}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-white/10">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{dt('Përgjigje zyrtare me AI')}</h3>
                  <input
                    type="text"
                    value={adminReason}
                    onChange={(e) => setAdminReason(e.target.value)}
                    placeholder={dt('Arsyeja e shkurtër (p.sh. Rruga jashtë pronësisë komunale)...')}
                    aria-label={dt('Arsyeja e shkurtër')}
                    className={fieldClass}
                  />
                  <button
                    type="button"
                    onClick={generateAIResponse}
                    disabled={aiResponseGenerating || !adminReason}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 text-xs font-black uppercase tracking-wide text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-200"
                  >
                    <Wand2 className="h-4 w-4" aria-hidden="true" />
                    {aiResponseGenerating ? 'Duke gjeneruar...' : 'Gjenero përgjigjen me AI'}
                  </button>
                  {adminResponse && (
                    <textarea value={adminResponse} onChange={(e) => setAdminResponse(e.target.value)} aria-label={dt('Përgjigjja zyrtare')} className={cn(fieldClass, 'h-32 resize-none')} />
                  )}
                </section>
              </div>
            )}
          </div>

          {/* Composer: only where it belongs. */}
          {tab === 'comments' && (
            <form onSubmit={handleAddComment} className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-white/10 dark:bg-slate-900 md:px-6">
              <div className="relative">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={currentUser ? dt('Shto një koment...') : dt('Identifikohu për të komentuar...')}
                  aria-label={dt('Shto një koment...')}
                  disabled={!currentUser}
                  maxLength={1000}
                  className="h-12 w-full rounded-full border border-slate-200 bg-slate-50 pl-5 pr-14 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || !currentUser}
                  aria-label={dt('Dërgo')}
                  className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-blue-700 text-white transition hover:bg-blue-800 disabled:bg-slate-300 dark:disabled:bg-slate-700"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </form>
          )}
        </section>

        {dialog && <ActionDialog dialog={dialog} onClose={() => setDialog(null)} />}
      </div>

      {lightboxOpen && slides.length > 0 && (
        <Lightbox slides={slides} index={Math.min(slideIndex, slides.length - 1)} onIndex={setSlideIndex} onClose={() => setLightboxOpen(false)} />
      )}
    </div>,
    document.body
  );
}

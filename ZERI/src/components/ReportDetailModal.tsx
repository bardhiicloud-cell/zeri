import { dt } from '@/src/lib/dt';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../lib/store';
import { Report } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { sq } from 'date-fns/locale';
import {  ThumbsUp, MessageCircle, MapPin, X, Send, User as UserIcon, Edit3, Save, Trash2, Plus, Share2, Wand2 , ArrowUpRight, ChevronLeft, ChevronRight, ImageOff, FileText, Music, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { validateComment } from '../lib/moderation';
import { useLanguage } from '../lib/LanguageContext';
import { ReportTimeline } from './reports/ReportTimeline';
import { statusLabel } from '../lib/reportStatus';
import { applyTransition } from '../lib/adminApi';

interface ReportDetailModalProps {
  report: Report;
  onClose: () => void;
}

const statusConfig = {
  'Pending Review': { label: 'Në Pritje', classes: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
  'Approved': { label: 'Aprovuar', classes: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  'Assigned': { label: 'Caktuar', classes: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  'In Progress': { label: 'Në Progres', classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  'Resolved': { label: 'E Zgjidhur', classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  'Rejected': { label: 'Refuzuar', classes: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' }
};

export default function ReportDetailModal({ report, onClose }: ReportDetailModalProps) {
  const { t, dt, language } = useLanguage();
  const currentUser = useStore(state => state.currentUser);
  const upvoteReport = useStore(state => state.upvoteReport);
  const updateReport = useStore(state => state.updateReport);
  const addComment = useStore(state => state.addComment);
  const updateReportStatus = useStore(state => state.updateReportStatus);
  
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [resolvingStatus, setResolvingStatus] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState('');
  const mediaScrollRef = useRef<HTMLDivElement>(null);

  const scrollMedia = (direction: -1 | 1) => {
    const mediaTrack = mediaScrollRef.current;
    if (!mediaTrack) return;
    mediaTrack.scrollBy({ left: mediaTrack.clientWidth * direction, behavior: 'smooth' });
  };

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, []);

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

    const total = Math.min(100, catWeight + urgWeight + (upvotesCount * 5) + (commentsCount * 5));
    return total;
  };

  const impactScore = getImpactScore();

  const getImpactLabel = (score: number) => {
    if (score >= 80) return { label: 'Prioritet i Jashtëzakonshëm', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' };
    if (score >= 50) return { label: 'Prioritet i Lartë', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
    return { label: 'Prioritet Normal', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
  };

  const impactInfo = getImpactLabel(impactScore);

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
  const handleStatusChangeClick = async (status: string) => {
    try {
      if (status === 'Resolved') {
        const url = prompt("Ju lutem ngarkoni foton si provë e punës së kryer (Before & After): (Opsionale URL)");
        await updateReportStatus(report.id, status as any, adminResponse || adminReason || "Puna u krye me sukses.", url || undefined);
      } else {
        await updateReportStatus(report.id, status as any, adminResponse || adminReason);
      }
    } catch (error) {
      alert((error as Error)?.message || 'Statusi nuk u ndryshua.');
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
    if (transition === 'staff_return' && returnNote.trim().length < 5) { alert(dt('Shkruani çka mungon ose çka nuk u konfirmua (të paktën 5 shenja).')); return; }
    setVerifying(true);
    try {
      await applyTransition({ reportId: report.id, transition, note: transition === 'staff_return' ? returnNote.trim() : dt('Zgjidhja u verifikua nga platforma.') });
      alert(transition === 'staff_verify' ? dt('Zgjidhja u verifikua; raportimi u mbyll si i zgjidhur.') : dt('Raportimi u kthye te komuna me arsyen tuaj.'));
      setReturnNote('');
    } catch (error) {
      alert((error as Error)?.message || dt('Veprimi dështoi.'));
    } finally { setVerifying(false); }
  };

  const generateAIResponse = async () => {
     if (!adminReason) {
       alert("Ju lutem shënoni një arsye të shkurtër (psh. nuk është pronë komunale).");
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
     } catch(e) {
       console.error(e);
     }
     setAiResponseGenerating(false);
  };

  const handleAddImage = () => {
    const url = prompt("Vendos URL-në e fotos së re:");
    if (url) {
      setEditForm(prev => ({ ...prev, images: [...prev.images, url] }));
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/detailed-registry?report=${encodeURIComponent(report.id)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Raportim: ${report.title}`,
          text: `Shikoni këtë raportim qytetar: "${report.title}"`,
          url: url
        });
      } catch (err) {
        console.error("Gabim gjatë shpërndarjes:", err);
      }
    } else {
      navigator.clipboard.writeText(url);
      alert("Linku është kopjuar!");
    }
  };

  const handleRemoveImage = (index: number) => {
    setEditForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (!currentUser) {
      alert("Kërkohet kyçje për të komentuar.");
      return;
    }

    const validation = validateComment(commentText);
    if (!validation.valid) {
      alert(validation.error);
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

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-center justify-center overflow-hidden p-0 md:p-6" role="dialog" aria-modal="true" aria-label={report.title}>
       <div className="fixed inset-0 bg-slate-900/95 md:backdrop-blur-md transition-opacity" onClick={onClose} />

       <div className="relative flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-black shadow-2xl md:h-[min(90dvh,900px)] md:flex-row md:rounded-2xl md:border md:border-white/15">

         <div className="absolute left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[600] flex items-center justify-between md:left-4 md:right-4 md:top-4">
           <button
             type="button"
             aria-label={dt('Kthehu')}
             onClick={onClose}
             className="hidden items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 py-2 text-xs font-bold text-white backdrop-blur-md transition hover:bg-black/40 md:flex"
           >
             <ChevronLeft className="h-4 w-4" />
             <span>{dt('Kthehu')}</span>
           </button>
           <button aria-label={dt('Mbyll')}
             onClick={onClose}
             className="ml-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60 md:h-12 md:w-12"
           >
             <X className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
           </button>
         </div>

         {/* Left Side: Immersive Image (Reels Style) */}
          <div className="relative flex h-[36dvh] min-h-[220px] max-h-[340px] w-full shrink-0 flex-col overflow-hidden bg-neutral-900 md:h-full md:w-[58%] md:max-h-none">
             {report.resolvedImage ? (
            <div ref={mediaScrollRef} className="absolute inset-0 w-full h-full flex z-0 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                  <div className="w-full h-full flex-shrink-0 snap-center relative">
                     <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900 dark:bg-slate-800 text-white dark:text-white px-3 py-1 text-xs font-bold rounded shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] uppercase tracking-widest border border-slate-700">{dt(`Para Ndërhyrjes`)}</div>
                     <img src={report.images[0] || report.media?.[0]?.url} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="absolute inset-0 w-full h-full object-cover" alt="Para" />
                  </div>
                  <div className="w-full h-full flex-shrink-0 snap-center relative border-l-4 border-emerald-500">
                     <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-emerald-600 text-white px-3 py-1 text-xs font-bold rounded shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] uppercase tracking-widest border border-emerald-500">{dt(`Pas Ndërhyrjes`)}</div>
                     <img src={report.resolvedImage} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="absolute inset-0 w-full h-full object-cover" alt="Pas" />
                  </div>
                  <div className="absolute top-1/2 -mt-4 right-4 z-20 pointer-events-none">
                     <span className="bg-emerald-600/90 text-white text-[10px] uppercase tracking-widest px-2 py-1 rounded backdrop-blur border border-emerald-500/50 whitespace-nowrap shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)]">{dt(`Glisni &rarr;`)}</span>
                  </div>
                </div>
             ) : report.media && report.media.length > 0 ? (
                <div ref={mediaScrollRef} className="absolute inset-0 w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide z-0">
                  {report.media.map((item, idx) => (
                    <div key={idx} className="w-full h-full flex-shrink-0 snap-center relative">
                      {item.type === 'image' ? (
                        <img src={item.url} className="absolute inset-0 w-full h-full object-cover" alt={`${report.title} - ${idx}`} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : item.type === 'video' ? (
                        <video src={item.url} className="absolute inset-0 w-full h-full object-cover pointer-events-auto" controls playsInline />
                      ) : item.type === 'audio' ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900 px-8 text-center">
                          <Music className="h-14 w-14 text-white/40" aria-hidden="true" />
                          <p className="text-sm font-bold text-white">{item.name || dt('Regjistrim audio')}</p>
                          <audio src={item.url} controls preload="metadata" className="w-full max-w-sm" />
                        </div>
                      ) : (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900 px-8 text-center hover:bg-slate-800 transition-colors">
                          <FileText className="h-14 w-14 text-white/40" aria-hidden="true" />
                          <p className="text-sm font-bold text-white">{item.name || dt('Dokument')}</p>
                          <span className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white">
                            <Download className="h-4 w-4" /> {dt('Shkarko dokumentin')}
                          </span>
                        </a>
                      )}
                    </div>
                  ))}
                  {(report.media.length > 1) && (
                    <div className="absolute top-1/2 -mt-4 right-4 z-20 pointer-events-none">
                       <span className="bg-black/60 text-white text-[10px] uppercase tracking-widest px-2 py-1 rounded backdrop-blur whitespace-nowrap">{dt(`Glisni &rarr;`)}</span>
                    </div>
                  )}
                </div>
             ) : report.images && report.images.length > 0 ? (
                <div ref={mediaScrollRef} className="absolute inset-0 z-0 flex h-full w-full snap-x snap-mandatory overflow-x-auto scrollbar-hide">
                  {report.images.map((image, index) => (
                    <div key={`${image}-${index}`} className="relative h-full w-full flex-shrink-0 snap-center">
                      <img src={image} className="absolute inset-0 h-full w-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} alt={`${report.title} - ${index + 1}`} />
                    </div>
                  ))}
                </div>
             ) : (
               <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-white z-0">
                 <ImageOff className="h-10 w-10 text-white/30" aria-hidden="true" />
               </div>
             )}

            {(report.resolvedImage || (report.media?.length ?? 0) > 1 || (report.images?.length ?? 0) > 1) && (
              <div className="pointer-events-none absolute inset-x-3 top-1/2 z-30 flex -translate-y-1/2 justify-between">
                <button
                  type="button"
                  onClick={() => scrollMedia(-1)}
                  aria-label="Media paraprake"
                  className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-950/70 text-white shadow-lg backdrop-blur transition hover:bg-slate-950"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollMedia(1)}
                  aria-label="Media pasuese"
                  className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-950/70 text-white shadow-lg backdrop-blur transition hover:bg-slate-950"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none z-10" />

            <div className="absolute left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.25rem)] z-10 flex items-start justify-between gap-2 md:left-4 md:right-4 md:top-16">
              <div className="bg-black/50 backdrop-blur-md text-white px-3 py-1.5 text-xs font-bold tracking-wide rounded-2xl flex flex-col items-center border border-white/10">
                <span>{formatDistanceToNow(new Date(report.createdAt), { locale: sq })}</span>
              </div>
               <span className={cn("px-3 py-1.5 text-xs font-bold tracking-wide rounded-full border shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)] backdrop-blur-md",
                 report.status === 'Resolved' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' :
                 report.status === 'Rejected' ? 'bg-rose-500/20 text-rose-500 border-rose-500/30' :
                 'bg-amber-500/20 text-amber-500 border-amber-500/30'
               )}>
                 {statusLabel(report.status)}
               </span>
            </div>

            <div className="absolute bottom-0 inset-x-0 flex flex-col p-3 md:p-8 z-10">
              <div className="flex gap-2 flex-wrap mb-2 md:mb-3">
                 <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-bold border border-white/20 tracking-wide rounded-xl w-fit">
                   {dt(report.category)}
                 </span>
                 {report.isAd && (
                   <span className="inline-block px-3 py-1 bg-slate-900 backdrop-blur-md text-white text-xs font-bold border border-slate-900/50 tracking-wide rounded-xl w-fit">{dt(`Sponsorizuar`)}
                   </span>
                 )}
               </div>
               {report.isAd && report.adLink && (
                 <a href={report.adLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold rounded-2xl mb-4 w-fit hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800 transition-colors shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)]">{dt(`Mëso më shumë`)} <ArrowUpRight className="w-4 h-4" />
                 </a>
               )}
               <h2 className="text-lg line-clamp-3 md:line-clamp-none md:text-3xl font-bold text-white mb-1 md:mb-3 leading-tight title-serif drop-shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.3)]">
                 {report.title}
               </h2>
               <p className="hidden md:block text-xs md:text-base text-neutral-200 font-medium line-clamp-3 md:line-clamp-4 drop-shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)] max-w-2xl">
                 {report.description}
               </p>
               <div className="hidden md:flex flex-col sm:flex-row sm:items-center gap-2 md:gap-3 text-neutral-300 text-xs md:text-sm font-medium mt-3 md:mt-4">
                 <div className="flex items-center gap-2">
                   <MapPin className="w-4 h-4 text-red-400" />
                   <span>{report.location?.address || 'Nuk ka adresë'}</span>
                 </div>
                 {report.location?.lat && report.location?.lng && (
                   <a
                     href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${report.location.lat},${report.location.lng}`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded-xl border border-white/20 transition text-xs font-bold w-fit cursor-pointer"
                   >
                     <span>{dt(`Street View 🗺️`)}</span>
                   </a>
                 )}
               </div>
            </div>
         </div>

         {/* Right Side: Operations, Timeline & Comments */}
         <div className="relative z-20 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-slate-900 md:w-[42%] md:flex-none">

            {/* Action Bar & Admin Controls */}
            <div className="p-3 md:p-6 border-b border-neutral-100 dark:border-white/10 flex flex-row flex-wrap items-center justify-between gap-3 sticky top-0 bg-white/95 dark:bg-slate-900/95 z-30 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                   {report.isAnonymous ? (
                     <div className="w-10 h-10 bg-neutral-100 text-neutral-500 dark:text-slate-400 flex items-center justify-center text-lg font-bold rounded-full border border-slate-200/60 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)]">
                        A
                     </div>
                   ) : (
                     <div className="w-10 h-10 bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg font-bold rounded-full border border-indigo-100 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)]">
                        {report.authorName.charAt(0)}
                     </div>
                   )}
                   <div className="flex flex-col">
                     <span className="text-sm font-bold text-slate-900 dark:text-white">{report.authorName}</span>
                     <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400">{dt(`Qytetar Deklarues`)}</span>
                   </div>
                </div>

                <div className="flex items-center gap-2">
                   <button
                      onClick={() => upvoteReport(report.id)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-white/10 rounded-2xl text-slate-700 dark:text-slate-200 transition-colors shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)] group"
                    >
                      <ThumbsUp className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold">{report.upvotes}</span>
                    </button>
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-white/10 hover:border-indigo-200 hover:text-indigo-600 rounded-2xl text-slate-700 dark:text-slate-200 transition-colors shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)] group/share"
                      title={dt(`Shpërndaj Raportimin`)}
                    >
                      <Share2 className="w-4 h-4 group-hover/share:scale-110 transition-transform" />
                    </button>
                    {(currentUser?.role === 'admin' || currentUser?.role === 'approver' || currentUser?.permissions?.includes('reports')) && !isEditing && (
                      <>
                        <button onClick={() => setIsEditing(true)} className="flex items-center justify-center w-8 h-8 bg-neutral-50 text-slate-700 dark:text-slate-300 border border-slate-200/60 hover:bg-neutral-100 rounded-2xl transition-colors shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)]" title={dt(`Edit`)}>
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if(window.confirm('A jeni të sigurt që dëshironi ta fshini?')) {
                              useStore.getState().deleteReport(report.id);
                              onClose();
                            }
                          }}
                          className="flex items-center justify-center w-8 h-8 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-2xl transition-colors shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)]" title={dt(`Delete`)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                </div>
            </div>

            {/* Editing State Overlay or Normal View */}
              <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

              {isEditing && (
                <div className="space-y-4 mb-6 border border-slate-200/60 dark:border-white/10 p-4 bg-neutral-50 dark:bg-slate-800 rounded-2xl shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)]">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 dark:text-slate-200 uppercase tracking-wide border-b border-slate-200/60 dark:border-white/10 pb-2">{dt(`Modifiko Raportin`)}</h3>
                  <input type="text" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl text-sm font-medium outline-none focus:border-indigo-600 text-slate-900 dark:text-white" placeholder={dt(`Titulli...`)} />
                  <textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/60 rounded-2xl h-24 text-sm font-medium outline-none focus:border-indigo-600" placeholder={dt(`Përshkrimi...`)} />
                  <input type="text" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl text-sm font-medium outline-none focus:border-indigo-600 text-slate-900 dark:text-white" placeholder={dt(`Adresa...`)} />
                  <div className="flex gap-2">
                     <button onClick={handleSaveEdit} className="flex-1 py-2 bg-slate-900 dark:bg-slate-800 text-white dark:text-white font-bold text-xs rounded-2xl">{dt(`RUAJ`)}</button>
                     <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/60 font-bold text-xs rounded-2xl">{dt(`ANULO`)}</button>
                  </div>
                </div>
              )}

              {/* Phones: the description and place live here, below the photo, where they can scroll. */}
              <div className="space-y-3 md:hidden">
                {report.description && (
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{report.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-red-500" aria-hidden="true" />
                    {report.location?.address || dt('Nuk ka adresë')}
                  </span>
                  {report.location?.lat && report.location?.lng && (
                    <a
                      href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${report.location.lat},${report.location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 items-center rounded-full border border-slate-200 px-3 text-xs font-bold text-slate-700 dark:border-white/15 dark:text-slate-200"
                    >
                      {dt('Street View 🗺️')}
                    </a>
                  )}
                </div>
              </div>

              {/* Impact / Urgency Progress Bar */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-[1.25rem] border border-slate-200/60 dark:border-white/10/60 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)] animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">{dt(`Indeksi i Ndikimit dhe Urgjencës`)}</span>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border uppercase", impactInfo.color, impactInfo.bg)}>
                    {impactInfo.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{impactScore}%</span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{dt(`nga 100 pikë maksimale`)}</span>
                </div>
                {/* Sleek Progress Bar */}
                <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3.5 relative">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-1000 ease-out",
                      impactScore >= 80 ? "bg-rose-500" :
                      impactScore >= 50 ? "bg-amber-500" :
                      "bg-emerald-500"
                    )}
                    style={{ width: `${impactScore}%` }}
                  />
                </div>
                {/* Breakdown details */}
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 font-medium">{dt(`Kjo vlerë llogaritet automatikisht bazuar në kategorinë`)} <strong className="text-slate-800 dark:text-slate-200 dark:text-slate-200">"{dt(report.category)}"</strong>{dt(`, shkallën e urgjencës`)}{' '}<strong className="text-slate-800 dark:text-slate-200 dark:text-slate-200 font-bold">"{getUrgencyLabel(report.urgency)}"</strong>{' '}{dt(`dhe mbështetjen e`)}{' '}<strong className="text-slate-800 dark:text-slate-200 dark:text-slate-200 font-bold">{report.upvotes} {dt(`qytetarëve`)}</strong>.
                </p>
              </div>

              {/* Status Management */}
              {((currentUser?.role && ['admin', 'approver'].includes(currentUser.role)) || currentUser?.permissions?.includes('reports')) && (
                 <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-[1rem] border border-slate-200/60 dark:border-white/10 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.2)]">
                   {claim.resolutionClaimed === true && ['admin', 'superadmin'].includes(currentUser?.role ?? '') && (
                     <div className="mb-4 space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/30 dark:bg-blue-500/10">
                       <p className="text-xs font-bold text-blue-900 dark:text-blue-200">{dt('Komuna raporton se punimet u kryen. Raportimi mbyllet vetëm pasi ta verifikoni.')}</p>
                       {claim.resolutionClaim?.note && <p className="text-xs text-blue-900/80 dark:text-blue-100/80">{claim.resolutionClaim.note}</p>}
                       {claim.resolutionClaim?.image && <a href={claim.resolutionClaim.image} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-700 underline">{dt('Shiko dëshminë')}</a>}
                       <textarea value={returnNote} onChange={(e) => setReturnNote(e.target.value)} rows={2} maxLength={1000} placeholder={dt('Nëse e ktheni: çka mungon ose çka nuk u konfirmua (e lexon komuna)')} className="w-full rounded-lg border border-blue-200 bg-white p-2 text-xs dark:border-white/10 dark:bg-slate-900" />
                       <div className="flex flex-wrap gap-2">
                         <button type="button" disabled={verifying} onClick={() => void decideClaim('staff_verify')} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{dt('Verifiko zgjidhjen')}</button>
                         <button type="button" disabled={verifying} onClick={() => void decideClaim('staff_return')} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-900 dark:text-slate-200">{dt('Kthe te komuna')}</button>
                       </div>
                     </div>
                   )}
                   <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">{dt(`Përditëso Statusin`)}</h4>
                   <div className="flex flex-wrap gap-2">
                     {report.status === 'Pending Review' && (
                        <button
                          onClick={() => useStore.getState().updateReportStatus(report.id, 'Approved').catch((e: Error) => alert(e.message))}
                          className="px-3 py-1.5 text-xs font-bold rounded-2xl transition-colors border bg-blue-600 border-blue-600 text-white hover:bg-blue-700 w-full mb-2"
                        >{dt(`APROVO RAPORTIMIN (BËJE PUBLIK)`)}
                        </button>
                     )}
                     {Object.keys(statusConfig).map(status => {
                       const isActive = report.status === status;
                       return (
                         <button
                           key={status}
                           onClick={() => handleStatusChangeClick(status)}
                           disabled={isActive}
                           className={cn("px-2.5 py-1.5 text-xs font-bold rounded-2xl transition-colors border", isActive ? "bg-slate-900 border-slate-900 text-white" : "bg-white dark:bg-slate-900 border-slate-200/60 text-slate-700 dark:text-slate-300 hover:bg-neutral-50")}
                         >
                           {dt(status)}
                         </button>
                       );
                     })}
                   </div>

                   <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-white/10">
                     <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{dt(`Auto-Pilot AI për Përgjigje Zyrtare`)}</h4>
                     <input 
                       type="text" 
                       value={adminReason} 
                       onChange={(e) => setAdminReason(e.target.value)}
                       placeholder={dt(`Arsyeja e shkurtër (p.sh. Rruga jashtë pronësisë komunale)...`)}
                       className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 px-3 py-2 rounded-2xl text-sm mb-2 focus:outline-none focus:border-indigo-600"
                     />
                     <button
                       onClick={generateAIResponse}
                       disabled={aiResponseGenerating || !adminReason}
                       className="flex items-center gap-2 justify-center w-full px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-2xl text-xs font-bold uppercase transition hover:bg-indigo-100 disabled:opacity-50"
                     >
                       <Wand2 className="w-4 h-4" />
                       {aiResponseGenerating ? 'Duke gjeneruar...' : 'GJENERO PËRGJIGJEN ME AI'}
                     </button>
                     {adminResponse && (
                       <textarea 
                         value={adminResponse}
                         onChange={(e) => setAdminResponse(e.target.value)}
                         className="w-full mt-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 px-3 py-2 rounded-2xl text-sm h-32 focus:outline-none focus:border-indigo-600"
                       />
                     )}
                   </div>
                 </div>
              )}

              {/* Lifecycle Timeline — same canonical component the citizen sees on Track ID */}
              <div className="mt-6">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-4">{dt('Historia e trajtimit (Timeline)')}</h3>
                <ReportTimeline events={report.timeline || []} />
              </div>

              {/* Comments Section */}
              <div className="mt-6">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 dark:text-slate-200 uppercase tracking-wide mb-4">{dt(`Mendimet e Qytetarëve (`)}{report.commentsCount})</h3>
                {(!report.comments || report.comments.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-8 opacity-60">
                    <MessageCircle className="w-8 h-8 mb-2 text-neutral-400" />
                    <p className="text-xs font-semibold text-neutral-500 dark:text-slate-400">{dt(`Nuk ka asnjë koment.`)}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {report.comments.map(comment => (
                      <div key={comment.id} className="flex gap-3">
                        <div className="w-8 h-8 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center shrink-0">
                          <UserIcon className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div>
                          <div className="bg-neutral-50 dark:bg-slate-800 border border-neutral-100 dark:border-white/10 px-3 py-2 rounded-[1rem] rounded-tl-none">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 dark:text-slate-200 mr-2">{comment.authorName}</span>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 dark:text-slate-300">{comment.content}</span>
                          </div>
                          <span className="text-[10px] text-neutral-400 font-medium ml-1 mt-1 block">
                            {formatDistanceToNow(new Date(comment.createdAt), { locale: sq, addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comment Input */}
            <div className="border-t border-neutral-100 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-white/10 dark:bg-slate-900 sticky bottom-0 z-30 md:p-4">
              <form onSubmit={handleAddComment} className="flex gap-2 relative">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={currentUser ? dt('Shto një koment...') : dt('Identifikohu për të komentuar...')}
                  disabled={!currentUser}
                  className="w-full bg-neutral-100 dark:bg-slate-800 border-none px-4 py-3 rounded-full text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 placeholder:text-neutral-500 dark:placeholder:text-slate-400 disabled:opacity-50"
                />
                <button 
                   type="submit"
                   disabled={!commentText.trim() || !currentUser}
                   aria-label={dt('Dërgo')} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                 >
                   <Send className="w-3.5 h-3.5 -ml-0.5" />
                 </button>
              </form>
            </div>
         </div>
       </div>
    </div>,
    document.body
  );
}

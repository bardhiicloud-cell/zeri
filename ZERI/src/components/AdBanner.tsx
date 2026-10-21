import { dt } from '@/src/lib/dt';
import React, { useEffect, useId, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import { isSpecificScope, scopeKey } from '../lib/municipalityScope';
import { 
  ExternalLink, Phone, MessageCircle, Mail, Sparkles, 
  Building2, MapPin, Eye, Zap, CheckCircle2, X, Send, Award
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
const SanitizedAdHtml = React.lazy(() => import('./SanitizedAdHtml'));
import toast from 'react-hot-toast';
import { realContactOrEmpty } from '../lib/placeholderContacts';

interface AdBannerProps {
  position: any;
  className?: string;
  municipality?: string;
}

const getSectionFromPath = (path: string): string => {
  if (path === '/' || path.startsWith('/ballina')) return 'ballina';
  if (path.startsWith('/raporto')) return 'raporto';
  if (path.startsWith('/harta')) return 'harta';
  if (path.startsWith('/sondazhe')) return 'sondazhet';
  if (path.startsWith('/asistenti-ai')) return 'asistenti-ai';
  if (path.startsWith('/chat')) return 'bisedo';
  if (path.startsWith('/kontakte')) return 'numrat';
  if (path.startsWith('/donacion')) return 'donacione';
  if (path.startsWith('/komunat')) return 'komunat';
  if (path.startsWith('/sherbimet')) return 'sherbimet';
  if (path.startsWith('/projektet')) return 'projektet';
  if (path.startsWith('/lajme') || path.startsWith('/lajmet')) return 'lajme';
  if (path.startsWith('/kontakt')) return 'kontakt';
  if (path.startsWith('/rreth-projektit') || path.startsWith('/rreth-nesh')) return 'rreth-projektit';
  if (path.startsWith('/statistikat')) return 'statistikat';
  if (path.startsWith('/shendetesia') || path.startsWith('/semundjet')) return 'shendetesia';
  if (path.startsWith('/detailed-registry') || path.startsWith('/regjistri') || path.startsWith('/registry')) return 'raportimet';
  //
  // The routes below are real pages that were missing from this map, so an
  // advertiser who bought "Banka e Ideve" or "Debati Publik" had their campaign
  // silently served under 'ballina' instead. Every routed public page now has
  // a section, which is the contract the admin panel's section picker assumes.
  //
  if (path.startsWith('/forum')) return 'forum';
  if (path.startsWith('/Idea') || path.startsWith('/idea')) return 'idea';
  if (path.startsWith('/ndihma')) return 'ndihma';
  if (path.startsWith('/trackid')) return 'trackid';
  if (path.startsWith('/kushtet-e-perdorimit') || path.startsWith('/terms')) return 'kushtet';
  if (path.startsWith('/privatesia') || path.startsWith('/politika')) return 'privatesia';
  return 'ballina';
};

export default function AdBanner({ position, className, municipality }: AdBannerProps) {
  const ads = useStore(state => state.ads);
  const systemSettings = useStore(state => state.systemSettings);
  const userMunicipality = useStore(state => state.userMunicipality);
  const incrementAdView = useStore(state => state.incrementAdView);
  const incrementAdClick = useStore(state => state.incrementAdClick);
  const location = useLocation();
  const dialogTitleId = useId();

  const [activeAd, setActiveAd] = useState<any>(null);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    businessName: '',
    phone: '',
    email: '',
    notes: ''
  });

  useEffect(() => {
    const currentSection = getSectionFromPath(location.pathname);
    const selectedMunicipality = isSpecificScope(municipality)
      ? scopeKey(municipality)
      : isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : undefined;

    // Filter matching ads based on status, position, and target
    const targetAds = ads.filter(ad =>
      ad.status === 'active' &&
      (ad.position === position ||
        (position === 'banner' && ad.position === 'bottom') ||
        (position === 'sidebar' && ad.position === 'floating')) &&
      (ad.target === 'Nacionale' ||
        (selectedMunicipality !== undefined && scopeKey(ad.target) === selectedMunicipality))
    );

    let eligibleAds = targetAds.filter(ad => ad.section === currentSection);

    // Use a campaign for this section, or one explicitly marked as global.
    if (eligibleAds.length === 0) {
      eligibleAds = targetAds.filter(ad => !ad.section || ad.section === 'all' || ad.section === 'global');
    }

    if (eligibleAds.length > 0) {
      // Pick a random eligible ad to avoid showing the same one always
      const selected = eligibleAds[Math.floor(Math.random() * eligibleAds.length)];
      setActiveAd(selected);
      incrementAdView(selected.id);
    } else {
      setActiveAd(null);
    }
  }, [
    position,
    municipality,
    userMunicipality,
    (ads || []).map(ad =>
      `${ad.id}:${ad.status}:${ad.position}:${ad.section}:${ad.target}:${ad.mediaType}:${ad.mediaUrl}:${ad.title}:${ad.targetUrl}`
    ).join(','),
    location.pathname
  ]);

  // A new creative gets a fresh chance to load; only the failed one is hidden.
  useEffect(() => {
    setMediaFailed(false);
  }, [activeAd?.id, activeAd?.mediaUrl]);

  // The inquiry dialog behaves like every other modal on the site: Escape closes
  // it, and the page behind it stops scrolling so a phone user is not dragging
  // the page under the form.
  useEffect(() => {
    if (!showInquiryModal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowInquiryModal(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showInquiryModal]);

  const handleClick = () => {
    if (!activeAd) return;

    const targetUrl = typeof activeAd.targetUrl === 'string' ? activeAd.targetUrl.trim() : '';
    if (activeAd.mediaType !== 'html' && targetUrl) {
      incrementAdClick(activeAd.id);
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryForm.name || !inquiryForm.phone) {
      toast.error(dt('Ju lutemi plotësoni emrin dhe numrin e telefonit'));
      return;
    }

    // Same contract as AdRequestModal: the create rule needs the signed-in uid.
    const uid = auth.currentUser?.uid;
    if (!uid) {
      toast.error(dt('Kyçuni për të dërguar kërkesën, ose na telefononi direkt.'));
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'adRequests'), {
        userId: uid,
        name: inquiryForm.name.trim(),
        businessName: inquiryForm.businessName.trim(),
        phone: inquiryForm.phone.trim(),
        contactPhone: inquiryForm.phone.trim(),
        contactEmail: inquiryForm.email.trim(),
        userEmail: inquiryForm.email.trim(),
        targetMunicipality: municipality || 'Të gjitha Komunat',
        postId: `Pozicioni: ${position} | Komuna: ${municipality || 'Nacionale'}`,
        adNotes: inquiryForm.notes.trim(),
        notes: inquiryForm.notes.trim(),
        status: 'pending',
        createdAt: serverTimestamp()
      });

      toast.success(dt('Kërkesa u dërgua me sukses! Do t\'ju kontaktojmë së shpejti.'));
      setShowInquiryModal(false);
      setInquiryForm({ name: '', businessName: '', phone: '', email: '', notes: '' });
    } catch (err) {
      console.error('Gabim gjatë dërgimit të kërkesës:', err);
      toast.error(dt('Ndodhi një gabim. Ju lutemi provoni përsëri ose na telefononi direkt.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const widthClass = ['sidebar', 'mobile-nav', 'map', 'auth', 'modal'].includes(position as any) ? 'w-full' : 'w-full max-w-4xl mx-auto';

  let heightClass = 'min-h-[100px]';
  const pos = position as string;
  if (pos === 'top') heightClass = 'h-[76px] min-h-0';
  else if (pos === 'article') heightClass = 'min-h-[140px]';
  else if (pos === 'auth') heightClass = 'min-h-[250px] aspect-video sm:aspect-square md:aspect-auto md:h-[300px]';
  else if (pos === 'sidebar') heightClass = 'min-h-[180px]';
  else if (pos === 'mobile-nav') heightClass = 'min-h-[140px]';
  else if (pos === 'feed') heightClass = 'min-h-20 sm:min-h-24';
  else if (pos === 'modal') heightClass = 'min-h-[100px]';
  //
  // `banner` is the strategic long-form slot used at page footers, after the
  // ideas bank and below a long article. It is a fixed height rather than a
  // minimum so it can never push the following content off screen, and it is
  // capped at 4xl so on a wide monitor it reads as a card and not as a
  // full-bleed billboard.
  //
  else if (pos === 'banner') heightClass = 'h-[120px] min-h-0';

  // Strips (`top`, `banner`) are too short for a stacked title + call to action;
  // they lay the two out side by side instead of letting the title overflow.
  const isStrip = pos === 'top' || pos === 'banner';

  const baseStyle = cn(
    // `isolate` keeps the -z-10 surface behind the creative but above the page.
    "bg-slate-50 dark:bg-slate-800 relative isolate group overflow-hidden flex flex-col justify-center cursor-pointer transition duration-300",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
    pos === 'floating'
       ? "border border-slate-200/60 dark:border-white/10"
       : "border border-slate-200/60 dark:border-white/10 rounded-xl hover:-translate-y-0.5 hover:shadow-md",
    widthClass,
    heightClass,
    className
  );

  if (activeAd) {
    const adTargetUrl = typeof activeAd.targetUrl === 'string' ? activeAd.targetUrl.trim() : '';
    const isClickable = activeAd.mediaType !== 'html' && Boolean(adTargetUrl);
    const showMedia = !mediaFailed;

    return (
      <div
        onClick={handleClick}
        onKeyDown={(event) => {
          if (isClickable && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            handleClick();
          }
        }}
        role={isClickable ? 'link' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        aria-label={isClickable ? `${dt('Reklamë')}: ${activeAd.title ?? ''}` : undefined}
        className={cn(baseStyle, !isClickable && 'cursor-default')}
      >
        <div className="absolute top-0 right-0 z-10 flex items-center gap-1 rounded-bl-lg bg-slate-900/90 px-2.5 py-0.5 backdrop-blur-sm rtl:left-0 rtl:right-auto rtl:rounded-bl-none rtl:rounded-br-lg">
          <span className="text-xs font-bold tracking-wider text-white uppercase">{dt(`Sponzorizuar`)}</span>
        </div>

        <div className="absolute inset-0 -z-10 bg-(--color-sponsor-surface)" />

        {showMedia && (activeAd.mediaType === 'image' || activeAd.mediaType === 'gif') && (
          <img
            src={activeAd.mediaUrl}
            alt={activeAd.title ?? ''}
            loading="lazy"
            decoding="async"
            onError={() => setMediaFailed(true)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}

        {showMedia && activeAd.mediaType === 'video' && (
          <video
            src={activeAd.mediaUrl}
            muted
            playsInline
            autoPlay
            loop
            preload="metadata"
            aria-hidden="true"
            onError={() => setMediaFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {activeAd.mediaType === 'html' && (
          <div className="absolute inset-0 w-full h-full overflow-hidden">
            <React.Suspense fallback={null}>
              <SanitizedAdHtml html={activeAd.mediaUrl} />
            </React.Suspense>
          </div>
        )}

        {/* Overlay content only if it's not HTML to ensure text readability */}
        {activeAd.mediaType !== 'html' && (
           <div
             className={cn(
               "absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/10 opacity-95 group-hover:opacity-100 transition-opacity",
               isStrip
                 ? "flex flex-row items-end justify-between gap-3 px-3 pb-2.5 pt-6 sm:px-5"
                 : "flex flex-col justify-end p-4 sm:p-5"
             )}
           >
              <h4
                className={cn(
                  "min-w-0 font-bold text-white leading-tight drop-shadow-sm",
                  isStrip
                    ? "line-clamp-2 text-xs sm:text-sm md:text-base"
                    : "mb-1.5 line-clamp-3 text-sm sm:text-base md:text-lg tracking-wide"
                )}
              >
                {activeAd.title}
              </h4>
              {isClickable && (
                <p
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 text-xs font-bold tracking-wide text-rose-200",
                    isStrip && "rounded-full bg-white/15 px-2.5 py-1 backdrop-blur-sm"
                  )}
                >
                  {dt(`Shiko Ofertën`)} <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                </p>
              )}
           </div>
        )}
      </div>
    );
  }

  /**
   * Empty slots that render nothing.
   *
   * `floating`, `modal` and `auth` are reserved: an unfilled floating banner is
   * an overlay, and an overlay advertising "space for sale" is the pattern
   * every scam site uses. The same reasoning now covers `banner` and `feed`: a
   * placeholder is not shown at the end of a page or inside a discussion, it
   * simply does not render. `top`, `sidebar` and `inline` keep their placeholders
   * because those are the positions an advertiser buys by looking at the site.
   */
  if (['floating', 'modal', 'auth', 'map', 'banner'].includes(position)) return null;

  // Contact Info from System Settings (administered in Admin panel) - NO PRICES
  const contactPhone = realContactOrEmpty(systemSettings?.adContactPhone);
  const contactEmail = realContactOrEmpty(systemSettings?.adContactEmail);
  const companyName = systemSettings?.adContactCompanyName || 'Platforma Qytetare Reklama';
  const adSlogan = systemSettings?.adSlogan || 'Përzgjidhni hapësirën që i përshtatet biznesit tuaj dhe promovoni shërbimet tuaja në platformë.';
  const cleanPhone = contactPhone.replace(/\s+/g, '');
  const cleanWhatsApp = (realContactOrEmpty(systemSettings?.adWhatsApp) || contactPhone || '').replace(/[^0-9+]/g, '');

  const isCompact = ['sidebar', 'mobile-nav'].includes(pos);

  return (
    <>
      <div 
        onClick={() => setShowInquiryModal(true)}
        onKeyDown={(event) => {
          // Only the card itself; Enter on the phone/WhatsApp links inside must still follow them.
          if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            setShowInquiryModal(true);
          }
        }}
        // A group, not a button: the call and WhatsApp links inside are real
        // interactive elements and must not be nested in a button role.
        role="group"
        tabIndex={0}
        aria-label={dt('Kërkesë për Reklamim')}
        className={cn(
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
          "relative overflow-hidden group border border-slate-200/80 dark:border-white/5 bg-slate-50/40 dark:bg-slate-900/20 backdrop-blur-xl rounded-xl transition duration-300 cursor-pointer flex flex-col justify-center",
          "hover:bg-white dark:hover:bg-slate-800/60 hover:shadow-lg hover:shadow-slate-200/20 dark:hover:shadow-black/20 hover:border-blue-200/80 dark:hover:border-blue-900/40",
          isCompact ? "p-3 sm:p-4" : "p-4",
          widthClass,
          className
        )}
      >
        {/* Subtle Ambient Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 to-transparent dark:from-blue-500/5 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        {isCompact ? (
          /* Compact Vertical View (Sidebars) */
          <div className="flex flex-col gap-2 relative z-10 w-full">
            <div className="flex items-center justify-between w-full">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/60 dark:bg-black/20 rounded border border-slate-200/50 dark:border-white/5 shadow-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-(--color-brand-primary)"></span>
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {dt('Hapësirë reklamimi')}
                </span>
              </div>
              {municipality && municipality !== 'Të gjitha Komunat' && (
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" /> {municipality}
                </span>
              )}
            </div>
            
            <div className="mt-0.5">
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 leading-tight">
                {dt('Arrini qytetarët që lexojnë lajmet lokale')}
              </h4>
              <ul className="mt-1.5 space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                <li className="flex gap-1.5"><span aria-hidden="true" className="text-emerald-600">✓</span>{dt('Synim sipas komunës suaj')}</li>
                <li className="flex gap-1.5"><span aria-hidden="true" className="text-emerald-600">✓</span>{dt('Pranë përmbajtjes që lexohet çdo ditë')}</li>
                <li className="flex gap-1.5"><span aria-hidden="true" className="text-emerald-600">✓</span>{dt('Fushatë e shënuar qartë si reklamë')}</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowInquiryModal(true); }}
              className="mt-1.5 min-h-9 w-full rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-black text-white shadow-sm transition-colors hover:bg-blue-800"
            >
              {dt('Kërko ofertë')}
            </button>
            <div className="flex items-center gap-1.5">
              {cleanPhone && (
<a
                href={`tel:${cleanPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-h-9 py-1.5 bg-white dark:bg-slate-950 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors border border-slate-100 dark:border-white/5 hover:border-blue-200 dark:hover:border-blue-800 shadow-sm"
              >
                <Phone className="w-3 h-3" aria-hidden="true" />
                <span>{dt('Kliko e thirr')}</span>
              </a>
)}
              {cleanWhatsApp && (
<a
                href={`https://wa.me/${cleanWhatsApp.replace('+', '')}?text=${encodeURIComponent(dt('Përshëndetje! Jam i interesuar për reklamim në platformën Qytetari.'))}`}
                onClick={(e) => e.stopPropagation()}
                target="_blank"
                rel="noreferrer"
                className="flex-1 min-h-9 py-1.5 bg-white dark:bg-slate-950 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors border border-slate-100 dark:border-white/5 hover:border-emerald-200 dark:hover:border-emerald-800 shadow-sm"
              >
                <MessageCircle className="w-3 h-3" aria-hidden="true" />
                <span>{dt('WhatsApp')}</span>
              </a>
)}
            </div>
          </div>
        ) : (
          /* Wide Horizontal View (Feed / Top) */
          <div className="flex flex-row items-center justify-between gap-3 sm:gap-4 relative z-10 w-full">
            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden sm:flex w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200/50 dark:border-white/5 flex items-center justify-center text-blue-500 shrink-0 shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/60 dark:bg-black/20 rounded border border-slate-200/50 dark:border-white/5 shadow-sm">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-(--color-brand-primary)"></span>
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      {dt('Hapësirë reklamimi')}
                    </span>
                  </div>
                  {municipality && municipality !== 'Të gjitha Komunat' && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-slate-800 border border-slate-200/50 dark:border-white/5 px-1.5 py-0.5 rounded shadow-sm">
                      <MapPin className="w-2.5 h-2.5" /> {municipality}
                    </span>
                  )}
                </div>
                <h4 className="line-clamp-2 text-[13px] sm:text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight mt-0.5">
                  {dt('Vendosni biznesin tuaj para qytetarëve të komunës suaj')}
                </h4>
                <p className="mt-1 hidden max-w-2xl text-xs sm:block leading-relaxed text-slate-600 dark:text-slate-300">{adSlogan}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowInquiryModal(true); }}
                className="min-h-10 whitespace-nowrap px-3 sm:px-4 py-2 rounded-lg bg-blue-700 text-xs font-black text-white shadow-sm transition-colors hover:bg-blue-800"
              >
                {dt('Kërko ofertë')}
              </button>
              {cleanPhone && (
<a
                href={`tel:${cleanPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="hidden sm:flex min-h-10 px-3.5 py-2 bg-white dark:bg-slate-950 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-100 dark:border-white/5 hover:border-blue-200 dark:hover:border-blue-800 shadow-sm"
              >
                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{contactPhone}</span>
                <span className="inline sm:hidden">{dt('Kliko e thirr')}</span>
              </a>
)}
              {cleanWhatsApp && (
<a
                href={`https://wa.me/${cleanWhatsApp.replace('+', '')}?text=${encodeURIComponent(dt('Përshëndetje! Jam i interesuar për reklamim në platformën Qytetari.'))}`}
                onClick={(e) => e.stopPropagation()}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex min-h-10 px-3.5 py-2 bg-white dark:bg-slate-950 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-100 dark:border-white/5 hover:border-emerald-200 dark:hover:border-emerald-800 shadow-sm"
              >
                <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{dt('WhatsApp')}</span>
              </a>
)}
            </div>
          </div>
        )}
      </div>

      {/* Direct Ad Inquiry Modal */}
      {showInquiryModal && (
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center overflow-y-auto bg-slate-900/60 p-0 md:backdrop-blur-md animate-in fade-in duration-200 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowInquiryModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="relative max-h-[100dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[92dvh] sm:rounded-2xl sm:p-6 md:p-8 dark:border-white/10 dark:bg-slate-900"
          >
            <button
              type="button"
              onClick={() => setShowInquiryModal(false)}
              aria-label={dt('Mbyll')}
              className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:text-slate-800 rtl:left-3 rtl:right-auto dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            <div className="mb-6 flex items-center gap-3 pe-10">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-900/60 text-blue-600 flex items-center justify-center shadow-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 id={dialogTitleId} className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  {dt('Kërkesë për Reklamim')}
                </h3>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                  {dt('Pozicioni:')} <strong className="text-slate-700 dark:text-slate-200 capitalize">{position}</strong> {municipality && municipality !== 'Të gjitha Komunat' ? `• ${municipality}` : ''}
                </p>
              </div>
            </div>
            <form onSubmit={handleInquirySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  {dt('Emri & Mbiemri *')}
                </label>
                <input
                  type="text"
                  required
                  value={inquiryForm.name}
                  onChange={e => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                  placeholder={dt('psh. Agron Krasniqi')}
                  className="w-full min-h-11 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-base sm:text-sm outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  {dt('Emri i Biznesit / Kompanisë')}
                </label>
                <input
                  type="text"
                  value={inquiryForm.businessName}
                  onChange={e => setInquiryForm({ ...inquiryForm, businessName: e.target.value })}
                  placeholder={dt('psh. Auto Servis Prishtina')}
                  className="w-full min-h-11 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-base sm:text-sm outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium transition-colors"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {dt('Numri i Telefonit *')}
                  </label>
                  <input
                    type="tel"
                    required
                    value={inquiryForm.phone}
                    onChange={e => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                    placeholder={dt('+383 4X XXX XXX')}
                    className="w-full min-h-11 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-base sm:text-sm outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {dt('Email Adresa')}
                  </label>
                  <input
                    type="email"
                    value={inquiryForm.email}
                    onChange={e => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                    placeholder={dt('info@kompania.com')}
                    className="w-full min-h-11 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-base sm:text-sm outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  {dt('Shënime ose format i preferuar')}
                </label>
                <textarea
                  rows={2}
                  value={inquiryForm.notes}
                  onChange={e => setInquiryForm({ ...inquiryForm, notes: e.target.value })}
                  placeholder={dt('psh. Dëshiroj reklamë në Ballinë dhe Hartë për 1 muaj')}
                  className="w-full min-h-11 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-base sm:text-sm outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium transition-colors custom-scrollbar"
                />
              </div>
              <div className="pt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3 border-t border-slate-100 dark:border-white/10 mt-2">
                <button
                  type="button"
                  onClick={() => setShowInquiryModal(false)}
                  className="min-h-11 px-5 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {dt('Anulo')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-11 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black tracking-wide flex items-center gap-2 shadow-md shadow-blue-500/20 transition active:scale-95"
                >
                  <Send className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />
                  <span>{isSubmitting ? dt('Po dërgohet...') : dt('Dërgo Kërkesën')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

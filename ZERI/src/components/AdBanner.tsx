import { dt } from '@/src/lib/dt';
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import { isSpecificScope, scopeKey } from '../lib/municipalityScope';
import { 
  ExternalLink, Phone, MessageCircle, Mail, Sparkles, 
  Building2, MapPin, Eye, Zap, CheckCircle2, X, Send, Award
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

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

  const [activeAd, setActiveAd] = useState<any>(null);
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
      toast.error('Ju lutemi plotësoni emrin dhe numrin e telefonit');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'adRequests'), {
        name: inquiryForm.name,
        businessName: inquiryForm.businessName || '',
        phone: inquiryForm.phone,
        userEmail: inquiryForm.email || '',
        postId: `Pozicioni: ${position} | Komuna: ${municipality || 'Nacionale'}`,
        notes: inquiryForm.notes || '',
        status: 'pending',
        createdAt: serverTimestamp()
      });

      toast.success('Kërkesa u dërgua me sukses! Do t\'ju kontaktojmë së shpejti.');
      setShowInquiryModal(false);
      setInquiryForm({ name: '', businessName: '', phone: '', email: '', notes: '' });
    } catch (err) {
      console.error('Gabim gjatë dërgimit të kërkesës:', err);
      toast.error('Ndodhi një gabim. Ju lutemi provoni përsëri ose na telefononi direkt.');
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

  const baseStyle = cn(
    "bg-slate-50 dark:bg-slate-800 relative group overflow-hidden flex flex-col justify-center cursor-pointer transition-all duration-300",
    pos === 'floating'
       ? "border border-slate-200/60"
       : "border border-slate-200/60 dark:border-white/10 rounded-xl hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 rounded-xl",
    widthClass,
    heightClass,
    className
  );

  if (activeAd) {
    return (
      <div
        onClick={handleClick}
        className={baseStyle}
      >
        <div className="absolute top-0 right-0 flex items-center gap-1 z-10 bg-slate-900/90 backdrop-blur-sm px-2.5 py-0.5 rounded-bl-lg">
          <span className="text-[10px] font-bold tracking-wider text-white uppercase">{dt(`Sponzorizuar`)}</span>
        </div>

        <div className="absolute inset-0 -z-10 bg-(--color-sponsor-surface)" />

        {activeAd.mediaType === 'image' && (
          <img src={activeAd.mediaUrl} alt={activeAd.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        )}

        {activeAd.mediaType === 'video' && (
          <video src={activeAd.mediaUrl} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
        )}

        {activeAd.mediaType === 'html' && (
          <div className="absolute inset-0 w-full h-full overflow-hidden" dangerouslySetInnerHTML={{ __html: ((window as any).DOMPurify ? (window as any).DOMPurify.sanitize : (x: string) => x)(activeAd.mediaUrl, { ALLOWED_TAGS: ['iframe', 'img', 'div', 'span', 'a'], ALLOWED_ATTR: ['src', 'href', 'class', 'style', 'width', 'height', 'frameborder', 'allowfullscreen', 'sandbox'] }) }} />
        )}

        {/* Overlay content only if it's not HTML to ensure text readability */}
        {activeAd.mediaType !== 'html' && (
           <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent flex flex-col justify-end p-4 sm:p-5 opacity-90 group-hover:opacity-100 transition-opacity">
              <h4 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-wide leading-tight mb-1.5 drop-shadow-sm">
                {activeAd.title}
              </h4>
              <p className="text-xs text-rose-300 font-bold tracking-wide flex items-center gap-1.5 transition-colors">
                {dt(`Shiko Ofertën`)} <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </p>
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
  const contactPhone = systemSettings?.adContactPhone || '+383 44 123 456';
  const contactEmail = systemSettings?.adContactEmail || 'reklama@qytetari.ks';
  const companyName = systemSettings?.adContactCompanyName || 'Platforma Qytetare Reklama';
  const adSlogan = systemSettings?.adSlogan || 'Përzgjidhni hapësirën që i përshtatet biznesit tuaj dhe promovoni shërbimet tuaja në platformë.';
  const cleanPhone = contactPhone.replace(/\s+/g, '');
  const cleanWhatsApp = (systemSettings?.adWhatsApp || contactPhone).replace(/[^0-9+]/g, '');

  const isCompact = ['sidebar', 'mobile-nav'].includes(pos);

  return (
    <>
      <div 
        onClick={() => setShowInquiryModal(true)}
        className={cn(
          "relative overflow-hidden group border border-slate-200/80 dark:border-white/5 bg-slate-50/40 dark:bg-slate-900/20 backdrop-blur-xl rounded-xl transition-all duration-300 cursor-pointer flex flex-col justify-center",
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
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {dt('Reklamoni Këtu')}
                </span>
              </div>
              {municipality && municipality !== 'Të gjitha Komunat' && (
                <span className="text-[9px] font-bold text-slate-400 flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" /> {municipality}
                </span>
              )}
            </div>
            
            <div className="mt-0.5">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 leading-tight">
                {dt('Lidheni Biznesin Tuaj Këtu')}
              </h4>
              <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                {dt('Arritni qytetarët lokalë me një prezencë premium.')}
              </p>
            </div>

            <div className="flex items-center gap-1.5 mt-1.5">
              <a
                href={`tel:${cleanPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 py-1.5 bg-white dark:bg-slate-950 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 transition-colors border border-slate-100 dark:border-white/5 hover:border-blue-200 dark:hover:border-blue-800 shadow-sm"
              >
                <Phone className="w-2.5 h-2.5" />
                <span>{dt('Kliko e thirr')}</span>
              </a>
              <a
                href={`https://wa.me/${cleanWhatsApp.replace('+', '')}?text=${encodeURIComponent('Përshëndetje! Jam i interesuar për reklamim në platformën Qytetari.')}`}
                onClick={(e) => e.stopPropagation()}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-1.5 bg-white dark:bg-slate-950 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 transition-colors border border-slate-100 dark:border-white/5 hover:border-emerald-200 dark:hover:border-emerald-800 shadow-sm"
              >
                <MessageCircle className="w-2.5 h-2.5" />
                <span>{dt('WhatsApp')}</span>
              </a>
            </div>
          </div>
        ) : (
          /* Wide Horizontal View (Feed / Top) */
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10 w-full">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200/50 dark:border-white/5 flex items-center justify-center text-blue-500 shrink-0 shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/60 dark:bg-black/20 rounded border border-slate-200/50 dark:border-white/5 shadow-sm">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-(--color-brand-primary)"></span>
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      {dt('Hapësira Reklamimi e Lirë')}
                    </span>
                  </div>
                  {municipality && municipality !== 'Të gjitha Komunat' && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-slate-400 bg-white/50 dark:bg-slate-800 border border-slate-200/50 dark:border-white/5 px-1.5 py-0.5 rounded shadow-sm">
                      <MapPin className="w-2.5 h-2.5" /> {municipality}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight mt-0.5">
                  {dt('Promovoni Biznesin Tuaj Këtu – Bëhuni Pjesë e Komunës')}
                </h4>
                <p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{adSlogan}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href={`tel:${cleanPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-white dark:bg-slate-950 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-100 dark:border-white/5 hover:border-blue-200 dark:hover:border-blue-800 shadow-sm"
              >
                <Phone className="w-3 h-3" />
                <span className="hidden sm:inline">{contactPhone}</span>
                <span className="inline sm:hidden">{dt('Kliko e thirr')}</span>
              </a>
              <a
                href={`https://wa.me/${cleanWhatsApp.replace('+', '')}?text=${encodeURIComponent('Përshëndetje! Jam i interesuar për reklamim në platformën Qytetari.')}`}
                onClick={(e) => e.stopPropagation()}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-none px-3.5 py-2 bg-white dark:bg-slate-950 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-100 dark:border-white/5 hover:border-emerald-200 dark:hover:border-emerald-800 shadow-sm"
              >
                <MessageCircle className="w-3 h-3" />
                <span>{dt('WhatsApp')}</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Direct Ad Inquiry Modal */}
      {showInquiryModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setShowInquiryModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full transition-colors bg-slate-50 dark:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-900/60 text-blue-600 flex items-center justify-center shadow-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  {dt('Kërkesë për Reklamim')}
                </h3>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  {dt('Pozicioni:')} <strong className="text-slate-700 dark:text-slate-200 capitalize">{position}</strong> {municipality && municipality !== 'Të gjitha Komunat' ? `• ${municipality}` : ''}
                </p>
              </div>
            </div>
            <form onSubmit={handleInquirySubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                  {dt('Emri & Mbiemri *')}
                </label>
                <input
                  type="text"
                  required
                  value={inquiryForm.name}
                  onChange={e => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                  placeholder={dt('psh. Agron Krasniqi')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                  {dt('Emri i Biznesit / Kompanisë')}
                </label>
                <input
                  type="text"
                  value={inquiryForm.businessName}
                  onChange={e => setInquiryForm({ ...inquiryForm, businessName: e.target.value })}
                  placeholder={dt('psh. Auto Servis Prishtina')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium transition-colors"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                    {dt('Numri i Telefonit *')}
                  </label>
                  <input
                    type="tel"
                    required
                    value={inquiryForm.phone}
                    onChange={e => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                    placeholder={dt('+383 4X XXX XXX')}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                    {dt('Email Adresa')}
                  </label>
                  <input
                    type="email"
                    value={inquiryForm.email}
                    onChange={e => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                    placeholder={dt('info@kompania.com')}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                  {dt('Shënime ose format i preferuar')}
                </label>
                <textarea
                  rows={2}
                  value={inquiryForm.notes}
                  onChange={e => setInquiryForm({ ...inquiryForm, notes: e.target.value })}
                  placeholder={dt('psh. Dëshiroj reklamë në Ballinë dhe Hartë për 1 muaj')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium transition-colors custom-scrollbar"
                />
              </div>
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/10 mt-2">
                <button
                  type="button"
                  onClick={() => setShowInquiryModal(false)}
                  className="px-5 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {dt('Anulo')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black tracking-wide flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all active:scale-95"
                >
                  <Send className="w-4 h-4" />
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

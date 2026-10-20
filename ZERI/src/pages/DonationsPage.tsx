import { Button } from '../components/ui/Button';
import { dt } from '@/src/lib/dt';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { submitDonationApplication } from '../lib/directSubmissions';
import { saveGuestReportHistory } from '../lib/session';
import { TrackIdIssuedModal } from '../components/TrackIdIssuedModal';
import { useStore, DonationCause } from '../lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Heart, Globe, X, PlusCircle, Home, Utensils, Shirt, Grid, ChevronLeft, ChevronRight, HeartPulse } from 'lucide-react';
import AdBanner from '../components/AdBanner.tsx';
import { isSpecificScope, recordMatchesScope } from '../lib/municipalityScope';
import { AuraHero, AuraStats, AuraEmpty, Reveal, AuraOrbit } from '../components/aura/Aura';
import SubmissionOverlay from '../components/SubmissionOverlay';

/** Applicant-supplied links are only followed when they are plain http(s); `javascript:` and the like become "#". */
function safeExternalUrl(value: string | undefined): string {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '#';
  } catch {
    return '#';
  }
}

export default function DonationsPage() {
  const donationCauses = useStore(state => state.donationCauses).filter(c => c.status === 'approved');
  const donationUrls = useStore(state => state.donationUrls);
  const userMunicipality = useStore(state => state.userMunicipality);
  const [selectedCause, setSelectedCause] = useState<DonationCause | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isApplying, setIsApplying] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [issuedReference, setIssuedReference] = useState<string | null>(null);
  const [applyErrors, setApplyErrors] = useState<Record<string, string>>({});

  // Escape closes the open campaign dialog.
  useEffect(() => {
    if (!selectedCause) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedCause(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedCause]);



const ITEMS_PER_PAGE = 6;

  const [newApplication, setNewApplication] = useState({
    title: '',
    description: '',
    category: 'shtepi' as DonationCause['category'],
    mediaType: 'image' as DonationCause['mediaType'],
    mediaUrl: '',
    donationUrl: ''
  });

  const categories = [
    { id: 'all', label: 'Të Gjitha', icon: Grid },
    { id: 'semundje', label: 'Sëmundje & trajtim', icon: HeartPulse },
    { id: 'shtepi', label: 'Shtëpi', icon: Home },
    { id: 'ushqim', label: 'Ushqim', icon: Utensils },
    { id: 'veshmbathje', label: 'Veshmbathje', icon: Shirt },
    { id: 'tjera', label: 'Të Tjera', icon: Heart }
  ];

  const handleCategoryChange = (catId: string) => {
    setActiveCategory(catId);
    setCurrentPage(1);
  };

  /**
   * Causes follow the global municipality scope, the same way reports and
   * forum posts do. An approved cause carries no `municipality` field of its
   * own yet, so `recordMatchesScope` falls back to the address/neighbourhood
   * fields — and a cause with none of them (a national appeal) matches every
   * scope, which is the right behaviour for a nationwide campaign.
   */
  const scopedCauses = useMemo(
    () => (isSpecificScope(userMunicipality)
      ? donationCauses.filter(c => recordMatchesScope(c, userMunicipality))
      : donationCauses),
    [donationCauses, userMunicipality]
  );

  /** Numërimet sipas kategorive — na ndihmojnë qytetarin ta shohë fuqinë e çdo fushe. */
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: scopedCauses.length };
    scopedCauses.forEach(c => { counts[c.category] = (counts[c.category] || 0) + 1; });
    return counts;
  }, [scopedCauses]);

  const filteredCauses = activeCategory === 'all'
    ? scopedCauses
    : scopedCauses.filter(c => c.category === activeCategory);

  const totalPages = Math.ceil(filteredCauses.length / ITEMS_PER_PAGE);
  const activePage = currentPage > totalPages ? Math.max(1, totalPages) : currentPage;
  const indexOfLastItem = activePage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = filteredCauses.slice(indexOfFirstItem, indexOfLastItem);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (activePage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (activePage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', activePage - 1, activePage, activePage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  /** The two portal-level links are set by the administrator; when one is missing the button says so instead of doing nothing. */
  const openPortalLink = (url: string | undefined, missing: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const safe = safeExternalUrl(url);
    if (safe === '#') {
      toast.error(missing);
      return;
    }
    window.open(safe, '_blank', 'noopener,noreferrer');
  };
  const handleMaintenanceClick = openPortalLink(donationUrls.maintenance, dt('Lidhja për mirëmbajtjen nuk është caktuar ende.'));
  const handleCharityClick = openPortalLink(donationUrls.charity, dt('Lidhja për bamirësi nuk është caktuar ende.'));

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setApplyErrors({});
    if (!newApplication.title.trim() || !newApplication.description.trim() || !newApplication.mediaUrl) {
      toast.error(dt('Plotësoni titullin, përshkrimin dhe shtoni një foto ose video.'));
      return;
    }
    setSubmitting(true);
    // Through the server: the browser is not allowed to create donation causes, so the
    // old direct write failed for every citizen.
    // Server when it is usable, otherwise straight to Firestore with the same checks.
    const result = await submitDonationApplication(newApplication);
    setSubmitting(false);
    if (!result.ok) {
      setApplyErrors(result.fields);
      toast.error(result.error || dt('Aplikimi nuk u dërgua. Provoni përsëri.'));
      return;
    }
    if (result.reference) {
      saveGuestReportHistory({
        id: result.reference,
        trackingId: result.reference,
        title: newApplication.title.trim().slice(0, 160),
        category: newApplication.category,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      setIssuedReference(result.reference);
    } else {
      toast.success(dt('Aplikimi u ruajt. Publikohet vetëm pasi ta miratojë administratori.'), { duration: 8000 });
    }
    setIsApplying(false);
    setNewApplication({ title: '', description: '', category: 'shtepi', mediaType: 'image', mediaUrl: '', donationUrl: '' });
  };

  return (
    <>
      <SubmissionOverlay busy={submitting} kind="donation" />
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="au-page mx-auto min-h-screen max-w-6xl px-3 pb-32 pt-3 sm:px-6 md:pb-20 lg:px-8"
    >
      <TrackIdIssuedModal
        trackingId={issuedReference}
        title={dt('Aplikimi u ruajt')}
        note={dt('Publikohet vetëm pasi ta miratojë administratori. Me këtë kod ndiqni fazën e aplikimit.')}
        onClose={() => setIssuedReference(null)}
      />

      {/* Inline Ad Banner */}
      <div className="mb-6">
        <AdBanner position="inline" />
      </div>

      <div className="mb-6">
        <AuraHero
          visual={<AuraOrbit core={Heart} />}
          tone="rose"
          eyebrow={dt(`Fushatat e Donacioneve`)}
          icon={Heart}
          title={dt(`Njerëzit Me Nevojë`)}
          subtitle={dt(`Fushata ndihme të miratuara nga administratori i platformës. Donacionet nuk kalojnë përmes kësaj faqeje: çdo fushatë të çon te faqja e saj e jashtme.`)}
          actions={<>
            <button type="button" data-tour="donation-apply" onClick={() => setIsApplying(true)} className="au-btn au-btn-light"><PlusCircle className="h-4 w-4" aria-hidden="true" />{dt(`Aplikoni Për Rast Ndihme`)}</button>
            {scopedCauses.length > 0 && <a href="#fushatat" className="au-btn au-btn-glass">{dt('Shiko fushatat')}</a>}
          </>}
          aside={scopedCauses.length > 0 ? <AuraStats items={[{ value: scopedCauses.length, label: dt('Miratuar për publikim') }]} /> : undefined}
        />
      </div>


      {isApplying && (
        <div className="mb-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-white/10 p-5 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-rose-600" />
          <div className="flex justify-between items-center mb-6 border-b border-rose-50 pb-4">
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">{dt(`Aplikoni për Donacion`)}</h3>
            <button type="button" aria-label={dt('Mbyll')}  onClick={() => setIsApplying(false)} className="text-slate-400 hover:text-slate-500 dark:text-slate-400 p-1 hover:bg-slate-50 dark:bg-slate-900 rounded-2xl transition-colors">
<X className="w-6 h-6" /></button>
          </div>
          <form onSubmit={handleSubmitApplication} className="space-y-5" aria-busy={submitting}>
            <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              {dt('Aplikimi ruhet si “në pritje” dhe shfaqet publikisht vetëm pasi ta miratojë administratori. Platforma nuk i mbledh paratë: lidhja që jepni (p.sh. GoFundMe) është faqja ku bëhen donacionet.')}
            </p>
            {Object.values(applyErrors).length > 0 && (
              <ul role="alert" className="list-disc rounded-xl border border-red-200 bg-red-50 p-3 pl-7 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                {Object.values(applyErrors).map(m => <li key={m}>{m}</li>)}
              </ul>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">{dt(`Titulli i Rastit *`)}</label>
                <input required value={newApplication.title} onChange={e => setNewApplication({...newApplication, title: e.target.value})} className="w-full border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-sm focus:border-rose-600 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 dark:bg-slate-900 outline-none transition" placeholder={dt(`psh. Ndihmë për fëmijën...`)} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">{dt(`Kategoria *`)}</label>
                <select value={newApplication.category} onChange={e => setNewApplication({...newApplication, category: e.target.value as any})} className="w-full border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-sm focus:border-rose-600 focus:bg-white dark:focus:bg-slate-800 outline-none transition">
                  {/*
                    `semundje` is in the DonationCause union and in the public
                    filter row, but it was missing from this select — so an
                    applicant could filter by "Sëmundje & trajtim" and then had
                    no way to file a case under it, and the category looked
                    empty. All five are listed here now.
                  */}
                  <option value="semundje">{dt(`Sëmundje & trajtim`)}</option>
                  <option value="shtepi">{dt(`Shtëpi`)}</option>
                  <option value="ushqim">{dt(`Ushqim`)}</option>
                  <option value="veshmbathje">{dt(`Veshmbathje`)}</option>
                  <option value="tjera">{dt(`Të Tjera`)}</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">{dt(`Përshkrimi i Rastit *`)}</label>
                <textarea required value={newApplication.description} onChange={e => setNewApplication({...newApplication, description: e.target.value})} className="w-full border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-sm focus:border-rose-600 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 dark:bg-slate-900 outline-none min-h-[120px] transition" placeholder={dt(`Shpjegoni detajet e rastit paktën disa rreshta...`)}></textarea>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">{dt(`Foto ose video (video deri në 600 KB; fotoja ngjishet automatikisht) *`)}</label>
                <div className="flex items-center justify-center w-full overflow-hidden">
                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-slate-200/60 dark:border-white/10 border-dashed rounded-2xl cursor-pointer bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/80 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                      <svg className="w-8 h-8 mb-3 text-slate-450 text-rose-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                      </svg>
                      <p className="mb-1 text-sm text-slate-500 dark:text-slate-400 font-bold"><span className="text-rose-600 underline">{dt(`Kliko për të ngarkuar`)}</span>{dt(`ose tërhiq këtu`)}</p>
                      <p className="text-[11px] text-slate-400 uppercase tracking-widest font-black">{dt(`PNG, JPG, WebP, MP4 ose WebM`)}</p>
                    </div>
                    <input
                      id="dropzone-file"
                      type="file"
                      className="hidden"
                      accept="image/*,video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const isVideo = file.type.startsWith('video/');
                          if (isVideo) {
                            if (file.size > 600 * 1024) {
                              toast.error(dt('Videoja është shumë e madhe (maksimumi 600 KB).'));
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setNewApplication(prev => ({
                                ...prev,
                                mediaType: 'video',
                                mediaUrl: reader.result as string
                              }));
                            };
                            reader.readAsDataURL(file);
                          } else {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              const img = new Image();
                              img.src = reader.result as string;
                              img.onload = () => {
                                const canvas = document.createElement('canvas');
                                let width = img.width;
                                let height = img.height;
                                const maxWidth = 800;
                                const maxHeight = 800;
                                if (width > height) {
                                  if (width > maxWidth) {
                                    height = Math.round((height * maxWidth) / width);
                                    width = maxWidth;
                                  }
                                } else {
                                  if (height > maxHeight) {
                                    width = Math.round((width * maxHeight) / height);
                                    height = maxHeight;
                                  }
                                }
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                  ctx.drawImage(img, 0, 0, width, height);
                                  setNewApplication(prev => ({
                                    ...prev,
                                    mediaType: 'image',
                                    mediaUrl: canvas.toDataURL('image/jpeg', 0.75)
                                  }));
                                } else {
                                  setNewApplication(prev => ({
                                    ...prev,
                                    mediaType: 'image',
                                    mediaUrl: reader.result as string
                                  }));
                                }
                              };
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                    />
                  </label>
                </div>
                {newApplication.mediaUrl && (
                  <div className="mt-4 relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-slate-200/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                    {newApplication.mediaType === 'video' ? (
                      <video src={newApplication.mediaUrl} className="w-full h-full object-cover" controls muted />
                    ) : (
                      <img loading="lazy" decoding="async" src={newApplication.mediaUrl} className="w-full h-full object-cover" alt={dt('Pamje paraprake e skedarit të zgjedhur')} />
                    )}
                    <button
                      type="button"
                      onClick={() => setNewApplication(prev => ({ ...prev, mediaUrl: '', mediaType: 'image' }))}
                      className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">{dt(`Link Për Donacion (Opsionale)`)}</label>
                <input type="url" value={newApplication.donationUrl} onChange={e => setNewApplication({...newApplication, donationUrl: e.target.value})} className="w-full border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-sm focus:border-rose-600 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 dark:bg-slate-900 outline-none transition" placeholder={dt(`https://gofund.me/...`)} />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">{dt(`Nëse keni një fushatë të hapur në GoFundMe, KosovaCharity apo rrjete tjera`)}</p>
              </div>
            </div>
            <div className="pt-4">
              <Button type="submit" size="lg" variant="primary" fullWidth disabled={submitting}>{submitting ? dt('Po dërgohet…') : dt('Dërgo aplikimin për shqyrtim')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Categories */}
      <div id="fushatat" data-tour="donation-causes" className="au-rail mb-4 scroll-mt-20" role="group" aria-label={dt('Kategoritë')}>
        {categories.map((cat) => (
          <button key={cat.id} type="button" aria-pressed={activeCategory === cat.id} onClick={() => handleCategoryChange(cat.id)} className="au-chip">
            <cat.icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{cat.label}</span>
            <span className="au-count">{categoryCounts[cat.id] || 0}</span>
          </button>
        ))}
      </div>

      {/* Campaigns Grid Layout */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {currentItems.map((cause, index) => {
          const categoryObj = categories.find(c => c.id === cause.category);
          const link = safeExternalUrl(cause.donationUrl);
          return (
            <Reveal key={cause.id} delay={(index % 3) * 50} className="h-full">
              <article
                onClick={() => setSelectedCause(cause)}
                onKeyDown={(e) => { if (e.key === 'Enter') setSelectedCause(cause); }}
                tabIndex={0}
                role="button"
                aria-label={cause.title}
                className="au-tile au-tile-link flex h-full cursor-pointer flex-col overflow-hidden"
              >
                <div className="au-photo" style={{ aspectRatio: '16/10' }}>
                  {cause.mediaType === 'video' ? <video src={cause.mediaUrl} muted playsInline preload="metadata" /> : <img src={cause.mediaUrl} alt={cause.title} loading="lazy" decoding="async" />}
                  {categoryObj && (
                    <span className="absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                      <categoryObj.icon className="h-3 w-3" aria-hidden="true" />{categoryObj.label}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3.5">
                  <h3 className="line-clamp-2 break-words text-[15px] font-semibold leading-snug">{cause.title}</h3>
                  <p className="au-sub line-clamp-2 break-words text-[13px] leading-relaxed">{cause.description}</p>
                  <p className="au-sub mt-auto flex items-center justify-between pt-1 text-[11px]">
                    <span>{dt(`Miratuar për publikim`)}</span>
                    <span>{new Date(cause.createdAt).toLocaleDateString('sq-AL', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </p>
                  <div onClick={(e) => e.stopPropagation()}>
                    {link === '#' ? (
                      <p className="rounded-full bg-black/5 px-3 py-2 text-center text-[12px] font-medium au-sub dark:bg-white/10">{dt('Kjo fushatë nuk ka lidhje donacioni')}</p>
                    ) : (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="au-btn au-btn-primary w-full !h-9 !text-[13px]">{dt(`Hap faqen e donacionit`)} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
                    )}
                  </div>
                </div>
              </article>
            </Reveal>
          );
        })}

        {filteredCauses.length === 0 && (
          <div className="col-span-full">
            <AuraEmpty icon={Heart} title={dt(`Nuk ka fushata për t’u shfaqur`)} text={dt(`Nuk ka fushata të miratuara në këtë kategori ose komunë.`)} />
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-12 mb-16 select-none flex-wrap">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={activePage === 1}
            className="flex items-center justify-center p-2.5 rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-900 disabled:opacity-40 disabled:pointer-events-none transition shadow-sm dark:shadow-none active:scale-95 cursor-pointer"
            aria-label={dt('Faqja e mëparshme')}
          >
            <ChevronLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {getPageNumbers().map((page, index) => {
              if (page === '...') {
                return (
                  <span key={`ellipsis-${index}`} className="px-2 text-slate-400 font-bold font-mono">
                    ...
                  </span>
                );
              }
              const isCurrent = page === activePage;
              return (
                <button
                  key={`page-${page}`}
                  onClick={() => setCurrentPage(Number(page))}
                  className={`min-w-[40px] h-[40px] px-2 flex items-center justify-center rounded-xl font-extrabold font-mono text-sm transition focus:outline-none cursor-pointer ${
                    isCurrent
                      ? 'bg-rose-600 text-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shadow-rose-600/10'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 hover:bg-slate-50 dark:bg-slate-900 hover:border-slate-350'
                  } active:scale-95`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={activePage === totalPages}
            className="flex items-center justify-center p-2.5 rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-900 disabled:opacity-40 disabled:pointer-events-none transition shadow-sm dark:shadow-none active:scale-95 cursor-pointer"
            aria-label={dt('Faqja tjetër')}
          >
            <ChevronRight className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
      )}

      {/* Portal-level links */}
      <section className="au-tile flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="flex items-center gap-2 text-[17px] font-semibold"><Globe className="h-4 w-4 text-[var(--au-accent)]" aria-hidden="true" />{dt(`Kontribuo Për Komunitetin`)}</h2>
          <p className="au-sub mt-1 text-[13px]">{dt(`Lidhjet më poshtë i ka caktuar administratori i platformës dhe hapen në faqe të jashtme.`)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleCharityClick} className="au-btn au-btn-primary">{dt(`Njerëzit me Nevojë`)}</button>
          <button type="button" onClick={handleMaintenanceClick} className="au-btn au-btn-soft">{dt(`Mirëmbajtja e Web-it`)}</button>
        </div>
      </section>

      {/* Footer ad slot: below the contribution box, so the last thing seen is still the appeal to help. */}
      <div className="mt-8">
        <AdBanner position="banner" className="mx-auto" />
      </div>

      <AnimatePresence>
        {selectedCause && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 md:backdrop-blur-md"
            onClick={() => setSelectedCause(null)}
            role="dialog"
            aria-modal="true"
            aria-label={selectedCause.title}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-xl dark:shadow-none border border-slate-200/60 dark:border-white/10 w-full max-w-3xl flex flex-col max-h-[90vh]"
            >
              <div className="relative aspect-video w-full bg-slate-50 dark:bg-slate-900 shrink-0 select-none">
                {selectedCause.mediaType === 'video' ? (
                  <video src={selectedCause.mediaUrl} className="w-full h-full object-cover" controls muted />
                ) : (
                  <img loading="lazy" decoding="async" src={selectedCause.mediaUrl} alt={selectedCause.title} className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  aria-label={dt('Mbyll')}
                  onClick={() => setSelectedCause(null)}
                  className="absolute top-4 right-4 min-h-11 min-w-11 p-2 bg-slate-900/50 hover:bg-slate-900 text-white rounded-full transition-colors backdrop-blur-md cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-8 overflow-y-auto w-full flex-1">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white title-serif mb-4 leading-snug break-words">{selectedCause.title}</h2>
                <div className="text-xs font-extrabold text-slate-400 mb-6 flex items-center gap-2 uppercase tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>{dt(`Publikuar:`)} {new Date(selectedCause.createdAt).toLocaleDateString('sq-AL', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div className="prose prose-slate dark:prose-invert max-w-none text-neutral-600 dark:text-slate-300 leading-relaxed font-semibold text-sm md:text-base space-y-4 break-words">
                  {selectedCause.description.split('\n').map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              </div>
              
              <div className="p-5 sm:p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <p className="text-xs font-extrabold text-slate-400 max-w-xs text-center sm:text-left leading-normal uppercase break-words">{dt(`Donacioni bëhet në faqen e jashtme të fushatës. Zëri i Qytetarëve nuk e merr pagesën dhe nuk e kontrollon përdorimin e mjeteve.`)}
                </p>
                {safeExternalUrl(selectedCause.donationUrl) === '#' ? (
                  <p className="text-xs font-bold text-slate-500">{dt('Kjo fushatë nuk ka lidhje donacioni.')}</p>
                ) : (
                <a
                  href={safeExternalUrl(selectedCause.donationUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:translate-y-0 text-sm cursor-pointer uppercase tracking-wider text-center"
                >{dt(`Hap faqen e donacionit`)} 
                  <Heart className="w-4 h-4 ml-1 fill-transparent" />
                </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      
    </motion.div>
    </>
  );
}

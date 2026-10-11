import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { dt } from '@/src/lib/dt';
import React, { useMemo, useState } from 'react';
import { useStore, DonationCause } from '../lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Globe, X, PlusCircle, Activity, Home, Utensils, Shirt, Grid, ChevronLeft, ChevronRight, ChevronDown, Layers, HeartPulse } from 'lucide-react';
import { handleFirebaseError } from '../lib/errorHandler';
import AdBanner from '../components/AdBanner.tsx';
import { isSpecificScope, recordMatchesScope } from '../lib/municipalityScope';

export default function DonationsPage() {
  const donationCauses = useStore(state => state.donationCauses).filter(c => c.status === 'approved');
  const donationUrls = useStore(state => state.donationUrls);
  const addDonationCause = useStore(state => state.addDonationCause);
  const userMunicipality = useStore(state => state.userMunicipality);
  const [selectedCause, setSelectedCause] = useState<DonationCause | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isApplying, setIsApplying] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);



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

  const handleMaintenanceClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const confirmed = window.confirm("A jeni të sigurt që dëshironi të kontribuoni për mirëmbajtjen e platformës sonë parësisht njerëzve në nevojë?\n\nJu ftojmë të konsideroni ndarjen e donacionit tuaj në dy pjesë (50% për familjet në nevojë dhe 50% për platformën), apo t'i kushtoni vëmendje të plotë rasteve emergjente.\n\nFaleminderit përzemërsisht për mbështetjen tuaj pafund!");
    if (confirmed) {
      if (donationUrls.maintenance) {
        window.open(donationUrls.maintenance, '_blank', 'noopener,noreferrer');
      } else {
        alert("URL për mirëmbajtje nuk është konfiguruar nga administratori.");
      }
    }
  };

  const handleCharityClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (donationUrls.charity) {
      window.open(donationUrls.charity, '_blank', 'noopener,noreferrer');
    } else {
      alert("URL për bamirësi nuk është konfiguruar nga administratori.");
    }
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApplication.title || !newApplication.description || !newApplication.mediaUrl) {
      alert("Ju lutem plotësoni të gjitha fushat obligative (Titulli, Përshkrimi, bashkëngjitni një Foto/Video).");
      return;
    }
    
    try {
      const { db } = await import('../lib/firebase');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');

      // Firebase
      await addDoc(collection(db, 'donationCauses'), {
        ...newApplication,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Local State Update
      addDonationCause({
        ...newApplication,
        status: 'pending'
      });
      
      alert("Aplikimi juaj është dërguar me sukses! Administratori do ta shqyrtojë së shpejti.");
      setIsApplying(false);
      setNewApplication({
        title: '',
        description: '',
        category: 'shtepi',
        mediaType: 'image',
        mediaUrl: '',
        donationUrl: ''
      });
    } catch(err: any) {
      const appErr = handleFirebaseError(err);
      alert(appErr.message);
      console.error(appErr.technicalMessage);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-32 md:py-16 font-sans text-slate-900 dark:text-white dark:text-slate-100"
    >
      
      {/* Inline Ad Banner */}
      <div className="mb-6">
        <AdBanner position="inline" />
      </div>

      {/* Decorative ambient gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -z-10 w-72 h-72 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
        <div className="w-full">
          <div className="inline-flex items-center gap-2 md:gap-3 px-3 py-1.5 bg-slate-900 border border-slate-800 text-white text-[10px] md:text-xs font-bold tracking-widest mb-3 md:mb-5 rounded-xl uppercase">
            <Heart className="w-3 h-3 md:w-4 md:h-4 text-rose-500 fill-rose-500/20 active:scale-110 transition-transform cursor-pointer" />{dt(`Fushatat e Donacioneve`)}
          </div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight uppercase title-serif mb-2 md:mb-4 leading-none select-none">{dt(`Njerëzit Me Nevojë`)}<span className="text-rose-600">.</span>
          </h2>
          <p className="text-xs sm:text-sm md:text-base text-neutral-600 dark:text-slate-400 max-w-3xl border-l-4 border-rose-500 pl-3 md:pl-4 font-medium italic break-words">{dt(`Zgjidhni formën e kontributit tuaj për të mbështetur zhvillimin dhe solidaritetin në qytetin tonë. Kontributi juaj është thelbësor.`)}
          </p>
        </div>
        <Button size="lg" variant="primary" onClick={() => setIsApplying(true)} 
          className="w-full md:w-auto px-5 py-3.5 md:px-6 md:py-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shadow-rose-600/10 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] hover:shadow-rose-600/20 flex items-center justify-center gap-2 transform active:scale-95 text-xs md:text-sm mt-2 md:mt-0 whitespace-normal text-center break-words"
        >
          <PlusCircle className="w-4 h-4 md:w-5 md:h-5" />{dt(`Aplikoni Për Rast Ndihme`)}
        </Button>
      </div>

      {isApplying && (
        <div className="mb-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-white/10 p-5 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-rose-600" />
          <div className="flex justify-between items-center mb-6 border-b border-rose-50 pb-4">
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">{dt(`Aplikoni për Donacion`)}</h3>
            <button aria-label="Mbyll"  onClick={() => setIsApplying(false)} className="text-slate-400 hover:text-slate-500 dark:text-slate-400 p-1 hover:bg-slate-50 dark:bg-slate-900 rounded-2xl transition-colors">
<X className="w-6 h-6" /></button>
          </div>
          <form onSubmit={handleSubmitApplication} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">{dt(`Titulli i Rastit *`)}</label>
                <input required value={newApplication.title} onChange={e => setNewApplication({...newApplication, title: e.target.value})} className="w-full border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-sm focus:border-rose-600 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 dark:bg-slate-900 outline-none transition-all" placeholder={dt(`psh. Ndihmë për fëmijën...`)} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">{dt(`Kategoria *`)}</label>
                <select value={newApplication.category} onChange={e => setNewApplication({...newApplication, category: e.target.value as any})} className="w-full border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-sm focus:border-rose-600 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all">
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
                <textarea required value={newApplication.description} onChange={e => setNewApplication({...newApplication, description: e.target.value})} className="w-full border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-sm focus:border-rose-600 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 dark:bg-slate-900 outline-none min-h-[120px] transition-all" placeholder={dt(`Shpjegoni detajet e rastit paktën disa rreshta...`)}></textarea>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">{dt(`Ngarko Foto ose Video (Deri në 5MB) *`)}</label>
                <div className="flex items-center justify-center w-full overflow-hidden">
                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-slate-200/60 dark:border-white/10 border-dashed rounded-2xl cursor-pointer bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/80 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                      <svg className="w-8 h-8 mb-3 text-slate-450 text-rose-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                      </svg>
                      <p className="mb-1 text-sm text-slate-500 dark:text-slate-400 font-bold"><span className="text-rose-600 underline">{dt(`Kliko për të ngarkuar`)}</span>{dt(`ose tërhiq këtu`)}</p>
                      <p className="text-[11px] text-slate-400 uppercase tracking-widest font-black">{dt(`SVG, PNG, JPG, ose MP4`)}</p>
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
                              alert('Videoja është shumë e madhe (Maksimumi është 600KB për shkak të kufizimeve të databazës).');
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
                      <img src={newApplication.mediaUrl} className="w-full h-full object-cover" alt="Preview preview" />
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
                <input type="url" value={newApplication.donationUrl} onChange={e => setNewApplication({...newApplication, donationUrl: e.target.value})} className="w-full border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-sm focus:border-rose-600 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 dark:bg-slate-900 outline-none transition-all" placeholder={dt(`https://gofund.me/...`)} />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">{dt(`Nëse keni një fushatë të hapur në GoFundMe, KosovaCharity apo rrjete tjera`)}</p>
              </div>
            </div>
            <div className="pt-4">
              <Button type="submit" size="lg" variant="primary" fullWidth>{dt(`Dërgo Aplikimin për Shqyrtim Publik`)}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Categories Wrap Filter */}
      <div className="relative mb-10">
        <div className="flex overflow-x-auto gap-2 md:gap-3 pb-4 mb-2 md:mb-6 w-full hide-scrollbar snap-x snap-mandatory px-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`snap-start flex items-center justify-center gap-1.5 md:gap-2 px-4 py-3 md:px-5 md:py-4 rounded-xl font-bold whitespace-nowrap transition-all duration-300 ease-in-out text-[11px] sm:text-xs md:text-sm border-2 shrink-0 ${
                activeCategory === cat.id 
                  ? 'bg-rose-600 text-white border-rose-600 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none scale-[1.02]' 
                                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-white/10 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm dark:shadow-none'
                  } active:scale-[0.98] cursor-pointer`}
            >
              <cat.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${activeCategory === cat.id ? 'text-white' : 'text-rose-500'}`} />
              <span className="uppercase">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Campaigns Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-12">
        {currentItems.map((cause, index) => {
          const categoryObj = categories.find(c => c.id === cause.category);
          return (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (index % 3) * 0.08 }}
              key={cause.id}
              onClick={() => setSelectedCause(cause)}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-white/10 overflow-hidden shadow-sm dark:shadow-none hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:hover:shadow-none hover:border-slate-300 dark:hover:border-white/20 transition-all duration-300 flex flex-col group cursor-pointer h-full"
            >
              <div className="relative aspect-[4/3] sm:aspect-video w-full overflow-hidden bg-slate-50 dark:bg-slate-900 shrink-0 select-none">
                {/* Category Floating Badge */}
                {categoryObj && (
                  <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2.5 sm:px-3 py-1.5 rounded-2xl flex items-center gap-1.5 z-10 border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                    <categoryObj.icon className="w-3.5 h-3.5 text-rose-500 fill-rose-500/10" />
                    {categoryObj.label}
                  </div>
                )}

                {/* Rast Prioritar Floating Badge */}
                <div className="absolute top-3 right-3 bg-rose-600/95 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2.5 sm:px-3 py-1.5 rounded-2xl z-10 border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">{dt(`Rast Prioritar`)}
                </div>

                {cause.mediaType === 'video' ? (
                  <video src={cause.mediaUrl} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" muted />
                ) : (
                  <img
                    src={cause.mediaUrl}
                    alt={cause.title}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent"></div>
              </div>

              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-950 dark:text-white mb-1.5 leading-snug break-words group-hover:text-rose-600 transition-colors line-clamp-2">{cause.title}</h3>
                  <p className="text-neutral-600 dark:text-slate-400 mb-3 sm:mb-5 text-xs sm:text-sm flex-1 leading-relaxed font-semibold line-clamp-2 sm:line-clamp-4 break-words">
                    {cause.description}
                  </p>
                </div>

                <div className="mt-auto pt-3 sm:pt-4 border-t border-slate-100 dark:border-white/5 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between text-[10px] sm:text-xs text-slate-400 font-extrabold uppercase tracking-wider px-0.5 gap-1">
                    <span className="flex items-center gap-1 shrink-0">
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />{dt(`Ndihmë Urgjente`)}
                    </span>
                    <span className="text-emerald-600 font-black flex items-center gap-1 shrink-0">{dt(`● AKTIVE`)}
                    </span>
                  </div>

                  {/* Prevent event bubbling to secure double actions on mobile */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <a
                      href={cause.donationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 sm:py-3 bg-slate-900 hover:bg-rose-600 text-white font-black rounded-xl sm:rounded-2xl transition-all duration-300 flex items-center justify-center gap-1.5 text-xs shadow-sm dark:shadow-none hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-rose-600/10 active:scale-95 cursor-pointer uppercase tracking-wide whitespace-normal text-center break-words px-2"
                    >
                      <span>{dt(`Kontriboni Tani`)}</span>
                      <Heart className="w-3.5 h-3.5 shrink-0 fill-transparent group-hover:fill-white transition-all duration-300 text-rose-500" />
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {filteredCauses.length === 0 && (
          <div className="col-span-full py-16 sm:py-24 text-center text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200/60 dark:border-white/10 rounded-2xl bg-slate-50 dark:bg-slate-800/50 px-6">
            <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4 animate-bounce" />
            <h4 className="font-extrabold text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-tight">{dt(`Vonesë e përkohshme`)}</h4>
            <p className="font-semibold text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{dt(`Aktualisht nuk ka asnjë fushatë aktive për donacion në këtë kategori.`)}</p>
          </div>
        )}
      </div>

      {/* Beautiful citizen page pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-12 mb-16 select-none flex-wrap">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={activePage === 1}
            className="flex items-center justify-center p-2.5 rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm dark:shadow-none active:scale-95 cursor-pointer"
            aria-label="Faqja e mëparshme"
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
                  className={`min-w-[40px] h-[40px] px-2 flex items-center justify-center rounded-xl font-extrabold font-mono text-sm transition-all focus:outline-none cursor-pointer ${
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
            className="flex items-center justify-center p-2.5 rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm dark:shadow-none active:scale-95 cursor-pointer"
            aria-label="Faqja tjetër"
          >
            <ChevronRight className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
      )}

      {/* Main portal contribution box */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 sm:p-8 md:p-12 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 -mr-10 -mt-10 md:-mr-20 md:-mt-20 opacity-5 pointer-events-none">
          <Globe className="w-48 h-48 md:w-96 md:h-96" />
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8">
          <div className="flex-1 text-center lg:text-left">
            <h3 className="text-lg sm:text-xl md:text-3xl font-extrabold title-serif flex flex-wrap items-center justify-center lg:justify-start gap-2 md:gap-3 mb-2 md:mb-3">
              <Globe className="w-5 h-5 md:w-7 md:h-7 text-rose-500" />{dt(`Kontribuo Për Komunitetin`)}
            </h3>
            <p className="text-xs sm:text-sm md:text-base text-neutral-400 max-w-xl mx-auto lg:mx-0 font-medium">{dt(`Nëse dëshironi të kontribuoni drejtpërdrejt në mirëmbajtjen e platformës, ose në bamirësi shtesë, zgjidhni një nga opsionet më poshtë.`)}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 w-full lg:w-auto shrink-0 mt-4 lg:mt-0">
            <Button size="lg" variant="primary" fullWidth
              onClick={handleCharityClick}

            >
              <span className="w-2 h-2 bg-white dark:bg-slate-900 rounded-full animate-pulse" />{dt(`Njerëzit me Nevojë`)}
            </Button>
            <Button size="lg" variant="outline" fullWidth
              onClick={handleMaintenanceClick}

            >{dt(`Mirëmbajtja e Web-it`)}
            </Button>
          </div>
        </div>
      </div>

      /*
        Strategic footer slot. Below the main contribution box, so the last
        thing a citizen sees is still the appeal to help — the banner is a
        business card, not a competing call to action.
      */
      <div className="mt-8">
        <AdBanner position="banner" className="mx-auto" />
      </div>

      <AnimatePresence>
        {selectedCause && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setSelectedCause(null)}
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
                  <video src={selectedCause.mediaUrl} className="w-full h-full object-cover" controls autoPlay muted />
                ) : (
                  <img src={selectedCause.mediaUrl} alt={selectedCause.title} className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => setSelectedCause(null)}
                  className="absolute top-4 right-4 p-2 bg-slate-900/50 hover:bg-slate-900 text-white rounded-full transition-colors backdrop-blur-md cursor-pointer"
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
                <p className="text-xs font-extrabold text-slate-400 max-w-xs text-center sm:text-left leading-normal uppercase break-words">{dt(`Duke ndihmuar këta njerëz, ju po ndihmoni të gjithë komunitetin e qytetit tonë.`)}
                </p>
                <a 
                  href={selectedCause.donationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:translate-y-0 text-sm cursor-pointer uppercase tracking-wider text-center"
                >{dt(`Dërgo Ndihmën Tënde`)} 
                  <Heart className="w-4 h-4 ml-1 fill-transparent" />
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      
    </motion.div>
  );
}

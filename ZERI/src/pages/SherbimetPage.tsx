import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  FileText, Search, ExternalLink, Clock, DollarSign, 
  CheckCircle2, HelpCircle, Shield, ArrowRight, Phone,
  Home, Building, TreePine, HeartPulse, GraduationCap, AlertTriangle, Lightbulb, Star, Send
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AuraPage, AuraHero, AuraStats, AuraSection, AuraNote, AuraEmpty, AuraOrbit } from '../components/aura/Aura';
import toast from 'react-hot-toast';
import { postPublic } from '../lib/publicSubmit';

import { dt } from '@/src/lib/dt';
interface ServiceItem {
  id: string;
  category: string;
  title: string;
  department: string;
  description: string;
  requirements?: string[];
  isOnline: boolean;
  onlineUrl?: string;
  /** Route inside the platform for a platform service. */
  to?: string;
}

/**
 * Municipal catalogue: title, owning department and a one-line description only.
 * Fees, deadlines, required documents and download forms were removed: they were typed in
 * by hand, not sourced, and a citizen could act on them. Those details belong to the
 * institution and are only ever linked to, never restated here.
 */
const SERVICES_DATA: ServiceItem[] = [
  // Gjendja Civile
  {
    id: 'gc-1',
    category: 'Gjendja Civile',
    title: 'Certifikatë e Lindjes, Martesës dhe Vendbanimit',
    department: 'Drejtoria e Administratës së Përgjithshme',
    description: 'Pajisja me ekstrakte dhe certifikata zyrtare të gjendjes civile për të gjithë qytetarët e regjistruar.',
    isOnline: true,
    onlineUrl: 'https://ekosova.rks-gov.net'
  },
  {
    id: 'gc-2',
    category: 'Gjendja Civile',
    title: 'Ndryshimi i Vendbanimit dhe Regjistrimi i Ri',
    department: 'Drejtoria e Administratës së Përgjithshme',
    description: 'Regjistrimi zyrtar i adresës së re të banimit brenda komunës apo kalimi nga një komunë tjetër.',
    isOnline: true,
    onlineUrl: 'https://ekosova.rks-gov.net'
  },

  // Kadastri & Prona
  {
    id: 'kp-1',
    category: 'Kadastër & Pronë',
    title: 'Certifikata e Pronësisë (Fletë Poseduese)',
    department: 'Drejtoria për Kadastër dhe Gjeodezi',
    description: 'Dokumenti themelor që vërteton pronësinë ligjore mbi ngastrën kadastrale apo njësinë ndërtimore.',
    isOnline: true,
    onlineUrl: 'https://ekosova.rks-gov.net'
  },
  {
    id: 'kp-2',
    category: 'Kadastër & Pronë',
    title: 'Kopja e Planit Kadastral dhe Matjet Gjeodezike',
    department: 'Drejtoria për Kadastër dhe Gjeodezi',
    description: 'Lëshimi i planit të situacionit me koordinata gjeodezike zyrtare nga baza e të dhënave të AKK-së.',
    isOnline: false
  },

  // Urbanizmi & Ndërtimi
  {
    id: 'un-1',
    category: 'Urbanizëm & Leje',
    title: 'Kushtet Ndërtimore dhe Leja e Ndërtimit të Kategorisë I & II',
    department: 'Drejtoria e Planifikimit Urban dhe Ndërtimit',
    description: 'Aplikimi për leje ndërtimi për shtëpi individuale banimi, objekte shumëbanesore apo komplekse afariste.',
    isOnline: true,
    onlineUrl: 'https://ekosova.rks-gov.net'
  },
  {
    id: 'un-2',
    category: 'Urbanizëm & Leje',
    title: 'Legalizimi i Ndërtimeve pa Leje',
    department: 'Drejtoria e Urbanizmit',
    description: 'Përfshirja në regjistrin e trajtimit të ndërtimeve pa leje sipas ligjit në fuqi për legalizim.',
    isOnline: false
  },

  // Shërbime Publike & Mbeturina
  {
    id: 'sp-1',
    category: 'Shërbime Publike',
    title: 'Kërkesë për Vendosjen ose Riparimin e Ndriçimit Publik',
    department: 'Drejtoria e Shërbimeve Publike dhe Emergjencës',
    description: 'Raportimi i prishjeve të shtyllave, llambave LED apo kërkesa për zgjerim të rrjetit në lagje dhe fshatra.',
    isOnline: true
  },
  {
    id: 'sp-2',
    category: 'Shërbime Publike',
    title: 'Orari i Mbeturinave dhe Pastrimi i Deponive Ilegale',
    department: 'Drejtoria e Shërbimeve Publike & Kompania Regjionale',
    description: 'Informacione mbi oraret ditore të largimit të mbeturinave dhe kërkesa për pastrim të hapësirave të ndotura.',
    isOnline: true
  },

  // Tatimi në Pronë
  {
    id: 'tp-1',
    category: 'Tatimi në Pronë',
    title: 'Verifikimi i Faturës dhe Pagesa e Tatimit në Pronë',
    department: 'Drejtoria për Financa dhe Tatim në Pronë',
    description: 'Kontrolli i gjendjes financiare tatimore, shkarkimi i faturës vjetore dhe pagesa elektronike e menjëhershme.',
    isOnline: true,
    onlineUrl: 'https://ekosova.rks-gov.net'
  },
  {
    id: 'tp-2',
    category: 'Tatimi në Pronë',
    title: 'Certifikatë mbi Pagimin e Detyrimeve Tatimore Komunale',
    department: 'Drejtoria për Financa',
    description: 'Vërtetim zyrtar se qytetari apo biznesi nuk ka borxhe të papaguara ndaj buxhetit komunal.',
    isOnline: true,
    onlineUrl: 'https://ekosova.rks-gov.net'
  },

  // Shëndetësia & QKMF
  {
    id: 'sh-1',
    category: 'Shëndetësi & QKMF',
    title: 'Terminet për Mjekësi Familjare dhe Pediatri në QKMF',
    department: 'Drejtoria për Shëndetësi dhe Mirëqenie Sociale',
    description: 'Caktimi i vizitave të rregullta mjekësore, kontrolleve sistematike dhe vaksinimit të detyrueshëm për fëmijë.',
    isOnline: true
  },
  {
    id: 'sh-2',
    category: 'Shëndetësi & QKMF',
    title: 'Shërbimi Shëndetësor Shtëpiak për Personat e Palëvizshëm',
    department: 'QKMF dhe Kujdesi Parësor Shëndetësor',
    description: 'Ekipet mobile mjekësore për vizita dhe terapi shtëpiake për pacientët e moshuar ose me aftësi të kufizuara.',
    isOnline: false
  },

  // Arsimi & Çerdhet
  {
    id: 'ar-1',
    category: 'Arsim & Çerdhe',
    title: 'Regjistrimi i Fëmijëve në Çerdhet dhe Kopshtet Publike',
    department: 'Drejtoria Komunale e Arsimit (DKA)',
    description: 'Konkursi vjetor dhe regjistrimi online për pranimin e fëmijëve në institucionet parashkollore komunale.',
    isOnline: true,
    onlineUrl: 'https://ekosova.rks-gov.net'
  },
  {
    id: 'ar-2',
    category: 'Arsim & Çerdhe',
    title: 'Aplikimi për Bursa Komunale për Studentë dhe Nxënës Elitarë',
    department: 'Drejtoria Komunale e Arsimit',
    description: 'Mbështetje financiare vjetore për studentët me sukses të shkëlqyer akademik dhe në fusha deficitare.',
    isOnline: true,
    onlineUrl: 'https://ekosova.rks-gov.net'
  }
];

const PLATFORM_SERVICES: ServiceItem[] = [
  {
    id: 'platform-report', to: '/raporto', category: 'Raportime qytetare', title: 'Raporto një problem publik', department: 'Zëri Qytetarëve',
    description: 'Dërgo një raportim me foto, video, lokacion, kategori dhe nivel urgjence te platforma qytetare.',
    requirements: ['Titulli dhe përshkrimi i problemit', 'Lokacioni i saktë në hartë', 'Foto ose video, nëse ka'], isOnline: false
  },
  {
    id: 'platform-track', to: '/trackid', category: 'Raportime qytetare', title: 'Përcjell raportimin me Track-ID', department: 'Zëri Qytetarëve',
    description: 'Gjej raportimin tënd dhe shiko statusin dhe historikun publik të veprimeve.',
    requirements: ['Track-ID i raportimit', 'Kërkimi në regjistrin publik'], isOnline: false
  },
  {
    id: 'platform-map', to: '/harta', category: 'Transparencë & Harta', title: 'Shiko hartën e problemeve', department: 'Zëri Qytetarëve',
    description: 'Eksploro raportimet e aprovuara në Kosovë me filtra për komunë, kategori, status dhe urgjencë.',
    requirements: ['Zgjidh komunën ose Kosovën', 'Përdor filtrat e hartës'], isOnline: false
  },
  {
    id: 'platform-institutions', to: '/raporto', category: 'Institucione & Agjentë', title: 'Dërgo rastin te përgjegjësi i duhur', department: 'Zëri Qytetarëve',
    description: 'Pasi raporti aprovohet nga ekipi i platformës, ai i caktohet institucionit përgjegjës sipas kategorisë.',
    requirements: ['Kategori e saktë', 'Përshkrim i qartë', 'Komuna e problemit'], isOnline: false
  },
  {
    id: 'platform-community', to: '/forum', category: 'Pjesëmarrje qytetare', title: 'Debat publik dhe sondazhe', department: 'Zëri Qytetarëve',
    description: 'Merr pjesë në diskutime dhe sondazhe publike.',
    requirements: ['Hyrje në llogari (komuniteti)', 'Respektimi i rregullave të komunitetit'], isOnline: false
  },
  {
    id: 'platform-alerts', to: '/komunat', category: 'Njoftime lokale', title: 'Njoftime sipas komunës', department: 'Zëri Qytetarëve',
    description: 'Zgjidh komunën tënde për të parë raportet dhe njoftimet për atë zonë.',
    requirements: ['Zgjidh komunën nga Zona juaj', 'Mund të ndryshosh komunën kurdo'], isOnline: false
  }
];

export default function SherbimetPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  const categories = [
    'all',
    'Raportime qytetare', 'Transparencë & Harta', 'Institucione & Agjentë', 'Pjesëmarrje qytetare', 'Njoftime lokale',
    'Gjendja Civile', 'Kadastër & Pronë', 'Urbanizëm & Leje', 'Shërbime Publike', 'Tatimi në Pronë', 'Shëndetësi & QKMF', 'Arsim & Çerdhe'
  ];

  /**
   * Faqja shfaq si shërbimet e platformës ashtu edhe katalogun komunal.
   * Më parë SERVICES_DATA (14 shërbime administrative) nuk shfaqej kurrë,
   * edhe pse kishte kërkesa, tarifa dhe afate të plota për secilin.
   */
  const allServices = useMemo(() => [
    ...PLATFORM_SERVICES.map(s => ({ ...s, kind: 'platform' as const })),
    ...SERVICES_DATA.map(s => ({ ...s, kind: 'municipal' as const })),
  ], []);

  const filteredServices = useMemo(() => {
    return allServices.filter(srv => {
      const matchCat = selectedCategory === 'all' || srv.category === selectedCategory;
      const matchSearch = srv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          srv.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          srv.department.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allServices, searchQuery, selectedCategory]);

  const handleFeedbackSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rating || feedback.trim().length < 10) {
      toast.error('Zgjidhni një vlerësim dhe shkruani një sugjerim me të paktën 10 karaktere.');
      return;
    }

    setIsSendingFeedback(true);
    try {
      const result = await postPublic('/api/v1/public/feedback', { rating, feedback, source: 'SherbimetPage' });
      if (!result.ok) {
        toast.error(result.error || 'Sugjerimi nuk u dërgua. Provoni përsëri.');
        return;
      }
      toast.success('Faleminderit. Sugjerimi juaj u ruajt.');
      setRating(0);
      setFeedback('');
    } catch (error) {
      console.error('Gabim gjatë dërgimit të sugjerimit:', error);
      toast.error('Sugjerimi nuk u dërgua. Provoni përsëri.');
    } finally {
      setIsSendingFeedback(false);
    }
  };

  const platformList = filteredServices.filter(s => s.kind === 'platform');
  const municipalList = filteredServices.filter(s => s.kind === 'municipal');
  const countFor = (c: string) => c === 'all' ? allServices.length : allServices.filter(s => s.category === c).length;

  return (
    <AuraPage>
      <AuraHero
        visual={<AuraOrbit core={Shield} />}
        tone="blue"
        eyebrow={dt('Shërbimet e platformës')}
        icon={FileText}
        title={dt('Shërbimet e Zërit Qytetarëve')}
        subtitle={dt('Raporto, përcjell, informohu dhe merr pjesë në jetën publike të komunës tënde. Për shërbimet administrative shtetërore përdor e-Kosova.')}
        actions={<>
          <Link to="/raporto" className="au-btn au-btn-light">{dt('Raporto një problem')} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          <Link to="/Idea" className="au-btn au-btn-glass"><Lightbulb className="h-4 w-4" aria-hidden="true" /> {dt('Jepni një ide')}</Link>
        </>}
        aside={<AuraStats items={[
          { value: PLATFORM_SERVICES.length + SERVICES_DATA.length, label: dt('shërbime në katalog') },
          { value: '38', label: dt('komuna të mbuluara') },
          { value: 'Track-ID', label: dt('ndjekje publike e çdo rasti') },
        ]} />}
      />

      {/* Who provides what: two compact cards, no table. */}
      <AuraSection id="who" title={dt('Kush e ofron shërbimin?')}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Link to="/raporto" className="au-tile au-tile-link flex items-start gap-3 p-4">
            <span className="au-ico"><Shield className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2"><span className="text-[15px] font-semibold">{dt('Zëri Qytetarëve')}</span><span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{dt('Aktive')}</span></span>
              <span className="au-sub mt-0.5 block text-[13px] leading-snug">{dt('Raportime, Track-ID, harta, transparencë dhe pjesëmarrje qytetare.')}</span>
            </span>
          </Link>
          <a href="https://ekosova.rks-gov.net" target="_blank" rel="noreferrer" className="au-tile au-tile-link flex items-start gap-3 p-4">
            <span className="au-ico"><Building className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2"><span className="text-[15px] font-semibold">e-Kosova</span><span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold dark:bg-white/10">{dt('Portali zyrtar')}</span><ExternalLink className="ml-auto h-3.5 w-3.5 opacity-50" aria-hidden="true" /></span>
              <span className="au-sub mt-0.5 block text-[13px] leading-snug">{dt('Shërbime publike shtetërore të ofruara në mënyrë elektronike.')}</span>
            </span>
          </a>
        </div>
      </AuraSection>

      {/* Catalogue */}
      <AuraSection id="catalog" title={dt('Të gjitha shërbimet')} action={<span className="au-sub text-[12px]" role="status">{filteredServices.length}</span>}>
        <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <label htmlFor="svc-search" className="sr-only">{dt('Kërko shërbim...')}</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" aria-hidden="true" />
            <input id="svc-search" type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={dt('Kërko shërbim...')} className="au-input !pl-9" />
          </div>
          <div className="au-rail min-w-0 flex-1" role="group" aria-label={dt('Fusha')}>
            {categories.map(category => (
              <button key={category} type="button" aria-pressed={selectedCategory === category} onClick={() => setSelectedCategory(category)} className="au-chip">
                {category === 'all' ? dt('Të gjitha') : category} <span className="au-count">{countFor(category)}</span>
              </button>
            ))}
          </div>
        </div>

        {filteredServices.length === 0 ? (
          <AuraEmpty icon={Search} title={dt('Nuk u gjet asnjë shërbim')} text={dt('Provoni një kërkim tjetër, ose pastroni filtrat për të parë të gjitha shërbimet e katalogut.')}
            action={<button type="button" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }} className="au-btn au-btn-primary">{dt('Pastroni filtrat')}</button>} />
        ) : (
          <div className="space-y-5">
            {platformList.length > 0 && (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {platformList.map(service => (
                  <article key={service.id} className="au-tile flex flex-col p-4">
                    <div className="flex items-start gap-3">
                      <span className="au-ico"><CheckCircle2 className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <p className="au-sub text-[11px] font-semibold uppercase tracking-wide">{service.category}</p>
                        <h3 className="text-[15px] font-semibold leading-snug">{service.title}</h3>
                      </div>
                    </div>
                    <p className="au-sub mt-2 flex-1 text-[13px] leading-relaxed">{service.description}</p>
                    {service.requirements && service.requirements.length > 0 && (
                      <ul className="mt-2 space-y-1 text-[12px]">
                        {service.requirements.map(r => <li key={r} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--au-accent)]" aria-hidden="true" /><span className="au-sub">{dt(r)}</span></li>)}
                      </ul>
                    )}
                    {service.to && <Link to={service.to} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--au-accent)]">{dt('Hap')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
                  </article>
                ))}
              </div>
            )}

            {municipalList.length > 0 && (
              <div className="space-y-2.5">
                <AuraNote tone="warn" icon={HelpCircle}>{dt('Tarifat, afatet dhe dokumentet e kërkuara ndryshojnë sipas komunës dhe ligjit. Konfirmojini te institucioni ose te e-Kosova para se të aplikoni.')}</AuraNote>
                <ul className="au-list">
                  {municipalList.map(service => (
                    <li key={service.id} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="au-sub text-[11px] font-semibold uppercase tracking-wide">{service.category}</p>
                        <h3 className="text-[15px] font-medium leading-snug">{service.title}</h3>
                        <p className="au-sub text-[12px]">{service.department}</p>
                        <p className="au-sub mt-1 text-[13px] leading-relaxed">{service.description}</p>
                      </div>
                      {service.onlineUrl ? (
                        <a href={service.onlineUrl} target="_blank" rel="noreferrer" className="au-btn au-btn-soft shrink-0 !h-9 !text-[13px]">{dt('Hap portalin e-Kosova')} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
                      ) : (
                        <button type="button" onClick={() => navigate('/kontakt-numrat')} className="au-btn au-btn-soft shrink-0 !h-9 !text-[13px]"><Phone className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Gjej zyrën përgjegjëse')}</button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </AuraSection>

      {/* Feedback */}
      <section id="platform-feedback" className="au-tile scroll-mt-20 grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--au-accent)]">{dt('Zëri juaj na orienton')}</p>
          <h2 className="mt-1 text-[20px] font-semibold leading-tight">{dt('Çfarë duhet të shtojmë në platformë?')}</h2>
          <p className="au-sub mt-2 text-[13px] leading-relaxed">{dt('Na tregoni çfarë do ta bënte Zërin Qytetarëve më të dobishëm: një shërbim të ri, një mënyrë më të mirë për të ndjekur raportimin ose një ide për komunën tuaj.')}</p>
        </div>
        <form onSubmit={handleFeedbackSubmit} className="space-y-3">
          <div>
            <p className="au-label">{dt('Si e vlerësoni platformën?')}</p>
            <div className="flex items-center" role="radiogroup" aria-label={dt('Vlerësimi nga 1 deri në 5')}>
              {[1, 2, 3, 4, 5].map(value => (
                <button key={value} type="button" role="radio" aria-checked={rating === value} onClick={() => setRating(value)} aria-label={`${value} yje`} className="grid h-10 w-10 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-[var(--au-accent)]">
                  <Star className={cn('h-6 w-6 transition-colors', value <= rating ? 'fill-amber-400 text-amber-400' : 'text-black/20 dark:text-white/25')} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="platform-feedback-text" className="au-label">Sugjerimi juaj</label>
            <textarea id="platform-feedback-text" value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} maxLength={1000} placeholder={dt('Shkruani idenë, nevojën ose përmirësimin që dëshironi të shihni...')} className="au-input" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="au-sub text-[12px]">{dt('Sugjerimet shqyrtohen nga ekipi i platformës.')}</span>
            <button type="submit" disabled={isSendingFeedback} className="au-btn au-btn-primary"><Send className="h-4 w-4" aria-hidden="true" /> {isSendingFeedback ? 'Duke dërguar...' : 'Dërgo sugjerimin'}</button>
          </div>
        </form>
      </section>

      <p className="au-sub text-center text-[13px]">
        {dt('Keni nevojë për ndihmë?')} <Link to="/ndihma" className="font-semibold text-[var(--au-accent)]">{dt('Qendra e ndihmës')}</Link> · <Link to="/kontakt" className="font-semibold text-[var(--au-accent)]">{dt('Na shkruani')}</Link>
      </p>
    </AuraPage>
  );
}

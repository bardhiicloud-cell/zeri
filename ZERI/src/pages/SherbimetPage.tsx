import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  FileText, Search, ExternalLink, Clock, DollarSign, 
  CheckCircle2, HelpCircle, Shield, ArrowRight, Download,
  Home, Building, TreePine, HeartPulse, GraduationCap, AlertTriangle, Lightbulb, Star, Send
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHero, heroPrimaryClass, heroSecondaryClass } from '../components/layout/PageHero';
import toast from 'react-hot-toast';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

import { dt } from '@/src/lib/dt';
interface ServiceItem {
  id: string;
  category: string;
  title: string;
  department: string;
  description: string;
  requirements: string[];
  fee: string;
  deadline: string;
  isOnline: boolean;
  onlineUrl?: string;
  formName?: string;
}

const SERVICES_DATA: ServiceItem[] = [
  // Gjendja Civile
  {
    id: 'gc-1',
    category: 'Gjendja Civile',
    title: 'Certifikatë e Lindjes, Martesës dhe Vendbanimit',
    department: 'Drejtoria e Administratës së Përgjithshme',
    description: 'Pajisja me ekstrakte dhe certifikata zyrtare të gjendjes civile për të gjithë qytetarët e regjistruar.',
    requirements: ['Letërnjoftimi valid ose pasaporta', 'Numri personal 10-shifror', 'Autorizimi nëse aplikohet për persona të tretë'],
    fee: '1.00 € (ose falas online)',
    deadline: 'Menjëherë (10 min)',
    isOnline: true,
    onlineUrl: 'https://ekosova.rks-gov.net'
  },
  {
    id: 'gc-2',
    category: 'Gjendja Civile',
    title: 'Ndryshimi i Vendbanimit dhe Regjistrimi i Ri',
    department: 'Drejtoria e Administratës së Përgjithshme',
    description: 'Regjistrimi zyrtar i adresës së re të banimit brenda komunës apo kalimi nga një komunë tjetër.',
    requirements: ['Kontrata e qirasë apo fleta poseduese e pronës', 'Fatura e fundit e shërbimeve publike (rrymë/ujë)', 'Letërnjoftimi'],
    fee: 'Falas',
    deadline: '24 orë',
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
    requirements: ['Numri i ngastrës kadastrale', 'Kopja e letërnjoftimit të pronarit', 'Dëshmia mbi pagesën e tarifës'],
    fee: '4.00 € për ngastër',
    deadline: 'Brenda ditës',
    isOnline: true,
    onlineUrl: 'https://ekosova.rks-gov.net'
  },
  {
    id: 'kp-2',
    category: 'Kadastër & Pronë',
    title: 'Kopja e Planit Kadastral dhe Matjet Gjeodezike',
    department: 'Drejtoria për Kadastër dhe Gjeodezi',
    description: 'Lëshimi i planit të situacionit me koordinata gjeodezike zyrtare nga baza e të dhënave të AKK-së.',
    requirements: ['Kërkesa me shkrim e pronarit', 'Fleta poseduese', 'Vërtetimi i tatimit në pronë'],
    fee: '10.00 €',
    deadline: '2-3 ditë pune',
    isOnline: false,
    formName: 'Formulari-KopjePlani.pdf'
  },

  // Urbanizmi & Ndërtimi
  {
    id: 'un-1',
    category: 'Urbanizëm & Leje',
    title: 'Kushtet Ndërtimore dhe Leja e Ndërtimit të Kategorisë I & II',
    department: 'Drejtoria e Planifikimit Urban dhe Ndërtimit',
    description: 'Aplikimi për leje ndërtimi për shtëpi individuale banimi, objekte shumëbanesore apo komplekse afariste.',
    requirements: ['Projekti kryesor arkitektonik i nënshkruar nga inxhinieri i licencuar', 'Dëshmia e pronësisë', 'Pëlqimet mjedisore dhe të infrastrukturës'],
    fee: 'Sipas sipërfaqes (m²)',
    deadline: '15 - 30 ditë kalendarike',
    isOnline: true,
    onlineUrl: 'https://ekosova.rks-gov.net'
  },
  {
    id: 'un-2',
    category: 'Urbanizëm & Leje',
    title: 'Legalizimi i Ndërtimeve pa Leje',
    department: 'Drejtoria e Urbanizmit',
    description: 'Përfshirja në regjistrin e trajtimit të ndërtimeve pa leje sipas ligjit në fuqi për legalizim.',
    requirements: ['Fotografitë e objektit nga të gjitha anët', 'Certifikata e pronësisë së truallit', 'Certifikata gjeodezike me matje'],
    fee: '1.00 € / m² për shtëpi banimi',
    deadline: '30 ditë',
    isOnline: false,
    formName: 'Formulari-Legalizimi.pdf'
  },

  // Shërbime Publike & Mbeturina
  {
    id: 'sp-1',
    category: 'Shërbime Publike',
    title: 'Kërkesë për Vendosjen ose Riparimin e Ndriçimit Publik',
    department: 'Drejtoria e Shërbimeve Publike dhe Emergjencës',
    description: 'Raportimi i prishjeve të shtyllave, llambave LED apo kërkesa për zgjerim të rrjetit në lagje dhe fshatra.',
    requirements: ['Adresa e saktë apo pika në hartë', 'Foto e shtyllës ose lokacionit', 'Përshkrim i shkurtër i problemit'],
    fee: 'Falas',
    deadline: '48 - 72 orë',
    isOnline: true
  },
  {
    id: 'sp-2',
    category: 'Shërbime Publike',
    title: 'Orari i Mbeturinave dhe Pastrimi i Deponive Ilegale',
    department: 'Drejtoria e Shërbimeve Publike & Kompania Regjionale',
    description: 'Informacione mbi oraret ditore të largimit të mbeturinave dhe kërkesa për pastrim të hapësirave të ndotura.',
    requirements: ['Lokacioni i saktë', 'Përshkrimi i vëllimit të mbeturinave'],
    fee: 'Falas',
    deadline: '24 - 48 orë',
    isOnline: true
  },

  // Tatimi në Pronë
  {
    id: 'tp-1',
    category: 'Tatimi në Pronë',
    title: 'Verifikimi i Faturës dhe Pagesa e Tatimit në Pronë',
    department: 'Drejtoria për Financa dhe Tatim në Pronë',
    description: 'Kontrolli i gjendjes financiare tatimore, shkarkimi i faturës vjetore dhe pagesa elektronike e menjëhershme.',
    requirements: ['Numri personal i pronarit', 'Numri i llogarisë së pronës'],
    fee: 'Sipas vlerësimit komunal',
    deadline: 'Menjëherë online',
    isOnline: true,
    onlineUrl: 'https://tatimineprone-rks.org'
  },
  {
    id: 'tp-2',
    category: 'Tatimi në Pronë',
    title: 'Certifikatë mbi Pagimin e Detyrimeve Tatimore Komunale',
    department: 'Drejtoria për Financa',
    description: 'Vërtetim zyrtar se qytetari apo biznesi nuk ka borxhe të papaguara ndaj buxhetit komunal.',
    requirements: ['Letërnjoftimi / Certifikata e biznesit', 'Dëshmia e shlyerjes së borxhit'],
    fee: 'Falas',
    deadline: 'Brenda ditës',
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
    requirements: ['Libreza shëndetësore ose Numri personal', 'Kartela e vaksinimit për fëmijë'],
    fee: 'Falas (ose 1.00 € participim)',
    deadline: 'Sipas orarit të lirë',
    isOnline: true
  },
  {
    id: 'sh-2',
    category: 'Shëndetësi & QKMF',
    title: 'Shërbimi Shëndetësor Shtëpiak për Personat e Palëvizshëm',
    department: 'QKMF dhe Kujdesi Parësor Shëndetësor',
    description: 'Ekipet mobile mjekësore për vizita dhe terapi shtëpiake për pacientët e moshuar ose me aftësi të kufizuara.',
    requirements: ['Raporti mjekësor i specialistit', 'Kërkesa nga anëtari i familjes'],
    fee: 'Falas',
    deadline: '24 orë',
    isOnline: false,
    formName: 'Kerkesa-Shendetsore-Shtepiake.pdf'
  },

  // Arsimi & Çerdhet
  {
    id: 'ar-1',
    category: 'Arsim & Çerdhe',
    title: 'Regjistrimi i Fëmijëve në Çerdhet dhe Kopshtet Publike',
    department: 'Drejtoria Komunale e Arsimit (DKA)',
    description: 'Konkursi vjetor dhe regjistrimi online për pranimin e fëmijëve në institucionet parashkollore komunale.',
    requirements: ['Certifikata e lindjes së fëmijës', 'Dëshmia e punësimit të prindërve', 'Vërtetimi i vendbanimit'],
    fee: 'Sipas të ardhurave familjare',
    deadline: 'Gjatë periudhës së konkursit',
    isOnline: true,
    onlineUrl: 'https://ekosova.rks-gov.net'
  },
  {
    id: 'ar-2',
    category: 'Arsim & Çerdhe',
    title: 'Aplikimi për Bursa Komunale për Studentë dhe Nxënës Elitarë',
    department: 'Drejtoria Komunale e Arsimit',
    description: 'Mbështetje financiare vjetore për studentët me sukses të shkëlqyer akademik dhe në fusha deficitare.',
    requirements: ['Certifikata e notave (mesatarja mbi 8.5/9.0)', 'Vërtetimi i regjistrimit të vitit akademik', 'Letërnjoftimi'],
    fee: 'Falas',
    deadline: 'Sipas shpalljes zyrtare',
    isOnline: true,
    onlineUrl: 'https://ekosova.rks-gov.net'
  }
];

const PLATFORM_SERVICES: ServiceItem[] = [
  {
    id: 'platform-report', category: 'Raportime qytetare', title: 'Raporto një problem publik', department: 'Zëri Qytetarëve',
    description: 'Dërgo një raportim me foto, video, lokacion, kategori dhe nivel urgjence te platforma qytetare.',
    requirements: ['Titulli dhe përshkrimi i problemit', 'Lokacioni i saktë në hartë', 'Foto ose video, nëse ka'], fee: 'Falas', deadline: 'Dërgohet menjëherë', isOnline: false
  },
  {
    id: 'platform-track', category: 'Raportime qytetare', title: 'Përcjell raportimin me Track-ID', department: 'Zëri Qytetarëve',
    description: 'Gjej raportimin tënd, shiko statusin dhe historikun e veprimeve nga agjentët, administratorët dhe institucionet.',
    requirements: ['Track-ID i raportimit', 'Kërkimi në regjistrin publik'], fee: 'Falas', deadline: 'Në kohë reale', isOnline: false
  },
  {
    id: 'platform-map', category: 'Transparencë & Harta', title: 'Shiko hartën e problemeve', department: 'Zëri Qytetarëve',
    description: 'Eksploro raportimet e aprovuara në Kosovë me filtra për komunë, kategori, status dhe urgjencë.',
    requirements: ['Zgjidh komunën ose Kosovën', 'Përdor filtrat e hartës'], fee: 'Falas', deadline: 'Në kohë reale', isOnline: false
  },
  {
    id: 'platform-institutions', category: 'Institucione & Agjentë', title: 'Dërgo rastin te përgjegjësi i duhur', department: 'Zëri Qytetarëve',
    description: 'Platforma e klasifikon dhe e orienton problemin te agjentët, administratorët ose institucioni përgjegjës.',
    requirements: ['Kategori e saktë', 'Përshkrim i qartë', 'Komuna e problemit'], fee: 'Falas', deadline: 'Sipas urgjencës', isOnline: false
  },
  {
    id: 'platform-community', category: 'Pjesëmarrje qytetare', title: 'Debat publik dhe sondazhe', department: 'Zëri Qytetarëve',
    description: 'Merr pjesë në diskutime dhe sondazhe për çështje që ndikojnë në komunitetin tënd.',
    requirements: ['Llogari qytetare ose qasje si mysafir', 'Respektimi i rregullave të komunitetit'], fee: 'Falas', deadline: 'Aktive sipas njoftimit', isOnline: false
  },
  {
    id: 'platform-alerts', category: 'Njoftime lokale', title: 'Njoftime sipas komunës', department: 'Zëri Qytetarëve',
    description: 'Zgjidh komunën tënde për të parë raportimet, njoftimet, reklamat dhe informacionet më relevante për zonën.',
    requirements: ['Zgjidh komunën nga Zona juaj', 'Mund të ndryshosh komunën kurdo'], fee: 'Falas', deadline: 'Përditësohet automatikisht', isOnline: false
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
    'Raportime qytetare', 'Transparencë & Harta', 'Institucione & Agjentë', 'Pjesëmarrje qytetare', 'Njoftime lokale'
  ];

  const filteredServices = useMemo(() => {
    return PLATFORM_SERVICES.filter(srv => {
      const matchCat = selectedCategory === 'all' || srv.category === selectedCategory;
      const matchSearch = srv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          srv.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          srv.department.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [searchQuery, selectedCategory]);

  const handleDownloadStub = (formName?: string) => {
    toast.success(`Formulari ${formName || 'zyrtar'} u përgatit për shkarkim!`);
  };

  const handleFeedbackSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rating || feedback.trim().length < 10) {
      toast.error('Zgjidhni një vlerësim dhe shkruani një sugjerim me të paktën 10 karaktere.');
      return;
    }

    setIsSendingFeedback(true);
    try {
      await addDoc(collection(db, 'platformFeedback'), {
        rating,
        feedback: feedback.trim(),
        source: 'SherbimetPage',
        createdAt: serverTimestamp()
      });
      toast.success('Faleminderit. Sugjerimi juaj u dërgua për shqyrtim.');
      setRating(0);
      setFeedback('');
    } catch (error) {
      console.error('Gabim gjatë dërgimit të sugjerimit:', error);
      toast.error('Sugjerimi nuk u dërgua. Provoni përsëri.');
    } finally {
      setIsSendingFeedback(false);
    }
  };

  return (
    <div className="page-shell min-h-screen bg-(--color-page) dark:bg-(--color-brand-dark) text-slate-800 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <PageHero
          eyebrow={dt('Shërbimet e platformës')}
          icon={FileText}
          title={dt('Shërbimet e Zërit Qytetarëve')}
          subtitle={dt('Raporto, përcjell, informohu dhe merr pjesë në jetën publike të komunës tënde. Për shërbimet administrative shtetërore përdor e-Kosova.')}
          actions={
            <>
              <Link to="/raporto" className={heroPrimaryClass}>{dt('Raporto një problem')} <ArrowRight className="w-3.5 h-3.5" /></Link>
              <Link to="/Idea" className={heroSecondaryClass}><Lightbulb className="w-3.5 h-3.5 text-amber-300" /> {dt('Jepni një ide')}</Link>
            </>
          }
          stats={[
            { value: '38', label: dt('komuna të mbuluara') },
            { value: '24/7', label: dt('raportim në çdo kohë') },
            { value: 'Track-ID', label: dt('ndjekje publike e çdo rasti') },
            { value: '100%', label: dt('transparencë e veprimeve') },
          ]}
        />

        <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
          <div className="rounded-2xl bg-[#0b2b57] p-6 sm:p-8 text-white shadow-lg border border-blue-900/50">
            <div className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-200 mb-3">{dt('Ideja jonë')}</div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">{dt('Një zë i vetëm për çdo problem publik.')}</h2>
            <p className="text-sm leading-relaxed text-blue-100 max-w-2xl">{dt('Zëri Qytetarëve është platformë e pjesëmarrjes publike që e kthen një shqetësim të qytetarit në raportim të dokumentuar, me lokacion, Track-ID, përgjegjës dhe histori veprimesh.')}</p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/10 border border-white/10 p-3"><strong className="block text-lg">01</strong><span className="text-xs text-blue-100">{dt('Raporto')}</span></div>
              <div className="rounded-xl bg-white/10 border border-white/10 p-3"><strong className="block text-lg">02</strong><span className="text-xs text-blue-100">{dt('Përcjell')}</span></div>
              <div className="rounded-xl bg-white/10 border border-white/10 p-3"><strong className="block text-lg">03</strong><span className="text-xs text-blue-100">{dt('Merr përgjigje')}</span></div>
            </div>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 sm:p-8 border border-slate-200/80 dark:border-white/10 shadow-xs">
            <div className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-600 mb-3">{dt('Çfarë na duhet')}</div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-3">{dt('Bashkëpunim që prodhon rezultat.')}</h2>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li><strong className="text-slate-900 dark:text-white">{dt('Qytetarë aktivë:')}</strong> {dt('raportime të sakta dhe me dëshmi.')}</li>
              <li><strong className="text-slate-900 dark:text-white">{dt('Institucione të përgjegjshme:')}</strong> {dt('pranim, caktim dhe përditësim i rasteve.')}</li>
              <li><strong className="text-slate-900 dark:text-white">{dt('Të dhëna publike:')}</strong> {dt('transparencë pa ekspozuar të dhënat personale.')}</li>
            </ul>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-white/5">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{dt('Kush e ofron shërbimin?')}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{dt('Përdorni platformën e duhur për kërkesën tuaj.')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400"><tr><th className="px-5 py-3 font-black">{dt('Platforma')}</th><th className="px-5 py-3 font-black">{dt('Qëllimi')}</th><th className="px-5 py-3 font-black">{dt('Statusi')}</th><th className="px-5 py-3 font-black">{dt('Veprimi')}</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                <tr><td className="px-5 py-4 font-black text-blue-700 dark:text-blue-300">{dt('Zëri Qytetarëve')}</td><td className="px-5 py-4 text-slate-600 dark:text-slate-300">{dt('Raportime, Track-ID, harta, transparencë dhe pjesëmarrje qytetare.')}</td><td className="px-5 py-4"><span className="rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 font-bold text-emerald-700 dark:text-emerald-300">{dt('Aktive')}</span></td><td className="px-5 py-4"><Link to="/raporto" className="font-black text-blue-600 hover:text-blue-700">{dt('Raporto një problem')}</Link></td></tr>
                <tr><td className="px-5 py-4 font-black text-slate-900 dark:text-white">e-Kosova</td><td className="px-5 py-4 text-slate-600 dark:text-slate-300">{dt('Shërbime publike shtetërore të ofruara në mënyrë elektronike.')}</td><td className="px-5 py-4"><span className="rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 font-bold text-emerald-700 dark:text-emerald-300">Portali zyrtar</span></td><td className="px-5 py-4"><a href="https://ekosova.rks-gov.net" target="_blank" rel="noreferrer" className="font-black text-blue-600 hover:text-blue-700">{dt('Hap e-Kosova')}</a></td></tr>
                <tr><td className="px-5 py-4 font-black text-slate-900 dark:text-white">{dt('e-Komuna')}</td><td className="px-5 py-4 text-slate-600 dark:text-slate-300">{dt('Shërbime komunale të integruara në fazën e ardhshme të projektit.')}</td><td className="px-5 py-4"><span className="rounded-full bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 font-bold text-amber-700 dark:text-amber-300">{dt('Së shpejti')}</span></td><td className="px-5 py-4 text-slate-500 dark:text-slate-400">{dt('Nuk është ende aktive')}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="platform-feedback" className="scroll-mt-20 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-xs p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-6 items-start">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-black text-amber-600 mb-3">{dt('Zëri juaj na orienton')}</div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{dt('Çfarë duhet të shtojmë në platformë?')}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-3">{dt('Na tregoni çfarë do ta bënte Zërin Qytetarëve më të dobishëm: një shërbim të ri, një mënyrë më të mirë për të ndjekur raportimin ose një ide për komunën tuaj.')}</p>
            </div>
            <form onSubmit={handleFeedbackSubmit} className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-white/10 p-4 sm:p-5">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">{dt('Si e vlerësoni platformën?')}</label>
              <div className="flex items-center gap-1 mb-4" aria-label={dt('Vlerësimi nga 1 deri në 5')}>
                {[1, 2, 3, 4, 5].map(value => (
                  <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} yje`} className="p-1">
                    <Star className={cn('w-6 h-6 transition-colors', value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600')} />
                  </button>
                ))}
              </div>
              <label htmlFor="platform-feedback-text" className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">Sugjerimi juaj</label>
              <textarea id="platform-feedback-text" value={feedback} onChange={event => setFeedback(event.target.value)} rows={4} maxLength={1000} placeholder={dt('Shkruani idenë, nevojën ose përmirësimin që dëshironi të shihni...')} className="w-full resize-none rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500" />
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[10px] text-slate-400">{dt('Sugjerimet shqyrtohen nga ekipi i platformës.')}</span>
                <button type="submit" disabled={isSendingFeedback} className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-4 py-2.5 text-xs font-black text-white">
                  <Send className="w-3.5 h-3.5" /> {isSendingFeedback ? 'Duke dërguar...' : 'Dërgo sugjerimin'}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-5 items-start">
          <aside className="lg:sticky lg:top-20 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Filtrimi</h2>
              <span className="text-[10px] font-bold text-slate-400">{filteredServices.length} rezultate</span>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder={dt('Kërko shërbim...')} value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Fusha</p>
            <div className="space-y-1.5">
              {categories.map(category => (
                <button key={category} type="button" onClick={() => setSelectedCategory(category)} className={cn('w-full text-left rounded-lg px-3 py-2.5 text-xs font-bold transition-colors', selectedCategory === category ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800')}>
                  {category === 'all' ? 'Të gjitha' : category}
                </button>
              ))}
            </div>
          </aside>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filteredServices.map((service) => (
            <div 
              key={service.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs hover:shadow-md transition-all p-5 sm:p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900">
                    {service.category}
                  </span>
                  
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{dt('Shërbim i Zërit Qytetarëve')}</span>
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight mb-1.5">
                  {service.title}
                </h3>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                  {service.department}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                  {service.description}
                </p>

                {/* Requirements List */}
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-white/5 mb-4">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    {dt('Çfarë nevojitet:')}
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {service.requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Fee & Deadline Pills */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <DollarSign className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Tarifa: <strong className="text-slate-900 dark:text-white">{service.fee}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Afati: <strong className="text-slate-900 dark:text-white">{service.deadline}</strong></span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-3">
                {service.isOnline && service.onlineUrl ? (
                  <a
                    href={service.onlineUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                  >
                    <span>{dt('Apliko Menjëherë')}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : service.formName ? (
                  <button
                    onClick={() => handleDownloadStub(service.formName)}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Shkarko Formularin PDF</span>
                  </button>
                ) : (
                  <button
                    onClick={() => navigate('/raporto')}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>{dt('Paraqit Kërkesën në Platformë')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 p-5 shadow-xs">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-2">{dt('Shërbime administrative: e-Kosova')}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">{dt('Për certifikata, dokumente personale, tatime dhe aplikime shtetërore, përdorni portalin zyrtar e-Kosova. Zëri Qytetarëve ju orienton, por nuk e zëvendëson portalin shtetëror.')}</p>
            <a href="https://ekosova.rks-gov.net" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-700">{dt('Hap e-Kosova')} <ExternalLink className="w-3.5 h-3.5" /></a>
          </div>
          <div className="bg-blue-950 rounded-2xl border border-blue-800/60 p-5 shadow-xs text-white">
            <h3 className="text-base font-black mb-2">{dt('e-Komuna: së shpejti')}</h3>
            <p className="text-xs text-blue-100 leading-relaxed">{dt('Pas përfundimit të projektit, e-Komuna do të sjellë shërbime komunale të integruara. Deri atëherë, përdorni Zërin Qytetarëve për raportime, transparencë dhe pjesëmarrje.')}</p>
          </div>
        </div>

        {/* Informative Assistance Box */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 border border-blue-800/40 shadow-md">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-lg font-black">{dt('Keni nevojë për ndihmë?')}</h3>
            <p className="text-xs sm:text-sm text-blue-200 max-w-xl">
              {dt('Për një problem publik, përdorni raportimin në Zërin Qytetarëve. Për kontakte dhe numra institucionalë, shikoni qendrën e kontakteve.')}
            </p>
          </div>
          <Link
            to="/kontakt"
            className="px-5 py-2.5 bg-white text-blue-950 hover:bg-blue-50 rounded-xl text-xs font-black shrink-0 transition-all shadow-sm"
          >
            Shih Kontaktet
          </Link>
        </div>

      </div>
    </div>
  );
}

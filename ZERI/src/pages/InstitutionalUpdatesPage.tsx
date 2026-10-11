import React, { useState } from 'react';
import { 
  Building2, Calendar, MapPin, Search, ArrowRight, Share2, 
  ExternalLink, ArrowLeft, Filter, Tag, CheckCircle2, ChevronRight, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import toast from 'react-hot-toast';
import dardaniaImg from '../assets/images/dardania_lighting_1789827134761.jpg';
import gjilanImg from '../assets/images/gjilan_cleaning_1789827148688.jpg';
import maplConferenceImg from '../assets/images/mapl_conference_1789827163506.jpg';

export interface InstitutionalUpdate {
  id: string;
  institution: string;
  municipality: string;
  date: string;
  title: string;
  summary: string;
  content: string;
  image: string;
  category: string;
  officialSource?: string;
  status: 'Përfunduar' | 'Në Zhvillim' | 'Planifikuar';
}

export const INSTITUTIONAL_UPDATES: InstitutionalUpdate[] = [
  {
    id: 'upd-1',
    institution: 'Komuna e Prishtinës',
    municipality: 'Prishtinë',
    date: '18.09.2026',
    category: 'Ndriçim publik',
    status: 'Përfunduar',
    image: dardaniaImg,
    title: "Përfundon rregullimi i ndriçimit publik në lagjen 'Dardania'",
    summary: "Komuna e Prishtinës njofton se është përfunduar rregullimi i ndriçimit publik në disa rrugë të lagjes Dardania me ndriçues efiçientë LED.",
    content: `Komuna e Prishtinës, përmes Drejtorisë së Shërbimeve Publike, njofton të gjithë qytetarët se ka përfunduar me sukses faza e parë e modernizimit të rrjetit të ndriçimit publik në lagjen "Dardania".

Projekti përfshiu zëvendësimin e mbi 240 trupave ndriçues me teknologji të avancuar LED me kursim energjie deri në 60%, si dhe rregullimin e kabllove nëntokësore përgjatë rrugëve kryesore dhe hapësirave midis banesave.

Ky investim rrit ndjeshëm sigurinë e këmbësorëve gjatë orëve të natës dhe përmirëson cilësinë e jetesës për mbi 15,000 banorë të zonës. Në ditët në vijim, ekipi do të vazhdojë me lagjen "Ulpiana" dhe "Bregu i Diellit".`,
    officialSource: 'https://prishtinaonline.com'
  },
  {
    id: 'upd-2',
    institution: 'Komuna e Gjilanit',
    municipality: 'Gjilan',
    date: '17.09.2026',
    category: 'Mjedis & Pastrim',
    status: 'Në Zhvillim',
    image: gjilanImg,
    title: 'Fillon pastrimi i deponive të egra',
    summary: 'Në kuadër të planit për një ambient më të pastër, Komuna e Gjilanit ka filluar aksionin e pastrimit të deponive të egra në disa lokalitete.',
    content: `Komuna e Gjilanit ka nisur sot aksionin e gjerë për eliminimin e të gjitha deponive ilegale të mbeturinave në zonat rurale dhe periferike të komunës.

Në terren janë angazhuar makineri të rënda dhe ekipe të kompanisë rajonale të mbeturinave. Deri më tani janë pastruar me sukses 4 pika kritike në dalje të qytetit dhe janë vendosur tabela paralajmëruese me kamera vëzhguese.

Kryetari i komunës u bëri thirrje qytetarëve që të raportojnë çdo hedhje të paligjshme të mbeturinave direkt në platformën "Zëri i Qytetarëve" për reagim të menjëhershëm nga inspektorati komunal.`,
    officialSource: 'https://gjilani-komuna.org'
  },
  {
    id: 'upd-3',
    institution: 'Zëri i Qytetarëve',
    municipality: 'Nacionale',
    date: '16.09.2026',
    category: 'Digjitalizim',
    status: 'Përfunduar',
    image: maplConferenceImg,
    title: 'Takim për digjitalizimin e shërbimeve komunale',
    summary: 'Platforma Zëri i Qytetarëve organizoi takim me përfaqësues të komunave për avancimin e digjitalizimit dhe përmirësimin e shërbimeve për qytetarët.',
    content: `Platforma Zëri i Qytetarëve mbajti sot një tryezë të nivelit të lartë me nënkryetarët dhe drejtorët e administratave nga të gjitha 38 komunat e Republikës së Kosovës.

Fokusi i takimit ishte integrimi i plotë i shërbimeve komunale me platformat digjitale qytetare, reduktimi i burokracisë dhe përgjigjja e shpejtë ndaj kërkesave dhe ankesave të parashtruara nga komuniteti.

U prezantua gjithashtu moduli i ri i transparencës buxhetore komunale, i cili do t'u mundësojë qytetarëve të monitorojnë çdo investim publik në kohë reale.`,
    officialSource: 'https://rks-gov.net'
  },
  {
    id: 'upd-4',
    institution: 'Komuna e Prizrenit',
    municipality: 'Prizren',
    date: '15.09.2026',
    category: 'Ujë & Kanalizim',
    status: 'Në Zhvillim',
    image: '/src/assets/images/hero_city_modern_1789826592815.jpg',
    title: 'Nis faza e dytë e riparimit të rrjetit të ujësjellësit në Qendrën Historike',
    summary: 'Projekti synon minimizimin e humbjeve të ujit dhe sigurimin e furnizimit 24 orë pa ndërprerje për bizneset dhe banorët e Shadërvanit.',
    content: `Komuna e Prizrenit në bashkëpunim me KRU "Hidroregjioni Jugor" ka nisur punimet për rikonstruktimin e tubacioneve kryesore në zonën historike. Punimet do të kryhen në orët e vona të natës për të mos penguar lëvizjen e qytetarëve dhe turistëve.`,
    officialSource: 'https://prizreni.org'
  },
  {
    id: 'upd-5',
    institution: 'Komuna e Pejës',
    municipality: 'Pejë',
    date: '14.09.2026',
    category: 'Infrastrukturë',
    status: 'Përfunduar',
    image: '/src/assets/images/festa_qytetit_ad_1789826607925.jpg',
    title: 'Hapet qendra e re multifunksionale për të rinjtë në Pejë',
    summary: 'Hapësirë moderne për kurse digjitale, punëtori inovative dhe aktivitete sportive për komunitetin lokal.',
    content: `Qendra ofron sallë kompjuterike, hapësira 'co-working' dhe ambiente takimesh për organizatat joqeveritare dhe iniciativat rinore të qytetit të Pejës.`,
    officialSource: 'https://peja.rks-gov.net'
  },
  {
    id: 'upd-6',
    institution: 'Komuna e Ferizajt',
    municipality: 'Ferizaj',
    date: '12.09.2026',
    category: 'Mobilitet Urban',
    status: 'Planifikuar',
    image: '/src/assets/images/dardania_lighting_1789827134761.jpg',
    title: 'Miratohet plani i ri për shtigjet e reja të biçikletave',
    summary: 'Mbi 12 kilometra shtigje të dedikuara do të lidhin qendrën e qytetit me parqet dhe shkollat kryesore.',
    content: `Plani synon lehtësimin e trafikut të automjeteve dhe promovimin e transportit të gjelbër në territorin e Komunës së Ferizajt me standardet më të larta të sigurisë rrugore.`,
    officialSource: 'https://ferizaj-komuna.org'
  }
];

export default function InstitutionalUpdatesPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMunicipality, setSelectedMunicipality] = useState('Të gjitha');
  const [selectedCategory, setSelectedCategory] = useState('Të gjitha');
  const [selectedArticle, setSelectedArticle] = useState<InstitutionalUpdate | null>(null);

  const categories = ['Të gjitha', 'Ndriçim publik', 'Mjedis & Pastrim', 'Digjitalizim', 'Ujë & Kanalizim', 'Infrastrukturë', 'Mobilitet Urban'];

  const filteredUpdates = INSTITUTIONAL_UPDATES.filter(item => {
    if (selectedMunicipality !== 'Të gjitha' && item.municipality !== selectedMunicipality && item.municipality !== 'Nacionale') {
      return false;
    }
    if (selectedCategory !== 'Të gjitha' && item.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSummary = item.summary.toLowerCase().includes(q);
      const matchInst = item.institution.toLowerCase().includes(q);
      if (!matchTitle && !matchSummary && !matchInst) return false;
    }
    return true;
  });

  const handleShare = (article: InstitutionalUpdate) => {
    if (navigator.share) {
      navigator.share({ title: article.title, text: article.summary, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Linku u kopjua!");
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] dark:bg-[#0B1320] text-slate-900 dark:text-white pb-20">
      
      {/* Top Banner Header */}
      <div className="bg-[#0b1a30] text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          
          <div className="flex items-center gap-3 mb-4">
            <button 
              onClick={() => navigate('/')} 
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white flex items-center gap-2 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kthehu te Ballina</span>
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold rounded-full">
              <Building2 className="w-3.5 h-3.5" />
              <span>Transparenca Institucionale</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black title-serif text-white tracking-tight">
            Përditësime nga Institucionet
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
            Njoftime zyrtare, projekte të përfunduara dhe punimet në zhvillim nga komunat e Kosovës dhe Ministria e Administrimit të Pushtetit Lokal.
          </p>

          {/* Search & Filter Bar */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-12 gap-3">
            
            <div className="sm:col-span-6 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Kërko njoftime, projekte, komuna..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 backdrop-blur-md"
              />
            </div>

            <div className="sm:col-span-3">
              <select 
                value={selectedMunicipality}
                onChange={(e) => setSelectedMunicipality(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer backdrop-blur-md"
              >
                <option value="Të gjitha" className="text-slate-900">Të gjitha Komunat</option>
                {KOSOVO_MUNICIPALITIES.map(m => (
                  <option key={m} value={m} className="text-slate-900">{m}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer backdrop-blur-md"
              >
                {categories.map(c => (
                  <option key={c} value={c} className="text-slate-900">{c}</option>
                ))}
              </select>
            </div>

          </div>

        </div>
      </div>

      {/* Main Grid Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Duke shfaqur {filteredUpdates.length} njoftime zyrtare
          </span>
          {(selectedMunicipality !== 'Të gjitha' || selectedCategory !== 'Të gjitha' || searchQuery) && (
            <button 
              onClick={() => { setSelectedMunicipality('Të gjitha'); setSelectedCategory('Të gjitha'); setSearchQuery(''); }}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold"
            >
              Pastro të gjitha filtrat
            </button>
          )}
        </div>

        {filteredUpdates.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-12 text-center">
            <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Nuk u gjet asnjë njoftim</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Provoni të zgjidhni një komunë tjetër ose pastroni kërkimin tuaj.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUpdates.map((item) => (
              <article 
                key={item.id}
                onClick={() => setSelectedArticle(item)}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group cursor-pointer"
              >
                {/* Image */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img 
                    src={item.image} 
                    alt={item.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="px-2.5 py-1 bg-slate-950/80 backdrop-blur-md text-white text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1 shadow-sm">
                      <Building2 className="w-3 h-3 text-blue-400" />
                      {item.institution}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full shadow-sm">
                      {item.status}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1">
                  
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-2 font-medium">
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold">
                      <Tag className="w-3 h-3" />
                      {item.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {item.date}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors leading-snug mb-2">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed mb-4 flex-1">
                    {item.summary}
                  </p>

                  <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs mt-auto">
                    <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 group-hover:gap-1.5 transition-all">
                      <span>Lexo më shumë</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>

                    <button 
                      onClick={(e) => { e.stopPropagation(); handleShare(item); }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                      title="Shpërndaj"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>

              </article>
            ))}
          </div>
        )}

      </div>

      {/* Full editorial reader: an article surface, not a cramped modal. */}
      {selectedArticle && (
        <div className="fixed inset-0 z-[1100] overflow-y-auto bg-[#f5f8fc] dark:bg-slate-950">
          <article className="min-h-full">
            <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
              <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <span className="font-serif text-sm font-black text-slate-900 dark:text-white">Zëri i Qytetarëve <span className="text-blue-600">/ Përditësime</span></span>
                <button onClick={() => setSelectedArticle(null)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-white">← Kthehu te përditësimet</button>
              </div>
            </header>
            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900 sm:rounded-3xl">
              <div className="relative aspect-[16/9] w-full">
              <img 
                src={selectedArticle.image} 
                alt={selectedArticle.title} 
                className="w-full h-full object-cover" 
              />
              <div className="absolute bottom-4 left-4 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-xl text-white text-xs font-bold flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>{selectedArticle.institution}</span>
                <span>•</span>
                <span>{selectedArticle.date}</span>
              </div>
            </div>

            <div className="p-6 sm:p-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold">
                  {selectedArticle.category}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                  {selectedArticle.status}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black title-serif text-slate-900 dark:text-white leading-tight mb-4">
                {selectedArticle.title}
              </h2>

              <p className="mb-8 border-l-4 border-blue-600 pl-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">{selectedArticle.summary}</p>
              <div className="prose max-w-none whitespace-pre-line text-base leading-8 text-slate-700 dark:prose-invert dark:text-slate-300 sm:text-lg">
                {selectedArticle.content}
              </div>

              <div className="mt-8 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                <button 
                  onClick={() => handleShare(selectedArticle)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Shpërndaj Njoftimin</span>
                </button>

                {selectedArticle.officialSource && (
                  <a 
                    href={selectedArticle.officialSource} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline font-bold flex items-center gap-1"
                  >
                    <span>Burimi Zyrtar</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

            </div>

              </div>
            </div>
          </article>
        </div>
      )}

    </div>
  );
}

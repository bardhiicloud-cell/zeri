import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Briefcase, Search, Filter, Calendar, MapPin, 
  TrendingUp, CheckCircle2, Clock, AlertTriangle, 
  Building, ArrowUpRight, DollarSign, Users, Layers
} from 'lucide-react';
import { MunicipalityShield } from '../components/MunicipalityShield';
import { cn } from '../lib/utils';

interface MunicipalProject {
  id: string;
  title: string;
  municipality: string;
  sector: string;
  budget: string;
  status: 'Në Zhvillim' | 'Përfunduar' | 'Në Prokurim';
  progress: number;
  startDate: string;
  endDate: string;
  contractor: string;
  supervisor: string;
  funder: string;
  description: string;
  impact: string;
}

const MUNICIPAL_PROJECTS_ARCHIVE: MunicipalProject[] = [
  {
    id: 'prj-1',
    title: 'Ndërtimi i Rrugës "A" dhe Kolektorit të Madh Fekal',
    municipality: 'Prishtinë',
    sector: 'Infrastrukturë Rrugore',
    budget: '8,420,000 €',
    status: 'Në Zhvillim',
    progress: 72,
    startDate: 'Mars 2024',
    endDate: 'Tetor 2026',
    contractor: 'Konsorciumi "Prishtina Roads & Infra"',
    supervisor: 'Drejtoria e Investimeve Kapitale',
    funder: 'Buxheti i Komunës së Prishtinës',
    description: 'Një nga projektet më madhore infrastrukturore që lidh lagjet Kalabria, Mati 1 dhe Prishtinën e Re me kolektor të mbyllur dhe 6 korsi moderne.',
    impact: 'Zvogëlon ngarkesën e trafikut me mbi 35% dhe eliminon kundërmimin e ujërave të zeza në lagjet jugore.'
  },
  {
    id: 'prj-2',
    title: 'Impianti Modern për Trajtimin e Ujërave të Zeza',
    municipality: 'Pejë',
    sector: 'Mjedis & Kanalizim',
    budget: '14,200,000 €',
    status: 'Përfunduar',
    progress: 100,
    startDate: 'Janar 2023',
    endDate: 'Maj 2026',
    contractor: 'KfW & Hidro-Peja Consortium',
    supervisor: 'Kompania Rajonale Ujësjellësi Hidrodrini',
    funder: 'Granti Gjerman (KfW), Qeveria e Zvicrës dhe Komuna',
    description: 'Teknologji e pastrimit biologjik dhe kimik të ujërave të shkarkuara të qytetit të Pejës para derdhjes në lumin Lumëbardh.',
    impact: 'Mbron 100% ekosistemin e Lumëbardhit dhe garanton ujë të pastër për zonat bujqësore të Rrafshit të Dukagjinit.'
  },
  {
    id: 'prj-3',
    title: 'Revitalizimi dhe Këmbësorizimi i Qendrës Historike',
    municipality: 'Prizren',
    sector: 'Kulturë & Trashëgimi',
    budget: '3,150,000 €',
    status: 'Në Zhvillim',
    progress: 65,
    startDate: 'Tetor 2024',
    endDate: 'Nëntor 2026',
    contractor: 'Guri & Restaurim Sh.p.k.',
    supervisor: 'Qendra Rajonale për Trashëgimi Kulturore',
    funder: 'Komuna e Prizrenit & Bashkimi Evropian',
    description: 'Shtrimi me kalldrëm tradicional të gurit, largimi i kabllove ajrore nëntokë dhe ndriçimi i ri arkitektonik i Shadërvanit.',
    impact: 'Rrit tërheqjen turistike ndërkombëtare dhe mbron autenticitetin shekullor të Prizrenit.'
  },
  {
    id: 'prj-4',
    title: 'Ndërtimi i Parkut të Madh Urban dhe Zonës Rekreative',
    municipality: 'Gjilan',
    sector: 'Mjedis & Parqe',
    budget: '2,800,000 €',
    status: 'Në Zhvillim',
    progress: 48,
    startDate: 'Prill 2025',
    endDate: 'Dhjetor 2026',
    contractor: 'Green City Partners',
    supervisor: 'Drejtoria e Shërbimeve Publike',
    funder: 'Buxheti Komunal i Gjilanit',
    description: 'Hapësirë e gjelbër prej mbi 12 hektarësh me shtigje ecjeje, pistë vrapimi, kënde lojërash për fëmijë dhe amfiteatër të hapur.',
    impact: 'Krijon mushkërinë kryesore të gjelbër për mbi 90,000 qytetarë të Gjilanit.'
  },
  {
    id: 'prj-5',
    title: 'Modernizimi i Ndriçimit Publik me Efiçiencë LED në 24 Fshatra',
    municipality: 'Ferizaj',
    sector: 'Efiçiencë Energjetike',
    budget: '1,200,000 €',
    status: 'Përfunduar',
    progress: 100,
    startDate: 'Qershor 2024',
    endDate: 'Gusht 2026',
    contractor: 'Electro Kosova Group',
    supervisor: 'Drejtoria e Infrastrukturës',
    funder: 'Fondi i Kosovës për Efiçiencë të Energjisë & Komuna',
    description: 'Zëvendësimi i 6,800 poçave të vjetër të merkurit me ndriçues inteligjentë LED dhe sistem tele-menaxhimi.',
    impact: 'Zvogëlimi i shpenzimeve të energjisë elektrike për buxhetin komunal me 62% çdo vit.'
  },
  {
    id: 'prj-6',
    title: 'Ndërtimi i Çerdhes së Re Publike me Standarde Evropiane',
    municipality: 'Mitrovicë',
    sector: 'Edukimi & Shkollat',
    budget: '950,000 €',
    status: 'Në Zhvillim',
    progress: 85,
    startDate: 'Nëntor 2024',
    endDate: 'Shtator 2026',
    contractor: 'Ndërtimi MIT',
    supervisor: 'Drejtoria Komunale e Arsimit',
    funder: 'Komuna e Mitrovicës & MASHTI',
    description: 'Objekt modern me kapacitet për 160 fëmijë, me kuzhinë qendrore, sallë psikologjike dhe hapësirë të jashtme edukative.',
    impact: 'Zgjidh problemin e listave të pritjes për nënat e punësuara në zonën veriore të qytetit.'
  },
  {
    id: 'prj-7',
    title: 'Zgjerimi i Unazës Veriore me Shtigje Çiklizmi dhe Ndriçim',
    municipality: 'Gjakovë',
    sector: 'Infrastrukturë Rrugore',
    budget: '4,500,000 €',
    status: 'Në Zhvillim',
    progress: 35,
    startDate: 'Janar 2025',
    endDate: 'Qershor 2027',
    contractor: 'Dukagjini Asfalt',
    supervisor: 'Drejtoria e Investimeve Kapitale',
    funder: 'Buxheti Komunal dhe Ministria e Mjedisit',
    description: 'Segment rrugor prej 4.8 km me 4 korsi, rrethrrotullime me siguri të lartë dhe shtigje të ndara për biçikleta.',
    impact: 'Largon mjetet e rënda transportuese nga brendësia e zonës historike dhe qendrës.'
  },
  {
    id: 'prj-8',
    title: 'Rinovimi i Thellë Termik i Qendrës Kryesore të Mjekësisë Familjare',
    municipality: 'Podujevë',
    sector: 'Shëndetësi & Efiçiencë',
    budget: '680,000 €',
    status: 'Përfunduar',
    progress: 100,
    startDate: 'Tetor 2024',
    endDate: 'Korrik 2026',
    contractor: 'TermoIzolimi Kosova',
    supervisor: 'Drejtoria e Shëndetësisë',
    funder: 'Buxheti Komunal Podujevë',
    description: 'Fasada ventiluese me izolim lesh guri, pompë termike ngrohje/ftohje dhe panele diellore fotovoltaike në kulm.',
    impact: 'Kushte dinjitoze trajtimi për mbi 80,000 pacientë dhe kursim prej 40,000 € në vit për ngrohje.'
  },
  {
    id: 'prj-9',
    title: 'Rrjeti i Ri i Ujësjellësit dhe Furnizim 24/7 me Ujë të Pijshëm',
    municipality: 'Vushtrri',
    sector: 'Ujësjellës & Kanalizim',
    budget: '1,900,000 €',
    status: 'Në Zhvillim',
    progress: 92,
    startDate: 'Shkurt 2024',
    endDate: 'Tetor 2026',
    contractor: 'Hidro-Teknika',
    supervisor: 'KRU Mitrovica',
    funder: 'Komuna e Vushtrrisë & Donatorët Zviceranë',
    description: 'Vendosja e mbi 32 km gypave të rinj duktil në 14 fshatra të Vushtrrisë dhe instalimi i ujëmatësve digjitalë.',
    impact: 'Furnizim i pandërprerë me ujë cilësor sipas standardeve të OBSH-së për 18,000 banorë.'
  }
];

const PROJECTS_DATA: MunicipalProject[] = [
  {
    id: 'platform-1', title: 'Qendra e Raportimeve Qytetare', municipality: 'Zëri Qytetarëve', sector: 'Raportime', budget: 'Platformë publike', status: 'Përfunduar', progress: 100,
    startDate: 'Janar 2026', endDate: 'Aktive', contractor: 'Ekipi i Zërit Qytetarëve', supervisor: 'Administrimi i platformës', funder: 'Zëri Qytetarëve',
    description: 'Kanal i vetëm ku qytetarët raportojnë probleme, bashkëngjisin dëshmi dhe marrin Track-ID për çdo rast.', impact: 'Raportime më të qarta dhe reagim i matshëm nga institucionet.'
  },
  {
    id: 'platform-2', title: 'Harta Live e Problemeve në Kosovë', municipality: 'Zëri Qytetarëve', sector: 'Harta & Transparenca', budget: 'Platformë publike', status: 'Përfunduar', progress: 100,
    startDate: 'Shkurt 2026', endDate: 'Aktive', contractor: 'Ekipi GIS', supervisor: 'Administrimi i platformës', funder: 'Zëri Qytetarëve',
    description: 'Hartë publike me lokacionet reale të raportimeve të aprovuara dhe statusin e tyre në kohë reale.', impact: 'Çdo problem i aprovuar shihet në vendin e tij dhe mund të ndiqet.'
  },
  {
    id: 'platform-3', title: 'Track-ID dhe Regjistri i Hapur', municipality: 'Zëri Qytetarëve', sector: 'Llogaridhënie', budget: 'Platformë publike', status: 'Në Zhvillim', progress: 82,
    startDate: 'Mars 2026', endDate: 'Dhjetor 2026', contractor: 'Ekipi teknik', supervisor: 'Administrimi i platformës', funder: 'Zëri Qytetarëve',
    description: 'Sistem transparent për gjurmimin e pranimit, shqyrtimit, caktimit dhe zgjidhjes së çdo raportimi.', impact: 'Qytetari nuk humb më informacionin pas dorëzimit të raportimit.'
  },
  {
    id: 'platform-4', title: 'Paneli i Institucioneve dhe Agjentëve', municipality: 'Zëri Qytetarëve', sector: 'Institucione', budget: 'Platformë publike', status: 'Në Zhvillim', progress: 68,
    startDate: 'Prill 2026', endDate: 'Janar 2027', contractor: 'Ekipi i produkteve', supervisor: 'Administrimi i platformës', funder: 'Zëri Qytetarëve',
    description: 'Panel pune për agjentët, administratorët dhe institucionet që pranojnë, caktojnë dhe përditësojnë raportimet.', impact: 'Përgjegjësitë dhe afatet bëhen të dukshme për të gjithë.'
  },
  {
    id: 'platform-5', title: 'Komuniteti dhe Debati Publik', municipality: 'Zëri Qytetarëve', sector: 'Pjesëmarrje qytetare', budget: 'Platformë publike', status: 'Në Zhvillim', progress: 55,
    startDate: 'Maj 2026', endDate: 'Mars 2027', contractor: 'Ekipi komunitar', supervisor: 'Administrimi i platformës', funder: 'Zëri Qytetarëve',
    description: 'Hapësirë për diskutime, sondazhe dhe bashkëpunim mes qytetarëve rreth çështjeve publike.', impact: 'Vendimmarrje më e informuar dhe pjesëmarrje aktive e komunitetit.'
  },
  {
    id: 'platform-6', title: 'Asistenti Inteligjent për Raportime', municipality: 'Zëri Qytetarëve', sector: 'Teknologji qytetare', budget: 'Platformë publike', status: 'Në Zhvillim', progress: 44,
    startDate: 'Qershor 2026', endDate: 'Prill 2027', contractor: 'Ekipi AI', supervisor: 'Administrimi i platformës', funder: 'Zëri Qytetarëve',
    description: 'Ndihmës që orienton qytetarin te kategoria, urgjenca dhe institucioni i duhur pa zëvendësuar vendimmarrjen njerëzore.', impact: 'Raportime më të sakta dhe shpërndarje më e shpejtë te përgjegjësi.'
  }
];

export default function ProjektetPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('all');
  const [selectedSector, setSelectedSector] = useState<string>('all');

  const sectors = [
    'all', 'Raportime', 'Harta & Transparenca', 'Llogaridhënie', 'Institucione', 'Pjesëmarrje qytetare', 'Teknologji qytetare'
  ];

  const filteredProjects = useMemo(() => {
    return PROJECTS_DATA.filter(prj => {
      const matchStatus = selectedStatus === 'all' || prj.status === selectedStatus;
      const matchMuni = selectedMunicipality === 'all' || prj.municipality === selectedMunicipality;
      const matchSector = selectedSector === 'all' || prj.sector === selectedSector;
      const matchSearch = prj.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          prj.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          prj.municipality.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchMuni && matchSector && matchSearch;
    });
  }, [searchQuery, selectedStatus, selectedMunicipality, selectedSector]);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070e1c] text-slate-800 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Hero */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-white/10 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200/60 dark:border-blue-900 mb-3">
                <Briefcase className="w-3.5 h-3.5" />
                <span>Zhvillimi i Platformës</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Projektet e Zërit Qytetarëve
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
                Ndiqni iniciativat, modulet dhe zhvillimet që e bëjnë platformën Zëri Qytetarëve më të dobishme,
                më transparente dhe më afër qytetarëve.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex flex-wrap gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-white/5 text-center min-w-[110px]">
                <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">6</div>
                <div className="text-[10px] font-semibold text-slate-500">Iniciativa aktive</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-white/5 text-center min-w-[100px]">
                <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">77%</div>
                <div className="text-[10px] font-semibold text-slate-500">Progresi i platformës</div>
              </div>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder="Kërkoni iniciativa sipas emrit, fushës apo përshkrimit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
              {/* Status Select */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">Të gjitha Statuset</option>
                <option value="Në Zhvillim">Në Zhvillim</option>
                <option value="Përfunduar">Përfunduar</option>
                <option value="Në Prokurim">Në Prokurim</option>
              </select>

              {/* Komuna Select */}
              <select
                value={selectedMunicipality}
                onChange={(e) => setSelectedMunicipality(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">Të gjitha iniciativat</option>
                <option value="Zëri Qytetarëve">Zëri Qytetarëve</option>
              </select>

              {/* Sektori Select */}
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="col-span-2 sm:col-span-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">Të gjitha fushat</option>
                {sectors.slice(1).map(sector => <option key={sector} value={sector}>{sector}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((prj) => (
            <div 
              key={prj.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs hover:shadow-md transition-all flex flex-col justify-between p-5 group"
            >
              <div>
                {/* Header: Municipality Crest + Status Badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <MunicipalityShield name={prj.municipality} size="sm" />
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block leading-tight">
                        {prj.municipality}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 block">
                        {prj.sector}
                      </span>
                    </div>
                  </div>

                  <span className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-bold border shrink-0",
                    prj.status === 'Përfunduar' && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
                    prj.status === 'Në Zhvillim' && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900",
                    prj.status === 'Në Prokurim' && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900"
                  )}>
                    {prj.status}
                  </span>
                </div>

                {/* Project Title */}
                <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug mb-2 group-hover:text-blue-600 transition-colors">
                  {prj.title}
                </h3>

                {/* Description */}
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">
                  {prj.description}
                </p>

                {/* Progress Bar */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-white/5 mb-4">
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-600 dark:text-slate-400">Ecuria Fizike</span>
                    <span className={cn(
                      prj.progress === 100 ? "text-emerald-600" : "text-blue-600"
                    )}>
                      {prj.progress}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        prj.progress === 100 ? "bg-emerald-500" : "bg-blue-600"
                      )}
                      style={{ width: `${prj.progress}%` }}
                    />
                  </div>
                </div>

                {/* Budget & Timeline */}
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Lloji:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{prj.budget}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Afati:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{prj.startDate} - {prj.endDate}</span>
                  </div>
                  <div className="flex items-center justify-between truncate">
                    <span className="text-[11px] text-slate-400 shrink-0">Përgjegjësi:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate ml-2">{prj.contractor}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer Impact Note */}
              <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium italic truncate max-w-[200px]">
                  {prj.funder}
                </span>
                <button
                  onClick={() => navigate(`/detailed-registry?q=${encodeURIComponent(prj.municipality)}`)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 cursor-pointer"
                >
                  <span>Raportet</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-8">
            <Briefcase className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Nuk u gjet asnjë projekt</h3>
            <p className="text-xs text-slate-500 mt-1">Provoni të ndryshoni fushën ose kërkimin.</p>
          </div>
        )}

      </div>
    </div>
  );
}

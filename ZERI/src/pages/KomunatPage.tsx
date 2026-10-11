import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Building2, Search, MapPin, Users, Phone, Mail, 
  ExternalLink, CheckCircle2, AlertCircle, ArrowRight,
  ShieldAlert, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import { MunicipalityShield } from '../components/MunicipalityShield';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';

interface MunicipalityDetail {
  name: string;
  code: string;
  region: string;
  population: string;
  area: string;
  mayor: string;
  phone: string;
  email: string;
  website: string;
  postalCode: string;
  description: string;
}

const DETAILED_MUNICIPALITIES: MunicipalityDetail[] = [
  {
    name: 'Prishtinë',
    code: 'PR',
    region: 'Rajoni i Prishtinës',
    population: '219,000+',
    area: '572 km²',
    mayor: 'Përparim Rama',
    phone: '+383 (0) 38 221 242',
    email: 'info.prishtina@rks-gov.net',
    website: 'https://prishtinaonline.com',
    postalCode: '10000',
    description: 'Kryeqyteti dhe qendra më e madhe administrative, ekonomike e universitare e Republikës së Kosovës.'
  },
  {
    name: 'Prizren',
    code: 'PZ',
    region: 'Rajoni i Prizrenit',
    population: '178,000+',
    area: '640 km²',
    mayor: 'Shaqir Totaj',
    phone: '+383 (0) 29 241 123',
    email: 'komuna.prizren@rks-gov.net',
    website: 'https://kk.rks-gov.net/prizren',
    postalCode: '20000',
    description: 'Kryeqyteti historik dhe kulturor i Kosovës me trashëgimi shekullore dhe bashkëjetesë multietnike.'
  },
  {
    name: 'Pejë',
    code: 'PE',
    region: 'Rajoni i Pejës',
    population: '96,000+',
    area: '603 km²',
    mayor: 'Gazmend Muhaxheri',
    phone: '+383 (0) 39 432 505',
    email: 'komuna.peje@rks-gov.net',
    website: 'https://kk.rks-gov.net/peje',
    postalCode: '30000',
    description: 'Qendër e rëndësishme e turizmit malor, hyrje në Grykën spektakolare të Rugovës dhe Alpet Shqiptare.'
  },
  {
    name: 'Gjilan',
    code: 'GJ',
    region: 'Rajoni i Gjilanit',
    population: '90,000+',
    area: '515 km²',
    mayor: 'Alban Hyseni',
    phone: '+383 (0) 280 321 445',
    email: 'komuna.gjilan@rks-gov.net',
    website: 'https://kk.rks-gov.net/gjilan',
    postalCode: '60000',
    description: 'Qendra kryesore e Anamoravës, nyje tregtare dhe industriale me traditë të pasur kulturore.'
  },
  {
    name: 'Ferizaj',
    code: 'FE',
    region: 'Rajoni i Ferizajt',
    population: '108,000+',
    area: '345 km²',
    mayor: 'Agim Aliu',
    phone: '+383 (0) 290 321 333',
    email: 'komuna.ferizaj@rks-gov.net',
    website: 'https://kk.rks-gov.net/ferizaj',
    postalCode: '70000',
    description: 'Qendër dinamike e zhvillimit ekonomik privat dhe nyje kyçe hekurudhore e autostradave të Kosovës.'
  },
  {
    name: 'Mitrovicë',
    code: 'MI',
    region: 'Rajoni i Mitrovicës',
    population: '72,000+',
    area: '350 km²',
    mayor: 'Bedri Hamza',
    phone: '+383 (0) 28 532 200',
    email: 'komuna.mitrovice@rks-gov.net',
    website: 'https://kk.rks-gov.net/mitrovice',
    postalCode: '40000',
    description: 'Qytet industrial dhe minierash me pasuri të mëdha natyrore të minierës historike të Trepçës.'
  },
  {
    name: 'Gjakovë',
    code: 'GJA',
    region: 'Rajoni i Gjakovës',
    population: '94,000+',
    area: '521 km²',
    mayor: 'Ardian Gjini',
    phone: '+383 (0) 390 321 210',
    email: 'komuna.gjakove@rks-gov.net',
    website: 'https://kk.rks-gov.net/gjakove',
    postalCode: '50000',
    description: 'Qytet me Çarshinë më të madhe të vjetër në Ballkan, artizanat të pasur dhe traditë arsimore.'
  },
  {
    name: 'Podujevë',
    code: 'POD',
    region: 'Rajoni i Prishtinës',
    population: '83,000+',
    area: '633 km²',
    mayor: 'Shpejtim Bulliqi',
    phone: '+383 (0) 38 200 41 001',
    email: 'komuna.podujeve@rks-gov.net',
    website: 'https://kk.rks-gov.net/podujeve',
    postalCode: '11000',
    description: 'Qendra e Llapit me tokë pjellore bujqësore, liqenin e Batllavës dhe qasje të drejtpërdrejtë kufitare.'
  },
  {
    name: 'Vushtrri',
    code: 'VU',
    region: 'Rajoni i Mitrovicës',
    population: '69,000+',
    area: '344 km²',
    mayor: 'Ferit Idrizi',
    phone: '+383 (0) 28 571 222',
    email: 'komuna.vushtrri@rks-gov.net',
    website: 'https://kk.rks-gov.net/vushtrri',
    postalCode: '42000',
    description: 'Një nga qytetet më të lashta të Kosovës me Urën e Gurit me 9 harqe dhe kalanë mesjetare.'
  },
  {
    name: 'Suharekë',
    code: 'SU',
    region: 'Rajoni i Prizrenit',
    population: '59,000+',
    area: '361 km²',
    mayor: 'Bali Muharremaj',
    phone: '+383 (0) 29 271 220',
    email: 'komuna.suhareke@rks-gov.net',
    website: 'https://kk.rks-gov.net/suhareke',
    postalCode: '23000',
    description: 'E njohur për industrinë e verërave, vreshtarinë dhe bizneset e suksesshme prodhuese.'
  },
  {
    name: 'Rahovec',
    code: 'RA',
    region: 'Rajoni i Gjakovës',
    population: '56,000+',
    area: '276 km²',
    mayor: 'Smajl Latifi',
    phone: '+383 (0) 29 276 050',
    email: 'komuna.rahovec@rks-gov.net',
    website: 'https://kk.rks-gov.net/rahovec',
    postalCode: '21000',
    description: 'Zemra e vreshtarisë dhe verërave cilësore të Kosovës me traditë shumëshekullore agrare.'
  },
  {
    name: 'Drenas',
    code: 'DR',
    region: 'Rajoni i Prishtinës',
    population: '58,000+',
    area: '290 km²',
    mayor: 'Ramiz Lladrovci',
    phone: '+383 (0) 38 584 093',
    email: 'komuna.drenas@rks-gov.net',
    website: 'https://kk.rks-gov.net/gllogoc',
    postalCode: '13000',
    description: 'Qendra e rajonit historik të Drenicës dhe selia e kombinatit metalurgjik Ferronikeli.'
  },
  {
    name: 'Lipjan',
    code: 'LI',
    region: 'Rajoni i Prishtinës',
    population: '57,000+',
    area: '338 km²',
    mayor: 'Imri Ahmeti',
    phone: '+383 (0) 38 581 222',
    email: 'komuna.lipjan@rks-gov.net',
    website: 'https://kk.rks-gov.net/lipjan',
    postalCode: '14000',
    description: 'Qytet me trashëgimi të lashtë romake afër Ulpianës, nyje hekurudhore dhe zonë e rëndësishme logjistike.'
  },
  {
    name: 'Malishevë',
    code: 'MA',
    region: 'Rajoni i Prizrenit',
    population: '54,000+',
    area: '306 km²',
    mayor: 'Ekrem Kastrati',
    phone: '+383 (0) 29 266 010',
    email: 'komuna.malisheve@rks-gov.net',
    website: 'https://kk.rks-gov.net/malisheve',
    postalCode: '24000',
    description: 'Pozicion qendror gjeografik në Kosovë me burime termale dhe Ujëvarat e Mirushës afër.'
  },
  {
    name: 'Klinë',
    code: 'KL',
    region: 'Rajoni i Pejës',
    population: '38,000+',
    area: '308 km²',
    mayor: 'Zenun Elezaj',
    phone: '+383 (0) 39 471 222',
    email: 'komuna.kline@rks-gov.net',
    website: 'https://kk.rks-gov.net/kline',
    postalCode: '32000',
    description: 'E vendosur në luginën e lumit Klina dhe Drinit të Bardhë me trashëgimi të pasur natyrore.'
  },
  {
    name: 'Fushë Kosovë',
    code: 'FK',
    region: 'Rajoni i Prishtinës',
    population: '45,000+',
    area: '83 km²',
    mayor: 'Burim Berisha',
    phone: '+383 (0) 38 535 088',
    email: 'komuna.fushekosove@rks-gov.net',
    website: 'https://kk.rks-gov.net/fushekosove',
    postalCode: '12000',
    description: 'Komuna me rritjen më të shpejtë demografike dhe ndërtimore afër Aeroportit Ndërkombëtar.'
  },
  {
    name: 'Deçan',
    code: 'DEC',
    region: 'Rajoni i Pejës',
    population: '40,000+',
    area: '371 km²',
    mayor: 'Bashkim Ramosaj',
    phone: '+383 (0) 39 441 222',
    email: 'komuna.decan@rks-gov.net',
    website: 'https://kk.rks-gov.net/decan',
    postalCode: '51000',
    description: 'Komunë me pasuri të jashtëzakonshme pyjore e ujore në rrëzë të maleve madhështore të Deçanit.'
  },
  {
    name: 'Istog',
    code: 'IST',
    region: 'Rajoni i Pejës',
    population: '39,000+',
    area: '453 km²',
    mayor: 'Ilir Ferati',
    phone: '+383 (0) 39 451 222',
    email: 'komuna.istog@rks-gov.net',
    website: 'https://kk.rks-gov.net/istog',
    postalCode: '31000',
    description: 'Burimi i kristaltë i lumit Istog, pika më e madhe e troftës në rajon dhe peizazhe alpine.'
  },
  {
    name: 'Skenderaj',
    code: 'SK',
    region: 'Rajoni i Mitrovicës',
    population: '50,000+',
    area: '372 km²',
    mayor: 'Fadil Nura',
    phone: '+383 (0) 28 582 222',
    email: 'komuna.skenderaj@rks-gov.net',
    website: 'https://kk.rks-gov.net/skenderaj',
    postalCode: '41000',
    description: 'Zemra historike e Drenicës dhe Kompleksi Memorial Adem Jashari në Prekaz.'
  },
  {
    name: 'Kamenicë',
    code: 'KAM',
    region: 'Rajoni i Gjilanit',
    population: '36,000+',
    area: '423 km²',
    mayor: 'Kadri Rahimaj',
    phone: '+383 (0) 280 371 222',
    email: 'komuna.kamenice@rks-gov.net',
    website: 'https://kk.rks-gov.net/kamenice',
    postalCode: '62000',
    description: 'Komunë lindore kufitare me reliev kodrinor dhe komunitet të integruar multietnik.'
  }
];

export default function KomunatPage() {
  const navigate = useNavigate();
  const reports = useStore((state) => state.reports || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');

  // Add all other 18 municipalities dynamically if not present in detailed array
  const fullMunicipalitiesList = useMemo(() => {
    const list = [...DETAILED_MUNICIPALITIES];
    const existingNames = new Set(list.map(m => m.name.toLowerCase()));

    KOSOVO_MUNICIPALITIES.forEach(name => {
      if (!existingNames.has(name.toLowerCase())) {
        list.push({
          name,
          code: name.slice(0, 3).toUpperCase(),
          region: 'Komunë e Republikës së Kosovës',
          population: '12,000+',
          area: '180 km²',
          mayor: 'Zyra e Kryetarit Komunal',
          phone: '+383 (0) 38 200 12 345',
          email: `komuna.${name.toLowerCase().replace(/\s+/g, '')}@rks-gov.net`,
          website: `https://kk.rks-gov.net/${name.toLowerCase().replace(/\s+/g, '')}`,
          postalCode: '10000',
          description: `Komuna e ${name} është pjesë integrale e sistemit të vetëqeverisjes lokale të Republikës së Kosovës.`
        });
      }
    });

    return list;
  }, []);

  // Filter municipalities
  const filteredMunicipalities = useMemo(() => {
    return fullMunicipalitiesList.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.mayor.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.region.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchRegion = selectedRegion === 'all' || item.region.toLowerCase().includes(selectedRegion.toLowerCase());

      return matchSearch && matchRegion;
    });
  }, [fullMunicipalitiesList, searchQuery, selectedRegion]);

  // Calculate real reports per municipality
  const getReportCount = (muniName: string) => {
    return reports.filter(r => r.location?.municipality?.toLowerCase() === muniName.toLowerCase()).length;
  };

  return (
    <div className="page-shell min-h-screen bg-(--color-page) dark:bg-(--color-brand-dark) text-slate-800 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Title Section */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-white/10 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200/60 dark:border-blue-900 mb-3">
                <Building2 className="w-3.5 h-3.5" />
                <span>Vetëqeverisja Lokale e Republikës së Kosovës</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                38 Komunat e Kosovës
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
                Zgjidhni komunën tuaj për të parë statistikat lokale, raportimet e qytetarëve, 
                kontaktet e administratës komunale dhe shërbimet e integruara digjitale.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-white/5 text-center min-w-[100px]">
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400">38</div>
                <div className="text-[11px] font-semibold text-slate-500">Komuna Aktive</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-white/5 text-center min-w-[100px]">
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">100%</div>
                <div className="text-[11px] font-semibold text-slate-500">Mbulueshmëri</div>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder="Kërko komunën sipas emrit, kryetarit ose rajonit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {['all', 'Prishtinë', 'Prizren', 'Pejë', 'Gjilan', 'Ferizaj', 'Mitrovicë', 'Gjakovë'].map((reg) => (
                <button
                  key={reg}
                  onClick={() => setSelectedRegion(reg)}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer",
                    selectedRegion === reg
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                >
                  {reg === 'all' ? 'Të gjitha Rajonet' : reg}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Municipalities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMunicipalities.map((muni) => {
            const reportsCount = getReportCount(muni.name);
            return (
              <div 
                key={muni.name}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs hover:shadow-md transition-all flex flex-col justify-between p-5 group"
              >
                <div>
                  {/* Card Header with Shield */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3.5">
                      <div className="p-1 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <MunicipalityShield name={muni.name} code={muni.code} size="lg" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight flex items-center gap-1.5">
                          <span>{muni.name}</span>
                        </h3>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                          {muni.region}
                        </div>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900">
                      {muni.code}
                    </span>
                  </div>

                  {/* Summary & Description */}
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">
                    {muni.description}
                  </p>

                  {/* Key Quick Stats */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-white/5 text-xs mb-4">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Kryetari</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{muni.mayor}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Banorë</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">{muni.population}</span>
                    </div>
                  </div>

                  {/* Official Contacts */}
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono text-[11px]">{muni.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate text-[11px]">{muni.email}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                  <button
                    onClick={() => navigate(`/detailed-registry?komuna=${encodeURIComponent(muni.name)}`)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Raportimet ({reportsCount})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => navigate(`/raporto?komuna=${encodeURIComponent(muni.name)}`)}
                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Raporto
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredMunicipalities.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-8">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Nuk u gjet asnjë komunë</h3>
            <p className="text-xs text-slate-500 mt-1">Provoni një kërkim tjetër me emër komune apo emër kryetari.</p>
          </div>
        )}

      </div>
    </div>
  );
}

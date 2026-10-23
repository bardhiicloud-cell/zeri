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
import { getMunicipalityPhoto, getMunicipalitySlug } from '../lib/municipalityPhotos';
import { MUNICIPALITY_PHOTO_CREDITS } from '../lib/municipalityPhotoCredits';

import { dt } from '@/src/lib/dt';
import { PageHero } from '../components/layout/PageHero';
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
  photoDay?: string;
  photoNight?: string;
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
    const [expandedMuni, setExpandedMuni] = useState<string | null>(null);

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
          // Placeholder population, area, phone, email, website and postal code used to be
          // generated here for every municipality without a hand-written entry. They were
          // invented, so they are left empty and the card simply omits them.
          population: '',
          area: '',
          mayor: '',
          phone: '',
          email: '',
          website: '',
          postalCode: '',
          description: `Komuna e ${name}.`
        });
      }
    });

    return list.map(m => ({
      ...m,
      photoDay: getMunicipalityPhoto(m.name, 'day'),
      photoNight: getMunicipalityPhoto(m.name, 'night'),
    }));
  }, []);

  // Filter municipalities
  const filteredMunicipalities = useMemo(() => {
    return fullMunicipalitiesList.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.region.toLowerCase().includes(searchQuery.toLowerCase());

      return matchSearch;
    });
  }, [fullMunicipalitiesList, searchQuery]);

  // Calculate real reports per municipality
  const getReportCount = (muniName: string) => {
    return reports.filter(r => r.location?.municipality?.toLowerCase() === muniName.toLowerCase()).length;
  };

  /** Raportime të zgjidhura për komunën — tregon performancën e administratës. */
  const getResolvedCount = (muniName: string) => {
    return reports.filter(r => r.location?.municipality?.toLowerCase() === muniName.toLowerCase() && r.status === 'Resolved').length;
  };

  return (
    <div className="page-shell min-h-screen bg-(--color-page) dark:bg-(--color-brand-dark) text-slate-800 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">

        <PageHero
          eyebrow={dt('Vetëqeverisja Lokale e Republikës së Kosovës')}
          icon={Building2}
          title={dt('38 Komunat e Kosovës')}
          subtitle={dt('Zgjidhni komunën tuaj për të parë raportet publike dhe për të dërguar një raport për atë komunë.')}
          stats={[
            { value: '38', label: dt('komuna në Kosovë') },
          ]}
        />

        <p role="note" className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
          {dt('Popullsia dhe sipërfaqja janë të dhëna referuese dhe jo të verifikuara nga platforma; kryetari, telefoni dhe emaili nuk shfaqen sepse ndryshojnë dhe nuk kemi burim të verifikuar. Për informacion zyrtar shihni faqen e komunës.')}
        </p>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900 sm:p-5">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={dt('Kërko komunën sipas emrit ose rajonit...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-4 h-4 text-slate-600 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs hover:shadow-xl hover:-translate-y-0.5 transition duration-300 flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  {/* Photo header: real daytime photo in light mode, night photo in dark mode */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-slate-200 dark:bg-slate-800">
                    {muni.photoDay && (
                      <img
                        src={muni.photoDay}
                        alt={`${muni.name} – pamje nga dita`}
                        loading="lazy"
                        decoding="async"
                        className="dark:hidden absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    )}
                    {muni.photoNight && (
                      <img
                        src={muni.photoNight}
                        alt={`${muni.name} – pamje nga nata`}
                        loading="lazy"
                        decoding="async"
                        className="hidden dark:block absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-transparent dark:from-slate-950/90 dark:via-slate-950/25" />

                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-white/90 dark:bg-slate-900/75 text-blue-700 dark:text-blue-300 backdrop-blur-sm border border-white/60 dark:border-white/10">
                      {muni.code}
                    </span>

                    <div className="absolute inset-x-0 bottom-0 p-4 flex items-end gap-3">
                      <div className="shrink-0 p-1 rounded-xl bg-white/95 dark:bg-slate-900/80 backdrop-blur-sm shadow-lg ring-1 ring-black/5 dark:ring-white/10">
                        <MunicipalityShield name={muni.name} code={muni.code} size="lg" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-black text-white leading-tight drop-shadow-sm truncate">
                          {muni.name}
                        </h3>
                        <div className="text-xs font-medium text-white/80 mt-0.5 truncate">
                          {muni.region}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 pb-0">
                  {/* Summary & Description */}
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">
                    {muni.description}
                  </p>

                  {/* Key Quick Stats */}
                  {muni.population && (
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-white/5 text-xs mb-4">
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-wider block font-medium">{dt('Banorë (përafërsisht)')}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">{muni.population}</span>
                    </div>
                  )}

                  <Link to="/kontakt-numrat" className="mb-1 inline-flex min-h-11 items-center gap-2 text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">
                    <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {dt('Kontakte dhe numra')}
                  </Link>

                  {/* Raportimet e zgjidhura — performanca lokale */}
                  {reportsCount > 0 && (
                    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 transition-colors hover:border-emerald-200 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:hover:border-emerald-800/60">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> {dt('Të zgjidhura (nga raportet e ngarkuara)')}
                        </span>
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                          {getResolvedCount(muni.name)}/{reportsCount} ({Math.round((getResolvedCount(muni.name) / Math.max(reportsCount, 1)) * 100)}%)
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-200/60 dark:bg-emerald-900/50">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700 ease-out"
                          style={{ width: `${Math.round((getResolvedCount(muni.name) / Math.max(reportsCount, 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  </div>
                </div>

                {/* Detajet e plota — të zgjerueshme */}
                {expandedMuni === muni.name && (
                  <div className="mx-5 mt-4 space-y-2.5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/30 text-xs">
                    {(muni.area || muni.postalCode) && (
                      <div className="grid grid-cols-2 gap-3">
                        {muni.area && <div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Sipërfaqja</p><p className="font-bold text-slate-800 dark:text-slate-200">{muni.area}</p></div>}
                        {muni.postalCode && <div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Kodi postar</p><p className="font-mono font-bold text-slate-800 dark:text-slate-200">{muni.postalCode}</p></div>}
                      </div>
                    )}
                    {muni.website && (
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Website</p>
                        <a href={muni.website} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold text-blue-700 hover:underline dark:text-blue-300 break-all">
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" /> {muni.website.replace('https://', '')}
                        </a>
                      </div>
                    )}
                    <p className="leading-relaxed text-slate-600 dark:text-slate-300">{muni.description}</p>
                  </div>
                )}

                {/* Bottom Action Buttons */}
                <div className="mx-5 mt-5 mb-5 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                  {reportsCount > 0 ? (
                    <button
                      onClick={() => navigate(`/detailed-registry?komuna=${encodeURIComponent(muni.name)}`)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{dt('Raportimet')} ({reportsCount})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : <span />}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedMuni(expandedMuni === muni.name ? null : muni.name)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                        expandedMuni === muni.name
                          ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-950/40 dark:text-blue-300"
                          : "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      )}
                    >
                      {expandedMuni === muni.name ? dt('Mbyll') : dt('Detaje')}
                    </button>
                    <button
                      onClick={() => navigate(`/raporto?komuna=${encodeURIComponent(muni.name)}`)}
                      className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      {dt('Raporto')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredMunicipalities.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-8">
            <AlertCircle className="w-12 h-12 text-slate-600 dark:text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">{dt('Nuk u gjet asnjë komunë')}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{dt('Provoni një kërkim tjetër me emër komune ose rajoni.')}</p>
          </div>
        )}

        <details className="text-[11px] text-slate-600 dark:text-slate-400">
          <summary className="cursor-pointer font-semibold">Burimi i fotove (Wikimedia Commons)</summary>
          <p className="mt-2 max-w-3xl">
            Fotot e ditës janë fotografi reale nga Wikimedia Commons. Për komunat pa foto reale nate, pamja e natës është fotoja e ditës e përpunuar në ngjyra nate.
          </p>
          <ul className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
            {fullMunicipalitiesList.map((m) => {
              const credit = MUNICIPALITY_PHOTO_CREDITS[getMunicipalitySlug(m.name) ?? ''];
              if (!credit) return null;
              return (
                <li key={m.name} className="truncate">
                  <span className="font-semibold">{m.name}:</span>{' '}
                  <a href={credit.day.source} target="_blank" rel="noreferrer" className="underline">{credit.day.author || 'Autori'}</a>
                  {' · '}{credit.day.license}
                </li>
              );
            })}
          </ul>
        </details>

      </div>
    </div>
  );
}

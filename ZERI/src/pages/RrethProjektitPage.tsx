import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Info, ShieldCheck, Cpu, Database, Map, CheckCircle2, 
  ArrowRight, Users, Sparkles, Layers, Lock, Award, 
  BarChart3, Clock, HelpCircle, HeartHandshake, Eye
} from 'lucide-react';
import { MunicipalityShield } from '../components/MunicipalityShield';

export default function RrethProjektitPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070e1c] text-slate-800 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Hero Section */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 border border-slate-200/80 dark:border-white/10 shadow-xs relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200/60 dark:border-blue-900">
              <Info className="w-3.5 h-3.5" />
              <span>Rreth Platformës Kombëtare</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Zëri i Qytetarëve
            </h1>
            
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              Platforma zyrtare digjitale e Republikës së Kosovës që bashkon qytetarët me 38 komunat 
              për raportimin në kohë reale të problemeve, rritjen e transparencës publike dhe 
              pjesëmarrjen aktive në vendimmarrjen lokale.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate('/raporto')}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <span>Raporto një Problem</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => navigate('/komunat')}
                className="px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Eksploro 38 Komunat
              </button>
            </div>
          </div>
        </div>

        {/* 1. MISSION & PURPOSE (Për Çka Është Ndërtuar) */}
        <section className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Për Çka Është Ndërtuar Ky Projekt?
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Qëllimet kryesore që udhëheqin funksionimin e përditshëm të platformës "Zëri i Qytetarëve"
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-black">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Eliminimi i Burokracisë
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Nuk ka më nevojë për shkuarje fizike në sportele komunale apo shkresave të gjata. 
                Çdo qytetar raporton çështjen e lagjes me foto dhe lokacion GPS brenda 30 sekondave nga telefoni.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-black">
                <Eye className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Transparencë 100% Radikale
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Çdo raportim i dërguar hyn në Regjistrin Publik me kod unik. Ecuria e punimeve, 
                afatet e reagimit (SLA) dhe fotografitë para/pas janë të hapura për çdo qytetar dhe media.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center font-black">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Pjesëmarrje Qytetare
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Përmes sondazheve zyrtare, forumeve tematike dhe buxhetimit pjesëmarrës, 
                komuniteti vendos drejtpërdrejt se cilat projekte infrastrukturore duhet të financohen.
              </p>
            </div>
          </div>
        </section>

        {/* 2. HOW IT WORKS (Qysh Tek - Rrjedha Hap pas Hapi) */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-8">
          <div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">
              Rrjedha Operative
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Si Funksionon Platforma (Qysh Tek)?
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Nga momenti kur një qytetar vëren një problem në lagje, deri te zgjidhja e verifikuar në terren:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            
            {/* Step 1 */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                1
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Raportimi</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Qytetari bën fotografinë, zgjedh kategorinë dhe vendndodhja caktohet automatikisht në hartën GIS.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                2
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Triazhi Digjital</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Gjenerohet kodi unik publik (#ZQ-XXXX) me nivel urgjence dhe orar të garantuar reagimi (SLA).
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                3
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Delegimi Komunal</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Raporti dërgohet automatikisht te drejtoria përkatëse komunale (Shërbime Publike, Ndriçim, Mjedis).
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                4
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Ndërhyrja në Terren</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Ekipet teknike ose kompanitë e mirëmbajtjes dalin në lokacion dhe kryejnë punimet e kërkuara.
              </p>
            </div>

            {/* Step 5 */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                5
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Verifikimi & Mbyllja</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Ngarkohet foto e punës së kryer, qytetari njoftohet dhe raporti merr statusin "I Zgjidhur".
              </p>
            </div>

          </div>
        </section>

        {/* 3. ARCHITECTURE & TECH STACK (Si Është Ndërtuar) */}
        <section className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Arkitektura Teknike dhe Teknologjitë
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Platforma është ndërtuar me standardet më moderne të inxhinierisë softuerike për shpejtësi, siguri dhe shkallëzim
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
              <Cpu className="w-8 h-8 text-blue-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">React 18 & TypeScript</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Arkitekturë moderne SPA me tipizim të plotë statik, modularitet të lartë dhe kohë përgjigjeje të menjëhershme.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
              <Map className="w-8 h-8 text-emerald-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Leaflet & OpenStreetMap</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Motor gjeohapësinor GIS me koordinata reale gjeografike për të 38 komunat e Kosovës dhe filtra me rreze veprimi.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
              <Database className="w-8 h-8 text-amber-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Firebase & Realtime Sync</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Sinkronizim në kohë reale i raporteve, sondazheve dhe njoftimeve me shpejtësi milisekondash dhe siguri të të dhënave.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
              <ShieldCheck className="w-8 h-8 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Siguria & Privatësia</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Përputhshmëri e plotë me Ligjin për Mbrojtjen e të Dhënave Personale të Kosovës dhe mundësi raportimi 100% anonim.
              </p>
            </div>

          </div>
        </section>

        {/* 4. COVERAGE - ALL 38 MUNICIPALITIES */}
        <section className="bg-gradient-to-r from-[#071328] via-[#0b1d3a] to-[#071328] text-white rounded-3xl p-6 sm:p-10 border border-blue-900/60 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-1">
                Shtrirja Gjeografike
              </span>
              <h2 className="text-2xl sm:text-3xl font-black">
                Mbulueshmëri 100% në të Gjitha 38 Komunat
              </h2>
              <p className="text-xs sm:text-sm text-blue-200 mt-1 max-w-2xl">
                Nga qendrat e mëdha urbane deri te vendbanimet më të thella rurale, çdo banor i Kosovës 
                ka zë të barabartë në zgjidhjen e problemeve të komunitetit.
              </p>
            </div>

            <Link
              to="/komunat"
              className="px-5 py-3 bg-white text-blue-950 hover:bg-blue-50 rounded-xl text-xs font-black transition-all shrink-0 shadow-sm"
            >
              Shiko Listën e Komunave
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3 pt-4 border-t border-white/10">
            {['Prishtinë', 'Prizren', 'Pejë', 'Gjilan', 'Ferizaj', 'Mitrovicë', 'Gjakovë', 'Podujevë'].map(muni => (
              <div key={muni} className="bg-white/5 p-3 rounded-xl border border-white/10 flex flex-col items-center text-center">
                <MunicipalityShield name={muni} size="sm" className="mb-2" />
                <span className="text-xs font-bold text-slate-200">{muni}</span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

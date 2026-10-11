import { dt } from '@/src/lib/dt';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, FileText, Cookie, Megaphone, Lock, Scale, AlertTriangle, Eye, CheckCircle2 } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms' | 'ads' | 'cookies' | 'security' | null;
}

export function LegalModal({ isOpen, onClose, type }: LegalModalProps) {
  if (!isOpen || !type) return null;

  const content = {
    privacy: {
      title: 'Politika e Privatësisë & Transparenca',
      icon: ShieldCheck,
      body: (
        <div className="space-y-6 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start gap-3">
            <Lock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-emerald-900 font-medium">{dt(`Të dhënat tuaja janë thellësisht të enkriptuara dhe të mbrojtura. Asnjë e dhënë personale nuk shitet apo ndahet për qëllime komerciale.`)}</p>
          </div>
          
          <div>
            <h4 className="text-lg font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2"><Eye className="w-5 h-5 text-indigo-500"/>{dt(`Transparenca e Plotë Sistemit`)}</h4>
            <p>{dt(`Platforma operon mbi parimet e transparencës absolute. Çdo raportim, kërkesë apo ankesë regjistrohet në një regjistër publik të pandryshueshëm, ku institucionet mbahen llogaridhënëse. Inteligjenca Artificiale përdoret vetëm për të filtruar dezinformatat, pa prekur lirinë e fjalës.`)}</p>
          </div>

          <div>
            <h4 className="text-lg font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-indigo-500"/>{dt(`Përdorimi i Informacionit`)}</h4>
            <p>{dt(`Të dhënat që mbledhim (emri, email, lokacioni i raportimeve) përdoren EKSKLUZIVISHT për: a) Verifikimin e identitetit në lidhje me institucionet; b) Përmirësimin e analizave hapësinore për problemet e qytetit; c) Mbrojtjen kundër sistemeve të bot-eve.`)}</p>
          </div>
        </div>
      )
    },
    terms: {
      title: 'Kodi i Mirësjelljes & Rregullorja',
      icon: Scale,
      body: (
        <div className="space-y-6 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
            <p className="text-indigo-900 font-medium">{dt(`Ky është një komunitet i bazuar në respektin reciprok dhe debatin e shëndoshë publik. Për të ruajtur standardin profesional, çdo anëtar duhet t'i përmbahet këtij kodi.`)}</p>
          </div>

          <div>
            <h4 className="text-lg font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-500"/>{dt(`Rregullat Baza të Debatit Publik`)}</h4>
            <ul className="space-y-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl p-5">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
                <div><strong className="text-slate-900 dark:text-white">{dt(`Respekti Absolut:`)}</strong>{dt(`Sulmet personale, fyerjet, dhe gjuha denigruese (ad hominem) do të sanksionohen menjëherë. Debati bëhet rreth idesë, jo individit.`)}</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
                <div><strong className="text-slate-900 dark:text-white">{dt(`Zero Tolerancë ndaj Dezinformimit:`)}</strong>{dt(`Çdo postim që përmban lajme të rreme të qëllimshme (Fake News) për komunitetin ose institucionet do të fshihet.`)}</div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</span>
                <div><strong className="text-slate-900 dark:text-white">{dt(`Publikimi i Fotove & Videove:`)}</strong>{dt(`Nuk lejohen pamje shqetësuese, eksplicite apo që shkelin privatësinë e personave të tretë pa miratimin e tyre. Përmbajtja vizuale duhet t'i shërbejë interesit publik.`)}</div>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-black text-rose-600 mb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-rose-500"/>{dt(`Sistemi i Sanksioneve`)}</h4>
            <p>{dt(`Sistemi ynë i moderimit AI (Auto-Pilot) fshin automatikisht fjalët banale. Nëse një përdorues shkel kodin më shumë se 3 herë, llogaria e tij bllokohet (Banned) në mënyrë të pakthyeshme nga platforma.`)}</p>
          </div>
        </div>
      )
    },
    ads: {
      title: 'Transparenca e Reklamave',
      icon: Megaphone,
      body: (
        <div className="space-y-4 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
          <p>{dt(`Platforma jonë mbahet e gjallë falë sponsorizimeve nga bizneset lokale. Për të ruajtur transparencën, OÇDO reklamë apo përmbajtje e paguar shënjohet qartë me etiketën`)} <strong>{dt(`"SPONSORIZUAR"`)}</strong>.</p>
          <ul className="list-disc pl-5 space-y-2 mt-4">
            <li>{dt(`Nuk pranohen reklama politike.`)}</li>
            <li>{dt(`Nuk lejohen reklama për produkte të paligjshme.`)}</li>
            <li>{dt(`Algoritmet tona nuk manipulojnë "Feed-in" publik për të favorizuar pagesat ndaj përmbajtjes qytetare.`)}</li>
          </ul>
        </div>
      )
    },
    cookies: {
      title: 'Politika e Cookies',
      icon: Cookie,
      body: (
        <div className="space-y-4 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
          <p>{dt(`Ne përdorim skedarë thelbësorë (Cookies) për të mbajtur sesionin tuaj të kyçur dhe për të mbajtur mend preferencat tuaja lokale (psh. Tema Dark/Light, Gjuha).`)}</p>
          <p>Ne <strong>{dt(`NUK`)}</strong>{dt(`përdorim cookies ndjekës për t'ju targetuar me reklama në faqe të tjera. Privatësia juaj është e shenjtë.`)}</p>
        </div>
      )
    },
    security: {
      title: 'Siguria Kibernetike',
      icon: ShieldCheck,
      body: (
        <div className="space-y-4 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
          <p>{dt(`Platforma përdor certifikata të avancuara SSL, sisteme kundër sulmeve DDoS dhe Firewalls të dedikuara për të mbajtur çdo raportim tuajin të sigurtë nga hakerat apo manipulimet keqdashëse.`)}</p>
        </div>
      )
    }
  };

  const activeContent = content[type];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <activeContent.icon className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {activeContent.title}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-200 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Body */}
          <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
            {activeContent.body}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
            <button 
              onClick={onClose}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-xl"
            >{dt(`E Kuptova dhe Pajtohem`)}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

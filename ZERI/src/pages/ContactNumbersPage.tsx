import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { dt } from '@/src/lib/dt';
import React, { useState } from 'react';
import { Phone, Search, Building, ShieldAlert, HeartPulse, Shield, TreePine, GraduationCap, Gavel, FileText, Globe, Landmark, Factory, Briefcase, Car, Users, HandCoins, Sprout, Zap, Droplet, Scale, LifeBuoy, ChevronDown, Layers } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/LanguageContext';
import { motion } from 'framer-motion';
import { PageHero } from '../components/layout/PageHero';

interface Contact {
  name: string;
  department: string;
  phone: string;
  email?: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}

import { EMERGENCY_NUMBERS, MINISTRY_CONTACTS, UTILITY_CONTACTS, MUNICIPALITY_CONTACTS } from '../lib/data/contacts';

export default function ContactNumbersPage() {
  const { t, dt } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  const allContacts = [...UTILITY_CONTACTS, ...MINISTRY_CONTACTS, ...MUNICIPALITY_CONTACTS];
  const [activeTab, setActiveTab] = useState<'all' | 'ministries' | 'municipalities' | 'inspectors' | 'justice' | 'others'>('all');

  const getFilteredContacts = () => {
    let base = [];
    if (activeTab === 'all') base = allContacts;
    else if (activeTab === 'ministries') base = MINISTRY_CONTACTS.filter(c => 
      c.name.toLowerCase().includes('ministria') || 
      c.name.toLowerCase().includes('presidenca') || 
      c.name.toLowerCase().includes('kryeministri') || 
      c.name.toLowerCase().includes('kuvendi')
    );
    else if (activeTab === 'municipalities') base = MUNICIPALITY_CONTACTS;
    else if (activeTab === 'inspectors') base = allContacts.filter(c => c.department === 'Inspektoratet');
    else if (activeTab === 'justice') base = allContacts.filter(c => 
      c.department === 'Drejtësia' || 
      c.department === 'Sistemi Ligjor' || 
      c.department === 'Siguria' ||
      c.name.toLowerCase().includes('policia') ||
      c.name.toLowerCase().includes('gjykata') ||
      c.name.toLowerCase().includes('prokuroria')
    );
    else if (activeTab === 'others') base = allContacts.filter(c => 
      c.department === 'Mjedisi' || 
      c.department === 'Ujësjellësi' || 
      c.department === 'Energjia'
    );

    return base.filter(contact => 
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      contact.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const filteredContacts = getFilteredContacts();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:py-16"
    >
      <PageHero
        className="mb-8 md:mb-12"
        eyebrow={t('contact_central_directory')}
        icon={Phone}
        title={t('contact_front_lines')}
        subtitle={t('contact_direct_channels')}
        stats={[
          { value: '112', label: dt('Emergjenca Qendrore · 24/7') },
        ]}
      />

      <div role="note" className="mb-8 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
        <strong className="font-black">{dt('Kujdes: kontaktet nuk janë verifikuar.')}</strong>{' '}
        {dt('Numrat e emergjencës 112, 192, 193 dhe 194 janë numrat kombëtarë. Të gjitha kontaktet e tjera më poshtë (numra dhe email) janë të dhëna referuese që platforma nuk i ka verifikuar me institucionet. Para se të telefononi ose shkruani, kontrolloni faqen zyrtare të institucionit.')}
      </div>

      {/* Emergency Numbers Grid - Highly Prominent, Accessible & High Contrast */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12 md:mb-16">
        {EMERGENCY_NUMBERS.map((emergency, index) => {
          const Icon = emergency.icon;
          return (
            <div 
              key={index} 
              className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 hover:border-rose-300 dark:hover:border-rose-500/50 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:hover:shadow-none transition duration-300 flex flex-col shadow-sm dark:shadow-none h-full"
            >
              <div className="absolute right-[-10px] top-[-10px] opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-700 pointer-events-none">
                 <Icon className="w-24 h-24 text-slate-900 dark:text-white shrink-0" />
              </div>
              
              <div className="relative z-10 flex flex-col flex-1 justify-between gap-3 sm:gap-4">
                {/* Mobile View: Row Layout | Desktop View: Stacked Layout */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 shadow-inner shrink-0">
                       <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center mb-1">
                        <span className="text-[9px] bg-rose-100 text-rose-800 font-extrabold px-2 py-0.5 rounded-xl uppercase tracking-wider">{dt(`Urgjente`)}
                        </span>
                      </div>
                      <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base lg:text-lg tracking-tight leading-tight break-words">
                        {dt(emergency.name)}
                      </h3>
                    </div>
                  </div>
                  
                  <span className="font-mono font-black text-2xl sm:text-3xl lg:text-4xl text-rose-600 tracking-wider block break-all">
                    {emergency.phone}
                  </span>
                  
                  {/* Description */}
                  <p className="text-[11px] sm:text-xs text-neutral-600 dark:text-slate-400 font-semibold leading-relaxed line-clamp-2 sm:line-clamp-none">
                    {dt(emergency.description)}
                  </p>
                </div>
                
                {/* Call Button */}
                <a 
                  href={`tel:${emergency.phone}`} 
                  className="w-full shrink-0 bg-slate-900 hover:bg-rose-600 text-white rounded-xl py-2.5 px-3 sm:py-3 sm:px-4 font-black text-[11px] sm:text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition duration-300 active:scale-95 shadow-sm dark:shadow-none mt-2 sm:mt-auto"
                >
                  <Phone className="w-4 h-4 text-rose-500 fill-rose-500/10 group-hover:text-white" />
                  <span>{dt(`Telefono Tani`)}</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

       <div className="mb-8">
         
       </div>


      <div className="mb-8 md:mb-12 flex flex-col gap-4">
        <div className="relative border border-slate-200/60 dark:border-white/10 rounded-xl p-1 bg-white dark:bg-slate-900 shadow-sm dark:shadow-none hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:hover:shadow-none transition-all duration-300">
          <div className="absolute inset-y-0 left-0 pl-4 md:pl-6 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-900 dark:text-white" />
          </div>
          <input
            type="text"
            placeholder={t('contact_search_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 md:pl-16 pr-4 py-3 md:py-4 bg-transparent border-none text-slate-900 dark:text-white focus:outline-none placeholder-neutral-400 font-bold tracking-wide text-xs md:text-sm lg:text-base"
          />
        </div>
        
        <div className="flex overflow-x-auto gap-2 md:gap-3 pb-4 mb-2 md:mb-6 w-full hide-scrollbar snap-x snap-mandatory px-1">
          {[
            { id: 'all', label: t('contact_tab_all'), icon: Globe },
            { id: 'ministries', label: t('contact_tab_state'), icon: Landmark },
            { id: 'municipalities', label: t('contact_municipalities'), icon: Building },
            { id: 'inspectors', label: t('contact_inspectors'), icon: ShieldAlert },
            { id: 'justice', label: t('contact_justice'), icon: Gavel },
            { id: 'others', label: t('contact_others'), icon: TreePine }
          ].map(tab => {
            const TabIcon = tab.icon;
            return (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "snap-start whitespace-nowrap px-4 py-3 md:px-5 md:py-4 text-[11px] sm:text-xs md:text-sm font-bold tracking-wide border-2 transition-colors duration-300 ease-in-out flex items-center justify-center gap-1.5 md:gap-2 shrink-0 rounded-xl", 
                  activeTab === tab.id ? "bg-slate-900 text-white border-slate-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none" : "bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200/60 dark:border-white/10 hover:bg-neutral-50 dark:bg-slate-900/50 hover:border-slate-300 shadow-sm dark:shadow-none"
                )}
              >
                <TabIcon className={cn("w-3.5 h-3.5 md:w-4 md:h-4", activeTab === tab.id ? "text-rose-400" : "text-slate-400")} />
                <span className="uppercase whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1">
          {filteredContacts.length === 0 ? (
            <div className="text-center py-12 md:py-20 bg-neutral-50 dark:bg-slate-900/50 border-2 border-slate-200/60 dark:border-white/10 rounded-xl border-dashed">
              <ShieldAlert className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-slate-900 dark:text-white font-bold tracking-wide title-serif text-sm md:text-lg px-4">{t('contact_no_results')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredContacts.map((contact, idx) => {
                 const Icon = contact.icon;
                 return (
                  <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-5 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:hover:shadow-none transition-all duration-300 relative shadow-sm dark:shadow-none flex flex-col justify-between">
                    <div className="absolute top-0 right-0 rounded-bl-xl rounded-tr-xl bg-slate-900 text-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wider z-10">{dt(`Inst.`)}
                    </div>
                    <div>
                      <div className="flex flex-row items-start gap-4 mb-4">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl flex items-center justify-center text-slate-900 dark:text-white shrink-0 shadow-sm dark:shadow-none">
                           <Icon className="w-6 h-6 shrink-0 text-slate-850" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="inline-flex items-center px-2 py-0.5 rounded bg-rose-50 text-rose-600 text-[9px] md:text-xs font-black tracking-wide mb-1 uppercase">
                              {dt(contact.department)}
                          </div>
                          <h3 className="font-black text-slate-950 dark:text-white text-sm sm:text-base tracking-tight leading-tight break-words">{dt(contact.name)}</h3>
                        </div>
                      </div>
                      
                      <p className="text-xs text-neutral-600 dark:text-slate-400 font-semibold leading-relaxed mb-3 line-clamp-2 break-words">
                        {dt(contact.description)}
                      </p>
                      {contact.email && (
                        <p className="text-[10px] text-slate-400 font-bold lowercase tracking-wider break-all mb-3">
                          {contact.email}
                        </p>
                      )}
                    </div>
                    
                    {/* Beautiful, High-Contrast Phone Action Box */}
                    <div className="mt-auto p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-inner">
                      <div className="min-w-0">
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest block">{dt(`Numri i Telefonit`)}</span>
                        <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono tracking-wider break-all block">
                          {contact.phone}
                        </span>
                      </div>
                      <a 
                        href={`tel:${contact.phone.replace(/\s+/g, '')}`} 
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-slate-900 text-white rounded-2xl font-black transition duration-300 shadow-sm dark:shadow-none shrink-0 active:scale-95 text-xs uppercase tracking-widest"
                      >
                        <Phone className="w-3.5 h-3.5 text-white" />
                        <span>{dt(`Thirr`)}</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      {/* Bottom Banner */}
      
    </div>
    </motion.div>
  );
}
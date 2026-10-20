import { dt } from '@/src/lib/dt';
import React from 'react';
import { Eye, Check, Phone, Mail, MessageCircle, Building2, Sparkles, Save, Code } from 'lucide-react';












/** The contact, free-slot and AdSense settings the form edits. */
export interface AdContactForm {
  adContactPhone: string;
  adWhatsApp: string;
  adContactEmail: string;
  adContactCompanyName: string;
  adSlogan: string;
  adSenseEnabled: boolean;
  adSenseClientId: string;
  adSenseSlot: string;
  adSenseCode: string;
  adFrequencyPosts: number;
  adFeedAlgorithm: string;
}

export default function AdSettingsTab({ contactForm, setContactForm, handleSaveSettings, settingsSaved }: {
  contactForm: AdContactForm;
  setContactForm: React.Dispatch<React.SetStateAction<AdContactForm>>;
  handleSaveSettings: (e: React.FormEvent) => Promise<void>;
  settingsSaved: boolean;
}) {
  return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Settings Form */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-100 dark:border-white/5 pb-4">
              <div className="flex items-center gap-2 text-rose-600 text-xs font-black uppercase tracking-wider mb-1">
                <Sparkles className="w-4 h-4" />
                <span>{dt(`Konfigurimi i Hapësirave Reklamuese të Lira`)}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white title-serif tracking-tight">
                {dt(`Kontakti i Firmës / Adminit në Hapësirat e Lira`)}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {dt(`Kur nuk ka reklamë aktive në një pozicion, sistemi shfaq automatikisht hapësirën reklamuese me të dhënat tuaja të kontaktit, në mënyrë që bizneset të dinë se është e lirë dhe t'ju kontaktojnë menjëherë.`)}
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-rose-600" />
                  <span>{dt(`Numri i Telefonit të Firmës / Adminit *`)}</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactForm.adContactPhone}
                  onChange={e => setContactForm({ ...contactForm, adContactPhone: e.target.value })}
                  placeholder={dt(`psh. +383 44 123 456`)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{dt(`Numri i WhatsApp për Porosi të Shpejta *`)}</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactForm.adWhatsApp}
                  onChange={e => setContactForm({ ...contactForm, adWhatsApp: e.target.value })}
                  placeholder={dt(`psh. +383 44 123 456`)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>{dt(`Email për Marketing / Reklama *`)}</span>
                </label>
                <input
                  type="email"
                  required
                  value={contactForm.adContactEmail}
                  onChange={e => setContactForm({ ...contactForm, adContactEmail: e.target.value })}
                  placeholder={dt(`psh. reklama@qytetari.ks`)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                  <span>{dt(`Emri i Firmës / Zyrës së Reklamave *`)}</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactForm.adContactCompanyName}
                  onChange={e => setContactForm({ ...contactForm, adContactCompanyName: e.target.value })}
                  placeholder={dt(`psh. Zyra e Marketingut & Reklamave Digjitale`)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                  <span>{dt(`Slogani Promovues / Mesazhi për Bizneset e Interesuara *`)}</span>
                </label>
                <textarea
                  rows={2}
                  value={contactForm.adSlogan}
                  onChange={e => setContactForm({ ...contactForm, adSlogan: e.target.value })}
                  placeholder={dt(`psh. Arritni mijëra qytetarë dhe konsumatorë aktivë në komunën tuaj me shikueshmëri maksimale`)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* GOOGLE ADSENSE & SCRIPT ADS */}
              <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      {dt(`Google AdSense & Reklama me Skript`)}
                    </h4>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {contactForm.adSenseEnabled ? dt('E Aktivizuar') : dt('E Çaktivizuar')}
                    </span>
                    <input
                      type="checkbox"
                      checked={contactForm.adSenseEnabled}
                      onChange={e => setContactForm({ ...contactForm, adSenseEnabled: e.target.checked })}
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      {dt(`AdSense Client ID (ca-pub-...)`)}
                    </label>
                    <input
                      type="text"
                      value={contactForm.adSenseClientId}
                      onChange={e => setContactForm({ ...contactForm, adSenseClientId: e.target.value })}
                      placeholder="ca-pub-1234567890123456"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-mono outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      {dt(`Ad Slot ID`)}
                    </label>
                    <input
                      type="text"
                      value={contactForm.adSenseSlot}
                      onChange={e => setContactForm({ ...contactForm, adSenseSlot: e.target.value })}
                      placeholder="9876543210"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-mono outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    {dt(`Kodi Skript AdSense / HTML i Personalizuar (Opsionale)`)}
                  </label>
                  <textarea
                    rows={2}
                    value={contactForm.adSenseCode}
                    onChange={e => setContactForm({ ...contactForm, adSenseCode: e.target.value })}
                    placeholder="<script async src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'></script>..."
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      {dt(`Frekuenca në Feed të Debatit Publik`)}
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{dt(`Shfaq reklamë çdo`)}</span>
                      <input
                        type="number"
                        min={2}
                        max={20}
                        value={contactForm.adFrequencyPosts}
                        onChange={e => setContactForm({ ...contactForm, adFrequencyPosts: parseInt(e.target.value) || 4 })}
                        className="w-20 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-center font-bold text-slate-900 dark:text-white"
                      />
                      <span className="text-xs text-slate-500">{dt(`postime`)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                {settingsSaved ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    {dt(`Cilësimet u ruajtën me sukses!`)}
                  </span>
                ) : <div />}

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-rose-600 text-white text-xs font-black tracking-wider uppercase transition shadow-sm flex items-center gap-2 active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>{dt(`Ruaj Ndryshimet`)}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Live Preview Panel */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-100 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {dt(`Parapamje e Drejtpërdrejtë e Hapësirës së Lirë:`)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                {dt(`Kështu shfaqet për qytetarët kur ky vend është i lirë për rezervim:`)}
              </p>

              {/* Mock Ad Banner Fallback Render */}
              <div className="border border-slate-200 dark:border-white/10 bg-slate-900 text-white rounded-2xl p-5 relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 bg-rose-600 text-white px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-bl-xl flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-rose-200" />
                  <span>{dt(`Hapësirë e Lirë Reklamuese`)}</span>
                </div>

                <div className="flex items-start gap-3 pt-2">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 text-rose-400 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-extrabold text-rose-400 uppercase tracking-widest block">
                      {dt(`VENDI I REKLAMËS SUAJ`)}
                    </span>
                    <h4 className="text-sm font-black text-white tracking-tight leading-snug mt-0.5">
                      {contactForm.adContactCompanyName}
                    </h4>
                    <p className="text-xs text-slate-300 font-medium mt-1">
                      {contactForm.adSlogan}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <a
                        href={`tel:${contactForm.adContactPhone.replace(/\s+/g, '')}`}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm"
                      >
                        <Phone className="w-3.5 h-3.5 text-white" />
                        <span>{contactForm.adContactPhone}</span>
                      </a>
                      <span className="px-3 py-2 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>WhatsApp</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-4 rounded-2xl">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>{dt(`Si Funksionon Shënjestrimi?`)}</span>
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed font-medium">
                {dt(`Kur një qytetar zgjedh komunën e tij në faqe (psh. Prishtinë), sistemi automatikisht kërkon nëse ka ndonjë reklamë të dedikuar për Prishtinë. Nëse po, shfaqet reklama e Prishtinës. Nëse jo, shfaqen reklamat Nacionale, ose kjo hapësirë e lirë me numrin tuaj të telefonit.`)}
              </p>
            </div>
          </div>
        </div>
  );
}

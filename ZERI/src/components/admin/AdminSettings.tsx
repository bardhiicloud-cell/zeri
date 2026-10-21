import { dt } from '@/src/lib/dt';
import React, { useState } from 'react';
import { Settings, Save, Database, Shield, Globe, Heart, AlertTriangle, Eye } from 'lucide-react';
import { useStore } from '../../lib/store';
import { db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function AdminSettings() {
  const donationUrls = useStore(state => state.donationUrls);
  const updateDonationUrls = useStore(state => state.updateDonationUrls);

  const [charityUrl, setCharityUrl] = useState(donationUrls.charity);
  const [maintenanceUrl, setMaintenanceUrl] = useState(donationUrls.maintenance);
  const systemSettings = useStore(state => state.systemSettings);
  const [showReels, setShowReels] = useState(systemSettings?.showReels ?? true);
  const [isSaving, setIsSaving] = useState(false);
  // Popup fields are read straight from Firestore since store doesn't carry them.
  const [popup, setPopup] = useState<{ enabled: boolean; title: string; message: string; severity: string }>({
    enabled: false, title: '', message: '', severity: 'info',
  });

  React.useEffect(() => {
    import('firebase/firestore').then(({ getDoc }) => getDoc(doc(db, 'settings', 'general')).then((snap) => {
      if (!snap.exists()) return;
      const data: any = snap.data();
      setPopup({
        enabled: data.popupEnabled === true,
        title: data.popupTitle || '',
        message: data.popupMessage || '',
        severity: data.popupSeverity || 'info',
      });
    }).catch(() => {}));
  }, []);

  const savePopup = async () => {
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        popupEnabled: popup.enabled,
        popupTitle: popup.title,
        popupMessage: popup.message,
        popupSeverity: popup.severity,
      }, { merge: true });
      toast.success(dt('Njoftimi popup u publikua për të gjithë vizitorët!'));
    } catch (e) {
      console.error(e);
      toast.error(dt('Popup nuk u ruajt. Provoni përsëri.'));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    updateDonationUrls({ charity: charityUrl, maintenance: maintenanceUrl });
    try {
      await setDoc(doc(db, 'settings', 'general'), { showReels }, { merge: true });
      toast.success(dt('Cilësimet e sistemit u ruajtën me sukses!'));
    } catch (e) {
      // A failed write must say so. This used to report success ("saved
      // locally"), so an administrator believed a setting was live when the
      // platform never received it.
      console.error(e);
      toast.error(dt('Cilësimet nuk u ruajtën. Kontrolloni lidhjen dhe provoni përsëri.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto md:mx-0">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200/60 dark:border-white/10 rounded-xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] dark:shadow-none transition-all duration-300 rounded-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-wide title-serif flex items-center gap-3">
            <Settings className="w-8 h-8 text-rose-600" />{dt(`Cilësimet e Sistemit`)}
          </h2>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex w-full md:w-auto items-center justify-center gap-2 bg-rose-600 text-white px-6 py-3 font-bold tracking-wide text-xs hover:bg-slate-900 transition-colors border-2 border-transparent rounded-2xl disabled:opacity-60"
          >
            <Save className="w-4 h-4" />{dt(`Ruaj Ndryshimet`)}
          </button>
        </div>

        <div className="space-y-8">
                    <section>
            <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white tracking-wide border-b-2 border-slate-900 pb-2 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-rose-600"/>{dt(`Modulet e Platformës`)}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-neutral-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200/60 dark:border-white/10">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{dt(`Reels / Video Për Ty`)}</h4>
                  <p className="text-xs text-slate-500">{dt(`Shfaq ose fshih seksionin Reels nga forumi dhe menuja për përdoruesit.`)}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={showReels} onChange={(e) => setShowReels(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                </label>
              </div>
            </div>
          </section>
          
          <section>
            <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white tracking-wide border-b-2 border-slate-900 pb-2 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600"/>{dt(`Njoftim Popup Global`)}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-neutral-50 p-4 border-2 border-slate-200/60">
                <input
                  type="checkbox"
                  checked={popup.enabled}
                  onChange={(e) => setPopup(p => ({ ...p, enabled: e.target.checked }))}
                  className="w-5 h-5 accent-rose-600 cursor-pointer"
                  id="popup-enabled"
                />
                <label htmlFor="popup-enabled" className="text-xs font-bold text-slate-900 dark:text-white tracking-wide cursor-pointer">
                  {dt(`Aktivizo popup për të gjithë vizitorët e platformës`)}
                </label>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{dt('Titulli i popup-it')}</label>
                <input
                  type="text"
                  value={popup.title}
                  onChange={(e) => setPopup(p => ({ ...p, title: e.target.value }))}
                  placeholder="p.sh. Mirëmbajtje e planifikuar"
                  className="w-full px-4 py-3 bg-neutral-100 border border-slate-200/60 dark:border-white/10 rounded-xl font-bold text-sm outline-none focus:border-rose-600 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{dt('Mesazhi i popup-it')}</label>
                <textarea
                  value={popup.message}
                  onChange={(e) => setPopup(p => ({ ...p, message: e.target.value }))}
                  rows={4}
                  placeholder={dt("Shkruani njoftimin serioz që do t'u shfaqet çdo vizitori...")}
                  className="w-full px-4 py-3 bg-neutral-100 border border-slate-200/60 dark:border-white/10 rounded-xl font-bold text-sm outline-none focus:border-rose-600 transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{dt('Niveli i seriozitetit')}</label>
                <div className="flex gap-2">
                  {[
                    { id: 'info', label: 'Info', cls: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/40' },
                    { id: 'serious', label: 'I rëndësishëm', cls: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40' },
                    { id: 'critical', label: 'Kritik', cls: 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/40' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPopup(p => ({ ...p, severity: opt.id }))}
                      aria-pressed={popup.severity === opt.id}
                      className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${popup.severity === opt.id ? opt.cls : 'border-slate-200 text-slate-500 hover:bg-neutral-50 dark:border-white/10'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={savePopup}
                className="flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-xs font-black text-white transition hover:bg-slate-800"
              >
                <Eye className="w-4 h-4" /> {dt('Publiko popup-in')}
              </button>
              <p className="text-xs text-slate-500">Njoftimi shfaqet te çdo vizitor një herë; mesazhi i ri e riaktivizon automatikisht.</p>
            </div>
          </section>

          <section>
            <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white tracking-wide border-b-2 border-slate-900 pb-2 mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-rose-600"/>{dt(`Konfigurimi Gjeneral`)}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs md:text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-300 tracking-wide mb-1">{dt(`Emri i Drejtorisë`)}</label>
                <input type="text" defaultValue="Drejtoria Qendrore" className="w-full px-4 py-3 bg-neutral-100 border border-slate-200/60 dark:border-white/10 rounded-xl font-bold text-sm outline-none focus:border-rose-600 transition-colors" />
              </div>
              <div>
                <label className="block text-xs md:text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-300 tracking-wide mb-1">{dt(`Emaili Mbështetës`)}</label>
                <input type="email" defaultValue="admin@qyteti.gov" className="w-full px-4 py-3 bg-neutral-100 border border-slate-200/60 dark:border-white/10 rounded-xl font-bold text-sm outline-none focus:border-rose-600 transition-colors" />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white tracking-wide border-b-2 border-slate-900 pb-2 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600"/>{dt(`Njoftim Popup Global`)}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-neutral-100 px-4 py-3 dark:border-white/10 dark:bg-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{dt('Shfaq popup çdo vizitori kur hyn në faqe')}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={popup.enabled}
                  onClick={() => setPopup(p => ({ ...p, enabled: !p.enabled }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${popup.enabled ? 'bg-rose-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${popup.enabled ? 'left-[1.375rem]' : 'left-0.5'}`} />
                </button>
              </div>
              <div>
                <label className="block text-xs md:text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide mb-1">{dt('Titulli')}</label>
                <input
                  type="text"
                  value={popup.title}
                  onChange={(e) => setPopup(p => ({ ...p, title: e.target.value }))}
                  placeholder={dt('p.sh. Mirëmbajtje e planifikuar')}
                  className="w-full px-4 py-3 bg-neutral-100 border border-slate-200/60 dark:border-white/10 rounded-xl font-bold text-sm outline-none focus:border-rose-600 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs md:text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide mb-1">{dt('Mesazhi')}</label>
                <textarea
                  value={popup.message}
                  onChange={(e) => setPopup(p => ({ ...p, message: e.target.value }))}
                  rows={3}
                  placeholder={dt('Shkruani njoftimin serioz...')}
                  className="w-full px-4 py-3 bg-neutral-100 border border-slate-200/60 dark:border-white/10 rounded-xl font-bold text-sm outline-none focus:border-rose-600 transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-xs md:text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide mb-1">{dt('Niveli seriozitetit')}</label>
                <div className="flex gap-2">
                  {[
                    { id: 'info', label: dt('Njoftim') },
                    { id: 'serious', label: dt('I rëndësishëm') },
                    { id: 'critical', label: dt('I menjëhershëm') },
                  ].map(level => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setPopup(p => ({ ...p, severity: level.id }))}
                      aria-pressed={popup.severity === level.id}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        popup.severity === level.id
                          ? 'border-rose-600 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                          : 'border-slate-200 text-slate-600 hover:bg-neutral-100 dark:border-white/10 dark:text-slate-300'
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={savePopup}
                className="flex items-center justify-center gap-2 bg-rose-600 text-white px-6 py-3 font-bold tracking-wide text-xs hover:bg-slate-900 transition-colors rounded-2xl w-full"
              >
                <Save className="w-4 h-4" />{dt(`Publiko Njoftimin Popup`)}
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white tracking-wide border-b-2 border-slate-900 pb-2 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-rose-600"/>{dt(`Siguria & API`)}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs md:text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-300 tracking-wide mb-1">{dt(`Global API Key`)}</label>
                <input type="password" defaultValue="************************" className="w-full px-4 py-3 bg-neutral-100 border border-slate-200/60 dark:border-white/10 rounded-xl font-bold text-sm outline-none focus:border-rose-600 transition-colors" />
                <p className="text-xs mt-1 text-neutral-500 dark:text-slate-400 font-bold tracking-wide">{dt(`Kërkohet për integrime të palëve të treta.`)}</p>
              </div>
              <div className="flex items-center gap-3 bg-neutral-50 p-4 border-2 border-slate-200/60">
                <input type="checkbox" defaultChecked className="w-5 h-5 border border-slate-200/60 dark:border-white/10 rounded-xl accent-rose-600 rounded-xl cursor-pointer" />
                <label className="text-xs font-bold text-slate-900 dark:text-white tracking-wide cursor-pointer">{dt(`Kërko Mbrojtje 2FA Për Të Gjithë Administratorët`)}</label>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white tracking-wide border-b-2 border-slate-900 pb-2 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-rose-600"/>{dt(`Ruajtja e të Dhënave`)}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs md:text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-300 tracking-wide mb-1">{dt(`Periudha e ruajtjes së logeve (Ditë)`)}</label>
                <input type="number" defaultValue="90" className="w-full md:w-64 px-4 py-3 bg-neutral-100 border border-slate-200/60 dark:border-white/10 rounded-xl font-bold text-sm outline-none focus:border-rose-600 transition-colors" />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white tracking-wide border-b-2 border-slate-900 pb-2 mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-600"/>{dt(`Donacionet`)}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-300 tracking-wide mb-1">{dt(`URL për Njerëzit me Nevojë (Bamirësi)`)}</label>
                <input type="url" value={charityUrl} onChange={e => setCharityUrl(e.target.value)} placeholder={dt(`https://`)} className="w-full px-4 py-3 bg-neutral-100 border border-slate-200/60 dark:border-white/10 rounded-xl font-bold text-sm outline-none focus:border-rose-600 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-300 tracking-wide mb-1">{dt(`URL për Mirëmbajtjen e Uebit`)}</label>
                <input type="url" value={maintenanceUrl} onChange={e => setMaintenanceUrl(e.target.value)} placeholder={dt(`https://`)} className="w-full px-4 py-3 bg-neutral-100 border border-slate-200/60 dark:border-white/10 rounded-xl font-bold text-sm outline-none focus:border-rose-600 transition-colors" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

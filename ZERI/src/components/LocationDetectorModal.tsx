import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../lib/store';
import { useLanguage } from '../lib/LanguageContext';
import { MapPin, Navigation, Loader2, Search, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { normalizeMunicipalityName, isInsideKosovo } from '../lib/municipalityNormalizer';
import { hasAnalyticsConsent, hasDecided, onConsentChange } from '../lib/consent';
import { AGE_PASSED_EVENT, isAgeVerified } from '../lib/ageGate';
import {
  ALL_MUNICIPALITIES,
  ALL_SCOPE, searchMunicipalities
} from '../lib/municipalityScope';

/**
 * The prompt opens on the absence of a stored choice, not on the value of the
 * scope. Keying it off `userMunicipality !== null` used to mean the modal
 * re-opened on every single reload for anyone who had deliberately chosen the
 * whole country, and it could never be dismissed once the sentinel string
 * replaced null.
 */

export function LocationDetectorModal() {
  const { dt } = useLanguage();
  const userMunicipality = useStore(state => state.userMunicipality);
  const setUserMunicipality = useStore(state => state.setUserMunicipality);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [geolocationAllowed, setGeolocationAllowed] = useState<boolean>(() => hasAnalyticsConsent());

  // The banner can be answered after this modal mounts, so follow the event
  // rather than sampling the flag once. Law 06/L-082 requires the citizen's
  // explicit, specific consent before the browser geolocation API is touched.
  useEffect(() => {
    return onConsentChange(() => setGeolocationAllowed(hasAnalyticsConsent()));
  }, []);

  // A first visit used to stack three gates at once (age, cookies, location).
  // The location prompt now waits until the age check is passed and the cookie
  // question is answered, so the citizen meets one question at a time.
  const [gatesClear, setGatesClear] = useState<boolean>(() => isAgeVerified() && hasDecided());
  useEffect(() => {
    const refresh = () => setGatesClear(isAgeVerified() && hasDecided());
    window.addEventListener(AGE_PASSED_EVENT, refresh);
    const off = onConsentChange(refresh);
    return () => {
      window.removeEventListener(AGE_PASSED_EVENT, refresh);
      off();
    };
  }, []);

  // Persist only the municipality name. The Geolocation coordinates feed the
  // single reverse-geocode call below and are then discarded: they never reach
  // localStorage, the Zustand store or Firestore.
  const handleManualSelect = (muni: string) => {
    // The store setter is the only writer of the persisted key; writing it here
    // as well was the second half of the double-write race between this modal
    // and the sidebar switcher.
    setUserMunicipality(muni);
    toast.success(dt(`Vendndodhja u vendos në:`) + ' ' + muni, {
      icon: '📍'
    });
  };

  const handleAutoDetect = () => {
    if (!geolocationAllowed) {
      toast.error(dt("Për të gjetur vendndodhjen automatikisht duhet të pranoni përdorimin e të dhënave analitike në panelin e privatësisë."));
      return;
    }
    if (!navigator.geolocation) {
      toast.error(dt("Shfletuesi juaj nuk mbështet gjetjen e vendndodhjes."));
      return;
    }
    setIsLoading(true);

    // The Geolocation callback can fire more than once and the modal may unmount
    // mid-request. The latch makes every exit path release the spinner exactly once.
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setIsLoading(false);
    };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;

        // Drop positions outside Kosovo's bounding box before any network call.
        if (!isInsideKosovo(latitude, longitude)) {
          toast.success(dt("Nuk u gjet përputhje e saktë komune, mund ta zgjidhni manualisht."));
          finish();
          return;
        }

        try {
          // zoom=10 keeps the lookup at municipality level, and coarse accuracy
          // stops it from narrowing the result down to a single street.
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&addressdetails=1&lat=${latitude}&lon=${longitude}`,
            { headers: { 'Accept-Language': 'sq' } }
          );
          if (!res.ok) throw new Error(`Geocoder responded ${res.status}`);
          const data = await res.json();
          const address = (data && data.address) || {};
          const rawCity = address.city
            || address.town
            || address.county
            || address.municipality
            || address.village
            || address.suburb
            || '';

          // One shared spelling table (Pristina / Prishtinë / Priština) instead of
          // the 50-entry literal that used to be inlined in this component.
          const matched = normalizeMunicipalityName(rawCity)
            || ALL_MUNICIPALITIES.find((municipality) =>
              normalizeMunicipalityName(municipality) === normalizeMunicipalityName(rawCity)
            )
            || null;
          if (matched) {
            handleManualSelect(matched);
          } else {
            toast.success(dt("Nuk u gjet përputhje e saktë komune, mund ta zgjidhni manualisht."));
          }
        } catch {
          toast.error(dt("Gabim gjatë lidhjes me serverin e lokacionit."));
        } finally {
          finish();
        }
      },
      () => {
        toast.error(dt("Keni refuzuar qasjen në lokacion ose ka ndodhur një gabim. Zgjidhni manualisht."));
        finish();
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 }
    );
  };

  const filteredMunicipalities = useMemo(
    () => searchMunicipalities(searchQuery),
    [searchQuery]
  );

  // Reactive, not sampled: answering the prompt (or picking a municipality
  // anywhere else) must dismiss it for good. A one-time read left the modal
  // stuck on screen when the choice was made by a sibling component after
  // mount — the citizen could see their municipality saved while the gate
  // stayed up, and every in-app navigation re-showed it.
  const hasAnswered = useStore(state => state.hasChosenMunicipality);
  if (hasAnswered || !gatesClear) return null;


  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/80 md:backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.45, bounce: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="location-dialog-title"
          className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900 md:flex-row"
        >
          {/* Left Side: Presentation */}
          <div className="relative flex shrink-0 flex-col justify-between overflow-hidden bg-(--color-brand-primary) p-4 text-white dark:bg-blue-700 md:w-2/5 md:p-6">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-900/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />

            <div className="relative z-10">
              <div className="hidden md:flex w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl items-center justify-center mb-6 shadow-inner border border-white/20">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <h2 id="location-dialog-title" className="text-xl md:text-2xl font-black tracking-tight mb-1.5 md:mb-3">
                {dt("Zgjidhni Vendndodhjen")}
              </h2>
              <p className="text-blue-100 font-medium text-xs md:text-sm leading-relaxed md:mb-6">
                {dt("Përjetoni platformën në mënyrë të personalizuar. Duke zgjedhur komunën tuaj, ne do t'ju shfaqim njoftimet, debatet dhe informacionet më relevante për zonën tuaj.")}
              </p>
            </div>

            <div className="relative z-10 hidden space-y-3 md:block">
              <div className="flex items-center gap-3 text-sm font-medium text-blue-50">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>{dt("100% Privat dhe Anonim")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-blue-50">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>{dt("Asnjë ruajtje e IP-së")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-blue-50">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>{dt("Lokalizim Inteligjent")}</span>
              </div>
            </div>
          </div>

          {/* Right Side: Selection */}
          <div className="flex h-[calc(100dvh-12rem)] min-h-0 flex-col p-5 sm:p-6 md:h-auto md:max-h-[min(700px,calc(100dvh-2rem))] md:w-3/5">

            <button
              onClick={handleAutoDetect}
              disabled={isLoading}
              className="w-full mb-6 group relative overflow-hidden rounded-2xl bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-blue-900/50 p-4 flex items-center gap-4 transition hover:border-blue-300 dark:hover:border-blue-700/50 hover:shadow-md active:scale-[0.98] disabled:opacity-70"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                ) : (
                  <Navigation className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="text-left flex-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {dt("Gjej vendndodhjen time automatikisht")}
                </h4>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                  {dt("Kërkon leje nga shfletuesi juaj")}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                {dt("Ose Zgjidhni Manualisht")}
              </span>
              <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={dt("Kërko komunën...")}
                aria-label={dt("Kërko komunën...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition placeholder:text-slate-400"
              />
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-1.5 -mr-2">
              {filteredMunicipalities.length > 0 ? (
                filteredMunicipalities.map(m => (
                  <button
                    key={m}
                    onClick={() => handleManualSelect(m)}
                    className="w-full px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl text-left transition flex items-center justify-between group"
                  >
                    {m}
                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <MapPin className="w-3 h-3" />
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">
                  {dt("Nuk u gjet asnjë komunë.")}
                </div>
              )}
            </div>

            <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => handleManualSelect(ALL_SCOPE)}
                className="w-full py-3 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                <span>{dt("Shiko gjithë Kosovën (Nacionale)")}</span>
              </button>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

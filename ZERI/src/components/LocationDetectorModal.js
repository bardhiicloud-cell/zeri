import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../lib/store';
import { useLanguage } from '../lib/LanguageContext';
import { MapPin, Navigation, Loader2, Search, CheckCircle2 } from 'lucide-react';
import { ALL_MUNICIPALITIES_OPTION, FORUM_MUNICIPALITIES } from '../lib/constants';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { normalizeMunicipalityName, isInsideKosovo } from '../lib/municipalityNormalizer';
import { hasAnalyticsConsent, onConsentChange } from '../lib/consent';
/** Named to match the report form so the detected value is never mistyped. */
const USER_MUNICIPALITY_STORAGE_KEY = 'kosova_user_muni';
const KOSOVO_MUNICIPALITIES = FORUM_MUNICIPALITIES.filter((municipality) => municipality !== ALL_MUNICIPALITIES_OPTION);
export function LocationDetectorModal() {
    const { dt } = useLanguage();
    const userMunicipality = useStore(state => state.userMunicipality);
    const setUserMunicipality = useStore(state => state.setUserMunicipality);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [geolocationAllowed, setGeolocationAllowed] = useState(() => hasAnalyticsConsent());
    // The banner can be answered after this modal mounts, so follow the event
    // rather than sampling the flag once. Law 06/L-082 requires the citizen's
    // explicit, specific consent before the browser geolocation API is touched.
    useEffect(() => {
        return onConsentChange(() => setGeolocationAllowed(hasAnalyticsConsent()));
    }, []);
    // Persist only the municipality name. The Geolocation coordinates feed the
    // single reverse-geocode call below and are then discarded: they never reach
    // localStorage, the Zustand store or Firestore.
    const handleManualSelect = (muni) => {
        localStorage.setItem(USER_MUNICIPALITY_STORAGE_KEY, muni);
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
            if (settled)
                return;
            settled = true;
            setIsLoading(false);
        };
        navigator.geolocation.getCurrentPosition(async (pos) => {
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
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&addressdetails=1&lat=${latitude}&lon=${longitude}`, { headers: { 'Accept-Language': 'sq' } });
                if (!res.ok)
                    throw new Error(`Geocoder responded ${res.status}`);
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
                    || KOSOVO_MUNICIPALITIES.find((municipality) => normalizeMunicipalityName(municipality) === normalizeMunicipalityName(rawCity))
                    || null;
                if (matched) {
                    handleManualSelect(matched);
                }
                else {
                    toast.success(dt("Nuk u gjet përputhje e saktë komune, mund ta zgjidhni manualisht."));
                }
            }
            catch {
                toast.error(dt("Gabim gjatë lidhjes me serverin e lokacionit."));
            }
            finally {
                finish();
            }
        }, () => {
            toast.error(dt("Keni refuzuar qasjen në lokacion ose ka ndodhur një gabim. Zgjidhni manualisht."));
            finish();
        }, { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 });
    };
    const filteredMunicipalities = useMemo(() => {
        return KOSOVO_MUNICIPALITIES
            .filter(m => m.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [searchQuery]);
    if (userMunicipality !== null)
        return null;
    return (_jsx(AnimatePresence, { children: _jsxs("div", { className: "fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6", children: [_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, className: "absolute inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-md" }), _jsxs(motion.div, { initial: { opacity: 0, scale: 0.98, y: 12 }, animate: { opacity: 1, scale: 1, y: 0 }, transition: { type: "spring", duration: 0.45, bounce: 0 }, role: "dialog", "aria-modal": "true", "aria-labelledby": "location-dialog-title", className: "relative flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900 md:flex-row", children: [_jsxs("div", { className: "relative flex max-h-40 shrink-0 flex-col justify-between overflow-hidden bg-(--color-brand-primary) p-5 text-white dark:bg-blue-700 md:max-h-none md:w-2/5 md:p-6", children: [_jsx("div", { className: "absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" }), _jsx("div", { className: "absolute bottom-0 left-0 w-48 h-48 bg-blue-900/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" }), _jsxs("div", { className: "relative z-10", children: [_jsx("div", { className: "w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-white/20", children: _jsx(MapPin, { className: "w-6 h-6 text-white" }) }), _jsx("h2", { id: "location-dialog-title", className: "text-2xl font-black tracking-tight mb-3", children: dt("Zgjidhni Vendndodhjen") }), _jsx("p", { className: "text-blue-100 font-medium text-sm leading-relaxed mb-6", children: dt("Përjetoni platformën në mënyrë të personalizuar. Duke zgjedhur komunën tuaj, ne do t'ju shfaqim njoftimet, debatet dhe informacionet më relevante për zonën tuaj.") })] }), _jsxs("div", { className: "relative z-10 hidden space-y-3 md:block", children: [_jsxs("div", { className: "flex items-center gap-3 text-sm font-medium text-blue-50", children: [_jsx(CheckCircle2, { className: "w-5 h-5 text-emerald-400" }), _jsx("span", { children: dt("100% Privat dhe Anonim") })] }), _jsxs("div", { className: "flex items-center gap-3 text-sm font-medium text-blue-50", children: [_jsx(CheckCircle2, { className: "w-5 h-5 text-emerald-400" }), _jsx("span", { children: dt("Asnjë ruajtje e IP-së") })] }), _jsxs("div", { className: "flex items-center gap-3 text-sm font-medium text-blue-50", children: [_jsx(CheckCircle2, { className: "w-5 h-5 text-emerald-400" }), _jsx("span", { children: dt("Lokalizim Inteligjent") })] })] })] }), _jsxs("div", { className: "flex h-[calc(100dvh-12rem)] min-h-0 flex-col p-5 sm:p-6 md:h-auto md:max-h-[min(700px,calc(100dvh-2rem))] md:w-3/5", children: [_jsxs("button", { onClick: handleAutoDetect, disabled: isLoading, className: "w-full mb-6 group relative overflow-hidden rounded-2xl bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-blue-900/50 p-4 flex items-center gap-4 transition-all hover:border-blue-300 dark:hover:border-blue-700/50 hover:shadow-md active:scale-[0.98] disabled:opacity-70", children: [_jsx("div", { className: "w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300", children: isLoading ? (_jsx(Loader2, { className: "w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" })) : (_jsx(Navigation, { className: "w-5 h-5 text-blue-600 dark:text-blue-400" })) }), _jsxs("div", { className: "text-left flex-1", children: [_jsx("h4", { className: "text-sm font-bold text-slate-900 dark:text-white", children: dt("Gjej vendndodhjen time automatikisht") }), _jsx("p", { className: "text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5", children: dt("Kërkon leje nga shfletuesi juaj") })] })] }), _jsxs("div", { className: "flex items-center gap-4 mb-6", children: [_jsx("div", { className: "flex-1 h-px bg-slate-100 dark:bg-slate-800" }), _jsx("span", { className: "text-[10px] font-black uppercase tracking-widest text-slate-400", children: dt("Ose Zgjidhni Manualisht") }), _jsx("div", { className: "flex-1 h-px bg-slate-100 dark:bg-slate-800" })] }), _jsxs("div", { className: "relative mb-4", children: [_jsx(Search, { className: "absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" }), _jsx("input", { type: "text", placeholder: dt("Kërko komunën..."), "aria-label": dt("Kërko komunën..."), value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400" })] }), _jsx("div", { className: "flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-1.5 -mr-2", children: filteredMunicipalities.length > 0 ? (filteredMunicipalities.map(m => (_jsxs("button", { onClick: () => handleManualSelect(m), className: "w-full px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl text-left transition-all flex items-center justify-between group", children: [m, _jsx("div", { className: "w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity", children: _jsx(MapPin, { className: "w-3 h-3" }) })] }, m)))) : (_jsx("div", { className: "py-8 text-center text-slate-500 dark:text-slate-400 text-sm font-medium", children: dt("Nuk u gjet asnjë komunë.") })) }), _jsx("div", { className: "pt-4 mt-2 border-t border-slate-100 dark:border-slate-800", children: _jsx("button", { onClick: () => handleManualSelect(ALL_MUNICIPALITIES_OPTION), className: "w-full py-3 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2", children: _jsx("span", { children: dt("Shiko gjithë Kosovën (Nacionale)") }) }) })] })] })] }) }));
}

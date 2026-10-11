import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { dt } from '@/src/lib/dt';
import React, { useState, useEffect, useRef, Component } from 'react';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '../lib/store';
import { useLanguage } from '../lib/LanguageContext';
import { Camera, MapPin, AlertCircle, CheckCircle2, ChevronRight, Loader2, Sparkles, ArrowLeft, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { getAccountabilityDueDate, getAccountabilityProfile } from '../lib/accountability';
import { KOSOVO_MUNICIPALITIES, MUNICIPALITY_COORDINATES } from '../lib/constants';
import { auth, db, uploadFileToStorage, MAX_UPLOAD_BYTES, formatBytes } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { createTrackingId, getOrCreateGuestUser, saveGuestReportHistory } from '../lib/session';
/**
 * Guarantees an authenticated Firebase session before a report is written.
 *
 * The `reports` rule requires `authorId == request.auth.uid`, so a report can
 * only be persisted when a real uid exists. Signed-in citizens already have
 * one; visitors are upgraded to an anonymous account when the project allows
 * it. Returning `null` means no write can succeed, and the caller must tell
 * the citizen instead of showing a Track ID for a report that was never saved.
 */
async function ensureReportSession() {
    if (auth.currentUser?.uid)
        return auth.currentUser.uid;
    try {
        const credential = await signInAnonymously(auth);
        return credential.user.uid;
    }
    catch {
        const guestUser = getOrCreateGuestUser();
        return guestUser.id;
    }
}
import { validations } from '../lib/validations';
import { handleFirebaseError } from '../lib/errorHandler';
// Fix for default Leaflet icon in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});
function MapUpdater({ mapCenter }) {
    const map = useMapEvents({
        click() {
            // The parent uses click differently via LocationMarker, but map doesn't trigger here unless we intercept
        }
    });
    React.useEffect(() => {
        map.flyTo(mapCenter, Math.max(map.getZoom(), 16));
    }, [mapCenter[0], mapCenter[1], map]);
    return null;
}
// Safe Kosovo Municipality Mapping Helper to resolve standardizing OpenStreetMap names
const mapToKosovoMunicipality = (name) => {
    if (!name)
        return '';
    const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const mappings = {
        'pristina': 'Prishtinë',
        'prishtina': 'Prishtinë',
        'prishtine': 'Prishtinë',
        'pec': 'Pejë',
        'peja': 'Pejë',
        'peje': 'Pejë',
        'gnjilane': 'Gjilan',
        'gjilani': 'Gjilan',
        'gjilan': 'Gjilan',
        'prizren': 'Prizren',
        'prizreni': 'Prizren',
        'urosevac': 'Ferizaj',
        'ferizaj': 'Ferizaj',
        'dakovica': 'Gjakovë',
        'gjakova': 'Gjakovë',
        'gjakove': 'Gjakovë',
        'mitrovica': 'Mitrovicë',
        'mitrovice': 'Mitrovicë',
        'kosovska mitrovica': 'Mitrovicë',
        'mitrovica e veriut': 'Mitrovica e Veriut',
        'severna mitrovica': 'Mitrovica e Veriut',
        'vushtrri': 'Vushtrri',
        'vucitrn': 'Vushtrri',
        'podujeva': 'Podujevë',
        'podujeve': 'Podujevë',
        'podujevo': 'Podujevë',
        'fushe kosove': 'Fushë Kosovë',
        'kosovo polje': 'Fushë Kosovë',
        'skenderaj': 'Skenderaj',
        'srbica': 'Skenderaj',
        'drenas': 'Drenas',
        'glogovac': 'Drenas',
        'gllogoc': 'Drenas',
        'suhareke': 'Suharekë',
        'suva reka': 'Suharekë',
        'suhareka': 'Suharekë',
        'rahovec': 'Rahovec',
        'orahovac': 'Rahovec',
        'malisheve': 'Malishevë',
        'malisevo': 'Malishevë',
        'malisheva': 'Malishevë',
        'kamenice': 'Kamenicë',
        'kamenica': 'Kamenicë',
        'kosovska kamenica': 'Kamenicë',
        'viti': 'Viti',
        'vitina': 'Viti',
        'decan': 'Deçan',
        'decani': 'Deçan',
        'kline': 'Klinë',
        'klina': 'Klinë',
        'lipjan': 'Lipjan',
        'lipljan': 'Lipjan',
        'istog': 'Istog',
        'istok': 'Istog',
        'kacanik': 'Kaçanik',
        'shtime': 'Shtime',
        'stimlje': 'Shtime',
        'dragash': 'Dragash',
        'dragas': 'Dragash',
        'obiliq': 'Obiliq',
        'obilic': 'Obiliq',
        'novoberde': 'Novobërdë',
        'novo brdo': 'Novobërdë',
        'artana': 'Novobërdë',
        'artane': 'Novobërdë',
        'shterpce': 'Shtërpcë',
        'strpce': 'Shtërpcë',
        'junik': 'Junik',
        'hani i elezit': 'Hani i Elezit',
        'general jankovic': 'Hani i Elezit',
        'elez han': 'Hani i Elezit',
        'gracanice': 'Graçanicë',
        'gracanica': 'Graçanicë',
        'ranillug': 'Ranillug',
        'ranilug': 'Ranillug',
        'partesh': 'Partesh',
        'partes': 'Partesh',
        'kllokot': 'Kllokot',
        'klokot': 'Kllokot',
        'mamushe': 'Mamushë',
        'mamusa': 'Mamushë',
        'leposaviq': 'Leposaviq',
        'leposavic': 'Leposaviq',
        'zubin potok': 'Zubin Potok',
        'zvecan': 'Zveçan',
        'zvecane': 'Zveçan'
    };
    if (mappings[n])
        return mappings[n];
    for (const key of Object.keys(mappings)) {
        if (n.includes(key) || key.includes(n)) {
            return mappings[key];
        }
    }
    const exactMatch = KOSOVO_MUNICIPALITIES.find(m => m.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === n);
    if (exactMatch)
        return exactMatch;
    return '';
};
// Error Boundary for the Leaflet Map to prevent entire app crashes in sandboxed iframes
class SafeMapContainer extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, errorInfo) {
        console.error("Leaflet Map crash intercepted gracefully:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (_jsxs("div", { className: "w-full h-full flex flex-col items-center justify-center bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-800 border-2 border-dashed border-neutral-300 rounded-xl p-8 text-center", children: [_jsx(MapPin, { className: "w-12 h-12 text-indigo-600 mb-3 animate-pulse" }), _jsx("h4", { className: "font-bold text-[var(--color-text)] dark:text-white text-sm uppercase tracking-wider", children: dt(`Harta interaktive po ngarkohet...`) }), _jsx("p", { className: "text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] mt-2 max-w-sm leading-relaxed", children: dt(`Ju mund të vazhdoni duke shkruar adresën tuaj ose duke përdorur butonin GPS më lart për të zbuluar automatikisht vendndodhjen.`) })] }));
        }
        return this.props.children;
    }
}
function LocationMarker({ position, setPosition, setAddress, setMunicipality, preventSearchRef }) {
    useMapEvents({
        async click(e) {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            setPosition([lat, lng]);
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                const data = await res.json();
                if (data && data.address) {
                    const city = data.address.city || data.address.town || data.address.village || data.address.municipality;
                    if (city) {
                        const exactCommune = mapToKosovoMunicipality(city);
                        if (exactCommune) {
                            setMunicipality(exactCommune);
                        }
                    }
                    if (preventSearchRef)
                        preventSearchRef.current = true;
                    setAddress(data.display_name);
                }
            }
            catch (err) {
                console.error(err);
            }
        },
    });
    return (_jsxs(_Fragment, { children: [_jsx(MapUpdater, { mapCenter: position }), _jsx(Marker, { position: position })] }));
}
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            return;
        }
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = error => reject(error);
    });
};
function getSimulatedIP() {
    return "Private";
}
import { motion } from 'framer-motion';
export default function ReportIssue() {
    const { t, dt } = useLanguage();
    const bannedIPs = useStore(state => state.bannedIPs);
    const currentIP = getSimulatedIP();
    const isBanned = bannedIPs.includes(currentIP);
    const addReport = useStore(state => state.addReport);
    const upvoteReport = useStore(state => state.upvoteReport);
    const reports = useStore(state => state.reports);
    const currentUser = useStore(state => state.currentUser);
    const addPoints = useStore(state => state.addPoints);
    const categories = useStore(state => state.categories);
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [submittedReportId, setSubmittedReportId] = useState('');
    const startTime = useRef(Date.now());
    const [isSubmitting, setIsSubmitting] = useState(false);
    if (isBanned) {
        return (_jsxs("div", { className: "max-w-md mx-auto my-12 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border border-indigo-600 rounded-[2rem] p-8 text-center space-y-6 shadow-xl animate-fade-in", children: [_jsx("div", { className: "w-16 h-16 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto animate-pulse", children: _jsx(ShieldAlert, { className: "w-8 h-8" }) }), _jsx("h2", { className: "text-xl font-extrabold text-[var(--color-text)] dark:text-white uppercase", children: dt(`Raportimi u Bllokua`) }), _jsxs("p", { className: "text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-bold leading-relaxed", children: [dt(`Sistemi i Sigurisë (AI Guard) ka bllokuar këtë pajisje (IP:`), " ", currentIP, dt(`) për shkak të shkeljes së kushteve të përdorimit ose dyshimit për spam të vazhdueshëm.`)] }), _jsx("div", { className: "border-t border-slate-100 dark:border-white/5 pt-4", children: _jsx("p", { className: "text-[10px] text-[var(--color-text-muted)] font-mono", children: dt(`CODE: BAN_IP_PREVENT_SUBMIT`) }) })] }));
    }
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiInsights, setAiInsights] = useState(null);
    const [mediaError, setMediaError] = useState(false);
    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [categorySearchTerm, setCategorySearchTerm] = useState('');
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const categoryDropdownRef = useRef(null);
    useEffect(() => {
        function handleClickOutside(event) {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
                setIsCategoryDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    // Kategoritë e plota - Nivel qendror dhe lokal me fjalë kyçe për kërkim të lehtë
    const defaultCategories = [
        // Rrugët dhe Infrastruktura
        { name: "Komuna - Drejtoria e Infrastrukturës (Rrugë lokale, Gropa, Asfaltim në qytet/fshat)", group: "Infrastruktura dhe Rrugët", keywords: "rrugë, gropë, grop, asfalt, trotuar, dëmtime, kubëza, baltë, pluhur, shtruar, ndërtim, infrastrukturë, lagje, fshat, rrug, rruga" },
        { name: "Ministria e Infrastrukturës (Rrugë magjistrale, Autostrada, Rrugë rajonale)", group: "Infrastruktura dhe Rrugët", keywords: "rrugë, autostradë, shpronësim, magjistrale, nacionale, rrug, rruga, ura, hekurudha, ndërtim, infrastrukturë" },
        // Shëndetësia
        { name: "Komuna - QKMF / Ambulancat lokale (Shëndetësia primare)", group: "Shëndetësia", keywords: "spital, mjekësi, barna, ambulancë, qkmf, mjek, shëndet, vizitë, mjeku i familjes, lokal, komuna" },
        { name: "Ministria e Shëndetësisë / SHSKUK (QKUK, Spitalet Rajonale)", group: "Shëndetësia", keywords: "spital, qkuk, shskuk, operacion, emergjencë, pacient, barna, shëndetësi, nivel qendror" },
        // Arsimi
        { name: "Komuna - Drejtoria e Arsimit (Kopshte, Shkolla fillore dhe të mesme)", group: "Arsimi dhe Shkolla", keywords: "shkollë, kopsht, çerdhe, arsim, nxënës, mësues, klasa, fillore, mesme, shkolla" },
        { name: "Ministria e Arsimit, Shkencës dhe Teknologjisë (Universitetet, Kurrikulat)", group: "Arsimi dhe Shkolla", keywords: "fakultet, universitet, diplomë, libër, student, edukim, arsimi i lartë, MASHT" },
        // Uji, Rryma, dhe Mbeturinat (Këto zakonisht i ngatërrojnë njerëzit)
        { name: "Ujësjellësi Rajonal - KRU (Mungesë uji, Gyp i pëlcitur, Faturim)", group: "Shërbimet Publike (Kompani & Agjenci)", keywords: "ujë, pijshëm, gyp, kru, reduktim, ndërprerje, faturë, pusetë, rrjedhje, ujësjellës, kanalizim, ujt, uj, uji" },
        { name: "Komuna - Kanalizimi lokal dhe Ujërat e zeza (Zgjerim rrjeti, Bllokim i madh)", group: "Shërbimet Publike (Kompani & Agjenci)", keywords: "kanalizim, ujë i zi, pusetë, erë, bllokim, shpërthim, rrjedhje, fecale, ujrat e zeza, komuna" },
        { name: "KEDS / KESCO (Ndërprerje e rrymës, Kabllo e rrezikshme, Fatura)", group: "Shërbimet Publike (Kompani & Agjenci)", keywords: "rrymë, dritë, keds, kesco, trafo, kabllo, ndërprerje, faturë, shtyllë, defekt, energji, prishje, rryma, tension" },
        { name: "Komuna - Ndriçimi Publik (Llamba të djegura në rrugë, Errësirë)", group: "Shërbimet Publike (Kompani & Agjenci)", keywords: "dritë, ndriçim, llambë, errësirë, shtyllë, djegur, publik, rrugë, poça, dritat" },
        { name: "Kompania 'Pastrimi' (Vonesa në mbledhjen e bërllokut/mbeturinave)", group: "Shërbimet Publike (Kompani & Agjenci)", keywords: "mbeturina, bërllok, pastrimi, kontejner, kamion, erë, pastrim, mbetje, berrllok" },
        { name: "Komuna - Deponi Ilegale, Ndotje e natyrës, dhe Mjedisi", group: "Shërbimet Publike (Kompani & Agjenci)", keywords: "mbeturina, bërllok, deponi, ilegale, hedhje, natyrë, lumë, pyll, papastërti, mjedis, komuna" },
        // Siguria, Policia dhe Emergjencat
        { name: "Policia e Kosovës / Siguria Publike (Krim, Aksident, Prishje e rendit)", group: "Siguria, Policia dhe Emergjencat", keywords: "polici, krim, vjedhje, aksident, rrahje, siguri, rrezik, patrollë, armë, rendi, qetësia" },
        { name: "Inspekcioni Komunal (Zhurmë në lokale, Tregje, Ndërtime pa leje)", group: "Siguria, Policia dhe Emergjencat", keywords: "inspektor, treg, çmim, zhurmë, orar, market, ushqim, skaduar, muzikë, kafiteri, lokal, ndërtim, pa leje, uzurpim, inspeksioni" },
        { name: "Zjarrfikësit dhe Shpëtimi", group: "Siguria, Policia dhe Emergjencat", keywords: "zjarr, zjarrfikës, tym, djegie, shpëtim, aksident, emergjencë, pyll" },
        // Shërbime tjera Komunale dhe Qendrore
        { name: "Komuna - Qentë endacakë & Kafshët e rrezikshme", group: "Shërbime të Tjera (Lokal dhe Qendror)", keywords: "qen, endacak, kafshë, rrezik, sulm, kafshim, strehimore, mace, rrugë, qent" },
        { name: "Komuna - Transporti Publik (Urbanët, Stacionet, Vonesat)", group: "Shërbime të Tjera (Lokal dhe Qendror)", keywords: "autobus, transport, publik, orar, stacion, urban, biletë, vonesë, cilësi, udhëtar, autobusi" },
        { name: "Komuna - Parqet, Hapësirat e gjelbra, Drunjtë (Mirëmbajtja)", group: "Shërbime të Tjera (Lokal dhe Qendror)", keywords: "ambient, park, dru, prerje, dëmtim, natyrë, gjelbërim, bar, park, pyll, drunj" },
        { name: "Komuna - Qasja për Personat me Aftësi të Kufizuara (Rampa, Barrierat)", group: "Shërbime të Tjera (Lokal dhe Qendror)", keywords: "qasje, PAK, aftësi, kufizuar, karrocë, shkallë, rampë, pengesë, trotuar" },
        // Institucionet Qendrore (Nivel Shtetëror)
        { name: "Ministria e Punëve të Brendshme (Pasaporta, Letërnjoftime, Gjendja Civile)", group: "Shërbime të Tjera (Lokal dhe Qendror)", keywords: "dokumente, pasaportë, letërnjoftim, kufiri, MPB, patentë shofer, vula" },
        { name: "Ministria e Drejtësisë (Gjykatat, Prokuroria, Noteria)", group: "Shërbime të Tjera (Lokal dhe Qendror)", keywords: "gjykatë, prokurori, burg, avokat, drejtësi, ligj, dënim, korrupsion, hak, noter" },
        { name: "Ministria e Industrisë dhe Tregtisë / MINT (Mbrojtja e Konsumatorit)", group: "Shërbime të Tjera (Lokal dhe Qendror)", keywords: "industri, tregti, biznes, inspektorat qendror, çmime, konsumator, fabrikë, naftë, doganë" },
        { name: "Ministria e Financave, Punës dhe Transfereve (ATK, Dogana, Pensionet)", group: "Shërbime të Tjera (Lokal dhe Qendror)", keywords: "financa, para, tatim, atk, dogana, punë, pagë, pension, social, ndihmë, skema sociale" },
        { name: "BESA / KESH (Energjia elektrike, defekt në linja, shpërndarje)", group: "Shërbimet Publike (Kompani & Agjenci)", keywords: "besa, kesh, energji, rrymë, elektrike, defekt, shpërndarje, linja, transformator" },
        { name: "Telecom Kosovo / Vala (Internet, Telefon fiks, TV kabel)", group: "Shërbimet Publike (Kompani & Agjenci)", keywords: "telecom, vala, internet, wifi, fiks, tv, kabel, telefon, signal" },
        { name: "Posta e Kosovës (Dërgesa, Posta e shpejtë, Paket)", group: "Shërbimet Publike (Kompani & Agjenci)", keywords: "posta, dërgesa, paket, shpejtë, post, korrespondencë, dokument" },
        { name: "Komuna - Shërbimet Sociale (Ndihma, Vaksinim, Assistencë)", group: "Shërbimen Qytetare", keywords: "ndihmë, sociale, social, pension, vaksinim, bamirësi, familje" },
        { name: "Agjencia e Pronarëzimit të Kosovës (Akte pronash, Hiri, Noter)", group: "Shërbimen Qytetare", keywords: "pronë, apartament, vula, hiri, noter, titull, pasurie" },
        { name: "Agjencia e Zhvillimit të Biznesit (Regjistrimi, Leje tregti)", group: "Shërbimen Qytetare", keywords: "biznes, regjistrim, tregti, leje, kompani, nipt" },
        { name: "Agjencia e Mbrotjes së Konsumatorit (Çmime, Skauda)", group: "Shërbimen Qytetare", keywords: "konsumator, çmim, skauda, mbrojtje, super, bazar, kualitet" },
        { name: "Agjencia Meteorologjake e Kosovës (Parashikimet e motit, Stuhie)", group: "Mjedsi dhe Natyrë", keywords: "meteo, mot, stuhie, reshje, borë, parashikim, klima" },
        { name: "Komuna - Hapësira e lira për Aktivitete të jashtme", group: "Komuna - Rekreatim", keywords: "park, lirë, aktivitet, jashtme, rekreatim, sport, grimotë" }
    ];
    const combinedCategories = [...defaultCategories];
    categories.forEach(storeCat => {
        if (!combinedCategories.find(c => c.name === storeCat.name)) {
            combinedCategories.push({ name: storeCat.name, group: storeCat.group || 'Të tjera', keywords: '' });
        }
    });
    const allCategories = combinedCategories;
    const groups = Array.from(new Set(allCategories.map(c => c.group || 'Të tjera')));
    const [urgency, setUrgency] = useState('Mesatare');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isAd, setIsAd] = useState(false);
    const [adLink, setAdLink] = useState('');
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const userMunicipality = useStore(state => state.userMunicipality);
    const [municipality, setMunicipality] = useState(userMunicipality === 'Të gjitha Komunat' ? '' : (userMunicipality || ''));
    const preventSearch = React.useRef(false);
    const [address, setAddress] = useState('');
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [isSearchingAddress, setIsSearchingAddress] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [coordinates, setCoordinates] = useState([42.6629, 21.1655]);
    useEffect(() => {
        // A report is intentionally session-only until it is submitted.
        localStorage.removeItem('reportDraft');
    }, []);
    useEffect(() => {
        if (preventSearch.current) {
            preventSearch.current = false;
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            if (address.length > 3) {
                setIsSearchingAddress(true);
                try {
                    // Add 'Kosovo' if not already present to guide Nominatim, but keep user query flexible
                    const searchQuery = address.toLowerCase().includes('kosov') ? address : `${address}, Kosovo`;
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(searchQuery)}&limit=5`);
                    const data = await res.json();
                    setAddressSuggestions(data);
                }
                catch (e) {
                    console.error('Search error', e);
                }
                finally {
                    setIsSearchingAddress(false);
                }
            }
            else {
                setAddressSuggestions([]);
            }
        }, 800);
        return () => clearTimeout(delayDebounceFn);
    }, [address]);
    const selectSuggestion = (sug) => {
        const newAddress = sug.display_name;
        const lat = parseFloat(sug.lat);
        const lon = parseFloat(sug.lon);
        preventSearch.current = true;
        setCoordinates([lat, lon]);
        setAddress(newAddress);
        // Attempt to extract municipality from OpenStreetMap address
        if (sug.address) {
            const city = sug.address.city || sug.address.town || sug.address.village || sug.address.municipality;
            if (city) {
                const upperCity = city.toUpperCase();
                const match = KOSOVO_MUNICIPALITIES.find(m => m.toUpperCase() === upperCity || upperCity.includes(m.toUpperCase()));
                if (match)
                    setMunicipality(match);
            }
        }
        // Only set suggestions empty after state updates, to avoid re-triggering search immediately
        setTimeout(() => {
            setAddressSuggestions([]);
        }, 100);
    };
    useEffect(() => {
        // Removed automatic geolocation on mount so browser doesn't prompt immediately
        // Users will click the GPS button to allow location
    }, []);
    const [mediaItems, setMediaItems] = useState([]);
    const analyzeWithAI = async () => {
        if (mediaItems.length === 0) {
            toast.error(dt("Ju lutem ngarkoni të paktën një foto për t'u analizuar nga AI."));
            return;
        }
        const imageFile = mediaItems[0].file;
        setIsAnalyzing(true);
        try {
            // Convert file to base64
            const reader = new FileReader();
            reader.readAsDataURL(imageFile);
            const base64Promise = new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
            const base64DataUrl = await base64Promise;
            const parts = base64DataUrl.split(';');
            const mimeType = parts[0].split(':')[1];
            const imageBase64 = parts[1].split(',')[1];
            const res = await fetch('/api/analyze-issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64,
                    mimeType,
                    lat: coordinates[0],
                    lng: coordinates[1],
                    descriptionText: description
                })
            });
            if (!res.ok) {
                throw new Error("Dështoi analiza AI");
            }
            const data = await res.json();
            if (data && (data.category || data.title)) {
                if (data.title)
                    setTitle(data.title);
                if (data.description)
                    setDescription(data.description);
                if (data.category)
                    setCategory(data.category);
                if (data.urgency)
                    setUrgency(data.urgency);
                setAiInsights(data);
            }
            else {
                toast.error("Nuk arritëm të gjejmë kategorinë e duhur për këtë problem.");
            }
        }
        catch (e) {
            console.error(e);
            toast.error("Pati një gabim gjatë procesimit me AI. Ju lutem provoni përsëri ose zgjidhni kategorinë manualisht.");
        }
        finally {
            setIsAnalyzing(false);
        }
    };
    const handleImageUpload = (e) => {
        const files = e.target.files;
        if (files) {
            Array.from(files).forEach((file) => {
                // Matches the deployed Storage rules for reports/, which cap every
                // object at 10 MB. Accepting more here only produced a failed upload.
                if (file.size > MAX_UPLOAD_BYTES.reports) {
                    toast.error(dt(`Fajlli "${file.name}" është ${(file.size / 1024 / 1024).toFixed(1)}MB. Kufiri për çdo foto ose video është ${formatBytes(MAX_UPLOAD_BYTES.reports)}.`));
                    return;
                }
                const url = URL.createObjectURL(file);
                const type = (file.type.startsWith('video') ? 'video' : 'image');
                setMediaItems(prev => [...prev, { file, url, type }].slice(0, 12));
                setMediaError(false);
            });
        }
    };
    const removeMedia = (index) => {
        setMediaItems(prev => prev.filter((_, i) => i !== index));
    };
    const [errors, setErrors] = useState({});
    const validateForm = () => {
        const newErrors = {};
        const titleErr = validations.isRequired(title, 'Emërtimi i Çështjes') || validations.minLength(title, 5, 'Emërtimi i Çështjes');
        if (titleErr)
            newErrors.title = titleErr;
        const descErr = validations.isRequired(description, 'Raporti i Detajuar') || validations.minLength(description, 20, 'Raporti i Detajuar');
        if (descErr)
            newErrors.description = descErr;
        const catErr = validations.isRequired(category, 'Sektori / Ministria');
        if (catErr)
            newErrors.category = catErr;
        const munErr = validations.isRequired(municipality, 'Komuna');
        if (munErr)
            newErrors.municipality = munErr;
        if ((!currentUser || currentUser?.role === 'guest') && !isAnonymous) {
            const nameErr = validations.isRequired(guestName, 'Emri dhe Mbiemri') || validations.minLength(guestName, 3, 'Emri dhe Mbiemri');
            if (nameErr)
                newErrors.guestName = nameErr;
            const phoneErr = validations.isRequired(guestPhone, 'Telefoni') || validations.isPhone(guestPhone);
            if (phoneErr)
                newErrors.guestPhone = phoneErr;
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm())
            return;
        setIsSubmitting(true);
        const timeSpentMs = Date.now() - startTime.current;
        try {
            // 0. Firestore requires `authorId == request.auth.uid`, so a report can
            //    only be stored together with a real identity. Guarantee one up front
            //    instead of showing a Track ID for a report that was never persisted.
            const authorUid = await ensureReportSession();
            if (!authorUid) {
                toast.error('Për të ruajtur raportin nevojitet një sesion aktiv. Kyçuni ose vazhdoni si mysafir (Guest) dhe provoni përsëri — të dhënat e formës ruhen.', { duration: 10000 });
                setIsSubmitting(false);
                return;
            }
            // The report id is generated up front so media lands under
            // reports/{uid}/{reportId}/... which the Storage rules accept.
            const reportRef = doc(collection(db, 'reports'));
            const trackingId = createTrackingId('ZQ', reportRef.id);
            // Check if Forensics found an issue during AI Analyze step earlier
            if (aiInsights && aiInsights.authenticityScore < 40) {
                toast.error(dt(`Sistemi Forenzik AI bllokoi raportin: ${aiInsights.forensicsReport}`));
                setIsSubmitting(false);
                return;
            }
            // 2. Anti-Spam / Duplication Geofencing & AI Duplicate Text Merger
            const getDistanceInM = (lat1, lon1, lat2, lon2) => {
                const R = 6371;
                const dLat = (lat2 - lat1) * (Math.PI / 180);
                const dLon = (lon2 - lon1) * (Math.PI / 180);
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return R * c * 1000;
            };
            // Find active reports in a 50m radius to send to AI
            const nearbyReports = reports.filter(r => r.status !== 'Resolved' && r.status !== 'Rejected' && r.location?.lat && r.location?.lng &&
                getDistanceInM(coordinates[0], coordinates[1], r.location.lat, r.location.lng) <= 50);
            if (nearbyReports.length > 0) {
                try {
                    const dupRes = await fetch('/api/detect-duplicate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            newReport: { title, description, imageUrl: mediaItems[0]?.url },
                            existingReports: nearbyReports
                        })
                    });
                    const dupData = await dupRes.json();
                    if (dupData.is_duplicate && dupData.duplicate_of_id) {
                        upvoteReport(dupData.duplicate_of_id);
                        setIsSubmitting(false);
                        navigate(`/detailed-registry?report=${dupData.duplicate_of_id}`);
                        toast.success(dt(`AI Shkrirje: Raportimi juaj u regjistrua si Votë Mbështetëse!`), { duration: 6000 });
                        return;
                    }
                }
                catch (e) {
                    console.error("Gabim në AI merger", e);
                }
            }
            // Simulate AI Moderation for Text
            const { validateReportByAI } = await import('../lib/moderation');
            const aiCheck = await validateReportByAI(title, description);
            if (!aiCheck.valid) {
                toast.error(aiCheck.error);
                setIsSubmitting(false);
                return;
            }
            const reportData = {
                title,
                description,
                category: category || 'Të tjera',
                urgency,
                status: 'Pending Review',
                location: { lat: coordinates[0], lng: coordinates[1], address: address || 'Nuk ka adresë', municipality: municipality || 'Prishtinë' },
                images: [],
                media: [],
                authorId: authorUid,
                authorName: isAnonymous ? 'Qytetar Anonim' : (currentUser?.name || guestName || 'Anonim'),
                isAnonymous,
                createdAt: new Date().toISOString(),
                ...(aiInsights ? {
                    aiCategoryScore: aiInsights.authenticityScore,
                    aiRoutingReason: aiInsights.routingReason,
                    aiForensicsReport: aiInsights.forensicsReport
                } : {})
            };
            const accountability = getAccountabilityProfile(reportData.category);
            reportData.responsibleInstitution = accountability.institution;
            reportData.responsibleLevel = accountability.level;
            reportData.responsibleOffice = accountability.office;
            reportData.responseDueAt = getAccountabilityDueDate(reportData.createdAt, accountability.responseHours);
            reportData.accountabilityStatus = 'Në pritje';
            if (currentUser?.email === 'reklama@admin.com' && isAd) {
                reportData.isAd = true;
                reportData.adLink = adLink;
            }
            reportData.id = reportRef.id;
            reportData.trackingId = trackingId;
            if (!currentUser || currentUser.role === 'guest') {
                saveGuestReportHistory({
                    id: reportRef.id,
                    trackingId,
                    title: title || 'Raportim i ri',
                    description,
                    category: category || 'Të tjera',
                    status: 'Pending Review',
                    municipality: municipality || 'Prishtinë',
                    createdAt: reportData.createdAt
                });
            }
            setSubmittedReportId(trackingId);
            setStep(3);
            const uploadResults = await Promise.allSettled(mediaItems.map(async (media) => {
                const downloadUrl = await uploadFileToStorage(media.file, 'reports', {
                    userId: authorUid,
                    scope: reportRef.id,
                });
                return { url: downloadUrl, type: media.type };
            }));
            const uploadedMedia = uploadResults.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
            const failedUploads = uploadResults.filter(result => result.status === 'rejected');
            if (failedUploads.length > 0) {
                const firstReason = failedUploads[0].reason;
                const reasonText = firstReason instanceof Error ? firstReason.message : 'Gabim i panjohur gjatë ngarkimit.';
                toast.error(`${failedUploads.length} nga ${mediaItems.length} dëshmi nuk u ngarkuan dhe raporti do të ruhet pa to. Arsyeja: ${reasonText}`, { duration: 8000 });
            }
            reportData.images = uploadedMedia.filter(m => m.type === 'image').map(m => m.url);
            reportData.media = uploadedMedia;
            try {
                await setDoc(reportRef, {
                    ...reportData,
                    createdAt: serverTimestamp() // native firebase timestamp
                });
            }
            catch (e) {
                const appError = handleFirebaseError(e);
                console.warn('Firestore save failed; kept report in local session fallback.', appError.technicalMessage);
                const localReport = {
                    ...reportData,
                    id: reportData.id || `rep_${Date.now()}`,
                    trackingId: trackingId,
                    createdAt: new Date().toISOString(),
                    status: 'Pending Review',
                    timeline: [{ id: `tl-${Date.now()}`, status: 'Pending Review', date: new Date().toISOString(), updatedBy: 'Sistemi' }]
                };
                addReport(localReport);
                setSubmittedReportId(localReport.trackingId || localReport.id);
                localStorage.removeItem('reportDraft');
                setStep(3);
                toast.success('Raporti u ruajt me sukses në sesionin lokal dhe Track ID është gati për ndjekje.', { duration: 7000 });
                return;
            }
            addReport({
                ...reportData,
                id: reportData.id || `rep_${Date.now()}`
            });
            setSubmittedReportId(reportData.trackingId || reportData.id);
            if (currentUser) {
                addPoints(10);
            }
            localStorage.removeItem('reportDraft');
            setStep(3); // Success step
        }
        catch (err) {
            const appError = handleFirebaseError(err);
            console.error('Submission error:', appError.technicalMessage);
            toast.error(appError.message || 'Ka ndodhur një gabim gjatë procesimit të të dhënave, provoni përsëri.');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsx(_Fragment, { children: _jsxs(motion.div, { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }, className: "max-w-4xl mx-auto pt-6 pb-32 md:py-12 px-4 sm:px-6 lg:px-8", children: [step < 3 && (_jsxs("div", { className: "flex items-center justify-center gap-4 mb-8 md:mb-16 w-full max-w-xs md:max-w-md mx-auto", children: [_jsx("div", { className: `flex items-center justify-center w-8 h-8 md:w-10 md:h-10 border-2 font-bold text-xs md:text-sm title-serif ${step === 1 ? 'bg-slate-900 dark:bg-slate-800 text-white dark:text-white border-slate-900 dark:border-white' : 'bg-transparent text-[var(--color-text)] dark:text-white border-slate-900 dark:border-white'}`, children: "1" }), _jsx("div", { className: "h-0.5 flex-1 bg-neutral-300", children: _jsx("div", { className: `h-full bg-indigo-600 transition-all ${step > 1 ? 'w-full' : 'w-0'}` }) }), _jsx("div", { className: `flex items-center justify-center w-8 h-8 md:w-10 md:h-10 border-2 font-bold text-xs md:text-sm title-serif transition-colors ${step === 2 ? 'bg-slate-900 dark:bg-slate-800 text-white dark:text-white border-slate-900 dark:border-white' : 'bg-transparent text-neutral-500 dark:text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] border-neutral-300 dark:border-slate-700'}`, children: "2" })] })), step === 1 && (_jsxs("div", { className: "bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-2xl p-5 sm:p-10 md:p-16 shadow-sm dark:shadow-none transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 relative", children: [_jsx("div", { className: "absolute top-0 right-0 bg-indigo-600 text-white px-3 md:px-4 py-1 text-xs md:text-xs font-bold tracking-wide border-b-4 border-l-4 border-slate-900 dark:border-slate-700 rounded-bl-xl rounded-tr-xl", children: dt(`Nr: 01`) }), _jsxs("div", { className: "mb-8 md:mb-12", children: [_jsxs("h1", { className: "text-3xl sm:text-5xl md:text-6xl font-bold text-[var(--color-text)] dark:text-white tracking-tight mb-4 title-serif uppercase leading-[0.9]", children: [dt(`Hap`), _jsx("br", { className: "sm:hidden" }), dt(`Procedurën`), _jsx("span", { className: "text-indigo-600", children: "." })] }), _jsx("p", { className: "text-slate-700 dark:text-slate-200 dark:text-[var(--color-text-muted)] max-w-sm md:max-w-md font-serif italic text-sm md:text-lg", children: dt(`Paraqit një çështje që ndikon drejtpërdrejt në shoqëri ose proceset e lëvizjes.`) })] }), _jsxs("div", { className: "space-y-6 md:space-y-8", children: [_jsxs("div", { children: [_jsxs("div", { className: "border-2 border-dashed border-slate-300 dark:border-white/20 p-4 md:p-8 flex flex-col items-center justify-center bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900/50 hover:bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:hover:bg-slate-800/50 dark:bg-slate-800 dark:hover:bg-slate-800 transition-colors relative h-40 sm:h-56 md:h-72 group cursor-pointer overflow-hidden mb-4 rounded-2xl", children: [_jsx("div", { className: "w-12 h-12 md:w-20 md:h-20 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-2xl flex items-center justify-center mb-3 md:mb-6 group-hover:-translate-y-2 transition-transform", children: _jsx(Camera, { className: "w-6 h-6 md:w-8 md:h-8 text-blue-900" }) }), _jsx("span", { className: "text-xs md:text-lg font-bold text-[var(--color-text)] dark:text-white mb-1 uppercase tracking-wide title-serif text-center", children: dt(`Ngarko Dëshminë (Foto/Video)`) }), _jsx("span", { className: "text-[10px] md:text-xs font-mono text-slate-700 dark:text-slate-200 dark:text-[var(--color-text-muted)] max-w-[220px] md:max-w-[320px] text-center uppercase", children: dt(`JPG, PNG, MP4 · deri në 12 foto/video · 25MB foto / 150MB video`) }), _jsx("input", { type: "file", multiple: true, accept: "image/*,video/*", onChange: handleImageUpload, className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer" })] }), mediaItems.length > 0 && (_jsx("div", { className: "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-6", children: mediaItems.map((media, idx) => (_jsxs("div", { className: "relative aspect-square rounded-xl overflow-hidden group border border-slate-200/60 dark:border-white/10", children: [media.type === 'image' ? (_jsx("img", { src: media.url, alt: "Preview", className: "w-full h-full object-cover mix-blend-luminosity group-hover:mix-blend-normal transition-all" })) : (_jsx("video", { src: media.url, className: "w-full h-full object-cover mix-blend-luminosity group-hover:mix-blend-normal transition-all", muted: true, playsInline: true })), _jsx("div", { className: "absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all", children: _jsx("button", { type: "button", onClick: () => removeMedia(idx), className: "text-white text-xs font-bold uppercase border-b-2 border-indigo-600 pb-0.5 hover:text-rose-400", children: t('remove') }) })] }, idx))) })), mediaItems.length > 0 && (_jsxs("div", { className: "bg-blue-900 border-l-4 border-red-500 rounded-l-xl p-3 md:p-5 flex gap-3 text-white items-start", children: [_jsx(Sparkles, { className: "w-4 h-4 md:w-5 md:h-5 flex-shrink-0 text-[#C5A059]" }), _jsx("p", { className: "text-xs md:text-xs font-bold tracking-wide leading-relaxed", children: t('report_ai_analysis_msg') })] }))] }), mediaError && (_jsxs("div", { className: "bg-rose-50 border-l-4 border-indigo-600 p-4 mb-6 rounded-r-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300", children: [_jsx(AlertCircle, { className: "w-5 h-5 text-indigo-600 shrink-0 mt-0.5" }), _jsx("p", { className: "text-rose-700 text-xs md:text-sm font-bold", children: t('report_error_media') })] })), _jsxs("button", { onClick: () => {
                                        if (mediaItems.length === 0) {
                                            setMediaError(true);
                                            setTimeout(() => setMediaError(false), 5000);
                                            return;
                                        }
                                        setStep(2);
                                    }, className: "w-full flex items-center justify-center gap-3 p-4 md:p-5 font-bold transition-all tracking-wide text-sm md:text-sm border rounded-xl active:scale-[0.99] mb-8 bg-slate-900 hover:bg-indigo-600 text-white border-slate-200/60 dark:border-white/10 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] hover:shadow-indigo-500/10", children: [dt(`Vazhdo te hapi tjetër (Konfirmo Lokacionin)`), " ", _jsx(ChevronRight, { className: "w-4 h-4 animate-pulse text-rose-500" })] }), _jsxs("div", { className: "bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-6 md:p-8 hover:border-slate-950 transition-colors duration-300", children: [_jsxs("div", { className: "flex items-start gap-3 mb-6 border-b border-slate-200/60 dark:border-white/10 pb-4", children: [_jsx("div", { className: "w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shadow-indigo-600/20 shrink-0", children: "?" }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-[var(--color-text)] dark:text-white text-sm md:text-base uppercase tracking-wider", children: dt(`Nuk dini si të raportoni? Ndihmë e Shpejtë`) }), _jsx("p", { className: "text-xs text-neutral-500 dark:text-[var(--color-text-muted)]", children: dt(`Mësoni si të dërgoni një raportim të saktë dhe me impakt në komunitet vetëm me 3 hapa të thjeshtë.`) })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("div", { className: "bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-800 p-5 border border-slate-200/60 dark:border-white/10 rounded-xl flex flex-col justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-shadow", children: [_jsxs("div", { children: [_jsx("div", { className: "w-7 h-7 rounded-full bg-slate-900 text-rose-500 flex items-center justify-center font-bold text-xs mb-3 shadow-sm dark:shadow-none", children: "1" }), _jsxs("h4", { className: "font-bold text-[var(--color-text)] dark:text-white text-xs uppercase tracking-wide mb-1.5 flex items-center gap-1.5", children: [_jsx("span", { className: "w-1.5 h-1.5 bg-indigo-600 rounded-full" }), dt(`Ngarko Dëshminë`)] }), _jsx("p", { className: "text-xs text-neutral-600 dark:text-[var(--color-text-muted)] leading-relaxed font-semibold", children: dt(`Bëni një foto ose video të problemit (gropë në rrugë, ndotje mjedisore, shtyllë e dëmtuar) dhe ngarkojeni te kutia më lart.`) })] }), _jsx("p", { className: "text-[10px] text-indigo-600 font-bold mt-3 border-t border-slate-100 dark:border-white/5 pt-2 uppercase tracking-wider", children: dt(`Foto duhet të jetë e qartë`) })] }), _jsxs("div", { className: "bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-800 p-5 border border-slate-200/60 dark:border-white/10 rounded-xl flex flex-col justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-shadow", children: [_jsxs("div", { children: [_jsx("div", { className: "w-7 h-7 rounded-full bg-slate-900 text-rose-500 flex items-center justify-center font-bold text-xs mb-3 shadow-sm dark:shadow-none", children: "2" }), _jsxs("h4", { className: "font-bold text-[var(--color-text)] dark:text-white text-xs uppercase tracking-wide mb-1.5 flex items-center gap-1.5", children: [_jsx("span", { className: "w-1.5 h-1.5 bg-indigo-600 rounded-full" }), dt(`Vendodhja`)] }), _jsxs("p", { className: "text-xs text-neutral-600 dark:text-[var(--color-text-muted)] leading-relaxed font-semibold", children: [dt(`Sistemi do të gjejë GPS tuaj automatikisht, ose mund të klikoni`), " ", _jsx("strong", { children: dt(`direkt mbi hartë`) }), dt(`për të vendosur pikën e saktë ku ndodhet problemi.`)] })] }), _jsx("p", { className: "text-[10px] text-indigo-600 font-bold mt-3 border-t border-slate-100 dark:border-white/5 pt-2 uppercase tracking-wider", children: dt(`Kliko mbi Hartë për saktësi`) })] }), _jsxs("div", { className: "bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-800 p-5 border border-slate-200/60 dark:border-white/10 rounded-xl flex flex-col justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-shadow", children: [_jsxs("div", { children: [_jsx("div", { className: "w-7 h-7 rounded-full bg-slate-900 text-rose-500 flex items-center justify-center font-bold text-xs mb-3 shadow-sm dark:shadow-none", children: "3" }), _jsxs("h4", { className: "font-bold text-[var(--color-text)] dark:text-white text-xs uppercase tracking-wide mb-1.5 flex items-center gap-1.5", children: [_jsx("span", { className: "w-1.5 h-1.5 bg-indigo-600 rounded-full" }), dt(`Detajet & AI`)] }), _jsxs("p", { className: "text-xs text-neutral-600 dark:text-[var(--color-text-muted)] leading-relaxed font-semibold", children: [dt(`Kliko`), " ", _jsx("strong", { children: dt(`"Krijim me AI"`) }), dt(`që inteligjenca jonë të lexojë foton dhe të shkruajë automatikisht titullin/kategorinë. Më pas kliko dërgo.`)] })] }), _jsx("p", { className: "text-[10px] text-indigo-600 font-bold mt-3 border-t border-slate-100 dark:border-white/5 pt-2 uppercase tracking-wider", children: dt(`E lehtë dhe automatike`) })] })] }), _jsxs("div", { className: "mt-6 bg-slate-900 border-l-4 border-indigo-600 p-4 flex gap-3 text-white items-start rounded-r-xl", children: [_jsx(AlertCircle, { className: "w-4 h-4 text-rose-500 shrink-0 mt-0.5" }), _jsxs("div", { className: "text-xs font-bold leading-relaxed space-y-1", children: [_jsx("span", { className: "text-[10px] text-rose-500 uppercase tracking-widest block font-extrabold", children: dt(`Shënim për Sigurinë`) }), _jsx("p", { className: "text-slate-200 font-medium font-sans", children: dt(`ZëriYT është portal nga komuniteti, për komunitetin. Të gjitha të dhënat janë të sigurta dhe mund të zgjidhni të mbeteni anonim gjatë postimeve tuaja.`) })] })] })] })] })] })), step === 2 && !isSubmitting && (_jsxs("form", { onSubmit: handleSubmit, className: "bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-2xl p-5 sm:p-10 md:p-16 shadow-sm dark:shadow-none transition-all duration-300 animate-in fade-in slide-in-from-right-8 duration-500 relative", children: [_jsx("div", { className: "absolute top-0 right-0 bg-indigo-600 text-white px-3 md:px-4 py-1 text-xs md:text-xs font-bold tracking-wide border-b-4 border-l-4 border-slate-900 dark:border-slate-700 rounded-bl-xl rounded-tr-xl", children: dt(`Nr: 02`) }), _jsxs("div", { className: "mb-8 md:mb-12 flex flex-col md:flex-row items-start md:items-end justify-between gap-6 border-b-2 border-slate-900 pb-6 md:pb-8", children: [_jsxs("div", { className: "w-full", children: [_jsxs("button", { type: "button", onClick: () => setStep(1), className: "text-slate-700 dark:text-slate-200 dark:text-[var(--color-text-muted)] hover:text-indigo-600 flex items-center gap-2 text-xs md:text-xs font-bold tracking-wide mb-4 md:mb-6 transition-colors", children: [_jsx(ArrowLeft, { className: "w-4 h-4" }), dt(`Kthehu prapa`)] }), _jsxs("h1", { className: "text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--color-text)] dark:text-white tracking-tight mb-2 title-serif uppercase leading-none", children: [dt(`Specifikat e`), _jsx("br", { className: "hidden md:block" }), dt(`Rastit`), _jsx("span", { className: "text-indigo-600", children: "." })] })] }), _jsxs("button", { type: "button", onClick: analyzeWithAI, className: "flex items-center justify-center gap-2 text-xs md:text-xs uppercase font-bold tracking-widest bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 hover:bg-neutral-200 text-[var(--color-text)] dark:text-white px-4 md:px-5 py-2.5 md:py-3 border border-slate-200/60 dark:border-white/10 rounded-xl transition-colors whitespace-nowrap group w-full md:w-auto", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5 md:w-4 md:h-4 group-hover:text-indigo-600" }), " ", isAnalyzing ? 'Po përpunohet...' : 'Krijim me AI'] })] }), _jsxs("div", { className: "space-y-6 md:space-y-8", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide mb-2 md:mb-3 border-l-2 border-indigo-600 pl-3", children: dt(`Emërtimi i Çështjes`) }), _jsx("input", { required: true, type: "text", value: title, onChange: (e) => { setTitle(e.target.value); if (errors.title)
                                                setErrors({ ...errors, title: '' }); }, placeholder: dt(`Psh. Shkatërrimi i infrastrukturës urbane...`), className: cn("w-full px-4 md:px-5 py-3 md:py-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border outline-none transition-colors font-bold text-[var(--color-text)] dark:text-white placeholder:font-medium placeholder:text-neutral-500 dark:text-[var(--color-text-muted)] text-sm md:text-base", errors.title ? "border-indigo-600 focus:border-indigo-600" : "border-neutral-300 focus:border-slate-900") }), errors.title && _jsxs("p", { className: "text-indigo-600 text-[10px] sm:text-xs font-bold mt-1.5 flex items-center gap-1", children: [_jsx(AlertCircle, { className: "w-3 h-3" }), " ", errors.title] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide mb-2 md:mb-3 border-l-2 border-indigo-600 pl-3", children: dt(`Raporti i Detajuar`) }), _jsx("textarea", { required: true, value: description, onChange: (e) => { setDescription(e.target.value); if (errors.description)
                                                setErrors({ ...errors, description: '' }); }, rows: 5, className: cn("w-full px-4 md:px-5 py-3 md:py-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border outline-none transition-colors resize-none font-medium text-[var(--color-text)] dark:text-white placeholder:font-normal placeholder:text-neutral-500 dark:text-[var(--color-text-muted)] font-serif italic text-sm md:text-base", errors.description ? "border-indigo-600 focus:border-indigo-600" : "border-neutral-300 focus:border-slate-900"), placeholder: dt(`Paraqisni me detaje natyrën e problemit...`) }), errors.description && _jsxs("p", { className: "text-indigo-600 text-[10px] sm:text-xs font-bold mt-1.5 flex items-center gap-1", children: [_jsx(AlertCircle, { className: "w-3 h-3" }), " ", errors.description] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 p-4 md:p-8 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900/50 border border-slate-200/60 dark:border-white/10 rounded-xl", children: [_jsxs("div", { className: "relative", ref: categoryDropdownRef, children: [_jsxs("label", { className: "flex items-center gap-2 text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide mb-2 border-l-2 border-indigo-600 pl-3", children: [dt(`Sektori / Ministria (Kërko Problemin)`), isAnalyzing && _jsxs("span", { className: "flex h-2 w-2 relative ml-2", children: [_jsx("span", { className: "animate-ping absolute inline-flex h-full w-full bg-indigo-600 opacity-75" }), _jsx("span", { className: "relative inline-flex h-2 w-2 bg-indigo-600" })] })] }), _jsxs("div", { className: cn("w-full px-4 md:px-5 py-3 md:py-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border outline-none transition-colors font-bold uppercase text-xs md:text-xs tracking-wider cursor-text flex items-center justify-between", isAnalyzing ? "border-indigo-600 text-indigo-600" : (errors.category ? "border-indigo-600 text-[var(--color-text)] dark:text-white" : "border-neutral-300 text-[var(--color-text)] dark:text-white")), onClick: () => setIsCategoryDropdownOpen(true), children: [_jsx("input", { type: "text", value: isCategoryDropdownOpen ? categorySearchTerm : (category ? dt(category) : ''), onChange: (e) => {
                                                                setCategorySearchTerm(e.target.value);
                                                                setIsCategoryDropdownOpen(true);
                                                                if (errors.category)
                                                                    setErrors({ ...errors, category: '' });
                                                            }, placeholder: t('report_step2_category_ph') + " ose kërko problemin (psh. rrugë, mbeturina)...", className: "w-full outline-none bg-transparent placeholder:text-neutral-500 dark:text-[var(--color-text-muted)] placeholder:normal-case placeholder:font-normal" }), _jsx(ChevronRight, { className: cn("w-4 h-4 text-[var(--color-text-muted)] transition-transform", isCategoryDropdownOpen && "rotate-90") })] }), isCategoryDropdownOpen && (_jsxs("div", { className: "absolute z-50 left-0 right-0 top-full mt-1 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/95 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-xl rounded-2xl overflow-hidden max-h-72 overflow-y-auto", children: [groups.map(group => {
                                                            const filteredInGroup = allCategories.filter(c => {
                                                                if ((c.group || 'Të tjera') !== group)
                                                                    return false;
                                                                if (!categorySearchTerm)
                                                                    return true;
                                                                const term = categorySearchTerm.toLowerCase();
                                                                const nameMatch = dt(c.name).toLowerCase().includes(term);
                                                                const keywordMatch = c.keywords && c.keywords.toLowerCase().includes(term);
                                                                return nameMatch || keywordMatch;
                                                            });
                                                            if (filteredInGroup.length === 0)
                                                                return null;
                                                            return (_jsxs("div", { children: [_jsx("div", { className: "bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-800 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest sticky top-0", children: dt(group) }), filteredInGroup.map(c => (_jsxs("button", { type: "button", onClick: () => {
                                                                            setCategory(c.name);
                                                                            setCategorySearchTerm('');
                                                                            setIsCategoryDropdownOpen(false);
                                                                            if (errors.category)
                                                                                setErrors({ ...errors, category: '' });
                                                                        }, className: "w-full text-left px-4 py-3 hover:bg-indigo-600/10 border-b last:border-0 border-slate-100 dark:border-white/5 font-bold text-xs text-slate-700 dark:text-[var(--color-text-muted)] transition-colors", children: [dt(c.name), c.keywords && categorySearchTerm && c.keywords.toLowerCase().includes(categorySearchTerm.toLowerCase()) && !dt(c.name).toLowerCase().includes(categorySearchTerm.toLowerCase()) && (_jsx("span", { className: "block text-[10px] text-neutral-400 font-normal mt-0.5 normal-case", children: dt(`Lidhet me kërkimin tuaj`) }))] }, 'id' in c ? c.id : c.name)))] }, group));
                                                        }), allCategories.filter(c => {
                                                            if (!categorySearchTerm)
                                                                return true;
                                                            const term = categorySearchTerm.toLowerCase();
                                                            return dt(c.name).toLowerCase().includes(term) || (c.keywords && c.keywords.toLowerCase().includes(term));
                                                        }).length === 0 && (_jsx("div", { className: "px-4 py-6 text-center text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] text-sm font-medium", children: dt(`Nuk u gjet asnjë sektor për këtë problem.`) }))] })), errors.category && _jsxs("p", { className: "text-indigo-600 text-[10px] sm:text-xs font-bold mt-1.5 flex items-center gap-1", children: [_jsx(AlertCircle, { className: "w-3 h-3" }), " ", errors.category] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide mb-2 border-l-2 border-indigo-600 pl-3", children: dt(`Niveli i Rrezikshmërisë`) }), _jsxs("select", { value: urgency, onChange: (e) => setUrgency(e.target.value), className: "w-full px-[var(--spacing-4)] py-[var(--spacing-3)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-slate-200 dark:border-white/10 rounded-[var(--radius-button)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-[var(--color-text)]", children: [_jsxs("option", { value: "E ul\u00EBt", children: [dt(`SHKALLA I:`), " ", dt('E ulët').toUpperCase()] }), _jsxs("option", { value: "Mesatare", children: [dt(`SHKALLA II:`), " ", dt('Mesatare').toUpperCase()] }), _jsxs("option", { value: "E lart\u00EB", children: [dt(`SHKALLA III:`), " ", dt('E lartë').toUpperCase()] }), _jsxs("option", { value: "Kritike", children: [dt(`SHKALLA IV:`), " ", dt('Kritike').toUpperCase()] })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide mb-2 md:mb-3 border-l-2 border-indigo-600 pl-3", children: dt(`Zona e Operimit (Komuna)`) }), _jsxs("select", { value: municipality, onChange: e => {
                                                setMunicipality(e.target.value);
                                                if (errors.municipality)
                                                    setErrors({ ...errors, municipality: '' });
                                                if (MUNICIPALITY_COORDINATES[e.target.value]) {
                                                    setCoordinates(MUNICIPALITY_COORDINATES[e.target.value]);
                                                }
                                            }, className: cn("w-full px-4 md:px-5 py-3 md:py-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border outline-none transition-colors font-bold mb-1 appearance-none uppercase text-xs md:text-xs tracking-wider text-[var(--color-text)] dark:text-white", errors.municipality ? "border-indigo-600 focus:border-indigo-600" : "border-neutral-300 focus:border-slate-900"), children: [_jsx("option", { value: "", children: t('map_filter_city') }), KOSOVO_MUNICIPALITIES.map(m => (_jsx("option", { value: m, children: m.toUpperCase() }, m)))] }), errors.municipality && _jsxs("p", { className: "text-indigo-600 text-[10px] sm:text-xs font-bold mb-4 flex items-center gap-1", children: [_jsx(AlertCircle, { className: "w-3 h-3" }), " ", errors.municipality] }), _jsxs("div", { className: "flex justify-between items-center mb-2 md:mb-3 border-l-2 border-indigo-600 pl-3 relative", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide", children: dt(`Koordinatat / Adresa`) }), _jsx("p", { className: "text-[10px] text-indigo-600 mt-1 uppercase tracking-widest font-bold max-w-[200px] md:max-w-none", children: dt(`Kliko tek GPS ose në hartë për të ndarë lokacionin saktësisht!`) })] }), _jsx("button", { type: "button", onClick: () => {
                                                        const isAlerted = localStorage.getItem('gps_alerted');
                                                        if (!isAlerted) {
                                                            toast(dt("Sistemi kërkon qasje në GPS për të gjetur koordinatat tuaja të sakta."), { icon: '📍' });
                                                            localStorage.setItem('gps_alerted', 'true');
                                                        }
                                                        if (navigator.geolocation) {
                                                            setIsLocating(true);
                                                            navigator.geolocation.getCurrentPosition(async (pos) => {
                                                                const lat = pos.coords.latitude;
                                                                const lng = pos.coords.longitude;
                                                                setCoordinates([lat, lng]);
                                                                try {
                                                                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                                                                    const data = await res.json();
                                                                    if (data && data.address) {
                                                                        const city = data.address.city || data.address.town || data.address.village || data.address.municipality;
                                                                        if (city) {
                                                                            const exactCommune = mapToKosovoMunicipality(city);
                                                                            if (exactCommune) {
                                                                                setMunicipality(exactCommune);
                                                                            }
                                                                        }
                                                                        preventSearch.current = true;
                                                                        setAddress(data.display_name);
                                                                    }
                                                                    else {
                                                                        setAddress("Lokacioni juaj GPS (Live)");
                                                                    }
                                                                }
                                                                catch (e) {
                                                                    console.error('Reverse geocode error', e);
                                                                    setAddress("Lokacioni juaj GPS (Live)");
                                                                }
                                                                finally {
                                                                    setIsLocating(false);
                                                                }
                                                            }, (err) => {
                                                                console.log(err);
                                                                setIsLocating(false);
                                                                toast.error("Nuk mund të gjejmë lokacionin. Ju lutem kontrolloni nëse keni lejuar qasjen në GPS (Allow Location) në shfletuesin tuaj.");
                                                            }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
                                                        }
                                                        else {
                                                            toast.error(dt("Shfletuesi juaj nuk suporton GPS."));
                                                        }
                                                    }, className: "px-3 py-1.5 md:py-2 bg-slate-900 text-white rounded-2xl text-xs md:text-sm font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-sm dark:shadow-none active:scale-95 whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed", disabled: isLocating, children: isLocating ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" }), dt(`Duke kërkuar...`)] })) : (_jsxs(_Fragment, { children: [_jsx(MapPin, { className: "w-3.5 h-3.5 md:w-4 md:h-4" }), dt(`Zbulo Lokacionin (Live)`)] })) })] }), _jsxs("p", { className: "text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] mb-2 font-medium", children: [dt(`Këshillë: Nëse jeni në kompjuter (Desktop) lokacioni mund të mos jetë 100% i saktë sepse llogaritet nga interneti. Mund ta`), " ", _jsx("b", { children: dt(`klikoni kudo në hartë`) }), dt(`për të vendosur gjilpërën (pin) saktësisht te vendi ku ndodhet problemi.`)] }), _jsx("div", { className: "h-48 md:h-64 w-full bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-800 border-2 border-neutral-300 rounded-xl mb-4 relative z-0 overflow-hidden", children: _jsx(SafeMapContainer, { children: _jsxs(MapContainer, { center: coordinates, zoom: 13, scrollWheelZoom: true, className: "w-full h-full", zoomControl: true, children: [_jsx(TileLayer, { attribution: '', url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", className: "map-tiles-dark" }), _jsx(LocationMarker, { position: coordinates, setPosition: setCoordinates, setAddress: setAddress, setMunicipality: setMunicipality, preventSearchRef: preventSearch })] }) }) }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: "text", value: address, onChange: e => setAddress(e.target.value), className: "w-full px-[var(--spacing-4)] py-[var(--spacing-3)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-slate-200 dark:border-white/10 rounded-[var(--radius-button)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-[var(--color-text)]", placeholder: dt(`Identifikoni lokacionin me saktësi...`) }), isSearchingAddress && (_jsx("div", { className: "absolute right-4 top-1/2 -translate-y-1/2", children: _jsx("div", { className: "w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" }) })), addressSuggestions.length > 0 && (_jsx("div", { className: "absolute z-50 left-0 right-0 top-full mt-1 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/95 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-xl rounded-2xl overflow-hidden text-sm font-medium", children: addressSuggestions.map((sug, i) => (_jsxs("button", { type: "button", onClick: () => selectSuggestion(sug), className: "w-full text-left px-4 py-3 hover:bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border-b last:border-0 border-slate-100 dark:border-white/5 flex items-start gap-2", children: [_jsx(MapPin, { className: "w-4 h-4 text-[var(--color-text-muted)] mt-0.5 shrink-0" }), _jsx("span", { className: "text-slate-700 dark:text-[var(--color-text-muted)]", children: sug.display_name })] }, i))) }))] })] }), _jsxs("div", { className: "flex flex-col gap-4 pt-6 md:pt-8 border-t-2 border-slate-900 mt-8 md:mt-10", children: [(!currentUser || currentUser?.role === 'guest') && !isAnonymous && (_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 p-6 md:p-8 border border-slate-200/60 dark:border-white/10 rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900/50 relative mt-4", children: [_jsx("div", { className: "absolute -top-4 left-4 md:left-6 px-3 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide py-1", children: dt(`Identifikimi Subjektit`) }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide mb-2 border-l-2 border-indigo-600 pl-2", children: dt(`Emri dhe Mbiemri`) }), _jsx("input", { required: true, type: "text", value: guestName, onChange: (e) => { setGuestName(e.target.value); if (errors.guestName)
                                                                setErrors({ ...errors, guestName: '' }); }, placeholder: "...", className: cn("w-full px-4 md:px-5 py-2.5 md:py-3 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border outline-none transition-colors font-bold text-[var(--color-text)] dark:text-white text-sm", errors.guestName ? "border-indigo-600 focus:border-indigo-600" : "border-neutral-300 focus:border-slate-900") }), errors.guestName && _jsxs("p", { className: "text-indigo-600 text-[10px] sm:text-xs font-bold mt-1.5 flex items-center gap-1", children: [_jsx(AlertCircle, { className: "w-3 h-3" }), " ", errors.guestName] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide mb-2 border-l-2 border-indigo-600 pl-2", children: dt(`Kontakti`) }), _jsx("input", { required: true, type: "tel", value: guestPhone, onChange: (e) => { setGuestPhone(e.target.value); if (errors.guestPhone)
                                                                setErrors({ ...errors, guestPhone: '' }); }, placeholder: "+383...", className: cn("w-full px-4 md:px-5 py-2.5 md:py-3 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border outline-none transition-colors font-bold text-[var(--color-text)] dark:text-white text-sm", errors.guestPhone ? "border-indigo-600 focus:border-indigo-600" : "border-neutral-300 focus:border-slate-900") }), errors.guestPhone && _jsxs("p", { className: "text-indigo-600 text-[10px] sm:text-xs font-bold mt-1.5 flex items-center gap-1", children: [_jsx(AlertCircle, { className: "w-3 h-3" }), " ", errors.guestPhone] })] })] })), _jsxs("label", { className: "flex items-center gap-4 cursor-pointer select-none bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900/50 p-4 md:p-5 border-2 border-slate-200/60 dark:border-white/10 hover:border-slate-900 transition-colors mt-2 md:mt-4", children: [_jsx("input", { type: "checkbox", checked: isAnonymous, onChange: e => setIsAnonymous(e.target.checked), className: "w-5 h-5 md:w-6 md:h-6 border border-slate-200/60 dark:border-white/10 rounded-xl text-[var(--color-text)] dark:text-white focus:ring-slate-900 transition-all rounded-xl" }), _jsx("span", { className: "text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide", children: dt(`Kërkoj statusin anonim në proces`) })] }), currentUser?.email === 'reklama@admin.com' && (_jsxs("div", { className: "mt-2 md:mt-4 space-y-2", children: [_jsxs("label", { className: "flex items-center gap-4 cursor-pointer select-none bg-indigo-600/5 p-4 md:p-5 border-2 border-indigo-600/20 hover:border-indigo-600 transition-colors", children: [_jsx("input", { type: "checkbox", checked: isAd, onChange: e => setIsAd(e.target.checked), className: "w-5 h-5 md:w-6 md:h-6 border border-indigo-600/20 rounded-xl text-blue-600 focus:ring-blue-600 transition-all rounded-xl" }), _jsx("span", { className: "text-xs md:text-xs font-bold text-blue-900 tracking-wide uppercase", children: dt(`Posto si Reklamë (Sponsorizuar)`) })] }), isAd && (_jsx("input", { type: "url", value: adLink, onChange: e => setAdLink(e.target.value), placeholder: dt(`Linku i reklamës (opsional) - https://...`), className: "w-full px-[var(--spacing-4)] py-[var(--spacing-3)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-slate-200 dark:border-white/10 rounded-[var(--radius-button)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-[var(--color-text)]" }))] }))] }), _jsx("div", { className: "pt-6 md:pt-8", children: _jsx("button", { type: "submit", disabled: isSubmitting, className: "w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-slate-900 text-white p-4 md:p-6 font-bold transition-colors tracking-wide text-xs md:text-sm border-2 border-transparent hover:border-slate-900 disabled:opacity-70 disabled:cursor-not-allowed", children: isSubmitting ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-4 h-4 md:w-5 md:h-5 animate-spin" }), dt(`PROCESIMI...`)] })) : ('PROTOKOLLO DHE PËRCELLO') }) })] })] })), step === 2 && isSubmitting && (_jsxs("div", { className: "bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-[28px] p-8 md:p-16 text-center animate-in zoom-in-95 duration-500 max-w-2xl mx-auto relative overflow-hidden flex flex-col items-center justify-center min-h-[420px]", children: [_jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_bottom,_rgba(244,63,94,0.12),transparent_40%)]" }), _jsxs("div", { className: "relative z-10", children: [_jsxs("div", { className: "w-24 h-24 bg-indigo-600/10 border-2 border-indigo-200 rounded-full flex items-center justify-center mx-auto mb-8 relative", children: [_jsx(Loader2, { className: "w-10 h-10 text-indigo-600 animate-spin" }), _jsx("div", { className: "absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin", style: { animationDuration: '3s' } })] }), _jsx("h2", { className: "text-2xl md:text-3xl font-black text-[var(--color-text)] dark:text-white tracking-tight mb-4 uppercase", children: dt(`Duke Procesuar`) }), _jsx("p", { className: "text-[var(--color-text-muted)] dark:text-slate-300 font-medium max-w-md mx-auto animate-pulse leading-relaxed", children: dt(`Raporti juaj po dërgohet në sistem të sigurt. Verifikimi i lokacionit, kategorisë dhe sigurisë po bëhet në kohë reale...`) }), _jsxs("div", { className: "mt-8 flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.2em] text-slate-500", children: [_jsx("span", { className: "h-2 w-2 rounded-full bg-indigo-600 animate-pulse" }), _jsx("span", { children: "Secure workflow" })] })] })] })), step === 3 && (_jsxs("div", { className: "bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-[28px] p-8 md:p-14 text-center animate-in zoom-in-95 duration-500 max-w-2xl mx-auto relative overflow-hidden", children: [_jsx("div", { className: "absolute top-0 right-0 bg-amber-500 text-slate-950 px-3 md:px-4 py-1 text-xs md:text-xs font-bold tracking-wide border-b-4 border-l-4 border-white", children: dt(`Raporti: Në shqyrtim`) }), _jsx("div", { className: "w-20 h-20 md:w-28 md:h-28 bg-emerald-50 border-2 border-emerald-200 rounded-[28px] flex items-center justify-center mx-auto mb-6 md:mb-8 relative", children: _jsx(CheckCircle2, { className: "w-10 h-10 md:w-16 md:h-16 text-emerald-600 relative z-10" }) }), _jsxs("h1", { className: "text-3xl md:text-5xl font-black text-[var(--color-text)] dark:text-white tracking-tight mb-4 md:mb-5 title-serif uppercase", children: [dt(`Raportimi u pranua`), _jsx("span", { className: "text-indigo-600", children: "." })] }), _jsx("p", { className: "text-slate-600 dark:text-slate-200 font-medium text-sm md:text-base lg:text-lg mb-6 md:mb-8 font-serif italic max-w-md mx-auto", children: dt(`Raportimi iu dërgua agjentëve dhe administratorëve për shqyrtim. Përdorni Track-ID për ta ndjekur statusin e tij në çdo moment.`) }), _jsxs("div", { className: "w-full mb-8 rounded-2xl border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800 p-4 text-left shadow-inner", children: [_jsx("div", { className: "text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-bold", children: "Track-ID i raportimit" }), _jsxs("div", { className: "mt-2 flex items-center justify-between gap-3", children: [_jsx("code", { className: "text-lg font-black tracking-wider text-slate-900 dark:text-white break-all", children: submittedReportId }), _jsx("button", { type: "button", onClick: () => navigator.clipboard?.writeText(submittedReportId), className: "shrink-0 text-xs font-bold text-blue-600 hover:text-blue-700", children: "Kopjo" })] })] }), currentUser && (_jsxs("div", { className: "inline-flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-blue-700 text-white px-6 md:px-8 py-3 md:py-4 font-bold tracking-wide text-xs md:text-xs mb-8 md:mb-10 w-full rounded-2xl shadow-lg shadow-indigo-600/20", children: [_jsx(Sparkles, { className: "w-4 h-4 md:w-5 md:h-5 text-amber-300" }), dt(`Titulli: +10 Pikë Qytetare`)] })), _jsxs("div", { className: "flex flex-col sm:flex-row gap-4", children: [_jsx("button", { onClick: () => navigate(`/trackid?id=${encodeURIComponent(submittedReportId)}`), className: "flex-1 px-6 md:px-8 py-4 md:py-5 bg-slate-900 hover:bg-[#003865] text-white font-bold tracking-wide text-xs md:text-xs transition-colors border border-slate-200/60 dark:border-white/10 rounded-xl", children: dt(`Ndiq raportimin`) }), _jsx("button", { onClick: () => { setStep(1); setTitle(''); setDescription(''); setMediaItems([]); }, className: "flex-1 px-6 md:px-8 py-4 md:py-5 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[var(--color-text)] dark:text-white border border-slate-200/60 dark:border-white/10 rounded-xl font-bold tracking-wide text-xs md:text-xs transition-colors", children: dt(`Rast i Ri`) })] })] }))] }) }));
}

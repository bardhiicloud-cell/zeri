import { AuraHero, AuraOrbit } from '../components/aura/Aura';
import { dt } from '@/src/lib/dt';
import React, { useState, useEffect, useRef, Component } from 'react';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import '../lib/leafletLifecycle';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '../lib/store';
import { useLanguage } from '../lib/LanguageContext';
import { Camera, MapPin, AlertCircle, CheckCircle2, ChevronRight, Loader2, Sparkles, ArrowLeft, ShieldAlert, FileText, Music } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UrgentLevel } from '../types';
import { cn } from '../lib/utils';
import { getAccountabilityDueDate, getAccountabilityProfile } from '../lib/accountability';

import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

import { KOSOVO_MUNICIPALITIES, MUNICIPALITY_COORDINATES } from '../lib/constants';
import { getReportTopicPlainLabel, REPORT_TOPIC_GROUPS } from '../lib/reportTopics';
import { isSpecificScope, scopeKey } from '../lib/municipalityScope';
import { auth, db, uploadFileToStorage, MAX_UPLOAD_BYTES, formatBytes } from '../lib/firebase';
import { authHeaders } from '../lib/apiAuth';
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
async function ensureReportSession(): Promise<string | null> {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  try {
    const credential = await signInAnonymously(auth);
    return credential.user.uid;
  } catch {
    const guestUser = getOrCreateGuestUser();
    return guestUser.id;
  }
}

import { validations } from '../lib/validations';
import { handleFirebaseError } from '../lib/errorHandler';
import { checkEvidenceFile, classifyServerResponse, evidenceKind, MAX_REPORT_FILES, type FileProblem } from '../lib/reportSubmit';
import {
  draftOwner,
  LEGACY_REPORT_DRAFT_KEY,
  parseDraft,
  REPORT_DRAFT_KEY,
  serializeDraft,
  type LocationSource,
} from '../lib/reportDraft';

/** Ids that the error summary and the focus management point at. */
const FIELD_IDS: Record<string, string> = {
  title: 'report-title',
  description: 'report-description',
  topicCategory: 'report-topic-category',
  category: 'report-category',
  municipality: 'report-municipality',
  location: 'report-address',
  guestName: 'report-guest-name',
  guestPhone: 'report-guest-phone',
};

const labelClass = 'mb-2 block text-sm font-semibold text-[var(--color-text)] dark:text-white';
const inputClass =
  'min-h-11 w-full rounded-lg border bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-text)] outline-none transition-colors placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:ring-indigo-600/50 dark:bg-slate-900 dark:text-white';

function RequiredMark() {
  return <span aria-hidden="true" className="text-rose-600"> *</span>;
}

/** The message a field's `aria-describedby` points at. Empty when the field is valid. */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1 text-sm font-semibold text-rose-700 dark:text-rose-300">
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

const DEFAULT_CENTRE: [number, number] = [42.6629, 21.1655];

// Fix for default Leaflet icon in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapUpdater({ mapCenter }: { mapCenter: [number, number] }) {
  const map = useMapEvents({
    click() {
      // The parent uses click differently via LocationMarker, but map doesn't trigger here unless we intercept
    }
  });
  
  React.useEffect(() => {
    map.flyTo(mapCenter, Math.max(map.getZoom(), 16));
    // No cleanup on purpose: react-leaflet has already called map.remove() by
    // the time this effect is torn down, remove() cancels a running fly itself,
    // and calling map.stop() on a removed map throws. The zoom timer that
    // remove() leaves behind is handled in lib/leafletLifecycle.ts.
  }, [mapCenter[0], mapCenter[1], map]);

  return null;
}

// Safe Kosovo Municipality Mapping Helper to resolve standardizing OpenStreetMap names
const mapToKosovoMunicipality = (name: string): string => {
  if (!name) return '';
  const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  const mappings: Record<string, string> = {
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

  if (mappings[n]) return mappings[n];

  for (const key of Object.keys(mappings)) {
    if (n.includes(key) || key.includes(n)) {
      return mappings[key];
    }
  }

  const exactMatch = KOSOVO_MUNICIPALITIES.find(
    m => m.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === n
  );
  if (exactMatch) return exactMatch;

  return '';
};

// Error Boundary for the Leaflet Map to prevent entire app crashes in sandboxed iframes
class SafeMapContainer extends Component<any, any> {
  state = { hasError: false };

  constructor(props: any) {
    super(props);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Leaflet Map crash intercepted gracefully:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-800 border-2 border-dashed border-neutral-300 rounded-xl p-8 text-center">
          <MapPin className="w-12 h-12 text-indigo-600 mb-3 animate-pulse" />
          <h4 className="font-bold text-[var(--color-text)] dark:text-white text-sm uppercase tracking-wider">{dt(`Harta interaktive po ngarkohet...`)}</h4>
          <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] mt-2 max-w-sm leading-relaxed">{dt(`Ju mund të vazhdoni duke shkruar adresën tuaj ose duke përdorur butonin GPS më lart për të zbuluar automatikisht vendndodhjen.`)}</p>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

function LocationMarker({ position, setPosition, setAddress, setMunicipality, preventSearchRef, onGeocodeError }: { position: [number, number], setPosition: (pos: [number, number]) => void, setAddress: (addr: string) => void, setMunicipality: (m: string) => void, preventSearchRef?: React.MutableRefObject<boolean>, onGeocodeError?: () => void }) {
  useMapEvents({
    async click(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      setPosition([lat, lng]);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        if (!res.ok) throw new Error(`reverse geocode ${res.status}`);
        const data = await res.json();
        if (data && data.address) {
          const city = data.address.city || data.address.town || data.address.village || data.address.municipality;
          if (city) {
            const exactCommune = mapToKosovoMunicipality(city);
            if (exactCommune) {
              setMunicipality(exactCommune); 
            }
          }
          if (preventSearchRef) preventSearchRef.current = true;
          setAddress(data.display_name);
        } else {
          onGeocodeError?.();
        }
      } catch (err) {
        // The pin is still valid; only the address text could not be looked up.
        console.error(err);
        onGeocodeError?.();
      }
    },
  });

  return (
    <>
      <MapUpdater mapCenter={position} />
      <Marker position={position} />
    </>
  );
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
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

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [topicCategory, setTopicCategory] = useState('');
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
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
  const [urgency, setUrgency] = useState<UrgentLevel>('Mesatare');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isAd, setIsAd] = useState(false);
  const [adLink, setAdLink] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const userMunicipality = useStore(state => state.userMunicipality);
  /**
   * Prefilled from the global scope, but deliberately not re-synced: the citizen
   * is allowed to file a report for a neighbouring municipality without changing
   * what the rest of the platform is filtered to. Re-syncing on every scope
   * change overwrote a choice they had already made on the form.
   */
  const [municipality, setMunicipality] = useState(
    isSpecificScope(userMunicipality) ? scopeKey(userMunicipality) : ''
  );
  const preventSearch = React.useRef(false);
  const [address, setAddress] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [coordinates, setCoordinates] = useState<[number, number]>(DEFAULT_CENTRE);
  /**
   * Where the coordinates came from. `default` (the Prishtina map centre) and
   * `municipality` (the centre of the chosen municipality) are NOT an incident
   * location: the form asks for a pin, a GPS fix or a searched address before
   * it accepts the report.
   */
  const [locationSource, setLocationSource] = useState<LocationSource>('default');
  const [geoNotice, setGeoNotice] = useState('');
  const [draftNotice, setDraftNotice] = useState(false);
  const owner = draftOwner(currentUser);
  const draftReady = useRef(false);

  // Restore a draft from this tab, once, and only if it belongs to this account.
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_REPORT_DRAFT_KEY);
      const draft = parseDraft(sessionStorage.getItem(REPORT_DRAFT_KEY), owner);
      if (draft) {
        setTitle(draft.title);
        setDescription(draft.description);
        setCategory(draft.category);
        setTopicCategory(draft.topicCategory);
        if (draft.urgency) setUrgency(draft.urgency as UrgentLevel);
        if (draft.municipality) setMunicipality(draft.municipality);
        setAddress(draft.address);
        preventSearch.current = true;
        setCoordinates(draft.coordinates);
        setLocationSource(draft.locationSource);
        setDraftNotice(true);
      }
    } catch {
      // Storage can be blocked (private mode); the form simply starts empty.
    }
    draftReady.current = true;
  }, []);

  // Keep the draft current while the citizen types. Contact details and files
  // are deliberately never written (see lib/reportDraft.ts).
  useEffect(() => {
    if (!draftReady.current || step === 3) return;
    const timer = setTimeout(() => {
      try {
        const raw = serializeDraft({
          owner, title, description, category, topicCategory, urgency, municipality, address, coordinates, locationSource,
        });
        if (raw) sessionStorage.setItem(REPORT_DRAFT_KEY, raw);
        else sessionStorage.removeItem(REPORT_DRAFT_KEY);
      } catch {
        // ignore: recovery is best effort
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [owner, title, description, category, topicCategory, urgency, municipality, address, coordinates, locationSource, step]);

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(REPORT_DRAFT_KEY);
      localStorage.removeItem(LEGACY_REPORT_DRAFT_KEY);
    } catch {
      // ignore
    }
  };

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
        } catch (e) {
          console.error('Search error', e);
        } finally {
          setIsSearchingAddress(false);
        }
      } else {
        setAddressSuggestions([]);
      }
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [address]);

  const selectSuggestion = (sug: any) => {
    const newAddress = sug.display_name;
    const lat = parseFloat(sug.lat);
    const lon = parseFloat(sug.lon);
    
    preventSearch.current = true;
    setCoordinates([lat, lon]);
    setLocationSource('search');
    setGeoNotice('');
    setAddress(newAddress);
    
    // Attempt to extract municipality from OpenStreetMap address
    if (sug.address) {
      const city = sug.address.city || sug.address.town || sug.address.village || sug.address.municipality;
      if (city) {
         const upperCity = city.toUpperCase();
         const match = KOSOVO_MUNICIPALITIES.find(m => m.toUpperCase() === upperCity || upperCity.includes(m.toUpperCase()));
         if (match) setMunicipality(match);
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

  const [mediaItems, setMediaItems] = useState<{file: File, url: string, type: 'image' | 'video' | 'document' | 'audio'}[]>([]);
  const [evidenceMessages, setEvidenceMessages] = useState<string[]>([]);
  const [failedFileNames, setFailedFileNames] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState('');
  const [forensicsPrompt, setForensicsPrompt] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const forensicsAcknowledged = useRef(false);
  const submittingRef = useRef(false);
  /** Same document id on every attempt of one submission, so a retry cannot create a second report. */
  const submissionRef = useRef<ReturnType<typeof doc> | null>(null);
  /** Files that are already in Storage, so a retry uploads only what failed. */
  const uploadedRef = useRef(new Map<File, { url: string; type: string; name: string; sizeBytes: number; mimeType?: string }>());
  const submitErrorRef = useRef<HTMLDivElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const fmt = (key: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), dt(key));

  const fieldProps = (key: string, hintId?: string) => ({
    id: FIELD_IDS[key],
    'aria-invalid': errors[key] ? (true as const) : undefined,
    'aria-describedby': [errors[key] ? `${FIELD_IDS[key]}-error` : '', hintId ?? ''].filter(Boolean).join(' ') || undefined,
  });

  // Moving to another step replaces the content; send focus to its heading so
  // keyboard and screen-reader users land at the top of what is new.
  const firstStepRender = useRef(true);
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (submitError && !isSubmitting) submitErrorRef.current?.focus();
  }, [submitError, isSubmitting]);

  // Revoke preview URLs when the page goes away.
  const mediaRef = useRef(mediaItems);
  mediaRef.current = mediaItems;
  useEffect(() => () => mediaRef.current.forEach(item => item.url && URL.revokeObjectURL(item.url)), []);

  const invalidateAnalysis = () => {
    // The advice was about the photos that were analysed; once they change it no longer applies.
    setAiInsights(null);
    setForensicsPrompt(false);
    forensicsAcknowledged.current = false;
    setAiStatus('');
  };

  const analyzeWithAI = async () => {
    // AI vision analysis only makes sense for a photo; a video, document or
    // voice note has no frame to read, so pick the first image explicitly.
    const imageMedia = mediaItems.find(m => m.type === 'image');
    if (!imageMedia) {
      setAiStatus(dt('Analiza AI lexon vetëm një foto. Kthehuni te hapi 1 dhe shtoni një foto, ose plotësoni fushat vetë.'));
      return;
    }

    const imageFile = imageMedia.file;
    setIsAnalyzing(true);
    setAiStatus(dt('Po analizohet fotoja…'));

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);

      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
      });

      const base64DataUrl = await base64Promise;
      const parts = base64DataUrl.split(';');
      const mimeType = parts[0].split(':')[1];
      const imageBase64 = parts[1].split(',')[1];

      const res = await fetch('/api/analyze-issue', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          imageBase64,
          mimeType,
          lat: coordinates[0],
          lng: coordinates[1],
          descriptionText: description
        })
      });

      if (!res.ok) {
        throw new Error('Dështoi analiza AI');
      }

      const data = await res.json();

      if (data?.degraded) {
        setAiStatus(dt('Analiza AI nuk është e disponueshme tani. Plotësoni fushat vetë — raporti mund të dërgohet pa të.'));
      } else if (data && (data.category || data.title)) {
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
        if (data.category) setCategory(data.category);
        if (data.urgency) setUrgency(data.urgency);
        setAiInsights(data);
        setAiStatus(dt('AI sugjeroi titullin, përshkrimin dhe kategorinë. Kontrollojini dhe ndryshojini nëse nuk janë të sakta.'));
      } else {
        setAiStatus(dt('AI nuk gjeti një kategori të sigurt për këtë foto. Zgjidhni kategorinë vetë.'));
      }
    } catch (e) {
      console.error(e);
      setAiStatus(dt('Analiza AI dështoi. Provoni përsëri ose plotësoni fushat vetë — raporti mund të dërgohet pa të.'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addFiles = (files: FileList | null) => {
    // Cancelling the file dialog gives no files: leave the current state alone.
    if (files && files.length > 0) {
      const messages: string[] = [];
      const accepted: typeof mediaItems = [];
      Array.from(files).forEach((file: File) => {
        // Matches the deployed Storage rules for reports/ (10 MB per object) and
        // the server, which keeps at most MAX_REPORT_FILES. These checks only
        // save a doomed upload; Storage rules and the server enforce them again.
        const problem: FileProblem | null = checkEvidenceFile(file, {
          maxBytes: MAX_UPLOAD_BYTES.reports,
          currentCount: mediaItems.length + accepted.length,
        });
        if (problem === 'too_large') {
          messages.push(fmt('Fajlli “{name}” është {size}. Kufiri për çdo skedar është {max}.', {
            name: file.name, size: formatBytes(file.size), max: formatBytes(MAX_UPLOAD_BYTES.reports),
          }));
        } else if (problem === 'unsupported') {
          messages.push(fmt('Fajlli “{name}” nuk pranohet. Lejohen foto, video, audio, PDF, DOC/DOCX dhe TXT.', { name: file.name }));
        } else if (problem === 'empty') {
          messages.push(fmt('Fajlli “{name}” është bosh.', { name: file.name }));
        } else if (problem === 'limit') {
          messages.push(fmt('Mund të shtoni deri në {max} skedarë. “{name}” nuk u shtua.', { max: MAX_REPORT_FILES, name: file.name }));
        } else {
          const type = evidenceKind(file.type || '');
          const url = type === 'image' || type === 'video' ? URL.createObjectURL(file) : '';
          accepted.push({ file, url, type });
        }
      });
      if (accepted.length > 0) {
        setMediaItems(prev => [...prev, ...accepted]);
        invalidateAnalysis();
        setFailedFileNames([]);
      }
      setEvidenceMessages(messages);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    // Allow re-selecting the same file after a validation error.
    e.target.value = '';
  };

  const removeMedia = (index: number) => {
    const removed = mediaItems[index];
    if (removed?.url) URL.revokeObjectURL(removed.url);
    if (removed) uploadedRef.current.delete(removed.file);
    setMediaItems(prev => prev.filter((_, i) => i !== index));
    setFailedFileNames([]);
    setEvidenceMessages([]);
    invalidateAnalysis();
  };

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const required = (label: string) => fmt('Fusha “{field}” është e detyrueshme.', { field: dt(label) });
    const tooShort = (label: string, min: number) => fmt('Fusha “{field}” duhet të ketë të paktën {min} karaktere.', { field: dt(label), min });

    if (validations.isRequired(title, '')) newErrors.title = required('Emërtimi i Çështjes');
    else if (validations.minLength(title, 5, '')) newErrors.title = tooShort('Emërtimi i Çështjes', 5);

    if (validations.isRequired(description, '')) newErrors.description = required('Raporti i Detajuar');
    else if (validations.minLength(description, 20, '')) newErrors.description = tooShort('Raporti i Detajuar', 20);

    if (validations.isRequired(topicCategory, '')) newErrors.topicCategory = required('Tema e problemit');
    if (validations.isRequired(category, '')) newErrors.category = required('Institucioni që e merr raportin');
    if (validations.isRequired(municipality, '')) newErrors.municipality = required('Zona e Operimit (Komuna)');

    // The map centre or a municipality centre is not where the problem is.
    if ((locationSource === 'default' || locationSource === 'municipality') && !address.trim()) {
      newErrors.location = dt('Shënoni vendin e saktë të problemit: klikoni në hartë, përdorni GPS ose shkruani adresën.');
    }

    if ((!currentUser || currentUser?.role === 'guest') && !isAnonymous) {
      if (validations.isRequired(guestName, '')) newErrors.guestName = required('Emri dhe Mbiemri');
      else if (validations.minLength(guestName, 3, '')) newErrors.guestName = tooShort('Emri dhe Mbiemri', 3);

      if (validations.isRequired(guestPhone, '')) newErrors.guestPhone = required('Kontakti');
      else if (validations.isPhone(guestPhone)) newErrors.guestPhone = dt('Numri duhet të jetë në formatin e Kosovës, p.sh. +383 44 123 456.');
    }

    setErrors(newErrors);
    return newErrors;
  };

  const startNewReport = () => {
    mediaItems.forEach(item => item.url && URL.revokeObjectURL(item.url));
    clearDraft();
    submissionRef.current = null;
    uploadedRef.current.clear();
    forensicsAcknowledged.current = false;
    setMediaItems([]); setEvidenceMessages([]); setFailedFileNames([]);
    setTitle(''); setDescription(''); setCategory(''); setTopicCategory(''); setUrgency('Mesatare');
    setAddress(''); setAddressSuggestions([]); setCoordinates(DEFAULT_CENTRE); setLocationSource('default'); setGeoNotice('');
    setGuestName(''); setGuestPhone(''); setIsAnonymous(false);
    setAiInsights(null); setAiStatus(''); setForensicsPrompt(false);
    setErrors({}); setSubmitError(''); setDraftNotice(false); setSubmittedReportId('');
    setStep(1);
  };

  const FIELD_ORDER = ['title', 'description', 'topicCategory', 'category', 'municipality', 'location', 'guestName', 'guestPhone'];

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    // Enter pressed twice, a double click, a second tab of the same button: one request at a time.
    if (submittingRef.current) return;
    setSubmitError('');

    const found = validateForm();
    const firstInvalid = FIELD_ORDER.find(key => found[key]);
    if (firstInvalid) {
      setTimeout(() => document.getElementById(FIELD_IDS[firstInvalid])?.focus(), 0);
      return;
    }

    /*
     * The photo analysis is advice, not a verdict: it ran in the citizen's own
     * browser and its result is relayed by that browser, so it cannot be
     * trusted as a gate, and a low score on a genuine photo (night, blur,
     * screenshot) used to leave people with an unexplained dead end. A low
     * score now asks once; the citizen can replace the evidence or send the
     * report anyway. Every report is reviewed by staff before it is public, and
     * the analysis text travels with it for that review.
     */
    if (aiInsights && Number(aiInsights.authenticityScore) < 40 && !forensicsAcknowledged.current) {
      setForensicsPrompt(true);
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    const fail = (message: string) => setSubmitError(message);

    try {
      // 0. Firestore requires `authorId == request.auth.uid`, so a report can
      //    only be stored together with a real identity. Guarantee one up front
      //    instead of showing a Track ID for a report that was never persisted.
      const authorUid = await ensureReportSession();
      if (!authorUid) {
        fail(dt('Për të ruajtur raportin nevojitet një sesion aktiv. Kyçuni ose vazhdoni si mysafir dhe provoni përsëri — të dhënat e formës ruhen.'));
        return;
      }

      // The report id is generated once per submission and reused by every retry:
      // the server and the fallback both write to this document, so a repeated
      // attempt cannot create a second report. It is also the media folder
      // (reports/{uid}/{reportId}/...) the Storage rules accept.
      const reportRef = (submissionRef.current ??= doc(collection(db, 'reports')));
      const trackingId = createTrackingId('ZQ', reportRef.id);

      // 2. Anti-Spam / Duplication Geofencing & AI Duplicate Text Merger
      const getDistanceInM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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
      const nearbyReports = reports.filter(r =>
        r.status !== 'Resolved' && r.status !== 'Rejected' && r.location?.lat && r.location?.lng &&
        getDistanceInM(coordinates[0], coordinates[1], r.location.lat, r.location.lng) <= 50
      );

      if (nearbyReports.length > 0) {
         try {
           const dupRes = await fetch('/api/detect-duplicate', {
             method: 'POST',
             headers: await authHeaders({ 'Content-Type': 'application/json' }),
             body: JSON.stringify({
               newReport: { title, description, imageUrl: mediaItems[0]?.url },
               existingReports: nearbyReports
             })
           });
           const dupData = await dupRes.json();
           if (dupData.is_duplicate && dupData.duplicate_of_id) {
              /*
               * The model only suggests a duplicate. It used to decide on its own:
               * the citizen's report was thrown away and replaced by a "support"
               * vote, with no way to say "no, mine is different". Now they choose.
               */
              const supportExisting = window.confirm(
                dt('Duket se ky problem është raportuar tashmë pranë vendndodhjes suaj. Dëshironi ta mbështesni raportimin ekzistues? Shtypni "Anulo" për ta dërguar raportin tuaj gjithsesi.')
              );
              if (supportExisting) {
                upvoteReport(dupData.duplicate_of_id);
                clearDraft();
                navigate(`/detailed-registry?report=${dupData.duplicate_of_id}`);
                toast.success(dt(`Faleminderit! E mbështetët raportimin ekzistues.`), { duration: 6000 });
                return;
              }
           }
         } catch(e) {
           console.error("Gabim në AI merger", e);
         }
      }

      // Simulate AI Moderation for Text
      const { validateReportByAI } = await import('../lib/moderation');
      const aiCheck = await validateReportByAI(title, description);

      if (!aiCheck.valid) {
        fail(aiCheck.error || dt('Teksti i raportit nuk u pranua. Rishikoni formulimin.'));
        return;
      }

      const reportData: any = {
        title,
        description,
        category: category || 'Të tjera',
        topicCategory,
        urgency,
        status: 'Pending Review',
        location: { lat: coordinates[0], lng: coordinates[1], address: address.trim() || 'Nuk ka adresë', municipality },
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

      /**
       * Everything that tells the citizen "your report exists" lives here and is
       * called only after the report has actually been written. It used to run
       * before the uploads and before the save, so a failed save still ended on
       * the Track ID screen for a report that was never stored.
       */
      const confirmSubmission = (finalTrackingId: string, finalId: string) => {
        if (!currentUser || currentUser.role === 'guest') {
          saveGuestReportHistory({
            id: finalId,
            trackingId: finalTrackingId,
            title: title || 'Raportim i ri',
            description,
            category: category || 'Të tjera',
            topicCategory,
            status: 'Pending Review',
            municipality,
            createdAt: reportData.createdAt
          });
        }
        setSubmittedReportId(finalTrackingId);
        if (currentUser) addPoints(10);
        clearDraft();
        submissionRef.current = null;
        uploadedRef.current.clear();
        setStep(3);
      };

      // Upload only what is not in Storage yet. A failed file used to be dropped
      // silently ("the report will be saved without it"); now the citizen decides.
      const pending = mediaItems.filter(media => !uploadedRef.current.has(media.file));
      const uploadResults = await Promise.allSettled(
        pending.map(async (media) => {
          const downloadUrl = await uploadFileToStorage(media.file, 'reports', {
            userId: authorUid,
            scope: reportRef.id,
          });
          uploadedRef.current.set(media.file, {
            url: downloadUrl,
            type: media.type,
            name: media.file.name,
            sizeBytes: media.file.size,
            mimeType: media.file.type || undefined,
          });
        })
      );
      const failed = pending.filter((_, index) => uploadResults[index].status === 'rejected');
      if (failed.length > 0) {
        setFailedFileNames(failed.map(media => media.file.name));
        fail(fmt('{count} nga {total} dëshmi nuk u ngarkuan. Provoni përsëri ose hiqini nga lista; raporti nuk është dërguar.', {
          count: failed.length, total: mediaItems.length,
        }));
        return;
      }
      setFailedFileNames([]);

      const uploadedMedia = mediaItems.flatMap(media => {
        const stored = uploadedRef.current.get(media.file);
        return stored ? [stored] : [];
      });
      reportData.images = uploadedMedia.filter(m => m.type === 'image').map(m => m.url);
      reportData.media = uploadedMedia;

      /*
       * Preferred path: the server endpoint. The server re-validates fields,
       * applies a per-uid duplicate + rate window and assembles the document
       * itself, so a modified client cannot skip those checks. The direct
       * Firestore write below remains only for the case where the server cannot
       * be reached at all; a refusal, a validation error or an expired sign-in
       * is shown to the citizen and never bypassed.
       */
      let outcome: ReturnType<typeof classifyServerResponse> = { kind: 'fallback' };
      let timedOut = false;
      const token = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
      if (token) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 45_000);
        try {
          const response = await fetch('/api/v1/reports', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              reportId: reportRef.id,
              title: reportData.title,
              description: reportData.description,
              category: reportData.category,
              topicCategory: reportData.topicCategory,
              urgency: reportData.urgency,
              location: reportData.location,
              media: reportData.media,
              isAnonymous: reportData.isAnonymous === true,
              authorName: reportData.authorName ?? '',
              trackingId: reportData.trackingId,
              aiCategoryScore: reportData.aiCategoryScore,
              aiRoutingReason: reportData.aiRoutingReason,
              aiForensicsReport: reportData.aiForensicsReport,
            }),
          });
          const body = await response.json().catch(() => null);
          outcome = classifyServerResponse(response.status, body);
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            // The server may still be saving it. Do not write a second copy.
            timedOut = true;
            outcome = { kind: 'retry' };
          } else {
            outcome = { kind: 'fallback' };
          }
        } finally {
          clearTimeout(timer);
        }
      }

      if (outcome.kind === 'created') {
        const serverTrackingId = outcome.trackingId || reportData.trackingId;
        reportData.trackingId = serverTrackingId;
        reportData.id = outcome.id;
        addReport({ ...reportData, id: outcome.id } as any);
        confirmSubmission(serverTrackingId, outcome.id);
        return;
      }
      if (outcome.kind === 'refused') {
        fail(outcome.code === 'DUPLICATE_WINDOW'
          ? dt('Një raport i ngjashëm u dërgua së fundmi nga ju. Prisni disa minuta para se ta dërgoni përsëri.')
          : outcome.code === 'RATE_WINDOW'
            ? dt('Keni dërguar shumë raporte në pak minuta. Provoni përsëri pak më vonë.')
            : outcome.message || dt('Raportimi u refuzua nga serveri.'));
        return;
      }
      if (outcome.kind === 'invalid') {
        fail(dt('Serveri nuk e pranoi raportin. Kontrolloni fushat dhe provoni përsëri.') + (outcome.message ? ` (${outcome.message})` : ''));
        return;
      }
      if (outcome.kind === 'session') {
        fail(dt('Sesioni juaj ka skaduar. Rifreskoni faqen ose kyçuni përsëri; teksti i raportit ruhet në këtë skedë, por dëshmitë duhen shtuar sërish.'));
        return;
      }
      if (outcome.kind === 'retry') {
        fail(timedOut
          ? dt('Serveri po përgjigjet ngadalë. Raporti mund të jetë ruajtur. Provoni përsëri: nuk do të krijohet dublikat.')
          : dt('Raporti nuk u ruajt. Provoni përsëri: nuk do të krijohet dublikat.'));
        return;
      }

      // outcome.kind === 'fallback': the server was unreachable.
      try {
        await setDoc(reportRef, {
          ...reportData,
          createdAt: serverTimestamp() // native firebase timestamp
        });
      } catch (e) {
        // The report was not stored anywhere the municipality or platform can
        // see. Saying otherwise left citizens waiting on a complaint that did
        // not exist. Keep the form so they can simply try again.
        const appError = handleFirebaseError(e);
        console.warn('Firestore save failed; the report was NOT stored.', appError.technicalMessage);
        fail(dt('Raporti NUK u dërgua dhe nuk u krijua Track ID. Të dhënat e formës janë ende këtu — kontrolloni lidhjen dhe provoni përsëri.'));
        return;
      }

      addReport({
        ...reportData,
        id: reportData.id || `rep_${Date.now()}`
      });
      confirmSubmission(reportData.trackingId || reportData.id, reportData.id || reportRef.id);
    } catch(err) {
      const appError = handleFirebaseError(err);
      console.error('Submission error:', appError.technicalMessage);
      fail(appError.message || dt('Ka ndodhur një gabim gjatë procesimit të të dhënave, provoni përsëri.'));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (isBanned) {
    return (
      <div className="max-w-md mx-auto my-12 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border border-indigo-600 rounded-[2rem] p-8 text-center space-y-6 shadow-xl animate-fade-in">
        <div className="w-16 h-16 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto animate-pulse">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-[var(--color-text)] dark:text-white uppercase">{dt(`Raportimi u Bllokua`)}</h2>
        <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] font-bold leading-relaxed">{dt(`Sistemi i Sigurisë (AI Guard) ka bllokuar këtë pajisje (IP:`)} {currentIP}{dt(`) për shkak të shkeljes së kushteve të përdorimit ose dyshimit për spam të vazhdueshëm.`)}
        </p>
        <div className="border-t border-slate-100 dark:border-white/5 pt-4">
          <p className="text-[10px] text-[var(--color-text-muted)] font-mono">{dt(`CODE: BAN_IP_PREVENT_SUBMIT`)}</p>
        </div>
      </div>
    );
  }
  return (
    <>
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-4xl mx-auto pt-6 pb-32 md:py-12 px-4 sm:px-6 lg:px-8"
    >
      
      {/* STEPS INDICATOR: named steps, current step exposed to assistive technology */}
      {step < 3 && (
        <nav aria-label={dt('Hapat e raportimit')} className="mx-auto mb-6 w-full max-w-md md:mb-10">
          <ol className="flex items-center gap-3">
            {[{ n: 1, label: dt('Dëshmia') }, { n: 2, label: dt('Detajet dhe vendndodhja') }].map((item, index) => {
              const state = step > item.n ? 'done' : step === item.n ? 'current' : 'todo';
              return (
                <React.Fragment key={item.n}>
                  {index > 0 && (
                    <li aria-hidden="true" className="h-0.5 flex-1 bg-neutral-300 dark:bg-slate-700">
                      <div className={cn('h-full bg-indigo-600 transition-all', step > 1 ? 'w-full' : 'w-0')} />
                    </li>
                  )}
                  <li aria-current={state === 'current' ? 'step' : undefined} className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold',
                        state === 'current' && 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-slate-800',
                        state === 'done' && 'border-indigo-600 bg-indigo-600 text-white',
                        state === 'todo' && 'border-neutral-300 text-neutral-600 dark:border-slate-700 dark:text-slate-300',
                      )}
                    >
                      {state === 'done' ? <CheckCircle2 className="h-5 w-5" /> : item.n}
                    </span>
                    <span className="text-xs font-semibold text-[var(--color-text)] dark:text-white md:text-sm">
                      {item.label}
                      <span className="sr-only"> ({state === 'done' ? dt('përfunduar') : state === 'current' ? dt('hapi aktual') : dt('hapi tjetër')})</span>
                    </span>
                  </li>
                </React.Fragment>
              );
            })}
          </ol>
        </nav>
      )}

      {step === 1 && (
        <div className="au-page mb-5 bg-transparent">
          <AuraHero tone="blue" eyebrow={dt('Raportim qytetar')} icon={Camera} visual={<AuraOrbit core={Camera} />}
            title={dt('Raporto një problem')}
            subtitle={dt('Përshkruani problemin, shënoni vendndodhjen dhe shtoni foto. Do të merrni një Track-ID për ta ndjekur raportin.')} />
        </div>
      )}

      {step === 1 && (
        <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-2xl p-4 sm:p-8 shadow-sm dark:shadow-none transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
          <div className="mb-6 md:mb-8">
            <h2 ref={stepHeadingRef} tabIndex={-1} className="mb-2 text-2xl font-bold leading-tight tracking-tight text-[var(--color-text)] outline-none dark:text-white sm:text-3xl">
              {dt('Hapi 1: Shtoni dëshmi')} <span className="text-base font-medium text-[var(--color-text-muted)]">({dt('opsionale')})</span>
            </h2>
            <p id="evidence-help" className="max-w-2xl text-sm leading-relaxed text-slate-700 dark:text-slate-200 md:text-base">
              {dt('Një foto, video ose dokument e ndihmon shqyrtimin, por nuk është e detyrueshme. Mund ta dërgoni raportin edhe pa dëshmi.')}
            </p>
          </div>

          <div className="space-y-6 md:space-y-8">
            <div>
              <label
                htmlFor="report-evidence"
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault();
                  addFiles(event.dataTransfer.files);
                }}
                className="group relative mb-4 flex min-h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-400 bg-[var(--color-surface)] p-4 text-center transition-colors hover:bg-slate-50 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-600/40 dark:border-white/30 dark:bg-slate-900/50 dark:hover:bg-slate-800/50 md:p-8"
              >
                <span aria-hidden="true" className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/60 bg-[var(--color-surface)] dark:border-white/10 dark:bg-slate-900/60 md:h-16 md:w-16">
                  <Camera className="h-6 w-6 text-blue-900 dark:text-blue-300 md:h-8 md:w-8" />
                </span>
                <span className="mb-1 text-base font-bold text-[var(--color-text)] dark:text-white md:text-lg">{dt('Zgjidhni skedarë ose tërhiqini këtu')}</span>
                <span id="evidence-limits" className="max-w-sm text-sm text-slate-700 dark:text-slate-200">
                  {fmt('Foto, video, audio, PDF, DOC ose TXT · deri në {count} skedarë · deri në {size} secili', {
                    count: MAX_REPORT_FILES,
                    size: formatBytes(MAX_UPLOAD_BYTES.reports),
                  })}
                </span>
                <input
                  id="report-evidence"
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                  onChange={handleImageUpload}
                  aria-describedby="evidence-help evidence-limits"
                  className="sr-only"
                />
              </label>

              {evidenceMessages.length > 0 && (
                <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border-l-4 border-rose-600 bg-rose-50 p-4 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                  <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  <ul className="space-y-1 text-sm font-medium">
                    {evidenceMessages.map(message => <li key={message}>{message}</li>)}
                  </ul>
                </div>
              )}

              {mediaItems.length > 0 && (
                <ul aria-label={dt('Dëshmitë e shtuara')} className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {mediaItems.map((media, idx) => (
                    <li key={`${media.file.name}-${media.file.size}-${idx}`} className="overflow-hidden rounded-xl border border-slate-200/60 dark:border-white/10">
                      <div className="relative aspect-square">
                        {media.type === 'image' ? (
                          <img src={media.url} alt={media.file.name} className="h-full w-full object-cover" />
                        ) : media.type === 'video' ? (
                          <video src={media.url} aria-label={media.file.name} className="h-full w-full object-cover" muted playsInline />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[var(--color-surface-subtle)] p-2 text-center">
                            {media.type === 'audio'
                              ? <Music aria-hidden="true" className="h-6 w-6 text-indigo-600" />
                              : <FileText aria-hidden="true" className="h-6 w-6 text-indigo-600" />}
                            <span className="w-full break-all text-xs font-semibold text-[var(--color-text)] dark:text-white">{media.file.name}</span>
                          </div>
                        )}
                        {failedFileNames.includes(media.file.name) && (
                          <span className="absolute inset-x-0 top-0 bg-rose-700 px-2 py-1 text-center text-xs font-bold text-white">{dt('Nuk u ngarkua')}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMedia(idx)}
                        aria-label={fmt('Hiq {name}', { name: media.file.name })}
                        className="flex min-h-11 w-full items-center justify-center gap-1 bg-slate-100 px-2 text-sm font-semibold text-slate-900 hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 dark:bg-slate-800 dark:text-white dark:hover:bg-rose-950"
                      >
                        {t('remove')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-start gap-3 rounded-xl border-l-4 border-indigo-500 bg-slate-100 p-3 text-slate-900 dark:bg-slate-800 dark:text-slate-100 md:p-5">
                <Sparkles aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                <p className="text-sm leading-relaxed">{t('report_ai_analysis_msg')}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="mb-8 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200/60 bg-slate-900 p-4 text-sm font-bold tracking-wide text-white transition-all hover:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.99] dark:border-white/10 md:p-5"
            >
              {mediaItems.length > 0 ? dt('Vazhdo te detajet dhe vendndodhja') : dt('Vazhdo pa dëshmi')}
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>

            {/* Dynamic & Beautiful Step-by-Step Reporting Guide for Citizens */}
            <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-6 md:p-8 hover:border-slate-950 transition-colors duration-300">
              <div className="flex items-start gap-3 mb-6 border-b border-slate-200/60 dark:border-white/10 pb-4">
                <div aria-hidden="true" className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shadow-indigo-600/20 shrink-0">
                  ?
                </div>
                <div>
                  <h3 className="font-bold text-[var(--color-text)] dark:text-white text-sm md:text-base">{dt(`Nuk dini si të raportoni? Ndihmë e Shpejtë`)}</h3>
                  <p className="text-sm text-neutral-600 dark:text-[var(--color-text-muted)]">{dt(`Mësoni si të dërgoni një raportim të saktë dhe me impakt në komunitet vetëm me 3 hapa të thjeshtë.`)}</p>
                </div>
              </div>

              <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <li className="bg-[var(--color-surface)] dark:bg-slate-800 p-5 border border-slate-200/60 dark:border-white/10 rounded-xl">
                  <span aria-hidden="true" className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs mb-3">1</span>
                  <h4 className="font-bold text-[var(--color-text)] dark:text-white text-sm mb-1.5">{dt(`Ngarko Dëshminë`)}</h4>
                  <p className="text-sm text-neutral-700 dark:text-[var(--color-text-muted)] leading-relaxed">{dt(`Bëni një foto ose video të problemit (gropë në rrugë, ndotje mjedisore, shtyllë e dëmtuar) dhe ngarkojeni te kutia më lart.`)}</p>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 font-bold mt-3 border-t border-slate-100 dark:border-white/5 pt-2">{dt(`Foto duhet të jetë e qartë`)}</p>
                </li>
                <li className="bg-[var(--color-surface)] dark:bg-slate-800 p-5 border border-slate-200/60 dark:border-white/10 rounded-xl">
                  <span aria-hidden="true" className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs mb-3">2</span>
                  <h4 className="font-bold text-[var(--color-text)] dark:text-white text-sm mb-1.5">{dt(`Vendodhja`)}</h4>
                  <p className="text-sm text-neutral-700 dark:text-[var(--color-text-muted)] leading-relaxed">{dt(`Sistemi do të gjejë GPS tuaj automatikisht, ose mund të klikoni`)} <strong>{dt(`direkt mbi hartë`)}</strong> {dt(`për të vendosur pikën e saktë ku ndodhet problemi.`)}</p>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 font-bold mt-3 border-t border-slate-100 dark:border-white/5 pt-2">{dt(`Kliko mbi Hartë për saktësi`)}</p>
                </li>
                <li className="bg-[var(--color-surface)] dark:bg-slate-800 p-5 border border-slate-200/60 dark:border-white/10 rounded-xl">
                  <span aria-hidden="true" className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs mb-3">3</span>
                  <h4 className="font-bold text-[var(--color-text)] dark:text-white text-sm mb-1.5">{dt(`Detajet & AI`)}</h4>
                  <p className="text-sm text-neutral-700 dark:text-[var(--color-text-muted)] leading-relaxed">{dt(`Kliko`)} <strong>{dt(`"Krijim me AI"`)}</strong> {dt(`që inteligjenca jonë të lexojë foton dhe të shkruajë automatikisht titullin/kategorinë. Më pas kliko dërgo.`)}</p>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 font-bold mt-3 border-t border-slate-100 dark:border-white/5 pt-2">{dt(`E lehtë dhe automatike`)}</p>
                </li>
              </ol>

              <div className="mt-6 bg-slate-900 border-l-4 border-indigo-600 p-4 flex gap-3 text-white items-start rounded-r-xl">
                <AlertCircle aria-hidden="true" className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                <div className="text-sm leading-relaxed space-y-1">
                  <span className="text-xs text-rose-200 block font-bold">{dt(`Shënim për Sigurinë`)}</span>
                  <p className="text-slate-100">{dt(`Zëri i Qytetarëve është portal nga komuniteti, për komunitetin. Mund të zgjidhni të mbeteni anonim kur dërgoni një raport.`)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && !isSubmitting && (
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-labelledby="report-step2-title"
          className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-2xl p-4 sm:p-8 shadow-sm dark:shadow-none transition-all duration-300 animate-in fade-in slide-in-from-right-8 duration-500 relative"
        >
          <div className="mb-6 md:mb-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-4 border-b-2 border-slate-900 dark:border-white/20 pb-5">
            <div className="w-full">
              <button type="button" onClick={() => setStep(1)} className="mb-3 flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700 hover:text-indigo-600 dark:text-slate-200 md:mb-4">
                <ArrowLeft aria-hidden="true" className="w-4 h-4" />{dt(`Kthehu prapa`)}
              </button>
              <h1 id="report-step2-title" ref={stepHeadingRef} tabIndex={-1} className="text-[26px] sm:text-[34px] font-bold text-[var(--color-text)] dark:text-white tracking-tight leading-tight outline-none">
                {dt(`Hapi 2: Detajet e problemit`)}
              </h1>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{dt('Fushat me * janë të detyrueshme.')}</p>
            </div>
            <div className="w-full md:w-auto">
              <button
                type="button"
                onClick={analyzeWithAI}
                disabled={isAnalyzing}
                aria-describedby="ai-help"
                className="flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-[var(--color-surface)] px-4 py-2.5 text-sm font-bold text-[var(--color-text)] transition-colors hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70 dark:border-white/20 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800 md:w-auto"
              >
                {isAnalyzing ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}
                {isAnalyzing ? dt('Po përpunohet...') : dt('Krijim me AI')}
              </button>
            </div>
          </div>

          <p id="ai-help" className="mb-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {dt('“Krijim me AI” lexon foton e parë dhe sugjeron titullin, përshkrimin, kategorinë dhe urgjencën. Është vetëm ndihmë: i kontrolloni dhe i ndryshoni vetë, dhe raporti mund të dërgohet edhe pa të.')}
          </p>
          <div role="status" aria-live="polite" className={cn('mb-4 text-sm font-medium text-slate-800 dark:text-slate-100', !aiStatus && 'hidden')}>{aiStatus}</div>

          {draftNotice && (
            <div role="status" className="mb-6 flex flex-col gap-2 rounded-xl border border-indigo-300 bg-indigo-50 p-4 text-sm text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100 sm:flex-row sm:items-center sm:justify-between">
              <p>{dt('Rikthyem tekstin e raportit që nisët në këtë skedë. Emri, telefoni dhe dëshmitë nuk ruhen kurrë.')}</p>
              <button
                type="button"
                onClick={() => {
                  clearDraft();
                  setTitle(''); setDescription(''); setCategory(''); setTopicCategory(''); setAddress('');
                  setCoordinates(DEFAULT_CENTRE); setLocationSource('default'); setDraftNotice(false); setErrors({});
                }}
                className="min-h-11 shrink-0 rounded-lg border border-indigo-400 px-3 text-sm font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900"
              >
                {dt('Fshi draftin')}
              </button>
            </div>
          )}

          {Object.keys(errors).filter(key => errors[key]).length > 0 && (
            <div role="alert" className="mb-6 rounded-xl border-l-4 border-rose-600 bg-rose-50 p-4 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
              <p className="font-bold">{dt('Rregulloni këto fusha para se ta dërgoni raportin:')}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {FIELD_ORDER.filter(key => errors[key]).map(key => (
                  <li key={key}>
                    <a
                      href={`#${FIELD_IDS[key]}`}
                      onClick={event => {
                        event.preventDefault();
                        document.getElementById(FIELD_IDS[key])?.focus();
                      }}
                      className="underline underline-offset-2"
                    >
                      {errors[key]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-6 md:space-y-8">
            <div>
              <label htmlFor="report-title" className={labelClass}>{dt(`Emërtimi i Çështjes`)}<RequiredMark /></label>
              <input
                {...fieldProps('title')}
                required
                type="text"
                value={title}
                autoComplete="off"
                onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors({ ...errors, title: '' }); }}
                placeholder={dt(`Psh. Shkatërrimi i infrastrukturës urbane...`)}
                className={cn(inputClass, errors.title ? 'border-rose-600' : 'border-neutral-300 focus:border-slate-900')}
              />
              <FieldError id="report-title-error" message={errors.title} />
            </div>

            <div>
              <label htmlFor="report-description" className={labelClass}>{dt(`Raporti i Detajuar`)}<RequiredMark /></label>
              <textarea
                {...fieldProps('description')}
                required
                value={description}
                onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors({ ...errors, description: '' }); }}
                rows={5}
                className={cn(inputClass, 'resize-y', errors.description ? 'border-rose-600' : 'border-neutral-300 focus:border-slate-900')}
                placeholder={dt(`Paraqisni me detaje natyrën e problemit...`)}
              />
              <FieldError id="report-description-error" message={errors.description} />
            </div>

            <fieldset className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200/60 bg-[var(--color-surface)] p-4 dark:border-white/10 dark:bg-slate-900/50 md:grid-cols-2 md:gap-8 md:p-8">
              <legend className="sr-only">{dt('Klasifikimi i raportit')}</legend>
              <div>
                <label htmlFor="report-topic-category" className={labelClass}>{dt('Tema e problemit')}<RequiredMark /></label>
                <select
                  {...fieldProps('topicCategory', 'report-topic-hint')}
                  required
                  value={topicCategory}
                  onChange={event => {
                    setTopicCategory(event.target.value);
                    if (errors.topicCategory) setErrors({ ...errors, topicCategory: '' });
                  }}
                  className={cn(inputClass, 'font-semibold', errors.topicCategory ? 'border-rose-600' : 'border-neutral-300')}
                >
                  <option value="">{dt('Zgjidhni temën kryesore')}</option>
                  {REPORT_TOPIC_GROUPS.map(group => (
                    <optgroup key={group.label} label={dt(group.label)}>
                      {group.ids.map(id => (
                        <option key={id} value={id}>{getReportTopicPlainLabel(id)}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <FieldError id="report-topic-category-error" message={errors.topicCategory} />
                <p id="report-topic-hint" className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {dt('Kjo temë ndihmon kërkimin, hartën dhe statistikat; zgjedhja e institucionit poshtë përcakton adresimin e raportit.')}
                </p>
              </div>

              <div className="relative" ref={categoryDropdownRef} onBlur={event => {
                if (!categoryDropdownRef.current?.contains(event.relatedTarget as Node | null)) setIsCategoryDropdownOpen(false);
              }}>
                <label htmlFor="report-category" className={labelClass}>{dt('Institucioni që e merr raportin')}<RequiredMark /></label>
                <div className="relative">
                  <input
                    {...fieldProps('category', 'report-category-hint')}
                    required
                    role="combobox"
                    aria-expanded={isCategoryDropdownOpen}
                    aria-controls="report-category-list"
                    aria-autocomplete="list"
                    type="text"
                    autoComplete="off"
                    value={isCategoryDropdownOpen ? categorySearchTerm : (category ? dt(category) : '')}
                    onFocus={() => setIsCategoryDropdownOpen(true)}
                    onChange={(e) => {
                      setCategorySearchTerm(e.target.value);
                      setIsCategoryDropdownOpen(true);
                      if (errors.category) setErrors({ ...errors, category: '' });
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Escape') setIsCategoryDropdownOpen(false);
                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setIsCategoryDropdownOpen(true);
                        setTimeout(() => document.querySelector<HTMLElement>('#report-category-list [role="option"]')?.focus(), 0);
                      }
                    }}
                    placeholder={dt('Zgjidhni institucionin ose kërkoni problemin (p.sh. rrugë, mbeturina)...')}
                    className={cn(inputClass, 'pr-10', errors.category ? 'border-rose-600' : 'border-neutral-300')}
                  />
                  <ChevronRight aria-hidden="true" className={cn('pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)] transition-transform', isCategoryDropdownOpen && 'rotate-90')} />
                </div>

                {isCategoryDropdownOpen && (
                  <div
                    id="report-category-list"
                    role="listbox"
                    aria-label={dt('Institucioni që e merr raportin')}
                    onKeyDown={event => {
                      const options = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'));
                      const at = options.indexOf(document.activeElement as HTMLElement);
                      if (event.key === 'ArrowDown') { event.preventDefault(); options[Math.min(options.length - 1, at + 1)]?.focus(); }
                      if (event.key === 'ArrowUp') { event.preventDefault(); if (at <= 0) document.getElementById('report-category')?.focus(); else options[at - 1]?.focus(); }
                      if (event.key === 'Escape') { setIsCategoryDropdownOpen(false); document.getElementById('report-category')?.focus(); }
                    }}
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-slate-200/60 bg-[var(--color-surface)] shadow-xl dark:border-white/10 dark:bg-slate-900"
                  >
                    {groups.map(group => {
                      const filteredInGroup = allCategories.filter(c => {
                        if ((c.group || 'Të tjera') !== group) return false;
                        if (!categorySearchTerm) return true;
                        const term = categorySearchTerm.toLowerCase();
                        const nameMatch = dt(c.name).toLowerCase().includes(term);
                        const keywordMatch = (c as any).keywords && (c as any).keywords.toLowerCase().includes(term);
                        return nameMatch || keywordMatch;
                      });

                      if (filteredInGroup.length === 0) return null;

                      return (
                        <div key={group} role="group" aria-label={dt(group)}>
                          <div aria-hidden="true" className="sticky top-0 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{dt(group)}</div>
                          {filteredInGroup.map(c => (
                            <button
                              key={'id' in c ? (c as any).id : c.name}
                              type="button"
                              role="option"
                              aria-selected={category === c.name}
                              onClick={() => {
                                setCategory(c.name);
                                setCategorySearchTerm('');
                                setIsCategoryDropdownOpen(false);
                                if (errors.category) setErrors({ ...errors, category: '' });
                                document.getElementById('report-category')?.focus();
                              }}
                              className="min-h-11 w-full border-b border-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-800 last:border-0 hover:bg-indigo-600/10 focus-visible:bg-indigo-600/10 focus-visible:outline-none dark:border-white/5 dark:text-slate-100"
                            >
                              {dt(c.name)}
                              {(c as any).keywords && categorySearchTerm && (c as any).keywords.toLowerCase().includes(categorySearchTerm.toLowerCase()) && !dt(c.name).toLowerCase().includes(categorySearchTerm.toLowerCase()) && (
                                <span className="mt-0.5 block text-xs font-normal text-slate-600 dark:text-slate-300">{dt(`Lidhet me kërkimin tuaj`)}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                    {allCategories.filter(c => {
                      if (!categorySearchTerm) return true;
                      const term = categorySearchTerm.toLowerCase();
                      return dt(c.name).toLowerCase().includes(term) || ((c as any).keywords && (c as any).keywords.toLowerCase().includes(term));
                    }).length === 0 && (
                      <div className="px-4 py-6 text-center text-sm font-medium text-slate-700 dark:text-slate-200">{dt(`Nuk u gjet asnjë sektor për këtë problem.`)}</div>
                    )}
                  </div>
                )}
                <FieldError id="report-category-error" message={errors.category} />
                <p id="report-category-hint" className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {dt('Kush e merr raportin për ta zgjidhur: komuna, ministria ose kompania. Nëse nuk jeni të sigurt, shkruani problemin në kërkim.')}
                </p>
              </div>

              <div>
                <label htmlFor="report-urgency" className={labelClass}>{dt(`Niveli i Rrezikshmërisë`)}</label>
                <select
                  id="report-urgency"
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as UrgentLevel)}
                  className={cn(inputClass, 'border-slate-200 dark:border-white/10')}
                >
                  <option value="E ulët">{dt(`SHKALLA I:`)} {dt('E ulët')}</option>
                  <option value="Mesatare">{dt(`SHKALLA II:`)} {dt('Mesatare')}</option>
                  <option value="E lartë">{dt(`SHKALLA III:`)} {dt('E lartë')}</option>
                  <option value="Kritike">{dt(`SHKALLA IV:`)} {dt('Kritike')}</option>
                </select>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{dt('Në rrezik të menjëhershëm për jetën? Telefononi 112; ky formular nuk zëvendëson emergjencën.')}</p>
              </div>
            </fieldset>

            <fieldset>
              <legend className={cn(labelClass, 'mb-3')}>{dt('Vendndodhja e problemit')}<RequiredMark /></legend>

              <label htmlFor="report-municipality" className="mb-2 block text-sm font-semibold text-[var(--color-text)] dark:text-white">
                {dt(`Zona e Operimit (Komuna)`)}<RequiredMark />
              </label>
              <select
                {...fieldProps('municipality')}
                required
                value={municipality}
                onChange={e => {
                  const next = e.target.value;
                  setMunicipality(next);
                  if (errors.municipality) setErrors({ ...errors, municipality: '' });
                  if (locationSource === 'default' || locationSource === 'municipality') {
                    if (MUNICIPALITY_COORDINATES[next]) {
                      setCoordinates(MUNICIPALITY_COORDINATES[next]);
                      setLocationSource('municipality');
                    }
                  } else if (next) {
                    // The pin the citizen placed is more precise than a municipality centre; keep it and say so.
                    setGeoNotice(dt('Komuna u ndryshua, por pina mbeti aty ku e vendosët. Kontrolloni që komuna dhe pina përputhen.'));
                  }
                }}
                className={cn(inputClass, 'mb-1 font-semibold', errors.municipality ? 'border-rose-600' : 'border-neutral-300 focus:border-slate-900')}
              >
                <option value="">{dt('Zgjidhni komunën')}</option>
                {KOSOVO_MUNICIPALITIES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <FieldError id="report-municipality-error" message={errors.municipality} />

              <div className="mb-3 mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  {dt('Klikoni në hartë për të vendosur pinën te problemi, ose përdorni GPS, ose shkruani adresën më poshtë.')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (!localStorage.getItem('gps_alerted')) {
                      toast(dt("Sistemi kërkon qasje në GPS për të gjetur koordinatat tuaja të sakta."), { icon: '📍' });
                      localStorage.setItem('gps_alerted', 'true');
                    }
                    if (!navigator.geolocation) {
                      setGeoNotice(dt('Shfletuesi juaj nuk suporton GPS. Klikoni në hartë ose shkruani adresën.'));
                      return;
                    }
                    setIsLocating(true);
                    setGeoNotice('');
                    navigator.geolocation.getCurrentPosition(
                      async (pos) => {
                        const lat = pos.coords.latitude;
                        const lng = pos.coords.longitude;
                        setCoordinates([lat, lng]);
                        setLocationSource('gps');
                        if (errors.location) setErrors({ ...errors, location: '' });
                        try {
                          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                          if (!res.ok) throw new Error(`reverse geocode ${res.status}`);
                          const data = await res.json();
                          if (data && data.address) {
                            const city = data.address.city || data.address.town || data.address.village || data.address.municipality;
                            if (city) {
                              const exactCommune = mapToKosovoMunicipality(city);
                              if (exactCommune) setMunicipality(exactCommune);
                            }
                            preventSearch.current = true;
                            setAddress(data.display_name);
                          } else {
                            setGeoNotice(dt('Pozicioni u gjet, por adresa jo. Shkruani adresën ose përshkrimin e vendit.'));
                          }
                        } catch (e) {
                          console.error('Reverse geocode error', e);
                          setGeoNotice(dt('Pozicioni u gjet, por adresa jo. Shkruani adresën ose përshkrimin e vendit.'));
                        } finally {
                          setIsLocating(false);
                        }
                      },
                      (err) => {
                        setIsLocating(false);
                        setGeoNotice(
                          err.code === 1
                            ? dt('Qasja në vendndodhje u refuzua. Lejojeni te cilësimet e shfletuesit, ose klikoni në hartë dhe shkruani adresën.')
                            : err.code === 3
                              ? dt('Gjetja e vendndodhjes zgjati shumë. Provoni përsëri ose klikoni në hartë.')
                              : dt('Vendndodhja nuk mund të gjendet. Klikoni në hartë ose shkruani adresën.'),
                        );
                      },
                      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
                    );
                  }}
                  disabled={isLocating}
                  className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white transition-colors hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLocating ? (
                    <><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />{dt(`Duke kërkuar...`)}</>
                  ) : (
                    <><MapPin aria-hidden="true" className="h-4 w-4" />{dt(`Zbulo Lokacionin (Live)`)}</>
                  )}
                </button>
              </div>

              <div role="status" aria-live="polite" className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                {locationSource === 'default' && dt('Harta tregon qendrën e Prishtinës si pikë fillestare. Nuk është ende vendndodhja e problemit.')}
                {locationSource === 'municipality' && dt('Harta është në qendër të komunës së zgjedhur. Klikoni në hartë ose shkruani adresën për të shënuar vendin e saktë.')}
                {locationSource === 'pin' && dt('Vendndodhja u shënua nga ju në hartë.')}
                {locationSource === 'gps' && dt('Vendndodhja u zbulua nga GPS. Kontrolloni që pina është te problemi, jo te vendi ku gjendeni.')}
                {locationSource === 'search' && dt('Vendndodhja u zgjodh nga adresa e kërkuar.')}
                {geoNotice && <span className="mt-1 block font-semibold">{geoNotice}</span>}
              </div>

              <div
                role="group"
                aria-label={dt('Hartë për shënimin e vendndodhjes. Nëse nuk mund ta përdorni, shkruani adresën në fushën më poshtë.')}
                className="relative z-0 mb-4 h-56 w-full overflow-hidden rounded-xl border-2 border-neutral-300 bg-[var(--color-surface)] dark:bg-slate-800 md:h-72"
              >
                <SafeMapContainer>
                  <MapContainer center={coordinates} zoom={13} scrollWheelZoom={true} className="w-full h-full" zoomControl={true}>
                    <TileLayer
                      attribution='&copy; OpenStreetMap'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      className="map-tiles-dark"
                    />
                    <LocationMarker
                      position={coordinates}
                      setPosition={pos => { setCoordinates(pos); setLocationSource('pin'); setGeoNotice(''); if (errors.location) setErrors({ ...errors, location: '' }); }}
                      setAddress={setAddress}
                      setMunicipality={setMunicipality}
                      preventSearchRef={preventSearch}
                      onGeocodeError={() => setGeoNotice(dt('Pina u vendos, por adresa nuk u gjet. Shkruani adresën ose përshkrimin e vendit.'))}
                    />
                  </MapContainer>
                </SafeMapContainer>
              </div>

              <label htmlFor="report-address" className="mb-2 block text-sm font-semibold text-[var(--color-text)] dark:text-white">
                {dt('Adresa ose pika e referencës')}
              </label>
              <div className="relative">
                <input
                  {...fieldProps('location', 'report-address-hint')}
                  type="text"
                  value={address}
                  autoComplete="street-address"
                  onChange={e => { setAddress(e.target.value); if (errors.location) setErrors({ ...errors, location: '' }); }}
                  className={cn(inputClass, errors.location ? 'border-rose-600' : 'border-slate-200 dark:border-white/10')}
                  placeholder={dt(`Identifikoni lokacionin me saktësi...`)}
                />
                {isSearchingAddress && (
                  <div aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
                  </div>
                )}
                {addressSuggestions.length > 0 && (
                  <ul aria-label={dt('Sugjerime adresash')} className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-slate-200/60 bg-[var(--color-surface)] text-sm font-medium shadow-xl dark:border-white/10 dark:bg-slate-900">
                    {addressSuggestions.map((sug, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => selectSuggestion(sug)}
                          className="flex min-h-11 w-full items-start gap-2 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-none dark:border-white/5 dark:hover:bg-slate-800"
                        >
                          <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                          <span className="text-slate-800 dark:text-slate-100">{sug.display_name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p id="report-address-hint" className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                {dt('Kjo fushë është alternativa e hartës: shkruani rrugën, lagjen ose një objekt pranë.')}
              </p>
              <FieldError id="report-address-error" message={errors.location} />
            </fieldset>

            <div className="flex flex-col gap-4 pt-6 md:pt-8 border-t-2 border-slate-900 dark:border-white/20">
              {(!currentUser || currentUser?.role === 'guest') && !isAnonymous && (
                <fieldset className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200/60 bg-[var(--color-surface)] p-4 dark:border-white/10 dark:bg-slate-900/50 sm:grid-cols-2 md:gap-6 md:p-8">
                  <legend className="px-2 text-sm font-bold text-[var(--color-text)] dark:text-white">{dt(`Identifikimi Subjektit`)}</legend>
                  <div>
                    <label htmlFor="report-guest-name" className={labelClass}>{dt(`Emri dhe Mbiemri`)}<RequiredMark /></label>
                    <input
                      {...fieldProps('guestName')}
                      required
                      type="text"
                      autoComplete="name"
                      value={guestName}
                      onChange={(e) => { setGuestName(e.target.value); if (errors.guestName) setErrors({ ...errors, guestName: '' }); }}
                      className={cn(inputClass, errors.guestName ? 'border-rose-600' : 'border-neutral-300 focus:border-slate-900')}
                    />
                    <FieldError id="report-guest-name-error" message={errors.guestName} />
                  </div>
                  <div>
                    <label htmlFor="report-guest-phone" className={labelClass}>{dt(`Kontakti`)}<RequiredMark /></label>
                    <input
                      {...fieldProps('guestPhone', 'report-guest-phone-hint')}
                      required
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={guestPhone}
                      onChange={(e) => { setGuestPhone(e.target.value); if (errors.guestPhone) setErrors({ ...errors, guestPhone: '' }); }}
                      placeholder="+383 44 123 456"
                      className={cn(inputClass, errors.guestPhone ? 'border-rose-600' : 'border-neutral-300 focus:border-slate-900')}
                    />
                    <p id="report-guest-phone-hint" className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{dt('Format: +383 44 123 456')}</p>
                    <FieldError id="report-guest-phone-error" message={errors.guestPhone} />
                  </div>
                </fieldset>
              )}

              <label className="flex min-h-11 cursor-pointer select-none items-start gap-4 border-2 border-slate-200/60 bg-[var(--color-surface)] p-4 transition-colors hover:border-slate-900 dark:border-white/10 dark:bg-slate-900/50 md:p-5">
                <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} aria-describedby="report-anon-hint" className="mt-0.5 h-6 w-6 shrink-0 rounded border border-slate-400 text-[var(--color-text)] focus:ring-slate-900" />
                <span>
                  <span className="block text-sm font-bold text-[var(--color-text)] dark:text-white">{dt(`Kërkoj statusin anonim në proces`)}</span>
                  <span id="report-anon-hint" className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{dt('Në raport shfaqet “Qytetar Anonim” në vend të emrit tuaj.')}</span>
                </span>
              </label>

              {currentUser?.email === 'reklama@admin.com' && (
                <div className="mt-2 md:mt-4 space-y-2">
                  <label className="flex items-center gap-4 cursor-pointer select-none bg-indigo-600/5 p-4 md:p-5 border-2 border-indigo-600/20 hover:border-indigo-600 transition-colors">
                    <input type="checkbox" checked={isAd} onChange={e => setIsAd(e.target.checked)} className="w-5 h-5 md:w-6 md:h-6 border border-indigo-600/20 rounded-xl text-blue-600 focus:ring-blue-600 transition-all rounded-xl" />
                    <span className="text-xs md:text-xs font-bold text-blue-900 tracking-wide uppercase">{dt(`Posto si Reklamë (Sponsorizuar)`)}</span>
                  </label>
                  {isAd && (
                    <input
                      type="url"
                      aria-label={dt('Linku i reklamës (opsional) - https://...')}
                      value={adLink}
                      onChange={e => setAdLink(e.target.value)}
                      placeholder={dt(`Linku i reklamës (opsional) - https://...`)}
                      className="w-full px-[var(--spacing-4)] py-[var(--spacing-3)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-slate-200 dark:border-white/10 rounded-[var(--radius-button)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-[var(--color-text)]"
                    />
                  )}
                </div>
              )}
            </div>

            {forensicsPrompt && aiInsights && (
              <div role="alert" className="rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-bold">{dt('Analiza e fotos nuk mundi ta konfirmojë dëshminë')}</p>
                <p className="mt-1 text-sm leading-relaxed">
                  {dt('Kjo mund të ndodhë me foto të errëta, të paqarta ose pamje ekrani. Nuk e bllokon raportin: stafi e shqyrton çdo raport para publikimit dhe do ta shohë këtë shënim.')}
                </p>
                {aiInsights.forensicsReport && (
                  <p className="mt-2 rounded bg-white/60 p-2 text-sm dark:bg-black/20">{String(aiInsights.forensicsReport).slice(0, 600)}</p>
                )}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => { setForensicsPrompt(false); setStep(1); }}
                    className="min-h-11 rounded-lg border border-amber-700 px-4 text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  >
                    {dt('Ndrysho dëshminë')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { forensicsAcknowledged.current = true; setForensicsPrompt(false); void handleSubmit(); }}
                    className="min-h-11 rounded-lg bg-amber-700 px-4 text-sm font-semibold text-white hover:bg-amber-800"
                  >
                    {dt('Dërgo gjithsesi për shqyrtim')}
                  </button>
                </div>
              </div>
            )}

            {submitError && (
              <div ref={submitErrorRef} tabIndex={-1} role="alert" className="flex items-start gap-3 rounded-xl border-l-4 border-rose-600 bg-rose-50 p-4 text-rose-900 outline-none dark:bg-rose-950/40 dark:text-rose-100">
                <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm font-semibold leading-relaxed">{submitError}</p>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="flex min-h-14 w-full items-center justify-center gap-3 border-2 border-transparent bg-indigo-600 p-4 text-sm font-bold tracking-wide text-white transition-colors hover:border-slate-900 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-70 md:p-6"
              >
                {isSubmitting ? (
                  <><Loader2 aria-hidden="true" className="w-4 h-4 md:w-5 md:h-5 animate-spin" />{dt(`PROCESIMI...`)}</>
                ) : (
                  dt('Dërgo raportin')
                )}
              </button>
              <p className="mt-3 text-center text-sm text-slate-600 dark:text-slate-300">
                {dt('Pas dërgimit merrni një Track-ID. Raporti shqyrtohet nga stafi para se të bëhet publik.')}
              </p>
            </div>
          </div>
        </form>
      )}

      {step === 2 && isSubmitting && (
        <div role="status" aria-live="polite" className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-[28px] p-8 md:p-16 text-center animate-in zoom-in-95 duration-500 max-w-2xl mx-auto relative overflow-hidden flex flex-col items-center justify-center min-h-[420px]">
          <div className="relative z-10">
            <div aria-hidden="true" className="w-24 h-24 bg-indigo-600/10 border-2 border-indigo-200 rounded-full flex items-center justify-center mx-auto mb-8 relative">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] dark:text-white tracking-tight mb-4">{dt(`Duke Procesuar`)}</h2>
            <p className="text-[var(--color-text-muted)] dark:text-slate-300 font-medium max-w-md mx-auto leading-relaxed">{dt(`Raporti juaj po dërgohet në sistem të sigurt. Verifikimi i lokacionit, kategorisë dhe sigurisë po bëhet në kohë reale...`)}</p>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-[28px] p-8 md:p-14 text-center animate-in zoom-in-95 duration-500 max-w-2xl mx-auto relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 px-3 md:px-4 py-1 text-xs md:text-xs font-bold tracking-wide border-b-4 border-l-4 border-white">{dt(`Raporti: Në shqyrtim`)}
          </div>
          
          <div className="w-20 h-20 md:w-28 md:h-28 bg-emerald-50 border-2 border-emerald-200 rounded-[28px] flex items-center justify-center mx-auto mb-6 md:mb-8 relative">
            <CheckCircle2 className="w-10 h-10 md:w-16 md:h-16 text-emerald-600 relative z-10" />
          </div>
          <h1 ref={stepHeadingRef} tabIndex={-1} className="text-[28px] md:text-[36px] font-bold text-[var(--color-text)] dark:text-white tracking-tight mb-4 outline-none">{dt(`Raportimi u pranua`)}<span className="text-indigo-600">.</span></h1>
          <p className="text-slate-600 dark:text-slate-200 font-medium text-sm md:text-base lg:text-lg mb-6 md:mb-8 font-serif italic max-w-md mx-auto">{dt(`Raportimi iu dërgua agjentëve dhe administratorëve për shqyrtim. Përdorni Track-ID për ta ndjekur statusin e tij në çdo moment.`)}</p>
          <div className="w-full mb-8 rounded-2xl border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800 p-4 text-left shadow-inner">
            <div className="text-xs text-slate-600 dark:text-slate-300 font-bold">{dt('Track-ID i raportimit')}</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <code className="text-lg font-black tracking-wider text-slate-900 dark:text-white break-all">{submittedReportId}</code>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(submittedReportId);
                    toast.success(dt('Track-ID u kopjua.'));
                  } catch {
                    toast.error(dt('Kopjimi nuk u realizua. Shënojeni Track-ID me dorë.'));
                  }
                }}
                className="shrink-0 min-h-11 px-3 text-sm font-bold text-blue-700 hover:text-blue-800 dark:text-blue-300"
              >{dt('Kopjo')}</button>
            </div>
          </div>
          
          <div role="note" className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-xs leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
            <p className="font-black">{dt('Çfarë ndodh tani')}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>{dt('Statusi është “Në pritje”: raporti pret shqyrtimin. Nuk është ende publik.')}</li>
              <li>{dt('Pasi të aprovohet, dërgohet te institucioni përgjegjës dhe shfaqet në hartë dhe regjistër.')}</li>
              <li>{dt('Ruajeni Track-ID: është mënyra e vetme për ta ndjekur raportin pa llogari. Platforma nuk dërgon email konfirmimi.')}</li>
            </ul>
          </div>

          {currentUser && (
            <div className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-blue-700 text-white px-6 md:px-8 py-3 md:py-4 font-bold tracking-wide text-xs md:text-xs mb-8 md:mb-10 w-full rounded-2xl shadow-lg shadow-indigo-600/20">
              <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-amber-300" />{dt(`Titulli: +10 Pikë Qytetare`)}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={() => navigate(`/trackid?id=${encodeURIComponent(submittedReportId)}`)} className="flex-1 px-6 md:px-8 py-4 md:py-5 bg-slate-900 hover:bg-[#003865] text-white font-bold tracking-wide text-xs md:text-xs transition-colors border border-slate-200/60 dark:border-white/10 rounded-xl">{dt(`Ndiq raportimin`)}
            </button>
            <button onClick={startNewReport} className="flex-1 px-6 md:px-8 py-4 md:py-5 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[var(--color-text)] dark:text-white border border-slate-200/60 dark:border-white/10 rounded-xl font-bold tracking-wide text-xs md:text-xs transition-colors">{dt(`Rast i Ri`)}
            </button>
          </div>
        </div>
       )}

     </motion.div>
    </>
  );
}

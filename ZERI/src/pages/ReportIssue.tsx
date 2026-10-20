import { AuraHero, AuraOrbit } from '../components/aura/Aura';
import { dt } from '@/src/lib/dt';
import React, { useState, useEffect, useRef, Component } from 'react';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '../lib/store';
import { useLanguage } from '../lib/LanguageContext';
import { Camera, MapPin, AlertCircle, CheckCircle2, ChevronRight, Loader2, Sparkles, ArrowLeft, ShieldAlert, FileText, Music } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UrgentLevel } from '../types';
import { cn } from '../lib/utils';
import { getAccountabilityDueDate, getAccountabilityProfile } from '../lib/accountability';
import { SECTOR_CATALOG, LEVEL_LABEL, checkLocation, nearestMunicipality, sectorByName, sectorLabel, suggestSectors } from '../lib/sectorCatalog';

import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

import { KOSOVO_MUNICIPALITIES, MUNICIPALITY_COORDINATES } from '../lib/constants';
import { getReportTopicValueLabel, REPORT_TOPICS } from '../lib/reportTopics';
import { isSpecificScope, scopeKey } from '../lib/municipalityScope';
import { compressImage, looksLikeImage } from '../lib/imageCompress';
import { auth, db, uploadFileToStorage, MAX_UPLOAD_BYTES, MAX_REPORT_VIDEO_BYTES, REPORT_MEDIA_LIMITS, formatBytes } from '../lib/firebase';
import { authHeaders } from '../lib/apiAuth';
import { doc, setDoc, getDocFromServer, collection, serverTimestamp } from 'firebase/firestore';
import { fetchWithTimeout, isJsonResponse, withTimeout } from '../lib/timeouts';
import { apiReady, markApiUnavailable } from '../lib/apiAvailability';
import { createTrackingId, saveGuestReportHistory } from '../lib/session';
import { ensureReportSession } from '../lib/reportSession';


import { validations, runValidations } from '../lib/validations';
import { handleFirebaseError } from '../lib/errorHandler';

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

function LocationMarker({ position, setPosition, setAddress, setMunicipality, preventSearchRef }: { position: [number, number], setPosition: (pos: [number, number]) => void, setAddress: (addr: string) => void, setMunicipality: (m: string) => void, preventSearchRef?: React.MutableRefObject<boolean> }) {
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
          if (!city || !mapToKosovoMunicipality(city)) {
            const near = nearestMunicipality(lat, lng);
            if (near && near.km < 25) setMunicipality(near.name);
          }
          if (preventSearchRef) preventSearchRef.current = true;
          setAddress(data.display_name);
        }
      } catch (err) {
         console.error(err);
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
  const currentUser = useStore(state => state.currentUser);
  const addPoints = useStore(state => state.addPoints);
  const categories = useStore(state => state.categories);
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [submittedReportId, setSubmittedReportId] = useState('');
  const startTime = useRef(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** What the processing screen says is happening right now. */
  const [submitStage, setSubmitStage] = useState('');
  /**
   * One report id per attempt *series*: a retry after a timeout reuses it, so the
   * server (clientReportId) and the direct write both land on the same document
   * instead of creating a duplicate when the first try did reach the database.
   */
  const pendingReportIdRef = useRef<string | null>(null);

  // Warm up while the citizen fills the form: the anonymous session (its uid owns
  // the report and its media) and the check whether /api is usable. Pressing
  // "Protokollo" then only uploads and saves, with nothing left to wait for.
  useEffect(() => {
    void ensureReportSession();
    void apiReady();
  }, []);

  // Each step starts at its top. The "next" and "send" buttons sit at the bottom of a
  // long form, so the next screen used to appear with the reader left far down it.
  const topRef = useRef<HTMLDivElement | null>(null);
  const firstStepRender = useRef(true);
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    topRef.current?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
  }, [step, isSubmitting]);

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [mediaError, setMediaError] = useState(false);
  
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

  // Every institution of Kosovo by topic and level lives in the sector catalog.
  const defaultCategories: { name: string; group: string; keywords: string }[] = SECTOR_CATALOG.map(e => ({ name: e.name, group: e.group, keywords: e.keywords }));

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
  const [coordinates, setCoordinates] = useState<[number, number]>([42.6629, 21.1655]);

  /** Bodies that answer the chosen topic, named after the chosen municipality. */
  const sectorSuggestions = React.useMemo(
    () => suggestSectors({ topicId: topicCategory, municipality, text: `${title} ${description}` }),
    [topicCategory, municipality, title, description]
  );
  /** True while `category` was filled by the suggestion, so a new topic may replace it; a manual pick is never overwritten. */
  const categoryAutoRef = useRef(false);
  useEffect(() => {
    if (!topicCategory || sectorSuggestions.length === 0) return;
    if (category && !categoryAutoRef.current) return;
    const best = sectorSuggestions[0].entry.name;
    if (best !== category) {
      categoryAutoRef.current = true;
      setCategory(best);
    }
  }, [topicCategory, sectorSuggestions]);
  const pickSector = (name: string) => {
    categoryAutoRef.current = false;
    setCategory(name);
    setCategorySearchTerm('');
    setIsCategoryDropdownOpen(false);
    setErrors(prev => (prev.category ? { ...prev, category: '' } : prev));
  };
  const locationCheck = React.useMemo(
    () => checkLocation(coordinates[0], coordinates[1], municipality),
    [coordinates, municipality]
  );

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

  const analyzeWithAI = async () => {
    // AI vision analysis only makes sense for a photo; a video, document or
    // voice note has no frame to read, so pick the first image explicitly.
    const imageMedia = mediaItems.find(m => m.type === 'image');
    if (!imageMedia) {
      toast.error(dt("Ju lutem ngarkoni të paktën një foto për t'u analizuar nga AI."));
      return;
    }

    const imageFile = imageMedia.file;
    setIsAnalyzing(true);
    
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
        throw new Error("Dështoi analiza AI");
      }
      
      const data = await res.json();
      
       if (data?.degraded) {
        toast.error(dt('Analiza AI nuk është e disponueshme tani. Plotësoni fushat vetë.'));
      } else if (data && (data.category || data.title)) {
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
        if (data.category) setCategory(data.category);
        if (data.urgency) setUrgency(data.urgency);
        setAiInsights(data);
      } else {
        toast.error("Nuk arritëm të gjejmë kategorinë e duhur për këtë problem.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Pati një gabim gjatë procesimit me AI. Ju lutem provoni përsëri ose zgjidhni kategorinë manualisht.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  /** Length of a video in seconds, read from its metadata; null when the browser cannot read it. */
  const videoSeconds = (url: string) => new Promise<number | null>((resolve) => {
    const probe = document.createElement('video');
    const done = (value: number | null) => { probe.removeAttribute('src'); probe.load(); resolve(value); };
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? probe.duration : null);
    probe.onerror = () => done(null);
    setTimeout(() => done(null), 5000);
    probe.src = url;
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // Allow re-selecting the same file after a validation error.
    e.target.value = '';
    const limits = REPORT_MEDIA_LIMITS;
    let images = mediaItems.filter(m => m.type === 'image').length;
    let videos = mediaItems.filter(m => m.type === 'video').length;
    for (const picked of files) {
      // Photos are shrunk to ~1600 px JPEG first (HEIC included): seconds to upload on 4G instead of minutes.
      const file = looksLikeImage(picked) ? await compressImage(picked) : picked;
      const mime = file.type || '';
      const type: 'image' | 'video' | 'audio' | 'document' =
        mime.startsWith('video/') ? 'video'
        : mime.startsWith('audio/') ? 'audio'
        : mime.startsWith('image/') ? 'image'
        : 'document';
      if (type === 'image' && images >= limits.images) {
        toast.error(dt(`Maksimumi është ${limits.images} foto.`));
        continue;
      }
      if (type === 'video' && videos >= limits.videos) {
        toast.error(dt(`Maksimumi është ${limits.videos} video.`));
        continue;
      }
      const cap = type === 'video' ? MAX_REPORT_VIDEO_BYTES : MAX_UPLOAD_BYTES.reports;
      if (file.size > cap) {
        toast.error(dt(`Fajlli "${file.name}" është ${(file.size / 1024 / 1024).toFixed(1)}MB. Kufiri është ${formatBytes(cap)}.`));
        continue;
      }
      const url = type === 'image' || type === 'video' ? URL.createObjectURL(file) : '';
      if (type === 'video') {
        const seconds = await videoSeconds(url);
        if (seconds !== null && seconds > limits.videoSeconds + 0.5) {
          URL.revokeObjectURL(url);
          toast.error(dt(`Videoja "${file.name}" zgjat ${Math.round(seconds)} sekonda. Maksimumi është ${limits.videoSeconds} sekonda.`));
          continue;
        }
        videos++;
      } else if (type === 'image') {
        images++;
      }
      setMediaItems(prev => [...prev, { file, url, type }].slice(0, 16));
      setMediaError(false);
    }
  };

  const removeMedia = (index: number) => {
    setMediaItems(prev => prev.filter((_, i) => i !== index));
  };

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    const titleErr = validations.isRequired(title, 'Emërtimi i Çështjes') || validations.minLength(title, 5, 'Emërtimi i Çështjes');
    if (titleErr) newErrors.title = titleErr;
    
    const descErr = validations.isRequired(description, 'Raporti i Detajuar') || validations.minLength(description, 20, 'Raporti i Detajuar');
    if (descErr) newErrors.description = descErr;
    
    const catErr = validations.isRequired(category, 'Sektori / Ministria');
    if (catErr) newErrors.category = catErr;

    const topicErr = validations.isRequired(topicCategory, 'Kategoria tematike');
    if (topicErr) newErrors.topicCategory = topicErr;
    
    const munErr = validations.isRequired(municipality, 'Komuna');
    if (munErr) newErrors.municipality = munErr;

    if (municipality) {
      const where = checkLocation(coordinates[0], coordinates[1], municipality);
      if (where.status === 'outside') newErrors.location = where.message;
    }

    if ((!currentUser || currentUser?.role === 'guest') && !isAnonymous) {
      const nameErr = validations.isRequired(guestName, 'Emri dhe Mbiemri') || validations.minLength(guestName, 3, 'Emri dhe Mbiemri');
      if (nameErr) newErrors.guestName = nameErr;
      
      const phoneErr = validations.isRequired(guestPhone, 'Telefoni') || validations.isPhone(guestPhone);
      if (phoneErr) newErrors.guestPhone = phoneErr;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      // The errors print next to their fields, far above this button on a phone:
      // without this the press looked like it did nothing at all.
      toast.error(dt('Plotësoni fushat e shënuara më lart.'));
      window.setTimeout(() => {
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'center' });
      }, 60);
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitStage(dt('Duke verifikuar sesionin...'));
    const timeSpentMs = Date.now() - startTime.current;
    
    try {
      // 0. Firestore requires `authorId == request.auth.uid`, so a report can
      //    only be stored together with a real identity. Guarantee one up front
      //    instead of showing a Track ID for a report that was never persisted.
      const authorUid = await ensureReportSession();
      if (!authorUid || !auth.currentUser) {
        toast.error(
          'Për të ruajtur raportin nevojitet një sesion aktiv. Kyçuni ose vazhdoni si mysafir (Guest) dhe provoni përsëri — të dhënat e formës ruhen.',
          { duration: 10000 }
        );
        setIsSubmitting(false);
        return;
      }

      // The report id is generated up front so media lands under
      // reports/{uid}/{reportId}/... which the Storage rules accept.
      if (!pendingReportIdRef.current) pendingReportIdRef.current = doc(collection(db, 'reports')).id;
      const reportRef = doc(db, 'reports', pendingReportIdRef.current);

      // No automatic gate: nothing here decides whether a report is accepted. Photos,
      // videos and text are kept as sent; a person on the admin side reviews the report
      // (status 'Pending Review') and the citizen gets the Track ID straight away.

      // Simulate AI Moderation for Text
      const { validateReportByAI } = await import('../lib/moderation');
      const aiCheck = await validateReportByAI(title, description);
      
      if (!aiCheck.valid) {
        toast.error(aiCheck.error);
        setIsSubmitting(false);
        return;
      }

      const reportData: any = {
        title,
        description,
        category: category || 'Të tjera',
        topicCategory,
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
            municipality: municipality || 'Prishtinë',
            createdAt: reportData.createdAt
          });
        }
        setSubmittedReportId(finalTrackingId);
        pendingReportIdRef.current = null;
        if (currentUser) addPoints(10);
        localStorage.removeItem('reportDraft');
        setStep(3);
      };

      if (mediaItems.length > 0) {
        setSubmitStage(dt(`Duke ngarkuar ${mediaItems.length} foto/video/dokument...`));
      }
      let uploadedCount = 0;
      const sentBytes = new Map<number, number>();
      const totalBytes = mediaItems.reduce((sum, m) => sum + m.file.size, 0) || 1;
      const showProgress = () => {
        const sent = Array.from(sentBytes.values()).reduce((a, b) => a + b, 0);
        const pct = Math.min(99, Math.round((sent / totalBytes) * 100));
        setSubmitStage(dt(`Duke ngarkuar ${mediaItems.length} foto/video/dokument... ${pct}% (${uploadedCount} nga ${mediaItems.length} gati)`));
      };
      const uploadResults = await Promise.allSettled(
        mediaItems.map(async (media, index) => {
          const send = () => uploadFileToStorage(media.file, 'reports', {
            userId: authorUid,
            scope: reportRef.id,
            onProgress: (sent) => { sentBytes.set(index, sent); showProgress(); },
          });
          // One retry, but only for a flaky link: a refusal (permissions, format) repeats identically.
          const downloadUrl = await send().catch((error: Error) =>
            /refuzua|konfiguruar|plotë/.test(error.message) ? Promise.reject(error) : send());
          uploadedCount += 1;
          sentBytes.set(index, media.file.size);
          showProgress();
          return {
            url: downloadUrl,
            type: media.type,
            name: media.file.name,
            sizeBytes: media.file.size,
            mimeType: media.file.type || undefined,
          };
        })
      );
      const uploadedMedia = uploadResults.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
      const failedUploads = uploadResults.filter(result => result.status === 'rejected');
      if (failedUploads.length > 0) {
        const firstReason = (failedUploads[0] as PromiseRejectedResult).reason;
        const reasonText = firstReason instanceof Error ? firstReason.message : 'Gabim i panjohur gjatë ngarkimit.';
        console.warn('Media upload failed:', reasonText);
        // Never drop the citizen's evidence silently: they choose to send without it or retry.
        const sendWithout = window.confirm(
          dt(`${failedUploads.length} nga ${mediaItems.length} foto/video nuk u ngarkuan (${reasonText}). Shtypni "OK" për ta dërguar raportin pa to, ose "Anulo" për të provuar përsëri (të dhënat ruhen).`)
        );
        if (!sendWithout) {
          setIsSubmitting(false);
          return;
        }
      }

      reportData.images = uploadedMedia.filter(m => m.type === 'image').map(m => m.url);
      reportData.media = uploadedMedia;

      /*
       * Preferred path: the server endpoint. The server re-validates fields,
       * applies a per-uid duplicate + rate window and assembles the document
       * itself, so a modified client cannot skip those checks. The direct
       * Firestore write below remains as the fallback for the case where the
       * server is unreachable — the security rules still bound what that write
       * may contain, and the citizen's report is never lost either way.
       */
      setSubmitStage(dt('Duke ruajtur raportin dhe duke krijuar Track ID...'));
      let serverRefusal: string | null = null;
      try {
        const token = auth.currentUser
          ? await withTimeout(auth.currentUser.getIdToken(), 15000, 'Tokeni i sesionit nuk u mor në kohë.')
          : null;
        // Only a server that can store the report is worth waiting for; otherwise the
        // report goes straight to Firestore below, which is what makes the Track ID fast.
        if (token && await apiReady()) {
          const response = await fetchWithTimeout('/api/v1/reports', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: reportData.title,
              description: reportData.description,
              category: reportData.category,
              topicCategory: reportData.topicCategory,
              urgency: reportData.urgency,
              location: reportData.location,
              media: reportData.media,
              isAnonymous: reportData.isAnonymous === true,
              authorName: reportData.authorName ?? '',
              // The server mints the Track ID; the report id only makes a retry idempotent.
              clientReportId: reportRef.id,
              aiCategoryScore: reportData.aiCategoryScore,
              aiRoutingReason: reportData.aiRoutingReason,
              aiForensicsReport: reportData.aiForensicsReport,
            }),
          }, 20000);

          // Only a JSON answer is the API: a static host without the /api forward
          // answers 200 with index.html, which is not a stored report.
          const body = isJsonResponse(response)
            ? await response.json().catch(() => null) as { id?: string; trackingId?: string; error?: string } | null
            : null;

          if (response.ok && body?.trackingId && body?.id) {
            reportData.trackingId = body.trackingId;
            reportData.id = body.id;
            addReport({ ...reportData, id: body.id } as any);
            confirmSubmission(body.trackingId, body.id);
            return;
          }
          // The server read the report and refused it (validation, duplicate, rate):
          // say why instead of writing around a decision it just made.
          if (body && [400, 409, 413, 422, 429].includes(response.status)) {
            serverRefusal = body.error || 'Raportimi u refuzua nga serveri.';
          }
          // Any other answer (5xx, HTML, no API) falls through to the direct write.
          if (!serverRefusal) markApiUnavailable();
        }
      } catch (error) {
        markApiUnavailable();
        console.warn('Server path unavailable; falling back to direct Firestore write.', error);
      }
      if (serverRefusal) {
        toast.error(serverRefusal, { duration: 8000 });
        return;
      }

      // Server unreachable: the only case the browser has to mint an id itself.
      reportData.trackingId = createTrackingId('ZQ', reportRef.id);
      try {
        // A Firestore write settles only when the server acknowledges it, which on a
        // dead link is never. Bound it, then ask the server whether it landed anyway.
        await withTimeout(setDoc(reportRef, {
          ...reportData,
          createdAt: serverTimestamp() // native firebase timestamp
        }), 45000, 'Ruajtja zgjati shumë.');
      } catch (e) {
        const landed = await withTimeout(getDocFromServer(reportRef), 10000, 'timeout')
          .then(snap => snap.exists() ? (snap.data() as { trackingId?: string }) : null)
          .catch(() => null);
        if (landed) {
          reportData.trackingId = landed.trackingId || reportData.trackingId;
          addReport({ ...reportData, id: reportRef.id });
          confirmSubmission(reportData.trackingId, reportRef.id);
          return;
        }
        // The report was not stored anywhere the municipality or platform can
        // see. Saying otherwise (the old "saved locally" success toast and Track
        // ID) left citizens waiting on a complaint that did not exist. Keep the
        // form and the draft so they can simply try again.
        const appError = handleFirebaseError(e);
        console.warn('Firestore save failed; the report was NOT stored.', appError.technicalMessage);
        toast.error(
          'Raporti NUK u dërgua dhe nuk u krijua Track ID. Të dhënat e formës janë ruajtur në këtë pajisje — kontrolloni lidhjen dhe provoni përsëri.',
          { duration: 10000 }
        );
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
      toast.error(appError.message || 'Ka ndodhur një gabim gjatë procesimit të të dhënave, provoni përsëri.');
    } finally {
      setIsSubmitting(false);
      setSubmitStage('');
    }
  };

  return (
    <>
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      ref={topRef}
      className="max-w-4xl mx-auto pt-6 pb-32 md:py-12 px-4 sm:px-6 lg:px-8 scroll-mt-20"
    >
      
      {/* STEPS INDICATOR */}
      {step < 3 && (
        <div className="flex items-center justify-center gap-4 mb-8 md:mb-16 w-full max-w-xs md:max-w-md mx-auto">
          <div className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 border-2 font-bold text-xs md:text-sm title-serif ${step === 1 ? 'bg-slate-900 dark:bg-slate-800 text-white dark:text-white border-slate-900 dark:border-white' : 'bg-transparent text-[var(--color-text)] dark:text-white border-slate-900 dark:border-white'}`}>1</div>
          <div className="h-0.5 flex-1 bg-neutral-300"><div className={`h-full bg-indigo-600 transition ${step > 1 ? 'w-full' : 'w-0'}`} /></div>
          <div className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 border-2 font-bold text-xs md:text-sm title-serif transition-colors ${step === 2 ? 'bg-slate-900 dark:bg-slate-800 text-white dark:text-white border-slate-900 dark:border-white' : 'bg-transparent text-neutral-500 dark:text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] border-neutral-300 dark:border-slate-700'}`}>2</div>
        </div>
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
          <div className="absolute top-0 right-0 bg-indigo-600 text-white px-3 md:px-4 py-1 text-xs md:text-xs font-bold tracking-wide border-b-4 border-l-4 border-slate-900 dark:border-slate-700 rounded-bl-xl rounded-tr-xl">{dt(`Nr: 01`)}
          </div>

          <div className="mb-8 md:mb-12">
            <h2 className="text-[28px] sm:text-[40px] font-bold text-[var(--color-text)] dark:text-white tracking-tight mb-4 leading-[1.1]">{dt(`Hap`)}{' '}<br className="sm:hidden" />{dt(`Procedurën`)}<span className="text-indigo-600">.</span>
            </h2>
            <p className="text-slate-700 dark:text-slate-200 dark:text-[var(--color-text-muted)] max-w-sm md:max-w-md font-serif italic text-sm md:text-lg">{dt(`Paraqit një çështje që ndikon drejtpërdrejt në shoqëri ose proceset e lëvizjes.`)}</p>
          </div>
          
          <div className="space-y-6 md:space-y-8">
            <div>
               <div data-tour="report-upload" className="border-2 border-dashed border-slate-300 dark:border-white/20 p-4 md:p-8 flex flex-col items-center justify-center bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900/50 hover:bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:hover:bg-slate-800/50 dark:bg-slate-800 dark:hover:bg-slate-800 transition-colors relative h-40 sm:h-56 md:h-72 group cursor-pointer overflow-hidden mb-4 rounded-2xl">
                 <div className="w-12 h-12 md:w-20 md:h-20 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-2xl flex items-center justify-center mb-3 md:mb-6 group-hover:-translate-y-2 transition-transform">
                   <Camera className="w-6 h-6 md:w-8 md:h-8 text-blue-900" />
                 </div>
                 <span className="text-xs md:text-lg font-bold text-[var(--color-text)] dark:text-white mb-1 uppercase tracking-wide title-serif text-center">{dt(`Ngarko Dëshminë (Foto/Video/Dokument/Audio)`)}</span>
                 <span className="text-[10px] md:text-xs font-mono text-slate-700 dark:text-slate-200 dark:text-[var(--color-text-muted)] max-w-[220px] md:max-w-[320px] text-center uppercase">{dt(`JPG, PNG, MP4, MOV, PDF, DOC, MP3 · foto max ${formatBytes(MAX_UPLOAD_BYTES.reports)} · video max ${formatBytes(MAX_REPORT_VIDEO_BYTES)}`)}</span>
                 <span className="text-[10px] md:text-xs text-slate-600 dark:text-slate-300 mt-2 text-center">{dt(`Deri në ${REPORT_MEDIA_LIMITS.images} foto dhe ${REPORT_MEDIA_LIMITS.videos} video (secila deri në ${REPORT_MEDIA_LIMITS.videoSeconds} sekonda)`)}</span>
                 <input type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
               </div>

               {mediaItems.length > 0 && (
                 <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-6">
                   {mediaItems.map((media, idx) => (
                     <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group border border-slate-200/60 dark:border-white/10">
                       {media.type === 'image' ? (
                         <img src={media.url} alt="Preview" className="w-full h-full object-cover mix-blend-luminosity group-hover:mix-blend-normal transition" />
                       ) : media.type === 'video' ? (
                         <video src={media.url} className="w-full h-full object-cover mix-blend-luminosity group-hover:mix-blend-normal transition" muted playsInline />
                       ) : (
                         <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[var(--color-surface-subtle)] p-2 text-center">
                           {media.type === 'audio'
                             ? <Music className="w-6 h-6 text-indigo-600" />
                             : <FileText className="w-6 h-6 text-indigo-600" />}
                           <span className="text-[10px] font-bold text-[var(--color-text)] dark:text-white truncate w-full">{media.file.name}</span>
                         </div>
                       )}
                       <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                         <button type="button" onClick={() => removeMedia(idx)} className="text-white text-xs font-bold uppercase border-b-2 border-indigo-600 pb-0.5 hover:text-rose-400">{t('remove')}</button>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
               
               {mediaItems.length > 0 && (
                 <div className="bg-blue-900 border-l-4 border-red-500 rounded-l-xl p-3 md:p-5 flex gap-3 text-white items-start">
                   <Sparkles className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0 text-[#C5A059]" />
                   <p className="text-xs md:text-xs font-bold tracking-wide leading-relaxed">{t('report_ai_analysis_msg')}</p>
                 </div>
               )}
            </div>

            {mediaError && (
              <div className="bg-rose-50 border-l-4 border-indigo-600 p-4 mb-6 rounded-r-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-rose-700 text-xs md:text-sm font-bold">{t('report_error_media')}</p>
              </div>
            )}

            <button 
              data-tour="report-continue"
              onClick={() => {
                if (mediaItems.length === 0) {
                  setMediaError(true);
                  setTimeout(() => setMediaError(false), 5000);
                  return;
                }
                setStep(2);
              }}
              className="w-full flex items-center justify-center gap-3 p-4 md:p-5 font-bold transition tracking-wide text-sm md:text-sm border rounded-xl active:scale-[0.99] mb-8 bg-slate-900 hover:bg-indigo-600 text-white border-slate-200/60 dark:border-white/10 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] hover:shadow-indigo-500/10"
            >{dt(`Vazhdo te hapi tjetër (Konfirmo Lokacionin)`)} <ChevronRight className="w-4 h-4 animate-pulse text-rose-500" />
            </button>

            {/* Dynamic & Beautiful Step-by-Step Reporting Guide for Citizens */}
            <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-6 md:p-8 hover:border-slate-950 transition-colors duration-300">
              <div className="flex items-start gap-3 mb-6 border-b border-slate-200/60 dark:border-white/10 pb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shadow-indigo-600/20 shrink-0">
                  ?
                </div>
                <div>
                  <h3 className="font-bold text-[var(--color-text)] dark:text-white text-sm md:text-base uppercase tracking-wider">{dt(`Nuk dini si të raportoni? Ndihmë e Shpejtë`)}</h3>
                  <p className="text-xs text-neutral-500 dark:text-[var(--color-text-muted)]">{dt(`Mësoni si të dërgoni një raportim të saktë dhe me impakt në komunitet vetëm me 3 hapa të thjeshtë.`)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-800 p-5 border border-slate-200/60 dark:border-white/10 rounded-xl flex flex-col justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-shadow">
                  <div>
                    <div className="w-7 h-7 rounded-full bg-slate-900 text-rose-500 flex items-center justify-center font-bold text-xs mb-3 shadow-sm dark:shadow-none">
                      1
                    </div>
                    <h4 className="font-bold text-[var(--color-text)] dark:text-white text-xs uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>{dt(`Ngarko Dëshminë`)}
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-[var(--color-text-muted)] leading-relaxed font-semibold">{dt(`Bëni një foto ose video të problemit (gropë në rrugë, ndotje mjedisore, shtyllë e dëmtuar) dhe ngarkojeni te kutia më lart.`)}
                    </p>
                  </div>
                  <p className="text-[10px] text-indigo-600 font-bold mt-3 border-t border-slate-100 dark:border-white/5 pt-2 uppercase tracking-wider">{dt(`Foto duhet të jetë e qartë`)}
                  </p>
                </div>
                
                <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-800 p-5 border border-slate-200/60 dark:border-white/10 rounded-xl flex flex-col justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-shadow">
                  <div>
                    <div className="w-7 h-7 rounded-full bg-slate-900 text-rose-500 flex items-center justify-center font-bold text-xs mb-3 shadow-sm dark:shadow-none">
                      2
                    </div>
                    <h4 className="font-bold text-[var(--color-text)] dark:text-white text-xs uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>{dt(`Vendodhja`)}
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-[var(--color-text-muted)] leading-relaxed font-semibold">{dt(`Sistemi do të gjejë GPS tuaj automatikisht, ose mund të klikoni`)} <strong>{dt(`direkt mbi hartë`)}</strong>{dt(`për të vendosur pikën e saktë ku ndodhet problemi.`)}
                    </p>
                  </div>
                  <p className="text-[10px] text-indigo-600 font-bold mt-3 border-t border-slate-100 dark:border-white/5 pt-2 uppercase tracking-wider">{dt(`Kliko mbi Hartë për saktësi`)}
                  </p>
                </div>
                
                <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-800 p-5 border border-slate-200/60 dark:border-white/10 rounded-xl flex flex-col justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-shadow">
                  <div>
                    <div className="w-7 h-7 rounded-full bg-slate-900 text-rose-500 flex items-center justify-center font-bold text-xs mb-3 shadow-sm dark:shadow-none">
                      3
                    </div>
                    <h4 className="font-bold text-[var(--color-text)] dark:text-white text-xs uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>{dt(`Detajet & AI`)}
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-[var(--color-text-muted)] leading-relaxed font-semibold">{dt(`Kliko`)} <strong>{dt(`"Krijim me AI"`)}</strong>{dt(`që inteligjenca jonë të lexojë foton dhe të shkruajë automatikisht titullin/kategorinë. Më pas kliko dërgo.`)}
                    </p>
                  </div>
                  <p className="text-[10px] text-indigo-600 font-bold mt-3 border-t border-slate-100 dark:border-white/5 pt-2 uppercase tracking-wider">{dt(`E lehtë dhe automatike`)}
                  </p>
                </div>
              </div>
              
              <div className="mt-6 bg-slate-900 border-l-4 border-indigo-600 p-4 flex gap-3 text-white items-start rounded-r-xl">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="text-xs font-bold leading-relaxed space-y-1">
                  <span className="text-[10px] text-rose-500 uppercase tracking-widest block font-extrabold">{dt(`Shënim për Sigurinë`)}</span>
                  <p className="text-slate-200 font-medium font-sans">{dt(`ZëriYT është portal nga komuniteti, për komunitetin. Të gjitha të dhënat janë të sigurta dhe mund të zgjidhni të mbeteni anonim gjatë postimeve tuaja.`)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && !isSubmitting && (
        <form onSubmit={handleSubmit} className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-2xl p-4 sm:p-8 shadow-sm dark:shadow-none transition-all duration-300 animate-in fade-in slide-in-from-right-8 duration-500 relative">
          <div className="absolute top-0 right-0 bg-indigo-600 text-white px-3 md:px-4 py-1 text-xs md:text-xs font-bold tracking-wide border-b-4 border-l-4 border-slate-900 dark:border-slate-700 rounded-bl-xl rounded-tr-xl">{dt(`Nr: 02`)}
          </div>

          <div className="mb-8 md:mb-12 flex flex-col md:flex-row items-start md:items-end justify-between gap-6 border-b-2 border-slate-900 pb-6 md:pb-8">
            <div className="w-full">
              <button type="button" onClick={() => setStep(1)} className="text-slate-700 dark:text-slate-200 dark:text-[var(--color-text-muted)] hover:text-indigo-600 flex items-center gap-2 text-xs md:text-xs font-bold tracking-wide mb-4 md:mb-6 transition-colors">
                 <ArrowLeft className="w-4 h-4" />{dt(`Kthehu prapa`)}
              </button>
              <h1 className="text-[26px] sm:text-[34px] font-bold text-[var(--color-text)] dark:text-white tracking-tight mb-2  uppercase leading-none">{dt(`Specifikat e`)}<br className="hidden md:block" />{dt(`Rastit`)}<span className="text-indigo-600">.</span></h1>
            </div>
            <button type="button" data-tour="report-ai" onClick={analyzeWithAI} className="flex items-center justify-center gap-2 text-xs md:text-xs uppercase font-bold tracking-widest bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 hover:bg-neutral-200 text-[var(--color-text)] dark:text-white px-4 md:px-5 py-2.5 md:py-3 border border-slate-200/60 dark:border-white/10 rounded-xl transition-colors whitespace-nowrap group w-full md:w-auto">
               <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover:text-indigo-600" /> {isAnalyzing ? 'Po përpunohet...' : 'Krijim me AI'}
            </button>
          </div>

          <div className="space-y-6 md:space-y-8">
            <div>
              <label className="block text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide mb-2 md:mb-3 border-l-2 border-indigo-600 pl-3">{dt(`Emërtimi i Çështjes`)}</label>
              <input 
                required
                type="text" 
                value={title}
                onChange={(e) => { setTitle(e.target.value); if(errors.title) setErrors({...errors, title: ''}) }}
                placeholder={dt(`Psh. Shkatërrimi i infrastrukturës urbane...`)} 
                className={cn("w-full px-4 md:px-5 py-3 md:py-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border outline-none transition-colors font-bold text-[var(--color-text)] dark:text-white placeholder:font-medium placeholder:text-neutral-500 dark:text-[var(--color-text-muted)] text-sm md:text-base", errors.title ? "border-indigo-600 focus:border-indigo-600" : "border-neutral-300 focus:border-slate-900")}
              />
              {errors.title && <p data-field-error className="text-indigo-600 text-[10px] sm:text-xs font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.title}</p>}
            </div>

            <div>
              <label className="block text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide mb-2 md:mb-3 border-l-2 border-indigo-600 pl-3">{dt(`Raporti i Detajuar`)}</label>
              <textarea 
                required
                value={description}
                onChange={(e) => { setDescription(e.target.value); if(errors.description) setErrors({...errors, description: ''}) }}
                rows={5} 
                className={cn("w-full px-4 md:px-5 py-3 md:py-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border outline-none transition-colors resize-none font-medium text-[var(--color-text)] dark:text-white placeholder:font-normal placeholder:text-neutral-500 dark:text-[var(--color-text-muted)] font-serif italic text-sm md:text-base", errors.description ? "border-indigo-600 focus:border-indigo-600" : "border-neutral-300 focus:border-slate-900")}
                placeholder={dt(`Paraqisni me detaje natyrën e problemit...`)}
              />
              {errors.description && <p data-field-error className="text-indigo-600 text-[10px] sm:text-xs font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.description}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 p-4 md:p-8 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900/50 border border-slate-200/60 dark:border-white/10 rounded-xl">
              <div data-tour="report-topic">
                <label htmlFor="report-topic-category" className="mb-2 block border-l-2 border-indigo-600 pl-3 text-xs font-bold tracking-wide text-[var(--color-text)] dark:text-white">
                  {dt('Kategoria e raportimit')}
                </label>
                <select
                  id="report-topic-category"
                  required
                  value={topicCategory}
                  onChange={event => {
                    setTopicCategory(event.target.value);
                    if (errors.topicCategory) setErrors({ ...errors, topicCategory: '' });
                  }}
                  className={cn(
                    'w-full appearance-none rounded-xl border bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:text-white',
                    errors.topicCategory ? 'border-indigo-600' : 'border-slate-200 dark:border-white/10'
                  )}
                >
                  <option value="">{dt('Zgjidhni temën kryesore')}</option>
                  {REPORT_TOPICS.map(topic => (
                    <option key={topic.id} value={topic.id}>{getReportTopicValueLabel(topic.id)}</option>
                  ))}
                </select>
                {errors.topicCategory && <p data-field-error className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-indigo-600"><AlertCircle className="h-3 w-3" />{errors.topicCategory}</p>}
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {dt('Kjo temë ndihmon kërkimin, hartën dhe statistikat; zgjedhja e institucionit poshtë përcakton adresimin e raportit.')}
                </p>
              </div>
              <div className="relative" ref={categoryDropdownRef} data-tour="report-sector">
                <label className="flex items-center gap-2 text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide mb-2 border-l-2 border-indigo-600 pl-3">{dt(`Sektori / Ministria (Kërko Problemin)`)}
                  {isAnalyzing && <span className="flex h-2 w-2 relative ml-2"><span className="animate-ping absolute inline-flex h-full w-full bg-indigo-600 opacity-75"></span><span className="relative inline-flex h-2 w-2 bg-indigo-600"></span></span>}
                </label>
                <div 
                  className={cn(
                    "w-full px-4 md:px-5 py-3 md:py-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border outline-none transition-colors font-bold uppercase text-xs md:text-xs tracking-wider cursor-text flex items-center justify-between",
                    isAnalyzing ? "border-indigo-600 text-indigo-600" : (errors.category ? "border-indigo-600 text-[var(--color-text)] dark:text-white" : "border-neutral-300 text-[var(--color-text)] dark:text-white")
                  )}
                  onClick={() => setIsCategoryDropdownOpen(true)}
                >
                  <input
                    type="text"
                    value={isCategoryDropdownOpen ? categorySearchTerm : (category ? (sectorByName(category) ? dt(sectorLabel(sectorByName(category)!, municipality)) : dt(category)) : '')}
                    onChange={(e) => {
                      setCategorySearchTerm(e.target.value);
                      setIsCategoryDropdownOpen(true);
                      if(errors.category) setErrors({...errors, category: ''});
                    }}
                    placeholder={dt('Zgjidhni sektorin ose kërkoni problemin (psh. rrugë, mbeturina)...')}
                    className="w-full outline-none bg-transparent placeholder:text-neutral-500 dark:text-[var(--color-text-muted)] placeholder:normal-case placeholder:font-normal"
                  />
                  <ChevronRight className={cn("w-4 h-4 text-[var(--color-text-muted)] transition-transform", isCategoryDropdownOpen && "rotate-90")} />
                </div>
                
                {isCategoryDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/95 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-xl rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
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
                        <div key={group}>
                          <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-800 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest sticky top-0">{dt(group)}</div>
                          {filteredInGroup.map(c => (
                            <button
                              key={'id' in c ? (c as any).id : c.name}
                              type="button"
                              onClick={() => pickSector(c.name)}
                              className="w-full text-left px-4 py-3 hover:bg-indigo-600/10 border-b last:border-0 border-slate-100 dark:border-white/5 font-bold text-xs text-slate-700 dark:text-[var(--color-text-muted)] transition-colors"
                            >
                              {sectorByName(c.name) ? dt(sectorLabel(sectorByName(c.name)!, municipality)) : dt(c.name)}
                              {sectorByName(c.name) && <span className="ml-2 rounded-full bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{dt(LEVEL_LABEL[sectorByName(c.name)!.level])}</span>}
                              {(c as any).keywords && categorySearchTerm && (c as any).keywords.toLowerCase().includes(categorySearchTerm.toLowerCase()) && !dt(c.name).toLowerCase().includes(categorySearchTerm.toLowerCase()) && (
                                <span className="block text-[10px] text-neutral-400 font-normal mt-0.5 normal-case">{dt(`Lidhet me kërkimin tuaj`)}</span>
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
                      <div className="px-4 py-6 text-center text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] text-sm font-medium">{dt(`Nuk u gjet asnjë sektor për këtë problem.`)}</div>
                    )}
                  </div>
                )}
                {errors.category && <p data-field-error className="text-indigo-600 text-[10px] sm:text-xs font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.category}</p>}
                {topicCategory && sectorSuggestions.length > 0 && (
                  <div className="mt-3" data-testid="sector-suggestions">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1.5">
                      {municipality ? dt(`Sugjerime për ${municipality}`) : dt('Sugjerime (zgjidhni komunën për adresim të saktë)')}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {sectorSuggestions.map(({ entry, label, reason }) => (
                        <button
                          key={entry.name}
                          type="button"
                          onClick={() => pickSector(entry.name)}
                          aria-pressed={category === entry.name}
                          className={cn('w-full text-left rounded-xl border px-3 py-2 text-xs transition-colors',
                            category === entry.name ? 'border-indigo-600 bg-indigo-600/10' : 'border-slate-200 dark:border-white/10 hover:border-indigo-400')}
                        >
                          <span className="font-bold text-[var(--color-text)] dark:text-white">{dt(label)}</span>
                          <span className="ml-2 rounded-full bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{dt(LEVEL_LABEL[entry.level])}</span>
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{dt(reason)} · {dt('Afati i përgjigjes')}: {entry.responseHours}h</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide mb-2 border-l-2 border-indigo-600 pl-3">{dt(`Niveli i Rrezikshmërisë`)}</label>
                <select 
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as UrgentLevel)}
                  className="w-full px-[var(--spacing-4)] py-[var(--spacing-3)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-slate-200 dark:border-white/10 rounded-[var(--radius-button)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition text-[var(--color-text)]"
                >
                  <option value="E ulët">{dt(`SHKALLA I:`)} {dt('E ulët').toUpperCase()}</option>
                  <option value="Mesatare">{dt(`SHKALLA II:`)} {dt('Mesatare').toUpperCase()}</option>
                  <option value="E lartë">{dt(`SHKALLA III:`)} {dt('E lartë').toUpperCase()}</option>
                  <option value="Kritike">{dt(`SHKALLA IV:`)} {dt('Kritike').toUpperCase()}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide mb-2 md:mb-3 border-l-2 border-indigo-600 pl-3">{dt(`Zona e Operimit (Komuna)`)}</label>
              <select 
                value={municipality}
                onChange={e => {
                  setMunicipality(e.target.value);
                  if(errors.municipality) setErrors({...errors, municipality: ''});
                  if (MUNICIPALITY_COORDINATES[e.target.value]) {
                    setCoordinates(MUNICIPALITY_COORDINATES[e.target.value]);
                  }
                }}
                className={cn("w-full px-4 md:px-5 py-3 md:py-4 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border outline-none transition-colors font-bold mb-1 appearance-none uppercase text-xs md:text-xs tracking-wider text-[var(--color-text)] dark:text-white", errors.municipality ? "border-indigo-600 focus:border-indigo-600" : "border-neutral-300 focus:border-slate-900")}
              >
                <option value="">{dt('Zgjidhni komunën')}</option>
                {KOSOVO_MUNICIPALITIES.map(m => (
                  <option key={m} value={m}>{m.toUpperCase()}</option>
                ))}
              </select>
              {errors.municipality && <p data-field-error className="text-indigo-600 text-[10px] sm:text-xs font-bold mb-4 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.municipality}</p>}

              <div data-tour="report-location" className="flex justify-between items-center mb-2 md:mb-3 border-l-2 border-indigo-600 pl-3 relative">
                  <div>
                    <label className="block text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide">{dt(`Koordinatat / Adresa`)}</label>
                    <p className="text-[10px] text-indigo-600 mt-1 uppercase tracking-widest font-bold max-w-[200px] md:max-w-none">{dt(`Kliko tek GPS ose në hartë për të ndarë lokacionin saktësisht!`)}</p>
                  </div>
                  <button type="button" onClick={() => {
                    const isAlerted = localStorage.getItem('gps_alerted');
                    if (!isAlerted) {
                       toast(dt("Sistemi kërkon qasje në GPS për të gjetur koordinatat tuaja të sakta."), { icon: '📍' });
                       localStorage.setItem('gps_alerted', 'true');
                    }

                    if (navigator.geolocation) {
                      setIsLocating(true);
                      navigator.geolocation.getCurrentPosition(
                        async (pos) => {
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
                              preventSearch.current = true; setAddress(data.display_name);
                            } else {
                              setAddress("Lokacioni juaj GPS (Live)");
                            }
                          } catch (e) {
                            console.error('Reverse geocode error', e);
                            setAddress("Lokacioni juaj GPS (Live)");
                          } finally {
                            setIsLocating(false);
                          }
                        },
                        (err) => {
                          console.warn(err);
                          setIsLocating(false);
                          toast.error("Nuk mund të gjejmë lokacionin. Ju lutem kontrolloni nëse keni lejuar qasjen në GPS (Allow Location) në shfletuesin tuaj.");
                        },
                        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                      );
                    } else {
                      toast.error(dt("Shfletuesi juaj nuk suporton GPS."));
                    }
                  }} className="px-3 py-1.5 md:py-2 bg-slate-900 text-white rounded-2xl text-xs md:text-sm font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-sm dark:shadow-none active:scale-95 whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed" disabled={isLocating}>
                    {isLocating ? (
                      <><Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />{dt(`Duke kërkuar...`)}</>
                    ) : (
                      <><MapPin className="w-3.5 h-3.5 md:w-4 md:h-4" />{dt(`Zbulo Lokacionin (Live)`)}</>
                    )}
                  </button>
               </div>
               <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] mb-2 font-medium">{dt(`Këshillë: Nëse jeni në kompjuter (Desktop) lokacioni mund të mos jetë 100% i saktë sepse llogaritet nga interneti. Mund ta`)} <b>{dt(`klikoni kudo në hartë`)}</b>{dt(`për të vendosur gjilpërën (pin) saktësisht te vendi ku ndodhet problemi.`)}
               </p>
              <div className="h-48 md:h-64 w-full bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-800 border-2 border-neutral-300 rounded-xl mb-4 relative z-0 overflow-hidden">
                <SafeMapContainer>
                  <MapContainer center={coordinates} zoom={13} scrollWheelZoom={true} className="w-full h-full" zoomControl={true}>
                    <TileLayer
                      attribution='' 
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      className="map-tiles-dark"
                    />
                    <LocationMarker position={coordinates} setPosition={setCoordinates} setAddress={setAddress} setMunicipality={setMunicipality} preventSearchRef={preventSearch} />
                  </MapContainer>
                </SafeMapContainer>
              </div>
              {locationCheck.status !== 'ok' && (
                <p role="alert" data-field-error className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{dt(locationCheck.message)}
                    {locationCheck.status === 'mismatch' && (
                      <button type="button" onClick={() => setMunicipality(locationCheck.suggested)} className="ml-2 underline">{dt(`Përdor ${locationCheck.suggested}`)}</button>
                    )}
                  </span>
                </p>
              )}
              <div className="relative">
                <input 
                   type="text" 
                   value={address}
                   onChange={e => setAddress(e.target.value)}
                   className="w-full px-[var(--spacing-4)] py-[var(--spacing-3)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-slate-200 dark:border-white/10 rounded-[var(--radius-button)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition text-[var(--color-text)]"
                   placeholder={dt(`Identifikoni lokacionin me saktësi...`)}
                />
                {isSearchingAddress && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
                  </div>
                )}
                {addressSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/95 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-xl rounded-2xl overflow-hidden text-sm font-medium">
                    {addressSuggestions.map((sug, i) => (
                      <button 
                        key={i} 
                        type="button" 
                        onClick={() => selectSuggestion(sug)}
                        className="w-full text-left px-4 py-3 hover:bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border-b last:border-0 border-slate-100 dark:border-white/5 flex items-start gap-2"
                      >
                        <MapPin className="w-4 h-4 text-[var(--color-text-muted)] mt-0.5 shrink-0" />
                        <span className="text-slate-700 dark:text-[var(--color-text-muted)]">{sug.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 pt-6 md:pt-8 border-t-2 border-slate-900 mt-8 md:mt-10">
              {(!currentUser || currentUser?.role === 'guest') && !isAnonymous && (
                 <div data-tour="report-identity" className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 p-6 md:p-8 border border-slate-200/60 dark:border-white/10 rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900/50 relative mt-4">
                   <div className="absolute -top-4 left-4 md:left-6 px-3 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide py-1">{dt(`Identifikimi Subjektit`)}</div>
                   <div>
                     <label className="block text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide mb-2 border-l-2 border-indigo-600 pl-2">{dt(`Emri dhe Mbiemri`)}</label>
                     <input 
                       required
                       type="text" 
                       value={guestName}
                       onChange={(e) => { setGuestName(e.target.value); if(errors.guestName) setErrors({...errors, guestName: ''}) }}
                       placeholder="..." 
                       className={cn("w-full px-4 md:px-5 py-2.5 md:py-3 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border outline-none transition-colors font-bold text-[var(--color-text)] dark:text-white text-sm", errors.guestName ? "border-indigo-600 focus:border-indigo-600" : "border-neutral-300 focus:border-slate-900")}
                     />
                     {errors.guestName && <p data-field-error className="text-indigo-600 text-[10px] sm:text-xs font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.guestName}</p>}
                   </div>
                   <div>
                     <label className="block text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide mb-2 border-l-2 border-indigo-600 pl-2">{dt(`Kontakti`)}</label>
                     <input 
                       required
                       type="tel" 
                       value={guestPhone}
                       onChange={(e) => { setGuestPhone(e.target.value); if(errors.guestPhone) setErrors({...errors, guestPhone: ''}) }}
                       placeholder="+383..." 
                       className={cn("w-full px-4 md:px-5 py-2.5 md:py-3 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900 border outline-none transition-colors font-bold text-[var(--color-text)] dark:text-white text-sm", errors.guestPhone ? "border-indigo-600 focus:border-indigo-600" : "border-neutral-300 focus:border-slate-900")}
                     />
                     {errors.guestPhone && <p data-field-error className="text-indigo-600 text-[10px] sm:text-xs font-bold mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.guestPhone}</p>}
                   </div>
                 </div>
              )}
              
              <label data-tour="report-anon" className="flex items-center gap-4 cursor-pointer select-none bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-900/50 p-4 md:p-5 border-2 border-slate-200/60 dark:border-white/10 hover:border-slate-900 transition-colors mt-2 md:mt-4">
                <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="w-5 h-5 md:w-6 md:h-6 border border-slate-200/60 dark:border-white/10 rounded-xl text-[var(--color-text)] dark:text-white focus:ring-slate-900 transition-all rounded-xl" />
                <span className="text-xs md:text-xs font-bold text-[var(--color-text)] dark:text-white tracking-wide">{dt(`Kërkoj statusin anonim në proces`)}</span>
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
                      value={adLink}
                      onChange={e => setAdLink(e.target.value)}
                      placeholder={dt(`Linku i reklamës (opsional) - https://...`)}
                      className="w-full px-[var(--spacing-4)] py-[var(--spacing-3)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-slate-200 dark:border-white/10 rounded-[var(--radius-button)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition text-[var(--color-text)]"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="pt-6 md:pt-8">
              <button 
                type="submit"
                data-tour="report-submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-slate-900 text-white p-4 md:p-6 font-bold transition-colors tracking-wide text-xs md:text-sm border-2 border-transparent hover:border-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />{dt(`PROCESIMI...`)}</>
                ) : (
                  'PROTOKOLLO DHE PËRCELLO'
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {step === 2 && isSubmitting && (
        <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-[28px] p-8 md:p-16 text-center animate-in zoom-in-95 duration-500 max-w-2xl mx-auto relative overflow-hidden flex flex-col items-center justify-center min-h-[420px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_bottom,_rgba(244,63,94,0.12),transparent_40%)]" />
          <div className="relative z-10">
            <div className="w-24 h-24 bg-indigo-600/10 border-2 border-indigo-200 rounded-full flex items-center justify-center mx-auto mb-8 relative">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" style={{ animationDuration: '3s' }}></div>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-[var(--color-text)] dark:text-white tracking-tight mb-4 uppercase">{dt(`Duke Procesuar`)}</h2>
            <p className="text-[var(--color-text-muted)] dark:text-slate-300 font-medium max-w-md mx-auto leading-relaxed">{dt(`Raporti juaj po dërgohet në sistem të sigurt. Verifikimi i lokacionit, kategorisë dhe sigurisë po bëhet në kohë reale...`)}</p>
            {submitStage && (
              <p role="status" aria-live="polite" className="mt-5 text-sm font-bold text-indigo-700 dark:text-indigo-300">{submitStage}</p>
            )}
            <p className="mt-3 text-xs text-slate-500 max-w-md mx-auto">{dt('Mos e mbyllni faqen. Nëse lidhja dështon, forma ruhet dhe merrni mesazh për ta provuar përsëri.')}</p>
            <div className="mt-8 flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
              <span>Secure workflow</span>
            </div>
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
          <h1 className="text-[28px] md:text-[36px] font-bold text-[var(--color-text)] dark:text-white tracking-tight mb-4">{dt(`Raportimi u pranua`)}<span className="text-indigo-600">.</span></h1>
          <p className="text-slate-600 dark:text-slate-200 font-medium text-sm md:text-base lg:text-lg mb-6 md:mb-8 font-serif italic max-w-md mx-auto">{dt(`Raportimi iu dërgua agjentëve dhe administratorëve për shqyrtim. Përdorni Track-ID për ta ndjekur statusin e tij në çdo moment.`)}</p>
          <div className="w-full mb-8 rounded-2xl border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800 p-4 text-left shadow-inner">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-bold">{dt('Track-ID i raportimit')}</div>
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
                className="shrink-0 min-h-11 px-3 text-xs font-bold text-blue-600 hover:text-blue-700"
              >{dt('Kopjo')}</button>
            </div>
          </div>
          
          <div role="note" className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-xs leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
            <p className="font-black">{dt('Çfarë ndodh tani')}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>{dt('Statusi është “Në pritje”: raporti pret shqyrtimin. Nuk është ende publik.')}</li>
              <li>{dt('Pasi të aprovohet, dërgohet te institucioni përgjegjës dhe shfaqet në hartë dhe regjistër.')}</li>
              <li>{dt('Ruajeni Track-ID: është mënyra e vetme për ta ndjekur raportin pa llogari.')}</li>
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
            <button onClick={() => { setStep(1); setTitle(''); setDescription(''); setMediaItems([]); }} className="flex-1 px-6 md:px-8 py-4 md:py-5 bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[var(--color-text)] dark:text-white border border-slate-200/60 dark:border-white/10 rounded-xl font-bold tracking-wide text-xs md:text-xs transition-colors">{dt(`Rast i Ri`)}
            </button>
          </div>
        </div>
       )}

     </motion.div>
    </>
  );
}

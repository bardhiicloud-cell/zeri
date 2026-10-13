import React, { useState, useEffect, useMemo, useRef } from 'react';
import {  dt } from '../lib/dt';
import {
  HeartPulse, Activity, ShieldAlert, Plus, Search, Filter, MapPin, 
  User, Calendar, AlertCircle, CheckCircle2, ChevronRight, Share2, 
  Phone, Heart, Download, FileText, Sparkles, Building2, Droplets,
  Stethoscope, Pill, X, ArrowUpRight, Upload, Camera, Eye, Send,
  Mail, Printer, AlertTriangle, ShieldCheck, Link as LinkIcon, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, query, updateDoc, doc, where, limit } from 'firebase/firestore';
import { auth, db, readPrivateHealthDocument, uploadPrivateHealthDocument } from '../lib/firebase.ts';
import { useStore } from '../lib/store';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import { STAFF_LIMITS } from '../lib/loadLimits';
import { cn } from '../lib/utils';
import { getMunicipalNeighborhoods } from '../lib/kosovoNeighborhoods';
import { getHospitalInfoForMunicipality, HospitalContact } from '../data/kosovoHospitals';
import AdBanner from '../components/AdBanner.tsx';
import { MedicineShortages } from '../components/health/MedicineShortages';
import toast from 'react-hot-toast';

import { HealthCase } from '../types';
export type { HealthCase };

const DISEASE_CATEGORIES = [
  { id: 'all', name: 'Të Gjitha Sëmundjet', icon: HeartPulse },
  { id: 'Kancer / Onkologji', name: 'Kancer & Onkologji', icon: ShieldAlert },
  { id: 'Sëmundje të Zemrës', name: 'Zemër (Kardiake)', icon: Heart },
  { id: 'Sëmundje të Mushkërive', name: 'Mushkëri (Pulmonare)', icon: Activity },
  { id: 'Sëmundje të Veshkave & Dializë', name: 'Veshkë & Dializë', icon: Droplets },
  { id: 'Diabet me Komplikime', name: 'Diabet me Komplikime', icon: Pill },
  { id: 'Sëmundje Neurologjike', name: 'Neurologjike', icon: Stethoscope },
  { id: 'Sëmundje e Rrallë', name: 'Sëmundje të Rralla', icon: Sparkles },
];

export default function HealthRegistryPage() {
  const { currentUser } = useStore();
  const [cases, setCases] = useState<HealthCase[]>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('Të Gjitha');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'cases' | 'municipalStats' | 'hospitalDirectory' | 'shortages'>('cases');

  // Hospital notification modal
  const [hospitalModalCase, setHospitalModalCase] = useState<HealthCase | null>(null);
  const [hospitalInfo, setHospitalInfo] = useState<HospitalContact | null>(null);
  const [hospitalNotes, setHospitalNotes] = useState('');
  const [isNotifyingHospital, setIsNotifyingHospital] = useState(false);

  // Photo viewer modal
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string; documentType?: 'image' | 'pdf' } | null>(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

  // GoFundMe contribution modal
  const [goFundMeModalCase, setGoFundMeModalCase] = useState<HealthCase | null>(null);
  const [goFundMeInputUrl, setGoFundMeInputUrl] = useState('');
  const [isSavingGoFundMe, setIsSavingGoFundMe] = useState(false);

  // Form State
  const [form, setForm] = useState({
    fullName: '',
    age: 45,
    gender: 'Mashkull' as HealthCase['gender'],
    municipality: 'Prishtinë',
    neighborhood: '',
    category: 'Kancer / Onkologji' as HealthCase['category'],
    diagnosis: '',
    diagnosedYear: new Date().getFullYear(),
    urgency: 'Urgjente' as HealthCase['urgency'],
    needsInput: '',
    description: '',
    contactPhone: '',
    contactName: '',
    isAnonymous: true,
    consentToProcessing: false,
    supportAmountNeeded: 0,
    donationUrl: '',
    imageUrl: '',
    documentType: 'image' as 'image' | 'pdf',
    documentName: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Health records are private by design; only the signed-in owner's cases load here.
  useEffect(() => {
    if (!currentUser || currentUser.role === 'guest') {
      setCases([]);
      return;
    }

    try {
      const q = query(
        collection(db, 'healthRegistry'),
        where('authorId', '==', currentUser.id),
        limit(STAFF_LIMITS.healthCases)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const loaded = snapshot.docs.map((healthDoc) => ({
          id: healthDoc.id,
          ...(healthDoc.data() as Omit<HealthCase, 'id'>),
        })).sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
        setCases(loaded);
      }, (err) => {
        console.error('Regjistri shëndetësor nuk u ngarkua:', err);
        toast.error('Rastet nuk u ngarkuan. Kontrolloni lidhjen dhe provoni përsëri.');
      });
      return () => unsub();
    } catch (e) {
      console.error('Regjistri shëndetësor nuk u ngarkua:', e);
      toast.error('Regjistri shëndetësor nuk u ngarkua.');
    }
  }, [currentUser?.id, currentUser?.role]);

  // Filtered cases
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      if (selectedMunicipality !== 'Të Gjitha' && c.municipality !== selectedMunicipality) {
        return false;
      }
      if (selectedCategory !== 'all' && c.category !== selectedCategory) {
        return false;
      }
      if (selectedUrgency !== 'all' && c.urgency !== selectedUrgency) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = c.fullName.toLowerCase().includes(query);
        const matchDiag = c.diagnosis.toLowerCase().includes(query);
        const matchMun = c.municipality.toLowerCase().includes(query);
        const matchNeigh = (c.neighborhood || '').toLowerCase().includes(query);
        const matchNeeds = (c.needs || []).some(n => n.toLowerCase().includes(query));
        if (!matchName && !matchDiag && !matchMun && !matchNeigh && !matchNeeds) return false;
      }
      return true;
    });
  }, [cases, selectedMunicipality, selectedCategory, selectedUrgency, searchQuery]);

  const displayedCases = filteredCases;

  // Aggregate stats per municipality (all 38 municipalities)
  const municipalityStats = useMemo(() => {
    const stats: Record<string, { total: number; cancer: number; heart: number; lung: number; urgent: number }> = {};
    
    KOSOVO_MUNICIPALITIES.forEach(m => {
      stats[m] = { total: 0, cancer: 0, heart: 0, lung: 0, urgent: 0 };
    });

    cases.forEach(c => {
      if (!stats[c.municipality]) {
        stats[c.municipality] = { total: 0, cancer: 0, heart: 0, lung: 0, urgent: 0 };
      }
      stats[c.municipality].total += 1;
      if (c.category === 'Kancer / Onkologji') stats[c.municipality].cancer += 1;
      if (c.category === 'Sëmundje të Zemrës') stats[c.municipality].heart += 1;
      if (c.category === 'Sëmundje të Mushkërive') stats[c.municipality].lung += 1;
      if (c.urgency === 'Urgjente') stats[c.municipality].urgent += 1;
    });

    return stats;
  }, [cases]);

  // Grand totals
  const totalCount = cases.length;
  const cancerCount = cases.filter(c => c.category === 'Kancer / Onkologji').length;
  const heartCount = cases.filter(c => c.category === 'Sëmundje të Zemrës').length;
  const urgentCount = cases.filter(c => c.urgency === 'Urgjente').length;
  const withDocCount = cases.filter(c => c.imageUrl).length;

  // Store health documents in the private Storage namespace, not inline in Firestore.
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingDocument(true);
    try {
      const path = await uploadPrivateHealthDocument(file, 'registry');
      setForm(prev => ({
        ...prev,
        imageUrl: path,
        documentType: file.type === 'application/pdf' ? 'pdf' : 'image',
        documentName: file.name,
      }));
      toast.success('Dokumenti u ngarkua në hapësirën private shëndetësore.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Dokumenti nuk u ngarkua.');
    } finally {
      setIsUploadingDocument(false);
      e.target.value = '';
    }
  };

  const openHealthDocument = async (healthCase: HealthCase) => {
    if (!healthCase.imageUrl) return;
    const documentType = healthCase.documentType || (/\.pdf(?:$|[?#])/i.test(healthCase.imageUrl) ? 'pdf' : 'image');
    try {
      const url = healthCase.imageUrl.startsWith('health/')
        ? URL.createObjectURL(await readPrivateHealthDocument(healthCase.imageUrl))
        : healthCase.imageUrl;
      setPreviewPhoto({ url, title: `${healthCase.fullName} - Dokument mjekësor`, documentType });
    } catch (error) {
      console.error('Dokumenti shëndetësor nuk u hap:', error);
      toast.error('Nuk keni qasje te ky dokument ose nuk u arrit të hapet.');
    }
  };

  useEffect(() => () => {
    if (previewPhoto?.url.startsWith('blob:')) URL.revokeObjectURL(previewPhoto.url);
  }, [previewPhoto]);

  // Submit new Health Case
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const diagnosis = form.diagnosis.trim();
    if (!diagnosis) {
      toast.error('Ju lutem shënoni diagnozën specifike.');
      return;
    }
    if (!form.isAnonymous && !form.fullName.trim()) {
      toast.error('Shënoni emrin ose zgjidhni regjistrimin anonim.');
      return;
    }
    if (!form.consentToProcessing) {
      toast.error('Konfirmoni pëlqimin për përpunimin konfidencial të të dhënave.');
      return;
    }

    setIsSubmitting(true);
    try {
      const needsArray = form.needsInput
        ? form.needsInput.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10).map(s => s.slice(0, 120))
        : [];

      const isAnonymousCase = form.isAnonymous;
      const firebaseUser = auth.currentUser;
      const canStorePrivateExtras = Boolean(firebaseUser && !firebaseUser.isAnonymous && !isAnonymousCase);
      const trackingId = `HC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const newCaseData: Omit<HealthCase, 'id'> = {
        trackingId,
        ...(firebaseUser ? { authorId: firebaseUser.uid } : {}),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        fullName: isAnonymousCase ? '' : form.fullName.trim(),
        age: Number(form.age),
        gender: form.gender,
        municipality: form.municipality,
        neighborhood: isAnonymousCase ? '' : (form.neighborhood || 'Qendër').trim().slice(0, 120),
        category: form.category,
        diagnosis,
        diagnosedYear: Number(form.diagnosedYear),
        urgency: form.urgency,
        needs: needsArray,
        description: form.description.trim().slice(0, 2000),
        contactPhone: isAnonymousCase ? '' : form.contactPhone.trim(),
        contactName: isAnonymousCase ? '' : form.contactName.trim(),
        isAnonymous: isAnonymousCase,
        contactVisibility: 'admin_only',
        hospitalPrivacyNotice: isAnonymousCase
          ? 'RAST ANONIM: Nuk është mbledhur emër ose kontakt. Të dhënat shëndetësore janë konfidenciale dhe të qasshme vetëm për stafin e autorizuar.'
          : 'Kontakti i pacientit është i qasshëm vetëm për administratorët e autorizuar; nuk publikohet në platformë.',
        supportAmountNeeded: Number(form.supportAmountNeeded) || 0,
        supportAmountRaised: 0,
        ...(canStorePrivateExtras && form.donationUrl.trim() ? { donationUrl: form.donationUrl.trim() } : {}),
        ...(canStorePrivateExtras && form.imageUrl ? {
          imageUrl: form.imageUrl,
          documentType: form.documentType,
          documentName: form.documentName,
        } : {}),
        hospitalNotified: false,
        status: 'pending',
        createdAt: new Date().toISOString(),
        consentToProcessing: true,
      };

      const docRef = await addDoc(collection(db, 'healthRegistry'), {
        ...newCaseData,
        healthCondition: diagnosis
      });
      
      if (currentUser && currentUser.role !== 'guest') {
        setCases(prev => [{ id: docRef.id, ...newCaseData }, ...prev]);
      }

      toast.success(`Kërkesa u dërgua për verifikim. Kodi i rastit: ${trackingId}`);
      setIsRegisterModalOpen(false);
      setForm({
        fullName: '',
        age: 45,
        gender: 'Mashkull',
        municipality: 'Prishtinë',
        neighborhood: '',
        category: 'Kancer / Onkologji',
        diagnosis: '',
        diagnosedYear: new Date().getFullYear(),
        urgency: 'Urgjente',
        needsInput: '',
        description: '',
        contactPhone: '',
        contactName: '',
        isAnonymous: true,
        consentToProcessing: false,
        supportAmountNeeded: 0,
        donationUrl: '',
        imageUrl: '',
        // Both fields are part of the form contract: leaving them behind kept
        // the previous case's PDF label attached to the next submission.
        documentType: 'image',
        documentName: ''
      });
    } catch (err: unknown) {
      console.error(err);
      const errorCode = typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string'
        ? err.code
        : '';
      toast.error(errorCode === 'permission-denied'
        ? 'Firebase nuk e ka aktivizuar ende dërgimin pa kyçje. Publikoni firestore.rules të përditësuara dhe provoni përsëri.'
        : err instanceof Error ? `Kërkesa nuk u dërgua: ${err.message}` : 'Kërkesa nuk u dërgua. Provoni përsëri.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open GoFundMe Modal
  const handleOpenGoFundMeModal = (c: HealthCase) => {
    setGoFundMeModalCase(c);
    setGoFundMeInputUrl(c.donationUrl || '');
  };

  // Save GoFundMe Link
  const handleSaveGoFundMe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goFundMeModalCase) return;
    const url = goFundMeInputUrl.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      toast.error('Ju lutem vendosni një URL të vlefshme (duke filluar me https://)');
      return;
    }

    setIsSavingGoFundMe(true);
    try {
      // Update local state immediately
      setCases(prev => prev.map(item => item.id === goFundMeModalCase.id ? { ...item, donationUrl: url || undefined } : item));

      // Persist to Firestore if it's not a mock-only item or if it exists
      try {
        await updateDoc(doc(db, 'healthRegistry', goFundMeModalCase.id), {
          donationUrl: url || null
        });
      } catch (err) {
        console.warn("Firestore update notice (offline/mock record):", err);
      }

      toast.success(url ? 'Linku i GoFundMe u ruajt me sukses!' : 'Linku i donacionit u hoq.');
      setGoFundMeModalCase(null);
    } catch (err) {
      console.error(err);
      toast.error('Gabim gjatë ruajtjes së linkut të GoFundMe.');
    } finally {
      setIsSavingGoFundMe(false);
    }
  };

  // Open Hospital Notification Modal
  const handleOpenHospitalModal = (c: HealthCase) => {
    setHospitalModalCase(c);
    const hosp = getHospitalInfoForMunicipality(c.municipality);
    setHospitalInfo(hosp);
    setHospitalNotes(`${c.hospitalPrivacyNotice || (c.isAnonymous ? 'RAST ANONIM: Mos e shfaqni emrin e pacientit në asnjë dokument të spitalit.' : 'KONFIDENCIAL: Numri i kontaktit nuk publikohet në platformë.')}

NJOFTIM ZYRTAR SHËNDETËSOR PËR SPITALIN / QKMF:
Pacienti: ${c.isAnonymous ? 'Anonim (Rast i Verifikuar)' : c.fullName} (${c.age} vjeç, ${c.gender})
Komuna: ${c.municipality} • Lagjja/Fshati: ${c.neighborhood || 'Qendër'}
Kategoria: ${c.category}
Diagnoza: ${c.diagnosis}
Niveli i Urgjencës: ${c.urgency}
Nevojat Primare: ${(c.needs || []).join(', ')}
${c.description ? `Përshkrimi i Gjendjes: ${c.description}` : ''}
${c.imageUrl ? 'Dokument Mjekësor / Epikriza: E bashkangjitur në sistem' : ''}`);
  };

  // Dispatch notification
  const handleConfirmHospitalNotify = async () => {
    if (!hospitalModalCase || !hospitalInfo) return;
    setIsNotifyingHospital(true);
    try {
      if (!hospitalModalCase.id.startsWith('hc-')) {
        await updateDoc(doc(db, 'healthRegistry', hospitalModalCase.id), {
          hospitalNotified: true,
          hospitalNotifiedAt: new Date().toISOString(),
          hospitalTarget: hospitalInfo.name
        });
      }

      setCases(prev => prev.map(item => {
        if (item.id === hospitalModalCase.id) {
          return {
            ...item,
            hospitalNotified: true,
            hospitalNotifiedAt: new Date().toISOString(),
            hospitalTarget: hospitalInfo.name
          };
        }
        return item;
      }));

      toast.success(`Njoftimi iu dërgua ${hospitalInfo.name}!`);
      setHospitalModalCase(null);
    } catch (e) {
      console.error(e);
      toast.error('Gabim gjatë njoftimit.');
    } finally {
      setIsNotifyingHospital(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredCases.length === 0) {
      toast.error('Nuk ka të dhëna për të shkarkuar.');
      return;
    }

    const headers = [
      'ID', 'Pacienti', 'Mosha', 'Gjinia', 'Komuna', 'Lagjja', 
      'Kategoria', 'Diagnoza', 'Viti i Diagnozës', 'Urgjenca', 
      'Nevojat', 'Kontakti', 'Spitali i Njoftuar', 'Dokument Mjekesor', 'Data'
    ];

    const rows = filteredCases.map(c => [
      c.id,
      `"${c.isAnonymous ? 'Anonim' : c.fullName}"`,
      c.age,
      c.gender,
      `"${c.municipality}"`,
      `"${c.neighborhood || 'Qendër'}"`,
      `"${c.category}"`,
      `"${c.diagnosis.replace(/"/g, '""')}"`,
      c.diagnosedYear,
      c.urgency,
      `"${(c.needs || []).join('; ')}"`,
      `"${c.contactPhone || '-'}"`,
      `"${c.hospitalTarget || (c.hospitalNotified ? 'Po' : 'Jo')}"`,
      `"${c.imageUrl ? 'Ka foto' : 'Pa foto'}"`,
      `"${new Date(c.createdAt).toLocaleDateString('sq-AL')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `regjistri-shendetesor-${selectedMunicipality === 'Të Gjitha' ? '38-komunat' : selectedMunicipality.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Regjistri u shkarkua me sukses në formatin CSV!');
  };

  const currentAvailableNeighborhoods = useMemo(() => {
    return getMunicipalNeighborhoods(form.municipality);
  }, [form.municipality]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-900 transition-colors dark:bg-zinc-950 dark:text-slate-100">
      <div className="px-4 pt-4 sm:px-6 lg:px-8 lg:pt-8">
        <header className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#071322] p-5 text-white shadow-[0_30px_90px_-42px_rgba(2,6,23,0.9)] sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-rose-400/15 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-rose-200">
              <HeartPulse className="h-3.5 w-3.5" />
              <span>{dt('Shërbim qytetar · Privatësi si parazgjedhje')}</span>
            </div>
            <h1 className="max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
              {dt('Kujdes i organizuar. Të dhëna të mbrojtura.')}
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
              {dt('Një hapësirë e sigurt për të paraqitur nevoja shëndetësore, ndjekur kërkesat e tua dhe gjetur institucionin përkatës. Rastet dhe dokumentet mjekësore nuk janë publike.')}
            </p>
          </div>

          <div className="relative flex flex-wrap items-center gap-3 lg:max-w-[430px] lg:justify-end">
            <button
              onClick={handleExportCSV}
              disabled={!currentUser || currentUser.role === 'guest' || cases.length === 0}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              title={dt('Shkarko evidencën në formatin CSV / Excel')}
            >
              <Download className="h-4 w-4 text-emerald-300" />
              <span>Shkarko CSV</span>
            </button>

            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-500 px-4 text-sm font-black text-white shadow-lg shadow-rose-950/30 transition hover:bg-rose-400"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>{dt('Regjistro Rast / Kërko Ndihmë')}</span>
            </button>
          </div>
          </div>
        </header>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="grid gap-3 sm:grid-cols-3" aria-label={dt('Si funksionon mbështetja shëndetësore')}>
          {[
            { number: '01', title: 'Paraqite nevojën', description: 'Dërgo kërkesën pa llogari, në mënyrë anonime ose me identitet dhe pëlqim të qartë.', icon: FileText, tone: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-400/10' },
            { number: '02', title: 'Shqyrtim i sigurt', description: 'Kërkesa merr kod gjurmimi dhe kalon në verifikim nga stafi i autorizuar.', icon: ShieldCheck, tone: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-400/10' },
            { number: '03', title: 'Gjej institucionin', description: 'Përdor drejtorinë për kontaktet e spitaleve rajonale dhe QKMF-ve.', icon: Building2, tone: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-400/10' },
          ].map(({ number, title, description, icon: Icon, tone }) => (
            <article key={number} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <span className="font-mono text-[11px] font-black tracking-wider text-slate-400">{number} / 03</span>
              </div>
              <h2 className="mt-4 text-sm font-black text-slate-900 dark:text-white">{title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
            </article>
          ))}
        </section>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-300/15 dark:bg-amber-300/[0.06] dark:text-amber-100">
          <strong>{dt('Shënim i rëndësishëm:')}</strong> {dt('Regjistri koordinon kërkesat qytetare dhe nuk zëvendëson këshillën, diagnozën apo kujdesin urgjent mjekësor.')}
        </p>
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
              <span>Rastet e mia</span>
              <Building2 className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2">
              {totalCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">{dt('Të dhëna personale të mbrojtura')}</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between text-purple-600 text-xs font-bold uppercase">
              <span>Kancer / Onkologji</span>
              <ShieldAlert className="w-4 h-4" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 mt-2">
              {cancerCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">{dt('Vetëm nga rastet e tua')}</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between text-rose-600 text-xs font-bold uppercase">
              <span>Raste Urgjente</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-2">
              {urgentCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">{dt('Sipas urgjencës së regjistruar')}</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between text-emerald-600 text-xs font-bold uppercase">
              <span>{dt('Dokumente Mjekësore')}</span>
              <FileText className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
              {withDocCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">{dt('Dokumente në hapësirë private')}</p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-zinc-800" role="tablist" aria-label={dt('Pamjet e regjistrit shëndetësor')}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'cases'}
            onClick={() => setActiveTab('cases')}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all ${
              activeTab === 'cases'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-800'
            }`}
          >
            <User className="h-4 w-4" aria-hidden="true" />
            <span>Rastet e mia ({filteredCases.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'municipalStats'}
            onClick={() => setActiveTab('municipalStats')}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all ${
              activeTab === 'municipalStats'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-800'
            }`}
          >
            <Building2 className="h-4 w-4" aria-hidden="true" />
            <span>{dt('Përmbledhja ime (private)')}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'hospitalDirectory'}
            onClick={() => setActiveTab('hospitalDirectory')}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all ${
              activeTab === 'hospitalDirectory'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-800'
            }`}
          >
            <Stethoscope className="h-4 w-4" aria-hidden="true" />
            <span>{dt('Spitalet & QKMF e Kosovës')}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'shortages'}
            onClick={() => setActiveTab('shortages')}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all ${
              activeTab === 'shortages'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-800'
            }`}
          >
            <Pill className="h-4 w-4" aria-hidden="true" />
            <span>Mungesat e Barnave</span>
          </button>
        </div>

        {activeTab === 'shortages' && <MedicineShortages />}

        {/* TAB 1: CASES FEED */}
        {activeTab === 'cases' && (
          <div className="space-y-6">
            {/* Filters Row */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={dt('Kërko me emër, diagnozë, komunë...')}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-rose-500 font-medium"
                  />
                </div>

                {/* Municipality Dropdown */}
                <div>
                  <select
                    value={selectedMunicipality}
                    onChange={e => setSelectedMunicipality(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                  >
                    <option value="Të Gjitha">{dt('📍 Të Gjitha 38 Komunat')}</option>
                    {KOSOVO_MUNICIPALITIES.map(m => (
                      <option key={m} value={m}>{m} ({municipalityStats[m]?.total || 0} raste)</option>
                    ))}
                  </select>
                </div>

                {/* Urgency Dropdown */}
                <div>
                  <select
                    value={selectedUrgency}
                    onChange={e => setSelectedUrgency(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                  >
                    <option value="all">{dt('⚡ Të gjitha Nivelet e Urgjencës')}</option>
                    <option value="Urgjente">{dt('Urgjente')}</option>
                    <option value="Mesatare">{dt('Mesatare')}</option>
                    <option value="Kronike e Stabilizuar">Kronike e Stabilizuar</option>
                  </select>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {DISEASE_CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                        isSelected
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-zinc-700 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cases Grid */}
            {displayedCases.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-slate-500">
                <HeartPulse className="w-12 h-12 mx-auto text-slate-300 dark:text-zinc-700 mb-3" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {searchQuery || selectedMunicipality !== 'Të Gjitha' || selectedCategory !== 'all' || selectedUrgency !== 'all' ? 'Nuk u gjetën raste për filtrat e zgjedhur' : 'Nuk ke ende raste të regjistruara'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {currentUser && currentUser.role !== 'guest' ? 'Regjistro një rast për të ndjekur shqyrtimin dhe hapat e mbështetjes.' : 'Dërgo kërkesë shëndetësore anonime ose me identitet. Për arsye privatësie, rastet pa llogari nuk shfaqen në këtë listë.'}
                </p>
                <button onClick={() => setIsRegisterModalOpen(true)} className="mt-4 min-h-10 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700">{dt('Regjistro Rast të Ri')}</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {displayedCases.map(c => {
                  const assignedHospital = getHospitalInfoForMunicipality(c.municipality);
                  return (
                    <motion.div
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-3.5">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                              c.category === 'Kancer / Onkologji'
                                ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                                : c.category === 'Sëmundje të Zemrës'
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                : c.category === 'Sëmundje të Mushkërive'
                                ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            }`}>
                              {c.category === 'Kancer / Onkologji' ? 'ONK' : c.category === 'Sëmundje të Zemrës' ? 'KRD' : c.category === 'Sëmundje të Mushkërive' ? 'PUL' : 'SHËN'}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                                  {c.isAnonymous ? 'Rast anonim i mbrojtur' : c.fullName}
                                </h3>
                                <span title="Rast i verifikuar">
                                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-medium mt-0.5">
                                {c.age} vjeç • {c.gender} • Viti i diagnozës: {c.diagnosedYear}
                              </p>
                            </div>
                          </div>

                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            c.urgency === 'Urgjente'
                              ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                              : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                          }`}>
                            {c.urgency}
                          </span>
                        </div>

                        <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/45" aria-label={`Statusi i rastit ${c.trackingId || c.id}`}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Gjurmimi i rastit</span>
                            <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400">{c.trackingId || `HC-${c.id.slice(0, 8).toUpperCase()}`}</span>
                          </div>
                          {c.status === 'rejected' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> {dt('Rasti kërkon rishikim')}
                            </span>
                          ) : (
                            <div className="grid grid-cols-4 gap-1.5">
                              {[
                                { label: 'Regjistruar', complete: true },
                                { label: 'Verifikuar', complete: c.status !== 'pending' },
                                { label: 'Spitali', complete: Boolean(c.hospitalNotified) },
                                { label: 'Përfunduar', complete: c.status === 'resolved' },
                              ].map((step) => (
                                <div key={step.label} className="min-w-0">
                                  <div className={cn('mb-1 h-1.5 rounded-full', step.complete ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-zinc-700')} />
                                  <span className={cn('block truncate text-[9px] font-bold', step.complete ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-500')}>{step.label}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Municipality & Diagnosis */}
                        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>Komuna: {c.municipality}</span>
                            {c.neighborhood && <span className="text-slate-400 font-normal">• Lagjja: {c.neighborhood}</span>}
                          </div>

                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {c.diagnosis}
                          </p>

                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                            {c.description}
                          </p>
                        </div>

                        {/* Medical Report Photo Attachment */}
                        {c.imageUrl && (
                          <div className="pt-1">
                            <div 
                              onClick={() => void openHealthDocument(c)}
                              className="group cursor-pointer p-2 bg-slate-50 dark:bg-zinc-800/60 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 rounded-xl border border-slate-200/80 dark:border-zinc-700/80 flex items-center justify-between transition-all"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-600 dark:border-zinc-700 dark:bg-zinc-900">
                                  {c.documentType === 'pdf' ? <FileText className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                                </span>
                                <div>
                                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>{dt('Dokument Mjekësor / Epikrizë')}</span>
                                  </p>
                                  <p className="text-[11px] text-slate-400">{dt('Kliko për ta parë në madhësi të plotë')}</p>
                                </div>
                              </div>
                              <Eye className="w-4 h-4 text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors mr-1" />
                            </div>
                          </div>
                        )}

                        {/* Needs Tags */}
                        {c.needs && c.needs.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {c.needs.map((need, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-medium"
                              >
                                • {need}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Hospital notification badge */}
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Spitali Rajonal:</span>
                          {c.hospitalNotified ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3" />
                              Njoftuar: {c.hospitalTarget || assignedHospital.name.split('-')[0]}
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-300 font-bold truncate max-w-[200px]" title={assignedHospital.name}>
                              {assignedHospital.name.split('-')[0]}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom Actions */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          {/* Njofto Spitalin */}
                          <button
                            onClick={() => handleOpenHospitalModal(c)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                            title={dt('Njofto Spitalin ose QKMF-në për këtë rast')}
                          >
                            <Send className="w-3 h-3" />
                            <span>Njofto Spitalin</span>
                          </button>

                          {/* Kontribo me GoFundMe */}
                          {c.donationUrl ? (
                            <div className="inline-flex items-center gap-1">
                              <a
                                href={c.donationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 group"
                                title={dt('Kontribo me donacion përmes GoFundMe për këtë pacient')}
                              >
                                <Heart className="w-3 h-3 fill-white/80 text-white group-hover:scale-110 transition-transform" />
                                <span>Kontribo</span>
                                <ArrowUpRight className="w-3 h-3 opacity-80" />
                              </a>
                              <button
                                onClick={() => handleOpenGoFundMeModal(c)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                title={dt('Ndrysho ose shiko linkun e GoFundMe')}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleOpenGoFundMeModal(c)}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                              title={dt('Vendos linkun e GoFundMe për të mbledhur donacione')}
                            >
                              <Heart className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Kontribo</span>
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800/70 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-zinc-700 rounded-xl text-[11px] font-bold flex items-center gap-1.5" title={dt('Numri nuk publikohet; adminët e autorizuar e shohin në panelin e tyre.')}>
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Kontakt privat
                          </span>
                          <button
                            onClick={() => {
                              /**
                               * Never put the patient's name in share text.
                               *
                               * This previously sent `c.fullName`, so sharing an
                               * "anonymous" case disclosed the identity of the
                               * person it was meant to protect — and the share
                               * sheet is a hand-off to other apps. Only the
                               * tracking reference and the municipality are
                               * shareable; those are already public on the card.
                               */
                              const shareTitle = c.isAnonymous
                                ? `Rast Shëndetësor: ${dt('Rast anonim i mbrojtur')}`
                                : `Rast Shëndetësor: ${c.trackingId || c.id}`;
                              if (navigator.share) {
                                navigator.share({
                                  title: shareTitle,
                                  text: `${c.diagnosis} - ${dt('Komuna')}: ${c.municipality}`,
                                  url: window.location.href
                                }).catch(() => {});
                              } else {
                                navigator.clipboard.writeText(window.location.href);
                                toast.success(dt('Linku u kopjua!'));
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                            title={dt('Shpërndaj')}
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MUNICIPAL STATS (ALL 38 MUNICIPALITIES) */}
        {activeTab === 'municipalStats' && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {dt('Tabela e Evidencës Shëndetësore sipas 38 Komunave')}
                </h3>
                <p className="text-xs text-slate-500">
                  {dt('Transparencë e plotë mbi rastet onkologjike, kardiake dhe nevojat urgjente për çdo komunë.')}
                </p>
              </div>

              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
              >
                <Download className="w-4 h-4" />
                <span>{dt('Shkarko Tabelën (CSV)')}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">{dt('Komuna')}</th>
                    <th className="py-3.5 px-4 text-center">Totali i Rasteve</th>
                    <th className="py-3.5 px-4 text-center">Kancer / Onkologji</th>
                    <th className="py-3.5 px-4 text-center">{dt('Sëmundje Zemre')}</th>
                    <th className="py-3.5 px-4 text-center">{dt('Sëmundje Mushkërie')}</th>
                    <th className="py-3.5 px-4 text-center">Raste Urgjente</th>
                    <th className="py-3.5 px-4 text-right">{dt('Spitali Përgjegjës')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium">
                  {KOSOVO_MUNICIPALITIES.map(m => {
                    const st = municipalityStats[m] || { total: 0, cancer: 0, heart: 0, lung: 0, urgent: 0 };
                    const hosp = getHospitalInfoForMunicipality(m);
                    return (
                      <tr key={m} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>{m}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded-full ${st.total > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-black' : 'text-slate-400'}`}>
                            {st.total}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-purple-600 dark:text-purple-400 font-bold">
                          {st.cancer > 0 ? st.cancer : '-'}
                        </td>
                        <td className="py-3 px-4 text-center text-rose-600 dark:text-rose-400 font-bold">
                          {st.heart > 0 ? st.heart : '-'}
                        </td>
                        <td className="py-3 px-4 text-center text-sky-600 dark:text-sky-400 font-bold">
                          {st.lung > 0 ? st.lung : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {st.urgent > 0 ? (
                            <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded font-black">
                              {st.urgent}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 truncate max-w-[220px]" title={hosp.name}>
                          {hosp.name.split('(')[0]}
                        </td>
                      </tr>
                    );
                  })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/*
                  Strategic footer slot at the end of the registry. The health module is
                  the one place on the platform where a citizen arrives anxious, so the
                  banner is kept at the very bottom and renders nothing when unsold — it is
                  never allowed to sit between the reader and a case.
                */}
                <AdBanner position="banner" className="mx-auto" />

                        {/* TAB 3: HOSPITAL & QKMF DIRECTORY (38 MUNICIPALITIES) */}
        {activeTab === 'hospitalDirectory' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {dt('Drejtoria e Spitaleve Rajonale & QKMF-ve për 38 Komunat e Kosovës')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {dt('Kontaktet zyrtare të urgjencës për të gjitha rajonet: Prishtinë (QKUK), Prizren, Pejë, Gjakovë, Gjilan, Ferizaj, dhe Mitrovicë.')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {KOSOVO_MUNICIPALITIES.map(m => {
                const hosp = getHospitalInfoForMunicipality(m);
                return (
                  <div 
                    key={m}
                    className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Komuna {m}</span>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight mt-0.5">
                            {hosp.name}
                          </h4>
                        </div>
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded">
                          {hosp.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">📍 {hosp.address}</p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs font-medium">
                      <a 
                        href={`tel:${hosp.emergencyPhone}`} 
                        className="flex items-center justify-between p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 font-bold"
                      >
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{dt('Urgjenca:')}</span>
                        </span>
                        <span>{hosp.emergencyPhone}</span>
                      </a>

                      <a 
                        href={`mailto:${hosp.email}`}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      >
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-blue-500" />
                          <span>{dt('Email:')}</span>
                        </span>
                        <span className="truncate max-w-[150px]">{hosp.email}</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* REGISTRATION MODAL WITH PHOTO UPLOAD (z-[9999] TO PREVENT ANY GLITCHES) */}
      <AnimatePresence>
        {isRegisterModalOpen && (
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-6 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <HeartPulse className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-slate-900 dark:text-white">
                      {dt('Regjistro Rast Shëndetësor')}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {dt('Evidenca regjistrohet sipas komunës përkatëse në Kosovë.')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-3 dark:border-zinc-700/60 dark:bg-zinc-800/60">
                  <p className="mb-2 text-xs font-bold text-slate-900 dark:text-white">{dt('Si dëshironi ta dërgoni kërkesën?')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setForm(prev => ({
                      ...prev, isAnonymous: true, fullName: '', contactPhone: '', contactName: '',
                      imageUrl: '', documentName: '', donationUrl: '',
                    }))} aria-pressed={form.isAnonymous}
                      className={`rounded-lg border px-3 py-2 text-xs font-bold ${form.isAnonymous ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200' : 'border-slate-200 text-slate-600 dark:border-zinc-700 dark:text-slate-300'}`}>
                      Anonim
                    </button>
                    <button type="button" onClick={() => setForm(prev => ({ ...prev, isAnonymous: false }))} aria-pressed={!form.isAnonymous}
                      className={`rounded-lg border px-3 py-2 text-xs font-bold ${!form.isAnonymous ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200' : 'border-slate-200 text-slate-600 dark:border-zinc-700 dark:text-slate-300'}`}>
                      {dt('Me identitet')}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {form.isAnonymous
                      ? 'Nuk ruajmë emër, telefon, lagje, dokumente ose link donacioni. Mos shkruani emra apo të dhëna identifikuese në përshkrim; të dhënat mjekësore mbeten konfidenciale për stafin e autorizuar.'
                      : 'Emri ruhet privatisht për verifikim nga stafi. Kyçja nuk kërkohet; telefoni mund të lihet bosh.'}
                  </p>
                </div>

                {!form.isAnonymous && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Emri i pacientit *
                    </label>
                    <input
                      type="text"
                      required={!form.isAnonymous}
                      maxLength={120}
                      value={form.fullName}
                      onChange={e => setForm({ ...form, fullName: e.target.value })}
                      placeholder={dt('Shfaqet vetëm për stafin e autorizuar')}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium"
                    />
                  </div>
                </div>}

                {!form.isAnonymous && <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Numri i Telefonit / Kontaktit</label>
                  <input type="text" maxLength={40} value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} placeholder="+383 44 123 456" className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium" />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{dt('Kontakti ruhet në regjistrin e kufizuar për pronarin dhe stafin e autorizuar; nuk publikohet në faqen publike.')}</p>
                </div>}

                {/* Age, Gender, Year */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {dt('Mosha (vjeç)')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={form.age}
                      onChange={e => setForm({ ...form, age: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Gjinia
                    </label>
                    <select
                      value={form.gender}
                      onChange={e => setForm({ ...form, gender: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium"
                    >
                      <option value="Mashkull">Mashkull</option>
                      <option value="Femër">{dt('Femër')}</option>
                      <option value="Tjetër">{dt('Tjetër')}</option>
                    </select>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {dt('Viti i Diagnozës')}
                    </label>
                    <input
                      type="number"
                      min={1980}
                      max={new Date().getFullYear()}
                      value={form.diagnosedYear}
                      onChange={e => setForm({ ...form, diagnosedYear: parseInt(e.target.value) || 2024 })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium"
                    />
                  </div>
                </div>

                {/* Municipality & Neighborhood */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {dt('Komuna (nga 38 Komunat) *')}
                    </label>
                    <select
                      value={form.municipality}
                      onChange={e => setForm({ ...form, municipality: e.target.value, neighborhood: '' })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                    >
                      {KOSOVO_MUNICIPALITIES.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Lagjja / Fshati
                    </label>
                    {currentAvailableNeighborhoods.length > 0 ? (
                      <select
                        value={form.neighborhood}
                        onChange={e => setForm({ ...form, neighborhood: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium"
                      >
                        <option value="">Zgjedh Lagjen...</option>
                        {currentAvailableNeighborhoods.map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={form.neighborhood}
                        onChange={e => setForm({ ...form, neighborhood: e.target.value })}
                        placeholder="psh. Qendra, Dardania"
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium"
                      />
                    )}
                  </div>
                </div>

                {/* Category & Urgency */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {dt('Kategoria e Sëmundjes *')}
                    </label>
                    <select
                      value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                    >
                      <option value="Kancer / Onkologji">Kancer / Onkologji</option>
                      <option value="Sëmundje të Zemrës">{dt('Sëmundje të Zemrës (Kardiake)')}</option>
                      <option value="Sëmundje të Mushkërive">{dt('Sëmundje të Mushkërive (Pulmonare)')}</option>
                      <option value="Sëmundje të Veshkave & Dializë">{dt('Sëmundje të Veshkave & Dializë')}</option>
                      <option value="Diabet me Komplikime">{dt('Diabet me Komplikime')}</option>
                      <option value="Sëmundje Neurologjike">{dt('Sëmundje Neurologjike')}</option>
                      <option value="Sëmundje e Rrallë">{dt('Sëmundje e Rrallë')}</option>
                      <option value="Tjetër">{dt('Tjetër')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {dt('Niveli i Urgjencës')}
                    </label>
                    <select
                      value={form.urgency}
                      onChange={e => setForm({ ...form, urgency: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                    >
                      <option value="Urgjente">{dt('Urgjente (Ka nevojë për ndërhyrje/barna menjëherë)')}</option>
                      <option value="Mesatare">Mesatare (Terapia kronike e rregullt)</option>
                      <option value="Kronike e Stabilizuar">Kronike e Stabilizuar</option>
                    </select>
                  </div>
                </div>

                {/* Specific Diagnosis */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Diagnoza Specifike *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={300}
                    value={form.diagnosis}
                    onChange={e => setForm({ ...form, diagnosis: e.target.value })}
                    placeholder={dt('psh. Adenokarcinomë, Kardiomiopati e Dilatuar, SPOK, Leuçemi...')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium"
                  />
                </div>

                {/* Private attachments require a signed-in, identified owner. */}
                {!form.isAnonymous && auth.currentUser && !auth.currentUser.isAnonymous && <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {dt('Foto e Dokumentit Mjekësor / Epikrizës / Recetës (Opsionale)')}
                  </label>
                  
                  {form.imageUrl ? (
                    <div className="relative p-3 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-rose-600 dark:border-zinc-700 dark:bg-zinc-900">
                          {form.documentType === 'pdf' ? <FileText className="h-6 w-6" /> : <Camera className="h-6 w-6" />}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">Dokumenti u ngarkua</p>
                          <p className="max-w-48 truncate text-[11px] text-emerald-600 font-medium">{form.documentName || 'Gati për regjistrim'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, imageUrl: '' }))}
                        className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      >
                        Largo foton
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => !isUploadingDocument && fileInputRef.current?.click()}
                      className="cursor-pointer border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-rose-500 dark:hover:border-rose-500 rounded-2xl p-5 text-center transition-all bg-slate-50/50 dark:bg-zinc-800/40 hover:bg-rose-50/30"
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handlePhotoSelect} 
                        accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
                        className="hidden" 
                      />
                      {isUploadingDocument ? <Activity className="w-8 h-8 text-rose-500 mx-auto mb-1.5 animate-pulse" /> : <Upload className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />}
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {isUploadingDocument ? 'Duke ngarkuar dokumentin privat…' : 'Ngarko epikrizë, analizë ose recetë'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {dt('JPG, PNG, WEBP ose PDF · Maksimumi 5MB · Qasje vetëm për ju dhe stafin shëndetësor')}
                      </p>
                    </div>
                  )}
                </div>}
                {!form.isAnonymous && (!auth.currentUser || auth.currentUser.isAnonymous) && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                    {dt('Bashkëngjitja e dokumenteve është opsionale dhe kërkon llogari të kyçur. Kërkesën mund ta dërgoni tani pa dokument.')}
                  </p>
                )}

                {/* Primary Needs */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {dt('Nevojat Kryesore (të ndara me presje)')}
                  </label>
                  <input
                    type="text"
                    value={form.needsInput}
                    onChange={e => setForm({ ...form, needsInput: e.target.value })}
                    placeholder={dt('psh. Barna Citostatike, Dializë, Koncentrator Oksigjeni, Ndihmë Financiare')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {dt('Përshkrimi i Situatës dhe Nevoja për Ndihmë')}
                  </label>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder={dt('Shpjegoni shkurtimisht gjendjen shëndetësore, barnat që mungojnë në spital apo nevojën për trajtim...')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium resize-none"
                  />
                </div>

                {/* Donation links require an identified account and are reviewed by staff. */}
                {!form.isAnonymous && auth.currentUser && !auth.currentUser.isAnonymous && <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Linku i GoFundMe / Donacionit (Opsionale)</span>
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{dt('Për butonin "Kontribo"')}</span>
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={form.donationUrl}
                      onChange={e => setForm({ ...form, donationUrl: e.target.value })}
                      placeholder="https://www.gofundme.com/f/emri-i-fushatës..."
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-medium"
                    />
                    <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {dt('Nëse keni hapur fushatë në GoFundMe apo platformë tjetër, vendosni linkun këtu që qytetarët të mund të dhurojnë drejtpërdrejt.')}
                  </p>
                </div>}

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-300">
                  <input
                    type="checkbox"
                    required
                    checked={form.consentToProcessing}
                    onChange={e => setForm(prev => ({ ...prev, consentToProcessing: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-rose-600"
                  />
                  <span>
                    {dt('Pajtohem që këto të dhëna shëndetësore të përpunohen vetëm për shqyrtimin e kërkesës nga stafi i autorizuar. E kuptoj se kërkesa nuk është publike dhe se kodi shërben për referim gjatë komunikimit me stafin. *')}
                  </span>
                </label>

                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsRegisterModalOpen(false)}
                    className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    {dt('Anulo')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-rose-600/20 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>{isSubmitting ? 'Duke regjistruar...' : 'Dërgo në Regjistër'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HOSPITAL NOTIFICATION MODAL */}
      <AnimatePresence>
        {hospitalModalCase && hospitalInfo && (
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      {dt('Njofto Spitalin / QKMF Përkatëse')}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Dërgim alarmi zyrtar për Komunën e {hospitalModalCase.municipality}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setHospitalModalCase(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Hospital Contact Info Box */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    {hospitalInfo.name}
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                    {hospitalInfo.type}
                  </span>
                </div>
                <p className="text-xs text-slate-500">📍 {hospitalInfo.address}</p>

                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <a
                    href={`tel:${hospitalInfo.emergencyPhone}`}
                    className="flex items-center gap-2 p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl hover:bg-rose-100 font-bold"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Urgjenca: {hospitalInfo.emergencyPhone}</span>
                  </a>
                  <a
                    href={`mailto:${hospitalInfo.email}?subject=Njoftim Urgjent Shendetesor - ${hospitalModalCase.municipality}&body=${encodeURIComponent(hospitalNotes)}`}
                    className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-xl hover:bg-blue-100 font-bold"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{hospitalInfo.email}</span>
                  </a>
                </div>
              </div>

              {/* Notification Message Text Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {dt('Mesazhi i Njoftimit për Spitalin / Mjekët Kujdestarë')}
                </label>
                <textarea
                  rows={6}
                  value={hospitalNotes}
                  onChange={e => setHospitalNotes(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-rose-500 resize-none font-mono"
                />
              </div>

              {/* Direct Dispatch Options */}
              <div className="flex flex-wrap gap-2 text-xs">
                <a
                  href={`mailto:${hospitalInfo.email}?subject=Njoftim Zyrtar - Rast Shendetesor ne ${hospitalModalCase.municipality}&body=${encodeURIComponent(hospitalNotes)}`}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-500" />
                  <span>{dt('Hap në Email')}</span>
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(hospitalNotes)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{dt('Dërgo në WhatsApp')}</span>
                </a>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setHospitalModalCase(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  {dt('Mbyll')}
                </button>
                <button
                  type="button"
                  disabled={isNotifyingHospital}
                  onClick={handleConfirmHospitalNotify}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/20 active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isNotifyingHospital ? 'Duke regjistruar...' : 'Konfirmo Njoftimin e Spitalit'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PHOTO PREVIEW MODAL */}
      <AnimatePresence>
        {previewPhoto && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full p-4 overflow-hidden border border-slate-200 dark:border-zinc-800 space-y-3"
            >
              <div className="flex items-center justify-between pb-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {previewPhoto.title}
                </p>
                <button
                  onClick={() => setPreviewPhoto(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-100 dark:border-zinc-800 flex items-center justify-center bg-slate-950">
                {previewPhoto.documentType === 'pdf'
                  ? <iframe title={previewPhoto.title} src={previewPhoto.url} className="h-[68vh] w-full rounded-xl bg-white" />
                  : <img src={previewPhoto.url} alt="" className="max-h-[68vh] object-contain w-auto rounded-xl" />}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <a
                  href={previewPhoto.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>{dt('Hap në madhësi të plotë')}</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GOFUNDME MODAL */}
      <AnimatePresence>
        {goFundMeModalCase && (
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                    <Heart className="w-5 h-5 fill-emerald-500/20" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      Vendos Linkun e GoFundMe
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Për: {goFundMeModalCase.fullName} • Komuna e {goFundMeModalCase.municipality}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setGoFundMeModalCase(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                {dt('Vendosni linkun zyrtar të fushatës së hapur në')} <strong>GoFundMe</strong> (ose platformë tjetër bamirësie). Me t'u ruajtur ky link, çdo qytetar mund të klikojë butonin <strong>"Kontribo"</strong> {dt('dhe të dhurojë ndihmë financiare menjëherë.')}
              </div>

              <form onSubmit={handleSaveGoFundMe} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Linku i GoFundMe / Donacionit *
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={goFundMeInputUrl}
                      onChange={e => setGoFundMeInputUrl(e.target.value)}
                      placeholder="https://www.gofundme.com/f/emri-i-fushatës..."
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-medium"
                    />
                    <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {dt('Shembull: https://www.gofundme.com/f/ndihme-per-sherim')}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
                  {goFundMeModalCase.donationUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setGoFundMeInputUrl('');
                      }}
                      className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors mr-auto cursor-pointer"
                    >
                      Pastro Linkun
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setGoFundMeModalCase(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                  >
                    {dt('Anulo')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingGoFundMe}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 fill-white" />
                    <span>{isSavingGoFundMe ? 'Po ruhet...' : 'Ruaj Linkun'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

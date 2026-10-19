import React, { useState, useEffect, useMemo, useRef } from 'react';
import {  dt } from '../lib/dt'; import { AuraHero, AuraNote, AuraOrbit } from '../components/aura/Aura';
import {
  HeartPulse, Activity, ShieldAlert, Plus, Search, Filter, MapPin, 
  User, Calendar, AlertCircle, CheckCircle2, ChevronRight, Share2, 
  Phone, Heart, Download, FileText, Sparkles, Building2, Droplets,
  Stethoscope, Pill, X, ArrowUpRight, Upload, Camera, Eye, Send,
  Mail, Printer, AlertTriangle, ShieldCheck, Link as LinkIcon, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { HealthCaseWizard, type HealthFormState } from '../components/health/HealthCaseWizard';
import { CATEGORY_META, URGENCY_META, categoryMeta, statusMeta, urgencyMeta } from '../lib/healthCategories';
import toast from 'react-hot-toast';
import { withTimeout } from '../lib/timeouts';
import { saveGuestReportHistory } from '../lib/session';
import { TrackIdIssuedModal } from '../components/TrackIdIssuedModal';

import { HealthCase } from '../types';
export type { HealthCase };

const DISEASE_CATEGORIES: { id: string; name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', name: 'Të Gjitha Sëmundjet', icon: HeartPulse },
  ...CATEGORY_META,
];

type GroupBy = 'none' | 'category' | 'urgency' | 'municipality';
const GROUP_OPTIONS: { id: GroupBy; label: string }[] = [
  { id: 'category', label: 'Sipas kategorisë' },
  { id: 'urgency', label: 'Sipas urgjencës' },
  { id: 'municipality', label: 'Sipas komunës' },
  { id: 'none', label: 'Pa grupim' },
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
  const [issuedTrackingId, setIssuedTrackingId] = useState<string | null>(null);
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
  const [form, setForm] = useState<HealthFormState>({
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
    documentType: 'image',
    documentName: '',
  });

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

  const [groupBy, setGroupBy] = useState<GroupBy>('category');

  /**
   * Cases are ordered so the most urgent come first inside every group, and
   * the groups themselves follow the order of the taxonomy (category list,
   * urgency rank) rather than whichever case happened to be newest.
   */
  const { displayedCases, groupLabelFor } = useMemo(() => {
    const groupKey = (c: HealthCase) =>
      groupBy === 'category' ? c.category : groupBy === 'urgency' ? c.urgency : groupBy === 'municipality' ? c.municipality : 'all';
    const groupRank = (c: HealthCase) =>
      groupBy === 'category' ? CATEGORY_META.findIndex((m) => m.id === c.category)
        : groupBy === 'urgency' ? urgencyMeta(c.urgency).rank
        : 0;
    const sorted = [...filteredCases].sort((a, b) =>
      groupRank(a) - groupRank(b)
      || (groupBy === 'municipality' ? a.municipality.localeCompare(b.municipality) : 0)
      || urgencyMeta(a.urgency).rank - urgencyMeta(b.urgency).rank
      || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const counts = new Map<string, number>();
    sorted.forEach((c) => counts.set(groupKey(c), (counts.get(groupKey(c)) ?? 0) + 1));
    return {
      displayedCases: sorted,
      /** Returns the group header for the first case of each group, otherwise null. */
      groupLabelFor: (c: HealthCase, index: number) => {
        if (groupBy === 'none') return null;
        const key = groupKey(c);
        if (index > 0 && groupKey(sorted[index - 1]) === key) return null;
        return { key, count: counts.get(key) ?? 0 };
      },
    };
  }, [filteredCases, groupBy]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: cases.length };
    cases.forEach((c) => { counts[c.category] = (counts[c.category] ?? 0) + 1; });
    return counts;
  }, [cases]);

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
  const handleRegisterSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
      // HC-<time>-<4 random>: the random part comes from the platform CSPRNG and is
      // always four symbols (Math.random().toString(36) could come out shorter).
      const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');
      const trackingId = `HC-${Date.now().toString(36).toUpperCase()}-${randomPart}`;
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

      // Bounded: on a dead link the write never settles and the button spun forever.
      const docRef = await withTimeout(addDoc(collection(db, 'healthRegistry'), {
        ...newCaseData,
        healthCondition: diagnosis
      }), 30000, 'Serveri nuk u përgjigj në kohë. Kontrolloni lidhjen dhe provoni përsëri.');
      
      if (currentUser && currentUser.role !== 'guest') {
        setCases(prev => [{ id: docRef.id, ...newCaseData }, ...prev]);
      }

      saveGuestReportHistory({
        id: docRef.id,
        trackingId,
        title: `Rast shëndetësor: ${form.category}`,
        category: form.category,
        status: 'pending',
        municipality: form.municipality,
        createdAt: newCaseData.createdAt,
      });
      setIssuedTrackingId(trackingId);
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
      // Persist first; the list only changes once the write really succeeded.
      await updateDoc(doc(db, 'healthRegistry', goFundMeModalCase.id), {
        donationUrl: url || null
      });
      setCases(prev => prev.map(item => item.id === goFundMeModalCase.id ? { ...item, donationUrl: url || undefined } : item));

      toast.success(url ? 'Linku u ruajt te rasti juaj privat.' : 'Linku i donacionit u hoq.');
      setGoFundMeModalCase(null);
    } catch (err) {
      console.error(err);
      toast.error('Linku nuk u ruajt. Provoni përsëri.');
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

      toast.success(`U shënua si i njoftuar: ${hospitalInfo.name}. Platforma nuk dërgon vetë mesazh; dërgojeni me email, telefon ose WhatsApp.`, { duration: 8000 });
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
    <div className="au-page min-h-screen pb-20">
      <TrackIdIssuedModal
        trackingId={issuedTrackingId}
        title={dt('Rasti u regjistrua')}
        note={dt('Kërkesa pret verifikimin nga stafi i autorizuar. Rasti nuk është publik; me këtë kod ndiqni fazën e tij.')}
        onClose={() => setIssuedTrackingId(null)}
      />
      <div className="px-4 pt-4 sm:px-6 lg:px-8 lg:pt-8">
        <div className="mx-auto max-w-6xl">
          <AuraHero
            visual={<AuraOrbit core={ShieldCheck} />}
            tone="rose"
            eyebrow={dt('Shërbim qytetar · Privatësi si parazgjedhje')}
            icon={HeartPulse}
            title={dt('Kujdes i organizuar. Të dhëna të mbrojtura.')}
            subtitle={dt('Një hapësirë e sigurt për të paraqitur nevoja shëndetësore, ndjekur kërkesat e tua dhe gjetur institucionin përkatës. Rastet dhe dokumentet mjekësore nuk janë publike.')}
            actions={<>
              <button onClick={() => setIsRegisterModalOpen(true)} className="au-btn au-btn-light"><Plus className="h-4 w-4" aria-hidden="true" /><span>{dt('Regjistro Rast / Kërko Ndihmë')}</span></button>
              {currentUser && currentUser.role !== 'guest' && cases.length > 0 && (
                <button onClick={handleExportCSV} className="au-btn au-btn-glass" title={dt('Shkarko evidencën në formatin CSV / Excel')}>
                  <Download className="h-4 w-4" aria-hidden="true" /><span>{dt('Shkarko CSV')}</span>
                </button>
              )}
            </>}
          />
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-4 px-3 py-4 sm:px-6 lg:px-8">
        {/* How it works: one compact strip */}
        <section className="au-tile grid divide-y divide-[var(--au-line)] sm:grid-cols-3 sm:divide-x sm:divide-y-0" aria-label={dt('Si funksionon mbështetja shëndetësore')}>
          {[
            { n: 1, title: 'Paraqite nevojën', description: 'Dërgo kërkesën pa llogari, në mënyrë anonime ose me identitet dhe pëlqim të qartë.', icon: FileText },
            { n: 2, title: 'Shqyrtim i sigurt', description: 'Kërkesa merr kod gjurmimi dhe kalon në verifikim nga stafi i autorizuar.', icon: ShieldCheck },
            { n: 3, title: 'Gjej institucionin', description: 'Përdor drejtorinë për kontaktet e spitaleve rajonale dhe QKMF-ve.', icon: Building2 },
          ].map(({ n, title, description, icon: Icon }) => (
            <article key={n} className="flex items-start gap-3 p-4">
              <span className="au-ico"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
              <div className="min-w-0">
                <h2 className="text-[14px] font-semibold"><span className="au-sub mr-1 tabular-nums">{n}.</span>{title}</h2>
                <p className="au-sub mt-0.5 text-[12.5px] leading-snug">{description}</p>
              </div>
            </article>
          ))}
        </section>

        <AuraNote tone="warn" icon={AlertCircle}>
          <strong>{dt('Shënim i rëndësishëm:')}</strong> {dt('Regjistri koordinon kërkesat qytetare dhe nuk zëvendëson këshillën, diagnozën apo kujdesin urgjent mjekësor.')}
        </AuraNote>

        {/* Key figures: one strip instead of five cards */}
        {totalCount > 0 && <dl className="au-tile grid grid-cols-2 divide-[var(--au-line)] sm:grid-cols-5 sm:divide-x" aria-label={dt('Të dhëna personale të mbrojtura')}>
          {[
            { label: 'Rastet e mia', value: totalCount, note: dt('Të dhëna personale të mbrojtura') },
            { label: 'Kancer / Onkologji', value: cancerCount, note: dt('Vetëm nga rastet e tua') },
            { label: 'Sëmundje Zemre', value: heartCount, note: dt('Kardiake, nga rastet e tua') },
            { label: 'Raste Urgjente', value: urgentCount, note: dt('Sipas urgjencës së regjistruar') },
            { label: dt('Dokumente Mjekësore'), value: withDocCount, note: dt('Dokumente në hapësirë private') },
          ].map(kpi => (
            <div key={kpi.label} className="px-4 py-3">
              <dd className="text-[24px] font-semibold leading-none tabular-nums">{kpi.value}</dd>
              <dt className="mt-1.5 truncate text-[12px] font-medium">{kpi.label}</dt>
              <p className="au-sub truncate text-[11px]">{kpi.note}</p>
            </div>
          ))}
        </dl>}

        {/* View switcher */}
        <div className="au-rail" role="tablist" aria-label={dt('Pamjet e regjistrit shëndetësor')}>
          {([
            { id: 'cases', icon: User, label: `Rastet e mia (${filteredCases.length})` },
            { id: 'municipalStats', icon: Building2, label: dt('Përmbledhja ime (private)') },
            { id: 'hospitalDirectory', icon: Stethoscope, label: dt('Spitalet & QKMF e Kosovës') },
            { id: 'shortages', icon: Pill, label: 'Mungesat e Barnave' },
          ] as const).map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={activeTab === t.id} onClick={() => setActiveTab(t.id)} className="au-chip">
              <t.icon className="h-3.5 w-3.5" aria-hidden="true" />{t.label}
            </button>
          ))}
        </div>

        {activeTab === 'shortages' && <MedicineShortages />}

        {/* TAB 1: CASES FEED */}
        {activeTab === 'cases' && (
          <div className="space-y-6">
            {/* Filters: only useful once there is something to filter. */}
            {cases.length > 0 && <div className="space-y-2.5">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <div className="relative">
                  <label htmlFor="hr-search" className="sr-only">{dt('Kërko me emër, diagnozë, komunë...')}</label>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" aria-hidden="true" />
                  <input id="hr-search" type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={dt('Kërko me emër, diagnozë, komunë...')} className="au-input !pl-9" />
                </div>
                <select aria-label={dt('Komuna')} value={selectedMunicipality} onChange={e => setSelectedMunicipality(e.target.value)} className="au-input sm:!w-52">
                  <option value="Të Gjitha">{dt('📍 Të Gjitha 38 Komunat')}</option>
                  {KOSOVO_MUNICIPALITIES.map(m => (<option key={m} value={m}>{m} ({municipalityStats[m]?.total || 0} raste)</option>))}
                </select>
                <select aria-label={dt('Urgjenca')} value={selectedUrgency} onChange={e => setSelectedUrgency(e.target.value)} className="au-input sm:!w-52">
                  <option value="all">{dt('⚡ Të gjitha Nivelet e Urgjencës')}</option>
                  {URGENCY_META.map((item) => (<option key={item.id} value={item.id}>{dt(item.label)}</option>))}
                </select>
              </div>
              <div className="au-rail" role="group" aria-label={dt('Kategoritë')}>
                {DISEASE_CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <button key={cat.id} type="button" aria-pressed={selectedCategory === cat.id} onClick={() => setSelectedCategory(cat.id)} className="au-chip">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" /><span>{dt(cat.name)}</span>
                      <span className="ml-1 rounded-full bg-black/10 px-1.5 text-[10px] font-black tabular-nums dark:bg-white/15">{categoryCounts[cat.id] ?? 0}</span>
                    </button>
                  );
                })}
              </div>
            </div>}

            {displayedCases.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-500" aria-live="polite">
                  {displayedCases.length} {displayedCases.length === 1 ? dt('rast') : dt('raste')}
                  {urgentCount > 0 && <> · <span className="text-rose-600 dark:text-rose-400">{urgentCount} {dt('urgjente')}</span></>}
                </p>
                <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-zinc-800" role="radiogroup" aria-label={dt('Grupimi i rasteve')}>
                  {GROUP_OPTIONS.map((option) => (
                    <button key={option.id} type="button" role="radio" aria-checked={groupBy === option.id} onClick={() => setGroupBy(option.id)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${groupBy === option.id ? 'bg-white text-rose-700 shadow-sm dark:bg-zinc-700 dark:text-rose-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                      {dt(option.label)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cases Grid */}
            {displayedCases.length === 0 ? (
              <div className="au-tile px-6 py-10 text-center">
                <HeartPulse className="mx-auto h-7 w-7 opacity-40" aria-hidden="true" />
                <h3 className="mt-3 text-[15px] font-semibold">
                  {searchQuery || selectedMunicipality !== 'Të Gjitha' || selectedCategory !== 'all' || selectedUrgency !== 'all' ? 'Nuk u gjetën raste për filtrat e zgjedhur' : 'Nuk ke ende raste të regjistruara'}
                </h3>
                <p className="au-sub mx-auto mt-1 max-w-sm text-[13px]">
                  {currentUser && currentUser.role !== 'guest' ? 'Regjistro një rast për të ndjekur shqyrtimin dhe hapat e mbështetjes.' : 'Dërgo kërkesë shëndetësore anonime ose me identitet. Për arsye privatësie, rastet pa llogari nuk shfaqen në këtë listë.'}
                </p>
                <button onClick={() => setIsRegisterModalOpen(true)} className="au-btn au-btn-primary mt-4">{dt('Regjistro Rast të Ri')}</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {displayedCases.map((c, index) => {
                  const assignedHospital = getHospitalInfoForMunicipality(c.municipality);
                  const cMeta = categoryMeta(c.category);
                  const uMeta = urgencyMeta(c.urgency);
                  const sMeta = statusMeta(c.status, c.hospitalNotified);
                  const groupHeader = groupLabelFor(c, index);
                  const headerMeta = groupHeader && groupBy === 'category' ? categoryMeta(groupHeader.key) : null;
                  return (
                    <React.Fragment key={c.id}>
                    {groupHeader && (
                      <div className="col-span-full flex items-center gap-2.5 pt-2 first:pt-0">
                        <span className={`h-5 w-1 rounded-full ${headerMeta ? headerMeta.bar : groupBy === 'urgency' ? urgencyMeta(groupHeader.key).dot : 'bg-slate-400'}`} />
                        <h3 className={`text-sm font-black ${headerMeta ? headerMeta.accent : 'text-slate-900 dark:text-white'}`}>
                          {groupBy === 'category' ? dt(headerMeta!.name) : groupBy === 'urgency' ? dt(urgencyMeta(groupHeader.key).label) : groupHeader.key}
                        </h3>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black tabular-nums text-slate-600 dark:bg-zinc-800 dark:text-slate-300">{groupHeader.count}</span>
                        <span className="h-px flex-1 bg-slate-200 dark:bg-zinc-800" />
                      </div>
                    )}
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`au-tile flex flex-col justify-between border-l-4 p-4 ${c.urgency === 'Urgjente' ? 'border-l-rose-500' : c.urgency === 'Mesatare' ? 'border-l-amber-400' : 'border-l-emerald-400'}`}
                    >
                      <div className="space-y-3.5">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl ${cMeta.tile}`} title={dt(cMeta.name)}>
                              <cMeta.icon className="h-4 w-4" aria-hidden="true" />
                              <span className="mt-0.5 text-[8px] font-black leading-none">{cMeta.abbr}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                                  {c.isAnonymous ? 'Rast anonim i mbrojtur' : c.fullName}
                                </h3>
                                {(c.status === 'verified' || c.status === 'resolved') && (
                                  <span title={dt('Rast i verifikuar')}>
                                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 font-medium mt-0.5">
                                {c.age} vjeç • {c.gender} • Viti i diagnozës: {c.diagnosedYear}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${uMeta.pill}`}>
                              {dt(uMeta.label)}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sMeta.pill}`}>{dt(sMeta.label)}</span>
                          </div>
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
                              className="group cursor-pointer p-2 bg-slate-50 dark:bg-zinc-800/60 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 rounded-xl border border-slate-200/80 dark:border-zinc-700/80 flex items-center justify-between transition"
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
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                            title={dt('Njofto Spitalin ose QKMF-në për këtë rast')}
                          >
                            <Send className="w-3 h-3" />
                            <span>Njofto Spitalin</span>
                          </button>

                          {/* Kontribo me GoFundMe */}
                          {c.donationUrl ? (
                            <div className="inline-flex items-center gap-1">
                              <a
                                href={/^https?:\/\//i.test(c.donationUrl) ? c.donationUrl : '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 group"
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
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
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
                    </React.Fragment>
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
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition"
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
          <div className="fixed inset-0 z-[9999] bg-black/70 md:backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              role="dialog"
              aria-modal="true"
              aria-label={dt('Regjistro Rast Shëndetësor')}
              className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-zinc-800 my-4 max-h-[94vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 dark:border-zinc-800 px-6 py-4">
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

              <HealthCaseWizard
                form={form}
                setForm={setForm}
                neighborhoods={currentAvailableNeighborhoods}
                canAttach={Boolean(auth.currentUser && !auth.currentUser.isAnonymous)}
                isSubmitting={isSubmitting}
                isUploadingDocument={isUploadingDocument}
                onPickDocument={handlePhotoSelect}
                onSubmit={() => void handleRegisterSubmit()}
                onClose={() => setIsRegisterModalOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HOSPITAL NOTIFICATION MODAL */}
      <AnimatePresence>
        {hospitalModalCase && hospitalInfo && (
          <div className="fixed inset-0 z-[9999] bg-black/70 md:backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
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
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/20 active:scale-95 transition"
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
          <div className="fixed inset-0 z-[9999] bg-black/85 md:backdrop-blur-md flex items-center justify-center p-4">
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
          <div className="fixed inset-0 z-[9999] bg-black/60 md:backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
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
                {dt('Vendosni linkun zyrtar të fushatës së hapur në')} <strong>GoFundMe</strong> (ose platformë tjetër bamirësie). {dt('Linku ruhet te rasti juaj. Rastet shëndetësore nuk janë publike, kështu që linku shfaqet vetëm te ju, jo te qytetarët e tjerë.')}
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
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
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

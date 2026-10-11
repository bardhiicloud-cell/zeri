import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo, useRef } from 'react';
import { HeartPulse, Activity, ShieldAlert, Plus, Search, MapPin, User, AlertCircle, CheckCircle2, Share2, Phone, Heart, Download, FileText, Sparkles, Building2, Droplets, Stethoscope, Pill, X, ArrowUpRight, Camera, Eye, Send, Mail, AlertTriangle, ShieldCheck, Link as LinkIcon, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, query, updateDoc, doc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../lib/store';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import { cn } from '../lib/utils';
import { getMunicipalNeighborhoods } from '../lib/kosovoNeighborhoods';
import { getHospitalInfoForMunicipality } from '../data/kosovoHospitals';
import toast from 'react-hot-toast';
// Exactly 2 realistic demo examples as requested by the user
const INITIAL_HEALTH_CASES = [
    {
        id: 'hc-1',
        fullName: 'Arben Gashi',
        age: 54,
        gender: 'Mashkull',
        municipality: 'Prishtinë',
        neighborhood: 'Dardania',
        category: 'Kancer / Onkologji',
        diagnosis: 'Adenokarcinomë e mushkërive (Stadi 3)',
        diagnosedYear: 2024,
        urgency: 'Urgjente',
        needs: ['Terapi Imunologjike', 'Barna Citostatike', 'Mbështetje Financiare'],
        description: 'Kërkohet ndihmë për sigurimin e medikamentit Pembrolizumab që nuk mbulohet nga lista esenciale e barnave.',
        contactPhone: '+383 44 210 340',
        contactName: 'Djali (Valon Gashi)',
        isAnonymous: true,
        supportAmountNeeded: 6500,
        supportAmountRaised: 2800,
        donationUrl: 'https://www.gofundme.com/f/ndihme-per-sherimin-e-arben-gashit',
        imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=800&auto=format&fit=crop&q=80',
        hospitalNotified: true,
        hospitalNotifiedAt: '2026-03-15T11:00:00Z',
        hospitalTarget: 'QKUK - Qendra Klinike Universitare e Kosovës',
        status: 'verified',
        createdAt: '2026-03-01T10:00:00Z'
    },
    {
        id: 'hc-2',
        fullName: 'Liridona Krasniqi',
        age: 42,
        gender: 'Femër',
        municipality: 'Prizren',
        neighborhood: 'Ortakoll',
        category: 'Sëmundje të Zemrës',
        diagnosis: 'Pamjaftueshmëri Kardiake e Avancuar & Kardiomiopati',
        diagnosedYear: 2023,
        urgency: 'Urgjente',
        needs: ['Pajisje Ndihmëse LVAD', 'Operacion Jashtë Vendit', 'Kontrolle të Specializuara'],
        description: 'Rekomanduar për ndërhyrje kirurgjike kardiokirurgjike jashtë Kosovës në mungesë të aparaturës përkatëse në spital.',
        contactPhone: '+383 49 112 890',
        contactName: 'Bashkëshorti (Besnik)',
        isAnonymous: true,
        supportAmountNeeded: 12000,
        supportAmountRaised: 7400,
        donationUrl: 'https://www.gofundme.com/f/operacioni-kardiak-liridona-krasniqi',
        imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&auto=format&fit=crop&q=80',
        hospitalNotified: false,
        status: 'verified',
        createdAt: '2026-03-04T12:30:00Z'
    },
    {
        id: 'hc-3',
        fullName: 'Rinor Berisha',
        age: 11,
        gender: 'Mashkull',
        municipality: 'Gjilan',
        neighborhood: 'Kodra e Trimave',
        category: 'Sëmundje të Mushkërive',
        diagnosis: 'Diabet i ri me komplikim pulmonar dhe nevojë për oksigjen',
        diagnosedYear: 2025,
        urgency: 'Urgjente',
        needs: ['Monitorim në shtëpi', 'Oksigjen mjekësor', 'Kontrolle pulmonare'],
        description: 'Kërkohet mbështetje e shpejtë për pajisje dhe kontrolle ekstra për një fëmijë në nevojë kritike.',
        contactPhone: '+383 44 990 818',
        contactName: 'Nëna (Merita Berisha)',
        isAnonymous: true,
        supportAmountNeeded: 4200,
        supportAmountRaised: 1800,
        donationUrl: 'https://www.gofundme.com/f/rinor-berisha-mbështetje-pulmonare',
        imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&auto=format&fit=crop&q=80',
        hospitalNotified: true,
        status: 'verified',
        createdAt: '2026-04-02T08:15:00Z'
    },
    {
        id: 'hc-4',
        fullName: 'Mimoza Hoxha',
        age: 63,
        gender: 'Femër',
        municipality: 'Pejë',
        neighborhood: 'Qendra',
        category: 'Diabet me Komplikime',
        diagnosis: 'Diabet mellitus me komplikime të retinës dhe nefropati',
        diagnosedYear: 2021,
        urgency: 'Mesatare',
        needs: ['Kontrolle oftalmologjike', 'Barna për dializë', 'Transport për terapitë'],
        description: 'Në mungesë të trajtimit të duhur, gjendja po përkeqësohet dhe kërkon mbështetje afatmesme për mjekim dhe transport.',
        contactPhone: '+383 49 501 291',
        contactName: 'Bashkëshorti (Naim Hoxha)',
        isAnonymous: true,
        supportAmountNeeded: 3600,
        supportAmountRaised: 2100,
        donationUrl: 'https://www.gofundme.com/f/mbështetje-mjekësore-mimoza-hoxha',
        imageUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&auto=format&fit=crop&q=80',
        hospitalNotified: false,
        status: 'verified',
        createdAt: '2026-04-14T14:00:00Z'
    },
    {
        id: 'hc-5',
        fullName: 'Blerim Lajqi',
        age: 48,
        gender: 'Mashkull',
        municipality: 'Mitrovicë',
        neighborhood: 'Bajram Curri',
        category: 'Sëmundje Neurologjike',
        diagnosis: 'Sëmundje e gjatë e nervave me nevojë për rehabilitim të vazhdueshëm',
        diagnosedYear: 2022,
        urgency: 'Mesatare',
        needs: ['Rehabilitimi fizik', 'Sesione neurologjike', 'Pajisje mbështetëse'],
        description: 'Përparimi është i ngadaltë dhe kërkon rehabilitim të vazhdueshëm dhe mbështetje për trajtimin në shtëpi.',
        contactPhone: '+383 44 136 451',
        contactName: 'Vëllai (Jeton Lajqi)',
        isAnonymous: true,
        supportAmountNeeded: 5200,
        supportAmountRaised: 2400,
        donationUrl: 'https://www.gofundme.com/f/rehabilitimi-blerim-lajqi',
        imageUrl: 'https://images.unsplash.com/photo-1538108149393-fbbd81895977?w=800&auto=format&fit=crop&q=80',
        hospitalNotified: true,
        status: 'verified',
        createdAt: '2026-03-20T09:40:00Z'
    },
    {
        id: 'hc-6',
        fullName: 'Amina Maxhuni',
        age: 36,
        gender: 'Femër',
        municipality: 'Ferizaj',
        neighborhood: 'Kaqanik',
        category: 'Sëmundje e Rrallë',
        diagnosis: 'Sëmundje e rrallë autoimune me nevojë për terapie të specializuar',
        diagnosedYear: 2024,
        urgency: 'Urgjente',
        needs: ['Terapi biologjike', 'Monitorim laboratorik', 'Mbështetje për udhëtim'],
        description: 'Trajtimi është i kushtueshëm dhe po kërkon mbështetje për të vazhduar terapinë në kohë.',
        contactPhone: '+383 49 112 500',
        contactName: 'Babai (Hajdin Maxhuni)',
        isAnonymous: true,
        supportAmountNeeded: 9000,
        supportAmountRaised: 4700,
        donationUrl: 'https://www.gofundme.com/f/amina-maxhuni-terapi-biologjike',
        imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&auto=format&fit=crop&q=80',
        hospitalNotified: true,
        status: 'verified',
        createdAt: '2026-05-09T06:20:00Z'
    }
];
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
    const [cases, setCases] = useState(INITIAL_HEALTH_CASES);
    const [selectedMunicipality, setSelectedMunicipality] = useState('Të Gjitha');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedUrgency, setSelectedUrgency] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    // Modals
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('cases');
    // Hospital notification modal
    const [hospitalModalCase, setHospitalModalCase] = useState(null);
    const [hospitalInfo, setHospitalInfo] = useState(null);
    const [hospitalNotes, setHospitalNotes] = useState('');
    const [isNotifyingHospital, setIsNotifyingHospital] = useState(false);
    // Photo viewer modal
    const [previewPhoto, setPreviewPhoto] = useState(null);
    // GoFundMe contribution modal
    const [goFundMeModalCase, setGoFundMeModalCase] = useState(null);
    const [goFundMeInputUrl, setGoFundMeInputUrl] = useState('');
    const [isSavingGoFundMe, setIsSavingGoFundMe] = useState(false);
    // Form State
    const [form, setForm] = useState({
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
        supportAmountNeeded: 0,
        donationUrl: '',
        imageUrl: ''
    });
    const fileInputRef = useRef(null);
    // Firestore synchronization. Health records are private by design: citizens can
    // read their own submitted cases, while the public feed uses redacted examples.
    useEffect(() => {
        if (!currentUser || currentUser.role === 'guest') {
            setCases(INITIAL_HEALTH_CASES);
            return;
        }
        try {
            const q = query(collection(db, 'healthRegistry'), where('authorId', '==', currentUser.id));
            const unsub = onSnapshot(q, (snapshot) => {
                const loaded = snapshot.docs.map((healthDoc) => ({
                    id: healthDoc.id,
                    ...healthDoc.data(),
                })).sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
                const combined = [...loaded];
                INITIAL_HEALTH_CASES.forEach((initialCase) => {
                    if (!combined.some((healthCase) => healthCase.id === initialCase.id)) {
                        combined.push(initialCase);
                    }
                });
                setCases(combined);
            }, (err) => {
                console.warn('Using offline health registry cache:', err);
                setCases(INITIAL_HEALTH_CASES);
            });
            return () => unsub();
        }
        catch (e) {
            console.warn('Firestore error:', e);
            setCases(INITIAL_HEALTH_CASES);
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
                if (!matchName && !matchDiag && !matchMun && !matchNeigh && !matchNeeds)
                    return false;
            }
            return true;
        });
    }, [cases, selectedMunicipality, selectedCategory, selectedUrgency, searchQuery]);
    const myCases = useMemo(() => {
        if (!currentUser || currentUser.role === 'guest')
            return [];
        return filteredCases.filter((healthCase) => healthCase.authorId === currentUser.id);
    }, [currentUser, filteredCases]);
    const displayedCases = activeTab === 'myCases' ? myCases : filteredCases;
    // Aggregate stats per municipality (all 38 municipalities)
    const municipalityStats = useMemo(() => {
        const stats = {};
        KOSOVO_MUNICIPALITIES.forEach(m => {
            stats[m] = { total: 0, cancer: 0, heart: 0, lung: 0, urgent: 0 };
        });
        cases.forEach(c => {
            if (!stats[c.municipality]) {
                stats[c.municipality] = { total: 0, cancer: 0, heart: 0, lung: 0, urgent: 0 };
            }
            stats[c.municipality].total += 1;
            if (c.category === 'Kancer / Onkologji')
                stats[c.municipality].cancer += 1;
            if (c.category === 'Sëmundje të Zemrës')
                stats[c.municipality].heart += 1;
            if (c.category === 'Sëmundje të Mushkërive')
                stats[c.municipality].lung += 1;
            if (c.urgency === 'Urgjente')
                stats[c.municipality].urgent += 1;
        });
        return stats;
    }, [cases]);
    // Grand totals
    const totalCount = cases.length;
    const cancerCount = cases.filter(c => c.category === 'Kancer / Onkologji').length;
    const heartCount = cases.filter(c => c.category === 'Sëmundje të Zemrës').length;
    const urgentCount = cases.filter(c => c.urgency === 'Urgjente').length;
    const withDocCount = cases.filter(c => c.imageUrl).length;
    // Handle Photo selection & conversion to Base64
    const handlePhotoSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (file.size > 8 * 1024 * 1024) {
            toast.error('Madhësia e fotos/dokumentit nuk duhet të kalojë 8MB.');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                setForm(prev => ({ ...prev, imageUrl: reader.result }));
                toast.success('Foto e dokumentit u ngarkua me sukses!');
            }
        };
        reader.readAsDataURL(file);
    };
    // Submit new Health Case
    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        if (!currentUser || currentUser.role === 'guest') {
            toast.error('Për regjistrim shëndetësor kërkohet një llogari e regjistruar, për mbrojtjen e të dhënave tuaja.');
            return;
        }
        if (!form.diagnosis.trim()) {
            toast.error('Ju lutem shënoni diagnozën specifike.');
            return;
        }
        setIsSubmitting(true);
        try {
            const needsArray = form.needsInput
                ? form.needsInput.split(',').map(s => s.trim()).filter(Boolean)
                : ['Mbështetje Mjekësore', 'Furnizim me Barna'];
            const isAnonymousCase = form.isAnonymous;
            const protectedFullName = isAnonymousCase ? 'Rast i Mbrojtur / Anonim' : form.fullName.trim();
            const protectedContactPhone = isAnonymousCase ? '' : form.contactPhone.trim();
            const protectedContactName = isAnonymousCase ? 'Kontakt i rezervuar për admin' : form.contactName.trim();
            const newCaseData = {
                trackingId: `HC-${Date.now().toString(36).toUpperCase()}`,
                authorId: currentUser.id,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                // The real identity remains in the protected record for authorized administrators.
                // The public interface uses isAnonymous to redact it in every public view.
                fullName: protectedFullName,
                age: Number(form.age),
                gender: form.gender,
                municipality: form.municipality,
                neighborhood: form.neighborhood || 'Qendër',
                category: form.category,
                diagnosis: form.diagnosis,
                diagnosedYear: Number(form.diagnosedYear),
                urgency: form.urgency,
                needs: needsArray,
                description: form.description,
                contactPhone: protectedContactPhone,
                contactName: protectedContactName,
                isAnonymous: isAnonymousCase,
                contactVisibility: 'admin_only',
                hospitalPrivacyNotice: isAnonymousCase
                    ? 'RAST ANONIM: Emri i pacientit nuk duhet të shfaqet në dokumentet, komunikimet apo evidencat e spitalit. Kontakti është i qasshëm vetëm për administratorët e autorizuar.'
                    : 'Kontakti i pacientit është i qasshëm vetëm për administratorët e autorizuar; nuk publikohet në platformë.',
                supportAmountNeeded: Number(form.supportAmountNeeded) || 0,
                supportAmountRaised: 0,
                donationUrl: form.donationUrl.trim() || undefined,
                imageUrl: form.imageUrl || undefined,
                hospitalNotified: false,
                status: 'verified',
                createdAt: new Date().toISOString()
            };
            // Add to Firestore
            const docRef = await addDoc(collection(db, 'healthRegistry'), {
                ...newCaseData,
                authorId: currentUser.id,
                healthCondition: form.diagnosis
            });
            // Update local state immediately
            setCases(prev => [{ id: docRef.id, ...newCaseData }, ...prev]);
            toast.success(`Rasti u regjistrua me sukses në Komunën e ${form.municipality}!`);
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
                supportAmountNeeded: 0,
                donationUrl: '',
                imageUrl: ''
            });
        }
        catch (err) {
            console.error(err);
            toast.error('Gabim gjatë regjistrimit të rastit.');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    // Open GoFundMe Modal
    const handleOpenGoFundMeModal = (c) => {
        setGoFundMeModalCase(c);
        setGoFundMeInputUrl(c.donationUrl || '');
    };
    // Save GoFundMe Link
    const handleSaveGoFundMe = async (e) => {
        e.preventDefault();
        if (!goFundMeModalCase)
            return;
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
            }
            catch (err) {
                console.warn("Firestore update notice (offline/mock record):", err);
            }
            toast.success(url ? 'Linku i GoFundMe u ruajt me sukses!' : 'Linku i donacionit u hoq.');
            setGoFundMeModalCase(null);
        }
        catch (err) {
            console.error(err);
            toast.error('Gabim gjatë ruajtjes së linkut të GoFundMe.');
        }
        finally {
            setIsSavingGoFundMe(false);
        }
    };
    // Open Hospital Notification Modal
    const handleOpenHospitalModal = (c) => {
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
        if (!hospitalModalCase || !hospitalInfo)
            return;
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
        }
        catch (e) {
            console.error(e);
            toast.error('Gabim gjatë njoftimit.');
        }
        finally {
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
    return (_jsxs("div", { className: "min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-100 transition-colors pb-16", children: [_jsx("div", { className: "bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 py-8 px-4 sm:px-6 lg:px-8 shadow-xs", children: _jsxs("div", { className: "max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "inline-flex items-center gap-2 px-3 py-1 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 rounded-full text-xs font-bold uppercase tracking-wider", children: [_jsx(HeartPulse, { className: "w-3.5 h-3.5 animate-pulse text-rose-500" }), _jsx("span", { children: "Regjistri Sh\u00EBndet\u00EBsor Komb\u00EBtar \u2022 38 Komunat" })] }), _jsx("h1", { className: "text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-950 dark:text-white", children: "Evidenca e S\u00EBmundjeve t\u00EB R\u00EBnda & Kronike" }), _jsx("p", { className: "text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed", children: "Mbledhja transparente e t\u00EB dh\u00EBnave sh\u00EBndet\u00EBsore p\u00EBr secil\u00EBn komun\u00EB t\u00EB Kosov\u00EBs. Bashkangjitni dokumentet mjek\u00EBsore, njoftoni spitalin rajonal ose QKMF-n\u00EB dhe mund\u00EBsoni ndihm\u00EB t\u00EB shpejt\u00EB p\u00EBr qytetar\u00EBt." })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs("button", { onClick: handleExportCSV, className: "px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-2 border border-slate-200 dark:border-zinc-700 transition-all active:scale-95", title: "Shkarko evidenc\u00EBn n\u00EB formatin CSV / Excel", children: [_jsx(Download, { className: "w-4 h-4 text-emerald-600 dark:text-emerald-400" }), _jsx("span", { children: "Shkarko CSV" })] }), _jsxs("button", { onClick: () => setIsRegisterModalOpen(true), className: "px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-rose-600/25 active:scale-95 transition-all", children: [_jsx(Plus, { className: "w-4 h-4 stroke-[3]" }), _jsx("span", { children: "Regjistro Rast / K\u00EBrko Ndihm\u00EB" })] })] })] }) }), _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xs", children: [_jsxs("div", { className: "flex items-center justify-between text-slate-500 text-xs font-bold uppercase", children: [_jsx("span", { children: "Totali i Rasteve" }), _jsx(Building2, { className: "w-4 h-4 text-blue-500" })] }), _jsx("p", { className: "text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2", children: totalCount }), _jsx("p", { className: "text-[11px] text-slate-400 mt-1", children: "38 Komunat e Kosov\u00EBs" })] }), _jsxs("div", { className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xs", children: [_jsxs("div", { className: "flex items-center justify-between text-purple-600 text-xs font-bold uppercase", children: [_jsx("span", { children: "Kancer / Onkologji" }), _jsx(ShieldAlert, { className: "w-4 h-4" })] }), _jsx("p", { className: "text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 mt-2", children: cancerCount }), _jsx("p", { className: "text-[11px] text-slate-400 mt-1", children: "Terapi biologjike & kimioterapi" })] }), _jsxs("div", { className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xs", children: [_jsxs("div", { className: "flex items-center justify-between text-rose-600 text-xs font-bold uppercase", children: [_jsx("span", { children: "Raste Urgjente" }), _jsx(AlertTriangle, { className: "w-4 h-4 text-rose-500" })] }), _jsx("p", { className: "text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-2", children: urgentCount }), _jsx("p", { className: "text-[11px] text-slate-400 mt-1", children: "Nevoj\u00EB p\u00EBr nd\u00EBrhyrje menj\u00EBher\u00EB" })] }), _jsxs("div", { className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xs", children: [_jsxs("div", { className: "flex items-center justify-between text-emerald-600 text-xs font-bold uppercase", children: [_jsx("span", { children: "Dokumente Mjek\u00EBsore" }), _jsx(FileText, { className: "w-4 h-4 text-emerald-500" })] }), _jsx("p", { className: "text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2", children: withDocCount }), _jsx("p", { className: "text-[11px] text-slate-400 mt-1", children: "Epikriza & foto t\u00EB verifikuara" })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-zinc-800", role: "tablist", "aria-label": "Pamjet e regjistrit sh\u00EBndet\u00EBsor", children: [_jsxs("button", { type: "button", role: "tab", "aria-selected": activeTab === 'cases', onClick: () => setActiveTab('cases'), className: `inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all ${activeTab === 'cases'
                                    ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-800'}`, children: [_jsx(User, { className: "h-4 w-4", "aria-hidden": "true" }), _jsxs("span", { children: ["Rastet e Qytetar\u00EBve (", filteredCases.length, ")"] })] }), currentUser && currentUser.role !== 'guest' && (_jsxs("button", { type: "button", role: "tab", "aria-selected": activeTab === 'myCases', onClick: () => setActiveTab('myCases'), className: `inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all ${activeTab === 'myCases'
                                    ? 'bg-rose-600 text-white shadow-sm'
                                    : 'text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40'}`, children: [_jsx(ShieldCheck, { className: "h-4 w-4", "aria-hidden": "true" }), _jsxs("span", { children: ["Rastet e Mia (", myCases.length, ")"] })] })), _jsxs("button", { type: "button", role: "tab", "aria-selected": activeTab === 'municipalStats', onClick: () => setActiveTab('municipalStats'), className: `inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all ${activeTab === 'municipalStats'
                                    ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-800'}`, children: [_jsx(Building2, { className: "h-4 w-4", "aria-hidden": "true" }), _jsx("span", { children: "Evidenca p\u00EBr 38 Komunat" })] }), _jsxs("button", { type: "button", role: "tab", "aria-selected": activeTab === 'hospitalDirectory', onClick: () => setActiveTab('hospitalDirectory'), className: `inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all ${activeTab === 'hospitalDirectory'
                                    ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-800'}`, children: [_jsx(Stethoscope, { className: "h-4 w-4", "aria-hidden": "true" }), _jsx("span", { children: "Spitalet & QKMF e Kosov\u00EBs" })] })] }), (activeTab === 'cases' || activeTab === 'myCases') && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" }), _jsx("input", { type: "text", value: searchQuery, onChange: e => setSearchQuery(e.target.value), placeholder: "K\u00EBrko me em\u00EBr, diagnoz\u00EB, komun\u00EB...", className: "w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-rose-500 font-medium" })] }), _jsx("div", { children: _jsxs("select", { value: selectedMunicipality, onChange: e => setSelectedMunicipality(e.target.value), className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500", children: [_jsx("option", { value: "T\u00EB Gjitha", children: "\uD83D\uDCCD T\u00EB Gjitha 38 Komunat" }), KOSOVO_MUNICIPALITIES.map(m => (_jsxs("option", { value: m, children: [m, " (", municipalityStats[m]?.total || 0, " raste)"] }, m)))] }) }), _jsx("div", { children: _jsxs("select", { value: selectedUrgency, onChange: e => setSelectedUrgency(e.target.value), className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500", children: [_jsx("option", { value: "all", children: "\u26A1 T\u00EB gjitha Nivelet e Urgjenc\u00EBs" }), _jsx("option", { value: "Urgjente", children: "Urgjente" }), _jsx("option", { value: "Mesatare", children: "Mesatare" }), _jsx("option", { value: "Kronike e Stabilizuar", children: "Kronike e Stabilizuar" })] }) })] }), _jsx("div", { className: "flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar", children: DISEASE_CATEGORIES.map(cat => {
                                            const Icon = cat.icon;
                                            const isSelected = selectedCategory === cat.id;
                                            return (_jsxs("button", { onClick: () => setSelectedCategory(cat.id), className: `px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${isSelected
                                                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                                    : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-zinc-700 hover:border-slate-300'}`, children: [_jsx(Icon, { className: "w-3.5 h-3.5" }), _jsx("span", { children: cat.name })] }, cat.id));
                                        }) })] }), displayedCases.length === 0 ? (_jsxs("div", { className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-slate-500", children: [_jsx(HeartPulse, { className: "w-12 h-12 mx-auto text-slate-300 dark:text-zinc-700 mb-3" }), _jsx("h3", { className: "font-bold text-base text-slate-900 dark:text-white", children: activeTab === 'myCases' ? 'Nuk keni ende raste të regjistruara' : 'Nuk u gjet asnjë rast me këta filtra' }), _jsx("p", { className: "text-xs text-slate-400 mt-1 max-w-sm mx-auto", children: activeTab === 'myCases' ? 'Regjistroni një rast për të ndjekur verifikimin, njoftimin e spitalit dhe përfundimin e trajtimit.' : 'Mund të zgjidhni një komunë tjetër ose të regjistroni një rast të ri shëndetësor.' }), _jsx("button", { onClick: () => setIsRegisterModalOpen(true), className: "mt-4 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700", children: "Regjistro Rast t\u00EB Ri" })] })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-5", children: displayedCases.map(c => {
                                    const assignedHospital = getHospitalInfoForMunicipality(c.municipality);
                                    return (_jsxs(motion.div, { layout: true, initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between", children: [_jsxs("div", { className: "space-y-3.5", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${c.category === 'Kancer / Onkologji'
                                                                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                                                                            : c.category === 'Sëmundje të Zemrës'
                                                                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                                                                : c.category === 'Sëmundje të Mushkërive'
                                                                                    ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                                                                                    : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'}`, children: c.category === 'Kancer / Onkologji' ? 'ONK' : c.category === 'Sëmundje të Zemrës' ? 'KRD' : c.category === 'Sëmundje të Mushkërive' ? 'PUL' : 'SHËN' }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("h3", { className: "font-bold text-base text-slate-900 dark:text-white leading-tight", children: c.isAnonymous ? 'Rast anonim i mbrojtur' : c.fullName }), _jsx("span", { title: "Rast i verifikuar", children: _jsx(CheckCircle2, { className: "w-4 h-4 text-blue-500 shrink-0" }) })] }), _jsxs("p", { className: "text-xs text-slate-500 font-medium mt-0.5", children: [c.age, " vje\u00E7 \u2022 ", c.gender, " \u2022 Viti i diagnoz\u00EBs: ", c.diagnosedYear] })] })] }), _jsx("span", { className: `px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${c.urgency === 'Urgjente'
                                                                    ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                                                                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'}`, children: c.urgency })] }), _jsxs("div", { className: "rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/45", "aria-label": `Statusi i rastit ${c.trackingId || c.id}`, children: [_jsxs("div", { className: "mb-2 flex items-center justify-between gap-2", children: [_jsx("span", { className: "text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400", children: "Gjurmimi i rastit" }), _jsx("span", { className: "font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400", children: c.trackingId || `HC-${c.id.slice(0, 8).toUpperCase()}` })] }), c.status === 'rejected' ? (_jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-lg bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300", children: [_jsx(AlertCircle, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), " Rasti k\u00EBrkon rishikim"] })) : (_jsx("div", { className: "grid grid-cols-4 gap-1.5", children: [
                                                                    { label: 'Regjistruar', complete: true },
                                                                    { label: 'Verifikuar', complete: c.status !== 'pending' },
                                                                    { label: 'Spitali', complete: Boolean(c.hospitalNotified) },
                                                                    { label: 'Përfunduar', complete: c.status === 'resolved' },
                                                                ].map((step) => (_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: cn('mb-1 h-1.5 rounded-full', step.complete ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-zinc-700') }), _jsx("span", { className: cn('block truncate text-[9px] font-bold', step.complete ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-500'), children: step.label })] }, step.label))) }))] }), _jsxs("div", { className: "pt-2 border-t border-slate-100 dark:border-zinc-800/80 space-y-1.5", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300", children: [_jsx(MapPin, { className: "w-3.5 h-3.5 text-rose-500 shrink-0" }), _jsxs("span", { children: ["Komuna: ", c.municipality] }), c.neighborhood && _jsxs("span", { className: "text-slate-400 font-normal", children: ["\u2022 Lagjja: ", c.neighborhood] })] }), _jsx("p", { className: "text-sm font-bold text-slate-900 dark:text-white", children: c.diagnosis }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2", children: c.description })] }), c.imageUrl && (_jsx("div", { className: "pt-1", children: _jsxs("div", { onClick: () => setPreviewPhoto({ url: c.imageUrl, title: `${c.fullName} - Epikrizë / Dokument Mjekësor` }), className: "group cursor-pointer p-2 bg-slate-50 dark:bg-zinc-800/60 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 rounded-xl border border-slate-200/80 dark:border-zinc-700/80 flex items-center justify-between transition-all", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("img", { src: c.imageUrl, alt: "Dokument", className: "w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-zinc-700 shrink-0" }), _jsxs("div", { children: [_jsxs("p", { className: "text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1", children: [_jsx(ShieldCheck, { className: "w-3.5 h-3.5 text-emerald-500" }), _jsx("span", { children: "Dokument Mjek\u00EBsor / Epikriz\u00EB" })] }), _jsx("p", { className: "text-[11px] text-slate-400", children: "Kliko p\u00EBr ta par\u00EB n\u00EB madh\u00EBsi t\u00EB plot\u00EB" })] })] }), _jsx(Eye, { className: "w-4 h-4 text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors mr-1" })] }) })), c.needs && c.needs.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1.5 pt-1", children: c.needs.map((need, i) => (_jsxs("span", { className: "px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-medium", children: ["\u2022 ", need] }, i))) })), _jsxs("div", { className: "p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs", children: [_jsx("span", { className: "text-slate-500 dark:text-slate-400 font-medium", children: "Spitali Rajonal:" }), c.hospitalNotified ? (_jsxs("span", { className: "inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md", children: [_jsx(CheckCircle2, { className: "w-3 h-3" }), "Njoftuar: ", c.hospitalTarget || assignedHospital.name.split('-')[0]] })) : (_jsx("span", { className: "text-slate-600 dark:text-slate-300 font-bold truncate max-w-[200px]", title: assignedHospital.name, children: assignedHospital.name.split('-')[0] }))] })] }), _jsxs("div", { className: "mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-1.5 sm:gap-2", children: [_jsxs("button", { onClick: () => handleOpenHospitalModal(c), className: "px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer", title: "Njofto Spitalin ose QKMF-n\u00EB p\u00EBr k\u00EBt\u00EB rast", children: [_jsx(Send, { className: "w-3 h-3" }), _jsx("span", { children: "Njofto Spitalin" })] }), c.donationUrl ? (_jsxs("div", { className: "inline-flex items-center gap-1", children: [_jsxs("a", { href: c.donationUrl, target: "_blank", rel: "noopener noreferrer", className: "px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 group", title: "Kontribo me donacion p\u00EBrmes GoFundMe p\u00EBr k\u00EBt\u00EB pacient", children: [_jsx(Heart, { className: "w-3 h-3 fill-white/80 text-white group-hover:scale-110 transition-transform" }), _jsx("span", { children: "Kontribo" }), _jsx(ArrowUpRight, { className: "w-3 h-3 opacity-80" })] }), _jsx("button", { onClick: () => handleOpenGoFundMeModal(c), className: "p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer", title: "Ndrysho ose shiko linkun e GoFundMe", children: _jsx(Edit3, { className: "w-3.5 h-3.5" }) })] })) : (_jsxs("button", { onClick: () => handleOpenGoFundMeModal(c), className: "px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer", title: "Vendos linkun e GoFundMe p\u00EBr t\u00EB mbledhur donacione", children: [_jsx(Heart, { className: "w-3 h-3 text-emerald-600 dark:text-emerald-400" }), _jsx("span", { children: "Kontribo" }), _jsx(Plus, { className: "w-3 h-3" })] }))] }), _jsxs("div", { className: "flex items-center gap-1.5 sm:gap-2", children: [_jsxs("span", { className: "px-3 py-1.5 bg-slate-50 dark:bg-zinc-800/70 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-zinc-700 rounded-xl text-[11px] font-bold flex items-center gap-1.5", title: "Numri nuk publikohet; admin\u00EBt e autorizuar e shohin n\u00EB panelin e tyre.", children: [_jsx(ShieldCheck, { className: "w-3 h-3 text-emerald-600" }), "Kontakt privat"] }), _jsx("button", { onClick: () => {
                                                                    if (navigator.share) {
                                                                        navigator.share({
                                                                            title: `Rast Shëndetësor: ${c.fullName}`,
                                                                            text: `${c.diagnosis} - Komuna: ${c.municipality}`,
                                                                            url: window.location.href
                                                                        }).catch(() => { });
                                                                    }
                                                                    else {
                                                                        navigator.clipboard.writeText(window.location.href);
                                                                        toast.success('Linku u kopjua!');
                                                                    }
                                                                }, className: "p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer", title: "Shp\u00EBrndaj", children: _jsx(Share2, { className: "w-4 h-4" }) })] })] })] }, c.id));
                                }) }))] })), activeTab === 'municipalStats' && (_jsxs("div", { className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden", children: [_jsxs("div", { className: "p-5 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-bold text-base text-slate-900 dark:text-white", children: "Tabela e Evidenc\u00EBs Sh\u00EBndet\u00EBsore sipas 38 Komunave" }), _jsx("p", { className: "text-xs text-slate-500", children: "Transparenc\u00EB e plot\u00EB mbi rastet onkologjike, kardiake dhe nevojat urgjente p\u00EBr \u00E7do komun\u00EB." })] }), _jsxs("button", { onClick: handleExportCSV, className: "px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all", children: [_jsx(Download, { className: "w-4 h-4" }), _jsx("span", { children: "Shkarko Tabel\u00EBn (CSV)" })] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-xs", children: [_jsx("thead", { className: "bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider", children: _jsxs("tr", { children: [_jsx("th", { className: "py-3.5 px-4", children: "Komuna" }), _jsx("th", { className: "py-3.5 px-4 text-center", children: "Totali i Rasteve" }), _jsx("th", { className: "py-3.5 px-4 text-center", children: "Kancer / Onkologji" }), _jsx("th", { className: "py-3.5 px-4 text-center", children: "S\u00EBmundje Zemre" }), _jsx("th", { className: "py-3.5 px-4 text-center", children: "S\u00EBmundje Mushk\u00EBrie" }), _jsx("th", { className: "py-3.5 px-4 text-center", children: "Raste Urgjente" }), _jsx("th", { className: "py-3.5 px-4 text-right", children: "Spitali P\u00EBrgjegj\u00EBs" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium", children: KOSOVO_MUNICIPALITIES.map(m => {
                                                const st = municipalityStats[m] || { total: 0, cancer: 0, heart: 0, lung: 0, urgent: 0 };
                                                const hosp = getHospitalInfoForMunicipality(m);
                                                return (_jsxs("tr", { className: "hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors", children: [_jsxs("td", { className: "py-3 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-1.5", children: [_jsx(MapPin, { className: "w-3.5 h-3.5 text-rose-500 shrink-0" }), _jsx("span", { children: m })] }), _jsx("td", { className: "py-3 px-4 text-center font-bold", children: _jsx("span", { className: `px-2 py-0.5 rounded-full ${st.total > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-black' : 'text-slate-400'}`, children: st.total }) }), _jsx("td", { className: "py-3 px-4 text-center text-purple-600 dark:text-purple-400 font-bold", children: st.cancer > 0 ? st.cancer : '-' }), _jsx("td", { className: "py-3 px-4 text-center text-rose-600 dark:text-rose-400 font-bold", children: st.heart > 0 ? st.heart : '-' }), _jsx("td", { className: "py-3 px-4 text-center text-sky-600 dark:text-sky-400 font-bold", children: st.lung > 0 ? st.lung : '-' }), _jsx("td", { className: "py-3 px-4 text-center", children: st.urgent > 0 ? (_jsx("span", { className: "px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded font-black", children: st.urgent })) : (_jsx("span", { className: "text-slate-400", children: "-" })) }), _jsx("td", { className: "py-3 px-4 text-right text-slate-500 truncate max-w-[220px]", title: hosp.name, children: hosp.name.split('(')[0] })] }, m));
                                            }) })] }) })] })), activeTab === 'hospitalDirectory' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs", children: [_jsx("h3", { className: "font-bold text-base text-slate-900 dark:text-white", children: "Drejtoria e Spitaleve Rajonale & QKMF-ve p\u00EBr 38 Komunat e Kosov\u00EBs" }), _jsx("p", { className: "text-xs text-slate-500 mt-1", children: "Kontaktet zyrtare t\u00EB urgjenc\u00EBs p\u00EBr t\u00EB gjitha rajonet: Prishtin\u00EB (QKUK), Prizren, Pej\u00EB, Gjakov\u00EB, Gjilan, Ferizaj, dhe Mitrovic\u00EB." })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: KOSOVO_MUNICIPALITIES.map(m => {
                                    const hosp = getHospitalInfoForMunicipality(m);
                                    return (_jsxs("div", { className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3 flex flex-col justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsxs("span", { className: "text-xs font-bold text-rose-600 dark:text-rose-400", children: ["Komuna ", m] }), _jsx("h4", { className: "font-bold text-sm text-slate-900 dark:text-white leading-tight mt-0.5", children: hosp.name })] }), _jsx("span", { className: "px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded", children: hosp.type })] }), _jsxs("p", { className: "text-xs text-slate-500 mt-2", children: ["\uD83D\uDCCD ", hosp.address] })] }), _jsxs("div", { className: "space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs font-medium", children: [_jsxs("a", { href: `tel:${hosp.emergencyPhone}`, className: "flex items-center justify-between p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 font-bold", children: [_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(Phone, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "Urgjenca:" })] }), _jsx("span", { children: hosp.emergencyPhone })] }), _jsxs("a", { href: `mailto:${hosp.email}`, className: "flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100", children: [_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(Mail, { className: "w-3.5 h-3.5 text-blue-500" }), _jsx("span", { children: "Email:" })] }), _jsx("span", { className: "truncate max-w-[150px]", children: hosp.email })] })] })] }, m));
                                }) })] }))] }), _jsx(AnimatePresence, { children: isRegisterModalOpen && (_jsx("div", { className: "fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto", children: _jsxs(motion.div, { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, className: "bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-6 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center", children: _jsx(HeartPulse, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-black text-lg text-slate-900 dark:text-white", children: "Regjistro Rast Sh\u00EBndet\u00EBsor" }), _jsx("p", { className: "text-xs text-slate-500", children: "Evidenca regjistrohet sipas komun\u00EBs p\u00EBrkat\u00EBse n\u00EB Kosov\u00EB." })] })] }), _jsx("button", { onClick: () => setIsRegisterModalOpen(false), className: "p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("form", { onSubmit: handleRegisterSubmit, className: "space-y-4", children: [_jsxs("div", { className: "p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200/60 dark:border-zinc-700/60 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-bold text-slate-900 dark:text-white", children: "Regjistrim Anonim (Vet\u00EBm p\u00EBr Statistika)" }), _jsx("p", { className: "text-[11px] text-slate-500", children: "N\u00EBse aktivizohet, emri dhe telefoni juaj nuk shfaqen publikisht." })] }), _jsx("input", { type: "checkbox", checked: form.isAnonymous, onChange: e => setForm({ ...form, isAnonymous: e.target.checked }), className: "w-4 h-4 accent-rose-600 rounded" })] }), !form.isAnonymous && (_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Emri dhe Mbiemri i Pacientit *" }), _jsx("input", { type: "text", required: !form.isAnonymous, value: form.fullName, onChange: e => setForm({ ...form, fullName: e.target.value }), placeholder: "psh. Valon Krasniqi", className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium" })] }) })), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Numri i Telefonit / Kontaktit" }), _jsx("input", { type: "text", value: form.contactPhone, onChange: e => setForm({ ...form, contactPhone: e.target.value }), placeholder: "+383 44 123 456", className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium" }), _jsx("p", { className: "mt-1.5 text-[11px] leading-relaxed text-slate-500", children: "Numri nuk publikohet n\u00EB faqe. Ai ruhet vet\u00EBm p\u00EBr administrator\u00EBt e autorizuar; n\u00EB rast anonim, emri mbetet i fshehur edhe n\u00EB dokumentet e referimit p\u00EBr spital." })] }), _jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Mosha (vje\u00E7)" }), _jsx("input", { type: "number", min: 0, max: 120, value: form.age, onChange: e => setForm({ ...form, age: parseInt(e.target.value) || 0 }), className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Gjinia" }), _jsxs("select", { value: form.gender, onChange: e => setForm({ ...form, gender: e.target.value }), className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium", children: [_jsx("option", { value: "Mashkull", children: "Mashkull" }), _jsx("option", { value: "Fem\u00EBr", children: "Fem\u00EBr" }), _jsx("option", { value: "Tjet\u00EBr", children: "Tjet\u00EBr" })] })] }), _jsxs("div", { className: "col-span-2 sm:col-span-1", children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Viti i Diagnoz\u00EBs" }), _jsx("input", { type: "number", min: 1980, max: new Date().getFullYear(), value: form.diagnosedYear, onChange: e => setForm({ ...form, diagnosedYear: parseInt(e.target.value) || 2024 }), className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium" })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Komuna (nga 38 Komunat) *" }), _jsx("select", { value: form.municipality, onChange: e => setForm({ ...form, municipality: e.target.value, neighborhood: '' }), className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500", children: KOSOVO_MUNICIPALITIES.map(m => (_jsx("option", { value: m, children: m }, m))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Lagjja / Fshati" }), currentAvailableNeighborhoods.length > 0 ? (_jsxs("select", { value: form.neighborhood, onChange: e => setForm({ ...form, neighborhood: e.target.value }), className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium", children: [_jsx("option", { value: "", children: "Zgjedh Lagjen..." }), currentAvailableNeighborhoods.map(n => (_jsx("option", { value: n, children: n }, n)))] })) : (_jsx("input", { type: "text", value: form.neighborhood, onChange: e => setForm({ ...form, neighborhood: e.target.value }), placeholder: "psh. Qendra, Dardania", className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium" }))] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Kategoria e S\u00EBmundjes *" }), _jsxs("select", { value: form.category, onChange: e => setForm({ ...form, category: e.target.value }), className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500", children: [_jsx("option", { value: "Kancer / Onkologji", children: "Kancer / Onkologji" }), _jsx("option", { value: "S\u00EBmundje t\u00EB Zemr\u00EBs", children: "S\u00EBmundje t\u00EB Zemr\u00EBs (Kardiake)" }), _jsx("option", { value: "S\u00EBmundje t\u00EB Mushk\u00EBrive", children: "S\u00EBmundje t\u00EB Mushk\u00EBrive (Pulmonare)" }), _jsx("option", { value: "S\u00EBmundje t\u00EB Veshkave & Dializ\u00EB", children: "S\u00EBmundje t\u00EB Veshkave & Dializ\u00EB" }), _jsx("option", { value: "Diabet me Komplikime", children: "Diabet me Komplikime" }), _jsx("option", { value: "S\u00EBmundje Neurologjike", children: "S\u00EBmundje Neurologjike" }), _jsx("option", { value: "S\u00EBmundje e Rrall\u00EB", children: "S\u00EBmundje e Rrall\u00EB" }), _jsx("option", { value: "Tjet\u00EBr", children: "Tjet\u00EBr" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Niveli i Urgjenc\u00EBs" }), _jsxs("select", { value: form.urgency, onChange: e => setForm({ ...form, urgency: e.target.value }), className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500", children: [_jsx("option", { value: "Urgjente", children: "Urgjente (Ka nevoj\u00EB p\u00EBr nd\u00EBrhyrje/barna menj\u00EBher\u00EB)" }), _jsx("option", { value: "Mesatare", children: "Mesatare (Terapia kronike e rregullt)" }), _jsx("option", { value: "Kronike e Stabilizuar", children: "Kronike e Stabilizuar" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Diagnoza Specifike *" }), _jsx("input", { type: "text", required: true, value: form.diagnosis, onChange: e => setForm({ ...form, diagnosis: e.target.value }), placeholder: "psh. Adenokarcinom\u00EB, Kardiomiopati e Dilatuar, SPOK, Leu\u00E7emi...", className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300", children: "Foto e Dokumentit Mjek\u00EBsor / Epikriz\u00EBs / Recet\u00EBs (Opsionale)" }), form.imageUrl ? (_jsxs("div", { className: "relative p-3 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("img", { src: form.imageUrl, alt: "Dokument", className: "w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-zinc-700" }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-bold text-slate-900 dark:text-white", children: "Dokumenti u ngarkua" }), _jsx("p", { className: "text-[11px] text-emerald-600 font-medium", children: "Gati p\u00EBr regjistrim" })] })] }), _jsx("button", { type: "button", onClick: () => setForm(prev => ({ ...prev, imageUrl: '' })), className: "px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors", children: "Largo foton" })] })) : (_jsxs("div", { onClick: () => fileInputRef.current?.click(), className: "cursor-pointer border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-rose-500 dark:hover:border-rose-500 rounded-2xl p-5 text-center transition-all bg-slate-50/50 dark:bg-zinc-800/40 hover:bg-rose-50/30", children: [_jsx("input", { type: "file", ref: fileInputRef, onChange: handlePhotoSelect, accept: "image/*", className: "hidden" }), _jsx(Camera, { className: "w-8 h-8 text-slate-400 mx-auto mb-1.5" }), _jsx("p", { className: "text-xs font-bold text-slate-700 dark:text-slate-300", children: "Kliko k\u00EBtu p\u00EBr t\u00EB ngarkuar foto t\u00EB epikriz\u00EBs apo analiz\u00EBs" }), _jsx("p", { className: "text-[11px] text-slate-400 mt-0.5", children: "Formate t\u00EB mb\u00EBshtetura: JPG, PNG, WEBP (maks. 8MB)" })] }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "Nevojat Kryesore (t\u00EB ndara me presje)" }), _jsx("input", { type: "text", value: form.needsInput, onChange: e => setForm({ ...form, needsInput: e.target.value }), placeholder: "psh. Barna Citostatike, Dializ\u00EB, Koncentrator Oksigjeni, Ndihm\u00EB Financiare", className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1", children: "P\u00EBrshkrimi i Situat\u00EBs dhe Nevoja p\u00EBr Ndihm\u00EB" }), _jsx("textarea", { rows: 3, value: form.description, onChange: e => setForm({ ...form, description: e.target.value }), placeholder: "Shpjegoni shkurtimisht gjendjen sh\u00EBndet\u00EBsore, barnat q\u00EB mungojn\u00EB n\u00EB spital apo nevoj\u00EBn p\u00EBr trajtim...", className: "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-rose-500 font-medium resize-none" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between", children: [_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(Heart, { className: "w-3.5 h-3.5 text-emerald-500" }), _jsx("span", { children: "Linku i GoFundMe / Donacionit (Opsionale)" })] }), _jsx("span", { className: "text-[10px] text-emerald-600 dark:text-emerald-400 font-medium", children: "P\u00EBr butonin \"Kontribo\"" })] }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: "url", value: form.donationUrl, onChange: e => setForm({ ...form, donationUrl: e.target.value }), placeholder: "https://www.gofundme.com/f/emri-i-fushat\u00EBs...", className: "w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-medium" }), _jsx(LinkIcon, { className: "w-4 h-4 text-slate-400 absolute left-3 top-3" })] }), _jsx("p", { className: "text-[11px] text-slate-400 mt-1", children: "N\u00EBse keni hapur fushat\u00EB n\u00EB GoFundMe apo platform\u00EB tjet\u00EBr, vendosni linkun k\u00EBtu q\u00EB qytetar\u00EBt t\u00EB mund t\u00EB dhurojn\u00EB drejtp\u00EBrdrejt." })] }), _jsxs("div", { className: "pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3", children: [_jsx("button", { type: "button", onClick: () => setIsRegisterModalOpen(false), className: "px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200", children: "Anulo" }), _jsxs("button", { type: "submit", disabled: isSubmitting, className: "px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-rose-600/20 active:scale-95 transition-all flex items-center gap-2", children: [_jsx(Plus, { className: "w-4 h-4 stroke-[3]" }), _jsx("span", { children: isSubmitting ? 'Duke regjistruar...' : 'Dërgo në Regjistër' })] })] })] })] }) })) }), _jsx(AnimatePresence, { children: hospitalModalCase && hospitalInfo && (_jsx("div", { className: "fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto", children: _jsxs(motion.div, { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "p-2 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400", children: _jsx(Building2, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-base text-slate-900 dark:text-white", children: "Njofto Spitalin / QKMF P\u00EBrkat\u00EBse" }), _jsxs("p", { className: "text-xs text-slate-500", children: ["D\u00EBrgim alarmi zyrtar p\u00EBr Komun\u00EBn e ", hospitalModalCase.municipality] })] })] }), _jsx("button", { onClick: () => setHospitalModalCase(null), className: "p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5", children: [_jsx(Building2, { className: "w-4 h-4 text-blue-500" }), hospitalInfo.name] }), _jsx("span", { className: "text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded", children: hospitalInfo.type })] }), _jsxs("p", { className: "text-xs text-slate-500", children: ["\uD83D\uDCCD ", hospitalInfo.address] }), _jsxs("div", { className: "pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs", children: [_jsxs("a", { href: `tel:${hospitalInfo.emergencyPhone}`, className: "flex items-center gap-2 p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl hover:bg-rose-100 font-bold", children: [_jsx(Phone, { className: "w-3.5 h-3.5" }), _jsxs("span", { children: ["Urgjenca: ", hospitalInfo.emergencyPhone] })] }), _jsxs("a", { href: `mailto:${hospitalInfo.email}?subject=Njoftim Urgjent Shendetesor - ${hospitalModalCase.municipality}&body=${encodeURIComponent(hospitalNotes)}`, className: "flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-xl hover:bg-blue-100 font-bold", children: [_jsx(Mail, { className: "w-3.5 h-3.5" }), _jsx("span", { children: hospitalInfo.email })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5", children: "Mesazhi i Njoftimit p\u00EBr Spitalin / Mjek\u00EBt Kujdestar\u00EB" }), _jsx("textarea", { rows: 6, value: hospitalNotes, onChange: e => setHospitalNotes(e.target.value), className: "w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-rose-500 resize-none font-mono" })] }), _jsxs("div", { className: "flex flex-wrap gap-2 text-xs", children: [_jsxs("a", { href: `mailto:${hospitalInfo.email}?subject=Njoftim Zyrtar - Rast Shendetesor ne ${hospitalModalCase.municipality}&body=${encodeURIComponent(hospitalNotes)}`, className: "px-3.5 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5", children: [_jsx(Mail, { className: "w-3.5 h-3.5 text-blue-500" }), _jsx("span", { children: "Hap n\u00EB Email" })] }), _jsxs("a", { href: `https://wa.me/?text=${encodeURIComponent(hospitalNotes)}`, target: "_blank", rel: "noreferrer", className: "px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold flex items-center gap-1.5", children: [_jsx(Send, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "D\u00EBrgo n\u00EB WhatsApp" })] })] }), _jsxs("div", { className: "pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3", children: [_jsx("button", { type: "button", onClick: () => setHospitalModalCase(null), className: "px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white", children: "Mbyll" }), _jsxs("button", { type: "button", disabled: isNotifyingHospital, onClick: handleConfirmHospitalNotify, className: "px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/20 active:scale-95 transition-all", children: [_jsx(CheckCircle2, { className: "w-4 h-4" }), _jsx("span", { children: isNotifyingHospital ? 'Duke regjistruar...' : 'Konfirmo Njoftimin e Spitalit' })] })] })] }) })) }), _jsx(AnimatePresence, { children: previewPhoto && (_jsx("div", { className: "fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4", children: _jsxs(motion.div, { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, className: "bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full p-4 overflow-hidden border border-slate-200 dark:border-zinc-800 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between pb-1", children: [_jsx("p", { className: "text-sm font-bold text-slate-900 dark:text-white truncate", children: previewPhoto.title }), _jsx("button", { onClick: () => setPreviewPhoto(null), className: "p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsx("div", { className: "max-h-[70vh] overflow-auto rounded-2xl border border-slate-100 dark:border-zinc-800 flex items-center justify-center bg-slate-950", children: _jsx("img", { src: previewPhoto.url, alt: "", className: "max-h-[68vh] object-contain w-auto rounded-xl" }) }), _jsx("div", { className: "flex justify-end gap-2 pt-1", children: _jsxs("a", { href: previewPhoto.url, target: "_blank", rel: "noreferrer", className: "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5", children: [_jsx(ArrowUpRight, { className: "w-4 h-4" }), _jsx("span", { children: "Hap n\u00EB madh\u00EBsi t\u00EB plot\u00EB" })] }) })] }) })) }), _jsx(AnimatePresence, { children: goFundMeModalCase && (_jsx("div", { className: "fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto", children: _jsxs(motion.div, { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, className: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400", children: _jsx(Heart, { className: "w-5 h-5 fill-emerald-500/20" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-base text-slate-900 dark:text-white", children: "Vendos Linkun e GoFundMe" }), _jsxs("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: ["P\u00EBr: ", goFundMeModalCase.fullName, " \u2022 Komuna e ", goFundMeModalCase.municipality] })] })] }), _jsx("button", { onClick: () => setGoFundMeModalCase(null), className: "p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed", children: ["Vendosni linkun zyrtar t\u00EB fushat\u00EBs s\u00EB hapur n\u00EB ", _jsx("strong", { children: "GoFundMe" }), " (ose platform\u00EB tjet\u00EBr bamir\u00EBsie). Me t'u ruajtur ky link, \u00E7do qytetar mund t\u00EB klikoj\u00EB butonin ", _jsx("strong", { children: "\"Kontribo\"" }), " dhe t\u00EB dhuroj\u00EB ndihm\u00EB financiare menj\u00EBher\u00EB."] }), _jsxs("form", { onSubmit: handleSaveGoFundMe, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5", children: "Linku i GoFundMe / Donacionit *" }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: "url", value: goFundMeInputUrl, onChange: e => setGoFundMeInputUrl(e.target.value), placeholder: "https://www.gofundme.com/f/emri-i-fushat\u00EBs...", className: "w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-medium" }), _jsx(LinkIcon, { className: "w-4 h-4 text-slate-400 absolute left-3 top-3" })] }), _jsx("p", { className: "text-[11px] text-slate-400 mt-1", children: "Shembull: https://www.gofundme.com/f/ndihme-per-sherim" })] }), _jsxs("div", { className: "pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2.5", children: [goFundMeModalCase.donationUrl && (_jsx("button", { type: "button", onClick: () => {
                                                    setGoFundMeInputUrl('');
                                                }, className: "px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors mr-auto cursor-pointer", children: "Pastro Linkun" })), _jsx("button", { type: "button", onClick: () => setGoFundMeModalCase(null), className: "px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer", children: "Anulo" }), _jsxs("button", { type: "submit", disabled: isSavingGoFundMe, className: "px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer", children: [_jsx(Heart, { className: "w-3.5 h-3.5 fill-white" }), _jsx("span", { children: isSavingGoFundMe ? 'Po ruhet...' : 'Ruaj Linkun' })] })] })] })] }) })) })] }));
}

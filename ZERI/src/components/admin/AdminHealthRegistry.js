import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { HeartPulse, Download, Search, Phone, Mail, MapPin, CheckCircle2, AlertTriangle, FileText, Send, Building2, X, Printer, ArrowUpRight, Heart, Link as LinkIcon, Edit3, Plus, Trash2 } from 'lucide-react';
import { collection, onSnapshot, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import { getHospitalInfoForMunicipality } from '../../data/kosovoHospitals';
import toast from 'react-hot-toast';
export default function AdminHealthRegistry() {
    const [cases, setCases] = useState([]);
    const [selectedMunicipality, setSelectedMunicipality] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedUrgency, setSelectedUrgency] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    // Detailed Case Inspection & Edit Modal State
    const [inspectingCase, setInspectingCase] = useState(null);
    const [isEditingCase, setIsEditingCase] = useState(false);
    const [editFormData, setEditFormData] = useState({});
    // Hospital Notification Modal State
    const [notifyingCase, setNotifyingCase] = useState(null);
    const [hospitalInfo, setHospitalInfo] = useState(null);
    const [notificationNotes, setNotificationNotes] = useState('');
    const [isDispatching, setIsDispatching] = useState(false);
    // Document / Photo Preview Modal
    const [previewImage, setPreviewImage] = useState(null);
    // GoFundMe Admin Edit Modal State
    const [adminGoFundMeCase, setAdminGoFundMeCase] = useState(null);
    const [adminGoFundMeUrl, setAdminGoFundMeUrl] = useState('');
    const [isAdminSavingGoFundMe, setIsAdminSavingGoFundMe] = useState(false);
    // Listen to Firestore healthRegistry
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'healthRegistry'), (snapshot) => {
            if (!snapshot.empty) {
                const firestoreCases = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setCases(firestoreCases);
            }
            else {
                // Fallback demo cases if firestore is empty
                setCases([
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
                        description: 'Kërkohet ndihmë urgjente për sigurimin e medikamentit Pembrolizumab që nuk mbulohet nga lista esenciale e barnave.',
                        contactPhone: '+383 44 210 340',
                        contactName: 'Djali (Valon Gashi)',
                        isAnonymous: false,
                        supportAmountNeeded: 6500,
                        supportAmountRaised: 2800,
                        donationUrl: 'https://www.gofundme.com/f/ndihme-per-sherimin-e-arben-gashit',
                        status: 'verified',
                        imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=800&auto=format&fit=crop&q=80',
                        createdAt: new Date().toISOString()
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
                        description: 'Rekomanduar për ndërhyrje kardiokirurgjike jashtë Kosovës në mungesë të pajisjes përkatëse në spital.',
                        contactPhone: '+383 49 112 890',
                        contactName: 'Bashkëshorti (Besnik)',
                        isAnonymous: false,
                        supportAmountNeeded: 12000,
                        supportAmountRaised: 7400,
                        donationUrl: 'https://www.gofundme.com/f/operacioni-kardiak-liridona-krasniqi',
                        status: 'verified',
                        imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&auto=format&fit=crop&q=80',
                        createdAt: new Date().toISOString()
                    }
                ]);
            }
        });
        return () => unsub();
    }, []);
    // Filtered cases
    const filteredCases = useMemo(() => {
        return cases.filter(c => {
            const matchMuni = selectedMunicipality === 'all' || c.municipality === selectedMunicipality;
            const matchCat = selectedCategory === 'all' || c.category === selectedCategory;
            const matchUrg = selectedUrgency === 'all' || c.urgency === selectedUrgency;
            const matchStatus = selectedStatus === 'all' || (c.status || 'verified') === selectedStatus;
            const matchSearch = !searchQuery ||
                c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.municipality.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.needs || []).some(n => n.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchMuni && matchCat && matchUrg && matchStatus && matchSearch;
        });
    }, [cases, selectedMunicipality, selectedCategory, selectedUrgency, selectedStatus, searchQuery]);
    // Statistics
    const totalCount = filteredCases.length;
    const urgentCount = filteredCases.filter(c => c.urgency === 'Urgjente').length;
    const verifiedCount = filteredCases.filter(c => c.status === 'verified').length;
    const notifiedCount = filteredCases.filter(c => c.hospitalNotified).length;
    const withPhotoCount = filteredCases.filter(c => c.imageUrl).length;
    // Handle open inspect modal
    const handleOpenInspect = (c) => {
        setInspectingCase(c);
        setIsEditingCase(false);
        setEditFormData({
            fullName: c.fullName,
            age: c.age,
            gender: c.gender,
            municipality: c.municipality,
            neighborhood: c.neighborhood,
            category: c.category,
            diagnosis: c.diagnosis,
            urgency: c.urgency,
            description: c.description,
            contactPhone: c.contactPhone,
            supportAmountNeeded: c.supportAmountNeeded || 0,
            supportAmountRaised: c.supportAmountRaised || 0,
            donationUrl: c.donationUrl || ''
        });
    };
    // Quick Status Updater
    const handleUpdateStatus = async (caseId, newStatus) => {
        const statusUpdatedAt = new Date().toISOString();
        setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: newStatus, statusUpdatedAt } : c));
        if (inspectingCase && inspectingCase.id === caseId) {
            setInspectingCase(prev => prev ? { ...prev, status: newStatus, statusUpdatedAt } : null);
        }
        try {
            if (!caseId.startsWith('hc-')) {
                await updateDoc(doc(db, 'healthRegistry', caseId), { status: newStatus, statusUpdatedAt });
            }
            const label = newStatus === 'verified' ? 'Verifikuar' : newStatus === 'pending' ? 'Në Shqyrtim' : newStatus === 'rejected' ? 'Refuzuar' : 'Zgjidhur';
            toast.success(`Statusi u përditësua me sukses në: ${label}`);
        }
        catch (err) {
            console.warn("Firestore status update fallback:", err);
            toast.success(`Statusi u përditësua në memorie.`);
        }
    };
    // Save Case Details
    const handleSaveCaseEdits = async (e) => {
        e.preventDefault();
        if (!inspectingCase)
            return;
        try {
            const updatedCase = {
                ...inspectingCase,
                ...editFormData,
            };
            setCases(prev => prev.map(c => c.id === inspectingCase.id ? updatedCase : c));
            setInspectingCase(updatedCase);
            setIsEditingCase(false);
            if (!inspectingCase.id.startsWith('hc-')) {
                await updateDoc(doc(db, 'healthRegistry', inspectingCase.id), {
                    ...editFormData
                });
            }
            toast.success('Të dhënat mjekësore u ruajtën me sukses!');
        }
        catch (err) {
            console.error(err);
            toast.error('Gabim gjatë ruajtjes së ndryshimeve.');
        }
    };
    // Delete Case Handler
    const handleDeleteCase = async (caseId) => {
        if (!window.confirm('A jeni të sigurt që dëshironi ta fshini këtë rast nga Regjistri Shëndetësor? Ky veprim nuk mund të kthehet.'))
            return;
        setCases(prev => prev.filter(c => c.id !== caseId));
        if (inspectingCase?.id === caseId) {
            setInspectingCase(null);
        }
        try {
            if (!caseId.startsWith('hc-')) {
                await deleteDoc(doc(db, 'healthRegistry', caseId));
            }
            toast.success('Rasti shëndetësor u fshi me sukses.');
        }
        catch (err) {
            console.error(err);
        }
    };
    // Print Official Hospital Referral Document
    const handlePrintReferral = (c) => {
        const hosp = getHospitalInfoForMunicipality(c.municipality);
        const printWindow = window.open('', '_blank');
        if (!printWindow)
            return;
        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fletë-Referim Zyrtar - ${c.isAnonymous ? 'Rast Anonim' : c.fullName}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #0f172a; max-width: 800px; margin: auto; }
            .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 24px; }
            .gov-title { font-size: 13px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #1e293b; }
            .dept-title { font-size: 11px; font-weight: bold; color: #64748b; margin-top: 3px; }
            .doc-title { font-size: 16px; font-weight: 900; margin-top: 14px; color: #e11d48; text-transform: uppercase; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
            .field { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
            .field-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
            .field-val { font-size: 13px; font-weight: bold; color: #0f172a; }
            .urgent-badge { color: #e11d48; font-weight: 900; }
            .box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-top: 6px; font-size: 13px; line-height: 1.6; }
            .hosp-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; margin-top: 15px; font-size: 12px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px; }
            .sign-col { border-top: 1px dashed #64748b; width: 220px; text-align: center; font-size: 11px; padding-top: 8px; color: #475569; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="gov-title">REPUBLIKA E KOSOVËS • SHTABI QENDROR I SHËNDETËSISË</div>
            <div class="dept-title">DREJTORIA E REGJISTRIT TË RASTEVE TË VEÇANTA & SOLIDARITETIT</div>
            <div class="doc-title">FLETË-REFERIM DHE ALARM ZYRTAR SHËNDETËSOR</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Numri Protokollar: REF-KS-${c.id.slice(-6).toUpperCase()} • Data: ${new Date().toLocaleDateString('sq-AL')}</div>
          </div>

          <div class="grid">
            <div class="field"><div class="field-label">Pacienti</div><div class="field-val">${c.isAnonymous ? 'Rast i Mbrojtur / Anonim' : c.fullName}</div></div>
            <div class="field"><div class="field-label">Mosha dhe Gjinia</div><div class="field-val">${c.age} vjeç • ${c.gender}</div></div>
            <div class="field"><div class="field-label">Komuna & Lagjja</div><div class="field-val">Komuna e ${c.municipality} (${c.neighborhood || 'Qendër'})</div></div>
            <div class="field"><div class="field-label">Urgjenca</div><div class="field-val urgent-badge">${c.urgency}</div></div>
            <div class="field"><div class="field-label">Kategoria Klinike</div><div class="field-val">${c.category}</div></div>
            <div class="field"><div class="field-label">Telefoni i Kontaktit</div><div class="field-val">${c.contactPhone || 'Pa kontakt të shënuar'}</div></div>
          </div>

          <div style="margin-top: 15px;">
            <div class="field-label">Diagnoza Paraprake dhe Epikriza</div>
            <div class="box">
              <strong>Diagnoza:</strong> ${c.diagnosis}<br/><br/>
              <strong>Përshkrimi i Rastit:</strong><br/>
              ${c.description || 'Nuk ka përshkrim të plotë të shtuar.'}<br/><br/>
              <strong>Nevojat e Veçanta:</strong> ${(c.needs || []).join(' • ')}
            </div>
          </div>

          <div class="hosp-box">
            <strong>Institucioni Shëndetësor Pritës:</strong> ${hosp.name}<br/>
            <strong>Adresa:</strong> ${hosp.address} | <strong>Kontakti i Urgjencës:</strong> ${hosp.emergencyPhone}
          </div>

          <div class="signatures">
            <div class="sign-col">
              <strong>Administratori i Regjistrit</strong><br/>
              Vula e Autoritetit Qendror
            </div>
            <div class="sign-col">
              <strong>Reparti Pranues në Spital</strong><br/>
              Nënshkrimi dhe Pranohet më: ____/____/202X
            </div>
          </div>
        </body>
      </html>
    `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 300);
    };
    // Handle open notify modal
    const handleOpenNotifyModal = (c) => {
        setNotifyingCase(c);
        const hosp = getHospitalInfoForMunicipality(c.municipality);
        setHospitalInfo(hosp);
        setNotificationNotes(`Njoftim Zyrtar Shëndetësor për rastin: ${c.isAnonymous ? 'Anonim' : c.fullName} (${c.age} vjeç) nga Komuna ${c.municipality}, Lagjja ${c.neighborhood}.\nDiagnoza: ${c.diagnosis}.\nNevojat primare: ${(c.needs || []).join(', ')}.\nNiveli i Urgjencës: ${c.urgency}.`);
    };
    // Dispatch Notification to Hospital
    const handleDispatchNotification = async () => {
        if (!notifyingCase || !hospitalInfo)
            return;
        setIsDispatching(true);
        try {
            // If it's stored in Firestore, update document
            if (!notifyingCase.id.startsWith('hc-')) {
                await updateDoc(doc(db, 'healthRegistry', notifyingCase.id), {
                    hospitalNotified: true,
                    hospitalNotifiedAt: new Date().toISOString(),
                    hospitalTarget: hospitalInfo.name,
                    notificationNotes: notificationNotes,
                    status: 'verified'
                });
            }
            // Update local state
            setCases(prev => prev.map(item => {
                if (item.id === notifyingCase.id) {
                    return {
                        ...item,
                        hospitalNotified: true,
                        hospitalNotifiedAt: new Date().toISOString(),
                        hospitalTarget: hospitalInfo.name,
                        notificationNotes: notificationNotes
                    };
                }
                return item;
            }));
            toast.success(`Njoftimi iu dërgua me sukses ${hospitalInfo.name}!`);
            setNotifyingCase(null);
        }
        catch (err) {
            console.error(err);
            toast.error('Gabim gjatë regjistrimit të njoftimit.');
        }
        finally {
            setIsDispatching(false);
        }
    };
    // GoFundMe Admin Handlers
    const handleOpenAdminGoFundMe = (c) => {
        setAdminGoFundMeCase(c);
        setAdminGoFundMeUrl(c.donationUrl || '');
    };
    const handleSaveAdminGoFundMe = async (e) => {
        e.preventDefault();
        if (!adminGoFundMeCase)
            return;
        const url = adminGoFundMeUrl.trim();
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
            toast.error('Ju lutem vendosni një URL të vlefshme (duke filluar me https://)');
            return;
        }
        setIsAdminSavingGoFundMe(true);
        try {
            setCases(prev => prev.map(item => item.id === adminGoFundMeCase.id ? { ...item, donationUrl: url || undefined } : item));
            try {
                await updateDoc(doc(db, 'healthRegistry', adminGoFundMeCase.id), {
                    donationUrl: url || null
                });
            }
            catch (err) {
                console.warn("Firestore save fallback for local demo record:", err);
            }
            toast.success(url ? 'Linku i GoFundMe u ruajt!' : 'Linku i donacionit u hoq.');
            setAdminGoFundMeCase(null);
        }
        catch (err) {
            toast.error('Gabim gjatë ruajtjes së linkut të GoFundMe.');
        }
        finally {
            setIsAdminSavingGoFundMe(false);
        }
    };
    // CSV Export Function
    const handleExportCSV = () => {
        if (filteredCases.length === 0) {
            toast.error('Nuk ka të dhëna për të shkarkuar.');
            return;
        }
        const headers = [
            'ID',
            'Emri dhe Mbiemri',
            'Mosha',
            'Gjinia',
            'Komuna',
            'Lagjja / Fshati',
            'Kategoria',
            'Diagnoza',
            'Viti i Diagnozës',
            'Urgjenca',
            'Nevojat',
            'Numri i Kontaktit',
            'Linku GoFundMe',
            'Spitali i Njoftuar',
            'Data e Njoftimit',
            'Foto / Dokument',
            'Data e Regjistrimit'
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
            `"${c.donationUrl || '-'}"`,
            `"${c.hospitalTarget || (c.hospitalNotified ? 'Po' : 'Jo')}"`,
            `"${c.hospitalNotifiedAt ? new Date(c.hospitalNotifiedAt).toLocaleDateString('sq-AL') : '-'}"`,
            `"${c.imageUrl ? 'Ka foto' : 'Pa foto'}"`,
            `"${new Date(c.createdAt).toLocaleDateString('sq-AL')}"`
        ]);
        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `regjistri-shendetesor-kosove-${selectedMunicipality === 'all' ? '38-komunat' : selectedMunicipality.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Skedari CSV u shkarkua me sukses!');
    };
    // Print Report Function
    const handlePrintReport = () => {
        window.print();
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4", children: [_jsx("div", { children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400", children: _jsx(HeartPulse, { className: "w-6 h-6" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-slate-900 dark:text-white", children: "Regjistri Sh\u00EBndet\u00EBsor & Menaxhimi i Spitaleve" }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: "Evidenca e s\u00EBmundjeve t\u00EB r\u00EBnda, foto/dokumentet mjek\u00EBsore, dhe njoftimi i spitaleve rajonale e QKMF-ve p\u00EBr 38 komunat." })] })] }) }), _jsxs("div", { className: "flex flex-wrap items-center gap-2.5 w-full lg:w-auto", children: [_jsxs("button", { onClick: handleExportCSV, className: "flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95", title: "Eksporto t\u00EB gjitha t\u00EB dh\u00EBnat n\u00EB skedar Excel / CSV", children: [_jsx(Download, { className: "w-4 h-4" }), _jsxs("span", { children: ["Shkarko CSV (", filteredCases.length, ")"] })] }), _jsxs("button", { onClick: handlePrintReport, className: "flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95", title: "Printo raport zyrtar", children: [_jsx(Printer, { className: "w-4 h-4" }), _jsx("span", { children: "Printo Raport" })] })] })] }), _jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-4", children: [_jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4", children: [_jsx("p", { className: "text-xs font-bold text-slate-500 uppercase", children: "Raste t\u00EB Filtruara" }), _jsx("p", { className: "text-2xl font-black text-slate-900 dark:text-white mt-1", children: totalCount }), _jsx("p", { className: "text-[11px] text-slate-400", children: "nga t\u00EB gjitha 38 komunat" })] }), _jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4", children: [_jsx("p", { className: "text-xs font-bold text-rose-500 uppercase", children: "Urgjenca t\u00EB Larta" }), _jsx("p", { className: "text-2xl font-black text-rose-600 dark:text-rose-400 mt-1", children: urgentCount }), _jsx("p", { className: "text-[11px] text-slate-400", children: "k\u00EBrkojn\u00EB nd\u00EBrhyrje menj\u00EBher\u00EB" })] }), _jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4", children: [_jsx("p", { className: "text-xs font-bold text-blue-500 uppercase", children: "Spitalet e Njoftuara" }), _jsx("p", { className: "text-2xl font-black text-blue-600 dark:text-blue-400 mt-1", children: notifiedCount }), _jsx("p", { className: "text-[11px] text-slate-400", children: "dep\u00EBrtuar te personeli mjek\u00EBsor" })] }), _jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4", children: [_jsx("p", { className: "text-xs font-bold text-emerald-500 uppercase", children: "Dokumente / Foto" }), _jsx("p", { className: "text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1", children: withPhotoCount }), _jsx("p", { className: "text-[11px] text-slate-400", children: "epikriza & analiza mjek\u00EBsore" })] })] }), _jsx("div", { className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm space-y-3", children: _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "w-4 h-4 absolute left-3 top-3 text-slate-400" }), _jsx("input", { type: "text", value: searchQuery, onChange: e => setSearchQuery(e.target.value), placeholder: "K\u00EBrko pacient, diagnoz\u00EB, nevoj\u00EB...", className: "w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-rose-500" })] }), _jsx("div", { children: _jsxs("select", { value: selectedMunicipality, onChange: e => setSelectedMunicipality(e.target.value), className: "w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500", children: [_jsx("option", { value: "all", children: "\uD83D\uDCCD T\u00EB gjitha 38 Komunat" }), KOSOVO_MUNICIPALITIES.map(m => (_jsx("option", { value: m, children: m }, m)))] }) }), _jsx("div", { children: _jsxs("select", { value: selectedCategory, onChange: e => setSelectedCategory(e.target.value), className: "w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500", children: [_jsx("option", { value: "all", children: "\uD83C\uDFE5 T\u00EB gjitha Kategorit\u00EB" }), _jsx("option", { value: "Kancer / Onkologji", children: "Kancer / Onkologji" }), _jsx("option", { value: "S\u00EBmundje t\u00EB Zemr\u00EBs", children: "S\u00EBmundje t\u00EB Zemr\u00EBs" }), _jsx("option", { value: "S\u00EBmundje t\u00EB Mushk\u00EBrive", children: "S\u00EBmundje t\u00EB Mushk\u00EBrive" }), _jsx("option", { value: "S\u00EBmundje t\u00EB Veshkave & Dializ\u00EB", children: "S\u00EBmundje t\u00EB Veshkave" }), _jsx("option", { value: "Diabet me Komplikime", children: "Diabet me Komplikime" }), _jsx("option", { value: "S\u00EBmundje Neurologjike", children: "S\u00EBmundje Neurologjike" }), _jsx("option", { value: "S\u00EBmundje e Rrall\u00EB", children: "S\u00EBmundje e Rrall\u00EB" })] }) }), _jsx("div", { children: _jsxs("select", { value: selectedUrgency, onChange: e => setSelectedUrgency(e.target.value), className: "w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500", children: [_jsx("option", { value: "all", children: "\u26A1 T\u00EB gjitha Urgjencat" }), _jsx("option", { value: "Urgjente", children: "Urgjente" }), _jsx("option", { value: "Mesatare", children: "Mesatare" }), _jsx("option", { value: "Kronike e Stabilizuar", children: "Kronike e Stabilizuar" })] }) }), _jsx("div", { children: _jsxs("select", { value: selectedStatus, onChange: e => setSelectedStatus(e.target.value), className: "w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500", children: [_jsx("option", { value: "all", children: "\uD83D\uDCCB T\u00EB gjitha Statuset" }), _jsx("option", { value: "verified", children: "\u2705 E Verifikuar" }), _jsx("option", { value: "pending", children: "\u23F3 N\u00EB Shqyrtim" }), _jsx("option", { value: "rejected", children: "\u274C E Refuzuar" }), _jsx("option", { value: "resolved", children: "\uD83D\uDD4A\uFE0F E Trajtuar / Sh\u00EBruar" })] }) })] }) }), _jsx("div", { className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-xs", children: [_jsx("thead", { className: "bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider", children: _jsxs("tr", { children: [_jsx("th", { className: "py-3.5 px-4", children: "Pacienti" }), _jsx("th", { className: "py-3.5 px-4", children: "Komuna & Lagjja" }), _jsx("th", { className: "py-3.5 px-4", children: "Diagnoza & Kategoria" }), _jsx("th", { className: "py-3.5 px-4", children: "Urgjenca" }), _jsx("th", { className: "py-3.5 px-4", children: "Statusi Administrativ" }), _jsx("th", { className: "py-3.5 px-4", children: "GoFundMe / Fondi" }), _jsx("th", { className: "py-3.5 px-4", children: "Spitali" }), _jsx("th", { className: "py-3.5 px-4 text-right", children: "Veprime Administrative" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100 dark:divide-white/5", children: filteredCases.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "py-8 text-center text-slate-500 font-medium", children: "Nuk u gjet asnj\u00EB rast me k\u00EBta filtra." }) })) : (filteredCases.map(c => {
                                    const assignedHospital = getHospitalInfoForMunicipality(c.municipality);
                                    const caseStatus = c.status || 'verified';
                                    return (_jsxs("tr", { className: "hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors", children: [_jsx("td", { className: "py-3.5 px-4", children: _jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 shrink-0", children: c.isAnonymous ? '?' : c.fullName.charAt(0) }), _jsxs("div", { children: [_jsx("p", { onClick: () => handleOpenInspect(c), className: "font-bold text-slate-900 dark:text-white hover:text-rose-600 cursor-pointer", children: c.isAnonymous ? 'Rast Anonim' : c.fullName }), _jsxs("p", { className: "text-[11px] text-slate-400", children: [c.age, " vje\u00E7 \u2022 ", c.gender, " \u2022 ", c.contactPhone || 'Pa kontakt'] }), _jsx("p", { className: "text-[10px] font-mono font-bold text-blue-600 mt-1", children: c.trackingId || `HC-${c.id.slice(0, 8).toUpperCase()}` }), c.expiresAt && _jsxs("p", { className: "text-[10px] text-slate-400", children: ["Afati: ", new Date(c.expiresAt).toLocaleDateString('sq-AL')] })] }), c.imageUrl && _jsx("button", { type: "button", onClick: () => setPreviewImage({ url: c.imageUrl, title: c.fullName }), className: "w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 shrink-0", title: "Shiko foton", children: _jsx("img", { src: c.imageUrl, alt: "", className: "w-full h-full object-cover" }) })] }) }), _jsxs("td", { className: "py-3.5 px-4", children: [_jsxs("span", { className: "inline-flex items-center gap-1 font-bold text-slate-900 dark:text-white", children: [_jsx(MapPin, { className: "w-3.5 h-3.5 text-rose-500 shrink-0" }), c.municipality] }), _jsx("p", { className: "text-[11px] text-slate-400 pl-4", children: c.neighborhood || 'Qendra' })] }), _jsxs("td", { className: "py-3.5 px-4 max-w-xs", children: [_jsx("p", { className: "font-bold text-slate-900 dark:text-white truncate", title: c.diagnosis, children: c.diagnosis }), _jsx("span", { className: "inline-block mt-0.5 px-2 py-0.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded text-[10px] font-bold", children: c.category })] }), _jsx("td", { className: "py-3.5 px-4", children: _jsxs("span", { className: `px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${c.urgency === 'Urgjente'
                                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'}`, children: [c.urgency === 'Urgjente' && _jsx(AlertTriangle, { className: "w-3 h-3" }), c.urgency] }) }), _jsx("td", { className: "py-3.5 px-4", children: _jsxs("select", { value: caseStatus, onChange: (e) => handleUpdateStatus(c.id, e.target.value), className: `text-[11px] font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer ${caseStatus === 'verified'
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                                        : caseStatus === 'pending'
                                                            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                                            : caseStatus === 'rejected'
                                                                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                                                : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'}`, children: [_jsx("option", { value: "verified", children: "\u2705 Verifikuar" }), _jsx("option", { value: "pending", children: "\u23F3 N\u00EB Shqyrtim" }), _jsx("option", { value: "rejected", children: "\u274C Refuzuar" }), _jsx("option", { value: "resolved", children: "\uD83D\uDD4A\uFE0F Trajtuar" })] }) }), _jsxs("td", { className: "py-3.5 px-4", children: [c.donationUrl ? (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsxs("a", { href: c.donationUrl, target: "_blank", rel: "noopener noreferrer", className: "px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 border border-emerald-200 dark:border-emerald-800 transition-colors", title: "Hap fushat\u00EBn n\u00EB GoFundMe", children: [_jsx(Heart, { className: "w-3 h-3 fill-emerald-600/30 text-emerald-600" }), _jsx("span", { children: "GoFundMe" }), _jsx(ArrowUpRight, { className: "w-2.5 h-2.5" })] }), _jsx("button", { onClick: () => handleOpenAdminGoFundMe(c), className: "p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800", title: "Ndrysho linkun e GoFundMe", children: _jsx(Edit3, { className: "w-3 h-3" }) })] })) : (_jsxs("button", { onClick: () => handleOpenAdminGoFundMe(c), className: "px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 rounded-lg text-[11px] font-bold text-slate-500 inline-flex items-center gap-1 border border-slate-200 dark:border-slate-700 transition-colors", title: "Vendos linkun e GoFundMe", children: [_jsx(Plus, { className: "w-3 h-3" }), _jsx("span", { children: "Shto Link" })] })), c.supportAmountNeeded ? (_jsxs("p", { className: "text-[10px] text-slate-400 mt-1", children: ["Q\u00EBllimi: \u20AC", c.supportAmountNeeded.toLocaleString()] })) : null] }), _jsx("td", { className: "py-3.5 px-4", children: c.hospitalNotified ? (_jsxs("div", { children: [_jsxs("span", { className: "inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded", children: [_jsx(CheckCircle2, { className: "w-3 h-3" }), "Njoftuar"] }), _jsx("p", { className: "text-[10px] text-slate-400 mt-0.5 truncate max-w-[130px]", title: c.hospitalTarget || assignedHospital.name, children: c.hospitalTarget || assignedHospital.name })] })) : (_jsxs("div", { children: [_jsx("span", { className: "inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded", children: "N\u00EB pritje" }), _jsx("p", { className: "text-[10px] text-slate-400 mt-0.5 truncate max-w-[130px]", children: assignedHospital.name })] })) }), _jsx("td", { className: "py-3.5 px-4 text-right", children: _jsxs("div", { className: "flex items-center justify-end gap-1.5", children: [_jsxs("button", { onClick: () => handleOpenInspect(c), className: "px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition-all", title: "Inspekto Dosjen e Plot\u00EB Mjek\u00EBsore", children: [_jsx(FileText, { className: "w-3 h-3 text-rose-500" }), _jsx("span", { children: "Dosja" })] }), _jsxs("button", { onClick: () => handleOpenNotifyModal(c), className: "px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1 shadow-xs transition-all active:scale-95", title: "Njofto Spitalin Rajonal ose QKMF", children: [_jsx(Send, { className: "w-3 h-3" }), _jsx("span", { children: "Spitali" })] }), _jsx("button", { onClick: () => handlePrintReferral(c), className: "p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800", title: "Printo Flet\u00EB-Referimin Zyrtar", children: _jsx(Printer, { className: "w-3.5 h-3.5" }) })] }) })] }, c.id));
                                })) })] }) }) }), inspectingCase && (_jsx("div", { className: "fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto", children: _jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400", children: _jsx(HeartPulse, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsxs("h3", { className: "font-bold text-base text-slate-900 dark:text-white flex items-center gap-2", children: [_jsx("span", { children: "Dosja Mjek\u00EBsore Administrative" }), _jsxs("span", { className: "text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400", children: ["ID: ", inspectingCase.id] })] }), _jsx("p", { className: "text-xs text-slate-500", children: "Inspektimi dhe menaxhimi i pacientit n\u00EB Regjistrin Qendror" })] })] }), _jsx("button", { onClick: () => setInspectingCase(null), className: "p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs font-bold text-slate-700 dark:text-slate-300", children: "Statusi i Rastit:" }), _jsx("span", { className: `text-xs font-bold px-2.5 py-0.5 rounded-full ${inspectingCase.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                                                inspectingCase.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                                    inspectingCase.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`, children: inspectingCase.status === 'verified' ? 'E Verifikuar' :
                                                inspectingCase.status === 'pending' ? 'Në Shqyrtim' :
                                                    inspectingCase.status === 'rejected' ? 'E Refuzuar' : 'E Trajtuar' })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("button", { onClick: () => handleUpdateStatus(inspectingCase.id, 'verified'), className: "px-2.5 py-1 text-[11px] font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors", children: "Verifiko" }), _jsx("button", { onClick: () => handleUpdateStatus(inspectingCase.id, 'pending'), className: "px-2.5 py-1 text-[11px] font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors", children: "N\u00EB Shqyrtim" }), _jsx("button", { onClick: () => handleUpdateStatus(inspectingCase.id, 'rejected'), className: "px-2.5 py-1 text-[11px] font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors", children: "Refuzo" }), _jsx("button", { onClick: () => handleUpdateStatus(inspectingCase.id, 'resolved'), className: "px-2.5 py-1 text-[11px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors", children: "P\u00EBrfundo" })] })] }), isEditingCase ? (_jsxs("form", { onSubmit: handleSaveCaseEdits, className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs", children: [_jsxs("div", { children: [_jsx("label", { className: "font-bold text-slate-700 dark:text-slate-300 block mb-1", children: "Emri i Plot\u00EB" }), _jsx("input", { type: "text", value: editFormData.fullName || '', onChange: e => setEditFormData({ ...editFormData, fullName: e.target.value }), className: "w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg" })] }), _jsxs("div", { children: [_jsx("label", { className: "font-bold text-slate-700 dark:text-slate-300 block mb-1", children: "Telefoni i Kontaktit" }), _jsx("input", { type: "text", value: editFormData.contactPhone || '', onChange: e => setEditFormData({ ...editFormData, contactPhone: e.target.value }), className: "w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg" })] }), _jsxs("div", { children: [_jsx("label", { className: "font-bold text-slate-700 dark:text-slate-300 block mb-1", children: "Komuna" }), _jsx("select", { value: editFormData.municipality || '', onChange: e => setEditFormData({ ...editFormData, municipality: e.target.value }), className: "w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg", children: KOSOVO_MUNICIPALITIES.map(m => (_jsx("option", { value: m, children: m }, m))) })] }), _jsxs("div", { children: [_jsx("label", { className: "font-bold text-slate-700 dark:text-slate-300 block mb-1", children: "Niveli i Urgjenc\u00EBs" }), _jsxs("select", { value: editFormData.urgency || '', onChange: e => setEditFormData({ ...editFormData, urgency: e.target.value }), className: "w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg", children: [_jsx("option", { value: "Urgjente", children: "Urgjente" }), _jsx("option", { value: "Mesatare", children: "Mesatare" }), _jsx("option", { value: "Kronike e Stabilizuar", children: "Kronike e Stabilizuar" })] })] }), _jsxs("div", { className: "sm:col-span-2", children: [_jsx("label", { className: "font-bold text-slate-700 dark:text-slate-300 block mb-1", children: "Diagnoza Mjek\u00EBsore" }), _jsx("input", { type: "text", value: editFormData.diagnosis || '', onChange: e => setEditFormData({ ...editFormData, diagnosis: e.target.value }), className: "w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg" })] }), _jsxs("div", { className: "sm:col-span-2", children: [_jsx("label", { className: "font-bold text-slate-700 dark:text-slate-300 block mb-1", children: "P\u00EBrshkrimi i Epikriz\u00EBs & Gjendjes" }), _jsx("textarea", { rows: 3, value: editFormData.description || '', onChange: e => setEditFormData({ ...editFormData, description: e.target.value }), className: "w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg" })] }), _jsxs("div", { children: [_jsx("label", { className: "font-bold text-slate-700 dark:text-slate-300 block mb-1", children: "Fondi i Nevojsh\u00EBm (\u20AC)" }), _jsx("input", { type: "number", value: editFormData.supportAmountNeeded || 0, onChange: e => setEditFormData({ ...editFormData, supportAmountNeeded: Number(e.target.value) }), className: "w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg" })] }), _jsxs("div", { children: [_jsx("label", { className: "font-bold text-slate-700 dark:text-slate-300 block mb-1", children: "Linku i GoFundMe" }), _jsx("input", { type: "url", value: editFormData.donationUrl || '', onChange: e => setEditFormData({ ...editFormData, donationUrl: e.target.value }), className: "w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg" })] })] }), _jsxs("div", { className: "flex items-center justify-end gap-2 pt-3 border-t", children: [_jsx("button", { type: "button", onClick: () => setIsEditingCase(false), className: "px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg", children: "Anulo" }), _jsx("button", { type: "submit", className: "px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg", children: "Ruaj Ndryshimet" })] })] })) : (_jsxs("div", { className: "space-y-4 text-xs", children: [_jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-3 gap-3", children: [_jsxs("div", { className: "p-3 bg-slate-50 dark:bg-slate-800 rounded-xl", children: [_jsx("span", { className: "text-[10px] uppercase font-bold text-slate-400 block", children: "Pacienti" }), _jsx("strong", { className: "text-sm text-slate-900 dark:text-white", children: inspectingCase.fullName })] }), _jsxs("div", { className: "p-3 bg-slate-50 dark:bg-slate-800 rounded-xl", children: [_jsx("span", { className: "text-[10px] uppercase font-bold text-slate-400 block", children: "Mosha & Gjinia" }), _jsxs("strong", { className: "text-sm text-slate-900 dark:text-white", children: [inspectingCase.age, " vje\u00E7 (", inspectingCase.gender, ")"] })] }), _jsxs("div", { className: "p-3 bg-slate-50 dark:bg-slate-800 rounded-xl", children: [_jsx("span", { className: "text-[10px] uppercase font-bold text-slate-400 block", children: "Komuna & Lagjja" }), _jsxs("strong", { className: "text-sm text-slate-900 dark:text-white", children: [inspectingCase.municipality, " - ", inspectingCase.neighborhood || 'Qendër'] })] })] }), _jsxs("div", { className: "p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2", children: [_jsx("span", { className: "text-[10px] uppercase font-bold text-slate-400 block", children: "Diagnoza Klinike" }), _jsx("p", { className: "font-bold text-sm text-slate-900 dark:text-white", children: inspectingCase.diagnosis }), _jsx("p", { className: "text-slate-600 dark:text-slate-300 leading-relaxed", children: inspectingCase.description || 'Nuk ka përshkrim të shtuar.' }), inspectingCase.needs && inspectingCase.needs.length > 0 && (_jsx("div", { className: "pt-2 flex flex-wrap gap-1.5", children: inspectingCase.needs.map((n, i) => (_jsxs("span", { className: "px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[10px]", children: ["\u2022 ", n] }, i))) }))] }), _jsxs("div", { className: "p-3.5 border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("span", { className: "text-[10px] uppercase font-bold text-blue-600 block", children: "Spitali P\u00EBrgjegj\u00EBs Rajonal" }), _jsx("strong", { className: "text-xs text-slate-900 dark:text-white", children: getHospitalInfoForMunicipality(inspectingCase.municipality).name })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: () => handlePrintReferral(inspectingCase), className: "px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border rounded-lg font-bold text-xs flex items-center gap-1 hover:bg-slate-50", children: [_jsx(Printer, { className: "w-3.5 h-3.5" }), " Printo Flet\u00EB-Referim"] }), _jsxs("button", { onClick: () => {
                                                        setInspectingCase(null);
                                                        handleOpenNotifyModal(inspectingCase);
                                                    }, className: "px-3 py-1.5 bg-rose-600 text-white rounded-lg font-bold text-xs flex items-center gap-1 hover:bg-rose-700", children: [_jsx(Send, { className: "w-3.5 h-3.5" }), " Njofto Spitalin"] })] })] }), _jsxs("div", { className: "pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between", children: [_jsxs("button", { onClick: () => handleDeleteCase(inspectingCase.id), className: "text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1", children: [_jsx(Trash2, { className: "w-3.5 h-3.5" }), " Fshi Rastin"] }), _jsxs("button", { onClick: () => setIsEditingCase(true), className: "px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs flex items-center gap-1.5", children: [_jsx(Edit3, { className: "w-3.5 h-3.5" }), " Ndrysho t\u00EB Dh\u00EBnat"] })] })] }))] }) })), notifyingCase && hospitalInfo && (_jsx("div", { className: "fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto", children: _jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400", children: _jsx(Building2, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-base text-slate-900 dark:text-white", children: "Njofto Spitalin / QKMF P\u00EBrkat\u00EBse" }), _jsxs("p", { className: "text-xs text-slate-500", children: ["D\u00EBrgim alarmi zyrtar p\u00EBr Komun\u00EBn e ", notifyingCase.municipality] })] })] }), _jsx("button", { onClick: () => setNotifyingCase(null), className: "p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5", children: [_jsx(Building2, { className: "w-4 h-4 text-blue-500" }), hospitalInfo.name] }), _jsx("span", { className: "text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded", children: hospitalInfo.type })] }), _jsxs("p", { className: "text-xs text-slate-500", children: ["\uD83D\uDCCD ", hospitalInfo.address] }), _jsxs("div", { className: "pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs", children: [_jsxs("a", { href: `tel:${hospitalInfo.emergencyPhone}`, className: "flex items-center gap-2 p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-100 font-bold", children: [_jsx(Phone, { className: "w-3.5 h-3.5" }), _jsxs("span", { children: ["Urgjenca: ", hospitalInfo.emergencyPhone] })] }), _jsxs("a", { href: `mailto:${hospitalInfo.email}?subject=Njoftim Urgjent Shendetesor - ${notifyingCase.municipality}&body=${encodeURIComponent(notificationNotes)}`, className: "flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 font-bold", children: [_jsx(Mail, { className: "w-3.5 h-3.5" }), _jsx("span", { children: hospitalInfo.email })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5", children: "Mesazhi Zyrtar i Njoftimit (P\u00EBrmbajtja e Raportit)" }), _jsx("textarea", { rows: 5, value: notificationNotes, onChange: e => setNotificationNotes(e.target.value), className: "w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-rose-500 resize-none font-mono" })] }), _jsxs("div", { className: "flex flex-wrap gap-2 text-xs", children: [_jsxs("a", { href: `mailto:${hospitalInfo.email}?subject=Njoftim Zyrtar - Pacient në ${notifyingCase.municipality}&body=${encodeURIComponent(notificationNotes)}`, className: "px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5", children: [_jsx(Mail, { className: "w-3.5 h-3.5 text-blue-500" }), _jsx("span", { children: "Hap n\u00EB Email Client" })] }), _jsxs("a", { href: `https://wa.me/?text=${encodeURIComponent(notificationNotes)}`, target: "_blank", rel: "noreferrer", className: "px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold flex items-center gap-1.5", children: [_jsx(Send, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "D\u00EBrgo n\u00EB WhatsApp / Ekipit" })] })] }), _jsxs("div", { className: "pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-end gap-3", children: [_jsx("button", { type: "button", onClick: () => setNotifyingCase(null), className: "px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white", children: "Anulo" }), _jsxs("button", { type: "button", disabled: isDispatching, onClick: handleDispatchNotification, className: "px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/20 active:scale-95 transition-all", children: [_jsx(CheckCircle2, { className: "w-4 h-4" }), _jsx("span", { children: isDispatching ? 'Duke regjistruar...' : 'Konfirmo Njoftimin e Spitalit' })] })] })] }) })), previewImage && (_jsx("div", { className: "fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4", children: _jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-4 overflow-hidden border border-slate-200 dark:border-white/10 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-sm font-bold text-slate-900 dark:text-white truncate", children: previewImage.title }), _jsx("button", { onClick: () => setPreviewImage(null), className: "p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsx("div", { className: "max-h-[70vh] overflow-auto rounded-xl border border-slate-100 dark:border-white/5 flex items-center justify-center bg-slate-950", children: _jsx("img", { src: previewImage.url, alt: "", className: "max-h-[68vh] object-contain w-auto" }) }), _jsx("div", { className: "flex justify-end gap-2 pt-1", children: _jsxs("a", { href: previewImage.url, target: "_blank", rel: "noreferrer", className: "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5", children: [_jsx(ArrowUpRight, { className: "w-4 h-4" }), _jsx("span", { children: "Hap n\u00EB madh\u00EBsi t\u00EB plot\u00EB" })] }) })] }) })), adminGoFundMeCase && (_jsx("div", { className: "fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto", children: _jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400", children: _jsx(Heart, { className: "w-5 h-5 fill-emerald-500/20" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-base text-slate-900 dark:text-white", children: "Menaxho Linkun e GoFundMe" }), _jsxs("p", { className: "text-xs text-slate-500", children: ["Pacienti: ", adminGoFundMeCase.fullName, " \u2022 Komuna e ", adminGoFundMeCase.municipality] })] })] }), _jsx("button", { onClick: () => setAdminGoFundMeCase(null), className: "p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("form", { onSubmit: handleSaveAdminGoFundMe, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5", children: "Linku i GoFundMe / Donacionit" }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: "url", value: adminGoFundMeUrl, onChange: e => setAdminGoFundMeUrl(e.target.value), placeholder: "https://www.gofundme.com/f/emri-i-fushat\u00EBs...", className: "w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-medium" }), _jsx(LinkIcon, { className: "w-4 h-4 text-slate-400 absolute left-3 top-3" })] }), _jsx("p", { className: "text-[11px] text-slate-400 mt-1", children: "Shembull: https://www.gofundme.com/f/ndihme-per-sherim" })] }), _jsxs("div", { className: "pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-end gap-2.5", children: [adminGoFundMeCase.donationUrl && (_jsx("button", { type: "button", onClick: () => setAdminGoFundMeUrl(''), className: "px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors mr-auto", children: "Pastro Linkun" })), _jsx("button", { type: "button", onClick: () => setAdminGoFundMeCase(null), className: "px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors", children: "Anulo" }), _jsxs("button", { type: "submit", disabled: isAdminSavingGoFundMe, className: "px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5", children: [_jsx(Heart, { className: "w-3.5 h-3.5 fill-white" }), _jsx("span", { children: isAdminSavingGoFundMe ? 'Duke ruajtur...' : 'Ruaj Ndryshimet' })] })] })] })] }) }))] }));
}

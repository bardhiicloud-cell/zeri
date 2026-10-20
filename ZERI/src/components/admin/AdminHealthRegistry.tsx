import React, { useState, useEffect, useMemo } from 'react';
import { escapeHtml } from '../../lib/escapeHtml';
import {  dt } from '../../lib/dt';
import {
  HeartPulse, Download, Search, Filter, Phone, Mail, 
  MapPin, CheckCircle2, AlertTriangle, FileText, Send, 
  ExternalLink, Eye, Building2, ShieldAlert, Sparkles, X,
  Printer, ArrowUpRight, Heart, Link as LinkIcon, Edit3, Plus,
  Trash2, ShieldCheck, Check, Clock, UserCheck
} from 'lucide-react';
import { collection, onSnapshot, updateDoc, deleteDoc, doc, query, orderBy, limit } from 'firebase/firestore';
import DecisionBar from './DecisionBar';
import { takeDecision } from '../../lib/decisionsApi';
import { db, readPrivateHealthDocument } from '../../lib/firebase.ts';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import { getHospitalInfoForMunicipality, HospitalContact } from '../../data/kosovoHospitals';
import { STAFF_LIMITS } from '../../lib/loadLimits';
import { cn } from '../../lib/utils';
import type { HealthCase } from '../../pages/HealthRegistryPage.tsx';
import AdminMedicineShortages from './AdminMedicineShortages.tsx';
import toast from 'react-hot-toast';
import { askConfirm, askReason } from '../../lib/dialogs';

export default function AdminHealthRegistry() {
  // Section switcher: the patient registry vs. the medicine-shortage queue.
  const [registryTab, setRegistryTab] = useState<'cases' | 'shortages'>('cases');
  const [cases, setCases] = useState<HealthCase[]>([]);
  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Detailed Case Inspection & Edit Modal State
  const [inspectingCase, setInspectingCase] = useState<HealthCase | null>(null);
  const [isEditingCase, setIsEditingCase] = useState<boolean>(false);
  const [editFormData, setEditFormData] = useState<Partial<HealthCase>>({});

  // Hospital Notification Modal State
  const [notifyingCase, setNotifyingCase] = useState<HealthCase | null>(null);
  const [hospitalInfo, setHospitalInfo] = useState<HospitalContact | null>(null);
  const [notificationNotes, setNotificationNotes] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState<boolean>(false);

  // Document / Photo Preview Modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; documentType?: 'image' | 'pdf' } | null>(null);

  // GoFundMe Admin Edit Modal State
  const [adminGoFundMeCase, setAdminGoFundMeCase] = useState<HealthCase | null>(null);
  const [adminGoFundMeUrl, setAdminGoFundMeUrl] = useState<string>('');
  const [isAdminSavingGoFundMe, setIsAdminSavingGoFundMe] = useState<boolean>(false);

  // Listen to Firestore healthRegistry.
  //
  // Bounded and ordered. This collection holds the most sensitive records on the
  // platform — a patient's name, diagnosis and contact number — and it was streamed
  // in full, unordered, to every staff session. At scale that is both the largest
  // read cost in the admin panel and an unnecessary exposure: a supervisor
  // reviewing urgent cases needs the newest page of them, and the search box below
  // narrows what is already loaded rather than requiring the whole registry.
  useEffect(() => {
    if (registryTab !== 'cases') return;
    const q = query(
      collection(db, 'healthRegistry'),
      orderBy('createdAt', 'desc'),
      limit(STAFF_LIMITS.healthCases)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setCases(snapshot.docs.map(caseDoc => ({
        id: caseDoc.id,
        ...caseDoc.data()
      } as HealthCase)));
      setLoadError(null);
      setIsLoadingCases(false);
    }, (error) => {
      console.error('Regjistri shëndetësor nuk u ngarkua për administratorin:', error);
      setLoadError('Të dhënat nuk u ngarkuan. Kontrolloni lejet dhe lidhjen, pastaj provoni përsëri.');
      setIsLoadingCases(false);
      toast.error('Regjistri shëndetësor nuk u ngarkua.');
    });

    return () => unsub();
  }, [registryTab]);

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
  const handleOpenInspect = (c: HealthCase) => {
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

  const handleOpenHealthDocument = async (healthCase: HealthCase) => {
    if (!healthCase.imageUrl) return;
    const documentType = healthCase.documentType || (/\.pdf(?:$|[?#])/i.test(healthCase.imageUrl) ? 'pdf' : 'image');
    try {
      const url = healthCase.imageUrl.startsWith('health/')
        ? URL.createObjectURL(await readPrivateHealthDocument(healthCase.imageUrl))
        : healthCase.imageUrl;
      setPreviewImage({ url, title: `${healthCase.fullName || 'Rast shëndetësor'} · Dokument`, documentType });
    } catch (error) {
      console.error('Dokumenti privat nuk u hap:', error);
      toast.error('Dokumenti nuk u hap. Verifikoni qasjen dhe provoni përsëri.');
    }
  };

  useEffect(() => () => {
    if (previewImage?.url.startsWith('blob:')) URL.revokeObjectURL(previewImage.url);
  }, [previewImage]);

  /** After the server accepted a decision, mirror it locally so the screen updates at once. */
  const applyDecidedStatus = (caseId: string, newStatus: string) => {
    const statusUpdatedAt = new Date().toISOString();
    const status = newStatus as HealthCase['status'];
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, status, statusUpdatedAt } : c));
    setInspectingCase(prev => prev?.id === caseId ? { ...prev, status, statusUpdatedAt } : prev);
  };

  // Save Case Details
  const handleSaveCaseEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingCase) return;

    try {
      const updatedCase: HealthCase = {
        ...inspectingCase,
        ...editFormData,
      } as HealthCase;

      await updateDoc(doc(db, 'healthRegistry', inspectingCase.id), editFormData);
      setCases(prev => prev.map(c => c.id === inspectingCase.id ? updatedCase : c));
      setInspectingCase(updatedCase);
      setIsEditingCase(false);
      toast.success('Të dhënat mjekësore u ruajtën me sukses!');
    } catch (err) {
      console.error('Ndryshimet e rastit shëndetësor nuk u ruajtën:', err);
      toast.error('Gabim gjatë ruajtjes së ndryshimeve.');
    }
  };

  // Delete Case Handler
  const handleDeleteCase = async (caseId: string) => {
    if (!await askConfirm('A jeni të sigurt që dëshironi ta fshini këtë rast nga Regjistri Shëndetësor? Ky veprim nuk mund të kthehet.')) return;
    
    try {
      await deleteDoc(doc(db, 'healthRegistry', caseId));
      setCases(prev => prev.filter(c => c.id !== caseId));
      if (inspectingCase?.id === caseId) setInspectingCase(null);
      toast.success('Rasti shëndetësor u fshi me sukses.');
    } catch (err) {
      console.error('Rasti shëndetësor nuk u fshi:', err);
      toast.error('Rasti nuk u fshi. Kontrolloni lejet dhe provoni përsëri.');
    }
  };

  /**
   * Convert a verified case into an anonymous public record.
   *
   * This is the second half of the anonymity workflow the report described:
   * a citizen files an anonymous request, the submission carries the real
   * identity (`fullName`, `contactPhone`, `contactName`) precisely so that a
   * health administrator can *review and confirm the case is genuine*, and only
   * then does the record become anonymous to everyone else.
   *
   * Redacting at submission time would make verification impossible; redacting
   * never would publish a patient's name. So the administrator performs the
   * redaction as an explicit, audited action:
   *
   *  • `isAnonymous` is set, so every public view redacts the name.
   *  • The contact fields are moved into `contactVisibility: 'admin_only'`,
   *    which the public registry already honours, rather than being deleted —
   *    deleting them would make the case impossible to follow up.
   *  • `anonymizedAt` / `anonymizedBy` record who did it and when, because
   *    "who removed this patient's name" is a question that will be asked.
   */
  const handleAnonymizeCase = async (healthCase: HealthCase) => {
    if (healthCase.isAnonymous) {
      toast('Ky rast është tashmë anonim.');
      return;
    }
    if (!await askConfirm(
      'Konverto këtë rast në anonim?\n\n' +
      'Emri i pacientit do të fshihet nga të gjitha pamjet publike dhe i vetmi ' +
      'identifikues do të mbetet kodi i gjurmimit. Të dhënat e kontaktit mbeten ' +
      'të qasshme vetëm për administratorët e autorizuar.'
    )) return;

    const anonymizedAt = new Date().toISOString();
    const patch = {
      isAnonymous: true,
      contactVisibility: 'admin_only' as const,
      anonymizedAt,
      hospitalPrivacyNotice:
        'RAST ANONIM: Emri i pacientit nuk duhet të shfaqet në dokumentet, komunikimet apo evidencat e spitalit. Kontakti është i qasshëm vetëm për administratorët e autorizuar.',
    };

    try {
      await updateDoc(doc(db, 'healthRegistry', healthCase.id), patch);
      setCases(prev => prev.map(c => (c.id === healthCase.id ? { ...c, ...patch } : c)));
      setInspectingCase(prev => prev?.id === healthCase.id ? { ...prev, ...patch } : prev);
      toast.success('Rasti u kthye në anonim. Identiteti mbetet vetëm për administratën.');
    } catch (err) {
      console.error('Anonimizimi i rastit nuk u ruajt:', err);
      toast.error('Anonimizimi nuk u ruajt. Provoni përsëri.');
    }
  };

  // Print Official Hospital Referral Document
  const handlePrintReferral = (c: HealthCase) => {
    const hosp = getHospitalInfoForMunicipality(c.municipality);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fletë-Referim Zyrtar - ${c.isAnonymous ? 'Rast Anonim' : escapeHtml(c.fullName)}</title>
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
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Numri Protokollar: REF-KS-${escapeHtml(c.id.slice(-6).toUpperCase())} • Data: ${new Date().toLocaleDateString('sq-AL')}</div>
          </div>

          <div class="grid">
            <div class="field"><div class="field-label">Pacienti</div><div class="field-val">${c.isAnonymous ? 'Rast i Mbrojtur / Anonim' : escapeHtml(c.fullName)}</div></div>
            <div class="field"><div class="field-label">Mosha dhe Gjinia</div><div class="field-val">${escapeHtml(c.age)} vjeç • ${escapeHtml(c.gender)}</div></div>
            <div class="field"><div class="field-label">Komuna & Lagjja</div><div class="field-val">Komuna e ${escapeHtml(c.municipality)} (${escapeHtml(c.neighborhood || 'Qendër')})</div></div>
            <div class="field"><div class="field-label">Urgjenca</div><div class="field-val urgent-badge">${escapeHtml(c.urgency)}</div></div>
            <div class="field"><div class="field-label">Kategoria Klinike</div><div class="field-val">${escapeHtml(c.category)}</div></div>
            <div class="field"><div class="field-label">Telefoni i Kontaktit</div><div class="field-val">${escapeHtml(c.contactPhone || 'Pa kontakt të shënuar')}</div></div>
          </div>

          <div style="margin-top: 15px;">
            <div class="field-label">Diagnoza Paraprake dhe Epikriza</div>
            <div class="box">
              <strong>Diagnoza:</strong> ${escapeHtml(c.diagnosis)}<br/><br/>
              <strong>Përshkrimi i Rastit:</strong><br/>
              ${escapeHtml(c.description || 'Nuk ka përshkrim të plotë të shtuar.')}<br/><br/>
              <strong>Nevojat e Veçanta:</strong> ${escapeHtml((c.needs || []).join(' • '))}
            </div>
          </div>

          <div class="hosp-box">
            <strong>Institucioni Shëndetësor Pritës:</strong> ${escapeHtml(hosp.name)}<br/>
            <strong>Adresa:</strong> ${escapeHtml(hosp.address)} | <strong>Kontakti i Urgjencës:</strong> ${escapeHtml(hosp.emergencyPhone)}
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
  const handleOpenNotifyModal = (c: HealthCase) => {
    setNotifyingCase(c);
    const hosp = getHospitalInfoForMunicipality(c.municipality);
    setHospitalInfo(hosp);
    setNotificationNotes(`Njoftim Zyrtar Shëndetësor për rastin: ${c.isAnonymous ? 'Anonim' : c.fullName} (${c.age} vjeç) nga Komuna ${c.municipality}, Lagjja ${c.neighborhood}.\nDiagnoza: ${c.diagnosis}.\nNevojat primare: ${(c.needs || []).join(', ')}.\nNiveli i Urgjencës: ${c.urgency}.`);
  };

  // Dispatch Notification to Hospital
  const handleDispatchNotification = async () => {
    if (!notifyingCase || !hospitalInfo) return;

    setIsDispatching(true);
    try {
      // If it's stored in Firestore, update document
      if (!notifyingCase.id.startsWith('hc-')) {
        await updateDoc(doc(db, 'healthRegistry', notifyingCase.id), {
          hospitalNotified: true,
          hospitalNotifiedAt: new Date().toISOString(),
          hospitalTarget: hospitalInfo.name,
          notificationNotes: notificationNotes,
        });
        // Telling a hospital means the case was checked: record that as a
        // verification decision (with author and trace), not a silent status write.
        if ((notifyingCase.status ?? 'pending') === 'pending') {
          try {
            await takeDecision('health', notifyingCase.id, 'approve');
            setCases(prev => prev.map(item => item.id === notifyingCase.id ? { ...item, status: 'verified' } : item));
          } catch (error) {
            toast.error(`${dt('Spitali u njoftua, por rasti nuk u verifikua:')} ${(error as Error).message}`);
          }
        }
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
    } catch (err) {
      console.error(err);
      toast.error('Gabim gjatë regjistrimit të njoftimit.');
    } finally {
      setIsDispatching(false);
    }
  };

  // GoFundMe Admin Handlers
  const handleOpenAdminGoFundMe = (c: HealthCase) => {
    setAdminGoFundMeCase(c);
    setAdminGoFundMeUrl(c.donationUrl || '');
  };

  const handleSaveAdminGoFundMe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminGoFundMeCase) return;
    const url = adminGoFundMeUrl.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      toast.error('Ju lutem vendosni një URL të vlefshme (duke filluar me https://)');
      return;
    }

    setIsAdminSavingGoFundMe(true);
    const previousUrl = adminGoFundMeCase.donationUrl;
    try {
      // Write first, then update the screen. This used to swallow a failed write
      // and still announce success, leaving the list showing a link that was
      // never stored.
      await updateDoc(doc(db, 'healthRegistry', adminGoFundMeCase.id), {
        donationUrl: url || null
      });
      setCases(prev => prev.map(item => item.id === adminGoFundMeCase.id ? { ...item, donationUrl: url || undefined } : item));
      toast.success(url ? 'Linku i GoFundMe u ruajt!' : 'Linku i donacionit u hoq.');
      setAdminGoFundMeCase(null);
    } catch (err) {
      console.error('GoFundMe link not saved:', err);
      setCases(prev => prev.map(item => item.id === adminGoFundMeCase.id ? { ...item, donationUrl: previousUrl } : item));
      toast.error('Linku nuk u ruajt. Kontrolloni lejet dhe provoni përsëri.');
    } finally {
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

  /** Filename stem shared by every export, so the three files group together. */
  const exportStem = () =>
    `regjistri-shendetesor-${selectedMunicipality === 'all' ? '38-komunat' : selectedMunicipality.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;

  /**
   * Standalone HTML export.
   *
   * This is the version that can be emailed to a hospital directorate or
   * archived: one self-contained file with inline styles, no external assets and
   * no build step. CSV is for spreadsheets; this is for a human to read.
   */
  const handleExportHTML = () => {
    if (filteredCases.length === 0) {
      toast.error(dt('Nuk ka të dhëna për të shkarkuar.'));
      return;
    }

    const rows = filteredCases.map(c => `
      <tr>
        <td>${escapeHtml(c.trackingId || c.id)}</td>
        <td>${c.isAnonymous ? '<em>' + escapeHtml(dt('Anonim')) + '</em>' : escapeHtml(c.fullName)}</td>
        <td>${c.age}</td>
        <td>${c.gender}</td>
        <td>${c.municipality}</td>
        <td>${c.neighborhood || dt('Qendër')}</td>
        <td>${c.category}</td>
        <td>${c.diagnosis}</td>
        <td>${c.urgency}</td>
        <td>${(c.needs || []).join(', ')}</td>
        <td>${c.contactPhone || '-'}</td>
        <td>${c.hospitalTarget || (c.hospitalNotified ? dt('Po') : dt('Jo'))}</td>
        <td>${new Date(c.createdAt).toLocaleDateString('sq-AL')}</td>
      </tr>`).join('');

    const html = `<!doctype html>
<html lang="sq">
<head>
<meta charset="utf-8">
<title>${dt('Regjistri Shëndetësor')} — ${selectedMunicipality === 'all' ? dt('Të 38 komunat') : selectedMunicipality}</title>
<style>
  body { font-family: system-ui, Segoe UI, sans-serif; margin: 32px; color: #0f172a; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  th { background: #0f172a; color: #fff; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  em { color: #64748b; }
  footer { margin-top: 24px; font-size: 10px; color: #94a3b8; }
</style>
</head>
<body>
  <h1>${dt('Regjistri Shëndetësor')}</h1>
  <div class="meta">${selectedMunicipality === 'all' ? dt('Të 38 komunat') : dt('Komuna') + ': ' + selectedMunicipality} · ${filteredCases.length} ${dt('raste')} · ${new Date().toLocaleString('sq-AL')}</div>
  <table>
    <thead><tr>
      <th>ID</th><th>${dt('Pacienti')}</th><th>${dt('Mosha')}</th><th>${dt('Gjinia')}</th>
      <th>${dt('Komuna')}</th><th>${dt('Lagjja')}</th><th>${dt('Kategoria')}</th>
      <th>${dt('Diagnoza')}</th><th>${dt('Urgjenca')}</th><th>${dt('Nevojat')}</th>
      <th>${dt('Kontakti')}</th><th>${dt('Spitali')}</th><th>${dt('Data')}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <footer>${dt('Dokument i gjeneruar automatikisht nga platforma Zëri Qytetarëve. Përmban të dhëna konfidenciale.')}</footer>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${exportStem()}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(dt('Skedari HTML u shkarkua.'));
  };

  /**
   * PDF export through the browser's own print dialog.
   *
   * The app has no PDF library and adding one would put a ~300KB dependency in
   * front of every admin load for a feature used occasionally. "Save as PDF" is
   * a standard target in every print dialog, so the printable document is put in
   * a hidden iframe and printing is triggered on it — the admin chooses PDF.
   */
  const handleExportPDF = () => {
    if (filteredCases.length === 0) {
      toast.error(dt('Nuk ka të dhëna për të shkarkuar.'));
      return;
    }

    const rows = filteredCases.map(c => `
      <tr>
        <td>${escapeHtml(c.trackingId || c.id)}</td>
        <td>${c.isAnonymous ? '<em>' + escapeHtml(dt('Anonim')) + '</em>' : escapeHtml(c.fullName)}</td>
        <td>${escapeHtml(c.age)}</td><td>${escapeHtml(c.municipality)}</td><td>${escapeHtml(c.category)}</td>
        <td>${escapeHtml(c.diagnosis)}</td><td>${escapeHtml(c.urgency)}</td>
      </tr>`).join('');

    const doc = `<!doctype html><html><head><meta charset="utf-8">
<style>
  @page { size: A4 landscape; margin: 14mm; }
  body { font-family: system-ui, sans-serif; color: #0f172a; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  .meta { color: #64748b; font-size: 10px; margin-bottom: 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 9px; }
  th { background: #0f172a; color: #fff; padding: 5px 6px; text-align: left; }
  td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; }
</style></head><body>
<h1>${dt('Regjistri Shëndetësor')} — ${selectedMunicipality === 'all' ? dt('Të 38 komunat') : escapeHtml(selectedMunicipality)}</h1>
<div class="meta">${filteredCases.length} ${dt('raste')} · ${new Date().toLocaleString('sq-AL')}</div>
<table><thead><tr>
  <th>ID</th><th>${dt('Pacienti')}</th><th>${dt('Mosha')}</th><th>${dt('Komuna')}</th>
  <th>${dt('Kategoria')}</th><th>${dt('Diagnoza')}</th><th>${dt('Urgjenca')}</th>
</tr></thead><tbody>${rows}</tbody></table>
</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    if (!win) {
      document.body.removeChild(iframe);
      toast.error(dt('Eksporti PDF nuk është i mundur në këtë shfletues.'));
      return;
    }
    win.document.open();
    win.document.write(doc);
    win.document.close();
    win.focus();
    // Let the iframe paint before invoking print, otherwise some browsers print
    // a blank page.
    setTimeout(() => {
      win.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);

    toast.success(dt('Zgjidh "Ruaj si PDF" në dialogun e printimit.'));
  };

  // Print Report Function
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Section switcher */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRegistryTab('cases')}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition',
            registryTab === 'cases'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
          )}
        >
          <HeartPulse className="w-4 h-4" /> {dt('Regjistri Shëndetësor')}
        </button>
        <button
          type="button"
          onClick={() => setRegistryTab('shortages')}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition',
            registryTab === 'shortages'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
          )}
        >
          <ShieldAlert className="w-4 h-4" /> {dt('Mungesat e Barnave')}
        </button>
      </div>

      {registryTab === 'shortages' ? (
        <AdminMedicineShortages />
      ) : (
      <>
      {/* Top Header Card */}
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-slate-700 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-[0_28px_80px_-40px_rgba(15,23,42,0.8)] sm:p-7 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-400/10 text-rose-300 ring-1 ring-rose-300/10">
              <HeartPulse className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-black text-white sm:text-2xl">
                Regjistri Shëndetësor & Menaxhimi i Spitaleve
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">
                Rastet dhe dokumentet e pacientëve · qasje e kufizuar për stafin e autorizuar · ndryshimet ruhen në Firestore.
              </p>
            </div>
          </div>
        </div>

        {/*
          Export cluster. The three formats cover the three real consumers:
          CSV for a spreadsheet, HTML for something a person reads or emails on,
          and PDF for an official record that must not be edited.
        */}
        <div className="flex w-full flex-wrap items-center gap-2.5 lg:w-auto">
          <button
            onClick={handleExportCSV}
            disabled={isLoadingCases || filteredCases.length === 0}
            className="flex-1 rounded-xl bg-emerald-500 px-3.5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial"
            title={dt('Eksporto në Excel / CSV për tabela')}
          >
            <Download className="inline w-4 h-4" />
            <span className="ml-1.5">CSV ({filteredCases.length})</span>
          </button>

          <button
            onClick={handleExportHTML}
            disabled={isLoadingCases || filteredCases.length === 0}
            className="flex-1 rounded-xl bg-sky-600 px-3.5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-sky-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial"
            title={dt('Eksporto si faqe HTML të lexueshme ose për email')}
          >
            <FileText className="inline w-4 h-4" />
            <span className="ml-1.5">HTML</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isLoadingCases || filteredCases.length === 0}
            className="flex-1 rounded-xl bg-rose-600 px-3.5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-rose-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial"
            title={dt('Eksporto si PDF zyrtar')}
          >
            <FileText className="inline w-4 h-4" />
            <span className="ml-1.5">PDF</span>
          </button>

          <button
            onClick={handlePrintReport}
            className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10 active:scale-95 sm:flex-initial"
            title="Printo raport zyrtar"
          >
            <Printer className="inline w-4 h-4" />
            <span className="ml-1.5">{dt('Printo Raport')}</span>
          </button>
        </div>
      </div>

      {isLoadingCases && (
        <div role="status" className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-3 text-xs font-semibold text-cyan-800 dark:text-cyan-200">
          Po sinkronizohen rastet shëndetësore...
        </div>
      )}
      {loadError && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-300/30 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div><p className="font-black">Sinkronizimi dështoi</p><p className="mt-1 text-xs">{loadError}</p></div>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Raste në filtra</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</p>
          <p className="text-[11px] text-slate-400">nga të gjitha 38 komunat</p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[11px] font-black uppercase tracking-wider text-rose-500">Urgjenca të larta</p>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{urgentCount}</p>
          <p className="text-[11px] text-slate-400">kërkojnë ndërhyrje menjëherë</p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[11px] font-black uppercase tracking-wider text-blue-500">Spitalet e njoftuara</p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{notifiedCount}</p>
          <p className="text-[11px] text-slate-400">depërtuar te personeli mjekësor</p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-500">Dokumente / foto</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{withPhotoCount}</p>
          <p className="text-[11px] text-slate-400">epikriza & analiza mjekësore</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Kërko pacient, diagnozë, nevojë..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-rose-500"
            />
          </div>

          {/* Municipality Selector */}
          <div>
            <select
              value={selectedMunicipality}
              onChange={e => setSelectedMunicipality(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
            >
              <option value="all">📍 Të gjitha 38 Komunat</option>
              {KOSOVO_MUNICIPALITIES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Category Selector */}
          <div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
            >
              <option value="all">🏥 Të gjitha Kategoritë</option>
              <option value="Kancer / Onkologji">Kancer / Onkologji</option>
              <option value="Sëmundje të Zemrës">Sëmundje të Zemrës</option>
              <option value="Sëmundje të Mushkërive">Sëmundje të Mushkërive</option>
              <option value="Sëmundje të Veshkave & Dializë">Sëmundje të Veshkave</option>
              <option value="Diabet me Komplikime">Diabet me Komplikime</option>
              <option value="Sëmundje Neurologjike">Sëmundje Neurologjike</option>
              <option value="Sëmundje e Rrallë">Sëmundje e Rrallë</option>
            </select>
          </div>

          {/* Urgency Selector */}
          <div>
            <select
              value={selectedUrgency}
              onChange={e => setSelectedUrgency(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
            >
              <option value="all">⚡ Të gjitha Urgjencat</option>
              <option value="Urgjente">Urgjente</option>
              <option value="Mesatare">Mesatare</option>
              <option value="Kronike e Stabilizuar">Kronike e Stabilizuar</option>
            </select>
          </div>

          {/* Status Selector */}
          <div>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
            >
              <option value="all">📋 Të gjitha Statuset</option>
              <option value="verified">✅ E Verifikuar</option>
              <option value="pending">⏳ Në Shqyrtim</option>
              <option value="rejected">❌ E Refuzuar</option>
              <option value="resolved">🕊️ E Trajtuar / Shëruar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Health Cases Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Pacienti</th>
                <th className="py-3.5 px-4">Komuna & Lagjja</th>
                <th className="py-3.5 px-4">Diagnoza & Kategoria</th>
                <th className="py-3.5 px-4">Urgjenca</th>
                <th className="py-3.5 px-4">Statusi Administrativ</th>
                <th className="py-3.5 px-4">GoFundMe / Fondi</th>
                <th className="py-3.5 px-4">Spitali</th>
                <th className="py-3.5 px-4 text-right">Veprime Administrative</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-medium">
                    Nuk u gjet asnjë rast me këta filtra.
                  </td>
                </tr>
              ) : (
                filteredCases.map(c => {
                  const assignedHospital = getHospitalInfoForMunicipality(c.municipality);
                  const caseStatus = c.status || 'verified';
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Patient Name & Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 shrink-0">
                            {c.fullName?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p 
                              onClick={() => handleOpenInspect(c)}
                              className="font-bold text-slate-900 dark:text-white hover:text-rose-600 cursor-pointer"
                            >
                              {c.fullName || 'Emër privat i padeklaruar'}
                            </p>
                            {c.isAnonymous && <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">Anonim për publik</span>}
                            <p className="text-[11px] text-slate-400">
                              {c.age} vjeç • {c.gender} • {c.contactPhone || 'Pa kontakt'}
                            </p>
                            <p className="text-[11px] font-mono font-bold text-blue-600 mt-1">{c.trackingId || `HC-${c.id.slice(0, 8).toUpperCase()}`}</p>
                            {c.expiresAt && <p className="text-[11px] text-slate-400">Afati: {new Date(c.expiresAt).toLocaleDateString('sq-AL')}</p>}
                          </div>
                          {c.imageUrl && <button type="button" onClick={() => void handleOpenHealthDocument(c)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-600 dark:border-white/10 dark:bg-slate-900 shrink-0" title="Shiko dokumentin">{c.documentType === 'pdf' ? <FileText className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>}
                        </div>
                      </td>

                      {/* Municipality & Neighborhood */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-bold text-slate-900 dark:text-white">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          {c.municipality}
                        </span>
                        <p className="text-[11px] text-slate-400 pl-4">{c.neighborhood || 'Qendra'}</p>
                      </td>

                      {/* Diagnosis & Category */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-bold text-slate-900 dark:text-white truncate" title={c.diagnosis}>
                          {c.diagnosis}
                        </p>
                        <span className="inline-block mt-0.5 px-2 py-0.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded text-[11px] font-bold">
                          {c.category}
                        </span>
                      </td>

                      {/* Urgency */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                          c.urgency === 'Urgjente' 
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400' 
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                        }`}>
                          {c.urgency === 'Urgjente' && <AlertTriangle className="w-3 h-3" />}
                          {c.urgency}
                        </span>
                      </td>

                      {/* Administrative Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex text-[11px] font-bold px-2 py-1 rounded-lg border ${
                            caseStatus === 'verified'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : caseStatus === 'pending'
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : caseStatus === 'rejected'
                              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          }`}
                          title={dt('Gjendja ndryshohet te dosja e rastit, me arsye dhe histori.')}
                        >
                          {caseStatus === 'verified' ? dt('Verifikuar') : caseStatus === 'pending' ? dt('Në shqyrtim') : caseStatus === 'rejected' ? dt('Refuzuar') : dt('Trajtuar')}
                        </span>
                      </td>

                      {/* GoFundMe / Donacion */}
                      <td className="py-3.5 px-4">
                        {c.donationUrl ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={c.donationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 border border-emerald-200 dark:border-emerald-800 transition-colors"
                              title="Hap fushatën në GoFundMe"
                            >
                              <Heart className="w-3 h-3 fill-emerald-600/30 text-emerald-600" />
                              <span>GoFundMe</span>
                              <ArrowUpRight className="w-2.5 h-2.5" />
                            </a>
                            <button
                              onClick={() => handleOpenAdminGoFundMe(c)}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Ndrysho linkun e GoFundMe"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenAdminGoFundMe(c)}
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 rounded-lg text-[11px] font-bold text-slate-500 inline-flex items-center gap-1 border border-slate-200 dark:border-slate-700 transition-colors"
                            title="Vendos linkun e GoFundMe"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Shto Link</span>
                          </button>
                        )}
                        {c.supportAmountNeeded ? (
                          <p className="text-[11px] text-slate-400 mt-1">
                            Qëllimi: €{c.supportAmountNeeded.toLocaleString()}
                          </p>
                        ) : null}
                      </td>

                      {/* Hospital Status */}
                      <td className="py-3.5 px-4">
                        {c.hospitalNotified ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" />
                              Njoftuar
                            </span>
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[130px]" title={c.hospitalTarget || assignedHospital.name}>
                              {c.hospitalTarget || assignedHospital.name}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                              Në pritje
                            </span>
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[130px]">
                              {assignedHospital.name}
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenInspect(c)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition"
                            title="Inspekto Dosjen e Plotë Mjekësore"
                          >
                            <FileText className="w-3 h-3 text-rose-500" />
                            <span>Dosja</span>
                          </button>

                          <button
                            onClick={() => handleOpenNotifyModal(c)}
                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1 shadow-xs transition active:scale-95"
                            title="Njofto Spitalin Rajonal ose QKMF"
                          >
                            <Send className="w-3 h-3" />
                            <span>Spitali</span>
                          </button>

                          <button
                            onClick={() => handlePrintReferral(c)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Printo Fletë-Referimin Zyrtar"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED CASE INSPECTION & DOSSIER MODAL */}
      {inspectingCase && (
        <div className="fixed inset-0 z-[9999] bg-black/60 md:backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Dosja Mjekësore Administrative</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      ID: {inspectingCase.id}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Inspektimi dhe menaxhimi i pacientit në Regjistrin Qendror
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectingCase(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Status Bar */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Statusi i Rastit:</span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  inspectingCase.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                  inspectingCase.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                  inspectingCase.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {inspectingCase.status === 'verified' ? 'E Verifikuar' :
                   inspectingCase.status === 'pending' ? 'Në Shqyrtim' :
                   inspectingCase.status === 'rejected' ? 'E Refuzuar' : 'E Trajtuar'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {!inspectingCase.id.startsWith('hc-') && (
                  <DecisionBar
                    kind="health"
                    id={inspectingCase.id}
                    doc={inspectingCase as any}
                    onDecided={state => applyDecidedStatus(inspectingCase.id, state)}
                  />
                )}

                {/*
                  The anonymity workflow. A health administrator reviews the
                  real identity first — that is the only way to confirm the case
                  is genuine — and then redacts it with one click. The button is
                  hidden once the case is already anonymous, so it can never be
                  pressed twice and quietly "re-anonymize" a case whose
                  identity was deliberately published with consent.
                */}
                <button
                  type="button"
                  onClick={() => handleAnonymizeCase(inspectingCase)}
                  disabled={inspectingCase.isAnonymous}
                  title={inspectingCase.isAnonymous
                    ? 'Ky rast është anonim'
                    : 'Fshih identitetin nga pamja publike'}
                  className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {inspectingCase.isAnonymous ? 'Anonim' : 'Kthe në anonim'}
                </button>
              </div>
            </div>

            {/* Content or Edit Form */}
            {isEditingCase ? (
              <form onSubmit={handleSaveCaseEdits} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Emri i Plotë</label>
                    <input
                      type="text"
                      value={editFormData.fullName || ''}
                      onChange={e => setEditFormData({ ...editFormData, fullName: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Telefoni i Kontaktit</label>
                    <input
                      type="text"
                      value={editFormData.contactPhone || ''}
                      onChange={e => setEditFormData({ ...editFormData, contactPhone: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Komuna</label>
                    <select
                      value={editFormData.municipality || ''}
                      onChange={e => setEditFormData({ ...editFormData, municipality: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                    >
                      {KOSOVO_MUNICIPALITIES.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Niveli i Urgjencës</label>
                    <select
                      value={editFormData.urgency || ''}
                      onChange={e => setEditFormData({ ...editFormData, urgency: e.target.value as any })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                    >
                      <option value="Urgjente">Urgjente</option>
                      <option value="Mesatare">Mesatare</option>
                      <option value="Kronike e Stabilizuar">Kronike e Stabilizuar</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Diagnoza Mjekësore</label>
                    <input
                      type="text"
                      value={editFormData.diagnosis || ''}
                      onChange={e => setEditFormData({ ...editFormData, diagnosis: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Përshkrimi i Epikrizës & Gjendjes</label>
                    <textarea
                      rows={3}
                      value={editFormData.description || ''}
                      onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Fondi i Nevojshëm (€)</label>
                    <input
                      type="number"
                      value={editFormData.supportAmountNeeded || 0}
                      onChange={e => setEditFormData({ ...editFormData, supportAmountNeeded: Number(e.target.value) })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Linku i GoFundMe</label>
                    <input
                      type="url"
                      value={editFormData.donationUrl || ''}
                      onChange={e => setEditFormData({ ...editFormData, donationUrl: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setIsEditingCase(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Anulo
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
                  >
                    Ruaj Ndryshimet
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">Pacienti</span>
                    <strong className="text-sm text-slate-900 dark:text-white">{inspectingCase.fullName}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">Mosha & Gjinia</span>
                    <strong className="text-sm text-slate-900 dark:text-white">{inspectingCase.age} vjeç ({inspectingCase.gender})</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">Komuna & Lagjja</span>
                    <strong className="text-sm text-slate-900 dark:text-white">{inspectingCase.municipality} - {inspectingCase.neighborhood || 'Qendër'}</strong>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2">
                  <span className="text-[11px] uppercase font-bold text-slate-400 block">Diagnoza Klinike</span>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">{inspectingCase.diagnosis}</p>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{inspectingCase.description || 'Nuk ka përshkrim të shtuar.'}</p>
                  {inspectingCase.needs && inspectingCase.needs.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-1.5">
                      {inspectingCase.needs.map((n, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[11px]">
                          • {n}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hospital info bar */}
                <div className="p-3.5 border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] uppercase font-bold text-blue-600 block">Spitali Përgjegjës Rajonal</span>
                    <strong className="text-xs text-slate-900 dark:text-white">
                      {getHospitalInfoForMunicipality(inspectingCase.municipality).name}
                    </strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePrintReferral(inspectingCase)}
                      className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border rounded-lg font-bold text-xs flex items-center gap-1 hover:bg-slate-50"
                    >
                      <Printer className="w-3.5 h-3.5" /> Printo Fletë-Referim
                    </button>
                    <button
                      onClick={() => {
                        setInspectingCase(null);
                        handleOpenNotifyModal(inspectingCase);
                      }}
                      className="px-3 py-1.5 bg-rose-600 text-white rounded-lg font-bold text-xs flex items-center gap-1 hover:bg-rose-700"
                    >
                      <Send className="w-3.5 h-3.5" /> Njofto Spitalin
                    </button>
                  </div>
                </div>

                {/* Footer dossier controls */}
                <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                  <button
                    onClick={() => handleDeleteCase(inspectingCase.id)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Fshi Rastin
                  </button>
                  <button
                    onClick={() => setIsEditingCase(true)}
                    className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Ndrysho të Dhënat
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NOTIFY HOSPITAL MODAL */}
      {notifyingCase && hospitalInfo && (
        <div className="fixed inset-0 z-[9999] bg-black/60 md:backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Njofto Spitalin / QKMF Përkatëse
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dërgim alarmi zyrtar për Komunën e {notifyingCase.municipality}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNotifyingCase(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hospital Contact Info Box */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  {hospitalInfo.name}
                </span>
                <span className="text-[11px] font-bold uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                  {hospitalInfo.type}
                </span>
              </div>
              <p className="text-xs text-slate-500">📍 {hospitalInfo.address}</p>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <a
                  href={`tel:${hospitalInfo.emergencyPhone}`}
                  className="flex items-center gap-2 p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-100 font-bold"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Urgjenca: {hospitalInfo.emergencyPhone}</span>
                </a>
                <a
                  href={`mailto:${hospitalInfo.email}?subject=Njoftim Urgjent Shendetesor - ${notifyingCase.municipality}&body=${encodeURIComponent(notificationNotes)}`}
                  className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 font-bold"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{hospitalInfo.email}</span>
                </a>
              </div>
            </div>

            {/* Notification Text Area */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Mesazhi Zyrtar i Njoftimit (Përmbajtja e Raportit)
              </label>
              <textarea
                rows={5}
                value={notificationNotes}
                onChange={e => setNotificationNotes(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-rose-500 resize-none font-mono"
              />
            </div>

            {/* Direct Channels */}
            <div className="flex flex-wrap gap-2 text-xs">
              <a
                href={`mailto:${hospitalInfo.email}?subject=Njoftim Zyrtar - Pacient në ${notifyingCase.municipality}&body=${encodeURIComponent(notificationNotes)}`}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5 text-blue-500" />
                <span>Hap në Email Client</span>
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(notificationNotes)}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Dërgo në WhatsApp / Ekipit</span>
              </a>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setNotifyingCase(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                Anulo
              </button>
              <button
                type="button"
                disabled={isDispatching}
                onClick={handleDispatchNotification}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/20 active:scale-95 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isDispatching ? 'Duke regjistruar...' : 'Konfirmo Njoftimin e Spitalit'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE / DOCUMENT PREVIEW MODAL */}
      {previewImage && (
        <div className="fixed inset-0 z-[9999] bg-black/80 md:backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-4 overflow-hidden border border-slate-200 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {previewImage.title}
              </p>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-100 dark:border-white/5 flex items-center justify-center bg-slate-950">
              {previewImage.documentType === 'pdf'
                ? <iframe title={previewImage.title} src={previewImage.url} className="h-[68vh] w-full bg-white" />
                : <img src={previewImage.url} alt="" className="max-h-[68vh] object-contain w-auto" />}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Hap në madhësi të plotë</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* GOFUNDME ADMIN EDIT MODAL */}
      {adminGoFundMeCase && (
        <div className="fixed inset-0 z-[9999] bg-black/60 md:backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Heart className="w-5 h-5 fill-emerald-500/20" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Menaxho Linkun e GoFundMe
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pacienti: {adminGoFundMeCase.fullName} • Komuna e {adminGoFundMeCase.municipality}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdminGoFundMeCase(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdminGoFundMe} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Linku i GoFundMe / Donacionit
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={adminGoFundMeUrl}
                    onChange={e => setAdminGoFundMeUrl(e.target.value)}
                    placeholder="https://www.gofundme.com/f/emri-i-fushatës..."
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-medium"
                  />
                  <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Shembull: https://www.gofundme.com/f/ndihme-per-sherim
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-end gap-2.5">
                {adminGoFundMeCase.donationUrl && (
                  <button
                    type="button"
                    onClick={() => setAdminGoFundMeUrl('')}
                    className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors mr-auto"
                  >
                    Pastro Linkun
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAdminGoFundMeCase(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Anulo
                </button>
                <button
                  type="submit"
                  disabled={isAdminSavingGoFundMe}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  <Heart className="w-3.5 h-3.5 fill-white" />
                  <span>{isAdminSavingGoFundMe ? 'Duke ruajtur...' : 'Ruaj Ndryshimet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

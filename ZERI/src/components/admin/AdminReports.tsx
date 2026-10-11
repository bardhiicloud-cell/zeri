import { dt } from '@/src/lib/dt';
import React, { useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { Download, Search, Trash2, CheckCircle2, FileText, Calendar, Filter, X, ChevronLeft, ChevronRight, CheckSquare, Square, Edit, MapPin, LayoutGrid, List, Cpu, Mail, ContactRound, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import ReportDetailModal from '../ReportDetailModal.tsx';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../lib/LanguageContext';
import { getAccountabilityProfile, getAccountabilityDueDate } from '../../lib/accountability';
import { db } from '../../lib/firebase';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, writeBatch, limit } from 'firebase/firestore';
import { getReportTopic, getReportTopicLabel, getReportTopicValueLabel, REPORT_TOPICS } from '../../lib/reportTopics';
import { STAFF_LIMITS } from '../../lib/loadLimits';
import toast from 'react-hot-toast';

interface ReportRoutingContact {
  id: string;
  name: string;
  role: string;
  email: string;
  municipality: string;
  institution: string;
  sourceUrl: string;
}

const normalizeContactKey = (value: string) =>
  value.trim().toLocaleLowerCase('sq-AL').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const contactDocumentId = (municipality: string, institution: string) =>
  `${normalizeContactKey(municipality)}-${normalizeContactKey(institution)}`
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index++;
      row.push(field.trim());
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error('CSV ka thonjëza të pambyllur.');
  if (field.length || row.length) {
    row.push(field.trim());
    if (row.some(value => value.length > 0)) rows.push(row);
  }
  return rows;
}

export default function AdminReports({ department }: { department?: 'infrastrukture' | 'tjera' }) {
  const { dt } = useLanguage();
  const reports = useStore(state => state.reports);
  const isOverdueReport = (report: (typeof reports)[number]) => {
    const responseHours = getAccountabilityProfile(report.category).responseHours;
    const dueDate = getAccountabilityDueDate(report.createdAt, responseHours);
    return !['Resolved', 'Rejected'].includes(report.status) && new Date(dueDate).getTime() < Date.now();
  };
  const deleteReport = useStore(state => state.deleteReport);
  const updateReportStatus = useStore(state => state.updateReportStatus);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMunicipality, setSelectedMunicipality] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [routingContacts, setRoutingContacts] = useState<ReportRoutingContact[]>([]);
  const [isContactDirectoryOpen, setIsContactDirectoryOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '', role: '', email: '', municipality: '', institution: '', sourceUrl: '',
  });
  
  // View Toggle
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');

  // Pagination & Multi-select
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 8; // keeping it low for nice list, but board will show more or scroll

  // AI Summary states
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  React.useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'reportRoutingContacts'), limit(STAFF_LIMITS.routingContacts)),
      snapshot => setRoutingContacts(snapshot.docs.map(contact => ({
        id: contact.id,
        ...contact.data(),
      })) as ReportRoutingContact[]),
      error => {
        console.error('Nuk u ngarkua drejtoria e kontakteve të raportimit:', error);
        toast.error(dt('Drejtoria e kontakteve nuk u ngarkua. Kontrolloni lejet e Firestore.'));
      }
    );
    return unsubscribe;
  }, []);

  const handleGetSummary = async () => {
    const reportsToSummarize = selectedIds.size > 0 
      ? filteredReports.filter(r => selectedIds.has(r.id))
      : filteredReports;

    if (reportsToSummarize.length === 0) {
      alert("Nuk ka raporte të zgjedhura apo të filtruara për të krijuar përmbledhje.");
      return;
    }

    setLoadingSummary(true);
    setIsSummaryModalOpen(true);
    setAiSummary(null);

    try {
      const res = await fetch('/api/admin/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports: reportsToSummarize })
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setAiSummary(data.summary);
      } else {
        setAiSummary(`Gabim: ${data.error || "Dështoi gjenerimi i përmbledhjes."}`);
      }
    } catch (e) {
      console.error(e);
      setAiSummary("Gabim gjatë kontaktit me serverin për gjenerimin e përmbledhjes me AI.");
    } finally {
      setLoadingSummary(false);
    }
  };

  const reportsInScope = useMemo(() => reports.filter(r => {
    if (!department) return true;
    const cat = r.category || '';
    const infra = ['infrastrukturë', 'urbanizëm', 'ambient', 'infrastrukturë rrugore'];
    const isInfra = infra.some(i => cat.toLowerCase().includes(i));
    if (department === 'infrastrukture') return isInfra;
    return !isInfra;
  }), [reports, department]);

  let filteredReports = reportsInScope;

  const now = new Date();
  if (timeFilter !== 'all') {
    filteredReports = filteredReports.filter(r => {
      const reportDate = new Date(r.createdAt);
      if (timeFilter === 'daily') {
        return reportDate.toDateString() === now.toDateString();
      } else if (timeFilter === 'weekly') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return reportDate >= oneWeekAgo;
      } else if (timeFilter === 'monthly') {
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        return reportDate >= oneMonthAgo;
      }
      return true;
    });
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredReports = filteredReports.filter(r => 
      r.title?.toLocaleLowerCase('sq-AL').includes(q) ||
      r.description?.toLocaleLowerCase('sq-AL').includes(q) ||
      r.id?.toLocaleLowerCase('sq-AL').includes(q) ||
      r.location?.address?.toLocaleLowerCase('sq-AL').includes(q) ||
      r.category?.toLocaleLowerCase('sq-AL').includes(q) ||
      getReportTopicLabel(r).toLocaleLowerCase('sq-AL').includes(q) ||
      (getReportTopic(r)?.keywords.some(keyword => keyword.includes(q) || q.includes(keyword)) ?? false) ||
      r.responsibleInstitution?.toLocaleLowerCase('sq-AL').includes(q)
    );
  }
  if (selectedTopic) filteredReports = filteredReports.filter(report => getReportTopic(report)?.id === selectedTopic);
  if (selectedMunicipality) {
    filteredReports = filteredReports.filter(r => r.location?.municipality === selectedMunicipality);
  }
  if (selectedStatus === 'unapproved') {
    filteredReports = filteredReports.filter(r => r.status === 'Pending Review');
  } else if (selectedStatus === 'in-progress') {
    filteredReports = filteredReports.filter(r => ['Approved', 'Assigned', 'In Progress'].includes(r.status));
  } else if (selectedStatus === 'unresolved') {
    filteredReports = filteredReports.filter(r => !['Resolved', 'Rejected'].includes(r.status));
  } else if (selectedStatus === 'resolved') {
    filteredReports = filteredReports.filter(r => r.status === 'Resolved');
  } else if (selectedStatus === 'rejected') {
    filteredReports = filteredReports.filter(r => r.status === 'Rejected');
  } else if (selectedStatus === 'overdue') {
    filteredReports = filteredReports.filter(isOverdueReport);
  } else if (selectedStatus) {
    filteredReports = filteredReports.filter(r => r.status === selectedStatus);
  }

  // Status totals stay stable while search and table filters change.
  const stats = useMemo(() => {
    const overdue = reportsInScope.filter(isOverdueReport);
    return {
      total: reportsInScope.length,
      unapproved: reportsInScope.filter(r => r.status === 'Pending Review').length,
      inProgress: reportsInScope.filter(r => ['In Progress', 'Assigned', 'Approved'].includes(r.status)).length,
      unresolved: reportsInScope.filter(r => !['Resolved', 'Rejected'].includes(r.status)).length,
      resolved: reportsInScope.filter(r => r.status === 'Resolved').length,
      rejected: reportsInScope.filter(r => r.status === 'Rejected').length,
      overdue: overdue.length,
    };
  }, [reportsInScope]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const paginatedReports = filteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedReports.length && paginatedReports.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedReports.map(r => r.id)));
    }
  };

  const toggleSelectBlock = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  /**
   * Bulk actions run each transition through the server, so a refusal on one
   * report (wrong stage, missing note) does not stop the rest — and the operator
   * is told which ones the pipeline declined.
   */
  const handleBulkAction = async (action: 'approve' | 'resolve' | 'delete') => {
    if (!window.confirm(`A jeni të sigurt që dëshironi të kryeni këtë veprim për ${selectedIds.size} dosje?`)) return;

    const refused: string[] = [];
    for (const id of selectedIds) {
      try {
        if (action === 'delete') {
          await deleteReport(id);
        } else if (action === 'approve') {
          await updateReportStatus(id, 'Approved', 'Aprovuar masivisht.');
        } else if (action === 'resolve') {
          await updateReportStatus(id, 'Resolved', 'Zgjidhur masivisht.');
        }
      } catch (error) {
        refused.push(`${id}: ${(error as Error)?.message ?? 'refuzuar'}`);
      }
    }
    setSelectedIds(new Set());
    if (refused.length > 0) {
      alert(`Disa dosje nuk u ndryshuan nga rrjedha e aprovimit:\n${refused.join('\n')}`);
    }
  };

  const handleStatusChange = async (id: string, newStatus: any) => {
    try {
      await updateReportStatus(id, newStatus, `Statusi u ndryshua në ${newStatus}`);
    } catch (error) {
      alert((error as Error)?.message || 'Statusi nuk u ndryshua.');
    }
  };

  const getMatchingContact = (report: (typeof reports)[number]) => {
    const institution = report.responsibleInstitution || getAccountabilityProfile(report.category).institution;
    return routingContacts.find(contact =>
      normalizeContactKey(contact.municipality) === normalizeContactKey(report.location?.municipality || '') &&
      normalizeContactKey(contact.institution) === normalizeContactKey(institution)
    ) || (report.responsibleLevel === 'Qendrore' ? routingContacts.find(contact =>
      normalizeContactKey(contact.municipality) === normalizeContactKey('Kosovë') &&
      normalizeContactKey(contact.institution) === normalizeContactKey(institution)
    ) : undefined);
  };

  const handleAddContact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const source = (() => {
      try { return new URL(newContact.sourceUrl); } catch { return null; }
    })();
    if (!source || !['http:', 'https:'].includes(source.protocol)) {
      toast.error(dt('Shtoni lidhjen publike ku verifikohet ky kontakt.'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newContact.email.trim())) {
      toast.error('Adresa e emailit nuk duket e vlefshme.');
      return;
    }
    try {
      await setDoc(doc(db, 'reportRoutingContacts', contactDocumentId(newContact.municipality, newContact.institution)), {
        ...newContact,
        email: newContact.email.trim(),
        createdAt: new Date().toISOString(),
      });
      setNewContact({ name: '', role: '', email: '', municipality: '', institution: '', sourceUrl: '' });
      toast.success(dt('Kontakti u ruajt në drejtorinë e adminit.'));
    } catch (error) {
      console.error('Nuk u ruajt kontakti:', error);
      toast.error(dt('Kontakti nuk u ruajt. Kontrolloni lejet e adminit.'));
    }
  };

  const handleImportContacts = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ''));
      const expectedHeaders = ['name', 'role', 'email', 'municipality', 'institution', 'sourceurl'];
      const actualHeaders = rows[0]?.map(value => value.trim().toLowerCase());
      if (!actualHeaders || expectedHeaders.some((header, index) => actualHeaders[index] !== header)) {
        throw new Error('Kolonat duhet të jenë në këtë renditje: name, role, email, municipality, institution, sourceUrl.');
      }
      if (rows.length < 2) throw new Error('CSV nuk përmban kontakte për import.');
      const contacts = rows.slice(1).map((values, index) => {
        if (values.length !== expectedHeaders.length) throw new Error(`Rreshti ${index + 2}: priten 6 kolona.`);
        const [name, role, email, municipality, institution, sourceUrl] = values;
        let parsedSource: URL;
        try { parsedSource = new URL(sourceUrl); } catch { throw new Error(`Rreshti ${index + 2}: burimi nuk është URL e vlefshme.`); }
        if (!name || !role || !municipality || !institution || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error(`Rreshti ${index + 2}: plotësoni emrin, rolin, emailin, komunën dhe institucionin.`);
        }
        if (!['http:', 'https:'].includes(parsedSource.protocol)) throw new Error(`Rreshti ${index + 2}: burimi duhet të jetë http/https.`);
        return { name, role, email, municipality, institution, sourceUrl, createdAt: new Date().toISOString() };
      });
      for (let offset = 0; offset < contacts.length; offset += 400) {
        const batch = writeBatch(db);
        contacts.slice(offset, offset + 400).forEach(contact => {
          batch.set(
            doc(db, 'reportRoutingContacts', contactDocumentId(contact.municipality, contact.institution)),
            contact
          );
        });
        await batch.commit();
      }
      toast.success(`${contacts.length} ${dt('kontakte u importuan / përditësuan.')}`);
    } catch (error) {
      console.error('Importi i kontakteve dështoi:', error);
      toast.error(error instanceof Error ? error.message : 'Importi i kontakteve dështoi.');
    }
  };

  const downloadContactTemplate = () => {
    const template = 'name,role,email,municipality,institution,sourceUrl\n"Emri Mbiemri","Drejtor i Departamentit","email@example.org","Prishtinë","Institucioni / Drejtoria","https://example.org/contact"\n';
    const url = URL.createObjectURL(new Blob([template], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kontaktet-pergjegjese-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteContact = async (contact: ReportRoutingContact) => {
    if (!window.confirm(`${dt('Të fshihet kontakti')} ${contact.name} (${contact.email})?`)) return;
    try {
      await deleteDoc(doc(db, 'reportRoutingContacts', contact.id));
      toast.success('Kontakti u fshi.');
    } catch (error) {
      console.error('Nuk u fshi kontakti:', error);
      toast.error('Kontakti nuk u fshi.');
    }
  };

  const handleEmailReport = (report: (typeof reports)[number]) => {
    const contact = getMatchingContact(report);
    if (!contact) {
      setNewContact(current => ({
        ...current,
        municipality: report.responsibleLevel === 'Qendrore' ? 'Kosovë' : report.location?.municipality || '',
        institution: report.responsibleInstitution || getAccountabilityProfile(report.category).institution,
      }));
      setIsContactDirectoryOpen(true);
      toast.error(dt('Nuk ka ende kontakt të verifikuar për këtë komunë dhe institucion.'));
      return;
    }
    const subject = `Raportim qytetar: ${report.title}`;
    const reportUrl = `${window.location.origin}/detailed-registry?report=${encodeURIComponent(report.id)}`;
    const body = [
      `I/e nderuar ${contact.name},`,
      '',
      'Po ju përcjellim raportimin qytetar për trajtim sipas kompetencës suaj.',
      `Titulli: ${report.title}`,
      `Tema: ${getReportTopicLabel(report)}`,
      `Institucioni përgjegjës: ${contact.institution}`,
      `Komuna: ${report.location?.municipality || 'Pa komunë'}`,
      `Adresa: ${report.location?.address || 'Pa adresë'}`,
      `Urgjenca: ${report.urgency}`,
      `Statusi: ${report.status}`,
      `Numri përcjellës: ${report.trackingId || report.id}`,
      `Afati i përgjigjes: ${report.responseDueAt || 'Nuk është caktuar'}`,
      '',
      'Përshkrimi:',
      report.description || 'Nuk ka përshkrim.',
      '',
      'Fotot / videot:',
      ...((report.media?.length ? report.media.map(item => item.url) : report.images || []).slice(0, 5).map((url, index) => `${index + 1}. ${url}`)),
      '',
      `Shiko raportimin në platformë: ${reportUrl}`,
      '',
      'Me respekt,',
      'Zëri i Qytetarëve',
    ].join('\n');
    window.location.href = `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleDownload = (format: 'html' | 'csv' | 'pdf') => {
    if (format === 'csv') {
      const headers = ['ID', 'Titulli', 'Përshkrimi', 'Statusi', 'Tema', 'Sektori / institucioni', 'Urgjenca', 'Data e Raportimit', 'Komuna', 'Adresa', 'Lat', 'Lng', 'Raportuesi'];
      
      const csvRows = [headers.join(',')];
      
      filteredReports.forEach(r => {
        const row = [
          r.id,
          `"${r.title.replace(/"/g, '""')}"`,
          `"${r.description.replace(/"/g, '""')}"`,
          r.status,
          getReportTopicLabel(r),
          r.category,
          r.urgency,
          new Date(r.createdAt).toISOString(),
          r.location?.municipality || 'N/A',
          `"${(r.location?.address || '').replace(/"/g, '""')}"`,
          r.location?.lat || 0,
          r.location?.lng || 0,
          `"${r.isAnonymous ? 'Anonim' : (r.authorName || 'N/A')}"`
        ];
        csvRows.push(row.join(','));
      });
      
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Raportet_${selectedMunicipality || 'Gjitha'}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const groupedReports = filteredReports.reduce((acc, report) => {
      const topic = getReportTopicLabel(report);
      if (!acc[topic]) acc[topic] = [];
      acc[topic].push(report);
      return acc;
    }, {} as Record<string, typeof filteredReports>);

    let htmlContent = `
    <!DOCTYPE html>
    <html lang="sq">
    <head>
      <meta charset="UTF-8">
      <title>Dosja Zyrtare e Raporteve</title>
      <style>
        body { font-family: 'Inter', system-ui, sans-serif; margin: 40px; color: #111; line-height: 1.5; background: #fff; }
        .header { border-bottom: 4px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #0f172a; text-transform: uppercase; margin: 0 0 10px 0; font-size: 28px; font-weight: 900; letter-spacing: 1px; }
        .header p { margin: 0; color: #555; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        h2 { color: #e11d48; margin-top: 50px; border-bottom: 2px solid #eee; padding-bottom: 10px; text-transform: uppercase; font-size: 20px; font-weight: 900; letter-spacing: 1px; }
        .report-card { border: 2px solid #0f172a; padding: 24px; margin-bottom: 24px; page-break-inside: avoid; background: #fdfdfd; box-shadow: 6px 6px 0px #0f172a; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { text-align: left; padding: 8px 4px; border-bottom: 1px solid #e5e5e5; font-size: 13px; }
        th { width: 140px; font-weight: 800; text-transform: uppercase; color: #666; letter-spacing: 0.5px; }
        .status { padding: 4px 10px; font-weight: 900; text-transform: uppercase; font-size: 11px; background: #0f172a; color: white; display: inline-block; letter-spacing: 1px; margin-top: 8px; }
        .images { margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap; }
        .images img { max-width: 300px; max-height: 250px; border: 2px solid #0f172a; object-fit: cover; }
        .desc-title { font-weight: 900; text-transform: uppercase; font-size: 14px; margin-bottom: 5px; color: #0f172a; letter-spacing: 0.5px; margin-top: 20px; }
        .desc-content { font-size: 14px; color: #333; margin: 0; white-space: pre-wrap; }
        @media print {
          body { margin: 0; }
          .report-card { border: 2px solid #000; box-shadow: none; margin-bottom: 30px; }
          .header, h2 { break-before: auto; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Raportet dhe Aprovimet Qytetare</h1>
        <p>Gjeneruar më: ${new Date().toLocaleString('sq-AL')} | Lokalizimi: ${selectedMunicipality || 'E Tërë Kosova'}</p>
        <p>Të filtruara për kohën: ${timeFilter === 'daily' ? 'Ditore' : timeFilter === 'weekly' ? 'Javore' : timeFilter === 'monthly' ? 'Mujore' : 'Të Gjitha'}</p>
      </div>
    `;

    for (const [organ, reportsGroup] of Object.entries(groupedReports)) {
      htmlContent += `<h2>Kategoria tematike: ${organ.toUpperCase()}</h2>`;
      htmlContent += `<p style="font-weight: bold; font-size: 14px; text-transform: uppercase;">Totali i raporteve: <span style="background: #0f172a; color: white; padding: 2px 8px; border-radius: 12px;">${reportsGroup.length}</span></p>`;
      
      reportsGroup.forEach(r => {
        htmlContent += `
        <div class="report-card">
          <div class="grid">
            <div>
              <h3 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase;">Referenca: ${r.id}</h3>
              <h4 style="margin: 5px 0 0 0; font-size: 16px; font-weight: 600; color: #e11d48; text-transform: uppercase;">${r.title}</h4>
              <span class="status">${r.status}</span>
              <table>
                <tr><th>Tema</th><td><strong>${getReportTopicLabel(r)}</strong></td></tr>
                <tr><th>Sektori / institucioni</th><td>${r.category}</td></tr>
                <tr><th>Urgjenca</th><td>${r.urgency}</td></tr>
                <tr><th>Data e Hapjes</th><td>${new Date(r.createdAt).toLocaleString('sq-AL')}</td></tr>
                <tr><th>Raportuesi</th><td>${r.isAnonymous ? 'Anonim (Mbrojtur)' : r.authorName}</td></tr>
              </table>
            </div>
            <div>
              <div class="desc-title">Të Dhënat Gjeografike</div>
              <table>
                <tr><th>Komuna</th><td>${r.location?.municipality || 'N/A'}</td></tr>
                <tr><th>Adresa</th><td>${r.location?.address || 'N/A'}</td></tr>
              </table>
              <div class="desc-title">Përshkrimi</div>
              <p class="desc-content">${r.description}</p>
            </div>
          </div>
        </div>
        `;
      });
    }

    htmlContent += `
    </body>
    </html>
    `;

    if (format === 'pdf') {
      const printWindow = window.open('', '', 'width=800,height=600');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
      return;
    }

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Raportet.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Resolved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Pending Review': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'In Progress':
      case 'Assigned':
      case 'Approved': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Rejected': return 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/10';
      default: return 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/10';
    }
  };

  // Organize by columns for Board view
  const columns = [
    { id: 'Pending Review', title: 'Në Pritje' },
    { id: 'Approved', title: 'Aprovuar / Hapur' },
    { id: 'In Progress', title: 'Në Analizë' },
    { id: 'Resolved', title: 'Të Zgjidhura' }
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm dark:border-indigo-400/20 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200"><ContactRound className="h-5 w-5" /></span>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">{dt('Kontaktet dhe dërgimi i raportimeve')}</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {dt('Draft-emaili hapet vetëm kur ka kontakt që përputhet saktësisht me komunën dhe institucionin përgjegjës. Shtoni vetëm email publik profesional dhe burim zyrtar verifikimi.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsContactDirectoryOpen(open => !open)}
            aria-expanded={isContactDirectoryOpen}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 px-4 text-xs font-black text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-400/30 dark:text-indigo-200 dark:hover:bg-indigo-400/10"
          >
            <ContactRound className="h-4 w-4" />
            {isContactDirectoryOpen ? dt('Mbyll drejtorinë') : `${dt('Drejtoria')} (${routingContacts.length})`}
          </button>
        </div>
        {isContactDirectoryOpen && (
          <div className="grid gap-5 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <form onSubmit={handleAddContact} className="grid content-start gap-3 sm:grid-cols-2">
              <p className="text-xs font-black text-slate-800 dark:text-slate-100 sm:col-span-2">{dt('Shto kontakt publik të përgjegjësit')}</p>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button type="button" onClick={downloadContactTemplate} className="min-h-9 rounded-lg border border-slate-200 px-3 text-[10px] font-black text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800">{dt('Shkarko formatin CSV')}</button>
                <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-indigo-200 px-3 text-[10px] font-black text-indigo-700 hover:bg-indigo-50 dark:border-indigo-400/20 dark:text-indigo-200 dark:hover:bg-indigo-400/10">
                  <Plus className="h-3.5 w-3.5" /> {dt('Importo listë CSV')}
                  <input type="file" accept=".csv,text/csv" onChange={event => void handleImportContacts(event)} className="sr-only" />
                </label>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 sm:col-span-2">CSV: name, role, email, municipality, institution, sourceUrl. Importi bën përditësim sipas çiftit komunë + institucion.</p>
              {([
                ['name', 'Emri i zyrtarit'],
                ['role', 'Roli / pozita'],
                ['email', 'Email profesional publik'],
                ['institution', 'Institucioni përgjegjës'],
                ['municipality', 'Komuna (ose Kosovë për nivel qendror)'],
                ['sourceUrl', 'Lidhje zyrtare verifikimi'],
              ] as const).map(([field, label]) => (
                <label key={field} className={`block ${field === 'sourceUrl' ? 'sm:col-span-2' : ''}`}>
                  <span className="mb-1 block text-[10px] font-bold text-slate-500 dark:text-slate-400">{dt(label)}</span>
                  <input
                    required
                    type={field === 'email' ? 'email' : field === 'sourceUrl' ? 'url' : 'text'}
                    value={newContact[field]}
                    onChange={event => setNewContact(current => ({ ...current, [field]: event.target.value }))}
                    placeholder={field === 'sourceUrl' ? 'https://...' : ''}
                    className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                  />
                </label>
              ))}
              <button type="submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-black text-white hover:bg-indigo-700 sm:col-span-2">
                <Plus className="h-4 w-4" /> {dt('Ruaj kontaktin e verifikuar')}
              </button>
            </form>
            <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <p className="mb-2 text-xs font-black text-slate-800 dark:text-slate-100">{dt('Kontaktet e regjistruara')}</p>
              {routingContacts.length === 0 ? (
                <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">
                  {dt('Drejtoria është bosh. Shtoni kontaktet dhe burimet e tyre zyrtare këtu; aplikacioni nuk shpik ose supozon emaila.')}
                </p>
              ) : routingContacts.map(contact => (
                <article key={contact.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3 dark:border-white/10">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-slate-900 dark:text-white">{contact.name} <span className="font-medium text-slate-500">· {contact.role}</span></p>
                    <p className="mt-1 break-all text-xs font-semibold text-indigo-700 dark:text-indigo-200">{contact.email}</p>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{contact.municipality} · {contact.institution}</p>
                    <a href={contact.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] font-bold text-blue-700 underline dark:text-blue-300">{dt('Burimi i verifikimit')}</a>
                  </div>
                  <button type="button" onClick={() => void handleDeleteContact(contact)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-400/10" aria-label={`Fshi kontaktin ${contact.name}`}><Trash2 className="h-4 w-4" /></button>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {[
          { label: 'Të gjitha', value: stats.total, filter: '', color: 'text-slate-900 dark:text-white', bg: 'bg-white dark:bg-slate-900', border: 'border-slate-200/60 dark:border-white/10' },
          { label: 'Pa u aprovuar', value: stats.unapproved, filter: 'unapproved', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-900' },
          { label: 'Në proces', value: stats.inProgress, filter: 'in-progress', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-900' },
          { label: 'Të pazgjidhura', value: stats.unresolved, filter: 'unresolved', color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-900' },
          { label: 'Të zgjidhura', value: stats.resolved, filter: 'resolved', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-900' },
          { label: 'Të refuzuara', value: stats.rejected, filter: 'rejected', color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-white/10' },
          { label: 'Mbi afat', value: stats.overdue, filter: 'overdue', color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-900' }
        ].map(stat => (
          <button type="button" key={stat.label} onClick={() => setSelectedStatus(stat.filter)} aria-pressed={selectedStatus === stat.filter} className={cn("p-4 rounded-xl border flex flex-col justify-center text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:shadow-none", stat.bg, stat.border, selectedStatus === stat.filter && "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-950")}>
            <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-widest">{stat.label}</div>
            <div className={cn("text-3xl font-bold title-serif mt-1", stat.color)}>{stat.value}</div>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl shadow-sm dark:shadow-none hover:shadow transition-all duration-300 flex flex-col max-w-full mx-auto w-full mb-6">
        <div className="p-4 md:p-6 border-b border-slate-100 dark:border-white/5 flex flex-col xl:flex-row items-center justify-between gap-4 md:gap-6 bg-white dark:bg-slate-900 rounded-t-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-wrap items-center gap-3 md:gap-4 w-full xl:w-auto">
          <div className="relative col-span-1 sm:col-span-2 lg:col-span-1 xl:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-900 dark:text-white" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={dt(`KËRKO DOSJE...`)} 
              className="w-full pl-10 md:pl-12 pr-4 py-2.5 md:py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 focus:bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-bold tracking-wide focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-300 ease-in-out placeholder:text-neutral-500 dark:text-slate-400" 
            />
          </div>
          <select 
            value={selectedMunicipality} 
            onChange={(e) => setSelectedMunicipality(e.target.value)}
            className="py-2.5 md:py-3 px-3 md:px-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 focus:bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-bold tracking-wide focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-300 ease-in-out"
          >
            <option value="">{dt(`LOKALITETI`)}</option>
            {KOSOVO_MUNICIPALITIES.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select 
            value={selectedStatus} 
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="col-span-1 py-2.5 md:py-3 px-3 md:px-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 focus:bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-bold tracking-wide focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-300 ease-in-out"
          >
            <option value="">{dt(`TË GJITHA STATUSET`)}</option>
            <option value="unapproved">{dt(`PA U APROVUAR`)}</option>
            <option value="unresolved">{dt(`TË PAZGJIDHURA`)}</option>
            <option value="in-progress">{dt(`NË PROCES`)}</option>
            <option value="resolved">{dt(`TË ZGJIDHURA`)}</option>
            <option value="rejected">{dt(`TË REFUZUARA`)}</option>
            <option value="overdue">{dt(`MBI AFAT`)}</option>
            <option value="Approved">{dt(`E HAPUR / APROVUAR`)}</option>
            <option value="Assigned">{dt(`E CAKTUAAR`)}</option>
            <option value="In Progress">{dt(`NË ANALIZË`)}</option>
          </select>
          <select
            value={selectedTopic}
            onChange={event => { setSelectedTopic(event.target.value); setCurrentPage(1); }}
            aria-label={dt('Filtro sipas temës')}
            className="col-span-1 py-2.5 md:py-3 px-3 md:px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-bold tracking-wide focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">{dt('TË GJITHA TEMAT')}</option>
            {REPORT_TOPICS.map(topic => <option key={topic.id} value={topic.id}>{topic.icon} {getReportTopicValueLabel(topic.id)}</option>)}
          </select>
          <select 
            value={timeFilter} 
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="col-span-1 lg:col-span-1 xl:w-48 py-2.5 md:py-3 px-3 md:px-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 focus:bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl text-xs font-bold tracking-wide focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors duration-300 ease-in-out"
          >
            <option value="all">{dt(`E GJITHË KOHA`)}</option>
            <option value="daily">{dt(`DITORE`)}</option>
            <option value="weekly">{dt(`JAVORE`)}</option>
            <option value="monthly">{dt(`MUJORE`)}</option>
          </select>
        </div>
        <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto pb-1 xl:pb-0">
          
          <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl mr-2">
            <button 
              onClick={() => setViewMode('list')} 
              className={cn("p-2 rounded-2xl flex items-center justify-center transition-colors", viewMode === 'list' ? "bg-white dark:bg-slate-900 shadow-sm dark:shadow-none text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-500 dark:text-slate-400")}
              title={dt(`Pamja Tabelare`)}
            >
              <List className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('board')} 
              className={cn("p-2 rounded-2xl flex items-center justify-center transition-colors", viewMode === 'board' ? "bg-white dark:bg-slate-900 shadow-sm dark:shadow-none text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-500 dark:text-slate-400")}
              title={dt(`Pamja Kanban (Bordi)`)}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {selectedIds.size > 0 ? (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 bg-slate-900 px-2 py-1.5 rounded-xl shadow-sm dark:shadow-none border border-slate-800"
            >
              <span className="text-white text-xs font-bold px-2 whitespace-nowrap">{selectedIds.size}{dt(`zgjedhur`)}</span>
              <button onClick={() => handleBulkAction('approve')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-colors">{dt(`Aprovo`)}</button>
              <button onClick={() => handleBulkAction('resolve')} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold transition-colors">{dt(`Zgjidh`)}</button>
              <button onClick={handleGetSummary} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shadow-indigo-600/25">
                <Cpu className="w-3.5 h-3.5" />{dt(`Përmbledh me AI`)}
              </button>
              <button onClick={() => handleBulkAction('delete')} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </motion.div>
          ) : (
            <>
              <button 
                onClick={handleGetSummary}
                className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold tracking-wide text-[10px] xl:text-xs transition-all duration-300 rounded-xl border border-slate-950 flex items-center justify-center gap-1.5 shadow-sm dark:shadow-none shadow-slate-900/10"
                title={dt(`Gjenero Përmbledhje Ekzekutive me AI`)}
              >
                <Cpu className="w-4 h-4 text-rose-500 animate-pulse" />{dt(`Përmbledh me AI`)}
              </button>
              <button 
                onClick={() => handleDownload('html')}
                className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold tracking-wide text-[10px] xl:text-xs transition-colors rounded-xl border border-rose-200"
                title={dt(`Eksporto HTML`)}
              >
                <FileText className="w-4 h-4" />{dt(`HTML`)}
              </button>
              <button 
                onClick={() => handleDownload('pdf')}
                className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold tracking-wide text-[10px] xl:text-xs transition-colors rounded-xl border border-indigo-200"
                title={dt(`Eksporto PDF`)}
              >
                <FileText className="w-4 h-4" />{dt(`PDF`)}
              </button>
              <button 
                onClick={() => handleDownload('csv')}
                className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold tracking-wide text-[10px] xl:text-xs transition-colors rounded-xl border border-emerald-200"
                title={dt(`Eksporto CSV`)}
              >
                <Download className="w-4 h-4" />{dt(`CSV`)}
              </button>
            </>
          )}
        </div>
      </div>
      
      {viewMode === 'list' ? (
        <>
        <div className="overflow-x-auto min-h-[400px] bg-white dark:bg-slate-900 relative rounded-b-xl">
          <div className="absolute top-0 right-0 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-4 py-2 text-[10px] font-bold tracking-widest uppercase border-b border-l border-slate-100 dark:border-white/5 z-10 rounded-bl-xl hidden sm:block">
            {department === 'infrastrukture' ? 'Sektori Qendror: Infrastrukturë & Urbanizëm' : department === 'tjera' ? 'Sektori Sekondar: Tjera' : 'Gjitha Raportimet'}
          </div>
          <table className="w-full text-left text-sm whitespace-nowrap min-w-[900px]">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] tracking-widest uppercase font-bold border-b border-slate-100 dark:border-white/5">
              <tr>
                <th className="px-4 py-4 w-12 text-center">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-500 dark:text-slate-400">
                    {paginatedReports.length > 0 && selectedIds.size === paginatedReports.length ? (
                      <CheckSquare className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4">{dt(`Statusi & ID`)}</th>
                <th className="px-6 py-4">{dt(`Objekti Raportimit`)}</th>
                <th className="px-6 py-4">{dt(`Tema, sektori & urgjenca`)}</th>
                <th className="px-6 py-4">{dt(`Koha e Regjistrimit`)}</th>
                <th className="px-6 py-4 text-right">{dt(`Veprime`)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              <AnimatePresence mode="popLayout">
                {paginatedReports.map((report) => {
                  const isSelected = selectedIds.has(report.id);
                  const accountability = getAccountabilityProfile(report.category);
                  const responseDueAt = report.responseDueAt || getAccountabilityDueDate(report.createdAt, accountability.responseHours);
                  const isOverdue = report.status !== 'Resolved' && new Date(responseDueAt).getTime() < Date.now();
                  return (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={report.id} 
                      className={cn(
                        "hover:bg-slate-50 dark:bg-slate-800 transition-colors group",
                        isSelected && "bg-indigo-50/50"
                      )}
                    >
                      <td className="px-4 py-4 align-top text-center">
                        <button onClick={() => toggleSelectBlock(report.id)} className="text-slate-400 hover:text-slate-500 dark:text-slate-400">
                          {isSelected ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                        </button>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-1.5 items-start">
                          <select
                            value={report.status}
                            onChange={(e) => handleStatusChange(report.id, e.target.value)}
                            className={cn(
                              "px-2 py-1 text-[10px] uppercase font-bold tracking-widest rounded outline-none border focus:ring-2 focus:ring-indigo-500/20 cursor-pointer appearance-none transition-colors",
                              getStatusColor(report.status)
                            )}
                          >
                            <option value="Pending Review">{dt(`Në Pritje`)}</option>
                            <option value="Approved">{dt(`Aprovuar / Hapur`)}</option>
                            <option value="Assigned">{dt(`Caktuar`)}</option>
                            <option value="In Progress">{dt(`Në Analizë`)}</option>
                            <option value="Resolved">{dt(`E Përfunduar`)}</option>
                            <option value="Rejected">{dt(`E Refuzuar`)}</option>
                            <option value="Overdue">{dt(`Mbi Afat`)}</option>
                          </select>
                          <span className="font-mono text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900">{report.trackingId || `ZQ-${report.id.substring(0, 8).toUpperCase()}`}</span>
                          {report.assignedTo && <span className="text-[10px] font-bold tracking-widest text-indigo-600 truncate max-w-[120px] uppercase mt-1">{dt(`Ref:`)} {report.assignedTo}
                          </span>}
                          <span className={cn("text-[9px] font-bold truncate max-w-[180px]", isOverdue ? "text-rose-600" : "text-slate-400")}>{isOverdue ? 'Përgjegjësi e vonuar' : 'Afati'}: {new Date(responseDueAt).toLocaleDateString('sq-AL')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-start gap-3">
                          {report.images?.[0] && <img src={report.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-white/10 shrink-0" />}
                          <p className="font-bold text-slate-900 dark:text-white max-w-[250px] truncate text-sm hover:text-indigo-600 cursor-pointer transition-colors" onClick={() => setSelectedReportId(report.id)} title={report.title}>
                            {report.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-slate-500 dark:text-slate-400">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                          <p className="text-[11px] font-bold tracking-wide truncate max-w-[230px] uppercase">{report.location?.address || 'Nuk ka adresë'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-1.5">
                          <span className="w-max max-w-[220px] truncate rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200" title="Kategoria tematike">{getReportTopicLabel(report)}</span>
                          <span className="text-slate-900 dark:text-white font-bold text-xs truncate max-w-[200px]" title="Sektori / institucioni">{dt(report.category)}</span>
                          <span className="text-[10px] font-bold text-blue-600 truncate max-w-[220px]" title={report.responsibleInstitution || accountability.institution}>{report.responsibleInstitution || accountability.institution}</span>
                          <span className={cn("text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded w-max uppercase", 
                            report.urgency === 'Kritike' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 
                            report.urgency === 'E lartë' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 
                            'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-white/5')}
                          >
                            {dt(report.urgency)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium text-xs align-top">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold">{format(new Date(report.createdAt), 'dd MMM yyyy')}</span>
                        </div>
                        <div className="text-slate-400 mt-0.5 ml-5.5 text-[10px] font-bold tracking-widest">{format(new Date(report.createdAt), 'HH:mm')}</div>
                      </td>
                      <td className="px-6 py-4 text-right align-top">
                        <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleEmailReport(report)}
                            className="inline-flex min-h-8 items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 text-[10px] font-black text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200 dark:hover:bg-indigo-400/20"
                            title={getMatchingContact(report) ? `${dt('Hap draft-email për')} ${getMatchingContact(report)?.name}` : dt('Shto kontaktin për këtë komunë dhe institucion')}
                          >
                            <Mail className="h-3.5 w-3.5" /> {getMatchingContact(report) ? dt('Email') : dt('Shto kontakt')}
                          </button>
                          <button 
                            onClick={() => setSelectedReportId(report.id)}
                            className="px-4 py-1.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 hover:border-indigo-600 hover:text-indigo-600 text-slate-500 dark:text-slate-400 rounded-2xl text-xs font-bold transition-colors shadow-sm dark:shadow-none flex items-center gap-2"
                          >
                            <Edit className="w-3.5 h-3.5" />{dt(`Shiko`)}
                          </button>
                          <button 
                            onClick={() => { if(window.confirm('A jeni i sigurt?')) deleteReport(report.id); }}
                            className="p-1.5 bg-white dark:bg-slate-900 text-rose-500 hover:text-white border border-slate-200/60 dark:border-white/10 hover:bg-rose-500 hover:border-rose-500 rounded-2xl transition-colors shadow-sm dark:shadow-none"
                            title={dt(`Fshij Dosjen`)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
          {paginatedReports.length === 0 && (
            <div className="text-center py-24">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-white/5">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">{dt(`Asnjë raport nuk u gjet me këto kritere.`)}</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800 rounded-b-xl flex items-center justify-between">
            <span className="text-xs font-bold tracking-widest uppercase text-slate-400">{dt(`Duke shfaqur`)} {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredReports.length)}{dt(`nga`)} {filteredReports.length}</span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-xl hover:bg-slate-200 disabled:opacity-50 text-slate-500 dark:text-slate-400 transition-colors bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-bold text-slate-900 dark:text-white min-w-[2.5rem] text-center">{currentPage}</span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-xl hover:bg-slate-200 disabled:opacity-50 text-slate-500 dark:text-slate-400 transition-colors bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        </>
      ) : (
        /* KANBAN BOARD VIEW */
        <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl overflow-x-auto min-h-[500px]">
          <div className="flex gap-4 min-w-max pb-4 h-full items-start">
            {columns.map(col => {
              const colReports = filteredReports.filter(r => r.status === col.id);
              return (
                <div key={col.id} className="w-80 flex flex-col gap-3 h-full">
                   <div className="flex items-center justify-between mb-2 px-1">
                     <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{col.title}</h3>
                     <span className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm dark:shadow-none">{colReports.length}</span>
                   </div>
                   
                   <div className="flex flex-col gap-3 flex-1">
                     {colReports.map(report => (
                       <motion.div 
                         layoutId={`board-${report.id}`}
                         key={report.id} 
                         className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm dark:shadow-none hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-shadow border border-slate-200/60 dark:border-white/10 cursor-pointer group"
                         onClick={() => setSelectedReportId(report.id)}
                       >
                         <div className="flex justify-between items-start mb-2">
                           <span className="font-mono text-[9px] text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-white/5">#{report.id.substring(0,6)}</span>
                           <span className={cn("text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded uppercase", 
                              report.urgency === 'Kritike' ? 'bg-rose-50 text-rose-600' : 
                              report.urgency === 'E lartë' ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400')}
                            >
                              {dt(report.urgency)}
                            </span>
                         </div>
                         <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors leading-snug">{report.title}</h4>
                         <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">{dt(report.category)}</p>
                         
                         <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-50">
                           <div className="flex items-center gap-1.5 text-slate-400">
                             <Calendar className="w-3.5 h-3.5" />
                             <span className="text-[10px] font-bold tracking-widest uppercase">{format(new Date(report.createdAt), 'dd MMM')}</span>
                           </div>
                           
                           {/* Quick Action Status Change in Board */}
                           <select
                              onClick={(e) => e.stopPropagation()}
                              value={report.status}
                              onChange={(e) => handleStatusChange(report.id, e.target.value)}
                              className="px-2 py-1 text-[9px] uppercase font-bold tracking-widest rounded outline-none border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer text-slate-500 dark:text-slate-400 appearance-none transition-colors"
                            >
                              <option value="Pending Review">{dt(`Dërgo në Pritje`)}</option>
                              <option value="Approved">{dt(`Aprovo / Hapur`)}</option>
                              <option value="Assigned">{dt(`Cakto`)}</option>
                              <option value="In Progress">{dt(`Analizo`)}</option>
                              <option value="Resolved">{dt(`Përfundo`)}</option>
                              <option value="Overdue">{dt(`Shëno mbi afat`)}</option>
                            </select>
                         </div>
                       </motion.div>
                     ))}
                     {colReports.length === 0 && (
                       <div className="h-24 border-2 border-dashed border-slate-200/60 dark:border-white/10 rounded-xl flex items-center justify-center text-slate-400 text-[10px] font-bold tracking-widest uppercase bg-slate-50 dark:bg-slate-800/50">{dt(`Boshe`)}
                       </div>
                     )}
                   </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      </div>

      {selectedReportId && (
        <ReportDetailModal 
          report={reports.find(r => r.id === selectedReportId)!} 
          onClose={() => setSelectedReportId(null)} 
        />
      )}

      {/* AI Executive Summary Modal */}
      <AnimatePresence>
        {isSummaryModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[500] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 border-2 border-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-5 flex justify-between items-center border-b-2 border-slate-900">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 border border-rose-500 bg-rose-500/10 flex items-center justify-center rounded-2xl">
                    <Cpu className="w-5 h-5 text-rose-500 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-wide uppercase">{dt(`Përmbledhje Ekzekutive me AI`)}</h3>
                    <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-0.5">{dt(`Analizë Inteligjente për Aksion Municipal`)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                {loadingSummary ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-white/5 border-t-indigo-600 animate-spin"></div>
                      <Cpu className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white tracking-wide text-sm uppercase">{dt(`Duke Sintetizuar Raportet me Gemini AI...`)}</h4>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">{dt(`Kjo mund të marrë disa sekonda. Duke analizuar korrelacionet gjeografike dhe ankesat e komunitetit.`)}</p>
                    </div>
                  </div>
                ) : aiSummary ? (
                  <div className="prose prose-slate max-w-none">
                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 p-5 rounded-xl text-xs font-mono text-slate-500 dark:text-slate-400 mb-6 flex justify-between items-center">
                      <div>
                        <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500 dark:text-slate-400">{dt(`Masa e Analizuar:`)}</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200 dark:text-slate-200 text-sm mt-0.5">
                          {selectedIds.size > 0 
                            ? `${selectedIds.size} raste të përzgjedhura manualisht` 
                            : `${filteredReports.length} raste bazuar në filtrat aktualë`}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500 dark:text-slate-400">{dt(`Data e Analizës:`)}</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200 dark:text-slate-200 mt-0.5">{format(new Date(), 'dd.MM.yyyy HH:mm')}</p>
                      </div>
                    </div>

                    {/* Formatted Markdown-like Content */}
                    <div className="space-y-6 text-slate-800 dark:text-slate-200 dark:text-slate-200 leading-relaxed text-sm">
                      {aiSummary.split('\n').map((line, idx) => {
                        if (line.startsWith('###')) {
                          return (
                            <h4 key={idx} className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2 mt-4 uppercase text-xs tracking-wider">
                              {line.replace('###', '').trim()}
                            </h4>
                          );
                        }
                        if (line.startsWith('-') || line.startsWith('*')) {
                          return (
                            <div key={idx} className="flex gap-2.5 items-start pl-2">
                              <span className="text-rose-500 font-bold mt-1 shrink-0">•</span>
                              <p className="text-slate-700 dark:text-slate-300 font-medium text-xs md:text-sm">{line.replace(/^[-*]\s*/, '').trim()}</p>
                            </div>
                          );
                        }
                        if (line.trim() === '') return null;
                        return (
                          <p key={idx} className="text-slate-700 dark:text-slate-300 font-medium text-xs md:text-sm pl-1">
                            {line}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">{dt(`Nuk ka të dhëna të disponueshme.`)}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              {!loadingSummary && aiSummary && (
                <div className="bg-slate-50 dark:bg-slate-800 border-t border-slate-200/60 dark:border-white/10 p-4 md:px-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <span className="text-[10px] font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase">{dt(`Gjeneruar me Gemini 3.5 Flash`)}</span>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(aiSummary);
                        alert("Përmbledhja u kopjua në clipboard!");
                      }}
                      className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl tracking-wide uppercase transition-colors"
                    >{dt(`Kopjo Raportin`)}
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([aiSummary], { type: 'text/plain;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.setAttribute("href", url);
                        link.setAttribute("download", `AI_Permbledhje_Komunale_${new Date().toISOString().split('T')[0]}.txt`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="flex-1 sm:flex-none px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800 border border-slate-300 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl tracking-wide uppercase transition-colors"
                    >{dt(`Eksporto si TXT`)}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

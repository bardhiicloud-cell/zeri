import { dt } from '@/src/lib/dt';
import { escapeHtml } from '../../lib/escapeHtml';
import React, { useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { Download, Search, Trash2, CheckCircle2, FileText, Calendar, Filter, X, ChevronLeft, ChevronRight, CheckSquare, Square, Edit, MapPin, LayoutGrid, List, Cpu, Mail, ContactRound, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import ReportDetailModal from '../ReportDetailModal.tsx';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../lib/LanguageContext';
import { getAccountabilityProfile } from '../../lib/accountability';
import { isReportOverdue, reportDueAt } from '../../lib/reportDue';
import { db } from '../../lib/firebase';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, writeBatch, limit } from 'firebase/firestore';
import { getReportTopic, getReportTopicLabel, getReportTopicValueLabel, REPORT_TOPICS } from '../../lib/reportTopics';
import { STAFF_LIMITS } from '../../lib/loadLimits';
import toast from 'react-hot-toast';
import { filterByScope, isSpecificScope, normalizeScope } from '../../lib/municipalityScope';
import {
  EMPTY_FILTERS,
  csvCell,
  filterQueue,
  paginate,
  type QueueContext,
  type QueueFilters,
} from '../../lib/reportQueue';
import { useOptionalAdminCounts } from './AdminCountsContext';
import { looksLikeCode, mergePages, useServerReports, type ReportListParams } from '../../lib/adminReportsApi';
import type { Figure } from './dashboard/DashboardParts';
import { ReportRow } from './reports/ReportRow';
import ReviewMode from './ReviewMode';
import EmailInstitutionDialog from './EmailInstitutionDialog';
import { ReportsToolbar } from './reports/ReportsToolbar';

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

export default function AdminReports({ department, openReportId }: { department?: 'infrastrukture' | 'tjera'; openReportId?: string }) {
  const { dt } = useLanguage();
  const reports = useStore(state => state.reports);
  const isOverdueReport = (report: (typeof reports)[number]) => isReportOverdue(report);
  const deleteReport = useStore(state => state.deleteReport);
  const updateReportStatus = useStore(state => state.updateReportStatus);
  const [filters, setFilters] = useState<QueueFilters>(EMPTY_FILTERS);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  /** Review Mode: the records to walk through, frozen when it starts. */
  const [review, setReview] = useState<{ queue: typeof reports; startId?: string } | null>(null);
  /** The report being sent to an institution, with the contact chosen from the directory. */
  const [emailing, setEmailing] = useState<{ report: (typeof reports)[number]; contact: { id: string; name: string; email: string; institution: string } } | null>(null);
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
  const itemsPerPage = 20;
  const changeFilters = (patch: Partial<QueueFilters>) => {
    setFilters(current => ({ ...current, ...patch }));
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  // AI Summary states
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // A link from the work inbox opens straight onto its report. If that report is
  // not among those loaded yet, the code is put in the search box instead, so
  // the person lands on a filtered list rather than an unexplained empty one.
  React.useEffect(() => {
    if (!openReportId) return;
    if (knownReports.some(report => report.id === openReportId)) {
      setSelectedReportId(openReportId);
    } else {
      setFilters(current => ({ ...current, query: openReportId }));
    }
    // Only when the requested report changes, not on every report update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openReportId]);

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

  const scope = useStore(state => state.userMunicipality);
  const hasMoreReports = useStore(state => state.hasMoreReports);
  const loadMoreReports = useStore(state => state.loadMoreReports);
  const reportsStatus = useStore(state => state.reportsStatus);
  const currentUser = useStore(state => state.currentUser);
  const adminCounts = useOptionalAdminCounts();

  // The header's municipality scope governs this list, like every other section.
  // A private dropdown here used to disagree with it.
  const isScoped = isSpecificScope(scope);
  const scopeName = isScoped ? normalizeScope(scope) : null;
  const selectedMunicipality = scopeName ?? '';
  const timeFilter = filters.time;

  /**
   * Where the list comes from.
   *
   * The server returns one filtered, authorised page at a time (see
   * server/adminReports.ts), so the screen works the same with 30 reports or 30
   * million. The status tab, the header's municipality scope and a typed tracking
   * code become server filters; the rest (topic, period, free text) narrow the
   * loaded pages. If the server cannot answer - offline, or an index not yet
   * deployed - the screen falls back to the reports already in memory and says so.
   */
  const codeQuery = looksLikeCode(filters.query) ? filters.query.trim() : '';
  // "Overdue" depends on each category's deadline, which the server cannot filter
  // on, so that tab asks for every open report and narrows them here.
  const serverStatus = filters.status === 'overdue' ? 'unresolved' : filters.status;
  // "Të miat": what this person has taken on. Combined with the status tab only;
  // the server pins it to the signed-in account.
  const [onlyMine, setOnlyMine] = useState(false);
  const canHaveMine = currentUser?.role !== 'municipality' && currentUser?.role !== 'monitor';
  // The two lists staff work from when a case is stuck: waiting for the citizen's answer,
  // and raised to the owner. A flag is a list of its own (the server refuses other filters).
  const [flag, setFlag] = useState<'' | 'awaitingInfo' | 'escalated'>('');
  const canSeeFlags = currentUser?.role !== 'municipality';
  const serverParams = useMemo<ReportListParams>(
    () => (codeQuery
      ? { code: codeQuery }
      : flag && canSeeFlags
        ? { flag }
        : onlyMine && canHaveMine
        ? { status: serverStatus || undefined, assignee: 'me' }
        : { status: serverStatus || undefined, municipality: scopeName || undefined }),
    [codeQuery, serverStatus, scopeName, onlyMine, canHaveMine, flag, canSeeFlags]
  );
  const serverList = useServerReports(serverParams, !department);
  const serverActive = !department && serverList.status !== 'error';
  const sourceReports = serverActive ? serverList.items : reports;
  // Everything the screen has seen, so a link can open a report on any page.
  const knownReports = useMemo(() => mergePages(serverList.items, reports), [serverList.items, reports]);
  const moreAvailable = serverActive ? Boolean(serverList.nextCursor) : hasMoreReports;
  const loadMore = serverActive ? serverList.loadMore : loadMoreReports;
  const listLoading = serverActive ? serverList.status === 'loading' && serverList.items.length === 0 : reportsStatus === 'loading';

  // Deadlines and "N days ago" move without data changing, so time is state.
  const [now, setNow] = useState(() => Date.now());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Permanent deletion is reserved to admin/superadmin by the Firestore rules; a
  // button that can only fail is not offered to anyone else.
  const canDelete = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  // A monitor reads. The server refuses its writes either way; the buttons that
  // would only fail are not drawn.
  const canChange = currentUser?.role !== 'monitor';
  // Photos are the staff's to take down; the server also refuses a municipality or a monitor.
  const canEditPhotos = canChange && currentUser?.role !== 'municipality';

  const reportsInScope = useMemo(() => filterByScope(sourceReports, scope).filter(r => {
    if (!department) return true;
    const cat = r.category || '';
    const infra = ['infrastrukturë', 'urbanizëm', 'ambient', 'infrastrukturë rrugore'];
    const isInfra = infra.some(i => cat.toLowerCase().includes(i));
    if (department === 'infrastrukture') return isInfra;
    return !isInfra;
  }), [sourceReports, scope, department]);

  const queueContext = useMemo<QueueContext<(typeof reports)[number]>>(() => ({
    now,
    isOverdue: isOverdueReport,
    searchText: r => [
      r.title, r.description, r.id, r.trackingId, r.location?.address, r.location?.municipality,
      r.category, getReportTopicLabel(r), r.responsibleInstitution,
      // Topic keywords are synonyms ("gropë", "asfalt"): searching them finds the report.
      getReportTopic(r)?.keywords.join(' '),
    ].filter(Boolean).join(' '),
    topicId: r => getReportTopic(r)?.id,
  }), [now]);

  const filteredReports = useMemo(
    () => filterQueue(reportsInScope, filters, queueContext),
    [reportsInScope, filters, queueContext]
  );

  /**
   * Tab counts. The browser holds only the newest page of reports, so a count
   * taken from it is a lower bound once more exist. For the whole country the
   * server's exact counters are used where they exist; otherwise the figure is
   * marked "≥". "Overdue" depends on each category's deadline, which the server
   * cannot count, so it always comes from the loaded reports.
   */
  const tabCounts = useMemo<Record<string, Figure>>(() => {
    const sample = (predicate: (r: (typeof reports)[number]) => boolean): Figure => ({
      value: reportsInScope.filter(predicate).length,
      atLeast: moreAvailable,
    });
    const server = !isScoped && !department && adminCounts?.updatedAt != null ? adminCounts.counts : null;
    const exact = (value: number | undefined, fallback: Figure): Figure =>
      value === undefined ? fallback : { value };
    return {
      '': exact(server?.reports, { value: reportsInScope.length, atLeast: moreAvailable }),
      unapproved: exact(server?.reportsPending, sample(r => r.status === 'Pending Review')),
      'in-progress': exact(server?.reportsActive, sample(r => ['Approved', 'Assigned', 'In Progress'].includes(r.status))),
      overdue: sample(isOverdueReport),
      resolved: exact(server?.reportsResolved, sample(r => r.status === 'Resolved')),
      rejected: sample(r => r.status === 'Rejected'),
    };
  }, [reportsInScope, moreAvailable, isScoped, department, adminCounts?.updatedAt, adminCounts?.counts]);

  const pageData = paginate(filteredReports, currentPage, itemsPerPage);
  const totalPages = pageData.totalPages;
  const paginatedReports = pageData.items;

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
    void serverList.refresh();
    if (refused.length > 0) {
      toast.error(`${refused.length} ${dt('dosje nuk u ndryshuan nga rrjedha e aprovimit')}: ${refused[0]}`, { duration: 8000 });
    } else {
      toast.success(dt('Veprimi u krye.'));
    }
  };

  const handleStatusChange = async (id: string, newStatus: any) => {
    try {
      await updateReportStatus(id, newStatus, `Statusi u ndryshua në ${newStatus}`);
    } catch (error) {
      toast.error((error as Error)?.message || dt('Statusi nuk u ndryshua.'));
    }
  };

  /** One-click approval from a row: the same server-checked transition as the bulk action. */
  const approveOne = async (id: string) => {
    try {
      await updateReportStatus(id, 'Approved', 'Aprovuar.');
      toast.success(dt('Raporti u aprovua dhe u dërgua te komuna.'));
      void serverList.refresh();
    } catch (error) {
      toast.error((error as Error)?.message || dt('Raporti nuk u aprovua.'));
    }
  };

  /** Start Review Mode on what the list is showing now, beginning at one record or the first. */
  const startReview = (startId?: string) => {
    if (filteredReports.length === 0) return;
    setReview({ queue: filteredReports, startId });
  };

  const reviewReject = async (id: string, reason: string) => {
    await updateReportStatus(id, 'Rejected', reason);
  };

  const deleteOne = (report: (typeof reports)[number]) => {
    if (window.confirm(`${dt('Të fshihet përgjithmonë raporti')} "${report.title}"? ${dt('Ky veprim nuk mund të zhbëhet.')}`)) {
      void Promise.resolve(deleteReport(report.id)).then(() => serverList.refresh());
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

  const handleEmailReport = (report: (typeof reports)[number], viaMailProgram = false) => {
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
    if (!viaMailProgram) {
      // The platform sends it and records it; the mail program stays as an alternative in the dialog.
      setEmailing({ report, contact: { id: contact.id, name: contact.name, email: contact.email, institution: contact.institution } });
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
          r.title,
          r.description,
          r.status,
          getReportTopicLabel(r),
          r.category,
          r.urgency,
          new Date(r.createdAt).toISOString(),
          r.location?.municipality || 'N/A',
          r.location?.address || '',
          r.location?.lat || 0,
          r.location?.lng || 0,
          r.isAnonymous ? 'Anonim' : (r.authorName || 'N/A'),
        ].map(csvCell);
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
        <p>Gjeneruar më: ${new Date().toLocaleString('sq-AL')} | Lokalizimi: ${escapeHtml(selectedMunicipality || 'E Tërë Kosova')}</p>
        <p>Të filtruara për kohën: ${timeFilter === 'daily' ? 'Ditore' : timeFilter === 'weekly' ? 'Javore' : timeFilter === 'monthly' ? 'Mujore' : 'Të Gjitha'}</p>
      </div>
    `;

    for (const [organ, reportsGroup] of Object.entries(groupedReports)) {
      htmlContent += `<h2>Kategoria tematike: ${escapeHtml(organ.toUpperCase())}</h2>`;
      htmlContent += `<p style="font-weight: bold; font-size: 14px; text-transform: uppercase;">Totali i raporteve: <span style="background: #0f172a; color: white; padding: 2px 8px; border-radius: 12px;">${reportsGroup.length}</span></p>`;
      
      reportsGroup.forEach(r => {
        htmlContent += `
        <div class="report-card">
          <div class="grid">
            <div>
              <h3 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase;">Referenca: ${escapeHtml(r.id)}</h3>
              <h4 style="margin: 5px 0 0 0; font-size: 16px; font-weight: 600; color: #e11d48; text-transform: uppercase;">${escapeHtml(r.title)}</h4>
              <span class="status">${escapeHtml(r.status)}</span>
              <table>
                <tr><th>Tema</th><td><strong>${escapeHtml(getReportTopicLabel(r))}</strong></td></tr>
                <tr><th>Sektori / institucioni</th><td>${escapeHtml(r.category)}</td></tr>
                <tr><th>Urgjenca</th><td>${escapeHtml(r.urgency)}</td></tr>
                <tr><th>Data e Hapjes</th><td>${new Date(r.createdAt).toLocaleString('sq-AL')}</td></tr>
                <tr><th>Raportuesi</th><td>${r.isAnonymous ? 'Anonim (Mbrojtur)' : escapeHtml(r.authorName)}</td></tr>
              </table>
            </div>
            <div>
              <div class="desc-title">Të Dhënat Gjeografike</div>
              <table>
                <tr><th>Komuna</th><td>${escapeHtml(r.location?.municipality || 'N/A')}</td></tr>
                <tr><th>Adresa</th><td>${escapeHtml(r.location?.address || 'N/A')}</td></tr>
              </table>
              <div class="desc-title">Përshkrimi</div>
              <p class="desc-content">${escapeHtml(r.description)}</p>
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

  const toolbarTopics = REPORT_TOPICS.map(topic => ({ id: topic.id, label: `${topic.icon} ${getReportTopicValueLabel(topic.id)}` }));
  const hasAnyFilter = Boolean(filters.query || filters.status || filters.topic || filters.time !== 'all');
  const allOnPageSelected = paginatedReports.length > 0 && selectedIds.size === paginatedReports.length;

  return (
    <div className="flex flex-col gap-4">
      <section className="relative rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900">
        <ReportsToolbar
          filters={filters}
          onChange={changeFilters}
          onClear={() => changeFilters({ ...EMPTY_FILTERS })}
          tabCounts={tabCounts}
          topics={toolbarTopics}
          scopeName={scopeName}
          view={viewMode}
          onView={setViewMode}
          onExport={handleDownload}
          onSummary={handleGetSummary}
          contactsCount={routingContacts.length}
          contactsOpen={isContactDirectoryOpen}
          onToggleContacts={() => setIsContactDirectoryOpen(open => !open)}
        />

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

        {!department && serverList.status === 'error' && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
            <span>
              {dt(`Lista e plotë nga serveri nuk është e disponueshme tani`)}
              {serverList.error?.message ? ` (${serverList.error.message})` : ''}. {dt(`Po shfaqen raportet e fundit të ngarkuara.`)}
            </span>
            <button type="button" onClick={() => void serverList.refresh()} className="rounded-md border border-amber-300 px-2.5 py-1 font-bold hover:bg-amber-100 dark:border-amber-500/40 dark:hover:bg-amber-900/40">
              {dt(`Provo përsëri`)}
            </button>
          </div>
        )}
        {serverActive && filters.query.trim() && !codeQuery && moreAvailable && (
          <p className="border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] text-slate-500 dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-400">
            {dt(`Kërkimi me fjalë shfaq vetëm raportet e ngarkuara. Për të gjetur çdo raport, shkruani kodin e ndjekjes (p.sh. ZQ-1042).`)}
          </p>
        )}

        {viewMode === 'list' ? (
          <>
            {paginatedReports.length > 0 && (
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-3 py-2 text-[11px] font-semibold text-slate-500 sm:px-4 dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleSelectAll}
                  aria-label={dt(`Zgjidh të gjitha në këtë faqe`)}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-rose-600"
                />
                <span>
                  {pageData.total.toLocaleString('sq')} {dt(`raporte`)}
                  {moreAvailable && <span className="font-normal"> · {dt(`të ngarkuara deri tani`)}</span>}
                </span>
                {canSeeFlags && (
                  <div className="ml-auto flex gap-1.5" role="group" aria-label={dt(`Raporte që kërkojnë vëmendje`)}>
                    {([['awaitingInfo', 'Presin informacion'], ['escalated', 'Të eskaluara']] as const).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setFlag(current => (current === id ? '' : id))}
                        aria-pressed={flag === id}
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors',
                          flag === id ? 'bg-sky-700 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800'
                        )}
                      >
                        {dt(label)}
                      </button>
                    ))}
                  </div>
                )}
                {canHaveMine && (
                  <button
                    type="button"
                    onClick={() => setOnlyMine(value => !value)}
                    aria-pressed={onlyMine}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors',
                      onlyMine ? 'bg-indigo-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800'
                    )}
                    title={dt(`Vetëm raportimet që i keni marrë përsipër`)}
                  >
                    {dt(`Të miat`)}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => startReview()}
                  className={cn('inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 dark:bg-rose-600 dark:hover:bg-rose-500', !canHaveMine && 'ml-auto')}
                  title={dt(`Hap rekordin e parë dhe kalo një nga një`)}
                >
                  {dt(`Fillo rishikimin`)}
                </button>
              </div>
            )}

            {paginatedReports.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-slate-100 bg-slate-50 dark:border-white/5 dark:bg-slate-800">
                  <Search className="h-6 w-6 text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {listLoading
                    ? dt(`Duke ngarkuar raportet…`)
                    : hasAnyFilter || scopeName
                      ? dt(`Asnjë raport nuk përputhet me këto kritere.`)
                      : dt(`Nuk ka ende raporte.`)}
                </p>
                {hasAnyFilter && !listLoading && (
                  <button
                    type="button"
                    onClick={() => changeFilters({ ...EMPTY_FILTERS })}
                    className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-rose-600 dark:hover:bg-rose-500"
                  >
                    {dt(`Pastro filtrat`)}
                  </button>
                )}
                {scopeName && !hasAnyFilter && !listLoading && (
                  <p className="mt-1 text-xs text-slate-400">{dt(`Kufizimi aktiv:`)} {scopeName}</p>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-white/10">
                {paginatedReports.map(report => {
                  const accountability = getAccountabilityProfile(report.category);
                  const contact = getMatchingContact(report);
                  return (
                    <ReportRow
                      key={report.id}
                      report={report}
                      selected={selectedIds.has(report.id)}
                      onToggle={() => toggleSelectBlock(report.id)}
                      onOpen={() => startReview(report.id)}
                      now={now}
                      dueAt={reportDueAt(report)}
                      topicLabel={getReportTopicLabel(report)}
                      institution={report.responsibleInstitution || accountability.institution}
                      onApprove={canChange && report.status === 'Pending Review' ? () => void approveOne(report.id) : undefined}
                      onEmail={() => handleEmailReport(report)}
                      hasContact={Boolean(contact)}
                      onDelete={canDelete ? () => deleteOne(report) : undefined}
                    />
                  );
                })}
              </ul>
            )}

            {(totalPages > 1 || moreAvailable) && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                <span className="font-semibold">
                  {pageData.from}–{pageData.to} {dt(`nga`)} {pageData.total.toLocaleString('sq')}
                </span>
                <div className="flex items-center gap-2">
                  {moreAvailable && pageData.page === totalPages && (
                    <button
                      type="button"
                      disabled={serverList.isLoadingMore}
                      onClick={() => void loadMore()}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {serverList.isLoadingMore ? dt(`Duke ngarkuar…`) : dt(`Ngarko më shumë raporte`)}
                    </button>
                  )}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(pageData.page - 1)}
                        disabled={pageData.page === 1}
                        aria-label={dt(`Faqja e mëparshme`)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-slate-800"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="min-w-[4rem] text-center font-bold text-slate-700 dark:text-slate-200">{pageData.page} / {totalPages}</span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(pageData.page + 1)}
                        disabled={pageData.page === totalPages}
                        aria-label={dt(`Faqja tjetër`)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-slate-800"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
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

        {selectedIds.size > 0 && (
          <div className="sticky bottom-3 z-30 mx-auto mb-3 flex w-fit max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white shadow-2xl">
            <span className="px-1 font-bold">{selectedIds.size} {dt(`të zgjedhura`)}</span>
            {canChange && <button type="button" onClick={() => handleBulkAction('approve')} className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold hover:bg-emerald-500">{dt(`Aprovo`)}</button>}
            <button type="button" onClick={handleGetSummary} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 font-bold hover:bg-indigo-500"><Cpu className="h-3.5 w-3.5" aria-hidden="true" />{dt(`Përmbledh me AI`)}</button>
            {canDelete && (
              <button type="button" onClick={() => handleBulkAction('delete')} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 font-bold hover:bg-rose-500"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{dt(`Fshi`)}</button>
            )}
            <button type="button" onClick={() => setSelectedIds(new Set())} className="rounded-lg px-2 py-1.5 font-bold text-slate-300 hover:text-white">{dt(`Pastro`)}</button>
          </div>
        )}
      </section>

      {emailing && (
        <EmailInstitutionDialog
          reportId={emailing.report.id}
          reportTitle={emailing.report.title}
          contact={emailing.contact}
          canRetry={currentUser?.role === 'admin' || currentUser?.role === 'superadmin'}
          onClose={() => setEmailing(null)}
          onUseMailProgram={() => { const report = emailing.report; setEmailing(null); handleEmailReport(report, true); }}
        />
      )}

      {review && (
        <ReviewMode
          queue={review.queue}
          startId={review.startId}
          getReport={id => knownReports.find(r => r.id === id)}
          canApprove={canChange}
          canReject={canChange}
          canDelete={canDelete}
          canEditPhotos={canEditPhotos}
          onApprove={id => updateReportStatus(id, 'Approved', 'Aprovuar.')}
          onReject={reviewReject}
          onDelete={async id => { await deleteReport(id); }}
          onOpenFull={id => { setReview(null); setSelectedReportId(id); }}
          onClose={() => { setReview(null); void serverList.refresh(); }}
        />
      )}

      {selectedReportId && (
        <ReportDetailModal 
          report={knownReports.find(r => r.id === selectedReportId)!} 
          onClose={() => { setSelectedReportId(null); void serverList.refresh(); }} 
        />
      )}

      {/* AI Executive Summary Modal */}
      <AnimatePresence>
        {isSummaryModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 md:backdrop-blur-md z-[500] flex items-center justify-center p-4">
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

import React, { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Clock3, Image as ImageIcon, MapPin, Search, ShieldCheck, ShieldOff, Video } from 'lucide-react';
import { useStore } from '../lib/store';
import { db } from '../lib/firebase';
import { Report, IssueStatus } from '../types';
import { getAccountabilityProfile, getAccountabilityDueDate } from '../lib/accountability';
import { getGuestReportHistory } from '../lib/session';
import { statusLabel, statusMeta, TONE_CLASSES } from '../lib/reportStatus';
import { ReportTimeline } from '../components/reports/ReportTimeline';
import { ReportAttachments } from '../components/reports/ReportAttachments';

import { dt } from '@/src/lib/dt';
function normalizeReport(data: any, id: string): Report {
  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000).toISOString() : data.createdAt;
  return { ...data, id, createdAt: createdAt || new Date().toISOString(), timeline: Array.isArray(data.timeline) ? data.timeline : [] } as Report;
}

export default function TrackIdPage() {
  const reports = useStore(state => state.reports || []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState(searchParams.get('id') || '');
  const [report, setReport] = useState<Report | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const guestHistory = getGuestReportHistory();

  const searchReport = async (value: string) => {
    const trackingId = value.trim().toUpperCase();
    if (!trackingId) return;
    setIsSearching(true);
    setNotFound(false);
    setSearchParams({ id: trackingId });

    const localReport = reports.find(item => (item.trackingId || '').toUpperCase() === trackingId || item.id.toUpperCase() === trackingId);
    if (localReport) {
      setReport(localReport);
      setIsSearching(false);
      return;
    }

    const guestLocalReport = guestHistory.find(item => item.trackingId.toUpperCase() === trackingId || item.id.toUpperCase() === trackingId);
    if (guestLocalReport) {
      setReport({
        id: guestLocalReport.id,
        trackingId: guestLocalReport.trackingId,
        title: guestLocalReport.title,
        description: guestLocalReport.description || 'Raportimi u regjistrua në pajisjen tuaj dhe po pret procesimin e mëtejshëm.',
        category: guestLocalReport.category || 'Të tjera',
        status: (guestLocalReport.status as IssueStatus) || 'Pending Review',
        location: { municipality: guestLocalReport.municipality || 'Pa komunë', address: 'Raportim nga pajisja e përdoruesit', lat: 0, lng: 0 },
        images: [],
        createdAt: guestLocalReport.createdAt,
        timeline: [{ id: `guest-${Date.now()}`, status: 'Pending Review', date: guestLocalReport.createdAt, updatedBy: 'Sistemi' }],
        responsibleInstitution: 'Në pritje të caktimit',
        responsibleLevel: 'Lokal',
        responsibleOffice: 'Sistemi i raportimeve',
        accountabilityStatus: 'Në pritje',
        municipality: guestLocalReport.municipality || 'Pa komunë',
        authorName: 'Mysafir',
        isAnonymous: true,
        urgency: 'Mesatare',
        authorId: 'guest',
        upvotes: 0,
        commentsCount: 0,
        media: []
      } as Report);
      setIsSearching(false);
      return;
    }

    try {
      const snapshot = await getDocs(query(collection(db, 'reports'), where('trackingId', '==', trackingId), limit(1)));
      if (!snapshot.empty) {
        const item = snapshot.docs[0];
        setReport(normalizeReport(item.data(), item.id));
      } else {
        setReport(null);
        setNotFound(true);
      }
    } catch (error) {
      console.error('Track ID lookup failed:', error);
      setReport(null);
      setNotFound(true);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const initialId = searchParams.get('id');
    if (initialId) searchReport(initialId);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="relative overflow-hidden rounded-[28px] bg-slate-950 p-8 text-white sm:p-12">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-blue-600/25 blur-3xl" />
          <div className="absolute -bottom-32 left-1/4 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-blue-300">
              <ShieldCheck className="h-4 w-4" /> {dt('Gjurmimi i raportimit')}
            </div>
            <h1 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">{dt('Gjej raportimin tënd')}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Vendos Track ID (p.sh. <span className="font-mono font-bold text-white">ZQ-ABC12345</span>) për të parë statusin, historinë e veprimeve, fotot dhe përgjigjen e institucionit — njësoj siç shohin punonjesit e komunës.
            </p>
            <ol className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { step: '1', title: 'Kopjo Track ID', desc: 'E merr pas raportimit ose nga emaili i konfirmimit.' },
                { step: '2', title: 'Kërko më poshtë', desc: 'Shkruaje në fushë dhe shtyp Kërko.' },
                { step: '3', title: 'Shiko statusin', desc: 'Histori e plotë, afat dhe përgjigje zyrtare.' },
              ].map(item => (
                <li key={item.step} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xs font-black">{item.step}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-black">{item.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </header>

        <form onSubmit={event => { event.preventDefault(); searchReport(input); }} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder="p.sh. ZQ-ABC12345"
                aria-label={dt('Track ID')}
                className="h-14 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 pl-12 pr-4 font-mono text-base font-bold uppercase tracking-wide text-slate-900 outline-none transition focus:border-blue-500 dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !input.trim()}
              className="h-14 rounded-2xl bg-blue-600 px-8 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50"
            >
              {isSearching ? 'Duke kërkuar…' : 'Kërko Track ID'}
            </button>
          </div>
        </form>

        {guestHistory.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4">
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{dt('Raportimet e tua')}</div>
            <div className="flex flex-wrap gap-2">
              {guestHistory.slice(0, 10).map(item => (
                <button
                  key={item.trackingId}
                  onClick={() => { setInput(item.trackingId); searchReport(item.trackingId); }}
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-black text-blue-700 hover:bg-blue-100"
                >
                  {item.trackingId}
                </button>
              ))}
            </div>
          </div>
        )}

        {notFound && <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-5 text-sm font-semibold">{dt('Nuk u gjet raportimi me këtë Track ID. Kontrollo shkronjat dhe provo përsëri.')}</div>}

        {report && (
          <main className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-widest text-blue-600">{dt('Track ID')}</p><p className="font-mono text-2xl font-black text-slate-900 dark:text-white mt-1">{report.trackingId || report.id}</p><h2 className="text-xl font-black text-slate-900 dark:text-white mt-4">{report.title}</h2></div>
              <span className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap border ${TONE_CLASSES[statusMeta(report.status).tone].badge}`}>{statusLabel(report.status)}</span>
            </div>
            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8">
              <div className="space-y-5">
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30"><p className="text-[10px] font-black uppercase tracking-widest text-blue-600">{dt('Përgjegjësia institucionale')}</p><p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{report.responsibleInstitution || getAccountabilityProfile(report.category).institution}</p><p className="mt-1 text-xs text-slate-500">Zyra: {report.responsibleOffice || getAccountabilityProfile(report.category).office} · Afati: {report.responseDueAt ? new Date(report.responseDueAt).toLocaleString('sq-AL') : new Date(getAccountabilityDueDate(report.createdAt, getAccountabilityProfile(report.category).responseHours)).toLocaleString('sq-AL')}</p></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm"><div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800"><MapPin className="w-4 h-4 text-blue-600 mb-2" /><strong>{report.location?.municipality || 'Pa komunë'}</strong><p className="text-slate-500 mt-1">{report.location?.address || 'Pa adresë'}</p></div><div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800"><Calendar className="w-4 h-4 text-blue-600 mb-2" /><strong>{dt('Dërguar')}</strong><p className="text-slate-500 mt-1">{new Date(report.createdAt).toLocaleString('sq-AL')}</p></div></div>
                <div><h3 className="font-black text-slate-900 dark:text-white mb-2">{dt('Përshkrimi')}</h3><p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{report.description}</p></div>
                <div><h3 className="font-black text-(--color-text) mb-4">Historia e trajtimit (Timeline)</h3><ReportTimeline events={report.timeline || []} /></div>
              </div>
              <aside className="space-y-5">
                <ReportAttachments images={report.images} media={report.media} emptyText="Pa dëshmi të bashkangjitura" />
                <div className={`flex items-start gap-3 rounded-2xl border p-4 ${report.isAnonymous ? 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-800' : 'border-blue-100 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30'}`}>
                  {report.isAnonymous ? <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />}
                  <div className="text-xs leading-relaxed">
                    <p className="font-black text-slate-900 dark:text-white">{report.isAnonymous ? 'Raportim anonim' : 'Raportim i identifikuar'}</p>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      {report.isAnonymous
                        ? 'Identiteti yt mbetet plotësisht privat — nuk shfaqet askund, as tek stafi komunal.'
                        : 'Emri yt shfaqet vetëm tek stafi përgjegjës për trajtimin e rastit.'}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-500 space-y-2"><p className="flex items-center gap-2"><Clock3 className="w-4 h-4" /> {dt('Statusi përditësohet nga stafi gjatë trajtimit.')}</p><p className="flex items-center gap-2"><ImageIcon className="w-4 h-4" /> {dt('Fotot, videot dhe dokumentet ruhen si dëshmi e rastit.')}</p><p className="flex items-center gap-2"><Video className="w-4 h-4" /> {dt('Track ID përdoret për këtë raportim.')}</p></div>
              </aside>
            </div>
            {report.status === 'Resolved' && report.resolvedImage && <div className="p-6 sm:p-8 border-t border-slate-200 dark:border-white/10"><h3 className="font-black text-slate-900 dark:text-white mb-3">{dt('Dëshmia pas zgjidhjes')}</h3><img src={report.resolvedImage} alt={dt('Dëshmi pas zgjidhjes')} className="max-w-xl w-full rounded-2xl" /></div>}
          </main>
        )}
      </div>
    </div>
  );
}

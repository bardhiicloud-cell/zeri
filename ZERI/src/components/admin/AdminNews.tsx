import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch, query, limit, orderBy } from 'firebase/firestore';
import DecisionBar from './DecisionBar';
import { DECISION_KINDS } from '../../lib/decisionRules';
import { takeDecision } from '../../lib/decisionsApi';
import { CheckCircle2, Link2, Newspaper, Plus, Search, Trash2, X, Filter, Pencil } from 'lucide-react';
import { db } from '../../lib/firebase';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import { dt } from '@/src/lib/dt';
import { ALL_SCOPE } from '../../lib/municipalityScope';
import { STAFF_LIMITS } from '../../lib/loadLimits';
import toast from 'react-hot-toast';
import { NEWS_CATEGORIES } from '../../lib/newsCategories';
import { DEMO_NEWS } from '../../lib/demoNews';

interface AdminNewsItem {
  id: string;
  title: string;
  municipality: string;
  category: string;
  summary: string;
  content: string;
  imageUrl?: string;
  /** Photo shown inside the article body, below the lead. */
  inlineImageUrl?: string;
  /** Video embedded in the article body. */
  videoUrl?: string;
  author: string;
  readTime: string;
  date: string;
  published: boolean;
  isTicker?: boolean;
  isDemo?: boolean;
  position?: NewsPosition;
  relatedReportIds?: string[];
  createdAt?: string;
  publishedAt?: string;
}

type NewsPosition = 'featured' | 'feed' | 'sidebar';

/** "Gjithë Kosova" — a country-wide notice, not tied to one municipality. */
const ALL_KOSOVA = 'Gjithë Kosova';

const emptyForm = {
  title: '', municipality: ALL_KOSOVA, category: NEWS_CATEGORIES[0] as string, summary: '', content: '', imageUrl: '',
  inlineImageUrl: '', videoUrl: '', published: true, isTicker: false, position: 'feed' as NewsPosition, relatedReportIds: [] as string[]
};

/**
 * The report states an editor actually chooses between when linking a notice.
 * Showing the raw Firestore status strings ("Pending Review", "Approved") made
 * the picker read like a database dump; these are the same states in the
 * vocabulary the public registry uses.
 */
const REPORT_STATE_FILTERS = [
  { id: 'open', label: 'Të hapura' },
  { id: 'resolved', label: 'Të zgjidhura' },
  { id: 'critical', label: 'Kritike' },
  { id: 'all', label: 'Të gjitha' },
] as const;

type ReportStateFilter = typeof REPORT_STATE_FILTERS[number]['id'];

export default function AdminNews() {
  const reports = useStore(state => state.reports);
  const userMunicipality = useStore(state => state.userMunicipality);
  const [items, setItems] = useState<AdminNewsItem[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [reportFilter, setReportFilter] = useState<ReportStateFilter>('open');
  const [reportQuery, setReportQuery] = useState('');
  const [listQuery, setListQuery] = useState('');
  const [listFilter, setListFilter] = useState<'all' | 'published' | 'draft' | 'rejected' | 'linked'>('all');

  const fieldClass = 'w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500';

  /**
   * Reports offered for linking, filtered by state and free-text, and — when a
   * municipality filter is active — restricted to that municipality. The
   * previous version listed every open report in the chosen municipality with
   * no way to narrow it, which on a busy municipality is a scroll of hundreds
   * of rows in a 56-unit-tall box.
   */
  const linkableReports = useMemo(() => {
    const needle = reportQuery.trim().toLowerCase();
    return reports.filter(report => {
      if (form.municipality !== ALL_KOSOVA && report.location?.municipality !== form.municipality) return false;

      if (reportFilter === 'open' && ['Resolved', 'Rejected', 'Draft'].includes(report.status)) return false;
      if (reportFilter === 'resolved' && report.status !== 'Resolved') return false;
      if (reportFilter === 'critical' && report.urgency !== 'Kritike') return false;

      if (!needle) return true;
      return (
        report.title.toLowerCase().includes(needle) ||
        (report.trackingId ?? '').toLowerCase().includes(needle) ||
        (report.location?.address ?? '').toLowerCase().includes(needle)
      );
    });
  }, [reports, form.municipality, reportFilter, reportQuery]);

  /**
   * The editor's own list. `linked` is the view the module exists for: which
   * notices are actually answering citizen reports, and which of those still
   * have open reports attached.
   */
  const visibleItems = useMemo(() => {
    const needle = listQuery.trim().toLowerCase();
    return items
      .filter(item => {
        const state = DECISION_KINDS.news.stateOf(item as any);
        if (listFilter === 'published' && state !== 'published') return false;
        if (listFilter === 'draft' && state !== 'draft') return false;
        if (listFilter === 'rejected' && state !== 'rejected') return false;
        if (listFilter === 'linked' && !(item.relatedReportIds?.length)) return false;
        if (!needle) return true;
        return (
          item.title.toLowerCase().includes(needle) ||
          item.municipality.toLowerCase().includes(needle) ||
          item.category.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => (b.relatedReportIds?.length ?? 0) - (a.relatedReportIds?.length ?? 0));
  }, [items, listQuery, listFilter]);

  useEffect(() => onSnapshot(
    query(collection(db, 'newsArticles'), orderBy('createdAt', 'desc'), limit(STAFF_LIMITS.newsArticles)),
    snapshot => {
      setItems(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as AdminNewsItem)));
    },
    () => setItems([]),
  ), []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.summary.trim() || !form.content.trim()) return;
    try {
      const now = new Date().toISOString();
      const id = editingId ?? `news-${Date.now()}`;
      const existingItem = items.find(item => item.id === editingId);
      const articleData = {
        ...form,
        isDemo: false,
        isTicker: form.category === 'Njoftim Zyrtar' && form.isTicker,
        id,
        author: existingItem?.author || 'Administrata e Zërit të Qytetarëve',
        readTime: existingItem?.readTime || '3 min lexim',
        date: existingItem?.date || new Date().toLocaleDateString('sq-AL', { day: '2-digit', month: 'long', year: 'numeric' }),
        createdAt: existingItem?.createdAt || now,
        // Saving writes the text only. Going public, or coming down, is a decision
        // with an author and a trace, taken through the acceptance system below.
        published: existingItem?.published === true,
        publishedAt: existingItem?.published ? existingItem.publishedAt ?? null : null,
        status: existingItem ? (existingItem as any).status ?? 'Draft' : 'Draft',
        updatedAt: now,
      };
      await setDoc(doc(db, 'newsArticles', id), articleData, { merge: Boolean(editingId) });
      const wantsPublish = !editingId && form.published;
      if (wantsPublish) {
        try {
          await takeDecision('news', id, 'publish');
        } catch (error) {
          toast.error(`${dt('Lajmi u ruajt si draft, por nuk u publikua:')} ${(error as Error).message}`);
          setForm(emptyForm);
          setEditingId(null);
          setIsCreating(false);
          return;
        }
      }
      setForm(emptyForm);
      setEditingId(null);
      setIsCreating(false);
      toast.success(editingId ? dt('Lajmi u përditësua me sukses.') : wantsPublish ? dt('Lajmi u publikua me sukses.') : dt('Lajmi u ruajt si draft.'));
    } catch (error) {
      console.error('Gabim gjatë ruajtjes së lajmit:', error);
      toast.error(dt('Lajmi nuk u ruajt. Provoni përsëri.'));
    }
  };

  const handleEdit = (item: AdminNewsItem) => {
    setForm({
      title: item.title || '',
      municipality: item.municipality || ALL_KOSOVA,
      category: item.category || NEWS_CATEGORIES[0],
      summary: item.summary || '',
      content: item.content || '',
      imageUrl: item.imageUrl || '',
      inlineImageUrl: (item as any).inlineImageUrl || '',
      videoUrl: (item as any).videoUrl || '',
      published: item.published !== false,
      isTicker: item.isTicker === true,
      position: item.position || 'feed',
      relatedReportIds: item.relatedReportIds || [],
    });
    setEditingId(item.id);
    setIsCreating(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeEditor = () => {
    setIsCreating(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(dt('A dëshironi ta hiqni këtë lajm?'))) return;
    await deleteDoc(doc(db, 'newsArticles', id));
    toast.success(dt('Lajmi u hoq.'));
  };

  const handleSeedDemoArticles = async () => {
    const missing = DEMO_NEWS.filter(article => !items.some(item => item.id === article.id));
    if (missing.length === 0) {
      toast.success(dt('Shembujt demo janë shtuar tashmë.'));
      return;
    }

    const batch = writeBatch(db);
    const now = new Date().toISOString();
    missing.forEach(article => {
      batch.set(doc(db, 'newsArticles', article.id), {
        ...article,
        published: false,
        publishedAt: null,
        updatedAt: now,
      });
    });

    try {
      await batch.commit();
      toast.success(dt('Shembujt demo u shtuan si skica.'));
    } catch (error) {
      console.error('Shembujt demo të lajmeve nuk u shtuan:', error);
      toast.error(dt('Shembujt demo nuk u ruajtën. Kontrolloni lejet e administratës.'));
    }
  };

  /** Counts of open reports attached to a notice, used for the row badge. */
  const openReportCount = (item: AdminNewsItem) => {
    const ids = item.relatedReportIds ?? [];
    return reports.filter(
      report => ids.includes(report.id) && !['Resolved', 'Rejected'].includes(report.status)
    ).length;
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3"><Newspaper className="w-8 h-8 text-blue-600" /> Menaxhimi i Lajmeve</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Krijoni, publikoni dhe hiqni lajmet që shfaqen në faqen publike.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={handleSeedDemoArticles}
              disabled={DEMO_NEWS.every(article => items.some(item => item.id === article.id))}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/70"
            >
              <Newspaper className="h-4 w-4" /> {dt('Shto 12 shembuj demo si skica')}
            </button>
          )}
          <button onClick={() => isCreating ? closeEditor() : setIsCreating(true)} className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">
            {isCreating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{isCreating ? 'Mbyll redaktorin' : 'Krijo lajm'}
          </button>
        </div>
      </div>

      {isCreating && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-7 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titulli i lajmit" className={fieldClass} />
            <select value={form.municipality} onChange={e => setForm({ ...form, municipality: e.target.value, relatedReportIds: [] })} className={fieldClass}>
              <option value={ALL_KOSOVA}>{dt('Gjithë Kosova (niveli kombëtar)')}</option>
              {KOSOVO_MUNICIPALITIES.map(municipality => <option key={municipality}>{municipality}</option>)}
            </select>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value, isTicker: e.target.value === 'Njoftim Zyrtar' && form.isTicker })}
              className={fieldClass}
            >
              {NEWS_CATEGORIES.map(category => <option key={category} value={category}>{dt(category)}</option>)}
              {!NEWS_CATEGORIES.some(category => category === form.category) && (
                <option value={form.category}>{form.category} · {dt('kategori ekzistuese')}</option>
              )}
            </select>
            <input value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="URL e fotografisë kryesore (opsionale)" className={fieldClass} />
            <input value={form.inlineImageUrl} onChange={e => setForm({ ...form, inlineImageUrl: e.target.value })} placeholder="URL e fotos BRENDA lajmit (opsionale)" className={fieldClass} />
            <input value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })} placeholder="URL e videos (YouTube ose mp4, opsionale)" className={fieldClass} />
            <select value={form.position} onChange={e => setForm({ ...form, position: e.target.value as typeof form.position })} className={fieldClass}>
              <option value="featured">Ballina — lajm kryesor</option>
              <option value="feed">Arkivi — kartë lajmi</option>
              <option value="sidebar">Kolona anësore — të fundit</option>
            </select>
          </div>
          <label className={cn(
            'flex items-start gap-3 rounded-xl border p-4',
            form.category === 'Njoftim Zyrtar'
              ? 'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20'
              : 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-800/50 opacity-60'
          )}>
            <input
              type="checkbox"
              checked={form.isTicker}
              disabled={form.category !== 'Njoftim Zyrtar'}
              onChange={event => setForm({ ...form, isTicker: event.target.checked })}
              className="mt-0.5 h-4 w-4 accent-blue-700"
            />
            <span>
              <span className="block text-sm font-bold text-slate-900 dark:text-white">{dt('Shfaq edhe si njoftim kryesor')}</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {dt('Njoftimi shfaqet si shirit i dallueshëm nën navigimin kryesor në faqet publike dhe te Lajmet. Mund të hiqet në çdo kohë duke çaktivizuar këtë zgjedhje ose duke tërhequr publikimin.')}
              </span>
              {form.category !== 'Njoftim Zyrtar' && (
                <span className="mt-1 block text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  {dt('Zgjidhni kategorinë Njoftim Zyrtar për ta shfaqur në shiritin e njoftimeve.')}
                </span>
              )}
            </span>
          </label>
          <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20 sm:flex-row sm:items-center">
            {form.imageUrl && <img src={form.imageUrl} alt="Parapamja e fotos së lajmit" className={cn('w-full shrink-0 rounded-lg object-cover sm:w-40', form.position === 'featured' ? 'aspect-video' : 'aspect-[4/3]')} />}
            <div className="text-xs leading-relaxed text-blue-900 dark:text-blue-200">
              <p className="font-black">{form.position === 'featured' ? 'Ballina · imazh panoramik 16:9' : form.position === 'sidebar' ? 'Kolona anësore · imazh vertikal i shkurtër 4:3' : 'Arkivi i lajmeve · imazh landscape 4:3'}</p>
              <p className="mt-1">Ky pozicion përcakton vendin e lajmit në faqen publike. Përdorni imazh të qartë dhe të paktën 1200 px gjerësi për ballinën.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
            <fieldset className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
              <legend className="px-1 text-sm font-bold text-slate-900 dark:text-white">
                {dt('Raportime të lidhura —')} {form.municipality}
              </legend>
              <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {dt('Lidhni raportimet që ky njoftim i përgjigjet. Statusi i përgjigjes llogaritet vetë në faqen publike.')}
              </p>

              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {REPORT_STATE_FILTERS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setReportFilter(option.id)}
                    aria-pressed={reportFilter === option.id}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors',
                      reportFilter === option.id
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300'
                    )}
                  >
                    {dt(option.label)}
                  </button>
                ))}
              </div>

              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  value={reportQuery}
                  onChange={(event) => setReportQuery(event.target.value)}
                  placeholder={dt('Kërko sipas titullit, numrit ose adresës...')}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {linkableReports.map(report => {
                  const selected = form.relatedReportIds.includes(report.id);
                  return (
                    <label
                      key={report.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2 transition-colors',
                        selected ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => setForm(current => ({
                          ...current,
                          relatedReportIds: selected
                            ? current.relatedReportIds.filter(id => id !== report.id)
                            : [...current.relatedReportIds, report.id],
                        }))}
                        className="mt-0.5 h-4 w-4 accent-blue-700"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-100">{report.title}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                          {report.trackingId && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold dark:bg-slate-800">
                              {report.trackingId}
                            </span>
                          )}
                          <span>{report.status}</span>
                          {report.urgency === 'Kritike' && (
                            <span className="rounded-full bg-rose-100 px-1.5 py-0.5 font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                              {dt('Kritike')}
                            </span>
                          )}
                          <span className="truncate">{report.location?.address || dt('Pa adresë')}</span>
                        </span>
                      </span>
                    </label>
                  );
                })}
                {linkableReports.length === 0 && (
                  <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {reportFilter === 'all'
                      ? dt('Nuk ka raportime për këtë komunë.')
                      : dt('Asnjë raportim nuk përputhet me këtë filtër.')}
                  </p>
                )}
              </div>
            </fieldset>
            <div className="flex flex-col gap-4">
              {!editingId && (
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
                  <input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} className="h-4 w-4 accent-blue-700" />
                  {dt('Publikoje menjëherë')}
                </label>
              )}
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                <strong>{form.relatedReportIds.length} raportime</strong> do të lidhen me këtë njoftim për gjurmim të përgjigjes komunale.
              </div>
            </div>
          </div>
          <textarea required value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="Përmbledhja e shkurtër" className={`${fieldClass} min-h-24`} />
          <textarea required value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Përmbajtja e plotë e lajmit" className={`${fieldClass} min-h-40`} />

          {/* Live preview — exactly how the article renders publicly. */}
          <details open className="group rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-800/40">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-black text-slate-900 dark:text-white">
              {dt('Preview — si duket lajmi për publikun')}
            </summary>
            <article className="mx-4 mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
              {form.imageUrl && (
                <img src={form.imageUrl} alt="" className="aspect-video w-full object-cover" />
              )}
              <div className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{form.category}</span>
                  <span className="text-slate-400">{form.municipality === ALL_KOSOVA ? dt('Gjithë Kosova') : form.municipality}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400">{new Date().toLocaleDateString('sq-AL', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                  {form.position === 'featured' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{dt('Lajm kryesor')}</span>}
                  {form.isTicker && form.category === 'Njoftim Zyrtar' && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">{dt('Shirit njoftimesh')}</span>}
                </div>
                <h3 className="text-xl font-black leading-snug text-slate-900 dark:text-white">{form.title || dt('Titulli i lajmit do të shfaqet këtu')}</h3>
                <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{form.summary || dt('Përmbledhja e shkurtër e lajmit…')}</p>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{form.content}</div>
                {form.inlineImageUrl && (
                  <figure>
                    <img src={form.inlineImageUrl} alt="" className="w-full rounded-lg object-cover" />
                    <figcaption className="mt-1 text-[10px] text-slate-400">{dt('Foto brenda lajmit — shfaqet pas paraqitjes')}</figcaption>
                  </figure>
                )}
                {form.videoUrl && (
                  <div className="overflow-hidden rounded-lg">
                    {form.videoUrl.includes('youtube.com') || form.videoUrl.includes('youtu.be') ? (
                      <iframe
                        src={form.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                        title="Video e lajmit"
                        className="aspect-video w-full"
                        allowFullScreen
                      />
                    ) : (
                      <video src={form.videoUrl} controls className="w-full" />
                    )}
                  </div>
                )}
                {!!form.relatedReportIds.length && (
                  <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                    {form.relatedReportIds.length} {dt('raportime të lidhura me këtë lajm')}
                  </p>
                )}
              </div>
            </article>
          </details>
          <div className="flex justify-end">
            <button type="submit" className="px-5 py-3 rounded-xl bg-slate-950 text-white font-bold text-sm dark:bg-blue-700">{editingId ? dt('Ruaj tekstin') : form.published ? dt('Ruaj dhe publiko') : dt('Ruaj si draft')}</button>
          </div>
        </form>
      )}

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            {dt('Filtro')}
          </span>
          {([
            { id: 'all', label: 'Të gjitha' },
            { id: 'published', label: 'Të publikuara' },
            { id: 'draft', label: 'Drafts' },
            { id: 'rejected', label: 'Të refuzuara' },
            { id: 'linked', label: 'Me raportime' },
          ] as const).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setListFilter(option.id)}
              aria-pressed={listFilter === option.id}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors',
                listFilter === option.id
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300'
              )}
            >
              {dt(option.label)}
            </button>
          ))}
        </div>

        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            value={listQuery}
            onChange={(event) => setListQuery(event.target.value)}
            placeholder={dt('Kërko lajme...')}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visibleItems.map(item => {
          const openReports = openReportCount(item);
          return (
            <article key={item.id} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
              {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-24 h-24 rounded-xl object-cover shrink-0" /> : <div className="w-24 h-24 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0"><Newspaper className="w-8 h-8 text-blue-500" /></div>}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-black text-slate-900 dark:text-white line-clamp-2">{item.title}</h3>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      title="Redakto lajmin"
                      aria-label={`Redakto lajmin: ${item.title}`}
                      className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/30"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="rounded-lg p-2 text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/30" title={dt('Fshi lajmin')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">{item.municipality} · {item.category} · {item.date}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 line-clamp-2">{item.summary}</p>

                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  {item.isDemo && (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      {dt('Demo · skicë e pabotuar')}
                    </span>
                  )}
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    {item.position === 'featured' ? dt('Ballina') : item.position === 'sidebar' ? dt('Anësore') : dt('Arkivi')}
                  </span>
                  {item.isTicker && item.published && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                      {dt('Në shiritin e njoftimeve')}
                    </span>
                  )}
                  {!!item.relatedReportIds?.length && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
                      <Link2 className="h-3 w-3" aria-hidden="true" />
                      {item.relatedReportIds.length} {dt('të lidhura')}
                    </span>
                  )}
                  {openReports > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                      {openReports} {dt('akoma të hapura')}
                    </span>
                  )}
                  {!!item.relatedReportIds?.length && openReports === 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {dt('Të gjitha të zgjidhura')}
                    </span>
                  )}
                  {(() => {
                    const state = DECISION_KINDS.news.stateOf(item as any);
                    return (
                      <span className={cn(
                        'rounded-full px-2 py-0.5',
                        state === 'published'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : state === 'rejected'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      )}>
                        {state === 'published' ? dt('Publikuar') : state === 'rejected' ? dt('Refuzuar') : dt('Draft')}
                      </span>
                    );
                  })()}
                </div>
                {item.isDemo ? (
                  <p className="mt-3 text-[11px] text-amber-700 dark:text-amber-300">{dt('Redaktojeni dhe ruajeni shembullin para publikimit.')}</p>
                ) : (
                  <DecisionBar kind="news" id={item.id} doc={item as any} className="mt-3" />
                )}
              </div>
            </article>
          );
        })}
        {visibleItems.length === 0 && (
          <div className="lg:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900">
            {items.length === 0
              ? dt('Nuk ka ende lajme të krijuara nga administrata.')
              : dt('Asnjë lajm nuk përputhet me këtë filtër.')}
          </div>
        )}
      </div>
    </div>
  );
}

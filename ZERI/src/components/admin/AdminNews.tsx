import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc, writeBatch, query, limit, orderBy } from 'firebase/firestore';
import DecisionBar from './DecisionBar';
import { DECISION_KINDS } from '../../lib/decisionRules';
import { takeDecision } from '../../lib/decisionsApi';
import { Link2, Newspaper, Plus, Search, Trash2, X, Filter, Pencil, Send, Save, Wand2, Image as ImageIcon, Eye } from 'lucide-react';
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
import NewsPlacementPreview from './NewsPlacementPreview';
import { layoutNews } from '../../lib/newsPlacement';
import { askConfirm, askReason } from '../../lib/dialogs';

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

const POSITION_OPTIONS: { id: NewsPosition; title: string; where: string; ratio: string }[] = [
  { id: 'featured', title: 'Kryesor', where: 'Lajmi i madh në ballinë e /lajme', ratio: 'Foto 16:9' },
  { id: 'feed', title: 'Normal', where: 'Rrjedha sipas datës + arkivi', ratio: 'Foto 4:3' },
  { id: 'sidebar', title: 'Anësor', where: 'Kolona djathtas «Lajmet kryesore»', ratio: 'Foto 4:3' },
];

const DRAFT_KEY = 'zeri-admin-news-draft';

/** First sentences of the body, trimmed to a card-sized lead. */
const autoSummary = (content: string) => {
  const flat = content.replace(/\s+/g, ' ').trim();
  if (flat.length <= 180) return flat;
  const cut = flat.slice(0, 180);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 120))}…`;
};

const readTimeOf = (content: string) => `${Math.max(1, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 200))} min lexim`;

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
  const [saving, setSaving] = useState(false);
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

  /** Where every live article sits on /lajme right now, computed by the page's own layout function. */
  const livePlacement = useMemo(() => {
    const live = items
      .filter(item => item.published === true && !item.isDemo)
      .sort((a, b) => (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0));
    const layout = layoutNews(live);
    const map = new Map<string, string[]>();
    const add = (id: string, label: string) => map.set(id, [...(map.get(id) ?? []), label]);
    if (layout.lead) add(layout.lead.id, 'Kryesor');
    layout.latest.forEach((a, i) => add(a.id, `Majtas #${i + 1}`));
    layout.rail.forEach((a, i) => add(a.id, `Djathtas #${i + 1}`));
    layout.ticker.forEach((a, i) => add(a.id, `Të fundit #${i + 1}`));
    return map;
  }, [items]);

  useEffect(() => onSnapshot(
    query(collection(db, 'newsArticles'), orderBy('createdAt', 'desc'), limit(STAFF_LIMITS.newsArticles)),
    snapshot => {
      setItems(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as AdminNewsItem)));
    },
    () => setItems([]),
  ), []);

  type SaveIntent = 'publish' | 'publishNext' | 'draft';

  const save = async (intent: SaveIntent) => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error(dt('Shkruani të paktën titullin dhe tekstin e lajmit.'));
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const id = editingId ?? `news-${Date.now()}`;
      const existingItem = items.find(item => item.id === editingId);
      const { published: _ignored, ...fields } = form;
      const articleData = {
        ...fields,
        title: form.title.trim(),
        summary: form.summary.trim() || autoSummary(form.content),
        isDemo: false,
        isTicker: form.category === 'Njoftim Zyrtar' && form.isTicker,
        id,
        author: existingItem?.author || 'Administrata e Zërit të Qytetarëve',
        readTime: readTimeOf(form.content),
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
      const wantsPublish = intent !== 'draft' && !editingId;
      let published = existingItem?.published === true;
      if (wantsPublish) {
        try {
          await takeDecision('news', id, 'publish');
          published = true;
        } catch (error) {
          toast.error(`${dt('Lajmi u ruajt si draft, por nuk u publikua:')} ${(error as Error).message}`);
        }
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* storage unavailable */ }
      setForm(emptyForm);
      setEditingId(null);
      setIsCreating(intent === 'publishNext');
      if (intent === 'publishNext') window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success(
        editingId ? dt('Lajmi u përditësua me sukses.')
          : published ? dt('Lajmi u publikua — është live në /lajme.')
            : dt('Lajmi u ruajt si draft.'),
      );
    } catch (error) {
      console.error('Gabim gjatë ruajtjes së lajmit:', error);
      toast.error(dt('Lajmi nuk u ruajt. Provoni përsëri.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void save('publish');
  };

  /** Rank an article straight from the list: one click, no editor. */
  const setPosition = async (item: AdminNewsItem, position: NewsPosition) => {
    if (item.position === position) return;
    try {
      await updateDoc(doc(db, 'newsArticles', item.id), { position, updatedAt: new Date().toISOString() });
      toast.success(dt('Pozicioni u ndryshua.'));
    } catch {
      toast.error(dt('Pozicioni nuk u ndryshua.'));
    }
  };

  // Keep an unsent new article in this browser so a refresh never loses it.
  useEffect(() => {
    if (!isCreating || editingId) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch { /* storage unavailable */ }
  }, [form, isCreating, editingId]);

  const openNew = () => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setForm({ ...emptyForm, ...JSON.parse(saved) });
    } catch { /* ignore corrupt draft */ }
    setIsCreating(true);
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
    if (!await askConfirm(dt('A dëshironi ta hiqni këtë lajm?'))) return;
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
          <button onClick={() => isCreating ? closeEditor() : openNew()} className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">
            {isCreating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{isCreating ? 'Mbyll redaktorin' : 'Lajm i ri'}
          </button>
        </div>
      </div>

      {isCreating && (
        <form
          onSubmit={handleSubmit}
          onKeyDown={event => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              void save(editingId ? 'draft' : 'publishNext');
            }
          }}
          className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)]"
        >
          {/* LEFT — write it */}
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-7">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{editingId ? dt('Redakto lajmin') : dt('Lajm i ri')}</h3>
              <span className="text-[11px] font-semibold text-slate-400">{dt('Ctrl + Enter = publiko dhe hap tjetrin')}</span>
            </div>

            <input
              required
              autoFocus
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder={dt('Titulli i lajmit')}
              className={cn(fieldClass, 'text-lg font-black')}
            />

            {/* 1 — category */}
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">1 · {dt('Kategoria')}</p>
              <div className="flex flex-wrap gap-1.5">
                {NEWS_CATEGORIES.map(category => (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={form.category === category}
                    onClick={() => setForm({ ...form, category, isTicker: category === 'Njoftim Zyrtar' && form.isTicker })}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                      form.category === category
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300',
                    )}
                  >
                    {dt(category)}
                  </button>
                ))}
                {!NEWS_CATEGORIES.some(category => category === form.category) && (
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">{form.category} · {dt('kategori ekzistuese')}</span>
                )}
              </div>
              {form.category === 'Njoftim Zyrtar' && (
                <label className="mt-3 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
                  <input type="checkbox" checked={form.isTicker} onChange={event => setForm({ ...form, isTicker: event.target.checked })} className="mt-0.5 h-4 w-4 accent-blue-700" />
                  <span className="text-xs leading-relaxed text-blue-900 dark:text-blue-200">
                    <strong>{dt('Shfaq edhe si shirit njoftimi')}</strong> — {dt('shirit i dallueshëm nën navigimin kryesor në faqet publike.')}
                  </span>
                </label>
              )}
            </div>

            {/* 2 — where */}
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">2 · {dt('Ku del në faqe')}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {POSITION_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={form.position === option.id}
                    onClick={() => setForm({ ...form, position: option.id })}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-colors',
                      form.position === option.id
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200 dark:bg-blue-950/30 dark:ring-blue-800'
                        : 'border-slate-200 hover:border-blue-300 dark:border-white/10',
                    )}
                  >
                    <span className="block text-sm font-black text-slate-900 dark:text-white">{dt(option.title)}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">{dt(option.where)}</span>
                    <span className="mt-1.5 block text-[11px] font-bold text-blue-700 dark:text-blue-300">{dt(option.ratio)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3 — content */}
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">3 · {dt('Teksti')}</p>
              <textarea required value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder={dt('Përmbajtja e plotë e lajmit')} className={`${fieldClass} min-h-48`} />
              <div className="relative">
                <textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder={dt('Përmbledhja e shkurtër (bosh = nxirret vetë nga teksti)')} className={`${fieldClass} min-h-20 pr-28`} />
                <button
                  type="button"
                  onClick={() => setForm(current => ({ ...current, summary: autoSummary(current.content) }))}
                  disabled={!form.content.trim()}
                  className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-200"
                >
                  <Wand2 className="h-3 w-3" /> {dt('Gjenero')}
                </button>
              </div>
            </div>

            {/* 4 — media + municipality */}
            <details open={Boolean(form.imageUrl || form.inlineImageUrl || form.videoUrl)} className="rounded-xl border border-slate-200 dark:border-white/10">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-100">
                <ImageIcon className="mr-1.5 inline h-4 w-4" /> 4 · {dt('Foto, video dhe komuna')}
              </summary>
              <div className="grid gap-3 p-4 pt-0 md:grid-cols-2">
                <select value={form.municipality} onChange={e => setForm({ ...form, municipality: e.target.value, relatedReportIds: [] })} className={fieldClass}>
                  <option value={ALL_KOSOVA}>{dt('Gjithë Kosova (niveli kombëtar)')}</option>
                  {KOSOVO_MUNICIPALITIES.map(municipality => <option key={municipality}>{municipality}</option>)}
                </select>
                <input value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="URL e fotografisë kryesore" className={fieldClass} />
                <input value={form.inlineImageUrl} onChange={e => setForm({ ...form, inlineImageUrl: e.target.value })} placeholder="URL e fotos BRENDA lajmit" className={fieldClass} />
                <input value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })} placeholder="URL e videos (YouTube ose mp4)" className={fieldClass} />
              </div>
            </details>

            {/* 5 — linked reports (optional) */}
            <details open={form.relatedReportIds.length > 0} className="rounded-xl border border-slate-200 dark:border-white/10">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-100">
                <Link2 className="mr-1.5 inline h-4 w-4" /> 5 · {dt('Raportime të lidhura')} ({form.relatedReportIds.length}) <span className="font-normal text-slate-400">— {dt('opsionale')}</span>
              </summary>
              <div className="p-4 pt-0">
                <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {dt('Lidhni raportimet që ky njoftim i përgjigjet.')} {form.municipality}
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
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300',
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
                          selected ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800',
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
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {report.trackingId && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold dark:bg-slate-800">{report.trackingId}</span>}
                            <span>{report.status}</span>
                            {report.urgency === 'Kritike' && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{dt('Kritike')}</span>}
                            <span className="truncate">{report.location?.address || dt('Pa adresë')}</span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  {linkableReports.length === 0 && (
                    <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {reportFilter === 'all' ? dt('Nuk ka raportime për këtë komunë.') : dt('Asnjë raportim nuk përputhet me këtë filtër.')}
                    </p>
                  )}
                </div>
              </div>
            </details>
          </div>

          {/* RIGHT — see it, then send it */}
          <div className="space-y-4 xl:sticky xl:top-4">
            <NewsPlacementPreview
              items={items}
              editingId={editingId}
              draft={{ title: form.title, category: form.category, position: form.position, imageUrl: form.imageUrl }}
              willBePublic={editingId ? items.find(item => item.id === editingId)?.published === true : true}
            />

            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
              <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:border-white/10">
                <Eye className="h-3.5 w-3.5" /> {dt('Si duket për publikun')}
              </div>
              {form.imageUrl && <img src={form.imageUrl} alt="" className="aspect-video w-full object-cover" />}
              <div className="max-h-[28rem] space-y-3 overflow-y-auto p-5">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{dt(form.category)}</span>
                  <span className="text-slate-400">{form.municipality === ALL_KOSOVA ? dt('Gjithë Kosova') : form.municipality}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400">{readTimeOf(form.content)}</span>
                  {form.isTicker && form.category === 'Njoftim Zyrtar' && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">{dt('Shirit njoftimesh')}</span>}
                </div>
                <h3 className="text-xl font-black leading-snug text-slate-900 dark:text-white">{form.title || dt('Titulli i lajmit do të shfaqet këtu')}</h3>
                <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{form.summary || autoSummary(form.content) || dt('Përmbledhja e shkurtër e lajmit…')}</p>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{form.content}</div>
                {form.inlineImageUrl && <img src={form.inlineImageUrl} alt="" className="w-full rounded-lg object-cover" />}
                {form.videoUrl && (
                  <div className="overflow-hidden rounded-lg">
                    {form.videoUrl.includes('youtube.com') || form.videoUrl.includes('youtu.be') ? (
                      <iframe src={form.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} title="Video e lajmit" className="aspect-video w-full" allowFullScreen />
                    ) : (
                      <video src={form.videoUrl} controls className="w-full" />
                    )}
                  </div>
                )}
              </div>
            </article>

            <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              {editingId ? (
                <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60">
                  <Save className="h-4 w-4" /> {dt('Ruaj ndryshimet')}
                </button>
              ) : (
                <>
                  <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60">
                    <Send className="h-4 w-4" /> {dt('Publiko tani')}
                  </button>
                  <button type="button" disabled={saving} onClick={() => void save('publishNext')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-700">
                    <Plus className="h-4 w-4" /> {dt('Publiko dhe shkruaj tjetrin')}
                  </button>
                  <button type="button" disabled={saving} onClick={() => void save('draft')} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800">
                    {dt('Ruaj vetëm si draft')}
                  </button>
                </>
              )}
              <p className="text-center text-[11px] text-slate-400">{dt('Skica ruhet automatikisht në këtë shfletues derisa ta dërgoni.')}</p>
            </div>
          </div>
        </form>
      )}

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
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
                {!!livePlacement.get(item.id)?.length && (
                  <p className="mt-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    {dt('Live në')}: {livePlacement.get(item.id)!.join(' · ')}
                  </p>
                )}
                {!item.isDemo && (
                  <div className="mt-2.5 inline-flex overflow-hidden rounded-lg border border-slate-200 text-[11px] font-bold dark:border-white/10" role="group" aria-label={dt('Pozicioni')}>
                    {POSITION_OPTIONS.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => void setPosition(item, option.id)}
                        aria-pressed={(item.position ?? 'feed') === option.id}
                        className={cn(
                          'px-2.5 py-1 transition-colors',
                          (item.position ?? 'feed') === option.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-600 hover:bg-blue-50 dark:bg-slate-800 dark:text-slate-300',
                        )}
                      >
                        {dt(option.title)}
                      </button>
                    ))}
                  </div>
                )}
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

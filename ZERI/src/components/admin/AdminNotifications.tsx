import { dt } from '@/src/lib/dt';
import toast from 'react-hot-toast';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Bell, Send, Trash2, Search, CheckSquare, Square, X, ArrowRight, Newspaper,
  Pencil, Megaphone, Eye, EyeOff, Archive, Save, AlertTriangle,
} from 'lucide-react';
import { useStore } from '../../lib/store';
import type { AppNotification, NotificationCategory, NotificationPriority, NotificationState } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { sq } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where, limit } from 'firebase/firestore';
import { PLACEMENTS, PLACEMENT_META, placementsOf, type NotificationPlacement } from '../../lib/notificationPlacements';
import { askConfirm } from '../../lib/dialogs';

/**
 * Admin control centre for the bell's "Njoftime" (general broadcast) channel.
 *
 * Full CRUD over the `notifications` collection restricted to broadcasts
 * (`audience === 'all'`). Every broadcast carries a lifecycle `state`
 * (draft → published → archived/disabled), a category, a priority and an
 * optional deep link — the same fields the public bell reads, so what an admin
 * composes here is exactly what citizens see. Only published broadcasts reach
 * non-staff (enforced in firestore.rules); staff see the whole queue here.
 */

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  platform: 'Platformë',
  administration: 'Administratë',
  municipality: 'Komunë',
  public: 'Publike',
  urgent: 'Urgjente',
  maintenance: 'Mirëmbajtje',
  feature: 'Veçori e re',
  report: 'Raportim',
};

const STATE_META: Record<NotificationState, { label: string; badge: string; icon: typeof Eye }> = {
  draft: { label: 'Draft', badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-white/10', icon: EyeOff },
  published: { label: 'Publikuar', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50', icon: Eye },
  archived: { label: 'Arkivuar', badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50', icon: Archive },
  disabled: { label: 'Çaktivizuar', badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50', icon: EyeOff },
};

const TYPE_LABELS: Record<string, string> = { info: 'Info', success: 'Sukses', alert: 'Kujdes' };

/** Legacy docs may carry a malformed createdAt; never let one crash the grid. */
function safeRelative(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return formatDistanceToNow(d, { locale: sq, addSuffix: true });
  } catch {
    return '';
  }
}

interface FormState {
  title: string;
  message: string;
  type: NonNullable<AppNotification['type']>;
  category: NotificationCategory;
  priority: NotificationPriority;
  urgent: boolean;
  link: string;
  state: NotificationState;
  placements: NotificationPlacement[];
  /** datetime-local value, '' = never expires */
  expiresAt: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  message: '',
  type: 'info',
  category: 'platform',
  priority: 'normal',
  urgent: false,
  link: '',
  state: 'published',
  placements: ['bell'],
  expiresAt: '',
};

export default function AdminNotifications({ onOpenPublicNews }: { onOpenPublicNews?: () => void }) {
  const currentUser = useStore((s) => s.currentUser);

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<NotificationState | 'all'>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 8;

  // Broadcasts only. A single-field filter needs no composite index; we sort and
  // paginate client-side. The limit keeps the admin queue bounded at scale.
  useEffect(() => {
    const q = query(collection(db, 'notifications'), where('audience', '==', 'all'), limit(200));
    return onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs.map((d) => {
          const data = d.data() as any;
          const createdAt = data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : typeof data.createdAt === 'string'
              ? data.createdAt
              : new Date().toISOString();
          return { ...data, id: d.id, createdAt } as AppNotification;
        });
        mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setItems(mapped);
        setLoading(false);
      },
      (err) => {
        console.error('Njoftimet nuk u ngarkuan:', err);
        setLoading(false);
      },
    );
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setIsCreating(true);
  };

  const openEdit = (n: AppNotification) => {
    setForm({
      title: n.title || '',
      message: n.message || '',
      type: n.type || 'info',
      category: (n.category || 'platform') as NotificationCategory,
      priority: (n.priority || 'normal') as NotificationPriority,
      urgent: Boolean(n.urgent),
      link: n.link || '',
      state: (n.state || 'published') as NotificationState,
      placements: placementsOf(n),
      expiresAt: n.expiresAt ? new Date(n.expiresAt).toISOString().slice(0, 16) : '',
    });
    setEditingId(n.id);
    setIsCreating(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setIsCreating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const buildPayload = (): Record<string, unknown> => ({
    title: form.title.trim(),
    message: form.message.trim(),
    type: form.type,
    category: form.category,
    priority: form.priority,
    urgent: form.urgent,
    link: form.link.trim() || null,
    state: form.state,
    placements: Array.from(new Set<NotificationPlacement>(['bell', ...form.placements])),
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    channel: 'general',
    audience: 'all',
    sender: 'Komunikimi Publik',
    createdBy: currentUser?.id || currentUser?.email || 'admin',
    isRead: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;
    setSaving(true);
    try {
      const ref = editingId ? doc(db, 'notifications', editingId) : doc(collection(db, 'notifications'));
      const payload = buildPayload();
      // Preserve the original createdAt when editing so ordering stays stable.
      if (editingId) {
        await setDoc(ref, payload, { merge: true });
      } else {
        await setDoc(ref, { ...payload, createdAt: new Date().toISOString() });
      }
      closeForm();
    } catch (error) {
      console.error('Gabim gjatë ruajtjes së njoftimit', error);
      toast.error(dt('Njoftimi nuk u ruajt. Provoni përsëri.'));
    } finally {
      setSaving(false);
    }
  };

  const changeState = useCallback(async (id: string, state: NotificationState) => {
    try {
      await setDoc(doc(db, 'notifications', id), { state }, { merge: true });
      toast.success(dt('Gjendja e njoftimit u ndryshua.'));
    } catch (err) {
      console.error('Gabim gjatë ndryshimit të gjendjes', err);
      toast.error(dt('Gjendja nuk u ndryshua. Kontrolloni lejet dhe provoni përsëri.'));
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!await askConfirm(dt('A jeni i sigurt që dëshironi ta fshini këtë njoftim?'))) return;
    try {
      await deleteDoc(doc(db, 'notifications', id));
      toast.success(dt('Njoftimi u fshi.'));
    } catch (err) {
      console.error('Gabim gjatë fshirjes', err);
      toast.error(dt('Njoftimi nuk u fshi. Kontrolloni lejet dhe provoni përsëri.'));
    }
  }, []);

  const handleBulkDelete = async () => {
    if (!await askConfirm(`A jeni të sigurt që dëshironi të fshini ${selectedIds.size} njoftime?`)) return;
    // Count what really happened: "deleted" must never mean "tried".
    let deleted = 0;
    const kept = new Set<string>();
    for (const id of selectedIds) {
      try {
        await deleteDoc(doc(db, 'notifications', id));
        deleted += 1;
      } catch (err) {
        console.error('Failed to delete notification', id, err);
        kept.add(id);
      }
    }
    // Whatever could not be deleted stays selected so it can be tried again.
    setSelectedIds(kept);
    if (kept.size === 0) toast.success(`${deleted} njoftime u fshinë.`);
    else toast.error(`U fshinë ${deleted}; ${kept.size} nuk u fshinë (kontrolloni lejet).`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let result = items;
    if (stateFilter !== 'all') result = result.filter((n) => (n.state || 'published') === stateFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) => n.title?.toLowerCase().includes(q) || n.message?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [items, searchQuery, stateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const publishedCount = items.filter((n) => (n.state || 'published') === 'published').length;

  const stateCounts = useMemo(() => {
    const c: Record<string, number> = { all: items.length, draft: 0, published: 0, archived: 0, disabled: 0 };
    for (const n of items) c[(n.state || 'published') as string] = (c[(n.state || 'published') as string] || 0) + 1;
    return c;
  }, [items]);

  const inputCls =
    'w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm font-medium outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition';

  return (
    <div className="space-y-6 max-w-full mx-auto">
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-2">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight title-serif flex items-center gap-3">
            <Bell className="w-8 h-8 text-indigo-600" />
            {dt('Paneli i Njoftimeve')}
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
            {dt('Njoftimet e përgjithshme që shfaqen në zilen e qytetarëve (kategoria “Njoftime”).')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto items-start xl:items-center">
          <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
            <div className="px-5 py-2 flex flex-col items-center min-w-[6rem]">
              <span className="text-lg font-bold title-serif leading-none text-slate-900 dark:text-white">{publishedCount}</span>
              <span className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold mt-1">{dt('Aktive')}</span>
            </div>
            <div className="px-5 py-2 flex flex-col items-center min-w-[6rem] border-l border-slate-200 dark:border-white/10">
              <span className="text-lg font-bold title-serif leading-none text-slate-900 dark:text-white">{items.length}</span>
              <span className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold mt-1">{dt('Gjithsej')}</span>
            </div>
          </div>

          <button
            onClick={() => (isCreating && !editingId ? closeForm() : openCreate())}
            className={cn(
              'flex items-center justify-center gap-2 px-6 py-3.5 font-bold text-sm transition rounded-xl shadow-sm dark:shadow-none hover:shadow active:scale-95 w-full sm:w-auto',
              isCreating && !editingId
                ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                : 'bg-slate-900 text-white hover:bg-slate-800 border border-slate-800',
            )}
          >
            {isCreating && !editingId ? <X className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {isCreating && !editingId ? dt('Mbyll Formularin') : dt('Njoftim i Ri')}
          </button>
        </div>
      </div>

      <aside className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-900/50 dark:bg-blue-950/20 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          <strong className="font-black text-slate-900 dark:text-white">{dt('Çdo njoftim del te zilja. Zgjidhni më poshtë nëse del edhe si banner në ballinë, si pop-up ose në krye të Lajmeve.')}</strong>{' '}
          {dt('Artikujt e lajmeve publikohen te Lajmet; ky panel është për njoftime të shkurtra.')}
        </p>
        {onOpenPublicNews && (
          <button
            type="button"
            onClick={onOpenPublicNews}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-black text-white transition hover:bg-blue-800"
          >
            <Newspaper className="h-4 w-4" />
            {dt('Menaxho njoftimet publike')}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </aside>

      {/* FORM */}
      <AnimatePresence>
        {isCreating && (
          <motion.form
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900 p-6 md:p-10 border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none rounded-2xl space-y-6"
          >
            <div className="border-b border-slate-100 dark:border-white/5 pb-5 mb-2 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight title-serif">
                {editingId ? dt('Modifiko Njoftimin') : dt('Njoftim i Ri i Përgjithshëm')}
              </h3>
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-[6px] text-[11px] font-bold tracking-widest uppercase dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50">
                {dt('Transmetim Publik')}
              </span>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt('Titulli')}</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder={dt('psh. Rrjeti i Ujësjellësit')} required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt('Përmbajtja (Mesazhi)')}</label>
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={cn(inputCls, 'min-h-[120px] resize-y')} placeholder={dt('Shkruani detajet e njoftimit...')} required />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt('Lloji')}</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className={inputCls}>
                  <option value="info">{dt('Informacion')}</option>
                  <option value="success">{dt('Sukses / Zgjidhje')}</option>
                  <option value="alert">{dt('Kujdes / Paralajmërim')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt('Kategoria')}</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as NotificationCategory })} className={inputCls}>
                  {(Object.keys(CATEGORY_LABELS) as NotificationCategory[])
                    .filter((c) => c !== 'report')
                    .map((c) => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt('Prioriteti')}</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as NotificationPriority })} className={inputCls}>
                  <option value="low">{dt('I ulët')}</option>
                  <option value="normal">{dt('Normal')}</option>
                  <option value="high">{dt('I lartë')}</option>
                  <option value="urgent">{dt('Urgjent')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt('Gjendja')}</label>
                <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value as NotificationState })} className={inputCls}>
                  <option value="draft">{STATE_META.draft.label}</option>
                  <option value="published">{STATE_META.published.label}</option>
                  <option value="archived">{STATE_META.archived.label}</option>
                  <option value="disabled">{STATE_META.disabled.label}</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt('Lidhja (opsionale) — ku të çon klikimi')}</label>
                <input type="text" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className={inputCls} placeholder="/lajme ose /trackid?id=..." />
                <p className="mt-1.5 text-[11px] text-slate-400">{dt('Përdorni një rrugë të brendshme, psh. /lajme. Lini bosh nëse njoftimi nuk ka faqe destinacion.')}</p>
              </div>

              <fieldset className="md:col-span-2 rounded-xl border border-slate-200/60 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800">
                <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-300">{dt('Ku do të dalë ky njoftim')}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PLACEMENTS.map(p => {
                    const meta = PLACEMENT_META[p];
                    const on = p === 'bell' || form.placements.includes(p);
                    return (
                      <label key={p} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm', on ? 'border-indigo-300 bg-white dark:border-indigo-500/50 dark:bg-slate-900' : 'border-slate-200 dark:border-white/10', p === 'bell' && 'cursor-default')}>
                        <input type="checkbox" className="mt-1 h-4 w-4 accent-indigo-600" checked={on} disabled={p === 'bell'}
                          onChange={(e) => setForm({ ...form, placements: e.target.checked ? [...form.placements, p] : form.placements.filter(x => x !== p) })} />
                        <span>
                          <span className="block font-bold text-slate-900 dark:text-white">{dt(meta.label)}</span>
                          <span className="block text-xs text-slate-500">{dt(meta.where)}</span>
                          <span className="block text-[11px] text-slate-400">{dt(meta.behaviour)}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{dt('Skadon më (opsionale)')}
                    <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={inputCls + ' mt-1'} />
                  </label>
                  <p className="self-end text-[11px] text-slate-500">
                    {form.state === 'published' ? dt('Do të dalë menjëherë pas ruajtjes.') : dt('Nuk do të dalë askund derisa gjendja të jetë "Publikuar".')}
                    {form.urgent && form.placements.includes('popup') ? ` ${dt('Është urgjente: pop-up-i shfaqet para çdo gjëje tjetër.')}` : ''}
                  </p>
                </div>

                {/* What the visitor will actually see, drawn from what is typed above. */}
                <div className="mt-4 space-y-2" aria-label={dt('Parapamje')}>
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{dt('Parapamje')}</p>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs dark:border-white/10 dark:bg-slate-900">
                    <Bell className="h-4 w-4 shrink-0 text-indigo-600" />
                    <span className="min-w-0 flex-1 truncate"><b>{form.title || dt('Titulli')}</b> · {form.message || dt('Mesazhi')}</span>
                    {form.urgent && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-600" />}
                    <span className="shrink-0 text-[11px] font-bold uppercase text-slate-400">{dt('Zilja')}</span>
                  </div>
                  {form.placements.includes('banner') && (
                    <div className={cn('flex items-center gap-2 rounded-lg border p-2.5 text-xs', form.urgent ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-blue-200 bg-blue-50 text-blue-900')}>
                      <Megaphone className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate"><b>{form.title || dt('Titulli')}</b> {form.message}</span><X className="h-3.5 w-3.5 shrink-0" />
                      <span className="shrink-0 text-[11px] font-bold uppercase opacity-60">{dt('Banner')}</span>
                    </div>
                  )}
                  {form.placements.includes('news') && (
                    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-900">
                      <Newspaper className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate"><b>{form.title || dt('Titulli')}</b> {form.message}</span>
                      <span className="shrink-0 text-[11px] font-bold uppercase opacity-60">{dt('Krye i Lajmeve')}</span>
                    </div>
                  )}
                  {form.placements.includes('popup') && (
                    <div className="mx-auto max-w-xs rounded-2xl border border-slate-200 bg-white p-4 text-xs shadow-lg dark:border-white/10 dark:bg-slate-900">
                      <p className="text-[11px] font-bold uppercase text-slate-400">{dt('Pop-up')}</p>
                      <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{form.title || dt('Titulli')}</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">{form.message || dt('Mesazhi')}</p>
                    </div>
                  )}
                </div>
              </fieldset>

              <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-4 py-3 cursor-pointer">
                <input type="checkbox" checked={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.checked })} className="h-4 w-4 accent-rose-600" />
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  {dt('Shëno si urgjente (tregon tregues të kuq në zilje)')}
                </span>
              </label>
            </div>

            <div className="flex justify-end pt-6 border-t border-slate-100 dark:border-white/5 gap-3">
              <button type="button" onClick={closeForm} className="px-6 py-3 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold border border-slate-200/60 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                {dt('Anulo')}
              </button>
              <button type="submit" disabled={saving || !form.title.trim() || !form.message.trim()} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors rounded-xl shadow-sm dark:shadow-none tracking-wide disabled:opacity-50 flex items-center gap-2">
                <Save className="w-4 h-4" />
                {saving ? dt('Duke ruajtur...') : editingId ? dt('Ruaj Ndryshimet') : dt('Dërgo Njoftimin')}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* TOOLBAR */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm dark:shadow-none border border-slate-100 dark:border-white/5">
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={dt('Kërko me fjalë kyçe...')}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm font-medium placeholder:text-slate-400 outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'published', 'draft', 'archived', 'disabled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStateFilter(s); setCurrentPage(1); }}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-bold border transition-colors',
                stateFilter === s
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-700',
              )}
            >
              {s === 'all' ? dt('Të gjitha') : STATE_META[s].label}
              <span className="ml-1.5 opacity-70">{stateCounts[s] ?? 0}</span>
            </button>
          ))}
          {selectedIds.size > 0 && (
            <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
              {dt('Fshi')} ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-400 text-sm">{dt('Duke ngarkuar...')}</div>
        ) : (
          <AnimatePresence mode="popLayout">
            {paginated.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full py-20 text-center bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-white/5">
                  <Megaphone className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 title-serif">{dt("S'ka Rezultate")}</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium">{dt('Asnjë njoftim nuk u gjet për këtë filtër.')}</p>
              </motion.div>
            ) : (
              paginated.map((n) => {
                const isSelected = selectedIds.has(n.id);
                const state = (n.state || 'published') as NotificationState;
                const meta = STATE_META[state];
                const StateIcon = meta.icon;
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={n.id}
                    className={cn(
                      'bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none hover:shadow transition relative group flex flex-col items-start gap-3',
                      isSelected && 'ring-2 ring-indigo-500',
                      state === 'draft' && 'opacity-90',
                    )}
                  >
                    <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
                      <button
                        onClick={() => openEdit(n)}
                        title={dt('Modifiko')}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-transparent hover:border-indigo-100 bg-white dark:bg-slate-900 shadow-sm dark:shadow-none"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(n.id)}
                        title={dt('Fshi')}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-100 bg-white dark:bg-slate-900 shadow-sm dark:shadow-none"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleSelect(n.id)}
                        title={dt('Zgjidh')}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors bg-white/90 rounded-xl shadow-sm dark:shadow-none border border-slate-200/60 dark:border-white/10"
                      >
                        {isSelected ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pr-16">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-[11px] uppercase font-bold tracking-wide rounded border', meta.badge)}>
                        <StateIcon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      {placementsOf(n).filter(p => p !== 'bell').map(p => (
                        <span key={p} className="px-2 py-0.5 text-[11px] uppercase font-bold tracking-wide rounded border bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50">{dt(PLACEMENT_META[p].label)}</span>
                      ))}
                      {n.expiresAt && (
                        <span className="px-2 py-0.5 text-[11px] font-bold tracking-wide rounded border bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-white/10">{dt('skadon')} {new Date(n.expiresAt).toLocaleDateString('sq-AL')}</span>
                      )}
                      {n.urgent && (
                        <span className="px-2 py-0.5 text-[11px] uppercase font-bold tracking-wide rounded border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50">
                          {dt('Urgjente')}
                        </span>
                      )}
                      <span className="px-2 py-0.5 text-[11px] uppercase font-bold tracking-wide rounded border bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-white/10">
                        {TYPE_LABELS[n.type || 'info']}
                      </span>
                    </div>

                    <div className="min-w-0 w-full flex-1">
                      <h4 className="font-bold text-slate-900 dark:text-white tracking-tight text-base mb-1.5 line-clamp-2 leading-snug">{n.title}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">{n.message}</p>
                      {n.category && (
                        <p className="mt-2 text-[11px] font-semibold text-slate-400">
                          {CATEGORY_LABELS[n.category] || n.category}
                          {n.link ? <> · <span className="text-indigo-500">{n.link}</span></> : null}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between w-full border-t border-slate-100 dark:border-white/5 pt-3">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        {safeRelative(n.createdAt)}
                      </span>
                      {state !== 'published' ? (
                        <button onClick={() => changeState(n.id, 'published')} className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-500 transition-colors">
                          <Eye className="w-3.5 h-3.5" />{dt('Publiko')}
                        </button>
                      ) : (
                        <button onClick={() => changeState(n.id, 'archived')} className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-500 transition-colors">
                          <Archive className="w-3.5 h-3.5" />{dt('Arkivo')}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        )}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none flex flex-col sm:flex-row gap-4 items-center justify-between">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {dt('Shfaqur')} <strong className="text-slate-900 dark:text-white">{(page - 1) * itemsPerPage + 1}–{Math.min(page * itemsPerPage, filtered.length)}</strong> {dt('nga')} <strong className="text-slate-900 dark:text-white">{filtered.length}</strong>
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-2 border border-slate-200/60 dark:border-white/10 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-500 dark:text-slate-400 transition-colors text-sm font-medium">
              {dt('Kthehu')}
            </button>
            <div className="flex items-center px-4 font-bold title-serif text-slate-900 dark:text-white text-lg">{page} / {totalPages}</div>
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-2 border border-slate-200/60 dark:border-white/10 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-500 dark:text-slate-400 transition-colors text-sm font-medium">
              {dt('Vazhdo')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { dt } from '@/src/lib/dt';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Video, Plus, Pencil, Trash2, Search, X, Save, Upload, Link2, Loader2
} from 'lucide-react';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import { db, uploadFileToStorage } from '../../lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import DecisionBar from './DecisionBar';
import { takeDecision } from '../../lib/decisionsApi';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import { askConfirm, askReason } from '../../lib/dialogs';

/**
 * "Menaxhimi i Videove" — the admin manager for public video content.
 *
 * Videos are stored as `newsArticles` documents that carry a `videoUrl`, so
 * they reuse the collection that is already publicly readable when published
 * and already rendered by the news reader's video player — one editorial
 * pipeline, no parallel collection with its own rules to deploy. This page is
 * the dedicated surface for creating/editing/publishing/removing them and for
 * uploading the media to Storage.
 */

interface VideoItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  municipality: string;
  videoUrl: string;
  imageUrl?: string;
  published: boolean;
  createdAt?: string;
  date?: string;
  author?: string;
  readTime?: string;
  position?: string;
}

interface FormState {
  title: string;
  summary: string;
  videoUrl: string;
  imageUrl: string;
  municipality: string;
  published: boolean;
}

const EMPTY_FORM: FormState = {
  title: '',
  summary: '',
  videoUrl: '',
  imageUrl: '',
  municipality: KOSOVO_MUNICIPALITIES[0],
  published: true,
};

export default function AdminVideos() {
  const currentUser = useStore((s) => s.currentUser);

  const [items, setItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'video' | 'thumb' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [publishedOnly, setPublishedOnly] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'newsArticles'), orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(
      q,
      (snap) => {
        const videos = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((d) => Boolean(d.videoUrl)) as VideoItem[];
        setItems(videos);
        setLoading(false);
      },
      (err) => {
        console.error('Videot nuk u ngarkuan:', err);
        setLoading(false);
      },
    );
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (v: VideoItem) => {
    setForm({
      title: v.title || '',
      summary: v.summary || '',
      videoUrl: v.videoUrl || '',
      imageUrl: v.imageUrl || '',
      municipality: v.municipality || KOSOVO_MUNICIPALITIES[0],
      published: Boolean(v.published),
    });
    setEditingId(v.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleUpload = async (kind: 'video' | 'thumb', file: File) => {
    setUploading(kind);
    try {
      const url = await uploadFileToStorage(file, 'reports', { scope: 'videos' });
      setForm((f) => (kind === 'video' ? { ...f, videoUrl: url } : { ...f, imageUrl: url }));
    } catch (err: any) {
      toast.error(err?.message || dt('Ngarkimi dështoi.'));
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.videoUrl.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim() || form.title.trim(),
        content: form.summary.trim() || form.title.trim(),
        category: 'Video',
        municipality: form.municipality,
        videoUrl: form.videoUrl.trim(),
        imageUrl: form.imageUrl.trim() || null,
        position: 'sidebar',
        author: currentUser?.name || currentUser?.email || 'Redaksia',
        readTime: 'Video',
        date: now.slice(0, 10),
      };
      const ref = editingId ? doc(db, 'newsArticles', editingId) : doc(collection(db, 'newsArticles'));
      if (editingId) {
        // Editing saves the text and media; publishing stays a separate decision.
        await setDoc(ref, payload, { merge: true });
      } else {
        await setDoc(ref, { ...payload, published: false, status: 'Draft', createdAt: now });
        if (form.published) {
          try {
            await takeDecision('news', ref.id, 'publish');
          } catch (error) {
            toast.error(`${dt('Video u ruajt si draft, por nuk u publikua:')} ${(error as Error).message}`);
          }
        }
      }
      toast.success(dt('Video u ruajt.'));
      closeForm();
    } catch (err) {
      console.error('Gabim gjatë ruajtjes së videos', err);
      toast.error(dt('Pati një gabim gjatë ruajtjes së videos.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!await askConfirm(dt('A jeni i sigurt që dëshironi ta fshini këtë video?'))) return;
    try {
      await deleteDoc(doc(db, 'newsArticles', id));
    } catch (err) {
      console.error('Gabim gjatë fshirjes së videos', err);
    }
  };

  const filtered = useMemo(() => {
    let result = items;
    if (publishedOnly) result = result.filter((v) => v.published);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((v) => v.title?.toLowerCase().includes(q));
    }
    return result;
  }, [items, searchQuery, publishedOnly]);

  const inputCls =
    'w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm font-medium outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition';

  return (
    <div className="space-y-6 max-w-full mx-auto">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-2">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight title-serif flex items-center gap-3">
            <Video className="w-8 h-8 text-indigo-600" />
            {dt('Menaxhimi i Videove')}
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
            {dt('Video publike që shfaqen në sidebar-in e lajmeve dhe në lexuesin e lajmit.')}
          </p>
        </div>
        <button
          onClick={() => (showForm && !editingId ? closeForm() : openCreate())}
          className={cn(
            'flex items-center justify-center gap-2 px-6 py-3.5 font-bold text-sm transition rounded-xl shadow-sm dark:shadow-none hover:shadow active:scale-95 w-full sm:w-auto',
            showForm && !editingId
              ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
              : 'bg-slate-900 text-white hover:bg-slate-800 border border-slate-800',
          )}
        >
          {showForm && !editingId ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm && !editingId ? dt('Mbyll Formularin') : dt('Video e Re')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-6 md:p-10 border border-slate-200/60 dark:border-white/10 shadow-sm dark:shadow-none rounded-2xl space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt('Titulli')}</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} required />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt('Përshkrimi i shkurtër')}</label>
              <textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className={cn(inputCls, 'min-h-[90px] resize-y')} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt('Video (URL YouTube/MP4 ose ngarko)')}</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} className={cn(inputCls, 'pl-11')} placeholder="https://... mp4 / youtube" required />
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                  {uploading === 'video' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {dt('Ngarko MP4/WebM')}
                  <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload('video', f); e.target.value = ''; }} />
                </label>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt('Miniatura (opsionale)')}</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="text" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className={cn(inputCls, 'flex-1')} placeholder="https://..." />
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                  {uploading === 'thumb' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {dt('Ngarko Foto')}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload('thumb', f); e.target.value = ''; }} />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{dt('Komuna')}</label>
              <select value={form.municipality} onChange={(e) => setForm({ ...form, municipality: e.target.value })} className={inputCls}>
                {KOSOVO_MUNICIPALITIES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-4 py-3 cursor-pointer self-end">
              <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{dt('Publikuar (e dukshme për qytetarët)')}</span>
            </label>
          </div>

          <div className="flex justify-end pt-6 border-t border-slate-100 dark:border-white/5 gap-3">
            <button type="button" onClick={closeForm} className="px-6 py-3 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold border border-slate-200/60 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
              {dt('Anulo')}
            </button>
            <button type="submit" disabled={saving || !form.title.trim() || !form.videoUrl.trim()} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors rounded-xl shadow-sm dark:shadow-none disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? dt('Duke ruajtur...') : editingId ? dt('Ruaj Ndryshimet') : dt('Ruaj Videon')}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm dark:shadow-none border border-slate-100 dark:border-white/5">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder={dt('Kërko video...')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" checked={publishedOnly} onChange={(e) => setPublishedOnly(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
          {dt('Vetëm të publikuara')}
        </label>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">{dt('Duke ngarkuar...')}</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl">
          <Video className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="mt-3 text-slate-500 dark:text-slate-400 font-medium">{dt('Ende pa video.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <div key={v.id} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none flex flex-col">
              <div className="relative aspect-video bg-slate-100 dark:bg-slate-800">
                {v.imageUrl ? (
                  <img src={v.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center"><Video className="w-8 h-8 text-slate-300" /></div>
                )}
                <span className={cn('absolute top-2 left-2 px-2 py-0.5 rounded text-[11px] font-black uppercase', v.published ? 'bg-emerald-600 text-white' : 'bg-slate-500 text-white')}>
                  {v.published ? dt('Publikuar') : dt('Draft')}
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col gap-3">
                <h4 className="font-bold text-slate-900 dark:text-white line-clamp-2">{v.title}</h4>
                <p className="text-[11px] text-slate-400">{v.municipality}</p>
                <div className="mt-auto flex items-center gap-2">
                  <button onClick={() => openEdit(v)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />{dt('Modifiko')}
                  </button>
                  <DecisionBar kind="news" id={v.id} doc={v as any} />
                  <button onClick={() => handleDelete(v.id)} className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />{dt('Fshi')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

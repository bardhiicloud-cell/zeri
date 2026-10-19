import { useRef, useState } from 'react';
import { submitNewsTip } from '../lib/directSubmissions';
import { saveGuestReportHistory } from '../lib/session';
import { BackLink } from '../components/BackLink';
import { Link } from 'react-router-dom';
import { CheckCircle2, Copy, ImagePlus, Loader2, Megaphone, ShieldCheck, X } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';

/**
 * "Lajmëro": a citizen sends a news tip (corruption, propaganda, anything of public interest)
 * with photos or a short video. It is not published as sent: the newsroom checks it and writes
 * its own article. The sender gets a Track-ID (LJ-…) to follow the stage on /trackid.
 */
const CATEGORIES: Array<[string, string]> = [
  ['korrupsion', 'Korrupsion'], ['antipropagande', 'Antipropagandë'], ['politike', 'Politikë'], ['ekonomi', 'Ekonomi'],
  ['siguri', 'Siguri'], ['mjedis', 'Mjedis'], ['shoqeri', 'Shoqëri'], ['tjera', 'Tjera'],
];
const MAX_MEDIA = 3;
const MAX_TOTAL_CHARS = 650_000;

/** Photos are scaled down in the browser so three of them fit one request. */
async function toDataUri(file: File): Promise<string> {
  if (file.type.startsWith('video/')) {
    if (file.size > 380_000) throw new Error(dt('Videoja duhet të jetë deri në rreth 380 KB (disa sekonda). Për video më të gjata, shkruani te Kontakti.'));
    return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error(dt('Skedari nuk u lexua.'))); r.readAsDataURL(file); });
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export default function LajmeroPage() {
  const [form, setForm] = useState({ title: '', body: '', category: '', municipality: '', place: '', anonymous: true, contactName: '', contactEmail: '', contactPhone: '' });
  const [media, setMedia] = useState<Array<{ name: string; url: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [reference, setReference] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof typeof form, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));
  const total = media.reduce((sum, m) => sum + m.url.length, 0);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    setError('');
    try {
      const next = [...media];
      for (const file of Array.from(list)) {
        if (next.length >= MAX_MEDIA) break;
        const url = await toDataUri(file);
        next.push({ name: file.name, url });
      }
      if (next.reduce((sum, m) => sum + m.url.length, 0) > MAX_TOTAL_CHARS) throw new Error(dt('Fotot janë shumë të mëdha bashkë; hiqni një ose zgjidhni më të vogla.'));
      setMedia(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setFields({});
    try {
      // Server when it is usable, otherwise straight to Firestore with the same checks.
      const result = await submitNewsTip({ ...form, media: media.map(m => m.url) });
      if (!result.ok || !result.reference) {
        setFields(result.fields);
        throw new Error(result.error || dt('Lajmi nuk u dërgua. Provoni përsëri.'));
      }
      const issued = result.reference;
      saveGuestReportHistory({ id: issued, trackingId: issued, title: form.title, status: 'submitted', createdAt: new Date().toISOString() });
      setReference(issued);
    } catch (e) {
      setError((e as Error).message || dt('Pa lidhje me serverin. Provoni përsëri.'));
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 dark:border-white/10 dark:bg-slate-900 dark:text-white';
  const label = 'mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500';
  const err = (key: string) => fields[key] ? <p className="mt-1 text-xs font-semibold text-rose-600">{fields[key]}</p> : null;

  if (reference) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-xl dark:border-emerald-500/30 dark:bg-slate-900">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">{dt('Lajmi u dërgua')}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{dt('Ruajeni këtë kod. Me të ndiqni fazën: në pritje, pranuar, në përpunim, publikuar.')}</p>
          <p className="mt-5 font-mono text-3xl font-black tracking-wider text-slate-900 dark:text-white">{reference}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(reference); setCopied(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold dark:border-white/10 dark:text-white"><Copy className="h-4 w-4" aria-hidden="true" />{copied ? dt('U kopjua') : dt('Kopjo kodin')}</button>
            <Link to={`/trackid?id=${reference}`} className="inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 text-sm font-bold text-white">{dt('Ndiq lajmin')}</Link>
          </div>
          <p className="mt-6 text-xs text-slate-500">{dt('Redaksia e shqyrton. Nuk publikohet siç është dërguar: nëse mbahet, e shkruajmë vetë si artikull.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <BackLink to="/lajme" label="Lajmet" className="mb-5" />
      <header className="mb-6 flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-700 text-white"><Megaphone className="h-6 w-6" aria-hidden="true" /></span>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">{dt('Lajmëro')}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{dt('Keni informacion të interesit publik: korrupsion, propagandë, abuzim? Dërgojeni këtu me foto ose video. Merrni një kod për ta ndjekur.')}</p>
        </div>
      </header>

      <form onSubmit={submit} noValidate className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900 sm:p-7">
        <div>
          <label className={label} htmlFor="tip-title">{dt('Titulli')}</label>
          <input id="tip-title" className={input} value={form.title} maxLength={160} onChange={e => set('title', e.target.value)} />
          {err('title')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="tip-cat">{dt('Kategoria')}</label>
            <select id="tip-cat" className={input} value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="">{dt('Zgjidhni…')}</option>
              {CATEGORIES.map(([id, name]) => <option key={id} value={id}>{dt(name)}</option>)}
            </select>
            {err('category')}
          </div>
          <div>
            <label className={label} htmlFor="tip-muni">{dt('Komuna (opsionale)')}</label>
            <select id="tip-muni" className={input} value={form.municipality} onChange={e => set('municipality', e.target.value)}>
              <option value="">{dt('Pa komunë të caktuar')}</option>
              {KOSOVO_MUNICIPALITIES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={label} htmlFor="tip-body">{dt('Çfarë dini? Kush, çfarë, ku, kur')}</label>
          <textarea id="tip-body" className={input} rows={8} maxLength={6000} value={form.body} onChange={e => set('body', e.target.value)} />
          <p className="mt-1 text-[11px] text-slate-500">{form.body.trim().length}/40+ {dt('shenja')}</p>
          {err('body')}
        </div>
        <div>
          <label className={label} htmlFor="tip-place">{dt('Vendi (opsionale)')}</label>
          <input id="tip-place" className={input} value={form.place} maxLength={200} onChange={e => set('place', e.target.value)} />
        </div>

        <div>
          <span className={label}>{dt('Foto ose video (deri në 3)')}</span>
          <div className="flex flex-wrap gap-2">
            {media.map((m, i) => (
              <div key={m.name + i} className="relative h-24 w-32 overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5">
                {m.url.startsWith('data:video') ? <video src={m.url} className="h-full w-full object-cover" muted /> : <img loading="lazy" decoding="async" src={m.url} alt="" className="h-full w-full object-cover" />}
                <button type="button" onClick={() => setMedia(list => list.filter((_, j) => j !== i))} aria-label={dt('Hiq')} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-white"><X className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            ))}
            {media.length < MAX_MEDIA && (
              <button type="button" data-tour="tip-media" onClick={() => fileRef.current?.click()} className="flex h-24 w-32 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs font-bold text-slate-500 hover:border-blue-500 dark:border-white/20"><ImagePlus className="h-5 w-5" aria-hidden="true" />{dt('Shto')}</button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple className="hidden" onChange={e => void addFiles(e.target.files)} />
          <p className="mt-1 text-[11px] text-slate-500">{Math.round(total / 1024)} KB · {dt('fotot zvogëlohen automatikisht')}</p>
          {err('media')}
        </div>

        <fieldset className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
          <label className="flex items-center gap-3 text-sm font-bold text-slate-800 dark:text-slate-100">
            <input type="checkbox" checked={form.anonymous} onChange={e => set('anonymous', e.target.checked)} className="h-4 w-4" />
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />{dt('Dërgo anonimisht (pa emër dhe kontakt)')}
          </label>
          {!form.anonymous && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <input className={input} placeholder={dt('Emri')} value={form.contactName} onChange={e => set('contactName', e.target.value)} />
              <div><input className={input} placeholder="Email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} />{err('contactEmail')}</div>
              <input className={input} placeholder={dt('Telefoni')} value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} />
            </div>
          )}
          <p className="mt-2 text-[11px] text-slate-500">{dt('Kontakti, nëse e jepni, e sheh vetëm redaksia dhe nuk publikohet kurrë.')}</p>
        </fieldset>

        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
        <button type="submit" data-tour="tip-submit" disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-6 text-base font-black text-white hover:bg-blue-800 disabled:opacity-50">
          {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}{dt('Dërgo lajmin')}
        </button>
      </form>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Download, FileText, Loader2, Newspaper, X } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../../lib/utils';
import { describeApiFailure, requireAdminToken } from '../../../lib/adminApi';
import { actOnTipDirect, getTipDirect, listTipsDirect } from '../../../lib/newsTipsDirect';

type Stage = 'submitted' | 'accepted' | 'in_editing' | 'published' | 'rejected';
const STAGES: Array<[Stage, string, string]> = [
  ['submitted', 'Në pritje', 'Të reja: pranohen ose refuzohen me arsye.'],
  ['accepted', 'U pranua', 'Pranuar; shkarkoni tekstin dhe median dhe krijoni artikullin.'],
  ['in_editing', 'Në përpunim', 'Artikulli (draft) shkruhet nga redaksia te Lajmet.'],
  ['published', 'U publikua', 'Artikulli yni u publikua.'],
  ['rejected', 'Të refuzuara', 'Refuzuar me arsye; nuk publikohen.'],
];
const ACTION_LABEL: Record<string, string> = { accept: 'Pranoj lajmin', reject: 'Refuzo', create_draft: 'Krijo artikullin (draft)', mark_published: 'Shëno: u publikua' };

interface Row { id: string; reference: string; title: string; category: string; municipality: string; status: Stage; anonymous: boolean; mediaCount: number; articleId: string | null; createdAt: string | null; actions: string[] }
interface Detail extends Row {
  body: string; categoryLabel: string; place: string; stageLabel: string; contactName: string; contactEmail: string; contactPhone: string;
  media: Array<{ type: 'image' | 'video'; url: string }>; rejectionReason: string; history: Array<{ action: string; actorName: string; text: string; atMs: number; from: string; to: string }>;
}

/** Without the API server the same three calls are answered from the database (lib/newsTipsDirect.ts). */
async function direct<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const url = new URL(path, window.location.origin);
  const parts = url.pathname.split('/').filter(Boolean); // api v1 admin news-tips [id] [action]
  const id = parts[4] ? decodeURIComponent(parts[4]) : '';
  if (!id) return (await listTipsDirect(url.searchParams.get('stage') || 'submitted')) as unknown as T;
  if (parts[5] === 'action') {
    const b = (init?.body ?? {}) as { action?: string; reason?: string };
    return (await actOnTipDirect(id, String(b.action ?? ''), String(b.reason ?? ''))) as unknown as T;
  }
  return (await getTipDirect(id)) as unknown as T;
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const token = await requireAdminToken();
  let response: Response;
  try {
    response = await fetch(path, { method: init?.method ?? 'GET', headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) }, body: init?.body ? JSON.stringify(init.body) : undefined });
  } catch {
    return direct<T>(path, init);
  }
  if ([404, 502, 503, 504].includes(response.status)) return direct<T>(path, init);
  const body = (await response.json().catch(() => null)) ?? {};
  if (!response.ok) throw new Error(describeApiFailure(response.status, body));
  return body as T;
}

const when = (iso: string | null | number) => (iso ? new Date(iso).toLocaleString('sq-AL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

function download(name: string, href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Citizen news tips. Every tip has a Track-ID (LJ-…). Nothing here publishes: staff download the text and
 * the photos/video as source material, write the article themselves (own layout, ads and elements) from a
 * draft this panel creates, and mark the tip published only once that article is actually live.
 */
export default function NewsTipsPanel() {
  const [stage, setStage] = useState<Stage>('submitted');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await call<{ counts: Record<string, number>; items: Row[] }>(`/api/v1/admin/news-tips?stage=${stage}`);
      setCounts(r.counts ?? {});
      setRows(Array.isArray(r.items) ? r.items : []);
    } catch (e) {
      setRows([]);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [stage]);
  useEffect(() => { void load(); }, [load]);

  return (
    <section className="space-y-4">
      <div role="tablist" aria-label={dt('Fazat e lajmeve')} className="flex flex-wrap gap-1.5">
        {STAGES.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={stage === id} onClick={() => setStage(id)}
            className={cn('inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-bold', stage === id ? (id === 'rejected' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900') : 'bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-white/10')}>
            {dt(label)}<span className="rounded-full bg-black/10 px-1.5 text-[11px]">{counts[id] ?? '…'}</span>
          </button>
        ))}
      </div>
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">{dt(STAGES.find(s => s[0] === stage)![2])}</p>
      {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</p>}
      {loading ? <div className="flex h-24 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label={dt('Duke ngarkuar')} /></div>
        : rows.length === 0 && !error ? <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">{dt('Asnjë lajm në këtë fazë.')}</p>
          : (
            <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
              {rows.map(r => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3 last:border-0 dark:border-white/5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/5"><Newspaper className="h-5 w-5" aria-hidden="true" /></span>
                  <button type="button" onClick={() => setOpen(r.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-semibold text-slate-900 dark:text-white">{r.title}</span>
                    <span className="block truncate text-xs text-slate-500"><span className="font-mono text-sky-700 dark:text-sky-300">{r.reference}</span> · {r.category}{r.municipality ? ` · ${r.municipality}` : ''} · {r.mediaCount} {dt('media')} · {r.anonymous ? dt('anonim') : dt('me kontakt')} · {when(r.createdAt)}</span>
                  </button>
                  <button type="button" onClick={() => setOpen(r.id)} className="min-h-10 rounded-xl border border-slate-200 px-3.5 text-sm font-bold text-slate-700 dark:border-white/10 dark:text-slate-200">{dt('Hap')}</button>
                </li>
              ))}
            </ul>
          )}
      {open && <TipDrawer id={open} onClose={() => setOpen(null)} onChanged={() => void load()} />}
    </section>
  );
}

function TipDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [tip, setTip] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try { setTip(await call<Detail>(`/api/v1/admin/news-tips/${encodeURIComponent(id)}`)); } catch (e) { setError((e as Error).message); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const run = async (action: string) => {
    setBusy(true);
    setError('');
    try {
      const r = await call<{ label: string }>(`/api/v1/admin/news-tips/${encodeURIComponent(id)}/action`, { method: 'POST', body: { action, reason: reason.trim() } });
      toast.success(`${dt('Lajmi tani është')}: ${dt(r.label)}`);
      setAsking(null);
      setReason('');
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const downloadText = () => {
    if (!tip) return;
    const text = `${tip.title}\n${tip.reference} · ${tip.categoryLabel}${tip.municipality ? ` · ${tip.municipality}` : ''}${tip.place ? ` · ${tip.place}` : ''}\n\n${tip.body}\n`;
    download(`${tip.reference}.txt`, `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`);
  };

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/40 backdrop-blur-sm" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={dt('Lajmi i dërguar')} onClick={e => e.stopPropagation()} className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-white/10">
          <div className="min-w-0">
            <p className="font-mono text-xs text-slate-500">{tip?.reference}</p>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{tip?.title ?? dt('Lajmi')}</h2>
            {tip && <p className="text-xs text-slate-500">{tip.categoryLabel}{tip.municipality ? ` · ${tip.municipality}` : ''}{tip.place ? ` · ${tip.place}` : ''} · {dt('Faza')}: <b>{dt(tip.stageLabel)}</b></p>}
          </div>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-5 w-5" aria-hidden="true" /></button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
          {!tip && !error && <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" aria-label={dt('Duke ngarkuar')} />}
          {tip && (
            <>
              {tip.actions.length > 0 && !asking && (
                <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
                  <span className="mr-auto text-xs font-bold text-slate-500">{dt('Hapi i radhës')}</span>
                  {tip.actions.map(a => (
                    <button key={a} type="button" disabled={busy} onClick={() => (a === 'reject' ? setAsking(a) : void run(a))}
                      className={cn('inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-bold text-white disabled:opacity-50', a === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700')}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{dt(ACTION_LABEL[a] ?? a)}
                    </button>
                  ))}
                </div>
              )}
              {asking && (
                <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">{dt('Arsyeja e refuzimit (e shihet vetëm nga stafi) *')}
                    <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={500} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm dark:border-white/10 dark:bg-slate-900" />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => void run('reject')} className="min-h-10 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white disabled:opacity-40">{dt('Konfirmo refuzimin')}</button>
                    <button type="button" onClick={() => setAsking(null)} className="min-h-10 rounded-xl px-4 text-sm font-bold text-slate-700 dark:text-slate-200">{dt('Anulo')}</button>
                  </div>
                </div>
              )}
              {tip.articleId && <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 dark:bg-sky-500/10 dark:text-sky-200">{dt('Artikulli (draft) ekziston te Lajmet:')} <span className="font-mono">{tip.articleId}</span></p>}
              {tip.rejectionReason && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><b>{dt('Arsyeja e refuzimit')}:</b> {tip.rejectionReason}</p>}

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={downloadText} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3.5 text-sm font-bold text-slate-700 dark:border-white/10 dark:text-slate-200"><FileText className="h-4 w-4" aria-hidden="true" />{dt('Shkarko tekstin')}</button>
                {tip.media.map((m, i) => (
                  <button key={i} type="button" onClick={() => download(`${tip.reference}-${i + 1}.${m.type === 'video' ? (m.url.includes('webm') ? 'webm' : 'mp4') : m.url.includes('png') ? 'png' : m.url.includes('webp') ? 'webp' : 'jpg'}`, m.url)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3.5 text-sm font-bold text-slate-700 dark:border-white/10 dark:text-slate-200"><Download className="h-4 w-4" aria-hidden="true" />{m.type === 'video' ? dt('Shkarko videon') : `${dt('Shkarko foton')} ${i + 1}`}</button>
                ))}
              </div>
              {tip.media.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {tip.media.map((m, i) => m.type === 'video'
                    ? <video key={i} src={m.url} controls className="aspect-[4/3] w-full rounded-xl bg-black object-cover" />
                    : <img key={i} src={m.url} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />)}
                </div>
              )}
              <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-800 dark:bg-white/5 dark:text-slate-100"><b className="block text-[10px] uppercase tracking-wider text-slate-400">{dt('Teksti i dërguar')}</b>{tip.body}</p>
              <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
                {([['Dërguar', when(tip.createdAt)], ['Dërguesi', tip.anonymous ? dt('Anonim') : tip.contactName], ['Email', tip.contactEmail], ['Telefoni', tip.contactPhone]] as const).map(([k, v]) => (
                  <div key={k}><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{dt(k)}</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{v || '—'}</dd></div>
                ))}
              </dl>
              <section>
                <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{dt('Historiku')}</h3>
                {tip.history.length === 0 ? <p className="text-sm text-slate-500">{dt('Pa histori ende.')}</p> : (
                  <ol className="space-y-2 border-l-2 border-slate-200 pl-4 dark:border-white/10">
                    {tip.history.map((h, i) => <li key={i} className="text-sm"><p className="font-semibold text-slate-900 dark:text-white">{dt(ACTION_LABEL[h.action] ?? h.action)}</p><p className="text-xs text-slate-500">{h.actorName || '—'} · {when(h.atMs)}</p>{h.text && <p className="text-xs text-slate-700 dark:text-slate-300">{h.text}</p>}</li>)}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

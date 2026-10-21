import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Ban, CheckCircle2, Download, FileText, Inbox, Loader2, Newspaper, Search, SkipForward } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../../lib/utils';
import { describeApiFailure, requireAdminToken } from '../../../lib/adminApi';
import { actOnTipDirect, getTipDirect, listTipsDirect } from '../../../lib/newsTipsDirect';
import { DeskHeader, DrawerShell, Kbd, REJECT_REASONS, ago, isTyping, useMediaQuery, type DeskNav } from './deskKit';

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
 *
 * Laid out as a desk: the list and the open tip side by side, A / R to decide, J / K to step, and the
 * next tip opens by itself after each decision.
 */
export default function NewsTipsPanel() {
  const [stage, setStage] = useState<Stage>('submitted');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const desk = useMediaQuery('(min-width: 1024px)');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
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

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? rows.filter(r => [r.title, r.reference, r.category, r.municipality].some(v => String(v ?? '').toLowerCase().includes(needle))) : rows;
  }, [rows, q]);
  const index = open ? shown.findIndex(r => r.id === open) : -1;
  const go = useCallback((delta: number) => { const next = shown[index + delta]; if (next) setOpen(next.id); }, [shown, index]);
  const nav: DeskNav | undefined = index >= 0
    ? { index, total: shown.length, more: false, onPrev: index > 0 ? () => go(-1) : undefined, onNext: index < shown.length - 1 ? () => go(1) : undefined }
    : undefined;

  /** A decision moved the tip to another stage: show the next one at once. */
  const handleMoved = useCallback((id: string) => {
    const i = shown.findIndex(r => r.id === id);
    const next = shown[i + 1] ?? shown[i - 1] ?? null;
    setRows(prev => prev.filter(r => r.id !== id));
    setOpen(next ? next.id : null);
    void load(true);
  }, [shown, load]);

  useEffect(() => { if (desk && !open && !loading && shown.length > 0) setOpen(shown[0].id); }, [desk, open, loading, shown]);
  useEffect(() => { if (open) document.getElementById(`tip-row-${open}`)?.scrollIntoView({ block: 'nearest' }); }, [open]);

  const drawer = open
    ? <TipDrawer key={open} id={open} inline={desk} nav={nav} onMoved={handleMoved} onClose={() => setOpen(null)} onChanged={() => void load(true)} />
    : null;

  return (
    <section className="space-y-4">
      <div role="tablist" aria-label={dt('Fazat e lajmeve')} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {STAGES.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={stage === id} onClick={() => { setStage(id); setOpen(null); }}
            className={cn('inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-bold', stage === id ? (id === 'rejected' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900') : 'bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-white/10')}>
            {dt(label)}<span className="rounded-full bg-black/10 px-1.5 text-[11px]">{counts[id] ?? '…'}</span>
          </button>
        ))}
      </div>
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">{dt(STAGES.find(s => s[0] === stage)![2])}</p>
      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</span>
          <button type="button" onClick={() => void load()} className="min-h-9 rounded-lg bg-white px-3 text-xs font-bold text-rose-700 ring-1 ring-rose-200 dark:bg-transparent">{dt('Provo përsëri')}</button>
        </div>
      )}

      <div className={cn(desk && 'grid grid-cols-[minmax(300px,380px)_minmax(0,1fr)] items-start gap-4')}>
        <div className="min-w-0 space-y-3">
          <label className="relative block">
            <span className="sr-only">{dt('Kërko në lajmet e ngarkuara')}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={dt('Kërko titull, kod, kategori…')} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-white/10 dark:bg-slate-900" />
          </label>
          {loading ? <div className="flex h-24 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label={dt('Duke ngarkuar')} /></div>
            : rows.length === 0 && !error ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 p-10 text-center dark:border-white/10">
                <Inbox className="h-8 w-8 text-slate-300" aria-hidden="true" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{dt('Radha është e pastër.')}</p>
                <p className="text-xs text-slate-500">{dt('Asnjë lajm në këtë fazë.')}</p>
              </div>
            ) : shown.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-white/10">{dt('Asnjë lajm nuk përputhet me kërkimin.')}</p>
              : (
                <ul aria-label={dt('Lajmet')} className={cn('overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900', desk && 'max-h-[calc(100vh-17rem)] min-h-[20rem] overflow-y-auto')}>
                  {shown.map(r => (
                    <li key={r.id} id={`tip-row-${r.id}`}>
                      <button type="button" onClick={() => setOpen(r.id)} aria-current={r.id === open ? 'true' : undefined}
                        className={cn('flex w-full items-center gap-3 border-b border-l-4 border-slate-100 px-3 py-2.5 text-left transition dark:border-white/5',
                          r.id === open && desk ? 'border-l-sky-600 bg-sky-50 dark:bg-sky-500/10' : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-white/5')}>
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/5"><Newspaper className="h-5 w-5" aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-semibold text-slate-900 dark:text-white lg:truncate">{r.title}</span>
                          <span className="block break-words text-xs text-slate-500 lg:truncate"><span className="font-mono text-sky-700 dark:text-sky-300">{r.reference}</span> · {r.category}{r.municipality ? ` · ${r.municipality}` : ''}</span>
                          <span className="text-[11px] text-slate-500">{r.mediaCount} {dt('media')} · {r.anonymous ? dt('anonim') : dt('me kontakt')} · {ago(r.createdAt ? Date.parse(r.createdAt) : 0)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
        </div>

        {desk && (
          <div className="sticky top-2 h-[calc(100vh-9rem)] min-h-[34rem]">
            {drawer ?? (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 dark:border-white/10">
                <Inbox className="h-10 w-10" aria-hidden="true" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{loading ? dt('Duke ngarkuar') : rows.length === 0 ? dt('Nuk ka asgjë për shqyrtim këtu.') : dt('Zgjidhni një lajm nga lista')}</p>
              </div>
            )}
          </div>
        )}
      </div>
      {!desk && drawer}
    </section>
  );
}

function TipDrawer({ id, onClose, onChanged, inline, nav, onMoved }: {
  id: string; onClose: () => void; onChanged: () => void; inline?: boolean; nav?: DeskNav; onMoved?: (id: string) => void;
}) {
  const [tip, setTip] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [mediaIdx, setMediaIdx] = useState(0);

  const load = useCallback(async () => {
    try { setTip(await call<Detail>(`/api/v1/admin/news-tips/${encodeURIComponent(id)}`)); } catch (e) { setError((e as Error).message); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const run = async (action: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await call<{ label: string }>(`/api/v1/admin/news-tips/${encodeURIComponent(id)}/action`, { method: 'POST', body: { action, reason: reason.trim() } });
      toast.success(`${dt('Lajmi tani është')}: ${dt(r.label)}`);
      setAsking(null);
      setReason('');
      if (onMoved) { onMoved(id); return; }
      await load();
      onChanged();
    } catch (e) {
      // Nothing changed on the server.
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const primary = tip?.actions.find(a => a !== 'reject');
  const canReject = Boolean(tip?.actions.includes('reject'));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (asking) setAsking(null); else if (!inline) onClose(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || asking) return;
      const k = e.key.toLowerCase();
      if (k === 'j' || e.key === 'ArrowDown' || e.key === 'ArrowRight') { if (nav?.onNext) { e.preventDefault(); nav.onNext(); } }
      else if (k === 'k' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') { if (nav?.onPrev) { e.preventDefault(); nav.onPrev(); } }
      else if (k === 'a' && primary) { e.preventDefault(); void run(primary); }
      else if (k === 'r' && canReject) { e.preventDefault(); setAsking('reject'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const downloadText = () => {
    if (!tip) return;
    const text = `${tip.title}\n${tip.reference} · ${tip.categoryLabel}${tip.municipality ? ` · ${tip.municipality}` : ''}${tip.place ? ` · ${tip.place}` : ''}\n\n${tip.body}\n`;
    download(`${tip.reference}.txt`, `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`);
  };

  const hero = tip?.media[Math.min(mediaIdx, Math.max(0, (tip?.media.length ?? 1) - 1))];

  return (
    <DrawerShell inline={inline} onClose={onClose}>
      <DeskHeader
        trackingId={tip?.reference ?? id}
        title={tip?.title ?? dt('Lajmi')}
        meta={tip ? `${tip.categoryLabel}${tip.municipality ? ` · ${tip.municipality}` : ''}${tip.place ? ` · ${tip.place}` : ''} · ${dt('Faza')}: ${dt(tip.stageLabel)}` : undefined}
        nav={nav}
        onClose={onClose}
        inline={inline}
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
        {!tip && !error && <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" aria-label={dt('Duke ngarkuar')} />}
        {tip && (
          <>
            {tip.articleId && <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 dark:bg-sky-500/10 dark:text-sky-200">{dt('Artikulli (draft) ekziston te Lajmet:')} <span className="font-mono">{tip.articleId}</span></p>}
            {tip.rejectionReason && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><b>{dt('Arsyeja e refuzimit')}:</b> {tip.rejectionReason}</p>}

            {hero && (
              <section aria-label={dt('Media')} className="space-y-2">
                <div className="overflow-hidden rounded-2xl bg-slate-950">
                  {hero.type === 'video'
                    ? <video key={hero.url} src={hero.url} controls className="mx-auto max-h-[44vh] w-full" />
                    : <img src={hero.url} alt={dt('Fotoja e dërguar')} className="mx-auto max-h-[44vh] w-full object-contain" />}
                </div>
                {tip.media.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={dt('Zgjidh median')}>
                    {tip.media.map((m, i) => (
                      <button key={m.url} type="button" role="tab" aria-selected={i === mediaIdx} onClick={() => setMediaIdx(i)} className={cn('flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-200 ring-2 dark:bg-white/10', i === mediaIdx ? 'ring-sky-600' : 'ring-transparent opacity-70 hover:opacity-100')}>
                        {m.type === 'video' ? <span className="text-[10px] font-bold">VIDEO</span> : <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section aria-label={dt('Teksti i dërguar')} className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
              <h3 className="mb-1 text-[11px] font-black uppercase tracking-wider text-slate-400">{dt('Teksti i dërguar')}</h3>
              <p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-slate-800 dark:text-slate-100">{tip.body}</p>
            </section>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={downloadText} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3.5 text-sm font-bold text-slate-700 dark:border-white/10 dark:text-slate-200"><FileText className="h-4 w-4" aria-hidden="true" />{dt('Shkarko tekstin')}</button>
              {tip.media.map((m, i) => (
                <button key={i} type="button" onClick={() => download(`${tip.reference}-${i + 1}.${m.type === 'video' ? (m.url.includes('webm') ? 'webm' : 'mp4') : m.url.includes('png') ? 'png' : m.url.includes('webp') ? 'webp' : 'jpg'}`, m.url)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3.5 text-sm font-bold text-slate-700 dark:border-white/10 dark:text-slate-200"><Download className="h-4 w-4" aria-hidden="true" />{m.type === 'video' ? dt('Shkarko videon') : `${dt('Shkarko foton')} ${i + 1}`}</button>
              ))}
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 p-3 text-sm dark:border-white/10">
              {([['Dërguar', when(tip.createdAt)], ['Dërguesi', tip.anonymous ? dt('Anonim') : tip.contactName], ['Email', tip.contactEmail], ['Telefoni', tip.contactPhone]] as const).map(([k, v]) => (
                <div key={k} className="min-w-0"><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{dt(k)}</dt><dd className="break-words font-medium text-slate-800 dark:text-slate-100">{v || '—'}</dd></div>
              ))}
            </dl>

            <details className="rounded-2xl border border-slate-200 dark:border-white/10">
              <summary className="flex min-h-11 cursor-pointer items-center px-3 text-xs font-black uppercase tracking-wide text-slate-500">{dt('Historiku')} ({tip.history.length})</summary>
              <div className="px-3 pb-3">
                {tip.history.length === 0 ? <p className="text-sm text-slate-500">{dt('Pa histori ende.')}</p> : (
                  <ol className="space-y-2 border-l-2 border-slate-200 pl-4 dark:border-white/10">
                    {tip.history.map((h, i) => <li key={i} className="text-sm"><p className="font-semibold text-slate-900 dark:text-white">{dt(ACTION_LABEL[h.action] ?? h.action)}</p><p className="text-xs text-slate-500">{h.actorName || '—'} · {when(h.atMs)}</p>{h.text && <p className="text-xs text-slate-700 dark:text-slate-300">{h.text}</p>}</li>)}
                  </ol>
                )}
              </div>
            </details>
          </>
        )}
      </div>

      {tip && tip.actions.length > 0 && (
        <footer aria-label={dt('Veprimet')} className="max-h-[65%] overflow-y-auto border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950">
          {asking ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{dt('Arsyeja e refuzimit (e shihet vetëm nga stafi) *')}</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={dt('Arsye të gatshme')}>
                {REJECT_REASONS.map(r => (
                  <button key={r} type="button" onClick={() => setReason(r)} className={cn('min-h-9 rounded-lg px-2.5 text-xs font-bold ring-1', reason === r ? 'bg-rose-600 text-white ring-rose-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-white/10')}>{dt(r)}</button>
                ))}
              </div>
              <textarea autoFocus value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={500} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm dark:border-white/10 dark:bg-slate-900" />
              <div className="flex gap-2">
                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => void run('reject')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white disabled:opacity-40">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{dt('Konfirmo refuzimin')}</button>
                <button type="button" onClick={() => setAsking(null)} className="min-h-11 rounded-xl px-4 text-sm font-bold text-slate-700 dark:text-slate-200">{dt('Anulo')}</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {primary && (
                <button type="button" disabled={busy} onClick={() => void run(primary)} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{dt(ACTION_LABEL[primary] ?? primary)}<Kbd>A</Kbd>
                </button>
              )}
              {canReject && (
                <button type="button" disabled={busy} onClick={() => setAsking('reject')} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300"><Ban className="h-4 w-4" aria-hidden="true" />{dt('Refuzo')}<Kbd>R</Kbd></button>
              )}
              {nav?.onNext && <button type="button" onClick={nav.onNext} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"><SkipForward className="h-4 w-4" aria-hidden="true" />{dt('Kalo')}<Kbd>→</Kbd></button>}
            </div>
          )}
        </footer>
      )}
    </DrawerShell>
  );
}

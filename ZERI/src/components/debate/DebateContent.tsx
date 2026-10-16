import { useState } from 'react';
import { Eye, EyeOff, Flag, Heart, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { debateInsightsApi, type ReelRow, type StoryRow, type StoryViewerRow } from '../../lib/debateInsightsApi';
import { Badge, Empty, ErrorNote, Panel, Spinner, Stat, btn, inputClass, useLoad } from './ui';

const fmt = (ms: number) => (ms ? new Date(ms).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const compact = (n: number) => new Intl.NumberFormat('sq-AL', { notation: 'compact' }).format(n);

/** Stories and Reels of the public debate: what is live, how many saw it, and the means to hide it. */
export function DebateContent() {
  const [kind, setKind] = useState<'stories' | 'reels'>('stories');
  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist">
        {(['stories', 'reels'] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={kind === id} onClick={() => setKind(id)}
            className={cn('min-h-9 rounded-full px-4 text-sm font-bold', kind === id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300')}>
            {id === 'stories' ? dt('Debat Stories') : dt('Reels')}
          </button>
        ))}
      </div>
      {kind === 'stories' ? <Stories /> : <Reels />}
    </div>
  );
}

/** Asks for the reason, then hides. Unhiding needs none. */
function useHide(reload: () => Promise<void>, run: (id: string, hide: boolean, reason?: string) => Promise<unknown>) {
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const apply = async (id: string, hide: boolean, why?: string) => {
    setBusy(true);
    try { await run(id, hide, why); toast.success(hide ? dt('U fsheh.') : dt('U rikthye.')); setTarget(null); setReason(''); await reload(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return { target, setTarget, reason, setReason, busy, apply };
}

function HideForm({ id, hide }: { id: string; hide: ReturnType<typeof useHide> }) {
  return (
    <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); void hide.apply(id, true, hide.reason.trim()); }}>
      <input value={hide.reason} onChange={(e) => hide.setReason(e.target.value)} required minLength={5} maxLength={300} autoFocus
        placeholder={dt('Arsyeja e fshehjes (mbetet në auditim)')} className={inputClass} />
      <div className="flex gap-2">
        <button type="submit" disabled={hide.busy} className={cn(btn.danger, 'min-h-9 px-3 text-xs')}>{hide.busy ? <Spinner /> : null}{dt('Fshih')}</button>
        <button type="button" onClick={() => hide.setTarget(null)} className={cn(btn.ghost, 'min-h-9 px-3 text-xs')}>{dt('Anulo')}</button>
      </div>
    </form>
  );
}

function Stories() {
  const list = useLoad(debateInsightsApi.stories, []);
  const hide = useHide(list.reload, debateInsightsApi.hideStory);
  const [filter, setFilter] = useState<'all' | 'live' | 'hidden'>('all');
  const [viewing, setViewing] = useState<StoryRow | null>(null);
  const rows = (list.data?.stories ?? []).filter((s) => filter === 'all' || (filter === 'live' ? s.live : s.isHidden));

  return (
    <div className="space-y-4">
      <ErrorNote message={list.error} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Stories live tani" value={list.data?.totals.live ?? '—'} tone="emerald" />
        <Stat label="Pamje (60 të fundit)" value={list.data ? compact(list.data.totals.views) : '—'} tone="blue" />
        <Stat label="Të fshehura" value={list.data?.totals.hidden ?? '—'} tone="amber" />
      </div>
      <div className="flex flex-wrap gap-2">
        {([['all', 'Të gjitha'], ['live', 'Live'], ['hidden', 'Të fshehura']] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
            className={cn('min-h-9 rounded-full px-3 text-sm font-bold', filter === id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300')}>{dt(label)}</button>
        ))}
        <button type="button" onClick={() => void list.reload()} className={cn(btn.ghost, 'ml-auto min-h-9 px-3 text-xs')}>{dt('Rifresko')}</button>
      </div>
      {list.loading && !list.data && <div className="flex justify-center p-6 text-slate-400"><Spinner className="h-5 w-5" /></div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s) => (
          <Panel key={s.id} className="space-y-2 p-3 sm:p-3">
            <div className="flex gap-3">
              {s.mediaType === 'image'
                ? <img src={s.mediaUrl} alt="" loading="lazy" className="h-24 w-16 shrink-0 rounded-lg object-cover" />
                : <video src={s.mediaUrl} muted preload="metadata" className="h-24 w-16 shrink-0 rounded-lg object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-900 dark:text-white">{s.authorName || '—'}</p>
                <p className="text-xs text-slate-500">{fmt(s.createdAtMs)}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone={s.live ? 'emerald' : 'slate'}>{s.live ? dt('Live') : dt('Skaduar')}</Badge>
                  {s.isHidden && <Badge tone="amber">{dt('E fshehur')}</Badge>}
                </div>
                <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100"><Eye className="mr-1 inline h-4 w-4" aria-hidden="true" />{s.views} {dt('pamje')}</p>
              </div>
            </div>
            {hide.target === s.id ? <HideForm id={s.id} hide={hide} /> : (
              <div className="flex gap-2">
                <button type="button" onClick={() => setViewing(s)} className={cn(btn.ghost, 'min-h-9 flex-1 px-3 text-xs')}><Users className="h-3.5 w-3.5" aria-hidden="true" />{dt('Kush e pa')}</button>
                {s.isHidden
                  ? <button type="button" onClick={() => void hide.apply(s.id, false)} className={cn(btn.ghost, 'min-h-9 px-3 text-xs')}><Eye className="h-3.5 w-3.5" aria-hidden="true" />{dt('Rikthe')}</button>
                  : <button type="button" onClick={() => hide.setTarget(s.id)} className={cn(btn.ghost, 'min-h-9 px-3 text-xs')}><EyeOff className="h-3.5 w-3.5" aria-hidden="true" />{dt('Fshih')}</button>}
              </div>
            )}
          </Panel>
        ))}
      </div>
      {!list.loading && rows.length === 0 && <Panel><Empty>{dt('Asnjë story në këtë pamje.')}</Empty></Panel>}
      {viewing && <ViewersDialog story={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function ViewersDialog({ story, onClose }: { story: StoryRow; onClose: () => void }) {
  const data = useLoad(() => debateInsightsApi.storyViewers(story.id), [story.id]);
  const viewers: StoryViewerRow[] = data.data?.viewers ?? [];
  return (
    <div role="dialog" aria-modal="true" aria-label={dt('Shikuesit e story-t')} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900 dark:text-white">{dt('Shikuesit')} · {story.authorName}</h3>
          <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <p className="mt-1 text-xs text-slate-500">{dt('Çdo hapje e kësaj liste regjistrohet në auditim.')}</p>
        <ErrorNote message={data.error} />
        {data.loading && <div className="flex justify-center p-6 text-slate-400"><Spinner className="h-5 w-5" /></div>}
        {data.data && <p className="mt-3 text-sm font-bold">{data.data.count} {dt('shikues gjithsej')}{data.data.count > viewers.length ? ` · ${dt('shfaqen')} ${viewers.length}` : ''}</p>}
        <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/10">
          {viewers.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{v.name}</span>
              <span className="shrink-0 text-xs text-slate-500">{fmt(v.atMs)}</span>
            </li>
          ))}
        </ul>
        {data.data && viewers.length === 0 && <Empty>{dt('Ende askush.')}</Empty>}
      </div>
    </div>
  );
}

function Reels() {
  const list = useLoad(debateInsightsApi.reels, []);
  const hide = useHide(list.reload, debateInsightsApi.hideReel);
  const [filter, setFilter] = useState<'all' | 'reported' | 'hidden'>('all');
  const rows = (list.data?.reels ?? []).filter((r: ReelRow) => filter === 'all' || (filter === 'reported' ? r.reports > 0 : r.isHidden));

  return (
    <div className="space-y-4">
      <ErrorNote message={list.error} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pamje (100 të fundit)" value={list.data ? compact(list.data.totals.views) : '—'} tone="blue" />
        <Stat label="Pëlqime" value={list.data ? compact(list.data.totals.likes) : '—'} tone="emerald" />
        <Stat label="Me raportime" value={list.data?.totals.reported ?? '—'} tone="rose" />
        <Stat label="Të fshehura" value={list.data?.totals.hidden ?? '—'} tone="amber" />
      </div>
      <div className="flex flex-wrap gap-2">
        {([['all', 'Të gjitha'], ['reported', 'Të raportuara'], ['hidden', 'Të fshehura']] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
            className={cn('min-h-9 rounded-full px-3 text-sm font-bold', filter === id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300')}>{dt(label)}</button>
        ))}
        <button type="button" onClick={() => void list.reload()} className={cn(btn.ghost, 'ml-auto min-h-9 px-3 text-xs')}>{dt('Rifresko')}</button>
      </div>
      {list.loading && !list.data && <div className="flex justify-center p-6 text-slate-400"><Spinner className="h-5 w-5" /></div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <Panel key={r.id} className="space-y-2 p-3 sm:p-3">
            <div className="flex gap-3">
              {r.coverUrl
                ? <img src={r.coverUrl} alt="" loading="lazy" className="h-24 w-16 shrink-0 rounded-lg object-cover" />
                : <video src={r.mediaUrl} muted preload="metadata" className="h-24 w-16 shrink-0 rounded-lg object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-900 dark:text-white">{r.authorName || '—'}</p>
                <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{r.caption || dt('(pa përshkrim)')}</p>
                <p className="mt-1 text-xs text-slate-500">{fmt(r.createdAtMs)} · {Math.round(r.durationSec)}s</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span><Eye className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{r.views}</span>
                  <span><Heart className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{r.likes}</span>
                  {r.reports > 0 && <span className="text-rose-600"><Flag className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{r.reports}</span>}
                  {r.isHidden && <Badge tone="amber">{dt('E fshehur')}</Badge>}
                </p>
              </div>
            </div>
            {hide.target === r.id ? <HideForm id={r.id} hide={hide} /> : r.isHidden
              ? <button type="button" onClick={() => void hide.apply(r.id, false)} className={cn(btn.ghost, 'min-h-9 w-full px-3 text-xs')}><Eye className="h-3.5 w-3.5" aria-hidden="true" />{dt('Rikthe')}</button>
              : <button type="button" onClick={() => hide.setTarget(r.id)} className={cn(btn.ghost, 'min-h-9 w-full px-3 text-xs')}><EyeOff className="h-3.5 w-3.5" aria-hidden="true" />{dt('Fshih')}</button>}
          </Panel>
        ))}
      </div>
      {!list.loading && rows.length === 0 && <Panel><Empty>{dt('Asnjë Reel në këtë pamje.')}</Empty></Panel>}
    </div>
  );
}

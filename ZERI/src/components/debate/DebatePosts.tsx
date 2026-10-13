import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Flag, Megaphone, MessageCircle, Repeat2, Search, ThumbsUp, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import {
  bulkPosts,
  debatePosts,
  formatWhen,
  postReports,
  promotePost,
  type BulkAction,
  type PostFilter,
  type PostRow,
} from '../../lib/debateApi';
import { Badge, BulkBar, Empty, ErrorNote, Panel, Spinner, btn, inputClass, useLoad, useSelection } from './ui';

const FILTERS: ReadonlyArray<{ id: PostFilter; label: string; count?: 'all' | 'reported' | 'hidden' | 'promoted' }> = [
  { id: 'all', label: 'Të gjitha', count: 'all' },
  { id: 'reported', label: 'Të raportuara', count: 'reported' },
  { id: 'hidden', label: 'Të fshehura', count: 'hidden' },
  { id: 'promoted', label: 'Të promovuara', count: 'promoted' },
  { id: 'visible', label: 'Të dukshme' },
];

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  abuse: 'Gjuhë ofenduese',
  misinformation: 'Dezinformim',
  violence: 'Dhunë',
  illegal: 'Përmbajtje e paligjshme',
  other: 'Tjetër',
};

/**
 * Post moderation: find, select (one, many, all on screen) and act in bulk.
 * Nothing is deleted without a confirmation, and every action is audited by the server.
 */
export function DebatePosts({ initialFilter = 'all', onChanged }: { initialFilter?: PostFilter; onChanged?: () => void }) {
  const [filter, setFilter] = useState<PostFilter>(initialFilter);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [busy, setBusy] = useState(false);
  const [promoting, setPromoting] = useState<PostRow | null>(null);
  const [viewing, setViewing] = useState<PostRow | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { data, error, loading, reload } = useLoad(() => debatePosts(filter, debounced), [filter, debounced]);
  const posts = data?.posts ?? [];
  const ids = useMemo(() => posts.map((p) => p.id), [posts]);
  const selection = useSelection(ids);

  const run = async (action: BulkAction, label: string) => {
    const list = [...selection.selected];
    if (list.length === 0) return;
    const destructive = action === 'delete';
    if (destructive && !window.confirm(`${dt('Fshini përgjithmonë')} ${list.length} ${dt('postime? Ky veprim nuk kthehet.')}`)) return;
    setBusy(true);
    try {
      const { results } = await bulkPosts(action, list, destructive);
      const done = results.filter((r) => r.result === 'done').length;
      toast.success(`${dt(label)}: ${done}${done < results.length ? ` (${results.length - done} ${dt('nuk u gjetën')})` : ''}`);
      selection.clear();
      await reload();
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const single = async (row: PostRow, action: BulkAction, label: string) => {
    setBusy(true);
    try {
      await bulkPosts(action, [row.id], action === 'delete');
      toast.success(dt(label));
      await reload();
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={cn(
                'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition',
                filter === item.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5'
              )}
            >
              {dt(item.label)}
              {item.count && data && <span className="rounded-full bg-black/10 px-1.5 text-[10px]">{data.counts[item.count]}</span>}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={dt('Kërko në tekst, autor ose ID…')} aria-label={dt('Kërko postime')} className={cn(inputClass, 'pl-9')} />
          </label>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-700 dark:border-white/15 dark:text-slate-200">
            <input type="checkbox" checked={selection.allSelected} onChange={selection.toggleAll} className="h-4 w-4" />
            {dt('Zgjidh të gjitha')} ({posts.length})
          </label>
        </div>
      </Panel>

      <ErrorNote message={error} />

      {loading && posts.length === 0 ? (
        <Panel><Spinner /></Panel>
      ) : posts.length === 0 ? (
        <Panel><Empty>{dt('Asnjë postim nuk përputhet.')}</Empty></Panel>
      ) : (
        <ul className="space-y-2">
          {posts.map((post) => (
            <li
              key={post.id}
              className={cn(
                'rounded-2xl border bg-white p-3 shadow-sm sm:p-4 dark:bg-slate-900',
                selection.selected.has(post.id) ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-white/10',
                post.isHidden && 'opacity-75'
              )}
            >
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={selection.selected.has(post.id)} onChange={() => selection.toggle(post.id)} aria-label={`${dt('Zgjidh postimin e')} ${post.authorName}`} className="mt-1.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-black text-slate-900 dark:text-white">{post.authorName || '—'}</span>
                    <span className="text-slate-500">{formatWhen(post.createdAtMs)}</span>
                    {post.reportCount > 0 && <Badge tone="rose">{post.reportCount} {dt('raportime')}</Badge>}
                    {post.isHidden && <Badge tone="slate">{dt('E fshehur')}</Badge>}
                    {post.isAd && <Badge tone="amber">{dt('Promovuar')}{post.promotedUntilMs ? ` ${dt('deri')} ${new Date(post.promotedUntilMs).toLocaleDateString('sq-AL')}` : ''}</Badge>}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-100">{post.content}</p>
                  {post.imageUrl && <img src={post.imageUrl} alt="" loading="lazy" className="mt-2 max-h-40 rounded-xl object-cover" />}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" aria-hidden="true" />{post.viewCount}</span>
                    <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />{post.likes}</span>
                    <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{post.comments}</span>
                    <span className="inline-flex items-center gap-1"><Repeat2 className="h-3.5 w-3.5" aria-hidden="true" />{post.reposts}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {post.reportCount > 0 && (
                      <button type="button" onClick={() => setViewing(post)} className={cn(btn.ghost, 'min-h-9 px-3 text-xs')}><Flag className="h-3.5 w-3.5" aria-hidden="true" />{dt('Shiko raportimet')}</button>
                    )}
                    <button type="button" disabled={busy} onClick={() => void single(post, post.isHidden ? 'unhide' : 'hide', post.isHidden ? 'Postimi u shfaq' : 'Postimi u fsheh')} className={cn(btn.ghost, 'min-h-9 px-3 text-xs')}>
                      {post.isHidden ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
                      {post.isHidden ? dt('Shfaq') : dt('Fshih')}
                    </button>
                    {post.isAd ? (
                      <button type="button" disabled={busy} onClick={() => void single(post, 'unpromote', 'Promovimi u hoq')} className={cn(btn.ghost, 'min-h-9 px-3 text-xs')}>{dt('Hiq promovimin')}</button>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => setPromoting(post)} className={cn(btn.ghost, 'min-h-9 px-3 text-xs')}><Megaphone className="h-3.5 w-3.5" aria-hidden="true" />{dt('Promovo')}</button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <BulkBar count={selection.count} onClear={selection.clear}>
        <button type="button" disabled={busy} onClick={() => void run('hide', 'U fshehën')} className={cn(btn.ghost, 'min-h-9 border-white/30 px-3 text-white hover:bg-white/10')}><EyeOff className="h-4 w-4" aria-hidden="true" />{dt('Fshih')}</button>
        <button type="button" disabled={busy} onClick={() => void run('unhide', 'U shfaqën')} className={cn(btn.ghost, 'min-h-9 border-white/30 px-3 text-white hover:bg-white/10')}><Eye className="h-4 w-4" aria-hidden="true" />{dt('Shfaq')}</button>
        <button type="button" disabled={busy} onClick={() => void run('clear_reports', 'Raportimet u pastruan')} className={cn(btn.ghost, 'min-h-9 border-white/30 px-3 text-white hover:bg-white/10')}><Flag className="h-4 w-4" aria-hidden="true" />{dt('Pastro raportimet')}</button>
        <button type="button" disabled={busy} onClick={() => void run('unpromote', 'Promovimet u hoqën')} className={cn(btn.ghost, 'min-h-9 border-white/30 px-3 text-white hover:bg-white/10')}>{dt('Hiq promovimin')}</button>
        <button type="button" disabled={busy} onClick={() => void run('delete', 'U fshinë')} className={cn(btn.danger, 'min-h-9 px-3')}><Trash2 className="h-4 w-4" aria-hidden="true" />{dt('Fshi')}</button>
      </BulkBar>

      {promoting && (
        <PromoteDialog
          post={promoting}
          onClose={() => setPromoting(null)}
          onDone={async () => { setPromoting(null); await reload(); onChanged?.(); }}
        />
      )}
      {viewing && <ReportsDialog post={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl dark:bg-slate-900">
        <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function PromoteDialog({ post, onClose, onDone }: { post: PostRow; onClose: () => void; onDone: () => void | Promise<void> }) {
  const [days, setDays] = useState(7);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await promotePost(post.id, days, link.trim());
      toast.success(dt('Postimi u promovua.'));
      await onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={dt('Promovo postimin')} onClose={onClose}>
      <p className="mt-2 line-clamp-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{post.content}</p>
      <label className="mt-4 block text-xs font-bold text-slate-600 dark:text-slate-300">
        {dt('Sa ditë')}
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={cn(inputClass, 'mt-1')}>
          {[1, 3, 7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} {dt('ditë')}</option>)}
        </select>
      </label>
      <label className="mt-3 block text-xs font-bold text-slate-600 dark:text-slate-300">
        {dt('Link i reklamuesit (https://, opsional)')}
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" className={cn(inputClass, 'mt-1')} />
      </label>
      <div className="mt-3"><ErrorNote message={error} /></div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={btn.ghost}>{dt('Anulo')}</button>
        <button type="button" disabled={busy} onClick={() => void save()} className={btn.primary}>{busy ? <Spinner /> : dt('Promovo')}</button>
      </div>
    </Modal>
  );
}

function ReportsDialog({ post, onClose }: { post: PostRow; onClose: () => void }) {
  const { data, error, loading } = useLoad(() => postReports(post.id), [post.id]);
  return (
    <Modal title={`${dt('Raportimet')} (${post.reportCount})`} onClose={onClose}>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{post.content}</p>
      <div className="mt-3"><ErrorNote message={error} /></div>
      {loading ? <div className="py-6 text-center"><Spinner /></div> : (
        <ul className="mt-3 space-y-2">
          {(data?.reports ?? []).map((report, i) => (
            <li key={i} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
              <div className="flex items-center justify-between gap-2">
                <Badge tone="rose">{dt(REASON_LABELS[report.reason] ?? 'Tjetër')}</Badge>
                <span className="text-xs text-slate-500">{formatWhen(report.atMs)}</span>
              </div>
              {report.note && <p className="mt-1.5 text-slate-700 dark:text-slate-200">{report.note}</p>}
            </li>
          ))}
          {data && data.reports.length === 0 && <Empty>{dt('Nuk ka detaje.')}</Empty>}
        </ul>
      )}
      <div className="mt-4 flex justify-end"><button type="button" onClick={onClose} className={btn.ghost}>{dt('Mbyll')}</button></div>
    </Modal>
  );
}

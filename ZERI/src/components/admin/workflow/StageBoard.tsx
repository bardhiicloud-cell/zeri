import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCheck, ChevronDown, ChevronRight, Clock, Loader2, Search, UserRound, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { cn } from '../../../lib/utils';
import {
  ALL_STAGES,
  FLOW_STAGES,
  nextFlowStage,
  stageActor,
  stageText,
  type BoardKind,
  type NoteMode,
  type StageKey,
} from '../../../lib/workflowStages';

export interface BoardItem {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  /** A short label on the right of the row (urgency, category). */
  tag?: string;
  stage: StageKey;
  /** Whole days since the record was filed, when known. Shown as a fact, never as a deadline. */
  ageDays?: number | null;
  /** Who holds it now (a person or an office), when known. */
  owner?: string;
  /** Marked urgent by the record itself (e.g. "Kritike"). */
  urgent?: boolean;
}

type SortKey = 'list' | 'oldest' | 'newest' | 'urgent';
const SORTS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: 'list', label: 'Siç vijnë' },
  { value: 'oldest', label: 'Më të vjetrat së pari' },
  { value: 'newest', label: 'Më të rejat së pari' },
  { value: 'urgent', label: 'Urgjentet së pari' },
];

const ageLabel = (days: number) => (days === 0 ? dt('sot') : days === 1 ? `1 ${dt('ditë')}` : `${days} ${dt('ditë')}`);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('');

export type MoveCheck = { ok: true; note: NoteMode } | { ok: false; reason: string };

export interface StageBoardProps {
  kind: BoardKind;
  items: readonly BoardItem[];
  loading?: boolean;
  error?: string | null;
  /** Pure: may this person move this item to that stage? Drives the buttons and the counts. */
  check: (item: BoardItem, target: StageKey) => MoveCheck;
  /** Runs one move through the server. Throws with the reason when the server refuses. */
  move: (item: BoardItem, target: StageKey, note: string) => Promise<void>;
  onOpen?: (item: BoardItem) => void;
  /** Called after a batch finishes, so the list can reload. */
  onMoved?: () => void;
  moreAvailable?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  /** Told whenever the selection changes, so a screen can offer actions for it. */
  onSelectionChange?: (ids: string[]) => void;
}

const TONE: Record<StageKey, { chip: string; active: string; dot: string }> = {
  reported: { chip: 'text-slate-700 dark:text-slate-200', active: 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900', dot: 'bg-slate-500' },
  approved: { chip: 'text-indigo-700 dark:text-indigo-300', active: 'bg-indigo-600 text-white', dot: 'bg-indigo-500' },
  waiting: { chip: 'text-amber-700 dark:text-amber-300', active: 'bg-amber-500 text-white', dot: 'bg-amber-500' },
  responded: { chip: 'text-teal-700 dark:text-teal-300', active: 'bg-teal-600 text-white', dot: 'bg-teal-500' },
  completed: { chip: 'text-emerald-700 dark:text-emerald-300', active: 'bg-emerald-600 text-white', dot: 'bg-emerald-500' },
  rejected: { chip: 'text-rose-700 dark:text-rose-300', active: 'bg-rose-600 text-white', dot: 'bg-rose-500' },
};

const PAGE = 40;
const MIN_NOTE = 5;

interface Pending {
  target: StageKey;
  movable: BoardItem[];
  refused: Array<{ item: BoardItem; reason: string }>;
  note: NoteMode;
}

interface Result {
  target: StageKey;
  moved: number;
  failed: Array<{ title: string; reason: string }>;
}

/**
 * The staged board for one kind of work.
 *
 * One column is open at a time - the same layout on a phone and on a desk - with the
 * counts of every stage in the tabs above. Rows can be ticked one by one or all at once
 * ("select all" means everything the search shows in this stage, not only the rows
 * drawn), and the bar that appears offers each other stage as a target, with how many of
 * the selection can really go there. A refusal on one record (a report missing its
 * photo, a stage that belongs to the municipality) is listed with its reason and never
 * stops the others.
 */
export function StageBoard({ kind, items, loading, error, check, move, onOpen, onMoved, moreAvailable, onLoadMore, loadingMore, onSelectionChange }: StageBoardProps) {
  const [stage, setStage] = useState<StageKey>('reported');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('list');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const counts = useMemo(() => {
    const out = Object.fromEntries(ALL_STAGES.map(s => [s, 0])) as Record<StageKey, number>;
    for (const item of items) out[item.stage] += 1;
    return out;
  }, [items]);

  const inStage = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const found = items.filter(item =>
      item.stage === stage &&
      (!needle || `${item.title} ${item.subtitle ?? ''} ${item.id} ${item.tag ?? ''} ${item.owner ?? ''}`.toLowerCase().includes(needle))
    );
    if (sort === 'list') return found;
    const age = (item: BoardItem) => item.ageDays ?? -1;
    return [...found].sort((a, b) =>
      sort === 'oldest' ? age(b) - age(a)
        : sort === 'newest' ? age(a) - age(b)
          : Number(Boolean(b.urgent)) - Number(Boolean(a.urgent)) || age(b) - age(a)
    );
  }, [items, stage, query, sort]);

  /** What the person looking at this stage needs to know to move the work on. */
  const guide = useMemo(() => {
    const here = items.filter(item => item.stage === stage);
    const ages = here.map(item => item.ageDays).filter((d): d is number => typeof d === 'number');
    return {
      actor: stageActor(kind, stage),
      next: nextFlowStage(stage),
      oldest: ages.length ? Math.max(...ages) : null,
      urgent: here.filter(item => item.urgent).length,
      unheld: here.filter(item => item.owner !== undefined && !item.owner).length,
      tracksOwner: here.some(item => item.owner !== undefined),
    };
  }, [items, stage, kind]);

  // A selection belongs to the column it was made in.
  useEffect(() => {
    setSelected(new Set());
    setShown(PAGE);
    setPending(null);
  }, [stage, query]);

  useEffect(() => { onSelectionChange?.([...selected]); }, [selected, onSelectionChange]);

  // Records that left the list (moved, deleted elsewhere) drop out of the selection.
  useEffect(() => {
    setSelected(current => {
      const ids = new Set(inStage.map(i => i.id));
      const next = new Set([...current].filter(id => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [inStage]);

  useEffect(() => {
    if (pending?.note === 'required') noteRef.current?.focus();
  }, [pending]);

  const chosen = useMemo(() => inStage.filter(i => selected.has(i.id)), [inStage, selected]);
  const allSelected = inStage.length > 0 && selected.size === inStage.length;
  const busy = progress !== null;

  const toggle = (id: string) =>
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const targets = useMemo(
    () => ALL_STAGES.filter(s => s !== stage).map(target => {
      const reasons = chosen.map(item => refusalOf(check(item, target)));
      return {
        target,
        movable: reasons.filter(reason => reason === null).length,
        firstReason: reasons.find(reason => reason !== null) ?? '',
      };
    }),
    [chosen, check, stage]
  );

  const prepare = (target: StageKey, source: readonly BoardItem[]) => {
    const movable: BoardItem[] = [];
    const refused: Pending['refused'] = [];
    let needed: NoteMode = 'none';
    for (const item of source) {
      const verdict = check(item, target);
      if (verdict.ok === false) {
        refused.push({ item, reason: verdict.reason });
      } else {
        movable.push(item);
        if (verdict.note === 'required') needed = 'required';
        else if (verdict.note === 'optional' && needed === 'none') needed = 'optional';
      }
    }
    setNote('');
    setResult(null);
    setPending({ target, movable, refused, note: needed });
  };

  const run = async () => {
    if (!pending || busy) return;
    const text = note.trim();
    if (pending.note === 'required' && text.length < MIN_NOTE) {
      toast.error(dt('Shkruani shënimin (të paktën 5 shenja).'));
      noteRef.current?.focus();
      return;
    }
    const failed: Result['failed'] = pending.refused.map(r => ({ title: r.item.title, reason: r.reason }));
    let moved = 0;
    setProgress({ done: 0, total: pending.movable.length });
    for (const [index, item] of pending.movable.entries()) {
      try {
        await move(item, pending.target, text);
        moved += 1;
      } catch (caught) {
        failed.push({ title: item.title, reason: (caught as Error)?.message || dt('Serveri e refuzoi.') });
      }
      setProgress({ done: index + 1, total: pending.movable.length });
    }
    setProgress(null);
    setResult({ target: pending.target, moved, failed });
    setPending(null);
    setSelected(new Set());
    if (moved > 0) toast.success(`${moved} ${dt('u lëvizën te')} “${dt(stageText(kind, pending.target).label)}”.`);
    onMoved?.();
  };

  const visible = inStage.slice(0, shown);
  const text = stageText(kind, stage);

  return (
    <section aria-label={dt('Tabela e fazave')} className="space-y-4">
      <div role="tablist" aria-label={dt('Fazat')} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {[...FLOW_STAGES, 'rejected' as StageKey].map(key => {
          const label = stageText(kind, key).label;
          const active = stage === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStage(key)}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-bold transition',
                active ? `${TONE[key].active} border-transparent shadow-sm` : `border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-white/5 ${TONE[key].chip}`
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', active ? 'bg-white/80' : TONE[key].dot)} aria-hidden="true" />
              {dt(label)}
              <span className={cn('rounded-full px-1.5 text-[11px] font-black tabular-nums', active ? 'bg-white/25' : 'bg-slate-100 dark:bg-white/10')}>{counts[key]}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900" data-testid="stage-guide">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900 dark:text-white">{dt(text.label)}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{dt(text.hint)}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            {guide.oldest !== null && guide.oldest > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200"><Clock className="h-3 w-3" aria-hidden="true" />{dt('Më e vjetra')}: {ageLabel(guide.oldest)}</span>
            )}
            {guide.urgent > 0 && <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">{guide.urgent} {dt('urgjente')}</span>}
            {guide.tracksOwner && guide.unheld > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">{guide.unheld} {dt('pa të zot')}</span>}
          </div>
        </div>
        {(guide.actor || guide.next) && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300">
            {guide.actor && <span><strong className="text-slate-900 dark:text-white">{dt(guide.actor.who)}</strong>: {dt(guide.actor.does)}</span>}
            {guide.next && (
              <span className="inline-flex items-center gap-1 font-bold text-blue-700 dark:text-blue-300">
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />{dt('Më pas')}: {dt(stageText(kind, guide.next).label)}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <span className="sr-only">{dt('Kërko në këtë fazë')}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={dt('Kërko në këtë fazë…')}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-base text-slate-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
          <span className="sr-only sm:not-sr-only">{dt('Rendit')}</span>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-2.5 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
          >
            {SORTS.map(option => <option key={option.value} value={option.value}>{dt(option.label)}</option>)}
          </select>
        </label>
        <button
          type="button"
          disabled={inStage.length === 0 || busy}
          onClick={() => setSelected(allSelected ? new Set() : new Set(inStage.map(i => i.id)))}
          aria-pressed={allSelected}
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-bold transition disabled:opacity-50',
            allSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200'
          )}
        >
          <CheckCheck className="h-4 w-4" aria-hidden="true" />
          {allSelected ? dt('Hiq zgjedhjen') : `${dt('Zgjidh të gjitha')} (${inStage.length})`}
        </button>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-14 z-20 rounded-2xl border border-blue-200 bg-blue-50/95 p-3 shadow-md backdrop-blur dark:border-blue-400/30 dark:bg-slate-900/95">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black text-blue-900 dark:text-blue-100">
              {selected.size} {dt('të zgjedhura')} · {dt('zhvendos te')}:
            </p>
            <button type="button" onClick={() => setSelected(new Set())} aria-label={dt('Pastro zgjedhjen')} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-blue-100 dark:hover:bg-white/10">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {targets.map(({ target, movable, firstReason }) => (
              <button
                key={target}
                type="button"
                disabled={busy || movable === 0}
                onClick={() => prepare(target, chosen)}
                title={movable === 0 ? firstReason : movable < chosen.length ? `${chosen.length - movable} ${dt('nuk mund të lëvizin')}: ${firstReason}` : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45',
                  target === 'rejected' ? 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-400/40 dark:bg-transparent dark:text-rose-300' : 'bg-blue-600 text-white hover:bg-blue-700'
                )}
              >
                {dt(stageText(kind, target).label)}
                <span className="rounded-full bg-black/10 px-1.5 text-[11px] font-black tabular-nums dark:bg-white/20">{movable}/{chosen.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {pending && (
        <div role="dialog" aria-label={dt('Konfirmo lëvizjen')} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-white/10 dark:bg-slate-900">
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {pending.movable.length === 0
              ? dt('Asnjë nga të zgjedhurat nuk mund të lëvizë.')
              : `${dt('Do të lëvizin')} ${pending.movable.length} ${dt('te')} “${dt(stageText(kind, pending.target).label)}”.`}
          </p>
          {pending.refused.length > 0 && (
            <details className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <summary className="cursor-pointer font-bold">{pending.refused.length} {dt('nuk mund të lëvizin dhe do të mbeten ku janë')}</summary>
              <ul className="mt-2 space-y-1">
                {pending.refused.slice(0, 20).map(({ item, reason }) => (
                  <li key={item.id}><strong>{item.title}</strong>: {reason}</li>
                ))}
              </ul>
            </details>
          )}
          {pending.movable.length > 0 && pending.note !== 'none' && (
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
              {pending.note === 'required' ? dt('Shënim (i detyrueshëm, shfaqet te qytetari)') : dt('Shënim (opsional)')}
              <textarea
                ref={noteRef}
                value={note}
                onChange={e => setNote(e.target.value.slice(0, 300))}
                rows={3}
                className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 outline-none focus:border-blue-500 dark:border-white/15 dark:bg-slate-800 dark:text-white"
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || pending.movable.length === 0}
              onClick={() => void run()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              {busy && progress ? `${progress.done}/${progress.total}` : dt('Konfirmo')}
            </button>
            <button type="button" disabled={busy} onClick={() => setPending(null)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
              {dt('Anulo')}
            </button>
          </div>
          <p className="sr-only" aria-live="polite">{progress ? `${progress.done} / ${progress.total}` : ''}</p>
        </div>
      )}

      {result && (
        <div role="status" className={cn('rounded-2xl border p-4 text-sm', result.failed.length ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-100' : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-950/30 dark:text-emerald-100')}>
          <div className="flex items-start justify-between gap-2">
            <p className="font-black">
              {result.moved} {dt('u lëvizën te')} “{dt(stageText(kind, result.target).label)}”
              {result.failed.length > 0 && <> · {result.failed.length} {dt('mbetën ku ishin')}</>}
            </p>
            <button type="button" onClick={() => setResult(null)} aria-label={dt('Mbyll')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/5">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {result.failed.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {result.failed.slice(0, 30).map((f, i) => (
                <li key={i} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span><strong>{f.title}</strong>: {f.reason}</span></li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{dt('Duke ngarkuar…')}</div>
      ) : inStage.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
          {query.trim() ? dt('Asgjë nuk përputhet me kërkimin.') : dt('Asgjë në këtë fazë.')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-slate-900">
          {visible.map(item => {
            const picked = selected.has(item.id);
            const next = nextStage(stage);
            const forward = next ? check(item, next) : null;
            return (
              <li key={item.id} className={cn('flex items-center gap-2 px-2 py-1.5 sm:gap-3 sm:px-3', picked && 'bg-blue-50/70 dark:bg-blue-500/10')}>
                <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    checked={picked}
                    disabled={busy}
                    onChange={() => toggle(item.id)}
                    aria-label={`${dt('Zgjidh')} ${item.title}`}
                    className="h-5 w-5 accent-blue-600"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => (onOpen ? onOpen(item) : toggle(item.id))}
                  className="min-w-0 flex-1 py-1.5 text-left"
                >
                  <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{item.title}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {[item.subtitle, item.meta].filter(Boolean).join(' · ')}
                  </span>
                  {(typeof item.ageDays === 'number' || item.owner !== undefined) && (
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {typeof item.ageDays === 'number' && (
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold', item.ageDays >= 7 ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300')}>
                          <Clock className="h-3 w-3" aria-hidden="true" />{ageLabel(item.ageDays)}
                        </span>
                      )}
                      {item.owner !== undefined && (
                        item.owner
                          ? <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[8px] text-white" aria-hidden="true">{initials(item.owner)}</span>{item.owner}</span>
                          : <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400"><UserRound className="h-3 w-3" aria-hidden="true" />{dt('Pa të zot')}</span>
                      )}
                      {item.urgent && <span className="rounded-full bg-rose-100 px-2 py-0.5 font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">{dt('Urgjente')}</span>}
                    </span>
                  )}
                </button>
                {item.tag && <span className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 sm:inline dark:bg-white/10 dark:text-slate-300">{item.tag}</span>}
                {next && forward?.ok && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => prepare(next, [item])}
                    title={`${dt('Lëviz te')} ${dt(stageText(kind, next).label)}`}
                    aria-label={`${dt('Lëviz te')} ${dt(stageText(kind, next).label)}: ${item.title}`}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-black text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-white/10"
                  >
                    <span className="hidden md:inline">{dt(stageText(kind, next).label)}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {inStage.length > shown && (
        <button type="button" onClick={() => setShown(n => n + PAGE)} className="mx-auto flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
          {dt('Shfaq edhe')} {Math.min(PAGE, inStage.length - shown)} · {inStage.length - shown} {dt('të mbetura')}
        </button>
      )}

      {moreAvailable && onLoadMore && (
        <button type="button" disabled={loadingMore} onClick={onLoadMore} className="mx-auto flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900">
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {dt('Ngarko më shumë nga serveri')}
        </button>
      )}
    </section>
  );
}

/** Why a move is refused, or null when it is allowed. */
function refusalOf(verdict: MoveCheck): string | null {
  return verdict.ok === false ? verdict.reason : null;
}

/** The stage after this one in the flow, if any. */
function nextStage(stage: StageKey): StageKey | null {
  const index = FLOW_STAGES.indexOf(stage);
  return index >= 0 && index < FLOW_STAGES.length - 1 ? FLOW_STAGES[index + 1] : null;
}

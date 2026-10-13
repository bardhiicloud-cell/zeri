import { useMemo } from 'react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { HEADLINE_SLOTS, LATEST_SLOTS, RAIL_SLOTS, TICKER_SLOTS, layoutNews, placeCandidate, type NewsSlotPosition } from '../../lib/newsPlacement';

export interface PreviewArticle {
  id: string;
  title: string;
  category: string;
  published: boolean;
  position?: NewsSlotPosition;
  createdAt?: string;
}

interface Props {
  /** Every article the editor can see; unpublished ones are ignored. */
  items: readonly PreviewArticle[];
  editingId: string | null;
  draft: { title: string; category: string; position: NewsSlotPosition; imageUrl: string };
  /** Whether the article is (or will be, on saving) public. */
  willBePublic: boolean;
}

const CANDIDATE = '__candidate__';

/**
 * The public news page in miniature, built with the same layout function the page
 * uses. The article being edited is highlighted wherever it will appear; the other
 * slots show the real titles currently there, so the editor sees what it pushes out.
 */
export default function NewsPlacementPreview({ items, editingId, draft, willBePublic }: Props) {
  const { layout, placement, pushedOut } = useMemo(() => {
    const others = items
      .filter(item => item.published && item.id !== editingId)
      .map(item => ({ ...item, when: Date.parse(item.createdAt ?? '') || 0 }));
    const editing = editingId ? items.find(item => item.id === editingId) : undefined;
    const candidate = {
      id: CANDIDATE,
      title: draft.title.trim() || dt('Titulli i lajmit'),
      category: draft.category,
      published: true,
      position: draft.position,
      // An existing article keeps its place in time; a new one is the newest.
      when: editing ? Date.parse(editing.createdAt ?? '') || 0 : Date.now(),
    };
    const list = willBePublic ? [...others, candidate].sort((a, b) => b.when - a.when) : others.sort((a, b) => b.when - a.when);
    const before = layoutNews(others.sort((a, b) => b.when - a.when));
    const after = layoutNews(list);
    return {
      layout: after,
      placement: placeCandidate(others, candidate, willBePublic),
      // The story that stops being the lead because of this one.
      pushedOut: willBePublic && after.lead?.id === CANDIDATE && before.lead ? before.lead : undefined,
    };
  }, [items, editingId, draft.title, draft.category, draft.position, willBePublic]);

  const Slot = ({ item, className, children }: { item: { id: string; title: string }; className?: string; children?: React.ReactNode }) => {
    const mine = item.id === CANDIDATE;
    return (
      <div className={cn(
        'min-w-0 rounded-md border px-2 py-1.5 text-[10px] leading-snug',
        mine
          ? 'border-blue-600 bg-blue-600 font-black text-white shadow-md shadow-blue-600/20 ring-2 ring-blue-300 dark:ring-blue-500/40'
          : 'border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400',
        className,
      )}>
        {children}
        <span className="line-clamp-2 block">{mine ? `★ ${item.title}` : item.title}</span>
      </div>
    );
  };

  const where: string[] = [];
  if (placement.lead) where.push(dt('Lajmi kryesor në ballinë'));
  if (placement.latest) where.push(`${dt('Kolona majtas')} #${placement.latest}`);
  if (placement.rail) where.push(`${dt('Kolona djathtas')} #${placement.rail}`);
  if (placement.ticker) where.push(`${dt('Shiriti "Të fundit"')} #${placement.ticker}`);
  if (placement.headline) where.push(`${dt('Titujt e ditës')} ${String(placement.headline).padStart(2, '0')}`);
  if (placement.archivePage) where.push(`${dt('Arkivi')} · ${dt('faqja')} ${placement.archivePage}`);

  return (
    <section aria-label={dt('Parapamja e vendosjes')} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800/40">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-black text-slate-900 dark:text-white">{dt('Ku do të dalë ky lajm')}</h4>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{dt('Parapamje e faqes /lajme')}</span>
      </div>

      {!willBePublic ? (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {dt('Ky lajm është draft dhe nuk shfaqet në faqen publike. Vendet më poshtë janë ato që do të zinte pasi të publikohet.')}
        </p>
      ) : null}

      <p className="mb-3 text-xs font-bold text-blue-800 dark:text-blue-200" data-testid="placement-summary">
        {where.length ? `${dt('Do të shfaqet në')}: ${where.join(' · ')}` : dt('Vendi i zgjedhur nuk e vendos në asnjë nga vendet e faqes kryesore; do të gjendet në arkiv.')}
      </p>
      {pushedOut && (
        <p className="mb-3 text-[11px] text-slate-600 dark:text-slate-300">
          {dt('Zëvendëson si lajm kryesor')}: <strong>{pushedOut.title}</strong>
        </p>
      )}

      <div className="space-y-2 rounded-lg border border-slate-300 bg-white p-2.5 dark:border-white/10 dark:bg-slate-950">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="shrink-0 rounded bg-rose-600 px-1.5 py-1 text-[9px] font-black uppercase text-white">{dt('Të fundit')}</span>
          <div className="flex min-w-0 flex-1 gap-1.5">
            {layout.ticker.slice(0, 3).map(item => <Slot key={item.id} item={item} className="flex-1" />)}
            {layout.ticker.length > 3 && <span className="self-center text-[9px] text-slate-400">+{Math.min(layout.ticker.length, TICKER_SLOTS) - 3}</span>}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_1.6fr_1fr] gap-2">
          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{dt('Majtas')} · {LATEST_SLOTS}</p>
            {layout.latest.map(item => <Slot key={item.id} item={item} />)}
          </div>
          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{dt('Kryesori')}</p>
            {layout.lead ? (
              <Slot item={layout.lead} className="py-5 text-xs">
                {layout.lead.id === CANDIDATE && draft.imageUrl && <img src={draft.imageUrl} alt="" className="mb-1.5 aspect-video w-full rounded object-cover" />}
              </Slot>
            ) : <div className="rounded-md border border-dashed border-slate-300 p-4 text-center text-[10px] text-slate-400">{dt('Bosh')}</div>}
          </div>
          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{dt('Djathtas')} · {RAIL_SLOTS}</p>
            {layout.rail.map(item => <Slot key={item.id} item={item} />)}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[9px] font-black uppercase tracking-wider text-slate-400">{dt('Titujt e ditës')} · {HEADLINE_SLOTS}</p>
          <ol className="grid grid-cols-3 gap-1.5">
            {layout.headlines.map((item, index) => (
              <li key={item.id} className="min-w-0">
                <Slot item={item}>
                  <span className="mr-1 font-serif text-xs font-black opacity-60">{String(index + 1).padStart(2, '0')}</span>
                </Slot>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

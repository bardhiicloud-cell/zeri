import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, Search } from 'lucide-react';
import {
  ERAS, ERA_LABELS, EVIDENCE, EVIDENCE_STATUSES, byDate, pick,
  type EraId, type EvidenceStatus, type HeritageEntry, type HeritageLang,
} from '../../lib/heritage/types';
import { ui } from '../../lib/heritage/ui';
import type { HeritageContent } from '../../lib/heritage/content';
import { sourcesFor } from '../../lib/heritage/content';
import { ClaimsView, EntryMeta, EvidenceBadge, Prose, SourceCitations, entryPath } from './Atoms';

const yearOf = (entry: HeritageEntry): string => {
  const raw = entry.date?.from ?? '';
  const neg = raw.startsWith('-');
  const m = /^-?(\d{1,4})/.exec(raw);
  return m ? `${neg ? '−' : ''}${Number(m[1])}` : '—';
};

/**
 * The chronicle: a vertical spine of dated entries.
 *
 * Filters (period, evidence status, text) narrow the list without a round trip; each item
 * opens in place to its full text, dated claims and sources, so a reader can compare three
 * events without leaving the page, and still link to a full page per entry. Everything is a
 * real button/link, so it works from the keyboard and in a screen reader.
 */
export function Chronicle({ entries, content, lang, title, defaultOpenFirst = false }: {
  entries: HeritageEntry[]; content: HeritageContent; lang: HeritageLang; title?: string; defaultOpenFirst?: boolean;
}) {
  const sorted = useMemo(() => [...entries].sort(byDate), [entries]);
  const [era, setEra] = useState<EraId | 'all'>('all');
  const [evidence, setEvidence] = useState<EvidenceStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpenFirst && sorted[0] ? [sorted[0].id] : []));

  const eras = ERAS.filter((e) => sorted.some((x) => x.era === e));
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filtered = sorted.filter((e) => {
    if (era !== 'all' && e.era !== era) return false;
    if (evidence !== 'all' && e.evidence !== evidence) return false;
    if (query && !norm(`${pick(e.title, lang)} ${pick(e.summary, lang)} ${e.place?.name ?? ''}`).includes(norm(query))) return false;
    return true;
  });

  const years = Array.from(new Set(filtered.map(yearOf)));
  const toggle = (id: string) => setOpen((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  let lastYear = '';
  return (
    <section aria-label={title ?? ui('timeline', lang)} className="space-y-5">
      <div className="hx-card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label={ui('filterText', lang)} placeholder={ui('filterText', lang)}
              className="min-h-11 w-full rounded-xl border bg-transparent pl-9 pr-3 text-sm hx-rule" style={{ color: 'var(--hx-ink)' }} />
          </div>
          <label className="sr-only" htmlFor="hx-ev">{ui('filterEvidence', lang)}</label>
          <select id="hx-ev" value={evidence} onChange={(e) => setEvidence(e.target.value as EvidenceStatus | 'all')} className="min-h-11 rounded-xl border bg-transparent px-3 text-sm hx-rule" style={{ color: 'var(--hx-ink)' }}>
            <option value="all">{ui('filterEvidence', lang)}: {ui('filterAll', lang)}</option>
            {EVIDENCE_STATUSES.map((s) => <option key={s} value={s}>{EVIDENCE[s].label[lang]}</option>)}
          </select>
        </div>
        {eras.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={ui('filterEra', lang)}>
            {(['all', ...eras] as const).map((e) => (
              <button key={e} type="button" aria-pressed={era === e} onClick={() => setEra(e)}
                className="min-h-9 rounded-full border px-3 text-xs font-bold transition hx-rule"
                style={era === e ? { background: 'var(--hx-ink)', color: 'var(--hx-paper)', borderColor: 'var(--hx-ink)' } : { color: 'var(--hx-ink-2)' }}>
                {e === 'all' ? ui('filterAll', lang) : ERA_LABELS[e][lang]}
              </button>
            ))}
          </div>
        )}
        {years.length > 3 && (
          <nav aria-label={ui('jumpTo', lang)} className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="hx-ink-3 font-bold">{ui('jumpTo', lang)}:</span>
            {years.map((y) => <a key={y} href={`#hx-y-${y}`} className="hx-brass rounded px-1.5 py-0.5 font-black underline-offset-2 hover:underline">{y}</a>)}
          </nav>
        )}
        <p className="hx-ink-3 text-xs" role="status">{ui('showing', lang)} {filtered.length} {ui('of', lang)} {sorted.length}</p>
      </div>

      <ol className="hx-chron space-y-1">
        {filtered.map((e) => {
          const y = yearOf(e);
          const showYear = y !== lastYear;
          lastYear = y;
          const isOpen = open.has(e.id);
          return (
            <li key={e.id} className="hx-chron-item pb-5" data-open={isOpen}>
              <span className="hx-chron-dot" aria-hidden="true" />
              {showYear && <h3 id={`hx-y-${y}`} className="hx-year mb-2 scroll-mt-28 text-3xl leading-none">{y}</h3>}
              <article className="hx-card p-4">
                <button type="button" aria-expanded={isOpen} aria-controls={`hx-b-${e.id}`} onClick={() => toggle(e.id)} className="flex w-full items-start gap-3 text-left">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <EntryMeta entry={e} lang={lang} />
                    <h4 className="hx-serif text-lg font-black leading-snug" style={{ color: 'var(--hx-ink)' }}>{pick(e.title, lang)}</h4>
                    <p className="hx-ink-2 text-sm leading-relaxed">{pick(e.summary, lang)}</p>
                    <EvidenceBadge status={e.evidence} lang={lang} />
                  </div>
                  <ChevronDown className={`mt-1 h-5 w-5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  <span className="sr-only">{isOpen ? ui('collapse', lang) : ui('expand', lang)}</span>
                </button>
                {isOpen && (
                  <div id={`hx-b-${e.id}`} className="mt-4 space-y-4 border-t pt-4 hx-rule">
                    <Prose text={pick(e.body, lang)} />
                    <ClaimsView entry={e} content={content} lang={lang} />
                    <div>
                      <h5 className="hx-eyebrow mb-2">{ui('sources', lang)}</h5>
                      <SourceCitations sources={sourcesFor(content, e)} lang={lang} />
                    </div>
                    <Link to={entryPath(e)} className="hx-brass inline-flex items-center gap-1 text-sm font-black underline-offset-4 hover:underline">
                      {ui('fullEntry', lang)}<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                )}
              </article>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="hx-ink-3 hx-chron-item py-8 text-sm">{ui('noResults', lang)}</li>}
      </ol>
    </section>
  );
}

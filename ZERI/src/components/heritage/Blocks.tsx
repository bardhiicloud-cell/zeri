import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { pick, type HeritageEntry, type HeritageLang } from '../../lib/heritage/types';
import type { HeritageContent } from '../../lib/heritage/content';
import { sourcesFor } from '../../lib/heritage/content';
import { ui } from '../../lib/heritage/ui';
import {
  ClaimsView, EntryMeta, EvidenceBadge, LangFallback, MediaFigure, Prose, SourceCitations, VerificationNote, entryPath,
} from './Atoms';

/** A catalogue card: used where an entry is a doorway to its own page. */
export function EntryCard({ entry, lang, lead }: { entry: HeritageEntry; lang: HeritageLang; lead?: boolean }) {
  return (
    <Link to={entryPath(entry)} className={`hx-plate group block p-5 ${lead ? 'sm:p-7' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <EntryMeta entry={entry} lang={lang} />
        <ArrowUpRight className="h-5 w-5 shrink-0 opacity-50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" aria-hidden="true" />
      </div>
      <h3 className={`hx-serif mt-2 font-black leading-tight ${lead ? 'text-2xl sm:text-3xl' : 'text-lg'}`} style={{ color: 'var(--hx-ink)' }}>{pick(entry.title, lang)}</h3>
      <p className={`hx-ink-2 mt-2 leading-relaxed ${lead ? 'text-base' : 'text-sm'}`}>{pick(entry.summary, lang)}</p>
      <div className="mt-3"><EvidenceBadge status={entry.evidence} lang={lang} /></div>
    </Link>
  );
}

/** An entry read in place (archive chapters): full text, dated claims, sources, corrections. */
export function ArticleBlock({ entry, content, lang, headingLevel = 2 }: {
  entry: HeritageEntry; content: HeritageContent; lang: HeritageLang; headingLevel?: 2 | 3;
}) {
  const H = (`h${headingLevel}`) as 'h2' | 'h3';
  const sources = sourcesFor(content, entry);
  return (
    <article id={entry.id} className="hx-card scroll-mt-28 min-w-0 space-y-4 p-4 sm:p-7">
      <header className="space-y-2">
        <EntryMeta entry={entry} lang={lang} />
        <H className="hx-serif text-xl font-black leading-tight [overflow-wrap:anywhere] sm:text-2xl" style={{ color: 'var(--hx-ink)' }}>
          <Link to={entryPath(entry)} className="hover:underline decoration-[var(--hx-brass-2)] underline-offset-4">{pick(entry.title, lang)}</Link>
        </H>
        <EvidenceBadge status={entry.evidence} lang={lang} />
      </header>
      <LangFallback entry={entry} lang={lang} />
      <p className="hx-serif text-lg italic leading-snug" style={{ color: 'var(--hx-ink)' }}>{pick(entry.summary, lang)}</p>
      <Prose text={pick(entry.body, lang)} />
      {entry.media.map((m) => <MediaFigure key={m.id} media={m} lang={lang} />)}
      <ClaimsView entry={entry} content={content} lang={lang} />
      {entry.corrections.length > 0 && (
        <div className="rounded-xl border p-3 text-sm hx-rule">
          <p className="hx-eyebrow mb-1">{ui('corrections', lang)}</p>
          <ul className="space-y-1">{entry.corrections.map((c, i) => <li key={i}><strong>{c.at}</strong> — {pick(c.text, lang)}</li>)}</ul>
        </div>
      )}
      {sources.length > 0 && (
        <details className="group">
          <summary className="hx-eyebrow cursor-pointer select-none list-none py-1">{ui('sources', lang)} ({sources.length})</summary>
          <div className="mt-3"><SourceCitations sources={sources} lang={lang} /></div>
        </details>
      )}
      <VerificationNote entry={entry} lang={lang} />
    </article>
  );
}

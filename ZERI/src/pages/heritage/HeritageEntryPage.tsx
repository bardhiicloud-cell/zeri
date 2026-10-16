import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { usePageMeta } from '../../lib/usePageMeta';
import { useHeritage } from '../../lib/heritage/api';
import { entriesOf, entryById, sourcesFor } from '../../lib/heritage/content';
import { KIND_LABELS, ERA_LABELS, findSection, formatHeritageDate, pick, type HeritageArea } from '../../lib/heritage/types';
import {
  ClaimsView, Crumbs, EntryMeta, EvidenceBadge, LangFallback, MediaFigure, Prose, SensitiveGate, SourceCitations, VerificationNote,
  sectionPath, useHeritageLang, useJsonLd,
} from '../../components/heritage/Atoms';
import { EntryCard } from '../../components/heritage/Blocks';
import NotFoundPage from '../NotFoundPage';

/** /kosova/:section/:id and /historia-e-uck/:section/:id — one entry as a reading page. */
export default function HeritageEntryPage() {
  const { section: sectionId = '', id = '' } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const area: HeritageArea = pathname.includes('/historia-e-uck') ? 'uck' : 'kosova';
  const { lang, t } = useHeritageLang();
  const { content } = useHeritage();

  const entry = entryById(content, id);
  const section = findSection(area, sectionId);
  const valid = !!entry && !!section && entry.area === area && entry.section === sectionId;

  usePageMeta(entry ? pick(entry.title, lang) : t('kosovo'), entry ? pick(entry.summary, lang) : undefined);

  const jsonLd = useMemo(() => {
    if (!valid || !entry) return null;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    return {
      '@context': 'https://schema.org',
      '@type': entry.kind === 'event' ? 'Event' : 'Article',
      [entry.kind === 'event' ? 'name' : 'headline']: pick(entry.title, lang),
      description: pick(entry.summary, lang),
      inLanguage: lang,
      mainEntityOfPage: url,
      ...(entry.date ? { [entry.kind === 'event' ? 'startDate' : 'datePublished']: entry.date.from } : {}),
      ...(entry.updatedAt ? { dateModified: entry.updatedAt } : {}),
      publisher: { '@type': 'Organization', name: 'Zëri i Qytetarëve' },
      citation: sourcesFor(content, entry).filter((s) => s.url).map((s) => s.url),
    };
  }, [valid, entry, lang, content]);
  useJsonLd(jsonLd);

  const related = useMemo(() => entriesOf(content, area, sectionId).filter((e) => e.id !== id).slice(0, 3), [content, area, sectionId, id]);

  if (!valid || !entry || !section) return <NotFoundPage />;

  const base = area === 'uck' ? '/historia-e-uck' : '/kosova';
  const body = (
    <>
      <LangFallback entry={entry} lang={lang} />
      <Prose text={pick(entry.body, lang)} dropcap />
      {entry.media.map((m) => <MediaFigure key={m.id} media={m} lang={lang} />)}
      <ClaimsView entry={entry} content={content} lang={lang} />
    </>
  );

  return (
    <div data-no-translate className="hx hx-page -mx-3 -my-3 sm:-mx-5 sm:-my-4 lg:-mx-8">
      <article className="mx-auto max-w-[820px] space-y-8 px-4 pb-20 pt-4 sm:px-6 lg:pt-6">
        <Crumbs items={[
          { to: '/', label: t('home') },
          { to: base, label: area === 'uck' ? t('uckTitle') : t('kosovo') },
          { to: sectionPath(area, section.id), label: section.title[lang] },
          { label: pick(entry.title, lang) },
        ]} />

        <header className="space-y-4">
          <p className="hx-eyebrow">{section.numeral} · {KIND_LABELS[entry.kind][lang]}{entry.era ? ` · ${ERA_LABELS[entry.era][lang]}` : ''}</p>
          <h1 className="hx-serif text-4xl font-black leading-[1.02] sm:text-5xl" style={{ color: 'var(--hx-ink)' }}>{pick(entry.title, lang)}</h1>
          <p className="hx-serif text-xl italic leading-snug" style={{ color: 'var(--hx-ink-2)' }}>{pick(entry.summary, lang)}</p>
          <div className="flex flex-wrap items-center gap-3 border-y py-3 hx-rule">
            <EvidenceBadge status={entry.evidence} lang={lang} />
            <EntryMeta entry={entry} lang={lang} />
            <button type="button" onClick={() => window.print()} className="hx-ink-3 ml-auto inline-flex items-center gap-1.5 text-xs font-bold hover:underline"><Printer className="h-4 w-4" aria-hidden="true" />{t('printPage')}</button>
          </div>
        </header>

        {entry.sensitive === 'none'
          ? body
          : <SensitiveGate id={`entry-${entry.id}`} kind={entry.sensitive} lang={lang} onLeave={() => navigate(sectionPath(area, section.id))}>{body}</SensitiveGate>}

        {entry.corrections.length > 0 && (
          <section aria-labelledby="hx-corr" className="hx-card p-5">
            <h2 id="hx-corr" className="hx-eyebrow mb-2">{t('corrections')}</h2>
            <ul className="space-y-1.5 text-sm">{entry.corrections.map((c, i) => <li key={i}><strong>{c.at}</strong> — {pick(c.text, lang)}</li>)}</ul>
          </section>
        )}

        <section aria-labelledby="hx-src" className="hx-card space-y-4 p-5 sm:p-7">
          <h2 id="hx-src" className="hx-eyebrow">{t('sources')}</h2>
          <SourceCitations sources={sourcesFor(content, entry)} lang={lang} />
          <VerificationNote entry={entry} lang={lang} />
          <p className="hx-ink-3 text-xs">{t('version')} {entry.version}{entry.updatedAt ? ` · ${t('updated')} ${formatHeritageDate({ from: entry.updatedAt.slice(0, 10), precision: 'day' }, lang)}` : ''}</p>
        </section>

        {related.length > 0 && (
          <section aria-labelledby="hx-rel" className="space-y-4">
            <h2 id="hx-rel" className="hx-eyebrow">{t('related')}</h2>
            <div className="grid gap-4 md:grid-cols-3">{related.map((e) => <EntryCard key={e.id} entry={e} lang={lang} />)}</div>
          </section>
        )}
      </article>
    </div>
  );
}

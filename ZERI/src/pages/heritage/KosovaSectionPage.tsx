import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { usePageMeta } from '../../lib/usePageMeta';
import { useHeritage } from '../../lib/heritage/api';
import { entriesOf } from '../../lib/heritage/content';
import { KOSOVA_SECTIONS, findSection } from '../../lib/heritage/types';
import { PlateArt } from '../../components/heritage/HeritageArt';
import { Crumbs, sectionPath, useHeritageLang } from '../../components/heritage/Atoms';
import { EntryCard } from '../../components/heritage/Blocks';
import { Chronicle } from '../../components/heritage/Chronicle';
import NotFoundPage from '../NotFoundPage';

/** /kosova/:section — one of the ten chapters. Dated entries become a chronicle; the rest are catalogue cards. */
export default function KosovaSectionPage() {
  const { section: sectionId = '' } = useParams();
  const { lang, t } = useHeritageLang();
  const { content } = useHeritage();
  const navigate = useNavigate();
  const section = findSection('kosova', sectionId);

  usePageMeta(section ? `${section.title[lang]} — ${t('kosovo')}` : t('kosovo'), section?.lead[lang]);

  const all = useMemo(() => entriesOf(content, 'kosova', sectionId), [content, sectionId]);
  const dated = useMemo(() => all.filter((e) => e.date && (e.kind === 'event' || e.kind === 'biography')), [all]);
  const useChronicle = dated.length >= 4;
  const cards = useChronicle ? all.filter((e) => !dated.includes(e)) : all;

  if (!section) return <NotFoundPage />;
  const index = KOSOVA_SECTIONS.findIndex((s) => s.id === section.id);
  const prev = KOSOVA_SECTIONS[index - 1];
  const next = KOSOVA_SECTIONS[index + 1];

  return (
    <div data-no-translate className="hx hx-page -mx-3 -my-3 sm:-mx-5 sm:-my-4 lg:-mx-8">
      <div className="mx-auto max-w-[1100px] space-y-10 px-4 pb-20 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <Crumbs items={[{ to: '/', label: t('home') }, { to: '/kosova', label: t('kosovo') }, { label: section.title[lang] }]} />

        <header className="hx-hero relative isolate overflow-hidden rounded-[28px]">
          <div className="absolute inset-0 -z-10 opacity-80" aria-hidden="true"><PlateArt hue={section.hue} seed={index + 1} className="h-full w-full" /></div>
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(7,13,32,.9)_0%,rgba(7,13,32,.55)_60%,rgba(7,13,32,.2)_100%)]" aria-hidden="true" />
          <span className="hx-plate-numeral pointer-events-none absolute -bottom-3 right-4 text-[9rem] sm:text-[13rem]" aria-hidden="true">{section.numeral}</span>
          <div className="relative space-y-3 p-6 sm:p-10 lg:p-14">
            <p className="hx-eyebrow" style={{ color: '#e8c36e' }}>{t('kosovo')} · {section.numeral}</p>
            <h1 className="hx-serif max-w-3xl text-4xl font-black leading-[0.98] text-white sm:text-6xl">{section.title[lang]}</h1>
            <p className="max-w-2xl text-base leading-relaxed text-slate-200">{section.lead[lang]}</p>
          </div>
        </header>

        {section.id === 'lufta' && (
          <Link to="/historia-e-uck" className="hx-card group flex flex-col items-start justify-between gap-4 p-6 transition hover:border-[var(--hx-brass-2)] sm:flex-row sm:items-center sm:p-8">
            <div className="space-y-1">
              <p className="hx-eyebrow">{t('uckKicker')}</p>
              <p className="hx-serif text-2xl font-black" style={{ color: 'var(--hx-ink)' }}>{t('uckTitle')}</p>
              <p className="hx-ink-2 max-w-xl text-sm">{t('uckLead')}</p>
            </div>
            <span className="inline-flex min-h-12 items-center gap-2 rounded-xl px-5 text-sm font-black" style={{ background: 'var(--hx-ink)', color: 'var(--hx-paper)' }}>{t('uckBandCta')}<ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
          </Link>
        )}

        {cards.length > 0 && (
          <section aria-label={section.title[lang]} className="grid gap-4 md:grid-cols-2">
            {cards.map((e, i) => (
              <div key={e.id} className={i === 0 && cards.length > 2 ? 'md:col-span-2' : ''}><EntryCard entry={e} lang={lang} lead={i === 0} /></div>
            ))}
          </section>
        )}

        {useChronicle && <Chronicle entries={dated} content={content} lang={lang} title={t('timeline')} />}

        <nav aria-label={t('chapters')} className="grid gap-3 border-t pt-8 hx-rule sm:grid-cols-2">
          {prev ? (
            <Link to={sectionPath('kosova', prev.id)} className="hx-card group flex items-center gap-3 p-4">
              <ArrowLeft className="h-5 w-5 shrink-0 transition group-hover:-translate-x-0.5" aria-hidden="true" />
              <span><span className="hx-eyebrow block">{t('prev')}</span><span className="hx-serif font-black" style={{ color: 'var(--hx-ink)' }}>{prev.numeral} · {prev.title[lang]}</span></span>
            </Link>
          ) : <span />}
          {next ? (
            <Link to={sectionPath('kosova', next.id)} className="hx-card group flex items-center justify-end gap-3 p-4 text-right">
              <span><span className="hx-eyebrow block">{t('next')}</span><span className="hx-serif font-black" style={{ color: 'var(--hx-ink)' }}>{next.numeral} · {next.title[lang]}</span></span>
              <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ) : (
            <button type="button" onClick={() => navigate('/kosova')} className="hx-card p-4 text-right font-black">{t('allChapters')}</button>
          )}
        </nav>
      </div>
    </div>
  );
}

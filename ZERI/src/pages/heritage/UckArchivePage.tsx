import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, LifeBuoy, ShieldAlert } from 'lucide-react';
import { usePageMeta } from '../../lib/usePageMeta';
import { useHeritage } from '../../lib/heritage/api';
import { entriesOf, timelineOf } from '../../lib/heritage/content';
import { UCK_SECTIONS, findSection, pick, type HeritageEntry } from '../../lib/heritage/types';
import { MusicDock } from '../../components/heritage/MusicDock';
import { ClaimsView, Crumbs, EvidenceBadge, SensitiveGate, entryPath, sectionPath, useHeritageLang } from '../../components/heritage/Atoms';
import { ArticleBlock } from '../../components/heritage/Blocks';
import { Chronicle } from '../../components/heritage/Chronicle';
import { Photo } from '../../components/heritage/Photo';
import { photoCreditText } from '../../lib/heritage/photoCredits';
import NotFoundPage from '../NotFoundPage';
import { AccountabilitySection, FamiliesSection, JashariSection, LiberationSection, MartyrsSection } from '../../components/heritage/Memorial';

/**
 * /historia-e-uck and /historia-e-uck/:section — the KLA historical archive.
 *
 * Laid out as a dossier: a sticky chapter index, ARK-coded chapters, and each chapter read in place.
 * Chapters that deal with violence sit behind a content notice that asks before it shows; the
 * sexual-violence chapter additionally carries no images, names or detail and ends with support.
 */
export default function UckArchivePage() {
  const { section: sectionId } = useParams();
  const { lang, t } = useHeritageLang();
  const { content } = useHeritage();
  const navigate = useNavigate();

  const section = sectionId ? findSection('uck', sectionId) : undefined;
  usePageMeta(section ? `${section.title[lang]} — ${t('uckTitle')}` : t('uckTitle'), section?.lead[lang] ?? t('uckLead'));

  const entries = useMemo(() => (section ? entriesOf(content, 'uck', section.id) : []), [content, section]);
  const keyFigures = useMemo(
    () => entriesOf(content, 'uck').flatMap((e) => e.claims.map((c) => ({ c, e }))).filter(({ c }) => ['estimate', 'official-record', 'established'].includes(c.evidence)).slice(0, 4),
    [content],
  );

  if (sectionId && !section) return <NotFoundPage />;

  const index = section ? UCK_SECTIONS.findIndex((s) => s.id === section.id) : -1;
  const prev = index > 0 ? UCK_SECTIONS[index - 1] : undefined;
  const next = index >= 0 ? UCK_SECTIONS[index + 1] : undefined;

  const gate: 'graphic' | 'sexual-violence' | null = !section ? null
    : section.id === 'sexual-violence' ? 'sexual-violence'
      : entries.some((e) => e.sensitive === 'graphic') ? 'graphic' : null;

  const body = section ? (() => {
    if (section.id === 'timeline') {
      return <Chronicle entries={timelineOf(content, 'uck', 'timeline')} content={content} lang={lang} title={t('timeline')} />;
    }
    if (section.id === 'events') {
      const dossiers = entries;
      const placed = timelineOf(content, 'uck', 'timeline').filter((e) => e.place);
      const byPlace = new Map<string, HeritageEntry[]>();
      for (const e of placed) {
        const key = e.place!.municipality ?? e.place!.name;
        byPlace.set(key, [...(byPlace.get(key) ?? []), e]);
      }
      return (
        <div className="space-y-8">
          <section aria-label={lang === 'sq' ? 'Sipas komunës' : 'By municipality'} className="space-y-3">
            <h2 className="hx-eyebrow">{lang === 'sq' ? 'Vende të dokumentuara, sipas komunës' : 'Documented places, by municipality'}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[...byPlace.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([place, list]) => (
                <li key={place} className="hx-card p-4">
                  <p className="hx-serif text-lg font-black" style={{ color: 'var(--hx-ink)' }}>{place}</p>
                  <ul className="mt-2 space-y-1.5">
                    {list.map((e) => (
                      <li key={e.id}><Link to={entryPath(e)} className="hx-ink-2 flex items-center justify-between gap-2 text-sm hover:underline">
                        <span>{pick(e.title, lang)}</span><EvidenceBadge status={e.evidence} lang={lang} className="shrink-0" />
                      </Link></li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
          {dossiers.map((e) => <ArticleBlock key={e.id} entry={e} content={content} lang={lang} />)}
        </div>
      );
    }
    if (section.id === 'sexual-violence') {
      return <div className="space-y-8"><AccountabilitySection lang={lang} /><div className="space-y-5">{entries.map((e) => <ArticleBlock key={e.id} entry={e} content={content} lang={lang} />)}</div></div>;
    }
    return <div className="space-y-5">{entries.map((e) => <ArticleBlock key={e.id} entry={e} content={content} lang={lang} />)}</div>;
  })() : null;

  return (
    <div data-no-translate className="hx hx-page hx-uck -mx-3 -my-3 sm:-mx-5 sm:-my-4 lg:-mx-8">
      <div className="mx-auto max-w-[1280px] space-y-6 px-4 pb-28 pt-4 sm:space-y-8 sm:px-6 lg:px-8 lg:pt-6">
        <Crumbs items={[
          { to: '/', label: t('home') }, { to: '/kosova', label: t('kosovo') },
          ...(section ? [{ to: '/historia-e-uck', label: t('uckTitle') }, { label: section.title[lang] }] : [{ label: t('uckTitle') }]),
        ]} />

        {/* Masthead */}
        <header className="hx-uck-hero hx-grain relative isolate overflow-hidden rounded-[28px]">
          {/* The memorial park at Prekaz: a place, never a portrait, under a dark wash so the text stays the subject. */}
          {!section && (
            <div className="absolute inset-0 -z-10" aria-hidden="true">
              <Photo name="prekaz" alt="" bare className="!absolute inset-0 !bg-transparent opacity-30" />
              <span className="absolute inset-0 bg-gradient-to-r from-[#0a0405] via-[#0a0405]/70 to-transparent" />
            </div>
          )}
          {!section && photoCreditText('prekaz') && (
            <p className="absolute bottom-2 right-4 z-10 text-[10px] font-semibold text-white/55">{lang === 'sq' ? 'Kompleksi Memorial, Prekaz' : 'Memorial Complex, Prekaz'} · © {photoCreditText('prekaz')}</p>
          )}
          <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-10 sm:p-10 lg:p-12">
            {!section && (
              <img src="/heritage/emblema-uck.webp" alt={lang === 'sq' ? 'Emblema e UÇK-së' : 'KLA emblem'} width={150} height={170}
                className="h-24 w-auto max-w-none shrink-0 self-start object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,.6)] sm:h-44" />
            )}
            <div className="space-y-4">
              <p className="hx-eyebrow" style={{ color: '#ff8a98' }}>{section ? `${lang === 'sq' ? 'Kapitulli' : 'Chapter'} ${section.numeral}` : (lang === 'sq' ? 'Ushtria Çlirimtare e Kosovës' : 'Kosovo Liberation Army')}</p>
              <h1 className="hx-serif max-w-3xl text-[clamp(1.9rem,7vw,4.4rem)] font-black leading-[1.02] [overflow-wrap:anywhere] text-white">
                {section ? section.title[lang] : <>UÇK <span className="text-[#ff4d63]">—</span> {lang === 'sq' ? 'Lufta e pastër' : 'A just war'}</>}
              </h1>
              {!section && (
                <p className="hx-tribute inline-block rounded-full px-4 py-1.5 text-xs font-black tracking-wide text-white sm:text-sm">
                  {lang === 'sq' ? 'Lavdi dëshmorëve · Nderim e mirënjohje përjetë' : 'Glory to the martyrs · Honour and gratitude forever'}
                </p>
              )}
              {!section && <div className="h-1 w-24 rounded-full bg-gradient-to-r from-[#c8102e] to-white/80" aria-hidden="true" />}
              <p className="max-w-2xl text-base leading-relaxed text-slate-200">
                {section ? section.lead[lang] : (lang === 'sq'
                  ? 'Ata që e lanë shtëpinë, familjen dhe rininë për t’i dhënë Kosovës lirinë. Luftëtarët e UÇK-së, dëshmorët e kombit dhe familjet që sakrifikuan gjithçka — një borxh nderi që e mbajmë për jetë, çdo datë me burim.'
                  : 'Those who left home, family and youth to give Kosovo its freedom. The fighters of the KLA, the nation’s martyrs and the families who sacrificed everything — a debt of honour we carry for life, every date with a source.')}
              </p>
              {!section && (
                <nav aria-label={lang === 'sq' ? 'Në këtë faqe' : 'On this page'} className="flex flex-wrap gap-2 pt-1">
                  {[['#hx-lib', lang === 'sq' ? 'Jo terrorizëm' : 'Not terrorism'], ['#hx-jashari', 'Adem Jashari'], ['#hx-martyrs', lang === 'sq' ? 'Dëshmorët' : 'Martyrs'], ['#hx-fam', lang === 'sq' ? 'Familjet legjendare' : 'Legendary families'], ['#hx-serbia', lang === 'sq' ? 'Drejtësi' : 'Justice'], ['#hx-chap', lang === 'sq' ? 'Kapitujt' : 'Chapters']].map(([href, label]) => (
                    <a key={href} href={href} className="inline-flex min-h-10 items-center rounded-full border border-white/25 bg-white/5 px-3.5 text-xs font-black text-white backdrop-blur transition hover:border-[#ff4d63] hover:text-[#ff8a98]">{label}</a>
                  ))}
                </nav>
              )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
          {/* Chapter index */}
          <nav aria-label={t('chapters')} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <ol className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
              {UCK_SECTIONS.map((s) => {
                const active = s.id === section?.id;
                return (
                  <li key={s.id} className="shrink-0 lg:shrink">
                    <Link to={sectionPath('uck', s.id)} aria-current={active ? 'page' : undefined}
                      className="flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm transition hx-rule"
                      style={active ? { background: 'var(--hx-ink)', color: 'var(--hx-paper)', borderColor: 'var(--hx-ink)' } : { color: 'var(--hx-ink-2)', background: 'var(--hx-card)' }}>
                      <span className="hx-serif w-6 shrink-0 text-base font-black" style={{ color: active ? 'var(--hx-brass-2)' : 'var(--hx-brass)' }}>{s.numeral}</span>
                      <span className="font-bold leading-tight">{s.title[lang]}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="min-w-0 space-y-6 sm:space-y-8">
            {!section && (
              <>
                <LiberationSection lang={lang} />
                <JashariSection lang={lang} />
                <MartyrsSection lang={lang} />
                <FamiliesSection lang={lang} />
                <AccountabilitySection lang={lang} />

                <section className="hx-card space-y-3 p-6 sm:p-8" aria-labelledby="hx-method">
                  <h2 id="hx-method" className="hx-eyebrow flex items-center gap-2"><ShieldAlert className="h-4 w-4" aria-hidden="true" />{t('method')}</h2>
                  <p className="hx-serif text-xl font-bold leading-snug" style={{ color: 'var(--hx-ink)' }}>{t('methodBody')}</p>
                </section>

                {keyFigures.length > 0 && (
                  <section aria-labelledby="hx-fig" className="space-y-3">
                    <h2 id="hx-fig" className="hx-eyebrow">{t('claims')}</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      {keyFigures.map(({ e }) => <ClaimsView key={e.id} entry={{ ...e, claims: e.claims.slice(0, 1) }} content={content} lang={lang} />)}
                    </div>
                  </section>
                )}

                <section aria-labelledby="hx-chap" className="space-y-4">
                  <h2 id="hx-chap" className="hx-eyebrow">{t('chapters')}</h2>
                  <ol className="grid gap-4 sm:grid-cols-2">
                    {UCK_SECTIONS.map((s, i) => {
                      const n = entriesOf(content, 'uck', s.id).length;
                      return (
                        <li key={s.id}>
                          <Link to={sectionPath('uck', s.id)} className="hx-plate group flex h-full gap-4 p-5">
                            <span className="hx-plate-numeral text-6xl" aria-hidden="true">{s.numeral}</span>
                            <div className="min-w-0 space-y-1.5">
                              <h3 className="hx-serif text-lg font-black leading-snug" style={{ color: 'var(--hx-ink)' }}>{s.title[lang]}</h3>
                              <p className="hx-ink-2 text-sm leading-relaxed">{s.lead[lang]}</p>
                              <p className="hx-brass text-xs font-black">{n} {n === 1 ? t('entry') : t('entries')}{i === 2 ? '' : ''}</p>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </section>
                <Link to={sectionPath('uck', 'timeline')} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-5 text-sm font-black" style={{ background: 'var(--hx-ink)', color: 'var(--hx-paper)' }}>
                  {t('timeline')} 1998–1999<ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </>
            )}

            {section && (gate
              ? <SensitiveGate id={`chapter-${section.id}`} kind={gate} lang={lang} onLeave={() => navigate('/historia-e-uck')}>{body}</SensitiveGate>
              : body)}

            {section?.id === 'sexual-violence' && (
              <aside className="hx-card flex items-start gap-3 p-5" aria-label={lang === 'sq' ? 'Mbështetje' : 'Support'}>
                <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 hx-brass" aria-hidden="true" />
                <p className="hx-ink-2 text-sm leading-relaxed"><strong style={{ color: 'var(--hx-ink)' }}>{t('emergency')}</strong></p>
              </aside>
            )}

            {section && (
              <nav className="grid gap-3 border-t pt-6 hx-rule sm:grid-cols-2" aria-label={t('chapters')}>
                {prev ? (
                  <Link to={sectionPath('uck', prev.id)} className="hx-card group flex items-center gap-3 p-4">
                    <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span><span className="hx-eyebrow block">{t('prev')}</span><span className="hx-serif font-black" style={{ color: 'var(--hx-ink)' }}>{prev.numeral} · {prev.title[lang]}</span></span>
                  </Link>
                ) : <span />}
                {next && (
                  <Link to={sectionPath('uck', next.id)} className="hx-card group flex items-center justify-end gap-3 p-4 text-right">
                    <span><span className="hx-eyebrow block">{t('next')}</span><span className="hx-serif font-black" style={{ color: 'var(--hx-ink)' }}>{next.numeral} · {next.title[lang]}</span></span>
                    <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
                  </Link>
                )}
              </nav>
            )}
          </div>
        </div>
      </div>
      <MusicDock lang={lang} />
    </div>
  );
}

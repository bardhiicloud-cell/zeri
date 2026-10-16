import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpenCheck, Compass, Search, ShieldCheck } from 'lucide-react';
import { usePageMeta } from '../../lib/usePageMeta';
import { useHeritage } from '../../lib/heritage/api';
import { contentStats, entriesOf, searchEntries, timelineOf } from '../../lib/heritage/content';
import { EVIDENCE, EVIDENCE_STATUSES, KOSOVA_SECTIONS, UCK_SECTIONS, formatHeritageDate, pick } from '../../lib/heritage/types';
import { HeroArt, PlateArt } from '../../components/heritage/HeritageArt';
import { EvidenceBadge, entryPath, sectionPath, useHeritageLang, Crumbs } from '../../components/heritage/Atoms';
import { EntryCard } from '../../components/heritage/Blocks';

/**
 * /kosova — the front door of the identity & history experience.
 *
 * Reading order: a cinematic opening, a strip of dated facts, the ten chapters as numbered
 * plates, the KLA archive as its own major feature, a slice of the state-building chronicle,
 * and finally the part that earns trust: what each evidence status means and how much of the
 * text a second person has actually verified.
 */
export default function KosovaHubPage() {
  const { lang, t } = useHeritageLang();
  const { content, settings } = useHeritage();
  const [query, setQuery] = useState('');

  usePageMeta(
    lang === 'sq' ? 'Kosova — një popull, një histori, një e ardhme' : 'Kosovo — one people, one history, one future',
    t('heroIntro'),
  );

  const stats = useMemo(() => contentStats(content), [content]);
  const results = useMemo(() => (query.trim().length > 1 ? searchEntries(content, query, lang) : []), [content, query, lang]);
  const milestones = useMemo(() => timelineOf(content, 'kosova', 'pavaresia').slice(0, 7), [content]);
  const uckHighlights = useMemo(() => entriesOf(content, 'uck').filter((e) => e.featured).slice(0, 3), [content]);

  const facts: Array<{ k: string; v: string; l: string; src: string }> = [
    { k: '17.II.2008', v: lang === 'sq' ? 'Pavarësia' : 'Independence', l: lang === 'sq' ? 'Deklarata e Pavarësisë' : 'Declaration of Independence', src: 'declaration' },
    { k: '120', v: lang === 'sq' ? 'ulëse' : 'seats', l: lang === 'sq' ? 'në Kuvend; 20 të rezervuara për komunitetet' : 'in the Assembly; 20 reserved for communities', src: 'constitution' },
    { k: '2', v: lang === 'sq' ? 'gjuhë zyrtare' : 'official languages', l: lang === 'sq' ? 'shqipe dhe serbe' : 'Albanian and Serbian', src: 'constitution' },
    { k: '€', v: lang === 'sq' ? 'monedha' : 'currency', l: 'euro', src: 'worldbank-kosovo' },
    { k: '+383', v: lang === 'sq' ? 'kodi telefonik' : 'dialling code', l: lang === 'sq' ? 'i Kosovës' : 'of Kosovo', src: 'mfa' },
  ];

  return (
    <div data-no-translate className="hx hx-page -mx-3 -my-3 sm:-mx-5 sm:-my-4 lg:-mx-8">
      <div className="mx-auto max-w-[1280px] space-y-14 px-4 pb-20 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <Crumbs items={[{ to: '/', label: t('home') }, { label: t('kosovo') }]} />

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section aria-labelledby="hx-h1" className="hx-hero hx-grain relative isolate overflow-hidden rounded-[28px] shadow-[0_30px_80px_-40px_rgba(7,13,32,.9)]">
          <div className="absolute inset-0 -z-10" aria-hidden="true">
            {settings.heroImageUrl
              ? <img src={settings.heroImageUrl} alt="" className="h-full w-full object-cover" decoding="async" />
              : <HeroArt className="h-full w-full" />}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,13,32,.82)_0%,rgba(7,13,32,.35)_55%,rgba(7,13,32,0)_100%)]" />
          </div>
          <div className="flex min-h-[520px] flex-col justify-end gap-6 p-6 sm:min-h-[580px] sm:p-10 lg:p-14">
            <p className="hx-eyebrow hx-rise" style={{ ['--i' as string]: 0, color: '#e8c36e' }}>{t('kicker')}</p>
            <div className="hx-rise" style={{ ['--i' as string]: 1 }}>
              <h1 id="hx-h1" className="hx-serif text-[clamp(3.4rem,13vw,8.5rem)] font-black leading-[0.85] tracking-tight text-white">{t('heroTitle')}</h1>
              <p className="hx-serif mt-3 text-xl font-bold italic text-[#f0cf7e] sm:text-3xl">{t('heroSub')}</p>
            </div>
            <p className="hx-rise max-w-2xl text-[15px] leading-relaxed text-slate-200 sm:text-base" style={{ ['--i' as string]: 2 }}>{t('heroIntro')}</p>
            <div className="hx-rise flex flex-wrap gap-3" style={{ ['--i' as string]: 3 }}>
              <a href="#hx-chapters" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#e8c36e] px-5 text-sm font-black text-[#0b1531] transition hover:bg-[#f2d68c]">
                <Compass className="h-4 w-4" aria-hidden="true" />{t('explore')}
              </a>
              <Link to="/historia-e-uck" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/30 bg-white/5 px-5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15">
                {t('openArchive')}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {settings.heroImageUrl && settings.heroCredit && <p className="text-[11px] text-white/60">© {settings.heroCredit}</p>}
          </div>
        </section>

        {/* ── At a glance ─────────────────────────────────────────────────── */}
        <section aria-labelledby="hx-glance">
          <h2 id="hx-glance" className="hx-eyebrow mb-4">{t('facts')}</h2>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border hx-rule bg-[var(--hx-rule)] sm:grid-cols-3 lg:grid-cols-5">
            {facts.map((f) => (
              <div key={f.k + f.v} className="bg-[var(--hx-card)] p-4 sm:p-5">
                <dt className="hx-year text-2xl sm:text-3xl">{f.k}</dt>
                <dd className="mt-1 text-sm font-bold" style={{ color: 'var(--hx-ink)' }}>{f.v}</dd>
                <dd className="hx-ink-3 text-xs">{f.l}</dd>
                <dd className="mt-1 text-[10px] uppercase tracking-wider hx-ink-3">{content.sources.get(f.src)?.publisher.split(' (')[0]}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <section aria-labelledby="hx-search" className="space-y-3">
          <h2 id="hx-search" className="sr-only">{t('search')}</h2>
          <div className="relative mx-auto max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 opacity-50" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPh')} aria-label={t('search')}
              className="hx-card min-h-14 w-full pl-12 pr-4 text-base" style={{ color: 'var(--hx-ink)' }} />
          </div>
          {query.trim().length > 1 && (
            <div className="mx-auto max-w-2xl" role="status">
              {results.length === 0 ? <p className="hx-ink-3 text-sm">{t('noResults')}</p> : (
                <ul className="hx-card divide-y hx-rule">
                  {results.slice(0, 8).map((e) => (
                    <li key={e.id}>
                      <Link to={entryPath(e)} className="flex items-start gap-3 p-4 hover:bg-[color-mix(in_srgb,var(--hx-brass-2)_8%,transparent)]">
                        <div className="min-w-0 flex-1">
                          <p className="hx-serif font-black leading-snug" style={{ color: 'var(--hx-ink)' }}>{pick(e.title, lang)}</p>
                          <p className="hx-ink-3 line-clamp-1 text-xs">{pick(e.summary, lang)}</p>
                        </div>
                        <EvidenceBadge status={e.evidence} lang={lang} className="hidden sm:inline-flex" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* ── Ten chapters ────────────────────────────────────────────────── */}
        <section id="hx-chapters" aria-labelledby="hx-ten" className="scroll-mt-24 space-y-6">
          <header className="max-w-3xl space-y-2">
            <p className="hx-eyebrow">{t('chapters')}</p>
            <h2 id="hx-ten" className="hx-serif text-4xl font-black leading-tight sm:text-5xl" style={{ color: 'var(--hx-ink)' }}>{t('ten')}</h2>
            <p className="hx-ink-2 text-base leading-relaxed">{t('tenLead')}</p>
          </header>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {KOSOVA_SECTIONS.map((s, i) => {
              const n = entriesOf(content, 'kosova', s.id).length;
              return (
                <li key={s.id} className={i === 0 ? 'lg:col-span-2' : ''}>
                  <Link to={sectionPath('kosova', s.id)} className="hx-plate group flex h-full flex-col">
                    <div className="relative h-36 sm:h-44">
                      <PlateArt hue={s.hue} seed={i + 1} className="absolute inset-0 h-full w-full" />
                      <span className="hx-plate-numeral absolute bottom-2 right-4 text-7xl sm:text-8xl" aria-hidden="true">{s.numeral}</span>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-5">
                      <h3 className="hx-serif text-xl font-black leading-snug" style={{ color: 'var(--hx-ink)' }}>{s.title[lang]}</h3>
                      <p className="hx-ink-2 flex-1 text-sm leading-relaxed">{s.lead[lang]}</p>
                      <p className="hx-brass flex items-center justify-between pt-1 text-xs font-black">
                        <span>{n} {n === 1 ? t('entry') : t('entries')}</span>
                        <span className="inline-flex items-center gap-1">{t('read')}<ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" /></span>
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── The KLA archive: a major feature of its own ─────────────────── */}
        <section aria-labelledby="hx-uck" className="hx-hero hx-grain relative isolate overflow-hidden rounded-[28px]">
          <div className="absolute inset-0 -z-10 opacity-60" aria-hidden="true"><PlateArt hue={14} seed={91} className="h-full w-full" /></div>
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(110deg,rgba(7,13,32,.96)_0%,rgba(7,13,32,.78)_52%,rgba(7,13,32,.35)_100%)]" aria-hidden="true" />
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.15fr_1fr] lg:p-14">
            <div className="space-y-4">
              <p className="hx-eyebrow" style={{ color: '#e8c36e' }}>{t('uckKicker')} · ARK-1998/99</p>
              <h2 id="hx-uck" className="hx-serif text-4xl font-black leading-[0.95] text-white sm:text-6xl">{t('uckTitle')}</h2>
              <p className="max-w-xl text-[15px] leading-relaxed text-slate-200">{t('uckLead')}</p>
              <p className="max-w-xl rounded-xl border border-white/15 bg-white/5 p-3 text-xs leading-relaxed text-slate-300">
                <strong className="text-white">{t('method')}.</strong> {t('methodBody')}
              </p>
              <Link to="/historia-e-uck" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#e8c36e] px-5 text-sm font-black text-[#0b1531] transition hover:bg-[#f2d68c]">
                {t('uckBandCta')}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <ol className="grid grid-cols-2 gap-2 self-end text-sm">
              {UCK_SECTIONS.map((s) => (
                <li key={s.id}>
                  <Link to={sectionPath('uck', s.id)} className="flex min-h-14 items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-3 text-white backdrop-blur transition hover:border-[#e8c36e] hover:bg-white/10">
                    <span className="hx-serif w-7 shrink-0 text-lg font-black text-[#e8c36e]">{s.numeral}</span>
                    <span className="text-xs font-bold leading-tight">{s.title[lang]}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          {uckHighlights.length > 0 && (
            <ul className="grid gap-px border-t border-white/10 bg-white/10 sm:grid-cols-3">
              {uckHighlights.map((e) => (
                <li key={e.id} className="bg-[rgba(7,13,32,.85)] p-4 sm:p-5">
                  <Link to={entryPath(e)} className="group block space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#e8c36e]">{formatHeritageDate(e.date, lang)}</p>
                    <p className="hx-serif text-base font-black leading-snug text-white group-hover:underline">{pick(e.title, lang)}</p>
                    <EvidenceBadge status={e.evidence} lang={lang} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── State-building slice ────────────────────────────────────────── */}
        {milestones.length > 0 && (
          <section aria-labelledby="hx-state" className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <header className="space-y-3 lg:sticky lg:top-24 lg:self-start">
              <p className="hx-eyebrow">{KOSOVA_SECTIONS[3].numeral} · {KOSOVA_SECTIONS[3].title[lang]}</p>
              <h2 id="hx-state" className="hx-serif text-3xl font-black leading-tight sm:text-4xl" style={{ color: 'var(--hx-ink)' }}>
                {lang === 'sq' ? 'Ndërtimi i shtetit, hap pas hapi' : 'Building the state, step by step'}
              </h2>
              <p className="hx-ink-2 text-sm leading-relaxed">{KOSOVA_SECTIONS[3].lead[lang]}</p>
              <Link to={sectionPath('kosova', 'pavaresia')} className="hx-brass inline-flex items-center gap-1 text-sm font-black underline-offset-4 hover:underline">
                {t('timeline')}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </header>
            <ol className="hx-chron space-y-1">
              {milestones.map((e) => (
                <li key={e.id} className="hx-chron-item pb-4">
                  <span className="hx-chron-dot" aria-hidden="true" />
                  <Link to={entryPath(e)} className="hx-card block p-4 transition hover:border-[var(--hx-brass-2)]">
                    <p className="hx-year text-sm">{formatHeritageDate(e.date, lang)}</p>
                    <p className="hx-serif mt-0.5 text-lg font-black leading-snug" style={{ color: 'var(--hx-ink)' }}>{pick(e.title, lang)}</p>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ── Featured ────────────────────────────────────────────────────── */}
        <section aria-label={lang === 'sq' ? 'Të zgjedhura' : 'Featured'} className="grid gap-4 md:grid-cols-3">
          {entriesOf(content, 'kosova').filter((e) => e.featured).slice(0, 3).map((e, i) => <EntryCard key={e.id} entry={e} lang={lang} lead={i === 0} />)}
        </section>

        {/* ── Trust ───────────────────────────────────────────────────────── */}
        <section aria-labelledby="hx-trust" className="hx-card space-y-6 p-6 sm:p-10">
          <header className="flex flex-wrap items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'color-mix(in srgb, var(--hx-brass-2) 18%, transparent)', color: 'var(--hx-brass)' }}><ShieldCheck className="h-6 w-6" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <h2 id="hx-trust" className="hx-serif text-2xl font-black sm:text-3xl" style={{ color: 'var(--hx-ink)' }}>{t('trustTitle')}</h2>
              <p className="hx-ink-2 mt-1 max-w-2xl text-sm leading-relaxed">{t('trustLead')}</p>
            </div>
          </header>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              [String(stats.verified), t('verifiedCount')],
              [String(stats.unverified), t('unverifiedCount')],
              [String(stats.sources), t('sourcesCount')],
              [String(stats.uncheckedLinks), t('uncheckedLinks')],
            ].map(([v, l]) => (
              <div key={l}><dt className="hx-year text-4xl">{v}</dt><dd className="hx-ink-3 mt-1 text-xs font-semibold">{l}</dd></div>
            ))}
          </dl>
          <div>
            <h3 className="hx-eyebrow mb-3 flex items-center gap-2"><BookOpenCheck className="h-4 w-4" aria-hidden="true" />{t('evidenceScale')}</h3>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {EVIDENCE_STATUSES.map((s) => (
                <li key={s} className="space-y-1.5">
                  <EvidenceBadge status={s} lang={lang} />
                  <p className="hx-ink-3 text-xs leading-relaxed">{EVIDENCE[s].meaning[lang]}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, Landmark } from 'lucide-react';
import '../../styles/heritage.css';
import { KOSOVA_SECTIONS, UCK_SECTIONS } from '../../lib/heritage/types';
import { useHeritageLang } from '../../lib/heritage/useLang';
import { HeroArt, PlateArt } from './HeritageArt';

/**
 * Homepage entry points for the two archives, placed directly under the reporting hero.
 * It is deliberately light (no archive content is imported), so the homepage pays only for
 * two SVG scenes and a stylesheet; the archive itself loads when someone follows a link.
 */
export function HeritageHomeBand() {
  const { lang, t } = useHeritageLang();
  return (
    <section data-no-translate aria-label={t('homeBandTitle')} className="hx grid gap-3 sm:gap-4 xl:grid-cols-[1.7fr_1fr]">
      {/* Kosova */}
      <div className="hx-hero hx-grain relative isolate flex min-h-[340px] flex-col justify-end overflow-hidden rounded-[24px] sm:min-h-[380px]">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <HeroArt className="h-full w-full" />
          <div className="absolute inset-0 bg-[linear-gradient(95deg,rgba(7,13,32,.88)_0%,rgba(7,13,32,.5)_58%,rgba(7,13,32,.05)_100%)]" />
        </div>
        <div className="space-y-3 p-5 sm:p-8">
          <p className="hx-eyebrow" style={{ color: '#e8c36e' }}>{t('kicker')}</p>
          <h2 className="hx-serif max-w-2xl text-[1.7rem] font-black leading-[1.02] tracking-tight text-white sm:text-4xl lg:text-[2.7rem]">{t('homeBandTitle')}</h2>
          <p className="line-clamp-4 max-w-2xl text-[13px] leading-relaxed text-slate-200 sm:line-clamp-none sm:text-[15px]">{t('heroIntro')}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
            <Link to="/kosova" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#e8c36e] px-5 text-sm font-black text-[#0b1531] transition hover:bg-[#f2d68c] active:scale-[0.98]">
              <Landmark className="h-4 w-4" aria-hidden="true" />{t('homeBandCta')}
            </Link>
            <p className="text-[11px] font-semibold text-slate-300">{t('homeBandMeta')}</p>
          </div>
          <ul className="flex flex-wrap gap-1.5 pt-1" aria-label={t('chapters')}>
            {KOSOVA_SECTIONS.slice(0, 5).map((s) => (
              <li key={s.id}><Link to={`/kosova/${s.id}`} className="inline-flex min-h-8 items-center rounded-full border border-white/20 bg-white/5 px-3 text-[11px] font-bold text-white backdrop-blur transition hover:border-[#e8c36e]">{s.title[lang]}</Link></li>
            ))}
          </ul>
        </div>
      </div>

      {/* UÇK archive */}
      <Link to="/historia-e-uck" className="hx-hero hx-grain group relative isolate flex min-h-[300px] flex-col justify-between overflow-hidden rounded-[24px] p-5 sm:min-h-[380px] sm:p-7">
        <div className="absolute inset-0 -z-10 opacity-60" aria-hidden="true"><PlateArt hue={14} seed={91} className="h-full w-full" /></div>
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(160deg,rgba(7,13,32,.9)_0%,rgba(7,13,32,.78)_100%)]" aria-hidden="true" />
        <div className="space-y-2">
          <p className="hx-eyebrow" style={{ color: '#e8c36e' }}>{t('uckKicker')} · ARK-1998/99</p>
          <h2 className="hx-serif text-3xl font-black leading-[1] text-white sm:text-4xl">{t('uckBandTitle')}</h2>
          <p className="text-[13px] leading-relaxed text-slate-300 sm:text-sm">{t('uckBandBody')}</p>
        </div>
        <div className="space-y-3">
          <ol className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-bold text-slate-200" aria-hidden="true">
            {UCK_SECTIONS.slice(0, 6).map((s) => <li key={s.id} className="flex gap-2"><span className="text-[#e8c36e]">{s.numeral}</span>{s.title[lang]}</li>)}
          </ol>
          <span className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#e8c36e]/60 px-4 text-sm font-black text-[#e8c36e] transition group-hover:bg-[#e8c36e] group-hover:text-[#0b1531]">
            <BookOpenCheck className="h-4 w-4" aria-hidden="true" />{t('uckBandCta')}<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </section>
  );
}

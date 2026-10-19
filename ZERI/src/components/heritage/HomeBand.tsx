import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import '../../styles/heritage.css';
import { useHeritageLang } from '../../lib/heritage/useLang';

/**
 * Homepage entry points for the two archives: one card for Kosova (history and tourism),
 * one for the UÇK. Deliberately light — two emblems and a stylesheet, no archive content —
 * so the homepage stays fast; the archive loads when someone follows a link.
 */
export function HeritageHomeBand() {
  const { lang } = useHeritageLang();
  const sq = lang === 'sq';
  return (
    <section data-no-translate aria-label={sq ? 'Kosova dhe UÇK' : 'Kosovo and the KLA'} className="hx grid gap-3 sm:grid-cols-2 sm:gap-4">
      {/* Kosova */}
      <Link
        to="/kosova"
        className="hx-grain group relative isolate flex min-h-[188px] items-center gap-4 overflow-hidden rounded-[24px] p-5 text-white shadow-[0_24px_60px_-34px_rgba(12,40,120,.85)] transition active:scale-[0.99] sm:min-h-[220px] sm:p-7"
        style={{ background: 'radial-gradient(120% 120% at 100% 0%, #2a56c6 0%, #12317f 45%, #0a1b4d 100%)' }}
      >
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[#e8c36e]/20 blur-3xl" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-[#e8c36e] to-transparent opacity-70" />
        <img src="/heritage/stema-kosoves.png" alt="" width={84} height={93} loading="lazy" decoding="async" className="h-20 w-auto shrink-0 drop-shadow-[0_8px_18px_rgba(0,0,0,.45)] transition duration-500 group-hover:-rotate-3 group-hover:scale-105 sm:h-24" />
        <div className="min-w-0 space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#e8c36e]">{sq ? 'Republika e Kosovës' : 'Republic of Kosovo'}</p>
          <h2 className="hx-serif text-[1.65rem] font-black leading-[1.02] sm:text-3xl">
            Kosova <span className="text-[#e8c36e]">—</span> {sq ? 'Historia' : 'History'} <span className="text-[#e8c36e]">—</span> {sq ? 'Turizëm' : 'Tourism'}
          </h2>
          <p className="text-[13px] leading-snug text-blue-100 sm:text-sm">
            {sq ? 'Nga Dardania te shteti i pavarur, dhe vendet më të bukura që duhen parë.' : 'From Dardania to an independent state, and the most beautiful places to see.'}
          </p>
          <span className="inline-flex items-center gap-1.5 pt-1 text-sm font-black text-[#e8c36e]">
            {sq ? 'Zbulo Kosovën' : 'Discover Kosovo'}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
          </span>
        </div>
      </Link>

      {/* UÇK */}
      <Link
        to="/historia-e-uck"
        className="hx-grain group relative isolate flex min-h-[188px] items-center gap-4 overflow-hidden rounded-[24px] p-5 text-white shadow-[0_24px_60px_-34px_rgba(140,10,30,.9)] transition active:scale-[0.99] sm:min-h-[220px] sm:p-7"
        style={{ background: 'radial-gradient(120% 120% at 100% 0%, #b3122e 0%, #6d0b1c 42%, #14070b 100%)' }}
      >
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[#f2d200]/15 blur-3xl" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-[#f2d200] to-transparent opacity-70" />
        <img src="/heritage/emblema-uck.webp" alt="" width={84} height={95} loading="lazy" decoding="async" className="h-20 w-auto shrink-0 drop-shadow-[0_8px_18px_rgba(0,0,0,.5)] transition duration-500 group-hover:rotate-3 group-hover:scale-105 sm:h-24" />
        <div className="min-w-0 space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#f2d200]">{sq ? 'Ushtria Çlirimtare e Kosovës' : 'Kosovo Liberation Army'}</p>
          <h2 className="hx-serif text-[1.65rem] font-black leading-[1.02] sm:text-3xl">
            UÇK <span className="text-[#f2d200]">—</span> {sq ? 'Lufta e pastër' : 'A just war'}
          </h2>
          <p className="text-[13px] leading-snug text-rose-100 sm:text-sm">
            {sq ? 'Dëshmorët, familjet legjendare dhe e vërteta e luftës për liri.' : 'The martyrs, the legendary families and the truth of the fight for freedom.'}
          </p>
          <span className="inline-flex items-center gap-1.5 pt-1 text-sm font-black text-[#f2d200]">
            {sq ? 'Hap arkivin' : 'Open the archive'}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </section>
  );
}

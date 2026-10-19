import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import '../../styles/heritage.css';
import { useHeritageLang } from '../../lib/heritage/useLang';
import { BrandMark } from '../BrandLogo';

/**
 * Homepage entry points: Kosova (history and tourism), the UÇK, and what Zëri i Qytetarëve does.
 * Three glass cards, each with its own emblem and one colour. Deliberately light — emblems and a
 * stylesheet, no archive content — so the homepage stays fast; the archive loads on click.
 */
export function HeritageHomeBand() {
  const { lang } = useHeritageLang();
  const sq = lang === 'sq';
  return (
    <section data-no-translate aria-label={sq ? 'Kosova, UÇK dhe Zëri i Qytetarëve' : 'Kosovo, the KLA and Citizens’ Voice'} className="hx grid gap-3 md:grid-cols-3 md:gap-4">
      {/* Kosova */}
      <Link to="/kosova" className="hx-glass hx-grain group flex min-h-[210px] flex-col justify-between gap-4 p-5 sm:p-6"
        style={{ background: 'radial-gradient(130% 120% at 100% 0%, #2a56c6 0%, #12317f 48%, #0a1b4d 100%)' }}>
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[#e8c36e]/20 blur-3xl" />
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#e8c36e]">{sq ? 'Republika e Kosovës' : 'Republic of Kosovo'}</p>
          <img src="/heritage/stema-kosoves.png" alt="" width={56} height={62} loading="lazy" decoding="async" className="h-14 w-auto max-w-none shrink-0 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,.45)] transition duration-500 group-hover:scale-105" />
        </div>
        <div className="space-y-1.5">
          <h2 className="hx-serif text-[1.55rem] font-black leading-[1.05] sm:text-[1.7rem]">
            Kosova <span className="text-[#e8c36e]">—</span> {sq ? 'Historia' : 'History'} <span className="text-[#e8c36e]">—</span> {sq ? 'Turizëm' : 'Tourism'}
          </h2>
          <p className="text-[13px] leading-snug text-blue-100">{sq ? 'Nga Dardania te shteti i pavarur, dhe vendet më të bukura që duhen parë.' : 'From Dardania to an independent state, and the most beautiful places to see.'}</p>
          <span className="inline-flex items-center gap-1.5 pt-1 text-sm font-black text-[#e8c36e]">{sq ? 'Zbulo Kosovën' : 'Discover Kosovo'}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" /></span>
        </div>
      </Link>

      {/* UÇK */}
      <Link to="/historia-e-uck" className="hx-glass hx-grain group flex min-h-[210px] flex-col justify-between gap-4 p-5 sm:p-6"
        style={{ background: 'radial-gradient(130% 120% at 100% 0%, #c8102e 0%, #5c0a18 46%, #0a0405 100%)' }}>
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ff8a98]">{sq ? 'Ushtria Çlirimtare e Kosovës' : 'Kosovo Liberation Army'}</p>
          <img src="/heritage/emblema-uck.webp" alt="" width={56} height={63} loading="lazy" decoding="async" className="h-14 w-auto max-w-none shrink-0 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,.5)] transition duration-500 group-hover:scale-105" />
        </div>
        <div className="space-y-1.5">
          <h2 className="hx-serif text-[1.55rem] font-black leading-[1.05] sm:text-[1.7rem]">UÇK <span className="text-[#ff4d63]">—</span> {sq ? 'Lufta e pastër' : 'A just war'}</h2>
          <p className="text-[13px] leading-snug text-rose-100">{sq ? 'Dëshmorët, familjet legjendare dhe e vërteta e luftës për liri.' : 'The martyrs, the legendary families and the truth of the fight for freedom.'}</p>
          <span className="inline-flex items-center gap-1.5 pt-1 text-sm font-black text-[#ff8a98]">{sq ? 'Hap arkivin' : 'Open the archive'}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" /></span>
        </div>
      </Link>

      {/* Zëri i Qytetarëve */}
      <Link to="/zeri-qytetar" className="hx-glass hx-grain group flex min-h-[210px] flex-col justify-between gap-4 p-5 sm:p-6"
        style={{ background: 'radial-gradient(130% 120% at 100% 0%, #1f8f9c 0%, #0d3e55 46%, #07182b 100%)' }}>
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">{sq ? 'Çka bëjmë ne' : 'What we do'}</p>
          <BrandMark className="h-14 w-14 drop-shadow-[0_6px_14px_rgba(0,0,0,.4)] transition duration-500 group-hover:scale-105" />
        </div>
        <div className="space-y-1.5">
          <h2 className="hx-serif text-[1.55rem] font-black leading-[1.05] sm:text-[1.7rem]">Zëri i Qytetarëve</h2>
          <p className="text-[13px] leading-snug text-cyan-50">{sq ? 'Raporto problemet, ngri zërin dhe lexo lajme kundër korrupsionit dhe propagandës.' : 'Report problems, raise your voice and read news against corruption and propaganda.'}</p>
          <span className="inline-flex items-center gap-1.5 pt-1 text-sm font-black text-cyan-200">{sq ? 'Shih çka bëjmë' : 'See what we do'}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" /></span>
        </div>
      </Link>
    </section>
  );
}

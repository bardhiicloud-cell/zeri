import { PenSquare, FileText, Users, Building2, Heart } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { BrandMark } from '@/src/components/BrandLogo';
import { HeroScene } from '@/src/components/HeroScenes';

const CHIPS = [
  { icon: Users, label: 'Qytetarët raportojnë', tone: 'text-blue-600 bg-blue-500/15 dark:text-blue-300' },
  { icon: Building2, label: 'Institucionet veprojnë', tone: 'text-emerald-600 bg-emerald-500/15 dark:text-emerald-300' },
  { icon: Heart, label: 'Komuniteti përmirësohet', tone: 'text-rose-600 bg-rose-500/15 dark:text-rose-300' },
];

/**
 * Hero shown on Ballina when the scope is "Gjithë Kosova".
 * Day and night are both illustrated SVG scenes (HeroScenes.tsx).
 */
export function NationalHero({ onReport, onViewReports }: { onReport: () => void; onViewReports: () => void }) {
  return (
    <section
      aria-labelledby="national-hero-title"
      className="relative isolate w-full overflow-hidden rounded-[28px] border border-sky-200/70 dark:border-white/10 shadow-[0_20px_60px_-30px_rgba(30,64,175,0.45)] dark:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)]"
    >
      {/* ── Day scene ── */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 dark:hidden">
        <HeroScene variant="day" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.75)_60%,transparent_92%)] sm:bg-[linear-gradient(90deg,rgba(255,255,255,0.93)_0%,rgba(255,255,255,0.72)_34%,transparent_52%)]" />
      </div>

      {/* ── Night scene ── */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 hidden dark:block">
        <HeroScene variant="night" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.88)_0%,rgba(2,6,23,0.7)_60%,transparent_92%)] sm:bg-[linear-gradient(90deg,rgba(2,6,23,0.88)_0%,rgba(2,6,23,0.66)_34%,transparent_54%)]" />
      </div>

      <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:p-9">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/60 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-800 backdrop-blur dark:border-cyan-300/25 dark:bg-white/5 dark:text-cyan-200 sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {dt('Platforma kombëtare e angazhimit qytetar')}
          </span>

          <div className="mt-4 flex items-center gap-4 sm:gap-5">
            <BrandMark className="h-14 w-14 sm:h-20 sm:w-20 lg:h-24 lg:w-24 drop-shadow-[0_6px_18px_rgba(14,116,244,0.35)] dark:drop-shadow-[0_0_26px_rgba(34,211,238,0.5)]" />
            <div className="min-w-0">
              <h1 id="national-hero-title" className="text-[1.7rem] font-black leading-[0.95] tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-[3.4rem]">
                Zëri <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent dark:from-cyan-300 dark:to-blue-400">Qytetarëve</span>
              </h1>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.32em] text-sky-700 dark:text-cyan-300 sm:text-xs">
                {dt('Gjithë Kosova')}
              </p>
            </div>
          </div>

          <p className="mt-4 max-w-xl lg:max-w-[27rem] text-sm leading-relaxed text-slate-700 dark:text-slate-300 sm:text-[15px]">
            {dt('Raportoni probleme, merrni pjesë në vendimmarrje dhe ndihmoni në përmirësimin e shërbimeve në komunën tuaj.')}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onReport}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(14,116,244,0.8)] transition hover:brightness-110 active:scale-[0.98]"
            >
              <PenSquare className="h-4 w-4" aria-hidden="true" />
              {dt('Raporto një problem')}
            </button>
            <button
              type="button"
              onClick={onViewReports}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-900/15 bg-white/70 px-5 text-sm font-bold text-slate-900 backdrop-blur transition hover:bg-white dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 active:scale-[0.98]"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              {dt('Shiko raportimet')}
            </button>
          </div>
        </div>

        <ul className="flex flex-wrap gap-2 lg:grid lg:w-64 lg:grid-cols-1 lg:gap-2.5">
          {CHIPS.map(({ icon: Icon, label, tone }) => (
            <li key={label} className="flex items-center gap-2.5 rounded-2xl border border-white/70 bg-white/75 px-3 py-1.5 lg:gap-3 lg:px-3.5 lg:py-2.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-slate-900/55">
              <span className={`flex h-7 w-7 lg:h-8 lg:w-8 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{dt(label)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

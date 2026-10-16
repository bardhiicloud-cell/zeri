import { PenSquare, FileText, Users, Building2, Heart } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { BrandMark } from '@/src/components/BrandLogo';

const CHIPS = [
  { icon: Users, label: 'Qytetarët raportojnë', tone: 'text-blue-600 bg-blue-500/15 dark:text-blue-300' },
  { icon: Building2, label: 'Institucionet veprojnë', tone: 'text-emerald-600 bg-emerald-500/15 dark:text-emerald-300' },
  { icon: Heart, label: 'Komuniteti përmirësohet', tone: 'text-rose-600 bg-rose-500/15 dark:text-rose-300' },
];

/**
 * Hero shown on Ballina when the scope is "Gjithë Kosova".
 * Day and night draw the same skyline (public/skyline-day.svg, skyline-night.svg), so both read as one scene.
 */
export function NationalHero({ onReport, onViewReports }: { onReport: () => void; onViewReports: () => void }) {
  return (
    <section
      aria-labelledby="national-hero-title"
      className="relative isolate w-full overflow-hidden rounded-[28px] border border-sky-200/70 dark:border-white/10 shadow-[0_20px_60px_-30px_rgba(30,64,175,0.45)] dark:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)]"
    >
      {/* ── Day scene ── */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 dark:hidden bg-[linear-gradient(180deg,#e6f2ff_0%,#cfe5ff_55%,#f3f9ff_100%)]">
        <div className="absolute -right-10 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,236,179,0.95)_0%,rgba(255,236,179,0.35)_45%,transparent_70%)]" />
        <div className="absolute left-[8%] top-10 h-6 w-40 rounded-full bg-white/70 blur-md" />
        <div className="absolute left-[38%] top-20 h-5 w-52 rounded-full bg-white/60 blur-md" />
        <div className="absolute right-[22%] top-12 h-5 w-36 rounded-full bg-white/60 blur-md" />
        <img src="/skyline-day.svg" alt="" className="absolute inset-x-0 bottom-0 h-[68%] w-full object-cover object-bottom" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.55)_42%,transparent_72%)]" />
      </div>

      {/* ── Night scene: the same skyline as the day scene, drawn in a night palette ── */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 hidden dark:block bg-[linear-gradient(180deg,#030814_0%,#0a1a3a_62%,#16386b_100%)]">
        <div className="absolute right-[26%] top-6 hidden h-14 w-14 sm:block rounded-full bg-[radial-gradient(circle,#fff6d6_0%,#fff6d6_35%,rgba(255,246,214,0.25)_60%,transparent_72%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_58%_100%,rgba(250,190,90,0.16),transparent_65%)]" />
        <img src="/skyline-night.svg" alt="" className="absolute inset-x-0 bottom-0 h-[68%] w-full object-cover object-bottom" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,8,20,0.9)_0%,rgba(3,8,20,0.6)_40%,transparent_72%)]" />
      </div>

      <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:p-9">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/60 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-800 backdrop-blur dark:border-cyan-300/25 dark:bg-white/5 dark:text-cyan-200 sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {dt('Platforma kombëtare e angazhimit qytetar')}
          </span>

          <div className="mt-4 flex items-center gap-4 sm:gap-5">
            <BrandMark className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 drop-shadow-[0_6px_18px_rgba(14,116,244,0.35)] dark:drop-shadow-[0_0_26px_rgba(34,211,238,0.5)]" />
            <div className="min-w-0">
              <h1 id="national-hero-title" className="text-3xl font-black leading-[0.95] tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-[3.4rem]">
                Zëri <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent dark:from-cyan-300 dark:to-blue-400">Qytetarëve</span>
              </h1>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.32em] text-sky-700 dark:text-cyan-300 sm:text-xs">
                {dt('Gjithë Kosova')}
              </p>
            </div>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-700 dark:text-slate-300 sm:text-[15px]">
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

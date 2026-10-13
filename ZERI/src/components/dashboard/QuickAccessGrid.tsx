import { ArrowUpRight, FileSearch, HelpCircle, Map, PenSquare, Phone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

import { dt } from '@/src/lib/dt';
interface QuickAccessCard {
  to: string;
  title: string;
  description: string;
  action: string;
  icon: LucideIcon;
  iconClassName: string;
  accentClassName: string;
}

const QUICK_ACCESS_CARDS: QuickAccessCard[] = [
  {
    to: '/raporto',
    title: 'Raporto një problem',
    description: 'Trego çfarë ndodhi dhe ku. Fotografia është sipas dëshirës.',
    action: 'Fillo raportimin',
    icon: PenSquare,
    iconClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    accentClassName: 'from-blue-500/0 via-blue-500/10 to-blue-500/0',
  },
  {
    to: '/trackid',
    title: 'Ndiq raportimin tim',
    description: 'Shkruaj kodin e raportimit për të parë përgjigjen dhe ecurinë.',
    action: 'Gjej raportimin',
    icon: FileSearch,
    iconClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    accentClassName: 'from-emerald-500/0 via-emerald-500/10 to-emerald-500/0',
  },
  {
    to: '/harta',
    title: 'Shiko hartën e problemeve',
    description: 'Shiko çfarë është raportuar në komunën dhe lagjen tënde.',
    action: 'Hap hartën',
    icon: Map,
    iconClassName: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    accentClassName: 'from-amber-500/0 via-amber-500/10 to-amber-500/0',
  },
  {
    to: '/ndihma',
    title: 'Më duhet ndihmë',
    description: 'Gjej udhëzime të thjeshta ose kërko ndihmë nga platforma.',
    action: 'Hap qendrën e ndihmës',
    icon: HelpCircle,
    iconClassName: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
    accentClassName: 'from-rose-500/0 via-rose-500/10 to-rose-500/0',
  },
  {
    to: '/kontakt-numrat',
    title: 'Më duhen numrat e telefonit',
    description: 'Gjej kontaktet e komunave dhe institucioneve publike.',
    action: 'Gjej kontaktet',
    icon: Phone,
    iconClassName: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
    accentClassName: 'from-teal-500/0 via-teal-500/10 to-teal-500/0',
  },
];

export function QuickAccessGrid() {
  return (
    <section aria-label={dt('Aksesi i shpejtë')} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="title-serif text-lg font-black tracking-tight text-slate-900 dark:text-white sm:text-xl">
            {dt('Çfarë dëshiron të bësh sot?')}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {dt('Zgjidh çfarë të duhet. Të udhëheqim hap pas hapi.')}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {dt('Ndihmë e shpejtë')}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {QUICK_ACCESS_CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className={cn(
              'group relative flex min-h-[190px] flex-col justify-between overflow-hidden rounded-[20px] border border-slate-200/80 bg-white/95 p-5 shadow-sm transition-colors hover:border-blue-300 hover:shadow-md dark:border-white/10 dark:bg-[#17232D] dark:shadow-none',
            )}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.95),_rgba(255,255,255,0)_38%)] opacity-100 dark:bg-[radial-gradient(circle_at_top_right,_rgba(148,163,184,0.15),_rgba(15,23,42,0)_38%)]" />
            <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r opacity-90', card.accentClassName)} />
            <div className="absolute inset-x-4 bottom-0 h-12 rounded-t-[22px] bg-gradient-to-t from-slate-900/5 to-transparent dark:from-white/0" />

            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-black/5 shadow-sm transition-all duration-200 group-hover:scale-110 group-hover:shadow-md', card.iconClassName)}>
                <card.icon className="h-5 w-5" />
              </div>
              <div className="rounded-full border border-slate-200/80 bg-white/80 p-1.5 text-slate-400 shadow-sm backdrop-blur-sm transition-all group-hover:border-blue-200 group-hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-500 dark:group-hover:border-blue-500/50 dark:group-hover:text-blue-400">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="relative z-10">
              <h3 className="mt-4 text-base font-extrabold leading-snug text-slate-900 dark:text-white">
                {dt(card.title)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {dt(card.description)}
              </p>
            </div>

            <span className="relative z-10 mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-slate-900/5 px-3 py-2 text-xs font-bold text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-slate-800/80 dark:text-blue-300 dark:group-hover:bg-blue-500 dark:group-hover:text-white">
              {dt(card.action)}
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

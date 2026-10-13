import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface PageHeroStat {
  value: string;
  label: string;
}

interface PageHeroProps {
  eyebrow: string;
  icon: LucideIcon;
  title: ReactNode;
  subtitle: ReactNode;
  /** Primary and secondary calls to action, rendered under the subtitle. */
  actions?: ReactNode;
  /** Short proof points shown as glass tiles on the right. */
  stats?: PageHeroStat[];
  /** Free-form block for the right column when stats are not a fit. */
  aside?: ReactNode;
  className?: string;
}

/**
 * The shared page masthead for the platform's editorial pages (Idea, Services,
 * Projects, About, Contact).
 *
 * Those pages each carried their own ad-hoc header: a white card here, a navy
 * panel there, so moving between them read as moving between products. One
 * component keeps the identity consistent: deep-navy gradient, a faint
 * engineering grid, the Kosovo-gold hairline, a serif headline and glass proof
 * points. It is dark in both themes on purpose: it is a brand surface, not
 * content.
 */
export function PageHero({ eyebrow, icon: Icon, title, subtitle, actions, stats, aside, className }: PageHeroProps) {
  return (
    <header
      className={cn(
        'relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#061226] via-[#0b2b57] to-[#14408a] text-white shadow-[0_28px_70px_-30px_rgba(11,43,87,0.8)] ring-1 ring-white/10',
        className,
      )}
    >
      {/* Engineering grid, masked so it fades toward the bottom-left. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.16] [background-image:linear-gradient(to_right,rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.55)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]"
      />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 -z-10 h-80 w-80 rounded-full bg-sky-400/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/4 -z-10 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />

      <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-center lg:gap-12 lg:p-12">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-blue-100 backdrop-blur">
            <Icon className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
            {eyebrow}
          </span>
          <h1 className="mt-5 font-serif text-[2rem] font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">{title}</h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-blue-100/90 sm:text-base sm:leading-8">{subtitle}</p>
          {actions && <div className="mt-7 flex flex-wrap items-center gap-3">{actions}</div>}
        </div>

        {(stats?.length || aside) && (
          <div className="min-w-0">
            {stats?.length ? (
              <dl className="grid grid-cols-2 gap-3">
                {stats.map(stat => (
                  <div key={stat.label} className="rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm sm:p-5">
                    <dt className="order-2 mt-1 text-[11px] font-semibold leading-snug text-blue-100/80">{stat.label}</dt>
                    <dd className="order-1 font-serif text-3xl font-black tracking-tight text-white sm:text-4xl">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {aside}
          </div>
        )}
      </div>
    </header>
  );
}

/** Primary call to action for use inside a PageHero. */
export const heroPrimaryClass =
  'inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-xs font-black text-[#0b2b57] shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50';
/** Secondary call to action for use inside a PageHero. */
export const heroSecondaryClass =
  'inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 text-xs font-bold text-white backdrop-blur transition hover:bg-white/20';

export default PageHero;

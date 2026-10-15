import { dt } from '@/src/lib/dt';

/**
 * Official Zëri Qytetarëve mark. The PNG is transparent, so it reads on both
 * light and dark surfaces; the wordmark is live text and follows the theme.
 */
export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return <img src="/logo-mark.png" alt="" aria-hidden="true" className={`${className} shrink-0 object-contain`} draggable={false} />;
}

export function BrandLogo({
  markClassName = 'h-9 w-9',
  subtitle = 'Republika e Kosovës',
  onDark = false,
  hideTextOnMobile = false,
}: {
  markClassName?: string;
  subtitle?: string | null;
  onDark?: boolean;
  hideTextOnMobile?: boolean;
}) {
  const title = onDark ? 'text-white' : 'text-slate-900 dark:text-white';
  const sub = onDark ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400';
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className={markClassName} />
      <span className={`${hideTextOnMobile ? 'hidden sm:flex' : 'flex'} flex-col leading-none`}>
        <span className={`text-sm font-black tracking-tight ${title}`}>{dt('Zëri Qytetarëve')}</span>
        {subtitle && <span className={`mt-0.5 text-[8px] font-semibold ${sub}`}>{dt(subtitle)}</span>}
      </span>
    </span>
  );
}

/** Stacked lockup (mark above wordmark) for login/register hero areas on dark surfaces. */
export function BrandLockup({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-cyan-400/20 blur-3xl" aria-hidden="true" />
        <BrandMark className={lg ? 'h-28 w-28' : 'h-20 w-20'} />
      </div>
      <div className={`mt-4 font-black leading-none text-white ${lg ? 'text-5xl tracking-[0.14em]' : 'text-3xl tracking-[0.14em]'}`}>ZËRI</div>
      <div className={`mt-2 font-semibold uppercase text-cyan-300 ${lg ? 'text-sm tracking-[0.5em]' : 'text-[11px] tracking-[0.45em]'}`}>Qytetarëve</div>
    </div>
  );
}

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

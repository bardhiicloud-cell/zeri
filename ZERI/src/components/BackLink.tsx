import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dt } from '@/src/lib/dt';
import { cn } from '../lib/utils';

interface BackLinkProps {
  /** Destination. Omit and pass `onClick` for in-page back actions. */
  to?: string;
  onClick?: () => void;
  /** Destination name, e.g. "Platforma". Rendered next to the chevron. */
  label?: string;
  /** Small line above the label on wide screens, e.g. "Kthehu". */
  className?: string;
}

/**
 * The one back control for every page: a frosted-glass pill with a chevron and
 * the destination's name, in the iOS navigation-bar idiom. 44px tall so it is a
 * real touch target; the chevron nudges left on hover/press as the affordance.
 */
export function BackLink({ to = '/', onClick, label = 'Platforma', className }: BackLinkProps) {
  const classes = cn(
    'group inline-flex h-11 items-center gap-1 rounded-full border border-slate-200/70 bg-white/90 py-0 pl-2.5 pr-4',
    'text-[15px] font-semibold tracking-tight text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_-12px_rgba(15,23,42,0.25)]',
    'backdrop-blur-xl backdrop-saturate-150 transition hover:bg-white active:scale-[0.97]',
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25',
    'dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15',
    className
  );
  const content = (
    <>
      <ChevronLeft
        className="h-5 w-5 text-blue-600 transition-transform group-hover:-translate-x-0.5 group-active:-translate-x-1 dark:text-blue-400"
        strokeWidth={2.4}
        aria-hidden="true"
      />
      <span>{dt(label)}</span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={`${dt('Kthehu te')} ${dt(label)}`} className={classes}>
        {content}
      </button>
    );
  }
  return (
    <Link to={to} aria-label={`${dt('Kthehu te')} ${dt(label)}`} className={classes}>
      {content}
    </Link>
  );
}

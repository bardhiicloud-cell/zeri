import { BadgeCheck } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';

/** The blue tick: an account whose verification plan is active. */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span title={dt('Llogari e verifikuar')} className="inline-flex shrink-0">
      <BadgeCheck className={cn('h-4 w-4 fill-blue-500 text-white', className)} aria-label={dt('Llogari e verifikuar')} />
    </span>
  );
}

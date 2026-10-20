import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FilterChipProps {
  label: string;
  onRemove: () => void;
  className?: string;
}

export function FilterChip({ label, onRemove, className }: FilterChipProps) {
  return (
    <span className={cn('inline-flex min-h-8 items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2.5 text-xs font-bold text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200', className)}>
      <span className="max-w-[15rem] truncate">{label}</span>
      <button type="button" onClick={onRemove} className="grid h-6 w-6 place-items-center rounded-md text-current transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/50" aria-label={`Hiq filtrin ${label}`}>
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

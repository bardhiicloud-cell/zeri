import { type ReactNode } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { cn } from '../../lib/utils';

interface StatePanelProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: ReactNode;
  tone?: 'neutral' | 'error' | 'info';
}

export function StatePanel({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryAction,
  tone = 'neutral',
}: StatePanelProps) {
  const toneStyles = {
    neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    error: 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300',
    info: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300',
  };

  return (
    <Card
      className="flex min-h-[300px] flex-col items-center justify-center px-6 py-12 text-center shadow-(--shadow-control)"
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <div className={cn('mb-5 flex h-16 w-16 items-center justify-center rounded-full', toneStyles[tone])}>
        {icon}
      </div>
      <h2 className="max-w-xl text-xl font-extrabold tracking-tight text-(--color-text) dark:text-white sm:text-2xl">
        {title}
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-(--color-text-muted) dark:text-slate-400">
        {description}
      </p>
      {(actionLabel || secondaryAction) && (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {actionLabel && onAction && (
            <Button type="button" onClick={onAction} variant={tone === 'error' ? 'danger' : 'primary'}>
              {actionLabel}
            </Button>
          )}
          {secondaryAction}
        </div>
      )}
    </Card>
  );
}

import React from 'react';
import { cn } from '../../lib/utils';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        "bg-(--color-surface) dark:bg-(--color-surface-dark) border border-(--color-border-soft) dark:border-white/10 rounded-(--radius-card) shadow-(--shadow-control) hover:shadow-(--shadow-surface) transition overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-(--spacing-4) py-(--spacing-3) border-b border-(--color-border-soft) dark:border-white/10", className)} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-(--spacing-4)", className)} {...props}>
      {children}
    </div>
  );
}

import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

export function Badge({ className, variant = 'neutral', children, ...props }: BadgeProps) {
  const variants = {
    success: "bg-[#E8F5E9] text-[#2e7d32] border border-[#a5d6a7]",
    warning: "bg-[#FFF8E1] text-[#e65100] border border-[#ffe082]",
    error: "bg-[#FFEBEE] text-[#c62828] border border-[#ef9a9a]",
    info: "bg-[#E0F7FA] text-[#006064] border border-[#80deea]",
    neutral: "bg-[#F8F9FA] text-[var(--color-text-muted)] border border-[#CED4DA] dark:bg-[#343a40] dark:text-[#F8F9FA] dark:border-[#495057]"
  };

  return (
    <span 
      className={cn(
        "inline-flex items-center px-(--spacing-2) py-[2px] rounded-full text-[12px] font-bold tracking-wide",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

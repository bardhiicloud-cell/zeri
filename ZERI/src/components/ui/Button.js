import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '../../lib/utils';
export function Button({ className, variant = 'primary', size = 'md', fullWidth = false, children, ...props }) {
    const baseStyles = "inline-flex min-h-11 items-center justify-center font-bold transition-all rounded-(--radius-button) focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
    const variants = {
        primary: "bg-(--color-primary) text-white hover:opacity-90 focus-visible:ring-(--color-primary) shadow-(--shadow-control)",
        secondary: "bg-(--color-secondary) text-white hover:opacity-90 focus-visible:ring-(--color-secondary)",
        outline: "bg-transparent border-2 border-(--color-primary) text-(--color-primary) hover:bg-(--color-primary) hover:text-white dark:border-white/20 dark:text-white dark:hover:bg-white/10",
        ghost: "hover:bg-black/5 dark:hover:bg-white/10 text-(--color-text)",
        danger: "bg-(--color-error) text-white hover:opacity-90 focus-visible:ring-(--color-error) shadow-(--shadow-control)"
    };
    const sizes = {
        sm: "py-2 px-[var(--spacing-3)] text-[14px]",
        md: "py-[12px] px-[var(--spacing-4)] text-[16px]",
        lg: "py-[16px] px-[var(--spacing-6)] text-[18px]"
    };
    return (_jsx("button", { className: cn(baseStyles, variants[variant], sizes[size], fullWidth ? "w-full" : "", className), ...props, children: children }));
}

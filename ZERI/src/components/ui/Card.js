import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '../../lib/utils';
export function Card({ className, children, ...props }) {
    return (_jsx("div", { className: cn("bg-(--color-surface) dark:bg-(--color-surface-dark) border border-(--color-border-soft) dark:border-white/10 rounded-(--radius-card) shadow-(--shadow-control) hover:shadow-(--shadow-surface) transition-all overflow-hidden", className), ...props, children: children }));
}
export function CardHeader({ className, children, ...props }) {
    return (_jsx("div", { className: cn("px-(--spacing-4) py-(--spacing-3) border-b border-(--color-border-soft) dark:border-white/10", className), ...props, children: children }));
}
export function CardContent({ className, children, ...props }) {
    return (_jsx("div", { className: cn("p-(--spacing-4)", className), ...props, children: children }));
}

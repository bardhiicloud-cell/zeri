import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
export function FilterChip({ label, onRemove, className }) {
    return (_jsxs("span", { className: cn('inline-flex min-h-8 items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2.5 text-xs font-bold text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200', className), children: [_jsx("span", { className: "max-w-[15rem] truncate", children: label }), _jsx("button", { type: "button", onClick: onRemove, className: "grid h-6 w-6 place-items-center rounded-md text-current transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/50", "aria-label": `Hiq filtrin ${label}`, children: _jsx(X, { className: "h-3.5 w-3.5", "aria-hidden": "true" }) })] }));
}

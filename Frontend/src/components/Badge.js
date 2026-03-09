import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Badge({ variant = 'info', children, pulse, className = '' }) {
    const styles = {
        success: 'chip-green',
        warning: 'chip-orange',
        error: 'chip-red',
        info: 'chip-cyan',
        purple: 'chip-purple',
        neutral: 'bg-white/5 border border-white/10 text-white/50',
    };
    return (_jsxs("span", { className: `chip ${styles[variant]} ${className}`, children: [pulse && _jsx("span", { className: "live-dot !w-[6px] !h-[6px]" }), children] }));
}

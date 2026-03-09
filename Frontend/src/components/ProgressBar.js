import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ProgressBar({ value, max = 100, showLabel, className = '', color = 'cyan', size = 'md', animated = true, }) {
    const percentage = Math.min((value / max) * 100, 100);
    const colors = {
        cyan: 'bg-brand shadow-[0_0_10px_rgba(0,230,118,0.4)]',
        green: 'bg-brand shadow-[0_0_10px_rgba(0,230,118,0.4)]',
        purple: 'bg-neon-purple shadow-[0_0_10px_rgba(168,85,247,0.4)]',
        red: 'bg-neon-red shadow-[0_0_10px_rgba(239,68,68,0.4)]',
        orange: 'bg-neon-orange shadow-[0_0_10px_rgba(249,115,22,0.4)]',
        gradient: 'bg-gradient-to-r from-brand via-brand-light to-brand-dark shadow-[0_0_10px_rgba(0,230,118,0.3)]',
    };
    const sizes = {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
    };
    return (_jsxs("div", { className: className, children: [_jsx("div", { className: `w-full bg-white/5 rounded-full ${sizes[size]} overflow-hidden`, children: _jsx("div", { className: `${colors[color]} ${sizes[size]} rounded-full ${animated ? 'transition-all duration-1000 ease-out' : ''}`, style: { width: `${percentage}%` } }) }), showLabel && (_jsxs("div", { className: "flex justify-between mt-1.5", children: [_jsxs("span", { className: "text-xs font-mono text-white/40", children: [percentage.toFixed(1), "%"] }), _jsxs("span", { className: "text-xs font-mono text-white/30", children: [value.toLocaleString(), " / ", max.toLocaleString()] })] }))] }));
}

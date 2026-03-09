import { jsx as _jsx } from "react/jsx-runtime";
export function Card({ children, className = '', variant = 'default', animate = false, style }) {
    const variants = {
        default: 'glow-card',
        glow: 'glow-card animate-border-glow',
        glass: 'glass rounded-2xl',
        danger: 'bg-red-500/5 border border-red-500/20 rounded-2xl',
    };
    return (_jsx("div", { className: `p-6 ${variants[variant]} ${animate ? 'animate-fade-up opacity-0' : ''} ${className}`, style: style, children: children }));
}

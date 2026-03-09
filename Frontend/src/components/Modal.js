import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", children: [_jsx("div", { className: "fixed inset-0 bg-black/70 backdrop-blur-sm", onClick: onClose }), _jsxs("div", { className: "relative glass-strong rounded-2xl p-8 w-full max-w-lg max-h-[80vh] overflow-auto animate-scale-in", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-xl font-bold text-white", children: title }), _jsx("button", { onClick: onClose, className: "w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition", children: "\u2715" })] }), children] })] }));
}

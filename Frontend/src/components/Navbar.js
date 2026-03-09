import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useLocation } from 'react-router-dom';
import { ConnectWallet } from './ConnectWallet';
import { ProvenLogo } from './ProvenLogo';
export function Navbar() {
    const location = useLocation();
    const links = [
        { path: '/', label: 'Home' },
        { path: '/launch', label: 'Launch Pool' },
        { path: '/verify', label: 'Dashboard' },
        { path: '/monitor', label: 'Monitor' },
    ];
    return (_jsx("nav", { className: "fixed top-0 left-0 right-0 z-50 border-b border-brand/[0.06]", style: { background: 'rgba(3,11,6,0.92)', backdropFilter: 'blur(16px)' }, children: _jsxs("div", { className: "max-w-7xl mx-auto px-6 h-16 flex items-center justify-between", children: [_jsxs(Link, { to: "/", className: "flex items-center gap-2.5 group", children: [_jsx(ProvenLogo, { size: 28, className: "drop-shadow-[0_0_6px_rgba(0,230,118,0.3)] group-hover:drop-shadow-[0_0_12px_rgba(0,230,118,0.5)] transition-all duration-500" }), _jsx("span", { className: "text-[15px] font-bold tracking-tight text-white", children: "Proven Protocol" })] }), _jsx("div", { className: "flex items-center gap-1", children: links.map(({ path, label }) => {
                        const isActive = location.pathname === path ||
                            (path !== '/' && location.pathname.startsWith(path));
                        return (_jsx(Link, { to: path, className: `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                ? 'text-white'
                                : 'text-white/50 hover:text-white/80'}`, children: label }, path));
                    }) }), _jsx(ConnectWallet, {})] }) }));
}

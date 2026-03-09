import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useNetwork } from 'wagmi';
import { Wallet, Copy, ExternalLink, LogOut } from 'lucide-react';
export function ConnectWallet() {
    const { address, isConnected } = useAccount();
    const { connect, connectors, isLoading, pendingConnector } = useConnect();
    const { disconnect } = useDisconnect();
    const { chain } = useNetwork();
    const [showDropdown, setShowDropdown] = useState(false);
    const [showConnectors, setShowConnectors] = useState(false);
    const dropdownRef = useRef(null);
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
                setShowConnectors(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    const formatAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    if (!isConnected) {
        return (_jsxs("div", { className: "relative", ref: dropdownRef, children: [_jsx("button", { className: "px-5 py-2 rounded-lg border border-brand/30 bg-brand/10 text-brand text-sm font-semibold hover:bg-brand/20 hover:border-brand/50 transition-all duration-200", onClick: () => setShowConnectors(!showConnectors), children: isLoading ? (_jsxs("span", { className: "flex items-center gap-2", children: [_jsx("svg", { className: "animate-spin h-3.5 w-3.5", viewBox: "0 0 24 24", children: _jsx("circle", { cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "3", fill: "none", strokeDasharray: "60", strokeDashoffset: "20" }) }), "Connecting..."] })) : ('Connect Wallet') }), showConnectors && (_jsxs("div", { className: "absolute top-full right-0 mt-2 w-64 rounded-xl border border-surface-border bg-surface p-3 space-y-1.5 z-50 shadow-xl", children: [_jsx("p", { className: "text-white/40 text-[10px] font-semibold uppercase tracking-widest px-2 py-1", children: "Select Wallet" }), connectors
                            .filter((c) => c.ready)
                            .map((connector) => (_jsxs("button", { onClick: () => {
                                connect({ connector });
                                setShowConnectors(false);
                            }, className: "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all duration-200", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0", children: _jsx(Wallet, { className: "w-4 h-4 text-brand" }) }), _jsxs("div", { children: [_jsx("div", { className: "font-semibold", children: connector.name }), isLoading && pendingConnector?.id === connector.id && (_jsx("div", { className: "text-brand text-xs", children: "Connecting..." }))] })] }, connector.id))), _jsx("div", { className: "border-t border-white/5 mt-2 pt-2 px-2", children: _jsx("p", { className: "text-white/20 text-[10px]", children: "Connecting to Unichain Sepolia" }) })] }))] }));
    }
    return (_jsxs("div", { className: "relative", ref: dropdownRef, children: [_jsxs("button", { onClick: () => setShowDropdown(!showDropdown), className: "flex items-center gap-2.5 px-3 py-2 rounded-lg border border-brand/20 bg-brand/5 hover:bg-brand/10 transition-all duration-300", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-brand" }), _jsx("div", { className: "absolute inset-0 w-2 h-2 rounded-full bg-brand animate-ping opacity-40" })] }), _jsx("span", { className: "text-[10px] font-mono font-bold text-brand/60 uppercase", children: chain?.name?.slice(0, 5) || 'NET' }), _jsx("span", { className: "text-xs font-mono text-white/80", children: formatAddress(address) }), _jsx("svg", { className: `w-3 h-3 text-white/30 transition-transform ${showDropdown ? 'rotate-180' : ''}`, viewBox: "0 0 12 12", fill: "none", children: _jsx("path", { d: "M3 5L6 8L9 5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }) })] }), showDropdown && (_jsxs("div", { className: "absolute top-full right-0 mt-2 w-72 rounded-xl border border-surface-border bg-surface p-4 z-50 shadow-xl", children: [_jsxs("div", { className: "mb-3 pb-3 border-b border-white/5", children: [_jsx("p", { className: "text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2", children: "Connected" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-brand/20 border border-brand/30 flex items-center justify-center", children: _jsx("span", { className: "text-brand text-xs font-bold", children: address?.slice(2, 4).toUpperCase() }) }), _jsxs("div", { children: [_jsx("p", { className: "text-white font-mono text-sm", children: formatAddress(address) }), _jsx("p", { className: "text-white/20 text-xs", children: chain?.name || 'Unknown Chain' })] })] })] }), _jsxs("div", { className: "space-y-1", children: [_jsxs("button", { onClick: () => {
                                    navigator.clipboard.writeText(address);
                                    setShowDropdown(false);
                                }, className: "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all", children: [_jsx(Copy, { className: "w-4 h-4" }), " Copy Address"] }), _jsxs("a", { href: `${chain?.blockExplorers?.default?.url ?? 'https://sepolia.uniscan.xyz'}/address/${address}`, target: "_blank", rel: "noopener noreferrer", className: "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all", onClick: () => setShowDropdown(false), children: [_jsx(ExternalLink, { className: "w-4 h-4" }), " View on Explorer"] }), _jsxs("button", { onClick: () => {
                                    disconnect();
                                    setShowDropdown(false);
                                }, className: "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-all", children: [_jsx(LogOut, { className: "w-4 h-4" }), " Disconnect"] })] })] }))] }));
}

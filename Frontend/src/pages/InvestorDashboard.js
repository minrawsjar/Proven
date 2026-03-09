import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useVerifyStore } from '../store/verifyStore';
import { usePositionData, useRiskScore, useTokenInfo, useHookEventPolling } from '../hooks/useWeb3';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Badge } from '../components/Badge';
import { Search, Siren, ShieldCheck, ScrollText, Copy, Check, Loader2 } from 'lucide-react';
import { isValidAddress } from '../utils/format';
import { SIGNAL_LABELS, UNICHAIN_EXPLORER, VESTING_HOOK_ADDRESS } from '../config/constants';
export function InvestorDashboard() {
    const { address: routeAddress } = useParams();
    const { selectedAddress, setSelectedAddress, poolData, setPoolData, events } = useVerifyStore();
    const [searchInput, setSearchInput] = useState(routeAddress || '');
    const [copied, setCopied] = useState(false);
    // Resolved team address to query
    const queryAddr = selectedAddress || routeAddress;
    // On-chain hooks
    const { data: position, loading: posLoading, error: posError } = usePositionData(queryAddr);
    const { score: riskScore, tier: riskTier } = useRiskScore(queryAddr);
    const tokenAddr = position?.tokenAddr;
    const { info: tokenInfo } = useTokenInfo(tokenAddr && tokenAddr !== '0x0000000000000000000000000000000000000000' ? tokenAddr : undefined);
    const { isPolling } = useHookEventPolling(queryAddr);
    // When position data comes in, map it to the store shape
    useEffect(() => {
        if (!position || position.team === '0x0000000000000000000000000000000000000000') {
            if (!posLoading && queryAddr)
                setPoolData(null);
            return;
        }
        const lockUntil = Number(position.lockExtendedUntil);
        const now = Math.floor(Date.now() / 1000);
        setPoolData({
            projectName: tokenInfo?.name ?? 'Unknown Project',
            tokenSymbol: tokenInfo?.symbol ?? '???',
            tokenAddress: position.tokenAddr,
            pairToken: 'USDC',
            feeTier: 0.3,
            totalLocked: Number(position.lpAmount),
            currentUnlocked: Math.floor(Number(position.lpAmount) * position.unlockedPct / 100),
            unlockPercentage: position.unlockedPct,
            lockExtendedUntil: lockUntil > now ? new Date(lockUntil * 1000).toISOString().split('T')[0] : null,
            riskScore,
            milestones: [
                { condition: 'Milestone 1', currentValue: 0, threshold: 1, unlockAmount: 0, isComplete: false },
                { condition: 'Milestone 2', currentValue: 0, threshold: 1, unlockAmount: 0, isComplete: false },
                { condition: 'Milestone 3', currentValue: 0, threshold: 1, unlockAmount: 0, isComplete: false },
            ],
            monitoredWallets: [position.team],
            treasuryAddress: null,
        });
    }, [position, tokenInfo, riskScore, posLoading, queryAddr, setPoolData]);
    const handleSearch = () => {
        if (!searchInput || !isValidAddress(searchInput))
            return;
        setSelectedAddress(searchInput);
    };
    useEffect(() => {
        if (routeAddress && isValidAddress(routeAddress)) {
            setSearchInput(routeAddress);
            setSelectedAddress(routeAddress);
        }
    }, [routeAddress, setSelectedAddress]);
    const handleCopy = () => {
        const url = `${window.location.origin}/verify/${searchInput}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const riskColor = (score) => score < 25 ? 'brand' : score < 50 ? 'neon-yellow' : score < 75 ? 'neon-orange' : 'neon-red';
    const loading = posLoading;
    return (_jsxs("div", { className: "max-w-6xl mx-auto px-6 py-12", children: [_jsxs("div", { className: "mb-12 animate-fade-up opacity-0", children: [_jsx(Badge, { variant: "purple", pulse: true, className: "mb-4", children: "INVESTOR DASHBOARD" }), _jsx("h1", { className: "text-3xl md:text-4xl font-black text-white mb-2", children: "Verify a Project" }), _jsx("p", { className: "text-white/30 mb-8", children: "Paste a team address to check their vesting position" }), _jsxs("div", { className: "flex gap-3", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Search, { className: "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" }), _jsx("input", { className: "input-glow w-full !pl-12 font-mono", placeholder: "0x... (team wallet address)", value: searchInput, onChange: (e) => setSearchInput(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleSearch() })] }), _jsx("button", { className: "btn-primary px-8 py-3", onClick: handleSearch, disabled: loading, children: loading ? (_jsxs("span", { className: "flex items-center gap-2", children: [_jsx(Loader2, { className: "animate-spin h-4 w-4" }), "Searching"] })) : 'Search' })] }), VESTING_HOOK_ADDRESS === '0x0000000000000000000000000000000000000000' && (_jsx("p", { className: "text-neon-orange/60 text-xs mt-3 font-mono", children: "\u26A0 Hook not deployed \u2014 set VITE_HOOK_ADDRESS in .env" }))] }), poolData && (_jsxs("div", { className: "space-y-6", children: [poolData.lockExtendedUntil && (_jsxs("div", { className: "animate-fade-up opacity-0 p-5 rounded-2xl bg-red-500/5 border border-red-500/30 relative overflow-hidden", children: [_jsx("div", { className: "absolute top-0 left-0 w-1.5 h-full bg-red-500 animate-pulse" }), _jsxs("div", { className: "flex items-start gap-4 ml-4", children: [_jsx(Siren, { className: "w-8 h-8 text-red-400 flex-shrink-0" }), _jsxs("div", { children: [_jsx("h3", { className: "font-black text-red-400 text-lg mb-1", children: "RAGE LOCK ACTIVE" }), _jsxs("p", { className: "text-red-200/60 text-sm mb-1", children: ["Lock extended until ", _jsx("span", { className: "text-red-300 font-mono", children: poolData.lockExtendedUntil })] }), _jsx("p", { className: "text-red-200/40 text-sm", children: "The Reactive Smart Contract triggered a lock extension due to elevated risk signals." })] })] })] })), _jsxs(Card, { variant: "glow", className: "!p-8 animate-fade-up opacity-0", children: [_jsxs("div", { className: "flex items-start justify-between mb-8", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-black text-white", children: poolData.projectName }), _jsxs("p", { className: "text-white/30 font-mono text-sm mt-1", children: ["$", poolData.tokenSymbol, " / ", poolData.pairToken, " \u00B7 ", poolData.feeTier, "% fee"] })] }), _jsx(Badge, { variant: poolData.lockExtendedUntil ? 'error' : poolData.unlockPercentage === 100 ? 'success' : 'success', pulse: !poolData.lockExtendedUntil && poolData.unlockPercentage < 100, children: poolData.lockExtendedUntil ? 'RAGE LOCKED' : poolData.unlockPercentage === 100 ? 'FULLY UNLOCKED' : 'ACTIVE' })] }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 mb-8", children: [
                                    { label: 'Total LP Locked', value: poolData.totalLocked > 0 ? poolData.totalLocked.toLocaleString() : '0', color: 'text-white', sub: _jsx("a", { href: `${UNICHAIN_EXPLORER}/address/${VESTING_HOOK_ADDRESS}`, target: "_blank", rel: "noopener noreferrer", className: "text-brand/60 hover:text-brand transition", children: "Verify on-chain \u2197" }) },
                                    { label: 'Currently Unlocked', value: `${poolData.unlockPercentage}%`, color: 'text-brand', sub: `${poolData.currentUnlocked.toLocaleString()} released` },
                                    { label: 'Lock Extended', value: poolData.lockExtendedUntil || 'Never', color: 'text-white', sub: poolData.lockExtendedUntil ? 'RSC-triggered extension' : 'No extensions triggered' },
                                    { label: 'Risk Score', value: `${poolData.riskScore}/100`, color: `text-${riskColor(poolData.riskScore)}`, sub: poolData.riskScore === 0 ? 'All signals clear' : 'Active signals detected' },
                                ].map((stat, i) => (_jsxs("div", { className: "p-4 rounded-xl bg-white/[0.02] border border-white/5", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wider text-white/30 mb-2", children: stat.label }), _jsx("p", { className: `text-2xl font-black font-mono ${stat.color}`, children: stat.value }), _jsx("div", { className: "text-white/20 text-xs mt-1", children: stat.sub })] }, i))) }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wider text-white/30 mb-3", children: "Overall Unlock Progress" }), _jsx(ProgressBar, { value: poolData.unlockPercentage, color: "gradient", size: "lg", showLabel: true })] })] }), _jsxs(Card, { className: "!p-8 animate-fade-up opacity-0", children: [_jsxs("div", { className: "flex items-center gap-3 mb-8", children: [_jsx("div", { className: "w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center", children: _jsx(ShieldCheck, { className: "w-5 h-5 text-brand" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold text-white", children: "Risk Score Analysis" }), _jsx("p", { className: "text-white/30 text-sm", children: "5-signal composite monitored by Reactive Smart Contracts on Lasna" })] })] }), _jsxs("div", { className: "p-6 rounded-xl bg-void-50 border border-white/5 mb-6", children: [_jsxs("div", { className: "flex items-end justify-between mb-4", children: [_jsx("span", { className: "text-white/40 text-sm", children: "Risk Level" }), _jsx("span", { className: `text-4xl font-black font-mono text-${riskColor(poolData.riskScore)}`, children: poolData.riskScore })] }), _jsxs("div", { className: "h-3 bg-white/5 rounded-full overflow-hidden relative", children: [_jsxs("div", { className: "absolute inset-0 flex", children: [_jsx("div", { className: "flex-1 bg-brand/20" }), _jsx("div", { className: "flex-1 bg-neon-yellow/20" }), _jsx("div", { className: "flex-1 bg-neon-orange/20" }), _jsx("div", { className: "flex-1 bg-neon-red/20" })] }), _jsx("div", { className: `h-full rounded-full relative z-10 transition-all duration-1000 ${poolData.riskScore < 25 ? 'bg-brand shadow-[0_0_12px_rgba(0,230,118,0.5)]' :
                                                    poolData.riskScore < 50 ? 'bg-neon-yellow shadow-[0_0_12px_rgba(234,179,8,0.5)]' :
                                                        poolData.riskScore < 75 ? 'bg-neon-orange shadow-[0_0_12px_rgba(249,115,22,0.5)]' :
                                                            'bg-neon-red shadow-[0_0_12px_rgba(239,68,68,0.5)]'}`, style: { width: `${Math.max(poolData.riskScore, 2)}%` } })] }), _jsxs("div", { className: "flex justify-between text-[10px] text-white/20 mt-2 font-mono", children: [_jsx("span", { children: "0 SAFE" }), _jsx("span", { children: "25" }), _jsx("span", { children: "50" }), _jsx("span", { children: "75" }), _jsx("span", { children: "100 DANGER" })] })] }), _jsx("div", { className: "space-y-2", children: [0, 1, 2, 3, 4].map((signalId) => {
                                    const label = SIGNAL_LABELS[signalId];
                                    // In future, read actual signal states from RSC; for now show all as monitoring
                                    const isActive = false;
                                    return (_jsxs("div", { className: `p-4 rounded-xl flex items-center justify-between text-sm transition-all duration-300 ${isActive
                                            ? 'bg-neon-orange/5 border border-neon-orange/20'
                                            : 'bg-white/[0.02] border border-white/5 opacity-50'}`, children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("span", { className: `font-mono text-xs font-bold ${isActive ? 'text-neon-orange' : 'text-white/20'}`, children: ["S", signalId + 1] }), _jsx("span", { className: isActive ? 'text-white' : 'text-white/30', children: label })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("span", { className: "text-white/20 text-xs", children: isActive ? 'Active' : 'Monitoring' }), _jsx("span", { className: `font-mono text-xs ${isActive ? 'text-neon-orange' : 'text-white/15'}`, children: isActive ? '+pts' : '0 pts' })] })] }, signalId));
                                }) })] }), _jsxs(Card, { className: "!p-8 animate-fade-up opacity-0", children: [_jsxs("div", { className: "flex items-center gap-3 mb-8", children: [_jsx("div", { className: "w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center", children: _jsx(ScrollText, { className: "w-5 h-5 text-brand" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold text-white", children: "Event Log" }), _jsxs("p", { className: "text-white/30 text-sm", children: ["On-chain events for this position", isPolling && _jsx("span", { className: "ml-2 text-brand text-xs", children: "\u25CF Live" })] })] })] }), _jsx("div", { className: "space-y-3", children: events.length === 0 ? (_jsxs("div", { className: "text-center py-8", children: [_jsx(ScrollText, { className: "w-8 h-8 text-white/10 mx-auto mb-2" }), _jsx("p", { className: "text-white/20 text-sm", children: "No events found yet \u2014 events will appear after the first on-chain interaction" })] })) : (events.slice(0, 20).map((event, i) => (_jsxs("div", { className: "p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Badge, { variant: event.eventType === 'MilestoneUnlocked' ? 'success' :
                                                                event.eventType === 'LockExtended' ? 'error' :
                                                                    event.eventType === 'RiskElevated' ? 'warning' : 'info', children: event.eventType }), _jsxs("span", { className: "text-white/20 text-xs font-mono", children: ["Block #", event.blockNumber] })] }), _jsxs("a", { href: `${UNICHAIN_EXPLORER}/tx/${event.txHash}`, target: "_blank", rel: "noopener noreferrer", className: "text-brand/40 text-xs font-mono hover:text-brand cursor-pointer transition", children: [event.txHash.slice(0, 10), "... \u2197"] })] }), _jsx("p", { className: "text-white/50 text-sm", children: event.description })] }, event.id || i)))) })] }), _jsx("div", { className: "text-center animate-fade-up opacity-0", children: _jsx("button", { className: "btn-primary px-8 py-2.5", onClick: handleCopy, children: copied ? _jsxs("span", { className: "inline-flex items-center gap-1.5", children: [_jsx(Check, { className: "w-4 h-4" }), " Copied!"] }) : _jsxs("span", { className: "inline-flex items-center gap-1.5", children: [_jsx(Copy, { className: "w-4 h-4" }), " Copy Verification Link"] }) }) })] })), loading && queryAddr && (_jsx(Card, { className: "!p-12 text-center animate-fade-up opacity-0", children: _jsxs("div", { className: "flex flex-col items-center gap-4", children: [_jsx(Loader2, { className: "animate-spin h-8 w-8 text-brand" }), _jsx("p", { className: "text-white/30", children: "Reading on-chain data from Unichain Sepolia..." })] }) })), !loading && queryAddr && !poolData && posError && (_jsx(Card, { className: "!p-12 text-center animate-fade-up opacity-0", children: _jsxs("div", { className: "flex flex-col items-center gap-4", children: [_jsx(Search, { className: "w-12 h-12 text-white/10" }), _jsx("p", { className: "text-white/30 text-lg", children: "No position found for this address" }), _jsx("p", { className: "text-white/15 text-sm font-mono", children: posError })] }) })), !queryAddr && (_jsx(Card, { className: "!p-16 text-center animate-fade-up opacity-0", children: _jsxs("div", { className: "flex flex-col items-center gap-4", children: [_jsx(Search, { className: "w-12 h-12 text-white/10" }), _jsx("p", { className: "text-white/30 text-lg", children: "Enter a team address to begin verification" }), _jsx("p", { className: "text-white/15 text-sm", children: "Paste the team wallet address that registered the vesting position" })] }) }))] }));
}

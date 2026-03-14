import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVerifyStore } from '../store/verifyStore';
import { useWallet, usePositionData, useRiskScore, useTokenInfo, useHookEventPolling, useRugSignals, useMilestoneLockState, useMilestoneConfig } from '../hooks/useWeb3';
import { isValidAddress, formatAddress } from '../utils/format';
import { SIGNAL_LABELS, UNICHAIN_EXPLORER, LASNA_EXPLORER } from '../config/constants';
import { Search, Shield, Activity, AlertTriangle, Clock, Unlock, ChevronRight, ExternalLink, Rocket, Wallet, Eye, BarChart3 } from 'lucide-react';
export function InvestorDashboard() {
    const { address: routeAddress } = useParams();
    const navigate = useNavigate();
    const { selectedAddress, setSelectedAddress, events } = useVerifyStore();
    const [searchInput, setSearchInput] = useState(routeAddress || '');
    /* ── Connected wallet ── */
    const { address: connectedAddress, isConnected } = useWallet();
    /* ── View address = searched or route ── */
    const viewAddress = selectedAddress || routeAddress;
    /* ── Auto-load connected wallet's position ── */
    const { data: myPositionData, loading: myPosLoading } = usePositionData(isConnected && connectedAddress ? connectedAddress : undefined);
    const myTokenAddr = myPositionData?.tokenAddr;
    const { info: myTokenInfo } = useTokenInfo(myTokenAddr && myTokenAddr !== '0x0000000000000000000000000000000000000000' ? myTokenAddr : undefined);
    const { score: myRiskScore } = useRiskScore(isConnected && connectedAddress ? connectedAddress : undefined);
    /* ── Searched address position ── */
    const { data: positionData, loading: posLoading, error: posError } = usePositionData(viewAddress || undefined);
    const { score: riskScore, tier: riskTier } = useRiskScore(viewAddress || undefined);
    const { occurredSignals, lastTxBySignal, triggerMetaBySignal } = useRugSignals(viewAddress || undefined);
    const { lockedMilestones } = useMilestoneLockState(viewAddress || undefined);
    const { milestones: configuredMilestones } = useMilestoneConfig(viewAddress || undefined);
    const tokenAddr = positionData?.tokenAddr;
    const { info: tokenInfo } = useTokenInfo(tokenAddr && tokenAddr !== '0x0000000000000000000000000000000000000000' ? tokenAddr : undefined);
    useHookEventPolling(viewAddress || undefined);
    /* ── Has a valid launched pool? ── */
    const hasMyPool = myPositionData && myPositionData.team !== '0x0000000000000000000000000000000000000000' && myPositionData.registeredAt > 0n;
    const isViewingSelf = viewAddress?.toLowerCase() === connectedAddress?.toLowerCase();
    useEffect(() => {
        if (routeAddress && isValidAddress(routeAddress)) {
            setSelectedAddress(routeAddress);
        }
    }, [routeAddress]);
    /* ── Auto-navigate to own pool when connected and no route address ── */
    useEffect(() => {
        if (isConnected && connectedAddress && hasMyPool && !routeAddress && !selectedAddress) {
            setSelectedAddress(connectedAddress);
            setSearchInput(connectedAddress);
            navigate(`/verify/${connectedAddress}`, { replace: true });
        }
    }, [isConnected, connectedAddress, hasMyPool, routeAddress, selectedAddress]);
    const handleSearch = () => {
        if (searchInput && isValidAddress(searchInput)) {
            setSelectedAddress(searchInput);
            navigate(`/verify/${searchInput}`);
        }
    };
    const handleViewMyPool = () => {
        if (connectedAddress) {
            setSearchInput(connectedAddress);
            setSelectedAddress(connectedAddress);
            navigate(`/verify/${connectedAddress}`);
        }
    };
    const inp = "w-full bg-white dark:bg-[#111] border-4 border-black dark:border-white px-4 py-3 font-mono text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-shadow";
    const signals = [
        { id: 'S1', label: SIGNAL_LABELS?.[0] ?? 'LP removal via DEX', icon: Unlock, color: 'bg-[#DFFF00]' },
        { id: 'S2', label: SIGNAL_LABELS?.[1] ?? 'Treasury drain', icon: AlertTriangle, color: 'bg-[#FF3333] text-white' },
        { id: 'S3', label: SIGNAL_LABELS?.[2] ?? 'Wallet clustering', icon: Activity, color: 'bg-black text-white dark:bg-white dark:text-black' },
        { id: 'S4', label: SIGNAL_LABELS?.[3] ?? 'Social silence', icon: Clock, color: 'bg-gray-200 dark:bg-[#1A1A1A]' },
        { id: 'S5', label: SIGNAL_LABELS?.[4] ?? 'Code mutation', icon: Shield, color: 'bg-[#DFFF00]' },
    ];
    const getRiskColor = (score) => {
        if (score <= 30)
            return { bg: 'bg-[#DFFF00]', text: 'text-black', label: 'LOW RISK' };
        if (score <= 60)
            return { bg: 'bg-black dark:bg-white', text: 'text-[#DFFF00] dark:text-black', label: 'MEDIUM' };
        return { bg: 'bg-[#FF3333]', text: 'text-white', label: 'HIGH RISK' };
    };
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const inferredFromLock = positionData?.lockExtendedUntil && positionData.lockExtendedUntil > nowSec
        ? {
            score: positionData.lockExtendedUntil - nowSec > 7n * 24n * 60n * 60n ? 75 : 50,
            tier: positionData.lockExtendedUntil - nowSec > 7n * 24n * 60n * 60n ? 3 : 2,
        }
        : null;
    const displayRiskScore = riskScore > 0 || riskTier > 0 ? riskScore : (inferredFromLock?.score ?? 0);
    const displayRiskTier = riskScore > 0 || riskTier > 0 ? riskTier : (inferredFromLock?.tier ?? 0);
    const riskInfo = getRiskColor(displayRiskScore);
    const myRiskInfo = getRiskColor(myRiskScore);
    const riskTierLabel = displayRiskTier === 0 ? 'SAFE' : displayRiskTier === 1 ? 'WATCH' : displayRiskTier === 2 ? 'ALERT' : 'RAGE';
    const occurredSignalSet = new Set(occurredSignals);
    const occurredSignalText = `${occurredSignals.length > 0 ? occurredSignals.join(', ') : 'None'} | Locked milestones: ${lockedMilestones.length > 0 ? lockedMilestones.map((m) => `M${m}`).join(', ') : 'None'}`;
    const conditionLabel = (type) => type === 0 ? 'TVL' : type === 1 ? 'VOLUME' : type === 2 ? 'USERS' : 'UNKNOWN';
    const formatUsdcShort = (raw) => {
        const SCALE = 10n ** 6n;
        const whole = (raw % SCALE === 0n && raw / SCALE >= 10n) ? (raw / SCALE) : raw;
        if (whole >= 1_000_000_000n)
            return `$${(Number(whole / 100_000_000n) / 10).toFixed(1)}B`;
        if (whole >= 1_000_000n)
            return `$${(Number(whole / 100_000n) / 10).toFixed(1)}M`;
        if (whole >= 1_000n)
            return `$${(Number(whole / 100n) / 10).toFixed(1)}K`;
        return `$${whole.toString()}`;
    };
    const formatMilestoneThreshold = (conditionType, threshold) => {
        if (conditionType === 0 || conditionType === 1)
            return `${formatUsdcShort(threshold)} USDC`;
        return threshold.toString();
    };
    const milestoneCards = configuredMilestones.length === 3
        ? configuredMilestones.map((m, i) => ({
            key: i + 1,
            pct: m.unlockPct,
            done: m.complete,
            sub: `${conditionLabel(m.conditionType)} ≥ ${formatMilestoneThreshold(m.conditionType, m.threshold)}`,
        }))
        : [30, 70, 100].map((m, i) => ({
            key: i + 1,
            pct: m,
            done: positionData ? positionData.unlockedPct >= m : false,
            sub: 'Awaiting milestone config',
        }));
    const lockedMilestoneText = lockedMilestones.length > 0 ? lockedMilestones.map((m) => `M${m}`).join(', ') : 'None';
    const poolStatus = !positionData
        ? 'No pool loaded'
        : positionData.team === '0x0000000000000000000000000000000000000000'
            ? 'No position found'
            : positionData.lockExtendedUntil > 0n
                ? 'Lock extension active'
                : 'Monitoring normally';
    const lockUntilText = positionData?.lockExtendedUntil && positionData.lockExtendedUntil > 0n
        ? new Date(Number(positionData.lockExtendedUntil) * 1000).toLocaleString()
        : 'No extension';
    const formatLp = (amt) => {
        if (amt === 0n)
            return '0';
        const str = amt.toString();
        if (str.length > 18) {
            const whole = str.slice(0, str.length - 18) || '0';
            const frac = str.slice(str.length - 18, str.length - 14);
            return `${Number(whole).toLocaleString()}.${frac}`;
        }
        return str;
    };
    return (_jsx("div", { className: "min-h-screen bg-white dark:bg-[#0A0A0A] text-black dark:text-white", children: _jsxs("div", { className: "max-w-7xl mx-auto px-6 py-10", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8", children: [_jsxs("div", { children: [_jsx("span", { className: "inline-block bg-black text-[#DFFF00] font-black uppercase text-xs px-4 py-1 border-2 border-black mb-3", children: "Investor Dashboard" }), _jsx("h1", { className: "text-4xl md:text-5xl font-black uppercase tracking-tighter", children: "Pool Control Center" }), _jsx("p", { className: "font-mono text-sm text-gray-600 dark:text-gray-400 mt-1", children: "Track one team at a time: status, risk, unlocks, and live events." })] }), _jsx("div", { className: "border-4 border-black dark:border-white px-4 py-2 bg-[#DFFF00] text-black font-mono text-xs", children: "Comic UI \u2022 Real on-chain data" })] }), isConnected && !myPosLoading && hasMyPool && !isViewingSelf && (_jsxs("div", { className: "mb-10", children: [_jsxs("div", { className: "flex items-center gap-3 mb-4", children: [_jsx(Rocket, { className: "w-5 h-5 stroke-[2.5]" }), _jsx("h2", { className: "font-black uppercase text-xl tracking-tight", children: "Your Launched Pool" }), _jsx("span", { className: "bg-[#DFFF00] text-black text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black", children: "LIVE" })] }), _jsxs("div", { onClick: handleViewMyPool, className: "bg-white dark:bg-[#111] border-4 border-black dark:border-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] p-6 cursor-pointer hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[10px_10px_0px_0px_rgba(255,255,255,1)] transition-all group", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center gap-6", children: [_jsxs("div", { className: "flex items-center gap-4 min-w-0", children: [_jsx("div", { className: "w-16 h-16 border-4 border-black dark:border-white bg-[#DFFF00] flex items-center justify-center shrink-0", children: _jsx("span", { className: "font-black text-xl text-black", children: myTokenInfo?.symbol?.slice(0, 3) ?? '???' }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("h3", { className: "font-black uppercase text-lg truncate", children: myTokenInfo?.name ?? 'Unknown Token' }), _jsx("p", { className: "font-mono text-xs text-gray-500 dark:text-gray-400 truncate", children: myPositionData.tokenAddr })] })] }), _jsxs("div", { className: "flex flex-wrap gap-4 md:ml-auto", children: [_jsxs("div", { className: "border-4 border-black dark:border-white px-4 py-2 min-w-[120px]", children: [_jsx("p", { className: "text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400", children: "LP Locked" }), _jsx("p", { className: "font-black text-lg font-mono", children: formatLp(myPositionData.lpAmount) })] }), _jsxs("div", { className: "border-4 border-black dark:border-white px-4 py-2 min-w-[120px]", children: [_jsx("p", { className: "text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400", children: "Unlocked" }), _jsxs("p", { className: "font-black text-lg font-mono", children: [myPositionData.unlockedPct, "%"] })] }), _jsxs("div", { className: `border-4 border-black dark:border-white px-4 py-2 min-w-[100px] ${myRiskInfo.bg} ${myRiskInfo.text}`, children: [_jsx("p", { className: "text-[10px] font-bold uppercase opacity-70", children: "Risk" }), _jsxs("p", { className: "font-black text-lg font-mono", children: [myRiskScore, "/100"] })] })] }), _jsx("div", { className: "hidden md:flex items-center", children: _jsx(ChevronRight, { className: "w-8 h-8 stroke-[3] group-hover:translate-x-2 transition-transform" }) })] }), _jsxs("div", { className: "mt-4", children: [_jsx("div", { className: "h-4 border-4 border-black dark:border-white bg-gray-200 dark:bg-[#1A1A1A] overflow-hidden", children: _jsx("div", { className: "h-full bg-[#DFFF00] transition-all duration-700", style: { width: `${myPositionData.unlockedPct}%` } }) }), _jsxs("div", { className: "flex justify-between mt-1", children: [_jsxs("span", { className: "font-mono text-[10px] text-gray-400", children: ["Registered ", new Date(Number(myPositionData.registeredAt) * 1000).toLocaleDateString()] }), _jsxs("span", { className: "font-mono text-[10px] text-gray-400", children: [myPositionData.unlockedPct, "% vested"] })] })] })] })] })), isConnected && myPosLoading && (_jsxs("div", { className: "mb-10 border-4 border-black dark:border-white p-8 text-center", children: [_jsx("div", { className: "inline-block w-8 h-8 border-4 border-black dark:border-white border-t-[#DFFF00] rounded-full animate-spin mb-3" }), _jsx("p", { className: "font-mono text-gray-500 dark:text-gray-400 text-sm", children: "Loading your pool data..." })] })), isConnected && !myPosLoading && !hasMyPool && !viewAddress && (_jsxs("div", { className: "mb-10 border-4 border-dashed border-gray-300 dark:border-gray-600 p-8 text-center", children: [_jsx(Wallet, { className: "w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" }), _jsx("p", { className: "font-black uppercase text-gray-400 dark:text-gray-500 mb-1", children: "No Launched Pool Found" }), _jsxs("p", { className: "font-mono text-xs text-gray-400 dark:text-gray-500", children: ["Connected as ", _jsx("span", { className: "font-bold", children: formatAddress(connectedAddress) }), " \u2014 go to", ' ', _jsx("a", { href: "/launch", className: "underline text-[#DFFF00] hover:text-black dark:hover:text-white", children: "Launch" }), " to create one"] })] })), _jsxs("div", { className: "bg-white dark:bg-[#111] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-6 mb-8", children: [_jsx("label", { className: "block font-bold uppercase tracking-wider text-sm mb-2", children: "Search Any Address" }), _jsxs("div", { className: "flex gap-3", children: [_jsx("input", { className: `${inp} flex-1`, placeholder: "0x...", value: searchInput, onChange: (e) => setSearchInput(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleSearch() }), _jsxs("button", { onClick: handleSearch, className: "font-bold uppercase tracking-wide border-4 border-black px-8 py-3 bg-[#DFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:translate-x-0 active:shadow-none transition-all flex items-center gap-2", children: [_jsx(Search, { className: "w-5 h-5 stroke-[3]" }), "SEARCH"] })] }), isConnected && hasMyPool && !isViewingSelf && (_jsxs("button", { onClick: handleViewMyPool, className: "mt-3 font-mono text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 transition-colors", children: [_jsx(Eye, { className: "w-3 h-3" }), " or view your own pool (", formatAddress(connectedAddress), ")"] }))] }), posLoading && viewAddress && (_jsxs("div", { className: "border-4 border-black dark:border-white p-12 text-center mb-8", children: [_jsx("div", { className: "inline-block w-8 h-8 border-4 border-black dark:border-white border-t-[#DFFF00] rounded-full animate-spin mb-4" }), _jsx("p", { className: "font-mono text-gray-600 dark:text-gray-400", children: "Reading on-chain position..." })] })), posError && (_jsx("div", { className: "border-4 border-[#FF3333] p-6 mb-8 dark:bg-[#111]", children: _jsx("p", { className: "text-[#FF3333] font-mono font-bold", children: posError }) })), positionData && !posLoading && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { className: "border-4 border-black dark:border-white p-4 bg-[#DFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]", children: [_jsx("p", { className: "text-[10px] uppercase font-bold opacity-70", children: "Risk Score" }), _jsx("p", { className: "font-black text-3xl leading-none mt-1", children: displayRiskScore }), _jsxs("p", { className: "font-mono text-[10px] mt-1", children: ["Tier: ", riskTierLabel] })] }), _jsxs("div", { className: "border-4 border-black dark:border-white p-4 bg-white dark:bg-[#111] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]", children: [_jsx("p", { className: "text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400", children: "Unlocked" }), _jsxs("p", { className: "font-black text-3xl leading-none mt-1", children: [positionData.unlockedPct, "%"] }), _jsx("p", { className: "font-mono text-[10px] mt-1 text-gray-500 dark:text-gray-400", children: "Current vesting released" })] }), _jsxs("div", { className: "border-4 border-black dark:border-white p-4 bg-white dark:bg-[#111] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]", children: [_jsx("p", { className: "text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400", children: "LP Locked" }), _jsx("p", { className: "font-black text-2xl leading-none mt-1 font-mono", children: formatLp(positionData.lpAmount) }), _jsx("p", { className: "font-mono text-[10px] mt-1 text-gray-500 dark:text-gray-400", children: "Raw on-chain LP amount" })] }), _jsxs("div", { className: `border-4 border-black dark:border-white p-4 ${positionData.lockExtendedUntil > 0n ? 'bg-[#FF3333] text-white' : 'bg-black text-[#DFFF00] dark:bg-white dark:text-black'} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`, children: [_jsx("p", { className: "text-[10px] uppercase font-bold opacity-70", children: "Pool Status" }), _jsx("p", { className: "font-black text-base leading-tight mt-1", children: poolStatus }), _jsx("p", { className: "font-mono text-[10px] mt-1 opacity-80", children: lockUntilText })] })] }), isViewingSelf && (_jsxs("div", { className: "flex items-center gap-2 px-4 py-2 bg-[#DFFF00] border-4 border-black", children: [_jsx(Rocket, { className: "w-4 h-4 stroke-[2.5]" }), _jsx("span", { className: "font-black uppercase text-sm text-black", children: "Viewing Your Pool" }), _jsx("span", { className: "font-mono text-xs text-black/60 ml-auto", children: formatAddress(connectedAddress) })] })), _jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-12 gap-6", children: [_jsxs("div", { className: "xl:col-span-3 space-y-6", children: [_jsxs("div", { className: "bg-white dark:bg-[#111] border-4 border-black dark:border-white p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]", children: [_jsx("h3", { className: "font-black uppercase text-sm mb-4 border-b-4 border-black dark:border-white pb-2", children: "Project" }), _jsxs("div", { className: "space-y-3 font-mono text-xs", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-500 dark:text-gray-400", children: "Team" }), _jsx("p", { className: "font-black", children: formatAddress(positionData.team) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-500 dark:text-gray-400", children: "Token" }), _jsxs("p", { className: "font-black", children: [tokenInfo?.name ?? 'Unknown', " (", tokenInfo?.symbol ?? '—', ")"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-500 dark:text-gray-400", children: "Registered" }), _jsx("p", { className: "font-black", children: positionData.registeredAt > 0n ? new Date(Number(positionData.registeredAt) * 1000).toLocaleDateString() : '—' })] })] })] }), _jsxs("div", { className: "bg-white dark:bg-[#111] border-4 border-black dark:border-white p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]", children: [_jsx("h3", { className: "font-black uppercase text-sm mb-4 border-b-4 border-black dark:border-white pb-2", children: "Risk Gauge" }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: `w-24 h-24 border-4 border-black dark:border-white ${riskInfo.bg} ${riskInfo.text} flex flex-col items-center justify-center`, children: [_jsx("span", { className: "font-black text-3xl leading-none", children: displayRiskScore }), _jsx("span", { className: "font-bold text-[10px]", children: "/100" })] }), _jsxs("div", { children: [_jsx("p", { className: "font-black uppercase text-sm", children: riskInfo.label }), _jsxs("p", { className: "font-mono text-xs text-gray-500 dark:text-gray-400", children: ["Dispatch tier: ", riskTierLabel] })] })] })] })] }), _jsxs("div", { className: "xl:col-span-6 space-y-6", children: [_jsxs("div", { className: "bg-white dark:bg-[#111] border-4 border-black dark:border-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]", children: [_jsxs("h3", { className: "font-black uppercase text-lg mb-4 border-b-4 border-black dark:border-white pb-2 flex items-center gap-2", children: [_jsx(BarChart3, { className: "w-5 h-5" }), " Vesting Progress"] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-xs font-mono mb-1", children: [_jsx("span", { children: "Unlocked" }), _jsxs("span", { className: "font-black", children: [positionData.unlockedPct, "%"] })] }), _jsx("div", { className: "h-7 border-4 border-black dark:border-white bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden", children: _jsx("div", { className: "h-full bg-[#DFFF00]", style: { width: `${positionData.unlockedPct}%` } }) })] }), _jsx("div", { className: "grid grid-cols-3 gap-3", children: [30, 70, 100].map((m, i) => {
                                                                const done = positionData.unlockedPct >= m;
                                                                return (_jsxs("div", { className: `border-4 border-black dark:border-white p-3 ${done ? 'bg-[#DFFF00] text-black' : 'bg-white dark:bg-[#0A0A0A]'}`, children: [_jsxs("p", { className: "text-[10px] font-bold uppercase", children: ["Milestone ", i + 1] }), _jsxs("p", { className: "font-black text-lg", children: [m, "%"] }), _jsx("p", { className: "font-mono text-[10px]", children: done ? 'Completed' : 'Pending' })] }, m));
                                                            }) })] })] }), _jsxs("div", { className: "bg-white dark:bg-[#111] border-4 border-black dark:border-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]", children: [_jsxs("h3", { className: "font-black uppercase text-lg mb-4 border-b-4 border-black dark:border-white pb-2 flex items-center gap-2", children: [_jsx(Activity, { className: "w-5 h-5" }), " Signal Watchlist"] }), _jsxs("p", { className: "font-mono text-[11px] mb-3 text-gray-500 dark:text-gray-400", children: ["Occurred: ", _jsx("span", { className: "font-black text-black dark:text-white", children: occurredSignalText })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full font-mono text-xs border-separate border-spacing-y-2", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "text-left uppercase text-[10px] text-gray-500 dark:text-gray-400", children: "Signal" }), _jsx("th", { className: "text-left uppercase text-[10px] text-gray-500 dark:text-gray-400", children: "Condition" }), _jsx("th", { className: "text-left uppercase text-[10px] text-gray-500 dark:text-gray-400", children: "Status" })] }) }), _jsx("tbody", { children: signals.map((sig) => {
                                                                    const triggered = occurredSignalSet.has(sig.id);
                                                                    const triggerMeta = triggerMetaBySignal[sig.id];
                                                                    return (_jsxs("tr", { className: "bg-gray-50 dark:bg-[#0A0A0A]", children: [_jsx("td", { className: "border-2 border-black dark:border-white px-3 py-2 font-black", children: sig.id }), _jsx("td", { className: "border-2 border-black dark:border-white px-3 py-2", children: sig.label }), _jsx("td", { className: "border-2 border-black dark:border-white px-3 py-2", children: _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: `px-2 py-1 border-2 border-black dark:border-white font-bold uppercase text-[10px] ${triggered ? 'bg-[#FF3333] text-white' : 'bg-white dark:bg-[#111]'}`, children: triggered ? 'Triggered' : 'Monitoring' }), triggered && lastTxBySignal[sig.id] && (_jsxs("a", { href: `${triggerMeta?.source === 'rsc' ? LASNA_EXPLORER : UNICHAIN_EXPLORER}/tx/${lastTxBySignal[sig.id]}`, target: "_blank", rel: "noopener noreferrer", className: "text-[10px] inline-flex items-center gap-1 hover:text-[#DFFF00]", children: ["tx ", _jsx(ExternalLink, { className: "w-3 h-3" })] }))] }) })] }, sig.id));
                                                                }) })] }) })] })] }), _jsxs("div", { className: "xl:col-span-3 space-y-6", children: [_jsxs("div", { className: "bg-white dark:bg-[#111] border-4 border-black dark:border-white p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]", children: [_jsxs("h3", { className: "font-black uppercase text-sm mb-4 border-b-4 border-black dark:border-white pb-2 flex items-center gap-2", children: [_jsx(Clock, { className: "w-4 h-4" }), " Quick Facts"] }), _jsxs("div", { className: "space-y-3 font-mono text-xs", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-500 dark:text-gray-400", children: "Risk Tier" }), _jsx("span", { className: "font-black", children: riskTierLabel })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-500 dark:text-gray-400", children: "Unlock %" }), _jsxs("span", { className: "font-black", children: [positionData.unlockedPct, "%"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-500 dark:text-gray-400", children: "Lock State" }), _jsx("span", { className: "font-black", children: positionData.lockExtendedUntil > 0n ? 'Extended' : 'Normal' })] })] })] }), _jsxs("div", { className: "bg-white dark:bg-[#111] border-4 border-black dark:border-white p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]", children: [_jsxs("h3", { className: "font-black uppercase text-sm mb-4 border-b-4 border-black dark:border-white pb-2 flex items-center gap-2", children: [_jsx(Clock, { className: "w-4 h-4" }), " Live Event Feed"] }), events.length === 0 ? (_jsx("p", { className: "font-mono text-xs text-gray-500 dark:text-gray-400", children: "No events yet. Waiting for chain activity." })) : (_jsx("div", { className: "space-y-2 max-h-[420px] overflow-y-auto pr-1", children: events.map((evt) => (_jsxs("div", { className: "border-2 border-black dark:border-white p-2 bg-gray-50 dark:bg-[#0A0A0A]", children: [_jsx("p", { className: "font-black text-[10px] uppercase", children: evt.eventType }), _jsx("p", { className: "font-mono text-[10px] text-gray-600 dark:text-gray-400 truncate", children: evt.description }), _jsxs("div", { className: "flex items-center justify-between mt-1", children: [_jsx("span", { className: "font-mono text-[10px] text-gray-500 dark:text-gray-400", children: new Date(evt.timestamp).toLocaleTimeString() }), evt.txHash && (_jsxs("a", { href: `${UNICHAIN_EXPLORER}/tx/${evt.txHash}`, target: "_blank", rel: "noopener noreferrer", className: "text-[10px] hover:text-[#DFFF00] inline-flex items-center gap-1", children: ["tx ", _jsx(ExternalLink, { className: "w-3 h-3" })] }))] })] }, evt.id))) }))] })] })] })] })), !isConnected && !viewAddress && !posLoading && (_jsxs("div", { className: "border-4 border-dashed border-gray-300 dark:border-gray-600 p-16 text-center", children: [_jsx(Wallet, { className: "w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600 stroke-[1.5]" }), _jsx("p", { className: "font-black uppercase text-xl text-gray-300 dark:text-gray-600 mb-2", children: "Connect Your Wallet" }), _jsx("p", { className: "font-mono text-gray-400 text-sm", children: "Connect your wallet to see your launched pools, or search any address above" })] }))] }) }));
}

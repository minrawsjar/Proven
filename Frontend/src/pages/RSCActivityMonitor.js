import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { createPublicClient, http, keccak256, toHex, decodeAbiParameters, formatUnits } from 'viem';
import { useRSCMonitorStore } from '../store/rscMonitorStore';
import { VESTING_HOOK_ADDRESS, RISK_GUARD_RSC_ADDRESS, UNICHAIN_RPC, LASNA_RPC, UNICHAIN_EXPLORER, LASNA_EXPLORER, } from '../config/constants';
import { vestingHookAbi, riskGuardRSCAbi } from '../config/contracts';
import { formatAddress } from '../utils/format';
import { Radio, Zap, ArrowRight, Pause, Play, ExternalLink, Layers, AlertTriangle, GitBranch, Wifi, WifiOff } from 'lucide-react';
/* ── Viem clients for direct polling ── */
const unichainClient = createPublicClient({ transport: http(UNICHAIN_RPC) });
const lasnaClient = createPublicClient({ transport: http(LASNA_RPC) });
const MONITOR_LOOKBACK_BLOCKS = 5000000n;
/* ── Build a proper topic0 → event name map using keccak256 of event signatures ── */
const buildTopicMap = () => {
    const map = {};
    const allAbi = [...vestingHookAbi, ...riskGuardRSCAbi];
    for (const item of allAbi) {
        if (item.type !== 'event')
            continue;
        const evt = item;
        const sig = `${evt.name}(${evt.inputs.map((i) => i.type).join(',')})`;
        const hash = keccak256(toHex(sig));
        map[hash] = evt.name;
    }
    return map;
};
const eventNameMap = buildTopicMap();
const guessEventName = (log) => {
    const topic0 = log.topics?.[0];
    if (!topic0)
        return 'Unknown';
    return eventNameMap[topic0] ?? `Event(${topic0.slice(0, 10)}...)`;
};
const topicToAddress = (topic) => {
    if (!topic || topic.length !== 66)
        return null;
    return `0x${topic.slice(26)}`;
};
const extractRelatedTeam = (eventName, log) => {
    switch (eventName) {
        case 'PositionRegistered':
        case 'PositionLocked':
        case 'MilestoneUnlocked':
        case 'LockExtended':
        case 'WithdrawalsPaused':
        case 'UnlockAuthorized':
        case 'RiskScoreUpdated':
        case 'RiskElevated':
        case 'SignalTriggered':
        case 'ComboBonus':
            return topicToAddress(log.topics?.[1]);
        default:
            return null;
    }
};
/** Decode PoolMetricsUpdated(bytes32, uint256 tvl, uint256 cumulativeVol, uint256 uniqueUsers) */
const decodePoolMetrics = (data) => {
    if (!data || data === '0x')
        return '';
    try {
        const decoded = decodeAbiParameters([{ name: 'tvl', type: 'uint256' }, { name: 'vol', type: 'uint256' }, { name: 'users', type: 'uint256' }], data);
        // Default to USDC-style 6 decimals for pool metrics (TVL/Volume)
        const tvl = Number(formatUnits(decoded[0], 6)).toFixed(2);
        const vol = Number(formatUnits(decoded[1], 6)).toFixed(2);
        return `TVL: ${tvl} · Vol: ${vol} · Users: ${decoded[2].toString()}`;
    }
    catch {
        return '';
    }
};
export function RSCActivityMonitor() {
    const { incomingEvents, rscResponses, stats, addIncomingEvent, addRSCResponse, setStats, setIncomingEvents, setRSCResponses, } = useRSCMonitorStore();
    const [projectFilter, setProjectFilter] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [relayStatus, setRelayStatus] = useState('checking');
    const leftRef = useRef(null);
    const rightRef = useRef(null);
    /* ── Direct polling for Unichain Hook events ── */
    useEffect(() => {
        if (isPaused)
            return;
        let fromBlock = 0n;
        const poll = async () => {
            try {
                const currentBlock = await unichainClient.getBlockNumber();
                if (fromBlock === 0n)
                    fromBlock = currentBlock > MONITOR_LOOKBACK_BLOCKS ? currentBlock - MONITOR_LOOKBACK_BLOCKS : 0n;
                const logs = await unichainClient.getLogs({
                    address: VESTING_HOOK_ADDRESS,
                    fromBlock,
                    toBlock: currentBlock,
                });
                fromBlock = currentBlock + 1n;
                for (const log of logs) {
                    const evtName = guessEventName(log);
                    const metricsInfo = evtName === 'PoolMetricsUpdated' ? decodePoolMetrics(log.data) : '';
                    const relatedTeam = extractRelatedTeam(evtName, log);
                    addIncomingEvent({
                        id: `uni-${log.transactionHash}-${log.logIndex}`,
                        timestamp: Date.now(),
                        chain: 'UNICHAIN_SEPOLIA',
                        blockNumber: Number(log.blockNumber),
                        eventName: evtName,
                        fromAddress: log.address,
                        value: [
                            relatedTeam ? `team:${relatedTeam}` : '',
                            metricsInfo || (log.data?.slice(0, 22) ?? ''),
                        ].filter(Boolean).join(' · '),
                        txHash: log.transactionHash ?? '0x',
                    });
                }
            }
            catch (err) {
                console.error('Unichain polling error:', err);
            }
        };
        poll();
        const interval = setInterval(poll, 12000);
        return () => clearInterval(interval);
    }, [isPaused, addIncomingEvent]);
    /* ── Direct polling for Lasna RSC events ── */
    useEffect(() => {
        if (isPaused)
            return;
        let fromBlock = 0n;
        const poll = async () => {
            try {
                const currentBlock = await lasnaClient.getBlockNumber();
                if (fromBlock === 0n)
                    fromBlock = currentBlock > MONITOR_LOOKBACK_BLOCKS ? currentBlock - MONITOR_LOOKBACK_BLOCKS : 0n;
                const logs = await lasnaClient.getLogs({
                    address: RISK_GUARD_RSC_ADDRESS,
                    fromBlock,
                    toBlock: currentBlock,
                });
                fromBlock = currentBlock + 1n;
                let reactCalls = 0;
                let callbacks = 0;
                let unlocks = 0;
                let extensions = 0;
                for (const log of logs) {
                    reactCalls++;
                    const evtName = guessEventName(log);
                    const relatedTeam = extractRelatedTeam(evtName, log);
                    if (evtName.toLowerCase().includes('callback') || evtName.toLowerCase().includes('dispatch'))
                        callbacks++;
                    if (evtName.toLowerCase().includes('unlock'))
                        unlocks++;
                    if (evtName.toLowerCase().includes('extend') || evtName.toLowerCase().includes('lock'))
                        extensions++;
                    addRSCResponse({
                        id: `lasna-${log.transactionHash}-${log.logIndex}`,
                        timestamp: Date.now(),
                        signalId: 'S?',
                        conditionChecked: relatedTeam ? `${evtName} · team:${relatedTeam}` : evtName,
                        result: 'TRIGGERED',
                        scoreChange: 0,
                        newCompositeScore: 0,
                        actionTaken: evtName,
                        callbackTxHash: log.transactionHash ?? null,
                        projectAddress: relatedTeam ?? log.address,
                    });
                }
                setStats({
                    totalReactCalls: stats.totalReactCalls + reactCalls,
                    totalCallbacksDispatched: stats.totalCallbacksDispatched + callbacks,
                    totalMilestonesUnlocked: stats.totalMilestonesUnlocked + unlocks,
                    totalLockExtensionsApplied: stats.totalLockExtensionsApplied + extensions,
                });
            }
            catch (err) {
                console.error('Lasna polling error:', err);
            }
        };
        poll();
        const interval = setInterval(poll, 15000);
        return () => clearInterval(interval);
    }, [isPaused, addRSCResponse, setStats]);
    /* ── Poll RSC contract stats directly ── */
    useEffect(() => {
        if (isPaused)
            return;
        const pollStats = async () => {
            try {
                const [reactCalls, callbacks] = await Promise.all([
                    lasnaClient.readContract({
                        address: RISK_GUARD_RSC_ADDRESS,
                        abi: riskGuardRSCAbi,
                        functionName: 'totalReactCalls',
                    }),
                    lasnaClient.readContract({
                        address: RISK_GUARD_RSC_ADDRESS,
                        abi: riskGuardRSCAbi,
                        functionName: 'totalCallbacks',
                    }),
                ]);
                setStats({
                    totalReactCalls: Number(reactCalls),
                    totalCallbacksDispatched: Number(callbacks),
                    totalMilestonesUnlocked: stats.totalMilestonesUnlocked,
                    totalLockExtensionsApplied: stats.totalLockExtensionsApplied,
                });
                setRelayStatus(Number(reactCalls) > 0 ? 'active' : 'waiting');
            }
            catch (err) {
                console.error('RSC stats polling error:', err);
            }
        };
        pollStats();
        const interval = setInterval(pollStats, 10000);
        return () => clearInterval(interval);
    }, [isPaused, setStats]);
    /* ── Auto-scroll ── */
    useEffect(() => {
        if (!autoScroll)
            return;
        leftRef.current?.scrollTo({ top: leftRef.current.scrollHeight, behavior: 'smooth' });
        rightRef.current?.scrollTo({ top: rightRef.current.scrollHeight, behavior: 'smooth' });
    }, [incomingEvents.length, rscResponses.length, autoScroll]);
    const statCards = [
        { label: 'React() Calls', value: stats.totalReactCalls, icon: Zap },
        { label: 'Callbacks Sent', value: stats.totalCallbacksDispatched, icon: ArrowRight },
        { label: 'Milestones Unlocked', value: stats.totalMilestonesUnlocked, icon: Layers },
        { label: 'Lock Extensions', value: stats.totalLockExtensionsApplied, icon: AlertTriangle },
    ];
    return (_jsx("div", { className: "min-h-screen bg-white dark:bg-[#0A0A0A] text-black dark:text-white", children: _jsxs("div", { className: "max-w-7xl mx-auto px-6 py-12", children: [_jsxs("div", { className: "flex items-center justify-between mb-10", children: [_jsxs("div", { children: [_jsx("span", { className: "inline-block bg-black text-[#DFFF00] font-black uppercase text-xs px-4 py-1 border-2 border-black mb-3", children: "LIVE MONITOR" }), _jsx("h1", { className: "text-4xl md:text-5xl font-black uppercase tracking-tighter", children: "RSC Activity" }), _jsx("p", { className: "font-mono text-gray-600 dark:text-gray-400 mt-1", children: "Dual-chain event stream \u2014 Unichain Sepolia \u2194 Lasna" })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: `flex items-center gap-2 px-4 py-2 border-4 border-black dark:border-white font-bold uppercase text-xs ${relayStatus === 'active' ? 'bg-green-400 text-black' : relayStatus === 'waiting' ? 'bg-yellow-300 text-black' : 'bg-gray-200 dark:bg-[#1A1A1A]'}`, children: [relayStatus === 'active' ? _jsx(Wifi, { className: "w-3 h-3" }) : _jsx(WifiOff, { className: "w-3 h-3" }), "RSC RELAY: ", relayStatus === 'active' ? 'ACTIVE' : relayStatus === 'waiting' ? 'WAITING' : 'CHECKING'] }), _jsxs("div", { className: `flex items-center gap-2 px-4 py-2 border-4 border-black dark:border-white font-bold uppercase text-sm ${isPaused ? 'bg-gray-200 dark:bg-[#1A1A1A]' : 'bg-[#DFFF00] text-black'}`, children: [_jsx("span", { className: `w-3 h-3 border-2 border-black dark:border-white ${isPaused ? 'bg-gray-400' : 'bg-[#FF3333] animate-pulse'}` }), isPaused ? 'PAUSED' : 'LIVE'] })] })] }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 mb-8", children: statCards.map((s) => (_jsxs("div", { className: "bg-white dark:bg-[#111] border-4 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] p-5 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] transition-all", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(s.icon, { className: "w-4 h-4 stroke-[2.5]" }), _jsx("span", { className: "text-xs font-bold uppercase text-gray-500 dark:text-gray-400", children: s.label })] }), _jsx("span", { className: "font-black text-3xl font-mono", children: s.value })] }, s.label))) }), _jsxs("div", { className: "flex items-center gap-3 mb-6", children: [_jsx("input", { className: "flex-1 bg-white dark:bg-[#111] border-4 border-black dark:border-white px-4 py-3 font-mono text-sm text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-shadow", placeholder: "Filter by project address 0x...", value: projectFilter, onChange: (e) => setProjectFilter(e.target.value) }), _jsxs("button", { onClick: () => setIsPaused(!isPaused), className: `border-4 border-black dark:border-white px-5 py-3 font-bold uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] active:translate-y-0 active:shadow-none transition-all flex items-center gap-2 ${isPaused ? 'bg-[#DFFF00] text-black' : 'bg-white dark:bg-[#111]'}`, children: [isPaused ? _jsx(Play, { className: "w-4 h-4" }) : _jsx(Pause, { className: "w-4 h-4" }), isPaused ? 'RESUME' : 'PAUSE'] }), _jsxs("button", { onClick: () => setAutoScroll(!autoScroll), className: `border-4 border-black dark:border-white px-5 py-3 font-bold uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] active:translate-y-0 active:shadow-none transition-all ${autoScroll ? 'bg-black dark:bg-white text-[#DFFF00] dark:text-black' : 'bg-white dark:bg-[#111]'}`, children: ["AUTO-SCROLL ", autoScroll ? 'ON' : 'OFF'] }), _jsx("button", { onClick: () => { setIncomingEvents([]); setRSCResponses([]); }, className: "border-4 border-[#FF3333] px-5 py-3 font-bold uppercase text-sm bg-white dark:bg-[#111] text-[#FF3333] shadow-[4px_4px_0px_0px_rgba(255,51,51,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(255,51,51,1)] active:translate-y-0 active:shadow-none transition-all", children: "CLEAR" })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { className: "border-4 border-black dark:border-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]", children: [_jsxs("div", { className: "bg-[#DFFF00] border-b-4 border-black p-4 flex items-center gap-3", children: [_jsx(Radio, { className: "w-5 h-5 stroke-[2.5]" }), _jsxs("div", { children: [_jsx("h3", { className: "font-black uppercase text-sm text-black", children: "Unichain Sepolia" }), _jsx("p", { className: "font-mono text-[10px] text-gray-700", children: "VestingHook \u00B7 Chain 1301" })] }), _jsxs("span", { className: "ml-auto bg-black text-[#DFFF00] font-mono text-xs px-3 py-1 font-bold", children: [incomingEvents.length, " EVENTS"] })] }), _jsx("div", { ref: leftRef, className: "h-96 overflow-y-auto bg-white dark:bg-[#0A0A0A]", children: incomingEvents.length === 0 ? (_jsx("div", { className: "h-full flex items-center justify-center", children: _jsx("p", { className: "font-mono text-gray-400 text-sm", children: "Waiting for hook events..." }) })) : (_jsx("div", { className: "divide-y-2 divide-black dark:divide-white", children: incomingEvents.filter((e) => {
                                                if (!projectFilter)
                                                    return true;
                                                const q = projectFilter.toLowerCase();
                                                return (e.fromAddress.toLowerCase().includes(q) ||
                                                    e.eventName.toLowerCase().includes(q) ||
                                                    e.value.toLowerCase().includes(q) ||
                                                    e.txHash.toLowerCase().includes(q));
                                            }).map((evt) => (_jsxs("div", { className: "p-3 hover:bg-gray-50 dark:hover:bg-[#111] transition font-mono text-xs", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { className: `px-2 py-0.5 border-2 border-black dark:border-white font-black text-[10px] ${evt.eventName === 'PoolMetricsUpdated' ? 'bg-[#DFFF00] text-black' : evt.eventName === 'CrashDetected' ? 'bg-[#FF3333] text-white' : evt.eventName === 'PositionRegistered' ? 'bg-blue-400 text-black' : 'bg-gray-200 dark:bg-[#1A1A1A]'}`, children: evt.eventName }), _jsxs("span", { className: "text-gray-400", children: ["Block #", evt.blockNumber] })] }), evt.value && (_jsx("div", { className: "text-[10px] text-gray-500 dark:text-gray-400 mb-1", children: evt.value })), _jsxs("div", { className: "flex items-center gap-2 text-gray-500 dark:text-gray-400", children: [_jsx("span", { children: formatAddress(evt.fromAddress) }), evt.txHash && evt.txHash !== '0x' && (_jsxs("a", { href: `${UNICHAIN_EXPLORER}/tx/${evt.txHash}`, target: "_blank", rel: "noopener noreferrer", className: "hover:text-black dark:hover:text-white inline-flex items-center gap-1", children: [evt.txHash.slice(0, 10), "... ", _jsx(ExternalLink, { className: "w-3 h-3" })] }))] })] }, evt.id))) })) })] }), _jsxs("div", { className: "border-4 border-black dark:border-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]", children: [_jsxs("div", { className: "bg-black border-b-4 border-black dark:border-white p-4 flex items-center gap-3", children: [_jsx(GitBranch, { className: "w-5 h-5 stroke-[2.5] text-[#DFFF00]" }), _jsxs("div", { children: [_jsx("h3", { className: "font-black uppercase text-sm text-[#DFFF00]", children: "Lasna RSC" }), _jsx("p", { className: "font-mono text-[10px] text-gray-400", children: "TimeLockRSC \u00B7 Chain 5318007" })] }), _jsxs("span", { className: "ml-auto bg-[#DFFF00] text-black font-mono text-xs px-3 py-1 font-bold", children: [rscResponses.length, " RESPONSES"] })] }), _jsx("div", { ref: rightRef, className: "h-96 overflow-y-auto bg-white dark:bg-[#0A0A0A]", children: rscResponses.length === 0 ? (_jsx("div", { className: "h-full flex items-center justify-center", children: _jsx("p", { className: "font-mono text-gray-400 text-sm", children: "Waiting for RSC responses..." }) })) : (_jsx("div", { className: "divide-y-2 divide-black dark:divide-white", children: rscResponses.filter((r) => {
                                                if (!projectFilter)
                                                    return true;
                                                const q = projectFilter.toLowerCase();
                                                return (r.projectAddress.toLowerCase().includes(q) ||
                                                    r.conditionChecked.toLowerCase().includes(q) ||
                                                    r.actionTaken.toLowerCase().includes(q) ||
                                                    (r.callbackTxHash ?? '').toLowerCase().includes(q));
                                            }).map((res) => (_jsxs("div", { className: "p-3 hover:bg-gray-50 dark:hover:bg-[#111] transition font-mono text-xs", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { className: `px-2 py-0.5 border-2 border-black dark:border-white font-black text-[10px] ${res.result === 'TRIGGERED' ? 'bg-[#FF3333] text-white' : 'bg-gray-200 dark:bg-[#1A1A1A]'}`, children: res.result }), _jsx("span", { className: "font-bold", children: res.conditionChecked })] }), _jsxs("div", { className: "flex items-center gap-2 text-gray-500 dark:text-gray-400", children: [_jsxs("span", { children: ["Signal: ", res.signalId] }), res.actionTaken && _jsxs("span", { children: ["\u2192 ", res.actionTaken] }), res.callbackTxHash && (_jsxs("a", { href: `${LASNA_EXPLORER}/tx/${res.callbackTxHash}`, target: "_blank", rel: "noopener noreferrer", className: "hover:text-black dark:hover:text-white inline-flex items-center gap-1 ml-auto", children: ["TX ", _jsx(ExternalLink, { className: "w-3 h-3" })] }))] }), res.scoreChange !== 0 && (_jsxs("div", { className: "mt-1 text-gray-400", children: ["Score: ", res.newCompositeScore, " (", res.scoreChange > 0 ? '+' : '', res.scoreChange, ")"] }))] }, res.id))) })) })] })] }), _jsxs("div", { className: "mt-8 p-5 border-4 border-black dark:border-white bg-gray-100 dark:bg-[#111] font-mono text-xs text-gray-600 dark:text-gray-400", children: [_jsx("span", { className: "font-black text-black dark:text-white font-sans uppercase", children: "How it works:" }), " VestingHook events on Unichain (left) are picked up by the Reactive Network. The RSC evaluates 5 signals, computes a composite risk score, and dispatches callbacks (right) \u2014 either unlocking milestones or extending timelocks."] }), relayStatus === 'waiting' && (_jsxs("div", { className: "mt-4 p-5 border-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 font-mono text-xs text-yellow-800 dark:text-yellow-300", children: [_jsx("span", { className: "font-black font-sans uppercase", children: "\u23F3 Relay Status:" }), " The Reactive Network relay has not yet delivered events to the RSC contract on Lasna (totalReactCalls = 0). Events are confirmed on Unichain \u2014 the relay will process them when the testnet infrastructure catches up. RSC contract: ", formatAddress(TIMELOCK_RSC_ADDRESS)] }))] }) }));
}

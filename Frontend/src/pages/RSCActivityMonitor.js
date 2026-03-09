import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { createPublicClient, http } from 'viem';
import { useRSCMonitorStore } from '../store/rscMonitorStore';
import { timeLockRSCAbi, vestingHookAbi } from '../config/contracts';
import { lasnaTestnet, unichainSepolia } from '../config/wagmi';
import { TIMELOCK_RSC_ADDRESS, VESTING_HOOK_ADDRESS, LASNA_RPC, UNICHAIN_RPC, LASNA_EXPLORER, UNICHAIN_EXPLORER, } from '../config/constants';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Zap, Radio, Target, LockKeyhole, Search, Link2, BrainCircuit, BarChart3, Mail, RefreshCw, CheckCircle2, Lightbulb } from 'lucide-react';
/* ── Viem clients for direct polling ── */
const lasnaClient = createPublicClient({
    chain: lasnaTestnet,
    transport: http(LASNA_RPC),
});
const unichainClient = createPublicClient({
    chain: unichainSepolia,
    transport: http(UNICHAIN_RPC),
});
/* ── Topic-0 helpers (keccak256 of event sigs) ── */
// We'll match by event name via the ABI
const RSC_EVENT_NAMES = new Set([
    'TeamIndexed', 'UnlockAuthorized', 'SignalTriggered', 'RiskScoreUpdated',
    'RiskElevated', 'ComboBonus', 'LPLocked', 'Callback',
]);
const HOOK_EVENT_NAMES = new Set([
    'PositionRegistered', 'PositionLocked', 'PoolMetricsUpdated', 'CrashDetected',
    'MilestoneUnlocked', 'LockExtended', 'WithdrawalsPaused',
]);
export function RSCActivityMonitor() {
    const { incomingEvents, rscResponses, stats, addIncomingEvent, addRSCResponse, setStats, } = useRSCMonitorStore();
    const [selectedProject, setSelectedProject] = useState(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [isLive, setIsLive] = useState(false);
    const [lastLasnaBlock, setLastLasnaBlock] = useState(0n);
    const [lastUnichainBlock, setLastUnichainBlock] = useState(0n);
    /* ── Polling loop ── */
    useEffect(() => {
        // Check if contracts are deployed
        const rscDeployed = TIMELOCK_RSC_ADDRESS !== '0x0000000000000000000000000000000000000000';
        const hookDeployed = VESTING_HOOK_ADDRESS !== '0x0000000000000000000000000000000000000000';
        if (!rscDeployed && !hookDeployed)
            return;
        setIsLive(true);
        let lasnaFrom = lastLasnaBlock;
        let unichainFrom = lastUnichainBlock;
        let totalReact = 0;
        let totalCallbacks = 0;
        let totalUnlocks = 0;
        let totalExtensions = 0;
        const poll = async () => {
            try {
                /* ── Poll Lasna (RSC events) ── */
                if (rscDeployed) {
                    const currentBlock = await lasnaClient.getBlockNumber();
                    if (lasnaFrom === 0n)
                        lasnaFrom = currentBlock > 2000n ? currentBlock - 2000n : 0n;
                    const logs = await lasnaClient.getLogs({
                        address: TIMELOCK_RSC_ADDRESS,
                        fromBlock: lasnaFrom,
                        toBlock: currentBlock,
                    });
                    lasnaFrom = currentBlock + 1n;
                    setLastLasnaBlock(currentBlock + 1n);
                    for (const log of logs) {
                        totalReact++;
                        const eventName = guessEventName(log, timeLockRSCAbi);
                        if (eventName === 'Callback')
                            totalCallbacks++;
                        if (eventName === 'UnlockAuthorized')
                            totalUnlocks++;
                        // Add as RSC response
                        addRSCResponse({
                            id: `${log.transactionHash}-${log.logIndex}`,
                            timestamp: Date.now(),
                            signalId: eventName === 'SignalTriggered' ? `S${((log.data?.length ?? 0) > 2 ? parseInt(log.data.slice(2, 4), 16) + 1 : '?')}` : eventName,
                            conditionChecked: eventName,
                            result: eventName === 'Callback' || eventName === 'SignalTriggered' || eventName === 'RiskElevated' ? 'TRIGGERED' : 'BELOW_THRESHOLD',
                            scoreChange: 0,
                            newCompositeScore: 0,
                            actionTaken: eventName === 'Callback' ? 'Callback dispatched to Unichain Sepolia' :
                                eventName === 'UnlockAuthorized' ? 'Milestone unlock authorized' :
                                    eventName === 'RiskElevated' ? 'Risk score elevated' :
                                        eventName,
                            callbackTxHash: eventName === 'Callback' ? log.transactionHash ?? null : null,
                            projectAddress: log.topics[1] ? `0x${log.topics[1].slice(26)}` : TIMELOCK_RSC_ADDRESS,
                        });
                    }
                }
                /* ── Poll Unichain Sepolia (Hook events) ── */
                if (hookDeployed) {
                    const currentBlock = await unichainClient.getBlockNumber();
                    if (unichainFrom === 0n)
                        unichainFrom = currentBlock > 2000n ? currentBlock - 2000n : 0n;
                    const logs = await unichainClient.getLogs({
                        address: VESTING_HOOK_ADDRESS,
                        fromBlock: unichainFrom,
                        toBlock: currentBlock,
                    });
                    unichainFrom = currentBlock + 1n;
                    setLastUnichainBlock(currentBlock + 1n);
                    for (const log of logs) {
                        const eventName = guessEventName(log, vestingHookAbi);
                        if (eventName === 'LockExtended')
                            totalExtensions++;
                        addIncomingEvent({
                            id: `${log.transactionHash}-${log.logIndex}`,
                            timestamp: Date.now(),
                            chain: 'UNICHAIN_SEPOLIA',
                            blockNumber: Number(log.blockNumber),
                            eventName,
                            fromAddress: log.topics[1] ? `0x${log.topics[1].slice(26)}` : log.address,
                            value: log.data.length > 2 ? `${parseInt(log.data.slice(0, 66), 16)}` : '',
                            txHash: log.transactionHash ?? '0x',
                        });
                    }
                }
                setStats({
                    totalReactCalls: totalReact,
                    totalCallbacksDispatched: totalCallbacks,
                    totalMilestonesUnlocked: totalUnlocks,
                    totalLockExtensionsApplied: totalExtensions,
                });
            }
            catch (err) {
                console.error('Polling error:', err);
            }
        };
        // Initial poll + interval
        poll();
        const interval = setInterval(poll, 12000);
        return () => {
            clearInterval(interval);
            setIsLive(false);
        };
    }, [addIncomingEvent, addRSCResponse, setStats, lastLasnaBlock, lastUnichainBlock]);
    /* ── Auto-scroll ── */
    useEffect(() => {
        const leftColumn = document.getElementById('left-column');
        if (leftColumn && autoScroll)
            leftColumn.scrollTop = 0;
    }, [incomingEvents, autoScroll]);
    return (_jsxs("div", { className: "max-w-7xl mx-auto px-6 py-12", children: [_jsxs("div", { className: "mb-10 animate-fade-up opacity-0", children: [_jsx(Badge, { variant: "purple", pulse: true, className: "mb-4", children: "TECHNICAL VIEW" }), _jsx("h1", { className: "text-3xl md:text-4xl font-black text-white mb-2", children: "RSC Activity Monitor" }), _jsx("p", { className: "text-white/30", children: "Real-time Reactive Smart Contract event stream from Lasna Testnet" })] }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-up opacity-0", children: [
                    { label: 'React() Calls', value: stats.totalReactCalls, color: 'brand', Icon: Zap },
                    { label: 'Callbacks Dispatched', value: stats.totalCallbacksDispatched, color: 'brand', Icon: Radio },
                    { label: 'Milestones Unlocked', value: stats.totalMilestonesUnlocked, color: 'brand-light', Icon: Target },
                    { label: 'Lock Extensions', value: stats.totalLockExtensionsApplied, color: 'neon-orange', Icon: LockKeyhole },
                ].map((stat, i) => (_jsxs("div", { className: "glow-card !p-5 text-center", children: [_jsx(stat.Icon, { className: `w-5 h-5 text-${stat.color} mx-auto` }), _jsx("div", { className: `text-3xl font-black font-mono text-${stat.color} mt-2`, children: stat.value }), _jsx("p", { className: "text-white/30 text-xs mt-1 uppercase tracking-wider", children: stat.label })] }, i))) }), _jsxs("div", { className: "glass p-4 rounded-2xl mb-8 flex gap-4 items-center animate-fade-up opacity-0", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" }), _jsx("input", { type: "text", placeholder: "Filter by project or signal...", className: "input-glow w-full !pl-10 !py-2.5 !text-sm", onChange: (e) => setSelectedProject(e.target.value || null) })] }), _jsxs("label", { className: "flex items-center gap-2.5 text-white/40 cursor-pointer select-none shrink-0", children: [_jsxs("div", { className: "relative", children: [_jsx("input", { type: "checkbox", checked: autoScroll, onChange: (e) => setAutoScroll(e.target.checked), className: "sr-only peer" }), _jsx("div", { className: "w-9 h-5 bg-white/10 rounded-full peer-checked:bg-brand/30 transition" }), _jsx("div", { className: "absolute top-0.5 left-0.5 w-4 h-4 bg-white/30 rounded-full peer-checked:translate-x-4 peer-checked:bg-brand transition-all shadow-sm" })] }), _jsx("span", { className: "text-xs font-semibold uppercase tracking-wider", children: "Auto-scroll" })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsx("span", { className: `w-2 h-2 rounded-full ${isLive ? 'bg-brand animate-pulse' : 'bg-white/20'}` }), _jsx("span", { className: `text-xs font-semibold uppercase tracking-wider ${isLive ? 'text-brand' : 'text-white/30'}`, children: isLive ? 'Live' : 'Offline' })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-up opacity-0", children: [_jsxs(Card, { className: "!p-0 overflow-hidden flex flex-col", style: { maxHeight: '600px' }, children: [_jsxs("div", { className: "p-5 border-b border-white/5 flex items-center justify-between shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-brand animate-pulse" }), _jsx("h3", { className: "text-white font-bold", children: "Incoming Events" }), _jsx("span", { className: "chip chip-purple !text-[9px]", children: "UNICHAIN" })] }), _jsxs("span", { className: "text-white/20 text-xs font-mono", children: [incomingEvents.length, " events"] })] }), _jsx("div", { id: "left-column", className: "flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin", children: incomingEvents.length === 0 ? (_jsxs("div", { className: "text-center py-16", children: [_jsx(Radio, { className: "w-10 h-10 text-white/10 mx-auto mb-3" }), _jsx("p", { className: "text-white/20", children: "Waiting for events from Unichain Sepolia..." }), _jsxs("p", { className: "text-white/10 text-xs mt-2 font-mono", children: ["Polling VestingHook at ", VESTING_HOOK_ADDRESS.slice(0, 10), "..."] })] })) : (incomingEvents
                                    .filter((e) => !selectedProject || e.fromAddress.includes(selectedProject) || e.eventName.includes(selectedProject))
                                    .map((event) => (_jsxs("div", { className: "p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-brand/20 transition-all duration-300 animate-fade-up opacity-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: "chip chip-purple !text-[10px]", children: _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Link2, { className: "w-3 h-3" }), " UNICHAIN"] }) }), _jsxs("span", { className: "text-white/15 text-[10px] font-mono ml-auto", children: ["Block #", event.blockNumber] })] }), _jsx("p", { className: "font-bold text-white text-sm", children: event.eventName }), _jsxs("div", { className: "mt-2 grid grid-cols-2 gap-x-4 text-[11px] font-mono", children: [_jsxs("div", { children: [_jsx("span", { className: "text-white/20", children: "From: " }), _jsxs("span", { className: "text-white/40", children: [event.fromAddress.slice(0, 10), "..."] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-white/20", children: "Tx: " }), _jsxs("a", { href: `${UNICHAIN_EXPLORER}/tx/${event.txHash}`, target: "_blank", rel: "noopener noreferrer", className: "text-brand/60 hover:text-brand transition", children: [event.txHash.slice(0, 10), "... \u2197"] })] })] }), _jsx("p", { className: "text-white/10 text-[10px] font-mono mt-2", children: new Date(event.timestamp).toLocaleTimeString() })] }, event.id)))) })] }), _jsxs(Card, { className: "!p-0 overflow-hidden flex flex-col", style: { maxHeight: '600px' }, children: [_jsxs("div", { className: "p-5 border-b border-white/5 flex items-center justify-between shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-brand animate-pulse" }), _jsx("h3", { className: "text-white font-bold", children: "RSC Responses" }), _jsx("span", { className: "chip chip-cyan !text-[9px]", children: "LASNA" })] }), _jsxs("span", { className: "text-white/20 text-xs font-mono", children: [rscResponses.length, " responses"] })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin", children: rscResponses.length === 0 ? (_jsxs("div", { className: "text-center py-16", children: [_jsx(BrainCircuit, { className: "w-10 h-10 text-white/10 mx-auto mb-3" }), _jsx("p", { className: "text-white/20", children: "Waiting for RSC evaluations from Lasna..." }), _jsxs("p", { className: "text-white/10 text-xs mt-2 font-mono", children: ["Polling TimeLockRSC at ", TIMELOCK_RSC_ADDRESS.slice(0, 10), "..."] })] })) : (rscResponses
                                    .filter((r) => !selectedProject || r.projectAddress.includes(selectedProject) || r.signalId.includes(selectedProject))
                                    .map((response) => (_jsxs("div", { className: `p-4 rounded-xl border transition-all duration-300 animate-fade-up opacity-0 ${response.result === 'TRIGGERED'
                                        ? 'bg-brand/5 border-brand/20'
                                        : 'bg-white/[0.02] border-white/5'}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-mono text-xs font-bold text-white/40", children: response.signalId }), _jsx("span", { className: "text-white/10", children: "\u2022" }), _jsx("span", { className: "text-white font-semibold text-sm", children: response.conditionChecked })] }), _jsx(Badge, { variant: response.result === 'TRIGGERED' ? 'success' : 'neutral', children: response.result === 'TRIGGERED' ? _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Zap, { className: "w-3 h-3" }), " TRIGGERED"] }) : 'BELOW' })] }), response.result === 'TRIGGERED' && (_jsxs("div", { className: "p-2.5 rounded-lg bg-brand/5 border border-brand/10 mt-2", children: [_jsx("p", { className: "text-brand/70 text-xs font-mono", children: response.actionTaken }), response.callbackTxHash && (_jsxs("a", { href: `${LASNA_EXPLORER}/tx/${response.callbackTxHash}`, target: "_blank", rel: "noopener noreferrer", className: "text-brand/40 text-[10px] font-mono hover:text-brand transition block mt-1", children: ["Tx: ", response.callbackTxHash.slice(0, 14), "... \u2197"] }))] })), _jsx("p", { className: "text-white/10 text-[10px] font-mono mt-2", children: new Date(response.timestamp).toLocaleTimeString() })] }, response.id)))) })] })] }), _jsxs(Card, { variant: "glass", className: "!p-6 mt-8 animate-fade-up opacity-0", children: [_jsxs("div", { className: "flex items-center gap-3 mb-4", children: [_jsx(BarChart3, { className: "w-5 h-5 text-brand" }), _jsx("h3", { className: "font-bold text-white", children: "How This Works" })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-5 gap-4", children: [
                            { step: '01', text: 'On-chain events arrive from Unichain Sepolia', Icon: Mail },
                            { step: '02', text: 'Lasna RSC evaluates each against 5 rug signals', Icon: BrainCircuit },
                            { step: '03', text: 'Triggered signals dispatch callback transactions', Icon: Zap },
                            { step: '04', text: 'Risk scores update, milestones unlock, or locks extend', Icon: RefreshCw },
                            { step: '05', text: 'All activity is verifiable on-chain in real time', Icon: CheckCircle2 },
                        ].map((item) => (_jsxs("div", { className: "p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center", children: [_jsx(item.Icon, { className: "w-6 h-6 text-brand/40 mx-auto mb-2" }), _jsx("span", { className: "text-brand/40 font-mono text-[10px] font-bold", children: item.step }), _jsx("p", { className: "text-white/40 text-xs mt-1 leading-relaxed", children: item.text })] }, item.step))) }), _jsxs("p", { className: "text-white/20 text-xs mt-4 text-center font-mono", children: [_jsx(Lightbulb, { className: "w-3.5 h-3.5 text-brand/40 inline mr-1.5" }), isLive
                                ? 'Polling live events from Unichain Sepolia + Lasna Testnet every 12 seconds'
                                : 'Deploy contracts and set addresses in .env to enable live polling'] })] })] }));
}
/* ── Helper: guess event name from log topic ── */
function guessEventName(log, abi) {
    if (!log.topics[0])
        return 'Unknown';
    // Match topic0 against known event signatures
    // Using simple string hashing since we can't import keccak256 synchronously
    // We precompute a map of topic0 → name at module level
    const topic0 = log.topics[0].toLowerCase();
    for (const [hash, name] of eventTopicMap.entries()) {
        if (hash === topic0)
            return name;
    }
    return `Event(${log.topics[0].slice(0, 10)}...)`;
}
/* ── Precomputed topic0 map ── */
const eventTopicMap = new Map();
// Build topic map from ABIs using viem's keccak256
import { keccak256, toBytes } from 'viem';
for (const item of [...timeLockRSCAbi, ...vestingHookAbi]) {
    if (item.type !== 'event')
        continue;
    const sig = `${item.name}(${item.inputs.map((i) => i.type).join(',')})`;
    const hash = keccak256(toBytes(sig));
    eventTopicMap.set(hash.toLowerCase(), item.name);
}

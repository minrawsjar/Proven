import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useLaunchStore } from '../store/launchStore';
import { useWallet, useTokenInfo, useContractWrites } from '../hooks/useWeb3';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Settings, Target, PenLine, AlertTriangle, Lightbulb, Eye, Lock, CheckCircle, Loader2 } from 'lucide-react';
import { isValidAddress } from '../utils/format';
import { VESTING_HOOK_ADDRESS, TIMELOCK_RSC_ADDRESS } from '../config/constants';
export function LaunchPool() {
    const { currentStep, setCurrentStep, poolConfig, setPoolConfig, milestones, setMilestones, additionalWallets, addWallet, removeWallet, treasuryAddress, setTreasuryAddress, } = useLaunchStore();
    const { address, isConnected, isWrongNetwork, ensureCorrectNetwork } = useWallet();
    const { registerVestingPosition, registerMilestonesOnRSC, addGenesisWallet } = useContractWrites();
    const [formErrors, setFormErrors] = useState({});
    const [newWallet, setNewWallet] = useState('');
    const [understood, setUnderstood] = useState(false);
    const [selectedFeeTier, setSelectedFeeTier] = useState(0.3);
    // TX state
    const [txStep, setTxStep] = useState('idle');
    const [txHash1, setTxHash1] = useState(null);
    const [txHash2, setTxHash2] = useState(null);
    const [txError, setTxError] = useState(null);
    // Token info from on-chain
    const tokenAddr = poolConfig?.tokenAddress;
    const { info: tokenInfo, loading: tokenLoading } = useTokenInfo(tokenAddr && isValidAddress(tokenAddr) ? tokenAddr : undefined);
    // Initialize milestones if empty
    if (milestones.length === 0) {
        setMilestones([
            { id: '1', type: 'TVL', threshold: 1000000, unlockPercentage: 25, isComplete: false },
            { id: '2', type: 'VOLUME', threshold: 5000000, unlockPercentage: 50, isComplete: false },
            { id: '3', type: 'USERS', threshold: 5000, unlockPercentage: 25, isComplete: false },
        ]);
    }
    const handleStep1Submit = () => {
        if (!poolConfig?.projectName || !poolConfig?.tokenAddress) {
            setFormErrors({ general: 'Please fill in all required fields' });
            return;
        }
        if (!isValidAddress(poolConfig.tokenAddress)) {
            setFormErrors({ general: 'Invalid token address' });
            return;
        }
        setCurrentStep(2);
        setFormErrors({});
    };
    const totalUnlock = milestones.reduce((sum, m) => sum + m.unlockPercentage, 0);
    const canProceedStep2 = totalUnlock === 100;
    /* ── Sign & Deploy handler ── */
    const handleSign = async () => {
        if (!isConnected || !address) {
            setTxError('Connect your wallet first');
            return;
        }
        if (isWrongNetwork) {
            ensureCorrectNetwork();
            return;
        }
        if (VESTING_HOOK_ADDRESS === '0x0000000000000000000000000000000000000000') {
            setTxError('VestingHook not deployed yet — set VITE_HOOK_ADDRESS in .env');
            return;
        }
        setTxStep('tx1');
        setTxError(null);
        try {
            // TX1: registerVestingPosition on VestingHook (Unichain Sepolia)
            // We use a dummy poolId for now — in production this comes from pool creation
            const dummyPoolId = '0x0000000000000000000000000000000000000000000000000000000000000001';
            const receipt1 = await registerVestingPosition(milestones.map((m) => ({
                type: m.type,
                threshold: m.threshold,
                unlockPercentage: m.unlockPercentage,
            })), poolConfig.tokenAddress, dummyPoolId);
            setTxHash1(receipt1.transactionHash);
            setTxStep('tx2');
            // TX2: registerMilestones on TimeLockRSC (Lasna)
            if (TIMELOCK_RSC_ADDRESS !== '0x0000000000000000000000000000000000000000') {
                try {
                    const receipt2 = await registerMilestonesOnRSC(dummyPoolId, address, milestones.map((m) => ({
                        type: m.type,
                        threshold: m.threshold,
                        unlockPercentage: m.unlockPercentage,
                    })));
                    setTxHash2(receipt2.transactionHash);
                }
                catch (err) {
                    // Lasna TX may fail if wallet isn't on Lasna — log but don't block
                    console.warn('Lasna registerMilestones failed (may need chain switch):', err);
                }
            }
            // TX3: add genesis wallets on RSC
            setTxStep('tx3');
            for (const wallet of additionalWallets) {
                if (isValidAddress(wallet)) {
                    try {
                        await addGenesisWallet(address, wallet);
                    }
                    catch {
                        console.warn('addGenesisWallet failed for', wallet);
                    }
                }
            }
            setTxStep('done');
        }
        catch (err) {
            console.error('Transaction failed:', err);
            setTxError(err?.shortMessage ?? err?.message ?? 'Transaction rejected');
            setTxStep('error');
        }
    };
    const steps = [
        { num: 1, label: 'Pool Config', icon: Settings },
        { num: 2, label: 'Milestones', icon: Target },
        { num: 3, label: 'Review & Sign', icon: PenLine },
    ];
    const renderStep1 = () => (_jsx("div", { className: "animate-fade-up opacity-0 space-y-6", children: _jsxs(Card, { className: "!p-8", children: [_jsxs("div", { className: "flex items-center gap-3 mb-8", children: [_jsx("div", { className: "w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center", children: _jsx(Settings, { className: "w-5 h-5 text-brand" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-white", children: "Pool Configuration" }), _jsx("p", { className: "text-white/30 text-sm", children: "Set up your Uniswap v4 pool basics" })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-white/40 mb-2", children: "Project Name" }), _jsx("input", { className: "input-glow w-full", placeholder: "e.g., Nova Protocol", value: poolConfig?.projectName || '', onChange: (e) => setPoolConfig({ ...poolConfig, projectName: e.target.value }) }), _jsx("p", { className: "text-white/20 text-xs mt-1.5", children: "Shows on investor dashboards and activity feeds" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-white/40 mb-2", children: "Token Address (Unichain Sepolia)" }), _jsx("input", { className: "input-glow w-full font-mono", placeholder: "0x...", value: poolConfig?.tokenAddress || '', onChange: (e) => setPoolConfig({ ...poolConfig, tokenAddress: e.target.value }) }), tokenLoading && (_jsxs("div", { className: "mt-3 p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3", children: [_jsx(Loader2, { className: "w-4 h-4 text-brand animate-spin" }), _jsx("span", { className: "text-white/40 text-sm", children: "Reading token data..." })] })), tokenInfo && (_jsxs("div", { className: "mt-3 p-3 rounded-xl bg-brand/5 border border-brand/20 flex items-center gap-3", children: [_jsx("span", { className: "text-brand text-sm", children: "\u2713" }), _jsxs("div", { className: "text-sm", children: [_jsx("span", { className: "text-white font-semibold", children: tokenInfo.symbol }), _jsx("span", { className: "text-white/30 mx-2", children: "\u2022" }), _jsx("span", { className: "text-white/40", children: tokenInfo.name }), _jsx("span", { className: "text-white/30 mx-2", children: "\u2022" }), _jsxs("span", { className: "text-white/40 font-mono", children: ["Supply: ", (Number(tokenInfo.totalSupply) / 10 ** tokenInfo.decimals).toLocaleString()] })] })] })), poolConfig?.tokenAddress && isValidAddress(poolConfig.tokenAddress) && !tokenLoading && !tokenInfo && (_jsxs("div", { className: "mt-3 p-3 rounded-xl bg-neon-orange/5 border border-neon-orange/20 flex items-center gap-3", children: [_jsx("span", { className: "text-neon-orange text-sm", children: "\u26A0" }), _jsx("span", { className: "text-neon-orange/60 text-sm", children: "Token not found on Unichain Sepolia" })] }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-white/40 mb-2", children: "Pair Token" }), _jsx("div", { className: "grid grid-cols-3 gap-3", children: ['USDC', 'WETH', 'Custom'].map((token) => (_jsx("button", { className: `p-3 rounded-xl border text-sm font-semibold transition-all duration-300 ${poolConfig?.pairToken === token
                                            ? 'border-brand/40 bg-brand/10 text-brand'
                                            : 'border-white/5 bg-white/[0.02] text-white/40 hover:border-white/10 hover:text-white/60'}`, onClick: () => setPoolConfig({ ...poolConfig, pairToken: token }), children: token }, token))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-white/40 mb-2", children: "Fee Tier" }), _jsx("div", { className: "grid grid-cols-3 gap-3", children: [
                                        { value: 0.05, label: '0.05%', desc: 'Stablecoin pairs', recommended: false },
                                        { value: 0.3, label: '0.3%', desc: 'Standard launches', recommended: true },
                                        { value: 1.0, label: '1%', desc: 'High volatility', recommended: false },
                                    ].map((tier) => (_jsxs("button", { className: `p-4 rounded-xl border text-left transition-all duration-300 relative ${selectedFeeTier === tier.value
                                            ? 'border-brand/40 bg-brand/10'
                                            : 'border-white/5 bg-white/[0.02] hover:border-white/10'}`, onClick: () => setSelectedFeeTier(tier.value), children: [tier.recommended && (_jsx("span", { className: "absolute -top-2 right-3 chip chip-green !text-[10px] !py-0", children: "RECOMMENDED" })), _jsx("div", { className: `font-bold text-lg ${selectedFeeTier === tier.value ? 'text-brand' : 'text-white'}`, children: tier.label }), _jsx("div", { className: "text-white/30 text-xs mt-1", children: tier.desc })] }, tier.value))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-white/40 mb-2", children: "Initial Liquidity" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("input", { className: "input-glow w-full font-mono", placeholder: "Token amount" }), _jsx("p", { className: "text-white/20 text-xs mt-1 font-mono", children: "\u2248 $125,000" })] }), _jsxs("div", { children: [_jsx("input", { className: "input-glow w-full font-mono", placeholder: "USDC amount" }), _jsx("p", { className: "text-white/20 text-xs mt-1 font-mono", children: "\u2248 $125,000" })] })] }), _jsxs("div", { className: "mt-3 p-3 rounded-xl bg-brand/5 border border-brand/20 text-center", children: [_jsx("span", { className: "text-white/30 text-sm", children: "Total Liquidity Value: " }), _jsx("span", { className: "text-brand font-bold font-mono", children: "$250,000" })] })] }), _jsxs("div", { className: "p-5 rounded-xl bg-red-500/5 border border-red-500/20 relative overflow-hidden", children: [_jsx("div", { className: "absolute top-0 left-0 w-1 h-full bg-red-500" }), _jsxs("div", { className: "flex items-start gap-3 ml-3", children: [_jsx(AlertTriangle, { className: "w-5 h-5 text-red-400 flex-shrink-0" }), _jsxs("div", { children: [_jsx("p", { className: "text-red-300 font-semibold text-sm mb-1", children: "Critical \u2014 Read Before Proceeding" }), _jsxs("p", { className: "text-red-200/60 text-sm leading-relaxed", children: ["Once you add liquidity, these tokens go into Proven's vault. You ", _jsx("strong", { className: "text-red-300", children: "cannot withdraw" }), " them until your milestones are met."] })] })] })] }), formErrors.general && (_jsx("p", { className: "text-red-400 text-sm font-mono", children: formErrors.general }))] }), _jsx("div", { className: "flex justify-end gap-3 mt-8 pt-6 border-t border-white/5", children: _jsx("button", { className: "btn-primary px-6 py-2.5", onClick: handleStep1Submit, children: "Next: Milestones \u2192" }) })] }) }));
    const renderStep2 = () => (_jsx("div", { className: "animate-fade-up opacity-0 space-y-6", children: _jsxs(Card, { className: "!p-8", children: [_jsxs("div", { className: "flex items-center gap-3 mb-8", children: [_jsx("div", { className: "w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center", children: _jsx(Target, { className: "w-5 h-5 text-brand" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-white", children: "Milestone Builder" }), _jsx("p", { className: "text-white/30 text-sm", children: "Define on-chain conditions that unlock your liquidity" })] })] }), _jsxs("div", { className: "p-5 rounded-xl bg-void-50 border border-white/5 mb-8", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-wider text-white/40", children: "Unlock Distribution" }), _jsxs("span", { className: `font-mono text-sm font-bold ${totalUnlock === 100 ? 'text-brand' : 'text-neon-orange'}`, children: [totalUnlock === 100 ? '✓ ' : '', totalUnlock, "%"] })] }), _jsxs("div", { className: "h-4 bg-white/5 rounded-full overflow-hidden flex", children: [milestones.map((m, i) => (_jsx("div", { style: { width: `${m.unlockPercentage}%` }, className: `transition-all duration-500 ${i === 0 ? 'bg-brand shadow-[0_0_8px_rgba(0,230,118,0.4)]' :
                                        i === 1 ? 'bg-brand-dark shadow-[0_0_8px_rgba(0,200,83,0.4)]' :
                                            'bg-brand-light shadow-[0_0_8px_rgba(105,240,174,0.4)]'}` }, i))), totalUnlock < 100 && (_jsx("div", { style: { width: `${100 - totalUnlock}%` }, className: "bg-white/5" }))] }), totalUnlock !== 100 && (_jsx("p", { className: "text-neon-orange/70 text-xs mt-2 font-mono", children: "Must equal exactly 100% to proceed" }))] }), _jsx("div", { className: "space-y-4 mb-8", children: milestones.map((m, i) => {
                        const colors = ['neon-cyan', 'neon-purple', 'neon-green'];
                        const bgColors = ['bg-neon-cyan', 'bg-neon-purple', 'bg-neon-green'];
                        return (_jsxs("div", { className: "p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-300", children: [_jsxs("div", { className: "flex items-center gap-3 mb-4", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${bgColors[i]}` }), _jsxs("span", { className: "text-white font-bold text-sm", children: ["Milestone ", i + 1] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-white/30 mb-1.5", children: "Condition" }), _jsxs("select", { className: "input-glow w-full !py-2.5 !text-sm", value: m.type, onChange: (e) => {
                                                        const updated = [...milestones];
                                                        updated[i] = { ...m, type: e.target.value };
                                                        setMilestones(updated);
                                                    }, children: [_jsx("option", { value: "TVL", children: "TVL" }), _jsx("option", { value: "VOLUME", children: "Trading Volume" }), _jsx("option", { value: "USERS", children: "Unique Users" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-white/30 mb-1.5", children: "Threshold" }), _jsx("input", { className: "input-glow w-full !py-2.5 !text-sm font-mono", placeholder: m.type === 'USERS' ? '5,000' : '$1,000,000', value: m.threshold.toLocaleString(), onChange: (e) => {
                                                        const updated = [...milestones];
                                                        updated[i] = { ...m, threshold: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 };
                                                        setMilestones(updated);
                                                    } })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-white/30 mb-1.5", children: "Unlock %" }), _jsx("input", { type: "range", min: "1", max: "100", value: m.unlockPercentage, onChange: (e) => {
                                                        const updated = [...milestones];
                                                        updated[i] = { ...m, unlockPercentage: parseInt(e.target.value) };
                                                        setMilestones(updated);
                                                    }, className: "w-full accent-cyan-400 mt-2" }), _jsxs("div", { className: "flex justify-between text-xs mt-1", children: [_jsxs("span", { className: `font-mono font-bold text-${colors[i]}`, children: [m.unlockPercentage, "%"] }), _jsxs("span", { className: "text-white/20 font-mono", children: ["$", ((m.unlockPercentage / 100) * 250000).toLocaleString()] })] })] })] }), i === 0 && (_jsxs("p", { className: "text-white/20 text-xs mt-3 font-mono flex items-center gap-1.5", children: [_jsx(Lightbulb, { className: "w-3 h-3 text-brand/40 flex-shrink-0" }), " Unichain Sepolia pool TVL benchmarks vary \u2014 set realistic goals"] })), i === 1 && (_jsxs("p", { className: "text-white/20 text-xs mt-3 font-mono flex items-center gap-1.5", children: [_jsx(Lightbulb, { className: "w-3 h-3 text-brand/40 flex-shrink-0" }), " Top 10% of new launches reach $5M volume in 90 days"] }))] }, i));
                    }) }), _jsxs("div", { className: "p-5 rounded-xl bg-brand/5 border border-brand/10", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Eye, { className: "w-3.5 h-3.5 text-brand/60" }), _jsx("span", { className: "text-xs font-semibold uppercase tracking-wider text-brand/60", children: "Investor Preview" })] }), _jsx("div", { className: "space-y-3", children: milestones.map((m, i) => (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-3 h-3 rounded-full border-2 border-white/20" }), _jsxs("span", { className: "text-white/50 text-sm", children: [m.type === 'TVL' ? 'TVL' : m.type === 'VOLUME' ? 'Volume' : 'Users', " reaches ", m.type === 'USERS' ? m.threshold.toLocaleString() : `$${m.threshold.toLocaleString()}`] }), _jsxs("span", { className: "text-white/20 text-sm ml-auto font-mono", children: ["\u2192 ", m.unlockPercentage, "%"] })] }, i))) })] }), _jsxs("div", { className: "flex justify-between gap-3 mt-8 pt-6 border-t border-white/5", children: [_jsx("button", { className: "btn-secondary px-6 py-2.5", onClick: () => setCurrentStep(1), children: "\u2190 Back" }), _jsx("button", { className: "btn-primary px-6 py-2.5", onClick: () => setCurrentStep(3), disabled: !canProceedStep2, children: "Next: Review \u2192" })] })] }) }));
    const renderStep3 = () => (_jsx("div", { className: "animate-fade-up opacity-0 space-y-6", children: _jsxs(Card, { className: "!p-8", children: [_jsxs("div", { className: "flex items-center gap-3 mb-8", children: [_jsx("div", { className: "w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center", children: _jsx(PenLine, { className: "w-5 h-5 text-brand" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-white", children: "Review & Confirm" }), _jsx("p", { className: "text-white/30 text-sm", children: "Final review before deploying on-chain" })] })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h3", { className: "text-sm font-semibold text-white mb-2", children: "Monitored Wallets" }), _jsx("p", { className: "text-white/30 text-xs mb-4", children: "Deployer address is automatically monitored. Add team or advisor wallets for additional protection." }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsx("input", { className: "input-glow flex-1 font-mono !text-sm", placeholder: "0x...", value: newWallet, onChange: (e) => setNewWallet(e.target.value) }), _jsx("button", { className: "btn-primary py-2 px-4 text-xs", onClick: () => { if (newWallet && isValidAddress(newWallet)) {
                                        addWallet(newWallet);
                                        setNewWallet('');
                                    } }, children: "ADD" })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("span", { className: "chip chip-green", children: [_jsx("span", { className: "live-dot !w-[5px] !h-[5px]" }), " deployer (auto)"] }), additionalWallets.map((w) => (_jsxs("span", { className: "chip chip-cyan group cursor-pointer", children: [w.slice(0, 8), "...", _jsx("button", { onClick: () => removeWallet(w), className: "text-neon-cyan/50 hover:text-neon-cyan ml-1", children: "\u00D7" })] }, w)))] })] }), _jsxs("div", { className: "mb-8", children: [_jsxs("h3", { className: "text-sm font-semibold text-white mb-2", children: ["Treasury Contract ", _jsx("span", { className: "text-white/30", children: "(optional)" })] }), _jsx("input", { className: "input-glow w-full font-mono !text-sm", placeholder: "0x...", value: treasuryAddress, onChange: (e) => setTreasuryAddress(e.target.value) }), _jsx("p", { className: "text-white/20 text-xs mt-1.5", children: "Enables Signal 5: treasury drain monitoring" })] }), _jsxs("div", { className: "p-6 rounded-xl bg-void-50 border border-white/5 mb-8 font-mono text-sm space-y-2.5", children: [_jsx("h4", { className: "text-white font-bold !font-sans text-base mb-4", children: "Transaction Summary" }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-white/30", children: "Pool" }), _jsxs("span", { className: "text-white", children: ["$", tokenInfo?.symbol ?? 'TOKEN', " / ", poolConfig?.pairToken ?? 'USDC', " \u00B7 ", selectedFeeTier, "% fee"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-white/30", children: "Initial Liquidity" }), _jsx("span", { className: "text-brand font-bold", children: "$250,000" })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-white/30", children: "Chain" }), _jsx("span", { className: "text-white/60", children: "Unichain Sepolia (1301)" })] }), _jsx("div", { className: "neon-line my-3 opacity-20" }), milestones.map((m, i) => (_jsxs("div", { className: "flex justify-between", children: [_jsxs("span", { className: "text-white/30", children: ["Milestone ", i + 1] }), _jsxs("span", { className: "text-white/60", children: [m.type, " ", m.type === 'USERS' ? m.threshold.toLocaleString() : `$${m.threshold.toLocaleString()}`, " \u2192 ", _jsxs("span", { className: "text-white", children: [m.unlockPercentage, "%"] })] })] }, i))), _jsx("div", { className: "neon-line my-3 opacity-20" }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-white/30", children: "Wallets" }), _jsxs("span", { className: "text-white/60", children: ["deployer + ", additionalWallets.length] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-white/30", children: "Rug Thresholds" }), _jsx("span", { className: "text-white/60", children: "Standard defaults" })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-white/30", children: "Lock Extension" }), _jsx("span", { className: "text-white/60", children: "30 days on trigger" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4 mb-8", children: [_jsxs("div", { className: `p-4 rounded-xl border transition-all duration-300 ${txStep === 'tx1' ? 'bg-brand/10 border-brand/40 animate-pulse' :
                                txHash1 ? 'bg-brand/5 border-brand/30' : 'bg-brand/5 border-brand/10'}`, children: [_jsx(Badge, { variant: "info", className: "mb-2", children: "TX 1" }), _jsx("p", { className: "text-white text-sm font-semibold", children: "registerVestingPosition()" }), _jsx("p", { className: "text-white/30 text-xs mt-1", children: "Register milestones & wallets on Unichain" }), txStep === 'tx1' && _jsx("p", { className: "text-brand text-xs mt-2 animate-pulse", children: "\u23F3 Awaiting confirmation..." }), txHash1 && (_jsxs("a", { href: `https://sepolia.uniscan.xyz/tx/${txHash1}`, target: "_blank", rel: "noopener noreferrer", className: "text-brand/60 text-xs mt-2 font-mono block hover:text-brand transition", children: ["\u2713 ", txHash1.slice(0, 10), "... \u2197"] }))] }), _jsxs("div", { className: `p-4 rounded-xl border transition-all duration-300 ${txStep === 'tx2' ? 'bg-neon-purple/10 border-neon-purple/40 animate-pulse' :
                                txHash2 ? 'bg-neon-purple/5 border-neon-purple/30' : 'bg-brand/5 border-brand/10'}`, children: [_jsx(Badge, { variant: "purple", className: "mb-2", children: "TX 2" }), _jsx("p", { className: "text-white text-sm font-semibold", children: "registerMilestones()" }), _jsx("p", { className: "text-white/30 text-xs mt-1", children: "Register on Lasna RSC" }), txStep === 'tx2' && _jsx("p", { className: "text-neon-purple text-xs mt-2 animate-pulse", children: "\u23F3 Awaiting confirmation..." }), txHash2 && (_jsxs("a", { href: `https://lasna.reactscan.net/tx/${txHash2}`, target: "_blank", rel: "noopener noreferrer", className: "text-neon-purple/60 text-xs mt-2 font-mono block hover:text-neon-purple transition", children: ["\u2713 ", txHash2.slice(0, 10), "... \u2197"] }))] })] }), txStep === 'done' && (_jsx("div", { className: "p-5 rounded-xl bg-brand/5 border border-brand/30 mb-6", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(CheckCircle, { className: "w-6 h-6 text-brand" }), _jsxs("div", { children: [_jsx("p", { className: "text-brand font-bold", children: "Pool Launched Successfully!" }), _jsx("p", { className: "text-white/40 text-sm mt-1", children: "Your position is now locked and monitored by the Reactive Smart Contract." })] })] }) })), txError && (_jsx("div", { className: "p-4 rounded-xl bg-red-500/5 border border-red-500/30 mb-6", children: _jsx("p", { className: "text-red-400 text-sm font-mono", children: txError }) })), _jsxs("label", { className: "flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:border-white/10 transition", children: [_jsx("input", { type: "checkbox", checked: understood, onChange: (e) => setUnderstood(e.target.checked), className: "mt-1 accent-cyan-400" }), _jsxs("span", { className: "text-sm text-white/50", children: ["I understand my LP tokens will be held in Proven's vault and can ", _jsx("strong", { className: "text-white/70", children: "only be released" }), " by meeting the milestones above."] })] }), _jsxs("div", { className: "flex justify-between gap-3 mt-8 pt-6 border-t border-white/5", children: [_jsx("button", { className: "btn-secondary px-6 py-2.5", onClick: () => setCurrentStep(2), disabled: txStep !== 'idle' && txStep !== 'error' && txStep !== 'done', children: "\u2190 Back" }), _jsx("button", { className: `btn-primary px-8 py-2.5 ${(!understood || !isConnected || txStep === 'done') ? 'opacity-40 cursor-not-allowed' : ''}`, disabled: !understood || !isConnected || (txStep !== 'idle' && txStep !== 'error'), onClick: handleSign, children: txStep === 'idle' || txStep === 'error' ? (_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Lock, { className: "w-4 h-4" }), isConnected ? (isWrongNetwork ? 'Switch to Unichain Sepolia' : 'Sign & Deploy') : 'Connect Wallet First'] })) : txStep === 'done' ? (_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(CheckCircle, { className: "w-4 h-4" }), " Complete"] })) : (_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Loader2, { className: "w-4 h-4 animate-spin" }), " Processing..."] })) })] })] }) }));
    return (_jsxs("div", { className: "max-w-4xl mx-auto px-6 py-12", children: [_jsxs("div", { className: "text-center mb-10 animate-fade-up opacity-0", children: [_jsx(Badge, { variant: "info", pulse: true, className: "mb-4", children: "TEAM FLOW" }), _jsx("h1", { className: "text-3xl md:text-4xl font-black text-white mb-2", children: "Launch Your Pool" }), _jsx("p", { className: "text-white/30", children: "Deploy performance-vested liquidity on Uniswap v4" })] }), _jsx("div", { className: "mb-12 animate-fade-up opacity-0 delay-100", children: _jsx("div", { className: "flex items-center justify-between max-w-lg mx-auto", children: steps.map((step, i) => (_jsxs("div", { className: "flex items-center", children: [_jsxs("div", { className: "flex flex-col items-center", children: [_jsx("button", { onClick: () => step.num < currentStep && setCurrentStep(step.num), className: `w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-500 ${step.num === currentStep
                                            ? 'bg-brand/20 border-2 border-brand text-brand shadow-neon-green'
                                            : step.num < currentStep
                                                ? 'bg-brand/20 border-2 border-brand text-brand'
                                                : 'bg-white/5 border-2 border-white/10 text-white/20'}`, children: step.num < currentStep ? _jsx(CheckCircle, { className: "w-4 h-4" }) : _jsx(step.icon, { className: "w-5 h-5" }) }), _jsx("span", { className: `text-xs mt-2 font-semibold ${step.num <= currentStep ? 'text-white/60' : 'text-white/20'}`, children: step.label })] }), i < steps.length - 1 && (_jsx("div", { className: `w-20 h-0.5 mx-4 mb-6 rounded transition-all duration-500 ${step.num < currentStep ? 'bg-brand shadow-[0_0_6px_rgba(0,230,118,0.4)]' : 'bg-white/10'}` }))] }, step.num))) }) }), currentStep === 1 && renderStep1(), currentStep === 2 && renderStep2(), currentStep === 3 && renderStep3()] }));
}

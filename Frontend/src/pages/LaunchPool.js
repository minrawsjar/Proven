import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useLaunchStore } from '../store/launchStore';
import { useWallet, useTokenInfo, useContractWrites } from '../hooks/useWeb3';
import { Settings, Target, PenLine, AlertTriangle, Lightbulb, Eye, Lock, CheckCircle, Loader2 } from 'lucide-react';
import { isValidAddress } from '../utils/format';
import { VESTING_HOOK_ADDRESS, RISK_GUARD_RSC_ADDRESS, POOL_MODIFY_LIQUIDITY_TEST_ADDRESS } from '../config/constants';
import { buildPoolKey, computePoolId, computeSqrtPriceX96, fullRangeTicks, sortTokens } from '../utils/pool';
import { parseUnits } from 'viem';
export function LaunchPool() {
    const { currentStep, setCurrentStep, poolConfig, setPoolConfig, milestones, setMilestones, additionalWallets, addWallet, removeWallet, treasuryAddress, setTreasuryAddress, } = useLaunchStore();
    const { address, isConnected, isWrongNetwork, ensureCorrectNetwork } = useWallet();
    const { registerVestingPosition, registerMilestonesOnRSC, addGenesisWallet, approveToken, initializePool, addLiquidity, switchToLasna, switchToUnichain, } = useContractWrites();
    const [formErrors, setFormErrors] = useState({});
    const [newWallet, setNewWallet] = useState('');
    const [understood, setUnderstood] = useState(false);
    const [selectedFeeTier, setSelectedFeeTier] = useState(0.3);
    const [tokenAmount, setTokenAmount] = useState('');
    const [pairAmount, setPairAmount] = useState('');
    const [txStep, setTxStep] = useState('idle');
    const [txHashes, setTxHashes] = useState({});
    const [txError, setTxError] = useState(null);
    const [computedPoolId, setComputedPoolId] = useState(null);
    const tokenAddr = poolConfig?.tokenAddress;
    const { info: tokenInfo, loading: tokenLoading } = useTokenInfo(tokenAddr && isValidAddress(tokenAddr) ? tokenAddr : undefined);
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
    /* ═══════════════ handleSign — all contract logic preserved exactly ═══════════════ */
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
        const projectToken = poolConfig.tokenAddress;
        const pairTokenAddr = (poolConfig?.pairToken === 'WETH'
            ? '0x0000000000000000000000000000000000000000'
            : '0x11aFfEac94B440C3c332813450db66fb3285BFB2');
        const decimals = tokenInfo?.decimals ?? 18;
        const pairDecimals = 18;
        const tokenAmt = parseUnits(tokenAmount || '1000', decimals);
        const pairAmt = parseUnits(pairAmount || '1000', pairDecimals);
        const poolKey = buildPoolKey(projectToken, pairTokenAddr, selectedFeeTier);
        const poolId = computePoolId(poolKey);
        setComputedPoolId(poolId);
        const { isToken0 } = sortTokens(projectToken, pairTokenAddr);
        const sqrtPrice = isToken0
            ? computeSqrtPriceX96(tokenAmt, pairAmt)
            : computeSqrtPriceX96(pairAmt, tokenAmt);
        const { tickLower, tickUpper } = fullRangeTicks(poolKey.tickSpacing);
        const liquidityDelta = tokenAmt > 0n ? tokenAmt : 1000000000000000000n;
        setTxError(null);
        setTxHashes({});
        try {
            setTxStep('approve');
            const router = POOL_MODIFY_LIQUIDITY_TEST_ADDRESS;
            const MAX = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
            const r1 = await approveToken(projectToken, router, MAX);
            setTxHashes(p => ({ ...p, approve0: r1.transactionHash }));
            if (pairTokenAddr !== '0x0000000000000000000000000000000000000000') {
                const r2 = await approveToken(pairTokenAddr, router, MAX);
                setTxHashes(p => ({ ...p, approve1: r2.transactionHash }));
            }
            setTxStep('init-pool');
            const r3 = await initializePool(poolKey, sqrtPrice);
            setTxHashes(p => ({ ...p, initPool: r3.transactionHash }));
            setTxStep('register');
            const r4 = await registerVestingPosition(milestones.map(m => ({ type: m.type, threshold: m.threshold, unlockPercentage: m.unlockPercentage })), projectToken, poolId);
            setTxHashes(p => ({ ...p, register: r4.transactionHash }));
            setTxStep('add-liq');
            const r5 = await addLiquidity(poolKey, tickLower, tickUpper, liquidityDelta);
            setTxHashes(p => ({ ...p, addLiq: r5.transactionHash }));
            setTxStep('rsc-register');
            if (RISK_GUARD_RSC_ADDRESS !== '0x0000000000000000000000000000000000000000') {
                try {
                    await switchToLasna();
                    const r6 = await registerMilestonesOnRSC(poolId, address, milestones.map(m => ({ type: m.type, threshold: m.threshold, unlockPercentage: m.unlockPercentage })));
                    setTxHashes(p => ({ ...p, rscRegister: r6.transactionHash }));
                }
                catch (err) {
                    console.warn('Lasna registerMilestones failed:', err);
                }
            }
            setTxStep('rsc-wallets');
            try {
                await addGenesisWallet(address, address);
            }
            catch {
                console.warn('addGenesisWallet failed for deployer');
            }
            for (const w of additionalWallets) {
                if (isValidAddress(w)) {
                    try {
                        await addGenesisWallet(address, w);
                    }
                    catch {
                        console.warn('addGenesisWallet failed for', w);
                    }
                }
            }
            try {
                await switchToUnichain();
            }
            catch {
                console.warn('Failed to switch back');
            }
            setTxStep('done');
        }
        catch (err) {
            console.error('Transaction failed:', err);
            setTxError(err?.shortMessage ?? err?.message ?? 'Transaction rejected');
            setTxStep('error');
        }
    };
    /* ── reusable class strings ── */
    const inp = "w-full bg-white dark:bg-[#111] border-4 border-black dark:border-white px-4 py-3 font-mono text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-shadow";
    const btnPrimary = "font-bold uppercase tracking-wide border-4 border-black px-8 py-3 bg-[#DFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:translate-x-0 active:shadow-none transition-all";
    const btnSecondary = "font-bold uppercase tracking-wide border-4 border-black dark:border-white px-8 py-3 bg-white dark:bg-[#111] text-black dark:text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] active:translate-y-0 active:translate-x-0 active:shadow-none transition-all";
    const steps = [
        { num: 1, label: 'POOL CONFIG', icon: Settings },
        { num: 2, label: 'MILESTONES', icon: Target },
        { num: 3, label: 'REVIEW & SIGN', icon: PenLine },
    ];
    /* ═══════════════ STEP 1 ═══════════════ */
    const renderStep1 = () => (_jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "bg-white dark:bg-[#111] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-8", children: [_jsxs("div", { className: "flex items-center gap-4 mb-8 border-b-4 border-black dark:border-white pb-4", children: [_jsx(Settings, { size: 32, className: "stroke-[2]" }), _jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-black uppercase tracking-tight", children: "Pool Configuration" }), _jsx("p", { className: "font-mono text-gray-600 dark:text-gray-400", children: "Set up your Uniswap v4 pool basics" })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block font-bold uppercase tracking-wider text-sm mb-2", children: "Project Name" }), _jsx("input", { className: inp, placeholder: "e.g., Nova Protocol", value: poolConfig?.projectName || '', onChange: (e) => setPoolConfig({ ...poolConfig, projectName: e.target.value }) }), _jsx("p", { className: "text-gray-500 dark:text-gray-400 text-xs mt-1.5 font-mono", children: "Shows on investor dashboards" })] }), _jsxs("div", { children: [_jsx("label", { className: "block font-bold uppercase tracking-wider text-sm mb-2", children: "Token Address (Unichain Sepolia)" }), _jsx("input", { className: inp, placeholder: "0x...", value: poolConfig?.tokenAddress || '', onChange: (e) => setPoolConfig({ ...poolConfig, tokenAddress: e.target.value }) }), tokenLoading && (_jsxs("div", { className: "mt-3 p-3 border-4 border-black dark:border-white bg-gray-100 dark:bg-[#1A1A1A] flex items-center gap-3", children: [_jsx(Loader2, { className: "w-4 h-4 animate-spin" }), _jsx("span", { className: "font-mono text-sm", children: "Reading token data..." })] })), tokenInfo && (_jsxs("div", { className: "mt-3 p-3 border-4 border-black bg-[#DFFF00] flex items-center gap-3 font-mono text-sm text-black", children: [_jsx("span", { className: "font-black", children: "\u2713" }), _jsx("span", { className: "font-bold", children: tokenInfo.symbol }), _jsx("span", { children: "\u2022" }), _jsx("span", { children: tokenInfo.name }), _jsx("span", { children: "\u2022" }), _jsxs("span", { children: ["Supply: ", (Number(tokenInfo.totalSupply) / 10 ** tokenInfo.decimals).toLocaleString()] })] })), poolConfig?.tokenAddress && isValidAddress(poolConfig.tokenAddress) && !tokenLoading && !tokenInfo && (_jsx("div", { className: "mt-3 p-3 border-4 border-[#FF3333] bg-white dark:bg-[#111] font-mono text-sm text-[#FF3333]", children: "\u26A0 Token not found on Unichain Sepolia" }))] }), _jsxs("div", { children: [_jsx("label", { className: "block font-bold uppercase tracking-wider text-sm mb-2", children: "Pair Token" }), _jsx("div", { className: "grid grid-cols-3 gap-3", children: ['USDC', 'WETH', 'Custom'].map((token) => (_jsx("button", { className: `p-3 border-4 border-black dark:border-white font-bold uppercase text-sm transition-all ${poolConfig?.pairToken === token ? 'bg-[#DFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-white dark:bg-[#111] hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'}`, onClick: () => setPoolConfig({ ...poolConfig, pairToken: token }), children: token }, token))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block font-bold uppercase tracking-wider text-sm mb-2", children: "Fee Tier" }), _jsx("div", { className: "grid grid-cols-3 gap-3", children: [
                                        { value: 0.05, label: '0.05%', desc: 'Stablecoin pairs', recommended: false },
                                        { value: 0.3, label: '0.3%', desc: 'Standard launches', recommended: true },
                                        { value: 1.0, label: '1%', desc: 'High volatility', recommended: false },
                                    ].map((tier) => (_jsxs("button", { className: `p-4 border-4 border-black dark:border-white text-left transition-all relative ${selectedFeeTier === tier.value ? 'bg-[#DFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-white dark:bg-[#111] hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'}`, onClick: () => setSelectedFeeTier(tier.value), children: [tier.recommended && _jsx("span", { className: "absolute -top-3 right-2 bg-black text-[#DFFF00] text-[10px] font-black uppercase px-2 py-0.5", children: "REC" }), _jsx("div", { className: "font-black text-xl", children: tier.label }), _jsx("div", { className: "text-gray-600 dark:text-gray-400 text-xs font-mono mt-1", children: tier.desc })] }, tier.value))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block font-bold uppercase tracking-wider text-sm mb-2", children: "Initial Liquidity" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("input", { className: inp, placeholder: "Token amount", value: tokenAmount, onChange: (e) => setTokenAmount(e.target.value.replace(/[^0-9.]/g, '')) }), _jsx("p", { className: "text-gray-500 dark:text-gray-400 text-xs mt-1 font-mono", children: tokenInfo?.symbol ?? 'TOKEN' })] }), _jsxs("div", { children: [_jsx("input", { className: inp, placeholder: "Pair amount", value: pairAmount, onChange: (e) => setPairAmount(e.target.value.replace(/[^0-9.]/g, '')) }), _jsx("p", { className: "text-gray-500 dark:text-gray-400 text-xs mt-1 font-mono", children: poolConfig?.pairToken ?? 'USDC' })] })] }), (tokenAmount || pairAmount) && (_jsxs("div", { className: "mt-3 p-3 border-4 border-black bg-[#DFFF00] text-center font-mono font-bold text-black", children: [tokenAmount || '0', " ", tokenInfo?.symbol ?? 'TOKEN', " + ", pairAmount || '0', " ", poolConfig?.pairToken ?? 'USDC'] }))] }), _jsxs("div", { className: "p-5 border-4 border-[#FF3333] bg-white dark:bg-[#111] relative", children: [_jsx("div", { className: "absolute top-0 left-0 w-2 h-full bg-[#FF3333]" }), _jsxs("div", { className: "flex items-start gap-3 ml-3", children: [_jsx(AlertTriangle, { className: "w-6 h-6 text-[#FF3333] flex-shrink-0 stroke-[3]" }), _jsxs("div", { children: [_jsx("p", { className: "font-black text-[#FF3333] uppercase mb-1", children: "Critical \u2014 Read Before Proceeding" }), _jsxs("p", { className: "text-gray-700 dark:text-gray-300 font-mono text-sm", children: ["Once you add liquidity, these tokens go into Proven's vault. You ", _jsx("strong", { children: "cannot withdraw" }), " them until your milestones are met."] })] })] })] }), formErrors.general && _jsx("p", { className: "text-[#FF3333] font-mono font-bold", children: formErrors.general })] }), _jsx("div", { className: "flex justify-end mt-8 pt-6 border-t-4 border-black dark:border-white", children: _jsx("button", { className: btnPrimary, onClick: handleStep1Submit, children: "Next: Milestones \u2192" }) })] }) }));
    /* ═══════════════ STEP 2 ═══════════════ */
    const renderStep2 = () => (_jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "bg-white dark:bg-[#111] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-8", children: [_jsxs("div", { className: "flex items-center gap-4 mb-8 border-b-4 border-black dark:border-white pb-4", children: [_jsx(Target, { size: 32, className: "stroke-[2]" }), _jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-black uppercase tracking-tight", children: "Milestone Builder" }), _jsx("p", { className: "font-mono text-gray-600 dark:text-gray-400", children: "Define on-chain conditions that unlock your liquidity" })] })] }), _jsxs("div", { className: "p-5 border-4 border-black dark:border-white mb-8", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("span", { className: "font-bold uppercase text-sm", children: "Unlock Distribution" }), _jsxs("span", { className: `font-mono font-black text-lg ${totalUnlock === 100 ? '' : 'text-[#FF3333]'}`, children: [totalUnlock === 100 ? '✓ ' : '', totalUnlock, "%"] })] }), _jsxs("div", { className: "h-6 bg-gray-200 dark:bg-[#1A1A1A] border-4 border-black dark:border-white overflow-hidden flex", children: [milestones.map((m, i) => (_jsx("div", { style: { width: `${m.unlockPercentage}%` }, className: `transition-all duration-500 ${i === 0 ? 'bg-[#DFFF00]' : i === 1 ? 'bg-black dark:bg-white' : 'bg-gray-500'}` }, i))), totalUnlock < 100 && _jsx("div", { style: { width: `${100 - totalUnlock}%` }, className: "bg-gray-200 dark:bg-[#1A1A1A]" })] }), totalUnlock !== 100 && _jsx("p", { className: "text-[#FF3333] text-xs mt-2 font-mono font-bold", children: "Must equal exactly 100% to proceed" })] }), _jsx("div", { className: "space-y-4 mb-8", children: milestones.map((m, i) => (_jsxs("div", { className: "p-5 border-4 border-black dark:border-white bg-white dark:bg-[#0A0A0A] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] transition-all", children: [_jsxs("div", { className: "flex items-center gap-3 mb-4", children: [_jsx("span", { className: `font-black text-xl ${i === 0 ? 'bg-[#DFFF00] text-black' : i === 1 ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-gray-200 dark:bg-[#1A1A1A]'} px-3 py-1 border-2 border-black dark:border-white`, children: String(i + 1).padStart(2, '0') }), _jsxs("span", { className: "font-black uppercase", children: ["Milestone ", i + 1] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5", children: "Condition" }), _jsxs("select", { className: `${inp} !py-2.5`, value: m.type, onChange: (e) => { const u = [...milestones]; u[i] = { ...m, type: e.target.value }; setMilestones(u); }, children: [_jsx("option", { value: "TVL", children: "TVL" }), _jsx("option", { value: "VOLUME", children: "Trading Volume" }), _jsx("option", { value: "USERS", children: "Unique Users" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5", children: "Threshold" }), _jsx("input", { className: `${inp} !py-2.5`, placeholder: m.type === 'USERS' ? '5,000' : '$1,000,000', value: m.threshold.toLocaleString(), onChange: (e) => { const u = [...milestones]; u[i] = { ...m, threshold: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 }; setMilestones(u); } })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5", children: "Unlock %" }), _jsx("input", { type: "range", min: "1", max: "100", value: m.unlockPercentage, onChange: (e) => { const u = [...milestones]; u[i] = { ...m, unlockPercentage: parseInt(e.target.value) }; setMilestones(u); }, className: "w-full accent-black dark:accent-[#DFFF00] mt-2" }), _jsxs("div", { className: "flex justify-between text-xs mt-1", children: [_jsxs("span", { className: "font-mono font-black", children: [m.unlockPercentage, "%"] }), _jsxs("span", { className: "text-gray-400 font-mono", children: ["$", ((m.unlockPercentage / 100) * 250000).toLocaleString()] })] })] })] }), i === 0 && _jsxs("p", { className: "text-gray-400 text-xs mt-3 font-mono flex items-center gap-1.5", children: [_jsx(Lightbulb, { className: "w-3 h-3 flex-shrink-0" }), " Set realistic TVL goals for Unichain Sepolia"] })] }, i))) }), _jsxs("div", { className: "p-5 border-4 border-black bg-[#DFFF00] text-black", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Eye, { className: "w-4 h-4" }), _jsx("span", { className: "font-black uppercase text-sm", children: "Investor Preview" })] }), _jsx("div", { className: "space-y-3", children: milestones.map((m, i) => (_jsxs("div", { className: "flex items-center gap-3 font-mono text-sm", children: [_jsx("span", { className: "w-6 h-6 border-2 border-black flex items-center justify-center text-xs font-black", children: i + 1 }), _jsxs("span", { children: [m.type === 'TVL' ? 'TVL' : m.type === 'VOLUME' ? 'Volume' : 'Users', " reaches ", m.type === 'USERS' ? m.threshold.toLocaleString() : `$${m.threshold.toLocaleString()}`] }), _jsxs("span", { className: "ml-auto font-black", children: ["\u2192 ", m.unlockPercentage, "%"] })] }, i))) })] }), _jsxs("div", { className: "flex justify-between gap-3 mt-8 pt-6 border-t-4 border-black dark:border-white", children: [_jsx("button", { className: btnSecondary, onClick: () => setCurrentStep(1), children: "\u2190 Back" }), _jsx("button", { className: `${btnPrimary} ${!canProceedStep2 ? 'opacity-40 cursor-not-allowed' : ''}`, onClick: () => setCurrentStep(3), disabled: !canProceedStep2, children: "Next: Review \u2192" })] })] }) }));
    /* ═══════════════ STEP 3 ═══════════════ */
    const renderStep3 = () => (_jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "bg-white dark:bg-[#111] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-8", children: [_jsxs("div", { className: "flex items-center gap-4 mb-8 border-b-4 border-black dark:border-white pb-4", children: [_jsx(PenLine, { size: 32, className: "stroke-[2]" }), _jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-black uppercase tracking-tight", children: "Review & Confirm" }), _jsx("p", { className: "font-mono text-gray-600 dark:text-gray-400", children: "Final review before deploying on-chain" })] })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h3", { className: "font-black uppercase mb-2", children: "Monitored Wallets" }), _jsx("p", { className: "text-gray-500 dark:text-gray-400 text-xs font-mono mb-4", children: "Deployer address is automatically monitored." }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsx("input", { className: `${inp} flex-1`, placeholder: "0x...", value: newWallet, onChange: (e) => setNewWallet(e.target.value) }), _jsx("button", { className: btnPrimary + ' !px-6', onClick: () => { if (newWallet && isValidAddress(newWallet)) {
                                        addWallet(newWallet);
                                        setNewWallet('');
                                    } }, children: "ADD" })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("span", { className: "inline-flex items-center gap-2 px-3 py-1 border-2 border-black bg-[#DFFF00] font-mono text-xs font-bold text-black", children: [_jsx("span", { className: "w-2 h-2 bg-black rounded-full" }), " deployer (auto)"] }), additionalWallets.map((w) => (_jsxs("span", { className: "inline-flex items-center gap-1 px-3 py-1 border-2 border-black dark:border-white bg-white dark:bg-[#0A0A0A] font-mono text-xs font-bold", children: [w.slice(0, 8), "...", _jsx("button", { onClick: () => removeWallet(w), className: "hover:text-[#FF3333] ml-1 font-black", children: "\u00D7" })] }, w)))] })] }), _jsxs("div", { className: "mb-8", children: [_jsxs("h3", { className: "font-black uppercase mb-2", children: ["Treasury Contract ", _jsx("span", { className: "text-gray-400 font-normal lowercase", children: "(optional)" })] }), _jsx("input", { className: inp, placeholder: "0x...", value: treasuryAddress, onChange: (e) => setTreasuryAddress(e.target.value) }), _jsx("p", { className: "text-gray-400 text-xs mt-1.5 font-mono", children: "Enables Signal S2: treasury drain monitoring" })] }), _jsxs("div", { className: "p-6 border-4 border-black dark:border-white bg-gray-100 dark:bg-[#0A0A0A] mb-8 font-mono text-sm space-y-2.5", children: [_jsx("h4", { className: "font-black text-lg uppercase font-sans mb-4 border-b-2 border-black dark:border-white pb-2", children: "Transaction Summary" }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-500 dark:text-gray-400", children: "Pool" }), _jsxs("span", { className: "font-bold", children: [tokenInfo?.symbol ?? 'TOKEN', " / ", poolConfig?.pairToken ?? 'USDC', " \u00B7 ", selectedFeeTier, "% fee"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-500 dark:text-gray-400", children: "Liquidity" }), _jsxs("span", { className: "font-black", children: [tokenAmount || '0', " ", tokenInfo?.symbol ?? 'TOKEN', " + ", pairAmount || '0', " ", poolConfig?.pairToken ?? 'USDC'] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-500 dark:text-gray-400", children: "Chain" }), _jsx("span", { children: "Unichain Sepolia (1301)" })] }), computedPoolId && _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-500 dark:text-gray-400", children: "Pool ID" }), _jsxs("span", { className: "text-xs", children: [computedPoolId.slice(0, 18), "..."] })] }), _jsx("div", { className: "h-1 w-full bg-black dark:bg-white my-3" }), milestones.map((m, i) => (_jsxs("div", { className: "flex justify-between", children: [_jsxs("span", { className: "text-gray-500 dark:text-gray-400", children: ["Milestone ", i + 1] }), _jsxs("span", { children: [m.type, " ", m.type === 'USERS' ? m.threshold.toLocaleString() : `$${m.threshold.toLocaleString()}`, " \u2192 ", _jsxs("strong", { children: [m.unlockPercentage, "%"] })] })] }, i))), _jsx("div", { className: "h-1 w-full bg-black dark:bg-white my-3" }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-500 dark:text-gray-400", children: "Wallets" }), _jsxs("span", { children: ["deployer + ", additionalWallets.length] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-500 dark:text-gray-400", children: "Lock Extension" }), _jsx("span", { children: "30 days on trigger" })] })] }), _jsx("div", { className: "space-y-3 mb-8", children: [
                        { key: 'approve', label: 'APPROVE TOKENS', desc: 'Approve project + pair tokens for the liquidity router', chain: 'UNICHAIN', hashKeys: ['approve0', 'approve1'] },
                        { key: 'init-pool', label: 'INITIALIZE POOL', desc: 'Create Uniswap v4 pool with VestingHook attached', chain: 'UNICHAIN', hashKeys: ['initPool'] },
                        { key: 'register', label: 'REGISTER POSITION', desc: 'Register milestones on VestingHook', chain: 'UNICHAIN', hashKeys: ['register'] },
                        { key: 'add-liq', label: 'ADD LIQUIDITY', desc: 'Deposit tokens → LP locked in vault via hook', chain: 'UNICHAIN', hashKeys: ['addLiq'] },
                        { key: 'rsc-register', label: 'RSC MILESTONES', desc: 'Switch to Lasna & mirror milestones on RSC', chain: 'LASNA', hashKeys: ['rscRegister'] },
                        { key: 'rsc-wallets', label: 'RSC WALLETS', desc: 'Register genesis wallets for signal detection', chain: 'LASNA', hashKeys: [] },
                    ].map((step, i) => {
                        const isActive = txStep === step.key;
                        const order = ['approve', 'init-pool', 'register', 'add-liq', 'rsc-register', 'rsc-wallets', 'done'];
                        const isPast = order.indexOf(txStep) > order.indexOf(step.key);
                        const hasHash = step.hashKeys.some(k => txHashes[k]);
                        return (_jsxs("div", { className: `p-4 border-4 flex items-center gap-4 transition-all ${isActive ? 'border-[#DFFF00] bg-[#DFFF00]/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : isPast || hasHash ? 'border-black dark:border-white bg-white dark:bg-[#111]' : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-[#111] opacity-40'}`, children: [_jsx("div", { className: `w-10 h-10 border-4 border-black flex items-center justify-center font-black text-sm shrink-0 ${isPast || hasHash ? 'bg-[#DFFF00] text-black' : isActive ? 'bg-black text-[#DFFF00]' : 'bg-white dark:bg-[#1A1A1A]'}`, children: isPast || hasHash ? _jsx(CheckCircle, { className: "w-5 h-5" }) : isActive ? _jsx(Loader2, { className: "w-5 h-5 animate-spin" }) : String(i + 1).padStart(2, '0') }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-black text-sm", children: step.label }), _jsx("span", { className: `text-[10px] font-mono font-bold px-2 py-0.5 border-2 border-black ${step.chain === 'LASNA' ? 'bg-black text-[#DFFF00]' : 'bg-white dark:bg-[#111] dark:border-white'}`, children: step.chain })] }), _jsx("p", { className: "text-gray-500 dark:text-gray-400 text-xs font-mono mt-0.5", children: step.desc }), step.hashKeys.map(k => txHashes[k] && (_jsxs("a", { href: `${step.chain === 'UNICHAIN' ? 'https://sepolia.uniscan.xyz' : 'https://lasna.reactscan.net'}/tx/${txHashes[k]}`, target: "_blank", rel: "noopener noreferrer", className: "text-xs font-mono font-bold hover:underline inline-block mt-1", children: ["\u2713 ", txHashes[k].slice(0, 14), "... \u2197"] }, k)))] })] }, step.key));
                    }) }), txStep === 'done' && (_jsx("div", { className: "p-5 border-4 border-black bg-[#DFFF00] mb-6 text-black", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(CheckCircle, { size: 32, className: "stroke-[3]" }), _jsxs("div", { children: [_jsx("p", { className: "font-black text-xl uppercase", children: "Pool Launched Successfully!" }), _jsx("p", { className: "font-mono text-sm mt-1", children: "Your LP is locked in the vault and monitored by the RSC." }), computedPoolId && _jsxs("p", { className: "font-mono text-xs mt-2", children: ["Pool ID: ", computedPoolId.slice(0, 22), "..."] }), _jsx("a", { href: `/verify/${address}`, className: "font-bold underline text-sm mt-1 inline-block", children: "Verify on Dashboard \u2192" })] })] }) })), txError && (_jsx("div", { className: "p-4 border-4 border-[#FF3333] bg-white dark:bg-[#111] mb-6", children: _jsx("p", { className: "text-[#FF3333] font-mono font-bold", children: txError }) })), _jsxs("label", { className: "flex items-start gap-3 p-4 border-4 border-black dark:border-white bg-white dark:bg-[#0A0A0A] cursor-pointer hover:bg-gray-50 dark:hover:bg-[#111] transition", children: [_jsx("input", { type: "checkbox", checked: understood, onChange: (e) => setUnderstood(e.target.checked), className: "mt-1 accent-black dark:accent-[#DFFF00] w-5 h-5" }), _jsxs("span", { className: "font-mono text-sm", children: ["I understand my LP tokens will be held in Proven's vault and can ", _jsx("strong", { children: "only be released" }), " by meeting the milestones above."] })] }), _jsxs("div", { className: "flex justify-between gap-3 mt-8 pt-6 border-t-4 border-black dark:border-white", children: [_jsx("button", { className: btnSecondary, onClick: () => setCurrentStep(2), disabled: txStep !== 'idle' && txStep !== 'error' && txStep !== 'done', children: "\u2190 Back" }), _jsx("button", { className: `${btnPrimary} ${(!understood || !isConnected || txStep === 'done') ? 'opacity-40 cursor-not-allowed' : ''}`, disabled: !understood || !isConnected || (txStep !== 'idle' && txStep !== 'error'), onClick: handleSign, children: txStep === 'idle' || txStep === 'error' ? (_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Lock, { className: "w-5 h-5 stroke-[3]" }), isConnected ? (isWrongNetwork ? 'Switch to Unichain Sepolia' : 'SIGN & DEPLOY') : 'CONNECT WALLET'] })) : txStep === 'done' ? (_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(CheckCircle, { className: "w-5 h-5" }), " COMPLETE"] })) : (_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Loader2, { className: "w-5 h-5 animate-spin" }), " PROCESSING..."] })) })] })] }) }));
    return (_jsx("div", { className: "min-h-screen bg-white dark:bg-[#0A0A0A] text-black dark:text-white", children: _jsxs("div", { className: "max-w-4xl mx-auto px-6 py-12", children: [_jsxs("div", { className: "text-center mb-10", children: [_jsx("span", { className: "inline-block bg-black text-[#DFFF00] font-black uppercase text-xs px-4 py-1 border-2 border-black mb-4", children: "TEAM FLOW" }), _jsx("h1", { className: "text-4xl md:text-5xl font-black uppercase tracking-tighter", children: "Launch Your Pool" }), _jsx("p", { className: "font-mono text-gray-600 dark:text-gray-400 mt-2", children: "Deploy performance-vested liquidity on Uniswap v4" })] }), _jsx("div", { className: "mb-12", children: _jsx("div", { className: "flex items-center justify-between max-w-lg mx-auto", children: steps.map((step, i) => (_jsxs("div", { className: "flex items-center", children: [_jsxs("div", { className: "flex flex-col items-center", children: [_jsx("button", { onClick: () => step.num < currentStep && setCurrentStep(step.num), className: `w-14 h-14 border-4 border-black dark:border-white flex items-center justify-center font-black text-sm transition-all ${step.num === currentStep
                                                ? 'bg-[#DFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                                : step.num < currentStep
                                                    ? 'bg-black text-[#DFFF00]'
                                                    : 'bg-gray-200 dark:bg-[#1A1A1A] text-gray-400'}`, children: step.num < currentStep ? _jsx(CheckCircle, { className: "w-5 h-5" }) : _jsx(step.icon, { className: "w-5 h-5 stroke-[2.5]" }) }), _jsx("span", { className: `text-xs mt-2 font-bold uppercase tracking-wider ${step.num <= currentStep ? '' : 'text-gray-400'}`, children: step.label })] }), i < steps.length - 1 && (_jsx("div", { className: `w-20 h-1 mx-3 mb-6 border-t-4 ${step.num < currentStep ? 'border-black dark:border-white' : 'border-gray-300 dark:border-gray-600 border-dashed'}` }))] }, step.num))) }) }), currentStep === 1 && renderStep1(), currentStep === 2 && renderStep2(), currentStep === 3 && renderStep3()] }) }));
}

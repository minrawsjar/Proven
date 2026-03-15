import { useState } from 'react'
import { useLaunchStore } from '../store/launchStore'
import { useWallet, useTokenInfo, useContractWrites } from '../hooks/useWeb3'
import { Settings, Target, PenLine, AlertTriangle, Lightbulb, Eye, Lock, CheckCircle, Loader2 } from 'lucide-react'
import { isValidAddress } from '../utils/format'
import { VESTING_HOOK_ADDRESS, RISK_GUARD_RSC_ADDRESS, POOL_MODIFY_LIQUIDITY_TEST_ADDRESS } from '../config/constants'
import { buildPoolKey, computePoolId, computeSqrtPriceX96, fullRangeTicks, sortTokens } from '../utils/pool'
import { parseUnits } from 'viem'

export function LaunchPool() {
  const {
    currentStep,
    setCurrentStep,
    poolConfig,
    setPoolConfig,
    milestones,
    setMilestones,
    additionalWallets,
    addWallet,
    removeWallet,
    treasuryAddress,
    setTreasuryAddress,
  } = useLaunchStore()

  const { address, isConnected, isWrongNetwork, ensureCorrectNetwork } = useWallet()
  const {
    registerVestingPosition,
    registerMilestonesOnRSC,
    addGenesisWallet,
    setTreasuryAddressOnRSC,
    approveToken,
    initializePool,
    addLiquidity,
    switchToLasna,
    switchToUnichain,
  } = useContractWrites()

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [newWallet, setNewWallet] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [selectedFeeTier, setSelectedFeeTier] = useState(0.3)
  const [customPairTokenAddress, setCustomPairTokenAddress] = useState('')

  const [tokenAmount, setTokenAmount] = useState('')
  const [pairAmount, setPairAmount] = useState('')

  const [txStep, setTxStep] = useState<
    'idle' | 'approve' | 'init-pool' | 'register' | 'add-liq' | 'rsc-register' | 'rsc-wallets' | 'done' | 'error'
  >('idle')
  const [txHashes, setTxHashes] = useState<Record<string, string>>({})
  const [txError, setTxError] = useState<string | null>(null)
  const [computedPoolId, setComputedPoolId] = useState<`0x${string}` | null>(null)

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
  const UNICHAIN_USDC_ADDRESS = '0x11aFfEac94B440C3c332813450db66fb3285BFB2'
  const pairSelection = poolConfig?.pairToken ?? 'USDC'

  const resolvedPairTokenAddress = (
    pairSelection === 'WETH'
      ? ZERO_ADDRESS
      : pairSelection === 'Custom'
      ? customPairTokenAddress
      : UNICHAIN_USDC_ADDRESS
  ) as `0x${string}`

  const tokenAddr = poolConfig?.tokenAddress as `0x${string}` | undefined
  const { info: tokenInfo, loading: tokenLoading } = useTokenInfo(
    tokenAddr && isValidAddress(tokenAddr) ? tokenAddr : undefined,
  )
  const { info: pairTokenInfo, loading: pairTokenLoading } = useTokenInfo(
    resolvedPairTokenAddress !== ZERO_ADDRESS && isValidAddress(resolvedPairTokenAddress)
      ? resolvedPairTokenAddress
      : undefined,
  )

  const pairTokenSymbol =
    pairSelection === 'WETH'
      ? 'WETH'
      : pairTokenInfo?.symbol ?? (pairSelection === 'USDC' ? 'USDC' : 'CUSTOM')

  const MIN_TVL_VOLUME_THRESHOLD = 100

  const getMilestoneValidationError = () => {
    for (const [idx, m] of milestones.entries()) {
      if (!Number.isFinite(m.threshold) || m.threshold <= 0) {
        return `Milestone ${idx + 1}: threshold must be greater than 0`
      }

      if ((m.type === 'TVL' || m.type === 'VOLUME') && m.threshold < MIN_TVL_VOLUME_THRESHOLD) {
        return `Milestone ${idx + 1}: ${m.type} threshold must be at least ${MIN_TVL_VOLUME_THRESHOLD}`
      }
    }

    return null
  }

  if (milestones.length === 0) {
    setMilestones([
      { id: '1', type: 'TVL', threshold: 1000000, unlockPercentage: 25, isComplete: false },
      { id: '2', type: 'VOLUME', threshold: 5000000, unlockPercentage: 50, isComplete: false },
      { id: '3', type: 'USERS', threshold: 5000, unlockPercentage: 25, isComplete: false },
    ])
  }

  const handleStep1Submit = () => {
    if (!poolConfig?.projectName || !poolConfig?.tokenAddress) {
      setFormErrors({ general: 'Please fill in all required fields' })
      return
    }
    if (!isValidAddress(poolConfig.tokenAddress)) {
      setFormErrors({ general: 'Invalid token address' })
      return
    }
    if (pairSelection === 'Custom' && !isValidAddress(customPairTokenAddress)) {
      setFormErrors({ general: 'Invalid custom pair token address' })
      return
    }
    if (treasuryAddress && !isValidAddress(treasuryAddress)) {
      setFormErrors({ general: 'Invalid treasury contract address' })
      return
    }
    setCurrentStep(2)
    setFormErrors({})
  }

  const totalUnlock = milestones.reduce((sum, m) => sum + m.unlockPercentage, 0)
  const milestoneValidationError = getMilestoneValidationError()
  const canProceedStep2 = totalUnlock === 100 && !milestoneValidationError

  /* ═══════════════ handleSign — all contract logic preserved exactly ═══════════════ */
  const handleSign = async () => {
    if (!isConnected || !address) { setTxError('Connect your wallet first'); return }
    if (isWrongNetwork) { ensureCorrectNetwork(); return }
    if (VESTING_HOOK_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setTxError(
        `VestingHook not deployed yet — VITE_HOOK_ADDRESS=${VESTING_HOOK_ADDRESS}. ` +
        'Set VITE_HOOK_ADDRESS in your .env or Vercel Environment Variables and rebuild/redeploy.'
      )
      return
    }

    const projectToken = poolConfig!.tokenAddress as `0x${string}`
    if (pairSelection === 'Custom' && !isValidAddress(customPairTokenAddress)) {
      setTxError('Invalid custom pair token address')
      return
    }
    if (treasuryAddress && !isValidAddress(treasuryAddress)) {
      setTxError('Invalid treasury contract address')
      return
    }

    const pairTokenAddr = resolvedPairTokenAddress

    const decimals = tokenInfo?.decimals ?? 18
    const pairDecimals = pairSelection === 'WETH'
      ? 18
      : pairTokenInfo?.decimals ?? (pairSelection === 'USDC' ? 6 : 18)

    if (milestoneValidationError) {
      setTxError(milestoneValidationError)
      setTxStep('error')
      return
    }

    const tokenAmt = parseUnits(tokenAmount || '1000', decimals)
    const pairAmt = parseUnits(pairAmount || '1000', pairDecimals)

    const basePoolKey = buildPoolKey(projectToken, pairTokenAddr, selectedFeeTier)

    // Per-user pool isolation:
    // Uniswap v4 pool identity includes fee. We derive a deterministic fee variant
    // from the wallet address so each team gets a separate pool even with the same
    // token pair + hook + tick spacing.
    const addrInt = BigInt(address)
    const feeOffset = Number(addrInt % 997n) + 1 // 1..997 (prime modulus to reduce clustering)
    const uniqueFee = basePoolKey.fee + feeOffset
    const poolKey = {
      ...basePoolKey,
      fee: uniqueFee,
    }
    const poolId = computePoolId(poolKey)
    setComputedPoolId(poolId)

    const { isToken0 } = sortTokens(projectToken, pairTokenAddr)
    const sqrtPrice = isToken0
      ? computeSqrtPriceX96(tokenAmt, pairAmt)
      : computeSqrtPriceX96(pairAmt, tokenAmt)

    const { tickLower, tickUpper } = fullRangeTicks(poolKey.tickSpacing)
    const liquidityDelta = tokenAmt > 0n ? tokenAmt : 1000000000000000000n

    setTxError(null)
    setTxHashes({})

    try {
      setTxStep('approve')
      const router = POOL_MODIFY_LIQUIDITY_TEST_ADDRESS as `0x${string}`
      // Approve only the exact amounts needed (safer than unlimited allowance)
      const r1 = await approveToken(projectToken, router, tokenAmt)
      setTxHashes(p => ({ ...p, approve0: r1.transactionHash }))
      if (pairTokenAddr !== ZERO_ADDRESS) {
        const r2 = await approveToken(pairTokenAddr, router, pairAmt)
        setTxHashes(p => ({ ...p, approve1: r2.transactionHash }))
      }

      setTxStep('init-pool')
      try {
        const r3 = await initializePool(poolKey, sqrtPrice)
        setTxHashes(p => ({ ...p, initPool: r3.transactionHash }))
      } catch (err: any) {
        const msg = String(err?.shortMessage ?? err?.message ?? '')
        const alreadyInitialized =
          /already initialized|PoolAlreadyInitialized|execution reverted/i.test(msg)

        if (!alreadyInitialized) throw err

        // Pool was already initialized in a previous tx; continue with register + liquidity.
        setTxHashes(p => ({ ...p, initPool: 'already-initialized' }))
      }

      setTxStep('register')
      // Scale TVL/VOLUME thresholds to pair token decimals before sending on-chain
      const scaledMilestones = milestones.map((m) => {
        if (m.type === 'TVL' || m.type === 'VOLUME') {
          const base = BigInt(Math.floor(m.threshold))
          const scaled = base * 10n ** BigInt(pairDecimals)

          // Safety guard: reject suspiciously tiny on-chain thresholds
          // that can auto-unlock immediately due to unit mismatch.
          const minScaled = BigInt(MIN_TVL_VOLUME_THRESHOLD) * 10n ** BigInt(pairDecimals)
          if (scaled < minScaled) {
            throw new Error(
              `${m.type} threshold too low after scaling (min ${MIN_TVL_VOLUME_THRESHOLD}). ` +
              'Increase TVL/Volume threshold before signing.'
            )
          }

          return { type: m.type, threshold: Number(scaled), unlockPercentage: m.unlockPercentage }
        }
        // USERS stays as a plain integer
        return { type: m.type, threshold: Math.floor(m.threshold), unlockPercentage: m.unlockPercentage }
      })

      const r4 = await registerVestingPosition(
        scaledMilestones.map(m => ({ type: m.type, threshold: m.threshold, unlockPercentage: m.unlockPercentage })),
        projectToken, poolId,
      )
      setTxHashes(p => ({ ...p, register: r4.transactionHash }))

      setTxStep('add-liq')
      const r5 = await addLiquidity(poolKey, tickLower, tickUpper, liquidityDelta)
      setTxHashes(p => ({ ...p, addLiq: r5.transactionHash }))

      setTxStep('rsc-register')
      if (RISK_GUARD_RSC_ADDRESS !== '0x0000000000000000000000000000000000000000') {
        await switchToLasna()
        const r6 = await registerMilestonesOnRSC(
          poolId, address as `0x${string}`,
          projectToken,
          address as `0x${string}`,
          scaledMilestones.map(m => ({ type: m.type, threshold: m.threshold, unlockPercentage: m.unlockPercentage })),
        )
        setTxHashes(p => ({ ...p, rscRegister: r6.transactionHash }))

        const treasuryAddr = (treasuryAddress && isValidAddress(treasuryAddress)
          ? treasuryAddress
          : ZERO_ADDRESS) as `0x${string}`
        const r6b = await setTreasuryAddressOnRSC(address as `0x${string}`, treasuryAddr)
        setTxHashes(p => ({ ...p, rscTreasury: r6b.transactionHash }))
      }

      setTxStep('rsc-wallets')
      try { await addGenesisWallet(address as `0x${string}`, address as `0x${string}`) }
      catch { console.warn('addGenesisWallet failed for deployer') }
      for (const w of additionalWallets) {
        if (isValidAddress(w)) {
          try { await addGenesisWallet(address as `0x${string}`, w as `0x${string}`) }
          catch { console.warn('addGenesisWallet failed for', w) }
        }
      }
      try { await switchToUnichain() } catch { console.warn('Failed to switch back') }

      setTxStep('done')
    } catch (err: any) {
      console.error('Transaction failed:', err)
      setTxError(err?.shortMessage ?? err?.message ?? 'Transaction rejected')
      setTxStep('error')
    }
  }

  /* ── reusable class strings ── */
  const inp = "w-full bg-white dark:bg-[#111] border-4 border-black dark:border-white px-4 py-3 font-mono text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-shadow"
  const btnPrimary = "font-bold uppercase tracking-wide border-4 border-black px-8 py-3 bg-[#DFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:translate-x-0 active:shadow-none transition-all"
  const btnSecondary = "font-bold uppercase tracking-wide border-4 border-black dark:border-white px-8 py-3 bg-white dark:bg-[#111] text-black dark:text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] active:translate-y-0 active:translate-x-0 active:shadow-none transition-all"

  const steps = [
    { num: 1, label: 'POOL CONFIG', icon: Settings },
    { num: 2, label: 'MILESTONES', icon: Target },
    { num: 3, label: 'REVIEW & SIGN', icon: PenLine },
  ]

  /* ═══════════════ STEP 1 ═══════════════ */
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#111] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-8">
        <div className="flex items-center gap-4 mb-8 border-b-4 border-black dark:border-white pb-4">
          <Settings size={32} className="stroke-[2]" />
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Pool Configuration</h2>
            <p className="font-mono text-gray-600 dark:text-gray-400">Set up your Uniswap v4 pool basics</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block font-bold uppercase tracking-wider text-sm mb-2">Project Name</label>
            <input className={inp} placeholder="e.g., Nova Protocol" value={poolConfig?.projectName || ''} onChange={(e) => setPoolConfig({ ...poolConfig, projectName: e.target.value } as any)} />
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1.5 font-mono">Shows on investor dashboards</p>
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-sm mb-2">Token Address (Unichain Sepolia)</label>
            <input className={inp} placeholder="0x..." value={poolConfig?.tokenAddress || ''} onChange={(e) => setPoolConfig({ ...poolConfig, tokenAddress: e.target.value } as any)} />
            {tokenLoading && (
              <div className="mt-3 p-3 border-4 border-black dark:border-white bg-gray-100 dark:bg-[#1A1A1A] flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="font-mono text-sm">Reading token data...</span>
              </div>
            )}
            {tokenInfo && (
              <div className="mt-3 p-3 border-4 border-black bg-[#DFFF00] flex items-center gap-3 font-mono text-sm text-black">
                <span className="font-black">✓</span>
                <span className="font-bold">{tokenInfo.symbol}</span>
                <span>•</span>
                <span>{tokenInfo.name}</span>
                <span>•</span>
                <span>Supply: {(Number(tokenInfo.totalSupply) / 10 ** tokenInfo.decimals).toLocaleString()}</span>
              </div>
            )}
            {poolConfig?.tokenAddress && isValidAddress(poolConfig.tokenAddress) && !tokenLoading && !tokenInfo && (
              <div className="mt-3 p-3 border-4 border-[#FF3333] bg-white dark:bg-[#111] font-mono text-sm text-[#FF3333]">
                ⚠ Token not found on Unichain Sepolia
              </div>
            )}
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-sm mb-2">Pair Token</label>
            <div className="grid grid-cols-3 gap-3">
              {['USDC', 'WETH', 'Custom'].map((token) => (
                <button key={token} className={`p-3 border-4 border-black dark:border-white font-bold uppercase text-sm transition-all ${pairSelection === token ? 'bg-[#DFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-white dark:bg-[#111] hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'}`} onClick={() => setPoolConfig({ ...poolConfig, pairToken: token } as any)}>
                  {token}
                </button>
              ))}
            </div>

            {pairSelection === 'Custom' && (
              <div className="mt-4">
                <input
                  className={inp}
                  placeholder="Custom pair token address (0x...)"
                  value={customPairTokenAddress}
                  onChange={(e) => setCustomPairTokenAddress(e.target.value)}
                />
                {pairTokenLoading && (
                  <div className="mt-3 p-3 border-4 border-black dark:border-white bg-gray-100 dark:bg-[#1A1A1A] flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="font-mono text-sm">Reading pair token data...</span>
                  </div>
                )}
                {pairTokenInfo && (
                  <div className="mt-3 p-3 border-4 border-black bg-[#DFFF00] flex items-center gap-3 font-mono text-sm text-black">
                    <span className="font-black">✓</span>
                    <span className="font-bold">{pairTokenInfo.symbol}</span>
                    <span>•</span>
                    <span>{pairTokenInfo.name}</span>
                    <span>•</span>
                    <span>Decimals: {pairTokenInfo.decimals}</span>
                  </div>
                )}
                {customPairTokenAddress && isValidAddress(customPairTokenAddress) && !pairTokenLoading && !pairTokenInfo && (
                  <div className="mt-3 p-3 border-4 border-[#FF3333] bg-white dark:bg-[#111] font-mono text-sm text-[#FF3333]">
                    ⚠ Pair token not found on Unichain Sepolia
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-sm mb-2">Fee Tier</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 0.05, label: '0.05%', desc: 'Stablecoin pairs', recommended: false },
                { value: 0.3, label: '0.3%', desc: 'Standard launches', recommended: true },
                { value: 1.0, label: '1%', desc: 'High volatility', recommended: false },
              ].map((tier) => (
                <button key={tier.value} className={`p-4 border-4 border-black dark:border-white text-left transition-all relative ${selectedFeeTier === tier.value ? 'bg-[#DFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-white dark:bg-[#111] hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'}`} onClick={() => setSelectedFeeTier(tier.value)}>
                  {tier.recommended && <span className="absolute -top-3 right-2 bg-black text-[#DFFF00] text-[10px] font-black uppercase px-2 py-0.5">REC</span>}
                  <div className="font-black text-xl">{tier.label}</div>
                  <div className="text-gray-600 dark:text-gray-400 text-xs font-mono mt-1">{tier.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-sm mb-2">Initial Liquidity</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input className={inp} placeholder="Token amount" value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 font-mono">{tokenInfo?.symbol ?? 'TOKEN'}</p>
              </div>
              <div>
                <input className={inp} placeholder="Pair amount" value={pairAmount} onChange={(e) => setPairAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 font-mono">{pairTokenSymbol}</p>
              </div>
            </div>
            {(tokenAmount || pairAmount) && (
              <div className="mt-3 p-3 border-4 border-black bg-[#DFFF00] text-center font-mono font-bold text-black">
                {tokenAmount || '0'} {tokenInfo?.symbol ?? 'TOKEN'} + {pairAmount || '0'} {pairTokenSymbol}
              </div>
            )}
          </div>

          <div className="p-5 border-4 border-[#FF3333] bg-white dark:bg-[#111] relative">
            <div className="absolute top-0 left-0 w-2 h-full bg-[#FF3333]" />
            <div className="flex items-start gap-3 ml-3">
              <AlertTriangle className="w-6 h-6 text-[#FF3333] flex-shrink-0 stroke-[3]" />
              <div>
                <p className="font-black text-[#FF3333] uppercase mb-1">Critical — Read Before Proceeding</p>
                <p className="text-gray-700 dark:text-gray-300 font-mono text-sm">
                  Once you add liquidity, these tokens go into Proven's vault. You <strong>cannot withdraw</strong> them until your milestones are met.
                </p>
              </div>
            </div>
          </div>

          {formErrors.general && <p className="text-[#FF3333] font-mono font-bold">{formErrors.general}</p>}
        </div>

        <div className="flex justify-end mt-8 pt-6 border-t-4 border-black dark:border-white">
          <button className={btnPrimary} onClick={handleStep1Submit}>Next: Milestones →</button>
        </div>
      </div>
    </div>
  )

  /* ═══════════════ STEP 2 ═══════════════ */
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#111] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-8">
        <div className="flex items-center gap-4 mb-8 border-b-4 border-black dark:border-white pb-4">
          <Target size={32} className="stroke-[2]" />
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Milestone Builder</h2>
            <p className="font-mono text-gray-600 dark:text-gray-400">Define on-chain conditions that unlock your liquidity</p>
          </div>
        </div>

        {/* Unlock Distribution Bar */}
        <div className="p-5 border-4 border-black dark:border-white mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold uppercase text-sm">Unlock Distribution</span>
            <span className={`font-mono font-black text-lg ${totalUnlock === 100 ? '' : 'text-[#FF3333]'}`}>
              {totalUnlock === 100 ? '✓ ' : ''}{totalUnlock}%
            </span>
          </div>
          <div className="h-6 bg-gray-200 dark:bg-[#1A1A1A] border-4 border-black dark:border-white overflow-hidden flex">
            {milestones.map((m, i) => (
              <div key={i} style={{ width: `${m.unlockPercentage}%` }} className={`transition-all duration-500 ${i === 0 ? 'bg-[#DFFF00]' : i === 1 ? 'bg-black dark:bg-white' : 'bg-gray-500'}`} />
            ))}
            {totalUnlock < 100 && <div style={{ width: `${100 - totalUnlock}%` }} className="bg-gray-200 dark:bg-[#1A1A1A]" />}
          </div>
          {totalUnlock !== 100 && <p className="text-[#FF3333] text-xs mt-2 font-mono font-bold">Must equal exactly 100% to proceed</p>}
          {milestoneValidationError && <p className="text-[#FF3333] text-xs mt-2 font-mono font-bold">{milestoneValidationError}</p>}
        </div>

        {/* Milestone Cards */}
        <div className="space-y-4 mb-8">
          {milestones.map((m, i) => (
            <div key={i} className="p-5 border-4 border-black dark:border-white bg-white dark:bg-[#0A0A0A] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] transition-all">
              <div className="flex items-center gap-3 mb-4">
                <span className={`font-black text-xl ${i === 0 ? 'bg-[#DFFF00] text-black' : i === 1 ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-gray-200 dark:bg-[#1A1A1A]'} px-3 py-1 border-2 border-black dark:border-white`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-black uppercase">Milestone {i + 1}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">Condition</label>
                  <select className={`${inp} !py-2.5`} value={m.type} onChange={(e) => { const u = [...milestones]; u[i] = { ...m, type: e.target.value as any }; setMilestones(u) }}>
                    <option value="TVL">TVL</option>
                    <option value="VOLUME">Trading Volume</option>
                    <option value="USERS">Unique Users</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">Threshold</label>
                  <input className={`${inp} !py-2.5`} placeholder={m.type === 'USERS' ? '5,000' : '$1,000,000'} value={m.threshold.toLocaleString()} onChange={(e) => { const u = [...milestones]; u[i] = { ...m, threshold: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 }; setMilestones(u) }} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5">Unlock %</label>
                  <input type="range" min="1" max="100" value={m.unlockPercentage} onChange={(e) => { const u = [...milestones]; u[i] = { ...m, unlockPercentage: parseInt(e.target.value) }; setMilestones(u) }} className="w-full accent-black dark:accent-[#DFFF00] mt-2" />
                  <div className="flex justify-between text-xs mt-1">
                    <span className="font-mono font-black">{m.unlockPercentage}%</span>
                    <span className="text-gray-400 font-mono">${((m.unlockPercentage / 100) * 250000).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              {i === 0 && <p className="text-gray-400 text-xs mt-3 font-mono flex items-center gap-1.5"><Lightbulb className="w-3 h-3 flex-shrink-0" /> Set realistic TVL goals for Unichain Sepolia</p>}
            </div>
          ))}
        </div>

        {/* Investor Preview */}
        <div className="p-5 border-4 border-black bg-[#DFFF00] text-black">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-4 h-4" />
            <span className="font-black uppercase text-sm">Investor Preview</span>
          </div>
          <div className="space-y-3">
            {milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-3 font-mono text-sm">
                <span className="w-6 h-6 border-2 border-black flex items-center justify-center text-xs font-black">{i + 1}</span>
                <span>{m.type === 'TVL' ? 'TVL' : m.type === 'VOLUME' ? 'Volume' : 'Users'} reaches {m.type === 'USERS' ? m.threshold.toLocaleString() : `$${m.threshold.toLocaleString()}`}</span>
                <span className="ml-auto font-black">→ {m.unlockPercentage}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between gap-3 mt-8 pt-6 border-t-4 border-black dark:border-white">
          <button className={btnSecondary} onClick={() => setCurrentStep(1)}>← Back</button>
          <button className={`${btnPrimary} ${!canProceedStep2 ? 'opacity-40 cursor-not-allowed' : ''}`} onClick={() => setCurrentStep(3)} disabled={!canProceedStep2}>Next: Review →</button>
        </div>
      </div>
    </div>
  )

  /* ═══════════════ STEP 3 ═══════════════ */
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#111] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-8">
        <div className="flex items-center gap-4 mb-8 border-b-4 border-black dark:border-white pb-4">
          <PenLine size={32} className="stroke-[2]" />
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Review & Confirm</h2>
            <p className="font-mono text-gray-600 dark:text-gray-400">Final review before deploying on-chain</p>
          </div>
        </div>

        {/* Monitored Wallets */}
        <div className="mb-8">
          <h3 className="font-black uppercase mb-2">Monitored Wallets</h3>
          <p className="text-gray-500 dark:text-gray-400 text-xs font-mono mb-4">Deployer address is automatically monitored.</p>
          <div className="flex gap-2 mb-3">
            <input className={`${inp} flex-1`} placeholder="0x..." value={newWallet} onChange={(e) => setNewWallet(e.target.value)} />
            <button className={btnPrimary + ' !px-6'} onClick={() => { if (newWallet && isValidAddress(newWallet)) { addWallet(newWallet); setNewWallet('') } }}>ADD</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black bg-[#DFFF00] font-mono text-xs font-bold text-black">
              <span className="w-2 h-2 bg-black rounded-full" /> deployer (auto)
            </span>
            {additionalWallets.map((w) => (
              <span key={w} className="inline-flex items-center gap-1 px-3 py-1 border-2 border-black dark:border-white bg-white dark:bg-[#0A0A0A] font-mono text-xs font-bold">
                {w.slice(0, 8)}...
                <button onClick={() => removeWallet(w)} className="hover:text-[#FF3333] ml-1 font-black">×</button>
              </span>
            ))}
          </div>
        </div>

        {/* Treasury */}
        <div className="mb-8">
          <h3 className="font-black uppercase mb-2">Treasury Contract <span className="text-gray-400 font-normal lowercase">(optional)</span></h3>
          <input className={inp} placeholder="0x..." value={treasuryAddress ?? ''} onChange={(e) => setTreasuryAddress(e.target.value.trim() ? e.target.value : null)} />
          <p className="text-gray-400 text-xs mt-1.5 font-mono">Enables Signal S5: treasury drain monitoring</p>
        </div>

        {/* Summary */}
        <div className="p-6 border-4 border-black dark:border-white bg-gray-100 dark:bg-[#0A0A0A] mb-8 font-mono text-sm space-y-2.5">
          <h4 className="font-black text-lg uppercase font-sans mb-4 border-b-2 border-black dark:border-white pb-2">Transaction Summary</h4>
          <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Pool</span><span className="font-bold">{tokenInfo?.symbol ?? 'TOKEN'} / {pairTokenSymbol} · {selectedFeeTier}% fee</span></div>
          <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Liquidity</span><span className="font-black">{tokenAmount || '0'} {tokenInfo?.symbol ?? 'TOKEN'} + {pairAmount || '0'} {pairTokenSymbol}</span></div>
          <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Chain</span><span>Unichain Sepolia (1301)</span></div>
          {computedPoolId && <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Pool ID</span><span className="text-xs">{computedPoolId.slice(0, 18)}...</span></div>}
          <div className="h-1 w-full bg-black dark:bg-white my-3" />
          {milestones.map((m, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Milestone {i + 1}</span>
              <span>{m.type} {m.type === 'USERS' ? m.threshold.toLocaleString() : `$${m.threshold.toLocaleString()}`} → <strong>{m.unlockPercentage}%</strong></span>
            </div>
          ))}
          <div className="h-1 w-full bg-black dark:bg-white my-3" />
          <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Wallets</span><span>deployer + {additionalWallets.length}</span></div>
          <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Lock Extension</span><span>30 days on trigger</span></div>
        </div>

        {/* Transaction Steps */}
        <div className="space-y-3 mb-8">
          {[
            { key: 'approve', label: 'APPROVE TOKENS', desc: 'Approve project + pair tokens for the liquidity router', chain: 'UNICHAIN', hashKeys: ['approve0', 'approve1'] },
            { key: 'init-pool', label: 'INITIALIZE POOL', desc: 'Create Uniswap v4 pool with VestingHook attached', chain: 'UNICHAIN', hashKeys: ['initPool'] },
            { key: 'register', label: 'REGISTER POSITION', desc: 'Register milestones on VestingHook', chain: 'UNICHAIN', hashKeys: ['register'] },
            { key: 'add-liq', label: 'ADD LIQUIDITY', desc: 'Deposit tokens → LP locked in vault via hook', chain: 'UNICHAIN', hashKeys: ['addLiq'] },
            { key: 'rsc-register', label: 'RSC MILESTONES', desc: 'Switch to Lasna, mirror milestones, and set treasury on RSC', chain: 'LASNA', hashKeys: ['rscRegister', 'rscTreasury'] },
            { key: 'rsc-wallets', label: 'RSC WALLETS', desc: 'Register genesis wallets for signal detection', chain: 'LASNA', hashKeys: [] },
          ].map((step, i) => {
            const isActive = txStep === step.key
            const order = ['approve', 'init-pool', 'register', 'add-liq', 'rsc-register', 'rsc-wallets', 'done']
            const isPast = order.indexOf(txStep) > order.indexOf(step.key)
            const hasHash = step.hashKeys.some(k => txHashes[k])
            return (
              <div key={step.key} className={`p-4 border-4 flex items-center gap-4 transition-all ${isActive ? 'border-[#DFFF00] bg-[#DFFF00]/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : isPast || hasHash ? 'border-black dark:border-white bg-white dark:bg-[#111]' : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-[#111] opacity-40'}`}>
                <div className={`w-10 h-10 border-4 border-black flex items-center justify-center font-black text-sm shrink-0 ${isPast || hasHash ? 'bg-[#DFFF00] text-black' : isActive ? 'bg-black text-[#DFFF00]' : 'bg-white dark:bg-[#1A1A1A]'}`}>
                  {isPast || hasHash ? <CheckCircle className="w-5 h-5" /> : isActive ? <Loader2 className="w-5 h-5 animate-spin" /> : String(i + 1).padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm">{step.label}</span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border-2 border-black ${step.chain === 'LASNA' ? 'bg-black text-[#DFFF00]' : 'bg-white dark:bg-[#111] dark:border-white'}`}>{step.chain}</span>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs font-mono mt-0.5">{step.desc}</p>
                  {step.hashKeys.map(k => txHashes[k] && (
                    <a key={k} href={`${step.chain === 'UNICHAIN' ? 'https://sepolia.uniscan.xyz' : 'https://lasna.reactscan.net'}/tx/${txHashes[k]}`} target="_blank" rel="noopener noreferrer" className="text-xs font-mono font-bold hover:underline inline-block mt-1">
                      ✓ {txHashes[k].slice(0, 14)}... ↗
                    </a>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Success */}
        {txStep === 'done' && (
          <div className="p-5 border-4 border-black bg-[#DFFF00] mb-6 text-black">
            <div className="flex items-center gap-3">
              <CheckCircle size={32} className="stroke-[3]" />
              <div>
                <p className="font-black text-xl uppercase">Pool Launched Successfully!</p>
                <p className="font-mono text-sm mt-1">Your LP is locked in the vault and monitored by the RSC.</p>
                {computedPoolId && <p className="font-mono text-xs mt-2">Pool ID: {computedPoolId.slice(0, 22)}...</p>}
                <a href={`/verify/${address}`} className="font-bold underline text-sm mt-1 inline-block">Verify on Dashboard →</a>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {txError && (
          <div className="p-4 border-4 border-[#FF3333] bg-white dark:bg-[#111] mb-6">
            <p className="text-[#FF3333] font-mono font-bold">{txError}</p>
          </div>
        )}

        {/* Checkbox */}
        <label className="flex items-start gap-3 p-4 border-4 border-black dark:border-white bg-white dark:bg-[#0A0A0A] cursor-pointer hover:bg-gray-50 dark:hover:bg-[#111] transition">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-1 accent-black dark:accent-[#DFFF00] w-5 h-5" />
          <span className="font-mono text-sm">
            I understand my LP tokens will be held in Proven's vault and can <strong>only be released</strong> by meeting the milestones above.
          </span>
        </label>

        <div className="flex justify-between gap-3 mt-8 pt-6 border-t-4 border-black dark:border-white">
          <button className={btnSecondary} onClick={() => setCurrentStep(2)} disabled={txStep !== 'idle' && txStep !== 'error' && txStep !== 'done'}>← Back</button>
          <button
            className={`${btnPrimary} ${(!understood || !isConnected || txStep === 'done') ? 'opacity-40 cursor-not-allowed' : ''}`}
            disabled={!understood || !isConnected || (txStep !== 'idle' && txStep !== 'error')}
            onClick={handleSign}
          >
            {txStep === 'idle' || txStep === 'error' ? (
              <span className="inline-flex items-center gap-2">
                <Lock className="w-5 h-5 stroke-[3]" />
                {isConnected ? (isWrongNetwork ? 'Switch to Unichain Sepolia' : 'SIGN & DEPLOY') : 'CONNECT WALLET'}
              </span>
            ) : txStep === 'done' ? (
              <span className="inline-flex items-center gap-2"><CheckCircle className="w-5 h-5" /> COMPLETE</span>
            ) : (
              <span className="inline-flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> PROCESSING...</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-black dark:text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block bg-black text-[#DFFF00] font-black uppercase text-xs px-4 py-1 border-2 border-black mb-4">TEAM FLOW</span>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Launch Your Pool</h1>
          <p className="font-mono text-gray-600 dark:text-gray-400 mt-2">Deploy performance-vested liquidity on Uniswap v4</p>
        </div>

        {/* Step Progress */}
        <div className="mb-12">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            {steps.map((step, i) => (
              <div key={step.num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => step.num < currentStep && setCurrentStep(step.num as 1 | 2 | 3)}
                    className={`w-14 h-14 border-4 border-black dark:border-white flex items-center justify-center font-black text-sm transition-all ${
                      step.num === currentStep
                        ? 'bg-[#DFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        : step.num < currentStep
                        ? 'bg-black text-[#DFFF00]'
                        : 'bg-gray-200 dark:bg-[#1A1A1A] text-gray-400'
                    }`}
                  >
                    {step.num < currentStep ? <CheckCircle className="w-5 h-5" /> : <step.icon className="w-5 h-5 stroke-[2.5]" />}
                  </button>
                  <span className={`text-xs mt-2 font-bold uppercase tracking-wider ${step.num <= currentStep ? '' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-20 h-1 mx-3 mb-6 border-t-4 ${step.num < currentStep ? 'border-black dark:border-white' : 'border-gray-300 dark:border-gray-600 border-dashed'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </div>
    </div>
  )
}

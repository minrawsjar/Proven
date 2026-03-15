import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useVerifyStore } from '../store/verifyStore.ts'
import { useWallet, usePositionData, useRiskScore, useTokenInfo, useHookEventPolling, useRugSignals, useMilestoneLockState, useMilestoneConfig, useContractWrites } from '../hooks/useWeb3.ts'
import { isValidAddress, formatAddress } from '../utils/format.ts'
import { SIGNAL_LABELS, UNICHAIN_EXPLORER, LASNA_EXPLORER, POOL_SWAP_TEST_ADDRESS } from '../config/constants.ts'
import { buildPoolKey } from '../utils/pool.ts'
import { parseUnits } from 'viem'
import { Search, Shield, Activity, AlertTriangle, Clock, Unlock, Lock, ChevronRight, ExternalLink, Rocket, Wallet, Eye, BarChart3 } from 'lucide-react'

export function InvestorDashboard() {
  const { address: routeAddress } = useParams<{ address: string }>()
  const navigate = useNavigate()
  const { selectedAddress, setSelectedAddress, events } = useVerifyStore()
  const [searchInput, setSearchInput] = useState(routeAddress || '')

  /* ── Connected wallet ── */
  const { address: connectedAddress, isConnected } = useWallet()
  const { isWrongNetwork, ensureCorrectNetwork } = useWallet()
  const { approveToken, swapInPool } = useContractWrites()
  const [publicSwapAmount, setPublicSwapAmount] = useState('1')
  const [swapPending, setSwapPending] = useState(false)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [swapTx, setSwapTx] = useState<string | null>(null)
  const UNICHAIN_USDC = '0x11aFfEac94B440C3c332813450db66fb3285BFB2' as `0x${string}`

  /* ── View address = searched or route ── */
  const viewAddress = selectedAddress || routeAddress

  /* ── Auto-load connected wallet's position ── */
  const { data: myPositionData, loading: myPosLoading } = usePositionData(
    isConnected && connectedAddress ? (connectedAddress as `0x${string}`) : undefined,
  )
  const myTokenAddr = myPositionData?.tokenAddr
  const { info: myTokenInfo } = useTokenInfo(
    myTokenAddr && myTokenAddr !== '0x0000000000000000000000000000000000000000' ? myTokenAddr : undefined,
  )
  const { score: myRiskScore } = useRiskScore(
    isConnected && connectedAddress ? connectedAddress : undefined,
  )

  /* ── Searched address position ── */
  const { data: positionData, loading: posLoading, error: posError, resolvedTeam } = usePositionData(viewAddress || undefined)
  const readAddress = resolvedTeam || viewAddress
  const { score: riskScore, tier: riskTier } = useRiskScore(readAddress || undefined)
  const { occurredSignals, lastTxBySignal, triggerMetaBySignal } = useRugSignals(readAddress || undefined)
  const { lockedMilestones, unlockedMilestones, unlockTxByMilestone } = useMilestoneLockState(readAddress || undefined)
  const { milestones: configuredMilestones, loading: milestoneConfigLoading, error: milestoneConfigError } = useMilestoneConfig(readAddress || undefined)
  const tokenAddr = positionData?.tokenAddr
  const { info: tokenInfo } = useTokenInfo(
    tokenAddr && tokenAddr !== '0x0000000000000000000000000000000000000000' ? tokenAddr : undefined,
  )
  useHookEventPolling(readAddress || undefined)

  /* ── Has a valid launched pool? ── */
  const hasMyPool = myPositionData && myPositionData.team !== '0x0000000000000000000000000000000000000000' && myPositionData.registeredAt > 0n
  const isViewingSelf = viewAddress?.toLowerCase() === connectedAddress?.toLowerCase()

  useEffect(() => {
    if (routeAddress && isValidAddress(routeAddress)) {
      setSelectedAddress(routeAddress)
    }
  }, [routeAddress])

  /* ── Auto-navigate to own pool when connected and no route address ── */
  useEffect(() => {
    if (isConnected && connectedAddress && hasMyPool && !routeAddress && !selectedAddress) {
      setSelectedAddress(connectedAddress)
      setSearchInput(connectedAddress)
      navigate(`/verify/${connectedAddress}`, { replace: true })
    }
  }, [isConnected, connectedAddress, hasMyPool, routeAddress, selectedAddress])

  const handleSearch = () => {
    if (searchInput && isValidAddress(searchInput)) {
      setSelectedAddress(searchInput)
      navigate(`/verify/${searchInput}`)
    }
  }

  const handleViewMyPool = () => {
    if (connectedAddress) {
      setSearchInput(connectedAddress)
      setSelectedAddress(connectedAddress)
      navigate(`/verify/${connectedAddress}`)
    }
  }

  const handlePublicSwap = async () => {
    if (!isConnected || !connectedAddress) {
      setSwapError('Connect wallet to submit a swap')
      return
    }
    if (!positionData?.tokenAddr || positionData.tokenAddr === '0x0000000000000000000000000000000000000000') {
      setSwapError('No valid pool token found for this team')
      return
    }

    if (isWrongNetwork) {
      ensureCorrectNetwork()
      setSwapError('Switched network request sent. Confirm Unichain Sepolia in wallet and retry.')
      return
    }

    let amountIn: bigint
    try {
      amountIn = parseUnits(publicSwapAmount || '1', 6)
      if (amountIn <= 0n) throw new Error('invalid amount')
    } catch {
      setSwapError('Enter a valid USDC amount')
      return
    }

    setSwapPending(true)
    setSwapError(null)
    setSwapTx(null)

    try {
      const poolKey = buildPoolKey(UNICHAIN_USDC, positionData.tokenAddr, 0.3)
      await approveToken(UNICHAIN_USDC, POOL_SWAP_TEST_ADDRESS as `0x${string}`, amountIn)
      const receipt = await swapInPool(poolKey, UNICHAIN_USDC, amountIn)
      setSwapTx(receipt.transactionHash)
    } catch (err: any) {
      setSwapError(err?.shortMessage ?? err?.message ?? 'Swap failed')
    } finally {
      setSwapPending(false)
    }
  }

  const inp = "w-full bg-white dark:bg-[#111] border-4 border-black dark:border-white px-4 py-3 font-mono text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-shadow"

  const signals = [
    { id: 'S1', label: SIGNAL_LABELS?.[0] ?? 'LP removal via DEX', icon: Unlock, color: 'bg-[#DFFF00]' },
    { id: 'S2', label: SIGNAL_LABELS?.[1] ?? 'Treasury drain', icon: AlertTriangle, color: 'bg-[#FF3333] text-white' },
    { id: 'S3', label: SIGNAL_LABELS?.[2] ?? 'Wallet clustering', icon: Activity, color: 'bg-black text-white dark:bg-white dark:text-black' },
    { id: 'S4', label: SIGNAL_LABELS?.[3] ?? 'Social silence', icon: Clock, color: 'bg-gray-200 dark:bg-[#1A1A1A]' },
    { id: 'S5', label: SIGNAL_LABELS?.[4] ?? 'Code mutation', icon: Shield, color: 'bg-[#DFFF00]' },
  ]

  const getRiskColor = (score: number) => {
    if (score <= 30) return { bg: 'bg-[#DFFF00]', text: 'text-black', label: 'LOW RISK' }
    if (score <= 60) return { bg: 'bg-black dark:bg-white', text: 'text-[#DFFF00] dark:text-black', label: 'MEDIUM' }
    return { bg: 'bg-[#FF3333]', text: 'text-white', label: 'HIGH RISK' }
  }

  const nowSec = BigInt(Math.floor(Date.now() / 1000))
  const inferredFromLock =
    positionData?.lockExtendedUntil && positionData.lockExtendedUntil > nowSec
      ? {
          score: positionData.lockExtendedUntil - nowSec > 7n * 24n * 60n * 60n ? 75 : 50,
          tier: positionData.lockExtendedUntil - nowSec > 7n * 24n * 60n * 60n ? 3 : 2,
        }
      : null

  const displayRiskScore = riskScore > 0 || riskTier > 0 ? riskScore : (inferredFromLock?.score ?? 0)
  const displayRiskTier = riskScore > 0 || riskTier > 0 ? riskTier : (inferredFromLock?.tier ?? 0)

  const riskInfo = getRiskColor(displayRiskScore)
  const myRiskInfo = getRiskColor(myRiskScore)
  const riskTierLabel = displayRiskTier === 0 ? 'SAFE' : displayRiskTier === 1 ? 'WATCH' : displayRiskTier === 2 ? 'ALERT' : 'RAGE'
  const occurredSignalSet = new Set(occurredSignals)
  const occurredSignalText = occurredSignals.length > 0 ? occurredSignals.join(', ') : 'None'
  const lockedMilestoneText = lockedMilestones.length > 0 ? lockedMilestones.map((m) => `M${m}`).join(', ') : 'None'
  const unlockedMilestoneText = unlockedMilestones.length > 0 ? unlockedMilestones.map((m) => `M${m}`).join(', ') : 'None'
  const conditionLabel = (type: number) => type === 0 ? 'TVL' : type === 1 ? 'VOLUME' : type === 2 ? 'USERS' : 'UNKNOWN'
  const formatUsdcShort = (raw: bigint) => {
    if (raw === 0n) return '$0'

    let whole = raw

    // Backward-compatible formatting for mixed threshold units:
    // - 18 decimals (wei-like)
    // - 6 decimals (USDC-like)
    // - plain integer dollars
    if (raw >= 10n ** 18n && raw % (10n ** 18n) === 0n) {
      whole = raw / 10n ** 18n
    } else if (raw >= 10n ** 6n && raw % (10n ** 6n) === 0n) {
      whole = raw / 10n ** 6n
    }

    if (whole >= 1_000_000_000n) return `$${(Number(whole / 100_000_000n) / 10).toFixed(1)}B`
    if (whole >= 1_000_000n) return `$${(Number(whole / 100_000n) / 10).toFixed(1)}M`
    if (whole >= 1_000n) return `$${(Number(whole / 100n) / 10).toFixed(1)}K`
    return `$${whole.toString()}`
  }
  const formatMilestoneThreshold = (conditionType: number, threshold: bigint) => {
    if (conditionType === 0 || conditionType === 1) return `${formatUsdcShort(threshold)} USDC`
    return threshold.toString()
  }
  const milestoneFallbackSub = milestoneConfigError
    ? `Config unavailable: ${milestoneConfigError}`
    : milestoneConfigLoading
      ? 'Loading milestone config...'
      : 'Awaiting milestone config'
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
        sub: milestoneFallbackSub,
      }))
  const poolStatus = !positionData
    ? 'No pool loaded'
    : positionData.team === '0x0000000000000000000000000000000000000000'
      ? 'No position found'
      : positionData.lockExtendedUntil > 0n
        ? 'Lock extension active'
        : 'Monitoring normally'
  const lockUntilText = positionData?.lockExtendedUntil && positionData.lockExtendedUntil > 0n
    ? new Date(Number(positionData.lockExtendedUntil) * 1000).toLocaleString()
    : 'No extension'

  const formatLp = (amt: bigint) => {
    if (amt === 0n) return '0'
    const str = amt.toString()
    if (str.length > 18) {
      const whole = str.slice(0, str.length - 18) || '0'
      const frac = str.slice(str.length - 18, str.length - 14)
      return `${Number(whole).toLocaleString()}.${frac}`
    }
    return str
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-black dark:text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <span className="inline-block bg-black text-[#DFFF00] font-black uppercase text-xs px-4 py-1 border-2 border-black mb-3">Investor Dashboard</span>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Pool Control Center</h1>
            <p className="font-mono text-sm text-gray-600 dark:text-gray-400 mt-1">Track one team at a time: status, risk, unlocks, and live events.</p>
          </div>
          <div className="border-4 border-black dark:border-white px-4 py-2 bg-[#DFFF00] text-black font-mono text-xs">
            Real on-chain data
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
         *  YOUR LAUNCHED POOL — auto-detected from connected wallet
         * ═══════════════════════════════════════════════════════════════════ */}
        {isConnected && !myPosLoading && hasMyPool && !isViewingSelf && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <Rocket className="w-5 h-5 stroke-[2.5]" />
              <h2 className="font-black uppercase text-xl tracking-tight">Your Launched Pool</h2>
              <span className="bg-[#DFFF00] text-black text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black">LIVE</span>
            </div>
            <div
              onClick={handleViewMyPool}
              className="bg-white dark:bg-[#111] border-4 border-black dark:border-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] p-6 cursor-pointer hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[10px_10px_0px_0px_rgba(255,255,255,1)] transition-all group"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                {/* Token Badge */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-16 h-16 border-4 border-black dark:border-white bg-[#DFFF00] flex items-center justify-center shrink-0">
                    <span className="font-black text-xl text-black">{myTokenInfo?.symbol?.slice(0, 3) ?? '???'}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black uppercase text-lg truncate">{myTokenInfo?.name ?? 'Unknown Token'}</h3>
                    <p className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate">{myPositionData!.tokenAddr}</p>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="flex flex-wrap gap-4 md:ml-auto">
                  <div className="border-4 border-black dark:border-white px-4 py-2 min-w-[120px]">
                    <p className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">LP Locked</p>
                    <p className="font-black text-lg font-mono">{formatLp(myPositionData!.lpAmount)}</p>
                  </div>
                  <div className="border-4 border-black dark:border-white px-4 py-2 min-w-[120px]">
                    <p className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">Unlocked</p>
                    <p className="font-black text-lg font-mono">{myPositionData!.unlockedPct}%</p>
                  </div>
                  <div className={`border-4 border-black dark:border-white px-4 py-2 min-w-[100px] ${myRiskInfo.bg} ${myRiskInfo.text}`}>
                    <p className="text-[10px] font-bold uppercase opacity-70">Risk</p>
                    <p className="font-black text-lg font-mono">{myRiskScore}/100</p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="hidden md:flex items-center">
                  <ChevronRight className="w-8 h-8 stroke-[3] group-hover:translate-x-2 transition-transform" />
                </div>
              </div>

              {/* Unlock Progress */}
              <div className="mt-4">
                <div className="h-4 border-4 border-black dark:border-white bg-gray-200 dark:bg-[#1A1A1A] overflow-hidden">
                  <div
                    className="h-full bg-[#DFFF00] transition-all duration-700"
                    style={{ width: `${myPositionData!.unlockedPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="font-mono text-[10px] text-gray-400">Registered {new Date(Number(myPositionData!.registeredAt) * 1000).toLocaleDateString()}</span>
                  <span className="font-mono text-[10px] text-gray-400">{myPositionData!.unlockedPct}% vested</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading my pool */}
        {isConnected && myPosLoading && (
          <div className="mb-10 border-4 border-black dark:border-white p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-black dark:border-white border-t-[#DFFF00] rounded-full animate-spin mb-3" />
            <p className="font-mono text-gray-500 dark:text-gray-400 text-sm">Loading your pool data...</p>
          </div>
        )}

        {/* No pool yet */}
        {isConnected && !myPosLoading && !hasMyPool && !viewAddress && (
          <div className="mb-10 border-4 border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
            <Wallet className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="font-black uppercase text-gray-400 dark:text-gray-500 mb-1">No Launched Pool Found</p>
            <p className="font-mono text-xs text-gray-400 dark:text-gray-500">
              Connected as <span className="font-bold">{formatAddress(connectedAddress!)}</span> — go to{' '}
              <Link to="/launch" className="underline text-[#DFFF00] hover:text-black dark:hover:text-white">Launch</Link> to create one
            </p>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white dark:bg-[#111] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-6 mb-8">
          <label className="block font-bold uppercase tracking-wider text-sm mb-2">Search Any Address</label>
          <div className="flex gap-3">
            <input
              className={`${inp} flex-1`}
              placeholder="0x..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="font-bold uppercase tracking-wide border-4 border-black px-8 py-3 bg-[#DFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:translate-x-0 active:shadow-none transition-all flex items-center gap-2"
            >
              <Search className="w-5 h-5 stroke-[3]" />
              SEARCH
            </button>
          </div>

          {/* Quick view own pool link */}
          {isConnected && hasMyPool && !isViewingSelf && (
            <button
              onClick={handleViewMyPool}
              className="mt-3 font-mono text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 transition-colors"
            >
              <Eye className="w-3 h-3" /> or view your own pool ({formatAddress(connectedAddress!)})
            </button>
          )}

          {resolvedTeam && viewAddress && resolvedTeam.toLowerCase() !== viewAddress.toLowerCase() && (
            <p className="mt-3 font-mono text-xs text-[#DFFF00]">
              Resolved this contract address to team wallet {formatAddress(resolvedTeam)} for dashboard reads.
            </p>
          )}
        </div>

        {/* Loading */}
        {posLoading && viewAddress && (
          <div className="border-4 border-black dark:border-white p-12 text-center mb-8">
            <div className="inline-block w-8 h-8 border-4 border-black dark:border-white border-t-[#DFFF00] rounded-full animate-spin mb-4" />
            <p className="font-mono text-gray-600 dark:text-gray-400">Reading on-chain position...</p>
          </div>
        )}

        {/* Error */}
        {posError && (
          <div className="border-4 border-[#FF3333] p-6 mb-8 dark:bg-[#111]">
            <p className="text-[#FF3333] font-mono font-bold">{posError}</p>
          </div>
        )}

        {/* Position Data */}
        {positionData && !posLoading && (
          <div className="space-y-6">

            {/* Public interaction widget */}
            <div className="bg-white dark:bg-[#111] border-4 border-black dark:border-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
              <h3 className="font-black uppercase text-lg mb-4 border-b-4 border-black dark:border-white pb-2">Public Demo Swap</h3>
              <p className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-4">
                Anyone can interact with this pool from this UI. This submits a real on-chain swap: USDC → project token.
              </p>
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                <input
                  className={`${inp} md:max-w-[220px]`}
                  value={publicSwapAmount}
                  onChange={(e) => setPublicSwapAmount(e.target.value)}
                  placeholder="USDC amount"
                />
                <button
                  onClick={handlePublicSwap}
                  disabled={swapPending}
                  className="font-bold uppercase tracking-wide border-4 border-black px-6 py-3 bg-[#DFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:translate-x-0 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {swapPending ? 'Swapping...' : 'Swap USDC → Token'}
                </button>
              </div>
              {swapError && (
                <p className="mt-3 font-mono text-xs text-[#FF3333]">{swapError}</p>
              )}
              {swapTx && (
                <a
                  href={`${UNICHAIN_EXPLORER}/tx/${swapTx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 font-mono text-xs hover:text-[#DFFF00]"
                >
                  Swap tx: {swapTx.slice(0, 10)}... <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Top KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border-4 border-black dark:border-white p-4 bg-[#DFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-[10px] uppercase font-bold opacity-70">Risk Score</p>
                <p className="font-black text-3xl leading-none mt-1">{displayRiskScore}</p>
                <p className="font-mono text-[10px] mt-1">Tier: {riskTierLabel}</p>
              </div>
              <div className="border-4 border-black dark:border-white p-4 bg-white dark:bg-[#111] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                <p className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Unlocked</p>
                <p className="font-black text-3xl leading-none mt-1">{positionData.unlockedPct}%</p>
                <p className="font-mono text-[10px] mt-1 text-gray-500 dark:text-gray-400">Current vesting released</p>
              </div>
              <div className="border-4 border-black dark:border-white p-4 bg-white dark:bg-[#111] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                <p className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">LP Locked</p>
                <p className="font-black text-2xl leading-none mt-1 font-mono">{formatLp(positionData.lpAmount)}</p>
                <p className="font-mono text-[10px] mt-1 text-gray-500 dark:text-gray-400">Raw on-chain LP amount</p>
              </div>
              <div className={`border-4 border-black dark:border-white p-4 ${positionData.lockExtendedUntil > 0n ? 'bg-[#FF3333] text-white' : 'bg-black text-[#DFFF00] dark:bg-white dark:text-black'} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
                <p className="text-[10px] uppercase font-bold opacity-70">Pool Status</p>
                <p className="font-black text-base leading-tight mt-1">{poolStatus}</p>
                <p className="font-mono text-[10px] mt-1 opacity-80">{lockUntilText}</p>
              </div>
            </div>

            {/* Viewing own pool badge */}
            {isViewingSelf && (
              <div className="flex items-center gap-2 px-4 py-2 bg-[#DFFF00] border-4 border-black">
                <Rocket className="w-4 h-4 stroke-[2.5]" />
                <span className="font-black uppercase text-sm text-black">Viewing Your Pool</span>
                <span className="font-mono text-xs text-black/60 ml-auto">{formatAddress(connectedAddress!)}</span>
              </div>
            )}

            {/* Main dashboard grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Left rail */}
              <div className="xl:col-span-3 space-y-6">
                <div className="bg-white dark:bg-[#111] border-4 border-black dark:border-white p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                  <h3 className="font-black uppercase text-sm mb-4 border-b-4 border-black dark:border-white pb-2">Project</h3>
                  <div className="space-y-3 font-mono text-xs">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Team</p>
                      <p className="font-black">{formatAddress(positionData.team)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Token</p>
                      <p className="font-black">{tokenInfo?.name ?? 'Unknown'} ({tokenInfo?.symbol ?? '—'})</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Registered</p>
                      <p className="font-black">{positionData.registeredAt > 0n ? new Date(Number(positionData.registeredAt) * 1000).toLocaleDateString() : '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#111] border-4 border-black dark:border-white p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                  <h3 className="font-black uppercase text-sm mb-4 border-b-4 border-black dark:border-white pb-2">Risk Gauge</h3>
                  <div className="flex items-center gap-4">
                    <div className={`w-24 h-24 border-4 border-black dark:border-white ${riskInfo.bg} ${riskInfo.text} flex flex-col items-center justify-center`}>
                      <span className="font-black text-3xl leading-none">{displayRiskScore}</span>
                      <span className="font-bold text-[10px]">/100</span>
                    </div>
                    <div>
                      <p className="font-black uppercase text-sm">{riskInfo.label}</p>
                      <p className="font-mono text-xs text-gray-500 dark:text-gray-400">Dispatch tier: {riskTierLabel}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center */}
              <div className="xl:col-span-6 space-y-6">
                <div className="bg-white dark:bg-[#111] border-4 border-black dark:border-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                  <h3 className="font-black uppercase text-lg mb-4 border-b-4 border-black dark:border-white pb-2 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" /> Vesting Progress
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span>Unlocked</span>
                        <span className="font-black">{positionData.unlockedPct}%</span>
                      </div>
                      <div className="h-7 border-4 border-black dark:border-white bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden">
                        <div className="h-full bg-[#DFFF00]" style={{ width: `${positionData.unlockedPct}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {milestoneCards.map((m) => {
                        const done = m.done
                        return (
                          <div key={m.key} className={`border-4 border-black dark:border-white p-3 ${done ? 'bg-[#DFFF00] text-black' : 'bg-white dark:bg-[#0A0A0A]'}`}>
                            <p className="text-[10px] font-bold uppercase">Milestone {m.key}</p>
                            <p className="font-black text-lg">{m.pct}%</p>
                            <p className="font-mono text-[10px]">{done ? 'Completed' : 'Pending'}</p>
                            <p className="font-mono text-[10px] opacity-70 mt-1 truncate">{m.sub}</p>
                          </div>
                        )
                      })}
                    </div>
                    <div className="border-2 border-black dark:border-white p-3 bg-gray-50 dark:bg-[#0A0A0A]">
                      {milestoneConfigError && (
                        <p className="font-mono text-[10px] text-[#FF3333] mb-2">
                          Milestone config read failed. Showing fallback thresholds.
                        </p>
                      )}
                      <p className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Milestone lock state</p>
                      <p className="font-mono text-xs mt-1">Locked: <span className="font-black">{lockedMilestoneText}</span></p>
                      <p className="font-mono text-xs">Unlocked: <span className="font-black">{unlockedMilestoneText}</span></p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {unlockedMilestones.map((m) => {
                          const key = `M${m}`
                          const tx = unlockTxByMilestone[key]
                          if (!tx) return null
                          return (
                            <a
                              key={key}
                              href={`${UNICHAIN_EXPLORER}/tx/${tx}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] inline-flex items-center gap-1 border-2 border-black dark:border-white px-2 py-1 hover:text-[#DFFF00]"
                            >
                              {key} unlock tx <ExternalLink className="w-3 h-3" />
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#111] border-4 border-black dark:border-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                  <h3 className="font-black uppercase text-lg mb-4 border-b-4 border-black dark:border-white pb-2 flex items-center gap-2">
                    <Activity className="w-5 h-5" /> Signal Watchlist
                  </h3>
                  <p className="font-mono text-[11px] mb-3 text-gray-500 dark:text-gray-400">Occurred: <span className="font-black text-black dark:text-white">{occurredSignalText}</span></p>
                  <div className="overflow-x-auto">
                    <table className="w-full font-mono text-xs border-separate border-spacing-y-2">
                      <thead>
                        <tr>
                          <th className="text-left uppercase text-[10px] text-gray-500 dark:text-gray-400">Signal</th>
                          <th className="text-left uppercase text-[10px] text-gray-500 dark:text-gray-400">Condition</th>
                          <th className="text-left uppercase text-[10px] text-gray-500 dark:text-gray-400">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {signals.map((sig) => {
                          const triggered = occurredSignalSet.has(sig.id)
                          const triggerMeta = triggerMetaBySignal[sig.id]
                          return (
                          <tr key={sig.id} className="bg-gray-50 dark:bg-[#0A0A0A]">
                            <td className="border-2 border-black dark:border-white px-3 py-2 font-black">{sig.id}</td>
                            <td className="border-2 border-black dark:border-white px-3 py-2">{sig.label}</td>
                            <td className="border-2 border-black dark:border-white px-3 py-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-1 border-2 border-black dark:border-white font-bold uppercase text-[10px] ${triggered ? 'bg-[#FF3333] text-white' : 'bg-white dark:bg-[#111]'}`}>
                                  {triggered ? 'Triggered' : 'Monitoring'}
                                </span>
                                {triggered && triggerMeta && (
                                  <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                                    {triggerMeta.label}{typeof triggerMeta.points === 'number' ? ` (+${triggerMeta.points})` : ''}
                                  </span>
                                )}
                                {triggered && lastTxBySignal[sig.id] && (
                                  <a
                                    href={`${triggerMeta?.source === 'rsc' ? LASNA_EXPLORER : UNICHAIN_EXPLORER}/tx/${lastTxBySignal[sig.id]}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] inline-flex items-center gap-1 hover:text-[#DFFF00]"
                                  >
                                    tx <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right */}
              <div className="xl:col-span-3 space-y-6">
                <div className="bg-white dark:bg-[#111] border-4 border-black dark:border-white p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                  <h3 className="font-black uppercase text-sm mb-4 border-b-4 border-black dark:border-white pb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Quick Facts
                  </h3>
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Risk Tier</span><span className="font-black">{riskTierLabel}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Unlock %</span><span className="font-black">{positionData.unlockedPct}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Lock State</span><span className="font-black">{positionData.lockExtendedUntil > 0n ? 'Extended' : 'Normal'}</span></div>
                  </div>
                </div>

                {/* Event Log */}
                <div className="bg-white dark:bg-[#111] border-4 border-black dark:border-white p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
                  <h3 className="font-black uppercase text-sm mb-4 border-b-4 border-black dark:border-white pb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Live Event Feed
                  </h3>
                  {events.length === 0 ? (
                    <p className="font-mono text-xs text-gray-500 dark:text-gray-400">No events yet. Waiting for chain activity.</p>
                  ) : (
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {events.map((evt) => (
                        <div key={evt.id} className="border-2 border-black dark:border-white p-2 bg-gray-50 dark:bg-[#0A0A0A]">
                          <p className="font-black text-[10px] uppercase">{evt.eventType}</p>
                          <p className="font-mono text-[10px] text-gray-600 dark:text-gray-400 truncate">{evt.description}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                            {evt.txHash && (
                              <a href={`${UNICHAIN_EXPLORER}/tx/${evt.txHash}`} target="_blank" rel="noopener noreferrer" className="text-[10px] hover:text-[#DFFF00] inline-flex items-center gap-1">
                                tx <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State — not connected */}
        {!isConnected && !viewAddress && !posLoading && (
          <div className="border-4 border-dashed border-gray-300 dark:border-gray-600 p-16 text-center">
            <Wallet className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600 stroke-[1.5]" />
            <p className="font-black uppercase text-xl text-gray-300 dark:text-gray-600 mb-2">Connect Your Wallet</p>
            <p className="font-mono text-gray-400 text-sm">Connect your wallet to see your launched pools, or search any address above</p>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useVerifyStore } from '../store/verifyStore'
import { usePositionData, useRiskScore, useTokenInfo, useHookEventPolling } from '../hooks/useWeb3'
import { Card } from '../components/Card'
import { ProgressBar } from '../components/ProgressBar'
import { Badge } from '../components/Badge'
import { Search, Siren, Target, ShieldCheck, ScrollText, Copy, Check, Loader2 } from 'lucide-react'
import { isValidAddress, formatAddress } from '../utils/format'
import { SIGNAL_LABELS, UNICHAIN_EXPLORER, VESTING_HOOK_ADDRESS } from '../config/constants'

export function InvestorDashboard() {
  const { address: routeAddress } = useParams()
  const { selectedAddress, setSelectedAddress, poolData, setPoolData, events } = useVerifyStore()
  const [searchInput, setSearchInput] = useState(routeAddress || '')
  const [copied, setCopied] = useState(false)

  // Resolved team address to query
  const queryAddr = selectedAddress || routeAddress

  // On-chain hooks
  const { data: position, loading: posLoading, error: posError } = usePositionData(queryAddr)
  const { score: riskScore, tier: riskTier } = useRiskScore(queryAddr)
  const tokenAddr = position?.tokenAddr as `0x${string}` | undefined
  const { info: tokenInfo } = useTokenInfo(
    tokenAddr && tokenAddr !== '0x0000000000000000000000000000000000000000' ? tokenAddr : undefined,
  )
  const { isPolling } = useHookEventPolling(queryAddr)

  // When position data comes in, map it to the store shape
  useEffect(() => {
    if (!position || position.team === '0x0000000000000000000000000000000000000000') {
      if (!posLoading && queryAddr) setPoolData(null)
      return
    }

    const lockUntil = Number(position.lockExtendedUntil)
    const now = Math.floor(Date.now() / 1000)

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
    })
  }, [position, tokenInfo, riskScore, posLoading, queryAddr, setPoolData])

  const handleSearch = () => {
    if (!searchInput || !isValidAddress(searchInput)) return
    setSelectedAddress(searchInput)
  }

  useEffect(() => {
    if (routeAddress && isValidAddress(routeAddress)) {
      setSearchInput(routeAddress)
      setSelectedAddress(routeAddress)
    }
  }, [routeAddress, setSelectedAddress])

  const handleCopy = () => {
    const url = `${window.location.origin}/verify/${searchInput}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const riskColor = (score: number) =>
    score < 25 ? 'brand' : score < 50 ? 'neon-yellow' : score < 75 ? 'neon-orange' : 'neon-red'

  const loading = posLoading

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Header + Search */}
      <div className="mb-12 animate-fade-up opacity-0">
        <Badge variant="purple" pulse className="mb-4">INVESTOR DASHBOARD</Badge>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Verify a Project</h1>
        <p className="text-white/30 mb-8">Paste a team address to check their vesting position</p>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input
              className="input-glow w-full !pl-12 font-mono"
              placeholder="0x... (team wallet address)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button className="btn-primary px-8 py-3" onClick={handleSearch} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="animate-spin h-4 w-4" />
                Searching
              </span>
            ) : 'Search'}
          </button>
        </div>

        {VESTING_HOOK_ADDRESS === '0x0000000000000000000000000000000000000000' && (
          <p className="text-neon-orange/60 text-xs mt-3 font-mono">⚠ Hook not deployed — set VITE_HOOK_ADDRESS in .env</p>
        )}
      </div>

      {poolData && (
        <div className="space-y-6">
          {/* Rage Lock Banner */}
          {poolData.lockExtendedUntil && (
            <div className="animate-fade-up opacity-0 p-5 rounded-2xl bg-red-500/5 border border-red-500/30 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500 animate-pulse" />
              <div className="flex items-start gap-4 ml-4">
                <Siren className="w-8 h-8 text-red-400 flex-shrink-0" />
                <div>
                  <h3 className="font-black text-red-400 text-lg mb-1">RAGE LOCK ACTIVE</h3>
                  <p className="text-red-200/60 text-sm mb-1">
                    Lock extended until <span className="text-red-300 font-mono">{poolData.lockExtendedUntil}</span>
                  </p>
                  <p className="text-red-200/40 text-sm">
                    The Reactive Smart Contract triggered a lock extension due to elevated risk signals.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Lock Status Card */}
          <Card variant="glow" className="!p-8 animate-fade-up opacity-0">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-3xl font-black text-white">{poolData.projectName}</h2>
                <p className="text-white/30 font-mono text-sm mt-1">${poolData.tokenSymbol} / {poolData.pairToken} · {poolData.feeTier}% fee</p>
              </div>
              <Badge
                variant={poolData.lockExtendedUntil ? 'error' : poolData.unlockPercentage === 100 ? 'success' : 'success'}
                pulse={!poolData.lockExtendedUntil && poolData.unlockPercentage < 100}
              >
                {poolData.lockExtendedUntil ? 'RAGE LOCKED' : poolData.unlockPercentage === 100 ? 'FULLY UNLOCKED' : 'ACTIVE'}
              </Badge>
            </div>

            {/* 2x2 Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total LP Locked', value: poolData.totalLocked > 0 ? poolData.totalLocked.toLocaleString() : '0', color: 'text-white', sub: <a href={`${UNICHAIN_EXPLORER}/address/${VESTING_HOOK_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-brand/60 hover:text-brand transition">Verify on-chain ↗</a> },
                { label: 'Currently Unlocked', value: `${poolData.unlockPercentage}%`, color: 'text-brand', sub: `${poolData.currentUnlocked.toLocaleString()} released` },
                { label: 'Lock Extended', value: poolData.lockExtendedUntil || 'Never', color: 'text-white', sub: poolData.lockExtendedUntil ? 'RSC-triggered extension' : 'No extensions triggered' },
                { label: 'Risk Score', value: `${poolData.riskScore}/100`, color: `text-${riskColor(poolData.riskScore)}`, sub: poolData.riskScore === 0 ? 'All signals clear' : 'Active signals detected' },
              ].map((stat, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-2">{stat.label}</p>
                  <p className={`text-2xl font-black font-mono ${stat.color}`}>{stat.value}</p>
                  <div className="text-white/20 text-xs mt-1">{stat.sub}</div>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">Overall Unlock Progress</p>
              <ProgressBar value={poolData.unlockPercentage} color="gradient" size="lg" showLabel />
            </div>
          </Card>

          {/* Risk Score Panel */}
          <Card className="!p-8 animate-fade-up opacity-0">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Risk Score Analysis</h3>
                <p className="text-white/30 text-sm">5-signal composite monitored by Reactive Smart Contracts on Lasna</p>
              </div>
            </div>

            {/* Gauge */}
            <div className="p-6 rounded-xl bg-void-50 border border-white/5 mb-6">
              <div className="flex items-end justify-between mb-4">
                <span className="text-white/40 text-sm">Risk Level</span>
                <span className={`text-4xl font-black font-mono text-${riskColor(poolData.riskScore)}`}>
                  {poolData.riskScore}
                </span>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden relative">
                <div className="absolute inset-0 flex">
                  <div className="flex-1 bg-brand/20" />
                  <div className="flex-1 bg-neon-yellow/20" />
                  <div className="flex-1 bg-neon-orange/20" />
                  <div className="flex-1 bg-neon-red/20" />
                </div>
                <div
                  className={`h-full rounded-full relative z-10 transition-all duration-1000 ${
                    poolData.riskScore < 25 ? 'bg-brand shadow-[0_0_12px_rgba(0,230,118,0.5)]' :
                    poolData.riskScore < 50 ? 'bg-neon-yellow shadow-[0_0_12px_rgba(234,179,8,0.5)]' :
                    poolData.riskScore < 75 ? 'bg-neon-orange shadow-[0_0_12px_rgba(249,115,22,0.5)]' :
                    'bg-neon-red shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                  }`}
                  style={{ width: `${Math.max(poolData.riskScore, 2)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/20 mt-2 font-mono">
                <span>0 SAFE</span><span>25</span><span>50</span><span>75</span><span>100 DANGER</span>
              </div>
            </div>

            {/* Signal Rows */}
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((signalId) => {
                const label = SIGNAL_LABELS[signalId]
                // In future, read actual signal states from RSC; for now show all as monitoring
                const isActive = false
                return (
                  <div
                    key={signalId}
                    className={`p-4 rounded-xl flex items-center justify-between text-sm transition-all duration-300 ${
                      isActive
                        ? 'bg-neon-orange/5 border border-neon-orange/20'
                        : 'bg-white/[0.02] border border-white/5 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-mono text-xs font-bold ${isActive ? 'text-neon-orange' : 'text-white/20'}`}>
                        S{signalId + 1}
                      </span>
                      <span className={isActive ? 'text-white' : 'text-white/30'}>{label}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-white/20 text-xs">{isActive ? 'Active' : 'Monitoring'}</span>
                      <span className={`font-mono text-xs ${isActive ? 'text-neon-orange' : 'text-white/15'}`}>
                        {isActive ? '+pts' : '0 pts'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Event Log */}
          <Card className="!p-8 animate-fade-up opacity-0">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                <ScrollText className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Event Log</h3>
                <p className="text-white/30 text-sm">
                  On-chain events for this position
                  {isPolling && <span className="ml-2 text-brand text-xs">● Live</span>}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {events.length === 0 ? (
                <div className="text-center py-8">
                  <ScrollText className="w-8 h-8 text-white/10 mx-auto mb-2" />
                  <p className="text-white/20 text-sm">No events found yet — events will appear after the first on-chain interaction</p>
                </div>
              ) : (
                events.slice(0, 20).map((event, i) => (
                  <div key={event.id || i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Badge variant={
                          event.eventType === 'MilestoneUnlocked' ? 'success' :
                          event.eventType === 'LockExtended' ? 'error' :
                          event.eventType === 'RiskElevated' ? 'warning' : 'info'
                        }>
                          {event.eventType}
                        </Badge>
                        <span className="text-white/20 text-xs font-mono">Block #{event.blockNumber}</span>
                      </div>
                      <a
                        href={`${UNICHAIN_EXPLORER}/tx/${event.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand/40 text-xs font-mono hover:text-brand cursor-pointer transition"
                      >
                        {event.txHash.slice(0, 10)}... ↗
                      </a>
                    </div>
                    <p className="text-white/50 text-sm">{event.description}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Share Button */}
          <div className="text-center animate-fade-up opacity-0">
            <button className="btn-primary px-8 py-2.5" onClick={handleCopy}>
              {copied ? <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4" /> Copied!</span> : <span className="inline-flex items-center gap-1.5"><Copy className="w-4 h-4" /> Copy Verification Link</span>}
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && queryAddr && (
        <Card className="!p-12 text-center animate-fade-up opacity-0">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin h-8 w-8 text-brand" />
            <p className="text-white/30">Reading on-chain data from Unichain Sepolia...</p>
          </div>
        </Card>
      )}

      {/* Not Found */}
      {!loading && queryAddr && !poolData && posError && (
        <Card className="!p-12 text-center animate-fade-up opacity-0">
          <div className="flex flex-col items-center gap-4">
            <Search className="w-12 h-12 text-white/10" />
            <p className="text-white/30 text-lg">No position found for this address</p>
            <p className="text-white/15 text-sm font-mono">{posError}</p>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!queryAddr && (
        <Card className="!p-16 text-center animate-fade-up opacity-0">
          <div className="flex flex-col items-center gap-4">
            <Search className="w-12 h-12 text-white/10" />
            <p className="text-white/30 text-lg">Enter a team address to begin verification</p>
            <p className="text-white/15 text-sm">Paste the team wallet address that registered the vesting position</p>
          </div>
        </Card>
      )}
    </div>
  )
}
